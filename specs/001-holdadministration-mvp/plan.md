# Implementation Plan: Digital Holdadministration & Ressourcestyring: Proof of Concept af hele systemet

**Branch**: `001-holdadministration-mvp` | **Date**: 2026-10-06 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/001-holdadministration-mvp/spec.md` + planlægningsinput: *"formålet med at lave en proof of concept af hele systemet"*

**Note**: This template is filled in by the `/speckit-plan` command; its definition describes the execution workflow.

## Summary

Bøgegårdens Ridecenter styrer i dag 180 elever, ca. 22 heste og 28 ugentlige hold med papir, whiteboard og hukommelse. Spec'en beskriver en MVP med fire user stories: offline-fremmøde i stalden (US1), algoritmisk månedskabale (US2), akut hesteomplacering og vikaroverlevering (US3) samt fravær, venteliste og ledelsesoverblik (US4).

Denne plan leverer **en kørende, klikbar proof of concept (POC) af hele systemet**. Det betyder alle fire user stories ende-til-ende, bygget på den målarkitektur, forfatningen foreskriver, og seedet med casens egne fiktive data. Teknisk tilgang: én **TypeScript-monorepo** med en **delt, I/O-fri domænepakke** (Welfare Guard HC-01–HC-08, tildelingsmotor, top-3-erstatning, frist- og varselsregler), et **Fastify REST-API på PostgreSQL** med append-only revisionsspor og hashkæde, og en **PWA** med to rutetræer: en offline-first stald-flade (IndexedDB-outbox + push/pull-sync) og et online web-admin-dashboard. Fordi domænepakken kører både på serveren og på tabletten, er velfærdsreglerne implementeret ét sted, og akut hestebytning virker uden net.

### Formålet med POC'en

| # | Formål | Hvordan planen indfrier det |
|---|---|---|
| 1 | **Bevise arkitekturens bærende påstande** (hypoteserne nedenfor) | Automatiserede tests og målinger pr. succeskriterium ([quickstart.md §3–4](./quickstart.md)) |
| 2 | **Pitche løsningen** for Bøgegården og Dansk Rideforbund (casekrav: "klikbare proof of concepts, der kan pitches") | 10-minutters drejebog på rigtig tablet med casens heste og ryttere ([quickstart.md §5](./quickstart.md#5-pitch-drejebog-ca-10-min)) |
| 3 | **Afdække domænerisici tidligt** | Datafund D1–D5 og domænespørgsmål Å1–Å4 (alle afklaret i spec'en 2026-10-06) ([research.md](./research.md#datafund-fra-casematerialet-vigtige-for-planen-og-pitchen)) |
| 4 | **Vise udvidelsesmuligheder** (casekrav: forældreapp, hestemanagement) | Versioneret API + domænepakke som udvidelsespunkter. Ingen implementering af F1.5/F1.6 (forfatningen) |

### Hypoteser POC'en skal be- eller afkræfte

| ID | Hypotese | Bevis | SC |
|---|---|---|---|
| H1 | Et hold på 10 kan afkrydses på under 15 sek. med handsker, også offline, uden datatab | Playwright-tidsmåling offline (V1) | SC-001, SC-008 |
| H2 | Månedskabalen for 180 ryttere og 28 hold løses på under 30 sek. med 0 HC-brud og en forklaring pr. tildeling | Benchmark + fast-check-invariant + F-01–F-16 (V2) | SC-002 – SC-004 |
| H3 | Top-3 erstatning kan beregnes **på tabletten offline** på under 2 sek. **uden Art. 9-data på enheden** | E2E med 4× CPU-throttling + RBAC-feltscan (V3, V9) | SC-005 |
| H4 | En vikar kan overtage uden Malene og uden mundtlig overlevering | E2E vikarflow + notifikation (V4) | SC-007 |
| H5 | Afbud før kl. 12 giver et kvalificeret ventelisteforslag inden for 5 sek. | E2E med styret testur (V5) | SC-006 |
| H6 | Fremmøde er revisionssikkert, og kommunerapporten kan laves med 1 klik på under 5 sek. og verificeres | Append-only-trigger + hashkæde + rapporttid (V8) | SC-009 |

### Ægte vs. forenklet i POC'en

| Område | Ægte (implementeres fuldt) | Forenklet (bevidst, dokumenteret) |
|---|---|---|
| Velfærds- og sikkerhedsregler | HC-01 – HC-08 i domænepakken, uafhængig Welfare Guard, ingen override | HC-06-grænseværdier er demoværdier afledt af stangmål (skal valideres af Malene) |
| Tildelingsmotor | Deterministisk MRV + reparation, SC-01 – SC-05, forklaringer | Heuristik frem for optimal ILP (udskiftelig bag `AllocationSolver`) |
| Offline | PWA, IndexedDB-outbox, idempotent sync, felt-LWW, konfliktlog | Ingen baggrundssync, mens appen er lukket (sync ved åbning/fokus) |
| Sikkerhed og GDPR | RBAC pr. endpoint og felt, AES-256-GCM på Art. 9-felter, dataminimering på enheden, Art. 9-adgangslog | Krypteringsnøgle fra miljøvariabel (ingen KMS). Ingen ekstern IdP. Kun fiktive data. Ingen DPIA (forudsætning før pilot) |
| Revision | Append-only i databasen, hashkæde, verifikation | Ingen kvalificeret digital signatur på rapporter |
| Integrationer | Kommunerapport som CSV + print-HTML | Ingen API-integration til Strandby Kommune, ingen SMS, ingen betaling |
| Drift | Docker Compose lokalt, EU-PaaS til pitch | Ingen HA, backup eller overvågning |

## Technical Context

**Language/Version**: TypeScript 5.x på Node.js 24 LTS (API og tooling) og i browseren (PWA). Samme domænekode kører begge steder ([R2](./research.md#r2-sprog-og-runtime-typescript-end-to-end-nodejs-24-lts))

**Primary Dependencies**:
- *API*: Fastify 5, Zod (validering + OpenAPI), Prisma ORM, argon2, date-fns + `@date-fns/tz`
- *Web*: React 19, Vite, React Router, TanStack Query, `vite-plugin-pwa` (Workbox), Dexie 4 (IndexedDB), Tailwind CSS
- *Domæne*: ingen runtime-afhængigheder ud over date-fns (bevidst)

**Storage**: PostgreSQL 17 (Docker Compose). Append-only-triggere på revisionstabeller, hashkæde, AES-256-GCM på applikationsniveau for Art. 9-felter ([R3](./research.md#r3-persistens-postgresql-17--prisma-orm-append-only-håndhæves-i-databasen), [R8](./research.md#r8-gdpr-art-9-adskilt-sikkerhedsprofil-kryptering-på-applikationsniveau-og-cheat-sheet-kodekatalog), [R11](./research.md#r11-kommunal-tilsynsrapport-og-verificerbarhed)). På enheden: IndexedDB med kun dagens stald-projektion ([data-model §9](./data-model.md#9-lokal-enhedsmodel-indexeddb-på-stald-tablet))

**Testing**: Vitest (domæne, API-integration mod PostgreSQL), fast-check (egenskabstest af HC-invarianter), kontrakttest mod [openapi.yaml](./contracts/openapi.yaml), Playwright (E2E inkl. offline, tidsmåling, CPU-throttling) og benchmark-script for kabalen ([R12](./research.md#r12-teststrategi-tests-der-beviser-succeskriterierne))

**Target Platform**: Stald: PWA i Safari (iPadOS 17+) og Chrome (Android 12+) på 10" tablet i landskab samt smartphone. Admin: desktop-browser (Chrome/Edge/Safari/Firefox). Server: Linux-container. Udvikling på macOS og Windows

**Project Type**: Webapplikation: PWA-frontend (to rutetræer) + REST-API + delt domænebibliotek i en npm-workspaces-monorepo

**Performance Goals**: PIN-oplåsning under 2 sek. (mål under 500 ms, offline). Holdafkrydsning (10) under 15 sek. (mål under 5 sek.), lokal skrivning under 100 ms pr. tryk. Kabale (180/28) under 30 sek. (mål under 2 sek.). Top-3 erstatning under 2 sek. på tablet (mål under 200 ms). Ventelisteforslag under 5 sek. efter serverens modtagelse. Kommunerapport under 5 sek. for 12 måneders data. SSE-opdatering under 2 sek.

**Constraints**: Offline-first i stalden (ingen netafhængighed i kritisk sti). Ingen Art. 9-data, vægt, højde eller kontaktinfo på enheder. Append-only revision. Ingen omgåelse af HC-regler. Touch-mål på mindst 56 px og kontrast mindst 7:1. Dansk UI. Forretningsregler i Europe/Copenhagen. Kun fiktive data. EU-hosting til demo. HTTPS påkrævet for PWA på tablet

**Scale/Scope**: 180 ryttere, ca. 22 heste, 28–29 ugentlige hold (ca. 120 lektioner om måneden, ca. 1.500–2.000 fremmøderækker om måneden), 5–10 personalebrugere, 1–3 stald-enheder, 1 ledelsesbruger. Ca. 9 stald-skærme og ca. 13 admin-skærme ([ui-routes.md](./contracts/ui-routes.md)). Seed `fredag` (34 ryttere / 4 hold / 20 heste) til pitch og `fuld` (180 / 28 / 22) til benchmark

Alle tidligere ubekendte er afklaret i [research.md](./research.md) (R1–R15). Der er ingen udestående **NEEDS CLARIFICATION**. Domænespørgsmålene Å1–Å4 er afklaret via `/speckit-clarify` 2026-10-06 og skrevet ind i spec'en.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

Evalueret mod [constitution.md v1.2.0](../../.specify/memory/constitution.md).

| Forfatningskrav | Hvordan planen opfylder det | Status |
|---|---|---|
| **I. Hestevelfærd først**: HC-01 – HC-05, syge heste udelukket, intet må overskride kapacitet | Welfare Guard i domænepakken validerer hver placering (motor, manuel justering, offline-erstatning, server-revalidering af sync). Uafhængig efterkontrol af hele planen. **Ingen override-funktion**. Fail-safe: alle kan sætte en hest ude af drift | ✅ PASS (se fund G1) |
| **II. Ryttersikkerhed og fysiologisk match**: HC-06 – HC-08 + navngivne spærringer | Spærringer er data (`sikkerhedsprofil`, hesteattributter). Hvert forfatningseksempel er en navngiven test F-01 – F-16 ([domain-engine.md §5](./contracts/domain-engine.md#5-forfatningens-eksempler-som-navngivne-acceptance-tests)) | ✅ PASS (se fund G2, G3) |
| **III. Revisionssikkerhed og kommunal compliance** | Append-only-triggere, hashkæde, påkrævet begrundelse ved korrektion, 1-klik CSV med SHA-256, verifikationsendpoint | ✅ PASS |
| **IV. GDPR Art. 9 og tavs viden**: Privacy by Design, kryptering i hvile og transit, RBAC, adskillelse i datamodellen | `sikkerhedsprofil` adskilt fra `rytter`. AES-256-GCM. TLS i demo-hosting. RBAC pr. endpoint og felt. Stald-DTO'er uden følsomme felter. Kun afledte `godkendte_heste` på enheden. Cheat Sheet fra kodekatalog. Ingen CPR. Art. 9-adgangslog | ✅ PASS (forenkling noteret i Complexity Tracking) |
| **V. SSoT og staldrobusthed**: under 15 sek., offline-first, konfliktfri sync | PostgreSQL som SSoT. PWA + outbox + idempotent sync + felt-LWW + konfliktlog. Batch-afkrydsning med 1 tryk + undtagelser. Synlig synkstatus | ✅ PASS |
| **Scope-autoritet**: `feature_prioritization.md` + `capabilities.md`. F1.1–F1.4, F2.1–F2.3, F3.1 i scope. F1.5/F1.6 udskudt | Alle ti in-scope-features er dækket (F1.1 ønsker i stalden, F1.2 sikkerhedsprofil, F1.3 hestedatabase, F1.4 motor, F2.1 statusmeldinger, F2.2 top-3, F2.3 vikar, F3.1 fremmøde). Ingen forældre- eller elevadgang. F1.7/F1.8 ikke medtaget | ✅ PASS |
| **Domænebetingelser**: to-trins CSP, HC har absolut forrang for SC | Motorens trin 2–4 filtrerer HC før SC-scoring. Welfare Guard er eneste gyldighedskriterium | ✅ PASS |
| **Arkitektoniske guardrails**: stald-UI, web-admin, modulært forældremodul, REST/GraphQL + RBAC, offline-sync, Allocation Engine, Welfare Guard, Compliance Engine, PostgreSQL med kryptering | Hvert lag findes som modul ([Project Structure](#project-structure)). REST valgt. Forældremodul forberedt via versioneret API, ikke implementeret | ✅ PASS |
| **Akutberedskab**: 3-trins replacement under 2 sek., Cheat Sheet, Explainable Allocation | `foreslaaErstatninger` (offline), `/stald/lektion/:id/cheat-sheet`, årsagskoder + dansk tekst pr. tildeling | ✅ PASS |
| **Governance**: plan og tasks verificeres mod principper, HC og scope | Gate udført her og igen efter design. Quickstart-DoD kræver F-01 – F-16 grønne | ✅ PASS |

### Fund ved gate-evalueringen

- **G1 – Spec og forfatning er uenige om override af dagsgrænsen** *(✅ afklaret 2026-10-06: ingen override; spec'en er rettet)*: spec'ens edge case *"ridelæreren kan ikke overstyre reglen uden eksplicit ledelsesgodkendelse logget i audit-sporet"* åbner for en ledelsesoverstyring af HC-01. Forfatningens Princip I ("MUST forhindre enhver handling … der overskrider en hests kapacitet") har forrang efter governance-afsnittet. **Planen bygger derfor ingen override**. Spec'ens edge case og FR-007 er nu rettet. (= research Å1)
- **G2 – To dele af HC-08 kolliderer (parthest vs. begynderniveau)** *(✅ afklaret 2026-10-06)*: Lærke H.'s part på Aida på begynderholdet. Beslutning: parthesten bruges kun, hvis Ledelse har markeret partaftalen "godkendt trods niveau". Ellers gælder niveaukravet, og dashboardet advarer. HC-01 – HC-07 gælder altid (test F-16). (= research D4/Å3)
- **G3 – Forfatningens begynderhestliste kan give uopfyldelige hold** *(✅ afklaret 2026-10-06: egenskab på hesten)*: med 4 begyndervenlige heste og 7–9 begyndere pr. hold melder motoren korrekt kapacitetsmangel i stedet for at bryde reglen. `godkendt_til_begyndere` er en egenskab på hesten, som kun Ledelse kan ændre, med forfatningens 4 heste som startværdier. Ingen forfatningsændring er nødvendig. (= research D2/Å2)

**Gate-resultat (før Phase 0)**: ✅ **PASS**. Ingen uberettigede overtrædelser. G1 er løst ved at følge forfatningen. G1 – G3 er afklaret og skrevet ind i spec'en (2026-10-06).

## Project Structure

### Documentation (this feature)

```text
specs/001-holdadministration-mvp/
├── spec.md                  # Kravspecifikation (input)
├── plan.md                  # Denne fil (/speckit-plan)
├── research.md              # Phase 0: R1–R15, datafund D1–D5, åbne punkter Å1–Å4
├── data-model.md            # Phase 1: entiteter, tilstande, validering, lokal enhedsmodel
├── quickstart.md            # Phase 1: opsætning, valideringsscenarier V1–V10, pitch-drejebog
├── contracts/
│   ├── openapi.yaml         # REST-API (OpenAPI 3.1)
│   ├── sync-protocol.md     # Offline outbox/push/pull, konfliktregler
│   ├── domain-engine.md     # Domænepakkens offentlige API, invarianter, årsagskoder, F-01–F-16
│   └── ui-routes.md         # Ruter, RBAC-matrix, UX-krav
├── checklists/
│   └── requirements.md      # Spec-kvalitetstjekliste
└── tasks.md                 # Phase 2 (/speckit-tasks – IKKE oprettet af /speckit-plan)
```

### Source Code (repository root)

```text
package.json                     # npm workspaces: apps/*, packages/*
docker-compose.yml               # db (PostgreSQL 17)
.env.example

