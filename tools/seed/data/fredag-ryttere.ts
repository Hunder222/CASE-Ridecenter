import type { Erfaringsniveau } from '@ridecenter/domain';
import { FREDAGSHOLD, holdId } from './brugere-og-hold';
import { foersteMaanedMedHest } from './fredag-historik';
import { hestId } from './heste';
import { stabilId } from './id';
import type { SeedRytter, SeedTilmelding } from './typer';

// De 34 fredagsryttere fra Maries noter i _case-01-fredagsheste jan-jun TIL CASE.md.
// Alle personoplysninger er fiktive (research R15). "[Demoværdi]" = ikke angivet i casen.

/** [Demoværdi] Højde (cm) og vægt (kg) pr. alder. */
export const ALDERSTABEL: Readonly<Record<number, readonly [number, number]>> = {
  5: [110, 19],
  6: [116, 21],
  7: [122, 23],
  8: [128, 26],
  9: [133, 29],
  10: [139, 33],
  11: [144, 37],
  12: [150, 41],
  13: [156, 46],
  14: [160, 51],
  15: [163, 55],
  16: [166, 58],
  17: [168, 60],
};

interface Profil {
  forbudte?: string[];
  paakraevede?: string[];
  kunRolige?: boolean;
  faldtraume?: string;
  angst?: string;
}

interface RytterKilde {
  navn: string;
  alder: number;
  hold: string;
  /** Undtagelse fra alderstabellen ud fra noterne: [cm, kg]. */
  stoerrelse?: readonly [number, number];
  klarTilUdvikling?: boolean;
  erHjaelper?: boolean;
  partHest?: string;
  profil?: Profil;
}

const { begynder, letoevet1, oevet, letoevet2 } = FREDAGSHOLD;

export const FREDAGSRYTTERE: readonly RytterKilde[] = [
  // Hold 1 – Begynder 15:00
  { navn: 'Ellen Frellsen', alder: 11, hold: begynder, klarTilUdvikling: true },
  {
    navn: 'Filippa Udby',
    alder: 9,
    hold: begynder,
    profil: { paakraevede: ['Aslan', 'Toobi'], kunRolige: true, angst: 'Nervøs rytter' },
  },
  { navn: 'Johanne Johansen', alder: 10, hold: begynder, stoerrelse: [164, 45] },
  {
    navn: 'Sofia Ejby',
    alder: 8,
    hold: begynder,
    profil: { forbudte: ['Aida'], faldtraume: 'Smidt af Aida (fiktiv)' },
  },
  { navn: 'Alberte Solby', alder: 9, hold: begynder },
  { navn: 'Lærke Hansen', alder: 9, hold: begynder, partHest: 'Aida' },
  { navn: 'Viola Jensen', alder: 7, hold: begynder },
  // Hold 2 – Letøvet 15:45
  { navn: 'Freja Olsen', alder: 12, hold: letoevet1, profil: { kunRolige: true } },
  { navn: 'Ella Lundkvist', alder: 10, hold: letoevet1 },
  { navn: 'Freya Holm', alder: 12, hold: letoevet1, profil: { kunRolige: true } },
  {
    navn: 'Emma Grønby',
    alder: 11,
    hold: letoevet1,
    profil: { forbudte: ['Pixie'], faldtraume: 'Faldet af Pixie og brækket armen (fiktiv)' },
  },
  { navn: 'Lærke Broby', alder: 9, hold: letoevet1, stoerrelse: [125, 24] },
  { navn: 'Nora Grønbjerg', alder: 9, hold: letoevet1, stoerrelse: [126, 25] },
  { navn: 'Sophia Kronborg', alder: 10, hold: letoevet1 },
  { navn: 'Viktoria Kristensen', alder: 12, hold: letoevet1 },
  { navn: 'Victoria Åby', alder: 13, hold: letoevet1 },
  // Hold 3 – Øvet 16:30
  { navn: 'Andrea Dahl', alder: 14, hold: oevet, erHjaelper: true },
  { navn: 'Clara Bjerg', alder: 13, hold: oevet, stoerrelse: [168, 52] },
  { navn: 'Ella Justesen', alder: 13, hold: oevet, erHjaelper: true },
  { navn: 'Josefine Ibsen', alder: 15, hold: oevet },
  { navn: 'Klara Holmeby', alder: 12, hold: oevet, profil: { kunRolige: true } },
  { navn: 'Leonora Vinter', alder: 10, hold: oevet, stoerrelse: [133, 28] },
  { navn: 'Molly Jensen', alder: 11, hold: oevet, profil: { kunRolige: true } },
  { navn: 'Marie Rundholm', alder: 13, hold: oevet, stoerrelse: [145, 36], erHjaelper: true },
  { navn: 'Sara Troelsen', alder: 11, hold: oevet, stoerrelse: [146, 58] },
  { navn: 'Sofia Westergaard', alder: 12, hold: oevet },
  // Hold 4 – Letøvet 17:15
  { navn: 'Agnes Riis', alder: 15, hold: letoevet2, stoerrelse: [170, 55] },
  {
    navn: 'Anna Gammelgård',
    alder: 13,
    hold: letoevet2,
    profil: { paakraevede: ['Donny'], kunRolige: true, angst: 'Angstdiagnose (fiktiv)' },
  },
  { navn: 'Johanna Rindbo', alder: 12, hold: letoevet2 },
  { navn: 'Freja Pedersen', alder: 14, hold: letoevet2, partHest: 'Belle' },
  { navn: 'Josephine Iversen', alder: 10, hold: letoevet2 },
  { navn: 'Liv Danby', alder: 8, hold: letoevet2 },
  { navn: 'Selma Janbo', alder: 12, hold: letoevet2 },
  { navn: 'Victoria Skovby', alder: 9, hold: letoevet2 },
];

