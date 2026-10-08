import type { PrismaClient } from '@prisma/client';
import type { Tildelingskoersel } from '@ridecenter/contracts';
import { forklar, mrvGreedySolver, validerPlan } from '@ridecenter/domain';
import type { FastifyInstance } from 'fastify';
import { DomaeneFejl } from '../../plugins/fejl';
import type { SessionBruger } from '../../plugins/rbac';
import { opretNotifikation } from '../notifikationer/service';
import { rytterNavn } from '../ryttere/mapper';
import { beregnInputHash, bygAllokeringsInput, forklaringskontekst } from './input-bygger';
import { koerselDto, statistikFra, TILDELING_INCLUDE, TILDELING_ORDEN } from './mapper';

/**
 * Kør Kabalen for en måned (T085): byg input, kør mrv-greedy@1 og derefter Welfare Guard uafhængigt,
 * og gem kørslen (Kladde, eller Afvist ved overtrædelser) med én tildeling pr. tilmelding. Opretter
 * notifikationer om kapacitetsmangel og partaftaler uden niveaugodkendelse. Returnerer kørslens id.
 */
export async function koerTildeling(
  app: FastifyInstance,
  maaned: string,
  bruger: SessionBruger,
  reserverBegynderHeste?: boolean,
  reserverSpringHeste?: boolean,
): Promise<string> {
  const start = performance.now();
  const grundlag = await bygAllokeringsInput(app.prisma, maaned, reserverBegynderHeste, reserverSpringHeste);
  const { input } = grundlag;
  const inputHash = beregnInputHash(input);
  const resultat = mrvGreedySolver.allokér(input);
  const overtraedelser = validerPlan(
    {
      maaned,
      tildelinger: resultat.tildelinger.map((t) => ({
        holdtilmeldingId: t.holdtilmeldingId,
        hestId: t.hestId,
      })),
    },
    input,
  );
  const tilmeldinger = new Map(input.tilmeldinger.map((t) => [t.id, t]));
  const nu = app.ur();
  const varighedMs = Math.round(performance.now() - start);

  return app.prisma.$transaction(
    async (tx) => {
      const tildelinger = resultat.tildelinger.map((t) => {
        const tilmelding = tilmeldinger.get(t.holdtilmeldingId);
        return {
          holdtilmelding_id: t.holdtilmeldingId,
          hest_id: t.hestId,
          oenske_opfyldt: t.oenskeOpfyldt,
          er_alternativ_tildeling: t.erAlternativ,
          turnus_score: t.turnusScore,
          turnus_naeste_maaned: t.turnusNaesteMaaned,
          begrundelse_koder: t.koder,
          begrundelse_tekst: tilmelding
            ? forklar(
                t.koder,
                forklaringskontekst(grundlag, tilmelding.holdId, t.hestId, tilmelding.rytterId),
              )
            : t.tekst,
        };
      });
      const koersel = await tx.tildelingskoersel.create({
        data: {
          maaned,
          status: overtraedelser.length > 0 ? 'Afvist' : 'Kladde',
          startet_af: bruger.id,
          solver_version: mrvGreedySolver.version,
          input_hash: inputHash,
          varighed_ms: varighedMs,
          oprettet: nu,
          statistik: statistikFra(tildelinger),
          welfare_guard_resultat: overtraedelser.map((o) => o.kode),
        },
      });
      await tx.hestetildeling.createMany({
        data: tildelinger.map((t) => ({ ...t, koersel_id: koersel.id })),
      });

      for (const mangel of resultat.kapacitetsmangel) {
        const hold = grundlag.hold.get(mangel.holdId);
        await opretNotifikation(
          tx,
          'KAPACITETSMANGEL',
          { maaned, hold_id: mangel.holdId, holdnavn: hold?.holdnavn ?? '', antal: mangel.antal },
          nu,
          `KAPACITETSMANGEL:${maaned}:${mangel.holdId}`,
        );
      }
      for (const t of resultat.tildelinger) {
        if (!t.koder.some((kode) => kode.startsWith('HC08_PART_UDEN_NIVEAUGODKENDELSE'))) continue;
        const rytterId = tilmeldinger.get(t.holdtilmeldingId)?.rytterId;
        const rytter = rytterId ? await tx.rytter.findUnique({ where: { id: rytterId } }) : null;
        const hestId = rytter?.partaftale_hest_id;
        if (!rytter || !hestId) continue;
        await opretNotifikation(
          tx,
          'PARTAFTALE_MANGLER_NIVEAUGODKENDELSE',
          {
            maaned,
            rytter_id: rytter.id,
            rytter_navn: rytterNavn(rytter),
            hest_id: hestId,
            hest_navn: grundlag.hesteNavne[hestId] ?? '',
          },
          nu,
          `PARTAFTALE_MANGLER_NIVEAUGODKENDELSE:${rytter.id}:${hestId}`,
        );
      }
      return koersel.id;
    },
    { timeout: 30_000 },
  );
}

export async function hentKoerselRaekke(prisma: PrismaClient, id: string) {
  const koersel = await prisma.tildelingskoersel.findUnique({
    where: { id },
    include: { tildelinger: { include: TILDELING_INCLUDE, orderBy: TILDELING_ORDEN } },
  });
  if (!koersel) throw new DomaeneFejl('IKKE_FUNDET', 'Kørslen findes ikke', 404);
  return koersel;
}

export async function hentKoersel(prisma: PrismaClient, id: string): Promise<Tildelingskoersel> {
  const koersel = await hentKoerselRaekke(prisma, id);
  return koerselDto(koersel, koersel.tildelinger);
}

/** Kørsler for måneden uden tildelinger, nyeste først. */
export async function listKoersler(prisma: PrismaClient, maaned: string): Promise<Tildelingskoersel[]> {
  const koersler = await prisma.tildelingskoersel.findMany({
    where: { maaned },
    orderBy: { oprettet: 'desc' },
  });
  return koersler.map((k) => koerselDto(k));
}
