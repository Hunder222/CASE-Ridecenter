import type { TestApp } from './app';

export type Metode = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

export interface Svar<T = unknown> {
  status: number;
  /** JSON-body, eller undefined ved et tomt svar (204). */
  body: T;
}

export type SvarLytter = (svar: Svar, metode: Metode, sti: string) => void;

/** Tynd klient til /api/v1 med en fast session-cookie (null = ikke logget ind). */
export class Klient {
  constructor(
    private readonly app: TestApp,
    private readonly cookie: string | null,
    private readonly lytter?: SvarLytter,
  ) {}

  async kald<T = unknown>(metode: Metode, sti: string, payload?: unknown): Promise<Svar<T>> {
    const svar = await this.app.inject({
      method: metode,
      url: `/api/v1${sti}`,
      headers: this.cookie ? { cookie: this.cookie } : {},
      ...(payload === undefined ? {} : { payload: payload as object }),
    });
    const erJson = String(svar.headers['content-type'] ?? '').includes('application/json');
    const resultat: Svar<T> = {
      status: svar.statusCode,
      body: (svar.body === '' ? undefined : erJson ? svar.json() : svar.body) as T,
    };
    this.lytter?.(resultat, metode, sti);
    return resultat;
  }

  get<T = unknown>(sti: string): Promise<Svar<T>> {
    return this.kald<T>('GET', sti);
  }

  post<T = unknown>(sti: string, payload?: unknown): Promise<Svar<T>> {
    return this.kald<T>('POST', sti, payload);
  }

  put<T = unknown>(sti: string, payload: unknown): Promise<Svar<T>> {
    return this.kald<T>('PUT', sti, payload);
  }

  patch<T = unknown>(sti: string, payload: unknown): Promise<Svar<T>> {
    return this.kald<T>('PATCH', sti, payload);
  }
}
