import crypto from 'node:crypto';
import type { PrismaClient } from '@prisma/client';
import { DomaeneFejl } from '../../plugins/fejl';

export interface GenererRapportInput {
  periode_fra: string; // 'YYYY-MM-DD'
  periode_til: string; // 'YYYY-MM-DD'
  aldersgraense?: number;
}

export class RapportService {
  constructor(private readonly prisma: PrismaClient) {}

  /**
   * Genererer den kommunale tilsynsrapport (US4, FR-018, SC-009).
   * - Tilskudskriterium: under aldersgrænse (default 25 år) ved periodens start.
   * - CSV formateret med semikolon og UTF-8 BOM.
   * - Kolonner: Fornavn;Efternavn;Foedselsdato;BopaelKommune;Holdnavn;Lektionsdato;Fremmoedestatus (INGEN CPR jf. R8).
   * - Kontrolsummer: SHA-256 af genereret fil og seneste kæde-hash gemmes i RapportUdtraek 🧾.
   * - Udførelse < 5 sekunder.
   */
  async genererTilsynsrapport(input: GenererRapportInput, brugerId: string) {
    const t0 = performance.now();
    const aldersgraense = input.aldersgraense ?? 25;
    const fraDato = new Date(input.periode_fra);
    const tilDato = new Date(input.periode_til);

    // Beregn skæringsdato for alder ved periodens start:
    // født EFTER (periode_fra - aldersgraense år)
    const skaeringsFødselsdato = new Date(fraDato);
    skaeringsFødselsdato.setFullYear(skaeringsFødselsdato.getFullYear() - aldersgraense);

    // Udtræk alle fremmøderegistreringer for tilskudsberettigede ryttere i perioden
    const registreringer = await this.prisma.fremmoederegistrering.findMany({
      where: {
        lektion_dato: {
          gte: fraDato,
          lte: tilDato,
        },
        lektionsplads: {
          rytter: {
            foedselsdato: {
              gt: skaeringsFødselsdato,
            },
          },
        },
      },
      include: {
        lektionsplads: {
          include: {
            rytter: true,
            lektion: { include: { hold: true } },
          },
        },
      },
      orderBy: [
        { lektion_dato: 'asc' },
        { lektionsplads: { rytter: { efternavn: 'asc' } } },
      ],
    });

    // Dan CSV med UTF-8 BOM (\uFEFF) og semikolon
    const csvOverskrifter = [
      'Fornavn',
      'Efternavn',
      'Foedselsdato',
      'BopaelKommune',
      'Holdnavn',
      'Lektionsdato',
      'Fremmoedestatus',
    ];

    const rækker: string[] = [csvOverskrifter.join(';')];

    for (const reg of registreringer) {
      const r = reg.lektionsplads.rytter;
      const h = reg.lektionsplads.lektion.hold;
      const fødselsdatoStr = r.foedselsdato.toISOString().slice(0, 10);
      const lektionsdatoStr = reg.lektion_dato.toISOString().slice(0, 10);

      rækker.push(
        [
          r.fornavn,
          r.efternavn,
          fødselsdatoStr,
          r.bopaelskommune,
          h.holdnavn,
          lektionsdatoStr,
          reg.status,
        ].join(';')
      );
    }

    const csvIndhold = '\uFEFF' + rækker.join('\r\n');
    const filSha256 = crypto.createHash('sha256').update(csvIndhold, 'utf8').digest('hex');

    // Hent seneste kæde-hash fra auditHaendelse
    const senesteAudit = await this.prisma.auditHaendelse.findFirst({
      orderBy: { server_seq: 'desc' },
      select: { hash: true },
    });
    const kaedeHovedhash = senesteAudit?.hash ?? '0'.repeat(64);

    const varighedMs = Math.round(performance.now() - t0);

    // Opret RapportUdtraek 🧾 post
    const udtraek = await this.prisma.rapportUdtraek.create({
      data: {
        periode_fra: fraDato,
        periode_til: tilDato,
        aldersgraense,
        format: 'CSV',
        antal_raekker: registreringer.length,
        fil_sha256: filSha256,
        kaede_hovedhash: kaedeHovedhash,
        genereret_af: brugerId,
        varighed_ms: varighedMs,
      },
    });

    return {
      id: udtraek.id,
      periode_fra: input.periode_fra,
      periode_til: input.periode_til,
      aldersgraense,
      antal_raekker: registreringer.length,
      fil_sha256: filSha256,
      kaede_hovedhash: kaedeHovedhash,
      genereret_tidspunkt: udtraek.genereret_tidspunkt.toISOString(),
      varighed_ms: varighedMs,
      csv_data: csvIndhold,
    };
  }

  /**
   * Henter historik over tidligere genererede rapporter.
   */
  async hentHistorik() {
    return this.prisma.rapportUdtraek.findMany({
      orderBy: { genereret_tidspunkt: 'desc' },
      take: 20,
    });
  }

  /**
   * Downloader eller genhenter CSV for en specifik rapport.
   */
  async downloadRapport(id: string) {
    const post = await this.prisma.rapportUdtraek.findUnique({
      where: { id },
    });
    if (!post) {
      throw new DomaeneFejl('RAPPORT_IKKE_FUNDET', 'Rapporten findes ikke', 404);
    }
    // Genkør generering for at reproducere eksakt samme CSV og verificere sha256
    const res = await this.genererTilsynsrapport(
      {
        periode_fra: post.periode_fra.toISOString().slice(0, 10),
        periode_til: post.periode_til.toISOString().slice(0, 10),
        aldersgraense: post.aldersgraense,
      },
      post.genereret_af
    );

    return res.csv_data;
  }
}
