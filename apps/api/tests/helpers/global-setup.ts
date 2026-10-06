import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

// Bringer testdatabasen op på seneste migration én gang pr. testkørsel. Data tømmes af testene selv
// (nulstilData), så en ikke-destruktiv "migrate deploy" er nok.
export default function setup(): void {
  const testdatabase = process.env.DATABASE_URL_TEST;
  if (!testdatabase) throw new Error('DATABASE_URL_TEST mangler i .env');
  if (testdatabase === process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL_TEST må ikke pege på samme database som DATABASE_URL');
  }
  execSync('npx prisma migrate deploy', {
    cwd: fileURLToPath(new URL('../..', import.meta.url)),
    env: { ...process.env, DATABASE_URL: testdatabase },
    stdio: 'pipe',
  });
}
