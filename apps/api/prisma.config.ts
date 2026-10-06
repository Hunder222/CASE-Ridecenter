import path from 'node:path';
import { config } from 'dotenv';
import { defineConfig } from 'prisma/config';

// .env ligger i repo-roden og deles af api, seed og tests. Prisma indlæser den ikke selv,
// når der findes en prisma.config.ts.
config({ path: [path.resolve('.env'), path.resolve('../../.env')], quiet: true });

export default defineConfig({
  schema: 'prisma/schema.prisma',
});
