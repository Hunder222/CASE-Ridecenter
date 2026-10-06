import { describe, expect, it } from 'vitest';
import {
  mrvGreedySolver,
  validerPlan,
  type AllokeringsInput,
  type AllokeringsResultat,
  type HestData,
  type HoldData,
  type RytterRegelData,
  type Tildeling,
} from '../../src/index';
import { byggFredagsdata } from '../../../../tools/seed/data/fredag';
import { rytterId } from '../../../../tools/seed/data/fredag-ryttere';
import { byggFuldData } from '../../../../tools/seed/data/fuld';
import { hestId } from '../../../../tools/seed/data/heste';
import { tilAllokeringsInput } from '../../../../tools/seed/data/til-domaene';
import {
  basis,
  lavHest,
  lavHold,
  lavInput,
  lavOensker,
  lavRytter,
  tildelingFor,
  tildelingerFor,
  tilPlan,
} from '../fixtures/byggere';

// Forfatningens eksempler som navngivne acceptance-tests (domain-engine.md §5). De køres på casens
// fredag (seed "fredag") og de ugeafhængige regler desuden på seed "fuld" med springhold og hele ugen.
// Alle skal være grønne, før en kørsel kan publiceres.

const MAANED = '2026-07';

interface Koersel {
  input: AllokeringsInput;
  resultat: AllokeringsResultat;
}

function koer(input: AllokeringsInput): Koersel {
  return { input, resultat: mrvGreedySolver.allokér(input) };
}

const fredagsinput = () => tilAllokeringsInput(byggFredagsdata(MAANED), MAANED);
let fredagsKoersel: Koersel | undefined;
let fuldKoersel: Koersel | undefined;
const fredag = () => (fredagsKoersel ??= koer(fredagsinput()));
const fuld = () => (fuldKoersel ??= koer(tilAllokeringsInput(byggFuldData(MAANED), MAANED)));

/** Hver test kontrollerer også planen med den uafhængige Welfare Guard. */
function forventLovligPlan({ input, resultat }: Koersel): void {
  expect(validerPlan(tilPlan(input, resultat), input)).toEqual([]);
}

function medHest(input: AllokeringsInput, navn: string, aendring: Partial<HestData>): AllokeringsInput {
  const id = hestId(navn);
  return { ...input, heste: input.heste.map((h) => (h.id === id ? { ...h, ...aendring } : h)) };
}

function medRytter(
  input: AllokeringsInput,
  navn: string,
  aendring: Partial<RytterRegelData>,
): AllokeringsInput {
  const id = rytterId(navn);
  return { ...input, ryttere: input.ryttere.map((r) => (r.id === id ? { ...r, ...aendring } : r)) };
}

interface Plads {
  tildeling: Tildeling;
  rytter: RytterRegelData;
  hold: HoldData;
  hest: HestData | null;
}

/** Tildelingerne med rytter, hold og hest slået op. */
function pladser({ input, resultat }: Koersel): Plads[] {
  const tilmeldinger = new Map(input.tilmeldinger.map((t) => [t.id, t]));
  const ryttere = new Map(input.ryttere.map((r) => [r.id, r]));
  const hold = new Map(input.hold.map((h) => [h.id, h]));
  const heste = new Map(input.heste.map((h) => [h.id, h]));
  return resultat.tildelinger.map((tildeling) => {
    const tilmelding = tilmeldinger.get(tildeling.holdtilmeldingId);
    const rytter = tilmelding && ryttere.get(tilmelding.rytterId);
    const holdet = tilmelding && hold.get(tilmelding.holdId);
    if (!rytter || !holdet) throw new Error(`Ukendt tilmelding ${tildeling.holdtilmeldingId}`);
    const hest = tildeling.hestId === null ? null : (heste.get(tildeling.hestId) ?? null);
    if (tildeling.hestId !== null && !hest) throw new Error(`Ukendt hest ${tildeling.hestId}`);
    return { tildeling, rytter, hold: holdet, hest };
  });
}

function hesteFor(k: Koersel, rytterNavn: string): (string | null)[] {
  const tildelinger = tildelingerFor(k.input, k.resultat, rytterId(rytterNavn));
  expect(tildelinger.length, rytterNavn).toBeGreaterThan(0);
  return tildelinger.map((t) => t.hestId);
}

const ider = (...navne: string[]) => navne.map(hestId);

