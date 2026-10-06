import { describe, expect, it } from 'vitest';
import {
  validerPlacering,
  validerPlan,
  type AllokeringsInput,
  type HestData,
  type HoldData,
  type Maanedsplan,
  type Overtraedelse,
} from '../../src/index';
import {
  basis,
  lavHest,
  lavHold,
  lavInput,
  lavKontekst,
  lavRytter,
  lavTilmelding,
} from '../fixtures/byggere';

// Welfare Guard (R5 trin 6): validerPlacering til én plads og validerPlan som uafhængig
// efterkontrol af en hel månedsplan (domain-engine.md §1 og §6 a).

describe('validerPlacering', () => {
  it('returnerer [] for en lovlig placering', () => {
    expect(validerPlacering(lavKontekst())).toEqual([]);
  });

  it('samler koder fra alle regler, ikke kun den første', () => {
    const hest = lavHest({ sundhedsstatus: 'Sygemeldt', hviledag: 2, springforbud: true });
    const koder = validerPlacering(
      lavKontekst({
        hest,
        lektion: { dato: '2026-07-07', ugedag: 2, erSpringhold: true, niveau: 'Oevet' },
        dagsbelastning: 3,
        hestAlleredeILektion: true,
        godkendteHeste: [],
      }),
    );
    expect(basis(koder)).toEqual(
      expect.arrayContaining([
        'HC01_DAGSGRAENSE',
        'HC03_HVILEDAG',
        'HC04_IKKE_RASK',
        'HC05_SPRINGFORBUD',
        'LEKTION_HEST_OPTAGET',
        'IKKE_GODKENDT_TIL_RYTTER',
      ]),
    );
  });

  it('giver LEKTION_HEST_OPTAGET, når hesten allerede er brugt i lektionen', () => {
    expect(basis(validerPlacering(lavKontekst({ hestAlleredeILektion: true })))).toEqual([
      'LEKTION_HEST_OPTAGET',
    ]);
  });

  it('giver IKKE_GODKENDT_TIL_RYTTER, når hesten ikke står i godkendteHeste', () => {
    expect(basis(validerPlacering(lavKontekst({ godkendteHeste: ['hest-en-anden'] })))).toEqual([
      'IKKE_GODKENDT_TIL_RYTTER',
    ]);
  });
});

interface Scenarie {
  stamdata: AllokeringsInput;
  plan: Maanedsplan;
}

/** Ét hold pr. rytter. Rytter i får heste[i] (null = ikke tildelt). */
function scenarie(
  hold: HoldData[],
  heste: (HestData | null)[],
  rytterOverskriv: Parameters<typeof lavRytter>[0] = {},
): Scenarie {
  const ryttere = hold.map((_, i) => lavRytter({ ...rytterOverskriv, id: `rytter-${i + 1}` }));
  const tilmeldinger = hold.map((h, i) => lavTilmelding(`rytter-${i + 1}`, h.id));
  const unikkeHeste = new Map(heste.flatMap((h) => (h ? [[h.id, h] as const] : [])));
  const stamdata = lavInput({ heste: [...unikkeHeste.values()], hold, ryttere, tilmeldinger });
  const plan: Maanedsplan = {
    maaned: stamdata.maaned,
    tildelinger: tilmeldinger.map((t, i) => ({ holdtilmeldingId: t.id, hestId: heste[i]?.id ?? null })),
  };
  return { stamdata, plan };
}

/** n fredagshold i træk (15:00, 16:00, …). */
function fredagshold(n: number, overskriv: Partial<HoldData> = {}): HoldData[] {
  return Array.from({ length: n }, (_, i) =>
    lavHold({
      id: `hold-${i + 1}`,
      holdnavn: `Fredag hold ${i + 1}`,
      starttid: `${15 + i}:00`,
      ...overskriv,
    }),
  );
}

function kontroller({ stamdata, plan }: Scenarie): Overtraedelse[] {
  return validerPlan(plan, stamdata);
}

/** Koden kvalificeres med hestens id (T070). */
function forventOvertraedelse(overtraedelser: Overtraedelse[], basiskode: string, hest: HestData): void {
  expect(overtraedelser).toContainEqual(
    expect.objectContaining({ hestId: hest.id, kode: `${basiskode}:${hest.id}` }),
  );
}

