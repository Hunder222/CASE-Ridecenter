import type { Aarsagskode } from '../forklaring/aarsagskoder';
import { sammenlignId } from '../tildeling/score';
import type { HestData, HestId, HoldData, Id, Niveau, RytterId, RytterRegelData, Tilmelding } from '../typer';

/** Kun Begynder og Oevet har niveaukrav. Trækhold, Letøvet og Parthold har intet (domain-engine.md §6 d). */
function niveaukrav(niveau: Niveau, hest: HestData): Aarsagskode | null {
  if (niveau === 'Begynder' && !hest.godkendtTilBegyndere) return 'HC08_NIVEAU_BEGYNDER';
  if (niveau === 'Oevet' && !hest.egnetOevet) return 'HC08_NIVEAU_OEVET';
  return null;
}

/**
 * HC-08: holdets niveau og partaftaler. En anden rytters parthest er reserveret på holdet. Egen parthest
 * må kun bruges uden niveaugodkendelse, når partaftalen er markeret "godkendt trods niveau" (F-16).
 */
export function hc08Niveau(rytter: RytterRegelData, hold: HoldData, hest: HestData): Aarsagskode[] {
  const partrytter = hold.partheste?.[hest.id];
  if (partrytter !== undefined && partrytter !== rytter.id) return ['HC08_PARTHEST_RESERVERET'];
  const krav = niveaukrav(hold.niveau, hest);
  if (krav === null) return [];
  if (rytter.partaftaleHestId === hest.id) {
    return rytter.partaftaleGodkendtTrodsNiveau ? [] : ['HC08_PART_UDEN_NIVEAUGODKENDELSE'];
  }
  return [krav];
}

/**
 * Parthest → partrytter pr. hold ud fra de tilmeldte ryttere. Motoren og Welfare Guard bruger samme
 * udledning. Har to ryttere på samme hold samme parthest, gælder aftalen for laveste rytter-id.
 */
export function byggPartheste(
  tilmeldinger: readonly Tilmelding[],
  ryttere: readonly RytterRegelData[],
): Map<Id, Record<HestId, RytterId>> {
  const parthestPrRytter = new Map(ryttere.map((r) => [r.id, r.partaftaleHestId]));
  const sorterede = [...tilmeldinger].sort(
    (a, b) => sammenlignId(a.rytterId, b.rytterId) || sammenlignId(a.id, b.id),
  );
  const resultat = new Map<Id, Record<HestId, RytterId>>();
  for (const tilmelding of sorterede) {
    const hestId = parthestPrRytter.get(tilmelding.rytterId);
    if (!hestId) continue;
    const holdets = resultat.get(tilmelding.holdId) ?? {};
    if (!Object.hasOwn(holdets, hestId)) holdets[hestId] = tilmelding.rytterId;
    resultat.set(tilmelding.holdId, holdets);
  }
  return resultat;
}
