import { Fejl, PullSvar, PushAnmodning, PushSvar, StaldDag } from '@ridecenter/contracts';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { kraevEnhed } from '../enheder/enhed-service';
import { PullService } from './pull-service';
import { SyncService } from './sync-service';

export const syncRuter: FastifyPluginAsyncZod = async (app) => {
  const syncService = new SyncService(app.prisma, app);
  const pullService = new PullService(app.prisma, app.krypto);

  // POST /sync/push: Synkroniser offline kommandoer fra enhed
  app.post(
    '/sync/push',
    {
      preHandler: [kraevEnhed],
      schema: {
        body: PushAnmodning,
        response: {
          200: PushSvar,
          401: Fejl,
        },
      },
    },
    async (request) => {
      const enhedId = request.enhed!.id;
      return syncService.behaendlPush(request.body.kommandoer, enhedId);
    },
  );

  // GET /sync/pull: Hent dataminimeret snapshot for [i dag .. i dag + 6 dage]
  app.get(
    '/sync/pull',
    {
      preHandler: [kraevEnhed],
      schema: {
        querystring: z.object({ cursor: z.string().optional() }),
        response: {
          200: PullSvar,
          401: Fejl,
        },
      },
    },
    async (request) => {
      return pullService.hentPullData(app.ur());
    },
  );

  // GET /stald/dag/:dato: Hent dagens lektioner med forudberegnede godkendte heste
  app.get(
    '/stald/dag/:dato',
    {
      preHandler: [kraevEnhed],
      schema: {
        params: z.object({ dato: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Dato skal have formatet YYYY-MM-DD') }),
        response: {
          200: StaldDag,
          401: Fejl,
        },
      },
    },
    async (request) => {
      return pullService.hentStaldDag(request.params.dato);
    },
  );
};