describe('validerPlan', () => {
  const toobi = lavHest({ navn: 'Toobi' });

  it('returnerer [] for en lovlig plan (samme hest på 3 hold samme dag)', () => {
    expect(kontroller(scenarie(fredagshold(3), [toobi, toobi, toobi]))).toEqual([]);
  });

  it('finder en normal hest på 4 hold samme ugedag (HC-01)', () => {
    forventOvertraedelse(
      kontroller(scenarie(fredagshold(4), [toobi, toobi, toobi, toobi])),
      'HC01_DAGSGRAENSE',
      toobi,
    );
  });

  it('finder en skånehest på 3 hold samme ugedag (HC-02)', () => {
    const sally = lavHest({ navn: 'Sally', skaane: true });
    expect(kontroller(scenarie(fredagshold(2), [sally, sally]))).toEqual([]);
    forventOvertraedelse(
      kontroller(scenarie(fredagshold(3), [sally, sally, sally])),
      'HC02_SKAANE_DAGSGRAENSE',
      sally,
    );
  });

  it('finder et hold på hestens hviledag (HC-03)', () => {
    const rosa = lavHest({ navn: 'Rosa', hviledag: 5 });
    forventOvertraedelse(kontroller(scenarie(fredagshold(1), [rosa])), 'HC03_HVILEDAG', rosa);
  });

  it('finder en syg hest (HC-04)', () => {
    const syg = lavHest({ navn: 'Toobi', sundhedsstatus: 'Sygemeldt' });
    forventOvertraedelse(kontroller(scenarie(fredagshold(1), [syg])), 'HC04_IKKE_RASK', syg);
  });

  it('finder to springhold samme uge (HC-05)', () => {
    const tirsdag = lavHold({
      id: 'hold-tirsdag',
      holdnavn: 'Tirsdag spring',
      ugedag: 2,
      erSpringhold: true,
    });
    const torsdag = lavHold({
      id: 'hold-torsdag',
      holdnavn: 'Torsdag spring',
      ugedag: 4,
      erSpringhold: true,
    });
    const arthur = lavHest({ navn: 'Arthur', hviledag: 7 });
    forventOvertraedelse(
      kontroller(scenarie([tirsdag, torsdag], [arthur, arthur])),
      'HC05_SPRING_UGEGRAENSE',
      arthur,
    );
  });

  it('finder en hest med springforbud på et springhold (HC-05)', () => {
    const boelle = lavHest({ navn: 'Bølle', springforbud: true });
    forventOvertraedelse(
      kontroller(scenarie(fredagshold(1, { erSpringhold: true }), [boelle])),
      'HC05_SPRINGFORBUD',
      boelle,
    );
  });

  it('finder en for tung rytter (HC-06)', () => {
    const wally = lavHest({ navn: 'Wally', maxRytterVaegtKg: 35 });
    forventOvertraedelse(kontroller(scenarie(fredagshold(1), [wally], { vaegtKg: 58 })), 'HC06_VAEGT', wally);
  });

  it('finder en forbudt hest (HC-07)', () => {
    const pixie = lavHest({ navn: 'Pixie' });
    forventOvertraedelse(
      kontroller(scenarie(fredagshold(1), [pixie], { forbudteHeste: [pixie.id] })),
      'HC07_FORBUDT_HEST',
      pixie,
    );
  });

  it('finder en ikke-godkendt hest på et begynderhold (HC-08)', () => {
    const zigge = lavHest({ navn: 'Zigge', godkendtTilBegyndere: false });
    forventOvertraedelse(
      kontroller(scenarie(fredagshold(1, { niveau: 'Begynder' }), [zigge])),
      'HC08_NIVEAU_BEGYNDER',
      zigge,
    );
  });

  it('finder en anden rytters parthest på samme hold (HC-08) ud fra stamdata alene', () => {
    const belle = lavHest({ navn: 'Belle' });
    const freja = lavRytter({ id: 'rytter-freja', partaftaleHestId: belle.id });
    const agnes = lavRytter({ id: 'rytter-agnes' });
    const stamdata = lavInput({ heste: [belle, toobi], hold: [lavHold()], ryttere: [freja, agnes] });
    const [frejasPlads, agnesPlads] = stamdata.tilmeldinger;
    if (!frejasPlads || !agnesPlads) throw new Error('Mangler tilmeldinger');
    const plan: Maanedsplan = {
      maaned: stamdata.maaned,
      tildelinger: [
        { holdtilmeldingId: frejasPlads.id, hestId: toobi.id },
        { holdtilmeldingId: agnesPlads.id, hestId: belle.id },
      ],
    };
    expect(validerPlan(plan, stamdata)).toContainEqual({
      holdtilmeldingId: agnesPlads.id,
      hestId: belle.id,
      kode: `HC08_PARTHEST_RESERVERET:${belle.id}`,
    });
  });

  it('finder samme hest to gange på ét hold', () => {
    const ryttere = [lavRytter({ id: 'rytter-1' }), lavRytter({ id: 'rytter-2' })];
    const stamdata = lavInput({ heste: [toobi], hold: [lavHold()], ryttere });
    const plan: Maanedsplan = {
      maaned: stamdata.maaned,
      tildelinger: stamdata.tilmeldinger.map((t) => ({ holdtilmeldingId: t.id, hestId: toobi.id })),
    };
    forventOvertraedelse(validerPlan(plan, stamdata), 'LEKTION_HEST_OPTAGET', toobi);
  });

  it('ignorerer null-tildelinger (Ikke tildelt – kapacitetsmangel)', () => {
    expect(kontroller(scenarie(fredagshold(4), [null, null, null, null], { vaegtKg: 99 }))).toEqual([]);
  });
});
