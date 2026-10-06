import { kvalificer, opdel, type Aarsagskode } from '../forklaring/aarsagskoder';
import { sammenlignId } from '../tildeling/score';
import type {
  HestData,
  HoldData,
  Maanedsplan,
  Overtraedelse,
  PlaceringsKontekst,
  RytterRegelData,
  Stamdata,
} from '../typer';
import { hc01Dagsgraense } from './hc01-dagsgraense';
import { hc02Skaane } from './hc02-skaane';
import { hc03Hviledag } from './hc03-hviledag';
import { hc04Sundhed } from './hc04-sundhed';
import { hc05Forbud, hc05Ugegraense } from './hc05-spring';
import { hc06Fysisk } from './hc06-fysisk';
import { hc07Sikkerhed } from './hc07-sikkerhed';
import { byggPartheste, hc08Niveau } from './hc08-niveau';

// Welfare Guard (Princip I): HC-01 – HC-08 kan ikke tilsidesættes, hverken af motoren, API'et eller UI'et.

/** De statiske regler for rytter × hold × hest: HC-04, HC-05 (forbud), HC-06, HC-07 og HC-08. */
export function statiskeKoder(rytter: RytterRegelData, hold: HoldData, hest: HestData): Aarsagskode[] {
  return [
    ...hc04Sundhed(hest),
    ...hc05Forbud(hest, hold),
    ...hc06Fysisk(rytter, hest),
    ...hc07Sikkerhed(rytter, hest),
    ...hc08Niveau(rytter, hold, hest),
  ];
}

/** Validér én placering i dagens og ugens belastning. Tom liste = lovlig (domain-engine.md §1). */
export function validerPlacering(ktx: PlaceringsKontekst): Aarsagskode[] {
  const { hest, lektion } = ktx;
  const koder: Aarsagskode[] = [
    ...hc01Dagsgraense(hest, ktx.dagsbelastning),
    ...hc02Skaane(hest, ktx.dagsbelastning),
    ...hc03Hviledag(hest, lektion),
    ...hc04Sundhed(hest),
    ...hc05Forbud(hest, lektion),
    ...hc05Ugegraense(hest, lektion, ktx.springBrugtUge),
  ];
  if (ktx.hestAlleredeILektion) koder.push('LEKTION_HEST_OPTAGET');
  if (!ktx.godkendteHeste.includes(hest.id)) koder.push('IKKE_GODKENDT_TIL_RYTTER');
  return koder;
}

function tael(taeller: Map<string, number>, noegle: string): void {
  taeller.set(noegle, (taeller.get(noegle) ?? 0) + 1);
}

/**
 * Uafhængig efterkontrol af en månedsplan (R5 trin 6). Belastningen genberegnes fra bunden ud fra planen
 * alene, så kontrollen ikke afhænger af motorens mellemtilstand. Planen er en ugeskabelon: dagsbelastning
 * tælles pr. hest pr. ugedag og springhold pr. hest pr. uge. Ukendte referencer afvises (fail-safe).
 */
export function validerPlan(plan: Maanedsplan, data: Stamdata): Overtraedelse[] {
  const heste = new Map(data.heste.map((h) => [h.id, h]));
  const hold = new Map(data.hold.map((h) => [h.id, h]));
  const ryttere = new Map(data.ryttere.map((r) => [r.id, r]));
  const tilmeldinger = new Map(data.tilmeldinger.map((t) => [t.id, t]));
  const partheste = byggPartheste(data.tilmeldinger, data.ryttere);

  const placeringer = plan.tildelinger
    .flatMap(({ holdtilmeldingId, hestId }) => {
      if (hestId === null) return [];
      const tilmelding = tilmeldinger.get(holdtilmeldingId);
      const holdet = tilmelding && hold.get(tilmelding.holdId);
      return [
        {
          holdtilmeldingId,
          hestId,
          hest: heste.get(hestId),
          rytter: tilmelding && ryttere.get(tilmelding.rytterId),
          hold: holdet && { ...holdet, partheste: partheste.get(holdet.id) ?? {} },
        },
      ];
    })
    .sort((a, b) => sammenlignId(a.holdtilmeldingId, b.holdtilmeldingId) || sammenlignId(a.hestId, b.hestId));

  const dag = new Map<string, number>();
  const spring = new Map<string, number>();
  const paaHold = new Map<string, number>();
  for (const p of placeringer) {
    if (!p.hold) continue;
    tael(dag, `${p.hestId}|${p.hold.ugedag}`);
    if (p.hold.erSpringhold) tael(spring, p.hestId);
    tael(paaHold, `${p.hestId}|${p.hold.id}`);
  }

  const overtraedelser: Overtraedelse[] = [];
  for (const p of placeringer) {
    const koder: Aarsagskode[] = [];
    if (!p.hest || !p.rytter || !p.hold) {
      koder.push('IKKE_GODKENDT_TIL_RYTTER');
    } else {
      const dagsbelastning = (dag.get(`${p.hestId}|${p.hold.ugedag}`) ?? 1) - 1;
      koder.push(
        ...statiskeKoder(p.rytter, p.hold, p.hest),
        ...hc01Dagsgraense(p.hest, dagsbelastning),
        ...hc02Skaane(p.hest, dagsbelastning),
        ...hc03Hviledag(p.hest, p.hold),
        ...hc05Ugegraense(p.hest, p.hold, (spring.get(p.hestId) ?? 1) - 1),
      );
      if ((paaHold.get(`${p.hestId}|${p.hold.id}`) ?? 0) > 1) koder.push('LEKTION_HEST_OPTAGET');
    }
    for (const kode of new Set(koder)) {
      overtraedelser.push({
        holdtilmeldingId: p.holdtilmeldingId,
        hestId: p.hestId,
        kode: kvalificer(opdel(kode).basis, p.hestId),
      });
    }
  }
  return overtraedelser;
}
