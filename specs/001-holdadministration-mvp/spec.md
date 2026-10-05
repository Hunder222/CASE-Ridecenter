# Feature Specification: Digital Holdadministration & Ressourcestyring (MVP)

**Feature Branch**: `001-holdadministration-mvp`

**Created**: 2026-10-05

**Status**: Draft

**Input**: User description: "/speckit-specify Projekt: Bøgegårdens Ridecenter - Digital Holdadministration & Ressourcestyring (MVP) ..."

## Clarifications

### Session 2026-10-05
- Q: Hvordan skal venteliste-elever automatisk adviseres og acceptere en ledig lektionsplads ved afbud inden kl. 12:00? (FR-013) → A: Kun internt ledelsesforslag på Malenes dashboard (Malene godkender/kontakter manuelt).
- Q: Hvordan skal tavs viden og pædagogiske/helbredsmæssige observationer formuleres og vises på holdets digitale 'Cheat Sheet' til ridelærere/vikarer for at overholde GDPR Art. 9? (FR-003, FR-012) → A: Standardiseret anonymiseret kode (f.eks. "OBS: Følsom/skånsom håndtering påkrævet - se instruks") med specifikke adfærdsnoter, men UDEN medicinske diagnoser.
- Q: Hvordan skal ridelærere og staldelever godkendes/logge ind på stald-tabletten, så afkrydsning forbliver under 15 sekunder samtidig med individuelt revisionsspor? (FR-004, FR-016) → A: PIN-kode / hurtig-login per profil (f.eks. 4-cifret kode per ridelærer) for hurtig staldadgang med audit-logging.
- Q: Hvad skal tildelingsmotoren gøre, hvis en elevs ønskede heste alle er fuldt bookede eller spærrede af hårde velfærdsregler? (FR-006, SC-02) → A: Systemet prioriterer automatisk en erstatningshest ud fra SC-01 til SC-05 og tildeler den med en tydelig markering på holdlisten.
- Q: Hvordan skal en vikar tildeles adgang til stald-tabletten ved akut, uvarslet lærersygdom om morgenen uden fysisk overlevering? (FR-012) → A: Malene opretter en vikarprofil med begrænset adgang og genererer en engangskode, som potentielle vikarer modtager på forhånd. Når en vikar-PIN indtastes på tabletten, afkræves vikarens navn. Koden er gyldig én gang på én vilkårlig dato, hvorefter Malene adviseres på sit dashboard om hvem der har trådt til, og kan udsende en ny engangskode. Sikrer vikaradgang uden permanent konto eller ledelsens fysiske tilstedeværelse.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Ridelærerens Hurtige Stald-Afkrydsning & Offline-Fremmøde (Priority: P1)

Som ridelærer i stalden (på mobil eller tablet, potentielt iført ridehandsker og i et miljø med støv, fugt og ustabil netforbindelse) vil jeg via et lynhurtigt 4-cifret PIN-login kunne hente dagens holdliste og registrere fremmøde for alle elever på under 15 sekunder, så jeg ikke mister værdifuld undervisningstid eller risikerer tab af data ved netudfald, samtidig med at hver registrering logges med min brugeridentitet.

**Why this priority**: Kerneforudsætning for staldens daglige afvikling og foreningens økonomiske eksistens. Uden revisionssikker fremmøderegistrering risikerer ridecenteret tab af kommunal aktivitetsstøtte fra Strandby Kommune. Samtidig har ridelæreren 0 minutters pause mellem holdene, hvorfor tidsbesparelse, hurtig PIN-godkendelse og offline-resiliens er absolut forretningskritiske.

**Independent Test**: Ridelæreren logger ind med sin 4-cifrede PIN på stald-tabletten offline (simuleret flytilstand), afkrydser et hold på 10 elever, markerer fravær, og systemet gemmer data lokalt uden forsinkelse (<15 sekunder) og synkroniserer automatisk og konfliktfrit med den centrale database, når netforbindelsen genetableres.

**Acceptance Scenarios**:

