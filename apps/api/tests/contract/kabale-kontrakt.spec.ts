import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import type { KandidatHest, Tildelingskoersel } from '@ridecenter/contracts';
import Ajv2020 from 'ajv/dist/2020';
import addFormats from 'ajv-formats';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { parse } from 'yaml';
import { lavApp, logInd, type TestApp } from '../helpers/app';
import { prisma, seedFredag } from '../helpers/db';
import { Klient, type Metode } from '../helpers/klient';
import {
  gyldigHest,
  gyldigRytter,
  hestId,
  MAANED,
  rytterId,
  tildelingFor,
  UKENDT_ID,
  UR_JUNI,
} from '../helpers/testdata';

// Kontrakttest (T060): svarene fra alle Fase 1-endpoints valideres mod contracts/openapi.yaml.
// Skemaerne i kontrakten har sjældent "required", så testen gør alle deklarerede felter påkrævede
// (undtagen VALGFRIE_FELTER). Dermed fejler den både ved forkerte typer og ved manglende felter.

type Skema = Record<string, unknown>;
interface Kontrakt {
  paths: Record<
    string,
    Record<string, { responses?: Record<string, { content?: Record<string, { schema?: Skema }> }> }>
  >;
  components: { schemas: Record<string, Skema> };
}

const kontrakt = parse(
  readFileSync(
    fileURLToPath(
      new URL('../../../../specs/001-holdadministration-mvp/contracts/openapi.yaml', import.meta.url),
    ),
    'utf8',
  ),
) as Kontrakt;

/** Felter, et svar må udelade. Alle andre deklarerede felter skal være med. */
const VALGFRIE_FELTER: Record<string, string[]> = {
  // Kun GET /tildeling/koersler/{id} har tildelingerne med.
  Tildelingskoersel: ['tildelinger'],
  // Cheat Sheet og adfærdsinstruks kommer i Fase 2 (US3, FR-012).
  Sikkerhedsprofil: ['cheat_sheet_koder', 'adfaerdsinstruks'],
  Fejl: ['detaljer'],
};

/** Kopi af skemaet med lokale $defs-referencer og alle properties påkrævede. */
function strengt(skema: unknown, valgfrie: readonly string[] = []): unknown {
  if (Array.isArray(skema)) return skema.map((s) => strengt(s));
  if (skema === null || typeof skema !== 'object') return skema;
  const kopi: Skema = {};
  for (const [noegle, vaerdi] of Object.entries(skema)) {
    kopi[noegle] =
      noegle === '$ref' && typeof vaerdi === 'string'
        ? vaerdi.replace('#/components/schemas/', '#/$defs/')
        : strengt(vaerdi);
  }
  if (kopi.properties && typeof kopi.properties === 'object' && !Array.isArray(kopi.properties)) {
    const eksisterende = Array.isArray(kopi.required) ? (kopi.required as string[]) : [];
    const alle = Object.keys(kopi.properties).filter((felt) => !valgfrie.includes(felt));
    kopi.required = [...new Set([...eksisterende, ...alle])];
  }
  return kopi;
}

const DEFS = Object.fromEntries(
  Object.entries(kontrakt.components.schemas).map(([navn, skema]) => [
    navn,
    strengt(skema, VALGFRIE_FELTER[navn]),
  ]),
);

const ajv = new Ajv2020({ strict: false, allErrors: true });
addFormats(ajv);

function overtraedelser(skema: unknown, data: unknown): string[] {
  const valider = ajv.compile({ $defs: DEFS, ...(strengt(skema) as Skema) });
  if (valider(data)) return [];
  return (valider.errors ?? []).map((fejl) => `${fejl.instancePath || '/'} ${fejl.message ?? ''}`);
}

function svarskema(sti: string, metode: Metode, status: number): Skema {
  const skema =
    kontrakt.paths[sti]?.[metode.toLowerCase()]?.responses?.[String(status)]?.content?.['application/json']
      ?.schema;
  if (!skema) throw new Error(`Kontrakten har intet JSON-skema for ${metode} ${sti} → ${status}`);
  return skema;
}

let app: TestApp;
let anonym: Klient;
let malene: Klient;
let marie: Klient;

