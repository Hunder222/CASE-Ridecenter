import { describe, expect, it } from 'vitest';
import { validerAdfaerdsinstruks } from '../../../src/sikkerhed/diagnose-filter';

describe('Diagnose-filter for adfærdsinstruks (US3, T138)', () => {
  it('tillader handlingsorienterede instrukser uden diagnoseord', () => {
    const gyldige = [
      'OBS: Følsom/skånsom håndtering påkrævet - trækkes op i ro',
      'Hold 3 meters afstand til andre heste i ridehuset',
      'Brug skammel ved opstigning',
      'Hesten skal have dækken på efter ridning',
      'Taler bedst til rolig og bestemt stemmeføring',
    ];

    for (const instruks of gyldige) {
      const resultat = validerAdfaerdsinstruks(instruks);
      expect(resultat.gyldig).toBe(true);
      expect(resultat.overtraedelser).toBeUndefined();
    }
  });

  it('afviser medicinske og psykiatriske diagnoser med overtrædelsesliste', () => {
    const ugyldige = [
      { tekst: 'Rytteren har ADHD og har brug for ekstra pauser', term: 'adhd' },
      { tekst: 'Svær autisme - må ikke presses', term: 'autisme' },
      { tekst: 'Har epilepsi og skal have ledsager', term: 'epilepsi' },
      { tekst: 'Lider af angst efter tidligere ulykke', term: 'angst' },
      { tekst: 'Faldtraume fra sidste sæson', term: 'traume' },
      { tekst: 'Tager medicin mod depression', term: 'medicin' },
    ];

    for (const { tekst, term } of ugyldige) {
      const resultat = validerAdfaerdsinstruks(tekst);
      expect(resultat.gyldig).toBe(false);
      expect(resultat.overtraedelser).toContain(term);
    }
  });
});

