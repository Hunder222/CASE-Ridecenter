# TO-BE Procesdokumentation: Holdadministration & Hestetildeling

Dette dokument ledsager den nye BPMN 2.0-model [`TO-BE_Holdadministration.bpmn`](file:///c:/Users/Hunte/Documents/EK/EK-Kode/3.%20semester/Tv%C3%A6rfagligt/CASE-Ridecenter/_resources/team/TO-BE_Holdadministration.bpmn) og redegør for forbedringerne i forhold til den oprindelige [`AS-IS_Holdadministration.bpmn`](file:///c:/Users/Hunte/Documents/EK/EK-Kode/3.%20semester/Tv%C3%A6rfagligt/CASE-Ridecenter/_resources/team/AS-IS_Holdadministration.bpmn), med direkte reference til projektets [`constitution.md`](file:///c:/Users/Hunte/Documents/EK/EK-Kode/3.%20semester/Tv%C3%A6rfagligt/CASE-Ridecenter/.specify/memory/constitution.md) og [`feature_prioritization.md`](file:///c:/Users/Hunte/Documents/EK/EK-Kode/3.%20semester/Tv%C3%A6rfagligt/CASE-Ridecenter/_resources/team/feature_prioritization.md).

---

## 1. Sammenligning: AS-IS vs. TO-BE

| Procesfase | AS-IS (Manuel proces & spild) | TO-BE (Digitaliseret med fagsystemet) | Realiserede Features & Gevinster |
|---|---|---|---|
| **Fase 1: Månedlig kabale** | • Sedler og SMS'er samles manuelt.<br>• Kontortjek mod ventelister og betalinger gøres manuelt.<br>• Kabalen lægges i hovedet under hensyntagen til tavs viden.<br>• Forældrekonflikter ved manglende 1. ønsker.<br>• Fysisk print af A4-ark og opdatering af whiteboard. | • Ridelærer taster ønsker direkte ind.<br>• Algoritmisk løsning af kabalen (Constraint Satisfaction med HC-01 til HC-08 og SC-01 til SC-05).<br>• Lærer godkender forslag med indbygget objektiv forklaring (*Explainable Allocation*).<br>• Holdlister distribueres øjeblikkeligt digitalt til stald-tablets. | • **F1.1** Elevønsker i database.<br>• **F1.2** GDPR-sikret tavs viden.<br>• **F1.3** Hestedatabase (adfærd, max-timer, springforbud).<br>• **F1.4** Algoritmisk holdlistegenerering.<br>• Fjerner overbearbejdning og printspild. |
| **Fase 2: Før undervisning (30 min før)** | • Papirlister i plastlomme forældes ved sygemelding.<br>• Staldelever melder sygdom mundtligt.<br>• Paniksøgning efter erstatningshest i stalden.<br>• Mundtlig vikaroverlevering (0 min. pause) med risiko for tab af viden om angst og skånehensyn. | • Staldelever registrerer helbred og adfærd direkte på tablet.<br>• Ved syg hest beregner systemet top-3 godkendte erstatningsheste på <2 sekunder (*3-trins Replacement*).<br>• Ridelærer godkender med 1 klik.<br>• Vikar tilgår digitalt *Cheat Sheet* med vigtige sikkerhedsnoter. | • **F2.1** Staldelevers statusmeldinger.<br>• **F2.2** Akut heste-omplacering via algoritme.<br>• **F2.3** Vikardækning med digital adgang.<br>• Eliminerer kognitiv overbelastning og ventetid. |
| **Fase 3: Undervisning, Fremmøde & Ledelse** | • Papirafkrydsning glemmes pga. tidspres og snavsede hænder.<br>• Lister efterlades blanke i ringbind.<br>• **Kritisk risiko (Error):** Udokumenteret fremmøde medfører fare for tab af kommunalt tilskud.<br>• Manuel opdatering af elevstatus på privat PC ved fravær.<br>• Tilsynsrapporter tager timer/dage at samle. | • Digital batch-afkrydsning på stald-tablet (<15 sek., offline-first UX).<br>• Automatisk registrering med revisionsspor og tidsstempel.<br>• **Malenes Web-Admin Dashboard:** Fraværende elever flages automatisk; Malene kan med få klik justere ventelister og kontingent.<br>• **Separat 1-Klik Tilsynsrapport (Ad-hoc Start Event):** Udløst af kommunalt tilsyn eller månedsslutning kan Malene trække rapporten øjeblikkeligt, uafhængigt af den enkelte ridelektions gang. | • **F3.1** Digital fremmøderegistrering.<br>• Fjerner fejlrisiko og sikrer kommunal compliance.<br>• Fuld revisionssikkerhed og hestevelfærdsdokumentation.<br>• Malene sparer administrativ tid og har konstant overblik. |

---

## 2. Arkitektoniske Hovedpunkter i TO-BE

1. **Single Source of Truth (SSoT) & Fase-opdelte DataStore-referencer:**
   - Papirlister, private sedler og whiteboards er erstattet af den centrale relationelle database.
   - Både ledelse (Malene), ridelærere, vikarer og staldelever arbejder på det samme opdaterede datagrundlag i realtid.
   - **BPMN Best Practice (Multiple Data Store References):** For at eliminere forstyrrende, lange krydsende datalinjer på tværs af diagrammet, er den centrale database repræsenteret lokalt i hver af de tre faser (`DataStoreRef_RidecenterDB_F1`, `_F2` og `_F3`). De repræsenterer alle den samme underliggende SSoT-database:
     - **Fase 1 Database:** Modtager ønsker (`PROC-01`), fodrer kabale-algoritmen (`PROC-04`) og leverer data til holdlistepubliceringen (`PROC-06` $\rightarrow$ `DataObjectRef_DigitalHoldliste`).
     - **Fase 2 Database:** Modtager helbredsstatus fra staldelever (`Indberet hestehelbred`) og forsyner vikarer med sikkerhedsnoter via *Cheat Sheet* (`PROC-09`).
     - **Fase 3 Database:** Modtager lynhurtig fremmøderegistrering (`PROC-12`), opdaterer ventelister (`Malene`) og danner 1-klik revisionsrapporter til Strandby Kommune (`PROC Kommune rapport`).
2. **Malenes Rolle & Web-Admin Dashboard (Ledelse og Kontor):**
   - Malenes opgaver er opdelt metodisk i BPMN-modellen:
     1. **Automatisk fraværsopfølgning:** Hvis en elev udebliver gentagne gange, markerer systemet fraværet på Malenes dashboard (`Activity_AutoFravaersnotifikation`). Malene følger op og opdaterer ventelisten med få klik (`Activity_MaleneVentelisteHurtig`).
     2. **Ad-hoc Kommunal Rapportering (`StartEvent_KommuneTilsyn`):** Modellen indeholder nu en separat Message Start Event i ledelses-lanen, der aktiveres, når Strandby Kommune varsler tilsyn eller anmoder om tilskudsdokumentation. Fordi databasen løbende opdateres i baggrunden under hver lektion, kan Malene med ét klik generere og afsende en 100% revisionssikker rapport (`Activity_GenererKommuneRapport`).
3. **Lean MUDA-Eliminering:**
   - **Defects:** Udokumenteret fremmøde og blanke lister er elimineret ved hurtig, touch-optimeret afkrydsning.
   - **Overprocessing:** Manuel kabalelægning og krydstjek mod kontorlister er fuldautomatiseret af valideringsmotoren.
   - **Waiting:** Vikarer og staldelever har øjeblikkelig adgang til holdlister og sikkerhedsinstrukser.
4. **Kommunal Compliance & Hestevelfærd:**
   - Hestens max-belastninger overholdes matematisk (HC-01 til HC-05).
   - Strandby Kommune modtager verificerbare, automatiserede udtræk af tilskudsberettiget fremmøde.
