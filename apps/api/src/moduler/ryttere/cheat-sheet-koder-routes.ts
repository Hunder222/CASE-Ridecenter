import { CheatSheetKort, Uuid } from '@ridecenter/contracts';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { kraevRoller } from '../../plugins/rbac';
import { CheatSheetService } from './cheat-sheet-service';

export const cheatSheetRuter: FastifyPluginAsyncZod = async (app) => {
  const service = new CheatSheetService(app.prisma, app.krypto);

  // GET /lektioner/:id/cheat-sheet (Ridelaerer, Vikar, Ledelse)
  app.get(
    '/lektioner/:id/cheat-sheet',
    {
      onRequest: kraevRoller('Ridelaerer', 'Vikar', 'Ledelse'),
      schema: {
        params: z.object({ id: Uuid }),
        response: { 200: z.array(CheatSheetKort) },
      },
    },
    async (request) => {
      return service.hentLektionCheatSheet(request.params.id);
    },
  );

  // CRUD for CheatSheetKode katalog
  app.get(
    '/cheat-sheet-koder',
    {
      onRequest: kraevRoller('Ledelse', 'Ridelaerer', 'Vikar'),
      schema: {
        response: {
          200: z.array(
            z.object({
              kode: z.string(),
              tekst: z.string(),
              kategori: z.enum(['Haandtering', 'Afstand', 'Opstigning', 'Kommunikation']),
            }),
          ),
        },
      },
    },
    async () => {
      return app.prisma.cheatSheetKode.findMany({
        orderBy: [{ kategori: 'asc' }, { kode: 'asc' }],
      });
    },
  );
};

