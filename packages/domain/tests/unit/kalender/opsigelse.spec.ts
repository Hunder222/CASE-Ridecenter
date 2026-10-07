import { describe, expect, it } from 'vitest';
import { beregnOpsigelsesSlutdato } from '../../../src/kalender/opsigelse';

describe('Opsigelse slutdato beregning (US4, FR-017, T152)', () => {
  it('beregner slutdato som løbende måned + 30 dage for dato i oktober', () => {
    // 2026-10-10 -> oktober slutter 2026-10-31 -> + 30 dage giver 2026-11-30
    const slutdato = beregnOpsigelsesSlutdato('2026-10-10');
    expect(slutdato).toBe('2026-11-30');
  });

  it('beregner korrekt over månedsskifte for februar i et normalt år', () => {
    // 2026-02-05 -> februar slutter 2026-02-28 -> + 30 dage giver 2026-03-30
    const slutdato = beregnOpsigelsesSlutdato('2026-02-05');
    expect(slutdato).toBe('2026-03-30');
  });

  it('beregner korrekt for opsigelse modtaget på sidste dag i en måned', () => {
    // 2026-05-31 -> maj slutter 2026-05-31 -> + 30 dage giver 2026-06-30
    const slutdato = beregnOpsigelsesSlutdato('2026-05-31');
    expect(slutdato).toBe('2026-06-30');
  });
});

