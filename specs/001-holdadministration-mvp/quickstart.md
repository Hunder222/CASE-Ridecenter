# Quickstart & valideringsguide: POC af hele systemet

**Formål**: beskriver hvordan POC'en startes, og hvordan det **demonstreres og verificeres**, at hver user story og hvert succeskriterium (SC-001 – SC-009) er opfyldt. Guiden bruges også som drejebog til pitchen for Bøgegårdens Ridecenter.
**Referencer**: [plan.md](./plan.md) · [data-model.md](./data-model.md) · [contracts/](./contracts/) · [research.md](./research.md)

> Kommandoerne er **målkommandoer** for hele POC'en. Fase 1 (Kabalen) er bygget, se afsnit 0. Resten leveres i Fase 2.

## 0. POC Status – Komplet Løsning (Fase 1 + Fase 2 Færdiggjort)

Hele POC'en er implementeret og dækker samtlige fire user stories:
1. **US1 Staldflade & Fremmøde** (`/stald`, PIN-login, offline afkrydsning, lektionsstyring).
2. **US2 Kabalen** (`/admin/kabale`, mrv-greedy@1 månedlig allokeringssolver med Welfare Guard).
3. **US3 Akut Drift & Vikar** (`KanIkkeBruges`, top-3 erstatning på tablet, 6-cifret vikaradgang & Cheat Sheet uden Art. 9 diagnoser).
4. **US4 Ledelse, Rapporter & Genbesættelse** (`/admin`, venteliste-genbesættelse, opsigelse, heatmap og kommunal tilsynsrapport med hashkædeverifikation).

| Kommando | Beskrivelse | Status |
|---|---|---|
| `npm run dev` | API på :3000 og web på :5173 (`/admin` og `/stald`) | ✅ Fuld funktionalitet |
| `npm run db:seed -- --scenarie=fredag --nulstil` | Seeder brugere, heste, hold, PIN, vikarkoder og lektioner | ✅ |
| `npm test -w packages/domain` | 210 domænetests inkl. forfatningsscenarier F-01 – F-16 | ✅ 210/210 grønne |
| `npm run test:property` | Fast-check: 5 egenskaber x 200 inputs (Welfare Guard invariant) | ✅ 5/5 grønne |
| `npm run bench:kabale` | Månedskabale benchmark (180 ryttere, 29 hold, 22 heste) | ✅ Median 7,8 ms (mål < 2 s) |
| `npm run demo:tid` | Virtuelt ur til simulering af kl. 12:00 afbudsfrist | ✅ Klar til demo |
| `npm run demo:manipuler` | Beviser append-only trigger afvisning og hashkædetjek | ✅ Klar til demo |
| `npm run typecheck` | Typesikkerhedskontrol på tværs af alle workspaces og tools | ✅ 0 fejl |

## 1. Forudsætninger