1. **Given** en ridelærer ved stald-tabletten, **When** den personlige 4-cifrede PIN tastes, **Then** låses staldfladen op på under 2 sekunder, og sessionen tilknyttes lærerens ID i revisionssporet.
2. **Given** et planlagt ridehold med 8-10 tilmeldte elever og hestetildelinger på stald-tabletten, **When** ridelæreren åbner holdet og klikker "Markér alle fremmødt" (eller batch-afkrydser), **Then** er hele holdets fremmødestatus registreret på under 15 sekunder med tidsstempel og ridelærerens bruger-ID.
3. **Given** at stald-tabletten mister netforbindelsen (offline), **When** ridelæreren gennemfører fremmøderegistrering eller foretager en ændring, **Then** lagres handlingen lokalt i tablettens offline-cache (HC-01/Offline-First) uden fejlmeddelelser eller blokering.
4. **Given** lokale registreringer foretaget offline, **When** tabletten genopretter netforbindelse, **Then** synkroniseres alle tidsstemplede hændelser automatisk til den centrale database med revisionsspor.
5. **Given** at en ridelærer efterfølgende retter en fremmøderegistrering, **Then** kræver systemet en obligatorisk begrundelse og logger ændringen i et uforanderligt audit trail (HC-06/HC-07).

---

### User Story 2 - Algoritmisk Månedlig Holdliste- & Hestetildeling (Kabalen) (Priority: P2)

Som ridecenterets ledelse (Malene) eller ridelærer vil jeg have et automatiseret system, der på få sekunder genererer den månedlige holdplan og tildeler heste til elever baseret på elevønsker, historisk turnus og strenge velfærds- og sikkerhedsregler, så fejlmatch undgås og tidsforbruget reduceres fra timer til minutter. Hvis alle en elevs ønskede heste er utilgængelige, tildeler algoritmen automatisk den bedst egnede erstatningshest og markerer tildelingen tydeligt med begrundelse.

**Why this priority**: Den manuelle kabalelægning tager i dag op til 2 timer per måned, skaber konflikter med forældre og medfører risiko for menneskelige fejl, hvor heste overbelastes eller elever tildeles heste, der er for store, for svære eller forbundet med faldtraumer.

**Independent Test**: Opret et datasæt med 28 ugentlige hold, 22 elevheste og 180 elever med registrerede ønsker og begrænsninger. Udløs tildelingsalgoritmen. Verificér at ingen hårde restriktioner (HC-01 til HC-08) overtrædes, at elever uden ledige ønskede heste tildeles en godkendt erstatningshest med markering, og at der genereres en objektiv ræsonnementforklaring (*Explainable Allocation*) for hver tildeling.

**Acceptance Scenarios**:

1. **Given** en liste af elevønsker (1., 2. og 3. ønske) og hesteprofiler med kapacitetsgrænser, **When** tildelingsmotoren køres for den kommende måned, **Then** genereres en komplet holdplan, hvor 0 heste overskrider dagsgrænser (max 3 lektioner for normale heste jf. HC-01; max 2 lektioner for senior-/skåneheste jf. HC-02) og alle heste har mindst 1 ugentlig hviledag (HC-03).
2. **Given** elever med fysiologiske grænser (f.eks. vægt/højde) eller specifikke traumer/angstdiagnoser (f.eks. Anna må kun have Donny; Emma må ikke have Pixie; Sofia må ikke have Aida), **When** kabalen beregnes, **Then** afviser systemet matematisk ethvert match, der bryder disse hårde restriktioner (HC-06, HC-07).
3. **Given** hold med springlektioner, **When** heste allokeres, **Then** tildeles heste med springforbud (*Bølle*, *Wally*, *Aida*) aldrig springhold, og ingen hest tildeles mere end max 1 springhold per uge (HC-05).
4. **Given** en elev hvis 1., 2. og 3. ønske alle er optaget eller spærret af velfærdsregler, **When** algoritmen tildeler hest, **Then** allokerer systemet automatisk den mest optimale alternative hest baseret på SC-01 til SC-05, markerer tildelingen som "Alternativ tildeling (ønsker optaget)" og forøger elevens turnus-prioritet til efterfølgende måned.
5. **Given** to elever der ønsker samme populære hest, **When** algoritmen tildeler hesten, **Then** vægter den historisk turnus (SC-02), så den elev, der i foregående måned fik sit 2./3. ønske eller alternativ tildeling, prioriteres først, og systemet genererer en objektiv begrundelse for valget.

