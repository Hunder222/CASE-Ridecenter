import { beforeEach, describe, expect, it } from 'vitest';
import { lavApp, logInd } from '../helpers/app';
import { nulstilData, seedFredag } from '../helpers/db';

describe('Holdadministration og kapacitetsgrænser (US2, T130)', () => {
  beforeEach(async () => {
    await nulstilData();
    await seedFredag();
  });

  it('opretter nyt hold, tilmelder op til max_kapacitet og afviser derefter med 409 HOLD_FULDT', async () => {
    const app = await lavApp();
    const cookie = await logInd(app, 'malene@demo.dk');

    // Hent en fast underviser (f.eks. Marie eller Malene)
    const underviser = await app.prisma.bruger.findFirst({
      where: { roller: { has: 'Ridelaerer' } },
    });
    expect(underviser).toBeDefined();

    // 1. Opret nyt hold med max_kapacitet: 2
    const opretRes = await app.inject({
      method: 'POST',
      url: '/api/v1/hold',
      headers: { cookie },
      payload: {
        holdnavn: 'Lørdag Formiddag Begynder',
        niveau: 'Begynder',
        er_springhold: false,
        ugedag: 6,
        starttid: '10:00',
        varighed_min: 45,
        max_kapacitet: 2,
        fast_underviser_id: underviser!.id,
      },
    });

    expect(opretRes.statusCode).toBe(201);
    const nytHold = opretRes.json();
    expect(nytHold.id).toBeDefined();
    expect(nytHold.max_kapacitet).toBe(2);

    // Hent to aktive ryttere
    const ryttere = await app.prisma.rytter.findMany({
      where: { aktiv_status: 'Aktiv' },
      take: 3,
    });
    expect(ryttere.length).toBeGreaterThanOrEqual(3);

    // 2. Tilmeld 1. rytter
    const tilmeldRes1 = await app.inject({
      method: 'POST',
      url: `/api/v1/hold/${nytHold.id}/tilmeldinger`,
      headers: { cookie },
      payload: {
        rytter_id: ryttere[0]!.id,
      },
    });
    expect(tilmeldRes1.statusCode).toBe(201);

    // 3. Tilmeld 2. rytter (når kapacitet på 2)
    const tilmeldRes2 = await app.inject({
      method: 'POST',
      url: `/api/v1/hold/${nytHold.id}/tilmeldinger`,
      headers: { cookie },
      payload: {
        rytter_id: ryttere[1]!.id,
      },
    });
    expect(tilmeldRes2.statusCode).toBe(201);

    // 4. Forsøg at tilmelde 3. rytter (skal afvises med 409 HOLD_FULDT)
    const tilmeldRes3 = await app.inject({
      method: 'POST',
      url: `/api/v1/hold/${nytHold.id}/tilmeldinger`,
      headers: { cookie },
      payload: {
        rytter_id: ryttere[2]!.id,
      },
    });
    expect(tilmeldRes3.statusCode).toBe(409);
    const fejl = tilmeldRes3.json();
    expect(fejl.kode).toBe('HOLD_FULDT');

    // 5. Test afmelding via DELETE
    const tilmelding2 = tilmeldRes2.json();
    const afmeldRes = await app.inject({
      method: 'DELETE',
      url: `/api/v1/hold/${nytHold.id}/tilmeldinger/${tilmelding2.id}`,
      headers: { cookie },
    });
    expect(afmeldRes.statusCode).toBe(200);

    // 6. Nu bør der være plads igen til 3. rytter
    const tilmeldRes3Igen = await app.inject({
      method: 'POST',
      url: `/api/v1/hold/${nytHold.id}/tilmeldinger`,
      headers: { cookie },
      payload: {
        rytter_id: ryttere[2]!.id,
      },
    });
    expect(tilmeldRes3Igen.statusCode).toBe(201);
  });
});
