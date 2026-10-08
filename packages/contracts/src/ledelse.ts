import { z } from 'zod';
import { Dato, Tidspunkt, Uuid } from './faelles';

// Afbud DTO'er
export const AfbudInput = z.strictObject({
  lektionsplads_id: Uuid,
  modtaget_tidspunkt: Tidspunkt.optional(),
});
export type AfbudInput = z.infer<typeof AfbudInput>;

// Venteliste DTO'er
export const VentelisteStatus = z.enum(['Aktiv', 'Forslag_genereret', 'Optaget', 'Afslaaet']);
export type VentelisteStatus = z.infer<typeof VentelisteStatus>;

export const VentelisteOpretInput = z.strictObject({
  rytter_id: Uuid,
  oensket_hold_id: Uuid.nullable().optional(),
  oensket_niveau: z.enum(['Traekhold', 'Begynder', 'Letoevet', 'Oevet', 'Parthold']).nullable().optional(),
});
export type VentelisteOpretInput = z.infer<typeof VentelisteOpretInput>;

export const GenbesaettelseType = z.enum(['Enkeltlektion', 'FastPlads']);
export type GenbesaettelseType = z.infer<typeof GenbesaettelseType>;

export const GenbesaettelseStatus = z.enum(['Afventer', 'Godkendt', 'Afvist', 'Udloebet']);
export type GenbesaettelseStatus = z.infer<typeof GenbesaettelseStatus>;

export const GenbesaettelsesforslagPost = z.object({
  id: Uuid,
  type: GenbesaettelseType,
  lektion_id: Uuid.nullable(),
  hold_id: Uuid.nullable(),
  ledig_fra: Dato.nullable(),
  frigjort_hest_id: Uuid.nullable(),
  foreslaaet_venteliste_id: Uuid,
  kontaktinfo_snapshot: z.unknown(),
  status: GenbesaettelseStatus,
  oprettet_tidspunkt: Tidspunkt.optional(),
});
export type GenbesaettelsesforslagPost = z.infer<typeof GenbesaettelsesforslagPost>;

// Dashboard & Heatmap DTO'er
export const HestBelastningCelle = z.object({
  hest_id: Uuid,
  hest_navn: z.string(),
  sundhedsstatus: z.enum(['Aktiv', 'Sygemeldt', 'Skadet', 'Karantaene']).optional(),
  ugedag: z.number().int().min(1).max(7),
  ugedag_navn: z.string(),
  planlagte_lektioner: z.number().int(),
  max_lektioner_dag: z.number().int(),
  er_over_max: z.boolean(),
  er_hviledag: z.boolean(),
});
export type HestBelastningCelle = z.infer<typeof HestBelastningCelle>;

export const DashboardNoegletalSvar = z.object({
  ugentlig_holdudnyttelse_procent: z.number(),
  antal_heste_ude_af_drift: z.number().int(),
  aktive_vikarkoder: z.number().int(),
  afventende_ventelisteforslag: z.number().int(),
  gentaget_fravaer_advarsler: z.array(
    z.object({
      rytter_id: Uuid,
      rytter_navn: z.string(),
      holdnavn: z.string(),
      antal_udeblivelser_i_traek: z.number().int(),
    })
  ),
  hest_belastningsfordeling: z.array(HestBelastningCelle),
  valgt_maaned: z.string().optional(),
  tilgaengelige_maaneder: z.array(z.string()).optional(),
});
export type DashboardNoegletalSvar = z.infer<typeof DashboardNoegletalSvar>;

// Tilsynsrapport DTO'er
export const RapportTilsynInput = z.strictObject({
  periode_fra: Dato,
  periode_til: Dato,
  aldersgraense: z.number().int().default(25),
});
export type RapportTilsynInput = z.infer<typeof RapportTilsynInput>;

export const RapportTilsynSvar = z.object({
  id: Uuid,
  periode_fra: Dato,
  periode_til: Dato,
  aldersgraense: z.number().int(),
  antal_raekker: z.number().int(),
  fil_sha256: z.string(),
  kaede_hovedhash: z.string(),
  genereret_tidspunkt: Tidspunkt,
  varighed_ms: z.number().int(),
});
export type RapportTilsynSvar = z.infer<typeof RapportTilsynSvar>;

// Hashkæde verifikation DTO
export const AuditVerificerSvar = z.object({
  gyldig: z.boolean(),
  antal_haendelser: z.number().int(),
  seneste_hash: z.string(),
  brud_ved_seq: z.number().int().optional(),
});
export type AuditVerificerSvar = z.infer<typeof AuditVerificerSvar>;

