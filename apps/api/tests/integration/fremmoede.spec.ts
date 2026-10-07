import { randomUUID } from 'node:crypto';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { lavApp, logInd, type TestApp } from '../helpers/app';
import { prisma, seedFredag } from '../helpers/db';

describe('Batch fremmøde, korrektion og append-only (US1, T120)', () => {
  let app: TestApp;
  let cookieMarie: string;

  beforeEach(async () => {
    await seedFredag();
    app = await lavApp();
    cookieMarie = await logInd(app, 'marie@demo.dk');
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('gennemfører batch-registrering, lukning og korrektion med begrundelse', async () => {
    // 1. Find eller opret en lektion med pladser
    const hold = await prisma.hold.findFirstOrThrow();
    const ryttere = await prisma.rytter.findMany({ take: 3 });

    const lektionDato = new Date('2026-10-09T00:00:00.000Z');
    const lektion = await prisma.lektion.create({
      data: {
        hold_id: hold.id,
        dato: lektionDato,
        status: 'Planlagt',
        underviser_id: hold.fast_underviser_id,
      },
    });

    const pladser = await Promise.all(
      ryttere.map((r) =>
        prisma.lektionsPlads.create({
          data: {
            lektion_id: lektion.id,
            rytter_id: r.id,
            kilde: 'Plan',
          },
        }),
      ),
    );

    // 2. Batch-registrering på lektionen
    const batchRes = await app.inject({
      method: 'POST',
      url: '/api/v1/fremmoede/batch',
      headers: { cookie: cookieMarie },
      payload: {
        lektion_id: lektion.id,
        registreringer: [
          { lektionsplads_id: pladser[0]!.id, status: 'Fremmoedt' },
          { lektionsplads_id: pladser[1]!.id, status: 'Fremmoedt' },
          { lektionsplads_id: pladser[2]!.id, status: 'Udeblevet' },
        ],
      },
    });

    expect(batchRes.statusCode).toBe(201);
    const batchData = batchRes.json();
    expect(batchData).toHaveLength(3);
    expect(batchData[0].hash).toBeDefined();
    expect(batchData[0].status).toBe('Fremmoedt');

    const reg1Id = batchData[0].id;

    // 3. Afslut lektionen via POST /lektioner/{id}/afslut
    const afslutRes = await app.inject({
      method: 'POST',
      url: `/api/v1/lektioner/${lektion.id}/afslut`,
      headers: { cookie: cookieMarie },
    });

    expect(afslutRes.statusCode).toBe(200);
    expect(afslutRes.json().status).toBe('Afviklet');
    expect(afslutRes.json().fremmoede_lukket).toBeDefined();

    // 4. Forsøg på ændring via korrektion uden gyldig begrundelse (under 5 tegn) fejler (422)
    const fejlKorrektionRes = await app.inject({
      method: 'POST',
      url: `/api/v1/fremmoede/${reg1Id}/korrektion`,
      headers: { cookie: cookieMarie },
      payload: {
        ny_status: 'Udeblevet',
        begrundelse: 'Fejl', // Kun 4 tegn
      },
    });

    expect(fejlKorrektionRes.statusCode).toBe(422);

    // 5. Korrektion med gyldig begrundelse (mindst 5 tegn) lykkes
    const godKorrektionRes = await app.inject({
      method: 'POST',
      url: `/api/v1/fremmoede/${reg1Id}/korrektion`,
      headers: { cookie: cookieMarie },
      payload: {
        ny_status: 'Udeblevet',
        begrundelse: 'Kom alligevel ikke',
      },
    });

    expect(godKorrektionRes.statusCode).toBe(200);
    const korrigeretData = godKorrektionRes.json();
    expect(korrigeretData.status).toBe('Udeblevet');
    expect(korrigeretData.erstatter_id).toBe(reg1Id);
    expect(korrigeretData.korrektions_begrundelse).toBe('Kom alligevel ikke');

    // Verificér hashkæde: forrige_hash skal matche den seneste rækkes hash
    expect(korrigeretData.forrige_hash).toBe(batchData[2].hash);

    // 6. Verificér append-only: UPDATE og DELETE på fremmoederegistrering afvises af SQL-trigger
    await expect(
      prisma.fremmoederegistrering.update({
        where: { id: reg1Id },
        data: { status: 'Udeblevet' },
      }),
    ).rejects.toThrow(/append-only/);

    await expect(
      prisma.fremmoederegistrering.delete({
        where: { id: reg1Id },
      }),
    ).rejects.toThrow(/append-only/);
  });
});
