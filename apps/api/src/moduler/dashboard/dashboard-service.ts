import type { PrismaClient } from '@prisma/client';
import type { DashboardNoegletalSvar, HestBelastningCelle } from '@ridecenter/contracts';

const UGEDAGE = ['Mandag', 'Tirsdag', 'Onsdag', 'Torsdag', 'Fredag', 'Lørdag', 'Søndag'];

export class DashboardService {
  constructor(private readonly prisma: PrismaClient) {}

  /**
   * Beregner live ledelsesnøgletal og hestebelastnings-heatmap (US4, FR-016, T162).
   */
  async hentNoegletal(oensketMaaned?: string): Promise<DashboardNoegletalSvar> {
    // 1. Holdudnyttelse: antal aktive tilmeldinger vs. samlet max_kapacitet
    const holdListe = await this.prisma.hold.findMany({
      include: {
        tilmeldinger: {
          where: { gyldig_til: null },
        },
      },
    });

    const heste = await this.prisma.hest.findMany({
      where: { aktiv: true },
      orderBy: { navn: 'asc' },
    });

    function beregnGruppeKapacitet(params: {
      hold: typeof holdListe;
      heste: typeof heste;
      erHestEgnet: (h: (typeof heste)[0]) => boolean;
      getHestDagsKapacitet?: (h: (typeof heste)[0], dag: number) => number;
      getHestUgeKapacitet?: (h: (typeof heste)[0]) => number;
      nominelKapacitet?: number;
      erHoldCentreret?: boolean;
    }) {
      const { hold, heste: hesteListe, erHestEgnet } = params;
      const tilmeldte = hold.reduce((sum, h) => sum + h.tilmeldinger.length, 0);
      const raskeEgnede = hesteListe.filter((h) => erHestEgnet(h) && h.sundhedsstatus === 'Aktiv');

      const holdDage = Array.from(new Set(hold.map((h) => h.ugedag))).sort();
      let ugeKapacitet = 0;
      if (params.getHestUgeKapacitet) {
        ugeKapacitet = raskeEgnede.reduce((sum, h) => sum + params.getHestUgeKapacitet!(h), 0);
      } else if (params.nominelKapacitet !== undefined) {
        ugeKapacitet = params.nominelKapacitet;
      } else {
        for (const h of raskeEgnede) {
          for (const dag of holdDage) {
            if (h.hviledag !== dag) {
              ugeKapacitet += h.skaane ? 2 : h.max_lektioner_dag;
            }
          }
        }
      }

      const ugebasis_procent = ugeKapacitet > 0 ? Math.round((tilmeldte / ugeKapacitet) * 100) : 0;

      let maxDagsPct = 0;
      let erOverHolddagMax = false;

      for (const dag of holdDage) {
        const dagHold = hold.filter((h) => h.ugedag === dag);
        const dagElever = dagHold.reduce((sum, h) => sum + h.tilmeldinger.length, 0);
        const dagHoldPladser = dagHold.reduce((sum, h) => sum + h.max_kapacitet, 0);
        const tilgaengeligeHeste = raskeEgnede.filter((h) => h.hviledag !== dag);

        let hesteKapacitet = 0;
        for (const h of tilgaengeligeHeste) {
          hesteKapacitet += params.getHestDagsKapacitet
            ? params.getHestDagsKapacitet(h, dag)
            : (h.skaane ? 2 : h.max_lektioner_dag);
        }

        // For samlet holdudnyttelse er grundlaget holdenes pladser, men begrænset af tilgængelige heste på dagen
        const dagKapacitet = params.erHoldCentreret
          ? Math.min(dagHoldPladser, hesteKapacitet)
          : hesteKapacitet;

        const dagPct = dagKapacitet > 0 ? Math.round((dagElever / dagKapacitet) * 100) : (dagElever > 0 ? 100 : 0);
        if (dagPct > maxDagsPct) {
          maxDagsPct = dagPct;
        }
        if (dagElever > dagKapacitet || dagPct > 100) {
          erOverHolddagMax = true;
        }
      }

      const effektiv_udnyttelse_procent = holdDage.length > 0 ? maxDagsPct : ugebasis_procent;

      return {
        tilmeldte,
        kapacitet: ugeKapacitet,
        effektiv_udnyttelse_procent,
        ugebasis_procent,
        er_over_holddag_max: erOverHolddagMax,
      };
    }

    let samletKapacitet = 0;
    for (const h of holdListe) {
      samletKapacitet += h.max_kapacitet;
    }

    const samletDetaljer = beregnGruppeKapacitet({
      hold: holdListe,
      heste,
      erHestEgnet: () => true,
      nominelKapacitet: samletKapacitet,
      erHoldCentreret: true,
    });

    const springHold = holdListe.filter((h) => h.er_springhold);
    const springDetaljer = beregnGruppeKapacitet({
      hold: springHold,
      heste,
      erHestEgnet: (h) => !h.springforbud && (h.max_spring_uge ?? 0) > 0,
      getHestDagsKapacitet: () => 1,
      getHestUgeKapacitet: (h) => h.max_spring_uge ?? 1,
    });

    const begynderHold = holdListe.filter((h) => h.niveau === 'Begynder' || h.niveau === 'Traekhold');
    const begynderDetaljer = beregnGruppeKapacitet({
      hold: begynderHold,
      heste,
      erHestEgnet: (h) => !!h.godkendt_til_begyndere,
    });

    const oevetHold = holdListe.filter((h) => h.niveau === 'Oevet' || h.niveau === 'Letoevet');
    const oevetDetaljer = beregnGruppeKapacitet({
      hold: oevetHold,
      heste,
      erHestEgnet: (h) => h.egnet_oevet !== false,
    });

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
    // heste er allerede hentet ovenfor

    // Find alle måneder der har kørsler
    const alleKoersler = await this.prisma.tildelingskoersel.findMany({
      orderBy: { oprettet: 'desc' },
      select: { id: true, maaned: true, status: true },
    });

    const tilgaengeligeMaaneder = Array.from(new Set(alleKoersler.map((k) => k.maaned))).sort();

    // Vælg måned: hvis specificeret brug den, ellers find seneste publicerede eller nyeste kørsel
    let valgtMaaned = oensketMaaned;
    if (!valgtMaaned || !tilgaengeligeMaaneder.includes(valgtMaaned)) {
      const publiceret = alleKoersler.find((k) => k.status === 'Publiceret');
      valgtMaaned = publiceret ? publiceret.maaned : (tilgaengeligeMaaneder[0] ?? '2026-10');
    }

    // Find den relevante kørsel for valgte måned (prioritér Publiceret, ellers seneste kørsel for måneden)
    const koerslerForMaaned = alleKoersler.filter((k) => k.maaned === valgtMaaned);
    const aktivKoersel =
      koerslerForMaaned.find((k) => k.status === 'Publiceret') ?? koerslerForMaaned[0];

    const alleHold = await this.prisma.hold.findMany();
    const holdMap = new Map(alleHold.map((h) => [h.id, h]));

    const belastningsMap = new Map<string, number>(); // `${hestId}:${ugedag}` -> antal
    if (aktivKoersel) {
      const hestetildelinger = await this.prisma.hestetildeling.findMany({
        where: { koersel_id: aktivKoersel.id },
        include: {
          holdtilmelding: true,
        },
      });

      for (const t of hestetildelinger) {
        if (!t.hest_id) continue;
        const hold = holdMap.get(t.holdtilmelding.hold_id);
        if (hold) {
          const noegle = `${t.hest_id}:${hold.ugedag}`;
          belastningsMap.set(noegle, (belastningsMap.get(noegle) ?? 0) + 1);
        }
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
          sundhedsstatus: hest.sundhedsstatus as any,
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
      ugentlig_holdudnyttelse_procent: samletDetaljer.effektiv_udnyttelse_procent,
      antal_heste_ude_af_drift: hesteUdeAfDrift,
      aktive_vikarkoder: aktiveVikarkoder,
      afventende_ventelisteforslag: afventendeForslag,
      gentaget_fravaer_advarsler: gentagetFravaerAdvarsler,
      hest_belastningsfordeling: hestBelastningsfordeling,
      valgt_maaned: valgtMaaned,
      tilgaengelige_maaneder: tilgaengeligeMaaneder,
      begynder_heste_udnyttelse_procent: begynderDetaljer.effektiv_udnyttelse_procent,
      oevet_heste_udnyttelse_procent: oevetDetaljer.effektiv_udnyttelse_procent,
      spring_heste_udnyttelse_procent: springDetaljer.effektiv_udnyttelse_procent,
      samlet_holdudnyttelse_detaljer: samletDetaljer,
      begynder_heste_detaljer: begynderDetaljer,
      oevet_heste_detaljer: oevetDetaljer,
      spring_heste_detaljer: springDetaljer,
    };
  }
}

