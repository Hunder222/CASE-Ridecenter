import { describe, expect, it } from 'vitest';
import { validerPlacering } from '../../../src/index';
import { basis, lavHest, lavKontekst } from '../../fixtures/byggere';

// HC-05: springforbud og højst ét springhold om ugen. Gælder kun springhold.

const springhold = { erSpringhold: true, niveau: 'Oevet' as const, ugedag: 2 as const, dato: '2026-07-07' };

describe('HC-05: springforbud', () => {
  it('giver HC05_SPRINGFORBUD for en hest med springforbud, også uden spring tidligere på ugen', () => {
    const boelle = lavHest({ navn: 'Bølle', springforbud: true });
    const koder = basis(
      validerPlacering(lavKontekst({ hest: boelle, lektion: springhold, springBrugtUge: 0 })),
    );
    expect(koder).toContain('HC05_SPRINGFORBUD');
  });

  it('giver HC05_SPRINGFORBUD, når hesten må springe 0 gange om ugen', () => {
    const hest = lavHest({ maxSpringUge: 0 });
    const koder = basis(validerPlacering(lavKontekst({ hest, lektion: springhold, springBrugtUge: 0 })));
    expect(koder).toContain('HC05_SPRINGFORBUD');
  });

  it('påvirker ikke hold uden spring', () => {
    const boelle = lavHest({ navn: 'Bølle', springforbud: true });
    expect(validerPlacering(lavKontekst({ hest: boelle, springBrugtUge: 0 }))).toEqual([]);
  });
});

describe('HC-05: højst ét springhold om ugen', () => {
  it('giver HC05_SPRING_UGEGRAENSE for en hest uden forbud, der allerede har sprunget', () => {
    const koder = basis(validerPlacering(lavKontekst({ lektion: springhold, springBrugtUge: 1 })));
    expect(koder).toEqual(['HC05_SPRING_UGEGRAENSE']);
  });

  it('lader en hest som Arthur (maxSpringUge 1) få præcis ét springhold om ugen', () => {
    const arthur = lavHest({ navn: 'Arthur', stangmaalCm: 127, maxSpringUge: 1 });
    expect(validerPlacering(lavKontekst({ hest: arthur, lektion: springhold, springBrugtUge: 0 }))).toEqual(
      [],
    );
    expect(
      basis(validerPlacering(lavKontekst({ hest: arthur, lektion: springhold, springBrugtUge: 1 }))),
    ).toEqual(['HC05_SPRING_UGEGRAENSE']);
  });

  it('kan ikke hæves af forkerte data (maxSpringUge 2)', () => {
    const hest = lavHest({ maxSpringUge: 2 });
    expect(basis(validerPlacering(lavKontekst({ hest, lektion: springhold, springBrugtUge: 1 })))).toEqual([
      'HC05_SPRING_UGEGRAENSE',
    ]);
  });

  it('tæller ikke spring på hold uden spring', () => {
    expect(validerPlacering(lavKontekst({ springBrugtUge: 1 }))).toEqual([]);
  });
});
