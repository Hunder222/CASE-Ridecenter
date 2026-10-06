import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import {
  FORBUDTE_TERMER,
  mrvGreedySolver,
  validerPlan,
  type AllokeringsInput,
  type Erfaringsniveau,
  type HestData,
  type HoldData,
  type Niveau,
  type RytterRegelData,
  type Sundhedsstatus,
  type Temperament,
  type Ugedag,
} from '../../src/index';
import { blandRaekkefoelge, tilPlan } from '../fixtures/byggere';

// Invarianterne fra domain-engine.md §3 som egenskaber (R12): for ethvert gyldigt input er motorens
// plan lovlig, deterministisk og fri for Art. 9-ord. Inputtet er tilfældigt, men gyldigt: afledte
// felter beregnes som i API'et, en hest har højst én partrytter, og ingen hest er både forbudt og påkrævet.

const KOERSLER = 200;
const UGEDAGE: Ugedag[] = [1, 2, 3, 4, 5, 6, 7];
const NIVEAUER: Niveau[] = ['Traekhold', 'Begynder', 'Letoevet', 'Oevet', 'Parthold'];
const nr = (i: number) => String(i + 1).padStart(3, '0');
/** true med sandsynligheden 1/n. */
const sjaelden = (n: number) => fc.integer({ min: 1, max: n }).map((x) => x === 1);

const raaHest = fc.record({
  stangmaalCm: fc.integer({ min: 110, max: 175 }),
  hoejdegraense: fc.boolean(),
  temperament: fc.constantFrom<Temperament>('Rolig', 'Normal', 'Frisk'),
  godkendtTilBegyndere: fc.boolean(),
  egnetOevet: sjaelden(5).map((x) => !x),
  skaane: sjaelden(5),
  springforbud: sjaelden(4),
  hviledag: fc.constantFrom(...UGEDAGE),
  sundhedsstatus: fc.constantFrom<Sundhedsstatus>(
    'Aktiv',
    'Aktiv',
    'Aktiv',
    'Sygemeldt',
    'Skadet',
    'Karantaene',
  ),
  aktiv: sjaelden(10).map((x) => !x),
});

const raaHold = fc.record({
  ugedag: fc.constantFrom(...UGEDAGE),
  niveau: fc.constantFrom(...NIVEAUER),
  spring: sjaelden(4),
});

function raaRytter(antalHeste: number, antalHold: number) {
  const hest = fc.integer({ min: 0, max: antalHeste - 1 });
  const faa = (max: number, vaegt: number) =>
    fc.oneof(
      { weight: vaegt, arbitrary: fc.constant<number[]>([]) },
      { weight: 1, arbitrary: fc.uniqueArray(hest, { minLength: 1, maxLength: max }) },
    );
  return fc.record({
    hold: fc.integer({ min: 0, max: antalHold - 1 }),
    hoejdeCm: fc.integer({ min: 105, max: 185 }),
    vaegtKg: fc.integer({ min: 17, max: 80 }),
    erfaringsniveau: fc.constantFrom<Erfaringsniveau>('Begynder', 'Letoevet', 'Oevet'),
    klarTilUdvikling: sjaelden(5),
    erHjaelper: sjaelden(10),
    parthest: fc.oneof({ weight: 6, arbitrary: fc.constant(null) }, { weight: 1, arbitrary: hest }),
    partGodkendtTrodsNiveau: fc.boolean(),
    forbudte: faa(3, 6),
    paakraevede: faa(2, 12),
    kunRoligeHeste: sjaelden(8),
    oensker: fc.uniqueArray(hest, { maxLength: 3 }),
    turnus: fc.integer({ min: 0, max: 3 }),
    ancienitetAar: fc.integer({ min: 2018, max: 2026 }),
  });
}

type RaaHest = typeof raaHest extends fc.Arbitrary<infer T> ? T : never;
type RaaHold = typeof raaHold extends fc.Arbitrary<infer T> ? T : never;
type RaaRytter = ReturnType<typeof raaRytter> extends fc.Arbitrary<infer T> ? T : never;

