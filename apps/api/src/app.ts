import cookie from '@fastify/cookie';
import type { PrismaClient } from '@prisma/client';
import Fastify from 'fastify';
import { serializerCompiler, validatorCompiler, type ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import type { Config } from './config';
import { authRuter } from './moduler/auth/routes';
import { registrerFejlhaandtering } from './plugins/fejl';
import { registrerKrypto } from './plugins/krypto';

// Valideringsbeskeder på dansk (brugerfladen og fejlbeskeder er dansksprogede).
z.config(z.locales.da());

export interface AppAfhaengigheder {
  config: Config;
  prisma: PrismaClient;
  ur?: () => Date;
  logger?: boolean;
}

export async function buildApp({ config, prisma, ur = () => new Date(), logger = false }: AppAfhaengigheder) {
  const app = Fastify({ logger }).withTypeProvider<ZodTypeProvider>();
  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);

  app.decorate('config', config);
  app.decorate('prisma', prisma);
  app.decorate('ur', ur);
  app.decorateRequest('bruger', undefined);
  registrerKrypto(app, config.KRYPTERINGSNOEGLE);
  registrerFejlhaandtering(app);
  await app.register(cookie, { secret: config.SESSION_SECRET });

  await app.register(
    async (api) => {
      api.get('/sundhed', async () => ({ ok: true }));
      await api.register(authRuter);
    },
    { prefix: '/api/v1' },
  );

  return app;
}
