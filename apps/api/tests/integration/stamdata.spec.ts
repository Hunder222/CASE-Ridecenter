import type { Elevoenske, Hest, Rytter, Sikkerhedsprofil } from '@ridecenter/contracts';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { lavApp, logInd, type TestApp } from '../helpers/app';
import { prisma, seedFredag } from '../helpers/db';
import { Klient } from '../helpers/klient';
import {
  brugerId,
  FREDAGSHOLD,
  gyldigHest,
  hestId,
  holdId,
  MAANED,
  rytterId,
  UKENDT_ID,
  UR_JUNI,
} from '../helpers/testdata';

// Stamdata (F1.2, F1.3), sikkerhedsprofilen (FR-002, FR-003, GDPR art. 9) og ønsker (F1.1).

let app: TestApp;
let malene: Klient;
let marie: Klient;

beforeAll(async () => {
  await seedFredag();
  // Øvet-holdet får Camilla som fast underviser, så Marie har ryttere uden for sine hold.
  await prisma.hold.update({
    where: { id: holdId(FREDAGSHOLD.oevet) },
    data: { fast_underviser_id: brugerId('Camilla') },
  });
  app = await lavApp({ ur: UR_JUNI });
  malene = new Klient(app, await logInd(app, 'malene@demo.dk'));
  marie = new Klient(app, await logInd(app, 'marie@demo.dk'));
}, 60_000);

afterAll(async () => {
  await app?.close();
  await prisma.$disconnect();
});

function senesteAudit(handling: string, entitetId: string) {
  return prisma.auditHaendelse.findFirst({
    where: { handling, entitet_id: entitetId },
    orderBy: { server_seq: 'desc' },
  });
}

describe('heste (F1.3)', () => {
  it('POST /heste afviser et stangmål under 80 cm (422)', async () => {
    const svar = await malene.post('/heste', gyldigHest({ navn: 'Mini', stangmaal_cm: 79 }));
    expect(svar.status).toBe(422);
    expect(svar.body).toMatchObject({ kode: 'VALIDERINGSFEJL' });
  });

  it('POST /heste afleder max_lektioner_dag og max_spring_uge (skåne → 2, springforbud → 0)', async () => {
    const skaanehest = await malene.post<Hest>(
      '/heste',
      gyldigHest({ navn: 'Sally', skaane: true, springforbud: true }),
    );
    expect(skaanehest.status).toBe(201);
    expect(skaanehest.body).toMatchObject({ navn: 'Sally', max_lektioner_dag: 2, max_spring_uge: 0 });

    const normal = await malene.post<Hest>('/heste', gyldigHest({ navn: 'Nova' }));
    expect(normal.status).toBe(201);
    expect(normal.body).toMatchObject({ navn: 'Nova', max_lektioner_dag: 3, max_spring_uge: 1 });
  });

  it('POST /heste afviser de afledte felter i body (422)', async () => {
    const svar = await malene.post('/heste', { ...gyldigHest({ navn: 'Snyd' }), max_lektioner_dag: 3 });
    expect(svar.status).toBe(422);
  });

  it('POST /heste afviser et navn, der allerede findes (409)', async () => {
    const svar = await malene.post('/heste', gyldigHest({ navn: 'Toobi' }));
    expect(svar.status).toBe(409);
    expect(svar.body).toMatchObject({ kode: 'HEST_NAVN_FINDES' });
  });

  it('PATCH /heste/{Zigge} godkender til begyndere og logger HEST_AENDRET med foer og efter', async () => {
    const zigge = hestId('Zigge');
    const svar = await malene.patch<Hest>(`/heste/${zigge}`, { godkendt_til_begyndere: true });
    expect(svar.status).toBe(200);
    expect(svar.body).toMatchObject({ id: zigge, navn: 'Zigge', godkendt_til_begyndere: true });
    expect((await prisma.hest.findUniqueOrThrow({ where: { id: zigge } })).godkendt_til_begyndere).toBe(true);

    const audit = await senesteAudit('HEST_AENDRET', zigge);
    expect(audit?.bruger_id).toBe(brugerId('Malene'));
    expect(audit?.foer).toMatchObject({ godkendt_til_begyndere: false });
    expect(audit?.efter).toMatchObject({ godkendt_til_begyndere: true });
  });

  it('PATCH /heste afleder max_lektioner_dag igen, når hesten bliver skånehest', async () => {
    const svar = await malene.patch<Hest>(`/heste/${hestId('Jane')}`, { skaane: true });
    expect(svar.status).toBe(200);
    expect(svar.body).toMatchObject({ skaane: true, max_lektioner_dag: 2 });
  });

  it('PATCH /heste afviser de afledte felter (422)', async () => {
    expect((await malene.patch(`/heste/${hestId('Jane')}`, { max_spring_uge: 1 })).status).toBe(422);
  });
});

