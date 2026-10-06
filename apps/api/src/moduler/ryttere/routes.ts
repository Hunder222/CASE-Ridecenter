import { Rytter, RytterInput, RytterOpdatering } from '@ridecenter/contracts';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { IdParams } from '../../faelles';
import { aktuelBruger, kraevRoller } from '../../plugins/rbac';
import { rytterDto } from './mapper';
import { opdaterRytter, opretRytter } from './service';
import { sikkerhedsprofilRuter } from './sikkerhedsprofil';

// Ryttere (FR-002). Kun Ledelse: admin-projektionen har kontaktoplysninger og fysiske data.
export const rytterRuter: FastifyPluginAsyncZod = async (app) => {
  const kunLedelse = kraevRoller('Ledelse');

  app.get('/ryttere', { onRequest: kunLedelse, schema: { response: { 200: z.array(Rytter) } } }, async () =>
    (await app.prisma.rytter.findMany({ orderBy: [{ fornavn: 'asc' }, { efternavn: 'asc' }] })).map(
      rytterDto,
    ),
  );

  app.post(
    '/ryttere',
    { onRequest: kunLedelse, schema: { body: RytterInput, response: { 201: Rytter } } },
    async (request, reply) =>
      reply.status(201).send(await opretRytter(app.prisma, request.body, aktuelBruger(request), app.ur())),
  );

  app.patch(
    '/ryttere/:id',
    {
      onRequest: kunLedelse,
      schema: { params: IdParams, body: RytterOpdatering, response: { 200: Rytter } },
    },
    async (request) =>
      opdaterRytter(app.prisma, request.params.id, request.body, aktuelBruger(request), app.ur()),
  );

  await app.register(sikkerhedsprofilRuter);
};
