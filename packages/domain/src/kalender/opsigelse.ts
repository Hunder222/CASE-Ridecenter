import { TZDate } from '@date-fns/tz';
import type { LocalDate } from '../typer';

const TIDSZONE = 'Europe/Copenhagen';

/**
 * Beregner ophørsdato ved opsigelse jf. FR-017:
 * Løbende måned + 30 dage.
 *
 * Eksempel:
 * - Modtaget 2026-10-10:
 *   Udgangen af løbende måned er 2026-10-31.
 *   + 30 dage: 2026-11-30.
 */
export function beregnOpsigelsesSlutdato(modtagetDato: LocalDate): LocalDate {
  const [aar, md, dag] = modtagetDato.split('-').map(Number);
  if (aar === undefined || md === undefined || dag === undefined) {
    throw new Error(`Ugyldig modtagetDato: ${modtagetDato}`);
  }

  // Find sidste dag i den pågældende måned
  // Dag 0 i måned md + 1 giver sidste dag i måned md
  const sidsteDagIMaaned = new TZDate(aar, md, 0, 12, 0, 0, 0, TIDSZONE);

  // Læg 30 dage til
  const slutDato = new TZDate(
    sidsteDagIMaaned.getFullYear(),
    sidsteDagIMaaned.getMonth(),
    sidsteDagIMaaned.getDate() + 30,
    12,
    0,
    0,
    0,
    TIDSZONE
  );

  const yyyy = slutDato.getFullYear();
  const mm = String(slutDato.getMonth() + 1).padStart(2, '0');
  const dd = String(slutDato.getDate()).padStart(2, '0');

  return `${yyyy}-${mm}-${dd}` as LocalDate;
}

