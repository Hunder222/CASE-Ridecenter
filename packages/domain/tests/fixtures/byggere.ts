import {
  opdel,
  type Aarsagskode,
  type AllokeringsInput,
  type AllokeringsResultat,
  type HestData,
  type HoldData,
  type Maanedsplan,
  type Oenske,
  type PlaceringsKontekst,
  type RytterRegelData,
  type Tildeling,
  type Tilmelding,
} from '../../src/index';

// Byggere til domænetestene (T046). Standardværdierne er lovlige for hinanden: en standardrytter
// må ride en standardhest på et standardhold. Hver test overskriver kun det, den handler om.

function slug(tekst: string): string {
  return tekst.toLowerCase().replaceAll(' ', '-');
}

/** Aktiv, Normal, 145 cm, max 65 kg, ingen højdegrænse, hviledag mandag, egnet til alle niveauer. */
export function lavHest(overskriv: Partial<HestData> = {}): HestData {
  const navn = overskriv.navn ?? 'Testhest';
  return {
    id: `hest-${slug(navn)}`,
    navn,
    stangmaalCm: 145,
    maxRytterVaegtKg: 65,
    maxRytterHoejdeCm: null,
    temperament: 'Normal',
    godkendtTilBegyndere: true,
    egnetOevet: true,
    skaane: false,
    // Afledes som i API'et (T078), men kan overskrives for at teste forkerte data.
    maxLektionerDag: overskriv.skaane ? 2 : 3,
    springforbud: false,
    maxSpringUge: overskriv.springforbud ? 0 : 1,
    hviledag: 1,
    sundhedsstatus: 'Aktiv',
    aktiv: true,
    ...overskriv,
  };
}

/** Letøvet, 140 cm, 35 kg, ingen spærringer, ingen partaftale. */
export function lavRytter(overskriv: Partial<RytterRegelData> = {}): RytterRegelData {
  return {
    id: 'rytter-test',
    hoejdeCm: 140,
    vaegtKg: 35,
    erfaringsniveau: 'Letoevet',
    klarTilUdvikling: false,
    erHjaelper: false,
    partaftaleHestId: null,
    partaftaleGodkendtTrodsNiveau: false,
    forbudteHeste: [],
    paakraevedeHeste: [],
    kunRoligeHeste: false,
    ...overskriv,
  };
}

/** Letøvet fredag kl. 15:45, ikke spring, plads til 10. */
export function lavHold(overskriv: Partial<HoldData> = {}): HoldData {
  return {
    id: 'hold-test',
    holdnavn: 'Fredag 15:45 Letøvet',
    niveau: 'Letoevet',
    erSpringhold: false,
    ugedag: 5,
    starttid: '15:45',
    varighedMin: 45,
    maxKapacitet: 10,
    ...overskriv,
  };
}

export function lavTilmelding(
  rytterId: string,
  holdId: string,
  overskriv: Partial<Tilmelding> = {},
): Tilmelding {
  return { id: `tilm-${rytterId}-${holdId}`, rytterId, holdId, ancienitetDato: '2026-01-01', ...overskriv };
}

/** Ønsker i prioriteret rækkefølge: første hest = 1. ønske. */
export function lavOensker(rytterId: string, ...hestIder: string[]): Oenske[] {
  return hestIder.map((hestId, i) => ({ rytterId, prioritet: (i + 1) as 1 | 2 | 3, hestId }));
}

export interface InputDele {
  maaned?: string;
  heste?: HestData[];
  hold?: HoldData[];
  ryttere?: RytterRegelData[];
  /** Udelades de, tilmeldes alle ryttere det første hold. */
  tilmeldinger?: Tilmelding[];
  oensker?: Oenske[];
  turnus?: Record<string, number>;
}

export function lavInput(dele: InputDele = {}): AllokeringsInput {
  const hold = dele.hold ?? [lavHold()];
  const ryttere = dele.ryttere ?? [];
  const foersteHold = hold[0];
  return {
    maaned: dele.maaned ?? '2026-07',
    heste: dele.heste ?? [],
    hold,
    ryttere,
    tilmeldinger:
      dele.tilmeldinger ?? (foersteHold ? ryttere.map((r) => lavTilmelding(r.id, foersteHold.id)) : []),
    oensker: dele.oensker ?? [],
    turnus: dele.turnus ?? {},
  };
}

type KontekstOverskrivning = Omit<Partial<PlaceringsKontekst>, 'lektion'> & {
  lektion?: Partial<PlaceringsKontekst['lektion']>;
};

/** En lovlig placering fredag 2026-07-03 på et letøvet hold. Hesten er godkendt til pladsen. */
export function lavKontekst(overskriv: KontekstOverskrivning = {}): PlaceringsKontekst {
  const hest = overskriv.hest ?? lavHest();
  return {
    hest,
    dagsbelastning: 0,
    springBrugtUge: 0,
    hestAlleredeILektion: false,
    godkendteHeste: [hest.id],
    ...overskriv,
    lektion: { dato: '2026-07-03', ugedag: 5, erSpringhold: false, niveau: 'Letoevet', ...overskriv.lektion },
  };
}

/** Basiskoderne uden hest-id: `HC01_DAGSGRAENSE:<id>` → `HC01_DAGSGRAENSE`. */
export function basis(koder: readonly Aarsagskode[]): string[] {
  return koder.map((kode) => opdel(kode).basis);
}

/** Motorens resultat som månedsplan til `validerPlan`. */
export function tilPlan(input: AllokeringsInput, resultat: AllokeringsResultat): Maanedsplan {
  return {
    maaned: input.maaned,
    tildelinger: resultat.tildelinger.map((t) => ({
      holdtilmeldingId: t.holdtilmeldingId,
      hestId: t.hestId,
    })),
  };
}

/** Rytterens tildelinger (én pr. tilmelding). */
export function tildelingerFor(
  input: AllokeringsInput,
  resultat: AllokeringsResultat,
  rytterId: string,
): Tildeling[] {
  const tilmeldinger = new Set(input.tilmeldinger.filter((t) => t.rytterId === rytterId).map((t) => t.id));
  return resultat.tildelinger.filter((t) => tilmeldinger.has(t.holdtilmeldingId));
}

/** Rytterens eneste tildeling. Fejler, hvis rytteren ikke har præcis én. */
export function tildelingFor(
  input: AllokeringsInput,
  resultat: AllokeringsResultat,
  rytterId: string,
): Tildeling {
  const tildelinger = tildelingerFor(input, resultat, rytterId);
  const [tildeling] = tildelinger;
  if (tildelinger.length !== 1 || !tildeling) {
    throw new Error(`Forventede én tildeling for ${rytterId}, fandt ${tildelinger.length}`);
  }
  return tildeling;
}

/** Samme input i en anden rækkefølge (alle samlinger og turnus-nøglerne vendt om). */
export function blandRaekkefoelge(input: AllokeringsInput): AllokeringsInput {
  return {
    maaned: input.maaned,
    heste: [...input.heste].reverse(),
    hold: [...input.hold].reverse(),
    ryttere: [...input.ryttere].reverse(),
    tilmeldinger: [...input.tilmeldinger].reverse(),
    oensker: [...input.oensker].reverse(),
    turnus: Object.fromEntries(Object.entries(input.turnus).reverse()),
  };
}
