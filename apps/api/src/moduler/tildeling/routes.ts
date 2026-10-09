import {
  GodkendKoerselInput,
  Hestetildeling,
  KandidatHest,
  KoerselStart,
  Maaned,
  ManuelJustering,
  PubliceringSvar,
  SaertildelSvar,
  Tildelingskoersel,
  Uuid,
} from '@ridecenter/contracts';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { IdParams } from '../../faelles';
import { aktuelBruger, kraevRoller } from '../../plugins/rbac';
import { justerTildeling, kandidater, saertildelAlle } from './justering-service';
import { hentKoersel, koerTildeling, listKoersler } from './koersel-service';
import { godkendKoersel, publicerKoersel } from './publicering-service';

const TildelingParams = z.object({ id: Uuid, tildelingId: Uuid });

// Kabalen (US2): kør → justér under live Welfare Guard → godkend → publicér.
export const tildelingsRuter: FastifyPluginAsyncZod = async (app) => {
  const begge = kraevRoller('Ledelse', 'Ridelaerer');

  app.get(
    '/tildeling/koersler',
    {
      onRequest: begge,
      schema: { querystring: z.object({ maaned: Maaned }), response: { 200: z.array(Tildelingskoersel) } },
    },
    async (request) => listKoersler(app.prisma, request.query.maaned),
  );

  app.post(
    '/tildeling/koersler',
    { onRequest: begge, schema: { body: KoerselStart, response: { 201: Tildelingskoersel } } },
    async (request, reply) => {
      const id = await koerTildeling(
        app,
        request.body.maaned,
        aktuelBruger(request),
        request.body.reserver_begynder_heste,
        request.body.reserver_spring_heste,
      );
      return reply.status(201).send(await hentKoersel(app.prisma, id));
    },
  );

  app.get(
    '/tildeling/koersler/:id',
    { onRequest: begge, schema: { params: IdParams, response: { 200: Tildelingskoersel } } },
    async (request) => hentKoersel(app.prisma, request.params.id),
  );

  app.get(
    '/tildeling/koersler/:id/tildelinger/:tildelingId/kandidater',
    { onRequest: begge, schema: { params: TildelingParams, response: { 200: z.array(KandidatHest) } } },
    async (request) => kandidater(app, request.params.id, request.params.tildelingId),
  );

  app.patch(
    '/tildeling/koersler/:id/tildelinger/:tildelingId',
    {
      onRequest: begge,
      schema: { params: TildelingParams, body: ManuelJustering, response: { 200: Hestetildeling } },
    },
    async (request) =>
      justerTildeling(
        app,
        request.params.id,
        request.params.tildelingId,
        request.body.hest_id,
        aktuelBruger(request),
        request.body.tillad_niveau_dispensation,
      ),
  );

  app.post(
    '/tildeling/koersler/:id/saertildel-alle',
    { onRequest: begge, schema: { params: IdParams, response: { 200: SaertildelSvar } } },
    async (request) => saertildelAlle(app, request.params.id, aktuelBruger(request)),
  );

  app.post(
    '/tildeling/koersler/:id/godkend',
    {
      onRequest: begge,
      schema: {
        params: IdParams,
        body: GodkendKoerselInput,
        response: { 200: Tildelingskoersel },
      },
    },
    async (request) =>
      godkendKoersel(
        app,
        request.params.id,
        aktuelBruger(request),
        Boolean((request.body as { tillad_niveau_dispensation?: boolean } | null | undefined)?.tillad_niveau_dispensation),
      ),
  );

  app.post(
    '/tildeling/koersler/:id/publicer',
    { onRequest: kraevRoller('Ledelse'), schema: { params: IdParams, response: { 200: PubliceringSvar } } },
    async (request) => publicerKoersel(app, request.params.id, aktuelBruger(request)),
  );
};
