import crypto from 'node:crypto';
import type { PrismaClient } from '@prisma/client';
import { klassificerAfbud } from '@ridecenter/domain';
import { DomaeneFejl } from '../../plugins/fejl';
import { logHaendelse } from '../audit/audit-service';
import { VentelisteService } from '../venteliste/venteliste-service';

export class AfbudService {
  private readonly ventelisteService: VentelisteService;

  constructor(
    private readonly prisma: PrismaClient,
    private readonly app?: any,
  ) {
    this.ventelisteService = new VentelisteService(prisma, app?.log);
  }

  /**
   * Registrerer afbud for en lektionsplads jf. FR-015 og SC-006.
   * - Klassificerer som Afbud_rettidigt (før kl. 12:00) eller Afbud_for_sent.
   * - Opretter fremmoederegistrering 🧾 ⛓.
   * - Frigør hesten for lektionen (reducerer belastning).
   * - Ved rettidigt afbud: kalder asynkront genbesættelse (< 5 sek.).
   */
  async registrerAfbud(
    lektionId: string,
    input: {
      lektionsplads_id: string;
      modtaget_tidspunkt?: string;
    },
    bruger: any,
  ) {
    const plads = await this.prisma.lektionsPlads.findUnique({
      where: { id: input.lektionsplads_id },
      include: {
        lektion: {
          include: { hold: true },
        },
      },
    });

    if (!plads || plads.lektion_id !== lektionId) {
      throw new DomaeneFejl('PLADS_IKKE_FUNDET', 'Lektionspladsen findes ikke på denne lektion', 404);
    }

    const nu = this.app?.ur ? this.app.ur() : new Date();
    const modtagetTidspunkt = input.modtaget_tidspunkt ? new Date(input.modtaget_tidspunkt) : nu;
    const lektionDatoStr = plads.lektion.dato.toISOString().slice(0, 10);

    const afbudStatus = klassificerAfbud({
      lektionDato: lektionDatoStr,
      modtagetTidspunkt,
    });

    const kommandoId = crypto.randomUUID();
    const frigjortHestId = plads.aktuel_hest_id;

    // Transaktion for fremmøderegistrering og hestefrigørelse
    const registrering = await this.prisma.$transaction(async (tx) => {
      // Find seneste hash for hashkæden
      const senesteReg = await tx.fremmoederegistrering.findFirst({
        orderBy: { server_tidspunkt: 'desc' },
        select: { hash: true },
      });
      const forrigeHash = senesteReg?.hash ?? '0'.repeat(64);

      // Frigør aktuel hest
      await tx.lektionsPlads.update({
        where: { id: plads.id },
        data: {
          aktuel_hest_id: null,
        },
      });

      const hashData = `${forrigeHash}:${plads.id}:${afbudStatus}:${nu.toISOString()}`;
      const hash = crypto.createHash('sha256').update(hashData).digest('hex');

      const nyReg = await tx.fremmoederegistrering.create({
        data: {
          lektionsplads_id: plads.id,
          lektion_dato: plads.lektion.dato,
          hold_id: plads.lektion.hold_id,
          rytter_id: plads.rytter_id,
          hest_id: frigjortHestId,
          status: afbudStatus,
          modtaget_tidspunkt: modtagetTidspunkt,
          registreret_af_bruger_id: bruger?.id ?? null,
          registreret_af_navn: bruger?.navn ?? 'System',
          klient_tidspunkt: modtagetTidspunkt,
          server_tidspunkt: nu,
          kommando_id: kommandoId,
          forrige_hash: forrigeHash,
          hash,
        },
      });

      await logHaendelse(tx, {
        handling: 'FREMMOEDE_KORRIGERET',
        entitet: 'fremmoederegistrering',
        entitet_id: nyReg.id,
        bruger,
        tidspunkt: nu,
        efter: { status: afbudStatus, modtaget: modtagetTidspunkt.toISOString() },
      });

      return nyReg;
    });

    // Udsend SSE event
    if (this.app?.sse) {
      this.app.sse.udsendEvent('plads.opdateret', {
        pladsId: plads.id,
        lektionId,
        status: afbudStatus,
      });
    }

    // Ved rettidigt afbud: Opret genbesættelsesforslag asynkront
    if (afbudStatus === 'Afbud_rettidigt') {
      try {
        await this.ventelisteService.opretGenbesaettelsesForslagForLektion(
          lektionId,
          frigjortHestId
        );
      } catch (err) {
        this.app?.log?.error({ err }, 'Fejl ved automatisk genbesættelsesforslag');
      }
    }

    return registrering;
  }
}

