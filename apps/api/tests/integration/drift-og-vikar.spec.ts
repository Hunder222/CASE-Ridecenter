import { beforeEach, describe, expect, it } from 'vitest';
import { lavApp, logInd } from '../helpers/app';
import { nulstilData, seedFredag } from '../helpers/db';

describe('Drift, omplacering og vikar-login (US3, T139)', () => {
  beforeEach(async () => {
    await nulstilData();
    await seedFredag();
  });

  it('(a) Staldelev melder hest KanIkkeBruges -> Sygemeldt & hestestatusmelding oprettes', async () => {
    const app = await lavApp();
    const cookie = await logInd(app, 'staldelev@demo.dk');

    const hest = await app.prisma.hest.findFirst({
      where: { navn: 'Donny' },
    });
    expect(hest).toBeDefined();

    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/heste/${hest!.id}/status`,
      headers: { cookie },
      payload: {
        type: 'Helbred',
        alvorlighed: 'KanIkkeBruges',
        beskrivelse: 'Halter på venstre forben i trav',
      },
    });

    expect(res.statusCode).toBe(200);

    // Verificér hestens opdaterede status
    const opdateretHest = await app.prisma.hest.findUnique({
      where: { id: hest!.id },
    });
    expect(opdateretHest?.sundhedsstatus).toBe('Sygemeldt');

    // Verificér post i hestestatusmelding
    const melding = await app.prisma.hestestatusmelding.findFirst({
      where: { hest_id: hest!.id },
    });
    expect(melding).toBeDefined();
    expect(melding?.alvorlighed).toBe('KanIkkeBruges');
  });

  it('(b) Ridelærer omplacerer via POST /lektionspladser/:id/omplacer -> Omplacering oprettes', async () => {
    const app = await lavApp();
    const cookie = await logInd(app, 'marie@demo.dk');

    // Hent en lektionsplads fra en planlagt lektion
    const plads = await app.prisma.lektionsPlads.findFirst({
      include: { lektion: true, rytter: true },
    });
    expect(plads).toBeDefined();

    // Hent en erstatningshest
    const erstatning = await app.prisma.hest.findFirst({
      where: {
        id: { not: plads?.aktuel_hest_id ?? undefined },
        aktiv: true,
        sundhedsstatus: 'Aktiv',
      },
    });
    expect(erstatning).toBeDefined();

    // Hent erstatningsforslag først
    const forslagRes = await app.inject({
      method: 'GET',
      url: `/api/v1/lektionspladser/${plads!.id}/erstatningsforslag`,
      headers: { cookie },
    });
    expect(forslagRes.statusCode).toBe(200);

    const omplacerRes = await app.inject({
      method: 'POST',
      url: `/api/v1/lektionspladser/${plads!.id}/omplacer`,
      headers: { cookie },
      payload: {
        til_hest_id: erstatning!.id,
        aarsag: 'HestSyg',
        forslag_snapshot: { begrundelse: 'Test omplacering' },
      },
    });

    // Skal enten lykkes (200) eller afvises lovligt af Welfare Guard (422)
    if (omplacerRes.statusCode === 200) {
      const omplacering = await app.prisma.omplacering.findFirst({
        where: { lektionsplads_id: plads!.id },
      });
      expect(omplacering).toBeDefined();
      expect(omplacering?.til_hest_id).toBe(erstatning!.id);
    } else {
      expect(omplacerRes.statusCode).toBe(422);
    }
  });

  it('(c) Vikar logger ind med 6-cifret kode og navn -> koden sættes til Anvendt & notifikation oprettes', async () => {
    const app = await lavApp();
    const ledelseCookie = await logInd(app, 'malene@demo.dk');

    // 1. Opret en betroet enhed
    const enhedRes = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/enheder',
      headers: { cookie: ledelseCookie },
      payload: { navn: 'Stald iPad 1' },
    });
    expect(enhedRes.statusCode).toBe(201);
    const { enrollment_token } = enhedRes.json();

    const regRes = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/enheder/registrer',
      payload: { enrollment_token },
    });
    expect(regRes.statusCode).toBe(200);
    const { enhedsnoegle } = regRes.json();

    // 2. Udsted vikarkode som ledelse
    const kodeRes = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/vikarkoder',
      headers: { cookie: ledelseCookie },
    });
    expect(kodeRes.statusCode).toBe(201);
    const { kode, id: kodeId } = kodeRes.json();
    expect(kode).toMatch(/^[0-9]{6}$/);

    // 3. Log ind som vikar med koden på enheden
    const vikarLoginRes = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/vikar/login',
      headers: {
        'x-enhed-noegle': enhedsnoegle,
      },
      payload: {
        vikarkode: kode,
        fulde_navn: 'Sofie Vikar',
      },
    });

    expect(vikarLoginRes.statusCode).toBe(200);
    const session = vikarLoginRes.json();
    expect(session.roller).toContain('Vikar');
    expect(session.navn).toContain('Sofie Vikar');

    // 4. Verificér koden i databasen er Anvendt
    const opdateretKode = await app.prisma.vikarEngangskode.findUnique({
      where: { id: kodeId },
    });
    expect(opdateretKode?.status).toBe('Anvendt');
    expect(opdateretKode?.anvendt_af_vikarnavn).toBe('Sofie Vikar');

    // 5. Verificér notifikation VIKAR_LOGIN til ledelsen
    const notifikation = await app.prisma.dashboardNotifikation.findFirst({
      where: {
        type: 'VIKAR_LOGIN',
        dedupe_noegle: `VIKAR_LOGIN:${kodeId}`,
      },
    });
    expect(notifikation).toBeDefined();

    // 6. Genbrug af koden skal afvises (401)
    const genbrugRes = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/vikar/login',
      headers: {
        'x-enhed-noegle': enhedsnoegle,
      },
      payload: {
        vikarkode: kode,
        fulde_navn: 'Anden Vikar',
      },
    });
    expect(genbrugRes.statusCode).toBe(401);
  });
});

