import type { Aarsagskode } from '../forklaring/aarsagskoder';
import type { HestData, RytterRegelData } from '../typer';

/**
 * HC-07: rytterens sikkerhedsspærringer (Princip II: spærringer er data). Koderne siger aldrig hvorfor;
 * årsagen står kun i den krypterede sikkerhedsprofil. Bruges også til kan_opfyldes for ønsker.
 */
export function hc07Sikkerhed(rytter: RytterRegelData, hest: HestData): Aarsagskode[] {
  const koder: Aarsagskode[] = [];
  if (rytter.forbudteHeste.includes(hest.id)) koder.push('HC07_FORBUDT_HEST');
  if (rytter.paakraevedeHeste.length > 0 && !rytter.paakraevedeHeste.includes(hest.id)) {
    koder.push('HC07_KUN_PAAKRAEVET');
  }
  if (rytter.kunRoligeHeste && hest.temperament === 'Frisk') koder.push('HC07_KUN_ROLIG');
  return koder;
}