---

### User Story 3 - Akut Hesteomplacering & Sikker Vikar-overlevering (Priority: P3)

Som ridelærer eller tilkaldt vikar i stalden vil jeg ved akut opstået hestesygdom, halthed eller lærersygdom øjeblikkeligt kunne hente top-3 godkendte erstatningsheste for en elev samt tilgå et digitalt sikkerheds-Cheat Sheet for holdet med standardiserede adfærdsinstrukser (helt uden medicinske diagnoser jf. GDPR Art. 9). Ved uvarslet lærersygdom kan vikaren låse tabletten op med en forududstedt engangs-PIN og indtaste sit navn uden at Malene behøver være fysisk til stede.

**Why this priority**: Ved uforudsete hændelser (f.eks. hest er halt 30 min. før lektion, eller fast lærer er syg med 0 minutters overlevering) opstår der akut sikkerhedsrisiko for børnene og risiko for overbelastning af tilfældige heste, hvis viden kun eksisterer i hovedet på fraværende personale.

**Independent Test**: Tast en vikar-engangskode på stald-tabletten, angiv vikarnavn. Bekræft at vikaren modtager adgang til dagens hold og holdets Cheat Sheet (med GDPR-anonymiserede sikkerhedskoder). Markér en tildelt hest som "Sygemeldt/Halt" 20 minutter før lektionsstart. Bekræft at systemet på under 2 sekunder præsenterer top-3 erstatningsheste, der overholder alle hårde restriktioner for den pågældende elev.

**Acceptance Scenarios**:

1. **Given** uvarslet lærersygdom og en tilkaldt vikar, **When** vikaren indtaster den forududleverede vikar-engangskode på stald-tabletten, **Then** afkræver systemet vikarens fulde navn, logger vikarens identitet i audit-sporet, låser op for dagens hold og spærrer koden for genbrug.
2. **Given** at en vikar logger ind med engangskode, **When** sessionen aktiveres, **Then** modtager Malene en automatisk advisering på sit dashboard om at vikaren er trådt til, med en påmindelse om at generere en ny vikar-engangskode til beredskabet.
3. **Given** en hest der meldes halt eller skadet af en staldelev eller ridelærer, **When** hestens status sættes til "Sygemeldt", **Then** udelukkes hesten øjeblikkeligt fra alle fremtidige lektioner (HC-04), og berørte hold markeres med en advarsel.
4. **Given** en elev hvis hest er blevet sygemeldt, **When** ridelæreren anmoder om erstatning, **Then** genererer systemet på under 2 sekunder en prioriteret liste over op til 3 godkendte erstatningsheste, som er ledige på tidspunktet og matcher elevens niveau, vægt og traumespærringer.
5. **Given** ridelæreren vælger en af de foreslåede afløserheste, **When** der klikkes "Godkend omplacering", **Then** opdateres holdlisten i realtid på tværs af alle enheder, og dagsbelastningen på den nye hest opdateres.
6. **Given** en lærer eller vikar der åbner holdets digitale visning, **When** holdets Cheat Sheet åbnes, **Then** vises standardiserede, handlingsorienterede sikkerhedsinstrukser (f.eks. "OBS: Følsom/skånsom håndtering påkrævet - trækkes op i ro", "Hold 3 meters afstand til andre heste") uden medicinske diagnosebetegnelser eller følsomme privatoplysninger.

---

### User Story 4 - Fraværshåndtering, Ventelistestyring & Ledelsesoverblik (Priority: P4)

