import cookie from '@fastify/cookie';
import type { PrismaClient } from '@prisma/client';
import Fastify from 'fastify';
import { serializerCompiler, validatorCompiler, type ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import type { Config } from './config';
import { pinRuter } from './moduler/auth/pin-routes';
import { authRuter } from './moduler/auth/routes';
import { enhedRuter } from './moduler/enheder/routes';
import { hesteRuter } from './moduler/heste/routes';
import { holdAdminRuter } from './moduler/hold/admin-routes';
import { notifikationsRuter } from './moduler/notifikationer/routes';
import { oenskeRuter } from './moduler/oensker/routes';
import { staldOenskeRuter } from './moduler/oensker/stald-routes';
import { rytterRuter } from './moduler/ryttere/routes';
import { syncRuter } from './moduler/sync/routes';
import { tildelingsRuter } from './moduler/tildeling/routes';
import { fremmoedeRuter } from './moduler/fremmoede/routes';
import { omplaceringsRuter } from './moduler/lektioner/routes';
import { cheatSheetRuter } from './moduler/ryttere/cheat-sheet-koder-routes';
import { ventelisteRuter } from './moduler/venteliste/routes';
import { dashboardRuter } from './moduler/dashboard/routes';
import { rapportRuter } from './moduler/rapporter/routes';
import { auditVerificerRuter } from './moduler/audit/verificer-routes';
import { registrerFejlhaandtering } from './plugins/fejl';
import { registrerKrypto } from './plugins/krypto';
import { ssePlugin } from './plugins/sse';

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
  app.decorateRequest('enhed', undefined);
  registrerKrypto(app, config.KRYPTERINGSNOEGLE);
  registrerFejlhaandtering(app);
  await app.register(cookie, { secret: config.SESSION_SECRET });

  await app.register(
    async (api) => {
      api.get('/sundhed', async () => ({ ok: true }));
      await api.register(ssePlugin);
      await api.register(authRuter);
      await api.register(enhedRuter);
      await api.register(pinRuter);
      // RBAC pr. endpoint efter x-roller i openapi.yaml (kraevRoller i hvert modul).
      await api.register(hesteRuter);
      await api.register(rytterRuter);
      await api.register(holdAdminRuter);
      await api.register(oenskeRuter);
      await api.register(staldOenskeRuter);
      await api.register(notifikationsRuter);
      await api.register(tildelingsRuter);
      await api.register(syncRuter);
      await api.register(fremmoedeRuter);
      await api.register(omplaceringsRuter);
      await api.register(cheatSheetRuter);
      await api.register(ventelisteRuter);
      await api.register(dashboardRuter);
      await api.register(rapportRuter);
      await api.register(auditVerificerRuter);
    },
    { prefix: '/api/v1' },
  );

  return app;
}
