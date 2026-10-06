# Research: Proof of Concept af hele systemet (001-holdadministration-mvp)

**Fase**: 0 (Outline & Research) | **Dato**: 2026-10-06 | **Plan**: [plan.md](./plan.md) | **Spec**: [spec.md](./spec.md)

Dette dokument afklarer alle tekniske ubekendte fra planens *Technical Context*. Planlægningsinputtet var: *"formålet med at lave en proof of concept af hele systemet"*. Hver beslutning er derfor vurderet ud fra to spørgsmål:

1. Kan POC'en **bevise** den påstand, som kravet bygger på (f.eks. "<15 sek. offline", "0 HC-brud", "<2 sek. top-3")?
2. Kan teamet **bygge og pitche** den inden for et 3. semesters projektforløb uden at bryde forfatningen?

Format pr. punkt: **Beslutning**, **Begrundelse**, **Alternativer overvejet**.

---

## R1. POC'ens art: kørende kode frem for klikbar mock-up

- **Beslutning**: POC'en bygges som en **kørende, klikbar webapplikation med rigtig database, rigtig tildelingsmotor og rigtig offline-synkronisering**, der dækker alle fire user stories (US1–US4). Den seedes udelukkende med fiktive casedata fra `_resources/teacher/`.
- **Begrundelse**: Casen kræver "en eller flere klikbare proof of concepts, der kan pitches". De centrale løfter i spec'en er tekniske påstande: offline-afkrydsning under 15 sek. (SC-001), 0 velfærdsbrud (SC-002/003), kabale under 30 sek. (SC-004) og top-3 under 2 sek. (SC-005). En Figma-prototype kan vise flowet, men kan ikke bevise nogen af dem. En kørende POC kan begge dele og giver samtidig målinger til præsentationen.
- **Alternativer overvejet**:
  - *Figma/klikbar mock-up alene*: hurtig og god til UX-feedback, men beviser intet om algoritme, offline eller revisionsspor. Kan stadig bruges som supplement til pitch-slides.
  - *Low-code (Power Apps / AppSheet)*: hurtig CRUD, men en constraint-solver og ægte offline-first med konfliktløsning er besværlige eller umulige, og der er leverandørbinding.
  - *Kun algoritme-prototype (notebook)*: beviser H2, men ikke stald-UX, offline, vikarflow eller dashboard. Det dækker ikke "hele systemet".

## R2. Sprog og runtime: TypeScript end-to-end (Node.js 24 LTS)

- **Beslutning**: **TypeScript 5.x** i hele stakken: backend på **Node.js 24 LTS**, frontend i browseren og en **delt domænepakke** (`packages/domain`) uden I/O.
- **Begrundelse**: Forfatningen (Princip V) kræver, at **akut hestebytning** fungerer offline. Top-3-erstatningen (FR-011) skal altså kunne køre *på tabletten* uden server. Med TypeScript kører præcis den samme Welfare Guard- og erstatningskode på server og tablet, så der kun er én implementering af HC-01–HC-08 at teste. Det fjerner risikoen for, at to implementeringer af velfærdsreglerne glider fra hinanden. Det er også ét sprog for hele teamet.
- **Alternativer overvejet**:
  - *Java/Spring Boot + React*: velkendt fra uddannelsen, men reglerne skulle genimplementeres i JavaScript til offline-brug. To regelmotorer giver dobbelt testbyrde og risiko for afvigelser, hvilket rammer Princip I.
  - *Python/FastAPI + OR-Tools*: stærk solver, men samme problem med duplikerede regler offline.
  - *Native app (Flutter/React Native)*: god offline-lagring, men app-store-distribution og to platforme er overkill for en POC. En PWA kan installeres direkte fra browseren.

## R3. Persistens: PostgreSQL 17 + Prisma ORM; append-only håndhæves i databasen

