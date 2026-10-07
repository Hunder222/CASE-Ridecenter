import { Fejl } from '@ridecenter/contracts';
import { EnhedRegistrerBody, EnhedUdstedBody } from '@ridecenter/contracts';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { kraevRoller } from '../../plugins/rbac';
import { EnhedService } from './enhed-service';
import { logHaendelse } from '../audit/audit-service';

const EnhedUdstedSvar = z.object({
  enhed_id: z.string().uuid(),
  navn: z.string(),
  enrollment_token: z.string(),
});

const EnhedRegistrerSvar = z.object({
  enhed_id: z.string().uuid(),
  navn: z.string(),
  enhedsnoegle: z.string(),
});

export const enhedRuter: FastifyPluginAsyncZod = async (app) => {
  const service = new EnhedService(app.prisma);

  // POST /auth/enheder: Ledelse udsteder enhed
  app.post(
    '/auth/enheder',
    {
      preHandler: [kraevRoller('Ledelse')],
      schema: {
        body: EnhedUdstedBody,
        response: {
          201: EnhedUdstedSvar,
          401: Fejl,
          403: Fejl,
        },
      },
    },
    async (request, reply) => {
      const res = await service.udstedEnhed(request.body.navn);

      await app.prisma.$transaction(async (tx) => {
        await logHaendelse(tx, {
          handling: 'ENHED_UDSTEDT',
          entitet: 'enhed',
          entitet_id: res.enhed_id,
          bruger: request.bruger ?? null,
          tidspunkt: app.ur(),
          enhed_id: res.enhed_id,
          foer: null,
          efter: { navn: res.navn },
        });
      });

      return reply.status(201).send(res);
    },
  );

  // POST /auth/enheder/registrer: Ny tablet indløser sit token
  app.post(
    '/auth/enheder/registrer',
    {
      schema: {
        body: EnhedRegistrerBody,
        response: {
          200: EnhedRegistrerSvar,
          401: Fejl,
        },
      },
    },
    async (request, reply) => {
      const res = await service.registrerEnhed(request.body.enrollment_token);

      await app.prisma.$transaction(async (tx) => {
        await logHaendelse(tx, {
          handling: 'ENHED_REGISTRERET',
          entitet: 'enhed',
          entitet_id: res.enhed_id,
          bruger: null,
          tidspunkt: app.ur(),
          enhed_id: res.enhed_id,
          foer: null,
          efter: { navn: res.navn },
        });
      });

      return reply.status(200).send(res);
    },
  );
};
