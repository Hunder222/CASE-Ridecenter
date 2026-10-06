import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import {
  beregnHash,
  GENESIS_HASH,
  hashIndholdFraRaekke,
  logHaendelse,
  type NyHaendelse,
} from '../../src/moduler/audit/audit-service';
import { nulstilData, prisma } from '../helpers/db';

// Hashkæden (research R11): hver række peger på den forriges hash, og alle hashes kan genberegnes.

async function hentKaede() {
  return prisma.auditHaendelse.findMany({ orderBy: { server_seq: 'asc' } });
}

async function kontrollerKaede() {
  const kaede = await hentKaede();
  let forrige = GENESIS_HASH;
  for (const raekke of kaede) {
    expect(raekke.forrige_hash).toBe(forrige);
    expect(beregnHash(raekke.forrige_hash, hashIndholdFraRaekke(raekke))).toBe(raekke.hash);
    forrige = raekke.hash;
  }
  return kaede;
}

function haendelse(overskriv: Partial<NyHaendelse> = {}): NyHaendelse {
  return {
    handling: 'HEST_AENDRET',
    entitet: 'hest',
    entitet_id: 'test',
    bruger: null,
    tidspunkt: new Date(),
    foer: { godkendt_til_begyndere: false },
    efter: { godkendt_til_begyndere: true },
    ...overskriv,
  };
}

describe('audit-servicens hashkæde', () => {
  beforeEach(nulstilData);
  afterAll(() => prisma.$disconnect());

  it('kæder hændelser fra genesis, og hver hash kan genberegnes', async () => {
    const malene = await prisma.bruger.create({
      data: { navn: 'Malene', roller: ['Ledelse', 'Ridelaerer'] },
    });
    const bruger = { id: malene.id, navn: malene.navn, roller: malene.roller };

    for (const handling of ['HEST_AENDRET', 'RYTTER_AENDRET', 'TILDELING_GODKENDT'] as const) {
      await prisma.$transaction((tx) =>
        logHaendelse(tx, haendelse({ handling, entitet_id: handling, bruger })),
      );
    }

    const kaede = await kontrollerKaede();
    expect(kaede).toHaveLength(3);
    expect(kaede[0]?.forrige_hash).toBe(GENESIS_HASH);
    expect(kaede[0]?.rolle).toBe('Ledelse');
  });

  it('logger krypterede felter kun som "ændret"', async () => {
    await prisma.$transaction((tx) =>
      logHaendelse(
        tx,
        haendelse({
          handling: 'SIKKERHEDSPROFIL_AENDRET',
          foer: { faldtraume_note: 'v1:aaa:bbb:ccc', kun_rolige_heste: false },
          efter: { faldtraume_note: 'Hemmelig klartekst', kun_rolige_heste: true },
          krypteredeFelter: ['faldtraume_note'],
        }),
      ),
    );

    const [raekke] = await kontrollerKaede();
    expect(raekke?.foer).toEqual({ faldtraume_note: 'ændret', kun_rolige_heste: false });
    expect(raekke?.efter).toEqual({ faldtraume_note: 'ændret', kun_rolige_heste: true });
    expect(JSON.stringify([raekke?.foer, raekke?.efter])).not.toMatch(/Hemmelig|v1:/);
  });

  it('holder kæden ubrudt ved samtidige skrivninger', async () => {
    await Promise.all(
      Array.from({ length: 10 }, (_, i) =>
        prisma.$transaction((tx) => logHaendelse(tx, haendelse({ entitet_id: String(i) })), {
          maxWait: 10_000,
          timeout: 10_000,
        }),
      ),
    );

    expect(await kontrollerKaede()).toHaveLength(10);
  });
});
