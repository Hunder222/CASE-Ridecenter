import type { Aarsagskode } from '../forklaring/aarsagskoder';
import type { HestData, RytterRegelData } from '../typer';

/** HC-06: rytterens vægt og højde skal passe til hesten. null som højdegrænse = ingen grænse. */
export function hc06Fysisk(rytter: RytterRegelData, hest: HestData): Aarsagskode[] {
  const koder: Aarsagskode[] = [];
  if (rytter.vaegtKg > hest.maxRytterVaegtKg) koder.push('HC06_VAEGT');
  if (hest.maxRytterHoejdeCm !== null && rytter.hoejdeCm > hest.maxRytterHoejdeCm) koder.push('HC06_HOEJDE');
  return koder;
}
