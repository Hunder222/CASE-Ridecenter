// Offentlig grænseflade for domænepakken (contracts/domain-engine.md §1). Ren TypeScript uden I/O.
export type * from './typer';
export * from './forklaring/aarsagskoder';
export { FORBUDTE_TERMER, forbudtTermI } from './forklaring/forbudte-termer';
export { forklar, statusTekst, UGEDAGSNAVNE } from './forklaring/forklar';
export { datoerIMaaned, foersteDag, forrigeMaaned, sidsteDag, ugedagFor } from './kalender/maaned';
export { turnusFraKoder, turnusPoint } from './kalender/turnus';
export { dagsgraense } from './regler/hc01-dagsgraense';
export { hc07Sikkerhed } from './regler/hc07-sikkerhed';
export { byggPartheste } from './regler/hc08-niveau';
export { validerPlacering, validerPlan } from './regler/welfare-guard';
export { beregnEgnethed, type Egnethed } from './tildeling/egnethed';
export { mrvGreedySolver } from './tildeling/mrv-solver';
