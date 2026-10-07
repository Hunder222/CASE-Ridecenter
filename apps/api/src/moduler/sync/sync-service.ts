import crypto from 'node:crypto';
import type {
  GodkendOmplaceringPayload,
  KommandoKuvert,
  KommandoResultat,
  KorrigerFremmoedePayload,
  MeldHestStatusPayload,
  PushSvar,
  RegistrerAfbudPayload,
  RegistrerFremmoedePayload,
  RegistrerOenskerPayload,
  VikarLoginPayload,
} from '@ridecenter/contracts';
import { klassificerAfbud } from '@ridecenter/domain';
import type { PrismaClient } from '@prisma/client';
import type { FastifyInstance } from 'fastify';
import { logHaendelse } from '../audit/audit-service';
import { rytterNavn } from '../ryttere/mapper';

export class SyncService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly app: FastifyInstance,
  ) {}

  private beregnSha256(tekst: string): string {
    return crypto.createHash('sha256').update(tekst).digest('hex');
  }

  async behaendlPush(kommandoer: KommandoKuvert[], enhedId: string): Promise<PushSvar> {
    const resultater: KommandoResultat[] = [];
    const nu = this.app.ur();

    for (const k of kommandoer) {
      // 1. Tjek idempotens
      const eksisterendeFremmoede = await this.prisma.fremmoederegistrering.findUnique({
        where: { kommando_id: k.kommando_id },
      });
      const eksisterendeOmplacering = await this.prisma.omplacering.findUnique({
        where: { kommando_id: k.kommando_id },
      });
      const eksisterendeHestestatus = await this.prisma.hestestatusmelding.findUnique({
        where: { kommando_id: k.kommando_id },
      });

      if (eksisterendeFremmoede || eksisterendeOmplacering || eksisterendeHestestatus) {
        resultater.push({
          kommando_id: k.kommando_id,
          status: 'AlleredeAnvendt',
        });
        continue;
      }

      // 2. Tjek clock-skew (> 5 minutter)
      const klientTid = new Date(k.klient_tidspunkt);
      const skewMs = Math.abs(klientTid.getTime() - nu.getTime());
      if (skewMs > 5 * 60 * 1000) {
        await this.prisma.$transaction(async (tx) => {
          await logHaendelse(tx, {
            handling: 'SYNK_CLOCK_SKEW',
            entitet: 'enhed',
            entitet_id: enhedId,
            bruger: k.bruger_id ? { id: k.bruger_id, navn: 'Stald-bruger', roller: ['Ridelaerer'] } : null,
            tidspunkt: nu,
            enhed_id: enhedId,
            kommando_id: k.kommando_id,
            klient_tidspunkt: klientTid,
            foer: null,
            efter: { skew_minutter: Math.round(skewMs / 60000) },
          });
        });
      }

      try {
        const res = await this.eksekverKommando(k, enhedId, klientTid, nu);
        resultater.push(res);
      } catch (err: any) {
        resultater.push({
          kommando_id: k.kommando_id,
          status: 'Afvist',
          fejl_kode: err.kode ?? 'SERVER_FEJL',
          besked: err.message ?? 'Fejl under behandling af kommando',
        });
      }
    }

    return { resultater };
  }

  private async eksekverKommando(
    k: KommandoKuvert,
    enhedId: string,
    klientTid: Date,
    nu: Date,
  ): Promise<KommandoResultat> {
    switch (k.type) {
      case 'RegistrerFremmoede':
        return this.haendterRegistrerFremmoede(k, enhedId, klientTid, nu);
      case 'KorrigerFremmoede':
        return this.haendterKorrigerFremmoede(k, enhedId, klientTid, nu);
      case 'RegistrerAfbud':
        return this.haendterRegistrerAfbud(k, enhedId, klientTid, nu);
      case 'MeldHestStatus':
        return this.haendterMeldHestStatus(k, enhedId, klientTid, nu);
      case 'GodkendOmplacering':
        return this.haendterGodkendOmplacering(k, enhedId, klientTid, nu);
      case 'RegistrerOensker':
        return this.haendterRegistrerOensker(k, nu);
      case 'VikarLogin':
        return this.haendterVikarLogin(k, enhedId, klientTid, nu);
      default:
        return {
          kommando_id: k.kommando_id,
          status: 'Afvist',
          fejl_kode: 'UKENDT_KOMMANDO',
          besked: `Ukendt kommandotype: ${k.type}`,
        };
    }
  }

  private async haendterRegistrerFremmoede(
    k: KommandoKuvert,
    enhedId: string,
    klientTid: Date,
    nu: Date,
  ): Promise<KommandoResultat> {
    const payload = k.payload as RegistrerFremmoedePayload;

    const lektion = await this.prisma.lektion.findUnique({
      where: { id: payload.lektion_id },
      include: { hold: true },
    });

    if (!lektion) {
      return {
        kommando_id: k.kommando_id,
        status: 'Afvist',
        fejl_kode: 'LEKTION_IKKE_FUNDET',
        besked: 'Lektionen findes ikke',
      };
    }

    const senesteFremmoede = await this.prisma.fremmoederegistrering.findFirst({
      orderBy: { server_tidspunkt: 'desc' },
      select: { hash: true },
    });
    let forrigeHash = senesteFremmoede?.hash ?? 'GENESIS';

    const bruger = k.bruger_id
      ? await this.prisma.bruger.findUnique({ where: { id: k.bruger_id } })
      : null;
    const registreretAfNavn = bruger?.navn ?? 'Stald-enhed';

    for (const reg of payload.registreringer) {
      const plads = await this.prisma.lektionsPlads.findUnique({
        where: { id: reg.lektionsplads_id },
      });
      if (!plads) continue;

      const hashData = `${forrigeHash}:${plads.id}:${reg.status}:${klientTid.toISOString()}`;
      const nyHash = this.beregnSha256(hashData);

      const kommandoId =
        payload.registreringer.length === 1
          ? k.kommando_id
          : crypto.randomUUID();

      // Konflikt-tjek (sync-protocol §5): Forskellige statusser fra forskellige enheder for samme plads inden for 10 min. giver SYNK_KONFLIKT
      const nyligRegistrering = await this.prisma.fremmoederegistrering.findFirst({
        where: {
          lektionsplads_id: plads.id,
          enhed_id: { not: enhedId },
          server_tidspunkt: { gte: new Date(nu.getTime() - 10 * 60 * 1000) },
        },
        orderBy: { server_tidspunkt: 'desc' },
      });

      if (nyligRegistrering && nyligRegistrering.status !== reg.status) {
        await this.prisma.dashboardNotifikation.create({
          data: {
            type: 'SYNK_KONFLIKT',
            payload: {
              type: 'FremmoedeKonflikt',
              lektionsplads_id: plads.id,
              foerste_enhed: nyligRegistrering.enhed_id,
              foerste_status: nyligRegistrering.status,
              anden_enhed: enhedId,
              anden_status: reg.status,
            },
            dedupe_noegle: `SYNK_KONFLIKT:fremmoede:${plads.id}`,
          },
        });
      }

      await this.prisma.fremmoederegistrering.create({
        data: {
          lektionsplads_id: plads.id,
          lektion_dato: lektion.dato,
          hold_id: lektion.hold_id,
          rytter_id: plads.rytter_id,
          hest_id: plads.aktuel_hest_id,
          status: reg.status,
          registreret_af_bruger_id: k.bruger_id,
          registreret_af_navn: registreretAfNavn,
          klient_tidspunkt: klientTid,
          server_tidspunkt: nu,
          enhed_id: enhedId,
          kommando_id: kommandoId,
          forrige_hash: forrigeHash,
          hash: nyHash,
        },
      });

      forrigeHash = nyHash;
    }

    this.app.sse?.udsendEvent('plads.opdateret', {
      lektion_id: lektion.id,
      antal: payload.registreringer.length,
    });

    return { kommando_id: k.kommando_id, status: 'Anvendt' };
  }

  private async haendterKorrigerFremmoede(
    k: KommandoKuvert,
    enhedId: string,
    klientTid: Date,
    nu: Date,
  ): Promise<KommandoResultat> {
    const payload = k.payload as KorrigerFremmoedePayload;

    if (!payload.begrundelse || payload.begrundelse.trim().length < 5) {
      return {
        kommando_id: k.kommando_id,
        status: 'Afvist',
        fejl_kode: 'BEGRUNDELSE_FOR_KORT',
        besked: 'Begrundelse skal være mindst 5 tegn',
      };
    }

    const eksisterende = await this.prisma.fremmoederegistrering.findUnique({
      where: { id: payload.fremmoederegistrering_id },
    });

    if (!eksisterende) {
      return {
        kommando_id: k.kommando_id,
        status: 'Afvist',
        fejl_kode: 'REGISTRERING_IKKE_FUNDET',
        besked: 'Den oprindelige fremmøderegistrering findes ikke',
      };
    }

    const seneste = await this.prisma.fremmoederegistrering.findFirst({
      orderBy: { server_tidspunkt: 'desc' },
      select: { hash: true },
    });
    const forrigeHash = seneste?.hash ?? 'GENESIS';

    const hashData = `${forrigeHash}:${eksisterende.lektionsplads_id}:${payload.ny_status}:${klientTid.toISOString()}:${payload.begrundelse}`;
    const nyHash = this.beregnSha256(hashData);

    const bruger = k.bruger_id
      ? await this.prisma.bruger.findUnique({ where: { id: k.bruger_id } })
      : null;
    const registreretAfNavn = bruger?.navn ?? 'Stald-enhed';

    await this.prisma.fremmoederegistrering.create({
      data: {
        lektionsplads_id: eksisterende.lektionsplads_id,
        lektion_dato: eksisterende.lektion_dato,
        hold_id: eksisterende.hold_id,
        rytter_id: eksisterende.rytter_id,
        hest_id: eksisterende.hest_id,
        status: payload.ny_status,
        registreret_af_bruger_id: k.bruger_id,
        registreret_af_navn: registreretAfNavn,
        klient_tidspunkt: klientTid,
        server_tidspunkt: nu,
        enhed_id: enhedId,
        erstatter_id: eksisterende.id,
        korrektions_begrundelse: payload.begrundelse,
        kommando_id: k.kommando_id,
        forrige_hash: forrigeHash,
        hash: nyHash,
      },
    });

    this.app.sse?.udsendEvent('plads.opdateret', {
      plads_id: eksisterende.lektionsplads_id,
      ny_status: payload.ny_status,
    });

    return { kommando_id: k.kommando_id, status: 'Anvendt' };
  }

  private async haendterRegistrerAfbud(
    k: KommandoKuvert,
    enhedId: string,
    klientTid: Date,
    nu: Date,
  ): Promise<KommandoResultat> {
    const payload = k.payload as RegistrerAfbudPayload;

    const plads = await this.prisma.lektionsPlads.findUnique({
      where: { id: payload.lektionsplads_id },
      include: {
        lektion: { include: { hold: true } },
      },
    });

    if (!plads) {
      return {
        kommando_id: k.kommando_id,
        status: 'Afvist',
        fejl_kode: 'PLADS_IKKE_FUNDET',
        besked: 'Lektionspladsen findes ikke',
      };
    }

    const modtagetTid = payload.modtaget_tidspunkt
      ? new Date(payload.modtaget_tidspunkt)
      : klientTid;

    const lektionDato = plads.lektion.dato;
    const afbudStatus = klassificerAfbud(modtagetTid, lektionDato);

    const seneste = await this.prisma.fremmoederegistrering.findFirst({
      orderBy: { server_tidspunkt: 'desc' },
      select: { hash: true },
    });
    const forrigeHash = seneste?.hash ?? 'GENESIS';

    const hashData = `${forrigeHash}:${plads.id}:${afbudStatus}:${klientTid.toISOString()}`;
    const nyHash = this.beregnSha256(hashData);

    const bruger = k.bruger_id
      ? await this.prisma.bruger.findUnique({ where: { id: k.bruger_id } })
      : null;
    const registreretAfNavn = bruger?.navn ?? 'Stald-enhed';

    await this.prisma.fremmoederegistrering.create({
      data: {
        lektionsplads_id: plads.id,
        lektion_dato: plads.lektion.dato,
        hold_id: plads.lektion.hold_id,
        rytter_id: plads.rytter_id,
        hest_id: plads.aktuel_hest_id,
        status: afbudStatus,
        modtaget_tidspunkt: modtagetTid,
        registreret_af_bruger_id: k.bruger_id,
        registreret_af_navn: registreretAfNavn,
        klient_tidspunkt: klientTid,
        server_tidspunkt: nu,
        enhed_id: enhedId,
        kommando_id: k.kommando_id,
        forrige_hash: forrigeHash,
        hash: nyHash,
      },
    });

    if (afbudStatus === 'Afbud_rettidigt') {
      const aktivVenteliste = await this.prisma.venteliste.findFirst({
        where: {
          status: 'Aktiv',
          OR: [
            { oensket_hold_id: plads.lektion.hold_id },
            { oensket_niveau: plads.lektion.hold.niveau },
          ],
        },
        orderBy: { tilmeldingsdato: 'asc' },
        include: { rytter: true },
      });

      if (aktivVenteliste) {
        await this.prisma.genbesaettelsesforslag.create({
          data: {
            type: 'Enkeltlektion',
            lektion_id: plads.lektion_id,
            hold_id: plads.lektion.hold_id,
            frigjort_hest_id: plads.aktuel_hest_id,
            foreslaaet_venteliste_id: aktivVenteliste.id,
            kontaktinfo_snapshot: {
              rytter_navn: rytterNavn(aktivVenteliste.rytter),
              telefon: aktivVenteliste.rytter.kontakt_telefon,
            },
            status: 'Afventer',
          },
        });
      }
    }

    this.app.sse?.udsendEvent('plads.opdateret', {
      plads_id: plads.id,
      afbud_status: afbudStatus,
    });

    return { kommando_id: k.kommando_id, status: 'Anvendt' };
  }

  private async haendterMeldHestStatus(
    k: KommandoKuvert,
    enhedId: string,
    klientTid: Date,
    nu: Date,
  ): Promise<KommandoResultat> {
    const payload = k.payload as MeldHestStatusPayload;

    const hest = await this.prisma.hest.findUnique({
      where: { id: payload.hest_id },
    });

    if (!hest) {
      return {
        kommando_id: k.kommando_id,
        status: 'Afvist',
        fejl_kode: 'HEST_IKKE_FUNDET',
        besked: 'Hesten findes ikke',
      };
    }

    const bruger = k.bruger_id
      ? await this.prisma.bruger.findUnique({ where: { id: k.bruger_id } })
      : null;
    const meldtAfNavn = bruger?.navn ?? 'Stald-enhed';

    await this.prisma.hestestatusmelding.create({
      data: {
        hest_id: hest.id,
        type: payload.type,
        alvorlighed: payload.alvorlighed,
        beskrivelse: payload.beskrivelse,
        meldt_af_bruger_id: k.bruger_id,
        meldt_af_navn: meldtAfNavn,
        klient_tidspunkt: klientTid,
        server_tidspunkt: nu,
        kommando_id: k.kommando_id,
      },
    });

    if (payload.alvorlighed === 'KanIkkeBruges') {
      await this.prisma.hest.update({
        where: { id: hest.id },
        data: { sundhedsstatus: 'Sygemeldt' },
      });
    }

    this.app.sse?.udsendEvent('hest.status', {
      hest_id: hest.id,
      alvorlighed: payload.alvorlighed,
      type: payload.type,
      sygemeldt: payload.alvorlighed === 'KanIkkeBruges',
    });

    return { kommando_id: k.kommando_id, status: 'Anvendt' };
  }

  private async haendterGodkendOmplacering(
    k: KommandoKuvert,
    enhedId: string,
    klientTid: Date,
    nu: Date,
  ): Promise<KommandoResultat> {
    const payload = k.payload as GodkendOmplaceringPayload;

    const plads = await this.prisma.lektionsPlads.findUnique({
      where: { id: payload.lektionsplads_id },
      include: {
        lektion: {
          include: {
            hold: true,
          },
        },
      },
    });

    if (!plads) {
      return {
        kommando_id: k.kommando_id,
        status: 'Afvist',
        fejl_kode: 'PLADS_IKKE_FUNDET',
        besked: 'Lektionspladsen findes ikke',
      };
    }

    const nyHest = await this.prisma.hest.findUnique({
      where: { id: payload.til_hest_id },
    });

    if (!nyHest || !nyHest.aktiv || nyHest.sundhedsstatus !== 'Aktiv') {
      return {
        kommando_id: k.kommando_id,
        status: 'Afvist',
        fejl_kode: 'HEST_IKKE_KLAR',
        besked: 'Den valgte hest er ikke tilgængelig på serveren',
      };
    }

    const gammelHestId = plads.aktuel_hest_id ?? plads.planlagt_hest_id;

    await this.prisma.$transaction(async (tx) => {
      await tx.lektionsPlads.update({
        where: { id: plads.id },
        data: {
          aktuel_hest_id: nyHest.id,
          felt_tidsstempler: {
            aktuel_hest_id: klientTid.toISOString(),
          },
        },
      });

      const bruger = k.bruger_id
        ? await tx.bruger.findUnique({ where: { id: k.bruger_id } })
        : null;
      const godkendtAfNavn = bruger?.navn ?? 'Stald-enhed';

      await tx.omplacering.create({
        data: {
          lektionsplads_id: plads.id,
          fra_hest_id: gammelHestId ?? nyHest.id,
          til_hest_id: nyHest.id,
          aarsag: payload.aarsag,
          forslag_snapshot: (payload.forslag_snapshot as any) ?? {},
          godkendt_af_bruger_id: k.bruger_id,
          godkendt_af_navn: godkendtAfNavn,
          klient_tidspunkt: klientTid,
          server_tidspunkt: nu,
          kommando_id: k.kommando_id,
        },
      });
    });

    this.app.sse?.udsendEvent('plads.opdateret', {
      plads_id: plads.id,
      ny_hest_id: nyHest.id,
    });

    return { kommando_id: k.kommando_id, status: 'Anvendt' };
  }

  private async haendterRegistrerOensker(
    k: KommandoKuvert,
    nu: Date,
  ): Promise<KommandoResultat> {
    const payload = k.payload as RegistrerOenskerPayload;

    // Sikr gyldig bruger reference (Foreign Key)
    let registreretAfId: string | null = k.bruger_id;
    if (registreretAfId) {
      const fundet = await this.prisma.bruger.findUnique({
        where: { id: registreretAfId },
        select: { id: true },
      });
      if (!fundet) registreretAfId = null;
    }
    if (!registreretAfId) {
      const fallbackBruger = await this.prisma.bruger.findFirst({
        where: { aktiv: true },
        select: { id: true },
      });
      registreretAfId = fallbackBruger?.id ?? null;
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.elevoenske.deleteMany({
        where: {
          rytter_id: payload.rytter_id,
          maaned: payload.maaned,
        },
      });

      if (registreretAfId && payload.hest_ids && payload.hest_ids.length > 0) {
        let prio = 1;
        for (const hestId of payload.hest_ids) {
          await tx.elevoenske.create({
            data: {
              rytter_id: payload.rytter_id,
              maaned: payload.maaned,
              prioritet: prio++,
              oensket_hest_id: hestId,
              registreret_af: registreretAfId,
              oprettet: nu,
            },
          });
        }
      }
    });

    return { kommando_id: k.kommando_id, status: 'Anvendt' };
  }

  private async haendterVikarLogin(
    k: KommandoKuvert,
    enhedId: string,
    klientTid: Date,
    nu: Date,
  ): Promise<KommandoResultat> {
    const payload = k.payload as VikarLoginPayload;

    const vikarKode = await this.prisma.vikarEngangskode.findUnique({
      where: { id: payload.vikarkode_id },
    });

    if (!vikarKode) {
      return {
        kommando_id: k.kommando_id,
        status: 'Afvist',
        fejl_kode: 'KODE_IKKE_FUNDET',
        besked: 'Vikarkoden findes ikke',
      };
    }

    if (vikarKode.status !== 'Aktiv' || vikarKode.udloebsdato < nu) {
      return {
        kommando_id: k.kommando_id,
        status: 'Konflikt',
        fejl_kode: 'KODE_ALLEREDE_ANVENDT',
        besked: 'Koden er allerede anvendt eller udløbet',
      };
    }

    await this.prisma.vikarEngangskode.update({
      where: { id: vikarKode.id },
      data: {
        status: 'Anvendt',
        anvendt_dato: nu,
        anvendt_af_vikarnavn: payload.fulde_navn,
        anvendt_paa_enhed: enhedId,
      },
    });

    return { kommando_id: k.kommando_id, status: 'Anvendt' };
  }
}

