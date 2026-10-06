import type { Aarsagskode } from '../forklaring/aarsagskoder';
import type { HestData } from '../typer';
import { dagsgraense } from './hc01-dagsgraense';

/** HC-02: en skånehest går højst 2 hold om dagen, også hvis maxLektionerDag fejlagtigt er højere. */
export function hc02Skaane(hest: HestData, dagsbelastningEksklDenne: number): Aarsagskode[] {
  return hest.skaane && dagsbelastningEksklDenne + 1 > dagsgraense(hest) ? ['HC02_SKAANE_DAGSGRAENSE'] : [];
}
