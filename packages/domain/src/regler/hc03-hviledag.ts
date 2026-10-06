import type { Aarsagskode } from '../forklaring/aarsagskoder';
import type { HestData, Ugedag } from '../typer';

/** HC-03: ingen lektion på hestens faste hviledag. */
export function hc03Hviledag(hest: HestData, lektion: { ugedag: Ugedag }): Aarsagskode[] {
  return lektion.ugedag === hest.hviledag ? ['HC03_HVILEDAG'] : [];
}
