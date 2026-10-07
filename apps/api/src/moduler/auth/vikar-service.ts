import crypto from 'node:crypto';
import type { VikarKodeOpretSvar, VikarKodePost, VikarLoginBody } from '@ridecenter/contracts';
import argon2 from 'argon2';
import type { PrismaClient } from '@prisma/client';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { logHaendelse } from '../audit/audit-service';
import { DomaeneFejl } from '../../plugins/fejl';
import type { SessionBruger } from '../../plugins/rbac';

export class VikarService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly app: FastifyInstance,
  ) {}

  /**
   * Udsteder en ny tilfældig 6-cifret engangskode.
   * Klartekst returneres kun denne ene gang. Kode-hash gemmes med Argon2id.
   * Standard udløb er 90 dage.
   */
  async udstedVikarKode(bruger: SessionBruger): Promise<VikarKodeOpretSvar> {
    const talkode = Math.floor(100000 + Math.random() * 900000).toString();
    const hash = await argon2.hash(talkode, {
      type: argon2.argon2id,
      memoryCost: 19456,
      timeCost: 2,
    });

    const nu = this.app.ur();
    const udloeb = new Date(nu.getTime() + 90 * 24 * 60 * 60 * 1000);

    const post = await this.prisma.vikarEngangskode.create({
      data: {
        kode_hash: hash,
        udstedt_af: bruger.id,
        udstedt_dato: nu,
        udloebsdato: udloeb,
        status: 'Aktiv',
      },
    });

    return {
      id: post.id,
      kode: talkode,
      udloebsdato: udloeb.toISOString(),
    };
  }

  /**
   * Henter alle vikarkoder (uden hash).
   */
  async hentVikarKoder(): Promise<VikarKodePost[]> {
    const koder = await this.prisma.vikarEngangskode.findMany({
      orderBy: { udstedt_dato: 'desc' },
    });

    return koder.map((k) => ({
      id: k.id,
      status: k.status,
      udstedt_dato: k.udstedt_dato.toISOString(),
      udloebsdato: k.udloebsdato.toISOString(),
      anvendt_dato: k.anvendt_dato ? k.anvendt_dato.toISOString() : null,
      anvendt_af_vikarnavn: k.anvendt_af_vikarnavn,
    }));
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

    if (!fundetKode) {
      throw new DomaeneFejl('UGYLDIG_VIKARKODE', 'Ugyldig eller allerede anvendt vikarkode', 401);
    }

    const nu = this.app.ur();
    if (fundetKode.udloebsdato < nu) {
      await this.prisma.vikarEngangskode.update({
        where: { id: fundetKode.id },
        data: { status: 'Udloebet' },
      });
      throw new DomaeneFejl('VIKARKODE_UDLOEBET', 'Vikarkoden er udløbet', 401);
    }

    // Marker koden som anvendt
    await this.prisma.vikarEngangskode.update({
      where: { id: fundetKode.id },
      data: {
        status: 'Anvendt',
        anvendt_dato: nu,
        anvendt_af_vikarnavn: body.fulde_navn,
        anvendt_paa_enhed: enhedId,
      },
    });

    // Opret notifikation VIKAR_LOGIN til ledelsen
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

    // Opret vikar-session til 23:59
    const udloebIdag = new Date(nu);
    udloebIdag.setHours(23, 59, 59, 999);

    const sessionPayload = {
      bruger_id: fundetKode.id,
      navn: `${body.fulde_navn} (Vikar)`,
      roller: ['Vikar' as const],
      udloeber: udloebIdag.toISOString(),
    };

    reply.setCookie('session', JSON.stringify(sessionPayload), {
      path: '/',
      httpOnly: true,
      sameSite: 'lax',
      signed: true,
      expires: udloebIdag,
    });

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
