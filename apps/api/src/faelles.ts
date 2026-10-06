import { TZDate } from '@date-fns/tz';
import { Uuid } from '@ridecenter/contracts';
import { format } from 'date-fns';
import { z } from 'zod';

// Små fælles hjælpere til modulerne.

export const IdParams = z.object({ id: Uuid });

/** Prisma @db.Date (UTC-midnat) → 'YYYY-MM-DD'. */
export function isoDato(dato: Date): string {
  return dato.toISOString().slice(0, 10);
}

/** 'YYYY-MM-DD' → værdi til en @db.Date-kolonne. */
export function datoKolonne(dato: string): Date {
  return new Date(`${dato}T00:00:00.000Z`);
}

/** Dagens dato i Europe/Copenhagen ud fra appens (injicerbare) ur. */
export function iDag(nu: Date): string {
  return format(new TZDate(nu, 'Europe/Copenhagen'), 'yyyy-MM-dd');
}

/** De felter, der er ændret, som foer/efter til revisionssporet. */
export function aendringer(
  foer: Record<string, unknown>,
  efter: Record<string, unknown>,
): { foer: Record<string, unknown>; efter: Record<string, unknown> } {
  const resultat = { foer: {} as Record<string, unknown>, efter: {} as Record<string, unknown> };
  for (const noegle of Object.keys(efter)) {
    if (JSON.stringify(foer[noegle]) === JSON.stringify(efter[noegle])) continue;
    resultat.foer[noegle] = foer[noegle] ?? null;
    resultat.efter[noegle] = efter[noegle] ?? null;
  }
  return resultat;
}
