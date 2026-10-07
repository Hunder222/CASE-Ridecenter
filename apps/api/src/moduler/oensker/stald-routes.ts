import { StaldOenskerBatchBody } from '@ridecenter/contracts';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { logHaendelse } from '../audit/audit-service';
import { aktuelBruger, kraevRoller } from '../../plugins/rbac';
import { gemOensker } from './service';

export const staldOenskeRuter: FastifyPluginAsyncZod = async (app) => {
  app.post(
    '/oensker/stald/batch',
    {
      onRequest: kraevRoller('Ridelaerer', 'Ledelse'),
      schema: {
        body: StaldOenskerBatchBody,
        response: { 200: z.object({ ok: z.boolean() }) },
      },
    },
    async (request) => {
      const { rytter_id, maaned, oensker } = request.body;
      const bruger = aktuelBruger(request);
      const nu = app.ur();

      // Gem ønsker via gemOensker (validerer aktiv rytter, egne hold og unikke heste)
      await gemOensker(app.prisma, maaned, { rytter_id, oensker }, bruger, nu);

      // Audit log OENSKER_REGISTRERET
      await app.prisma.$transaction(async (tx) => {
        await logHaendelse(tx, {
          handling: 'OENSKER_REGISTRERET',
          entitet: 'elevoenske',
          entitet_id: rytter_id,
          bruger,
          tidspunkt: nu,
          foer: null,
          efter: { maaned, oensker },
        });
      });

      // Udsend SSE event
      app.sse?.udsendEvent('oensker.opdateret', {
        rytter_id,
        maaned,
        antal_oensker: oensker.length,
      });

      return { ok: true };
    },
  );

  // GET /stald/oensker/:maaned: Hent månedens registrerede ønsker til stald-tabletten
  app.get(
    '/stald/oensker/:maaned',
    {
      schema: {
        params: z.object({
          maaned: z.string().regex(/^[0-9]{4}-(0[1-9]|1[0-2])$/),
        }),
      },
    },
    async (request) => {
      const oensker = await app.prisma.elevoenske.findMany({
        where: { maaned: request.params.maaned },
        orderBy: [{ rytter_id: 'asc' }, { prioritet: 'asc' }],
      });
      return oensker.map((o) => ({
        rytter_id: o.rytter_id,
        prioritet: o.prioritet,
        oensket_hest_id: o.oensket_hest_id,
      }));
    },
  );
};

