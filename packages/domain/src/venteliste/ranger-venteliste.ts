import type { Niveau, Temperament } from '../typer';

export interface VentelisteKandidat {
  id: string; // venteliste id
  rytterId: string;
  tilmeldingsdato: string; // ISO date 'YYYY-MM-DD'
  oensketHoldId: string | null;
  oensketNiveau: Niveau | null;
  rytterNavn?: string;
  kontaktTelefon?: string;
  kontaktNavn?: string;
  // Fysiologiske data til validering mod hest (HC-06/07/08)
  vaegtKg?: number;
  hoejdeCm?: number;
  erfaring?: 'Begynder' | 'Letoevet' | 'Oevet';
  kunRoligeHeste?: boolean;
}

export interface FrigjortHestInfo {
  id: string;
  navn: string;
  stangmaalCm?: number;
  maxRytterVaegtKg?: number;
  maxRytterHoejdeCm?: number | null;
  temperament?: Temperament;
  sundhedsstatus?: string;
}

export interface HoldKontekst {
  id: string;
  holdnavn: string;
  niveau: Niveau;
}

/**
 * Rangerer og filtrerer ventelistekandidater for en ledig lektion/plads (US4, FR-015, SC-006).
 *
 * Regler:
 * 1. Filtrering:
 *    - Niveau: Skal matche holdets niveau (eller oensketHoldId === hold.id).
 *    - Fysiske grænser: Rytterens vægt må ikke overstige hestens maxRytterVaegtKg (HC-07).
 *    - Temperament: Hvis rytteren kræver rolige heste, må hesten ikke være 'Frisk' (HC-08).
 * 2. Rangering:
 *    - FIFO: Ældste tilmeldingsdato først.
 */
export function rangerVenteliste(
  kandidater: readonly VentelisteKandidat[],
  hold: HoldKontekst,
  frigjortHest?: FrigjortHestInfo | null
): VentelisteKandidat[] {
  const egnede = kandidater.filter((k) => {
    // 1. Tjek hold/niveau match
    if (k.oensketHoldId && k.oensketHoldId !== hold.id) {
      return false;
    }
    if (k.oensketNiveau && k.oensketNiveau !== hold.niveau) {
      return false;
    }

    // 2. Tjek fysiologisk match mod hesten hvis angivet
    if (frigjortHest) {
      if (k.vaegtKg !== undefined && frigjortHest.maxRytterVaegtKg !== undefined) {
        if (k.vaegtKg > frigjortHest.maxRytterVaegtKg) {
          return false;
        }
      }
      if (k.hoejdeCm !== undefined && frigjortHest.maxRytterHoejdeCm !== null && frigjortHest.maxRytterHoejdeCm !== undefined) {
        if (k.hoejdeCm > frigjortHest.maxRytterHoejdeCm) {
          return false;
        }
      }
      if (k.kunRoligeHeste && frigjortHest.temperament === 'Frisk') {
        return false;
      }
    }

    return true;
  });

  // Sorter efter tilmeldingsdato (FIFO: ældste først)
  return [...egnede].sort((a, b) => {
    const datoA = new Date(a.tilmeldingsdato).getTime();
    const datoB = new Date(b.tilmeldingsdato).getTime();
    return datoA - datoB;
  });
}

