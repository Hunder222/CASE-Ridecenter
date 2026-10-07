import { TZDate } from '@date-fns/tz';
import type { LocalDate } from '../typer';

const TIDSZONE = 'Europe/Copenhagen';

export interface FremmoedeVindueParametre {
  dato: LocalDate;
  starttid: string; // 'HH:MM'
  varighedMin: number;
  lukketTidspunkt: Date | null;
  nu: Date;
}

/**
 * Beregner det automatiske lukketidspunkt for en lektion (30 min. efter lektionens slut i Europe/Copenhagen).
 */
export function beregnAutomatiskLukketid({
  dato,
  starttid,
  varighedMin,
}: {
  dato: LocalDate;
  starttid: string;
  varighedMin: number;
}): Date {
  const [aar, md, dag] = dato.split('-').map(Number);
  const [timer, minutter] = starttid.split(':').map(Number);

  if (aar === undefined || md === undefined || dag === undefined || timer === undefined || minutter === undefined) {
    throw new Error('Ugyldig dato eller starttid');
  }

  const startDato = new TZDate(aar, md - 1, dag, timer, minutter, 0, 0, TIDSZONE);
  // Sluttidspunkt + 30 minutter
  const totalMinutter = varighedMin + 30;
  return new Date(startDato.getTime() + totalMinutter * 60 * 1000);
}

/**
 * Afgør om en lektions fremmøde er åbent for registrering uden begrundelse (sync-protocol §3).
 * Åbent fra 30 min. før starttidspunkt, indtil "Afslut hold" trykkes eller 30 min. efter slut.
 */
export function erFremmoedeAabent({
  dato,
  starttid,
  varighedMin,
  lukketTidspunkt,
  nu,
}: FremmoedeVindueParametre): boolean {
  if (lukketTidspunkt !== null) {
    return false;
  }

  const [aar, md, dag] = dato.split('-').map(Number);
  const [timer, minutter] = starttid.split(':').map(Number);

  if (aar === undefined || md === undefined || dag === undefined || timer === undefined || minutter === undefined) {
    return false;
  }

  const lektionStart = new TZDate(aar, md - 1, dag, timer, minutter, 0, 0, TIDSZONE);
  const aabneTidspunkt = new Date(lektionStart.getTime() - 30 * 60 * 1000);
  const automatiskLukketid = beregnAutomatiskLukketid({ dato, starttid, varighedMin });

  const nuMs = nu.getTime();
  return nuMs >= aabneTidspunkt.getTime() && nuMs <= automatiskLukketid.getTime();
}

/**
 * Validerer om en korrektionsbegrundelse opfylder kravet om mindst 5 tegn (US1 AS5, FR-017).
 */
export function validerKorrektionBegrundelse(begrundelse: string): boolean {
  return typeof begrundelse === 'string' && begrundelse.trim().length >= 5;
}
