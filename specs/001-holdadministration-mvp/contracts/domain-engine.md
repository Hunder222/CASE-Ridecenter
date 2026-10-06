# Kontrakt: Domænepakken (`packages/domain`): Welfare Guard, tildelingsmotor og regler

**Gælder for**: FR-006 – FR-011, FR-014, FR-015, SC-002 – SC-005
**Beslutninger**: [research.md R2, R5, R6, R10](../research.md)

Domænepakken er **ren TypeScript uden I/O**. Den bruges af både API'et (Node.js) og stald-PWA'en (browser, offline). Dette dokument fastlægger den offentlige grænseflade, så API, frontend og tests kan udvikles parallelt. Implementeringen hører til i tasks og implementeringsfasen.

## 1. Offentlig grænseflade (signaturer)

```ts
// ---------- Welfare Guard (HC-01 … HC-08) ----------
/** Validér én placering i kontekst af en dags/uges belastning. Tom liste = lovlig. */
export function validerPlacering(input: PlaceringsKontekst): Aarsagskode[];

/** Validér en hel månedsplan. Bruges som uafhængig efterkontrol af motoren (R5 trin 6). */
export function validerPlan(plan: Maanedsplan, data: Stamdata): Overtraedelse[];

/** Statisk egnethed (HC-04*, HC-05 forbud, HC-06, HC-07, HC-08) for rytter × hold. Kører på serveren. */
export function beregnEgnethed(rytter: RytterRegelData, hold: HoldData, heste: HestData[]):
  { godkendte: HestId[]; udelukkede: { hestId: HestId; koder: Aarsagskode[] }[] };

// ---------- Tildelingsmotor (Kabalen) ----------
export interface AllocationSolver {
  readonly version: string;                 // f.eks. "mrv-greedy@1"
  allokér(input: AllokeringsInput): AllokeringsResultat;   // deterministisk for samme input
}

// ---------- Akut erstatning (3-trins Replacement) ----------
/** Kører både på server og offline på enheden. Kun dynamiske regler + forudberegnet `godkendteHeste`. */
export function foreslaaErstatninger(input: ErstatningsInput): ErstatningsResultat; // ≤ 3 forslag

// ---------- Forklaring ----------
export function forklar(koder: Aarsagskode[], kontekst: ForklaringsKontekst): string; // dansk tekst

// ---------- Kalender- og forretningsregler (Europe/Copenhagen) ----------
export function klassificerAfbud(modtaget: Date, lektionsdato: LocalDate): 'Afbud_rettidigt' | 'Afbud_for_sent';
export function beregnOpsigelsesSlutdato(modtagetDato: LocalDate): LocalDate; // sidste dag i md. + 30 dage
export function turnusPoint(udfald: 1 | 2 | 3 | 'alternativ'): 0 | 1 | 2 | 3;
export function rangerVenteliste(kandidater: VentelisteKandidat[], plads: LedigPlads): VentelisteKandidat[];
export function erGentagetFravaer(historik: FremmoedeStatus[], taerskel?: number /* default 3 */): boolean;
```

## 2. Centrale datatyper (uddrag)

```ts
type PlaceringsKontekst = {
  hest: HestData;                        // inkl. sundhedsstatus, hviledag, max/dag, springforbud
  lektion: { dato: LocalDate; ugedag: 1|2|3|4|5|6|7; erSpringhold: boolean; niveau: Niveau };
  dagsbelastning: number;                // hestens lektioner den dag eksklusive denne
  springBrugtUge: number;
  hestAlleredeILektion: boolean;
  godkendteHeste: HestId[];              // statisk egnethed for rytterpladsen (R6)
};

type AllokeringsResultat = {
  tildelinger: { holdtilmeldingId: Id; hestId: HestId | null; oenskeOpfyldt: 1|2|3|null;
                 erAlternativ: boolean; turnusScore: number; turnusNaesteMaaned: number;
                 koder: Aarsagskode[]; tekst: string }[];
  statistik: { oenske1: number; oenske2: number; oenske3: number; alternativ: number; ikkeTildelt: number };
  kapacitetsmangel: { holdId: Id; antal: number; koder: Aarsagskode[] }[];
};

type ErstatningsResultat = {
  forslag: { hestId: HestId; rang: 1|2|3; dagsbelastningEfter: number; koder: Aarsagskode[] }[];
  kapacitetsmangel: boolean;             // < 3 lovlige kandidater
};
```

