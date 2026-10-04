<!--
### Sync Impact Report
- Version change: 1.0.0 → 1.1.0 (Minor version increment)
- Bump Rationale: Migrated core principles and domain constraints from root CONSTITUTION.md into the official spec-kit format (.specify/memory/constitution.md). Formulated declarative RFC 2119 constraint definitions (MUST/MUST NOT/SHOULD), formalized solver guardrails (HC-01 through HC-08, SC-01 through SC-05), defined offline-first technical constraints, and codified governance gates.
- Modified Principles:
  - Princip I: Hestevelfærd Først → I. Hestevelfærd Først (Animal Welfare Above All) [Refined with explicit numeric workload caps & rest requirements]
  - Princip II: Ryttersikkerhed og Fysiologisk Match → II. Ryttersikkerhed & Fysiologisk Match (Rider Safety & Physiological Compatibility) [Refined with explicit trauma and weight blocks]
  - Princip III: Revisionssikkerhed og Kommunal Compliance → III. Revisionssikkerhed & Kommunal Compliance (Auditability & Municipal Compliance) [Refined with immutable audit log requirements]
  - Princip IV: Dataetik, GDPR og Beskyttelse af »Tavs Viden« → IV. Dataetik, GDPR & Beskyttelse af Tavs Viden (Data Privacy & Special Category Protections) [Refined with GDPR Art. 9 & RBAC specifications]
  - Princip V: Single Source of Truth (SSoT) i et Hårdt Staldmiljø → V. Single Source of Truth & Staldmiljø-Robusthed (SSoT & Barn-Grade UX) [Refined with 15-second interaction limit and offline-first requirement]
- Added Sections:
  - ## Domænebetingelser & Tildelingskabale (Domain Constraints & Allocation Engine)
  - ## Arkitektoniske Guardrails, Performance & Beredskab (Architectural Guardrails & Contingencies)
  - ## Governance (Supremacy, Compliance Reviews, RACI & Amendment Procedure)
- Removed Sections:
  - Section 7 (Projektleverancer & Eksamenskrav) migrated to project roadmap/planning rather than permanent constitutional governance.
- Follow-up TODOs: None (All placeholders fully specified with concrete domain rules).
-->

# Bøgegårdens Ridecenter - Digital Holdadministration & Hestetildeling Constitution

Dette dokument udgør den øverste forfatning, domænekontrakt og arkitektoniske guardrails for pilotprojektet for **Dansk Rideforbund** med **Bøgegårdens Ridecenter** i Strandby som pilotvirksomhed. Formålet er at konceptualisere, analysere og udvikle en skræddersyet digital løsning for processen: »Holdadministration, elevregistrering og hestetildeling«.

## Core Principles

### I. Hestevelfærd Først (Animal Welfare Above All)
Dyrevelfærden for rideskolehestene er en absolut grænse, der trumfer alle andre interesser. Hverken forældrepres, elevønsker eller holdoptimering må kompromittere hestens fysiske eller mentale helbred:
- Systemet MUST forhindre enhver handling eller tildeling, der overskrider en hests kapacitet.
- En standard rideskolehest MUST NOT tildeles mere end højst 3 lektioner/hold på en enkelt dag.
- Skåne- og seniorheste MUST NOT tildeles mere end højst 2 lektioner/hold på en enkelt dag.
- Enhver rideskolehest MUST have mindst 1 fast, fuld ugentlig hviledag (0 lektioner).
- En hest MUST NOT deltage på springhold mere end højst 1 gang om ugen.
- Heste med springforbud (*Bølle*, *Wally*, *Aida*) MUST NOT under nogen omstændighed tildeles springhold. *Arthur* må maksimalt tildeles 1 springhold om ugen.
- Heste registreret som syge, halte eller skadede MUST øjeblikkeligt udelukkes fra al holdtildeling og må ikke bookes.

*Rationale:* Ridecenterets eksistens og faglige legitimitet hviler på ansvarlig hestevelfærd under Dansk Rideforbund. Hestens sundhed er et ufravigeligt etisk og lovgivningsmæssigt loft.

