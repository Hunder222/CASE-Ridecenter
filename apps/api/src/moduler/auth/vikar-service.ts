import crypto from 'node:crypto';
import type { VikarKodeOpdaterInput, VikarKodeOpretSvar, VikarKodePost, VikarLoginBody } from '@ridecenter/contracts';
import argon2 from 'argon2';
import type { PrismaClient } from '@prisma/client';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { logHaendelse } from '../audit/audit-service';
import { opretSession } from './session';
import { DomaeneFejl } from '../../plugins/fejl';
import type { SessionBruger } from '../../plugins/rbac';

export class VikarService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly app: FastifyInstance,
  ) {}

  private static kendteKoder = new Map<string, string>();
  private static vikarMetadata = new Map<string, { navn?: string; fast_vikar?: boolean }>();

  /**
   * Udsteder en ny tilfældig 5-cifret engangskode eller fast vikarkode.
   * Klartekst returneres kun denne ene gang. Kode-hash gemmes med Argon2id.
   * Standard udløb er 90 dage (eller uendelig / konfigureret).
   */
  async udstedVikarKode(
    bruger: SessionBruger,
    input?: { navn?: string; fast_vikar?: boolean; udloeb_dage?: number | null },
  ): Promise<VikarKodeOpretSvar> {
    // Hent alle aktive eller anvendte koder for at garantere mod kodekollision
    const aktiveKoder = await this.prisma.vikarEngangskode.findMany({
      where: { status: { in: ['Aktiv', 'Anvendt'] } },
      select: { kode_hash: true },
    });

    let talkode = '';
    let hash = '';
    for (let forsoeg = 0; forsoeg < 30; forsoeg++) {
      talkode = Math.floor(10000 + Math.random() * 90000).toString();
      // Tjek mod kendte koder i in-memory cache
      if (Array.from(VikarService.kendteKoder.values()).includes(talkode)) {
        continue;
      }
      // Tjek mod eksisterende koder i databasen
      let kolliderer = false;
      for (const k of aktiveKoder) {
        if (await argon2.verify(k.kode_hash, talkode)) {
          kolliderer = true;
          break;
        }
      }
      if (!kolliderer) {
        hash = await argon2.hash(talkode, {
          type: argon2.argon2id,
          memoryCost: 19456,
          timeCost: 2,
        });
        break;
      }
    }

    if (!hash) {
      talkode = Math.floor(10000 + Math.random() * 90000).toString();
      hash = await argon2.hash(talkode, {
        type: argon2.argon2id,
        memoryCost: 19456,
        timeCost: 2,
      });
    }

    const nu = this.app.ur();
    // Hvis udloeb_dage er null/0, sæt til 10 år frem (udløber aldrig)
    const dage = input?.udloeb_dage === null ? 3650 : (input?.udloeb_dage ?? 90);
    const udloeb = new Date(nu.getTime() + dage * 24 * 60 * 60 * 1000);

    const post = await this.prisma.vikarEngangskode.create({
      data: {
        kode_hash: hash,
        udstedt_af: bruger.id,
        udstedt_dato: nu,
        udloebsdato: udloeb,
        anvendt_af_vikarnavn: input?.navn?.trim() || null,
        status: 'Aktiv',
      },
    });

    VikarService.kendteKoder.set(post.id, talkode);
    if (input?.navn || input?.fast_vikar) {
      VikarService.vikarMetadata.set(post.id, {
        navn: input.navn?.trim(),
        fast_vikar: input.fast_vikar ?? false,
      });
    }

    return {
      id: post.id,
      kode: talkode,
      udloebsdato: udloeb.toISOString(),
      navn: input?.navn?.trim() || null,
      fast_vikar: input?.fast_vikar ?? false,
    };
  }

  /**
   * Henter liste af registrerede/aktive faste vikarer til dropdown på tablet.
   */
  async hentAktiveVikarKandidater(): Promise<{ id: string; navn: string; fast_vikar: boolean }[]> {
    const koder = await this.prisma.vikarEngangskode.findMany({
      where: {
        status: { in: ['Aktiv', 'Anvendt'] },
      },
      orderBy: { udstedt_dato: 'desc' },
    });

    const uniktMap = new Map<string, { id: string; navn: string; fast_vikar: boolean }>();

    for (const k of koder) {
      const meta = VikarService.vikarMetadata.get(k.id);
      const erFast = meta?.fast_vikar ?? (k.anvendt_af_vikarnavn?.includes('(Fast vikar)') ?? false);
      const navn = meta?.navn || k.anvendt_af_vikarnavn;
      if (navn && navn.trim().length >= 2) {
        const rentNavn = navn.trim();
        if (!uniktMap.has(rentNavn.toLowerCase())) {
          uniktMap.set(rentNavn.toLowerCase(), {
            id: k.id,
            navn: rentNavn,
            fast_vikar: erFast,
          });
        }
      }
    }

    return Array.from(uniktMap.values());
  }

  /**
   * Henter alle vikarkoder (med klartekstkode hvis kendt fra session eller demo-seed).
   */
  async hentVikarKoder(): Promise<VikarKodePost[]> {
    const koder = await this.prisma.vikarEngangskode.findMany({
      orderBy: { udstedt_dato: 'desc' },
    });

    const demoKandidater = ['12345', '54321', '88899'];
    const resultat: VikarKodePost[] = [];

    for (const k of koder) {
      let kode = VikarService.kendteKoder.get(k.id) ?? null;
      if (!kode) {
        for (const demo of demoKandidater) {
          try {
            if (await argon2.verify(k.kode_hash, demo)) {
              kode = demo;
              VikarService.kendteKoder.set(k.id, demo);
              break;
            }
          } catch {
            // Ignorér ugyldigt hash format
          }
        }
      }

      const meta = VikarService.vikarMetadata.get(k.id);
      const erFast = meta?.fast_vikar ?? (k.anvendt_af_vikarnavn?.includes('(Fast vikar)') ?? false);
      const visningsNavn = meta?.navn ?? k.anvendt_af_vikarnavn;

      resultat.push({
        id: k.id,
        status: k.status,
        udstedt_dato: k.udstedt_dato.toISOString(),
        udloebsdato: k.udloebsdato.toISOString(),
        anvendt_dato: k.anvendt_dato ? k.anvendt_dato.toISOString() : null,
        anvendt_af_vikarnavn: visningsNavn,
        kode,
        navn: visningsNavn,
        fast_vikar: erFast,
      });
    }

    return resultat;
  }

  /**
   * Spærrer en vikarkode.
   */
  async spaerVikarKode(id: string): Promise<void> {
    await this.prisma.vikarEngangskode.update({
      where: { id },
      data: { status: 'Spaerret' },
    });
  }

  /**
   * Opdaterer en vikarkode (navn/titel og/eller konvertering til/fra fast vikar).
   */
  async opdaterVikarKode(id: string, input: VikarKodeOpdaterInput): Promise<VikarKodePost> {
    const eksisterende = await this.prisma.vikarEngangskode.findUnique({ where: { id } });
    if (!eksisterende) {
      throw new DomaeneFejl('IKKE_FUNDET', 'Vikarkode findes ikke', 404);
    }

    const nuvaerendeMeta = VikarService.vikarMetadata.get(id);
    const nytNavn =
      input.navn !== undefined
        ? (input.navn ? input.navn.trim() : null)
        : (nuvaerendeMeta?.navn ?? eksisterende.anvendt_af_vikarnavn);
    const erFast =
      input.fast_vikar !== undefined
        ? input.fast_vikar
        : (nuvaerendeMeta?.fast_vikar ?? (eksisterende.anvendt_af_vikarnavn?.includes('(Fast vikar)') ?? false));

    const dataToUpdate: any = {
      anvendt_af_vikarnavn: nytNavn,
    };

    // Hvis koden laves til fast vikar og er udløbet eller udløber inden for 30 dage, forlæng den til 10 år frem
    const nu = this.app.ur();
    if (erFast && eksisterende.udloebsdato < new Date(nu.getTime() + 30 * 24 * 60 * 60 * 1000)) {
      dataToUpdate.udloebsdato = new Date(nu.getTime() + 3650 * 24 * 60 * 60 * 1000);
    }
    // Hvis den var udløbet men forlænges/opdateres, genaktivér status hvis den ikke er spærret
    if (eksisterende.status === 'Udloebet' && erFast) {
      dataToUpdate.status = 'Aktiv';
    }

    await this.prisma.vikarEngangskode.update({
      where: { id },
      data: dataToUpdate,
    });

    VikarService.vikarMetadata.set(id, {
      navn: nytNavn ?? undefined,
      fast_vikar: erFast,
    });

    const alle = await this.hentVikarKoder();
    const fundet = alle.find((k) => k.id === id);
    if (!fundet) throw new DomaeneFejl('IKKE_FUNDET', 'Kunne ikke hente opdateret vikarkode', 404);
    return fundet;
  }

  /**
   * Vikar logger ind med 6-cifret engangskode og sit navn.
   * Koden opdateres straks til Anvendt.
   * Session oprettes til kl. 23:59 i dag.
   * Opretter DashboardNotifikation(VIKAR_LOGIN).
   */
  async loginVikar(
    body: VikarLoginBody,
    enhedId: string,
    request: FastifyRequest,
    reply: FastifyReply,
  ) {
    const nu = this.app.ur();
    const startAfIdag = new Date(nu);
    startAfIdag.setHours(0, 0, 0, 0);

    // 1. Tjek om koden matcher en Aktiv kode
    const aktiveKoder = await this.prisma.vikarEngangskode.findMany({
      where: { status: 'Aktiv' },
    });

    let fundetKode: (typeof aktiveKoder)[0] | null = null;
    for (const k of aktiveKoder) {
      if (await argon2.verify(k.kode_hash, body.vikarkode)) {
        fundetKode = k;
        break;
      }
    }

    // 2. Hvis ikke aktiv, tjek om koden allerede er Anvendt i dag af samme vikar på samme enhed
    let erGenbrugSammeDag = false;
    if (!fundetKode) {
      const anvendteKoder = await this.prisma.vikarEngangskode.findMany({
        where: {
          status: 'Anvendt',
          anvendt_dato: { gte: startAfIdag },
        },
      });

      for (const k of anvendteKoder) {
        if (await argon2.verify(k.kode_hash, body.vikarkode)) {
          // Tjek om navnet matcher (case-insensitive)
          const matchendeNavn =
            k.anvendt_af_vikarnavn &&
            k.anvendt_af_vikarnavn.trim().toLowerCase() === body.fulde_navn.trim().toLowerCase();

          if (matchendeNavn) {
            fundetKode = k;
            erGenbrugSammeDag = true;
            break;
          } else {
            // Forsøg på at genbruge kode med et andet navn -> afvis og opret advarselsnotifikation
            await this.prisma.dashboardNotifikation.create({
              data: {
                type: 'VIKAR_LOGIN',
                payload: {
                  vikar_navn: body.fulde_navn,
                  advarsel: `Forsøg på uautoriseret genbrug af kode tilhørende ${k.anvendt_af_vikarnavn}`,
                  enhed_id: enhedId,
                  tidspunkt: nu.toISOString(),
                  vikarkode_id: k.id,
                  fejlet: true,
                },
              },
            });
            throw new DomaeneFejl(
              'UGYLDIG_VIKARKODE',
              `Koden er allerede anvendt af ${k.anvendt_af_vikarnavn}. Kontakt ledelsen for en ny kode.`,
              401,
            );
          }
        }
      }
    }

    if (!fundetKode) {
      // Opret advarsel til ledelsen om ugyldig indtastning
      await this.prisma.dashboardNotifikation.create({
        data: {
          type: 'VIKAR_LOGIN',
          payload: {
            vikar_navn: body.fulde_navn,
            advarsel: 'Ugyldigt eller ukendt vikarkode-forsøg',
            enhed_id: enhedId,
            tidspunkt: nu.toISOString(),
            fejlet: true,
          },
        },
      });
      throw new DomaeneFejl('UGYLDIG_VIKARKODE', 'Ugyldig eller allerede anvendt vikarkode', 401);
    }

    const meta = fundetKode ? VikarService.vikarMetadata.get(fundetKode.id) : undefined;
    const erFastVikar = meta?.fast_vikar ?? (fundetKode?.anvendt_af_vikarnavn?.includes('(Fast vikar)') ?? false);

    // Hvis koden er forud-tildelt en bestemt fast vikar, tjek at navnet matcher
    if (fundetKode.anvendt_af_vikarnavn && erFastVikar) {
      const tildeltNavn = fundetKode.anvendt_af_vikarnavn.replace(/\s*\(Fast vikar\)\s*/i, '').trim().toLowerCase();
      const indtastetNavn = body.fulde_navn.replace(/\s*\(Fast vikar\)\s*/i, '').trim().toLowerCase();
      if (!tildeltNavn.includes(indtastetNavn) && !indtastetNavn.includes(tildeltNavn)) {
        await this.prisma.dashboardNotifikation.create({
          data: {
            type: 'VIKAR_LOGIN',
            payload: {
              vikar_navn: body.fulde_navn,
              advarsel: `Forsøg på uautoriseret brug af kode udstedt til ${fundetKode.anvendt_af_vikarnavn}`,
              enhed_id: enhedId,
              tidspunkt: nu.toISOString(),
              vikarkode_id: fundetKode.id,
              fejlet: true,
            },
          },
        });
        throw new DomaeneFejl(
          'UGYLDIG_VIKARKODE',
          `Denne vikarkode er udstedt til ${fundetKode.anvendt_af_vikarnavn}. Vælg dit eget navn.`,
          401,
        );
      }
    }

    if (!erGenbrugSammeDag && fundetKode.udloebsdato < nu) {
      await this.prisma.vikarEngangskode.update({
        where: { id: fundetKode.id },
        data: { status: 'Udloebet' },
      });
      throw new DomaeneFejl('VIKARKODE_UDLOEBET', 'Vikarkoden er udløbet', 401);
    }

    // Hvis koden var aktiv, opdater den (fast vikar forbliver Aktiv så koden kan genbruges)
    if (!erGenbrugSammeDag) {
      await this.prisma.vikarEngangskode.update({
        where: { id: fundetKode.id },
        data: {
          status: erFastVikar ? 'Aktiv' : 'Anvendt',
          anvendt_dato: nu,
          anvendt_af_vikarnavn: fundetKode.anvendt_af_vikarnavn || body.fulde_navn,
          anvendt_paa_enhed: enhedId,
        },
      });
    }

    // Opret notifikation VIKAR_LOGIN til ledelsen (hvis ikke allerede adviseret i dag ved gen-oplåsning)
    if (!erGenbrugSammeDag) {
      await this.prisma.dashboardNotifikation.create({
        data: {
          type: 'VIKAR_LOGIN',
          payload: {
            vikar_navn: body.fulde_navn,
            enhed_id: enhedId,
            tidspunkt: nu.toISOString(),
            vikarkode_id: fundetKode.id,
          },
          dedupe_noegle: `VIKAR_LOGIN:${fundetKode.id}`,
        },
      });
    }

    // Opret vikar-session til 23:59
    const udloebIdag = new Date(nu);
    udloebIdag.setHours(23, 59, 59, 999);

    const sikkerCookie = process.env.NODE_ENV === 'production';
    const sessionPayload = opretSession(
      reply,
      {
        id: fundetKode.id,
        navn: `${body.fulde_navn} (Vikar)`,
        roller: ['Vikar'],
      },
      nu,
      sikkerCookie,
      {
        udloeber: udloebIdag,
        enhed_id: enhedId,
      },
    );

    await this.prisma.$transaction(async (tx) => {
      await logHaendelse(tx, {
        handling: 'LOGIN_PIN',
        entitet: 'vikar_engangskode',
        entitet_id: fundetKode.id,
        bruger: { id: fundetKode.id, navn: body.fulde_navn, roller: ['Vikar'] },
        tidspunkt: nu,
        enhed_id: enhedId,
        efter: { navn: body.fulde_navn },
      });
    });

    return sessionPayload;
  }
}
