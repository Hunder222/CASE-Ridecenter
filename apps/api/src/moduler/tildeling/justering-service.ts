import type { Hestetildeling, KandidatHest, Tildelingskoersel } from '@ridecenter/contracts';
import {
  beregnEgnethed,
  byggPartheste,
  forklar,
  kvalificer,
  opdel,
  turnusFraKoder,
  validerPlacering,
  validerPlan,
  type Aarsagskode,
} from '@ridecenter/domain';
import type { FastifyInstance } from 'fastify';
import { DomaeneFejl } from '../../plugins/fejl';
import { erLedelse, type SessionBruger } from '../../plugins/rbac';
import { logHaendelse } from '../audit/audit-service';
import { bygAllokeringsInput, forklaringskontekst, type KoerselGrundlag } from './input-bygger';
import { hentKoersel, hentKoerselRaekke } from './koersel-service';
import { statistikFra, TILDELING_INCLUDE, tildelingDto, type TildelingRaekke } from './mapper';

// Manuel justering under live Welfare Guard (T086, FR-008). Der findes intet override (Princip I).

interface Vurdering {
  hestId: string;
  navn: string;
  lovlig: boolean;
  koder: Aarsagskode[];
}

function tael(taeller: Map<string, number>, noegle: string): void {
  taeller.set(noegle, (taeller.get(noegle) ?? 0) + 1);
}

/** Statisk egnethed for rytteren på holdet + dynamiske regler mod resten af planen (uden denne tildeling). */
function vurderHeste(
  grundlag: KoerselGrundlag,
  plan: TildelingRaekke[],
  tildeling: TildelingRaekke,
  tilladNiveauDispensation = false,
): Vurdering[] {
  const { input } = grundlag;
  const hold = new Map(input.hold.map((h) => [h.id, h]));
  const holdet = hold.get(tildeling.holdtilmelding.hold_id);
  const rytter = input.ryttere.find((r) => r.id === tildeling.holdtilmelding.rytter_id);
  const aktive = input.heste.filter((h) => h.aktiv);
  if (!holdet || !rytter) {
    return aktive.map((h) => ({
      hestId: h.id,
      navn: h.navn,
      lovlig: false,
      koder: [kvalificer('IKKE_GODKENDT_TIL_RYTTER', h.id)],
    }));
  }
  const medPartheste = {
    ...holdet,
    partheste: byggPartheste(input.tilmeldinger, input.ryttere).get(holdet.id) ?? {},
  };
  const egnethed = beregnEgnethed(rytter, medPartheste, input.heste);

  const dag = new Map<string, number>();
  const spring = new Map<string, number>();
  const paaHoldet = new Set<string>();
  for (const t of plan) {
    const h = hold.get(t.holdtilmelding.hold_id);
    if (t.id === tildeling.id || !t.hest_id || !h) continue;
    tael(dag, `${t.hest_id}|${h.ugedag}`);
    if (h.erSpringhold) tael(spring, t.hest_id);
    if (h.id === holdet.id) paaHoldet.add(t.hest_id);
  }

  return aktive.map((hest) => {
    let statiske = egnethed.udelukkede.find((u) => u.hestId === hest.id)?.koder ?? [];
    if (tilladNiveauDispensation) {
      // Filtrér niveaukrav (HC08_NIVEAU_BEGYNDER og HC08_NIVEAU_OEVET) fra for denne ufordelte elev
      statiske = statiske.filter(
        (kode) => opdel(kode).basis !== 'HC08_NIVEAU_BEGYNDER' && opdel(kode).basis !== 'HC08_NIVEAU_OEVET',
      );
    }
    const dynamiske = validerPlacering({
      hest,
      lektion: holdet,
      dagsbelastning: dag.get(`${hest.id}|${holdet.ugedag}`) ?? 0,
      springBrugtUge: spring.get(hest.id) ?? 0,
      hestAlleredeILektion: paaHoldet.has(hest.id),
      godkendteHeste: egnethed.godkendte,
    }).filter((kode) => kode !== 'IKKE_GODKENDT_TIL_RYTTER');
    const koder = [...new Set([...statiske, ...dynamiske])].map((kode) =>
      kvalificer(opdel(kode).basis, hest.id),
    );
    return { hestId: hest.id, navn: hest.navn, lovlig: koder.length === 0, koder };
  });
}