function byggInput(raaHeste: RaaHest[], raaHoldListe: RaaHold[], raaRyttere: RaaRytter[]): AllokeringsInput {
  const heste: HestData[] = raaHeste.map((h, i) => ({
    id: `h${nr(i)}`,
    navn: `Hest ${nr(i)}`,
    stangmaalCm: h.stangmaalCm,
    maxRytterVaegtKg: h.stangmaalCm - 80,
    maxRytterHoejdeCm: h.hoejdegraense ? h.stangmaalCm + 15 : null,
    temperament: h.temperament,
    godkendtTilBegyndere: h.godkendtTilBegyndere,
    egnetOevet: h.egnetOevet,
    skaane: h.skaane,
    maxLektionerDag: h.skaane ? 2 : 3,
    springforbud: h.springforbud,
    maxSpringUge: h.springforbud ? 0 : 1,
    hviledag: h.hviledag,
    sundhedsstatus: h.sundhedsstatus,
    aktiv: h.aktiv,
  }));
  const hestId = (indeks: number) => heste[indeks]?.id ?? '';

  const hold: HoldData[] = raaHoldListe.map((h, i) => ({
    id: `hold${nr(i)}`,
    holdnavn: `Hold ${nr(i)}`,
    niveau: h.niveau,
    erSpringhold: h.spring,
    ugedag: h.ugedag,
    starttid: '15:00',
    varighedMin: 45,
    maxKapacitet: 10,
  }));

  const brugtePartheste = new Set<string>();
  const ryttere: RytterRegelData[] = raaRyttere.map((r, i) => {
    let partaftaleHestId: string | null = null;
    if (r.parthest !== null && !brugtePartheste.has(hestId(r.parthest))) {
      partaftaleHestId = hestId(r.parthest);
      brugtePartheste.add(partaftaleHestId);
    }
    const forbudteHeste = r.forbudte.map(hestId);
    return {
      id: `r${nr(i)}`,
      hoejdeCm: r.hoejdeCm,
      vaegtKg: r.vaegtKg,
      erfaringsniveau: r.erfaringsniveau,
      klarTilUdvikling: r.klarTilUdvikling,
      erHjaelper: r.erHjaelper,
      partaftaleHestId,
      partaftaleGodkendtTrodsNiveau: partaftaleHestId !== null && r.partGodkendtTrodsNiveau,
      forbudteHeste,
      paakraevedeHeste: r.paakraevede.map(hestId).filter((id) => !forbudteHeste.includes(id)),
      kunRoligeHeste: r.kunRoligeHeste,
    };
  });

  return {
    maaned: '2026-07',
    heste,
    hold,
    ryttere,
    tilmeldinger: raaRyttere.map((r, i) => ({
      id: `t${nr(i)}`,
      rytterId: `r${nr(i)}`,
      holdId: hold[r.hold]?.id ?? '',
      ancienitetDato: `${r.ancienitetAar}-01-01`,
    })),
    oensker: raaRyttere.flatMap((r, i) =>
      r.oensker.map((indeks, p) => ({
        rytterId: `r${nr(i)}`,
        prioritet: (p + 1) as 1 | 2 | 3,
        hestId: hestId(indeks),
      })),
    ),
    turnus: Object.fromEntries(raaRyttere.map((r, i) => [`r${nr(i)}`, r.turnus])),
  };
}

/** 3–25 heste, 2–15 hold (nogle springhold) og 5–120 ryttere med spærringer, partaftaler og 0–3 ønsker. */
const tilfaeldigtInput: fc.Arbitrary<AllokeringsInput> = fc
  .tuple(fc.integer({ min: 3, max: 25 }), fc.integer({ min: 2, max: 15 }))
  .chain(([antalHeste, antalHold]) =>
    fc.tuple(
      fc.array(raaHest, { minLength: antalHeste, maxLength: antalHeste }),
      fc.array(raaHold, { minLength: antalHold, maxLength: antalHold }),
      fc.array(raaRytter(antalHeste, antalHold), { minLength: 5, maxLength: 120 }),
    ),
  )
  .map(([heste, hold, ryttere]) => byggInput(heste, hold, ryttere));

function egenskab(test: (input: AllokeringsInput) => void): void {
  fc.assert(fc.property(tilfaeldigtInput, test), { numRuns: KOERSLER });
}

describe('Welfare Guard-invarianter for mrv-greedy@1 (fast-check)', { timeout: 300_000 }, () => {
  it('(1) Sikkerhed: validerPlan(allokér(input)) = []', () => {
    egenskab((input) => {
      const resultat = mrvGreedySolver.allokér(input);
      expect(validerPlan(tilPlan(input, resultat), input)).toEqual([]);
    });
  });

  it('(2) Determinisme: to kørsler og en kørsel i blandet rækkefølge giver identisk resultat', () => {
    egenskab((input) => {
      const resultat = mrvGreedySolver.allokér(input);
      expect(mrvGreedySolver.allokér(input)).toStrictEqual(resultat);
      expect(mrvGreedySolver.allokér(blandRaekkefoelge(input))).toStrictEqual(resultat);
    });
  });

  it('(5) Ingen Art. 9: ingen forklaring indeholder et ord fra FORBUDTE_TERMER', () => {
    egenskab((input) => {
      for (const { tekst } of mrvGreedySolver.allokér(input).tildelinger) {
        const smaa = tekst.toLowerCase();
        expect(FORBUDTE_TERMER.filter((term) => smaa.includes(term.toLowerCase()))).toEqual([]);
      }
    });
  });

  it('ingen hest går mere end 3 hold (skånehest: 2) pr. ugedag', () => {
    egenskab((input) => {
      const holdPrTilmelding = new Map(
        input.tilmeldinger.map((t) => [t.id, input.hold.find((h) => h.id === t.holdId)]),
      );
      const heste = new Map(input.heste.map((h) => [h.id, h]));
      const antal = new Map<string, number>();
      for (const { holdtilmeldingId, hestId } of mrvGreedySolver.allokér(input).tildelinger) {
        if (hestId === null) continue;
        const noegle = `${hestId}|${holdPrTilmelding.get(holdtilmeldingId)?.ugedag}`;
        antal.set(noegle, (antal.get(noegle) ?? 0) + 1);
      }
      for (const [noegle, n] of antal) {
        const hest = heste.get(noegle.split('|')[0] ?? '');
        expect(n, noegle).toBeLessThanOrEqual(hest?.skaane ? 2 : 3);
      }
    });
  });

  it('giver præcis én tildeling pr. tilmelding', () => {
    egenskab((input) => {
      const ider = mrvGreedySolver.allokér(input).tildelinger.map((t) => t.holdtilmeldingId);
      expect(ider).toHaveLength(input.tilmeldinger.length);
      expect([...ider].sort()).toEqual(input.tilmeldinger.map((t) => t.id).sort());
    });
  });
});