## 3. Invarianter (testes som egenskaber med fast-check, R12)

1. **Sikkerhed**: for ethvert gyldigt input gælder `validerPlan(allokér(input).plan) = []`. Motoren returnerer hellere `hestId: null` end en ulovlig hest.
2. **Determinisme**: samme `input_hash` giver bytevist samme resultat.
3. **Erstatning**: alle `foreslaaErstatninger(...).forslag` består `validerPlacering`. Antal er højst 3. Den aktuelle (syge) hest indgår aldrig.
4. **Monotoni ved afbud**: et afbud kan kun *sænke* en hests dagsbelastning.
5. **Ingen Art. 9 i output**: forklaringstekster til stald- og forældrevisning nævner aldrig diagnoser. Spærringer formuleres som *"af hensyn til rytterens sikkerhed (HC-07)"*.

## 4. Årsagskoder

### Hårde (udelukkelse)
| Kode | Regel | Dansk forklaringsskabelon |
|---|---|---|
| `HC01_DAGSGRAENSE` | Hest > 3 lektioner/dag | "{hest} har allerede {n} hold {dag} (max 3 af hensyn til hestevelfærd, HC-01)" |
| `HC02_SKAANE_DAGSGRAENSE` | Skånehest > 2/dag | "{hest} er skånehest og må højst gå 2 hold om dagen (HC-02)" |
| `HC03_HVILEDAG` | Lektion på hestens hviledag | "{dag} er {hest}s faste hviledag (HC-03)" |
| `HC04_IKKE_RASK` | Sundhedsstatus ≠ Aktiv | "{hest} er meldt {status} (HC-04)" |
| `HC05_SPRINGFORBUD` | Springforbud på springhold | "{hest} må ikke springe (HC-05)" |
| `HC05_SPRING_UGEGRAENSE` | Mere end 1 springhold om ugen | "{hest} har allerede sprunget denne uge (HC-05)" |
| `HC06_VAEGT` / `HC06_HOEJDE` | Fysisk match | "{hest} passer ikke til rytterens størrelse (HC-06)" |
| `HC07_FORBUDT_HEST` | Forbudt for rytteren | "Ikke tilladt af hensyn til rytterens sikkerhed (HC-07)" |
| `HC07_KUN_PAAKRAEVET` | Rytteren må kun have bestemte heste | "Rytteren har faste sikkerhedsheste (HC-07)" |
| `HC07_KUN_ROLIG` | Nervøs rytter og frisk hest | "Rytteren skal have en rolig hest (HC-07)" |
| `HC08_NIVEAU_BEGYNDER` | Hest ikke egnet til begynderhold | "{hest} er ikke godkendt til begynderhold (HC-08)" |
| `HC08_NIVEAU_OEVET` | Hest ikke egnet til øvede hold | "{hest} bruges ikke på øvede hold (HC-08)" |
| `HC08_PARTHEST_RESERVERET` | Parthest på parterens lektion | "{hest} er reserveret til sin part (HC-08)" |
| `HC08_PART_UDEN_NIVEAUGODKENDELSE` | Parthest ikke godkendt til holdets niveau, og partaftalen er ikke markeret "godkendt trods niveau" | "{hest} er ikke godkendt til dette holds niveau, og partaftalen mangler ledelsens godkendelse (HC-08)" |
| `LEKTION_HEST_OPTAGET` | Samme hest to gange i én lektion | "{hest} er allerede brugt på dette hold" |