function findTildeling(koersel: { tildelinger: TildelingRaekke[] }, tildelingId: string): TildelingRaekke {
  const tildeling = koersel.tildelinger.find((t) => t.id === tildelingId);
  if (!tildeling) throw new DomaeneFejl('IKKE_FUNDET', 'Tildelingen findes ikke', 404);
  return tildeling;
}

/** Alle aktive heste med lovlighed og dansk begrundelse, lovlige først. */
export async function kandidater(
  app: FastifyInstance,
  koerselId: string,
  tildelingId: string,
  tilladNiveauDispensation = false,
): Promise<KandidatHest[]> {
  const koersel = await hentKoerselRaekke(app.prisma, koerselId);
  const tildeling = findTildeling(koersel, tildelingId);
  const grundlag = await bygAllokeringsInput(app.prisma, koersel.maaned);
  const kontekst = forklaringskontekst(grundlag, tildeling.holdtilmelding.hold_id, null);
  // Niveau dispensation tillades hvis tildelingen i forvejen er ikke-tildelt (hest_id === null) eller eksplicit flag
  const dispensation = tilladNiveauDispensation || tildeling.hest_id === null;
  return vurderHeste(grundlag, koersel.tildelinger, tildeling, dispensation)
    .map((v) => ({
      hest_id: v.hestId,
      navn: v.navn,
      lovlig: v.lovlig,
      koder: v.koder,
      begrundelse_tekst: v.lovlig ? 'Kan tildeles' : forklar(v.koder, kontekst),
    }))
    .sort((a, b) => Number(b.lovlig) - Number(a.lovlig) || a.navn.localeCompare(b.navn, 'da'));
}

