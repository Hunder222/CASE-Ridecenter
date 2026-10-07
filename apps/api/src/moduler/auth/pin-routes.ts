import { Fejl, Session } from '@ridecenter/contracts';
import { PinLoginBody } from '@ridecenter/contracts';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { kraevEnhed } from '../enheder/enhed-service';
import { PinLaas, validerPin } from './pin-service';
import { opretSession } from './session';
import { DomaeneFejl } from '../../plugins/fejl';
import { logHaendelse } from '../audit/audit-service';

export const pinRuter: FastifyPluginAsyncZod = async (app) => {
  const pinLaas = new PinLaas(app.ur);

  app.post(
    '/auth/pin',
    {
      preHandler: [kraevEnhed],
      schema: {
        body: PinLoginBody,
        response: {
          200: Session,
          401: Fejl,
          429: Fejl,
        },
      },
    },
    async (request, reply) => {
      const enhedId = request.enhed!.id;

      // Tjek lockout
      const sekunderTilbage = pinLaas.spaerretSekunder(enhedId);
      if (sekunderTilbage > 0) {
        throw new DomaeneFejl(
          'PIN_LOCKOUT',
          'For mange forkerte forsøg. Prøv igen om 60 sekunder',
          429,
        );
      }

      const { pin } = request.body;

      // Find alle aktive brugere med stald-adgang (Ridelaerer, Ledelse, Staldelev) som har pin_hash
      const brugere = await app.prisma.bruger.findMany({
        where: {
          aktiv: true,
          pin_hash: { not: null },
          roller: {
            hasSome: ['Ridelaerer', 'Ledelse', 'Staldelev'],
          },
        },
      });

      let matchendeBruger = null;

      for (const bruger of brugere) {
        if (bruger.pin_hash) {
          const matcher = await validerPin(pin, bruger.pin_hash);
          if (matcher) {
            matchendeBruger = bruger;
            break;
          }
        }
      }

      if (!matchendeBruger) {
        pinLaas.registrerFejl(enhedId);
        throw new DomaeneFejl('UGYLDIG_PIN', 'Forkert PIN-kode', 401);
      }

      // Nulstil fejl ved succes
      pinLaas.nulstil(enhedId);

      // Audit-log login
      await app.prisma.$transaction(async (tx) => {
        await logHaendelse(tx, {
          handling: 'LOGIN_PIN',
          entitet: 'bruger',
          entitet_id: matchendeBruger.id,
          bruger: {
            id: matchendeBruger.id,
            navn: matchendeBruger.navn,
            roller: matchendeBruger.roller,
            enhed_id: enhedId,
          },
          tidspunkt: app.ur(),
          enhed_id: enhedId,
          foer: null,
          efter: { navn: matchendeBruger.navn },
        });
      });

      return opretSession(
        reply,
        matchendeBruger,
        app.ur(),
        app.config.NODE_ENV === 'production',
        { enhed_id: enhedId },
      );
    },
  );
};
