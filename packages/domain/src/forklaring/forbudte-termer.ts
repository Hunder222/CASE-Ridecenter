/**
 * Ord, der kan afsløre helbredsoplysninger (GDPR art. 9). De må aldrig stå i forklaringer til stalden eller
 * forældre (domain-engine.md §3, invariant 5). Listen genbruges i Fase 2 til INSTRUKS_INDEHOLDER_DIAGNOSE.
 * Der sammenlignes som delstreng uden forskel på store og små bogstaver.
 */
export const FORBUDTE_TERMER: readonly string[] = [
  'diagnose',
  'angst',
  'adhd',
  'autisme',
  'autist',
  'traume',
  'brækket',
  'epilepsi',
  'diabetes',
  'depression',
  'medicin',
  'psykiatri',
  'psykisk',
  'ptsd',
  'tourette',
  'skizofreni',
  'bipolar',
  'spiseforstyrrelse',
  'handicap',
  'astma',
  'allergi',
];

/** Det første forbudte ord i teksten, eller undefined. */
export function forbudtTermI(tekst: string): string | undefined {
  const smaa = tekst.toLowerCase();
  return FORBUDTE_TERMER.find((term) => smaa.includes(term));
}
