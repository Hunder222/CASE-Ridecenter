import { Uuid, VentelisteOpretInput } from '@ridecenter/contracts';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { aktuelBruger, kraevRoller } from '../../plugins/rbac';
import { VentelisteService } from './venteliste-service';

export const ventelisteRuter: FastifyPluginAsyncZod = async (app) => {
  const service = new VentelisteService(app.prisma, app.log);

  // GET /admin/venteliste
  app.get(
    '/admin/venteliste',
    {
      onRequest: kraevRoller('Ledelse'),
    },
    async () => {
      return service.hentVenteliste();
    },
  );

  // POST /admin/venteliste
  app.post(
    '/admin/venteliste',
    {
      onRequest: kraevRoller('Ledelse'),
      schema: {
        body: VentelisteOpretInput,
      },
    },
    async (request) => {
      return service.opretVentelistepost(request.body);
    },
  );

  // POST /admin/venteliste/forslag/:id/godkend
  app.post(
    '/admin/venteliste/forslag/:id/godkend',
    {
      onRequest: kraevRoller('Ledelse'),
      schema: {
        params: z.object({ id: Uuid }),
      },
    },
    async (request) => {
      const bruger = aktuelBruger(request);
      return service.godkendForslag(request.params.id, bruger?.id);
    },
  );

  // POST /admin/venteliste/forslag/:id/afvis
  app.post(
    '/admin/venteliste/forslag/:id/afvis',
    {
      onRequest: kraevRoller('Ledelse'),
      schema: {
        params: z.object({ id: Uuid }),
      },
    },
    async (request) => {
      const bruger = aktuelBruger(request);
      return service.afvisForslag(request.params.id, bruger?.id);
    },
  );
};

