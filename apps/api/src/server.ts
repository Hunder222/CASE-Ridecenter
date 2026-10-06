import path from 'node:path';
import { config as indlaesEnv } from 'dotenv';
import { buildApp } from './app';
import { laesConfig } from './config';
import { hentPrisma } from './db';

// .env ligger i repo-roden og deles af api, seed og tests.
indlaesEnv({ path: path.resolve(import.meta.dirname, '../../../.env'), quiet: true });

const config = laesConfig();
const app = await buildApp({ config, prisma: hentPrisma(), logger: true });
await app.listen({ port: config.API_PORT });
