import { z } from 'zod';
import { Aarsagskode, KoerselStatus, Maaned, NotifikationType, Tidspunkt, Uuid } from './faelles';

const Heltal = z.number().int();
const Prioritet = z.union([z.literal(1), z.literal(2), z.literal(3)]);

// ---------------------------------------------------------------- Ønsker (F1.1)

export const Elevoenske = z.object({
  rytter_id: Uuid,
  rytter_navn: z.string(),
  maaned: Maaned,
  prioritet: Prioritet,
  oensket_hest_id: Uuid,
  /** false hvis hesten er spærret for rytteren (HC-07). Årsagen vises ikke. */
  kan_opfyldes: z.boolean(),
});
export type Elevoenske = z.infer<typeof Elevoenske>;

export const OenskerPut = z.strictObject({
  rytter_id: Uuid,
  oensker: z
    .array(Uuid)
    .max(3, 'Højst 3 ønsker')
    .refine((heste) => new Set(heste).size === heste.length, 'Samme hest kan kun ønskes én gang'),
});
export type OenskerPut = z.infer<typeof OenskerPut>;

// ---------------------------------------------------------------- Tildeling (Kabalen)

export const KoerselStart = z.strictObject({
  maaned: Maaned,
  reserver_begynder_heste: z.boolean().optional(),
  reserver_spring_heste: z.boolean().optional(),
});
export type KoerselStart = z.infer<typeof KoerselStart>;

export const KoerselStatistik = z.object({
  oenske_1: Heltal,
  oenske_2: Heltal,
  oenske_3: Heltal,
  alternativ: Heltal,
  ikke_tildelt: Heltal,
});
export type KoerselStatistik = z.infer<typeof KoerselStatistik>;

export const Hestetildeling = z.object({
  id: Uuid,
  hold_id: Uuid,
  rytter_id: Uuid,
  rytter_navn: z.string(),
  /** null = Ikke tildelt – kapacitetsmangel. */
  hest_id: Uuid.nullable(),
  oenske_opfyldt: Prioritet.nullable(),
  er_alternativ_tildeling: z.boolean(),
  turnus_score: Heltal,
  turnus_naeste_maaned: Heltal,
  begrundelse_koder: z.array(Aarsagskode),
  begrundelse_tekst: z.string(),
  manuelt_justeret: z.boolean(),
});
export type Hestetildeling = z.infer<typeof Hestetildeling>;

export const Tildelingskoersel = z.object({
  id: Uuid,
  maaned: Maaned,
  status: KoerselStatus,
  solver_version: z.string(),
  input_hash: z.string(),
  varighed_ms: Heltal,
  oprettet: Tidspunkt,
  statistik: KoerselStatistik,
  welfare_guard_overtraedelser: z.array(Aarsagskode),
  tildelinger: z.array(Hestetildeling).optional(),
});
export type Tildelingskoersel = z.infer<typeof Tildelingskoersel>;

/** Manuel justering. Der findes intet override-felt (Princip I). */
export const ManuelJustering = z.strictObject({
  hest_id: Uuid,
  tillad_niveau_dispensation: z.boolean().optional(),
});
export type ManuelJustering = z.infer<typeof ManuelJustering>;

export const KandidatHest = z.object({
  hest_id: Uuid,
  navn: z.string(),
  lovlig: z.boolean(),
  koder: z.array(Aarsagskode),
  begrundelse_tekst: z.string(),
});
export type KandidatHest = z.infer<typeof KandidatHest>;

export const PubliceringSvar = z.object({
  status: z.literal('Publiceret'),
  antal_lektioner: Heltal,
  erstattet_koersel_id: Uuid.nullable(),
});
export type PubliceringSvar = z.infer<typeof PubliceringSvar>;

export const SaertildelSvar = z.object({
  antal_tildelt: Heltal,
  koersel: Tildelingskoersel,
});
export type SaertildelSvar = z.infer<typeof SaertildelSvar>;

// ---------------------------------------------------------------- Notifikationer

export const DashboardNotifikation = z.object({
  id: Uuid,
  type: NotifikationType,
  payload: z.record(z.string(), z.unknown()),
  oprettet: Tidspunkt,
  kvitteret: z.boolean(),
});
export type DashboardNotifikation = z.infer<typeof DashboardNotifikation>;
