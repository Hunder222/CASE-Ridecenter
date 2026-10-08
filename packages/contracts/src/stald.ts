import { z } from 'zod';
import { AktivStatus, Dato, Niveau, Sundhedsstatus, Temperament, Tidspunkt, Uuid } from './faelles';

// Stald-DTO'er (data-model.md §9, research R6/R8). De indeholder ALDRIG vaegt_kg, hoejde_cm, foedselsdato,
// kontakt_*, faldtraume_note, angstkategori, forbudte_heste eller paakraevede_heste (Princip IV).

export const FremmoedeStatus = z.enum(['Fremmoedt', 'Afbud_rettidigt', 'Afbud_for_sent', 'Udeblevet']);
export type FremmoedeStatus = z.infer<typeof FremmoedeStatus>;

export const StaldPlads = z.object({
  id: Uuid,
  /** Fornavn + efternavnsinitial (dataminimering). */
  rytter_navn_kort: z.string(),
  planlagt_hest_id: Uuid.nullable(),
  aktuel_hest_id: Uuid.nullable(),
  afledt_status: FremmoedeStatus.nullable(),
  rytter_status: AktivStatus.optional(),
  /** Afledt liste (R6). Aldrig årsagen til, at en hest mangler. */
  godkendte_heste: z.array(Uuid),
  cheat_sheet_koder: z.array(z.string()),
  /** Anonymiseret og dekrypteret instruks (højst 200 tegn). */
  adfaerdsinstruks: z.string().nullable(),
});
export type StaldPlads = z.infer<typeof StaldPlads>;

export const StaldHold = z.object({
  id: Uuid,
  hold_id: Uuid,
  dato: Dato,
  holdnavn: z.string(),
  niveau: Niveau,
  er_springhold: z.boolean(),
  starttid: z.string(),
  varighed_min: z.number().int(),
  underviser_navn: z.string(),
  fremmoede_lukket: Tidspunkt.nullable(),
  pladser: z.array(StaldPlads),
});
export type StaldHold = z.infer<typeof StaldHold>;

export const StaldDag = z.object({
  dato: Dato,
  lektioner: z.array(StaldHold),
});
export type StaldDag = z.infer<typeof StaldDag>;

export const HestStaldInfo = z.object({
  id: Uuid,
  navn: z.string(),
  stangmaal_cm: z.number().int(),
  temperament: Temperament,
  sundhedsstatus: Sundhedsstatus,
  staldnoter: z.string(),
  hviledag: z.number().int().min(1).max(7),
  max_lektioner_dag: z.number().int(),
  spring_brugt_uge: z.number().int(),
});
export type HestStaldInfo = z.infer<typeof HestStaldInfo>;

export const EnhedRegistrerBody = z.strictObject({ enrollment_token: z.string().min(1) });
export type EnhedRegistrerBody = z.infer<typeof EnhedRegistrerBody>;

export const EnhedUdstedBody = z.strictObject({ navn: z.string().min(1).max(100) });
export type EnhedUdstedBody = z.infer<typeof EnhedUdstedBody>;

export const PinLoginBody = z.strictObject({ pin: z.string().regex(/^[0-9]{4}$/, 'PIN skal være 4 cifre') });
export type PinLoginBody = z.infer<typeof PinLoginBody>;

export const VikarLoginBody = z.strictObject({
  vikarkode: z.string().regex(/^[0-9]{6}$/, 'Vikarkoden skal være 6 cifre'),
  fulde_navn: z.string().trim().min(3, 'Skriv dit fulde navn'),
});
export type VikarLoginBody = z.infer<typeof VikarLoginBody>;

export const FremmoedeBatchBody = z.strictObject({
  lektion_id: Uuid,
  registreringer: z
    .array(
      z.strictObject({
        lektionsplads_id: Uuid,
        status: z.enum(['Fremmoedt', 'Udeblevet']),
      }),
    )
    .min(1),
});
export type FremmoedeBatchBody = z.infer<typeof FremmoedeBatchBody>;