packages/
├── domain/                      # Ren TS, ingen I/O – kører på server OG tablet
│   ├── src/
│   │   ├── regler/              # hc01-dagsgraense … hc08-niveau, welfare-guard.ts
│   │   ├── tildeling/           # egnethed.ts, mrv-solver.ts, reparation.ts, score.ts (SC-01…05)
│   │   ├── erstatning/          # foreslaa-erstatninger.ts (top-3)
│   │   ├── forklaring/          # aarsagskoder.ts, danske skabeloner
│   │   └── kalender/            # afbudsfrist.ts, opsigelse.ts, turnus.ts, fravaer.ts
│   └── tests/
│       ├── unit/
│       ├── property/            # fast-check-invarianter
│       └── scenarier/           # forfatning.spec.ts (F-01 … F-16)
└── contracts/                   # Zod-skemaer + typer delt af api og web (kommandoer, DTO'er)
    └── src/

apps/
├── api/                         # Fastify REST + SSE
│   ├── prisma/
│   │   ├── schema.prisma
│   │   └── migrations/          # inkl. håndskrevet SQL: append-only-triggere, hashkæde
│   ├── src/
│   │   ├── moduler/             # auth, enheder, heste, ryttere, hold, oensker, tildeling,
│   │   │                        # lektioner, fremmoede, venteliste, vikar, dashboard,
│   │   │                        # rapporter, audit, sync
│   │   ├── plugins/             # rbac, krypto (AES-GCM), sse, fejl, idempotens
│   │   └── server.ts
│   └── tests/
│       ├── integration/         # rbac.spec.ts, append-only.spec.ts, sync.spec.ts
│       └── contract/            # svar valideres mod openapi.yaml
└── web/                         # React PWA
    ├── src/
    │   ├── stald/               # ruter + komponenter (PIN-pad, holdliste, cheat sheet, erstat)
    │   ├── admin/               # dashboard, kabale, stamdata, venteliste, vikarkoder, rapporter
    │   ├── offline/             # dexie-db.ts, outbox.ts, sync-motor.ts, lokal-pin.ts
    │   └── faelles/             # api-klient, UI-kit (store touch-mål), synkindikator
    ├── public/                  # manifest.webmanifest, ikoner
    └── tests/                   # komponenttests

