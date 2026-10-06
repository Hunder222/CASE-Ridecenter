import { byggBrugere, byggFredagshold, holdId } from './brugere-og-hold';
import { afledJuniUdfald, afledOensker } from './fredag-historik';
import { byggFredagsRyttere, FREDAGSRYTTERE, rytterId } from './fredag-ryttere';
import { byggHeste, hestId } from './heste';
import { foersteDag, forrigeMaaned } from './maaned';
import type { Seeddata, SeedHistoriskTildeling, SeedOenske } from './typer';

/** Casens fredag: 4 hold, 34 ryttere og 20 heste med måneden før som historik (quickstart V2). */
export function byggFredagsdata(maaned = '2026-07'): Seeddata {
  const forrige = forrigeMaaned(maaned);
  const { ryttere, tilmeldinger } = byggFredagsRyttere(foersteDag(forrige));

  const oensker: SeedOenske[] = FREDAGSRYTTERE.flatMap((kilde) =>
    afledOensker(kilde.navn).map((hest, i) => ({
      rytterId: rytterId(kilde.navn),
      maaned,
      prioritet: (i + 1) as 1 | 2 | 3,
      hestId: hestId(hest),
    })),
  );

  const historik: SeedHistoriskTildeling[] = FREDAGSRYTTERE.flatMap((kilde) => {
    const udfald = afledJuniUdfald(kilde.navn);
    if (!udfald) return [];
    return [
      {
        rytterId: rytterId(kilde.navn),
        holdId: holdId(kilde.hold),
        maaned: forrige,
        hestId: hestId(udfald.hest),
        oenskeOpfyldt: udfald.oenskeOpfyldt,
        erAlternativ: false,
        turnusNaesteMaaned: udfald.oenskeOpfyldt - 1,
      },
    ];
  });

  const data: Seeddata = {
    maaned,
    brugere: byggBrugere(),
    heste: byggHeste(),
    ryttere,
    hold: byggFredagshold(),
    tilmeldinger,
    oensker,
    historik,
  };
  kontrollerSeeddata(data, { ryttere: 34, heste: 20, hold: 4 });
  kontrollerFredagsforudsaetninger(data);
  return data;
}

/** Selvtjek af seeddata (bruges også af seed "fuld"). Kaster med en liste over brud. */
export function kontrollerSeeddata(
  data: Seeddata,
  forventet: { ryttere: number; heste: number; hold: number },
): void {
  const fejl: string[] = [];
  const antal = (navn: string, faktisk: number, krav: number) => {
    if (faktisk !== krav) fejl.push(`${navn}: ${faktisk}, forventet ${krav}`);
  };
  antal('ryttere', data.ryttere.length, forventet.ryttere);
  antal('heste', data.heste.length, forventet.heste);
  antal('hold', data.hold.length, forventet.hold);

  const alleIder = [...data.brugere, ...data.heste, ...data.ryttere, ...data.hold, ...data.tilmeldinger].map(
    (x) => x.id,
  );
  if (new Set(alleIder).size !== alleIder.length) fejl.push("id'er er ikke unikke");

  const hesteIder = new Set(data.heste.map((h) => h.id));
  const rytterIder = new Set(data.ryttere.map((r) => r.id));
  for (const hold of data.hold) {
    const tilmeldte = data.tilmeldinger.filter((t) => t.holdId === hold.id).length;
    if (tilmeldte > hold.maxKapacitet)
      fejl.push(`${hold.holdnavn}: ${tilmeldte} tilmeldte > max ${hold.maxKapacitet}`);
  }
  for (const t of data.tilmeldinger) {
    if (!rytterIder.has(t.rytterId)) fejl.push(`tilmelding ${t.id} peger på ukendt rytter`);
  }
  for (const o of data.oensker) {
    if (!hesteIder.has(o.hestId)) fejl.push(`ønske for rytter ${o.rytterId} peger på ukendt hest`);
  }
  for (const r of data.ryttere) {
    const egne = data.oensker
      .filter((o) => o.rytterId === r.id && o.maaned === data.maaned)
      .map((o) => o.hestId);
    if (egne.length > 3 || new Set(egne).size !== egne.length)
      fejl.push(`${r.fornavn} ${r.efternavn}: ugyldige ønsker`);
    if (r.partaftaleHestId && !hesteIder.has(r.partaftaleHestId))
      fejl.push(`${r.fornavn} ${r.efternavn}: ukendt parthest`);
  }
  if (fejl.length > 0) throw new Error(`Ugyldige seeddata:\n- ${fejl.join('\n- ')}`);
}

/** Forudsætninger for forfatningsscenarierne F-01 og F-15 (domain-engine.md §5). */
function kontrollerFredagsforudsaetninger(data: Seeddata): void {
  const rytter = (navn: string) => {
    const fundet = data.ryttere.find((r) => `${r.fornavn} ${r.efternavn}` === navn);
    if (!fundet) throw new Error(`Seed mangler ${navn}`);
    return fundet;
  };
  const anna = rytter('Anna Gammelgård');
  if (anna.paakraevedeHeste.length !== 1 || anna.paakraevedeHeste[0] !== hestId('Donny')) {
    throw new Error('F-01: Anna Gammelgård skal have Donny som eneste påkrævede hest');
  }

  const forrige = forrigeMaaned(data.maaned);
  const holdFor = (id: string) => data.tilmeldinger.find((t) => t.rytterId === id)?.holdId;
  const foersteOenske = (id: string) =>
    data.oensker.find((o) => o.rytterId === id && o.maaned === data.maaned && o.prioritet === 1)?.hestId;
  const turnus = (id: string) =>
    data.historik.find((h) => h.rytterId === id && h.maaned === forrige)?.turnusNaesteMaaned ?? 0;
  const sophia = rytter('Sophia Kronborg');
  const nora = rytter('Nora Grønbjerg');
  if (
    holdFor(sophia.id) !== holdFor(nora.id) ||
    foersteOenske(sophia.id) !== hestId('Toobi') ||
    foersteOenske(nora.id) !== hestId('Toobi') ||
    turnus(sophia.id) !== 1 ||
    turnus(nora.id) !== 0
  ) {
    throw new Error(
      'F-15: Sophia Kronborg (turnus 1) og Nora Grønbjerg (turnus 0) skal begge ønske Toobi på samme hold',
    );
  }
}
