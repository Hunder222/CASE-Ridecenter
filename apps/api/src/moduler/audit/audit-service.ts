import { createHash, randomUUID } from 'node:crypto';
import { Prisma } from '@prisma/client';
import type { SessionBruger } from '../../plugins/rbac';
import { kanoniskJson } from './kanonisk-json';

// Append-only revisionsspor med hashkæde (Princip III, research R11):
// hash = sha256(forrige_hash ‖ kanonisk JSON af rækkens indhold).

export const GENESIS_HASH = '0'.repeat(64);
/** Advisory-lås, der serialiserer kæden på tværs af forbindelser. */
const AUDIT_LAAS = 4242;
const SKJULT = 'ændret';

export type AuditHandling =
  | 'HEST_AENDRET'
  | 'RYTTER_AENDRET'
  | 'SIKKERHEDSPROFIL_LAEST'
  | 'SIKKERHEDSPROFIL_AENDRET'
  | 'TILDELING_JUSTERET'
  | 'TILDELING_GODKENDT'
  | 'TILDELING_PUBLICERET'
  | 'LOGIN_PIN'
  | 'ENHED_UDSTEDT'
  | 'ENHED_REGISTRERET'
  | 'FREMMOEDE_KORRIGERET'
  | 'OENSKER_REGISTRERET'
  | 'SYNK_CLOCK_SKEW'
  | 'SYNK_KONFLIKT';

type JsonObjekt = Record<string, unknown>;

export interface NyHaendelse {
  handling: AuditHandling;
  entitet: string;
  entitet_id: string;
  /** null = systemhandling. */
  bruger: SessionBruger | null;
  tidspunkt: Date;
  foer?: JsonObjekt | null;
  efter?: JsonObjekt | null;
  begrundelse?: string | null;
  /** Felter, der kun må logges som "ændret" (krypterede art. 9-felter). */
  krypteredeFelter?: readonly string[];
  /** Enheden, handlingen kom fra (stald-tablet). */
  enhed_id?: string | null;
  klient_tidspunkt?: Date | null;
  kommando_id?: string | null;
}

/** De felter, der indgår i hashen. Bruges også til at verificere kæden ud fra gemte rækker. */
export interface HashIndhold {
  id: string;
  server_tidspunkt: string;
  klient_tidspunkt: string | null;
  enhed_id: string | null;
  bruger_id: string | null;
  bruger_navn: string;
  rolle: string;
  handling: string;
  entitet: string;
  entitet_id: string;
  foer: unknown;
  efter: unknown;
  begrundelse: string | null;
  kommando_id: string | null;
}

export function beregnHash(forrigeHash: string, indhold: HashIndhold): string {
  return createHash('sha256')
    .update(forrigeHash + kanoniskJson(indhold))
    .digest('hex');
}

/** Genskaber hash-indholdet fra en gemt række, så kæden kan genberegnes. */
export function hashIndholdFraRaekke(raekke: {
  id: string;
  server_tidspunkt: Date;
  klient_tidspunkt: Date | null;
  enhed_id: string | null;
  bruger_id: string | null;
  bruger_navn: string;
  rolle: string;
  handling: string;
  entitet: string;
  entitet_id: string;
  foer: unknown;
  efter: unknown;
  begrundelse: string | null;
  kommando_id: string | null;
}): HashIndhold {
  return {
    id: raekke.id,
    server_tidspunkt: raekke.server_tidspunkt.toISOString(),
    klient_tidspunkt: raekke.klient_tidspunkt?.toISOString() ?? null,
    enhed_id: raekke.enhed_id,
    bruger_id: raekke.bruger_id,
    bruger_navn: raekke.bruger_navn,
    rolle: raekke.rolle,
    handling: raekke.handling,
    entitet: raekke.entitet,
    entitet_id: raekke.entitet_id,
    foer: raekke.foer ?? null,
    efter: raekke.efter ?? null,
    begrundelse: raekke.begrundelse,
    kommando_id: raekke.kommando_id,
  };
}

function skjulKrypterede(
  objekt: JsonObjekt | null | undefined,
  felter: readonly string[],
): JsonObjekt | null {
  if (!objekt) return null;
  const kopi = JSON.parse(kanoniskJson(objekt)) as JsonObjekt;
  for (const felt of felter) {
    if (felt in kopi) kopi[felt] = SKJULT;
  }
  return kopi;
}

function primaerRolle(bruger: SessionBruger): string {
  for (const rolle of ['Ledelse', 'Ridelaerer', 'Vikar', 'Staldelev'] as const) {
    if (bruger.roller.includes(rolle)) return rolle;
  }
  return bruger.roller[0] ?? 'Ukendt';
}

/** Skal kaldes inde i en transaktion. */
export async function logHaendelse(tx: Prisma.TransactionClient, h: NyHaendelse) {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(${AUDIT_LAAS}::bigint)`;
  const seneste = await tx.auditHaendelse.findFirst({
    orderBy: { server_seq: 'desc' },
    select: { hash: true },
  });
  const forrigeHash = seneste?.hash ?? GENESIS_HASH;

  const felter = h.krypteredeFelter ?? [];
  const indhold: HashIndhold = {
    id: randomUUID(),
    server_tidspunkt: h.tidspunkt.toISOString(),
    klient_tidspunkt: h.klient_tidspunkt?.toISOString() ?? null,
    enhed_id: h.enhed_id ?? null,
    bruger_id: h.bruger?.id ?? null,
    bruger_navn: h.bruger?.navn ?? 'System',
    rolle: h.bruger ? primaerRolle(h.bruger) : 'System',
    handling: h.handling,
    entitet: h.entitet,
    entitet_id: h.entitet_id,
    foer: skjulKrypterede(h.foer, felter),
    efter: skjulKrypterede(h.efter, felter),
    begrundelse: h.begrundelse ?? null,
    kommando_id: h.kommando_id ?? null,
  };
  const hash = beregnHash(forrigeHash, indhold);

  return tx.auditHaendelse.create({
    data: {
      ...indhold,
      server_tidspunkt: h.tidspunkt,
      klient_tidspunkt: h.klient_tidspunkt ?? null,
      foer: (indhold.foer as Prisma.InputJsonValue | null) ?? Prisma.DbNull,
      efter: (indhold.efter as Prisma.InputJsonValue | null) ?? Prisma.DbNull,
      forrige_hash: forrigeHash,
      hash,
    },
  });
}
