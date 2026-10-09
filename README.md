# Bøgegårdens Ridecenter - Digital Holdadministration & Ressourcestyring (MVP)

Pilotprojekt for **Dansk Rideforbund** med **Bøgegårdens Ridecenter** i Strandby som pilotvirksomhed.  
Projektet udvikles som et tværfagligt IT-arkitektur- og softwareudviklingsprojekt (3. semester).

---

## 📌 1. Kontekst & Problemstilling

Bøgegårdens Ridecenter administrerer ca. 180 elever, 22 elevheste og 28 ugentlige hold. Driften har hidtil været baseret på manuelle sedler, hvide tavler (whiteboards), fysiske plastlommer i stalden og personlige regneark hos ledelsen (Malene).

Dette har medført en række kritiske forretningsmæssige og driftsmæssige udfordringer:
1. **Hestens velfærd og overbelastning:** 
    Manuel planlægning medfører risiko for, at heste overskrider deres maksimale dags- og ugebelastning, eller at heste med springforbud/skånebehov tildeles uhensigtsmæssige hold.
2. **Ryttersikkerhed og fejlmatch:** 
    Udfordringer med at matche elever og heste ud fra højde, vægt og erfaringsniveau samt fare for at overse tavs viden om rideangst, diagnoser og traumer (f.eks. efter faldulykker).
3. **Manuelt administrativt tidsspild (Kabalelægning):** 
    Ledelsen bruger op til 2 timer hver måned på manuelt at fordele elevønsker på heste i hovedet og på papir.
4. **Staldmiljø under tidspres:** 
    Ridelærerne har 0 minutters pause mellem holdene. Papirafkrydsning glemmes, lister efterlades blanke, og ved akut lærersygdom mangler tilkaldte vikarer hurtig adgang til kritiske sikkerhedsinstrukser.
5. **Kommunal compliance og økonomisk risiko:** 
    Ridecenteret modtager aktivitetsstøtte fra Strandby Kommune. Mangelfuld eller manglende dokumentation for elevfremmøde skaber direkte risiko for tilbagebetalingskrav og tab af godkendelse.

---

## 🎯 2. Formål & Kernefokus

Formålet med projektet er at etablere en samlet, digital holdadministrations- og ressourcestyringsløsning (MVP), der binder **ledelsen (Malene)**, **ridelærerne i stalden**, **vikarer** og **staldelever** sammen i et synkront flow.

Løsningens absolutte omdrejningspunkt er at erstatte whiteboards og papir med en **Single Source of Truth (SSoT)** database, der automatiserer holdfordelingen via en intelligent tildelingsalgoritme (*Constraint Satisfaction*), sikrer lynhurtig offline-fremmøderegistrering i stalden og beskytter hestevelfærd og personfølsomme oplysninger.

---

## ⚙️ 3. Løsningsarkitektur & Hovedfunktioner

Systemet er opdelt i tre operationelle faser i overensstemmelse med projektets procesmodel [`_resources/team/TO-BE_Holdadministration.bpmn`]:

### Fase 1: Månedlig proces – Oprettelse af holdlister & Hestekabale
* **Digitalt stamdata-kartotek (F1.1 & F1.3):** Komplet overblik over heste (bæreevne, stangmål, temperament, skånestatus, max-timer, springforbud) og elever (niveau, vægt, kontaktinfo, partaftaler).
* **GDPR-sikret tavs viden (F1.2):** Håndtering af traumer og adfærdsinstrukser adskilt fra administrative stamdata under hensyntagen til GDPR Art. 9.
* **Algoritmisk tildelingsmotor (F1.4):** Automatisk løsning af månedskabalen, hvor matematiske velfærds- og sikkerhedsregler håndhæves forud for elevønsker, ledsaget af en objektiv begrundelse (*Explainable Allocation*).

### Fase 2: Proces før og under undervisning – Driftsberedskab & Vikardækning
* **Staldelevers statusmeldinger (F2.1):** Løbende registrering af hestes helbred og adfærd direkte fra stalden.
* **Akut hesteomplacering (F2.2):** Ved sygemelding af en hest beregner algoritmen top-3 godkendte erstatningsheste på under 2 sekunder (*3-trins Replacement*), som læreren kan godkende med ét klik.
* **Vikar-beredskab & Digitalt Cheat Sheet (F2.3):** Hurtig vikaradgang via forududstedte engangskoder (uden krav om fysisk overlevering) samt et kompakt sikkerheds-*Cheat Sheet* med anonymiserede instrukser (uden medicinske diagnoser).

