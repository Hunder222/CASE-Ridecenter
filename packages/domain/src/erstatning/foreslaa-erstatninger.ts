import type { HestData, Sundhedsstatus, Temperament, Ugedag } from '../typer';

export interface PladsInput {
  rytterNavnKort?: string;
  godkendteHeste: readonly string[];
}

export interface DagsbelastningMap {
  [hestId: string]: number;
}

export interface Top3Forslag {
  hestId: string;
  navn: string;
  dagsbelastning: number;
  temperament: Temperament;
  begrundelseTekst: string;
}

export interface StaldHestKandidat {
  id: string;
  navn: string;
  aktiv: boolean;
  sundhedsstatus: Sundhedsstatus;
  temperament: Temperament;
  hviledag: Ugedag;
  skaane?: boolean;
  maxLektionerDag?: number;
}

export interface ForeslaaErstatningerInput {
  plads: PladsInput;
  heste: readonly StaldHestKandidat[];
  dagsbelastninger: DagsbelastningMap;
  lektionUgedag: Ugedag;
  /** Heste-ID'er der allerede er optaget på den aktuelle lektion af andre ryttere. */
  optagedeHesteIds?: readonly string[];
}

/**
 * Akut top-3 hesteerstatningsalgoritme (US3, FR-011, SC-002).
 * Beregnes offline på tabletten på < 200 ms (krav: < 2 sek.).
 *
 * Udelukker:
 * 1. Heste der ikke er i pladsens godkendteHeste (Welfare Guard/R6 forhåndsgodkendt).
 * 2. Heste med sundhedsstatus != 'Aktiv' (f.eks. Sygemeldt, Skadet).
 * 3. Heste der har nået max_lektioner_dag (3 for normale, 2 for skåne) inkl. den nye lektion.
 * 4. Heste der har hviledag på lektionens ugedag.
 * 5. Heste der allerede er tildelt en rytter på den aktuelle lektion.
 *
 * Sortering:
 * 1. Færrest dagsbelastninger først.
 * 2. Temperament (Rolig først for stabilitet).
 * 3. Hestens navn alfabetisk som tie-breaker.
 */
export function foreslaaErstatninger(input: ForeslaaErstatningerInput): Top3Forslag[] {
  const { plads, heste, dagsbelastninger, lektionUgedag, optagedeHesteIds = [] } = input;
  const godkendteSet = new Set(plads.godkendteHeste);
  const optagedeSet = new Set(optagedeHesteIds);

  const kandidater = heste.filter((hest) => {
    // 0. Må ikke allerede være optaget på denne lektion
    if (optagedeSet.has(hest.id)) return false;

    // 1. Skal være i rytterens godkendte heste
    if (!godkendteSet.has(hest.id)) return false;

    // 2. Skal være sund og aktiv
    if (!hest.aktiv || hest.sundhedsstatus !== 'Aktiv') return false;

    // 3. Må ikke have hviledag på dagen
    if (hest.hviledag === lektionUgedag) return false;

    // 4. Må ikke have nået dagsgrænsen
    const aktuelBelastning = dagsbelastninger[hest.id] ?? 0;
    const maxLektioner = hest.skaane ? 2 : hest.maxLektionerDag ?? 3;
    if (aktuelBelastning >= maxLektioner) return false;

    return true;
  });

  // Temperament prioritet (Rolig = 1, Normal = 2, Frisk = 3)
  const temperamentVaegt = (temp: Temperament): number => {
    switch (temp) {
      case 'Rolig':
        return 1;
      case 'Normal':
        return 2;
      case 'Frisk':
        return 3;
      default:
        return 4;
    }
  };

  kandidater.sort((a, b) => {
    const belastningA = dagsbelastninger[a.id] ?? 0;
    const belastningB = dagsbelastninger[b.id] ?? 0;
    if (belastningA !== belastningB) {
      return belastningA - belastningB;
    }

    const tempA = temperamentVaegt(a.temperament);
    const tempB = temperamentVaegt(b.temperament);
    if (tempA !== tempB) {
      return tempA - tempB;
    }

    return a.navn.localeCompare(b.navn);
  });

  return kandidater.slice(0, 3).map((hest) => {
    const belastning = dagsbelastninger[hest.id] ?? 0;
    const maxLektioner = hest.skaane ? 2 : hest.maxLektionerDag ?? 3;
    const begrundelse = `${hest.temperament.toLowerCase()} hest, godkendt til rytteren. Dagens belastning: ${belastning}/${maxLektioner} lektioner.`;

    return {
      hestId: hest.id,
      navn: hest.navn,
      dagsbelastning: belastning,
      temperament: hest.temperament,
      begrundelseTekst: begrundelse,
    };
  });
}
