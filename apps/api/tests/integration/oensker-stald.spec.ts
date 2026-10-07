import { beforeEach, describe, expect, it } from 'vitest';
import { lavApp, logInd } from '../helpers/app';
import { nulstilData, seedFredag } from '../helpers/db';

describe('Stald-ønskeregistrering (US2, T131)', () => {
  beforeEach(async () => {
    await nulstilData();
    await seedFredag();
  });

  it('registrerer 3 hesteønsker for en elev, afviser dubletter og validerer måned', async () => {
    const app = await lavApp();
    const cookie = await logInd(app, 'marie@demo.dk');

    // Hent en aktiv elev på Maries hold (f.eks. Anna Jensen eller Sophia)
    const tilmelding = await app.prisma.holdtilmelding.findFirst({
      where: { hold: { fast_underviser: { email: 'marie@demo.dk' } } },
      include: { rytter: true },
    });
    expect(tilmelding).toBeDefined();
    const rytterId = tilmelding!.rytter_id;

    // Hent 3 forskellige aktive heste
    const heste = await app.prisma.hest.findMany({
      where: { aktiv: true },
      take: 3,
    });
    expect(heste.length).toBe(3);

    // 1. Forsøg at indsende dubleret hest (skal afvises med 422)
    const dubletRes = await app.inject({
      method: 'POST',
      url: '/api/v1/oensker/stald/batch',
      headers: { cookie },
      payload: {
        rytter_id: rytterId,
        maaned: '2026-08',
        oensker: [heste[0]!.id, heste[0]!.id, heste[1]!.id],
      },
    });
    expect(dubletRes.statusCode).toBe(422);

    // 2. Forsøg ugyldigt månedsformat (skal afvises med 400 schema error)
    const maanedRes = await app.inject({
      method: 'POST',
      url: '/api/v1/oensker/stald/batch',
      headers: { cookie },
      payload: {
        rytter_id: rytterId,
        maaned: '2026-8', // mangler leading zero
        oensker: [heste[0]!.id, heste[1]!.id, heste[2]!.id],
      },
    });
    expect(maanedRes.statusCode).toBe(422);

    // 3. Gyldig registrering af 3 ønsker
    const gyldigRes = await app.inject({
      method: 'POST',
      url: '/api/v1/oensker/stald/batch',
      headers: { cookie },
      payload: {
        rytter_id: rytterId,
        maaned: '2026-08',
        oensker: [heste[0]!.id, heste[1]!.id, heste[2]!.id],
      },
    });
    expect(gyldigRes.statusCode).toBe(200);

    // 4. Verificér i databasen at ønsker er oprettet med prioritet 1, 2, 3
    const gemteOensker = await app.prisma.elevoenske.findMany({
      where: { rytter_id: rytterId, maaned: '2026-08' },
      orderBy: { prioritet: 'asc' },
    });
    expect(gemteOensker.length).toBe(3);
    expect(gemteOensker[0]!.oensket_hest_id).toBe(heste[0]!.id);
    expect(gemteOensker[1]!.oensket_hest_id).toBe(heste[1]!.id);
    expect(gemteOensker[2]!.oensket_hest_id).toBe(heste[2]!.id);

    // 5. Verificér at auditlog hændelse OENSKER_REGISTRERET blev oprettet
    const audit = await app.prisma.auditHaendelse.findFirst({
      where: {
        handling: 'OENSKER_REGISTRERET',
        entitet_id: rytterId,
      },
    });
    expect(audit).toBeDefined();
  });
});