Som ridecenterleder (Malene) vil jeg have et samlet ledelsesdashboard med overblik over holdbelægning, hestebelastning og fravær, samt et fraværsflow, hvor registrerede afbud inden kl. 12:00 danner et kvalificeret genbesættelsesforslag på mit dashboard, så jeg med få klik kan godkende og manuelt kontakte den rette elev fra ventelisten.

**Why this priority**: Sikrer stabil indtægt, minimerer spildte lektionspladser og giver ledelsen fuld kontrol over ventelistekontakt og relationen til forældre, uden unødigt manuelt koordineringsarbejde.

**Independent Test**: Registrér et elevafbud før deadline (kl. 12:00 på lektionsdagen). Verificér at systemet frigør hestens dagsbelastning, præsenterer et prioriteret ventelisteforslag på Malenes dashboard, og at ledelsesdashboardet opdaterer nøgletal for kapacitetsudnyttelse og hestevelfærd i realtid.

**Acceptance Scenarios**:

1. **Given** en elev der melder afbud til dagens undervisning inden kl. 12:00, **When** afbuddet registreres, **Then** opdateres holdets fremmødevisning, og hestens planlagte dagsbelastning reduceres tilsvarende.
2. **Given** et afbud meldt inden kl. 12:00 på et hold med venteliste, **When** ledelsesdashboardet indlæses, **Then** præsenterer systemet et internt genbesættelsesforslag med den øverste kvalificerede ventelisteelev (inkl. telefonnummer/kontaktinfo), som Malene kan godkende efter manuel kontakt.
3. **Given** et afbud meldt efter kl. 12:00, **When** afbuddet registreres, **Then** markeres det som "Sent afbud", hestens dagsbelastning reduceres, men der genereres intet akut genbesættelsesforslag.
4. **Given** at en elev opsiger sin plads, **When** opsigelsen tastes i systemet, **Then** håndhæves forretningsreglen om opsigelsesvarsel på løbende måned + 30 dage, og pladsen planlægges automatisk til genbesættelse derefter.
5. **Given** ledelsens Web-Admin Dashboard, **When** Malene åbner oversigten, **Then** præsenteres realtids-nøgletal over ugentlig holdudnyttelse (procent), hesteflådens belastningsfordeling, sygemeldte heste, aktive vikar-engangskoder og advarsler om gentaget elevfravær.
6. **Given** anmodning om dokumentation fra Strandby Kommune, **When** Malene vælger en rapporteringsperiode og klikker "Generer kommunal tilsynsrapport", **Then** produceres et verificerbart, revisionssikkert udtræk over tilskudsberettiget elevfremmøde med ét klik.

---

### Edge Cases

- **Flere heste sygemeldes samtidigt på samme lektion:** Hvis flere heste bliver syge, og der ikke findes tilstrækkeligt mange godkendte erstatningsheste, der overholder HC-01 til HC-08, skal systemet advare ridelæreren om kapacitetsmangel og tillade manuel aflysning eller sammensætning af lektionen frem for at foreslå ulovlige heste.
- **Offline synkroniseringskonflikt ved ændringer i stalden:** Hvis to enheder offline ændrer status på samme hest eller elev, vinder den seneste tidsstemplede hændelse (Last-Write-Wins på feltniveau), mens en konfliktmarkering logges i systemets revisionsspor til ledelsens gennemsyn.
- **Elevafbud meldt efter tidsfristen kl. 12:00:** Afbud registreret efter kl. 12:00 registreres som "Sent afbud", hestens belastning justeres, men der udløses ikke akut genbesættelsesforslag på Malenes dashboard for at undgå administrativ forvirring og uforberedte fremmøder i stalden.
- **En hest når sin absolutte dagsgrænse (3 lektioner / 2 for skåne):** Systemet blokerer hårdt for enhver yderligere lektion; ridelæreren kan ikke overstyre reglen uden eksplicit ledelsesgodkendelse logget i audit-sporet.
- **Rytterens vægt overstiger hestens kapacitet ved akut erstatning:** Systemet må under ingen omstændigheder medtage heste, hvor ryttervægt overstiger bæreevne (f.eks. lette ponyer som Wally eller Missy til tunge ryttere), selvom hesten er ledig.
- **Vikar glemmer eller mister engangs-PIN:** Hvis en vikar mangler sin engangskode, kan Malene via sit Web-Admin Dashboard øjeblikkeligt generere en ny kode eller fjernaktivere sessionen.

