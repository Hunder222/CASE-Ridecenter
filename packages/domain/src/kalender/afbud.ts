import { TZDate } from '@date-fns/tz';

const TIDSZONE = 'Europe/Copenhagen';

/**
 * Klassificerer et afbud som enten rettidigt eller for sent jf. R10 / FR-014.
 * Et afbud er rettidigt hvis modtaget_tidspunkt ligger før kl. 12:00 lokal tid på lektionsdagen.
 */
export function klassificerAfbud(
  modtagetTidspunkt: Date,
  lektionDato: Date,
): 'Afbud_rettidigt' | 'Afbud_for_sent' {
  // Opret deadline kl. 12:00 lokal tid på lektionens dato
  const lektionTz = new TZDate(lektionDato, TIDSZONE);
  const deadline = new TZDate(
    lektionTz.getFullYear(),
    lektionTz.getMonth(),
    lektionTz.getDate(),
    12,
    0,
    0,
    0,
    TIDSZONE,
  );

  const modtagetTz = new TZDate(modtagetTidspunkt, TIDSZONE);

  if (modtagetTz.getTime() < deadline.getTime()) {
    return 'Afbud_rettidigt';
  }
  return 'Afbud_for_sent';
}

