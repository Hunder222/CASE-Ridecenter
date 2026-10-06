import type {
  Fejl,
  Hestetildeling,
  KandidatHest,
  PubliceringSvar,
  Tildelingskoersel,
} from '@ridecenter/contracts';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { lavApp, logInd, type TestApp } from '../helpers/app';
import { prisma, seedFredag } from '../helpers/db';
import { Klient } from '../helpers/klient';
import {
  brugerId,
  FREDAGSHOLD,
  hentKoersel,
  hestId,
  holdId,
  koerKabale,
  MAANED,
  rytterId,
  tildelingFor,
  UR_JUNI,
} from '../helpers/testdata';

// Kabalen gennem API'et (US2, FR-006 – FR-010, SC-002 – SC-004): kør → justér under live
// Welfare Guard → godkend → publicér. Appen bygges med uret sat til 15. juni 2026.

const FREDAGE_I_JULI = ['2026-07-03', '2026-07-10', '2026-07-17', '2026-07-24', '2026-07-31'];
const ANTAL_TILMELDINGER = 34;
const emma = rytterId('Emma Grønby');

let app: TestApp;
let malene: Klient;

beforeAll(async () => {
  await seedFredag();
  app = await lavApp({ ur: UR_JUNI });
  malene = new Klient(app, await logInd(app, 'malene@demo.dk'));
}, 60_000);

afterAll(async () => {
  await app?.close();
  await prisma.$disconnect();
});

const basiskoder = (koder: readonly string[] = []) => koder.map((kode) => kode.split(':')[0]);
const tildelingssti = (koersel: Tildelingskoersel, tildeling: Hestetildeling) =>
  `/tildeling/koersler/${koersel.id}/tildelinger/${tildeling.id}`;

/** Det, der skal være ens ved to kørsler på uændrede data. */
function sammenlignelig(koersel: Tildelingskoersel) {
  return (koersel.tildelinger ?? [])
    .map((t) => ({
      rytter_id: t.rytter_id,
      hold_id: t.hold_id,
      hest_id: t.hest_id,
      oenske_opfyldt: t.oenske_opfyldt,
      er_alternativ_tildeling: t.er_alternativ_tildeling,
      turnus_naeste_maaned: t.turnus_naeste_maaned,
      begrundelse_koder: t.begrundelse_koder,
      begrundelse_tekst: t.begrundelse_tekst,
    }))
    .sort((a, b) => `${a.rytter_id}|${a.hold_id}`.localeCompare(`${b.rytter_id}|${b.hold_id}`));
}

describe('POST /tildeling/koersler (SC-002 – SC-004)', () => {
  let koersel: Tildelingskoersel;

  it('svarer 201 med en kladde uden Welfare Guard-overtrædelser på under 30 sek.', async () => {
    const svar = await malene.post<Tildelingskoersel>('/tildeling/koersler', { maaned: MAANED });
    expect(svar.status).toBe(201);
    expect(svar.body).toMatchObject({
      maaned: MAANED,
      status: 'Kladde',
      solver_version: 'mrv-greedy@1',
      welfare_guard_overtraedelser: [],
    });
    expect(svar.body.input_hash).toMatch(/^[0-9a-f]{64}$/);
    expect(Number.isInteger(svar.body.varighed_ms)).toBe(true);
    expect(svar.body.varighed_ms).toBeLessThan(30_000);
    koersel = await hentKoersel(malene, svar.body.id);
  });

  it('giver én tildeling pr. tilmelding med årsagskoder og en dansk begrundelse', () => {
    const tildelinger = koersel.tildelinger ?? [];
    expect(tildelinger).toHaveLength(ANTAL_TILMELDINGER);
    for (const t of tildelinger) {
      expect(t.rytter_navn.trim()).not.toBe('');
      expect(t.begrundelse_koder.length, t.rytter_navn).toBeGreaterThan(0);
      expect(t.begrundelse_tekst.trim(), t.rytter_navn).not.toBe('');
    }
  });

  it('har en statistik, der stemmer med tildelingerne', () => {
    const tildelinger = koersel.tildelinger ?? [];
    expect(koersel.statistik).toEqual({
      oenske_1: tildelinger.filter((t) => t.oenske_opfyldt === 1).length,
      oenske_2: tildelinger.filter((t) => t.oenske_opfyldt === 2).length,
      oenske_3: tildelinger.filter((t) => t.oenske_opfyldt === 3).length,
      alternativ: tildelinger.filter((t) => t.er_alternativ_tildeling).length,
      ikke_tildelt: tildelinger.filter((t) => t.hest_id === null).length,
    });
  });

  it('giver samme input_hash og samme tildelinger på uændrede data', async () => {
    const igen = await koerKabale(malene);
    expect(igen.id).not.toBe(koersel.id);
    expect(igen.input_hash).toBe(koersel.input_hash);
    expect(sammenlignelig(igen)).toEqual(sammenlignelig(koersel));
  });

  it('bruger turnus fra den publicerede kørsel i juni: Sophia Kronborg har turnus_score 1', () => {
    expect(tildelingFor(koersel, rytterId('Sophia Kronborg')).turnus_score).toBe(1);
  });

  it('opretter KAPACITETSMANGEL for begynderholdet og PARTAFTALE_MANGLER_NIVEAUGODKENDELSE for Lærke Hansen uden dubletter', async () => {
    const kapacitetsnoegle = `KAPACITETSMANGEL:${MAANED}:${holdId(FREDAGSHOLD.begynder)}`;
    const kapacitet = await prisma.dashboardNotifikation.findMany({
      where: { type: 'KAPACITETSMANGEL', dedupe_noegle: kapacitetsnoegle },
    });
    expect(kapacitet).toHaveLength(1);

    const partaftale = await prisma.dashboardNotifikation.findMany({
      where: { type: 'PARTAFTALE_MANGLER_NIVEAUGODKENDELSE' },
    });
    expect(partaftale.filter((n) => n.dedupe_noegle?.includes(rytterId('Lærke Hansen')))).toHaveLength(1);

    const antalFoer = await prisma.dashboardNotifikation.count();
    await koerKabale(malene);
    expect(await prisma.dashboardNotifikation.count()).toBe(antalFoer);
  });
});

