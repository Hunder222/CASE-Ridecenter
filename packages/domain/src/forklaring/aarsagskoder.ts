// Årsagskoder fra contracts/domain-engine.md §4 (+ IKKE_GODKENDT_TIL_RYTTER fra §6).
// 'haard' udelukker en hest, 'bloed' begrunder et valg, 'udfald' beskriver resultatet.

export type Kodetype = 'haard' | 'bloed' | 'udfald';

export const AARSAGSKODER = {
  HC01_DAGSGRAENSE: { type: 'haard', regel: 'HC-01' },
  HC02_SKAANE_DAGSGRAENSE: { type: 'haard', regel: 'HC-02' },
  HC03_HVILEDAG: { type: 'haard', regel: 'HC-03' },
  HC04_IKKE_RASK: { type: 'haard', regel: 'HC-04' },
  HC05_SPRINGFORBUD: { type: 'haard', regel: 'HC-05' },
  HC05_SPRING_UGEGRAENSE: { type: 'haard', regel: 'HC-05' },
  HC06_VAEGT: { type: 'haard', regel: 'HC-06' },
  HC06_HOEJDE: { type: 'haard', regel: 'HC-06' },
  HC07_FORBUDT_HEST: { type: 'haard', regel: 'HC-07' },
  HC07_KUN_PAAKRAEVET: { type: 'haard', regel: 'HC-07' },
  HC07_KUN_ROLIG: { type: 'haard', regel: 'HC-07' },
  HC08_NIVEAU_BEGYNDER: { type: 'haard', regel: 'HC-08' },
  HC08_NIVEAU_OEVET: { type: 'haard', regel: 'HC-08' },
  HC08_PARTHEST_RESERVERET: { type: 'haard', regel: 'HC-08' },
  HC08_PART_UDEN_NIVEAUGODKENDELSE: { type: 'haard', regel: 'HC-08' },
  LEKTION_HEST_OPTAGET: { type: 'haard', regel: 'Lektion' },
  IKKE_GODKENDT_TIL_RYTTER: { type: 'haard', regel: 'HC-06/HC-07/HC-08' },
  SC01_OENSKE_1: { type: 'bloed', regel: 'SC-01' },
  SC01_OENSKE_2: { type: 'bloed', regel: 'SC-01' },
  SC01_OENSKE_3: { type: 'bloed', regel: 'SC-01' },
  SC02_TURNUS_PRIORITET: { type: 'bloed', regel: 'SC-02' },
  SC02_TABT_TIL_TURNUS: { type: 'bloed', regel: 'SC-02' },
  SC03_BELASTNINGSUDJAEVNING: { type: 'bloed', regel: 'SC-03' },
  SC04_PROGRESSION: { type: 'bloed', regel: 'SC-04' },
  SC05_HJAELPER: { type: 'bloed', regel: 'SC-05' },
  PARTAFTALE: { type: 'udfald', regel: 'HC-08' },
  PAAKRAEVET_HEST: { type: 'udfald', regel: 'HC-07' },
  ALT_TILDELING: { type: 'udfald', regel: 'SC-01' },
  IKKE_TILDELT_KAPACITET: { type: 'udfald', regel: 'HC-01–HC-08' },
} as const satisfies Record<string, { type: Kodetype; regel: string }>;

export type Basiskode = keyof typeof AARSAGSKODER;

/** En basiskode eller en kode kvalificeret med hestens id: `KODE:<hestId>`. */
export type Aarsagskode = Basiskode | `${Basiskode}:${string}`;

export function kvalificer(kode: Basiskode, hestId: string): Aarsagskode {
  return `${kode}:${hestId}`;
}

export function opdel(kode: Aarsagskode): { basis: Basiskode; hestId?: string } {
  const i = kode.indexOf(':');
  if (i === -1) return { basis: kode as Basiskode };
  return { basis: kode.slice(0, i) as Basiskode, hestId: kode.slice(i + 1) };
}

export function erHaardKode(kode: Aarsagskode): boolean {
  return AARSAGSKODER[opdel(kode).basis].type === 'haard';
}
