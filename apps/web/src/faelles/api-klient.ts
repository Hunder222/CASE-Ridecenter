import type { Fejl } from '@ridecenter/contracts';

/** Fejlsvar fra API'et (openapi: Fejl) med HTTP-status. */
export class ApiFejl extends Error {
  constructor(
    readonly status: number,
    readonly kode: string,
    besked: string,
    readonly detaljer: string[] = [],
  ) {
    super(besked);
    this.name = 'ApiFejl';
  }
}

type Metode = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

export async function api<T>(
  sti: string,
  { metode = 'GET', body }: { metode?: Metode; body?: unknown } = {},
): Promise<T> {
  const svar = await fetch(`/api/v1${sti}`, {
    method: metode,
    credentials: 'include',
    headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (svar.status === 204) return undefined as T;

  const data: unknown = await svar.json().catch(() => null);
  if (!svar.ok) {
    const fejl = (data ?? {}) as Partial<Fejl>;
    throw new ApiFejl(
      svar.status,
      fejl.kode ?? 'UKENDT_FEJL',
      fejl.besked ?? `Uventet svar fra serveren (${svar.status})`,
      fejl.detaljer ?? [],
    );
  }
  return data as T;
}
