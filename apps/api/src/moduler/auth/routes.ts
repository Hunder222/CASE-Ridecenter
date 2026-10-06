import { Fejl, Session } from '@ridecenter/contracts';
import * as argon2 from 'argon2';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { DomaeneFejl } from '../../plugins/fejl';
import { hentSession, opretSession, sletSession } from './session';

const LoginInput = z.strictObject({
  email: z.email(),
  adgangskode: z.string().min(8),
});

// Ukendte e-mails verificeres mod en dummy-hash, så svartiden ikke afslører, hvilke e-mails der findes.
const DUMMY_HASH = await argon2.hash('ingen-bruger-har-denne-adgangskode');

export const authRuter: FastifyPluginAsyncZod = async (app) => {
  app.post(
    '/auth/web/login',
    { schema: { body: LoginInput, response: { 200: Session, 401: Fejl } } },
    async (request, reply) => {
      const { email, adgangskode } = request.body;
      const bruger = await app.prisma.bruger.findUnique({ where: { email: email.toLowerCase() } });
      const korrekt = await argon2.verify(bruger?.password_hash ?? DUMMY_HASH, adgangskode);
      if (!bruger || !bruger.aktiv || !bruger.password_hash || !korrekt) {
        throw new DomaeneFejl('LOGIN_FEJLET', 'Forkert e-mail eller adgangskode', 401);
      }
      return opretSession(reply, bruger, app.ur(), app.config.NODE_ENV === 'production');
    },
  );

  app.get('/auth/session', { schema: { response: { 200: Session, 401: Fejl } } }, async (request) => {
    const session = hentSession(request, app.ur());
    if (!session) throw new DomaeneFejl('IKKE_LOGGET_IND', 'Log ind for at fortsætte', 401);
    return session;
  });

  app.post('/auth/logout', async (_request, reply) => {
    sletSession(reply);
    return reply.status(204).send();
  });
};
