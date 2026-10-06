import type { HestInput, RytterInput, Tildelingskoersel } from '@ridecenter/contracts';
import type { Klient } from './klient';

// Fælles testdata til API-testene. Id'erne er de stabile seed-id'er (UUID v5), så de matcher databasen.
export { brugerId, FREDAGSHOLD, holdId } from '../../../../tools/seed/data/brugere-og-hold';
export { rytterId } from '../../../../tools/seed/data/fredag-ryttere';
export { hestId } from '../../../../tools/seed/data/heste';

export const MAANED = '2026-07';
/** "Nu" i testene: før juli, så publicering opretter lektioner for alle fredage i måneden. */
export const UR_JUNI = () => new Date('2026-06-15T10:00:00.000Z');
/** Gyldigt UUID, der ikke findes i databasen. */
export const UKENDT_ID = '00000000-0000-4000-8000-000000000000';

export function gyldigHest(overskriv: Partial<HestInput> = {}): HestInput {
  return {
    navn: 'Testhest',
    stangmaal_cm: 145,
    max_rytter_vaegt_kg: 65,
    max_rytter_hoejde_cm: 160,
    temperament: 'Normal',
    godkendt_til_begyndere: false,
    egnet_oevet: true,
    skaane: false,
    springforbud: false,
    hviledag: 1,
    staldnoter: '',
    ...overskriv,
  };
}

export function gyldigRytter(overskriv: Partial<RytterInput> = {}): RytterInput {
  return {
    fornavn: 'Test',
    efternavn: 'Rytter',
    foedselsdato: '2015-09-01',
    bopaelskommune: 'Strandby',
    hoejde_cm: 140,
    vaegt_kg: 35,
    erfaringsniveau: 'Letoevet',
    klar_til_udvikling: false,
    er_hjaelper: false,
    kontaktperson_navn: 'Forælder til Test',
    kontakt_telefon: '+45 20 00 00 99',
    kontakt_email: 'foraelder.test@example.dk',
    partaftale_hest_id: null,
    partaftale_godkendt_trods_niveau: false,
    ...overskriv,
  };
}

/** Kører kabalen og henter kørslen med tildelinger. */
export async function koerKabale(klient: Klient, maaned = MAANED): Promise<Tildelingskoersel> {
  const start = await klient.post<Tildelingskoersel>('/tildeling/koersler', { maaned });
  if (start.status !== 201) throw new Error(`Kørslen fejlede: ${start.status} ${JSON.stringify(start.body)}`);
  return hentKoersel(klient, start.body.id);
}

export async function hentKoersel(klient: Klient, id: string): Promise<Tildelingskoersel> {
  const svar = await klient.get<Tildelingskoersel>(`/tildeling/koersler/${id}`);
  if (svar.status !== 200) throw new Error(`Kunne ikke hente kørsel ${id}: ${svar.status}`);
  return svar.body;
}

/** Tildelingen for en rytter i en kørsel (fredagsrytterne har ét hold hver). */
export function tildelingFor(koersel: Tildelingskoersel, rytter: string) {
  const tildeling = koersel.tildelinger?.find((t) => t.rytter_id === rytter);
  if (!tildeling) throw new Error(`Ingen tildeling for rytter ${rytter}`);
  return tildeling;
}
