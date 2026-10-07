import crypto from 'node:crypto';
import type { OmplaceringInput } from '@ridecenter/contracts';
import {
  beregnEgnethed,
  byggPartheste,
  foreslaaErstatninger,
  validerPlacering,
  type Top3Forslag,
  type Ugedag,
} from '@ridecenter/domain';
import type { PrismaClient } from '@prisma/client';
import type { FastifyInstance } from 'fastify';
import { logHaendelse } from '../audit/audit-service';
import { tilHestData } from '../heste/mapper';
import { tilHoldData } from '../tildeling/input-bygger';
import { tilRytterRegelData } from '../ryttere/mapper';
import { DomaeneFejl } from '../../plugins/fejl';
import type { SessionBruger } from '../../plugins/rbac';

export class OmplaceringService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly app: FastifyInstance,
  ) {}

  /**
   * Beregner top-3 kandidater for en lektionsplads.
   */
  async hentErstatningsforslag(pladsId: string): Promise<Top3Forslag[]> {
    const plads = await this.prisma.lektionsPlads.findUnique({
      where: { id: pladsId },
      include: {
        lektion: {
          include: {
            hold: {
              include: {
                tilmeldinger: {
                  include: { rytter: true },
                },
              },
            },
          },
        },
        rytter: {
          include: {
            sikkerhedsprofil: true,
          },
        },
      },
    });

    if (!plads) {
      throw new DomaeneFejl('PLADS_IKKE_FUNDET', 'Lektionsplads ikke fundet', 404);
    }

    const alleHeste = await this.prisma.hest.findMany();
    const domainHeste = alleHeste.map(tilHestData);

    // Beregn godkendte heste for rytteren på dette hold
    const tilmeldinger = plads.lektion.hold.tilmeldinger.map((t) => ({
      id: t.id,
      rytterId: t.rytter_id,
      holdId: t.hold_id,
      ancienitetDato: t.ancienitet_dato.toISOString().slice(0, 10),
    }));
    const ryttere = plads.lektion.hold.tilmeldinger.map((t) => tilRytterRegelData(t.rytter, null));
    const parthesteMap = byggPartheste(tilmeldinger, ryttere);
    const holdPartheste = parthesteMap.get(plads.lektion.hold_id) ?? {};

    const holdData = {
      ...tilHoldData(plads.lektion.hold),
      partheste: holdPartheste,
    };

    const domainRytter = tilRytterRegelData(plads.rytter, plads.rytter.sikkerhedsprofil);
    const egnethed = beregnEgnethed(domainRytter, holdData, domainHeste);

    // Beregn dagens hestebelastninger for denne lektions dato
    const dagsPladser = await this.prisma.lektionsPlads.findMany({
      where: {
        lektion: { dato: plads.lektion.dato },
        aktuel_hest_id: { not: null },
      },
    });

    const dagsbelastninger: Record<string, number> = {};
    for (const p of dagsPladser) {
      if (p.aktuel_hest_id) {
        dagsbelastninger[p.aktuel_hest_id] = (dagsbelastninger[p.aktuel_hest_id] ?? 0) + 1;
      }
    }

    return foreslaaErstatninger({
      plads: { godkendteHeste: egnethed.godkendte },
      heste: domainHeste,
      dagsbelastninger,
      lektionUgedag: plads.lektion.hold.ugedag as Ugedag,
    });
  }

  /**
   * Gennemfører hesteomplacering med revalidering mod Welfare Guard.
   */
  async omplacerHest(
    pladsId: string,
    input: OmplaceringInput,
    bruger: SessionBruger | null,
    klientTid?: Date,
    kommandoId?: string,
  ) {
    const plads = await this.prisma.lektionsPlads.findUnique({
      where: { id: pladsId },
      include: {
        lektion: {
          include: {
            hold: {
              include: {
                tilmeldinger: {
                  include: { rytter: true },
                },
              },
            },
          },
        },
        rytter: {
          include: {
            sikkerhedsprofil: true,
          },
        },
      },
    });

    if (!plads) {
      throw new DomaeneFejl('PLADS_IKKE_FUNDET', 'Lektionsplads ikke fundet', 404);
    }

    const nyHest = await this.prisma.hest.findUnique({
      where: { id: input.til_hest_id },
    });
    if (!nyHest || !nyHest.aktiv || nyHest.sundhedsstatus !== 'Aktiv') {
      throw new DomaeneFejl('HEST_IKKE_KLAR', 'Den valgte hest er ikke tilgængelig', 422);
    }

    const alleHeste = await this.prisma.hest.findMany();
    const domainHeste = alleHeste.map(tilHestData);
    const domainNyHest = tilHestData(nyHest);

    // Welfare Guard kontrol
    const tilmeldinger = plads.lektion.hold.tilmeldinger.map((t) => ({
      id: t.id,
      rytterId: t.rytter_id,
      holdId: t.hold_id,
      ancienitetDato: t.ancienitet_dato.toISOString().slice(0, 10),
    }));
    const ryttere = plads.lektion.hold.tilmeldinger.map((t) => tilRytterRegelData(t.rytter, null));
    const parthesteMap = byggPartheste(tilmeldinger, ryttere);
    const holdPartheste = parthesteMap.get(plads.lektion.hold_id) ?? {};

    const holdData = {
      ...tilHoldData(plads.lektion.hold),
      partheste: holdPartheste,
    };

    const domainRytter = tilRytterRegelData(plads.rytter, plads.rytter.sikkerhedsprofil);
    const egnethed = beregnEgnethed(domainRytter, holdData, domainHeste);

    if (!egnethed.godkendte.includes(nyHest.id)) {
      throw new DomaeneFejl(
        'WELFARE_GUARD_AFVIST',
        'Hesten er ikke godkendt til rytteren jf. Welfare Guard',
        422,
      );
    }

    const nu = this.app.ur();
    const tidspunktKlient = klientTid ?? nu;
    const cmdId = kommandoId ?? crypto.randomUUID();
    const fraHestId = plads.aktuel_hest_id ?? plads.planlagt_hest_id ?? nyHest.id;
    const brugerNavn = bruger?.navn ?? 'Stald-bruger';

    return this.prisma.$transaction(async (tx) => {
      // Opdater plads med felt-LWW timestamp
      await tx.lektionsPlads.update({
        where: { id: pladsId },
        data: {
          aktuel_hest_id: nyHest.id,
          felt_tidsstempler: {
            aktuel_hest_id: tidspunktKlient.toISOString(),
          },
        },
      });

      // Opret Omplacering post 🧾 ⛓
      const omplacering = await tx.omplacering.create({
        data: {
          lektionsplads_id: pladsId,
          fra_hest_id: fraHestId,
          til_hest_id: nyHest.id,
          aarsag: input.aarsag,
          forslag_snapshot: (input.forslag_snapshot as any) ?? {},
          godkendt_af_bruger_id: bruger?.id ?? null,
          godkendt_af_navn: brugerNavn,
          klient_tidspunkt: tidspunktKlient,
          server_tidspunkt: nu,
          kommando_id: cmdId,
        },
      });

      await logHaendelse(tx, {
        handling: 'TILDELING_JUSTERET',
        entitet: 'lektionsplads',
        entitet_id: pladsId,
        bruger,
        tidspunkt: nu,
        foer: { aktuel_hest_id: plads.aktuel_hest_id },
        efter: { aktuel_hest_id: nyHest.id, aarsag: input.aarsag },
      });

      this.app.sse?.udsendEvent('plads.opdateret', {
        plads_id: pladsId,
        ny_hest_id: nyHest.id,
      });

      return omplacering;
    });
  }
}