describe('ryttere (FR-002)', () => {
  it('PATCH /ryttere/{Lærke Hansen} markerer partaftalen "godkendt trods niveau" og logger RYTTER_AENDRET', async () => {
    const laerke = rytterId('Lærke Hansen');
    const svar = await malene.patch<Rytter>(`/ryttere/${laerke}`, { partaftale_godkendt_trods_niveau: true });
    expect(svar.status).toBe(200);
    expect(svar.body).toMatchObject({
      id: laerke,
      partaftale_hest_id: hestId('Aida'),
      partaftale_godkendt_trods_niveau: true,
    });

    const audit = await senesteAudit('RYTTER_AENDRET', laerke);
    expect(audit?.foer).toMatchObject({ partaftale_godkendt_trods_niveau: false });
    expect(audit?.efter).toMatchObject({ partaftale_godkendt_trods_niveau: true });
  });

  it('PATCH /ryttere afviser en partaftale med en ukendt hest (422 UKENDT_HEST)', async () => {
    const svar = await malene.patch(`/ryttere/${rytterId('Emma Grønby')}`, { partaftale_hest_id: UKENDT_ID });
    expect(svar.status).toBe(422);
    expect(svar.body).toMatchObject({ kode: 'UKENDT_HEST' });
  });
});

describe('sikkerhedsprofil (FR-003, GDPR art. 9)', () => {
  const emma = rytterId('Emma Grønby');
  const profil = {
    faldtraume_note: 'Faldt af i ridehuset (testtekst)',
    angstkategori: 'Usikker i galop (testtekst)',
    intern_note: 'Intern testnote',
    forbudte_heste: [hestId('Pixie')],
    paakraevede_heste: [],
    kun_rolige_heste: false,
  };

  it('PUT gemmer de følsomme felter krypteret (v1:) og aldrig i klartekst', async () => {
    const svar = await malene.put<Sikkerhedsprofil>(`/ryttere/${emma}/sikkerhedsprofil`, profil);
    expect(svar.status).toBe(200);
    expect(svar.body).toMatchObject({ ...profil, rytter_id: emma });

    const raekker = await prisma.$queryRaw<Record<string, string | null>[]>`
      SELECT faldtraume_note, angstkategori, intern_note FROM sikkerhedsprofil WHERE rytter_id = ${emma}::uuid`;
    expect(raekker).toHaveLength(1);
    for (const [felt, vaerdi] of Object.entries(raekker[0] ?? {})) {
      expect(vaerdi, felt).toMatch(/^v1:/);
      expect(vaerdi, felt).not.toMatch(/testtekst|testnote/);
    }
  });

  it('GET dekrypterer felterne og logger læsningen (SIKKERHEDSPROFIL_LAEST)', async () => {
    const laesning = { where: { handling: 'SIKKERHEDSPROFIL_LAEST', entitet_id: emma } };
    const foer = await prisma.auditHaendelse.count(laesning);
    const svar = await malene.get<Sikkerhedsprofil>(`/ryttere/${emma}/sikkerhedsprofil`);
    expect(svar.status).toBe(200);
    expect(svar.body).toMatchObject(profil);
    expect(await prisma.auditHaendelse.count(laesning)).toBe(foer + 1);
  });

  it('PUT logger SIKKERHEDSPROFIL_AENDRET med "ændret" i stedet for indholdet', async () => {
    const svar = await malene.put(`/ryttere/${emma}/sikkerhedsprofil`, {
      ...profil,
      intern_note: 'Ny intern testnote',
    });
    expect(svar.status).toBe(200);
    const audit = await senesteAudit('SIKKERHEDSPROFIL_AENDRET', emma);
    expect(audit?.efter).toMatchObject({ intern_note: 'ændret' });
    expect(JSON.stringify([audit?.foer, audit?.efter])).not.toMatch(/testnote|testtekst|v1:/);
  });

  it('PUT afviser samme hest som både forbudt og påkrævet (422 MODSTRIDENDE_SPAERRINGER)', async () => {
    const svar = await malene.put(`/ryttere/${emma}/sikkerhedsprofil`, {
      ...profil,
      paakraevede_heste: [hestId('Pixie')],
    });
    expect(svar.status).toBe(422);
    expect(svar.body).toMatchObject({ kode: 'MODSTRIDENDE_SPAERRINGER' });
  });

  it('GET giver en tom profil for en rytter uden sikkerhedsprofil', async () => {
    const ella = rytterId('Ella Lundkvist');
    const svar = await malene.get<Sikkerhedsprofil>(`/ryttere/${ella}/sikkerhedsprofil`);
    expect(svar.status).toBe(200);
    expect(svar.body).toMatchObject({
      rytter_id: ella,
      faldtraume_note: null,
      angstkategori: null,
      intern_note: null,
      forbudte_heste: [],
      paakraevede_heste: [],
      kun_rolige_heste: false,
    });
  });
});