### Bløde og udfald (begrundelse)
| Kode | Betydning |
|---|---|
| `SC01_OENSKE_1` / `_2` / `_3` | Ønske nr. n opfyldt |
| `SC02_TURNUS_PRIORITET` | Rytteren blev prioriteret pga. sidste måneds udfald |
| `SC02_TABT_TIL_TURNUS` | Ønsket hest gik til en rytter med højere turnusprioritet |
| `SC03_BELASTNINGSUDJAEVNING` | Valgt for at fordele belastningen jævnt |
| `SC04_PROGRESSION` | Valgt som et passende udviklingstrin |
| `SC05_HJAELPER` | Hjælpertildeling fra restkapacitet |
| `PARTAFTALE` | Fast parthest |
| `PAAKRAEVET_HEST` | Fast sikkerhedshest |
| `ALT_TILDELING` | "Alternativ tildeling (ønsker optaget)", turnus +3 (US2 AS4) |
| `IKKE_TILDELT_KAPACITET` | Ingen lovlig hest. Ledelse adviseres (edge case) |

## 5. Forfatningens eksempler som navngivne acceptance-tests

Hver linje er en navngiven test i `packages/domain/tests/scenarier/forfatning.spec.ts`. Alle skal være grønne, før en kørsel kan publiceres.

| # | Scenarie | Forventet |
|---|---|---|
| F-01 | Anna Gammelgård på et hvilket som helst hold | Kun Donny. Er Donny syg: `IKKE_TILDELT_KAPACITET` (aldrig en anden hest) |
| F-02 | Emma Grønby | Aldrig Pixie |
| F-03 | Sofia Ejby | Aldrig Aida |
| F-04 | Filippa Udby | Kun Aslan eller Toobi |
| F-05 | Nervøs rytter (`kun_rolige_heste`) | Aldrig Boy, Pixie, Freya eller Cornelius |
| F-06 | Springhold | Aldrig Bølle, Wally eller Aida. Ingen hest mere end 1 springhold om ugen (inkl. Arthur) |
| F-07 | Øvet hold | Aldrig Arthur |
| F-08 | Begynderhold | Kun heste med `godkendt_til_begyndere` (seed: Aslan, Toobi, Jane, Belle). Undtagelse: parthest til egen part, når partaftalen er markeret "godkendt trods niveau" (se F-16) |
| F-09 | Tung rytter (Sara Troelsen) | Kun heste med tilstrækkelig bæreevne. Aldrig Wally eller Missy |
| F-10 | Høje ryttere (Clara Bjerg, Johanne Johansen) | Kun store heste (f.eks. Aslan, Belle, Boy, Rosa) |
| F-11 | Partaftaler | Freja P. → Belle på sit hold. Lærke H. → Aida på begynderholdet **kun** med "godkendt trods niveau" (se F-16) |
| F-12 | Dagsgrænse | Ingen normal hest mere end 3/dag, ingen skånehest mere end 2/dag |
| F-13 | Hviledag | Ingen hest har lektioner på sin hviledag. Alle har mindst 1 hviledag om ugen |
| F-14 | Syg hest | Udelukkes fra al tildeling og alle erstatningsforslag |
| F-15 | To ryttere ønsker Toobi som 1. ønske | Rytteren med højest turnus får Toobi. Den anden får `SC02_TABT_TIL_TURNUS` + næste ønske |
| F-16 | Lærke H. (part på Aida) på begynderhold, **uden** markeringen "godkendt trods niveau" | Aida tildeles ikke. Lærke får en alternativ, begyndergodkendt hest med `HC08_PART_UDEN_NIVEAUGODKENDELSE`, og der oprettes en `PARTAFTALE_MANGLER_NIVEAUGODKENDELSE`-notifikation. **Med** markering tildeles Aida, hvis HC-01–HC-07 er opfyldt |
