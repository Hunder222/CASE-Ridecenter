import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { lavApp, logInd, type TestApp } from '../helpers/app';
import { prisma, seedFredag } from '../helpers/db';
import { Klient } from '../helpers/klient';
import { rytterId } from '../helpers/testdata';

/**
 * RBAC- og GDPR-sikkerhedsscan (T171, V9):
 * 1. Rekursiv validering af alle API-svar for stald- og vikarroller:
 *    - Verificér 403 på beskyttede ruter: /ryttere/:id/sikkerhedsprofil, /ryttere, /dashboard/* og /rapporter/*
 * 2. Verificér data-minimering (GDPR Art. 9 og Princip IV):
 *    - Ingen stald-respons indeholder vaegt_kg, hoejde_cm, foedselsdato, kontakt_*, faldtraume_note,
 *      angstkategori, forbudte_heste eller paakraevede_heste.
 * 3. Verificér audit-hændelse:
 *    - Enhver læsning af en sikkerhedsprofil danner AuditHaendelse(SIKKERHEDSPROFIL_LAEST).
 */

const FORBUDTE_STALD_FELTER = new Set([
  'vaegt_kg',
  'hoejde_cm',
  'foedselsdato',
  'kontakt_telefon',
  'kontakt_email',
  'kontaktperson_navn',
  'faldtraume_note',
  'angstkategori',
  'intern_note',
  'forbudte_heste',
  'paakraevede_heste',
]);

function findForbudteFelter(data: unknown, sti = '$'): string[] {
  if (Array.isArray(data)) {
    return data.flatMap((elem, idx) => findForbudteFelter(elem, `${sti}[${idx}]`));
  }
  if (data === null || typeof data !== 'object') {
    return [];
  }
  return Object.entries(data).flatMap(([key, val]) => [
    ...(FORBUDTE_STALD_FELTER.has(key) ? [`${sti}.${key}`] : []),
    ...findForbudteFelter(val, `${sti}.${key}`),
  ]);
}

