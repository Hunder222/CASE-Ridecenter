import { FORBUDTE_TERMER } from '../forklaring/forbudte-termer';

export interface DiagnoseValideringsResultat {
  gyldig: boolean;
  overtraedelser?: string[];
}

/**
 * Validerer en adfærdsinstruks jf. GDPR Art. 9 og FR-012.
 * Instruksen skal være handlingsorienteret (f.eks. "OBS: Følsom/skånsom håndtering påkrævet - trækkes op i ro", "Hold 3 meters afstand")
 * og må ALDRIG indeholde medicinske eller psykiatriske diagnoser/termer (ADHD, autisme, epilepsi, angst, traume osv.).
 */
export function validerAdfaerdsinstruks(tekst: string): DiagnoseValideringsResultat {
  if (!tekst || tekst.trim().length === 0) {
    return { gyldig: true };
  }

  const smaa = tekst.toLowerCase();
  const fundne: string[] = [];

  for (const term of FORBUDTE_TERMER) {
    // Tjek om termen optræder som delstreng eller ord
    if (smaa.includes(term.toLowerCase())) {
      fundne.push(term);
    }
  }

  if (fundne.length > 0) {
    return {
      gyldig: false,
      overtraedelser: fundne,
    };
  }

  return { gyldig: true };
}

