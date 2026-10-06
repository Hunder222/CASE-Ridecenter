import { PrismaClient } from '@prisma/client';
import { byggFredagsdata } from '../../../../tools/seed/data/fredag';
import { nulstilDatabase, skrivSeed } from '../../../../tools/seed/skriv-seed';

/** Forbundet til testdatabasen (vitest.config.ts sætter DATABASE_URL = DATABASE_URL_TEST). */
export const prisma = new PrismaClient();

function kraevTestdatabase(): void {
  if (!process.env.DATABASE_URL_TEST || process.env.DATABASE_URL !== process.env.DATABASE_URL_TEST) {
    throw new Error('Testene må kun køre mod DATABASE_URL_TEST');
  }
}

/** Tømmer alle Fase 1-tabeller i testdatabasen. */
export async function nulstilData(): Promise<void> {
  kraevTestdatabase();
  await nulstilDatabase(prisma);
}

/** Tømmer testdatabasen og seeder casens fredag (34 ryttere, 4 hold, 20 heste). */
export async function seedFredag(maaned = '2026-07') {
  await nulstilData();
  const data = byggFredagsdata(maaned);
  await skrivSeed(prisma, data, {
    krypteringsnoegle: Buffer.from(process.env.KRYPTERINGSNOEGLE ?? '', 'base64'),
    adgangskode: process.env.SEED_ADGANGSKODE ?? '',
  });
  return data;
}
