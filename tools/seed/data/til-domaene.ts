import type { AllokeringsInput, Stamdata } from '@ridecenter/domain';
import { forrigeMaaned } from './maaned';
import type { Seeddata } from './typer';

// Konverterer seeddata til domænets input uden database (domænetests og benchmark).

export function tilStamdata(data: Seeddata): Stamdata {
  return {
    maaned: data.maaned,
    heste: data.heste,
    hold: data.hold.map((hold) => ({
      id: hold.id,
      holdnavn: hold.holdnavn,
      niveau: hold.niveau,
      erSpringhold: hold.erSpringhold,
      ugedag: hold.ugedag,
      starttid: hold.starttid,
      varighedMin: hold.varighedMin,
      maxKapacitet: hold.maxKapacitet,
    })),
    ryttere: data.ryttere.map((rytter) => ({
      id: rytter.id,
      hoejdeCm: rytter.hoejdeCm,
      vaegtKg: rytter.vaegtKg,
      erfaringsniveau: rytter.erfaringsniveau,
      klarTilUdvikling: rytter.klarTilUdvikling,
      erHjaelper: rytter.erHjaelper,
      partaftaleHestId: rytter.partaftaleHestId,
      partaftaleGodkendtTrodsNiveau: rytter.partaftaleGodkendtTrodsNiveau,
      forbudteHeste: rytter.forbudteHeste,
      paakraevedeHeste: rytter.paakraevedeHeste,
      kunRoligeHeste: rytter.kunRoligeHeste,
    })),
    tilmeldinger: data.tilmeldinger.map((t) => ({
      id: t.id,
      rytterId: t.rytterId,
      holdId: t.holdId,
      ancienitetDato: t.ancienitetDato,
    })),
  };
}

/** Turnus = højeste turnus_naeste_maaned pr. rytter fra måneden før (0 hvis ingen). */
export function tilAllokeringsInput(data: Seeddata, maaned = data.maaned): AllokeringsInput {
  const forrige = forrigeMaaned(maaned);
  const turnus: Record<string, number> = {};
  for (const h of data.historik) {
    if (h.maaned === forrige) turnus[h.rytterId] = Math.max(turnus[h.rytterId] ?? 0, h.turnusNaesteMaaned);
  }
  return {
    ...tilStamdata(data),
    maaned,
    oensker: data.oensker
      .filter((o) => o.maaned === maaned)
      .map((o) => ({ rytterId: o.rytterId, prioritet: o.prioritet, hestId: o.hestId })),
    turnus,
  };
}
