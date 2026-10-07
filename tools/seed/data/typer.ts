import type { HestData, HoldData, Oenske, RytterRegelData, Tilmelding } from '@ridecenter/domain';

// Seedtyper: domænets typer (camelCase) + de administrative felter, som kun databasen kender.

export interface SeedBruger {
  id: string;
  navn: string;
  roller: ('Ledelse' | 'Ridelaerer' | 'Vikar' | 'Staldelev')[];
  /** Kun brugere med e-mail får web-login (adgangskode = SEED_ADGANGSKODE). */
  email: string | null;
  pin?: string;
}

export interface SeedHest extends HestData {
  staldnoter: string;
}

export interface SeedRytter extends RytterRegelData {
  fornavn: string;
  efternavn: string;
  /** 'YYYY-MM-DD'. */
  foedselsdato: string;
  bopaelskommune: string;
  kontaktpersonNavn: string;
  kontaktTelefon: string;
  kontaktEmail: string;
  aktivStatus: 'Aktiv' | 'Pauseret' | 'Opsagt';
  /** 🔒 Art. 9-noter. Krypteres ved skrivning til databasen. */
  faldtraumeNote: string | null;
  angstkategori: string | null;
  internNote: string | null;
}

export interface SeedHold extends HoldData {
  fastUnderviserId: string;
}

export interface SeedTilmelding extends Tilmelding {
  /** 'YYYY-MM-DD'. */
  gyldigFra: string;
}

export interface SeedOenske extends Oenske {
  maaned: string;
}

/** Udfaldet i måneden før seed-måneden. Kilden til turnus (SC-02). */
export interface SeedHistoriskTildeling {
  rytterId: string;
  holdId: string;
  maaned: string;
  hestId: string;
  oenskeOpfyldt: 1 | 2 | 3 | null;
  erAlternativ: boolean;
  turnusNaesteMaaned: number;
}

export interface Seeddata {
  /** Måneden, kabalen skal køres for ('YYYY-MM'). */
  maaned: string;
  brugere: SeedBruger[];
  heste: SeedHest[];
  ryttere: SeedRytter[];
  hold: SeedHold[];
  tilmeldinger: SeedTilmelding[];
  oensker: SeedOenske[];
  historik: SeedHistoriskTildeling[];
}
