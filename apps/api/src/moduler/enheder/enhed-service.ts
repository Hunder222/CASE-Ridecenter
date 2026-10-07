import crypto from 'node:crypto';
import type { PrismaClient } from '@prisma/client';
import type { FastifyRequest } from 'fastify';
import { DomaeneFejl } from '../../plugins/fejl';

export function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export function genererTilfaeldigHex(bytes: number): string {
  return crypto.randomBytes(bytes).toString('hex');
}

export class EnhedService {
  constructor(private readonly prisma: PrismaClient) {}

  /**
   * Genererer et engangs enrollment-token på 32 hex-tegn,
   * gemmer sha256-hash i en ny Enhed og returnerer klartekst-tokenet.
   */
  async udstedEnhed(navn: string) {
    const enrollmentToken = genererTilfaeldigHex(16); // 16 bytes = 32 hex tegn
    const enrollmentTokenHash = hashToken(enrollmentToken);

    const enhed = await this.prisma.enhed.create({
      data: {
        navn,
        enrollment_token_hash: enrollmentTokenHash,
        aktiv: true,
      },
    });

    return {
      enhed_id: enhed.id,
      navn: enhed.navn,
      enrollment_token: enrollmentToken,
    };
  }

  /**
   * En ny enhed indløser sit enrollment-token én gang.
   * Der genereres en 64-tegns hex enhedsnøgle, hvis hash gemmes.
   * enrollment_token_hash overskrives så den ikke kan genbruges.
   */
  async registrerEnhed(enrollmentToken: string) {
    const tokenHash = hashToken(enrollmentToken);

    const enhed = await this.prisma.enhed.findFirst({
      where: {
        enrollment_token_hash: tokenHash,
        aktiv: true,
      },
    });

    if (!enhed || enhed.enhedsnoegle_hash) {
      throw new DomaeneFejl('ENHED_IKKE_BETROET', 'Ugyldigt eller allerede anvendt enrollment-token', 401);
    }

    const enhedsnoegle = genererTilfaeldigHex(32); // 32 bytes = 64 hex tegn
    const enhedsnoegleHash = hashToken(enhedsnoegle);

    await this.prisma.enhed.update({
      where: { id: enhed.id },
      data: {
        enhedsnoegle_hash: enhedsnoegleHash,
        sidst_synkroniseret: new Date(),
      },
    });

    return {
      enhed_id: enhed.id,
      navn: enhed.navn,
      enhedsnoegle,
    };
  }

  /**
   * Validerer en enhedsnøgle.
   */
  async findAktivEnhedVedNoegle(enhedsnoegle: string) {
    const noegleHash = hashToken(enhedsnoegle);
    const enhed = await this.prisma.enhed.findFirst({
      where: {
        enhedsnoegle_hash: noegleHash,
        aktiv: true,
      },
    });
    return enhed;
  }
}

/**
 * Fastify preHandler middleware som sikrer at anmodningen kommer fra en betroet enhed
 * via X-Enhed-Noegle headeren.
 */
export async function kraevEnhed(request: FastifyRequest): Promise<void> {
  const noegle = request.headers['x-enhed-noegle'];
  if (!noegle || typeof noegle !== 'string') {
    throw new DomaeneFejl('ENHED_IKKE_BETROET', 'Enheden er ikke autoriseret (header mangler)', 401);
  }

  const enhedService = new EnhedService(request.server.prisma);
  const enhed = await enhedService.findAktivEnhedVedNoegle(noegle);

  if (!enhed) {
    throw new DomaeneFejl('ENHED_IKKE_BETROET', 'Enheden er ikke autoriseret eller er deaktiveret', 401);
  }

  request.enhed = {
    id: enhed.id,
    navn: enhed.navn,
  };
}

