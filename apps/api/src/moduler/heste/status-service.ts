import crypto from 'node:crypto';
import type { HestestatusmeldingInput } from '@ridecenter/contracts';
import type { PrismaClient } from '@prisma/client';
import type { FastifyInstance } from 'fastify';
import { logHaendelse } from '../audit/audit-service';
import { DomaeneFejl } from '../../plugins/fejl';
import type { SessionBruger } from '../../plugins/rbac';

export class StatusService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly app: FastifyInstance,
  ) {}

  /**
   * Melder hestestatus (helbred/adfærd).
   * Tilladt for alle roller ('Staldelev', 'Ridelaerer', 'Vikar', 'Ledelse') - fail-safe.
   * Ved 'KanIkkeBruges' sættes hestens sundhedsstatus straks til 'Sygemeldt'.
   */
  async meldHestStatus(
    hestId: string,
    input: HestestatusmeldingInput,
    bruger: SessionBruger | null,
    klientTid?: Date,
    kommandoId?: string,
  ) {
    const hest = await this.prisma.hest.findUnique({
      where: { id: hestId },
    });
    if (!hest) {
      throw new DomaeneFejl('HEST_IKKE_FUNDET', 'Hesten findes ikke', 404);
    }

    const nu = this.app.ur();
    const tidspunktKlient = klientTid ?? nu;
    const cmdId = kommandoId ?? crypto.randomUUID();
    const brugerNavn = bruger?.navn ?? 'Stald-bruger';

    return this.prisma.$transaction(async (tx) => {
      // Opret post i append-only hestestatusmelding 🧾
      const melding = await tx.hestestatusmelding.create({
        data: {
          hest_id: hestId,
          type: input.type,
          alvorlighed: input.alvorlighed,
          beskrivelse: input.beskrivelse,
          meldt_af_bruger_id: bruger?.id ?? null,
          meldt_af_navn: brugerNavn,
          klient_tidspunkt: tidspunktKlient,
          server_tidspunkt: nu,
          kommando_id: cmdId,
        },
      });

      // Fail-safe: Ved KanIkkeBruges sættes hesten straks til Sygemeldt
      if (input.alvorlighed === 'KanIkkeBruges') {
        await tx.hest.update({
          where: { id: hestId },
          data: { sundhedsstatus: 'Sygemeldt' },
        });

        // Opret dashboard-notifikation HEST_UDE_AF_DRIFT
        await tx.dashboardNotifikation.create({
          data: {
            type: 'HEST_UDE_AF_DRIFT',
            payload: {
              hest_id: hestId,
              hest_navn: hest.navn,
              alvorlighed: input.alvorlighed,
              beskrivelse: input.beskrivelse,
              meldt_af: brugerNavn,
            },
            dedupe_noegle: `HEST_UDE_AF_DRIFT:${hestId}`,
          },
        });
      }

      await logHaendelse(tx, {
        handling: 'HEST_AENDRET',
        entitet: 'hest',
        entitet_id: hestId,
        bruger,
        tidspunkt: nu,
        foer: { sundhedsstatus: hest.sundhedsstatus },
        efter: {
          sundhedsstatus: input.alvorlighed === 'KanIkkeBruges' ? 'Sygemeldt' : hest.sundhedsstatus,
          melding: input,
        },
      });

      // Udsend SSE
      this.app.sse?.udsendEvent('hest.status', {
        hest_id: hestId,
        sundhedsstatus: input.alvorlighed === 'KanIkkeBruges' ? 'Sygemeldt' : hest.sundhedsstatus,
        melding: input,
      });

      return melding;
    });
  }
}