tools/
├── seed/                        # fredag.ts (fra _resources/teacher), fuld.ts (syntetisk), cheat-sheet-koder.ts
└── demo/                        # demo:tid (styret ur), demo:manipuler (hashkæde-demo)

e2e/                             # Playwright: stald-offline, kabale, erstatning, vikar, afbud,
                                 # admin, rapport, konflikt
```

**Structure Decision**: Webapplikation som **npm-workspaces-monorepo** med to apps og to delte pakker. Opdelingen følger forfatningens systemlag: `apps/web` dækker Stald-Tablet UI og Web-Admin, `apps/api` dækker Integrations- og API-laget, Offline-Sync-serverdelen og Compliance Engine, `packages/domain` dækker Allocation Engine og Welfare Guard, og `apps/api/prisma` er persistenslaget. Stald og admin er ét deploybart frontend-projekt med to rutetræer for at holde POC'en slank. Kun `/stald/*` caches offline. Domænepakken er adskilt, fordi den skal køre i både Node og browser.

## POC-leverancer (vertikale snit, i prioriteret rækkefølge)

Hvert snit kan demonstreres for sig, så POC'en altid er pitchbar efter det seneste færdige snit.

| Snit | Indhold | Stories / features | Valideret af |
|---|---|---|---|
| **S0 Fundament** | Monorepo, Docker/PG, Prisma-skema, append-only-triggere, seed `fredag`, RBAC-skelet, PWA-shell | — | Integrationstest af append-only |
| **S1 Stald-fremmøde offline** | Enhedsregistrering, PIN (lokal + server), `/stald/i-dag`, holdliste, batch-afkrydsning, outbox/sync, korrektion, audit + hashkæde | US1 · F3.1 | V1, V10 |
| **S2 Kabalen** | Hestedatabase, sikkerhedsprofil (krypteret), ønsker, domæneregler HC-01 – HC-08, MRV-motor, Welfare Guard, forklaringer, kabale-UI, publicering → lektioner | US2 · F1.1 – F1.4 | V2, F-01 – F-16, benchmark |
| **S3 Akut drift** | Hestestatusmeldinger, top-3 offline, omplacering, SSE, vikarkoder, Cheat Sheet | US3 · F2.1 – F2.3 | V3, V4, V9 |
| **S4 Ledelse** | Afbud + 12:00-regel, venteliste og forslag, opsigelse, dashboard-nøgletal, notifikationer, kommunerapport, verifikation | US4 | V5 – V8 |
| **S5 Pitch-klar** | Seed `fuld`, EU-demo-deploy over HTTPS, drejebog, målinger samlet til slides | alle | Quickstart §5–6 |
| **S6 Drift & UX-polish** | Smart månedskalender (`GET /stald/kalender/:maaned`), tablet numpad, elevønske-rydning & admin-styring (`/admin/oensker`), hestesundhed KPI & hurtig-status, vikar-koder med øje-toggle | FR-019 – FR-023 | E2E + Typecheck |

## Constitution Check — re-evaluering efter Phase 1-design

| Kontrolpunkt | Resultat efter design |
|---|---|
| Kan en HC omgås et sted i designet? | Nej. Alle skriveveje for hestetildeling (motor, `PATCH` tildeling, `GodkendOmplacering` via sync) kalder Welfare Guard på serveren. Offline-forslag revalideres ved push og afvises ved brud ([sync-protocol §4](./contracts/sync-protocol.md#4-push-svar-pr-kommando)). Ingen override-endpoint i [openapi.yaml](./contracts/openapi.yaml) |
| Når Art. 9-data en enhed eller en uautoriseret rolle? | Nej. Stald-DTO'er (`StaldDag`, `StaldPlads`) indeholder ingen følsomme felter. Kun Ledelse har `/ryttere/*/sikkerhedsprofil`. V9 scanner alle stald-svar rekursivt |
| Er fremmøde uforanderligt med begrundede korrektioner? | Ja. Append-only i databasen, `erstatter_id` + påkrævet begrundelse efter lukning, hashkæde |
| Er kravet om under 15 sek. bevaret trods revisionskravet? | Ja. Undtagelser i åbent fremmøde kræver ingen tekst, og batch er én kommando |
| Holder scope-afgrænsningen? | Ja. Ingen forældre- eller elevroller, ingen selvbetjening, ingen stævner eller facilitetsbooking |
| Nye afvigelser fra spec'en? | Kun præciseringer: nye støtteentiteter (Enhed, Lektion, LektionsPlads, Tildelingskoersel m.fl.), `bopaelskommune` tilføjet, Holdtilmelding og Hestetildeling adskilt, åbent/lukket fremmødevindue. Alle er markeret **[Præcisering]** i [data-model.md](./data-model.md) |

**Gate-resultat (efter Phase 1)**: ✅ **PASS**. Ingen nye overtrædelser. G1 – G3 er afklaret i spec'en (session 2026-10-06), og designet er opdateret tilsvarende.

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

Der er ingen overtrædelser af forfatningen. Følgende POC-forenklinger berører forfatningens guardrails og er bevidst valgt:

| Forenkling | Hvorfor den er nødvendig i POC'en | Den simplere/strengere løsning blev fravalgt fordi |
|---|---|---|
| Krypteringsnøgle til Art. 9-felter kommer fra miljøvariabel (ingen KMS eller nøglerotation) | Kryptering i hvile (Princip IV) demonstreres uden cloud-KMS-afhængighed | KMS er driftsinfrastruktur uden bevisværdi for POC-hypoteserne. Kræves før pilotdrift med rigtige data |
| 4-cifrede PIN-hashes caches på enheden for offline-oplåsning | Krævet af FR-005 (PIN skal virke offline) og SC-001 | Online-only PIN bryder Princip V. Risikoen afbødes af enhedstillid, lockout, at PIN kun bruges som identifikation, og at der ikke ligger følsomme data på enheden |
| Felt-LWW på klienttid (risiko for forskudte ure) | Foreskrevet af spec'ens edge case | Servertid ville ignorere hvornår handlingen faktisk skete offline. Afvigelser logges og vises |
| Monorepo med 4 workspaces (2 apps + 2 pakker) | Domænepakken skal køre i både Node og browser (offline-erstatning) | Ét projekt ville blande browser- og serverafhængigheder. To separate regelimplementeringer ville bryde "én sandhed" for HC-reglerne |
