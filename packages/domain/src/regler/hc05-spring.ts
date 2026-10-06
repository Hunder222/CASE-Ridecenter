import type { Aarsagskode } from '../forklaring/aarsagskoder';
import type { HestData } from '../typer';

// HC-05 gælder kun springhold. Forbuddet er statisk (egnethed), ugegrænsen dynamisk (løbende plan).

interface Springlektion {
  erSpringhold: boolean;
}

function harSpringforbud(hest: HestData): boolean {
  return hest.springforbud || hest.maxSpringUge <= 0;
}

/** HC-05 (statisk): en hest med springforbud må ikke gå på springhold. */
export function hc05Forbud(hest: HestData, lektion: Springlektion): Aarsagskode[] {
  return lektion.erSpringhold && harSpringforbud(hest) ? ['HC05_SPRINGFORBUD'] : [];
}

/** HC-05 (dynamisk): højst ét springhold om ugen. Forfatningens loft kan ikke hæves af hestens data. */
export function hc05Ugegraense(
  hest: HestData,
  lektion: Springlektion,
  springBrugtUgeEksklDenne: number,
): Aarsagskode[] {
  if (!lektion.erSpringhold || harSpringforbud(hest)) return [];
  return springBrugtUgeEksklDenne + 1 > Math.min(hest.maxSpringUge, 1) ? ['HC05_SPRING_UGEGRAENSE'] : [];
}
