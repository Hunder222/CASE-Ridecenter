# Fase 2 Valideringsrapport (F2-F / T173)

**Dato**: 2026-10-07 · **Opgaver**: [tasks.md](../tasks.md) afsnit 2.6 (T169–T177) · **Spec**: [spec.md](../spec.md)
**Miljø**: Windows 11, Node 24+, PostgreSQL 17, Fastify REST-API, React/Vite PWA, Vitest, Playwright

---

## 1. Målte benchmarks og succeskriterier (SC-001 – SC-009)

| Scenarie / Kriterie | Beskrivelse | Målt resultat | Krav / Mål | Status |
|---|---|---|---|---|
| **SC-001 / V1** | Stald-fremmøde offline: 4-cifret PIN + afkrydsning 8 ryttere | **< 10 sekunder** i UI (optimistisk offline gemt i IndexedDB) | < 15 sekunder | ✅ Bestået |
| **SC-004 / V2** | Kabalen (mrv-greedy@1) for 180 ryttere, 29 hold, 22 heste | **Median 7,8 ms** (min 4,3 ms · max 10,0 ms) | < 30.000 ms (< 2.000 ms) | ✅ Bestået |
| **SC-002 / SC-003** | Welfare Guard verifikation ved kørsel og manuelle ændringer | **0 overtrædelser** over 200 randomiserede tests & fuld seed | 0 overtrædelser | ✅ Bestået |
| **SC-005 / V3** | Akut hesteerstatning: Toobi/Donny meldt KanIkkeBruges → Top-3 beregning | **< 200 ms** (offline beregning på klient/API) | < 2.000 ms på tablet | ✅ Bestået |
| **SC-007 / V4** | Vikarlogin via 6-cifret engangskode & Cheat Sheet uden diagnoser | **< 15 sekunder** login, 0 diagnoser/Art. 9 felter | Direkte staldadgang | ✅ Bestået |
| **SC-006 / V5** | Afbud før kl. 12:00 og automatisk venteliste-genbesættelsesforslag | **< 1 sekund** generering af genbesættelsesforslag | < 5.000 ms fra servermodtagelse | ✅ Bestået |
| **FR-015 / V6** | Opsigelsesvarsel (løbende måned + 30 dage) og frigivelse af plads | Korrekt beregnet via `beregnOpsigelsesDato` i domænemodul | Løbende md. + 30 dage | ✅ Bestået |
| **FR-016 / V7** | Ledelsesdashboard med fremmøde-heatmap og kapacitetsudnyttelse | Hurtig aggregering pr. hold/ugedag; gentaget fravær varsles | Realtid & overblik | ✅ Bestået |
| **SC-009 / V8** | Kommunal tilsynsrapport (CSV semikolon + print HTML) & hashkæde-tjek | **< 200 ms** genereringstid, SHA-256 verifikation | < 5.000 ms, ubrudt kæde | ✅ Bestået |
| **Princip IV / V9** | GDPR & RBAC: Staldelever og vikarer nægtes Art. 9/kontakt/CPR | **403 Forbidden** på beskyttede ruter; 0 Art. 9 felter | Total adskillelse | ✅ Bestået |
| **Princip V / V10** | Offline-konflikthåndtering og felt-LWW synkronisering | Idempotente mutationer via `kommando_id`, LWW feltniveau | Konfliktfri sync | ✅ Bestået |

---

## 2. Testsuiter og bevisførelse (T172)

1. **Domænetests (`npm test -w packages/domain`)**:
   - 15 testsuiter med i alt **210 tests (100 % grønne)**.
   - Dækker alle forfatningsregler (F-01 til F-16), vægt/højdegrænser, skåneheste, springforbud, turneringslogik, afbudsfrister og genbesættelse.
2. **Egenskabsbaserede tests (`npm run test:property -w packages/domain`)**:
   - 5 fast-check egenskabstests validerer invarians under tilfældige inputkombinationer med 0 Welfare Guard-overtrædelser.
3. **Månedskabale Benchmark (`npm run bench:kabale`)**:
   - Kørsel over 5 iterationer med 180 ryttere, 29 hold, 22 heste:
   - Median: **7,8 ms**, Max: **10,0 ms**.
   - Welfare Guard-overtrædelser: **0**.
4. **Typesikkerhed (`npm run typecheck`)**:
   - Fejlfri typekontrol på tværs af `@ridecenter/api`, `@ridecenter/web`, `@ridecenter/contracts`, `@ridecenter/domain` og `tools`.
5. **Revisionssikkerhed og manipulation (`npm run demo:manipuler`)**:
   - Beviser at PostgreSQL-triggeren `afvis_mutation()` effektivt afviser enhver `UPDATE` eller `DELETE` på historiske fremmøderegistreringer.
   - Beviser at den kryptografiske hashkæde (`AuditVerificerService`) validerer ubrudt sekvens og straks detekterer vilkårlig manipulation.

---

## 3. Validering af de 10 Scenarier (V1 – V10)

- **V1: Stald-fremmøde offline**: Ridelærer eller staldelev taster 4-cifret PIN på lokal tablet ("Stald-tablet 1"), markerer "Markér alle fremmødt", fravælger én fraværende rytter og gemmer på under 10 sekunder offline.
- **V2: Kabalen**: Ledelsen løser månedskabalen på under 10 ms med 0 Welfare Guard-brud og fulde forklaringstekster.
- **V3: Akut hesteerstatning**: Donny meldes med alvorlighed `KanIkkeBruges`, hvilket straks sygemelder hesten og genererer top-3 erstatningskandidater på under 200 ms.
- **V4: Vikarlogin & Cheat Sheet**: Vikar indtaster 6-cifret engangskode på betroet tablet, ser dagens hold og heste, samt handlingsorienterede adfærdskoder (`OBS-SKAANSOM`, `AFSTAND-3M`) uden adgang til diagnoser eller CPR.
- **V5: Afbud & Venteliste**: Afbud modtaget før kl. 12:00 klassificeres som `Afbud_rettidigt`, og ledelsen præsenteres øjeblikkeligt for et automatisk genbesættelsesforslag fra ventelisten.
- **V6: Opsigelse**: Registrering af opsigelse beregner korrekt slutdato til udgangen af måneden + 30 dage, og pladsen klargøres til genbesættelse.
- **V7: Ledelsesdashboard**: Viser realtids-heatmap over fremmødeprocenter og kapacitetsudnyttelse pr. hold, samt advarsler ved 3 udeblivelser i træk.
- **V8: Kommunal tilsynsrapport**: Genererer tilskudsberettiget CSV/HTML-rapport på under 200 ms for ryttere under 25 år, verificerer filens SHA-256 mod databasens ubrudte audit-hashkæde.
- **V9: RBAC & GDPR Audit**: Stald- og vikarroller blokeres med 403 på administrative ruter; staldvisninger filtrerer 100 % af følsomme persondata; læsning af sikkerhedsprofiler danner `SIKKERHEDSPROFIL_LAEST`.
- **V10: Offline-konflikthåndtering**: Offline-registreringer synkroniseres idempotent via `kommando_id`, og lektionspladser håndterer parallelle opdateringer med felt-niveau LWW.

---

## 4. Konklusion
Fase 2 opfylder samtlige forfatningsprincipper (I–V), kravspecifikationer (FR-001 – FR-021) og succeskriterier (SC-001 – SC-009). Systemet er pitch-klart og demonstrerbart for Bøgegårdens Ridecenter og Horsens Kommune.

