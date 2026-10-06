import type { PrismaClient } from '@prisma/client';
import type { Elevoenske, OenskerPut } from '@ridecenter/contracts';
import { hc07Sikkerhed } from '@ridecenter/domain';
import { datoKolonne, iDag } from '../../faelles';
import { DomaeneFejl } from '../../plugins/fejl';
import { erLedelse, type SessionBruger } from '../../plugins/rbac';
import { tilHestData } from '../heste/mapper';
import { rytterNavn, tilRytterRegelData } from '../ryttere/mapper';

/**
 * Månedens ønsker (F1.1). kan_opfyldes = ingen HC-07-spærring for rytteren på hesten. Et ønske på en
 * spærret hest gemmes som registrering, men markeres "kan ikke opfyldes" uden at vise årsagen.
 */
export async function hentOensker(prisma: PrismaClient, maaned: string): Promise<Elevoenske[]> {
  const oensker = await prisma.elevoenske.findMany({
    where: { maaned },
    include: { rytter: { include: { sikkerhedsprofil: true } }, oensket_hest: true },
    orderBy: [{ rytter: { fornavn: 'asc' } }, { rytter: { efternavn: 'asc' } }, { prioritet: 'asc' }],
  });
  return oensker.map((o) => ({
    rytter_id: o.rytter_id,
    rytter_navn: rytterNavn(o.rytter),
    maaned: o.maaned,
    prioritet: o.prioritet as 1 | 2 | 3,
    oensket_hest_id: o.oensket_hest_id,
    kan_opfyldes:
      hc07Sikkerhed(tilRytterRegelData(o.rytter, o.rytter.sikkerhedsprofil), tilHestData(o.oensket_hest))
        .length === 0,
  }));
}

/** Erstatter rytterens ønsker for måneden i én transaktion. En ridelærer må kun registrere på egne hold. */
export async function gemOensker(
  prisma: PrismaClient,
  maaned: string,
  { rytter_id, oensker }: OenskerPut,
  bruger: SessionBruger,
  nu: Date,
): Promise<void> {
  const rytter = await prisma.rytter.findUnique({ where: { id: rytter_id } });
  if (!rytter || rytter.aktiv_status !== 'Aktiv') {
    throw new DomaeneFejl('UKENDT_RYTTER', 'Rytteren findes ikke eller er ikke aktiv', 422);
  }
  if (!erLedelse(bruger)) {
    const idag = datoKolonne(iDag(nu));
    const paaEgetHold = await prisma.holdtilmelding.count({
      where: {
        rytter_id,
        hold: { fast_underviser_id: bruger.id },
        OR: [{ gyldig_til: null }, { gyldig_til: { gte: idag } }],
      },
    });
    if (paaEgetHold === 0) {
      throw new DomaeneFejl(
        'INGEN_ADGANG',
        'Du kan kun registrere ønsker for ryttere på dine egne hold',
        403,
      );
    }
  }
  if ((await prisma.hest.count({ where: { id: { in: oensker } } })) !== oensker.length) {
    throw new DomaeneFejl('UKENDT_HEST', 'En af de ønskede heste findes ikke', 422);
  }
  await prisma.$transaction([
    prisma.elevoenske.deleteMany({ where: { rytter_id, maaned } }),
    prisma.elevoenske.createMany({
      data: oensker.map((hestId, i) => ({
        rytter_id,
        maaned,
        prioritet: i + 1,
        oensket_hest_id: hestId,
        registreret_af: bruger.id,
        oprettet: nu,
      })),
    }),
  ]);
}