- **Beslutning**: **PostgreSQL 17** (krævet af forfatningens persistenslag) kører lokalt via **Docker Compose**. Adgang sker gennem **Prisma ORM** med versionerede migrationer. Append-only for `fremmoederegistrering`, `audit_haendelse`, `omplacering`, `hestestatusmelding` og `rapport_udtraek` håndhæves med en **`BEFORE UPDATE OR DELETE`-trigger, der rejser en exception**. Triggeren lægges i en håndskrevet SQL-migration.
- **Begrundelse**: Forfatningen kræver PostgreSQL. FR-017 kræver et *uforanderligt* revisionsspor. Når kravet håndhæves i databasen og ikke kun i applikationskoden, holder det også ved fejl i API'et eller ved manuel SQL. Prisma har god dokumentation for studerende og tillader brugerdefineret SQL i migrationer.
- **Alternativer overvejet**:
  - *SQLite*: enklere opsætning, men strider mod forfatningens krav om PostgreSQL.
  - *Supabase/Firebase*: indbygget sync og auth, men eksterne afhængigheder, tvivl om datalokation (GDPR) og ikke-relationel model (Firebase).
  - *Drizzle ORM*: lettere og tættere på SQL. Et fuldt gyldigt alternativ, men Prisma vælges for dokumentation og læringskurve.

## R4. Offline-first: PWA + IndexedDB-outbox + push/pull-sync

- **Beslutning**: Staldfladen er en **PWA**. App-shell caches af en Workbox-service-worker (`vite-plugin-pwa`). Data ligger i **IndexedDB via Dexie**. Alle staldhandlinger gemmes som **kommandoer i en lokal outbox** med klientgenereret UUID (idempotensnøgle), enheds-ID, bruger-ID og klienttidsstempel. Synkronisering sker via `POST /sync/push` (batch, idempotent) og `GET /sync/pull?cursor=` (ændringer siden sidste cursor). Konflikter på muterbare felter løses med **Last-Write-Wins pr. felt** ud fra klienttidsstemplet, som spec'ens edge case foreskriver. Hver konflikt logges som `AuditHaendelse(type=SYNK_KONFLIKT)` og vises på dashboardet. Protokollen er beskrevet i [contracts/sync-protocol.md](./contracts/sync-protocol.md).
- **Begrundelse**: Outbox-mønsteret giver FR-005 og US1 AS3/AS4: et tryk gemmes lokalt på under 100 ms og synkroniseres senere uden datatab. Fremmøde er append-only, så to enheder offline aldrig overskriver hinanden. Begge hændelser bevares, og den seneste vinder i den afledte status. Det er enkelt nok til at blive forstået og testet af teamet.
- **Alternativer overvejet**:
  - *RxDB / PouchDB-CouchDB*: indbygget replikering, men kræver CouchDB-protokol eller ekstra lag oven på PostgreSQL.
  - *ElectricSQL / PowerSync*: elegant Postgres-sync, men ekstra infrastruktur og licens-/driftskompleksitet, som overstiger POC-behovet.
  - *Ingen offline, kun "retry ved fejl"*: opfylder ikke Princip V og US1 AS3.
- **Bemærkning om service worker**: Service workers kræver *secure context* (HTTPS eller `localhost`). Se R13 om demo-hosting.

## R5. Tildelingsmotor (Kabalen): deterministisk constraint-filter + MRV-grådig tildeling med reparation + uafhængig Welfare Guard

- **Beslutning**: Motoren i `packages/domain/allocation` virker i trin:
  1. **Faste tildelinger**: partaftaler (f.eks. Freja P. → Belle, Lærke H. → Aida) og påkrævede heste (Anna → Donny) placeres først. Er det umuligt (f.eks. hesten er syg), markeres rytteren og ledelsen adviseres.
  2. **Statisk egnethedsmatrix** E(rytter, hold): heste, der består HC-04, HC-05 (springforbud), HC-06, HC-07 og HC-08 for den konkrete rytter på det konkrete hold. Hver udelukkelse gemmer en årsagskode.
  3. **Rækkefølge**: ryttere sorteres efter *Minimum Remaining Values* (færrest egnede heste først). Inden for samme gruppe sorteres efter **turnusprioritet** (SC-02), derefter ancienitet og til sidst et stabilt ID. Resultatet er deterministisk og reproducerbart.
  4. **Valg**: for hver rytter vælges den egnede hest med højest blød score. Scoren består af SC-01 (1./2./3. ønske = 100/60/30), SC-03 (straf for hestens aktuelle ugebelastning), SC-04 (bonus for et passende progressionstrin, når rytteren er markeret "klar til udvikling") og SC-05 (hjælpere tildeles til sidst fra restkapaciteten). Dynamiske grænser tjekkes løbende: HC-01/HC-02 dagsbelastning pr. ugedag, HC-03 hviledag, HC-05 springgrænse pr. uge og én hest pr. plads i samme lektion.
  5. **Reparation**: hvis en rytter ikke har nogen ledig egnet hest, prøves en *augmenting path* med begrænset dybde. En tidligere placeret rytter flyttes til en anden egnet hest for at frigøre en. Lykkes det ikke, markeres rytteren **"Ikke tildelt – kapacitetsmangel"** med forklaring, og der oprettes en dashboardnotifikation. Systemet foreslår **aldrig** en ulovlig hest (spec, edge cases).
  6. **Welfare Guard (uafhængig efterkontrol)**: hele planen valideres mod HC-01–HC-08 af et separat modul. Findes der bare én overtrædelse, afvises kørslen som en motorfejl og kan ikke publiceres. Det gør SC-002/SC-003 til en invariant, som ikke afhænger af, at heuristikken er korrekt.
  7. **Explainable Allocation**: hver tildeling får strukturerede årsagskoder plus en dansk tekst (FR-010), f.eks. *"Toobi nåede sin max-grænse på 3 hold fredag af hensyn til hestevelfærd (HC-01). Sophia fik sit 2. ønske, Zigge (SC-01). Turnusprioritet næste måned: +1 (SC-02)."*
