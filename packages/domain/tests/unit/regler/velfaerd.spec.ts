import { describe, expect, it } from 'vitest';
import { validerPlacering, type Sundhedsstatus } from '../../../src/index';
import { basis, lavHest, lavKontekst } from '../../fixtures/byggere';

// HC-01 – HC-04: hestens velfærd på dagen (forfatningen, Princip I). Reglerne testes gennem
// validerPlacering, som samler de dynamiske regler (domain-engine.md §1). Standardkonteksten er
// en lovlig placering fredag på et letøvet hold, så hver test kun ændrer den regel, den gælder.

describe('HC-01: en normal hest går højst 3 hold om dagen', () => {
  it('er lovlig med 2 hold i forvejen', () => {
    expect(validerPlacering(lavKontekst({ dagsbelastning: 2 }))).toEqual([]);
  });

  it('giver HC01_DAGSGRAENSE med 3 hold i forvejen', () => {
    expect(basis(validerPlacering(lavKontekst({ dagsbelastning: 3 })))).toEqual(['HC01_DAGSGRAENSE']);
  });

  it('kan ikke hæves af forkerte data (maxLektionerDag 4)', () => {
    const hest = lavHest({ maxLektionerDag: 4 });
    expect(basis(validerPlacering(lavKontekst({ hest, dagsbelastning: 3 })))).toEqual(['HC01_DAGSGRAENSE']);
  });

  it('bruger en lavere grænse fra hestens data (maxLektionerDag 2)', () => {
    const hest = lavHest({ maxLektionerDag: 2 });
    expect(basis(validerPlacering(lavKontekst({ hest, dagsbelastning: 2 })))).toEqual(['HC01_DAGSGRAENSE']);
  });
});

describe('HC-02: en skånehest går højst 2 hold om dagen', () => {
  const skaanehest = lavHest({ navn: 'Sally', skaane: true });

  it('er lovlig med 1 hold i forvejen', () => {
    expect(validerPlacering(lavKontekst({ hest: skaanehest, dagsbelastning: 1 }))).toEqual([]);
  });

  it('giver HC02_SKAANE_DAGSGRAENSE med 2 hold i forvejen', () => {
    expect(basis(validerPlacering(lavKontekst({ hest: skaanehest, dagsbelastning: 2 })))).toEqual([
      'HC02_SKAANE_DAGSGRAENSE',
    ]);
  });

  it('får aldrig et 3. hold, heller ikke hvis maxLektionerDag fejlagtigt er 3', () => {
    const forkerteData = lavHest({ navn: 'Sally', skaane: true, maxLektionerDag: 3 });
    expect(basis(validerPlacering(lavKontekst({ hest: forkerteData, dagsbelastning: 2 })))).toEqual([
      'HC02_SKAANE_DAGSGRAENSE',
    ]);
    expect(basis(validerPlacering(lavKontekst({ hest: forkerteData, dagsbelastning: 3 })))).toContain(
      'HC02_SKAANE_DAGSGRAENSE',
    );
  });
});

describe('HC-03: ingen lektion på hestens hviledag', () => {
  it('giver HC03_HVILEDAG, når lektionen ligger på hviledagen', () => {
    const hest = lavHest({ hviledag: 5 });
    expect(basis(validerPlacering(lavKontekst({ hest })))).toEqual(['HC03_HVILEDAG']);
  });

  it('er lovlig dagen før hviledagen', () => {
    const hest = lavHest({ hviledag: 5 });
    const torsdag = { dato: '2026-07-02', ugedag: 4 as const };
    expect(validerPlacering(lavKontekst({ hest, lektion: torsdag }))).toEqual([]);
  });
});

describe('HC-04: kun raske og aktive heste', () => {
  it.each<Sundhedsstatus>(['Sygemeldt', 'Skadet', 'Karantaene'])(
    'giver HC04_IKKE_RASK, når hesten er %s',
    (sundhedsstatus) => {
      const hest = lavHest({ sundhedsstatus });
      expect(basis(validerPlacering(lavKontekst({ hest })))).toEqual(['HC04_IKKE_RASK']);
    },
  );

  it('giver HC04_IKKE_RASK, når hesten ikke er aktiv', () => {
    const hest = lavHest({ aktiv: false });
    expect(basis(validerPlacering(lavKontekst({ hest })))).toEqual(['HC04_IKKE_RASK']);
  });

  it('er lovlig for en aktiv hest med status Aktiv', () => {
    expect(validerPlacering(lavKontekst({ hest: lavHest({ sundhedsstatus: 'Aktiv' }) }))).toEqual([]);
  });
});
