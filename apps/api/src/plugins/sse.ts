import type { SseKanal } from '@ridecenter/contracts';
import type { FastifyInstance, FastifyPluginAsync, FastifyReply, FastifyRequest } from 'fastify';
import fp from 'fastify-plugin';
import { hentSession } from '../moduler/auth/session';
import { EnhedService } from '../moduler/enheder/enhed-service';

export interface SseBroker {
  udsendEvent(kanal: SseKanal, payload: object): void;
}

declare module 'fastify' {
  interface FastifyInstance {
    sse: SseBroker;
  }
}

interface KlientForbindelse {
  id: string;
  reply: FastifyReply;
  enhed_id?: string;
  bruger_id?: string;
}

const ssePluginCallback: FastifyPluginAsync = async (app: FastifyInstance) => {
  const forbindelser = new Set<KlientForbindelse>();

  // Periodisk keep-alive kommentar hver 15. sekund jf. T115
  const keepAliveInterval = setInterval(() => {
    for (const klient of forbindelser) {
      klient.reply.raw.write(': keep-alive\n\n');
    }
  }, 15000);

  app.addHook('onClose', (_instance, done) => {
    clearInterval(keepAliveInterval);
    for (const klient of forbindelser) {
      klient.reply.raw.end();
    }
    forbindelser.clear();
    done();
  });

  const broker: SseBroker = {
    udsendEvent(kanal: SseKanal, payload: object) {
      const data = JSON.stringify(payload);
      const besked = `event: ${kanal}\ndata: ${data}\n\n`;
      for (const klient of forbindelser) {
        klient.reply.raw.write(besked);
      }
    },
  };

  app.decorate('sse', broker);

  // GET /api/v1/events
  app.get('/events', async (request: FastifyRequest, reply: FastifyReply) => {
    // Verificér godkendelse: Enten gyldig session ELLER X-Enhed-Noegle
    const session = hentSession(request, app.ur());
    let enhedId: string | undefined = session?.enhed_id;
    let brugerId: string | undefined = session?.bruger_id;

    if (!session) {
      const enhedNoegle = request.headers['x-enhed-noegle'];
      if (typeof enhedNoegle === 'string') {
        const enhedService = new EnhedService(app.prisma);
        const enhed = await enhedService.findAktivEnhedVedNoegle(enhedNoegle);
        if (enhed) {
          enhedId = enhed.id;
        }
      }
    }

    if (!session && !enhedId) {
      return reply.status(401).send({
        kode: 'IKKE_AUTORISERET',
        besked: 'Kræver aktiv session eller gyldig enhedsnøgle for SSE-forbindelse',
      });
    }

    // Etabler SSE stream headers
    reply.raw.setHeader('Content-Type', 'text/event-stream');
    reply.raw.setHeader('Cache-Control', 'no-cache, no-transform');
    reply.raw.setHeader('Connection', 'keep-alive');
    reply.raw.setHeader('X-Accel-Buffering', 'no');
    reply.raw.flushHeaders();

    const klient: KlientForbindelse = {
      id: Math.random().toString(36).substring(2),
      reply,
      enhed_id: enhedId,
      bruger_id: brugerId,
    };

    forbindelser.add(klient);

    // Send indledende kommentar / hilsen
    reply.raw.write(': velkommen\n\n');

    request.raw.on('close', () => {
      forbindelser.delete(klient);
    });

    // Returner reply for at forhindre Fastify i at lukke socketen automatisk
    return reply;
  });
};

export const ssePlugin = fp(ssePluginCallback, {
  name: 'sse-plugin',
});