- **Turnus (SC-02)**: Turnusprioriteten for måned M beregnes alene ud fra resultatet i M-1: 1. ønske = 0, 2. ønske = +1, 3. ønske = +2, alternativ tildeling = +3. Det følger spec'ens "i foregående måned" og US2 AS4/AS5.
- **Begrundelse**: Problemet er lille (180 ryttere × 22 heste × ca. 28 hold). En deterministisk heuristik kører på millisekunder, langt under 30 sek. (SC-004). Den er nem at forklare over for forældre, og Welfare Guard gør korrekthed af de hårde regler uafhængig af optimalitet. Motoren ligger bag et `AllocationSolver`-interface, så den kan skiftes ud senere.
- **Alternativer overvejet**:
  - *ILP/MIP-solver (HiGHS via WASM, glpk.js)*: optimal løsning, men forklaringer skal udledes bagefter og fejlsøgning er sværere for teamet. Er kandidat til "v2" bag samme interface.
  - *CP-SAT (OR-Tools, Python)*: stærkest til komplekse begrænsninger, men kræver en Python-tjeneste og bryder én-sprogs-beslutningen i R2.
  - *Min-cost flow pr. dag*: elegant for dagskapacitet, men ugentlige begrænsninger (springgrænse, hviledag) passer ikke ind i en laminær flow-struktur.

## R6. Akut erstatning (top-3) offline uden Art. 9-data på enheden

- **Beslutning**: Serveren beregner den **statiske egnethed** (HC-05 springforbud, HC-06, HC-07, HC-08) pr. rytterplads og sender den til tabletten **kun som en liste af godkendte hest-ID'er** (`godkendte_heste`). Tabletten anvender selv de **dynamiske** regler ud fra lokale data for dagen: HC-01/HC-02 dagsbelastning, HC-03 hviledag, HC-04 sundhedsstatus, HC-05 springgrænse for ugen og om hesten allerede er brugt i lektionen. Kandidaterne rangeres efter rytterens ønsker for måneden, dernæst laveste dagsbelastning (SC-03) og temperamentsmatch. Der returneres op til 3 forslag. Findes der færre end 3, vises en advarsel om kapacitetsmangel.
- **Begrundelse**: Det opfylder FR-011 (under 2 sek., også offline, typisk under 200 ms). Samtidig ligger der **ingen vægt, diagnoser, traumenoter eller begrundelser** for spærringer på tabletten. Kun et sæt tilladte ID'er. Det er dataminimering efter Princip IV og GDPR Art. 5(1)(c).
- **Alternativer overvejet**:
  - *Sende hele sikkerhedsprofilen til tabletten*: strider mod Princip IV.
  - *Kun online-erstatning*: strider mod Princip V ("akut hestebytning SHALL fungere uafbrudt").

## R7. Autentificering, enheder og RBAC

