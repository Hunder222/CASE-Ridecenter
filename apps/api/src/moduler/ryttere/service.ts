import type { Prisma, PrismaClient } from '@prisma/client';
import type { Rytter, RytterInput, RytterOpdatering } from '@ridecenter/contracts';
import { aendringer, datoKolonne } from '../../faelles';
import { DomaeneFejl } from '../../plugins/fejl';
import type { SessionBruger } from '../../plugins/rbac';
import { logHaendelse } from '../audit/audit-service';
import { rytterDto } from './mapper';

/** En partaftale skal pege på en aktiv hest (T079). */
async function kontrollerParthest(
  tx: Prisma.TransactionClient,
  hestId: string | null | undefined,
): Promise<void> {
  if (!hestId) return;
  if (!(await tx.hest.findFirst({ where: { id: hestId, aktiv: true } }))) {
    throw new DomaeneFejl('UKENDT_HEST', 'Parthesten findes ikke eller er ikke aktiv', 422);
  }
}

export function opretRytter(
  prisma: PrismaClient,
  input: RytterInput,
  bruger: SessionBruger,
  nu: Date,
): Promise<Rytter> {
  return prisma.$transaction(async (tx) => {
    await kontrollerParthest(tx, input.partaftale_hest_id);
    const dto = rytterDto(
      await tx.rytter.create({ data: { ...input, foedselsdato: datoKolonne(input.foedselsdato) } }),
    );
    await logHaendelse(tx, {
      handling: 'RYTTER_AENDRET',
      entitet: 'rytter',
      entitet_id: dto.id,
      bruger,
      tidspunkt: nu,
      foer: null,
      efter: dto,
    });
    return dto;
  });
}

export function opdaterRytter(
  prisma: PrismaClient,
  id: string,
  aendring: RytterOpdatering,
  bruger: SessionBruger,
  nu: Date,
): Promise<Rytter> {
  return prisma.$transaction(async (tx) => {
    const foer = await tx.rytter.findUnique({ where: { id } });
    if (!foer) throw new DomaeneFejl('IKKE_FUNDET', 'Rytteren findes ikke', 404);
    await kontrollerParthest(tx, aendring.partaftale_hest_id);
    const { foedselsdato, ...resten } = aendring;
    const efter = await tx.rytter.update({
      where: { id },
      data: { ...resten, ...(foedselsdato ? { foedselsdato: datoKolonne(foedselsdato) } : {}) },
    });
    const forskel = aendringer(rytterDto(foer), rytterDto(efter));
    if (Object.keys(forskel.efter).length > 0) {
      await logHaendelse(tx, {
        handling: 'RYTTER_AENDRET',
        entitet: 'rytter',
        entitet_id: id,
        bruger,
        tidspunkt: nu,
        ...forskel,
      });
    }
    return rytterDto(efter);
  });
}
