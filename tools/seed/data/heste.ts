import type { Temperament, Ugedag } from '@ridecenter/domain';
import { stabilId } from './id';
import type { SeedHest } from './typer';

// De 20 fredagsheste fra _resources/teacher/_case-01-fredagsheste jan-jun TIL CASE.md:
// Maries tabel med 19 heste + TryMe, som kun optræder i rytternes historik.
// "[Demoværdi]" markerer værdier, casen ikke angiver. De skal valideres af Malene (research R15).

interface HesteKilde {
  navn: string;
  stangmaalCm: number;
  staldnoter: string;
  springforbud?: boolean;
  egnetOevet?: boolean;
}

const KILDE: readonly HesteKilde[] = [
  { navn: 'Boy', stangmaalCm: 150, staldnoter: 'Svær at styre. Svær at ride i skoven' },
  { navn: 'Oline', stangmaalCm: 145, staldnoter: 'Meget nervøs i skoven' },
  { navn: 'Aslan', stangmaalCm: 160, staldnoter: 'Nem for de fleste' },
  { navn: 'Jane', stangmaalCm: 148, staldnoter: 'Meget doven' },
  { navn: 'Donny', stangmaalCm: 142, staldnoter: 'Svær at gøre klar før og efter ridning pga. vorter' },
  { navn: 'Toobi', stangmaalCm: 140, staldnoter: 'Nem og sød' },
  { navn: 'Zigge', stangmaalCm: 142, staldnoter: 'Nem, lidt doven' },
  { navn: 'Missy', stangmaalCm: 144, staldnoter: 'Sparker de andre heste, hvis de kommer for tæt på' },
  {
    navn: 'Bølle',
    stangmaalCm: 138,
    staldnoter: 'Mangler et øje. Svær at gøre klar i stalden',
    springforbud: true,
  },
  { navn: 'Arthur', stangmaalCm: 127, staldnoter: 'Nem, men lidt doven', egnetOevet: false },
  { navn: 'Wally', stangmaalCm: 115, staldnoter: 'Kun lette ryttere', springforbud: true },
  { navn: 'Pixie', stangmaalCm: 152, staldnoter: 'Meget frisk' },
  { navn: 'Freya', stangmaalCm: 139, staldnoter: 'Meget frisk' },
  { navn: 'Twister', stangmaalCm: 136, staldnoter: 'Doven, men nem nok' },
  { navn: 'Belle', stangmaalCm: 153, staldnoter: 'Nem' },
  { navn: 'Karla', stangmaalCm: 120, staldnoter: 'Svær at få til at gå fremad' },
  {
    navn: 'Rosa',
    stangmaalCm: 152,
    staldnoter: 'Svær at gøre klar pga. vorter. Skal styres blidt, men bestemt',
  },
  {
    navn: 'Aida',
    stangmaalCm: 128,
    staldnoter: 'Svær at gøre klar pga. vorter. Svær at ride',
    springforbud: true,
  },
  { navn: 'Cornelius', stangmaalCm: 132, staldnoter: 'Meget frisk. Kan være svær at styre' },
  // [Demoværdi] Casen angiver ingen data for TryMe.
  { navn: 'TryMe', stangmaalCm: 145, staldnoter: '' },
];

/** Forfatningens liste over heste, nervøse ryttere ikke må få (Princip II). */
const FRISKE = new Set(['Boy', 'Pixie', 'Freya', 'Cornelius']);
/** Beskrevet som "nem" eller "doven" i Maries noter. */
const ROLIGE = new Set(['Aslan', 'Toobi', 'Jane', 'Belle', 'Zigge', 'Twister', 'Arthur']);
/** Startværdier for godkendt_til_begyndere (forfatningen og spec-afklaringen 2026-10-06). */
const BEGYNDERHESTE = new Set(['Aslan', 'Toobi', 'Jane', 'Belle']);

/** [Demoværdi] Hviledage fordeles cyklisk og aldrig om fredagen, så fredagsdemoen kan bruge alle heste. */
export const HVILEDAGE_CYKLUS: readonly Ugedag[] = [1, 2, 3, 4, 6, 7];

export function hestId(navn: string): string {
  return stabilId('hest', navn);
}

export function temperamentFor(navn: string): Temperament {
  if (FRISKE.has(navn)) return 'Frisk';
  if (ROLIGE.has(navn)) return 'Rolig';
  return 'Normal';
}

/** [Demoværdi] HC-06: max ryttervægt afledt af stangmålet. */
export function maxRytterVaegt(stangmaalCm: number): number {
  return stangmaalCm - 80;
}

/** [Demoværdi] HC-06: max rytterhøjde for heste under 150 cm; større heste har ingen grænse. */
export function maxRytterHoejde(stangmaalCm: number): number | null {
  return stangmaalCm < 150 ? stangmaalCm + 15 : null;
}

export function byggHeste(): SeedHest[] {
  const alfabetisk = [...KILDE].sort((a, b) => a.navn.localeCompare(b.navn, 'da'));
  return alfabetisk.map((hest, i) => ({
    id: hestId(hest.navn),
    navn: hest.navn,
    stangmaalCm: hest.stangmaalCm,
    // Missy: "Ikke tunge ryttere".
    maxRytterVaegtKg: hest.navn === 'Missy' ? 45 : maxRytterVaegt(hest.stangmaalCm),
    maxRytterHoejdeCm: maxRytterHoejde(hest.stangmaalCm),
    temperament: temperamentFor(hest.navn),
    godkendtTilBegyndere: BEGYNDERHESTE.has(hest.navn),
    egnetOevet: hest.egnetOevet ?? true,
    // Casen nævner ingen skåneheste (seed "fuld" tilføjer én).
    skaane: false,
    maxLektionerDag: 3,
    springforbud: hest.springforbud ?? false,
    maxSpringUge: hest.springforbud ? 0 : 1,
    hviledag: HVILEDAGE_CYKLUS[i % HVILEDAGE_CYKLUS.length] as Ugedag,
    sundhedsstatus: 'Aktiv',
    aktiv: true,
    staldnoter: hest.staldnoter,
  }));
}
