import crypto from 'node:crypto';
import type { Prisma, PrismaClient } from '@prisma/client';
import {
  beregnAutomatiskLukketid,
  erFremmoedeAabent,
  validerKorrektionBegrundelse,
} from '@ridecenter/domain';
import { DomaeneFejl } from '../../plugins/fejl';
import { logHaendelse } from '../audit/audit-service';

export interface BatchRegistreringInput {
  lektionId: string;
  registreringer: Array<{
    lektionsplads_id: string;
    status: 'Fremmoedt' | 'Udeblevet';
  }>;
  bruger: {
    id: string;
    navn: string;
    roller: string[];
  } | null;
  klientTidspunkt?: Date;
  enhedId?: string;
  kommandoId?: string;
}

export interface KorrektionInput {
  fremmoedeId: string;
  nyStatus: 'Fremmoedt' | 'Afbud_rettidigt' | 'Afbud_for_sent' | 'Udeblevet';
  begrundelse: string;
  bruger: {
    id: string;
    navn: string;
    roller: string[];
  } | null;
  klientTidspunkt?: Date;
  enhedId?: string;
  kommandoId?: string;
}

export class FremmoedeService {
  constructor(private readonly prisma: PrismaClient) {}

  private beregnSha256(tekst: string): string {
    return crypto.createHash('sha256').update(tekst).digest('hex');
  }

  /**
   * Batch-registrering af fremmøde for lektion (typisk via "Markér alle fremmødt" + undtagelser).
   */
  async registrerFremmoedeBatch(tx: Prisma.TransactionClient, input: BatchRegistreringInput, nu: Date) {
    const klientTid = input.klientTidspunkt ?? nu;

    const lektion = await tx.lektion.findUnique({
      where: { id: input.lektionId },
      include: { hold: true },
    });

    if (!lektion) {
      throw new DomaeneFejl('LEKTION_IKKE_FUNDET', 'Lektionen findes ikke', 404);
    }

    // Tjek om fremmødet er åbent
    const datoStr = lektion.dato.toISOString().slice(0, 10);
    const aabent = erFremmoedeAabent({
      dato: datoStr,
      starttid: lektion.hold.starttid,
      varighedMin: lektion.hold.varighed_min,
      lukketTidspunkt: lektion.fremmoede_lukket,
      nu: klientTid,
    });

    // Hvis lektionen allerede er lukket, må der ikke bruges batch-registrering uden begrundelse
    if (!aabent && lektion.fremmoede_lukket !== null) {
      throw new DomaeneFejl(
        'FREMMOEDE_LUKKET',
        'Fremmødet for denne lektion er lukket. Brug korrektion med begrundelse',
        409,
      );
    }

    const senesteFremmoede = await tx.fremmoederegistrering.findFirst({
      orderBy: { server_tidspunkt: 'desc' },
      select: { hash: true },
    });
    let forrigeHash = senesteFremmoede?.hash ?? '0'.repeat(64);

    const registrerede: Array<Awaited<ReturnType<typeof tx.fremmoederegistrering.create>>> = [];
    const registreretAfNavn = input.bruger?.navn ?? 'Stald-bruger';

    for (const reg of input.registreringer) {
      const plads = await tx.lektionsPlads.findUnique({
        where: { id: reg.lektionsplads_id },
      });

      if (!plads || plads.lektion_id !== lektion.id) {
        throw new DomaeneFejl('PLADS_IKKE_FUNDET', 'En eller flere lektionspladser findes ikke på lektionen', 422);
      }

      const kommandoId = input.kommandoId ?? crypto.randomUUID();
      const hashData = `${forrigeHash}:${plads.id}:${reg.status}:${klientTid.toISOString()}`;
      const nyHash = this.beregnSha256(hashData);

      const serverTid = new Date(nu.getTime() + registrerede.length);

      const oprettet = await tx.fremmoederegistrering.create({
        data: {
          lektionsplads_id: plads.id,
          lektion_dato: lektion.dato,
          hold_id: lektion.hold_id,
          rytter_id: plads.rytter_id,
          hest_id: plads.aktuel_hest_id,
          status: reg.status,
          registreret_af_bruger_id: input.bruger?.id,
          registreret_af_navn: registreretAfNavn,
          klient_tidspunkt: klientTid,
          server_tidspunkt: serverTid,
          enhed_id: input.enhedId,
          kommando_id: kommandoId,
          forrige_hash: forrigeHash,
          hash: nyHash,
        },
      });

      forrigeHash = nyHash;
      registrerede.push(oprettet);
    }

    return registrerede;
  }