### Fase 3: Afvikling af undervisning & Ledelsesoverblik
* **Touch-optimeret fremmøderegistrering (F3.1):** Lynhurtig batch-afkrydsning af et helt hold på under 15 sekunder på mobil/tablet med 4-cifret personligt PIN-login og fuld **offline-first resiliens**.
* **Ledelsesdashboard (Malene):** Realtidsoverblik over kapacitetsudnyttelse, hesteflådens belastning, fraværsnotifikationer og interne ventelisteforslag ved afbud meldt inden kl. 12:00.
* **1-Klik Tilsynsrapport til Strandby Kommune:** Automatiseret generering af revisionssikre dataudtræk over tilskudsberettiget fremmøde.

---

## 🛡️ 4. Kardinalprincipper & Forretningsregler (Constitution)

Projektet styres strengt af forfatningen fastlagt i [`.specify/memory/constitution.md`]:

| Kardinalprincip | Regel & Betydning |
|---|---|
| **I. Hestevelfærd Først** | Max 3 lektioner/dag for normale heste (HC-01); max 2 for skåne-/seniorheste (HC-02); mindst 1 ugentlig hviledag (HC-03); syge heste spærres øjeblikkeligt (HC-04); max 1 springlektion/uge og forbud for *Bølle*, *Wally* og *Aida* (HC-05). |
| **II. Ryttersikkerhed & Fysiologisk Match** | Ryttervægt og -højde valideres mod hestens bæreevne (HC-06); ufravigelige traume- og diagnosespærringer håndhæves matematisk (f.eks. Anna må kun ride Donny; Emma må aldrig ride Pixie; Sofia må aldrig ride Aida) (HC-07). |
| **III. Revisionssikkerhed & Kommunal Compliance** | Uforanderligt revisionsspor (Audit Trail) med tidsstempler, bruger-PIN og obligatorisk begrundelse ved manuelle efterkorrektioner. |
| **IV. Dataetik & GDPR (Art. 9)** | Tavs viden og helbredsdata anonymiseres i staldvisninger til handlingsorienterede koder uden medicinske diagnoser. Streng rollebaseret adgangskontrol (RBAC). |
| **V. Single Source of Truth & Stald-UX** | Touch-brugerflade optimeret til fugt, støv og handsker. Afkrydsning på <15 sekunder. Offline-First arkitektur ved periodiske netudfald i landområdet. |

---

## 📐 5. Scope-Afgrænsning (MVP vs. Out of Scope)

I overensstemmelse med [`_resources/team/feature_prioritization.md`]:

### ✅ I Scope for MVP (P0 & P1)
- Digitalt stamdatakartotek for heste, ryttere og hold.
- Offline-resilient stald-tablet flade med hurtigt PIN-login og batch-afkrydsning.
- Constraint-baseret tildelingsmotor for den månedlige holdplan (Kabalen).
- Akut hesteomplacering (top-3 erstatninger) og vikaradgang via engangskoder.
- Fraværshåndtering (deadline kl. 12:00) med internt genbesættelsesforslag på dashboardet.
- Håndhævelse af opsigelsesvarsel (løbende måned + 30 dage).
- Malenes Web-Admin Dashboard og 1-klik kommunal tilsynsrapport.

### ❌ Udelukket fra MVP (Deprioriteret / Out of Scope)
- **F1.5 & F1.6:** Ekstern forældre-/elev-selvbetjeningsportal til direkte indsendelse af hesteønsker og afbud (ønsker indsamles af læreren; afbud modtages og tastes administrativt).
- **F1.7:** Stævnetilmelding og stævnestyring.
- **F1.8:** Privat opstaldning, facilitetsbooking (ridehus/baner) og foderstyring.
- Automatisk betalingsgateway (kun forberedt til eksport og afstemning).

---

## 🏆 6. Målbare Succeskriterier (Definition of Success)

- **Fremmødehastighed:** Registrering af fremmøde for et hold (10 elever) gennemføres på **under 15 sekunder**.
- **Hestevelfærd:** **0 utilsigtede overtrædelser** af dagsmaksimum, skånehensyn, springgrænser eller hviledage.
- **Sikkerhedsmatch:** **0 fejlplaceringer** i strid med absolutte traumespærringer eller fysiske vægtgrænser.
- **Kabaletid:** Generering af den månedlige holdplan reduceres fra **1-2 timer til under 30 sekunder**.
- **Akut erstatning:** Top-3 godkendte erstatningsheste beregnes på **under 2 sekunder**.
- **Papirløs stald:** **100% eliminering** af papirafkrydsningsark og afhængighed af whiteboards.
- **Revisionsudtræk:** Tilsynsrapport til Strandby Kommune genereres med **1 klik på under 5 sekunder**.

---

## 📂 7. Repository Struktur & Nøgledokumenter

