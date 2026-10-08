import type { Aarsagskode } from './forklaring/aarsagskoder';

// Domænetyper fra contracts/domain-engine.md §2 og §6. camelCase; API'et mapper fra snake_case.

export type Id = string;
export type HestId = string;
export type RytterId = string;
/** Kalenderdato 'YYYY-MM-DD' i Europe/Copenhagen. */
export type LocalDate = string;
/** 'YYYY-MM'. */
export type Maaned = string;
/** ISO-ugedag: 1 = mandag … 7 = søndag. */
export type Ugedag = 1 | 2 | 3 | 4 | 5 | 6 | 7;

export type Niveau = 'Traekhold' | 'Begynder' | 'Letoevet' | 'Oevet' | 'Parthold';
export type Temperament = 'Rolig' | 'Normal' | 'Frisk';
export type Sundhedsstatus = 'Aktiv' | 'Sygemeldt' | 'Skadet' | 'Karantaene';
export type Erfaringsniveau = 'Begynder' | 'Letoevet' | 'Oevet';

export interface HestData {
  id: HestId;
  navn: string;
  stangmaalCm: number;
  maxRytterVaegtKg: number;
  /** null = ingen højdegrænse. */
  maxRytterHoejdeCm: number | null;
  temperament: Temperament;
  godkendtTilBegyndere: boolean;
  egnetOevet: boolean;
  skaane: boolean;
  maxLektionerDag: number;
  springforbud: boolean;
  maxSpringUge: number;
  hviledag: Ugedag;
  sundhedsstatus: Sundhedsstatus;
  aktiv: boolean;
}

/** Rytterens regeldata. Indeholder art. 9-afledte spærringer og forlader aldrig serveren. */
export interface RytterRegelData {
  id: RytterId;
  hoejdeCm: number;
  vaegtKg: number;
  erfaringsniveau: Erfaringsniveau;
  klarTilUdvikling: boolean;
  erHjaelper: boolean;
  partaftaleHestId: HestId | null;
  partaftaleGodkendtTrodsNiveau: boolean;
  forbudteHeste: readonly HestId[];
  paakraevedeHeste: readonly HestId[];
  kunRoligeHeste: boolean;
}

export interface HoldData {
  id: Id;
  holdnavn: string;
  niveau: Niveau;
  erSpringhold: boolean;
  ugedag: Ugedag;
  starttid: string;
  varighedMin: number;
  maxKapacitet: number;
  /** Parthest → partrytter for ryttere tilmeldt holdet (HC-08). Udfyldes af motoren. */
  partheste?: Readonly<Record<HestId, RytterId>>;
}

/** Kontekst for én placering (domain-engine.md §2). Kører også offline på tabletten i Fase 2. */
export interface PlaceringsKontekst {
  hest: HestData;
  lektion: { dato?: LocalDate; ugedag: Ugedag; erSpringhold: boolean; niveau: Niveau };
  /** Hestens lektioner den dag eksklusive denne. */
  dagsbelastning: number;
  /** Hestens springhold i ugen eksklusive denne. */
  springBrugtUge: number;
  hestAlleredeILektion: boolean;
  /** Statisk egnethed for rytterpladsen (R6). */
  godkendteHeste: readonly HestId[];
}

export interface Tilmelding {
  id: Id;
  rytterId: RytterId;
  holdId: Id;
  ancienitetDato: LocalDate;
}

export interface Oenske {
  rytterId: RytterId;
  prioritet: 1 | 2 | 3;
  hestId: HestId;
}

export interface AllokeringsInput {
  maaned: Maaned;
  heste: readonly HestData[];
  hold: readonly HoldData[];
  ryttere: readonly RytterRegelData[];
  tilmeldinger: readonly Tilmelding[];
  oensker: readonly Oenske[];
  /** Rytter-id → turnusprioritet fra måneden før (0 hvis ukendt). */
  turnus: Readonly<Record<RytterId, number>>;
  /** Hvis true, reserveres begynder-godkendte heste primært til begynder/trækhold. */
  reserverBegynderHeste?: boolean;
  /** Hvis true, reserveres spring-godkendte heste primært til springhold. */
  reserverSpringHeste?: boolean;
}

export interface Tildeling {
  holdtilmeldingId: Id;
  /** null = Ikke tildelt – kapacitetsmangel. */
  hestId: HestId | null;
  oenskeOpfyldt: 1 | 2 | 3 | null;
  erAlternativ: boolean;
  turnusScore: number;
  turnusNaesteMaaned: number;
  koder: Aarsagskode[];
  tekst: string;
}

export interface AllokeringsResultat {
  tildelinger: Tildeling[];
  statistik: { oenske1: number; oenske2: number; oenske3: number; alternativ: number; ikkeTildelt: number };
  kapacitetsmangel: { holdId: Id; antal: number; koder: Aarsagskode[] }[];
}

/** Ugeskabelon for måneden: samme hest på rytterens hold hver uge. */
export interface Maanedsplan {
  maaned: Maaned;
  tildelinger: readonly { holdtilmeldingId: Id; hestId: HestId | null }[];
}

export type Stamdata = Omit<AllokeringsInput, 'oensker' | 'turnus'>;

export interface Overtraedelse {
  holdtilmeldingId: Id;
  hestId: HestId;
  kode: Aarsagskode;
}

export interface ForklaringsKontekst {
  hesteNavne: Readonly<Record<HestId, string>>;
  rytterNavn?: string;
  ugedag?: Ugedag;
  /** Den tildelte hest, som udfaldssætningen nævner (f.eks. "fik sit 2. ønske, Zigge"). */
  hestId?: HestId | null;
  /** Dansk status pr. hest til HC-04 (se statusTekst), f.eks. "meldt syg". */
  hesteStatus?: Readonly<Record<HestId, string>>;
}

export interface AllocationSolver {
  readonly version: string;
  /** Deterministisk: samme input giver samme resultat. */
  allokér(input: AllokeringsInput): AllokeringsResultat;
}
