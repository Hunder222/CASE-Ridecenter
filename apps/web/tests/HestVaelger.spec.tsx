import type { Hestetildeling, KandidatHest } from '@ridecenter/contracts';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { HestVaelger } from '../src/admin/kabale/HestVaelger';

// Manuel justering med live Welfare Guard (US2, FR-008, Princip I): lovlige heste kan vælges,
// ulovlige er grå og deaktiverede med begrundelse, og der findes ingen override.

const KOERSEL_ID = '11111111-1111-4111-8111-111111111111';
const BOY = 'aaaaaaaa-0000-4000-8000-000000000001';
const ZIGGE = 'aaaaaaaa-0000-4000-8000-000000000002';
const PIXIE = 'aaaaaaaa-0000-4000-8000-000000000003';
const TOOBI = 'aaaaaaaa-0000-4000-8000-000000000004';
const HC07_TEKST = 'Ikke tilladt af hensyn til rytterens sikkerhed (HC-07)';

const tildeling: Hestetildeling = {
  id: '22222222-2222-4222-8222-222222222222',
  hold_id: '33333333-3333-4333-8333-333333333333',
  rytter_id: '44444444-4444-4444-8444-444444444444',
  rytter_navn: 'Emma Grønby',
  hest_id: BOY,
  oenske_opfyldt: 1,
  er_alternativ_tildeling: false,
  turnus_score: 0,
  turnus_naeste_maaned: 0,
  begrundelse_koder: ['SC01_OENSKE_1'],
  begrundelse_tekst: 'Emma fik sit 1. ønske, Boy (SC-01).',
  manuelt_justeret: false,
};

const kandidater: KandidatHest[] = [
  { hest_id: BOY, navn: 'Boy', lovlig: true, koder: [], begrundelse_tekst: 'Kan tildeles' },
  { hest_id: ZIGGE, navn: 'Zigge', lovlig: true, koder: [], begrundelse_tekst: 'Kan tildeles' },
  {
    hest_id: PIXIE,
    navn: 'Pixie',
    lovlig: false,
    koder: [`HC07_FORBUDT_HEST:${PIXIE}`],
    begrundelse_tekst: HC07_TEKST,
  },
  {
    hest_id: TOOBI,
    navn: 'Toobi',
    lovlig: false,
    koder: [`HC01_DAGSGRAENSE:${TOOBI}`],
    begrundelse_tekst: 'Toobi har allerede 3 hold fredag (max 3 af hensyn til hestevelfærd, HC-01)',
  },
];

const tildelingssti = `/api/v1/tildeling/koersler/${KOERSEL_ID}/tildelinger/${tildeling.id}`;

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });
}

let patchSvar: () => Response;
const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
  const url = String(input);
  const metode = init?.method ?? 'GET';
  if (metode === 'GET' && url.endsWith(`${tildelingssti}/kandidater`)) return json(kandidater);
  if (metode === 'PATCH' && url.endsWith(tildelingssti)) return patchSvar();
  return json({ kode: 'IKKE_FUNDET', besked: `Ukendt kald i testen: ${metode} ${url}` }, 404);
});

const patchKald = () => fetchMock.mock.calls.filter(([, init]) => init?.method === 'PATCH');

function vis() {
  const onLuk = vi.fn();
  const queryKlient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  render(
    <QueryClientProvider client={queryKlient}>
      <HestVaelger koerselId={KOERSEL_ID} tildeling={tildeling} onLuk={onLuk} />
    </QueryClientProvider>,
  );
  return { onLuk };
}

beforeEach(() => {
  patchSvar = () => json({ ...tildeling, hest_id: ZIGGE, manuelt_justeret: true });
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  fetchMock.mockClear();
});

describe('HestVaelger', () => {
  it('lader en lovlig hest blive valgt og sender den til API’et', async () => {
    const bruger = userEvent.setup();
    vis();
    const zigge = await screen.findByRole<HTMLButtonElement>('button', { name: /Zigge/ });
    expect(zigge.disabled).toBe(false);

    await bruger.click(zigge);

    await waitFor(() => expect(patchKald()).toHaveLength(1));
    const [, init] = patchKald()[0] ?? [];
    expect(JSON.parse(String(init?.body))).toEqual({ hest_id: ZIGGE });
  });

  it('viser ulovlige heste deaktiverede med begrundelsen, og de kan ikke vælges', async () => {
    const bruger = userEvent.setup();
    vis();
    const pixie = await screen.findByRole<HTMLButtonElement>('button', { name: /Pixie/ });
    const toobi = screen.getByRole<HTMLButtonElement>('button', { name: /Toobi/ });
    expect(pixie.disabled).toBe(true);
    expect(toobi.disabled).toBe(true);
    expect(screen.getByText(/Ikke tilladt af hensyn til rytterens sikkerhed \(HC-07\)/)).toBeTruthy();
    expect(screen.getByText(/Toobi har allerede 3 hold fredag/)).toBeTruthy();

    await bruger.click(pixie);
    expect(patchKald()).toHaveLength(0);
  });

  it('har ingen override-, tilsidesæt- eller tving-knap (Princip I)', async () => {
    vis();
    await screen.findByRole('button', { name: /Pixie/ });
    const forbudt = /overstyr|override|tilsidesæt|tving/i;
    for (const knap of screen.getAllByRole('button')) {
      const tekster = [knap.textContent, knap.getAttribute('aria-label'), knap.getAttribute('title')];
      expect(tekster.join(' ')).not.toMatch(forbudt);
    }
    expect(document.body.textContent ?? '').not.toMatch(forbudt);
  });

  it('viser en 422 fra API’et som fejl i dialogen og lukker ikke', async () => {
    patchSvar = () =>
      json(
        {
          kode: 'WELFARE_GUARD_AFVIST',
          besked: 'Hesten kan ikke tildeles',
          detaljer: [`HC01_DAGSGRAENSE:${ZIGGE}`],
        },
        422,
      );
    const bruger = userEvent.setup();
    const { onLuk } = vis();

    await bruger.click(await screen.findByRole('button', { name: /Zigge/ }));

    expect((await screen.findByRole('alert')).textContent).toContain('Hesten kan ikke tildeles');
    expect(onLuk).not.toHaveBeenCalled();
  });
});
