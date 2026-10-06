import type { PrismaClient } from '@prisma/client';
import type { PubliceringSvar, Tildelingskoersel } from '@ridecenter/contracts';
import { datoerIMaaned, validerPlan, type Ugedag } from '@ridecenter/domain';
import type { FastifyInstance } from 'fastify';
import { datoKolonne, iDag, isoDato } from '../../faelles';
import { DomaeneFejl } from '../../plugins/fejl';
import type { SessionBruger } from '../../plugins/rbac';
import { logHaendelse } from '../audit/audit-service';
import { bygAllokeringsInput } from './input-bygger';
import { hentKoerselRaekke } from './koersel-service';
import { koerselDto, type TildelingRaekke } from './mapper';

// Tilstandsmaskinen (data-model.md §5): Kladde → Godkendt → Publiceret; en ny publicering forkaster den gamle.

/** Planen valideres igen med de aktuelle hestedata (f.eks. en hest, der er blevet syg siden kørslen). */
async function kontrollerPlan(
  prisma: PrismaClient,
  maaned: string,
  tildelinger: TildelingRaekke[],
): Promise<void> {
  const { input } = await bygAllokeringsInput(prisma, maaned);
  const brud = validerPlan(
    {
      maaned,
      tildelinger: tildelinger.map((t) => ({ holdtilmeldingId: t.holdtilmelding_id, hestId: t.hest_id })),
    },
    input,
  );
  if (brud.length > 0) {
    throw new DomaeneFejl(
      'WELFARE_GUARD_FEJL',
      'Planen overholder ikke Welfare Guard med de aktuelle hestedata',
      409,
      brud.map((o) => o.kode),
    );
  }
}

export async function godkendKoersel(
  app: FastifyInstance,
  id: string,
  bruger: SessionBruger,
): Promise<Tildelingskoersel> {
  const koersel = await hentKoerselRaekke(app.prisma, id);
  if (koersel.status !== 'Kladde')
    throw new DomaeneFejl('KOERSEL_IKKE_KLADDE', 'Kun en kladde kan godkendes', 409);
  await kontrollerPlan(app.prisma, koersel.maaned, koersel.tildelinger);
  const godkendt = await app.prisma.$transaction(async (tx) => {
    const raekke = await tx.tildelingskoersel.update({ where: { id }, data: { status: 'Godkendt' } });
    await logHaendelse(tx, {
      handling: 'TILDELING_GODKENDT',
      entitet: 'tildelingskoersel',
      entitet_id: id,
      bruger,
      tidspunkt: app.ur(),
      foer: { status: 'Kladde' },
      efter: { status: 'Godkendt', maaned: koersel.maaned },
    });
    return raekke;
  });
  return koerselDto(godkendt);
}

function aktivPaa(tilmelding: { gyldig_fra: Date; gyldig_til: Date | null }, dato: string): boolean {
  return (
    isoDato(tilmelding.gyldig_fra) <= dato &&
    (tilmelding.gyldig_til === null || isoDato(tilmelding.gyldig_til) >= dato)
  );
}

/**
 * Publicér (T087): opretter én lektion pr. hold pr. dato i måneden og én plads pr. aktiv tilmelding med
 * planlagt = aktuel hest. Erstatter planen en tidligere publiceret kørsel, røres kun datoer fra i dag.
 */
export async function publicerKoersel(
  app: FastifyInstance,
  id: string,
  bruger: SessionBruger,
): Promise<PubliceringSvar> {
  const koersel = await hentKoerselRaekke(app.prisma, id);
  if (koersel.status !== 'Godkendt') {
    throw new DomaeneFejl('IKKE_GODKENDT', 'Kørslen skal godkendes, før den kan publiceres', 409);
  }
  await kontrollerPlan(app.prisma, koersel.maaned, koersel.tildelinger);
  const idag = iDag(app.ur());

  const prHold = new Map<string, TildelingRaekke[]>();
  for (const t of koersel.tildelinger) {
    prHold.set(t.holdtilmelding.hold_id, [...(prHold.get(t.holdtilmelding.hold_id) ?? []), t]);
  }

  return app.prisma.$transaction(
    async (tx) => {
      const tidligere = await tx.tildelingskoersel.findFirst({
        where: { maaned: koersel.maaned, status: 'Publiceret', NOT: { id } },
      });
      if (tidligere)
        await tx.tildelingskoersel.update({ where: { id: tidligere.id }, data: { status: 'Forkastet' } });

      let antalLektioner = 0;
      for (const [holdId, tildelinger] of [...prHold].sort(([a], [b]) => (a < b ? -1 : 1))) {
        const hold = tildelinger[0]?.holdtilmelding.hold;
        if (!hold) continue;
        for (const dato of datoerIMaaned(koersel.maaned, hold.ugedag as Ugedag)) {
          if (tidligere && dato < idag) continue;
          const lektion = await tx.lektion.upsert({
            where: { hold_id_dato: { hold_id: holdId, dato: datoKolonne(dato) } },
            create: {
              hold_id: holdId,
              dato: datoKolonne(dato),
              underviser_id: hold.fast_underviser_id,
              status: 'Planlagt',
            },
            update: {},
          });
          antalLektioner++;
          const aktive = tildelinger.filter((t) => aktivPaa(t.holdtilmelding, dato));
          // Hestene nulstilles først, så ombytninger ikke rammer det unikke indeks (lektion, aktuel hest).
          await tx.lektionsPlads.updateMany({
            where: { lektion_id: lektion.id },
            data: { planlagt_hest_id: null, aktuel_hest_id: null },
          });
          await tx.lektionsPlads.deleteMany({
            where: {
              lektion_id: lektion.id,
              rytter_id: { notIn: aktive.map((t) => t.holdtilmelding.rytter_id) },
            },
          });
          for (const t of aktive) {
            const heste = { planlagt_hest_id: t.hest_id, aktuel_hest_id: t.hest_id, kilde: 'Plan' as const };
            await tx.lektionsPlads.upsert({
              where: {
                lektion_id_rytter_id: { lektion_id: lektion.id, rytter_id: t.holdtilmelding.rytter_id },
              },
              create: { lektion_id: lektion.id, rytter_id: t.holdtilmelding.rytter_id, ...heste },
              update: heste,
            });
          }
        }
      }

      await tx.tildelingskoersel.update({ where: { id }, data: { status: 'Publiceret' } });
      const svar: PubliceringSvar = {
        status: 'Publiceret',
        antal_lektioner: antalLektioner,
        erstattet_koersel_id: tidligere?.id ?? null,
      };
      await logHaendelse(tx, {
        handling: 'TILDELING_PUBLICERET',
        entitet: 'tildelingskoersel',
        entitet_id: id,
        bruger,
        tidspunkt: app.ur(),
        efter: { koersel_id: id, maaned: koersel.maaned, ...svar },
      });
      return svar;
    },
    { timeout: 60_000 },
  );
}
