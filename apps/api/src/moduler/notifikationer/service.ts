import type { NotifikationType, Prisma } from '@prisma/client';

/**
 * Opretter en dashboardnotifikation. Findes der allerede en ukvitteret notifikation med samme
 * dedupe-nøgle, oprettes intet (partielt unikt indeks i databasen sikrer det også).
 */
export async function opretNotifikation(
  tx: Prisma.TransactionClient,
  type: NotifikationType,
  payload: Prisma.InputJsonObject,
  nu: Date,
  dedupeNoegle?: string,
): Promise<void> {
  if (dedupeNoegle) {
    const findes = await tx.dashboardNotifikation.findFirst({
      where: { dedupe_noegle: dedupeNoegle, kvitteret_tidspunkt: null },
    });
    if (findes) return;
  }
  await tx.dashboardNotifikation.create({
    data: { type, payload, oprettet: nu, dedupe_noegle: dedupeNoegle ?? null },
  });
}
