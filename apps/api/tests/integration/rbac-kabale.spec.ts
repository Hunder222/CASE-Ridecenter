import type { KandidatHest, Tildelingskoersel } from '@ridecenter/contracts';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { lavApp, logInd, type TestApp } from '../helpers/app';
import { prisma, seedFredag } from '../helpers/db';
import { Klient, type Metode, type Svar } from '../helpers/klient';
import {
  brugerId,
  FREDAGSHOLD,
  gyldigHest,
  gyldigRytter,
  hestId,
  holdId,
  koerKabale,
  MAANED,
  rytterId,
  tildelingFor,
  UKENDT_ID,
  UR_JUNI,
} from '../helpers/testdata';

// RBAC pr. endpoint (x-roller i openapi.yaml) og pr. felt (V9-princippet): en ridelærer ser aldrig
// rytternes fysiske data, kontaktoplysninger eller sikkerhedsprofil.

const FOELSOMME_NOEGLER = new Set([
  'vaegt_kg',
  'hoejde_cm',
  'foedselsdato',
  'kontakt_telefon',
  'kontakt_email',
  'kontaktperson_navn',
  'faldtraume_note',
  'angstkategori',
  'intern_note',
  'forbudte_heste',
  'paakraevede_heste',
  'kun_rolige_heste',
]);

/** Stierne til alle følsomme nøgler i et JSON-svar, uanset dybde. */
function foelsommeNoegler(vaerdi: unknown, sti = '$'): string[] {
  if (Array.isArray(vaerdi)) return vaerdi.flatMap((v, i) => foelsommeNoegler(v, `${sti}[${i}]`));
  if (vaerdi === null || typeof vaerdi !== 'object') return [];
  return Object.entries(vaerdi).flatMap(([noegle, v]) => [
    ...(FOELSOMME_NOEGLER.has(noegle) ? [`${sti}.${noegle}`] : []),
    ...foelsommeNoegler(v, `${sti}.${noegle}`),
  ]);
}

const emma = rytterId('Emma Grønby');
const camillasHold = holdId(FREDAGSHOLD.oevet);

/** Alle Fase 1-endpoints med gyldige payloads, så kun adgangskontrollen kan afvise dem. */
const ALLE_ENDPOINTS: [Metode, string, unknown?][] = [
  ['GET', '/auth/session'],
  ['GET', '/heste'],
  ['POST', '/heste', gyldigHest({ navn: 'Uden session' })],
  ['PATCH', `/heste/${hestId('Zigge')}`, { godkendt_til_begyndere: true }],
  ['GET', '/ryttere'],
  ['POST', '/ryttere', gyldigRytter()],
  ['PATCH', `/ryttere/${emma}`, { klar_til_udvikling: true }],
  ['GET', `/ryttere/${emma}/sikkerhedsprofil`],
  ['PUT', `/ryttere/${emma}/sikkerhedsprofil`, { kun_rolige_heste: true }],
  ['GET', '/hold'],
  ['GET', `/oensker/${MAANED}`],
  ['PUT', `/oensker/${MAANED}`, { rytter_id: emma, oensker: [hestId('Zigge')] }],
  ['GET', `/tildeling/koersler?maaned=${MAANED}`],
  ['POST', '/tildeling/koersler', { maaned: MAANED }],
  ['GET', `/tildeling/koersler/${UKENDT_ID}`],
  ['PATCH', `/tildeling/koersler/${UKENDT_ID}/tildelinger/${UKENDT_ID}`, { hest_id: hestId('Zigge') }],
  ['GET', `/tildeling/koersler/${UKENDT_ID}/tildelinger/${UKENDT_ID}/kandidater`],
  ['POST', `/tildeling/koersler/${UKENDT_ID}/godkend`],
  ['POST', `/tildeling/koersler/${UKENDT_ID}/publicer`],
  ['GET', '/notifikationer'],
  ['POST', `/notifikationer/${UKENDT_ID}/kvitter`],
];

/** x-roller: [Ledelse]. */
const KUN_LEDELSE: [Metode, string, unknown?][] = [
  ['GET', '/ryttere'],
  ['POST', '/ryttere', gyldigRytter()],
  ['PATCH', `/ryttere/${emma}`, { klar_til_udvikling: true }],
  ['GET', `/ryttere/${emma}/sikkerhedsprofil`],
  ['PUT', `/ryttere/${emma}/sikkerhedsprofil`, { kun_rolige_heste: true }],
  ['POST', '/heste', gyldigHest({ navn: 'Maries hest' })],
  ['PATCH', `/heste/${hestId('Zigge')}`, { godkendt_til_begyndere: true }],
  ['POST', `/tildeling/koersler/${UKENDT_ID}/publicer`],
  ['GET', '/notifikationer'],
  ['POST', `/notifikationer/${UKENDT_ID}/kvitter`],
];

let app: TestApp;
let anonym: Klient;
let marie: Klient;
let malene: Klient;
const svarTilMarie: { kald: string; svar: Svar }[] = [];

beforeAll(async () => {
  await seedFredag();
  // Øvet-holdet får Camilla som fast underviser, så Marie har både egne og andres hold.
  await prisma.hold.update({
    where: { id: camillasHold },
    data: { fast_underviser_id: brugerId('Camilla') },
  });
  app = await lavApp({ ur: UR_JUNI });
  anonym = new Klient(app, null);
  marie = new Klient(app, await logInd(app, 'marie@demo.dk'), (svar, metode, sti) => {
    svarTilMarie.push({ kald: `${metode} ${sti}`, svar });
    expect(foelsommeNoegler(svar.body), `${metode} ${sti}`).toEqual([]);
  });
  malene = new Klient(app, await logInd(app, 'malene@demo.dk'));
}, 60_000);

