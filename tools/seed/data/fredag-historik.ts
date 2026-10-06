// Hestefordelingen januar–juni fra _resources/teacher/_case-01-fredagsheste jan-jun TIL CASE.md.
// null = '---' eller tom celle (rytteren gik ikke på holdet den måned).

type Seks = readonly [
  string | null,
  string | null,
  string | null,
  string | null,
  string | null,
  string | null,
];

export const HISTORIK: Readonly<Record<string, Seks>> = {
  // Hold 1 – Begynder 15:00
  'Ellen Frellsen': ['Bølle', 'Jane', 'Aslan', 'Donny', 'Rosa', 'Bølle'],
  'Filippa Udby': ['Jane', 'Toobi', 'Zigge', 'Aslan', 'Jane', null],
  'Johanne Johansen': ['Aslan', 'Zigge', 'Bølle', 'Toobi', 'Donny', 'Belle'],
  'Sofia Ejby': ['Belle', 'Aida', 'Jane', 'Belle', 'Belle', 'Donny'],
  'Alberte Solby': [null, null, 'Arthur', 'Arthur', 'Arthur', 'Arthur'],
  'Lærke Hansen': [null, null, 'Aida', 'Aida', 'Aida', 'Aida'],
  'Viola Jensen': [null, null, 'Wally', 'Zigge', 'Aslan', 'Aslan'],
  // Hold 2 – Letøvet 15:45
  'Freja Olsen': ['Jane', 'Aslan', 'Donny', 'Zigge', 'Twister', 'Zigge'],
  'Ella Lundkvist': ['Aslan', 'Toobi', 'Bølle', 'Donny', 'Aslan', 'Aslan'],
  'Freya Holm': ['Oline', 'Belle', 'Toobi', 'Aslan', 'Oline', 'Missy'],
  'Emma Grønby': [null, 'Bølle', 'Karla', 'Zigge', 'Bølle', 'Boy'],
  'Lærke Broby': [null, 'Wally', 'Wally', 'Bølle', 'Zigge', 'Toobi'],
  'Nora Grønbjerg': ['Bølle', 'Donny', 'Oline', 'Oline', 'Toobi', 'Oline'],
  'Sophia Kronborg': ['Toobi', 'Aslan', 'Donny', 'Toobi', 'Twister', 'Donny'],
  'Viktoria Kristensen': ['Donny', 'Zigge', 'Belle', 'Belle', 'Donny', 'Belle'],
  'Victoria Åby': ['Zigge', 'Oline', 'Boy', 'Boy', 'Pixie', 'Zigge'],
  // Hold 3 – Øvet 16:30
  'Andrea Dahl': ['Oline', 'Oline', 'Donny', 'Missy', 'Freya', 'Freya'],
  'Clara Bjerg': ['Boy', 'Boy', 'Belle', 'Boy', 'Missy', 'Oline'],
  'Ella Justesen': ['Pixie', 'Belle', 'Aslan', 'Rosa', 'Oline', 'Pixie'],
  'Josefine Ibsen': ['Zigge', 'Zigge', 'Zigge', 'Zigge', 'Toobi', 'Toobi'],
  'Klara Holmeby': ['Belle', 'Donny', 'Toobi', 'Aslan', 'Bølle', 'Twister'],
  'Leonora Vinter': [null, null, null, null, null, 'Boy'],
  'Molly Jensen': ['Bølle', 'Bølle', 'Bølle', 'Bølle', 'Aslan', 'Aslan'],
  'Marie Rundholm': ['Missy', 'Aida', 'Jane', 'Jane', 'Zigge', 'Zigge'],
  'Sara Troelsen': ['Toobi', 'Toobi', 'Oline', 'Oline', 'Boy', 'Missy'],
  'Sofia Westergaard': ['Cornelius', 'Jane', 'Boy', 'Twister', 'Cornelius', 'TryMe'],
  // Hold 4 – Letøvet 17:15
  'Agnes Riis': ['Aslan', 'Aslan', null, 'Belle', 'Boy', 'Oline'],
  'Anna Gammelgård': ['Donny', 'Donny', 'Donny', 'Donny', 'Donny', 'Donny'],
  'Johanna Rindbo': ['Belle', 'Oline', 'Missy', 'Boy', 'Missy', 'Missy'],
  'Freja Pedersen': ['Oline', 'Belle', 'Zigge', 'Missy', 'Belle', 'Belle'],
  'Josephine Iversen': ['Karla', 'Bølle', 'Aslan', 'Bølle', 'Bølle', 'Toobi'],
  'Liv Danby': ['Wally', 'Wally', 'Wally', 'Toobi', 'Toobi', 'Bølle'],
  'Selma Janbo': ['Boy', 'Boy', 'Boy', 'Oline', 'Pixie', 'Pixie'],
  'Victoria Skovby': [null, null, null, null, 'Wally', 'Jane'],
};

/** Favoritter fra Maries noter, hvor de afviger fra juni-hesten. Nora skaber F-15-konflikten med Sophia. */
const FAVORITTER: Readonly<Record<string, string>> = {
  'Sophia Kronborg': 'Toobi',
  'Nora Grønbjerg': 'Toobi',
  'Josefine Ibsen': 'Zigge',
  'Agnes Riis': 'Belle',
};

/** Ryttere, der ifølge noterne ikke fik deres 1. ønske i juni (giver turnus i den næste måned). */
const JUNI_UDFALD: Readonly<Record<string, 2 | 3>> = {
  'Sophia Kronborg': 2, // ønskede Toobi, fik Donny
  'Josefine Ibsen': 2, // ønskede Zigge, fik Toobi
  'Agnes Riis': 3, // ønskede Belle, fik Oline
};

function historikFor(rytter: string): Seks {
  const historik = HISTORIK[rytter];
  if (!historik) throw new Error(`Ingen historik for ${rytter}`);
  return historik;
}

/** Første dag i den første måned (2026), hvor rytteren havde en hest. Bruges som ancienitet. */
export function foersteMaanedMedHest(rytter: string): string {
  const indeks = historikFor(rytter).findIndex((hest) => hest !== null);
  return `2026-${String(indeks + 1).padStart(2, '0')}-01`;
}

/** Op til 3 unikke ønsker: favoritten (hvis den afviger), ellers juni-hesten, derefter bagud i tid. */
export function afledOensker(rytter: string): string[] {
  const oensker: string[] = [];
  const favorit = FAVORITTER[rytter];
  if (favorit) oensker.push(favorit);
  const historik = historikFor(rytter);
  for (let i = historik.length - 1; i >= 0 && oensker.length < 3; i--) {
    const hest = historik[i];
    if (hest && !oensker.includes(hest)) oensker.push(hest);
  }
  return oensker;
}

/** Juni-hesten og hvilket ønske den var. null, hvis rytteren ikke red i juni. */
export function afledJuniUdfald(rytter: string): { hest: string; oenskeOpfyldt: 1 | 2 | 3 } | null {
  const juni = historikFor(rytter)[5];
  if (!juni) return null;
  return { hest: juni, oenskeOpfyldt: JUNI_UDFALD[rytter] ?? 1 };
}
