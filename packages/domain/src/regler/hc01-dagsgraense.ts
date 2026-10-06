import type { Aarsagskode } from '../forklaring/aarsagskoder';
import type { HestData } from '../typer';

/** Hestens dagsgrænse. Forfatningens loft (3, skånehest 2) kan ikke hæves af forkerte hestedata. */
export function dagsgraense(hest: HestData): number {
  return Math.min(hest.maxLektionerDag, hest.skaane ? 2 : 3);
}

/** HC-01: en hest, der ikke er skånehest, går højst 3 hold om dagen. */
export function hc01Dagsgraense(hest: HestData, dagsbelastningEksklDenne: number): Aarsagskode[] {
  return !hest.skaane && dagsbelastningEksklDenne + 1 > dagsgraense(hest) ? ['HC01_DAGSGRAENSE'] : [];
}