/**
 * Kalder `skabelon` (stien fra openapi.yaml med {parametre}) og validerer svaret mod kontrakten.
 * Fejlsvar valideres mod Fejl, fordi kontrakten henviser til components/responses/Fejl.
 */
async function kontraktkald<T>(
  klient: Klient,
  metode: Metode,
  skabelon: string,
  status: number,
  {
    params = {},
    query = '',
    payload,
  }: { params?: Record<string, string>; query?: string; payload?: unknown } = {},
): Promise<T> {
  const sti = skabelon.replace(/\{(\w+)\}/g, (_, navn: string) => {
    const vaerdi = params[navn];
    if (!vaerdi) throw new Error(`Mangler parameteren ${navn} til ${skabelon}`);
    return vaerdi;
  });
  const svar = await klient.kald<T>(metode, `${sti}${query}`, payload);
  const kald = `${metode} ${skabelon} → ${status}`;
  expect(svar.status, `${kald}: ${JSON.stringify(svar.body)}`).toBe(status);
  if (status === 204) {
    expect(svar.body, kald).toBeUndefined();
  } else {
    const skema = status >= 400 ? { $ref: '#/components/schemas/Fejl' } : svarskema(skabelon, metode, status);
    expect(overtraedelser(skema, svar.body), kald).toEqual([]);
  }
  return svar.body;
}

beforeAll(async () => {
  await seedFredag();
  app = await lavApp({ ur: UR_JUNI });
  anonym = new Klient(app, null);
  malene = new Klient(app, await logInd(app, 'malene@demo.dk'));
  marie = new Klient(app, await logInd(app, 'marie@demo.dk'));
}, 60_000);

afterAll(async () => {
  await app?.close();
  await prisma.$disconnect();
});

describe('kontrakttjekket selv', () => {
  const hest = {
    id: hestId('Toobi'),
    navn: 'Toobi',
    stangmaal_cm: 140,
    max_rytter_vaegt_kg: 60,
    max_rytter_hoejde_cm: 155,
    temperament: 'Rolig',
    godkendt_til_begyndere: true,
    egnet_oevet: true,
    skaane: false,
    max_lektioner_dag: 3,
    springforbud: false,
    max_spring_uge: 1,
    hviledag: 4,
    sundhedsstatus: 'Aktiv',
    staldnoter: 'Nem og sød',
    aktiv: true,
  };
  const hestSkema = { $ref: '#/components/schemas/Hest' };

  it('godkender en komplet Hest', () => {
    expect(overtraedelser(hestSkema, hest)).toEqual([]);
  });

  it('afviser manglende felter og forkerte typer', () => {
    const udenNavn = Object.fromEntries(Object.entries(hest).filter(([felt]) => felt !== 'navn'));
    expect(overtraedelser(hestSkema, udenNavn)).not.toEqual([]);
    expect(overtraedelser(hestSkema, { ...hest, stangmaal_cm: '140' })).not.toEqual([]);
    expect(overtraedelser(hestSkema, { ...hest, max_lektioner_dag: 4 })).not.toEqual([]);
  });
});