describe('manuel justering under live Welfare Guard (Princip I: ingen override)', () => {
  let koersel: Tildelingskoersel;

  beforeAll(async () => {
    koersel = await koerKabale(malene);
  });

  it('kandidater viser alle aktive heste og markerer Pixie som ulovlig for Emma Grønby med begrundelse', async () => {
    const svar = await malene.get<KandidatHest[]>(
      `${tildelingssti(koersel, tildelingFor(koersel, emma))}/kandidater`,
    );
    expect(svar.status).toBe(200);
    expect(svar.body).toHaveLength(20);
    const pixie = svar.body.find((k) => k.hest_id === hestId('Pixie'));
    expect(pixie).toMatchObject({ navn: 'Pixie', lovlig: false });
    expect(basiskoder(pixie?.koder)).toContain('HC07_FORBUDT_HEST');
    expect(pixie?.begrundelse_tekst).toContain('af hensyn til rytterens sikkerhed (HC-07)');
    expect(svar.body.some((k) => k.lovlig)).toBe(true);
  });

  it('PATCH til Pixie afvises med 422 WELFARE_GUARD_AFVIST, og tildelingen er uændret', async () => {
    const foer = tildelingFor(koersel, emma);
    const svar = await malene.patch<Fejl>(tildelingssti(koersel, foer), { hest_id: hestId('Pixie') });
    expect(svar.status).toBe(422);
    expect(svar.body).toMatchObject({ kode: 'WELFARE_GUARD_AFVIST' });
    expect(basiskoder(svar.body.detaljer)).toContain('HC07_FORBUDT_HEST');
    expect(tildelingFor(await hentKoersel(malene, koersel.id), emma)).toEqual(foer);
  });

  it('PATCH med et override-felt afvises (422), og tildelingen er uændret', async () => {
    const foer = tildelingFor(koersel, emma);
    const svar = await malene.patch(tildelingssti(koersel, foer), {
      hest_id: hestId('Pixie'),
      override: true,
    });
    expect(svar.status).toBe(422);
    expect(tildelingFor(await hentKoersel(malene, koersel.id), emma)).toEqual(foer);
  });

  it('en lovlig PATCH gemmes som manuelt justeret og logges (TILDELING_JUSTERET)', async () => {
    const foer = tildelingFor(koersel, emma);
    const sti = tildelingssti(koersel, foer);
    const kandidater = await malene.get<KandidatHest[]>(`${sti}/kandidater`);
    const lovlig = kandidater.body.find((k) => k.lovlig && k.hest_id !== foer.hest_id);
    if (!lovlig) throw new Error('Ingen anden lovlig hest til Emma');
    const justeringer = { where: { handling: 'TILDELING_JUSTERET' } };
    const antalFoer = await prisma.auditHaendelse.count(justeringer);

    const svar = await malene.patch<Hestetildeling>(sti, { hest_id: lovlig.hest_id });
    expect(svar.status).toBe(200);
    expect(svar.body).toMatchObject({
      id: foer.id,
      rytter_id: emma,
      hest_id: lovlig.hest_id,
      manuelt_justeret: true,
    });
    expect(svar.body.begrundelse_tekst.trim()).not.toBe('');
    expect(tildelingFor(await hentKoersel(malene, koersel.id), emma)).toMatchObject({
      hest_id: lovlig.hest_id,
      manuelt_justeret: true,
    });
    expect(await prisma.auditHaendelse.count(justeringer)).toBe(antalFoer + 1);
  });
});