export function rytterId(navn: string): string {
  return stabilId('rytter', navn);
}

export function tilmeldingId(rytterNavn: string, holdnavn: string): string {
  return stabilId('tilmelding', `${rytterNavn}|${holdnavn}`);
}

/** Bogstaver til e-mailadresser: æ→ae, ø→oe, å→aa, mellemrum→punktum. */
export function slug(tekst: string): string {
  return tekst
    .toLowerCase()
    .replaceAll('æ', 'ae')
    .replaceAll('ø', 'oe')
    .replaceAll('å', 'aa')
    .replaceAll(' ', '.');
}

function niveauFor(holdnavn: string): Erfaringsniveau {
  if (holdnavn === begynder) return 'Begynder';
  if (holdnavn === oevet) return 'Oevet';
  return 'Letoevet';
}

/** Ryttere og deres tilmeldinger. gyldigFra = første dag i måneden før seed-måneden. */
export function byggFredagsRyttere(gyldigFra: string): {
  ryttere: SeedRytter[];
  tilmeldinger: SeedTilmelding[];
} {
  const ryttere: SeedRytter[] = [];
  const tilmeldinger: SeedTilmelding[] = [];

  FREDAGSRYTTERE.forEach((kilde, i) => {
    const [fornavn, ...resten] = kilde.navn.split(' ');
    const efternavn = resten.join(' ');
    const standard = ALDERSTABEL[kilde.alder];
    if (!fornavn || !standard) throw new Error(`Ugyldig rytterkilde: ${kilde.navn}`);
    const [hoejdeCm, vaegtKg] = kilde.stoerrelse ?? standard;
    const id = rytterId(kilde.navn);

    ryttere.push({
      id,
      fornavn,
      efternavn,
      // [Demoværdi] Rytteren har alderen fra noterne pr. 1. juli 2026.
      foedselsdato: `${2025 - kilde.alder}-09-01`,
      bopaelskommune: 'Strandby',
      hoejdeCm,
      vaegtKg,
      erfaringsniveau: niveauFor(kilde.hold),
      klarTilUdvikling: kilde.klarTilUdvikling ?? false,
      erHjaelper: kilde.erHjaelper ?? false,
      partaftaleHestId: kilde.partHest
        ? hestId(kilde.partHest)
        : kilde.profil?.paakraevede?.[0]
          ? hestId(kilde.profil.paakraevede[0])
          : null,
      partaftaleGodkendtTrodsNiveau: false,
      forbudteHeste: (kilde.profil?.forbudte ?? []).map(hestId),
      paakraevedeHeste: (kilde.profil?.paakraevede ?? []).map(hestId),
      kunRoligeHeste: kilde.profil?.kunRolige ?? false,
      kontaktpersonNavn: `Forælder til ${fornavn}`,
      kontaktTelefon: `+45 20 00 00 ${String(i + 1).padStart(2, '0')}`,
      kontaktEmail: `foraelder.${slug(kilde.navn)}@example.dk`,
      aktivStatus: 'Aktiv',
      faldtraumeNote: kilde.profil?.faldtraume ?? null,
      angstkategori: kilde.profil?.angst ?? null,
      internNote: null,
    });

    tilmeldinger.push({
      id: tilmeldingId(kilde.navn, kilde.hold),
      rytterId: id,
      holdId: holdId(kilde.hold),
      ancienitetDato: foersteMaanedMedHest(kilde.navn),
      gyldigFra,
    });
  });

  return { ryttere, tilmeldinger };
}
