import type { Basiskode } from './aarsagskoder';

/**
 * Dansk skabelon pr. årsagskode (domain-engine.md §4). Pladsholdere: {hest}, {hests} (genitiv), {rytter},
 * {dag}, {status} samt {, hest} og {: hest}, der udelades, når hesten ikke kendes. HC-07 nævner aldrig
 * årsagen, kun "af hensyn til rytterens sikkerhed (HC-07)" (invariant 5).
 */
export const SKABELONER: Readonly<Record<Basiskode, string>> = {
  HC01_DAGSGRAENSE: '{hest} har allerede 3 hold {dag} (max 3 af hensyn til hestevelfærd, HC-01)',
  HC02_SKAANE_DAGSGRAENSE: '{hest} er skånehest og må højst gå 2 hold om dagen (HC-02)',
  HC03_HVILEDAG: '{dag} er {hests} faste hviledag (HC-03)',
  HC04_IKKE_RASK: '{hest} er {status} (HC-04)',
  HC05_SPRINGFORBUD: '{hest} må ikke springe (HC-05)',
  HC05_SPRING_UGEGRAENSE: '{hest} har allerede sprunget denne uge (HC-05)',
  HC06_VAEGT: '{hest} passer ikke til rytterens størrelse (HC-06)',
  HC06_HOEJDE: '{hest} passer ikke til rytterens størrelse (HC-06)',
  HC07_FORBUDT_HEST: 'Ikke tilladt af hensyn til rytterens sikkerhed (HC-07)',
  HC07_KUN_PAAKRAEVET: 'Ikke tilladt af hensyn til rytterens sikkerhed (HC-07)',
  HC07_KUN_ROLIG: 'Ikke tilladt af hensyn til rytterens sikkerhed (HC-07)',
  HC08_NIVEAU_BEGYNDER: '{hest} er ikke godkendt til begynderhold (HC-08)',
  HC08_NIVEAU_OEVET: '{hest} bruges ikke på øvede hold (HC-08)',
  HC08_PARTHEST_RESERVERET: '{hest} er reserveret til sin part (HC-08)',
  HC08_PART_UDEN_NIVEAUGODKENDELSE:
    '{hest} er ikke godkendt til dette holds niveau, og partaftalen mangler ledelsens godkendelse (HC-08)',
  LEKTION_HEST_OPTAGET: '{hest} er allerede brugt på dette hold',
  IKKE_GODKENDT_TIL_RYTTER: '{hest} er ikke godkendt til denne rytter',
  SC01_OENSKE_1: '{rytter} fik sit 1. ønske{, hest} (SC-01)',
  SC01_OENSKE_2: '{rytter} fik sit 2. ønske{, hest} (SC-01)',
  SC01_OENSKE_3: '{rytter} fik sit 3. ønske{, hest} (SC-01)',
  SC02_TURNUS_PRIORITET: '{rytter} blev prioriteret efter sidste måneds udfald (SC-02)',
  SC02_TABT_TIL_TURNUS: '{hest} gik til en rytter med højere turnusprioritet (SC-02)',
  SC03_BELASTNINGSUDJAEVNING: 'Valgt for at fordele belastningen jævnt mellem hestene (SC-03)',
  SC04_PROGRESSION: 'Valgt som et passende udviklingstrin for rytteren (SC-04)',
  SC05_HJAELPER: 'Hjælpertildeling fra restkapaciteten (SC-05)',
  PARTAFTALE: 'Fast parthest{: hest} (partaftale, HC-08)',
  PAAKRAEVET_HEST: 'Fast hest af hensyn til rytterens sikkerhed (HC-07){: hest}',
  ALT_TILDELING: 'Alternativ tildeling (ønsker optaget){: hest}',
  IKKE_TILDELT_KAPACITET: 'Ikke tildelt – kapacitetsmangel: ingen lovlig hest var ledig',
};

/** Varianter, når en blød kode forklarer, hvorfor en bestemt ønsket hest blev fravalgt. */
export const BLOKERINGSSKABELONER: Readonly<Partial<Record<Basiskode, string>>> = {
  SC03_BELASTNINGSUDJAEVNING: '{hest} havde allerede mange hold i ugen, så belastningen blev fordelt (SC-03)',
};