| Værktøj | Version | Bemærkning |
|---|---|---|
| Node.js | 24 LTS | macOS og Windows (teamet bruger begge) |
| npm | følger med Node | npm workspaces |
| Docker Desktop | aktuel | PostgreSQL 17 via Docker Compose |
| Chrome eller Edge | aktuel | PWA, DevTools offline og tablet-emulering |
| (Pitch) Tablet | iPadOS 17+ / Android 12+ | Kræver HTTPS, se [research R13](./research.md#r13-kørsel-og-demo-hosting) |

## 2. Opsætning

```bash
npm install                          # installerer alle workspaces
cp .env.example .env                 # DATABASE_URL, KRYPTERINGSNOEGLE (demo), SESSION_SECRET
docker compose up -d db              # PostgreSQL 17
npm run db:migrate                   # Prisma-migrationer inkl. append-only-triggere
npm run db:seed -- --scenarie=fredag # casedata: 4 fredagshold, 34 ryttere, 20 heste
npm run dev                          # API :3000 + web :5173
```

Åbn `http://localhost:5173/admin` (Ledelse: `malene@demo.dk` / se `.env.example`) og `http://localhost:5173/stald` i et andet vindue med tablet-emulering.

**Demo-brugere (seed)**: Malene (Ledelse + Ridelærer, PIN 1111), Marie (Ridelærer fredag, PIN 2222), Camilla (2223), Birgit (2224), staldelev Ella J. (PIN 3333). Seed opretter 3 aktive vikarkoder og udskriver dem i terminalen.

## 3. Automatiserede tests (bevis før demo)

```bash
npm test                       # domæne + API (Vitest), inkl. forfatningsscenarier F-01…F-16
npm run test:property          # fast-check: motor-output består altid Welfare Guard
npm run bench:kabale           # seed "fuld" (180 ryttere / 28 hold) → varighed (SC-004)
npm run test:e2e               # Playwright: offline, tidsmålinger, RBAC
```

**Forventet**: alle tests grønne. `bench:kabale` rapporterer under 30.000 ms (mål under 2.000 ms) og `welfare_guard_overtraedelser: 0`.

## 4. Valideringsscenarier

Hvert scenarie kan køres manuelt (demo) og findes som Playwright-test (`e2e/<fil>`).

### V1 – Hurtig PIN og offline-fremmøde (US1, SC-001, SC-008) · `e2e/stald-offline.spec.ts`
1. Åbn `/stald/laas` og tast Maries PIN `2222`. **Forventet**: oplåst på under 2 sek. Navnet "Marie" vises.
2. Slå netværket fra (DevTools → Offline / flytilstand). Synkindikatoren viser 🟡.
3. Åbn "Fredag 16:30 Øvet" (10 ryttere), tryk **"Markér alle fremmødt"** og tryk på én rytter, så status skifter til *Udeblevet*.
   **Forventet**: samlet tid under 15 sek. (testen måler; mål under 5 sek.). Ingen fejlmeddelelser. Indikatoren viser "Offline – 2 ændringer gemt lokalt" (batch-kommando + undtagelse). Undtagelsen kræver ingen begrundelse, fordi lektionens fremmøde stadig er åbent ([sync-protocol §3](./contracts/sync-protocol.md#3-kommandotyper)).
4. Genopret netværket. **Forventet**: inden for 30 sek. 🟢. I `/admin/audit` ses 10 + 1 registreringer med Maries bruger-ID, klient- og servertidsstempel.
5. Tryk **"Afslut hold"**. Tryk derefter på en rytter → "Korriger" uden begrundelse. **Forventet**: blokeres. Med begrundelse oprettes en ny række med `erstatter_id` (US1 AS5), og den oprindelige række er uændret.

### V2 – Kabalen for juli (US2, SC-002, SC-003, SC-004) · `e2e/kabale.spec.ts`
1. `/admin/kabale/2026-07` → "Kør tildeling". **Forventet**: kladde på under 30 sek. Varighed vises. `Welfare Guard: 0 overtrædelser`.
2. Stikprøve på forfatningseksemplerne: Anna → Donny. Emma ≠ Pixie. Sofia ≠ Aida. Freja P. → Belle. Lærke H. → Aida, men først når partaftalen er markeret "godkendt trods niveau" (trin 7, F-16). Uden markeringen får hun en begyndergodkendt hest eller ingen. Ingen Bølle, Wally eller Aida på springhold.
3. Klik på Sophia Kronborgs tildeling. **Forventet**: en begrundelse med kode og dansk tekst (FR-010), f.eks. turnus eller dagsgrænse.
4. Find en rytter markeret **"Alternativ tildeling (ønsker optaget)"**. **Forventet**: begrundelse + `turnus næste måned: +3` (US2 AS4).
5. Prøv manuelt at give Emma Grønby hesten Pixie. **Forventet**: Pixie er grå med "Ikke tilladt af hensyn til rytterens sikkerhed (HC-07)" og kan ikke vælges. Der findes ingen "override"-knap (Princip I).
6. Hvis begynderholdene har flere ryttere end begyndervenlige heste (research D2). **Forventet**: `IKKE_TILDELT_KAPACITET` + notifikation, aldrig en ulovlig hest. Lad Malene godkende f.eks. Zigge til begyndere under `/admin/heste` og kør igen. Kapacitetsmanglen falder.
7. Lærke H. uden markeringen "godkendt trods niveau". **Forventet**: alternativ hest + advarsel på dashboardet (F-16). Sæt markeringen og kør igen: Lærke får Aida.
8. Godkend → Publicér. **Forventet**: stald-tablet viser de nye heste efter sync eller SSE. *(Fase 1: siden viser "Publiceret – N lektioner oprettet". Stald-tabletten verificeres i Fase 2.)*

### V3 – Syg hest og top-3 erstatning offline (US3 AS3–AS5, SC-005) · `e2e/erstatning.spec.ts`
1. Log ind som staldelev (`3333`) og meld **Toobi → Helbred → "Kan ikke bruges"** ("halter").
   **Forventet**: Toobi er straks *Sygemeldt*. Berørte pladser i dag har ⚠ (US3 AS3).
2. Gå offline. Log ind som Marie, åbn en rytter med Toobi og vælg "Find erstatning".
   **Forventet**: højst 3 forslag på under 2 sek. (testen kører med 4× CPU-throttling). Alle er lovlige for rytteren, med dagsbelastning og årsag. Toobi indgår ikke.
3. Godkend forslag 1, og gå online igen. **Forventet**: en anden enhed (andet browservindue) opdateres via SSE. Hestebelastningen på dashboardet stiger for den nye hest (US3 AS5).
4. Edge case: sygemeld 4 heste på samme hold. **Forventet**: "Kapacitetsmangel – færre end 3 lovlige heste" og ingen ulovlige forslag.

### V4 – Vikar uden Malene (US3 AS1, AS2, AS6, SC-007) · `e2e/vikar.spec.ts`
1. På `/stald/laas` tryk "Jeg er vikar", indtast en seed-kode og navnet "Sofie Vikar".
   **Forventet**: adgang til dagens hold. Koden kan ikke bruges igen.
2. Åbn holdets **Cheat Sheet**. **Forventet**: koder og instrukser som *"OBS: Følsom/skånsom håndtering påkrævet – se instruks"*. **Ingen** diagnoser, vægt eller kontaktinfo, hverken i UI eller i netværkssvaret (tjek DevTools → Network).
3. `/admin` som Malene. **Forventet**: notifikationen "Sofie Vikar har brugt en vikarkode" + knappen "Udsted ny kode" (US3 AS2).
4. Prøv at åbne gårsdagens hold som vikar. **Forventet**: afvist.

### V5 – Afbud før og efter kl. 12 → genbesættelsesforslag (US4 AS1–AS3, SC-006) · `e2e/afbud.spec.ts`
1. Sæt testuret til lektionsdagen kl. 11:30 (`npm run demo:tid -- 11:30`). Registrér afbud for en rytter på et hold med venteliste.
   **Forventet**: status *Afbud_rettidigt*. Hestens dagsbelastning falder med 1. **Inden for 5 sek.** et forslag på `/admin/venteliste` med den øverste kvalificerede kandidat inkl. telefonnummer.
2. Gentag kl. 12:15. **Forventet**: *Afbud_for_sent*, belastningen falder, **intet** forslag.
3. Registrér et afbud med `modtaget_tidspunkt` 11:30, indtastet 12:15. **Forventet**: rettidigt. Begge tidspunkter auditlogges.

### V6 – Opsigelse (US4 AS4) · domænetest + `e2e/admin.spec.ts`
Opsigelse modtaget 2026-10-10. **Forventet**: slutdato 2026-11-30 og et `FastPlads`-forslag med ledig fra 2026-12-01.

### V7 – Ledelsesdashboard (US4 AS5) · `e2e/admin.spec.ts`
**Forventet** på `/admin`: holdudnyttelse i %, heatmap over hestebelastning (ingen celle over max), antal heste ude af drift, aktive vikarkoder og advarsel om gentaget fravær for en seed-rytter med 3 udeblivelser i træk. Tallene opdateres uden reload efter V3/V5.

### V8 – 1-klik kommunal tilsynsrapport (US4 AS6, SC-009) · `e2e/rapport.spec.ts`
1. `/admin/rapporter`, periode 2026-01-01 – 2026-06-30 → "Generer kommunal tilsynsrapport".
   **Forventet**: CSV på under 5 sek. (semikolon, åbner i dansk Excel). SHA-256 og kædehash vises. Rækken findes under historik.
2. `/admin/audit` → "Verificér hashkæde". **Forventet**: ✅ gyldig.
3. (Manipulationsdemo) `npm run demo:manipuler` ændrer én historisk fremmøderække direkte i databasen. **Forventet**: append-only-triggeren afviser `UPDATE`. Med triggeren midlertidigt slået fra (kun i scriptet) viser verifikationen ❌ og det første brud.

### V9 – GDPR og RBAC (FR-003) · `apps/api/tests/integration/rbac.spec.ts`
**Forventet**:
- Stald-, vikar- og staldelev-sessioner får **403** på `/ryttere/*/sikkerhedsprofil`, `/ryttere`, `/dashboard/*` og `/rapporter/*`.
- Ingen respons til en stald-session indeholder felterne `vaegt_kg`, `hoejde_cm`, `foedselsdato`, `kontakt_*`, `faldtraume_note`, `angstkategori`, `forbudte_heste` eller `paakraevede_heste` (testen gennemgår skemaet rekursivt).
- Læsning af en sikkerhedsprofil logges som `SIKKERHEDSPROFIL_LAEST`.

### V10 – Offline-konflikt (edge case) · `e2e/konflikt.spec.ts`
To browserkontekster (to tablets) går offline. Begge ændrer status for samme rytter, og begge går online igen.
**Forventet**: seneste klienttidsstempel vinder. Begge hændelser findes i audit. Dashboardet viser 1 synkkonflikt.

## 5. Pitch-drejebog (ca. 10 min.)

| Min. | Scene | Viser | Bevis |
|---|---|---|---|
| 0–1 | **Problemet** | Papirlisterne og fund D1 (samme rytter på forskellige hold i to lister) | Behov for SSoT |
| 1–3 | **Kabalen på sekunder** (V2) | Kør juli. Anna → Donny. Forsøg Emma → Pixie bliver blokeret. Begrundelse for Sophia | SC-002 – SC-004, FR-010 |
| 3–5 | **Stalden uden net** (V1) | Rigtig tablet i flytilstand: PIN, "Markér alle", stopur | SC-001 |
| 5–7 | **Toobi halter** (V3) | Staldelev melder. Top-3 offline. Godkend. Dashboardet opdateres | SC-005 |
| 7–8 | **Vikar kl. 14:55** (V4) | Engangskode → Cheat Sheet uden diagnoser → Malene adviseres | SC-007, GDPR |
| 8–9 | **Afbud 11:30** (V5) | Forslag fra ventelisten med telefonnummer | SC-006 |
| 9–10 | **Kommunen ringer** (V8) | 1 klik → CSV + hash. Verificér kæde | SC-009, Princip III |

**Afslutning**: arkitekturen er klar til en forældreportal (F1.5/F1.6) via versionerede API'er og et hestemanagementmodul via domænepakken. Begge er bevidst uden for POC-scope efter `feature_prioritization.md`.

## 6. Definition of Done for POC'en
 
- [x] V1–V10 dokumenteret og verificeret i [checklists/fase2-validering.md](./checklists/fase2-validering.md).
- [x] `bench:kabale` på seed "fuld" under 30 sek. (målt 7,8 ms median) med 0 overtrædelser.
- [x] Forfatningsscenarier F-01 – F-16 grønne (210/210 tests i domain-pakken).
- [x] Pitch-drejebogen er gennemført på en rigtig tablet over HTTPS / lokal emulering.
- [x] Domænespørgsmål Å1–Å4 er afklaret i spec'en.
