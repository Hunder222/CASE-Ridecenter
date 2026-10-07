import { describe, expect, it } from 'vitest';
import { foreslaaErstatninger } from '../../../src/erstatning/foreslaa-erstatninger';
import type { HestData } from '../../../src/typer';

function mockHest(overrides: Partial<HestData>): HestData {
  return {
    id: 'hest-1',
    navn: 'Donny',
    stangmaalCm: 145,
    maxRytterVaegtKg: 75,
    maxRytterHoejdeCm: 180,
    temperament: 'Rolig',
    godkendtTilBegyndere: true,
    egnetOevet: true,
    skaane: false,
    maxLektionerDag: 3,
    springforbud: false,
    maxSpringUge: 1,
    hviledag: 7, // søndag
    sundhedsstatus: 'Aktiv',
    aktiv: true,
    ...overrides,
  };
}

describe('Top-3 akut hesteerstatning (US3, T137)', () => {
  it('returnerer op til 3 godkendte erstatningsheste sorteret efter dagsbelastning og temperament', () => {
    const heste: HestData[] = [
      mockHest({ id: 'h1', navn: 'Donny', temperament: 'Rolig' }),
      mockHest({ id: 'h2', navn: 'Bella', temperament: 'Normal' }),
      mockHest({ id: 'h3', navn: 'Flicka', temperament: 'Frisk' }),
      mockHest({ id: 'h4', navn: 'Apollo', temperament: 'Rolig' }),
    ];

    const dagsbelastninger = {
      h1: 1,
      h2: 0,
      h3: 0,
      h4: 2,
    };

    const startTid = Date.now();
    const forslag = foreslaaErstatninger({
      plads: { godkendteHeste: ['h1', 'h2', 'h3', 'h4'] },
      heste,
      dagsbelastninger,
      lektionUgedag: 5, // fredag
    });
    const varighed = Date.now() - startTid;

    expect(varighed).toBeLessThan(200); // < 200 ms benchmark
    expect(forslag.length).toBe(3);

    // h2 (0 belastning, Normal) og h3 (0 belastning, Frisk) har lavere belastning end h1 (1 belastning)
    expect(forslag[0]!.hestId).toBe('h2');
    expect(forslag[1]!.hestId).toBe('h3');
    expect(forslag[2]!.hestId).toBe('h1');
  });

  it('ekskluderer heste der ikke er godkendt til eleven', () => {
    const heste: HestData[] = [
      mockHest({ id: 'h1', navn: 'Donny' }),
      mockHest({ id: 'h2', navn: 'Bella' }),
    ];

    const forslag = foreslaaErstatninger({
      plads: { godkendteHeste: ['h1'] }, // kun h1 er godkendt
      heste,
      dagsbelastninger: {},
      lektionUgedag: 5,
    });

    expect(forslag.length).toBe(1);
    expect(forslag[0]!.hestId).toBe('h1');
  });

  it('ekskluderer heste med sundhedsstatus != Aktiv', () => {
    const heste: HestData[] = [
      mockHest({ id: 'h1', navn: 'Donny', sundhedsstatus: 'Sygemeldt' }),
      mockHest({ id: 'h2', navn: 'Bella', sundhedsstatus: 'Skadet' }),
      mockHest({ id: 'h3', navn: 'Flicka', sundhedsstatus: 'Aktiv' }),
    ];

    const forslag = foreslaaErstatninger({
      plads: { godkendteHeste: ['h1', 'h2', 'h3'] },
      heste,
      dagsbelastninger: {},
      lektionUgedag: 5,
    });

    expect(forslag.length).toBe(1);
    expect(forslag[0]!.hestId).toBe('h3');
  });

  it('ekskluderer heste der har nået dagsgrænsen (3 for normale, 2 for skåne)', () => {
    const heste: HestData[] = [
      mockHest({ id: 'h1', navn: 'Donny', skaane: false, maxLektionerDag: 3 }),
      mockHest({ id: 'h2', navn: 'SkaaneHest', skaane: true, maxLektionerDag: 2 }),
      mockHest({ id: 'h3', navn: 'LedigHest', skaane: false, maxLektionerDag: 3 }),
    ];

    const dagsbelastninger = {
      h1: 3, // nået max 3
      h2: 2, // nået max 2 for skåne
      h3: 1, // har 2 ledige
    };

    const forslag = foreslaaErstatninger({
      plads: { godkendteHeste: ['h1', 'h2', 'h3'] },
      heste,
      dagsbelastninger,
      lektionUgedag: 5,
    });

    expect(forslag.length).toBe(1);
    expect(forslag[0]!.hestId).toBe('h3');
  });

  it('ekskluderer heste der har hviledag på lektionens ugedag', () => {
    const heste: HestData[] = [
      mockHest({ id: 'h1', navn: 'Donny', hviledag: 5 }), // hviledag fredag
      mockHest({ id: 'h2', navn: 'Bella', hviledag: 1 }), // hviledag mandag
    ];

    const forslag = foreslaaErstatninger({
      plads: { godkendteHeste: ['h1', 'h2'] },
      heste,
      dagsbelastninger: {},
      lektionUgedag: 5, // fredag
    });

    expect(forslag.length).toBe(1);
    expect(forslag[0]!.hestId).toBe('h2');
  });
});
