import type { Hestetildeling, KandidatHest } from '@ridecenter/contracts';
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
import { hentKoerselRaekke } from './koersel-service';
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
    const statiske = egnethed.udelukkede.find((u) => u.hestId === hest.id)?.koder ?? [];
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
): Promise<KandidatHest[]> {
  const koersel = await hentKoerselRaekke(app.prisma, koerselId);
  const tildeling = findTildeling(koersel, tildelingId);
  const grundlag = await bygAllokeringsInput(app.prisma, koersel.maaned);
  const kontekst = forklaringskontekst(grundlag, tildeling.holdtilmelding.hold_id, null);
  return vurderHeste(grundlag, koersel.tildelinger, tildeling)
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
): Promise<Hestetildeling> {
  const koersel = await hentKoerselRaekke(app.prisma, koerselId);
  const tildeling = findTildeling(koersel, tildelingId);
  if (!erLedelse(bruger) && tildeling.holdtilmelding.hold.fast_underviser_id !== bruger.id) {
    throw new DomaeneFejl('INGEN_ADGANG', 'Du kan kun justere tildelinger på dine egne hold', 403);
  }
  if (koersel.status !== 'Kladde') {
    throw new DomaeneFejl('KOERSEL_IKKE_KLADDE', 'Kun en kladde kan justeres', 409);
  }

  const grundlag = await bygAllokeringsInput(app.prisma, koersel.maaned);
  const vurdering = vurderHeste(grundlag, koersel.tildelinger, tildeling).find((v) => v.hestId === hestId);
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
  const brud = validerPlan(plan, grundlag.input).filter(
    (o) => o.holdtilmeldingId === tildeling.holdtilmelding_id || o.hestId === hestId,
  );
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
