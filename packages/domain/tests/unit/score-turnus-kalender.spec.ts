import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { datoerIMaaned, foersteDag, forrigeMaaned, sidsteDag, turnusPoint, ugedagFor } from '../../src/index';
import { scoreHest } from '../../src/tildeling/score';
import { lavHest, lavRytter } from '../fixtures/byggere';

// Turnus (R5), score (domain-engine.md §6 f) og kalenderen i Europe/Copenhagen.

describe('turnusPoint', () => {
  it('giver 0/1/2 for 1./2./3. ønske og 3 for en alternativ tildeling', () => {
    expect(turnusPoint(1)).toBe(0);
    expect(turnusPoint(2)).toBe(1);
    expect(turnusPoint(3)).toBe(2);
    expect(turnusPoint('alternativ')).toBe(3);
  });
});

describe('scoreHest', () => {
  const rytter = lavRytter();
  const normal = lavHest({ navn: 'Donny', temperament: 'Normal' });
  const rolig = lavHest({ navn: 'Toobi', temperament: 'Rolig' });
  const frisk = lavHest({ navn: 'Pixie', temperament: 'Frisk' });

  it('giver 100/60/30 for 1./2./3. ønske og 0 for en hest, rytteren ikke har ønsket (SC-01)', () => {
    expect(scoreHest({ oenskePrioritet: 1, ugebelastning: 0, rytter, hest: normal })).toBe(100);
    expect(scoreHest({ oenskePrioritet: 2, ugebelastning: 0, rytter, hest: normal })).toBe(60);
    expect(scoreHest({ oenskePrioritet: 3, ugebelastning: 0, rytter, hest: normal })).toBe(30);
    expect(scoreHest({ oenskePrioritet: null, ugebelastning: 0, rytter, hest: normal })).toBe(0);
  });

  it('trækker 10 fra pr. tildeling, hesten allerede har i ugen (SC-03)', () => {
    expect(scoreHest({ oenskePrioritet: 1, ugebelastning: 2, rytter, hest: normal })).toBe(80);
    expect(scoreHest({ oenskePrioritet: null, ugebelastning: 1, rytter, hest: normal })).toBe(-10);
  });

  it('lægger 15 til for en rytter, der er klar til udvikling, på en hest, der ikke er Rolig (SC-04)', () => {
    const klar = lavRytter({ klarTilUdvikling: true });
    expect(scoreHest({ oenskePrioritet: 1, ugebelastning: 0, rytter: klar, hest: normal })).toBe(115);
    expect(scoreHest({ oenskePrioritet: 1, ugebelastning: 0, rytter: klar, hest: frisk })).toBe(115);
    expect(scoreHest({ oenskePrioritet: 1, ugebelastning: 0, rytter: klar, hest: rolig })).toBe(100);
    expect(scoreHest({ oenskePrioritet: 1, ugebelastning: 0, rytter, hest: frisk })).toBe(100);
  });
});

describe('kalender (Europe/Copenhagen)', () => {
  it('finder fredagene i juli 2026', () => {
    expect(datoerIMaaned('2026-07', 5)).toEqual([
      '2026-07-03',
      '2026-07-10',
      '2026-07-17',
      '2026-07-24',
      '2026-07-31',
    ]);
  });

  it('finder mandagene i februar 2026 (4 uger)', () => {
    expect(datoerIMaaned('2026-02', 1)).toEqual(['2026-02-02', '2026-02-09', '2026-02-16', '2026-02-23']);
  });

  it('beregner forrige måned over et årsskifte', () => {
    expect(forrigeMaaned('2026-01')).toBe('2025-12');
    expect(forrigeMaaned('2026-07')).toBe('2026-06');
  });

  it('beregner første og sidste dag i måneden inkl. skudår', () => {
    expect(foersteDag('2026-07')).toBe('2026-07-01');
    expect(sidsteDag('2026-07')).toBe('2026-07-31');
    expect(sidsteDag('2026-02')).toBe('2026-02-28');
    expect(sidsteDag('2028-02')).toBe('2028-02-29');
  });

  it('beregner ISO-ugedagen for en dato', () => {
    expect(ugedagFor('2026-07-03')).toBe(5);
    expect(ugedagFor('2026-07-05')).toBe(7);
    expect(ugedagFor('2026-07-06')).toBe(1);
  });
});

describe.each([
  { tz: 'America/New_York', forskydningJuli: 240 },
  { tz: 'Europe/Copenhagen', forskydningJuli: -120 },
  { tz: 'Pacific/Kiritimati', forskydningJuli: -840 },
])('kalenderen er uafhængig af maskinens tidszone: TZ=$tz', ({ tz, forskydningJuli }) => {
  beforeEach(() => {
    vi.stubEnv('TZ', tz);
  });
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('kører faktisk i tidszonen', () => {
    expect(new Date('2026-07-03T12:00:00Z').getTimezoneOffset()).toBe(forskydningJuli);
  });

  it('giver de samme datoer, også over sommertidsskift', () => {
    expect(datoerIMaaned('2026-07', 5)).toEqual([
      '2026-07-03',
      '2026-07-10',
      '2026-07-17',
      '2026-07-24',
      '2026-07-31',
    ]);
    // Sommertid starter søndag 29. marts og slutter søndag 25. oktober 2026 i Danmark.
    expect(datoerIMaaned('2026-03', 7)).toEqual([
      '2026-03-01',
      '2026-03-08',
      '2026-03-15',
      '2026-03-22',
      '2026-03-29',
    ]);
    expect(datoerIMaaned('2026-10', 7)).toEqual(['2026-10-04', '2026-10-11', '2026-10-18', '2026-10-25']);
    expect(ugedagFor('2026-03-29')).toBe(7);
    expect(ugedagFor('2026-10-25')).toBe(7);
    expect(sidsteDag('2026-10')).toBe('2026-10-31');
    expect(forrigeMaaned('2026-01')).toBe('2025-12');
  });
});
