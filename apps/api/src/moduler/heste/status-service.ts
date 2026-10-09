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
      // Map alvorlighed til DB enum (Info, Obs, KanIkkeBruges)
      const dbAlvorlighed =
        input.alvorlighed === 'Raskmeldt'
          ? 'Info'
          : ['Sygemeldt', 'Skadet', 'Karantaene', 'KanIkkeBruges'].includes(input.alvorlighed)
          ? 'KanIkkeBruges'
          : input.alvorlighed;

      const dbBeskrivelse =
        input.alvorlighed === 'Raskmeldt' && !input.beskrivelse.toLowerCase().includes('rask')
          ? `[Raskmeldt] ${input.beskrivelse}`
          : input.alvorlighed === 'Skadet' && !input.beskrivelse.toLowerCase().includes('skad')
          ? `[Skadet] ${input.beskrivelse}`
          : input.alvorlighed === 'Karantaene' && !input.beskrivelse.toLowerCase().includes('karant')
          ? `[Karantæne] ${input.beskrivelse}`
          : input.beskrivelse;

      const melding = await tx.hestestatusmelding.create({
        data: {
          hest_id: hestId,
          type: input.type,
          alvorlighed: dbAlvorlighed as any,
          beskrivelse: dbBeskrivelse,
          meldt_af_bruger_id: bruger?.id ?? null,
          meldt_af_navn: brugerNavn,
          klient_tidspunkt: tidspunktKlient,
          server_tidspunkt: nu,
          kommando_id: cmdId,
        },
      });

      // Opdater hestens sundhedsstatus i henhold til meldingen
      let nySundhedsstatus = hest.sundhedsstatus;
      if (input.alvorlighed === 'KanIkkeBruges' || input.alvorlighed === 'Sygemeldt') {
        nySundhedsstatus = 'Sygemeldt';
      } else if (input.alvorlighed === 'Skadet') {
        nySundhedsstatus = 'Skadet';
      } else if (input.alvorlighed === 'Karantaene') {
        nySundhedsstatus = 'Karantaene';
      } else if (input.alvorlighed === 'Raskmeldt') {
        nySundhedsstatus = 'Aktiv';
      }

      if (nySundhedsstatus !== hest.sundhedsstatus) {
        await tx.hest.update({
          where: { id: hestId },
          data: { sundhedsstatus: nySundhedsstatus as any },
        });

        if (nySundhedsstatus === 'Aktiv') {
          // Fjern eventuel aktiv HEST_UDE_AF_DRIFT notifikation
          await tx.dashboardNotifikation.deleteMany({
            where: { dedupe_noegle: `HEST_UDE_AF_DRIFT:${hestId}` },
          });
        } else {
          // Opret dashboard-notifikation HEST_UDE_AF_DRIFT
          await tx.dashboardNotifikation.create({
            data: {
              type: 'HEST_UDE_AF_DRIFT',
              payload: {
                hest_id: hestId,
                hest_navn: hest.navn,
                alvorlighed: input.alvorlighed,
                sundhedsstatus: nySundhedsstatus,
                beskrivelse: input.beskrivelse,
                meldt_af: brugerNavn,
              },
              dedupe_noegle: `HEST_UDE_AF_DRIFT:${hestId}`,
            },
          });
        }
      }

      await logHaendelse(tx, {
        handling: 'HEST_AENDRET',
        entitet: 'hest',
        entitet_id: hestId,
        bruger,
        tidspunkt: nu,
        foer: { sundhedsstatus: hest.sundhedsstatus },
        efter: {
          sundhedsstatus: nySundhedsstatus,
          melding: input,
        },
      });

      // Udsend SSE
      this.app.sse?.udsendEvent('hest.status', {
        hest_id: hestId,
        sundhedsstatus: nySundhedsstatus,
        melding: input,
      });

      return melding;
    });
  }
}

