import type { Rolle } from '@ridecenter/contracts';
import type { FastifyRequest } from 'fastify';
import { hentSession } from '../moduler/auth/session';
import { DomaeneFejl } from './fejl';

// RBAC pr. endpoint (contracts/ui-routes.md, RBAC-matrix, og x-roller i openapi.yaml).
// RBAC pr. felt håndhæves af response-skemaerne, som fjerner felter, der ikke står i DTO'en.

export interface SessionBruger {
  id: string;
  navn: string;
  roller: Rolle[];
  /** Sat for stald-sessioner (PIN/vikar) på en betroet enhed. */
  enhed_id?: string;
}

export function kraevRoller(...roller: Rolle[]) {
  return async function kontrollerAdgang(request: FastifyRequest): Promise<void> {
    const session = hentSession(request, request.server.ur());
    if (!session) throw new DomaeneFejl('IKKE_LOGGET_IND', 'Log ind for at fortsætte', 401);
    if (!session.roller.some((rolle) => roller.includes(rolle))) {
      throw new DomaeneFejl('INGEN_ADGANG', 'Du har ikke adgang til denne funktion', 403);
    }
    request.bruger = {
      id: session.bruger_id,
      navn: session.navn,
      roller: session.roller,
      ...(session.enhed_id ? { enhed_id: session.enhed_id } : {}),
    };
  };
}

export function erLedelse(bruger: SessionBruger): boolean {
  return bruger.roller.includes('Ledelse');
}

/** Brugeren sat af kraevRoller. Kaster, hvis ruten mangler kraevRoller (programmeringsfejl). */
export function aktuelBruger(request: FastifyRequest): SessionBruger {
  if (!request.bruger) throw new Error('Ruten mangler kraevRoller');
  return request.bruger;
}
