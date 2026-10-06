import { fileURLToPath } from 'node:url';
import { config as indlaesEnv } from 'dotenv';
import { defineConfig } from 'vitest/config';

// .env ligger i repo-roden. Testene kører altid mod DATABASE_URL_TEST, aldrig udviklingsdatabasen.
indlaesEnv({ path: fileURLToPath(new URL('../../.env', import.meta.url)), quiet: true });
const testdatabase = process.env.DATABASE_URL_TEST;
if (!testdatabase) throw new Error('DATABASE_URL_TEST mangler i .env (se .env.example)');

export default defineConfig({
  test: {
    include: ['tests/**/*.spec.ts'],
    // Testene deler én testdatabase og må ikke køre samtidig.
    fileParallelism: false,
    globalSetup: ['./tests/helpers/global-setup.ts'],
    passWithNoTests: true,
    env: {
      NODE_ENV: 'test',
      DATABASE_URL: testdatabase,
      DATABASE_URL_TEST: testdatabase,
      KRYPTERINGSNOEGLE: process.env.KRYPTERINGSNOEGLE ?? '',
      SESSION_SECRET: process.env.SESSION_SECRET ?? '',
      SEED_ADGANGSKODE: process.env.SEED_ADGANGSKODE ?? '',
    },
  },
});
