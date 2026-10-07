import { z } from 'zod';
import { Tidspunkt, Uuid } from './faelles';
import { FremmoedeStatus } from './stald';

// Offline-sync-kontrakt (contracts/sync-protocol.md §2–§6).

export const KommandoType = z.enum([
  'RegistrerFremmoede',
  'KorrigerFremmoede',
  'RegistrerAfbud',
  'MeldHestStatus',
  'GodkendOmplacering',
  'RegistrerOensker',
  'VikarLogin',
]);
export type KommandoType = z.infer<typeof KommandoType>;

// ------------------------------------------------------------ Payloads pr. kommandotype (§3)

export const RegistrerFremmoedePayload = z.object({
  lektion_id: Uuid,
  registreringer: z
    .array(z.object({ lektionsplads_id: Uuid, status: z.enum(['Fremmoedt', 'Udeblevet']) }))
    .min(1),
});
export type RegistrerFremmoedePayload = z.infer<typeof RegistrerFremmoedePayload>;

export const KorrigerFremmoedePayload = z.object({
  fremmoederegistrering_id: Uuid,
  ny_status: FremmoedeStatus,
  begrundelse: z.string().trim().min(5, 'Begrundelsen skal være mindst 5 tegn'),
});
export type KorrigerFremmoedePayload = z.infer<typeof KorrigerFremmoedePayload>;

export const RegistrerAfbudPayload = z.object({
  lektionsplads_id: Uuid,
  modtaget_tidspunkt: Tidspunkt.optional(),
});
export type RegistrerAfbudPayload = z.infer<typeof RegistrerAfbudPayload>;

export const MeldHestStatusPayload = z.object({
  hest_id: Uuid,
  type: z.enum(['Helbred', 'Adfaerd']),
  alvorlighed: z.enum(['Info', 'Obs', 'KanIkkeBruges']),
  beskrivelse: z.string().max(500, 'Beskrivelsen må højst være 500 tegn'),
});
export type MeldHestStatusPayload = z.infer<typeof MeldHestStatusPayload>;

export const GodkendOmplaceringPayload = z.object({
  lektionsplads_id: Uuid,
  til_hest_id: Uuid,
  aarsag: z.enum(['HestSyg', 'HestSkadet', 'Adfaerd', 'Andet']),
  forslag_snapshot: z.unknown(),
});
export type GodkendOmplaceringPayload = z.infer<typeof GodkendOmplaceringPayload>;

export const RegistrerOenskerPayload = z.object({
  rytter_id: Uuid,
  maaned: z.string().regex(/^[0-9]{4}-(0[1-9]|1[0-2])$/),
  hest_ids: z.array(Uuid).min(1).max(3),
});
export type RegistrerOenskerPayload = z.infer<typeof RegistrerOenskerPayload>;

export const VikarLoginPayload = z.object({
  vikarkode_id: Uuid,
  fulde_navn: z.string().trim().min(3),
});
export type VikarLoginPayload = z.infer<typeof VikarLoginPayload>;

// ------------------------------------------------------------ Kuvert (§2)

export const KommandoKuvert = z.object({
  /** Klientgenereret UUID v7 (idempotensnøgle). */
  kommando_id: Uuid,
  type: KommandoType,
  klient_tidspunkt: Tidspunkt,
  bruger_id: Uuid.nullable(),
  session_id: z.string().optional(),
  payload: z.unknown(),
});
export type KommandoKuvert = z.infer<typeof KommandoKuvert>;

/** Outboxen tømmes i batches på højst 500 (§8). */
export const PUSH_MAX_KOMMANDOER = 500;

export const PushAnmodning = z.object({
  kommandoer: z.array(KommandoKuvert).max(PUSH_MAX_KOMMANDOER),
});
export type PushAnmodning = z.infer<typeof PushAnmodning>;

// ------------------------------------------------------------ Svar (§4, §6)

export const KommandoResultatStatus = z.enum(['Anvendt', 'AlleredeAnvendt', 'Konflikt', 'Afvist']);
export type KommandoResultatStatus = z.infer<typeof KommandoResultatStatus>;

export const KommandoResultat = z.object({
  kommando_id: Uuid,
  status: KommandoResultatStatus,
  fejl_kode: z.string().optional(),
  besked: z.string().optional(),
});
export type KommandoResultat = z.infer<typeof KommandoResultat>;

export const PushSvar = z.object({ resultater: z.array(KommandoResultat) });
export type PushSvar = z.infer<typeof PushSvar>;

export const PullSvar = z.object({
  cursor: z.string(),
  aendringer: z.object({
    lektioner: z.array(z.unknown()),
    pladser: z.array(z.unknown()),
    heste: z.array(z.unknown()),
    /** PIN-hashes (PBKDF2) til lokal oplåsning. */
    brugere: z.array(z.unknown()),
    /** Kun hashes af aktive vikarkoder. */
    vikarkoder: z.array(z.unknown()),
  }),
});
export type PullSvar = z.infer<typeof PullSvar>;

/** Sync-tilstand til synkindikatoren (§9). */
export type SynkTilstand = 'online' | 'offline' | 'synkroniserer' | 'advarsel';

/** SSE-kanaler på GET /events. */
export const SseKanal = z.enum([
  'plads.opdateret',
  'hest.status',
  'synk.advarsel',
  'lektioner.publiceret',
  'oensker.opdateret',
]);
export type SseKanal = z.infer<typeof SseKanal>;

