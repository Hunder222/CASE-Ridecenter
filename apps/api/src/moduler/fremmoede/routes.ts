import { Fejl, FremmoedeBatchBody, FremmoedeKorrektionBody, FremmoedePost, Uuid } from '@ridecenter/contracts';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { aktuelBruger, kraevRoller } from '../../plugins/rbac';
import { FremmoedeService } from './fremmoede-service';

export const fremmoedeRuter: FastifyPluginAsyncZod = async (app) => {
  const service = new FremmoedeService(app.prisma);

  // POST /fremmoede/batch (Ridelærer, Vikar, Ledelse)
  app.post(
    '/fremmoede/batch',
    {
      preHandler: [kraevRoller('Ridelaerer', 'Vikar', 'Ledelse')],
      schema: {
        body: FremmoedeBatchBody,
        response: {
          201: z.array(FremmoedePost),
          401: Fejl,
          403: Fejl,
          404: Fejl,
          409: Fejl,
          422: Fejl,
        },
      },
    },
    async (request, reply) => {
      const bruger = aktuelBruger(request);
      const nu = app.ur();

      const registrerede = await app.prisma.$transaction(async (tx) => {
        return service.registrerFremmoedeBatch(
          tx,
          {
            lektionId: request.body.lektion_id,
            registreringer: request.body.registreringer,
            bruger,
            enhedId: bruger.enhed_id,
          },
          nu,
        );
      });

      app.sse?.udsendEvent('plads.opdateret', {
        lektion_id: request.body.lektion_id,
        antal: registrerede.length,
      });

      return reply.status(201).send(
        registrerede.map((r) => ({
          ...r,
          lektion_dato: r.lektion_dato.toISOString().slice(0, 10),
          modtaget_tidspunkt: r.modtaget_tidspunkt?.toISOString() ?? null,
          klient_tidspunkt: r.klient_tidspunkt.toISOString(),
          server_tidspunkt: r.server_tidspunkt.toISOString(),
        })),
      );
    },
  );

  // POST /fremmoede/:id/korrektion (Ridelærer, Ledelse)
  app.post(
    '/fremmoede/:id/korrektion',
    {
      preHandler: [kraevRoller('Ridelaerer', 'Ledelse')],
      schema: {
        params: z.object({ id: Uuid }),
        body: FremmoedeKorrektionBody,
        response: {
          200: FremmoedePost,
          401: Fejl,
          403: Fejl,
          404: Fejl,
          422: Fejl,
        },
      },
    },
    async (request, reply) => {
      const bruger = aktuelBruger(request);
      const nu = app.ur();

      const korrigeret = await app.prisma.$transaction(async (tx) => {
        return service.korrigerFremmoede(
          tx,
          {
            fremmoedeId: request.params.id,
            nyStatus: request.body.ny_status,
            begrundelse: request.body.begrundelse,
            bruger,
            enhedId: bruger.enhed_id,
          },
          nu,
        );
      });

      app.sse?.udsendEvent('plads.opdateret', {
        plads_id: korrigeret.lektionsplads_id,
        ny_status: korrigeret.status,
      });

      return reply.status(200).send({
        ...korrigeret,
        lektion_dato: korrigeret.lektion_dato.toISOString().slice(0, 10),
        modtaget_tidspunkt: korrigeret.modtaget_tidspunkt?.toISOString() ?? null,
        klient_tidspunkt: korrigeret.klient_tidspunkt.toISOString(),
        server_tidspunkt: korrigeret.server_tidspunkt.toISOString(),
      });
    },
  );

  // POST /lektioner/:id/afslut (Ridelærer, Ledelse)
  app.post(
    '/lektioner/:id/afslut',
    {
      preHandler: [kraevRoller('Ridelaerer', 'Ledelse')],
      schema: {
        params: z.object({ id: Uuid }),
        response: {
          200: z.object({ id: Uuid, status: z.string(), fremmoede_lukket: z.string() }),
          401: Fejl,
          403: Fejl,
          404: Fejl,
        },
      },
    },
    async (request, reply) => {
      const nu = app.ur();

      const opdateret = await app.prisma.$transaction(async (tx) => {
        return service.afslutLektion(tx, request.params.id, nu);
      });

      return reply.status(200).send({
        id: opdateret.id,
        status: opdateret.status,
        fremmoede_lukket: opdateret.fremmoede_lukket!.toISOString(),
      });
    },
  );

  // GET /lektioner/:id/fremmoede
  app.get(
    '/lektioner/:id/fremmoede',
    {
      preHandler: [kraevRoller('Ridelaerer', 'Vikar', 'Ledelse')],
      schema: {
        params: z.object({ id: Uuid }),
        response: {
          200: z.array(FremmoedePost),
          401: Fejl,
          403: Fejl,
        },
      },
    },
    async (request) => {
      const rækker = await service.hentLektionFremmoede(request.params.id);
      return rækker.map((r) => ({
        ...r,
        lektion_dato: r.lektion_dato.toISOString().slice(0, 10),
        modtaget_tidspunkt: r.modtaget_tidspunkt?.toISOString() ?? null,
        klient_tidspunkt: r.klient_tidspunkt.toISOString(),
        server_tidspunkt: r.server_tidspunkt.toISOString(),
      }));
    },
  );
};

