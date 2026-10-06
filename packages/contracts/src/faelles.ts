import { z } from 'zod';

// Fælles skemaer, der spejler components/schemas i specs/001-holdadministration-mvp/contracts/openapi.yaml.

export const Rolle = z.enum(['Ledelse', 'Ridelaerer', 'Vikar', 'Staldelev']);
export type Rolle = z.infer<typeof Rolle>;

export const Temperament = z.enum(['Rolig', 'Normal', 'Frisk']);
export type Temperament = z.infer<typeof Temperament>;

export const Sundhedsstatus = z.enum(['Aktiv', 'Sygemeldt', 'Skadet', 'Karantaene']);
export type Sundhedsstatus = z.infer<typeof Sundhedsstatus>;

export const Niveau = z.enum(['Traekhold', 'Begynder', 'Letoevet', 'Oevet', 'Parthold']);
export type Niveau = z.infer<typeof Niveau>;

export const Erfaringsniveau = z.enum(['Begynder', 'Letoevet', 'Oevet']);
export type Erfaringsniveau = z.infer<typeof Erfaringsniveau>;

export const AktivStatus = z.enum(['Aktiv', 'Pauseret', 'Opsagt']);
export type AktivStatus = z.infer<typeof AktivStatus>;

export const KoerselStatus = z.enum(['Kladde', 'Afvist', 'Godkendt', 'Publiceret', 'Forkastet']);
export type KoerselStatus = z.infer<typeof KoerselStatus>;

export const NotifikationType = z.enum([
  'VIKAR_LOGIN',
  'GENTAGET_FRAVAER',
  'SYNK_KONFLIKT',
  'KAPACITETSMANGEL',
  'HEST_UDE_AF_DRIFT',
  'GENBESAETTELSESFORSLAG',
  'PARTAFTALE_MANGLER_NIVEAUGODKENDELSE',
]);
export type NotifikationType = z.infer<typeof NotifikationType>;

export const Maaned = z.string().regex(/^[0-9]{4}-(0[1-9]|1[0-2])$/, 'Måned skal have formatet ÅÅÅÅ-MM');
export type Maaned = z.infer<typeof Maaned>;

export const Uuid = z.uuid();
export const Dato = z.iso.date();
export const Tidspunkt = z.iso.datetime();

/** Årsagskode fra domain-engine.md §4, evt. kvalificeret som KODE:<hest_id>. */
export const Aarsagskode = z.string();

export const Fejl = z.object({
  kode: z.string(),
  besked: z.string(),
  detaljer: z.array(z.string()).optional(),
});
export type Fejl = z.infer<typeof Fejl>;

export const Session = z.object({
  bruger_id: Uuid,
  navn: z.string(),
  roller: z.array(Rolle),
  udloeber: Tidspunkt,
});
export type Session = z.infer<typeof Session>;
