import { describe, expect, it } from 'vitest';
import {
  rangerVenteliste,
  type FrigjortHestInfo,
  type HoldKontekst,
  type VentelisteKandidat,
} from '../../../src/venteliste/ranger-venteliste';

describe('Ventelisterangering (US4, FR-015, SC-006, T152)', () => {
  const hold: HoldKontekst = {
    id: 'hold-1',
    holdnavn: 'Tirsdag 17:00 Letøvet',
    niveau: 'Letoevet',
  };

  const hest: FrigjortHestInfo = {
    id: 'hest-1',
    navn: 'Bella',
    maxRytterVaegtKg: 65,
    maxRytterHoejdeCm: 175,
    temperament: 'Rolig',
  };

  it('sorterer kandidater efter FIFO-tilmeldingsdato', () => {
    const kandidater: VentelisteKandidat[] = [
      {
        id: 'v1',
        rytterId: 'r1',
        tilmeldingsdato: '2026-09-15',
        oensketHoldId: 'hold-1',
        oensketNiveau: 'Letoevet',
        vaegtKg: 50,
      },
      {
        id: 'v2',
        rytterId: 'r2',
        tilmeldingsdato: '2026-08-01', // ældst
        oensketHoldId: 'hold-1',
        oensketNiveau: 'Letoevet',
        vaegtKg: 55,
      },
      {
        id: 'v3',
        rytterId: 'r3',
        tilmeldingsdato: '2026-09-01',
        oensketHoldId: 'hold-1',
        oensketNiveau: 'Letoevet',
        vaegtKg: 45,
      },
    ];

    const resultat = rangerVenteliste(kandidater, hold, hest);

    expect(resultat.map((k) => k.id)).toEqual(['v2', 'v3', 'v1']);
  });

  it('filtrerer kandidater hvis niveau ikke matcher holdet', () => {
    const kandidater: VentelisteKandidat[] = [
      {
        id: 'v1',
        rytterId: 'r1',
        tilmeldingsdato: '2026-08-01',
        oensketHoldId: null,
        oensketNiveau: 'Begynder', // matcher ikke Letoevet
      },
      {
        id: 'v2',
        rytterId: 'r2',
        tilmeldingsdato: '2026-09-01',
        oensketHoldId: null,
        oensketNiveau: 'Letoevet', // matcher
      },
    ];

    const resultat = rangerVenteliste(kandidater, hold, hest);

    expect(resultat.length).toBe(1);
    expect(resultat[0]!.id).toBe('v2');
  });

  it('filtrerer kandidat hvis vægt overstiger hestens maxRytterVaegtKg (HC-07)', () => {
    const kandidater: VentelisteKandidat[] = [
      {
        id: 'v1',
        rytterId: 'r1',
        tilmeldingsdato: '2026-08-01',
        oensketHoldId: 'hold-1',
        oensketNiveau: 'Letoevet',
        vaegtKg: 70, // Overstiger Bellas 65 kg
      },
      {
        id: 'v2',
        rytterId: 'r2',
        tilmeldingsdato: '2026-09-01',
        oensketHoldId: 'hold-1',
        oensketNiveau: 'Letoevet',
        vaegtKg: 60, // OK
      },
    ];

    const resultat = rangerVenteliste(kandidater, hold, hest);

    expect(resultat.length).toBe(1);
    expect(resultat[0]!.id).toBe('v2');
  });

  it('filtrerer kandidat hvis rytter kræver rolig hest og hesten er Frisk (HC-08)', () => {
    const friskHest: FrigjortHestInfo = {
      ...hest,
      temperament: 'Frisk',
    };

    const kandidater: VentelisteKandidat[] = [
      {
        id: 'v1',
        rytterId: 'r1',
        tilmeldingsdato: '2026-08-01',
        oensketHoldId: 'hold-1',
        oensketNiveau: 'Letoevet',
        kunRoligeHeste: true, // Kræver rolig hest
      },
      {
        id: 'v2',
        rytterId: 'r2',
        tilmeldingsdato: '2026-09-01',
        oensketHoldId: 'hold-1',
        oensketNiveau: 'Letoevet',
        kunRoligeHeste: false,
      },
    ];

    const resultat = rangerVenteliste(kandidater, hold, friskHest);

    expect(resultat.length).toBe(1);
    expect(resultat[0]!.id).toBe('v2');
  });
});

