import type { PrismaClient } from '@prisma/client';
import {
  beregnHash,
  GENESIS_HASH,
  hashIndholdFraRaekke,
} from './audit-service';

export interface AuditVerificerResultat {
  gyldig: boolean;
  antal_haendelser: number;
  seneste_hash: string;
  brud_ved_seq?: number;
}

export class AuditVerificerService {
  constructor(private readonly prisma: PrismaClient) {}

  /**
   * Gennemgår hele audit_haendelse-tabellen fra server_seq = 1 og genesis-hash (64 x '0'),
   * genberegner SHA-256 for hver række og verificerer at kæden er ubrudt (T164, FR-019).
   */
  async verificerHashkaede(): Promise<AuditVerificerResultat> {
    const haendelser = await this.prisma.auditHaendelse.findMany({
      orderBy: { server_seq: 'asc' },
    });

    if (haendelser.length === 0) {
      return {
        gyldig: true,
        antal_haendelser: 0,
        seneste_hash: GENESIS_HASH,
      };
    }

    let forventetForrigeHash = GENESIS_HASH;

    for (const h of haendelser) {
      // 1. Tjek om rækkens forrige_hash matcher den akkumulerede forrige hash
      if (h.forrige_hash !== forventetForrigeHash) {
        return {
          gyldig: false,
          antal_haendelser: haendelser.length,
          seneste_hash: h.hash,
          brud_ved_seq: Number(h.server_seq),
        };
      }

      // 2. Genberegn rækkens hash
      const indhold = hashIndholdFraRaekke(h);
      const beregnetHash = beregnHash(forventetForrigeHash, indhold);

      if (beregnetHash !== h.hash) {
        return {
          gyldig: false,
          antal_haendelser: haendelser.length,
          seneste_hash: h.hash,
          brud_ved_seq: Number(h.server_seq),
        };
      }

      forventetForrigeHash = h.hash;
    }

    const seneste = haendelser[haendelser.length - 1];

    return {
      gyldig: true,
      antal_haendelser: haendelser.length,
      seneste_hash: seneste ? seneste.hash : GENESIS_HASH,
    };
  }
}