describe('Fase 1-endpoints overholder openapi.yaml', () => {
  const emma = rytterId('Emma Grønby');
  let nyHestId: string;
  let koersel: Tildelingskoersel;

  it('auth: GET /auth/session', async () => {
    await kontraktkald(malene, 'GET', '/auth/session', 200);
  });

  it('heste: GET, POST og PATCH', async () => {
    await kontraktkald(malene, 'GET', '/heste', 200);
    const ny = await kontraktkald<{ id: string }>(malene, 'POST', '/heste', 201, {
      payload: gyldigHest({ navn: 'Kontrakthest' }),
    });
    nyHestId = ny.id;
    await kontraktkald(malene, 'PATCH', '/heste/{id}', 200, {
      params: { id: nyHestId },
      payload: { staldnoter: 'Opdateret i kontrakttesten' },
    });
  });

  it('hold: GET /hold', async () => {
    await kontraktkald(malene, 'GET', '/hold', 200);
  });

  it('ryttere: GET, POST og PATCH', async () => {
    await kontraktkald(malene, 'GET', '/ryttere', 200);
    const ny = await kontraktkald<{ id: string }>(malene, 'POST', '/ryttere', 201, {
      payload: gyldigRytter(),
    });
    await kontraktkald(malene, 'PATCH', '/ryttere/{id}', 200, {
      params: { id: ny.id },
      payload: { partaftale_hest_id: nyHestId },
    });
  });

  it('sikkerhedsprofil: PUT og GET', async () => {
    await kontraktkald(malene, 'PUT', '/ryttere/{id}/sikkerhedsprofil', 200, {
      params: { id: emma },
      payload: {
        faldtraume_note: 'Kontrakttest',
        angstkategori: null,
        intern_note: null,
        forbudte_heste: [hestId('Pixie')],
        paakraevede_heste: [],
        kun_rolige_heste: false,
      },
    });
    await kontraktkald(malene, 'GET', '/ryttere/{id}/sikkerhedsprofil', 200, { params: { id: emma } });
  });

  it('ønsker: GET og PUT', async () => {
    await kontraktkald(malene, 'GET', '/oensker/{maaned}', 200, { params: { maaned: MAANED } });
    await kontraktkald(malene, 'PUT', '/oensker/{maaned}', 204, {
      params: { maaned: MAANED },
      payload: { rytter_id: emma, oensker: [hestId('Pixie'), hestId('Zigge'), hestId('Boy')] },
    });
  });

  it('tildeling: kør, list, hent, kandidater og justér', async () => {
    const start = await kontraktkald<Tildelingskoersel>(malene, 'POST', '/tildeling/koersler', 201, {
      payload: { maaned: MAANED },
    });
    await kontraktkald(malene, 'GET', '/tildeling/koersler', 200, { query: `?maaned=${MAANED}` });
    koersel = await kontraktkald<Tildelingskoersel>(malene, 'GET', '/tildeling/koersler/{id}', 200, {
      params: { id: start.id },
    });
    expect(koersel.tildelinger?.length).toBeGreaterThan(0);

    const emmas = tildelingFor(koersel, emma);
    const params = { id: koersel.id, tildelingId: emmas.id };
    const kandidater = await kontraktkald<KandidatHest[]>(
      malene,
      'GET',
      '/tildeling/koersler/{id}/tildelinger/{tildelingId}/kandidater',
      200,
      { params },
    );
    const lovlig = kandidater.find((k) => k.lovlig && k.hest_id !== emmas.hest_id);
    if (!lovlig) throw new Error('Ingen anden lovlig hest til Emma');
    await kontraktkald(malene, 'PATCH', '/tildeling/koersler/{id}/tildelinger/{tildelingId}', 200, {
      params,
      payload: { hest_id: lovlig.hest_id },
    });
    await kontraktkald(malene, 'PATCH', '/tildeling/koersler/{id}/tildelinger/{tildelingId}', 422, {
      params,
      payload: { hest_id: hestId('Pixie') },
    });
  });

  it('tildeling: godkend og publicér', async () => {
    await kontraktkald(malene, 'POST', '/tildeling/koersler/{id}/godkend', 200, {
      params: { id: koersel.id },
    });
    await kontraktkald(malene, 'POST', '/tildeling/koersler/{id}/publicer', 200, {
      params: { id: koersel.id },
    });
    await kontraktkald(malene, 'POST', '/tildeling/koersler/{id}/publicer', 409, {
      params: { id: koersel.id },
    });
  });

  it('notifikationer: GET og kvittér', async () => {
    const notifikationer = await kontraktkald<{ id: string }[]>(malene, 'GET', '/notifikationer', 200);
    const foerste = notifikationer[0];
    if (!foerste) throw new Error('Kørslen burde have oprettet notifikationer (kapacitetsmangel)');
    await kontraktkald(malene, 'POST', '/notifikationer/{id}/kvitter', 204, { params: { id: foerste.id } });
  });

  it('fejlsvar følger Fejl-skemaet (401, 403, 404, 422)', async () => {
    await kontraktkald(anonym, 'GET', '/heste', 401);
    await kontraktkald(marie, 'GET', '/ryttere', 403);
    await kontraktkald(malene, 'GET', '/tildeling/koersler/{id}', 404, { params: { id: UKENDT_ID } });
    await kontraktkald(malene, 'POST', '/heste', 422, {
      payload: gyldigHest({ navn: 'Mini', stangmaal_cm: 79 }),
    });
  });
});
