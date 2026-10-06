import type { PrismaClient } from '@prisma/client';
import type { Config } from './config';
import type { Krypto } from './plugins/krypto';
import type { SessionBruger } from './plugins/rbac';

declare module 'fastify' {
  interface FastifyInstance {
    config: Config;
    prisma: PrismaClient;
    /** Injicerbart ur, så tests kan styre "nu" og "i dag". */
    ur: () => Date;
    krypto: Krypto;
  }

  interface FastifyRequest {
    /** Sættes af kraevRoller. */
    bruger?: SessionBruger;
  }
}
