import { validerPlacering } from '../regler/welfare-guard';
import type {
  HestData,
  HestId,
  HoldData,
  Id,
  Oenske,
  PlaceringsKontekst,
  RytterRegelData,
  Tilmelding,
} from '../typer';
import type { Egnethed } from './egnethed';
import { progressionsbonus, sammenlignKandidater, scoreHest, type Kandidat } from './score';

// Motorens løbende tilstand for ugeskabelonen (R5 trin 4): belastning pr. hest og pladserne.

function tael<K>(taeller: Map<K, number>, noegle: K, delta: number): void {
  taeller.set(noegle, (taeller.get(noegle) ?? 0) + delta);
}

/** Belastning pr. hest pr. ugedag, pr. uge og på springhold, og hvilken plads der har hesten på et hold. */
export class Belastning {
  private readonly dag = new Map<string, number>();
  private readonly uge = new Map<HestId, number>();
  private readonly spring = new Map<HestId, number>();
  private readonly paaHold = new Map<string, Id>();

  placer(hold: HoldData, hestId: HestId, tilmeldingId: Id): void {
    tael(this.dag, `${hestId}|${hold.ugedag}`, 1);
    tael(this.uge, hestId, 1);
    if (hold.erSpringhold) tael(this.spring, hestId, 1);
    this.paaHold.set(`${hold.id}|${hestId}`, tilmeldingId);
  }

  fjern(hold: HoldData, hestId: HestId): void {
    tael(this.dag, `${hestId}|${hold.ugedag}`, -1);
    tael(this.uge, hestId, -1);
    if (hold.erSpringhold) tael(this.spring, hestId, -1);
    this.paaHold.delete(`${hold.id}|${hestId}`);
  }

  dagsbelastning(hestId: HestId, ugedag: number): number {
    return this.dag.get(`${hestId}|${ugedag}`) ?? 0;
  }

  ugebelastning(hestId: HestId): number {
    return this.uge.get(hestId) ?? 0;
  }

  springBrugt(hestId: HestId): number {
    return this.spring.get(hestId) ?? 0;
  }

  /** Tilmeldingen, der har hesten på holdet, eller undefined. */
  ejerPaaHold(holdId: Id, hestId: HestId): Id | undefined {
    return this.paaHold.get(`${holdId}|${hestId}`);
  }
}

/** Én tilmelding i kørslen. `hold.partheste` er udfyldt for holdets partryttere. */
export interface Plads {
  tilmelding: Tilmelding;
  rytter: RytterRegelData;
  hold: HoldData;
  egnethed: Egnethed;
  /** Rytterens ønsker sorteret på prioritet. */
  oensker: readonly Oenske[];
  turnus: number;
  hestId: HestId | null;
  /** Fast tildeling (påkrævet hest eller partaftale) flyttes aldrig af reparationen. */
  fast: 'paakraevet' | 'part' | null;
  /** SC-04-bonussen afgjorde valget. */
  sc04: boolean;
}

export interface Motor {
  heste: ReadonlyMap<HestId, HestData>;
  belastning: Belastning;
}

export function kontekstFor(motor: Motor, plads: Plads, hest: HestData): PlaceringsKontekst {
  const { belastning } = motor;
  return {
    hest,
    lektion: plads.hold,
    dagsbelastning: belastning.dagsbelastning(hest.id, plads.hold.ugedag),
    springBrugtUge: belastning.springBrugt(hest.id),
    hestAlleredeILektion: belastning.ejerPaaHold(plads.hold.id, hest.id) !== undefined,
    godkendteHeste: plads.egnethed.godkendte,
  };
}

/** Består hesten både den statiske egnethed og de dynamiske regler i den aktuelle tilstand? */
export function lovlig(motor: Motor, plads: Plads, hestId: HestId): boolean {
  const hest = motor.heste.get(hestId);
  return hest !== undefined && validerPlacering(kontekstFor(motor, plads, hest)).length === 0;
}

export function placer(motor: Motor, plads: Plads, hestId: HestId, sc04 = false): void {
  plads.hestId = hestId;
  plads.sc04 = sc04;
  motor.belastning.placer(plads.hold, hestId, plads.tilmelding.id);
}

export function fjern(motor: Motor, plads: Plads): void {
  if (plads.hestId === null) return;
  motor.belastning.fjern(plads.hold, plads.hestId);
  plads.hestId = null;
  plads.sc04 = false;
}

/** Lovlige kandidater for pladsen, bedste først (domain-engine.md §6 f). */
export function rangerKandidater(motor: Motor, plads: Plads, kunLovlige = true): Kandidat[] {
  const kandidater: Kandidat[] = [];
  for (const hestId of plads.egnethed.godkendte) {
    const hest = motor.heste.get(hestId);
    if (!hest || (kunLovlige && !lovlig(motor, plads, hestId))) continue;
    const ugebelastning = motor.belastning.ugebelastning(hestId);
    const oenskePrioritet = plads.oensker.find((o) => o.hestId === hestId)?.prioritet ?? null;
    kandidater.push({
      hestId,
      ugebelastning,
      score: scoreHest({ oenskePrioritet, ugebelastning, rytter: plads.rytter, hest }),
    });
  }
  return kandidater.sort(sammenlignKandidater);
}

/** Den bedste lovlige hest (evt. uden en bestemt hest), og om SC-04-bonussen afgjorde valget. */
export function bedsteKandidat(
  motor: Motor,
  plads: Plads,
  undtagen?: HestId,
): { hestId: HestId; sc04: boolean } | null {
  const kandidater = rangerKandidater(motor, plads).filter((k) => k.hestId !== undtagen);
  const bedste = kandidater[0];
  if (!bedste) return null;
  const udenBonus = kandidater
    .map((k) => {
      const hest = motor.heste.get(k.hestId);
      return { ...k, score: k.score - (hest ? progressionsbonus(plads.rytter, hest) : 0) };
    })
    .sort(sammenlignKandidater)[0];
  return { hestId: bedste.hestId, sc04: udenBonus?.hestId !== bedste.hestId };
}
