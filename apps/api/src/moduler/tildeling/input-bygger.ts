import { createHash } from 'node:crypto';
import type { Hold as HoldRaekke, PrismaClient } from '@prisma/client';
import {
  foersteDag,
  forrigeMaaned,
  sidsteDag,
  statusTekst,
  type AllokeringsInput,
  type ForklaringsKontekst,
  type HoldData,
  type Ugedag,
} from '@ridecenter/domain';
import { datoKolonne, isoDato } from '../../faelles';
import { kanoniskJson } from '../audit/kanonisk-json';
import { tilHestData } from '../heste/mapper';
import { tilRytterRegelData } from '../ryttere/mapper';

export interface KoerselGrundlag {
  input: AllokeringsInput;
  hold: ReadonlyMap<string, HoldRaekke>;
  fornavne: ReadonlyMap<string, string>;
  hesteNavne: Readonly<Record<string, string>>;
  hesteStatus: Readonly<Record<string, string>>;
}

const sammenlign = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);
const efterId = <T extends { id: string }>(a: T, b: T) => sammenlign(a.id, b.id);

export function tilHoldData(h: HoldRaekke): HoldData {
  return {
    id: h.id,
    holdnavn: h.holdnavn,
    niveau: h.niveau,
    erSpringhold: h.er_springhold,
    ugedag: h.ugedag as Ugedag,
    starttid: h.starttid,
    varighedMin: h.varighed_min,
    maxKapacitet: h.max_kapacitet,
  };
}

/**
 * Motorens input for måneden (T084): alle heste (også syge, så HC-04 kan forklares), alle hold, tilmeldinger,
 * der er aktive i måneden, for aktive ryttere med HC-07-felterne fra sikkerhedsprofilen, månedens ønsker og
 * turnus fra den publicerede kørsel for måneden før. Samlingerne sorteres, så input_hash er stabil.
 */
export async function bygAllokeringsInput(prisma: PrismaClient, maaned: string): Promise<KoerselGrundlag> {
  const foerste = datoKolonne(foersteDag(maaned));
  const sidste = datoKolonne(sidsteDag(maaned));
  const [heste, hold, tilmeldinger, forrige, oensker] = await Promise.all([
    prisma.hest.findMany(),
    prisma.hold.findMany(),
    prisma.holdtilmelding.findMany({
      where: {
        gyldig_fra: { lte: sidste },
        OR: [{ gyldig_til: null }, { gyldig_til: { gte: foerste } }],
        rytter: { aktiv_status: 'Aktiv' },
      },
      include: { rytter: { include: { sikkerhedsprofil: true } } },
    }),
    prisma.tildelingskoersel.findFirst({
      where: { maaned: forrigeMaaned(maaned), status: 'Publiceret' },
      include: { tildelinger: { include: { holdtilmelding: true } } },
    }),
    prisma.elevoenske.findMany({ where: { maaned } }),
  ]);

  const ryttere = new Map(tilmeldinger.map((t) => [t.rytter.id, t.rytter]));
  const turnus: Record<string, number> = {};
  for (const t of forrige?.tildelinger ?? []) {
    const rytterId = t.holdtilmelding.rytter_id;
    if (ryttere.has(rytterId)) turnus[rytterId] = Math.max(turnus[rytterId] ?? 0, t.turnus_naeste_maaned);
  }

  const hesteData = heste.map(tilHestData).sort(efterId);
  return {
    input: {
      maaned,
      heste: hesteData,
      hold: hold.map(tilHoldData).sort(efterId),
      ryttere: [...ryttere.values()].map((r) => tilRytterRegelData(r, r.sikkerhedsprofil)).sort(efterId),
      tilmeldinger: tilmeldinger
        .map((t) => ({
          id: t.id,
          rytterId: t.rytter_id,
          holdId: t.hold_id,
          ancienitetDato: isoDato(t.ancienitet_dato),
        }))
        .sort(efterId),
      oensker: oensker
        .filter((o) => ryttere.has(o.rytter_id))
        .map((o) => ({
          rytterId: o.rytter_id,
          prioritet: o.prioritet as 1 | 2 | 3,
          hestId: o.oensket_hest_id,
        }))
        .sort((a, b) => sammenlign(a.rytterId, b.rytterId) || a.prioritet - b.prioritet),
      turnus: Object.fromEntries(Object.entries(turnus).sort(([a], [b]) => sammenlign(a, b))),
    },
    hold: new Map(hold.map((h) => [h.id, h])),
    fornavne: new Map([...ryttere.values()].map((r) => [r.id, r.fornavn])),
    hesteNavne: Object.fromEntries(hesteData.map((h) => [h.id, h.navn])),
    hesteStatus: Object.fromEntries(hesteData.map((h) => [h.id, statusTekst(h)])),
  };
}

/** sha256 af kanonisk JSON (T030): samme data giver samme hash. */
export function beregnInputHash(input: AllokeringsInput): string {
  return createHash('sha256').update(kanoniskJson(input)).digest('hex');
}

/** Kontekst til en personlig, dansk forklaring ("Sophia fik sit 2. ønske, Zigge"). */
export function forklaringskontekst(
  grundlag: KoerselGrundlag,
  holdId: string,
  hestId: string | null,
  rytterId?: string,
): ForklaringsKontekst {
  const hold = grundlag.hold.get(holdId);
  return {
    hesteNavne: grundlag.hesteNavne,
    hesteStatus: grundlag.hesteStatus,
    ugedag: hold ? (hold.ugedag as Ugedag) : undefined,
    hestId,
    rytterNavn: rytterId ? grundlag.fornavne.get(rytterId) : undefined,
  };
}
