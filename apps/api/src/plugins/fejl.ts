import type { FastifyInstance } from 'fastify';
import { hasZodFastifySchemaValidationErrors } from 'fastify-type-provider-zod';

/** Forventet fejl med maskinlæsbar kode og dansk besked (openapi: Fejl). */
export class DomaeneFejl extends Error {
  constructor(
    readonly kode: string,
    besked: string,
    readonly httpStatus: number,
    readonly detaljer?: string[],
  ) {
    super(besked);
    this.name = 'DomaeneFejl';
  }
}

export function registrerFejlhaandtering(app: FastifyInstance): void {
  app.setErrorHandler((fejl, request, reply) => {
    if (fejl instanceof DomaeneFejl) {
      return reply.status(fejl.httpStatus).send({
        kode: fejl.kode,
        besked: fejl.message,
        ...(fejl.detaljer ? { detaljer: fejl.detaljer } : {}),
      });
    }
    if (hasZodFastifySchemaValidationErrors(fejl)) {
      const detaljer = fejl.validation.map(
        (v) => `${v.instancePath || '/'}: ${v.message ?? 'ugyldig værdi'}`,
      );
      return reply.status(422).send({ kode: 'VALIDERINGSFEJL', besked: 'Ugyldige data', detaljer });
    }
    const klient = klientfejl(fejl);
    if (klient) {
      return reply
        .status(klient.statusCode)
        .send({ kode: klient.code ?? 'UGYLDIG_FORESPOERGSEL', besked: 'Ugyldig forespørgsel' });
    }
    request.log.error(fejl);
    return reply.status(500).send({ kode: 'SERVERFEJL', besked: 'Der opstod en uventet fejl' });
  });

  app.setNotFoundHandler((_request, reply) =>
    reply.status(404).send({ kode: 'IKKE_FUNDET', besked: 'Ressourcen findes ikke' }),
  );
}

/** Fastify-fejl med 4xx-status (f.eks. ugyldig JSON eller for stor body), ellers null. */
function klientfejl(fejl: unknown): { statusCode: number; code?: string } | null {
  if (typeof fejl !== 'object' || fejl === null) return null;
  const { statusCode, code } = fejl as { statusCode?: unknown; code?: unknown };
  if (typeof statusCode !== 'number' || statusCode < 400 || statusCode >= 500) return null;
  return { statusCode, code: typeof code === 'string' ? code : undefined };
}