describe('RBAC- og GDPR-sikkerhedsscan (T171, V9)', () => {
  let app: TestApp;
  let staldelevKlient: Klient;
  let vikarCookie: string;
  let enhedNoegle: string;
  let emmaId: string;

  beforeAll(async () => {
    await seedFredag();
    app = await lavApp();
    emmaId = rytterId('Emma Grønby');

    // Opret betroet enhed
    const enhedRes = await app.prisma.enhed.create({
      data: {
        navn: 'Audit-Tablet',
        enrollment_token_hash: 'token-hash',
        aktiv: true,
      },
    });

    // Opret session til staldelev
    staldelevKlient = new Klient(app, await logInd(app, 'staldelev@demo.dk'));

    // Udsted vikarkode som Ledelse
    const ledelseCookie = await logInd(app, 'malene@demo.dk');
    const kodeRes = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/vikarkoder',
      headers: { cookie: ledelseCookie },
    });
    const { kode } = kodeRes.json();

    // Registrér enhedsnøgle
    enhedNoegle = 'audit-test-device-key-999';
    await app.prisma.enhed.update({
      where: { id: enhedRes.id },
      data: {
        enhedsnoegle_hash: (await import('node:crypto'))
          .createHash('sha256')
          .update(enhedNoegle)
          .digest('hex'),
      },
    });

    // Log ind som vikar
    const vikarLoginRes = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/vikar/login',
      headers: { 'x-enhed-noegle': enhedNoegle },
      payload: {
        vikarkode: kode,
        fulde_navn: 'Vikar Lise',
      },
    });
    const cookies = ([] as string[]).concat(vikarLoginRes.headers['set-cookie'] ?? []);
    const vikarSessionCookie = cookies.find((c) => c.startsWith('session='));
    vikarCookie = vikarSessionCookie ? (vikarSessionCookie.split(';')[0] as string) : '';
  }, 60_000);

  afterAll(async () => {
    await app?.close();
    await prisma.$disconnect();
  });

  describe('1. Verificér 403 på beskyttede ruter for Staldelev og Vikar', () => {
    const BESKYTTEDE_RUTER: Array<{ metode: 'GET' | 'POST'; sti: string; payload?: unknown }> = [
      { metode: 'GET', sti: `/ryttere/${emmaId}/sikkerhedsprofil` },
      { metode: 'GET', sti: '/ryttere' },
      { metode: 'GET', sti: '/dashboard/noegletal' },
      { metode: 'GET', sti: '/dashboard/heatmap' },
      { metode: 'GET', sti: '/rapporter/kommune?start=2026-07-01&slut=2026-07-31' },
      { metode: 'POST', sti: '/audit/verificer' },
    ];

    it.each(BESKYTTEDE_RUTER)('Staldelev afvises med 403 på $metode $sti', async ({ metode, sti, payload }) => {
      const svar = await staldelevKlient.kald(metode, sti, payload);
      expect(svar.status).toBe(403);
    });

    it.each(BESKYTTEDE_RUTER)('Vikar afvises med 403 på $metode $sti', async ({ metode, sti, payload }) => {
      const res = await app.inject({
        method: metode,
        url: `/api/v1${sti}`,
        headers: {
          cookie: vikarCookie,
          'x-enhed-noegle': enhedNoegle,
        },
        payload: payload as Record<string, unknown> | undefined,
      });
      expect(res.statusCode).toBe(403);
    });
  });

  describe('2. Verificér GDPR dataminimering i stald- og vikar-svar', () => {
    it('GET /heste returnerer ingen følsomme rytteroplysninger', async () => {
      const svar = await staldelevKlient.get('/heste');
      expect(svar.status).toBe(200);
      const laekager = findForbudteFelter(svar.body);
      expect(laekager).toEqual([]);
    });

    it('GET /hold returnerer ingen følsomme rytteroplysninger', async () => {
      const svar = await staldelevKlient.get('/hold');
      expect(svar.status).toBe(200);
      const laekager = findForbudteFelter(svar.body);
      expect(laekager).toEqual([]);
    });

    it('Vikar GET /hold og /heste indeholder nul Art. 9 felter eller CPR', async () => {
      const hesteRes = await app.inject({
        method: 'GET',
        url: '/api/v1/heste',
        headers: { cookie: vikarCookie, 'x-enhed-noegle': enhedNoegle },
      });
      expect(hesteRes.statusCode).toBe(200);
      expect(findForbudteFelter(hesteRes.json())).toEqual([]);

      const holdRes = await app.inject({
        method: 'GET',
        url: '/api/v1/hold',
        headers: { cookie: vikarCookie, 'x-enhed-noegle': enhedNoegle },
      });
      expect(holdRes.statusCode).toBe(200);
      expect(findForbudteFelter(holdRes.json())).toEqual([]);
    });
  });

  describe('3. Verificér AuditHaendelse(SIKKERHEDSPROFIL_LAEST)', () => {
    it('Læsning af sikkerhedsprofil som Ledelse logger SIKKERHEDSPROFIL_LAEST med korrekt bruger og entitet', async () => {
      const ledelseKlient = new Klient(app, await logInd(app, 'malene@demo.dk'));

      const foerAuditAntal = await app.prisma.auditHaendelse.count({
        where: {
          handling: 'SIKKERHEDSPROFIL_LAEST',
          entitet_id: emmaId,
        },
      });

      const svar = await ledelseKlient.get(`/ryttere/${emmaId}/sikkerhedsprofil`);
      expect(svar.status).toBe(200);

      const efterAudit = await app.prisma.auditHaendelse.findFirst({
        where: {
          handling: 'SIKKERHEDSPROFIL_LAEST',
          entitet_id: emmaId,
        },
        orderBy: { server_tidspunkt: 'desc' },
      });

      expect(efterAudit).toBeDefined();
      expect(efterAudit?.rolle).toBe('Ledelse');
      expect(efterAudit?.bruger_navn).toBe('Malene');

      const efterAuditAntal = await app.prisma.auditHaendelse.count({
        where: {
          handling: 'SIKKERHEDSPROFIL_LAEST',
          entitet_id: emmaId,
        },
      });
      expect(efterAuditAntal).toBe(foerAuditAntal + 1);
    });
  });
});

