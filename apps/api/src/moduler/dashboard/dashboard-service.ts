import type { PrismaClient } from '@prisma/client';
import type { DashboardNoegletalSvar, HestBelastningCelle } from '@ridecenter/contracts';

const UGEDAGE = ['Mandag', 'Tirsdag', 'Onsdag', 'Torsdag', 'Fredag', 'Lørdag', 'Søndag'];

export class DashboardService {
  constructor(private readonly prisma: PrismaClient) {}

  /**
   * Beregner live ledelsesnøgletal og hestebelastnings-heatmap (US4, FR-016, T162).
   */
  async hentNoegletal(): Promise<DashboardNoegletalSvar> {
    // 1. Holdudnyttelse: antal aktive tilmeldinger vs. samlet max_kapacitet
    const holdListe = await this.prisma.hold.findMany({
      include: {
        tilmeldinger: {
          where: { gyldig_til: null },
        },
      },
    });

    let samletKapacitet = 0;
    let samletTilmeldte = 0;
    for (const h of holdListe) {
      samletKapacitet += h.max_kapacitet;
      samletTilmeldte += h.tilmeldinger.length;
    }

    const holdudnyttelsePct =
      samletKapacitet > 0 ? Math.round((samletTilmeldte / samletKapacitet) * 100) : 0;

    // 2. Heste ude af drift
    const hesteUdeAfDrift = await this.prisma.hest.count({
      where: { sundhedsstatus: { in: ['Sygemeldt', 'Skadet', 'Karantaene'] } },
    });

    // 3. Aktive vikarkoder
    const aktiveVikarkoder = await this.prisma.vikarEngangskode.count({
      where: { status: 'Aktiv' },
    });

    // 4. Afventende ventelisteforslag
    const afventendeForslag = await this.prisma.genbesaettelsesforslag.count({
      where: { status: 'Afventer' },
    });

    // 5. Gentaget fravær (3+ udeblivelser i træk jf. FR-016)
    // Hent seneste fremmøderegistreringer grupperet pr. rytter og hold
    const senesteFremmoede = await this.prisma.fremmoederegistrering.findMany({
      orderBy: { lektion_dato: 'desc' },
      include: {
        lektionsplads: {
          include: {
            rytter: true,
            lektion: { include: { hold: true } },
          },
        },
      },
      take: 200,
    });

    const rytterHistorik = new Map<string, { rytterNavn: string; holdnavn: string; statusser: string[] }>();
    for (const reg of senesteFremmoede) {
      const noegle = `${reg.rytter_id}:${reg.hold_id}`;
      if (!rytterHistorik.has(noegle)) {
        rytterHistorik.set(noegle, {
          rytterNavn: `${reg.lektionsplads.rytter.fornavn} ${reg.lektionsplads.rytter.efternavn}`,
          holdnavn: reg.lektionsplads.lektion.hold.holdnavn,
          statusser: [],
        });
      }
      const post = rytterHistorik.get(noegle)!;
      if (post.statusser.length < 5) {
        post.statusser.push(reg.status);
      }
    }

    const gentagetFravaerAdvarsler: DashboardNoegletalSvar['gentaget_fravaer_advarsler'] = [];
    for (const [noegle, val] of rytterHistorik.entries()) {
      const rytterId = noegle.split(':')[0]!;
      // Tjek om de 3 seneste er Udeblevet
      let udeblevneITraek = 0;
      for (const st of val.statusser) {
        if (st === 'Udeblevet') {
          udeblevneITraek++;
        } else {
          break;
        }
      }
      if (udeblevneITraek >= 3) {
        gentagetFravaerAdvarsler.push({
          rytter_id: rytterId,
          rytter_navn: val.rytterNavn,
          holdnavn: val.holdnavn,
          antal_udeblivelser_i_traek: udeblevneITraek,
        });
      }
    }

    // 6. Hestebelastningsfordeling heatmap (hest mod ugedag 1-7)
    const heste = await this.prisma.hest.findMany({
      where: { aktiv: true },
      orderBy: { navn: 'asc' },
    });

    // Hent alle planlagte lektionspladser og deres lektioners ugedage
    const alleHold = await this.prisma.hold.findMany();
    const holdMap = new Map(alleHold.map((h) => [h.id, h]));

    const hestetildelinger = await this.prisma.hestetildeling.findMany({
      include: {
        holdtilmelding: true,
      },
    });

    const belastningsMap = new Map<string, number>(); // `${hestId}:${ugedag}` -> antal
    for (const t of hestetildelinger) {
      const hold = holdMap.get(t.holdtilmelding.hold_id);
      if (hold) {
        const noegle = `${t.hest_id}:${hold.ugedag}`;
        belastningsMap.set(noegle, (belastningsMap.get(noegle) ?? 0) + 1);
      }
    }

    const hestBelastningsfordeling: HestBelastningCelle[] = [];
    for (const hest of heste) {
      for (let ugedag = 1; ugedag <= 7; ugedag++) {
        const noegle = `${hest.id}:${ugedag}`;
        const planlagte = belastningsMap.get(noegle) ?? 0;
        const maxDag = hest.skaane ? 2 : hest.max_lektioner_dag;
        const erHviledag = hest.hviledag === ugedag;
        const erOverMax = planlagte > maxDag || (erHviledag && planlagte > 0);

        hestBelastningsfordeling.push({
          hest_id: hest.id,
          hest_navn: hest.navn,
          ugedag,
          ugedag_navn: UGEDAGE[ugedag - 1] ?? `Dag ${ugedag}`,
          planlagte_lektioner: planlagte,
          max_lektioner_dag: maxDag,
          er_over_max: erOverMax,
          er_hviledag: erHviledag,
        });
      }
    }

    return {
      ugentlig_holdudnyttelse_procent: holdudnyttelsePct,
      antal_heste_ude_af_drift: hesteUdeAfDrift,
      aktive_vikarkoder: aktiveVikarkoder,
      afventende_ventelisteforslag: afventendeForslag,
      gentaget_fravaer_advarsler: gentagetFravaerAdvarsler,
      hest_belastningsfordeling: hestBelastningsfordeling,
    };
  }
}

