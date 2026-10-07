import { OmplaceringInput, Uuid } from '@ridecenter/contracts';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { aktuelBruger, kraevRoller } from '../../plugins/rbac';
import { OmplaceringService } from './omplacering-service';

export const omplaceringsRuter: FastifyPluginAsyncZod = async (app) => {
  const service = new OmplaceringService(app.prisma, app);

  // GET /lektionspladser/:id/erstatningsforslag
  app.get(
    '/lektionspladser/:id/erstatningsforslag',
    {
      onRequest: kraevRoller('Ridelaerer', 'Ledelse'),
      schema: {
        params: z.object({ id: Uuid }),
        response: {
          200: z.array(
            z.object({
              hestId: z.string(),
              navn: z.string(),
              dagsbelastning: z.number(),
              temperament: z.string(),
              begrundelseTekst: z.string(),
            }),
          ),
        },
      },
    },
    async (request) => {
      return service.hentErstatningsforslag(request.params.id);
    },
  );

  // POST /lektionspladser/:id/omplacer
  app.post(
    '/lektionspladser/:id/omplacer',
    {
      onRequest: kraevRoller('Ridelaerer', 'Ledelse'),
      schema: {
        params: z.object({ id: Uuid }),
        body: OmplaceringInput,
        response: {
          200: z.object({
            id: z.string(),
            lektionsplads_id: z.string(),
            til_hest_id: z.string(),
          }),
        },
      },
    },
    async (request) => {
      const omplacering = await service.omplacerHest(
        request.params.id,
        request.body,
        aktuelBruger(request),
      );
      return {
        id: omplacering.id,
        lektionsplads_id: omplacering.lektionsplads_id,
        til_hest_id: omplacering.til_hest_id,
      };
    },
  );
};