describe('Forfatningens eksempler (domain-engine.md §5)', () => {
  it('F-01: Anna Gammelgård får kun Donny', () => {
    const k = fredag();
    expect(hesteFor(k, 'Anna Gammelgård')).toEqual([hestId('Donny')]);
    expect(basis(tildelingFor(k.input, k.resultat, rytterId('Anna Gammelgård')).koder)).toContain(
      'PAAKRAEVET_HEST',
    );
    forventLovligPlan(k);
  });

  it('F-01: er Donny syg, får Anna IKKE_TILDELT_KAPACITET og aldrig en anden hest', () => {
    const k = koer(medHest(fredagsinput(), 'Donny', { sundhedsstatus: 'Sygemeldt' }));
    const anna = tildelingFor(k.input, k.resultat, rytterId('Anna Gammelgård'));
    expect(anna.hestId).toBeNull();
    expect(basis(anna.koder)).toContain('IKKE_TILDELT_KAPACITET');
    forventLovligPlan(k);
  });

  it('F-02: Emma Grønby får aldrig Pixie', () => {
    const k = fredag();
    expect(hesteFor(k, 'Emma Grønby')).not.toContain(hestId('Pixie'));
    forventLovligPlan(k);
  });

  it('F-03: Sofia Ejby får aldrig Aida', () => {
    const k = fredag();
    expect(hesteFor(k, 'Sofia Ejby')).not.toContain(hestId('Aida'));
    forventLovligPlan(k);
  });

  it('F-04: Filippa Udby får kun Aslan eller Toobi', () => {
    const k = fredag();
    for (const hest of hesteFor(k, 'Filippa Udby')) {
      expect([...ider('Aslan', 'Toobi'), null]).toContain(hest);
    }
    forventLovligPlan(k);
  });

  it('F-05: en nervøs rytter (kun rolige heste) får aldrig Boy, Pixie, Freya eller Cornelius', () => {
    for (const k of [fredag(), fuld()]) {
      const nervoese = pladser(k).filter((p) => p.rytter.kunRoligeHeste);
      expect(nervoese.length).toBeGreaterThan(0);
      for (const { tildeling, hest } of nervoese) {
        expect(ider('Boy', 'Pixie', 'Freya', 'Cornelius')).not.toContain(tildeling.hestId);
        expect(hest?.temperament).not.toBe('Frisk');
      }
      forventLovligPlan(k);
    }
  });

  it('F-06: springhold får aldrig Bølle, Wally eller Aida, og ingen hest springer mere end 1 gang om ugen', () => {
    const springpladserIFuld = pladser(fuld()).filter((p) => p.hold.erSpringhold && p.hest);
    expect(springpladserIFuld.length).toBeGreaterThan(0);

    for (const k of [fredag(), fuld()]) {
      const springPrHest = new Map<string, number>();
      for (const { hold, hest } of pladser(k)) {
        if (!hold.erSpringhold || !hest) continue;
        expect(ider('Bølle', 'Wally', 'Aida')).not.toContain(hest.id);
        expect(hest.springforbud).toBe(false);
        springPrHest.set(hest.navn, (springPrHest.get(hest.navn) ?? 0) + 1);
      }
      for (const [navn, antal] of springPrHest) expect(antal, navn).toBeLessThanOrEqual(1);
      forventLovligPlan(k);
    }
  });

  it('F-07: øvede hold får aldrig Arthur', () => {
    for (const k of [fredag(), fuld()]) {
      const oevede = pladser(k).filter((p) => p.hold.niveau === 'Oevet');
      expect(oevede.length).toBeGreaterThan(0);
      for (const { tildeling, hest } of oevede) {
        expect(tildeling.hestId).not.toBe(hestId('Arthur'));
        if (hest) expect(hest.egnetOevet).toBe(true);
      }
      forventLovligPlan(k);
    }
  });

  it('F-08: begynderhold får kun heste, der er godkendt til begyndere', () => {
    for (const k of [fredag(), fuld()]) {
      const begyndere = pladser(k).filter((p) => p.hold.niveau === 'Begynder' && p.hest);
      expect(begyndere.length).toBeGreaterThan(0);
      for (const { rytter, hest } of begyndere) {
        if (!hest) continue;
        const egenGodkendtParthest =
          rytter.partaftaleHestId === hest.id && rytter.partaftaleGodkendtTrodsNiveau;
        expect(hest.godkendtTilBegyndere || egenGodkendtParthest, hest.navn).toBe(true);
      }
      forventLovligPlan(k);
    }
    // Seed: Aslan, Toobi, Jane og Belle er begynderhestene om fredagen.
    const fredagsBegyndere = pladser(fredag()).filter((p) => p.hold.niveau === 'Begynder' && p.hest);
    for (const { hest } of fredagsBegyndere)
      expect(ider('Aslan', 'Toobi', 'Jane', 'Belle')).toContain(hest?.id);
  });

  it('F-09: Sara Troelsen (tung rytter) får kun heste med tilstrækkelig bæreevne, aldrig Wally eller Missy', () => {
    const k = fredag();
    const sara = pladser(k).filter((p) => p.rytter.id === rytterId('Sara Troelsen'));
    expect(sara.length).toBe(1);
    for (const { rytter, hest } of sara) {
      expect(ider('Wally', 'Missy')).not.toContain(hest?.id);
      if (hest) expect(hest.maxRytterVaegtKg).toBeGreaterThanOrEqual(rytter.vaegtKg);
    }
    forventLovligPlan(k);
  });

  it('F-10: Clara Bjerg og Johanne Johansen (høje ryttere) får kun store heste uden højdegrænse', () => {
    const k = fredag();
    const hoeje = pladser(k).filter((p) =>
      [rytterId('Clara Bjerg'), rytterId('Johanne Johansen')].includes(p.rytter.id),
    );
    expect(hoeje.length).toBe(2);
    for (const { hest } of hoeje) {
      if (hest) expect(hest.maxRytterHoejdeCm, hest.navn).toBeNull();
    }
    forventLovligPlan(k);
  });

  it('F-11: Freja Pedersen får sin parthest Belle, og Lærke Hansen får ikke Aida uden markering', () => {
    const k = fredag();
    const freja = tildelingFor(k.input, k.resultat, rytterId('Freja Pedersen'));
    expect(freja.hestId).toBe(hestId('Belle'));
    expect(basis(freja.koder)).toContain('PARTAFTALE');
    expect(hesteFor(k, 'Lærke Hansen')).not.toContain(hestId('Aida'));
    forventLovligPlan(k);
  });

  it('F-12: ingen normal hest går mere end 3 hold om dagen, ingen skånehest mere end 2', () => {
    expect(fuld().input.heste.some((h) => h.skaane)).toBe(true);
    for (const k of [fredag(), fuld()]) {
      const prHestOgDag = new Map<string, { hest: HestData; antal: number }>();
      for (const { hold, hest } of pladser(k)) {
        if (!hest) continue;
        const noegle = `${hest.id}|${hold.ugedag}`;
        const antal = (prHestOgDag.get(noegle)?.antal ?? 0) + 1;
        prHestOgDag.set(noegle, { hest, antal });
      }
      for (const [noegle, { hest, antal }] of prHestOgDag) {
        expect(antal, `${hest.navn} (${noegle})`).toBeLessThanOrEqual(hest.skaane ? 2 : 3);
      }
      forventLovligPlan(k);
    }
  });

  it('F-13: ingen hest har lektioner på sin hviledag, og alle har mindst 1 hviledag om ugen', () => {
    for (const k of [fredag(), fuld()]) {
      const dagePrHest = new Map<string, Set<number>>();
      for (const { hold, hest } of pladser(k)) {
        if (!hest) continue;
        expect(hold.ugedag, `${hest.navn} på ${hold.holdnavn}`).not.toBe(hest.hviledag);
        dagePrHest.set(hest.id, (dagePrHest.get(hest.id) ?? new Set<number>()).add(hold.ugedag));
      }
      for (const [id, dage] of dagePrHest) expect(dage.size, id).toBeLessThan(7);
      forventLovligPlan(k);
    }
  });

  it('F-14: en syg hest (Toobi) udelukkes fra al tildeling', () => {
    const k = koer(medHest(fredagsinput(), 'Toobi', { sundhedsstatus: 'Sygemeldt' }));
    expect(k.resultat.tildelinger.map((t) => t.hestId)).not.toContain(hestId('Toobi'));
    forventLovligPlan(k);
  });

  it('F-15: Sophia Kronborg (turnus 1) får Toobi; Nora Grønbjerg (turnus 0) får SC02_TABT_TIL_TURNUS og sit 2. ønske', () => {
    const k = fredag();
    const sophiaId = rytterId('Sophia Kronborg');
    const noraId = rytterId('Nora Grønbjerg');
    const toobi = hestId('Toobi');
    expect(k.input.turnus[sophiaId]).toBe(1);
    expect(k.input.turnus[noraId] ?? 0).toBe(0);

    const sophia = tildelingFor(k.input, k.resultat, sophiaId);
    expect(sophia.hestId).toBe(toobi);
    expect(sophia.oenskeOpfyldt).toBe(1);

    const nora = tildelingFor(k.input, k.resultat, noraId);
    const norasAndetOenske = k.input.oensker.find((o) => o.rytterId === noraId && o.prioritet === 2)?.hestId;
    expect(nora.koder).toContain(`SC02_TABT_TIL_TURNUS:${toobi}`);
    expect(nora.oenskeOpfyldt).toBe(2);
    expect(nora.hestId).toBe(norasAndetOenske);
    forventLovligPlan(k);
  });

  it('F-15: to ryttere i samme MRV-gruppe ønsker Toobi; højeste turnus vinder (minifixture)', () => {
    const toobi = lavHest({ navn: 'Toobi', temperament: 'Rolig' });
    const zigge = lavHest({ navn: 'Zigge' });
    const oevrige = ['Aslan', 'Belle', 'Donny', 'Jane', 'Oline', 'Rosa', 'Twister'].map((navn) =>
      lavHest({ navn }),
    );
    const sophia = lavRytter({ id: 'rytter-sophia' });
    const nora = lavRytter({ id: 'rytter-nora' });
    const input = lavInput({
      heste: [toobi, zigge, ...oevrige],
      ryttere: [nora, sophia],
      oensker: [...lavOensker(sophia.id, toobi.id), ...lavOensker(nora.id, toobi.id, zigge.id)],
      turnus: { [sophia.id]: 1, [nora.id]: 0 },
    });
    const k = koer(input);

    expect(tildelingFor(input, k.resultat, sophia.id).hestId).toBe(toobi.id);
    const noras = tildelingFor(input, k.resultat, nora.id);
    expect(noras.hestId).toBe(zigge.id);
    expect(noras.oenskeOpfyldt).toBe(2);
    expect(noras.koder).toContain(`SC02_TABT_TIL_TURNUS:${toobi.id}`);
    forventLovligPlan(k);
  });

  describe('F-16: Lærke Hansen (part på Aida) på begynderholdet', () => {
    const aida = lavHest({ navn: 'Aida', godkendtTilBegyndere: false });
    const begynderheste = ['Aslan', 'Toobi', 'Jane', 'Belle'].map((navn) =>
      lavHest({ navn, godkendtTilBegyndere: true }),
    );
    const begynderhold = lavHold({
      id: 'hold-begynder',
      holdnavn: 'Fredag 15:00 Begynder',
      niveau: 'Begynder',
    });
    const laerke = lavRytter({ id: 'rytter-laerke', erfaringsniveau: 'Begynder', partaftaleHestId: aida.id });
    const ellen = lavRytter({ id: 'rytter-ellen', erfaringsniveau: 'Begynder' });
    const sofia = lavRytter({ id: 'rytter-sofia', erfaringsniveau: 'Begynder', forbudteHeste: [aida.id] });
    const minifixture = (markering: boolean) =>
      lavInput({
        heste: [aida, ...begynderheste],
        hold: [begynderhold],
        ryttere: [{ ...laerke, partaftaleGodkendtTrodsNiveau: markering }, ellen, sofia],
        oensker: [
          ...lavOensker(laerke.id, aida.id),
          ...lavOensker(ellen.id, 'hest-aslan'),
          ...lavOensker(sofia.id, 'hest-toobi'),
        ],
      });

    it('uden markering får hun en alternativ, begyndergodkendt hest med HC08_PART_UDEN_NIVEAUGODKENDELSE', () => {
      const k = koer(minifixture(false));
      const laerkes = tildelingFor(k.input, k.resultat, laerke.id);
      expect(laerkes.hestId).not.toBeNull();
      expect(laerkes.hestId).not.toBe(aida.id);
      expect(begynderheste.map((h) => h.id)).toContain(laerkes.hestId);
      expect(laerkes.erAlternativ).toBe(true);
      expect(laerkes.koder).toContain(`HC08_PART_UDEN_NIVEAUGODKENDELSE:${aida.id}`);
      forventLovligPlan(k);
    });

    it('med markeringen "godkendt trods niveau" får hun Aida (PARTAFTALE)', () => {
      const k = koer(minifixture(true));
      const laerkes = tildelingFor(k.input, k.resultat, laerke.id);
      expect(laerkes.hestId).toBe(aida.id);
      expect(basis(laerkes.koder)).toContain('PARTAFTALE');
      forventLovligPlan(k);
    });

    it('på fredagsdata får hun aldrig Aida uden markering, men får Aida med markering', () => {
      const uden = fredag();
      expect(hesteFor(uden, 'Lærke Hansen')).not.toContain(hestId('Aida'));
      forventLovligPlan(uden);

      const med = koer(medRytter(fredagsinput(), 'Lærke Hansen', { partaftaleGodkendtTrodsNiveau: true }));
      expect(hesteFor(med, 'Lærke Hansen')).toEqual([hestId('Aida')]);
      forventLovligPlan(med);
    });
  });
});