```text
├── .specify/                         # Spec-Kit konfiguration & systemhukommelse
│   ├── memory/constitution.md        # Forfatning, kardinalprincipper & hårde restriktioner (HC)
│   ├── templates/                    # Skabeloner til specifikationer, planer og opgaver
│   └── feature.json                  # Reference til aktiv feature-gren
├── specs/                            # Formelle specifikationer og designkrav
│   └── 001-holdadministration-mvp/   # Aktiv MVP feature-specifikation
│       ├── spec.md                   # Formel kravspecifikation (Stories, FR, Entiteter, SC)
│       └── checklists/
│           └── requirements.md       # Verificeret kvalitets-tjekliste for krav
├── _resources/                       # Primære domænekilder og procesdokumentation
│   ├── team/                         # Teamets konsoliderede domæneanalyse (SSoT)
│   │   ├── feature_prioritization.md # Prioriteringsmatrix & faseopdeling (F1.1 - F3.1)
│   │   ├── capabilities.md           # Business capability mapping for roller
│   │   ├── TO-BE_Holdadministration_documentation.md # TO-BE procesforklaring & BPMN-reference
│   │   ├── TO-BE_Holdadministration.bpmn            # TO-BE procesmodel
│   │   ├── AS-IS_Holdadministration.bpmn            # Oprindelig manuel procesmodel
│   │   ├── SIPOC_Holdadministration.md              # SIPOC procesafgrænsning
│   │   └── interview_notes.md        # Empiriske interviewnoter med Malene
│   └── teacher/                      # Oprindeligt casemateriale og historiske data
└── README.md                         # Dette dokument
```

---

## 🚀 8. Kom i gang (Komplet POC: Fase 1 & Fase 2)

Systemet er nu en komplet fungerende Proof-of-Concept (POC), der omfatter:
- **Staldflade (PWA) under `/stald`:** Touch-optimeret til tablets, 4-cifret PIN-login, batch-fremmøde offline på under 10 sekunder, lektionsvisning og akut top-3 hesteerstatning.
- **Vikaradgang & Digitalt Cheat Sheet:** Hurtig vikar-adgang med 6-cifret engangskode uden kendskab til personfølsomme diagnoser (GDPR Art. 9).
- **Web-Admin under `/admin`:** Den automatiske hestekabale (mrv-greedy@1), live Welfare Guard uden override, venteliste-genbesættelse ved afbud før kl. 12:00, kapacitets-heatmaps og 1-klik kommunale tilsynsrapporter med kryptografisk hashkædeverifikation.

**Forudsætninger**: Node.js 24 og Docker Desktop (PostgreSQL 17).

```bash
npm install                                     # alle workspaces
cp .env.example .env                            # udfyld nøgler og adgangskoder
docker compose up -d db                         # PostgreSQL 17 (dev- og testdatabase)
npm run db:migrate                              # Prisma-migrationer inkl. append-only-triggere
npm run db:seed -- --scenarie=fredag --nulstil  # casens data inkl. PIN-koder og lektioner
npm run dev                                     # API på :3000 og web på :5173
```

### Adgang & Testbrugere
- **Web-Admin (`http://localhost:5173/admin`):**
  - **Malene (Ledelse):** `malene@demo.dk` (adgangskode fra `SEED_ADGANGSKODE` i `.env`)
  - **Marie (Ridelærer):** `marie@demo.dk`
- **Staldflade (`http://localhost:5173/stald`):**
  - **PIN-login:** Malene: `111111`, Marie: `222222`, Camilla: `222333`, Birgit: `222444`, Staldelev (Ella J.): `333333`
  - **Vikaradgang:** Vælg "Jeg er vikar" og brug en af de seedede 5-cifrede koder: `12345` (Sofie Fast vikar), `54321` eller `88899`.

### Kørsel på tablet over lokalt netværk / HTTPS
For at køre staldfladen på en fysisk iPad eller tablet på samme netværk:
- Start webapplikationen med host-eksponering eller brug en lokal HTTPS-proxy (f.eks. Caddy eller `mkcert`), da PWA og Service Worker kræver sikker kontekst.
- Åbn `https://<lokal-ip>:5173/stald` og tilføj til hjemmeskærmen for fuld PWA offline-oplevelse.

### Automatiseret bevisførelse og demo-værktøjer
```bash
npm test -w packages/domain       # 210 domænetests inkl. forfatningsscenarier F-01 – F-16
npm run test:property             # fast-check invariant-test af Welfare Guard (200 inputs)
npm run bench:kabale              # Månedskabale benchmark (180 ryttere / 29 hold / 22 heste): median 7,8 ms
npm run demo:tid                  # Virtuelt ur til simulering af kl. 12:00 afbudsfrist
npm run demo:manipuler            # Beviser append-only trigger afvisning og audit-hashkædetjek
npm run typecheck                 # 100% statisk typekontrol på tværs af hele monorepoet
```

Opgaver og opgavestatus: [specs/001-holdadministration-mvp/tasks.md](specs/001-holdadministration-mvp/tasks.md).  
Valideringsrapport for Fase 2: [specs/001-holdadministration-mvp/checklists/fase2-validering.md](specs/001-holdadministration-mvp/checklists/fase2-validering.md).