- **Beslutning**:
  - **Enhedstillid**: en stald-tablet registreres én gang af Ledelse med et enrollment-token. Kun registrerede enheder kan bruge PIN-login og synkronisere.
  - **Personale-PIN (4 cifre)**: identificerer brugeren på en betroet enhed (FR-004). PIN-hashes (Argon2id på serveren, PBKDF2 via WebCrypto i enhedens cache) synkroniseres til tabletten, så oplåsning virker offline og tager under 2 sek. (US1 AS1). Efter 5 forkerte forsøg spærres i 60 sek.
  - **Vikar-engangskode (6 cifre)**: adskiller sig visuelt og logisk fra 4-cifrede personale-PIN'er. Gemmes kun som hash. Kræver fulde navn ved brug. Giver en session til udgangen af den dag, den bruges (Europe/Copenhagen), og bliver derefter `Anvendt`. Ledelse adviseres (FR-013). Aktive koders hashes ligger på enheden, så de også virker offline. Bruges samme kode på to enheder offline, accepteres begge sessioner den dag, og der logges en konflikt.
  - **Web-admin**: Ledelse og Ridelærer logger ind med e-mail og adgangskode. Sessioner er kortlivede tokens (httpOnly-cookie på web, bearer-token på tablet).
  - **RBAC**: fire roller (Ledelse, Ridelærer, Vikar, Staldelev). En bruger kan have flere roller (Malene er både Ledelse og Ridelærer). Adgang tjekkes både pr. endpoint **og pr. felt** via faste DTO-projektioner, så Art. 9-felter aldrig kan serialiseres til stald-endpoints. Matrix: [contracts/ui-routes.md](./contracts/ui-routes.md#rbac-matrix).
- **Begrundelse**: En 4-cifret PIN er ikke stærk nok alene. Den er en hurtig identifikation til revisionssporet. Sikkerhedsgrænsen ligger i enhedstilliden og dataminimeringen på enheden (R6, R8). Det er en bevidst afvejning mellem sikkerhed og kravet om under 15 sek.
- **Alternativer overvejet**:
  - *Fuldt brugernavn og adgangskode i stalden*: for langsomt med handsker (bryder SC-001).
  - *NFC-brik/QR-kort*: hurtigt, men kræver hardware. Kan overvejes efter POC'en.
  - *Ekstern IdP (MitID Erhverv, Entra ID)*: ude af proportion for en POC.

## R8. GDPR Art. 9: adskilt sikkerhedsprofil, kryptering på applikationsniveau og Cheat Sheet-kodekatalog

- **Beslutning**:
  - Følsomme felter (faldtraume, angstkategori, interne pædagogiske noter) ligger i en **separat tabel `sikkerhedsprofil`** og krypteres på **applikationsniveau med AES-256-GCM**, før de skrives til databasen. Nøglen kommer fra miljøvariabel i POC'en. Administrative stamdata ligger i `rytter` (Princip IV: adskillelse).
  - Cheat Sheet'et (FR-012) bygges **kun** af et **standardiseret kodekatalog** (`cheat_sheet_kode`, f.eks. `OBS-SKAANSOM` → *"OBS: Følsom/skånsom håndtering påkrævet – se instruks"*, `AFSTAND-3M` → *"Hold 3 meters afstand til andre heste"*) og en anonymiseret, handlingsorienteret instrukstekst. Ledelse vælger koderne. Fritekst med diagnoser kan ikke nå staldvisningen, fordi feltet slet ikke indgår i stald-DTO'en.
  - **Ingen CPR-numre** i POC'en. Kun fødselsdato og bopælskommune til kommunerapporten (dataminimering).
  - Al data er fiktiv (fra casematerialet). En DPIA nævnes som forudsætning før pilotdrift med rigtige data.
- **Begrundelse**: Det følger afklaringen fra 2026-10-05 (standardiseret anonymiseret kode uden diagnoser) og FR-003. Applikationskryptering betyder, at data også er beskyttet i databasedumps og logs.
- **Alternativer overvejet**:
  - *pgcrypto i databasen*: nøglen ender i SQL-sætninger og logs.
  - *Fuld disk-kryptering alene*: beskytter ikke mod applikations- eller DBA-adgang.
  - *Fritekst-Cheat Sheet med manuel "tænk dig om"-regel*: for stor risiko for, at diagnoser slipper igennem.

## R9. Realtid på tværs af enheder: Server-Sent Events

- **Beslutning**: API'et udsender ændringer (omplacering, sygemelding, afbud, vikarlogin, nye forslag) på `GET /events` som **Server-Sent Events**, filtreret pr. rolle. Online enheder opdaterer straks. Offline enheder henter ændringer med `sync/pull` ved genforbindelse.
- **Begrundelse**: Det opfylder US3 AS5 ("opdateres holdlisten i realtid på tværs af alle enheder") og FR-016's realtidsnøgletal. SSE er envejs, kører over almindelig HTTP og er simplere end WebSockets. Kommandoerne går alligevel via REST/outbox.
- **Alternativer overvejet**: *WebSockets* (tovejs, men ikke nødvendigt), *polling hvert 5. sek.* (enklere, men spild og langsommere).

## R10. Tid, deadlines og forretningskalender

- **Beslutning**: Al forretningslogik bruger tidszonen **Europe/Copenhagen** (date-fns + `@date-fns/tz`). Gemte tidsstempler er UTC (`timestamptz`).
  - **Afbudsfrist (FR-014, HC-04 i spec)**: et afbud er *rettidigt*, hvis `modtaget_tidspunkt` ligger **før kl. 12:00 lokal tid på lektionsdagen**. `modtaget_tidspunkt` er som standard registreringstidspunktet. Ledelse kan angive et tidligere modtagelsestidspunkt, f.eks. for en SMS modtaget 11:30 og indtastet 12:15. Begge tidspunkter auditlogges.
  - **Opsigelsesvarsel (FR-015)**: `slutdato = sidste dag i den måned, opsigelsen modtages + 30 dage`. Eksempel: opsigelse modtaget 10. oktober giver slutdato 30. november. Pladsen klargøres til genbesættelse fra `slutdato + 1`.
  - **Gentaget fravær (FR-016)**: advarsel ved **3 lektioner i træk** med status `Udeblevet` eller afbud. Tærsklen kan konfigureres.
  - **Afbud registreret offline**: rettidighed afgøres af *klientens* modtagelsestidspunkt. Genbesættelsesforslaget oprettes inden for 5 sek. efter, at **serveren modtager** kommandoen (SC-006 måles fra serverens modtagelse).
- **Begrundelse**: Frister og månedsgrænser er klassiske fejlkilder med tidszoner og sommertid. De skal ligge i rene, testbare funktioner i domænepakken.
- **Alternativer overvejet**: *Native `Date`* (fejlbehæftet med tidszoner). *Temporal API* (oplagt, men understøttelsen i Safari er stadig ikke sikker nok til en POC).

## R11. Kommunal tilsynsrapport og verificerbarhed

- **Beslutning**:
  - Rapporten (FR-018, SC-009) genereres med ét klik for en valgt periode som **CSV** (UTF-8 med BOM og **semikolon** som separator, så den åbner korrekt i dansk Excel) plus en **printvenlig HTML-visning**, der kan gemmes som PDF fra browseren.
  - Hver række er en rytter: navn, fødselsdato, alder ved periodestart, bopælskommune, hold, antal planlagte lektioner, antal fremmødt, rettidige afbud, sene afbud og udeblevne.
  - Filteret *tilskudsberettiget* er en konfigurerbar aldersgrænse (standard **under 25 år**, efter folkeoplysningslovens praksis). Grænsen og felterne (fødselsdato + bopælskommune, intet CPR) er afklaret i spec'en 2026-10-06. Ledelse kan justere aldersgrænsen.
  - **Verificerbarhed**: fremmøderegistreringer og audithændelser danner en **hashkæde** (hver række gemmer `sha256(forrige_hash ‖ rækkeindhold)`). Rapporten indeholder kædens hovedhash og en SHA-256 af selve filen. Hver eksport logges i `rapport_udtraek`. Dashboardet har en knap til at verificere kæden.
- **Begrundelse**: "Revisionssikker" og "verificerbar" (Princip III) bliver demonstrerbart: ændres en historisk række direkte i databasen, knækker kæden synligt. Det er et stærkt pitch-moment.
- **Alternativer overvejet**:
  - *Kun PDF*: ikke maskinlæsbar for kommunen.
  - *Digital signatur med certifikat (XAdES)*: korrekt til produktion, men overkill for en POC.
  - *Ingen hashkæde*: append-only-triggeren beskytter mod applikationsfejl, men ikke mod en DBA. Hashkæden gør manipulation synlig.

## R12. Teststrategi: tests der beviser succeskriterierne

- **Beslutning**:
  - **Domæne (Vitest)**: unit-tests pr. hård regel. Der er **én navngiven scenarietest pr. forfatningseksempel**: Anna kun Donny, Emma aldrig Pixie, Sofia aldrig Aida, Filippa kun Aslan/Toobi, nervøse ryttere aldrig Boy/Pixie/Freya/Cornelius, Bølle/Wally/Aida aldrig på springhold, Arthur ikke på øvede hold, Wally kun lette ryttere, Missy ikke tunge ryttere, Sara T. kun store heste, Clara B./Johanne J. store heste og partheste til parter.
  - **Egenskabsbaserede tests (fast-check)**: for tilfældigt genererede datasæt skal motorens output *altid* bestå Welfare Guard (SC-002/003 som invariant).
  - **API-integration (Vitest + Fastify inject + PostgreSQL i Docker)**: RBAC (inkl. at Art. 9-felter aldrig optræder i stald-responses), append-only-trigger, idempotent sync og LWW-konflikter.
  - **Kontrakttests**: svar valideres mod [contracts/openapi.yaml](./contracts/openapi.yaml).
  - **E2E (Playwright)**: tablet-viewport, `context.setOffline(true)` for offline-scenarier, tidsmåling for afkrydsning (SC-001) og CPU-throttling (4×) for top-3 på en "langsom tablet" (SC-005).
  - **Benchmark**: syntetisk datasæt med 180 ryttere og 28 hold, hvor allokeringen skal tage under 30 sek. (SC-004).
- **Begrundelse**: Hvert succeskriterium har en automatiseret test, der kan vises i pitchen som bevis.
- **Alternativer overvejet**: *Jest* (langsommere med ESM/TS), *Cypress* (svagere offline-simulering end Playwright).

## R13. Kørsel og demo-hosting

- **Beslutning**:
  - **Udvikling**: `localhost` (secure context, så service workeren virker) med PostgreSQL i Docker Compose. Kører på både macOS og Windows (teamet bruger begge).
  - **Pitch-demo**: deploy til en **PaaS i EU-region** (container + managed PostgreSQL) med **kun fiktive seed-data**. Så kan en rigtig tablet bruge HTTPS og PWA-installation.
  - **Fallback**: kør lokalt med et `mkcert`-certifikat på LAN, eller Chrome DevTools' tablet-emulering på laptoppen.
- **Begrundelse**: En tablet kan ikke installere PWA'en eller registrere en service worker over `http://<laptop-ip>`. Uden HTTPS falder offline-demoen.
- **Alternativer overvejet**: *Tunnel (ngrok/Cloudflare)*: hurtigt, men endnu en ekstern afhængighed under pitchen. *Kun laptop-emulering*: overbeviser mindre end en rigtig tablet i hånden.

## R14. Stald-UX: barn-grade, handske-venlig betjening

- **Beslutning**: Touch-mål på **mindst 56×56 px** med mindst 8 px afstand. Grundtekst på mindst 18 px. **Høj kontrast** (mål 7:1, WCAG AAA, af hensyn til sollys). Ingen gestus, der kun virker med swipe. Hver handling gemmes automatisk i outboxen uden "Gem"-knap. Afkrydsning sker med **"Markér alle fremmødt"** (ét tryk) og derefter tryk på undtagelser, der skifter mellem Fremmødt → Udeblevet → Afbud. Synkstatus vises altid (online/offline/antal ventende). Hele brugerfladen er på dansk. Styling: Tailwind CSS.
- **Begrundelse**: Ti ryttere afkrydses med 1 + typisk 1–2 tryk, under 5 sek., godt inden for SC-001's 15 sek. Kontrast og store mål modvirker støv, fugt og handsker (Princip V).
- **Alternativer overvejet**: *Afkrydsning rytter for rytter* (10+ tryk, for langsomt med handsker). *Komponentbibliotek (MUI)*: standardstørrelserne er for små, og der skal alligevel tilpasses meget.

## R15. Seed- og demodata fra casematerialet

- **Beslutning**: To seed-scenarier:
  - **`fredag`** (pitch): bygget af `_resources/teacher/_case-01-fredagsheste jan-jun TIL CASE.md` og `_case-01-Holdoversigt, uge.md`. Det giver 4 fredagshold (Begynder 15:00, Letøvet 15:45, Øvet 16:30, Letøvet 17:15), 34 ryttere med januar–juni-historik (bruges til turnus), 20 heste (19 med Maries tavse viden + TryMe) og Maries noter oversat til strukturerede attributter og Cheat Sheet-koder. Teamet udleder demoønsker for juli fra noterne (Sophia → Toobi, Josefine → Zigge, Viktoria K. → Belle osv.). Forfatningens spærringer er kodet som data.
  - **`fuld`** (benchmark): `fredag` + en **syntetisk generator**, der fylder ugen ud til **28–29 hold, 180 ryttere og 22 heste** efter holdoversigtens niveaufordeling.
  - Grænseværdierne for HC-06 (max ryttervægt og -højde pr. hest) afledes som demoværdier af stangmålet. Malene skal validere dem før pilotdrift.
- **Begrundelse**: Pitchen bliver genkendelig for Bøgegården ("det er vores heste og vores fredag"), mens benchmarket beviser skalaen.
- **Alternativer overvejet**: *Rent syntetiske data* (mindre overbevisende i pitchen). *Rigtige persondata* (forbudt uden DPIA og databehandleraftale).

---

## Datafund fra casematerialet (vigtige for planen og pitchen)

| # | Fund | Konsekvens for POC'en |
|---|---|---|
| D1 | **Afkrydsningslisterne og fredagshestelisten placerer ryttere forskelligt.** Victoria Åby står på Begynder i den ene og Letøvet i den anden; Clara Bjerg på Begynder hhv. Øvet; "Agnes Risbjerg" hhv. "Agnes Riis". Niveauerne for 15:45- og 16:30-holdet er også forskellige. | Det er netop SSoT-problemet fra casen. Seed følger `fredagsheste` og `Holdoversigt`, som stemmer overens. Fundet bruges i pitchen som argument for Princip V. |
| D2 | Forfatningen nævner kun **4 begyndervenlige heste** (Aslan, Toobi, Jane, Belle). Fredagens to tidlige hold har 7–9 ryttere. | Lektionsbegrænsningen giver højst 4 ryttere pr. begynderhold plus partryttere. Er listen udtømmende, er hold med flere begyndere **matematisk uopfyldelige**, og motoren vil (korrekt) melde kapacitetsmangel. **Besluttet (afklaret i spec'en 2026-10-06)**: `godkendt_til_begyndere` er en egenskab på hesten, som kun Ledelse kan ændre. De 4 heste er startværdier. Malene kan godkende flere heste (f.eks. Zigge, Twister eller Arthur, som Marie beskriver som "nem"). Det er et godt pitch-øjeblik: kapacitetsmanglen forsvinder, når hun godkender en hest mere. |
| D3 | Tirsdag har **4 springhold**, men hver hest må højst springe 1 gang om ugen, og 3 heste har springforbud. | Med 22 heste kan der højst være 19 springpladser om ugen. Har tirsdagens springhold over 19 ryttere i alt, er HC-05 uopfyldelig. Motoren melder kapacitetsmangel i stedet for at bryde reglen. |
| D4 | Lærke Hansen har part på **Aida** og går på **Begynder**-holdet. Aida er ikke en "rolig" hest. | To dele af HC-08 kolliderer ("Begynder kun rolige heste" og "partheste reserveret parter"). **Besluttet (afklaret i spec'en 2026-10-06)**: parthesten bruges kun på holdet, hvis Ledelse har markeret partaftalen **"godkendt trods niveau"** (`partaftale_godkendt_trods_niveau`). Uden markering gælder niveaukravet: rytteren får en alternativ hest, og dashboardet viser en advarsel. HC-01–HC-07 gælder altid. |
| D5 | Spec'en nævner bopælskommune (antagelser), men Rytter-entiteten mangler feltet. | `bopaelskommune` er tilføjet i [data-model.md](./data-model.md). |

## Åbne punkter til teamet: alle besluttet via `/speckit-clarify` 2026-10-06

- **Å1 – Override af dagsgrænse (spec vs. forfatning)**: spec'ens edge case tillader "eksplicit ledelsesgodkendelse" til at gå over HC-01, men forfatningens Princip I siger, at systemet "MUST forhindre enhver handling … der overskrider en hests kapacitet". **Besluttet**: ingen override for nogen rolle. Spec'ens edge case og FR-007 er rettet.
- **Å2 – Begynderheste**: **Besluttet**: egenskab på hesten, som kun Ledelse kan ændre. De 4 heste er startværdier (se D2). Ingen forfatningsændring nødvendig.
- **Å3 – Partaftale vs. niveaukrav**: **Besluttet**: kun med Ledelsens markering "godkendt trods niveau" pr. partaftale (se D4).
- **Å4 – Tilskudskriterier**: **Besluttet**: fødselsdato + bopælskommune, intet CPR, under 25 år ved periodens start. Ledelse kan justere grænsen.