### II. Ryttersikkerhed & Fysiologisk Match (Rider Safety & Physiological Compatibility)
Tildeling af heste må aldrig baseres på vilkårlig lodtrækning eller udelukkende popularitetsønsker. Systemet skal sikre fuldstændig kompatibilitet mellem hest og rytter:
- Systemet MUST validere fysisk match: Rytterens højde og vægt SHALL matche hestens bæreevne (f.eks. *Wally* (115 cm) må kun bære lette ryttere; *Missy* (144 cm) må ikke bære tunge ryttere; tunge ryttere som *Sara Troelsen* må kun tildeles store, bæredygtige heste; høje ryttere som *Clara Bjerg* og *Johanne Johansen* SHALL tildeles store heste såsom *Aslan*, *Belle*, *Boy* eller *Rosa*).
- Systemet MUST håndhæve absolutte traume- og sikkerhedsspærringer:
  - *Anna Gammelgård* (angstdiagnose) MUST KUN tildeles *Donny*.
  - *Emma Grønby* (traume efter brækket arm) MUST ALDRIG tildeles *Pixie*.
  - *Sofia Ejby* (afkastet og utryg) MUST ALDRIG tildeles *Aida*.
  - *Filippa Udby* (nervøs elev/uerfarne forældre) MUST KUN tildeles rolige, stabile heste (*Aslan*, *Toobi*).
  - Nervøse elever og elever med rideangst MUST NOT tildeles urolige, fremadgående eller udfordrende heste (*Boy*, *Pixie*, *Freya*, *Cornelius*).
- Systemet MUST håndhæve holdniveau-kvalifikation: Begynderhold må KUN tildeles rolige heste (*Aslan*, *Toobi*, *Jane*, *Belle*); *Arthur* må IKKE tildeles øvede hold; ryttere med faste partaftaler (*Freja P.* og *Lærke H.*) MUST tildeles deres respektive partheste (*Belle* og *Aida*).

*Rationale:* Hestesport indebærer iboende fald- og ulykkesrisici. Fejlmatch mellem hest og elev skaber utryghed og ulykker, der kan undgås gennem stringente valideringsregler.

### III. Revisionssikkerhed & Kommunal Compliance (Auditability & Municipal Compliance)
Bøgegårdens Ridecenter modtager afgørende kommunal aktivitetsstøtte fra Strandby Kommune til fritidstilbud for børn og unge. Uretmæssig eller udokumenteret støtte kan medføre tilbagebetalingskrav og tab af godkendelse:
- Elevfremmøde MUST registreres digitalt, uforgængeligt og tidsstemplet.
- Manuelle papirafkrydsningslister MUST udfases til fordel for et revisionssikkert datagrundlag med automatisk historik.
- Enhver manuel efterkorrektion i fremmøderegistreringen MUST logges med bruger-ID, tidsstempel og obligatorisk begrundelse.
- Systemet SHALL levere verificerbare, standardiserede dataudtræk direkte til Strandby Kommunes tilsynskrav for tilskudsberettigede elever.

*Rationale:* Den kommunale støtte udgør en central del af ridecenterets økonomiske fundament. Manglende eller fejlbehæftet dokumentation truer foreningens eksistens.

### IV. Dataetik, GDPR & Beskyttelse af Tavs Viden (Data Privacy & Special Category Protections)
Oplysninger om elevers diagnoser, rideangst, familiære forhold samt hestes adfærdsvanskeligheder udgør særlige kategorier af personoplysninger (GDPR Art. 9) og fortrolig faglig viden:
- Systemet MUST beskytte følsomme elevoplysninger gennem Privacy by Design, kryptering i hvile og under transit (GDPR Art. 32).
- Systemet MUST implementere streng rollebaseret adgangskontrol (RBAC): Ridelærere og driftsledelse må kun tilgå de oplysninger, der er nødvendige for sikker afvikling; forældre, elever og uvedkommende må ALDRIG få indsigt i interne noter, diagnoser eller andre elevers data.
- Der MUST opretholdes en klar adskillelse i datamodellen mellem administrative stamdata/kontingenter og faglige/pædagogiske sikkerhedsobservationer.

*Rationale:* Elevernes personlige trivsel og tillid til ridecenteret forudsætter kompromisløs overholdelse af gældende databeskyttelseslovgivning og beskyttelse af personfølsom viden.

### V. Single Source of Truth & Staldmiljø-Robusthed (SSoT & Barn-Grade UX)
Løsningen skal fungere som det eneste autoritative sandhedspunkt for holdlister, elevtilmeldinger og hestestatus under barske fysiske driftsforhold:
- Systemet MUST udgøre den centrale Single Source of Truth (SSoT) og erstatte fragmenterede whiteboards, papirlister og private SMS-beskeder.
- Brugerfladen på stald-tablets og mobile enheder MUST være optimeret til staldmiljøet (støv, fugt, ridehandsker, sollys): Afkrydsning af et helt hold (op til 10 ryttere) MUST kunne gennemføres på under 15 sekunder.
- Systemet MUST implementere en Offline-First arkitektur: Holdlister, fremmøderegistrering og akut hestebytning SHALL fungere uafbrudt ved tab af mobil- og internetdækning og automatisk synkronisere konfliktfrit, så snart forbindelsen genoprettes.

