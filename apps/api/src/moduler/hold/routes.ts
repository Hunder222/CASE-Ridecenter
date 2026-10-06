import { Hold } from '@ridecenter/contracts';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { datoKolonne, iDag } from '../../faelles';
import { kraevRoller } from '../../plugins/rbac';

// Hold (T081): sorteret på ugedag og starttid med antal aktive tilmeldinger. Oprettelse kommer i Fase 2.
export const holdRuter: FastifyPluginAsyncZod = async (app) => {
  app.get(
    '/hold',
    { onRequest: kraevRoller('Ledelse', 'Ridelaerer'), schema: { response: { 200: z.array(Hold) } } },
    async () => {
      const idag = datoKolonne(iDag(app.ur()));
      const hold = await app.prisma.hold.findMany({
        orderBy: [{ ugedag: 'asc' }, { starttid: 'asc' }],
        include: {
          _count: {
            select: {
              tilmeldinger: {
                where: {
                  gyldig_fra: { lte: idag },
                  OR: [{ gyldig_til: null }, { gyldig_til: { gte: idag } }],
                },
              },
            },
          },
        },
      });
      return hold.map((h) => ({
        id: h.id,
        holdnavn: h.holdnavn,
        niveau: h.niveau,
        er_springhold: h.er_springhold,
        ugedag: h.ugedag,
        starttid: h.starttid,
        varighed_min: h.varighed_min,
        max_kapacitet: h.max_kapacitet,
        fast_underviser_id: h.fast_underviser_id,
        antal_tilmeldte: h._count.tilmeldinger,
      }));
    },
  );
};