---

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Systemet SKAL indeholde et digitalt stamdatakartotek over heste med registrering af stangmål/højde, maksimal bæreevne (vægt), temperament, skåne-/seniorstatus, maksimal dags- og ugebelastning, springforbud samt sundhedsstatus (aktiv/sygemeldt).
- **FR-002**: Systemet SKAL indeholde et digitalt stamdatakartotek over elever med erfaringsniveau, højde, vægt, kontaktinformation, faste partaftaler samt tavs viden/sikkerhedsbemærkninger (herunder faldtraumer, angstkoder og specifikke hestespærringer).
- **FR-003**: Systemet SKAL beskytte personfølsomme oplysninger og pædagogiske observationer (GDPR Art. 9) via rollebaseret adgangskontrol (RBAC) og anonymiserede handlingskoder, så medicinske diagnoser aldrig optræder i staldvisninger, og så forældre og uvedkommende aldrig kan tilgå interne noter eller andre elevers data.
- **FR-004**: Systemet SKAL stille en touch-optimeret staldflade til rådighed for tablets og smartphones med 4-cifret personligt PIN-login, hvor batch-afkrydsning af et helt hold (op til 10 ryttere) kan gennemføres på under 15 sekunder.
- **FR-005**: Systemet SKAL understøtte offline-resiliens (Offline-First arkitektur) på stald-tabletten, så PIN-godkendelse, fremmøderegistrering og visning af holdlister fungerer uafbrudt ved netudfald og automatisk synkroniserer data, når forbindelsen genetableres.
- **FR-006**: Systemet SKAL implementere en constraint-baseret tildelingsmotor, der automatisk beregner den månedlige holdfordeling og hestetildeling ud fra de hårde restriktioner HC-01 til HC-08 samt de bløde optimeringsmål SC-01 til SC-05. Hvis en elevs registrerede ønsker alle er optaget eller spærret af velfærdsregler, SKAL systemet automatisk tildele en godkendt alternativ erstatningshest og markere tildelingen tydeligt.
- **FR-007**: Tildelingsmotoren SKAL forhindre, at normale heste tildeles mere end max 3 lektioner/dag (HC-01), at skåne-/seniorheste tildeles mere end max 2 lektioner/dag (HC-02), og at nogen hest går uden mindst 1 ugentlig hviledag (HC-03).
- **FR-008**: Tildelingsmotoren SKAL forhindre, at heste med springforbud (*Bølle*, *Wally*, *Aida*) tildeles springhold, og sikre at ingen hest tildeles mere end højst 1 springhold per uge (HC-05).
- **FR-009**: Tildelingsmotoren SKAL validere fysisk match (rytterens højde og vægt mod hestens bæreevne jf. HC-06) samt håndhæve absolutte traume- og diagnosespærringer (HC-07, f.eks. Anna kun Donny; Emma aldrig Pixie; Sofia aldrig Aida).
- **FR-010**: Tildelingsmotoren SKAL levere en objektiv ræsonnementforklaring (*Explainable Allocation*) for hver genereret hestetildeling med henvisning til opfyldte ønsker, turnusregler eller velfærdsrestriktioner.
- **FR-011**: Systemet SKAL ved sygemelding af en hest på under 2 sekunder generere top-3 godkendte erstatningsheste (*3-trins Replacement*), der overholder alle hårde restriktioner for den pågældende rytter.
- **FR-012**: Systemet SKAL stille et digitalt "Cheat Sheet" til rådighed for faste lærere og vikarer med anonymiserede, standardiserede håndteringsinstrukser (f.eks. "OBS: Skånsom håndtering påkrævet") uden medicinske diagnoser.
- **FR-013**: Systemet SKAL understøtte vikar-beredskabsadgang via forududstedte engangskoder. Ved indtastning af vikar-PIN SKAL systemet afkræve vikarens fulde navn, tildele tidsbegrænset dagsadgang til staldvisningen, invalidere koden og advisere Malene på ledelsesdashboardet.
- **FR-014**: Systemet SKAL ved registrering af elevafbud inden kl. 12:00 på undervisningsdagen (HC-04) frigøre hestens dagsbelastning og generere et internt genbesættelsesforslag på Malenes dashboard med den øverste kvalificerede elev fra ventelisten.
- **FR-015**: Systemet SKAL håndhæve opsigelsesvarsel på løbende måned + 30 dage og automatisk klargøre pladsen til genbesættelse ved varslets udløb.
- **FR-016**: Systemet SKAL give ledelsen (Malene) et Web-Admin Dashboard med realtidsnøgletal for holdudnyttelse, hestebelastning, sygemeldinger, aktive vikar-engangskoder og advarsler om gentaget elevfravær.
- **FR-017**: Systemet SKAL opretholde et uforanderligt, revisionssikkert audit-spor over al fremmøderegistrering, vikar-logins og manuelle efterkorrektioner med tidsstempel, bruger-ID/navn og begrundelse.
- **FR-018**: Systemet SKAL kunne generere standardiserede, verificerbare dataudtræk og tilsynsrapporter til Strandby Kommune over tilskudsberettiget fremmøde med ét klik.