export const FremmoedeKorrektionBody = z.strictObject({
  ny_status: FremmoedeStatus,
  begrundelse: z.string().trim().min(5, 'Begrundelsen skal være mindst 5 tegn'),
});
export type FremmoedeKorrektionBody = z.infer<typeof FremmoedeKorrektionBody>;

export const FremmoedePost = z.object({
  id: Uuid,
  lektionsplads_id: Uuid,
  lektion_dato: Dato,
  hold_id: Uuid,
  rytter_id: Uuid,
  hest_id: Uuid.nullable(),
  status: FremmoedeStatus,
  modtaget_tidspunkt: Tidspunkt.nullable(),
  registreret_af_navn: z.string(),
  klient_tidspunkt: Tidspunkt,
  server_tidspunkt: Tidspunkt,
  erstatter_id: Uuid.nullable(),
  korrektions_begrundelse: z.string().nullable(),
  kommando_id: Uuid,
  forrige_hash: z.string(),
  hash: z.string(),
});
export type FremmoedePost = z.infer<typeof FremmoedePost>;

export const HestestatusmeldingInput = z.strictObject({
  type: z.enum(['Helbred', 'Adfaerd']),
  alvorlighed: z.enum(['Info', 'Obs', 'KanIkkeBruges']),
  beskrivelse: z.string().trim().min(1, 'Beskrivelse påkrævet').max(500, 'Beskrivelsen må højst være 500 tegn'),
});
export type HestestatusmeldingInput = z.infer<typeof HestestatusmeldingInput>;

export const OmplaceringInput = z.strictObject({
  til_hest_id: Uuid,
  aarsag: z.enum(['HestSyg', 'HestSkadet', 'Adfaerd', 'Andet']),
  forslag_snapshot: z.unknown().optional(),
});
export type OmplaceringInput = z.infer<typeof OmplaceringInput>;

export const VikarKodePost = z.object({
  id: Uuid,
  status: z.enum(['Aktiv', 'Anvendt', 'Udloebet', 'Spaerret']),
  udstedt_dato: Tidspunkt,
  udloebsdato: Tidspunkt,
  anvendt_dato: Tidspunkt.nullable(),
  anvendt_af_vikarnavn: z.string().nullable(),
  kode: z.string().optional().nullable(),
  navn: z.string().optional().nullable(),
  fast_vikar: z.boolean().optional(),
});
export type VikarKodePost = z.infer<typeof VikarKodePost>;

export const VikarKodeOpretInput = z.strictObject({
  navn: z.string().trim().min(2).optional(),
  fast_vikar: z.boolean().optional(),
  udloeb_dage: z.number().int().min(1).max(3650).optional().nullable(), // null = aldrig
});
export type VikarKodeOpretInput = z.infer<typeof VikarKodeOpretInput>;

export const VikarKodeOpdaterInput = z.strictObject({
  navn: z.string().trim().min(2).optional().nullable(),
  fast_vikar: z.boolean().optional(),
});
export type VikarKodeOpdaterInput = z.infer<typeof VikarKodeOpdaterInput>;

export const VikarKodeOpretSvar = z.object({
  id: Uuid,
  kode: z.string(),
  udloebsdato: Tidspunkt,
  navn: z.string().optional().nullable(),
  fast_vikar: z.boolean().optional(),
});
export type VikarKodeOpretSvar = z.infer<typeof VikarKodeOpretSvar>;

export const VikarAktivKandidat = z.object({
  id: Uuid,
  navn: z.string(),
  fast_vikar: z.boolean(),
});
export type VikarAktivKandidat = z.infer<typeof VikarAktivKandidat>;

export const CheatSheetKort = z.object({
  plads_id: Uuid,
  rytter_navn_kort: z.string(),
  hest_navn: z.string().nullable(),
  cheat_sheet_koder: z.array(z.string()),
  adfaerdsinstruks: z.string().nullable(),
});
export type CheatSheetKort = z.infer<typeof CheatSheetKort>;