export async function justerTildeling(
  app: FastifyInstance,
  koerselId: string,
  tildelingId: string,
  hestId: string,
  bruger: SessionBruger,
  tilladNiveauDispensation = false,
): Promise<Hestetildeling> {
  const koersel = await hentKoerselRaekke(app.prisma, koerselId);
  const tildeling = findTildeling(koersel, tildelingId);
  if (!erLedelse(bruger) && tildeling.holdtilmelding.hold.fast_underviser_id !== bruger.id) {
    throw new DomaeneFejl('INGEN_ADGANG', 'Du kan kun justere tildelinger på dine egne hold', 403);
  }
  if (koersel.status !== 'Kladde') {
    throw new DomaeneFejl('KOERSEL_IKKE_KLADDE', 'Kun en kladde kan justeres', 409);
  }

  const dispensation = tilladNiveauDispensation || tildeling.hest_id === null;
  const grundlag = await bygAllokeringsInput(app.prisma, koersel.maaned);
  const vurdering = vurderHeste(grundlag, koersel.tildelinger, tildeling, dispensation).find((v) => v.hestId === hestId);
  if (!vurdering?.lovlig) {
    const koder = vurdering?.koder ?? [kvalificer('IKKE_GODKENDT_TIL_RYTTER', hestId)];
    throw new DomaeneFejl('WELFARE_GUARD_AFVIST', 'Hesten kan ikke tildeles', 422, koder);
  }
  // Uafhængig kontrol af hele planen med ændringen (brud, der involverer denne plads eller hesten).
  const plan = {
    maaned: koersel.maaned,
    tildelinger: koersel.tildelinger.map((t) => ({
      holdtilmeldingId: t.holdtilmelding_id,
      hestId: t.id === tildeling.id ? hestId : t.hest_id,
    })),
  };
  let brud = validerPlan(plan, grundlag.input).filter(
    (o) => o.holdtilmeldingId === tildeling.holdtilmelding_id || o.hestId === hestId,
  );
  if (dispensation) {
    brud = brud.filter(
      (o) =>
        o.holdtilmeldingId !== tildeling.holdtilmelding_id ||
        (opdel(o.kode).basis !== 'HC08_NIVEAU_BEGYNDER' && opdel(o.kode).basis !== 'HC08_NIVEAU_OEVET'),
    );
  }
  if (brud.length > 0) {
    throw new DomaeneFejl(
      'WELFARE_GUARD_AFVIST',
      'Hesten kan ikke tildeles',
      422,
      brud.map((o) => o.kode),
    );
  }

  const rytterId = tildeling.holdtilmelding.rytter_id;
  const oensker = grundlag.input.oensker.filter((o) => o.rytterId === rytterId);
  const opfyldt = oensker.find((o) => o.hestId === hestId);
  const koder: Aarsagskode[] = opfyldt
    ? [`SC01_OENSKE_${opfyldt.prioritet}`]
    : oensker.length > 0
      ? ['ALT_TILDELING']
      : ['SC03_BELASTNINGSUDJAEVNING'];
  const kontekst = forklaringskontekst(grundlag, tildeling.holdtilmelding.hold_id, hestId, rytterId);
  const tekst = `${forklar(koder, kontekst)} Justeret manuelt af ${bruger.navn}.`;

  const opdateret = await app.prisma.$transaction(async (tx) => {
    const raekke = await tx.hestetildeling.update({
      where: { id: tildelingId },
      data: {
        hest_id: hestId,
        manuelt_justeret: true,
        oenske_opfyldt: opfyldt?.prioritet ?? null,
        er_alternativ_tildeling: !opfyldt && oensker.length > 0,
        turnus_naeste_maaned: turnusFraKoder(koder),
        begrundelse_koder: koder,
        begrundelse_tekst: tekst,
      },
      include: TILDELING_INCLUDE,
    });
    const alle = await tx.hestetildeling.findMany({ where: { koersel_id: koerselId } });
    await tx.tildelingskoersel.update({ where: { id: koerselId }, data: { statistik: statistikFra(alle) } });
    await logHaendelse(tx, {
      handling: 'TILDELING_JUSTERET',
      entitet: 'hestetildeling',
      entitet_id: tildelingId,
      bruger,
      tidspunkt: app.ur(),
      foer: { hest_id: tildeling.hest_id },
      efter: { hest_id: hestId },
    });
    return raekke;
  });
  return tildelingDto(opdateret);
}