describe('ønsker (F1.1)', () => {
  const emma = rytterId('Emma Grønby');
  const [pixie, zigge, boy] = [hestId('Pixie'), hestId('Zigge'), hestId('Boy')];

  it('PUT afviser mere end 3 ønsker (422)', async () => {
    const svar = await malene.put(`/oensker/${MAANED}`, {
      rytter_id: emma,
      oensker: [pixie, zigge, boy, hestId('Toobi')],
    });
    expect(svar.status).toBe(422);
  });

  it('PUT afviser samme hest to gange (422)', async () => {
    expect(
      (await malene.put(`/oensker/${MAANED}`, { rytter_id: emma, oensker: [zigge, zigge] })).status,
    ).toBe(422);
  });

  it('efter PUT af Emma Grønbys [Pixie, Zigge, Boy] viser GET Pixie som "kan ikke opfyldes"', async () => {
    expect(
      (await malene.put(`/oensker/${MAANED}`, { rytter_id: emma, oensker: [pixie, zigge, boy] })).status,
    ).toBe(204);

    const svar = await malene.get<Elevoenske[]>(`/oensker/${MAANED}`);
    expect(svar.status).toBe(200);
    const emmas = svar.body.filter((o) => o.rytter_id === emma).sort((a, b) => a.prioritet - b.prioritet);
    expect(emmas).toEqual([
      expect.objectContaining({
        prioritet: 1,
        oensket_hest_id: pixie,
        kan_opfyldes: false,
        rytter_navn: 'Emma Grønby',
      }),
      expect.objectContaining({ prioritet: 2, oensket_hest_id: zigge, kan_opfyldes: true, maaned: MAANED }),
      expect.objectContaining({ prioritet: 3, oensket_hest_id: boy, kan_opfyldes: true }),
    ]);

    const raekker = await prisma.elevoenske.findMany({ where: { rytter_id: emma, maaned: MAANED } });
    expect(raekker).toHaveLength(3);
    expect(raekker.every((r) => r.registreret_af === brugerId('Malene'))).toBe(true);
  });

  it('Marie må registrere ønsker for ryttere på sine egne hold, men får 403 på Camillas hold', async () => {
    expect((await marie.put(`/oensker/${MAANED}`, { rytter_id: emma, oensker: [zigge] })).status).toBe(204);

    const josefine = rytterId('Josefine Ibsen');
    const svar = await marie.put(`/oensker/${MAANED}`, { rytter_id: josefine, oensker: [zigge] });
    expect(svar.status).toBe(403);
    expect(svar.body).toMatchObject({ kode: 'INGEN_ADGANG' });
  });
});
