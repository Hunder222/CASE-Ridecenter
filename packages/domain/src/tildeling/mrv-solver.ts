import { kvalificer, opdel, type Aarsagskode } from '../forklaring/aarsagskoder';
import { forklar, statusTekst } from '../forklaring/forklar';
import { turnusFraKoder } from '../kalender/turnus';
import { byggPartheste } from '../regler/hc08-niveau';
import { validerPlacering } from '../regler/welfare-guard';
import type {
  AllocationSolver,
  AllokeringsInput,
  AllokeringsResultat,
  HestId,
  Oenske,
  Tildeling,
  Tilmelding,
} from '../typer';
import { beregnEgnethed } from './egnethed';
import { reparer } from './reparation';
import { sammenlignId } from './score';
import { Belastning, bedsteKandidat, kontekstFor, lovlig, placer, type Motor, type Plads } from './tilstand';

// mrv-greedy@1 (R5, domain-engine.md §6): faste tildelinger → statisk egnethed → MRV-rækkefølge →
// grådigt valg med løbende Welfare Guard → reparation (dybde 1) → koder og dansk forklaring.
// Deterministisk: alle samlinger sorteres på id, og der bruges hverken Math.random, Date.now eller I/O.

/** MRV-grupper: højst 3 egnede heste, 4–6, 7 eller flere (§6 e). */
function mrvGruppe(antalEgnede: number): number {
  return antalEgnede <= 3 ? 1 : antalEgnede <= 6 ? 2 : 3;
}

function efterAncienitet(a: Plads, b: Plads): number {
  return (
    b.turnus - a.turnus ||
    sammenlignId(a.tilmelding.ancienitetDato, b.tilmelding.ancienitetDato) ||
    sammenlignId(a.tilmelding.id, b.tilmelding.id)
  );
}

/** Ikke-hjælpere før hjælpere (SC-05), så MRV-gruppe, turnus (SC-02), ancienitet og tilmeldings-id. */
function raekkefoelge(a: Plads, b: Plads): number {
  return (
    Number(a.rytter.erHjaelper) - Number(b.rytter.erHjaelper) ||
    mrvGruppe(a.egnethed.godkendte.length) - mrvGruppe(b.egnethed.godkendte.length) ||
    efterAncienitet(a, b)
  );
}

