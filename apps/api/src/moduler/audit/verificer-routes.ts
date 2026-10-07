import { AuditVerificerSvar } from '@ridecenter/contracts';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { kraevRoller } from '../../plugins/rbac';
import { AuditVerificerService } from './verificer-service';

export const auditVerificerRuter: FastifyPluginAsyncZod = async (app) => {
  const service = new AuditVerificerService(app.prisma);

  // POST /audit/verificer (kun Ledelse)
  app.post(
    '/audit/verificer',
    {
      onRequest: kraevRoller('Ledelse'),
      schema: {
        response: {
          200: AuditVerificerSvar,
        },
      },
    },
    async () => {
      return service.verificerHashkaede();
    },
  );
};

