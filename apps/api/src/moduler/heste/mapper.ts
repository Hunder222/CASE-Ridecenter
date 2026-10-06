import type { Hest as HestRaekke } from '@prisma/client';
import type { Hest } from '@ridecenter/contracts';
import type { HestData, Ugedag } from '@ridecenter/domain';

export function hestDto(h: HestRaekke): Hest {
  return {
    id: h.id,
    navn: h.navn,
    stangmaal_cm: h.stangmaal_cm,
    max_rytter_vaegt_kg: h.max_rytter_vaegt_kg,
    max_rytter_hoejde_cm: h.max_rytter_hoejde_cm,
    temperament: h.temperament,
    godkendt_til_begyndere: h.godkendt_til_begyndere,
    egnet_oevet: h.egnet_oevet,
    skaane: h.skaane,
    max_lektioner_dag: h.max_lektioner_dag as 2 | 3,
    springforbud: h.springforbud,
    max_spring_uge: h.max_spring_uge as 0 | 1,
    hviledag: h.hviledag,
    sundhedsstatus: h.sundhedsstatus,
    staldnoter: h.staldnoter,
    aktiv: h.aktiv,
  };
}

/** Domænets regeldata (camelCase) til motoren og Welfare Guard. */
export function tilHestData(h: HestRaekke): HestData {
  return {
    id: h.id,
    navn: h.navn,
    stangmaalCm: h.stangmaal_cm,
    maxRytterVaegtKg: h.max_rytter_vaegt_kg,
    maxRytterHoejdeCm: h.max_rytter_hoejde_cm,
    temperament: h.temperament,
    godkendtTilBegyndere: h.godkendt_til_begyndere,
    egnetOevet: h.egnet_oevet,
    skaane: h.skaane,
    maxLektionerDag: h.max_lektioner_dag,
    springforbud: h.springforbud,
    maxSpringUge: h.max_spring_uge,
    hviledag: h.hviledag as Ugedag,
    sundhedsstatus: h.sundhedsstatus,
    aktiv: h.aktiv,
  };
}
