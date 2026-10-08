import { z } from 'zod';
import { DashboardNoegletalSvar, Maaned } from '@ridecenter/contracts';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { kraevRoller } from '../../plugins/rbac';
import { DashboardService } from './dashboard-service';

export const dashboardRuter: FastifyPluginAsyncZod = async (app) => {
  const service = new DashboardService(app.prisma);

  // GET /dashboard/noegletal (kun Ledelse)
  app.get(
    '/dashboard/noegletal',
    {
      onRequest: kraevRoller('Ledelse'),
      schema: {
        querystring: z.object({
          maaned: Maaned.optional(),
        }),
        response: {
          200: DashboardNoegletalSvar,
        },
      },
    },
    async (request) => {
      const maaned = (request.query as { maaned?: string })?.maaned;
      return service.hentNoegletal(maaned);
    },
  );
};

