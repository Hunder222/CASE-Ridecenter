import { Elevoenske, Maaned, OenskerPut } from '@ridecenter/contracts';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { aktuelBruger, kraevRoller } from '../../plugins/rbac';
import { gemOensker, hentOensker } from './service';

const MaanedParams = z.object({ maaned: Maaned });

// Ønsker (F1.1, admin-varianten). Stald-varianten via sync kommer i Fase 2.
export const oenskeRuter: FastifyPluginAsyncZod = async (app) => {
  const begge = kraevRoller('Ledelse', 'Ridelaerer');

  app.get(
    '/oensker/:maaned',
    { onRequest: begge, schema: { params: MaanedParams, response: { 200: z.array(Elevoenske) } } },
    async (request) => hentOensker(app.prisma, request.params.maaned),
  );

  app.put(
    '/oensker/:maaned',
    { onRequest: begge, schema: { params: MaanedParams, body: OenskerPut } },
    async (request, reply) => {
      await gemOensker(app.prisma, request.params.maaned, request.body, aktuelBruger(request), app.ur());
      return reply.status(204).send();
    },
  );
};
