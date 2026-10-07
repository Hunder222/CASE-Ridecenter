import {
  Hold,
  HoldInput,
  HoldOpdatering,
  Holdtilmelding,
  HoldtilmeldingInput,
  Uuid,
} from '@ridecenter/contracts';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { datoKolonne, iDag } from '../../faelles';
import { DomaeneFejl } from '../../plugins/fejl';
import { kraevRoller } from '../../plugins/rbac';

export const holdAdminRuter: FastifyPluginAsyncZod = async (app) => {
  // GET /hold (Ledelse, Ridelaerer)
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
                  OR: [{ gyldig_til: null }, { gyldig_til: { gt: idag } }],
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

  // POST /hold (Ledelse)
  app.post(
    '/hold',
    {
      onRequest: kraevRoller('Ledelse'),
      schema: {
        body: HoldInput,
        response: { 201: Hold },
      },
    },
    async (request, reply) => {
      const input = request.body;

      // Valider at underviser findes
      const underviser = await app.prisma.bruger.findUnique({
        where: { id: input.fast_underviser_id },
      });
      if (!underviser) {
        throw new DomaeneFejl('UNDERVISER_IKKE_FUNDET', 'Fast underviser findes ikke', 404);
      }

      const oprettet = await app.prisma.hold.create({
        data: {
          holdnavn: input.holdnavn,
          niveau: input.niveau,
          er_springhold: input.er_springhold,
          ugedag: input.ugedag,
          starttid: input.starttid,
          varighed_min: input.varighed_min,
          max_kapacitet: input.max_kapacitet,
          fast_underviser_id: input.fast_underviser_id,
        },
      });

      return reply.code(201).send({
        id: oprettet.id,
        holdnavn: oprettet.holdnavn,
        niveau: oprettet.niveau,
        er_springhold: oprettet.er_springhold,
        ugedag: oprettet.ugedag,
        starttid: oprettet.starttid,
        varighed_min: oprettet.varighed_min,
        max_kapacitet: oprettet.max_kapacitet,
        fast_underviser_id: oprettet.fast_underviser_id,
        antal_tilmeldte: 0,
      });
    },
  );

  // PATCH /hold/:id (Ledelse)
  app.patch(
    '/hold/:id',
    {
      onRequest: kraevRoller('Ledelse'),
      schema: {
        params: z.object({ id: Uuid }),
        body: HoldOpdatering,
        response: { 200: Hold },
      },
    },
    async (request) => {
      const { id } = request.params;
      const input = request.body;

      const hold = await app.prisma.hold.findUnique({ where: { id } });
      if (!hold) {
        throw new DomaeneFejl('HOLD_IKKE_FUNDET', 'Holdet findes ikke', 404);
      }

      if (input.fast_underviser_id) {
        const underviser = await app.prisma.bruger.findUnique({
          where: { id: input.fast_underviser_id },
        });
        if (!underviser) {
          throw new DomaeneFejl('UNDERVISER_IKKE_FUNDET', 'Fast underviser findes ikke', 404);
        }
      }

      const opdateret = await app.prisma.hold.update({
        where: { id },
        data: input,
        include: {
          _count: {
            select: {
              tilmeldinger: {
                where: {
                  gyldig_fra: { lte: datoKolonne(iDag(app.ur())) },
                  OR: [
                    { gyldig_til: null },
                    { gyldig_til: { gt: datoKolonne(iDag(app.ur())) } },
                  ],
                },
              },
            },
          },
        },
      });

      return {
        id: opdateret.id,
        holdnavn: opdateret.holdnavn,
        niveau: opdateret.niveau,
        er_springhold: opdateret.er_springhold,
        ugedag: opdateret.ugedag,
        starttid: opdateret.starttid,
        varighed_min: opdateret.varighed_min,
        max_kapacitet: opdateret.max_kapacitet,
        fast_underviser_id: opdateret.fast_underviser_id,
        antal_tilmeldte: opdateret._count.tilmeldinger,
      };
    },
  );

  // GET /hold/:id/tilmeldinger (Ledelse, Ridelaerer)
  app.get(
    '/hold/:id/tilmeldinger',
    {
      onRequest: kraevRoller('Ledelse', 'Ridelaerer'),
      schema: {
        params: z.object({ id: Uuid }),
        response: { 200: z.array(Holdtilmelding) },
      },
    },
    async (request) => {
      const { id } = request.params;
      const idag = datoKolonne(iDag(app.ur()));

      const tilmeldinger = await app.prisma.holdtilmelding.findMany({
        where: {
          hold_id: id,
          gyldig_fra: { lte: idag },
          OR: [{ gyldig_til: null }, { gyldig_til: { gt: idag } }],
        },
        include: { rytter: true },
        orderBy: { ancienitet_dato: 'asc' },
      });

      return tilmeldinger.map((t) => ({
        id: t.id,
        rytter_id: t.rytter_id,
        hold_id: t.hold_id,
        gyldig_fra: t.gyldig_fra.toISOString().slice(0, 10),
        gyldig_til: t.gyldig_til ? t.gyldig_til.toISOString().slice(0, 10) : null,
        ancienitet_dato: t.ancienitet_dato.toISOString().slice(0, 10),
        rytter_navn: `${t.rytter.fornavn} ${t.rytter.efternavn}`,
      }));
    },
  );

  // POST /hold/:id/tilmeldinger (Ledelse)
  app.post(
    '/hold/:id/tilmeldinger',
    {
      onRequest: kraevRoller('Ledelse'),
      schema: {
        params: z.object({ id: Uuid }),
        body: HoldtilmeldingInput,
        response: { 201: Holdtilmelding },
      },
    },
    async (request, reply) => {
      const { id: holdId } = request.params;
      const input = request.body;
      const nu = app.ur();
      const idag = datoKolonne(iDag(nu));

      const hold = await app.prisma.hold.findUnique({
        where: { id: holdId },
        include: {
          _count: {
            select: {
              tilmeldinger: {
                where: {
                  gyldig_fra: { lte: idag },
                  OR: [{ gyldig_til: null }, { gyldig_til: { gt: idag } }],
                },
              },
            },
          },
        },
      });

      if (!hold) {
        throw new DomaeneFejl('HOLD_IKKE_FUNDET', 'Holdet findes ikke', 404);
      }

      if (hold._count.tilmeldinger >= hold.max_kapacitet) {
        throw new DomaeneFejl('HOLD_FULDT', 'Holdet har nået sin maksimale kapacitet', 409);
      }

      const rytter = await app.prisma.rytter.findUnique({
        where: { id: input.rytter_id },
      });
      if (!rytter) {
        throw new DomaeneFejl('RYTTER_IKKE_FUNDET', 'Rytteren findes ikke', 404);
      }

      const gyldigFra = input.gyldig_fra ? new Date(input.gyldig_fra) : idag;
      const ancienitetDato = input.ancienitet_dato ? new Date(input.ancienitet_dato) : idag;

      const oprettet = await app.prisma.holdtilmelding.create({
        data: {
          hold_id: holdId,
          rytter_id: input.rytter_id,
          gyldig_fra: gyldigFra,
          ancienitet_dato: ancienitetDato,
        },
        include: { rytter: true },
      });

      return reply.code(201).send({
        id: oprettet.id,
        rytter_id: oprettet.rytter_id,
        hold_id: oprettet.hold_id,
        gyldig_fra: oprettet.gyldig_fra.toISOString().slice(0, 10),
        gyldig_til: null,
        ancienitet_dato: oprettet.ancienitet_dato.toISOString().slice(0, 10),
        rytter_navn: `${oprettet.rytter.fornavn} ${oprettet.rytter.efternavn}`,
      });
    },
  );

  // DELETE /hold/:id/tilmeldinger/:tilmeldingId (Ledelse)
  app.delete(
    '/hold/:id/tilmeldinger/:tilmeldingId',
    {
      onRequest: kraevRoller('Ledelse'),
      schema: {
        params: z.object({ id: Uuid, tilmeldingId: Uuid }),
        response: { 200: z.object({ ok: z.boolean() }) },
      },
    },
    async (request) => {
      const { id: holdId, tilmeldingId } = request.params;
      const idag = datoKolonne(iDag(app.ur()));

      const tilmelding = await app.prisma.holdtilmelding.findFirst({
        where: { id: tilmeldingId, hold_id: holdId },
      });

      if (!tilmelding) {
        throw new DomaeneFejl('TILMELDING_IKKE_FUNDET', 'Tilmeldingen findes ikke på holdet', 404);
      }

      await app.prisma.holdtilmelding.update({
        where: { id: tilmeldingId },
        data: { gyldig_til: idag },
      });

      return { ok: true };
    },
  );
};