/** Tildel automatisk ledige heste med niveau-dispensation (soft constraint) til alle ufordelte ryttere */
export async function saertildelAlle(
  app: FastifyInstance,
  koerselId: string,
  bruger: SessionBruger,
): Promise<{ antal_tildelt: number; koersel: Tildelingskoersel }> {
  const koersel = await hentKoerselRaekke(app.prisma, koerselId);
  if (koersel.status !== 'Kladde') {
    throw new DomaeneFejl('KOERSEL_IKKE_KLADDE', 'Kun en kladde kan justeres', 409);
  }

  const ufordelte = koersel.tildelinger.filter((t) => t.hest_id === null);
  if (ufordelte.length === 0) {
    return {
      antal_tildelt: 0,
      koersel: await hentKoersel(app.prisma, koerselId),
    };
  }

  const grundlag = await bygAllokeringsInput(app.prisma, koersel.maaned);
  const arbejdsPlan = [...koersel.tildelinger];
  const opdateringer: Array<{
    tildelingId: string;
    hestId: string;
    koder: Aarsagskode[];
    tekst: string;
    oenskeOpfyldt: 1 | 2 | 3 | null;
    erAlternativ: boolean;
    turnusNaesteMaaned: number;
  }> = [];

  for (const tildeling of ufordelte) {
    const vurderinger = vurderHeste(grundlag, arbejdsPlan, tildeling, true);
    const lovlige = vurderinger.filter((v) => v.lovlig);
    if (lovlige.length === 0) continue;

    const rytterId = tildeling.holdtilmelding.rytter_id;
    const oensker = grundlag.input.oensker.filter((o) => o.rytterId === rytterId);

    // Beregn ugebelastning i arbejdsPlan
    const ugebelastning = new Map<string, number>();
    for (const p of arbejdsPlan) {
      if (p.hest_id) {
        ugebelastning.set(p.hest_id, (ugebelastning.get(p.hest_id) ?? 0) + 1);
      }
    }

    const sorterede = [...lovlige].sort((a, b) => {
      const oenskeA = oensker.find((o) => o.hestId === a.hestId)?.prioritet ?? 99;
      const oenskeB = oensker.find((o) => o.hestId === b.hestId)?.prioritet ?? 99;
      if (oenskeA !== oenskeB) return oenskeA - oenskeB;
      const belA = ugebelastning.get(a.hestId) ?? 0;
      const belB = ugebelastning.get(b.hestId) ?? 0;
      if (belA !== belB) return belA - belB;
      return a.navn.localeCompare(b.navn, 'da');
    });

    const valgt = sorterede[0];
    if (!valgt) continue;

    const opfyldt = oensker.find((o) => o.hestId === valgt.hestId);
    const koder: Aarsagskode[] = opfyldt
      ? [`SC01_OENSKE_${opfyldt.prioritet}`]
      : oensker.length > 0
        ? ['ALT_TILDELING']
        : ['SC03_BELASTNINGSUDJAEVNING'];
    const kontekst = forklaringskontekst(grundlag, tildeling.holdtilmelding.hold_id, valgt.hestId, rytterId);
    const tekst = `${forklar(koder, kontekst)} Tildelt med særtilladelse (niveau-dispensation) af ${bruger.navn}.`;

    opdateringer.push({
      tildelingId: tildeling.id,
      hestId: valgt.hestId,
      koder,
      tekst,
      oenskeOpfyldt: (opfyldt?.prioritet as 1 | 2 | 3 | undefined) ?? null,
      erAlternativ: !opfyldt && oensker.length > 0,
      turnusNaesteMaaned: turnusFraKoder(koder),
    });

    // Opdater arbejdsplanen så efterfølgende ryttere tager højde for denne placering
    const idx = arbejdsPlan.findIndex((p) => p.id === tildeling.id);
    if (idx !== -1) {
      arbejdsPlan[idx] = { ...arbejdsPlan[idx]!, hest_id: valgt.hestId };
    }
  }

  if (opdateringer.length > 0) {
    await app.prisma.$transaction(async (tx) => {
      for (const opd of opdateringer) {
        await tx.hestetildeling.update({
          where: { id: opd.tildelingId },
          data: {
            hest_id: opd.hestId,
            manuelt_justeret: true,
            oenske_opfyldt: opd.oenskeOpfyldt,
            er_alternativ_tildeling: opd.erAlternativ,
            turnus_naeste_maaned: opd.turnusNaesteMaaned,
            begrundelse_koder: opd.koder,
            begrundelse_tekst: opd.tekst,
          },
        });
        await logHaendelse(tx, {
          handling: 'TILDELING_JUSTERET',
          entitet: 'hestetildeling',
          entitet_id: opd.tildelingId,
          bruger,
          tidspunkt: app.ur(),
          foer: { hest_id: null },
          efter: { hest_id: opd.hestId },
        });
      }
      const alle = await tx.hestetildeling.findMany({ where: { koersel_id: koerselId } });
      await tx.tildelingskoersel.update({ where: { id: koerselId }, data: { statistik: statistikFra(alle) } });
    });
  }

  const opdateretKoersel = await hentKoersel(app.prisma, koerselId);
  return {
    antal_tildelt: opdateringer.length,
    koersel: opdateretKoersel,
  };
}
