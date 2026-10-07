import { RapportTilsynInput, RapportTilsynSvar, Uuid } from '@ridecenter/contracts';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { aktuelBruger, kraevRoller } from '../../plugins/rbac';
import { RapportService } from './rapport-service';

export const rapportRuter: FastifyPluginAsyncZod = async (app) => {
  const service = new RapportService(app.prisma);

  // POST /rapporter/tilsyn (kun Ledelse)
  app.post(
    '/rapporter/tilsyn',
    {
      onRequest: kraevRoller('Ledelse'),
      schema: {
        body: RapportTilsynInput,
        response: {
          200: RapportTilsynSvar,
        },
      },
    },
    async (request) => {
      const bruger = aktuelBruger(request);
      return service.genererTilsynsrapport(request.body, bruger.id);
    },
  );

  // GET /rapporter/historik (kun Ledelse)
  app.get(
    '/rapporter/historik',
    {
      onRequest: kraevRoller('Ledelse'),
    },
    async () => {
      return service.hentHistorik();
    },
  );

  // GET /rapporter/tilsyn/:id/download (kun Ledelse)
  app.get(
    '/rapporter/tilsyn/:id/download',
    {
      onRequest: kraevRoller('Ledelse'),
      schema: {
        params: z.object({ id: Uuid }),
      },
    },
    async (request, reply) => {
      const csv = await service.downloadRapport(request.params.id);
      reply.header('Content-Type', 'text/csv; charset=utf-8');
      reply.header('Content-Disposition', `attachment; filename="tilsynsrapport-${request.params.id}.csv"`);
      return reply.send(csv);
    },
  );
};

