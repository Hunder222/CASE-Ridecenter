import { Hest, HestInput, HestOpdatering } from '@ridecenter/contracts';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { IdParams } from '../../faelles';
import { DomaeneFejl } from '../../plugins/fejl';
import { aktuelBruger, kraevRoller } from '../../plugins/rbac';
import { hestDto } from './mapper';
import { opdaterHest, opretHest } from './service';
import { StatusService } from './status-service';

// Heste (FR-001, F1.3). x-roller: GET Ledelse, Ridelærer, Staldelev. PATCH Ledelse, Ridelærer, samt Staldelev (kun staldnoter).
export const hesteRuter: FastifyPluginAsyncZod = async (app) => {
  app.get(
    '/heste',
    { onRequest: kraevRoller('Ledelse', 'Ridelaerer', 'Staldelev'), schema: { response: { 200: z.array(Hest) } } },
    async () => (await app.prisma.hest.findMany({ orderBy: { navn: 'asc' } })).map(hestDto),
  );

  app.post(
    '/heste',
    { onRequest: kraevRoller('Ledelse'), schema: { body: HestInput, response: { 201: Hest } } },
    async (request, reply) =>
      reply.status(201).send(await opretHest(app.prisma, request.body, aktuelBruger(request), app.ur())),
  );

  app.patch(
    '/heste/:id',
    {
      onRequest: kraevRoller('Ledelse', 'Ridelaerer', 'Staldelev'),
      schema: { params: IdParams, body: HestOpdatering, response: { 200: Hest } },
    },
    async (request) => {
      const bruger = aktuelBruger(request);
      const erKunStaldelev =
        bruger.roller.includes('Staldelev') &&
        !bruger.roller.includes('Ledelse') &&
        !bruger.roller.includes('Ridelaerer');

      if (erKunStaldelev) {
        const bodyKeys = Object.keys(request.body);
        const tilladteFelter = ['staldnoter', 'temperament', 'skaane'];
        const ugyldigeFelter = bodyKeys.filter((k) => !tilladteFelter.includes(k));
        if (ugyldigeFelter.length > 0) {
          throw new DomaeneFejl(
            'INGEN_ADGANG',
            'Staldelever må kun opdatere hestens staldnoter, temperament og skåne-status',
            403,
          );
        }
      }

      return opdaterHest(app.prisma, request.params.id, request.body, bruger, app.ur());
    },
  );

  // POST /heste/:id/status (Staldelev, Ridelaerer, Vikar, Ledelse - fail-safe)
  app.post(
    '/heste/:id/status',
    {
      onRequest: kraevRoller('Staldelev', 'Ridelaerer', 'Vikar', 'Ledelse'),
      schema: {
        params: IdParams,
        body: z.object({
          type: z.enum(['Helbred', 'Adfaerd']),
          alvorlighed: z.enum(['Info', 'Obs', 'KanIkkeBruges']),
          beskrivelse: z.string().trim().min(1).max(500),
        }),
        response: { 200: z.object({ ok: z.boolean(), id: z.string() }) },
      },
    },
    async (request) => {
      const statusService = new StatusService(app.prisma, app);
      const res = await statusService.meldHestStatus(
        request.params.id,
        request.body,
        aktuelBruger(request),
      );
      return { ok: true, id: res.id };
    },
  );
};