afterAll(async () => {
  await app?.close();
  await prisma.$disconnect();
});

describe('uden session', () => {
  it.each(ALLE_ENDPOINTS)('%s %s giver 401', async (metode, sti, payload) => {
    const svar = await anonym.kald(metode, sti, payload);
    expect(svar.status).toBe(401);
    expect(svar.body).toMatchObject({ kode: 'IKKE_LOGGET_IND' });
  });
});

describe('som Marie (Ridelærer)', () => {
  it.each(KUN_LEDELSE)('%s %s giver 403', async (metode, sti, payload) => {
    const svar = await marie.kald(metode, sti, payload);
    expect(svar.status).toBe(403);
    expect(svar.body).toMatchObject({ kode: 'INGEN_ADGANG' });
  });

  it('må læse heste og hold', async () => {
    expect((await marie.get('/heste')).status).toBe(200);
    expect((await marie.get('/hold')).status).toBe(200);
  });

  it('må læse ønsker og registrere ønsker for en rytter på sit eget hold', async () => {
    expect((await marie.get(`/oensker/${MAANED}`)).status).toBe(200);
    const svar = await marie.put(`/oensker/${MAANED}`, {
      rytter_id: emma,
      oensker: [hestId('Zigge'), hestId('Boy')],
    });
    expect(svar.status).toBe(204);
  });

  describe('kabalen', () => {
    let koersel: Tildelingskoersel;

    it('må køre tildelingen og læse kørslerne', async () => {
      const start = await marie.post<Tildelingskoersel>('/tildeling/koersler', { maaned: MAANED });
      expect(start.status).toBe(201);
      expect((await marie.get(`/tildeling/koersler?maaned=${MAANED}`)).status).toBe(200);
      const hentet = await marie.get<Tildelingskoersel>(`/tildeling/koersler/${start.body.id}`);
      expect(hentet.status).toBe(200);
      koersel = hentet.body;
    });

    it('får 403 ved justering af en tildeling på Camillas hold', async () => {
      const paaCamillasHold = koersel.tildelinger?.find((t) => t.hold_id === camillasHold);
      if (!paaCamillasHold) throw new Error('Ingen tildeling på Camillas hold');
      const svar = await marie.patch(`/tildeling/koersler/${koersel.id}/tildelinger/${paaCamillasHold.id}`, {
        hest_id: paaCamillasHold.hest_id ?? hestId('Aslan'),
      });
      expect(svar.status).toBe(403);
      expect(svar.body).toMatchObject({ kode: 'INGEN_ADGANG' });
    });

    it('må justere en tildeling på sit eget hold til en lovlig hest', async () => {
      const emmas = tildelingFor(koersel, emma);
      const sti = `/tildeling/koersler/${koersel.id}/tildelinger/${emmas.id}`;
      const kandidater = await marie.get<KandidatHest[]>(`${sti}/kandidater`);
      expect(kandidater.status).toBe(200);
      const lovlig =
        kandidater.body.find((k) => k.lovlig && k.hest_id !== emmas.hest_id) ??
        kandidater.body.find((k) => k.lovlig);
      if (!lovlig) throw new Error('Ingen lovlig hest til Emma');
      expect((await marie.patch(sti, { hest_id: lovlig.hest_id })).status).toBe(200);
    });

    it('må godkende, men ikke publicere', async () => {
      expect((await marie.post(`/tildeling/koersler/${koersel.id}/godkend`)).status).toBe(200);
      const publicer = await marie.post(`/tildeling/koersler/${koersel.id}/publicer`);
      expect(publicer.status).toBe(403);
      expect(publicer.body).toMatchObject({ kode: 'INGEN_ADGANG' });
    });
  });

  it('har aldrig fået følsomme felter i et svar (V9)', () => {
    expect(svarTilMarie.length).toBeGreaterThanOrEqual(KUN_LEDELSE.length + 10);
    for (const { kald, svar } of svarTilMarie) expect(foelsommeNoegler(svar.body), kald).toEqual([]);
  });
});

describe('som Malene (Ledelse)', () => {
  it.each([
    '/auth/session',
    '/heste',
    '/hold',
    '/ryttere',
    `/ryttere/${emma}/sikkerhedsprofil`,
    `/oensker/${MAANED}`,
    `/tildeling/koersler?maaned=${MAANED}`,
    '/notifikationer',
  ])('må læse %s', async (sti) => {
    expect((await malene.get(sti)).status).toBe(200);
  });

  it('må justere på alle hold, godkende og publicere', async () => {
    const koersel = await koerKabale(malene);
    const paaCamillasHold = koersel.tildelinger?.find(
      (t) => t.hold_id === camillasHold && t.hest_id !== null,
    );
    if (!paaCamillasHold) throw new Error('Ingen tildeling på Camillas hold');
    const sti = `/tildeling/koersler/${koersel.id}/tildelinger/${paaCamillasHold.id}`;
    const kandidater = await malene.get<KandidatHest[]>(`${sti}/kandidater`);
    const lovlig = kandidater.body.find((k) => k.lovlig);
    if (!lovlig) throw new Error('Ingen lovlig hest');

    expect((await malene.patch(sti, { hest_id: lovlig.hest_id })).status).toBe(200);
    expect((await malene.post(`/tildeling/koersler/${koersel.id}/godkend`)).status).toBe(200);
    expect((await malene.post(`/tildeling/koersler/${koersel.id}/publicer`)).status).toBe(200);
  });
});