describe('godkend og publicér (data-model.md §5)', () => {
  let koersel: Tildelingskoersel;

  beforeAll(async () => {
    koersel = await koerKabale(malene);
  });

  it('publicer før godkend giver 409 IKKE_GODKENDT', async () => {
    const svar = await malene.post(`/tildeling/koersler/${koersel.id}/publicer`);
    expect(svar.status).toBe(409);
    expect(svar.body).toMatchObject({ kode: 'IKKE_GODKENDT' });
  });

  it('godkend sætter status Godkendt, og derefter kan tildelinger ikke ændres (409 KOERSEL_IKKE_KLADDE)', async () => {
    const svar = await malene.post<Tildelingskoersel>(`/tildeling/koersler/${koersel.id}/godkend`);
    expect(svar.status).toBe(200);
    expect(svar.body.status).toBe('Godkendt');

    const tildeling = tildelingFor(koersel, emma);
    const patch = await malene.patch(tildelingssti(koersel, tildeling), {
      hest_id: tildeling.hest_id ?? hestId('Aslan'),
    });
    expect(patch.status).toBe(409);
    expect(patch.body).toMatchObject({ kode: 'KOERSEL_IKKE_KLADDE' });
  });

  it('publicer opretter én lektion pr. fredag pr. hold og én plads pr. tilmelding med planlagt = aktuel hest', async () => {
    const svar = await malene.post<PubliceringSvar>(`/tildeling/koersler/${koersel.id}/publicer`);
    expect(svar.status).toBe(200);
    expect(svar.body).toEqual({ status: 'Publiceret', antal_lektioner: 20, erstattet_koersel_id: null });

    const lektioner = await prisma.lektion.findMany({ include: { pladser: true } });
    expect(lektioner).toHaveLength(FREDAGE_I_JULI.length * 4);
    for (const holdnavn of Object.values(FREDAGSHOLD)) {
      const datoer = lektioner
        .filter((l) => l.hold_id === holdId(holdnavn))
        .map((l) => l.dato.toISOString().slice(0, 10))
        .sort();
      expect(datoer, holdnavn).toEqual(FREDAGE_I_JULI);
    }
    expect(lektioner.every((l) => l.status === 'Planlagt' && l.underviser_id === brugerId('Marie'))).toBe(
      true,
    );

    const hestPrRytter = new Map((koersel.tildelinger ?? []).map((t) => [t.rytter_id, t.hest_id]));
    const pladser = lektioner.flatMap((l) => l.pladser);
    expect(pladser).toHaveLength(ANTAL_TILMELDINGER * FREDAGE_I_JULI.length);
    for (const plads of pladser) {
      expect(plads.kilde).toBe('Plan');
      expect(plads.aktuel_hest_id).toBe(plads.planlagt_hest_id);
      expect(plads.planlagt_hest_id).toBe(hestPrRytter.get(plads.rytter_id) ?? null);
    }

    const audit = await prisma.auditHaendelse.findFirst({
      where: { handling: 'TILDELING_PUBLICERET' },
      orderBy: { server_seq: 'desc' },
    });
    expect(audit?.efter).toMatchObject({ koersel_id: koersel.id, maaned: MAANED, antal_lektioner: 20 });
  });

  it('en publiceret kørsel kan hverken justeres eller godkendes igen (409)', async () => {
    const tildeling = tildelingFor(koersel, emma);
    const patch = await malene.patch(tildelingssti(koersel, tildeling), {
      hest_id: tildeling.hest_id ?? hestId('Aslan'),
    });
    expect(patch.status).toBe(409);
    expect(patch.body).toMatchObject({ kode: 'KOERSEL_IKKE_KLADDE' });
    expect((await malene.post(`/tildeling/koersler/${koersel.id}/godkend`)).status).toBe(409);
  });

  it('en ny publicering for samme måned forkaster den gamle, så der kun er én publiceret kørsel', async () => {
    const ny = await koerKabale(malene);
    expect((await malene.post(`/tildeling/koersler/${ny.id}/godkend`)).status).toBe(200);
    const svar = await malene.post<PubliceringSvar>(`/tildeling/koersler/${ny.id}/publicer`);
    expect(svar.status).toBe(200);
    expect(svar.body).toEqual({
      status: 'Publiceret',
      antal_lektioner: 20,
      erstattet_koersel_id: koersel.id,
    });

    expect((await hentKoersel(malene, koersel.id)).status).toBe('Forkastet');
    expect(await prisma.tildelingskoersel.count({ where: { maaned: MAANED, status: 'Publiceret' } })).toBe(1);
    // Lektionerne opdateres (upsert), de dubleres ikke.
    expect(await prisma.lektion.count()).toBe(FREDAGE_I_JULI.length * 4);
    expect(await prisma.lektionsPlads.count()).toBe(ANTAL_TILMELDINGER * FREDAGE_I_JULI.length);
  });
});