### Key Entities *(include if feature involves data)*

- **Hest (Horse)**: Repræsenterer ridecenterets elevheste. Vigtige attributter: id, navn, højde/stangmål, max bærevægt (kg), temperament/niveau, skåne-status (boolean), max lektioner/dag (standard 3, skåne 2), max springlektioner/uge (0 eller 1), ugentlig hviledag (ugedag), sundhedsstatus (Aktiv, Sygemeldt, Skadet, Karantæne).
- **Rytter / Elev (Rider/Student)**: Repræsenterer tilmeldte elever. Vigtige attributter: id, fornavn, efternavn, fødselsdato (tilskudskriterium), højde, vægt, erfaringsniveau (begynder, letøvet, øvet), kontaktperson, partaftale_hest_id, aktiv_status (Aktiv, Pauseret, Opsagt m. dato).
- **Tavs Viden & Sikkerhedsprofil (Special Safety Profile)**: Fortrolige data tilknyttet rytteren. Attributter: rytter_id, faldtraumer, angstkategori, standard_adfaerdsinstruks (anonymiseret tekst til Cheat Sheet uden diagnose), forbudte_heste (liste af heste-id'er), påkrævede_heste (liste af heste-id'er). Beskyttet under GDPR Art. 9.
- **Bruger / Personale (User/Staff)**: Repræsenterer ridelærere, ledelse og vikarer. Attributter: id, navn, rolle (Ledelse, Ridelærer, Vikar, Staldelev), pinkode_hash, aktiv_status.
- **Vikar Engangskode (Substitute Access Token)**: Beredskabskoder til vikaradgang. Attributter: id, engangskode_hash, udstedt_dato, udloebsdato, anvendt_dato, anvendt_af_vikarnavn, status (Aktiv, Anvendt, Udløbet).
- **Hold (Lesson/Class)**: Repræsenterer de ugentlige ridehold (ca. 28 hold). Vigtige attributter: id, holdnavn, lektionstype (dressur, spring, begynder, handicap/skåne), ugedag, starttidspunkt, varighed, max_kapacitet (typisk 8-10 elever), tildelt_ridelærer_id.
- **Holdtilmelding & Tildeling (Lesson Assignment)**: Forbindelsen mellem elev, hold og hest. Attributter: id, hold_id, rytter_id, hest_id, gyldig_fra, gyldig_til, tildelingsbegrundelse (Explainable Allocation string), turnus_score, er_alternativ_tildeling (boolean).
- **Elevønske (Rider Preference)**: Månedlige hesteønsker indsamlet fra eleven. Attributter: rytter_id, måned_år, prioritet (1, 2 eller 3), ønsket_hest_id.
- **Fremmøderegistrering & Audit Log (Attendance Record)**: Uforanderlig log over lektionsafvikling. Attributter: id, lektion_dato, hold_id, rytter_id, hest_id (faktisk redet), status (Fremmødt, Afbud_rettidigt, Afbud_for_sent, Udeblevet), registreret_af_bruger_id, registreret_af_navn, registreret_tidspunkt, korrektions_begrundelse.
- **Venteliste (Waitlist Entry)**: Elever opskrevet til specifikke hold eller niveauer. Attributter: id, rytter_id, ønsket_hold_id/niveau, tilmeldingsdato, status (Aktiv, Forslag_genereret, Optaget, Afslået).

