import { describe, expect, it } from 'vitest';
import {
  AARSAGSKODER,
  FORBUDTE_TERMER,
  forklar,
  type Aarsagskode,
  type Basiskode,
  type ForklaringsKontekst,
} from '../../src/index';
import { SKABELONER } from '../../src/forklaring/skabeloner';

// Danske forklaringer (FR-010) fra årsagskoderne i domain-engine.md §4 og invariant 5:
// ingen tekst må nævne diagnoser. HC-07 formuleres kun som "af hensyn til rytterens sikkerhed".

const TOOBI = 'hest-toobi';
const ZIGGE = 'hest-zigge';
const kontekst: ForklaringsKontekst = {
  hesteNavne: { [TOOBI]: 'Toobi', [ZIGGE]: 'Zigge' },
  rytterNavn: 'Sophia',
  ugedag: 5,
};
const alleKoder = Object.keys(AARSAGSKODER) as Basiskode[];
const hc07Koder = alleKoder.filter((kode) => kode.startsWith('HC07_'));

function indeholderForbudtTerm(tekst: string): string | undefined {
  const smaa = tekst.toLowerCase();
  return FORBUDTE_TERMER.find((term) => smaa.includes(term.toLowerCase()));
}

describe('skabeloner', () => {
  it.each(alleKoder)('%s har en dansk skabelon', (kode) => {
    expect(SKABELONER[kode]?.trim()).toBeTruthy();
  });

  it('ingen skabelon indeholder et ord fra FORBUDTE_TERMER (invariant 5)', () => {
    expect(FORBUDTE_TERMER.length).toBeGreaterThan(0);
    for (const [kode, skabelon] of Object.entries(SKABELONER)) {
      expect(indeholderForbudtTerm(skabelon), `${kode}: "${skabelon}"`).toBeUndefined();
    }
  });
});

describe('forklar', () => {
  it.each(alleKoder)('%s giver en sætning uden tomme pladsholdere', (kode) => {
    for (const koder of [[kode], [`${kode}:${TOOBI}`]] as Aarsagskode[][]) {
      const tekst = forklar(koder, kontekst);
      expect(tekst.trim()).not.toBe('');
      expect(tekst).not.toMatch(/\{(hest|n|dag|status)\}|undefined|NaN/);
      expect(indeholderForbudtTerm(tekst)).toBeUndefined();
    }
  });

  it('forklarer 2. ønske og dagsgrænsen med hestenavn, ugedag og regel', () => {
    const tekst = forklar(['SC01_OENSKE_2', `HC01_DAGSGRAENSE:${TOOBI}`], kontekst);
    expect(tekst).toContain('2. ønske');
    expect(tekst).toContain('Toobi');
    expect(tekst).toContain('fredag');
    expect(tekst).toContain('HC-01');
    // Fast rækkefølge: udfaldet først, derefter hvorfor højere ønsker ikke kunne opfyldes.
    expect(tekst.indexOf('2. ønske')).toBeLessThan(tekst.indexOf('Toobi'));
  });

  it('giver samme tekst uanset kodernes rækkefølge', () => {
    const koder: Aarsagskode[] = [
      'SC01_OENSKE_2',
      `HC01_DAGSGRAENSE:${TOOBI}`,
      `SC02_TABT_TIL_TURNUS:${ZIGGE}`,
    ];
    expect(forklar([...koder].reverse(), kontekst)).toBe(forklar(koder, kontekst));
  });

  it.each(hc07Koder)('%s formuleres som "af hensyn til rytterens sikkerhed (HC-07)"', (kode) => {
    expect(forklar([kode], kontekst)).toContain('af hensyn til rytterens sikkerhed (HC-07)');
    expect(forklar([`${kode}:${TOOBI}`], kontekst)).toContain('af hensyn til rytterens sikkerhed (HC-07)');
  });

  it('markerer en alternativ tildeling og turnus +3 (US2 AS4)', () => {
    const tekst = forklar(['ALT_TILDELING', 'SC03_BELASTNINGSUDJAEVNING'], kontekst);
    expect(tekst).toContain('Alternativ tildeling (ønsker optaget)');
    expect(tekst).toContain('+3');
  });

  it('viser turnusprioriteten for næste måned efter et 2. ønske', () => {
    expect(forklar(['SC01_OENSKE_2'], kontekst)).toContain('+1');
  });
});
