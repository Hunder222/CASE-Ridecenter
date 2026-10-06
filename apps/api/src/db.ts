import { PrismaClient } from '@prisma/client';

let klient: PrismaClient | undefined;

/** Én PrismaClient pr. proces. Forbindelsen oprettes ved første forespørgsel ud fra DATABASE_URL. */
export function hentPrisma(): PrismaClient {
  klient ??= new PrismaClient();
  return klient;
}
