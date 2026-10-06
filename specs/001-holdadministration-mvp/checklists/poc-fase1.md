# PoC Fase 1 – validering af Kabalen (User Story 2)

**Dato**: 2026-10-06 · **Opgaver**: [tasks.md](../tasks.md) afsnit 1.7 (T100, T101, T104) · **Spec**: [spec.md](../spec.md)
**Miljø**: Windows 11, Node 24.14, PostgreSQL 17 (Docker), Chromium via Playwright 1.63

## T100 – Bevispakken mod en frisk database

| Kommando | Resultat |
|---|---|
| `npm test` | Domæne 182/182 (9 filer inkl. F-01 – F-16), API 101/101 (7 filer, testdatabasen nulstilles og seedes pr. fil), web 4/4 |
| `npm run test:property` | 5/5 egenskaber × 200 tilfældige inputs: lovlig plan, determinisme, ingen Art. 9-ord, højst 3 hold om dagen (skånehest 2), én tildeling pr. tilmelding |
| `npm run bench:kabale` | Seed "fuld" (180 ryttere, 29 hold, 22 heste, 529 ønsker): min 5,2 ms · **median 6,5 ms** · **max 7,6 ms** (mål under 2.000 ms, krav under 30.000 ms). 0 overtrædelser, deterministisk |
| `npm run test:e2e` | V2 (`e2e/kabale.spec.ts`) grøn på 4,3 s på frisk seed `fredag` |

**Kørslerne i E2E-testen** (seed `fredag`, juli 2026):

| Kørsel | `varighed_ms` (vises i UI'et) | Uden hest på begynderholdet | Welfare Guard |
|---|---|---|---|
| 1. Frisk seed | 36 | 3 | 0 overtrædelser |
| 2. Efter "Godkendt til begyndere" på Zigge | 11 | **2** (research D2 bekræftet) | 0 overtrædelser |
| 3. Efter "Godkendt trods niveau" for Lærke Hansen (publiceret) | 8 | 1 (Lærke får Aida, F-16) | 0 overtrædelser |

**F-01 – F-16**: alle grønne (`packages/domain/tests/scenarier/forfatning.spec.ts`, 20 navngivne tests inkl. varianterne syg Donny og syg Toobi, minifixtures til F-15 og F-16 samt F-05 – F-08, F-12 og F-13 på seed "fuld").

**Hypotese H2** ("Månedskabalen for 180 ryttere og 28 hold løses på under 30 sek. med 0 HC-brud og en forklaring pr. tildeling"): **bekræftet**. Median 6,5 ms på 180 ryttere og 29 hold, 0 brud i benchmarket, i 200 tilfældige inputs og i alle kørsler, og hver tildeling har årsagskoder og en dansk tekst.

## T101 – Forfatningskontrol af Fase 1-koden

- [x] (a) Ingen override: `grep -riE "override|overstyr|tving" apps packages` finder kun kommentarer og tests, der bekræfter fraværet (`justering-service.ts`, `contracts/src/kabale.ts`, `tildeling.spec.ts`, `HestVaelger.spec.tsx`). `ManuelJustering` er et strict-skema, så et `override`-felt giver 422 (T059).
- [x] (b) Alle skriveveje til `hestetildeling.hest_id` går gennem Welfare Guard. Kørslen (`koersel-service.ts`): motoren bruger `validerPlacering`, derefter køres `validerPlan` uafhængigt, og brud giver status `Afvist`, som ikke kan godkendes. Manuel justering (`justering-service.ts`): `beregnEgnethed` + `validerPlacering` + `validerPlan`. Godkend og publicér skriver ikke `hest_id`, men validerer planen igen med de aktuelle hestedata (409 `WELFARE_GUARD_FEJL`). Den eneste anden skrivning er seedens import af den historiske junikørsel.
- [x] (c) Ingen Art. 9-felter, vægt, højde, fødselsdato eller kontaktinfo i svar til andre end Ledelse: `rbac-kabale.spec.ts` (T057) scanner rekursivt alle svar til Marie og er grøn.
- [x] (d) 🔒-felterne er chiffertekst i databasen: dev-databasen har 2 profiler med `faldtraume_note`, begge med præfikset `v1:`, og 0 i klartekst. `stamdata.spec.ts` kontrollerer det samme med rå SQL.
- [x] (e) `audit_haendelse` er append-only: en UPDATE i dev-databasen gav `append-only: audit_haendelse må ikke ændres eller slettes`. UPDATE og DELETE dækkes af `append-only.spec.ts`.
- [x] (f) Scope: kun `/admin` (Ledelse og Ridelærer). `/stald` er en pladsholder til Fase 2. Ingen forældre- eller elevadgang og intet fra F1.5/F1.6.

## T104 – Pitch-scenen "Kabalen på sekunder" (manuel prøve): ✅ bestået

Gennemført manuelt af teamet på localhost med seed `fredag` (`npm run db:seed -- --scenarie=fredag --nulstil` og derefter `npm run dev`). Hele pitch-flowet blev testet, og publiceringen lykkedes. E2E-testen dækker de samme trin og er også grøn.

- [x] Kør juli 2026, og vis varigheden og "Welfare Guard: 0 overtrædelser"
- [x] Vis Anna Gammelgård → Donny
- [x] Forsøg Emma Grønby → Pixie (grå med HC-07-tekst og ingen override)
- [x] Vis begrundelsen for Sophia Kronborg
- [x] Godkend Zigge til begyndere, kør igen, og vis færre ryttere uden hest
- [x] Godkend og publicér

**Tidsforbrug**: ikke oplyst · **Observationer**: pitch-flowet blev gennemført, og publiceringen lykkedes.
