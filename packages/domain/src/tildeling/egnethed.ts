import type { Aarsagskode } from '../forklaring/aarsagskoder';
import { statiskeKoder } from '../regler/welfare-guard';
import type { HestData, HestId, HoldData, RytterRegelData } from '../typer';
import { sammenlignId } from './score';

export interface Egnethed {
  godkendte: HestId[];
  udelukkede: { hestId: HestId; koder: Aarsagskode[] }[];
}

/**
 * Statisk egnethed for rytter × hold (R5 trin 2, R6): HC-04, HC-05 (forbud), HC-06, HC-07 og HC-08.
 * Dagsbelastning, hviledag og springgrænse pr. uge er dynamiske og hører til validerPlacering.
 * `hold.partheste` skal være udfyldt for holdets partryttere. Resultatet er sorteret på hest-id.
 */
export function beregnEgnethed(
  rytter: RytterRegelData,
  hold: HoldData,
  heste: readonly HestData[],
): Egnethed {
  const resultat: Egnethed = { godkendte: [], udelukkede: [] };
  for (const hest of [...heste].sort((a, b) => sammenlignId(a.id, b.id))) {
    const koder = statiskeKoder(rytter, hold, hest);
    if (koder.length === 0) resultat.godkendte.push(hest.id);
    else resultat.udelukkede.push({ hestId: hest.id, koder });
  }
  return resultat;
}