export const mrvGreedySolver: AllocationSolver = {
  version: 'mrv-greedy@1',

  allokér(input: AllokeringsInput): AllokeringsResultat {
    // (0) Sortér alle samlinger på id, så resultatet er uafhængigt af inputrækkefølgen.
    const heste = [...input.heste].sort((a, b) => sammenlignId(a.id, b.id));
    const hold = new Map(input.hold.map((h) => [h.id, h]));
    const ryttere = new Map(input.ryttere.map((r) => [r.id, r]));
    const tilmeldinger = [...input.tilmeldinger].sort((a, b) => sammenlignId(a.id, b.id));
    const partheste = byggPartheste(tilmeldinger, input.ryttere);
    const oensker = new Map<string, Oenske[]>();
    for (const oenske of [...input.oensker].sort(
      (a, b) => a.prioritet - b.prioritet || sammenlignId(a.hestId, b.hestId),
    )) {
      oensker.set(oenske.rytterId, [...(oensker.get(oenske.rytterId) ?? []), oenske]);
    }
    const motor: Motor = { heste: new Map(heste.map((h) => [h.id, h])), belastning: new Belastning() };

    // (2) Statisk egnethed pr. tilmelding. Tilmeldinger med ukendt rytter eller hold får ingen hest.
    const pladser: Plads[] = [];
    const ugyldige: Tilmelding[] = [];
    for (const tilmelding of tilmeldinger) {
      const rytter = ryttere.get(tilmelding.rytterId);
      const holdet = hold.get(tilmelding.holdId);
      if (!rytter || !holdet) {
        ugyldige.push(tilmelding);
        continue;
      }
      const medPartheste = { ...holdet, partheste: partheste.get(holdet.id) ?? {} };
      pladser.push({
        tilmelding,
        rytter,
        hold: medPartheste,
        egnethed: beregnEgnethed(rytter, medPartheste, heste),
        oensker: oensker.get(rytter.id) ?? [],
        turnus: input.turnus[rytter.id] ?? 0,
        hestId: null,
        fast: null,
        sc04: false,
      });
    }

    // (1) Faste tildelinger: påkrævede heste (kun blandt dem), derefter partaftaler, der består alle regler.
    const medPaakraevet = pladser
      .filter((p) => p.rytter.paakraevedeHeste.length > 0)
      .sort(
        (a, b) =>
          a.rytter.paakraevedeHeste.length - b.rytter.paakraevedeHeste.length || efterAncienitet(a, b),
      );
    for (const plads of medPaakraevet) {
      plads.fast = 'paakraevet';
      const valg = bedsteKandidat(motor, plads);
      if (valg) placer(motor, plads, valg.hestId, valg.sc04);
    }
    for (const plads of pladser) {
      const parthest = plads.rytter.partaftaleHestId;
      if (plads.fast === null && parthest && lovlig(motor, plads, parthest)) {
        plads.fast = 'part';
        placer(motor, plads, parthest);
      }
    }

    // (3)–(5) Resten i MRV-rækkefølge; uden ledig hest prøves reparation, ellers ikke tildelt.
    for (const plads of pladser.filter((p) => p.fast === null).sort(raekkefoelge)) {
      const valg = bedsteKandidat(motor, plads);
      if (valg) placer(motor, plads, valg.hestId, valg.sc04);
      else reparer(motor, plads, pladser);
    }

    // (6) Koder, turnus og dansk forklaring ud fra den endelige plan.
    const pladsPrTilmelding = new Map(pladser.map((p) => [p.tilmelding.id, p]));
    const oenskereAf = new Map<string, Set<string>>();
    for (const plads of pladser) {
      for (const { hestId } of plads.oensker) {
        const noegle = `${plads.hold.id}|${hestId}`;
        oenskereAf.set(noegle, (oenskereAf.get(noegle) ?? new Set<string>()).add(plads.tilmelding.id));
      }
    }

    /** Hvorfor pladsen ikke fik denne hest. Kvalificeret med hest-id (§6 b). */
    const blokering = (plads: Plads, hestId: HestId): Aarsagskode[] => {
      const statisk = plads.egnethed.udelukkede.find((u) => u.hestId === hestId);
      if (statisk) return statisk.koder.map((kode) => kvalificer(opdel(kode).basis, hestId));
      const hest = motor.heste.get(hestId);
      if (!hest) return [kvalificer('IKKE_GODKENDT_TIL_RYTTER', hestId)];
      const ejer = motor.belastning.ejerPaaHold(plads.hold.id, hestId);
      if (ejer !== undefined && ejer !== plads.tilmelding.id) {
        const ejersTurnus = pladsPrTilmelding.get(ejer)?.turnus ?? 0;
        return [
          kvalificer(ejersTurnus > plads.turnus ? 'SC02_TABT_TIL_TURNUS' : 'LEKTION_HEST_OPTAGET', hestId),
        ];
      }
      const dynamiske = validerPlacering(kontekstFor(motor, plads, hest)).filter(
        (kode) => kode !== 'IKKE_GODKENDT_TIL_RYTTER',
      );
      return dynamiske.length > 0
        ? dynamiske.map((kode) => kvalificer(opdel(kode).basis, hestId))
        : [kvalificer('SC03_BELASTNINGSUDJAEVNING', hestId)];
    };

    const koderFor = (plads: Plads): Pick<Tildeling, 'koder' | 'oenskeOpfyldt' | 'erAlternativ'> => {
      if (plads.fast === 'part') return { koder: ['PARTAFTALE'], oenskeOpfyldt: null, erAlternativ: false };
      if (plads.fast === 'paakraevet') {
        const koder: Aarsagskode[] = ['PAAKRAEVET_HEST'];
        if (plads.hestId === null) {
          koder.push('IKKE_TILDELT_KAPACITET');
          for (const hestId of plads.rytter.paakraevedeHeste) koder.push(...blokering(plads, hestId));
        }
        return { koder: [...new Set(koder)], oenskeOpfyldt: null, erAlternativ: false };
      }

      const koder: Aarsagskode[] = [];
      const opfyldt = plads.oensker.find((o) => o.hestId === plads.hestId);
      const erAlternativ = plads.hestId !== null && !opfyldt && plads.oensker.length > 0;
      if (plads.hestId === null) koder.push('IKKE_TILDELT_KAPACITET');
      else if (opfyldt) koder.push(`SC01_OENSKE_${opfyldt.prioritet}`);
      else if (erAlternativ) koder.push('ALT_TILDELING', 'SC03_BELASTNINGSUDJAEVNING');
      else koder.push('SC03_BELASTNINGSUDJAEVNING');

      if (plads.hestId !== null) {
        const andre = oenskereAf.get(`${plads.hold.id}|${plads.hestId}`) ?? new Set<string>();
        if (plads.turnus > 0 && [...andre].some((id) => id !== plads.tilmelding.id)) {
          koder.push('SC02_TURNUS_PRIORITET');
        }
        if (plads.sc04) koder.push('SC04_PROGRESSION');
      }
      if (plads.rytter.erHjaelper) koder.push('SC05_HJAELPER');

      // En partaftale, der ikke kunne bruges (f.eks. uden niveaugodkendelse, F-16).
      const parthest = plads.rytter.partaftaleHestId;
      if (parthest && parthest !== plads.hestId) koder.push(...blokering(plads, parthest));
      // Hvorfor højere ønsker ikke blev opfyldt.
      for (const oenske of plads.oensker) {
        if (opfyldt && oenske.prioritet >= opfyldt.prioritet) break;
        koder.push(...blokering(plads, oenske.hestId));
      }
      return { koder: [...new Set(koder)], oenskeOpfyldt: opfyldt?.prioritet ?? null, erAlternativ };
    };

    const hesteNavne = Object.fromEntries(heste.map((h) => [h.id, h.navn]));
    const hesteStatus = Object.fromEntries(heste.map((h) => [h.id, statusTekst(h)]));
    const tildelinger: Tildeling[] = [
      ...pladser.map((plads) => {
        const { koder, oenskeOpfyldt, erAlternativ } = koderFor(plads);
        return {
          holdtilmeldingId: plads.tilmelding.id,
          hestId: plads.hestId,
          oenskeOpfyldt,
          erAlternativ,
          turnusScore: plads.turnus,
          turnusNaesteMaaned: turnusFraKoder(koder),
          koder,
          tekst: forklar(koder, { hesteNavne, hesteStatus, ugedag: plads.hold.ugedag, hestId: plads.hestId }),
        };
      }),
      ...ugyldige.map((tilmelding) => {
        const koder: Aarsagskode[] = ['IKKE_TILDELT_KAPACITET'];
        return {
          holdtilmeldingId: tilmelding.id,
          hestId: null,
          oenskeOpfyldt: null,
          erAlternativ: false,
          turnusScore: input.turnus[tilmelding.rytterId] ?? 0,
          turnusNaesteMaaned: turnusFraKoder(koder),
          koder,
          tekst: forklar(koder, { hesteNavne }),
        };
      }),
    ].sort((a, b) => sammenlignId(a.holdtilmeldingId, b.holdtilmeldingId));

    // (7) Statistik og kapacitetsmangel pr. hold.
    const holdPrTilmelding = new Map(tilmeldinger.map((t) => [t.id, t.holdId]));
    const ikkeTildeltPrHold = new Map<string, number>();
    for (const t of tildelinger) {
      const holdId = holdPrTilmelding.get(t.holdtilmeldingId);
      if (t.hestId === null && holdId)
        ikkeTildeltPrHold.set(holdId, (ikkeTildeltPrHold.get(holdId) ?? 0) + 1);
    }
    const antal = (filter: (t: Tildeling) => boolean) => tildelinger.filter(filter).length;

    return {
      tildelinger,
      statistik: {
        oenske1: antal((t) => t.oenskeOpfyldt === 1),
        oenske2: antal((t) => t.oenskeOpfyldt === 2),
        oenske3: antal((t) => t.oenskeOpfyldt === 3),
        alternativ: antal((t) => t.erAlternativ),
        ikkeTildelt: antal((t) => t.hestId === null),
      },
      kapacitetsmangel: [...ikkeTildeltPrHold]
        .sort(([a], [b]) => sammenlignId(a, b))
        .map(([holdId, antalIkkeTildelt]) => ({
          holdId,
          antal: antalIkkeTildelt,
          koder: ['IKKE_TILDELT_KAPACITET'],
        })),
    };
  },
};
