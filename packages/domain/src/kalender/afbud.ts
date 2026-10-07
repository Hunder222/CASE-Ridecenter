import { TZDate } from '@date-fns/tz';
import type { FremmoedeStatus } from '@ridecenter/contracts';
import type { LocalDate } from '../typer';

const TIDSZONE = 'Europe/Copenhagen';

export interface KlassificerAfbudParametre {
  lektionDato: LocalDate | Date;
  lektionStarttid?: string;
  modtagetTidspunkt: Date;
}

/**
 * Klassificerer et afbud som enten rettidigt eller for sent jf. R10 / FR-015 og SC-006.
 * Et afbud er rettidigt hvis modtaget_tidspunkt ligger før kl. 12:00:00 lokal tid på lektionsdagen (eller før lektionsdagen).
 *
 * Understøtter både objekt-kald `{lektionDato, modtagetTidspunkt}` og to argumenter `(modtagetTidspunkt, lektionDato)`.
 */
export function klassificerAfbud(
  arg1: KlassificerAfbudParametre | Date,
  arg2?: Date | LocalDate
): FremmoedeStatus {
  let modtaget: Date;
  let datoInput: LocalDate | Date;

  if (arg1 instanceof Date) {
    modtaget = arg1;
    datoInput = arg2 as Date | LocalDate;
  } else {
    modtaget = arg1.modtagetTidspunkt;
    datoInput = arg1.lektionDato;
  }

  let aar: number;
  let md: number;
  let dag: number;

  if (typeof datoInput === 'string') {
    const parts = datoInput.split('-').map(Number);
    aar = parts[0]!;
    md = parts[1]!;
    dag = parts[2]!;
  } else {
    const d = new TZDate(datoInput, TIDSZONE);
    aar = d.getFullYear();
    md = d.getMonth() + 1;
    dag = d.getDate();
  }

  // Opret deadline kl. 12:00:00 i Europe/Copenhagen
  const deadline = new TZDate(aar, md - 1, dag, 12, 0, 0, 0, TIDSZONE);

  const modtagetTz = new TZDate(modtaget, TIDSZONE);

  if (modtagetTz.getTime() < deadline.getTime()) {
    return 'Afbud_rettidigt';
  }
  return 'Afbud_for_sent';
}
