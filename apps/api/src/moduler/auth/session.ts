import { Rolle } from '@ridecenter/contracts';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';

// Statsløs, signeret session-cookie (POC). Roller og udløb ligger i cookien, så en rolleændring
// slår først igennem ved næste login, og logout sletter kun cookien i browseren.

export const SESSION_COOKIE = 'session';
const VARIGHED_MS = 8 * 60 * 60 * 1000;

const SessionIndhold = z.object({
  bruger_id: z.uuid(),
  navn: z.string(),
  roller: z.array(Rolle).min(1),
  udloeber: z.iso.datetime(),
  /** Sat ved PIN-login og vikarlogin på en betroet stald-enhed. */
  enhed_id: z.uuid().optional(),
});
export type SessionIndhold = z.infer<typeof SessionIndhold>;

export interface SessionValg {
  enhed_id?: string;
  /** Overstyrer standardvarigheden (8 timer), f.eks. til stald-sessioner. */
  udloeber?: Date;
}

export function opretSession(
  reply: FastifyReply,
  bruger: { id: string; navn: string; roller: Rolle[] },
  nu: Date,
  sikkerCookie: boolean,
  valg: SessionValg = {},
): SessionIndhold {
  const udloeb = valg.udloeber ?? new Date(nu.getTime() + VARIGHED_MS);
  const session: SessionIndhold = {
    bruger_id: bruger.id,
    navn: bruger.navn,
    roller: bruger.roller,
    udloeber: udloeb.toISOString(),
    ...(valg.enhed_id ? { enhed_id: valg.enhed_id } : {}),
  };
  reply.setCookie(SESSION_COOKIE, JSON.stringify(session), {
    signed: true,
    httpOnly: true,
    sameSite: 'lax',
    secure: sikkerCookie,
    path: '/',
    maxAge: Math.max(1, Math.floor((udloeb.getTime() - nu.getTime()) / 1000)),
  });
  return session;
}

/** Gyldig session eller null (manglende, forfalsket, ugyldig eller udløbet cookie). */
export function hentSession(request: FastifyRequest, nu: Date): SessionIndhold | null {
  const raa = request.cookies[SESSION_COOKIE];
  if (!raa) return null;
  const usigneret = request.unsignCookie(raa);
  if (!usigneret.valid || usigneret.value === null) return null;

  let data: unknown;
  try {
    data = JSON.parse(usigneret.value);
  } catch {
    return null;
  }
  const resultat = SessionIndhold.safeParse(data);
  if (!resultat.success || new Date(resultat.data.udloeber) <= nu) return null;
  return resultat.data;
}

export function sletSession(reply: FastifyReply): void {
  reply.clearCookie(SESSION_COOKIE, { path: '/' });
}
