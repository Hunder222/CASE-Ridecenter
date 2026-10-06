import { bedsteKandidat, fjern, lovlig, placer, rangerKandidater, type Motor, type Plads } from './tilstand';

/** Højst 50 forsøg pr. rytter, så køretiden er begrænset (T076). */
const MAX_FORSOEG = 50;

/**
 * Reparation med dybde 1 (R5 trin 5, domain-engine.md §6 g): pladsen har ingen ledig lovlig hest. For hver
 * statisk egnet hest (bedste score først) prøves at flytte én anden, ikke-fast rytter, der blokerer hesten
 * (samme hold, samme ugedag eller springhold samme uge), til en anden lovlig hest. Faste tildelinger
 * (påkrævet hest, partaftale) flyttes aldrig. Returnerer true, hvis pladsen fik en hest.
 */
export function reparer(motor: Motor, plads: Plads, alle: readonly Plads[]): boolean {
  let forsoeg = 0;
  for (const { hestId } of rangerKandidater(motor, plads, false)) {
    const blokerende = alle.filter(
      (b) =>
        b !== plads &&
        b.fast === null &&
        b.hestId === hestId &&
        (b.hold.id === plads.hold.id ||
          b.hold.ugedag === plads.hold.ugedag ||
          (b.hold.erSpringhold && plads.hold.erSpringhold)),
    );
    for (const blokerer of blokerende) {
      if (++forsoeg > MAX_FORSOEG) return false;
      const tidligereSc04 = blokerer.sc04;
      fjern(motor, blokerer);
      if (lovlig(motor, plads, hestId)) {
        placer(motor, plads, hestId);
        const nyHest = bedsteKandidat(motor, blokerer, hestId);
        if (nyHest) {
          placer(motor, blokerer, nyHest.hestId, nyHest.sc04);
          return true;
        }
        fjern(motor, plads);
      }
      placer(motor, blokerer, hestId, tidligereSc04);
    }
  }
  return false;
}
