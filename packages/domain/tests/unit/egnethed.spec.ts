import { describe, expect, it } from 'vitest';
import { beregnEgnethed } from '../../src/index';
import { basis, lavHest, lavHold, lavRytter } from '../fixtures/byggere';

// Statisk egnethed (domain-engine.md §1, R6): HC-04, HC-05 (forbud), HC-06, HC-07 og HC-08 for
// rytter × hold. Dagsbelastning og springgrænse pr. uge er dynamiske og indgår ikke.

const aslan = lavHest({ id: 'h1-aslan', navn: 'Aslan', stangmaalCm: 160, maxRytterVaegtKg: 80 });
const syg = lavHest({ id: 'h2-syg', navn: 'Toobi', sundhedsstatus: 'Sygemeldt' });
const boelle = lavHest({ id: 'h3-boelle', navn: 'Bølle', springforbud: true });
const wally = lavHest({ id: 'h4-wally', navn: 'Wally', maxRytterVaegtKg: 35, maxRytterHoejdeCm: 130 });
const pixie = lavHest({ id: 'h5-pixie', navn: 'Pixie', temperament: 'Frisk' });
const zigge = lavHest({ id: 'h6-zigge', navn: 'Zigge', godkendtTilBegyndere: false });
const arthur = lavHest({ id: 'h7-arthur', navn: 'Arthur', maxSpringUge: 1 });

const alle = [aslan, syg, boelle, wally, pixie, zigge, arthur];

function koderFor(resultat: ReturnType<typeof beregnEgnethed>, hestId: string): string[] {
  return basis(resultat.udelukkede.find((u) => u.hestId === hestId)?.koder ?? []);
}

describe('beregnEgnethed', () => {
  it('udelukker hver hest med sine årsagskoder og godkender resten', () => {
    const emma = lavRytter({ id: 'rytter-emma', vaegtKg: 37, hoejdeCm: 144, forbudteHeste: [pixie.id] });
    const begynderspring = lavHold({ niveau: 'Begynder', erSpringhold: true });
    const resultat = beregnEgnethed(emma, begynderspring, alle);

    expect(resultat.godkendte).toEqual([aslan.id, arthur.id]);
    expect(koderFor(resultat, syg.id)).toEqual(['HC04_IKKE_RASK']);
    expect(koderFor(resultat, boelle.id)).toEqual(['HC05_SPRINGFORBUD']);
    expect(koderFor(resultat, wally.id)).toEqual(expect.arrayContaining(['HC06_VAEGT', 'HC06_HOEJDE']));
    expect(koderFor(resultat, pixie.id)).toEqual(['HC07_FORBUDT_HEST']);
    expect(koderFor(resultat, zigge.id)).toEqual(['HC08_NIVEAU_BEGYNDER']);
  });

  it('samler alle koder for en hest, der rammer flere regler', () => {
    const sygOgForbudt = lavHest({ id: 'h9-rosa', navn: 'Rosa', sundhedsstatus: 'Skadet' });
    const rytter = lavRytter({ forbudteHeste: [sygOgForbudt.id] });
    const resultat = beregnEgnethed(rytter, lavHold(), [sygOgForbudt]);
    expect(koderFor(resultat, sygOgForbudt.id)).toEqual(
      expect.arrayContaining(['HC04_IKKE_RASK', 'HC07_FORBUDT_HEST']),
    );
  });

  it('udelukker ikke på dynamiske regler: en hest, der må springe én gang, er egnet til springhold', () => {
    const springhold = lavHold({ erSpringhold: true, ugedag: 2 });
    expect(beregnEgnethed(lavRytter(), springhold, [arthur]).godkendte).toEqual([arthur.id]);
  });

  it('udelukker en hest med maxSpringUge 0 fra springhold (HC-05 forbud)', () => {
    const springhold = lavHold({ erSpringhold: true, ugedag: 2 });
    const ingenSpring = lavHest({ id: 'h8-karla', navn: 'Karla', maxSpringUge: 0 });
    const resultat = beregnEgnethed(lavRytter(), springhold, [ingenSpring]);
    expect(koderFor(resultat, ingenSpring.id)).toContain('HC05_SPRINGFORBUD');
  });

  it('godkender en hest med springforbud på et hold uden spring', () => {
    expect(beregnEgnethed(lavRytter(), lavHold(), [boelle]).godkendte).toEqual([boelle.id]);
  });

  it('er sorteret deterministisk på hest-id uanset inputrækkefølgen', () => {
    const rytter = lavRytter({ forbudteHeste: [pixie.id, zigge.id] });
    const fremad = beregnEgnethed(rytter, lavHold(), alle);
    const baglaens = beregnEgnethed(rytter, lavHold(), [...alle].reverse());

    expect(baglaens).toEqual(fremad);
    expect(fremad.godkendte).toEqual([...fremad.godkendte].sort());
    const udelukkedeIder = fremad.udelukkede.map((u) => u.hestId);
    expect(udelukkedeIder).toEqual([...udelukkedeIder].sort());
  });
});
