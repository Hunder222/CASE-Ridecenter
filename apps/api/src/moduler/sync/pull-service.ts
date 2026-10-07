import type { HestStaldInfo, StaldDag, StaldHold, StaldPlads } from '@ridecenter/contracts';
import { beregnEgnethed, byggPartheste } from '@ridecenter/domain';
import type { PrismaClient } from '@prisma/client';
import type { Krypto } from '../../plugins/krypto';
import { tilHestData } from '../heste/mapper';
import { tilHoldData } from '../tildeling/input-bygger';
import { tilRytterRegelData } from '../ryttere/mapper';

function formaterKortNavn(fornavn: string, efternavn: string): string {
  const efternavnInitial = efternavn.trim().charAt(0)?.toUpperCase();
  return efternavnInitial ? `${fornavn} ${efternavnInitial}.` : fornavn;
}

export class PullService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly krypto: Krypto,
  ) {}

  /**
   * Returnerer dagens lektioner og pladser med forudberegnede godkendte_heste (R6)
   * samt anonymiserede stald-DTO'er.
   */
  async hentStaldDag(datoStr: string): Promise<StaldDag> {
    const dato = new Date(datoStr);

    const lektioner = await this.prisma.lektion.findMany({
      where: { dato },
      include: {
        hold: {
          include: {
            fast_underviser: true,
            tilmeldinger: {
              where: {
                gyldig_fra: { lte: dato },
                OR: [{ gyldig_til: null }, { gyldig_til: { gte: dato } }],
              },
              include: { rytter: true },
            },
          },
        },
        pladser: {
          include: {
            rytter: {
              include: {
                sikkerhedsprofil: true,
              },
            },
            fremmoeder: {
              orderBy: { klient_tidspunkt: 'desc' },
              take: 1,
            },
          },
        },
      },
      orderBy: { hold: { starttid: 'asc' } },
    });

    const alleHeste = await this.prisma.hest.findMany();
    const domainHeste = alleHeste.map(tilHestData);

    const staldHoldListe: StaldHold[] = [];

    for (const lektion of lektioner) {
      // Forbered partheste-mapping for holdet
      const tilmeldinger = lektion.hold.tilmeldinger.map((t) => ({
        id: t.id,
        rytterId: t.rytter_id,
        holdId: t.hold_id,
        ancienitetDato: t.ancienitet_dato.toISOString().slice(0, 10),
      }));
      const ryttere = lektion.hold.tilmeldinger.map((t) => tilRytterRegelData(t.rytter, null));
      const parthesteMap = byggPartheste(tilmeldinger, ryttere);
      const holdPartheste = parthesteMap.get(lektion.hold_id) ?? {};

      const holdData = {
        ...tilHoldData(lektion.hold),
        partheste: holdPartheste,
      };

      const pladser: StaldPlads[] = [];

      for (const plads of lektion.pladser) {
        const rytter = plads.rytter;
        const profil = rytter.sikkerhedsprofil;

        const domainRytter = tilRytterRegelData(rytter, profil);

        const egnethed = beregnEgnethed(domainRytter, holdData, domainHeste);
        const godkendteHeste = egnethed.godkendte;

        let adfaerdsinstruks: string | null = null;
        if (profil?.adfaerdsinstruks) {
          try {
            adfaerdsinstruks = this.krypto.dekrypter(profil.adfaerdsinstruks);
          } catch {
            adfaerdsinstruks = null;
          }
        }

        const senesteFremmoede = plads.fremmoeder[0];

        pladser.push({
          id: plads.id,
          rytter_navn_kort: formaterKortNavn(rytter.fornavn, rytter.efternavn),
          planlagt_hest_id: plads.planlagt_hest_id,
          aktuel_hest_id: plads.aktuel_hest_id,
          afledt_status: senesteFremmoede ? (senesteFremmoede.status as any) : null,
          godkendte_heste: godkendteHeste,
          cheat_sheet_koder: profil?.cheat_sheet_koder ?? [],
          adfaerdsinstruks,
        });
      }

      staldHoldListe.push({
        id: lektion.id,
        hold_id: lektion.hold_id,
        dato: datoStr,
        holdnavn: lektion.hold.holdnavn,
        niveau: lektion.hold.niveau,
        er_springhold: lektion.hold.er_springhold,
        starttid: lektion.hold.starttid,
        varighed_min: lektion.hold.varighed_min,
        underviser_navn: lektion.vikar_navn ?? lektion.hold.fast_underviser?.navn ?? 'Ukendt',
        fremmoede_lukket: lektion.fremmoede_lukket ? lektion.fremmoede_lukket.toISOString() : null,
        pladser,
      });
    }

    return {
      dato: datoStr,
      lektioner: staldHoldListe,
    };
  }

  /**
   * Returnerer dataminimeret snapshot for [i dag .. i dag + 6 dage]
   */
  async hentPullData(fraDato: Date) {
    const startDato = new Date(fraDato);
    startDato.setUTCHours(0, 0, 0, 0);

    const slutDato = new Date(startDato);
    slutDato.setDate(slutDato.getDate() + 6);
    slutDato.setUTCHours(23, 59, 59, 999);

    // Hent alle lektioner i vinduet
    const lektioner = await this.prisma.lektion.findMany({
      where: {
        dato: {
          gte: startDato,
          lte: slutDato,
        },
      },
      include: {
        hold: {
          include: {
            tilmeldinger: {
              include: { rytter: true },
            },
          },
        },
      },
    });

    const lektionIds = lektioner.map((l) => l.id);

    // Hent pladser med rytternavne og sikkerhedsprofil
    const pladser = await this.prisma.lektionsPlads.findMany({
      where: {
        lektion_id: { in: lektionIds },
      },
      include: {
        rytter: {
          include: {
            sikkerhedsprofil: true,
          },
        },
        fremmoeder: {
          orderBy: { klient_tidspunkt: 'desc' },
          take: 1,
        },
      },
    });

    // Hent heste
    const heste = await this.prisma.hest.findMany({
      where: { aktiv: true },
    });

    const domainHeste = heste.map(tilHestData);
    const lektionerMap = new Map(lektioner.map((l) => [l.id, l]));

    // Byg holdData-map
    const holdDataMap = new Map<string, any>();
    for (const lektion of lektioner) {
      if (holdDataMap.has(lektion.hold_id)) continue;
      const tilmeldinger = lektion.hold.tilmeldinger.map((t) => ({
        id: t.id,
        rytterId: t.rytter_id,
        holdId: t.hold_id,
        ancienitetDato: t.ancienitet_dato.toISOString().slice(0, 10),
      }));
      const ryttere = lektion.hold.tilmeldinger.map((t) => tilRytterRegelData(t.rytter, null));
      const parthesteMap = byggPartheste(tilmeldinger, ryttere);
      const holdPartheste = parthesteMap.get(lektion.hold_id) ?? {};
      holdDataMap.set(lektion.hold_id, {
        ...tilHoldData(lektion.hold),
        partheste: holdPartheste,
      });
    }

    // Hent brugere med PIN hash (kun Ridelaerer, Ledelse, Staldelev)
    const brugere = await this.prisma.bruger.findMany({
      where: {
        aktiv: true,
        pin_hash: { not: null },
        roller: { hasSome: ['Ridelaerer', 'Ledelse', 'Staldelev'] },
      },
      select: {
        id: true,
        navn: true,
        roller: true,
        pin_hash: true,
      },
    });

    // Hent aktive vikarkoder
    const nu = new Date();
    const vikarkoder = await this.prisma.vikarEngangskode.findMany({
      where: {
        status: 'Aktiv',
        udloebsdato: { gte: nu },
      },
      select: {
        id: true,
        kode_hash: true,
        status: true,
      },
    });

    return {
      cursor: nu.toISOString(),
      aendringer: {
        lektioner: lektioner.map((l) => ({
          id: l.id,
          dato: l.dato.toISOString().slice(0, 10),
          holdId: l.hold_id,
          holdnavn: l.hold.holdnavn,
          starttid: l.hold.starttid,
          niveau: l.hold.niveau,
          erSpringhold: l.hold.er_springhold,
          fremmoedeLukket: l.fremmoede_lukket?.toISOString() ?? null,
        })),
        pladser: pladser.map((p) => {
          let instruks: string | null = null;
          if (p.rytter.sikkerhedsprofil?.adfaerdsinstruks) {
            try {
              instruks = this.krypto.dekrypter(p.rytter.sikkerhedsprofil.adfaerdsinstruks);
            } catch {
              instruks = null;
            }
          }

          const lektion = lektionerMap.get(p.lektion_id);
          const holdData = lektion ? holdDataMap.get(lektion.hold_id) : null;
          let godkendteHeste: string[] = [];
          if (holdData) {
            const domainRytter = tilRytterRegelData(p.rytter, p.rytter.sikkerhedsprofil);
            const egnethed = beregnEgnethed(domainRytter, holdData, domainHeste);
            godkendteHeste = egnethed.godkendte;
          }

          return {
            id: p.id,
            lektionId: p.lektion_id,
            rytterId: p.rytter_id,
            rytterNavnKort: formaterKortNavn(p.rytter.fornavn, p.rytter.efternavn),
            aktuelHestId: p.aktuel_hest_id,
            planlagtHestId: p.planlagt_hest_id,
            status: p.fremmoeder[0]?.status ?? null,
            godkendteHeste,
            cheatSheetKoder: p.rytter.sikkerhedsprofil?.cheat_sheet_koder ?? [],
            adfaerdsinstruks: instruks,
          };
        }),
        heste: heste.map((h) => ({
          id: h.id,
          navn: h.navn,
          stangmaal_cm: h.stangmaal_cm,
          sundhedsstatus: h.sundhedsstatus,
          temperament: h.temperament,
          godkendt_til_begyndere: h.godkendt_til_begyndere,
          egnet_oevet: h.egnet_oevet,
          staldnoter: h.staldnoter,
          hviledag: h.hviledag,
          max_lektioner_dag: h.max_lektioner_dag,
        })),
        brugere: brugere.map((b) => ({
          id: b.id,
          navn: b.navn,
          roller: b.roller,
          pinHash: b.pin_hash,
        })),
        vikarkoder: vikarkoder.map((v) => ({
          id: v.id,
          kodeHash: v.kode_hash,
          status: v.status,
        })),
      },
    };
  }
}

