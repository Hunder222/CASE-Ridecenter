import type { FastifyInstance } from 'fastify';
import { dekrypter, krypter } from '../krypto/aes-gcm';

export interface Krypto {
  krypter(klartekst: string): string;
  dekrypter(chiffer: string): string;
}

export function registrerKrypto(app: FastifyInstance, noegle: Buffer): void {
  const krypto: Krypto = {
    krypter: (klartekst) => krypter(noegle, klartekst),
    dekrypter: (chiffer) => dekrypter(noegle, chiffer),
  };
  app.decorate('krypto', krypto);
}