  /**
   * Korrigerer en eksisterende fremmøderegistrering med obligatorisk begrundelse (mindst 5 tegn).
   */
  async korrigerFremmoede(tx: Prisma.TransactionClient, input: KorrektionInput, nu: Date) {
    if (!validerKorrektionBegrundelse(input.begrundelse)) {
      throw new DomaeneFejl(
        'BEGRUNDELSE_FOR_KORT',
        'Korrektionsbegrundelsen skal være mindst 5 tegn',
        422,
      );
    }

    const eksisterende = await tx.fremmoederegistrering.findUnique({
      where: { id: input.fremmoedeId },
      include: { lektionsplads: { include: { lektion: { include: { hold: true } } } } },
    });

    if (!eksisterende) {
      throw new DomaeneFejl(
        'REGISTRERING_IKKE_FUNDET',
        'Den oprindelige fremmøderegistrering findes ikke',
        404,
      );
    }

    const klientTid = input.klientTidspunkt ?? nu;

    const seneste = await tx.fremmoederegistrering.findFirst({
      orderBy: { server_tidspunkt: 'desc' },
      select: { hash: true },
    });
    const forrigeHash = seneste?.hash ?? '0'.repeat(64);

    const hashData = `${forrigeHash}:${eksisterende.lektionsplads_id}:${input.nyStatus}:${klientTid.toISOString()}:${input.begrundelse}`;
    const nyHash = this.beregnSha256(hashData);

    const registreretAfNavn = input.bruger?.navn ?? 'Stald-bruger';
    const kommandoId = input.kommandoId ?? crypto.randomUUID();

    const korrigeret = await tx.fremmoederegistrering.create({
      data: {
        lektionsplads_id: eksisterende.lektionsplads_id,
        lektion_dato: eksisterende.lektion_dato,
        hold_id: eksisterende.hold_id,
        rytter_id: eksisterende.rytter_id,
        hest_id: eksisterende.hest_id,
        status: input.nyStatus,
        registreret_af_bruger_id: input.bruger?.id,
        registreret_af_navn: registreretAfNavn,
        klient_tidspunkt: klientTid,
        server_tidspunkt: nu,
        enhed_id: input.enhedId,
        erstatter_id: eksisterende.id,
        korrektions_begrundelse: input.begrundelse,
        kommando_id: kommandoId,
        forrige_hash: forrigeHash,
        hash: nyHash,
      },
    });

    await logHaendelse(tx, {
      handling: 'FREMMOEDE_KORRIGERET' as any,
      entitet: 'fremmoederegistrering',
      entitet_id: korrigeret.id,
      bruger: input.bruger ? { id: input.bruger.id, navn: input.bruger.navn, roller: input.bruger.roller as any } : null,
      tidspunkt: nu,
      enhed_id: input.enhedId,
      kommando_id: kommandoId,
      klient_tidspunkt: klientTid,
      foer: { status: eksisterende.status },
      efter: { status: input.nyStatus, begrundelse: input.begrundelse, erstatter_id: eksisterende.id },
      begrundelse: input.begrundelse,
    });

    return korrigeret;
  }

  /**
   * Afslutter en lektions fremmøde manuelt ("Afslut hold").
   */
  async afslutLektion(tx: Prisma.TransactionClient, lektionId: string, nu: Date) {
    const lektion = await tx.lektion.findUnique({
      where: { id: lektionId },
    });

    if (!lektion) {
      throw new DomaeneFejl('LEKTION_IKKE_FUNDET', 'Lektionen findes ikke', 404);
    }

    return tx.lektion.update({
      where: { id: lektionId },
      data: {
        fremmoede_lukket: nu,
        status: 'Afviklet',
      },
    });
  }

  /**
   * Henter alle fremmøderegistreringer for en lektion sorteret kronologisk.
   */
  async hentLektionFremmoede(lektionId: string) {
    return this.prisma.fremmoederegistrering.findMany({
      where: {
        lektionsplads: { lektion_id: lektionId },
      },
      orderBy: { server_tidspunkt: 'desc' },
    });
  }
}
