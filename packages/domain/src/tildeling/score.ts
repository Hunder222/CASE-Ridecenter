import type { HestData, HestId, RytterRegelData } from '../typer';

/** Stabil sortering på id uafhængigt af sprog og locale (UTF-16-kodeenheder). */
export function sammenlignId(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

const SC01_POINT = { 1: 100, 2: 60, 3: 30 } as const;

/** SC-04: bonus for en rytter, der er klar til udvikling, på en hest, der ikke er Rolig. */
export function progressionsbonus(rytter: RytterRegelData, hest: HestData): number {
  return rytter.klarTilUdvikling && hest.temperament !== 'Rolig' ? 15 : 0;
}

/** Blød score (domain-engine.md §6 f): SC-01 (100/60/30) − 10 × ugebelastning (SC-03) + SC-04 (15). */
export function scoreHest({
  oenskePrioritet,
  ugebelastning,
  rytter,
  hest,
  erBegynderHold = false,
  reserverBegynderHeste = false,
  erSpringHold = false,
  reserverSpringHeste = false,
}: {
  oenskePrioritet: 1 | 2 | 3 | null;
  ugebelastning: number;
  rytter: RytterRegelData;
  hest: HestData;
  erBegynderHold?: boolean;
  reserverBegynderHeste?: boolean;
  erSpringHold?: boolean;
  reserverSpringHeste?: boolean;
}): number {
  const sc01 = oenskePrioritet === null ? 0 : SC01_POINT[oenskePrioritet];
  // Hvis begynder-heste skal reserveres, trækkes der 200 point fra, hvis en ikke-begynder rytter på et ikke-begynder hold tildeles en begynder-godkendt hest
  const begynderFradrag =
    reserverBegynderHeste && !erBegynderHold && hest.godkendtTilBegyndere ? 200 : 0;
  // Hvis spring-heste skal reserveres, trækkes der point fra, hvis en hest der må springe tildeles et ikke-springhold
  const springFradrag =
    reserverSpringHeste && !erSpringHold && !hest.springforbud && hest.maxSpringUge > 0 ? 200 : 0;
  return sc01 - 10 * ugebelastning + progressionsbonus(rytter, hest) - begynderFradrag - springFradrag;
}

export interface Kandidat {
  hestId: HestId;
  score: number;
  ugebelastning: number;
}

/** Bedste kandidat først: højeste score, laveste ugebelastning, laveste hest-id. */
export function sammenlignKandidater(a: Kandidat, b: Kandidat): number {
  return b.score - a.score || a.ugebelastning - b.ugebelastning || sammenlignId(a.hestId, b.hestId);
}
