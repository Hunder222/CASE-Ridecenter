import type { Niveau, Temperament, Ugedag } from '@ridecenter/domain';
import { brugerId, holdId } from './brugere-og-hold';
import { byggFredagsdata, kontrollerSeeddata } from './fredag';
import { ALDERSTABEL, slug } from './fredag-ryttere';
import { HVILEDAGE_CYKLUS, hestId, maxRytterHoejde, maxRytterVaegt } from './heste';
import { stabilId } from './id';
import { foersteDag, forrigeMaaned } from './maaned';
import type { SeedHest, SeedHold, Seeddata } from './typer';

// Seed "fuld" til benchmark (SC-004) og egenskabstest: casens fredag + en deterministisk generator,
// der fylder ugen ud til 29 hold, 180 ryttere og 22 heste efter _case-01-Holdoversigt, uge.md.
// Alle data ud over fredagen er syntetiske.

const PRNG_SEED = 20260706;

/** Deterministisk PRNG (mulberry32): samme seed giver altid samme data. */
function mulberry32(seed: number): () => number {
  let tilstand = seed;
  return () => {
    tilstand = (tilstand + 0x6d2b79f5) | 0;
    let t = Math.imul(tilstand ^ (tilstand >>> 15), 1 | tilstand);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

interface HoldSkabelon {
  niveau: Niveau;
  spring?: boolean;
  varighed?: number;
}

/** Ugeoversigten uden fredag (fredagen kommer fra byggFredagsdata). Starttider er [Demoværdi]. */
const UGE: readonly { ugedag: Ugedag; underviser: string; start: string; hold: readonly HoldSkabelon[] }[] = [
  {
    ugedag: 1,
    underviser: 'Malene',
    start: '15:00',
    hold: [{ niveau: 'Letoevet' }, { niveau: 'Oevet' }, { niveau: 'Letoevet' }, { niveau: 'Letoevet' }],
  },
  {
    ugedag: 2,
    underviser: 'Malene',
    start: '15:00',
    hold: [
      { niveau: 'Letoevet', spring: true },
      { niveau: 'Letoevet', spring: true },
      { niveau: 'Oevet', spring: true },
      { niveau: 'Oevet', spring: true },
    ],
  },
  {
    ugedag: 3,
    underviser: 'Camilla',
    start: '15:00',
    hold: [{ niveau: 'Begynder' }, { niveau: 'Letoevet' }, { niveau: 'Letoevet' }, { niveau: 'Begynder' }],
  },
  {
    ugedag: 4,
    underviser: 'Malene',
    start: '15:00',
    hold: [{ niveau: 'Letoevet' }, { niveau: 'Letoevet' }, { niveau: 'Oevet' }, { niveau: 'Oevet' }],
  },
  {
    ugedag: 6,
    underviser: 'Marie',
    start: '09:00',
    hold: [
      { niveau: 'Begynder' },
      { niveau: 'Traekhold' },
      { niveau: 'Traekhold', varighed: 30 },
      { niveau: 'Traekhold' },
      { niveau: 'Traekhold' },
    ],
  },
  {
    ugedag: 7,
    underviser: 'Birgit',
    start: '10:00',
    hold: [{ niveau: 'Parthold' }, { niveau: 'Traekhold' }, { niveau: 'Traekhold' }, { niveau: 'Traekhold' }],
  },
];

const DAGE = ['', 'Mandag', 'Tirsdag', 'Onsdag', 'Torsdag', 'Fredag', 'Lørdag', 'Søndag'];
const NIVEAUNAVN: Record<Niveau, string> = {
  Traekhold: 'Trækhold',
  Begynder: 'Begynder',
  Letoevet: 'Letøvet',
  Oevet: 'Øvet',
  Parthold: 'Parthold',
};
const ALDER: Record<Niveau, readonly [number, number]> = {
  Traekhold: [5, 7],
  Begynder: [7, 9],
  Letoevet: [9, 13],
  Oevet: [12, 17],
  Parthold: [10, 14],
};

const FORNAVNE = [
  'Alma',
  'Anna',
  'Asta',
  'Clara',
  'Ellen',
  'Emilie',
  'Emma',
  'Freja',
  'Frida',
  'Ida',
  'Isabella',
  'Johanne',
  'Josefine',
  'Karla',
  'Laura',
  'Lea',
  'Liva',
  'Lærke',
  'Maja',
  'Marie',
  'Mathilde',
  'Nanna',
  'Nora',
  'Olivia',
  'Sara',
  'Selma',
  'Signe',
  'Sofie',
  'Thea',
  'Vigga',
  'Agnes',
  'Ella',
  'Esther',
  'Malthe',
  'William',
  'Noah',
  'Oscar',
  'Carl',
  'Alfred',
  'Viktor',
];
const EFTERNAVNE = [
  'Andersen',
  'Bach',
  'Berg',
  'Dahl',
  'Eriksen',
  'Frost',
  'Hansen',
  'Holm',
  'Iversen',
  'Jensen',
  'Juhl',
  'Kjær',
  'Krog',
  'Lund',
  'Madsen',
  'Mikkelsen',
  'Mortensen',
  'Nielsen',
  'Nygaard',
  'Olsen',
  'Pedersen',
  'Poulsen',
  'Rasmussen',
  'Schmidt',
  'Skov',
  'Storm',
  'Thomsen',
  'Vestergaard',
  'Winther',
  'Østergaard',
];

function to(tal: number): string {
  return String(tal).padStart(2, '0');
}

function plusMinutter(tid: string, minutter: number): string {
  const [timer, min] = tid.split(':').map(Number) as [number, number];
  const ialt = timer * 60 + min + minutter;
  return `${to(Math.floor(ialt / 60))}:${to(ialt % 60)}`;
}

/** Hestene fortsætter hviledagscyklussen efter de 20 fredagsheste. */
function ekstraHest(
  navn: string,
  stangmaalCm: number,
  temperament: Temperament,
  skaane: boolean,
  indeks: number,
  staldnoter: string,
): SeedHest {
  return {
    id: hestId(navn),
    navn,
    stangmaalCm,
    maxRytterVaegtKg: maxRytterVaegt(stangmaalCm),
    maxRytterHoejdeCm: maxRytterHoejde(stangmaalCm),
    temperament,
    godkendtTilBegyndere: false,
    egnetOevet: true,
    skaane,
    maxLektionerDag: skaane ? 2 : 3,
    springforbud: false,
    maxSpringUge: 1,
    hviledag: HVILEDAGE_CYKLUS[indeks % HVILEDAGE_CYKLUS.length] as Ugedag,
    sundhedsstatus: 'Aktiv',
    aktiv: true,
    staldnoter,
  };
}

export function byggFuldData(maaned = '2026-07'): Seeddata {
  const fredag = byggFredagsdata(maaned);
  const forrige = forrigeMaaned(maaned);
  const rng = mulberry32(PRNG_SEED);
  const heltal = (min: number, max: number) => min + Math.floor(rng() * (max - min + 1));
  const vaelg = <T>(liste: readonly T[]): T => liste[Math.floor(rng() * liste.length)] as T;

  const heste: SeedHest[] = [
    ...fredag.heste,
    ekstraHest('Sally', 150, 'Rolig', true, fredag.heste.length, 'Seniorhest – højst 2 hold om dagen'),
    ekstraHest('Nova', 145, 'Normal', false, fredag.heste.length + 1, ''),
  ];

  // Hold: begynder- og springhold får 4 ryttere (hestene begrænser dem, research D2/D3), de øvrige 6–7.
  const hold: SeedHold[] = [...fredag.hold];
  const nyeHold: { hold: SeedHold; antalRyttere: number }[] = [];
  let oevrigeHold = 0;
  for (const dag of UGE) {
    let tid = dag.start;
    for (const skabelon of dag.hold) {
      const varighed = skabelon.varighed ?? 45;
      const holdnavn = `${DAGE[dag.ugedag]} ${tid} ${NIVEAUNAVN[skabelon.niveau]}${skabelon.spring ? ' spring' : ''}${varighed === 30 ? ' (30 min.)' : ''}`;
      const nyt: SeedHold = {
        id: holdId(holdnavn),
        holdnavn,
        niveau: skabelon.niveau,
        erSpringhold: skabelon.spring ?? false,
        ugedag: dag.ugedag,
        starttid: tid,
        varighedMin: varighed,
        maxKapacitet: 10,
        fastUnderviserId: brugerId(dag.underviser),
      };
      const begraenset = skabelon.niveau === 'Begynder' || skabelon.spring === true;
      const antalRyttere = begraenset ? 4 : oevrigeHold++ < 10 ? 7 : 6;
      hold.push(nyt);
      nyeHold.push({ hold: nyt, antalRyttere });
      tid = plusMinutter(tid, varighed);
    }
  }

  const ryttere = [...fredag.ryttere];
  const tilmeldinger = [...fredag.tilmeldinger];
  const oensker = [...fredag.oensker];
  const historik = [...fredag.historik];
  const brugteNavne = new Set(fredag.ryttere.map((r) => `${r.fornavn} ${r.efternavn}`));
  const brugtePartheste = new Set(
    fredag.ryttere.flatMap((r) => (r.partaftaleHestId ? [r.partaftaleHestId] : [])),
  );
  let loebenummer = fredag.ryttere.length;

  for (const { hold: aktueltHold, antalRyttere } of nyeHold) {
    for (let i = 0; i < antalRyttere; i++) {
      loebenummer++;
      let navn: string;
      do {
        navn = `${vaelg(FORNAVNE)} ${vaelg(EFTERNAVNE)}`;
      } while (brugteNavne.has(navn));
      brugteNavne.add(navn);
      const [fornavn, efternavn] = navn.split(' ') as [string, string];

      const [minAlder, maxAlder] = ALDER[aktueltHold.niveau];
      const alder = heltal(minAlder, maxAlder);
      const [standardHoejde, standardVaegt] = ALDERSTABEL[alder] as readonly [number, number];
      const hoejdeCm = standardHoejde + heltal(-3, 3);
      const vaegtKg = standardVaegt + heltal(-3, 3);
      const kunRolige = rng() < 0.05;
      const forbudte = rng() < 0.03 ? [vaelg(heste).id] : [];

      // Partryttere får en hest, der passer til dem og ikke har hviledag på holdets dag.
      let partaftaleHestId: string | null = null;
      if (aktueltHold.niveau === 'Parthold') {
        const kandidater = heste.filter(
          (hest) =>
            !brugtePartheste.has(hest.id) &&
            hest.hviledag !== aktueltHold.ugedag &&
            hest.maxRytterVaegtKg >= vaegtKg &&
            (hest.maxRytterHoejdeCm === null || hest.maxRytterHoejdeCm >= hoejdeCm) &&
            !forbudte.includes(hest.id) &&
            !(kunRolige && hest.temperament === 'Frisk'),
        );
        if (kandidater.length > 0) {
          partaftaleHestId = vaelg(kandidater).id;
          brugtePartheste.add(partaftaleHestId);
        }
      }

      const id = stabilId('rytter', `fuld:${navn}`);
      ryttere.push({
        id,
        fornavn,
        efternavn,
        foedselsdato: `${2025 - alder}-${to(heltal(1, 12))}-${to(heltal(1, 28))}`,
        bopaelskommune: rng() < 0.9 ? 'Strandby' : 'Nabokommune',
        hoejdeCm,
        vaegtKg,
        erfaringsniveau:
          aktueltHold.niveau === 'Oevet'
            ? 'Oevet'
            : aktueltHold.niveau === 'Letoevet' || aktueltHold.niveau === 'Parthold'
              ? 'Letoevet'
              : 'Begynder',
        klarTilUdvikling: rng() < 0.1,
        erHjaelper: false,
        partaftaleHestId,
        partaftaleGodkendtTrodsNiveau: false,
        forbudteHeste: forbudte,
        paakraevedeHeste: [],
        kunRoligeHeste: kunRolige,
        kontaktpersonNavn: `Forælder til ${fornavn}`,
        kontaktTelefon: `+45 20 00 ${to(Math.floor(loebenummer / 100))} ${to(loebenummer % 100)}`,
        kontaktEmail: `foraelder.${slug(navn)}@example.dk`,
        aktivStatus: 'Aktiv',
        faldtraumeNote: null,
        angstkategori: kunRolige ? 'Usikker rytter (syntetisk)' : null,
        internNote: null,
      });

      tilmeldinger.push({
        id: stabilId('tilmelding', `fuld:${navn}|${aktueltHold.holdnavn}`),
        rytterId: id,
        holdId: aktueltHold.id,
        ancienitetDato: `${heltal(2023, 2026)}-${to(heltal(1, 12))}-01`,
        gyldigFra: foersteDag(forrige),
      });

      // 3 tilfældige ønsker. Nogle rammer spærrede heste, hvilket tester alternativ tildeling.
      const oenskede = new Set<string>();
      while (oenskede.size < 3) oenskede.add(vaelg(heste).id);
      [...oenskede].forEach((oensketHest, j) =>
        oensker.push({ rytterId: id, maaned, prioritet: (j + 1) as 1 | 2 | 3, hestId: oensketHest }),
      );

      const turnus = heltal(0, 3);
      historik.push({
        rytterId: id,
        holdId: aktueltHold.id,
        maaned: forrige,
        hestId: vaelg(heste).id,
        oenskeOpfyldt: turnus === 3 ? null : ((turnus + 1) as 1 | 2 | 3),
        erAlternativ: turnus === 3,
        turnusNaesteMaaned: turnus,
      });
    }
  }

  const data: Seeddata = {
    maaned,
    brugere: fredag.brugere,
    heste,
    ryttere,
    hold,
    tilmeldinger,
    oensker,
    historik,
  };
  kontrollerSeeddata(data, { ryttere: 180, heste: 22, hold: 29 });
  return data;
}
