import { describe, expect, it } from 'vitest';
import {
  beregnAutomatiskLukketid,
  erFremmoedeAabent,
  validerKorrektionBegrundelse,
} from '../../../src/kalender/fremmoede-vindue';

describe('Fremmødevindue og korrektion (US1, FR-004, FR-017, sync-protocol §3)', () => {
  const dato = '2026-10-09'; // Fredag
  const starttid = '16:30';
  const varighedMin = 45; // Slutter 17:15, automatisk lukketid 17:45 lokal tid

  describe('erFremmoedeAabent', () => {
    it('er lukket før 30 min. før starttidspunkt', () => {
      // 15:59 er mere end 30 min. før 16:30
      const nu = new Date('2026-10-09T13:59:00.000Z'); // 15:59 i Europe/Copenhagen (+2 sommertid)
      const aabent = erFremmoedeAabent({
        dato,
        starttid,
        varighedMin,
        lukketTidspunkt: null,
        nu,
      });
      expect(aabent).toBe(false);
    });

    it('er åbent 30 min. før starttidspunkt', () => {
      // 16:00 er præcis 30 min. før 16:30
      const nu = new Date('2026-10-09T14:00:00.000Z'); // 16:00 lokal
      const aabent = erFremmoedeAabent({
        dato,
        starttid,
        varighedMin,
        lukketTidspunkt: null,
        nu,
      });
      expect(aabent).toBe(true);
    });

    it('forbliver åbent under lektionen', () => {
      const nu = new Date('2026-10-09T14:45:00.000Z'); // 16:45 lokal
      const aabent = erFremmoedeAabent({
        dato,
        starttid,
        varighedMin,
        lukketTidspunkt: null,
        nu,
      });
      expect(aabent).toBe(true);
    });

    it('forbliver åbent indtil 30 min. efter lektionens slut', () => {
      // Slut: 17:15. +30 min = 17:45. Kl. 17:44 skal være åbent.
      const nu = new Date('2026-10-09T15:44:00.000Z'); // 17:44 lokal
      const aabent = erFremmoedeAabent({
        dato,
        starttid,
        varighedMin,
        lukketTidspunkt: null,
        nu,
      });
      expect(aabent).toBe(true);
    });

    it('lukker automatisk 30 min. efter sluttidspunkt', () => {
      // Kl. 17:46 er efter automatisk lukketid
      const nu = new Date('2026-10-09T15:46:00.000Z'); // 17:46 lokal
      const aabent = erFremmoedeAabent({
        dato,
        starttid,
        varighedMin,
        lukketTidspunkt: null,
        nu,
      });
      expect(aabent).toBe(false);
    });

    it('er lukket hvis der foreligger et manuelt lukketTidspunkt ("Afslut hold")', () => {
      const manueltLukket = new Date('2026-10-09T14:50:00.000Z'); // 16:50 lokal
      const nu = new Date('2026-10-09T14:55:00.000Z'); // 16:55 lokal
      const aabent = erFremmoedeAabent({
        dato,
        starttid,
        varighedMin,
        lukketTidspunkt: manueltLukket,
        nu,
      });
      expect(aabent).toBe(false);
    });
  });

  describe('beregnAutomatiskLukketid', () => {
    it('beregner automatisk lukketid til 30 min. efter lektionens slut i Europe/Copenhagen', () => {
      const lukketid = beregnAutomatiskLukketid({
        dato,
        starttid: '16:30',
        varighedMin: 45,
      });
      // 16:30 + 45 min = 17:15. + 30 min = 17:45 Europe/Copenhagen (UTC+2) = 15:45:00 UTC
      expect(lukketid.toISOString()).toBe('2026-10-09T15:45:00.000Z');
    });
  });

  describe('validerKorrektionBegrundelse', () => {
    it('afviser tomme strenge eller strenge med kun whitespace', () => {
      expect(validerKorrektionBegrundelse('')).toBe(false);
      expect(validerKorrektionBegrundelse('   ')).toBe(false);
    });

    it('afviser tekst under 5 tegn', () => {
      expect(validerKorrektionBegrundelse('Fejl')).toBe(false);
      expect(validerKorrektionBegrundelse('1234')).toBe(false);
    });

    it('godkender tekst på mindst 5 tegn', () => {
      expect(validerKorrektionBegrundelse('Fejlafkrydsning')).toBe(true);
      expect(validerKorrektionBegrundelse('Kom for sent')).toBe(true);
      expect(validerKorrektionBegrundelse('12345')).toBe(true);
    });
  });
});

