import type { PrismaClient } from '@prisma/client';
import type { Config } from './config';
import type { Krypto } from './plugins/krypto';
import type { SessionBruger } from './plugins/rbac';
import type { SseBroker } from './plugins/sse';

declare module 'fastify' {
  interface FastifyInstance {
    config: Config;
    prisma: PrismaClient;
    /** Injicerbart ur, så tests kan styre "nu" og "i dag". */
    ur: () => Date;
    krypto: Krypto;
    sse: SseBroker;
  }

  interface FastifyRequest {
    /** Sættes af kraevRoller. */
    bruger?: SessionBruger;
    /** Sættes af kraevEnhed. */
    enhed?: {
      id: string;
      navn: string;
    };
  }
}
