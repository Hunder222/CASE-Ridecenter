import { DashboardNotifikation } from '@ridecenter/contracts';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { IdParams } from '../../faelles';
import { DomaeneFejl } from '../../plugins/fejl';
import { aktuelBruger, kraevRoller } from '../../plugins/rbac';

// Dashboardnotifikationer (kun Ledelse): ukvitterede først, derefter nyeste først.
export const notifikationsRuter: FastifyPluginAsyncZod = async (app) => {
  const kunLedelse = kraevRoller('Ledelse');

  app.get(
    '/notifikationer',
    { onRequest: kunLedelse, schema: { response: { 200: z.array(DashboardNotifikation) } } },
    async () => {
      const notifikationer = await app.prisma.dashboardNotifikation.findMany({
        orderBy: [
          { kvitteret_tidspunkt: { sort: 'asc', nulls: 'first' } },
          { oprettet: 'desc' },
          { id: 'asc' },
        ],
      });
      return notifikationer.map((n) => ({
        id: n.id,
        type: n.type,
        payload: (n.payload ?? {}) as Record<string, unknown>,
        oprettet: n.oprettet.toISOString(),
        kvitteret: n.kvitteret_tidspunkt !== null,
      }));
    },
  );

  app.post(
    '/notifikationer/:id/kvitter',
    { onRequest: kunLedelse, schema: { params: IdParams } },
    async (request, reply) => {
      const { id } = request.params;
      const notifikation = await app.prisma.dashboardNotifikation.findUnique({ where: { id } });
      if (!notifikation) throw new DomaeneFejl('IKKE_FUNDET', 'Notifikationen findes ikke', 404);
      if (notifikation.kvitteret_tidspunkt === null) {
        await app.prisma.dashboardNotifikation.update({
          where: { id },
          data: { kvitteret_af: aktuelBruger(request).id, kvitteret_tidspunkt: app.ur() },
        });
      }
      return reply.status(204).send();
    },
  );
};
