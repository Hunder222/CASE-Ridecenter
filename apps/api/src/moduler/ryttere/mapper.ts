import type { Rytter as RytterRaekke, Sikkerhedsprofil as ProfilRaekke } from '@prisma/client';
import type { Rytter } from '@ridecenter/contracts';
import type { RytterRegelData } from '@ridecenter/domain';
import { isoDato } from '../../faelles';

/** Admin-projektionen (kun Ledelse). Indeholder aldrig felter fra sikkerhedsprofilen. */
export function rytterDto(r: RytterRaekke): Rytter {
  return {
    id: r.id,
    fornavn: r.fornavn,
    efternavn: r.efternavn,
    foedselsdato: isoDato(r.foedselsdato),
    bopaelskommune: r.bopaelskommune,
    hoejde_cm: r.hoejde_cm,
    vaegt_kg: r.vaegt_kg,
    erfaringsniveau: r.erfaringsniveau,
    klar_til_udvikling: r.klar_til_udvikling,
    er_hjaelper: r.er_hjaelper,
    kontaktperson_navn: r.kontaktperson_navn,
    kontakt_telefon: r.kontakt_telefon,
    kontakt_email: r.kontakt_email,
    partaftale_hest_id: r.partaftale_hest_id,
    partaftale_godkendt_trods_niveau: r.partaftale_godkendt_trods_niveau,
    aktiv_status: r.aktiv_status,
    slutdato: r.slutdato ? isoDato(r.slutdato) : null,
  };
}

export function rytterNavn(r: { fornavn: string; efternavn: string }): string {
  return `${r.fornavn} ${r.efternavn}`;
}

/** Regeldata til motoren. HC-07-felterne fra profilen er ikke krypterede, så intet dekrypteres. */
export function tilRytterRegelData(
  r: RytterRaekke,
  profil: Pick<ProfilRaekke, 'forbudte_heste' | 'paakraevede_heste' | 'kun_rolige_heste'> | null,
): RytterRegelData {
  return {
    id: r.id,
    hoejdeCm: r.hoejde_cm,
    vaegtKg: r.vaegt_kg,
    erfaringsniveau: r.erfaringsniveau,
    klarTilUdvikling: r.klar_til_udvikling,
    erHjaelper: r.er_hjaelper,
    partaftaleHestId: r.partaftale_hest_id,
    partaftaleGodkendtTrodsNiveau: r.partaftale_godkendt_trods_niveau,
    forbudteHeste: [...(profil?.forbudte_heste ?? [])].sort(),
    paakraevedeHeste: [...(profil?.paakraevede_heste ?? [])].sort(),
    kunRoligeHeste: profil?.kun_rolige_heste ?? false,
  };
}
