import type { Prisma, Tildelingskoersel as KoerselRaekke } from '@prisma/client';
import type { Hestetildeling, KoerselStatistik, Tildelingskoersel } from '@ridecenter/contracts';
import { rytterNavn } from '../ryttere/mapper';

export const TILDELING_INCLUDE = {
  holdtilmelding: { include: { rytter: true, hold: true } },
} satisfies Prisma.HestetildelingInclude;

export type TildelingRaekke = Prisma.HestetildelingGetPayload<{ include: typeof TILDELING_INCLUDE }>;

/** Pr. hold (ugedag, starttid) og derefter rytterens fornavn. */
export const TILDELING_ORDEN = [
  { holdtilmelding: { hold: { ugedag: 'asc' } } },
  { holdtilmelding: { hold: { starttid: 'asc' } } },
  { holdtilmelding: { rytter: { fornavn: 'asc' } } },
  { id: 'asc' },
] satisfies Prisma.HestetildelingOrderByWithRelationInput[];

export function tildelingDto(t: TildelingRaekke): Hestetildeling {
  return {
    id: t.id,
    hold_id: t.holdtilmelding.hold_id,
    rytter_id: t.holdtilmelding.rytter_id,
    rytter_navn: rytterNavn(t.holdtilmelding.rytter),
    hest_id: t.hest_id,
    oenske_opfyldt: t.oenske_opfyldt as 1 | 2 | 3 | null,
    er_alternativ_tildeling: t.er_alternativ_tildeling,
    turnus_score: t.turnus_score,
    turnus_naeste_maaned: t.turnus_naeste_maaned,
    begrundelse_koder: t.begrundelse_koder,
    begrundelse_tekst: t.begrundelse_tekst,
    manuelt_justeret: t.manuelt_justeret,
  };
}

export function koerselDto(k: KoerselRaekke, tildelinger?: TildelingRaekke[]): Tildelingskoersel {
  return {
    id: k.id,
    maaned: k.maaned,
    status: k.status,
    solver_version: k.solver_version,
    input_hash: k.input_hash,
    varighed_ms: k.varighed_ms,
    oprettet: k.oprettet.toISOString(),
    statistik: k.statistik as KoerselStatistik,
    welfare_guard_overtraedelser: k.welfare_guard_resultat as string[],
    ...(tildelinger ? { tildelinger: tildelinger.map(tildelingDto) } : {}),
  };
}

/** Statistik ud fra tildelingerne (bruges også efter manuel justering). */
export function statistikFra(
  tildelinger: { hest_id: string | null; oenske_opfyldt: number | null; er_alternativ_tildeling: boolean }[],
): KoerselStatistik {
  const antal = (filter: (t: (typeof tildelinger)[number]) => boolean) => tildelinger.filter(filter).length;
  return {
    oenske_1: antal((t) => t.oenske_opfyldt === 1),
    oenske_2: antal((t) => t.oenske_opfyldt === 2),
    oenske_3: antal((t) => t.oenske_opfyldt === 3),
    alternativ: antal((t) => t.er_alternativ_tildeling),
    ikke_tildelt: antal((t) => t.hest_id === null),
  };
}
