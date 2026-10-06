import type { Prisma, PrismaClient } from '@prisma/client';
import type { Hest, HestInput, HestOpdatering } from '@ridecenter/contracts';
import { aendringer } from '../../faelles';
import { DomaeneFejl } from '../../plugins/fejl';
import type { SessionBruger } from '../../plugins/rbac';
import { logHaendelse } from '../audit/audit-service';
import { hestDto } from './mapper';

/** Afledte felter (T078): skånehest → højst 2 hold om dagen, springforbud → 0 springhold om ugen. */
export function afledteFelter(hest: { skaane: boolean; springforbud: boolean }) {
  return { max_lektioner_dag: hest.skaane ? 2 : 3, max_spring_uge: hest.springforbud ? 0 : 1 };
}

async function kontrollerNavn(tx: Prisma.TransactionClient, navn: string, undtagId?: string): Promise<void> {
  const findes = await tx.hest.findFirst({
    where: {
      aktiv: true,
      navn: { equals: navn, mode: 'insensitive' },
      ...(undtagId ? { NOT: { id: undtagId } } : {}),
    },
  });
  if (findes) throw new DomaeneFejl('HEST_NAVN_FINDES', `Der findes allerede en hest ved navn ${navn}`, 409);
}

export function opretHest(
  prisma: PrismaClient,
  input: HestInput,
  bruger: SessionBruger,
  nu: Date,
): Promise<Hest> {
  return prisma.$transaction(async (tx) => {
    await kontrollerNavn(tx, input.navn);
    const dto = hestDto(await tx.hest.create({ data: { ...input, ...afledteFelter(input) } }));
    await logHaendelse(tx, {
      handling: 'HEST_AENDRET',
      entitet: 'hest',
      entitet_id: dto.id,
      bruger,
      tidspunkt: nu,
      foer: null,
      efter: dto,
    });
    return dto;
  });
}

export function opdaterHest(
  prisma: PrismaClient,
  id: string,
  aendring: HestOpdatering,
  bruger: SessionBruger,
  nu: Date,
): Promise<Hest> {
  return prisma.$transaction(async (tx) => {
    const foer = await tx.hest.findUnique({ where: { id } });
    if (!foer) throw new DomaeneFejl('IKKE_FUNDET', 'Hesten findes ikke', 404);
    if (aendring.navn !== undefined) await kontrollerNavn(tx, aendring.navn, id);
    const efter = await tx.hest.update({
      where: { id },
      data: { ...aendring, ...afledteFelter({ ...foer, ...aendring }) },
    });
    const forskel = aendringer(hestDto(foer), hestDto(efter));
    if (Object.keys(forskel.efter).length > 0) {
      await logHaendelse(tx, {
        handling: 'HEST_AENDRET',
        entitet: 'hest',
        entitet_id: id,
        bruger,
        tidspunkt: nu,
        ...forskel,
      });
    }
    return hestDto(efter);
  });
}