*Rationale:* Ridelærerne har nul minutters pause mellem holdene, og staldens placering i et landområde medfører periodiske netudfald. Systemet skal derfor fungere lynhurtigt og fejlfrit uden internetadgang.

## Domænebetingelser & Tildelingskabale (Domain Constraints & Allocation Engine)

Tildelingskabalen mellem elever og heste styres af en to-trins Constraint-Satisfaction model, hvor Hårde Restriktioner (HC) har absolut forrang frem for Bløde Restriktioner (SC).

### Hårde Restriktioner (Hard Constraints - Absolute Rules)
Enhver tildeling, der overtræder én eller flere hårde restriktioner, er ugyldig og MUST afvises automatisk af valideringsmotoren (Welfare Guard):

| ID | Restriktion | Regeldefinition | Verifikationsmetode |
|---|---|---|---|
| **HC-01** | Dagsbelastning (Normale heste) | En hest må højst gå 3 hold på en enkelt dag. | Boolean filter på dags- og lektionsniveau. |
| **HC-02** | Dagsbelastning (Skåne-/Senior) | Ældre eller skåneregistrerede heste må højst gå 2 hold pr. dag. | Validering mod hestens helbredsstatus. |
| **HC-03** | Ugentlig Hviledag | Enhver rideskolehest skal have mindst 1 fuld ugentlig hviledag uden lektioner. | Kalendervalidering på ugeplan. |
| **HC-04** | Sundhedstilstand | Sygemeldte, halte eller skadede heste må under ingen omstændigheder tildeles. | Statusfelt i hestedatabase (Aktiv / Sygemeldt). |
| **HC-05** | Springfrekvens & Forbud | Max 1 springlektion/uge pr. hest. Absolut forbud for *Bølle*, *Wally*, *Aida*. *Arthur* max 1 springhold. | Validering mod hesteprofil og holdtype. |
| **HC-06** | Fysisk Vægt- & Størrelsesmatch | Rytterens vægt og højde skal overholde hestens specifikke bæreevne og stangmål. | Fysiologisk match-validering. |
| **HC-07** | Traume- & Sikkerhedsspærringer | Ufravigelige forbud grundet diagnoser, faldtraumer eller angst (f.eks. Anna KUN Donny; Emma IKKE Pixie; Sofia IKKE Aida). | Regel- og undtagelsesfilter i tildelingsmotor. |
| **HC-08** | Holdniveau-Kvalifikation | Elever tildeles kun heste, hvis temperament matcher holdniveauet (Begynder KUN rolige heste; Arthur forbudt på øvede hold; partheste reserveret parter). | Niveau- og partvalidering mod holdprofil. |

### Bløde Restriktioner (Soft Constraints - Optimization Goals)
Når de hårde restriktioner er opfyldt, optimerer tildelingsmotoren den samlede tilfredshed ud fra følgende vægtede målfunktion:

| ID | Restriktion | Formål & Vægtningsprincip |
|---|---|---|
| **SC-01** | Elevønsker | Prioriterer opfyldelse af elevernes 3 månedlige ønsker (1. ønske vægtes højest, derefter 2. og 3.). |
| **SC-02** | Historisk Retfærdighed (Turnus) | Elever, der i foregående måned fik 2. eller 3. ønske (eller kompromis), tildeles højere prioritet ved eftertragtede heste (*Toobi*, *Belle*, *Donny*). |
| **SC-03** | Jævn Flådebelastning | Arbejdsbyrden fordeles jævnt over hele hesteflåden for at minimere slidtage på de mest populære heste. |
| **SC-04** | Pædagogisk Progression | Elever, der er klar til udvikling, tildeles udfordrende heste, der stimulerer deres ridefaglige niveau under trygge rammer. |
| **SC-05** | Hjælper-præferencer | Erfarne staldelever tildeles passende heste til deres vederlagsfrie lektion uden at fortrænge betalende elevers primære undervisning. |

## Arkitektoniske Guardrails, Performance & Beredskab (Architectural Guardrails & Contingencies)

Systemarkitekturen skal understøtte stabil og responsiv drift i staldmiljøet samt levere automatiseret beredskab ved driftsafvigelser.

