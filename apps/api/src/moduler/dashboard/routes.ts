import { DashboardNoegletalSvar } from '@ridecenter/contracts';
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
        response: {
          200: DashboardNoegletalSvar,
        },
      },
    },
    async () => {
      return service.hentNoegletal();
    },
  );
};

