import { z } from 'zod';
import { AktivStatus, Dato, Erfaringsniveau, Niveau, Sundhedsstatus, Temperament, Uuid } from './faelles';

const Heltal = z.number().int();
const Ugedag = Heltal.min(1).max(7);

// ---------------------------------------------------------------- Heste (FR-001, F1.3)

export const Hest = z.object({
  id: Uuid,
  navn: z.string(),
  stangmaal_cm: Heltal,
  max_rytter_vaegt_kg: Heltal,
  max_rytter_hoejde_cm: Heltal.nullable(),
  temperament: Temperament,
  godkendt_til_begyndere: z.boolean(),
  egnet_oevet: z.boolean(),
  skaane: z.boolean(),
  max_lektioner_dag: z.union([z.literal(2), z.literal(3)]),
  springforbud: z.boolean(),
  max_spring_uge: z.union([z.literal(0), z.literal(1)]),
  hviledag: Ugedag,
  sundhedsstatus: Sundhedsstatus,
  staldnoter: z.string(),
  aktiv: z.boolean(),
});
export type Hest = z.infer<typeof Hest>;

/** max_lektioner_dag og max_spring_uge afledes af serveren og kan ikke sendes ind. */
export const HestInput = z.strictObject({
  navn: z.string().trim().min(1, 'Navn skal udfyldes'),
  stangmaal_cm: Heltal.min(80, 'Stangmål skal være mindst 80 cm').max(190, 'Stangmål må højst være 190 cm'),
  max_rytter_vaegt_kg: Heltal.positive(),
  max_rytter_hoejde_cm: Heltal.positive().nullable(),
  temperament: Temperament,
  godkendt_til_begyndere: z.boolean(),
  egnet_oevet: z.boolean(),
  skaane: z.boolean(),
  springforbud: z.boolean(),
  hviledag: Ugedag,
  staldnoter: z.string().max(500, 'Staldnoter må højst være 500 tegn').default(''),
});
export type HestInput = z.infer<typeof HestInput>;

/** Delvis opdatering. Uden defaults, så felter, der ikke sendes, ikke nulstilles (Zod 4 anvender defaults i partial). */
export const HestOpdatering = HestInput.extend({
  staldnoter: z.string().max(500, 'Staldnoter må højst være 500 tegn'),
}).partial();
export type HestOpdatering = z.infer<typeof HestOpdatering>;

// ---------------------------------------------------------------- Hold

export const Hold = z.object({
  id: Uuid,
  holdnavn: z.string(),
  niveau: Niveau,
  er_springhold: z.boolean(),
  ugedag: Ugedag,
  starttid: z.string().regex(/^[0-2][0-9]:[0-5][0-9]$/),
  varighed_min: Heltal,
  max_kapacitet: Heltal.min(1).max(10),
  fast_underviser_id: Uuid,
  antal_tilmeldte: Heltal.optional(),
});
export type Hold = z.infer<typeof Hold>;

// ---------------------------------------------------------------- Ryttere (FR-002, kun Ledelse)

/** Admin-projektion. Må aldrig sendes til andre roller end Ledelse. */
export const Rytter = z.object({
  id: Uuid,
  fornavn: z.string(),
  efternavn: z.string(),
  foedselsdato: Dato,
  bopaelskommune: z.string(),
  hoejde_cm: Heltal,
  vaegt_kg: Heltal,
  erfaringsniveau: Erfaringsniveau,
  klar_til_udvikling: z.boolean(),
  er_hjaelper: z.boolean(),
  kontaktperson_navn: z.string(),
  kontakt_telefon: z.string(),
  kontakt_email: z.string(),
  partaftale_hest_id: Uuid.nullable(),
  partaftale_godkendt_trods_niveau: z.boolean(),
  aktiv_status: AktivStatus,
  slutdato: Dato.nullable(),
});
export type Rytter = z.infer<typeof Rytter>;

export const RytterInput = z.strictObject({
  fornavn: z.string().trim().min(1, 'Fornavn skal udfyldes'),
  efternavn: z.string().trim().min(1, 'Efternavn skal udfyldes'),
  foedselsdato: Dato,
  bopaelskommune: z.string().trim().min(1, 'Bopælskommune skal udfyldes'),
  hoejde_cm: Heltal.min(80).max(210),
  vaegt_kg: Heltal.min(15).max(150),
  erfaringsniveau: Erfaringsniveau,
  klar_til_udvikling: z.boolean().default(false),
  er_hjaelper: z.boolean().default(false),
  kontaktperson_navn: z.string().trim().min(1, 'Kontaktperson skal udfyldes'),
  kontakt_telefon: z.string().trim().min(1, 'Telefon skal udfyldes'),
  kontakt_email: z.email('Ugyldig e-mail'),
  partaftale_hest_id: Uuid.nullable().default(null),
  partaftale_godkendt_trods_niveau: z.boolean().default(false),
});
export type RytterInput = z.infer<typeof RytterInput>;

/** Delvis opdatering uden defaults (se HestOpdatering). */
export const RytterOpdatering = RytterInput.extend({
  klar_til_udvikling: z.boolean(),
  er_hjaelper: z.boolean(),
  partaftale_hest_id: Uuid.nullable(),
  partaftale_godkendt_trods_niveau: z.boolean(),
}).partial();
export type RytterOpdatering = z.infer<typeof RytterOpdatering>;

// ---------------------------------------------------------------- Sikkerhedsprofil (GDPR art. 9, kun Ledelse)

/**
 * Fuld art. 9-profil i Fase 1. cheat_sheet_koder og adfaerdsinstruks tilføjes i Fase 2 (US3, FR-012).
 * faldtraume_note, angstkategori og intern_note er krypteret i databasen.
 */
export const Sikkerhedsprofil = z.object({
  rytter_id: Uuid,
  faldtraume_note: z.string().max(2000).nullable(),
  angstkategori: z.string().max(200).nullable(),
  intern_note: z.string().max(2000).nullable(),
  forbudte_heste: z.array(Uuid),
  paakraevede_heste: z.array(Uuid),
  kun_rolige_heste: z.boolean(),
});
export type Sikkerhedsprofil = z.infer<typeof Sikkerhedsprofil>;

/** rytter_id kommer fra stien og må gerne udelades i body. */
export const SikkerhedsprofilInput = z.strictObject({
  rytter_id: Uuid.optional(),
  faldtraume_note: z.string().max(2000).nullable().default(null),
  angstkategori: z.string().max(200).nullable().default(null),
  intern_note: z.string().max(2000).nullable().default(null),
  forbudte_heste: z.array(Uuid).default([]),
  paakraevede_heste: z.array(Uuid).default([]),
  kun_rolige_heste: z.boolean().default(false),
});
export type SikkerhedsprofilInput = z.infer<typeof SikkerhedsprofilInput>;
