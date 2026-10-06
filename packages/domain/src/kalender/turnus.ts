import { opdel, type Aarsagskode } from '../forklaring/aarsagskoder';

/** Turnus for måned M ud fra udfaldet i M-1 (R5): 1. ønske 0, 2. ønske +1, 3. ønske +2, alternativ +3. */
export function turnusPoint(udfald: 1 | 2 | 3 | 'alternativ'): 0 | 1 | 2 | 3 {
  return udfald === 'alternativ' ? 3 : ((udfald - 1) as 0 | 1 | 2);
}

/**
 * Turnus næste måned ud fra en tildelings udfaldskoder (domain-engine.md §6 h): ikke tildelt og alternativ
 * giver +3, n. ønske giver turnusPoint(n), og faste tildelinger og ryttere uden ønsker giver 0.
 */
export function turnusFraKoder(koder: readonly Aarsagskode[]): number {
  const basis = new Set(koder.map((kode) => opdel(kode).basis));
  if (basis.has('IKKE_TILDELT_KAPACITET') || basis.has('ALT_TILDELING')) return turnusPoint('alternativ');
  for (const n of [1, 2, 3] as const) if (basis.has(`SC01_OENSKE_${n}`)) return turnusPoint(n);
  return 0;
}