### 1. Systemlag & Målarkitektur
- **Frontend UI:**
  - *Stald-Tablet UI:* Berøringsvenlig flade optimeret til handsker, høj kontrast og fugtige skærme. Batch-afkrydsning af et hold (10 elever) MUST kunne gennemføres på under 15 sekunder.
  - *Web-Admin Dashboard:* Desktop-interface til ledelsen (Malene) til holdopsætning, hesteprofiler, kommunale udtræk og remote overvågning.
  - *Elev-/Forældremodul (Fremtidigt):* Modulært snitfladedesign, der tillader senere tilkobling af selvbetjeningsportal for ønsker og sygemelding uden omskrivning af kernemotoren.
- **Integrations- & API-lag:**
  - REST/GraphQL API med streng rollebaseret adgangskontrol (RBAC).
  - Offline-Sync Engine med lokal persistens (IndexedDB/SQLite cache) og transparent datasynkronisering ved genoprettet netforbindelse.
- **Forretningslogik & Motorer:**
  - *Allocation Engine:* Constraint-Satisfaction solver, der automatisk genererer månedlige holdlister ud fra HC og SC.
  - *Welfare Guard:* Valideringsmodul, der spærrer enhver manuel eller automatisk overbooking i realtid.
  - *Compliance Engine:* Audit-logning og revisionsspor for elevfremmøde til Strandby Kommune.
- **Persistenslag:**
  - PostgreSQL relationel database med kryptering af personfølsomme data (GDPR Art. 32).

### 2. Akutberedskab & Driftsafvigelser
- **3-Trins Replacement-Reglen:** Ved pludselig sygemelding eller skade på en hest MUST systemet på under 2 sekunder generere top-3 godkendte erstatningsheste, som overholder alle *Hard Constraints* (HC-01 til HC-08) for den berørte rytter. Ridelæreren godkender afløserhesten med ét klik.
- **Vikaroverlevering (Holdets Cheat Sheet):** Ved uvarslet lærersygdom MUST systemet øjeblikkeligt stille et kompakt Cheat Sheet til rådighed for vikaren med kritiske sikkerhedsnoter (f.eks. afstandskrav, håndteringsforbehold og traumespærringer) uden krav om manuel overlevering.
- **Explainable Allocation (Objektiv Ræsonnementforklaring):** Ved tvister eller forældreklager over tildelinger MUST systemet levere en objektiv og transparent begrundelsesrapport (f.eks. *"Toobi nåede sin max-grænse på 3 hold af hensyn til hestevelfærd jf. HC-01, og rytteren modtog sit 2. ønske jf. gældende turnusregler"*).

## Governance

Denne Constitution udgør det øverste styringsdokument for projektet og har forrang frem for alle øvrige specifikationer, procesmodeller, arkitekturskitser og prototyper.

### Compliance & Kvalitetsporte
- Alle specifikationer (`spec.md`), tekniske planer (`plan.md`), opgavelister (`tasks.md`) og implementeringer MUST verificeres mod de 5 kardinalprincipper, de hårde restriktioner (HC-01 til HC-08) og de arkitektoniske guardrails.
- Enhver foreslået funktionalitet, der bryder eller udvander dyrevelfærd, ryttersikkerhed eller revisionssikkerhed, er automatisk ugyldig.

### Stakeholder RACI Matrix

| Proces / Ansvarsområde | Malene (Ejer) | Ridelærere (Faste) | Vikarer | Staldelever | Forældre/Elever | Strandby Kommune | Dansk Rideforbund |
|---|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| Månedlig hestetildeling | Accountable | Responsible | - | Informed | Consulted | - | Informed |
| Sygemelding af hest | Accountable | Responsible | Responsible | Responsible | Informed | - | - |
| Fremmøderegistrering | Accountable | Responsible | Responsible | Informed | Informed | Informed | - |
| Hestevelfærdskontrol | Accountable | Responsible | Responsible | Informed | - | - | Informed |
| Kommunal indberetning | Responsible | Informed | - | - | - | Accountable | - |

### Ændringsprocedure & Versionsstyring
- Ændringer i denne Constitution forudsætter enstemmig konsensus i projektteamet samt forudgående afstemning med projektets rammer.
- Versionsnummeret følger Semantic Versioning (SemVer):
  - **MAJOR:** Ændringer eller ophævelse af kardinalprincipper eller hårde restriktioner (HC).
  - **MINOR:** Tilføjelse af nye principper, sektioner eller væsentligt udvidede domæneguardrails.
  - **PATCH:** Præciseringer, sproglige rettelser og ikke-semantiske tilretninger.

**Version**: 1.1.0 | **Ratified**: 2026-09-29 | **Last Amended**: 2026-10-04