---

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Registrering af fremmøde for et helt hold (op til 10 ryttere) på stald-tablet kan gennemføres på under 15 sekunder af ridelæreren efter hurtigt 4-cifret PIN-login.
- **SC-002**: 0 utilsigtede overtrædelser af hestevelfærdsgrænser (HC-01 dagsmaksimum, HC-02 skånestatus, HC-03 hviledage, HC-05 springbegrænsninger).
- **SC-003**: 0 fejlplaceringer af ryttere på heste i strid med absolutte traumespærringer (HC-07) eller fysiologiske vægtgrænser (HC-06).
- **SC-004**: Generering af den månedlige hold- og hestekabale for 180 elever og 28 ugentlige hold tager under 30 sekunder ved kørsel af algoritmen (mod 1-2 timers manuelt arbejde i dag).
- **SC-005**: Ved sygemelding af en hest genererer systemet top-3 godkendte erstatningsheste på under 2 sekunder.
- **SC-006**: 100% af alle afbud meldt inden kl. 12:00 danner automatisk et kvalificeret genbesættelsesforslag på Malenes ledelsesdashboard inden for 5 sekunder efter registrering.
- **SC-007**: 100% af vikar-overtagelser ved uvarslet lærersygdom kan gennemføres via forududstedt engangskode uden Malenes fysiske tilstedeværelse og med 0 minutters mundtlig overlevering.
- **SC-008**: 100% eliminering af fysiske papirafkrydsningsark og afhængighed af whiteboards i stalden til lektionsafvikling.
- **SC-009**: Generering af en komplet, verificerbar tilsynsrapport over elevfremmøde til Strandby Kommune kan gennemføres med et enkelt klik på under 5 sekunder.

---

## Assumptions

- **Brugerflade & Udstyr i Stald**: Ridelærere og staldelever har adgang til mindst én robust tablet eller smartphone i stalden med berøringsfølsom skærm egnet til staldmiljøet.
- **Netværksforhold**: Da ridecenteret ligger i et landområde med periodiske netudfald, antages det, at applikationen skal køre som en PWA eller app med lokal caching (IndexedDB/SQLite) for fuld offline-funktionalitet.
- **Dataindtastning af Elevønsker (MVP)**: Jf. den ratificerede `feature_prioritization.md` og `constitution.md` indsamles månedlige ønsker i MVP-fasen af ridelæreren i stalden og indtastes i systemet (F1.1), mens fuld ekstern selvbetjening for forældre (F1.5/F1.6) er klassificeret som lav prioritet / deprioriteret i kernescope.
- **Ventelistekontakt**: Ledelsen (Malene) foretrækker personlig opfølgning med forældre; systemet leverer derfor optimerede forslag og kontaktoplysninger direkte på dashboardet frem for fuldautomatisk ekstern SMS-udsendelse.
- **Rolle- og Adgangskontrol**: Systemet differentierer mellem 4 primære brugerroller: Ledelse (fuld adgang), Ridelærer (staldadgang, holdlister, hestetjek, hestebyt), Vikar (engangs-PIN med begrænset holdadgang og sikkerheds-Cheat Sheet) og Staldelev (begrænset adgang til hestestatusmeldinger).
- **Kommunal Dokumentation**: Strandby Kommunes krav til dokumentation for aktivitetsstøtte overholdes ved lagring af elevens CPR/fødselsdato, bopælskommune samt dato- og tidsstemplet fremmøde.
