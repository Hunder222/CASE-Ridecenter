import { TZDate } from '@date-fns/tz';
import { addDays, format, getISODay, lastDayOfMonth } from 'date-fns';
import type { LocalDate, Maaned, Ugedag } from '../typer';

// Forretningskalenderen fortolkes i Europe/Copenhagen (R10), uafhængigt af maskinens tidszone.
const TIDSZONE = 'Europe/Copenhagen';

function aarOgMaaned(maaned: Maaned): [number, number] {
  const [aar, md] = maaned.split('-').map(Number);
  if (!aar || !md || md < 1 || md > 12) throw new Error(`Ugyldig måned "${maaned}" (forventet ÅÅÅÅ-MM)`);
  return [aar, md];
}

function tilDato(dato: LocalDate): TZDate {
  const [aar, md, dag] = dato.split('-').map(Number);
  if (!aar || !md || !dag) throw new Error(`Ugyldig dato "${dato}" (forventet ÅÅÅÅ-MM-DD)`);
  return new TZDate(aar, md - 1, dag, TIDSZONE);
}

const somLocalDate = (dato: Date): LocalDate => format(dato, 'yyyy-MM-dd');

export function forrigeMaaned(maaned: Maaned): Maaned {
  const [aar, md] = aarOgMaaned(maaned);
  return md === 1 ? `${aar - 1}-12` : `${aar}-${String(md - 1).padStart(2, '0')}`;
}

export function foersteDag(maaned: Maaned): LocalDate {
  aarOgMaaned(maaned);
  return `${maaned}-01`;
}

export function sidsteDag(maaned: Maaned): LocalDate {
  const [aar, md] = aarOgMaaned(maaned);
  return somLocalDate(lastDayOfMonth(new TZDate(aar, md - 1, 1, TIDSZONE)));
}

/** ISO-ugedag: 1 = mandag … 7 = søndag. */
export function ugedagFor(dato: LocalDate): Ugedag {
  return getISODay(tilDato(dato)) as Ugedag;
}

/** Alle datoer i måneden, der falder på ugedagen (f.eks. de 5 fredage i juli 2026). */
export function datoerIMaaned(maaned: Maaned, ugedag: Ugedag): LocalDate[] {
  const [aar, md] = aarOgMaaned(maaned);
  const foerste = new TZDate(aar, md - 1, 1, TIDSZONE);
  const datoer: LocalDate[] = [];
  for (
    let dato = addDays(foerste, (ugedag - getISODay(foerste) + 7) % 7);
    dato.getMonth() === md - 1;
    dato = addDays(dato, 7)
  ) {
    datoer.push(somLocalDate(dato));
  }
  return datoer;
}
