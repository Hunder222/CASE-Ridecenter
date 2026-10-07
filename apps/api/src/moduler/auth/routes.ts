import { Fejl, Session, Uuid, VikarKodeOpretSvar, VikarKodePost, VikarLoginBody } from '@ridecenter/contracts';
import * as argon2 from 'argon2';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { DomaeneFejl } from '../../plugins/fejl';
import { aktuelBruger, kraevRoller } from '../../plugins/rbac';
import { kraevEnhed } from '../enheder/enhed-service';
import { hentSession, opretSession, sletSession } from './session';
import { VikarService } from './vikar-service';

const LoginInput = z.strictObject({
  email: z.email(),
  adgangskode: z.string().min(8),
});

// Ukendte e-mails verificeres mod en dummy-hash, så svartiden ikke afslører, hvilke e-mails der findes.
const DUMMY_HASH = await argon2.hash('ingen-bruger-har-denne-adgangskode');

export const authRuter: FastifyPluginAsyncZod = async (app) => {
  const vikarService = new VikarService(app.prisma, app);

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

  // POST /auth/vikarkoder (kun Ledelse)
  app.post(
    '/auth/vikarkoder',
    {
      onRequest: kraevRoller('Ledelse'),
      schema: { response: { 201: VikarKodeOpretSvar } },
    },
    async (request, reply) => {
      const res = await vikarService.udstedVikarKode(aktuelBruger(request));
      return reply.code(201).send(res);
    },
  );

  // GET /auth/vikarkoder (kun Ledelse)
  app.get(
    '/auth/vikarkoder',
    {
      onRequest: kraevRoller('Ledelse'),
      schema: { response: { 200: z.array(VikarKodePost) } },
    },
    async () => {
      return vikarService.hentVikarKoder();
    },
  );

  // DELETE /auth/vikarkoder/:id (kun Ledelse)
  app.delete(
    '/auth/vikarkoder/:id',
    {
      onRequest: kraevRoller('Ledelse'),
      schema: { params: z.object({ id: Uuid }), response: { 200: z.object({ ok: z.boolean() }) } },
    },
    async (request) => {
      await vikarService.spaerVikarKode(request.params.id);
      return { ok: true };
    },
  );

  // POST /auth/vikar/login (åben for betroet stald-enhed)
  app.post(
    '/auth/vikar/login',
    {
      preHandler: kraevEnhed,
      schema: { body: VikarLoginBody, response: { 200: Session } },
    },
    async (request, reply) => {
      return vikarService.loginVikar(
        request.body,
        request.enhed!.id,
        request,
        reply,
      );
    },
  );
};
