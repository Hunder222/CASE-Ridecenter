import { turnusFraKoder } from '../kalender/turnus';
import { sammenlignId } from '../tildeling/score';
import type { ForklaringsKontekst, HestData, HestId, Ugedag } from '../typer';
import { AARSAGSKODER, opdel, type Aarsagskode, type Basiskode } from './aarsagskoder';
import { BLOKERINGSSKABELONER, SKABELONER } from './skabeloner';

export const UGEDAGSNAVNE: Readonly<Record<Ugedag, string>> = {
  1: 'mandag',
  2: 'tirsdag',
  3: 'onsdag',
  4: 'torsdag',
  5: 'fredag',
  6: 'lørdag',
  7: 'søndag',
};

/** Udfaldet først (FR-010), derefter bløde begrundelser, så hvorfor højere ønsker ikke kunne opfyldes. */
const UDFALD: readonly Basiskode[] = [
  'SC01_OENSKE_1',
  'SC01_OENSKE_2',
  'SC01_OENSKE_3',
  'ALT_TILDELING',
  'PARTAFTALE',
  'PAAKRAEVET_HEST',
  'IKKE_TILDELT_KAPACITET',
];
const BLOEDE: readonly Basiskode[] = [
  'SC02_TURNUS_PRIORITET',
  'SC03_BELASTNINGSUDJAEVNING',
  'SC04_PROGRESSION',
  'SC05_HJAELPER',
];
const KATALOG = Object.keys(AARSAGSKODER) as Basiskode[];

/** Dansk status til HC-04, f.eks. "Toobi er meldt syg". */
export function statusTekst(hest: Pick<HestData, 'sundhedsstatus' | 'aktiv'>): string {
  switch (hest.sundhedsstatus) {
    case 'Sygemeldt':
      return 'meldt syg';
    case 'Skadet':
      return 'meldt skadet';
    case 'Karantaene':
      return 'i karantæne';
    default:
      return hest.aktiv ? 'rask' : 'ude af drift';
  }
}

function genitiv(navn: string): string {
  return /[sxz]$/i.test(navn) ? `${navn}'` : `${navn}s`;
}

function saetning(
  basis: Basiskode,
  hestFraKode: HestId | undefined,
  tildeltHest: HestId | undefined,
  kontekst: ForklaringsKontekst,
): string {
  const skabelon = (hestFraKode ? BLOKERINGSSKABELONER[basis] : undefined) ?? SKABELONER[basis] ?? basis;
  const hestId = hestFraKode ?? tildeltHest;
  const navn = hestId === undefined ? undefined : (kontekst.hesteNavne[hestId] ?? 'hesten');
  let tekst = skabelon
    .replaceAll('{, hest}', navn ? `, ${navn}` : '')
    .replaceAll('{: hest}', navn ? `: ${navn}` : '')
    .replaceAll('{hests}', navn ? genitiv(navn) : 'hestens')
    .replaceAll('{hest}', navn ?? 'hesten')
    .replaceAll('{rytter}', kontekst.rytterNavn ?? 'rytteren')
    .replaceAll('{dag}', kontekst.ugedag ? UGEDAGSNAVNE[kontekst.ugedag] : 'den dag')
    .replaceAll('{status}', (hestId && kontekst.hesteStatus?.[hestId]) || 'ikke rask');
  // En kvalificeret kode uden hestenavn i skabelonen (f.eks. HC-07) får navnet foran.
  if (hestFraKode && navn && !/\{(, |: )?hests?\}/.test(skabelon)) tekst = `${navn}: ${tekst}`;
  return `${tekst.charAt(0).toUpperCase()}${tekst.slice(1)}.`;
}

/**
 * Dansk forklaring af en tildeling ud fra årsagskoderne (FR-010). Rækkefølgen er fast og uafhængig af
 * kodernes rækkefølge: udfald → bløde begrundelser → blokeringer af højere ønsker → turnus næste måned.
 */
export function forklar(koder: readonly Aarsagskode[], kontekst: ForklaringsKontekst): string {
  const tildeltHest = kontekst.hestId ?? undefined;
  const gruppe = ({ basis, hestId }: { basis: Basiskode; hestId?: string }) =>
    UDFALD.includes(basis) ? 0 : BLOEDE.includes(basis) && !hestId ? 1 : 2;
  const navn = (hestId?: string) => (hestId ? (kontekst.hesteNavne[hestId] ?? hestId) : '');

  const dele = [...new Set(koder)]
    .map(opdel)
    .sort(
      (a, b) =>
        gruppe(a) - gruppe(b) ||
        KATALOG.indexOf(a.basis) - KATALOG.indexOf(b.basis) ||
        sammenlignId(navn(a.hestId), navn(b.hestId)) ||
        sammenlignId(a.hestId ?? '', b.hestId ?? ''),
    );
  const saetninger = dele.map((del) =>
    saetning(del.basis, del.hestId, gruppe(del) === 0 ? tildeltHest : undefined, kontekst),
  );
  const turnus = turnusFraKoder(koder);
  if (turnus > 0) saetninger.push(`Turnusprioritet næste måned: +${turnus} (SC-02).`);
  return [...new Set(saetninger)].join(' ');
}
