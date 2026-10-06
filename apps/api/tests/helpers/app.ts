import { buildApp } from '../../src/app';
import { laesConfig } from '../../src/config';
import { prisma } from './db';

export type TestApp = Awaited<ReturnType<typeof buildApp>>;

/** Appen mod testdatabasen. `ur` styrer "nu" (f.eks. til publicering af fremtidige datoer). */
export async function lavApp({ ur }: { ur?: () => Date } = {}): Promise<TestApp> {
  const app = await buildApp({ config: laesConfig(), prisma, ur });
  await app.ready();
  return app;
}

/** Logger ind som en seedet bruger og returnerer Cookie-headeren til efterfølgende kald. */
export async function logInd(app: TestApp, email: string): Promise<string> {
  const svar = await app.inject({
    method: 'POST',
    url: '/api/v1/auth/web/login',
    payload: { email, adgangskode: process.env.SEED_ADGANGSKODE },
  });
  if (svar.statusCode !== 200) throw new Error(`Login fejlede for ${email}: ${svar.statusCode} ${svar.body}`);
  const cookies = ([] as string[]).concat(svar.headers['set-cookie'] ?? []);
  const session = cookies.find((cookie) => cookie.startsWith('session='));
  if (!session) throw new Error('Login satte ingen session-cookie');
  return session.split(';')[0] as string;
}
