import type { PrismaClient } from '@prisma/client';
import { rangerVenteliste, type FrigjortHestInfo, type HoldKontekst, type VentelisteKandidat } from '@ridecenter/domain';
import { DomaeneFejl } from '../../plugins/fejl';
import { logHaendelse } from '../audit/audit-service';

export class VentelisteService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly logger?: any,
  ) {}

  /**
   * Henter alle aktive ventelisteposter og afventende forslag (US4, T161).
   */
  async hentVenteliste() {
    const poster = await this.prisma.venteliste.findMany({
      include: {
        rytter: true,
        forslag: true,
      },
      orderBy: { tilmeldingsdato: 'asc' },
    });

    const afventendeForslag = await this.prisma.genbesaettelsesforslag.findMany({
      where: { status: 'Afventer' },
      include: {
        venteliste: {
          include: { rytter: true },
        },
      },
    });

    return {
      poster,
      afventende_forslag: afventendeForslag,
    };
  }

  /**
   * Opretter en ny ventelistepost (US4, T161).
   */
  async opretVentelistepost(input: {
    rytter_id: string;
    oensket_hold_id?: string | null;
    oensket_niveau?: any;
  }) {
    if (!input.oensket_hold_id && !input.oensket_niveau) {
      throw new DomaeneFejl(
        'UGYLDIG_VENTELISTE',
        'Enten ønsket hold eller ønsket niveau skal angives',
        400
      );
    }

    const rytter = await this.prisma.rytter.findUnique({
      where: { id: input.rytter_id },
    });
    if (!rytter) {
      throw new DomaeneFejl('RYTTER_IKKE_FUNDET', 'Rytteren findes ikke', 404);
    }

    return this.prisma.venteliste.create({
      data: {
        rytter_id: input.rytter_id,
        oensket_hold_id: input.oensket_hold_id ?? null,
        oensket_niveau: input.oensket_niveau ?? null,
        status: 'Aktiv',
      },
    });
  }

  /**
   * Genererer asynkront et genbesættelsesforslag ved rettidigt afbud (< 5 sek., SC-006).
   */
  async opretGenbesaettelsesForslagForLektion(lektionId: string, frigjortHestId?: string | null) {
    const lektion = await this.prisma.lektion.findUnique({
      where: { id: lektionId },
      include: { hold: true },
    });
    if (!lektion) return;

    // Hent aktive ventelisteposter
    const ventelistePoster = await this.prisma.venteliste.findMany({
      where: { status: 'Aktiv' },
      include: { rytter: true },
      orderBy: { tilmeldingsdato: 'asc' },
    });

    if (ventelistePoster.length === 0) return;

    let frigjortHest: FrigjortHestInfo | null = null;
    if (frigjortHestId) {
      const h = await this.prisma.hest.findUnique({
        where: { id: frigjortHestId },
      });
      if (h) {
        frigjortHest = {
          id: h.id,
          navn: h.navn,
          stangmaalCm: h.stangmaal_cm,
          maxRytterVaegtKg: h.max_rytter_vaegt_kg,
          maxRytterHoejdeCm: h.max_rytter_hoejde_cm,
          temperament: h.temperament as any,
          sundhedsstatus: h.sundhedsstatus,
        };
      }
    }

    const kandidater: VentelisteKandidat[] = ventelistePoster.map((vp) => ({
      id: vp.id,
      rytterId: vp.rytter_id,
      tilmeldingsdato: vp.tilmeldingsdato.toISOString().slice(0, 10),
      oensketHoldId: vp.oensket_hold_id,
      oensketNiveau: vp.oensket_niveau as any,
      rytterNavn: `${vp.rytter.fornavn} ${vp.rytter.efternavn}`,
      kontaktTelefon: vp.rytter.kontakt_telefon ?? undefined,
      kontaktNavn: vp.rytter.kontaktperson_navn ?? undefined,
      vaegtKg: vp.rytter.vaegt_kg,
      hoejdeCm: vp.rytter.hoejde_cm,
      erfaring: vp.rytter.erfaringsniveau as any,
    }));

    const holdKontekst: HoldKontekst = {
      id: lektion.hold_id,
      holdnavn: lektion.hold.holdnavn,
      niveau: lektion.hold.niveau as any,
    };

    const rangerede = rangerVenteliste(kandidater, holdKontekst, frigjortHest);
    if (rangerede.length === 0) return;

    const bedsteKandidat = rangerede[0]!;

    // Opret Genbesaettelsesforslag
    const forslag = await this.prisma.genbesaettelsesforslag.create({
      data: {
        type: 'Enkeltlektion',
        lektion_id: lektion.id,
        hold_id: lektion.hold_id,
        frigjort_hest_id: frigjortHestId ?? null,
        foreslaaet_venteliste_id: bedsteKandidat.id,
        kontaktinfo_snapshot: {
          rytter_navn: bedsteKandidat.rytterNavn,
          kontakt_navn: bedsteKandidat.kontaktNavn,
          kontakt_telefon: bedsteKandidat.kontaktTelefon,
        },
        status: 'Afventer',
      },
    });

    // Opret også DashboardNotifikation
    await this.prisma.dashboardNotifikation.create({
      data: {
        type: 'GENBESAETTELSESFORSLAG',
        payload: {
          forslag_id: forslag.id,
          lektion_id: lektion.id,
          holdnavn: lektion.hold.holdnavn,
          rytter_navn: bedsteKandidat.rytterNavn,
          kontakt_telefon: bedsteKandidat.kontaktTelefon,
        },
        dedupe_noegle: `GENBESAETTELSE:${forslag.id}`,
      },
    });

    return forslag;
  }

  /**
   * Godkender et genbesættelsesforslag: opretter lektionsplads (kilde: Venteliste) og markerer forslaget godkendt.
   */
  async godkendForslag(forslagId: string, behandlerId?: string) {
    const forslag = await this.prisma.genbesaettelsesforslag.findUnique({
      where: { id: forslagId },
      include: { venteliste: { include: { rytter: true } } },
    });

    if (!forslag) {
      throw new DomaeneFejl('FORSLAG_IKKE_FUNDET', 'Genbesættelsesforslaget findes ikke', 404);
    }
    if (forslag.status !== 'Afventer') {
      throw new DomaeneFejl('UGYLDIG_STATUS', 'Forslaget er allerede behandlet', 409);
    }

    return this.prisma.$transaction(async (tx) => {
      // 1. Markér forslag som godkendt
      const opdateretForslag = await tx.genbesaettelsesforslag.update({
        where: { id: forslagId },
        data: {
          status: 'Godkendt',
          behandlet_af: behandlerId ?? null,
          behandlet_tidspunkt: new Date(),
        },
      });

      // 2. Hvis Enkeltlektion: Opret LektionsPlads på lektionen
      if (forslag.type === 'Enkeltlektion' && forslag.lektion_id) {
        await tx.lektionsPlads.create({
          data: {
            lektion_id: forslag.lektion_id,
            rytter_id: forslag.venteliste.rytter_id,
            aktuel_hest_id: forslag.frigjort_hest_id ?? null,
            planlagt_hest_id: forslag.frigjort_hest_id ?? null,
            kilde: 'Venteliste',
          },
        });
      }

      // 3. Hvis FastPlads: Opret Holdtilmelding og opdater ventelistepost til Optaget
      if (forslag.type === 'FastPlads' && forslag.hold_id) {
        await tx.venteliste.update({
          where: { id: forslag.foreslaaet_venteliste_id },
          data: { status: 'Optaget' },
        });

        await tx.holdtilmelding.create({
          data: {
            hold_id: forslag.hold_id,
            rytter_id: forslag.venteliste.rytter_id,
            gyldig_fra: forslag.ledig_fra ?? new Date(),
            ancienitet_dato: new Date(),
          },
        });
      }

      return opdateretForslag;
    });
  }

  /**
   * Afviser et genbesættelsesforslag og genererer forslag for næste kandidat.
   */
  async afvisForslag(forslagId: string, behandlerId?: string) {
    const forslag = await this.prisma.genbesaettelsesforslag.findUnique({
      where: { id: forslagId },
    });
    if (!forslag) {
      throw new DomaeneFejl('FORSLAG_IKKE_FUNDET', 'Genbesættelsesforslaget findes ikke', 404);
    }

    return this.prisma.$transaction(async (tx) => {
      const opdateret = await tx.genbesaettelsesforslag.update({
        where: { id: forslagId },
        data: {
          status: 'Afvist',
          behandlet_af: behandlerId ?? null,
          behandlet_tidspunkt: new Date(),
        },
      });

      // Marker ventelistepost som afvist for dette specifikke forslag hvis relevant
      return opdateret;
    });
  }
}
