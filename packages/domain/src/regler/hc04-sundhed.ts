import type { Aarsagskode } from '../forklaring/aarsagskoder';
import type { HestData } from '../typer';

/** HC-04: kun heste med status Aktiv, der ikke er taget ud af drift. */
export function hc04Sundhed(hest: HestData): Aarsagskode[] {
  return hest.sundhedsstatus !== 'Aktiv' || !hest.aktiv ? ['HC04_IKKE_RASK'] : [];
}
