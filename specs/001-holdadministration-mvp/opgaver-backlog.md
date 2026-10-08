# Ridecenter MVP - Opgave Backlog

Dette dokument samler de specificerede forbedringer og opgaver til Stald-appen, Admin Dashboardet og datasimuleringen. Alle opgaver er nu implementeret og verificeret med typecheck og automatiserede tests.

---

## 1. Stald App (`/stald`)

### 1.1 Vikar Login UI (Tablet-venlig numpad, gen-oplåsning og notifikationer) [GENNEMFØRT]
* **Løsning:** 
  * Header med vikarnavn i toppen.
  * Stor, touch-venlig numpad (1-9, C, 0, ⌫) til indtastning af 6-cifret vikarkode.
  * Tydelige feedback-cirkler (`● ● ○ ○ ○ ○`) og stor "Lås op med vikarkode"-knap.
  * **Hurtig-valg af dagens vikar:** Hvis en vikar allerede er logget ind i dag, vises en hurtig-knap "Vælg mig" i toppen af loginfladen med vikarens navn. Ved klik låses navnefeltet med en hængelås (`🔒`), så vikaren straks kan indtaste koden uden risiko for stavefejl eller navneændringer.
  * **Sammedags gen-oplåsning:** API'et tillader samme vikar på samme enhed at genbruge sin kode inden for samme døgn (indtil 23:59), hvis sessionen udløber eller skærmen låses.
  * **Sikkerhedsnotifikationer på Admin Dashboard:** Ved forsøg på ugyldige koder eller genbrugsforsøg med et andet navn sendes en tydelig `⚠️ Sikkerhedsadvarsel` til Malenes notifikationsfane med det indtastede navn.
  * **Rollebegrænsning i Staldfladen:**
    * Fanerne **⭐ Elevønsker** og **🐎 Heste** skjules i topbaren for vikarer, og direkte navigationsforsøg omdirigeres automatisk tilbage til `/stald/i-dag`.
    * Datonavigationen ("Forrige program" / "Næste program") og knappen til **Månedskalender** skjules for vikarer på `/stald/i-dag`, så de låses til udelukkende at se og afvikle **dagens program**.
  * Filer: [`VikarSide.tsx`](file:///c:/Users/Hunte/Documents/EK/EK-Kode/3.%20semester/Tv%C3%A6rfagligt/CASE-Ridecenter/apps/web/src/stald/VikarSide.tsx), [`StaldLayout.tsx`](file:///c:/Users/Hunte/Documents/EK/EK-Kode/3.%20semester/Tv%C3%A6rfagligt/CASE-Ridecenter/apps/web/src/stald/StaldLayout.tsx), [`IDagSide.tsx`](file:///c:/Users/Hunte/Documents/EK/EK-Kode/3.%20semester/Tv%C3%A6rfagligt/CASE-Ridecenter/apps/web/src/stald/IDagSide.tsx), [`vikar-service.ts`](file:///c:/Users/Hunte/Documents/EK/EK-Kode/3.%20semester/Tv%C3%A6rfagligt/CASE-Ridecenter/apps/api/src/moduler/auth/vikar-service.ts), [`NotifikationerSide.tsx`](file:///c:/Users/Hunte/Documents/EK/EK-Kode/3.%20semester/Tv%C3%A6rfagligt/CASE-Ridecenter/apps/web/src/admin/notifikationer/NotifikationerSide.tsx)

### 1.2 Elevønsker Sync & Rydning [GENNEMFØRT]
* **Løsning:**
  * **FK Constraint fix:** I `sync-service.ts` faldt backend tidligere tilbage til `'00000000-0000-0000-0000-000000000000'`. Der er nu automatisk fallback til en aktiv bruger i databasen, så PostgreSQL-transaktionen ikke ruller tilbage med foreign key fejl.
  * **Rydning af ønsker:** Tilføjet `🗑️ Ryd alle ønsker` i bunden af modalen og `Ryd valg` i statuslinjen. Når ønsker ryddes, opdateres elevkortet straks i matrixen (skifter fra grøn til gul/mangler), og den ryddede tilstand persisteres og synkroniseres.
  * Filer: [`OenskerLektionSide.tsx`](file:///c:/Users/Hunte/Documents/EK/EK-Kode/3.%20semester/Tv%C3%A6rfagligt/CASE-Ridecenter/apps/web/src/stald/OenskerLektionSide.tsx), [`sync-service.ts`](file:///c:/Users/Hunte/Documents/EK/EK-Kode/3.%20semester/Tv%C3%A6rfagligt/CASE-Ridecenter/apps/api/src/moduler/sync/sync-service.ts)

### 1.3 "Heste" Siden - Sundheds- og Kapacitetsoverblik [GENNEMFØRT]
* **Løsning:**
  * I toppen af `/stald/heste`: Implementeret interaktiv KPI-overbliksbjælke.
  * Tæller for: **Alle heste**, **🟢 Raske & Aktive**, **🔴 Sygemeldte**, **🟠 Skadede / Obs**.
  * Hurtig filtrering ved klik på statuskortene.
  * Fil: [`HesteOversigtSide.tsx`](file:///c:/Users/Hunte/Documents/EK/EK-Kode/3.%20semester/Tv%C3%A6rfagligt/CASE-Ridecenter/apps/web/src/stald/HesteOversigtSide.tsx)

### 1.4 Datonavigation & Månedskalender Pop-up [GENNEMFØRT]
* **Placer fredagshold på fredag:** Onsdag viser "Ingen hold i dag" med genvej til næste program.
* **Smart navigation:** Knapperne navigerer med **"Forrige program"** og **"Næste program"**, så et klik automatisk springer frem/tilbage til den nærmeste dato med faktiske holdlektioner.
* **Månedskalender pop-up:** En modal med oversigt over hele måneden med holdindikatorer, månedsskift og ét-tryk datovalg.
* Filer: [`IDagSide.tsx`](file:///c:/Users/Hunte/Documents/EK/EK-Kode/3.%20semester/Tv%C3%A6rfagligt/CASE-Ridecenter/apps/web/src/stald/IDagSide.tsx), [`pull-service.ts`](file:///c:/Users/Hunte/Documents/EK/EK-Kode/3.%20semester/Tv%C3%A6rfagligt/CASE-Ridecenter/apps/api/src/moduler/sync/pull-service.ts)

---

## 2. Admin Dashboard (`/admin`)

### 2.1 Vikarkoder - Skjul/Vis med Øje-ikon [GENNEMFØRT]
* **Løsning:**
  * Koderne maskeres som udgangspunkt som `••••••`.
  * Et øje-ikon (`👁️` / `🙈`) tilføjet ud for hver kode i tabellen for at vise/skjule klartekstkoden on-demand.
  * Knap til hurtig kopiering (`📋` / `✓`) til udklipsholder.
  * Backend cacher udstedte koder og seed-koder i hukommelsen, og frontend cacher lokalt i `localStorage`.
  * Filer: [`VikarKoderSide.tsx`](file:///c:/Users/Hunte/Documents/EK/EK-Kode/3.%20semester/Tv%C3%A6rfagligt/CASE-Ridecenter/apps/web/src/admin/VikarKoderSide.tsx), [`vikar-service.ts`](file:///c:/Users/Hunte/Documents/EK/EK-Kode/3.%20semester/Tv%C3%A6rfagligt/CASE-Ridecenter/apps/api/src/moduler/auth/vikar-service.ts), [`stald.ts`](file:///c:/Users/Hunte/Documents/EK/EK-Kode/3.%20semester/Tv%C3%A6rfagligt/CASE-Ridecenter/packages/contracts/src/stald.ts)

### 2.2 Vikarkode Styling (Light Mode) [GENNEMFØRT]
* **Løsning:**
  * Vikarkode-siden styles fuldt ud i light mode svarende til resten af Admin Dashboardet (`bg-white`, `border-stone-300`, `text-stone-900`, `bg-stone-50`).
  * Fil: [`VikarKoderSide.tsx`](file:///c:/Users/Hunte/Documents/EK/EK-Kode/3.%20semester/Tv%C3%A6rfagligt/CASE-Ridecenter/apps/web/src/admin/VikarKoderSide.tsx)

### 2.3 Administrative Indtastningsmuligheder [GENNEMFØRT]
* **Løsning:**
  * **Elevønsker (`/admin/oensker/:maaned`):** Viser samtlige aktive elever grupperet med niveau og status (`3/3`, delvis, mangler). Administratorer kan indtaste ønsker for enhver elev, redigere dem, og benytte `🗑️ Ryd alle ønsker`.
  * **Hestesundhed & Noter (`/admin/heste`):** Administratorer kan ændre hestesundhed direkte fra tabellen via hurtig status-dropdown samt i redigeringsdialogen. Hurtig-KPI kort i toppen med filtrering. Staldnoter vises og kan redigeres.
  * **Elever og Hold (`/admin/ryttere`, `/admin/hold`):** Oprettelse og redigering af hold, tilmeldinger, sikkerhedsprofiler og stamdata.
  * Filer: [`OenskerSide.tsx`](file:///c:/Users/Hunte/Documents/EK/EK-Kode/3.%20semester/Tv%C3%A6rfagligt/CASE-Ridecenter/apps/web/src/admin/oensker/OenskerSide.tsx), [`HesteSide.tsx`](file:///c:/Users/Hunte/Documents/EK/EK-Kode/3.%20semester/Tv%C3%A6rfagligt/CASE-Ridecenter/apps/web/src/admin/heste/HesteSide.tsx), [`stamdata.ts`](file:///c:/Users/Hunte/Documents/EK/EK-Kode/3.%20semester/Tv%C3%A6rfagligt/CASE-Ridecenter/packages/contracts/src/stamdata.ts)

---

## 3. Komplet Holdplan & Demodata (Casebeskrivelse) [GENNEMFØRT]

### 3.1 Fuld Ugeplan (Mandag - Søndag)
* **Løsning:**
  * Standard seed-scenarie er sat til `'fuld'` (29 hold, 180 ryttere, 22 heste) baseret på `_resources/teacher/_case-01-Holdoversigt, uge.md`:
    * **Mandag (Malene):** Letøvet, Øvet, Letøvet, Letøvet
    * **Tirsdag (Malene):** Letøvet spring, Letøvet spring, Øvet spring, Øvet spring
    * **Onsdag (Camilla):** Begynder, Letøvet, Letøvet, Begynder
    * **Torsdag (Malene):** Letøvet, Letøvet, Øvet, Øvet
    * **Fredag (Marie):** Begynder, Letøvet, Øvet, Letøvet
    * **Lørdag (Marie):** Begynder, Trækhold x 4
    * **Søndag (Birgit):** Parthold, Trækhold x 3
  * Filer: [`index.ts`](file:///c:/Users/Hunte/Documents/EK/EK-Kode/3.%20semester/Tv%C3%A6rfagligt/CASE-Ridecenter/tools/seed/index.ts), [`fuld.ts`](file:///c:/Users/Hunte/Documents/EK/EK-Kode/3.%20semester/Tv%C3%A6rfagligt/CASE-Ridecenter/tools/seed/data/fuld.ts)

### 3.2 Simuleret Status Oktober vs. November
* **Oktober (`2026-10` - Nuværende måned):** Færdig, publiceret holdtildeling og oprettede lektioner på holdenes respektive ugedage med afkrydset fremmøde.
* **November (`2026-11` - Næste måned):** Ufærdig holdtildeling, hvor eleverne har afgivet ønsker, men kabalen er klar til at blive kørt, justeret og publiceret i Admin Dashboardet (`/admin/kabale/2026-11`).
* Fil: [`skriv-seed.ts`](file:///c:/Users/Hunte/Documents/EK/EK-Kode/3.%20semester/Tv%C3%A6rfagligt/CASE-Ridecenter/tools/seed/skriv-seed.ts)

---

## 4. Faste Vikarer & Strikte Vikar-Restriktioner (FR-013 / FR-024) [GENNEMFØRT]

### 4.1 Faste Vikarer & Valgfri Udløbsdato
* **Løsning:**
  * Ledelsen kan udstede navngivne vikarkoder og markere dem som "Fast vikar (Genanvendelig kode)".
  * Faste vikar-koder forvandles ikke til `Anvendt` eller låses efter 1 dags brug, men forbliver `Aktiv` og kan genbruges frit på faste undervisningsdage.
  * Fleksibel gyldighed/udløb: 90 dage (standard), 30 dage, 1 år eller "Udløber aldrig" (10 år).
  * Filer: [`VikarKoderSide.tsx`](file:///c:/Users/Hunte/Documents/EK/EK-Kode/3.%20semester/Tv%C3%A6rfagligt/CASE-Ridecenter/apps/web/src/admin/VikarKoderSide.tsx), [`vikar-service.ts`](file:///c:/Users/Hunte/Documents/EK/EK-Kode/3.%20semester/Tv%C3%A6rfagligt/CASE-Ridecenter/apps/api/src/moduler/auth/vikar-service.ts), [`stald.ts`](file:///c:/Users/Hunte/Documents/EK/EK-Kode/3.%20semester/Tv%C3%A6rfagligt/CASE-Ridecenter/packages/contracts/src/stald.ts)

### 4.2 Profil-Dropdown på Tablet Vikar-Side
* **Løsning:**
  * På `/stald/vikar` vises en dropdown over alle registrerede/aktive vikarkandidater samt mulighed for "➕ Ny / Akut vikar (Indtast navn manuelt)".
  * Tabletten husker dagens vikar og forvælger (pre-selecter) automatisk den aktive profil.
  * Ved valg af profil låses navnefeltet automatisk (`🔒`), så vikaren blot skal taste sin 6-cifrede PIN-kode uden risiko for tastefejl.
  * Fil: [`VikarSide.tsx`](file:///c:/Users/Hunte/Documents/EK/EK-Kode/3.%20semester/Tv%C3%A6rfagligt/CASE-Ridecenter/apps/web/src/stald/VikarSide.tsx)

### 4.3 Strikte Sikkerhedsrestriktioner for Vikarer
* **Løsning:**
  * **Hestebyt / Erstatning:** En vikar må **aldrig** se eller erstatte til heste, der ikke er godkendt til rytteren. Den manuelle akutte hestevælger er fuldstændigt skjult og spærret for vikarer (`!erVikar`). Kun godkendte top-3 erstatninger kan vælges.
  * **Faner & Navigation:** Fanerne "⭐ Elevønsker" og "🐎 Heste" er skjult for vikarer i stald-headeren, og direkte URL-adgang omdirigeres til dagens program.
  * **Datonavigation:** Vikarer kan ikke spole til andre undervisningsdage eller åbne månedskalenderen; visningen er låst til dagens program (`🔒 Vikar: Dagens program`).
  * Filer: [`ErstatHestSide.tsx`](file:///c:/Users/Hunte/Documents/EK/EK-Kode/3.%20semester/Tv%C3%A6rfagligt/CASE-Ridecenter/apps/web/src/stald/ErstatHestSide.tsx), [`StaldLayout.tsx`](file:///c:/Users/Hunte/Documents/EK/EK-Kode/3.%20semester/Tv%C3%A6rfagligt/CASE-Ridecenter/apps/web/src/stald/StaldLayout.tsx), [`IDagSide.tsx`](file:///c:/Users/Hunte/Documents/EK/EK-Kode/3.%20semester/Tv%C3%A6rfagligt/CASE-Ridecenter/apps/web/src/stald/IDagSide.tsx)

### 4.4 Demodata & Dagslektioner
* **Løsning:**
  * Seed-scriptet opretter automatisk faste og akutte vikarkoder (`123456` Sofie Fast vikar, `654321` Akut vikar).
  * Lektioner på dagsdatoen forbliver åbne og planlagte uanset tidspunktet på dagen, så test af afkrydsning og vikarfremmøde altid er muligt.
  * Filer: [`skriv-seed.ts`](file:///c:/Users/Hunte/Documents/EK/EK-Kode/3.%20semester/Tv%C3%A6rfagligt/CASE-Ridecenter/tools/seed/skriv-seed.ts)

---

## 5. Justeringer & Forbedringer: Admin, Stald-Tablet & Generelt

### 5.1 Admin Dashboard
- [x] **Opret og slet ryttere (`/admin/ryttere`):**
  * Dialog/modal til oprettelse af ny rytter med obligatoriske stamdata (fornavn, efternavn, fødselsdato, kommune, højde, vægt, niveau) og sikkerhedsprofil.
  * Sletning/deaktivering af rytter med bekræftelsesdialog og oprydning/validering af holdtilmeldinger.
  * Filer: [`RyttereSide.tsx`](file:///c:/Users/Hunte/Documents/EK/EK-Kode/3.%20semester/Tv%C3%A6rfagligt/CASE-Ridecenter/apps/web/src/admin/ryttere/RyttereSide.tsx), API-ruter i [`ryttere/routes.ts`](file:///c:/Users/Hunte/Documents/EK/EK-Kode/3.%20semester/Tv%C3%A6rfagligt/CASE-Ridecenter/apps/api/src/moduler/ryttere/routes.ts).
- [x] **Kabale for næste måned viser elevønske-statistik (`/admin/kabale/:maaned`):**
  * For fremtidige/ufærdige måneder (f.eks. `2026-11`): Vis overblik over elevers indsamlede ønsker (hvor mange har 3/3, 1–2, 0 ønsker, samt fordeling over mest populære heste) inden kabalen startes.
  * Filer: [`KabaleSide.tsx`](file:///c:/Users/Hunte/Documents/EK/EK-Kode/3.%20semester/Tv%C3%A6rfagligt/CASE-Ridecenter/apps/web/src/admin/kabale/KabaleSide.tsx).
- [x] **Vikarkoder -> udskriv seddel fix (`/admin/vikarkoder`):**
  * `@media print` styling så `🖨️ Udskriv seddel` kun printer en ren, pæn udskriftsbon med 6-cifret kode, dato og vejledning, og skjuler hele admin-navigationen og baggrunden.
  * Filer: [`VikarKoderSide.tsx`](file:///c:/Users/Hunte/Documents/EK/EK-Kode/3.%20semester/Tv%C3%A6rfagligt/CASE-Ridecenter/apps/web/src/admin/VikarKoderSide.tsx).
- [x] **Navbar oprydning, kategorier & hover-dropdowns (`AdminLayout.tsx`):**
  * Omstrukturér topbaren med overskuelige kategorier (f.eks. "Drift & Stald", "Kabale & Tildeling", "Stamdata").
  * Dropdowns on hover/click for undermenuer.
  * Notifikationsklokke/-ikon i øverste højre hjørne med ulæste badges.
  * "Ledelsesoverblik" (`/admin`) er standard landingsside og tilgås via logoet "Bøgegården".
  * Filer: [`AdminLayout.tsx`](file:///c:/Users/Hunte/Documents/EK/EK-Kode/3.%20semester/Tv%C3%A6rfagligt/CASE-Ridecenter/apps/web/src/admin/AdminLayout.tsx).

### 5.2 Tablet Staldflade
- [x] **Fleksibel erstatningshest for leder og lærer (`/stald/plads/:id/erstat`):**
  * For `Ledelse` og `Ridelaerer`: Mulighed for at vælge alle andre egnede erstatningsheste (ud over top-3), samt manuelt vælge uegnede heste i absolutte nødstilfælde med eksplicit advarsel/begrundelse.
  * Vikarer forbliver 100% strengt blokeret fra ikke-godkendte heste.
  * Filer: [`ErstatHestSide.tsx`](file:///c:/Users/Hunte/Documents/EK/EK-Kode/3.%20semester/Tv%C3%A6rfagligt/CASE-Ridecenter/apps/web/src/stald/ErstatHestSide.tsx).
- [x] **Tablet-optimeret vikar PIN/login-flade (`/stald/vikar`):**
  * Dropdown og handlingsknapper gøres markant mere berøringsvenlige (store touch targets, min. 52-56px).
  * Dedikeret stor knap "➕ Ny vikar / Indtast navn" direkte ved siden af profilvælgeren.
  * Stor, tydelig "Skift vikar / tast nyt navn" knap velegnet til handsker.
  * Filer: [`VikarSide.tsx`](file:///c:/Users/Hunte/Documents/EK/EK-Kode/3.%20semester/Tv%C3%A6rfagligt/CASE-Ridecenter/apps/web/src/stald/VikarSide.tsx).
- [x] **Staldelever kan redigere staldnoter:**
  * Tillad `Staldelev` at redigere og gemme `staldnoter` på heste i både API RBAC og staldens UI.
  * Filer: [`HesteOversigtSide.tsx`](file:///c:/Users/Hunte/Documents/EK/EK-Kode/3.%20semester/Tv%C3%A6rfagligt/CASE-Ridecenter/apps/web/src/stald/HesteOversigtSide.tsx), API-ruter i [`heste/routes.ts`](file:///c:/Users/Hunte/Documents/EK/EK-Kode/3.%20semester/Tv%C3%A6rfagligt/CASE-Ridecenter/apps/api/src/moduler/heste/routes.ts).
- [x] **Fjern redundant "Ønsker" under `/stald/lektion`:**
  * Fjern link/knap til ønsker fra lektionssiden, da ønsker nu håndteres i navbaren for rette roller.
  * Filer: [`LektionSide.tsx`](file:///c:/Users/Hunte/Documents/EK/EK-Kode/3.%20semester/Tv%C3%A6rfagligt/CASE-Ridecenter/apps/web/src/stald/LektionSide.tsx).
- [x] **Sikkerhedsmarkør og sortering under `/stald/lektion`:**
  * Elever med sikkerhedskoder/instrukser sorteres i toppen af listen for øget opmærksomhed.
  * Selve koderne skjules i listen og erstattes af en diskret advarselsindikator (`⚠️ Sikkerhedsprofil`), så Cheat Sheet fanen aktivt bruges til detaljer.
  * Filer: [`LektionSide.tsx`](file:///c:/Users/Hunte/Documents/EK/EK-Kode/3.%20semester/Tv%C3%A6rfagligt/CASE-Ridecenter/apps/web/src/stald/LektionSide.tsx).

### 5.3 Generelt
- [x] **Redigering af staldnoter på tværs af Admin og Stald-tablet:**
  * Sikr at staldnoter på heste (`staldnoter`) kan redigeres og opdateres direkte på både `/admin/heste` og `/stald/heste` af autoriserede roller (Ledelse, Ridelærer, Staldelev).
  * Filer: [`heste/routes.ts`](file:///c:/Users/Hunte/Documents/EK/EK-Kode/3.%20semester/Tv%C3%A6rfagligt/CASE-Ridecenter/apps/api/src/moduler/heste/routes.ts), [`HesteSide.tsx`](file:///c:/Users/Hunte/Documents/EK/EK-Kode/3.%20semester/Tv%C3%A6rfagligt/CASE-Ridecenter/apps/web/src/admin/heste/HesteSide.tsx), [`stald/HesteOversigtSide.tsx`](file:///c:/Users/Hunte/Documents/EK/EK-Kode/3.%20semester/Tv%C3%A6rfagligt/CASE-Ridecenter/apps/web/src/stald/HesteOversigtSide.tsx).

### 5.4 Velfærdskontrol, Heatmap & Erstatningsårsager
- [x] **Heatmap hviledag visualisering (`DashboardSide.tsx`):**
  * Heste på fridag med 0 lektioner vises med en markant lyseblå nuance (`Hvile`), så den skiller sig ud fra almindelige tomme lektionsdage (`0/3`).
  * Heste der fejlagtigt er tildelt lektioner på en hviledag vises med **blå kant og rødt fyld**, så det omgående er tydeligt, at hesten er planlagt på sin fridag.
  * Fil: [`DashboardSide.tsx`](file:///c:/Users/Hunte/Documents/EK/EK-Kode/3.%20semester/Tv%C3%A6rfagligt/CASE-Ridecenter/apps/web/src/admin/DashboardSide.tsx).
- [x] **Stald erstatningsvælger – udeluk hviledag og differentier årsager (`ErstatHestSide.tsx`):**
  * Heste med hviledag på lektionens ugedag (f.eks. Boy om lørdagen) eller hvis dagsmaksimum er nået udelukkes konsekvent fra "Øvrige egnede" og placeres i "Uegnede i nødstilfælde".
  * Differentier uegnethedsårsager præcist:
    - "Har hviledag i dag"
    - "Ikke godkendt til holdets niveau (begynder/øvet)"
    - "Maks dagsbelastning nået (X/Y lekt.)"
    - "Sundhedsstatus: [Sygemeldt/Skadet/Karantæne]"
    - "Ikke godkendt til rytterens profil (fysik/sikkerhed)" (kun når det vedrører rytterens højde, vægt eller tavs viden/traumer)
  * Fil: [`ErstatHestSide.tsx`](file:///c:/Users/Hunte/Documents/EK/EK-Kode/3.%20semester/Tv%C3%A6rfagligt/CASE-Ridecenter/apps/web/src/stald/ErstatHestSide.tsx).
- [x] **Heste allerede tildelt på samme lektion udelukkes fra erstatning (`foreslaa-erstatninger.ts`, `ErstatHestSide.tsx`, `omplacering-service.ts`):**
  * Heste der allerede er tildelt til en anden elev på netop den aktuelle lektion udelukkes 100% fra top-3 forslag og fra "Øvrige egnede".
  * Hvis de vises under uegnede i nødstilfælde for leder/lærer, markeres de eksplicit med årsagen: ⚠️ **"Allerede optaget på denne lektion"**.
  * Filer: [`foreslaa-erstatninger.ts`](file:///c:/Users/Hunte/Documents/EK/EK-Kode/3.%20semester/Tv%C3%A6rfagligt/CASE-Ridecenter/packages/domain/src/erstatning/foreslaa-erstatninger.ts), [`omplacering-service.ts`](file:///c:/Users/Hunte/Documents/EK/EK-Kode/3.%20semester/Tv%C3%A6rfagligt/CASE-Ridecenter/apps/api/src/moduler/lektioner/omplacering-service.ts), [`ErstatHestSide.tsx`](file:///c:/Users/Hunte/Documents/EK/EK-Kode/3.%20semester/Tv%C3%A6rfagligt/CASE-Ridecenter/apps/web/src/stald/ErstatHestSide.tsx).

---

## 6. Pilotforbedringer: Drift, Sortering, Ventelister & Tablet UX

### 6.1 Generelt
- [x] **Opsagte elever på holdlisten (`LektionSide.tsx`, `IDagSide.tsx`):**
  * Hvis en elev (f.eks. Karla P) har status `Opsagt`, skal holdlisten på tabletten vise "Elev opsagt" i stedet for at melde fravær/udeblevet, og fremhæves med rød styling + udråbstegn.

### 6.2 Admin
- [x] **Sortering i ryttertabellen (`/admin/ryttere`):**
  * Mulighed for at sortere tabellen efter Navn, Niveau, Højde, Partaftale og Status.
- [x] **Flyt vikarkoder til Rapporter & Kontrol:**
  * Vikarkoder flyttes fra "Drift & Stald" til "Rapporter & Kontrol" i navigationsmenuen.
- [x] **Historiske rapportudtræk – forhåndsvisning i modal:**
  * Tilføj et "👁️ Se rapport" ikon ved siden af sletteikonet, der åbner et pop-up vindue med tabellens data direkte i UI'et uden krav om download og Excel.
- [x] **Manuel oprettelse/tilføjelse til ventelister:**
  * Mulighed for at tilføje en rytter til ventelisten på et specifikt hold direkte fra admin dashboardet/ventelistesiden.
- [x] **Navbar aktiv fane styling bugfix:**
  * Løs bug hvor "Rapporter & Kontrol" fejlagtigt markeres som aktiv (grøn baggrund), når man befinder sig på Dashboard/Overblik (`/admin/dashboard` / `/admin`).

### 6.3 Tablet Stald
- [x] **/stald/vikar – oprydning i knapper & modal vælger:**
  * Fjern "✏️ Skift vikar" knap ved siden af tekstfeltet, men behold "➕ Ny vikar".
  * Erstat select-dropdown med et stort, handsketilpasset pop-up vindue til valg af tidligere vikarer med store knapper.
- [x] **/stald/vikar – vertikal optimering & navigation:**
  * Gør "← Tilbage til PIN login" til en pæn knap i topbaren/headeren så den ikke optager vertikal plads og forårsager unødig scroll.
  * Flyt heste-ikonet op ved siden af overskriften på både `/stald/vikar` og `/stald/laas`.
- [x] **/stald/lektion – prioriteret sortering ved hesteadvarsel:**
  * Rytter/hest-par med advarsler (f.eks. sygemeldt eller skadet hest) sorteres absolut øverst på holdlisten for akut synlighed.
- [x] **/stald/lektion – differentieret styling af advarsler:**
  * Dæmp den orange glow for elever med sikkerhedsprofil (kun diskret `⚠️ Sikkerhedsprofil` badge).
  * Brug markant gul fill/glow + udråbstegn for par med sygemeldt hest.
  * Brug rød styling + udråbstegn for opsagte elever.
- [x] **/stald/plads/:id/erstat – Boy hviledagsfremhævning & fjernelse af redundant tekst:**
  * For uegnede heste der har hviledag (f.eks. Boy om lørdagen), skal "Hviledag i dag" fremhæves tydeligt i stedet for blot dagsbelastningstal.
  * Fjern redundant dagsbelastningsangivelse i top-3 kort (fjern det gentagne "• Dagsbelastning: X lekt." når det allerede står i teksten).

---

## 7. Showcase: Manuel fordeling fra case (oktober) vs. automatisk motor (november)

### 7.1 Data & Seed
- [x] **Manuel kabale-kørsel for oktober (`skriv-seed.ts`):**
  * Kør Maries oprindelige tildelinger for oktober gennem domænets `validerPlan(plan, data)`.
  * Registrér kørslen med `solver_version = 'manuel-papirark'`, status `Publiceret` (eller `Afvist pga. velfærdsbrud (Historisk)`), og udfyld `welfare_guard_resultat` med overtrædelserne.

### 7.2 UI & Præsentation
- [x] **Fremhævelse af manuelle overtrædelser i kabalevisningen (`KoerselOversigt.tsx`):**
  * Vis en informativ demonstrationsbjælke når kørslen er manuel (`solver_version = 'manuel-papirark'`), der forklarer at overtrædelserne (overbelastning, hviledage) stammer fra Maries manuelle papirark.
  * Sikr at overtrædelserne vises overskueligt grupperet med pæne forklaringer i stedet for blot rå koder.

---

## 8. Admin & Tablet Touch UX Forbedringer [GENNEMFØRT]

### 8.1 Admin
- [x] **"Stald tablet" åbner i ny fane (`AdminLayout.tsx`):**
  * Knappen har fået `target="_blank" rel="noopener noreferrer"` og en diskret `↗` ekstern faneindikator, så administratoren ubesværet kan have både admin- og tabletfladen åben side om side.
- [x] **Vikarkoder sortering & filtrering (`VikarKoderSide.tsx`):**
  * Klikbare sorteringskolonner med sorteringsretning (▲/▼) for Kode, Navn / Titel, Type, Status, Udstedt, Udløb og Sidst anvendt.
  * Hurtigfiltre for "Alle", "Kun faste" og "Kun midlertidige" samt fritekstsøgning.
- [x] **Vikarkoder efterfølgende navngivning & konvertering til fast vikar (`VikarKoderSide.tsx`, `vikar-service.ts`, `routes.ts`, `stald.ts`):**
  * Ny `✏️ Redigér` knap pr. vikarkode åbner en modal, hvor administrator kan omdøbe/navngive koden og slå "Gør til fast vikar" til/fra.
  * API'et forlænger udløbsdatoen til 10 år ved konvertering til fast vikar, så koden ikke udløber ved en fejl.

### 8.2 Tablet Stald
- [x] **Erstat hest handling & synlighed (`LektionSide.tsx`):**
  * Stor markant `[🔄 Erstat hest]` (min-h 52px) for ryttere med sygemeldt/skadet hest.
  * Tydelig `[🔄 Skift hest]` knap ved hestenavnet for alle ryttere for hurtig adgang.
  * Global `[🔄 Redigér heste / Afslut omplacering]` toggle i toppen, der åbner store, handsketilpassede erstatningsknapper for samtlige ryttere på holdet.
  * Tydelig visuel grabber-strip `⋮` i venstre kant af alle rytterkort.
- [x] **/stald/vikar – forstørret "Tilbage til PIN" knap (`VikarSide.tsx`):**
  * Knappen er gjort markant større (`min-h-[48px] px-4 py-2.5 font-bold`) og let at ramme med ridehandsker på en 11" skærm.
- [x] **/stald/i-dag – 2-rækket header container (`IDagSide.tsx`):**
  * Række 1: Fuldbredde ugedag og dato ("Onsdag d. 7. oktober 2026 (Dagens program)") uden tekstklemning.
  * Række 2: Store, handskevenlige navigations- og kalenderknapper (`min-h-[48px]`) med optimal udnyttelse af den horisontale plads og reduceret spildplads.

---

## 9. Kabale & Heatmap Holdplan-adskillelse [GENNEMFØRT]

### 9.1 Holdtabel – Differentiering af reelle brud mod bløde begrundelser
- [x] **Korrekt visning af velfærdsbrud i holdtabellen (`HoldTabel.tsx`):**
  * Tidligere markerede `Statusmaerker` fejlagtigt enhver tildeling som `⚠️ Velfærdsbrud`, hvis tildelingens forklaring indeholdt en hård kode (f.eks. hvorfor rytterens 1. ønske ikke kunne opfyldes, selvom den tildelte 2. ønske-hest var 100% lovlig).
  * `Statusmaerker` tjekker nu kørslens faktiske `welfare_guard_overtraedelser`. Den tildelte hest markeres kun som velfærdsbrud, hvis kørslen rent faktisk har registreret brud på den tildelte hest (f.eks. i Maries manuelle oktober-plan).
  * Ved automatiske kørsler (november med 0 overtrædelser) vises der nu 0 falske advarsler på holdene.

### 9.2 Dashboard Heatmap – Månedsfiltrering & Holdplans-omskifter
- [x] **Adskillelse af månedernes holdtildelinger i Heatmap (`dashboard-service.ts`, `routes.ts`, `ledelse.ts`):**
  * Tidligere lavede API'et en global aggregering af samtlige `hestetildeling`-rækker på tværs af både oktober og november, hvilket fejlagtigt fordoblede lektionsantallet og skabte kunstige overbelastninger.
  * API'et understøtter nu `GET /dashboard/noegletal?maaned=YYYY-MM`. Belastningen beregnes isoleret ud fra den valgte måneds kørsel (prioriterer publiceret plan, ellers seneste kørsel).
- [x] **Månedsvælger i Heatmap UI (`DashboardSide.tsx`):**
  * Heatmappet har fået interaktive knapper/tabs i headeren, så ledelsen kan skifte mellem oktober (viser den manuelle holdfordeling med brud) og november (viser motorens balancerede plan).

---

## 10. Brugerflade-polering, Dispensation & Kapacitetsoversigt [GENNEMFØRT]

### 10.1 Admin
- [x] **/kabale – Fjernelse af case-demonstrationskasse (`KoerselOversigt.tsx`):**
  * Den gule informationskasse for Maries oprindelige papirark er fjernet fra toppen af kørselsoversigten.
- [x] **/kabale – Rød boks for ikke-tildelte elever & Justerings-popup (`KabaleSide.tsx`, `KoerselOversigt.tsx`, `HestVaelger.tsx`, `justering-service.ts`):**
  * Hvis "Ikke tildelt" > 0 i statistikken, vises tallet i en rød advarselsknap med link `Vis liste →`.
  * Ved klik åbnes en popup, der lister alle elever uden hest grupperet pr. hold, med lektionstidspunkt og en direkte "Justér" knap.
  * Ved manuel justering af elever uden tildeling gives der mulighed for niveau-dispensation (f.eks. ved mangel på begyndergodkendte heste).
- [x] **/kabale – Stor blå Godkend knap & Kladde-påmindelse (`KabaleSide.tsx`):**
  * Når planen er en kladde, fremhæves knappen som en markant, stor blå handling (`bg-blue-600`, ring, ikon).
  * Der vises et tydeligt blåt informationsbanner i toppen med påmindelse om, at planen er i kladde-status.
- [x] **/heste – Kapacitetsnøgletal & Temperamentsoversigt (`HesteSide.tsx`):**
  * Nye KPI-kort: antal heste der er "begyndervenlige", "skåneheste" og "må springe".
  * Temperamentsoversigt med fordeling på Rolig, Normal og Frisk.
- [x] **/heste – Sorterbare kolonner (`HesteSide.tsx`):**
  * Tabellen kan sorteres (både stigende og faldende med indikatorpile) på: Navn, Sundhedsstatus, Stangmål, Max vægt, Temperament, Begyndere, Skåne, Spring og Hviledag.
- [x] **/dashboard – Forbedret månedsvælger & Statuskolonne i Heatmap (`DashboardSide.tsx`, `dashboard-service.ts`, `ledelse.ts`):**
  * Månedsvælgeren er udstyret med en dropdown med alle tilgængelige måneder samt `←` og `→` pileknapper.
  * Der er tilføjet en dedikeret "Status"-kolonne i tabellen mellem "Hest" og ugedagene, så man straks kan se om en hest er Rask, Syg, Skadet eller i Karantæne.

### 10.2 Tablet Stald
- [x] **/oensker – Større touch-knapper (`OenskerLektionSide.tsx`):**
  * Knapperne "Alle", "Mangler", "Klar" og niveauknapperne har fået øget højde (`min-h-[48px]` / `min-h-[44px]`), så de er nemme at betjene med ridehandsker.
- [x] **/oensker – Fjernelse af lille 'Ryd valg' i modal (`OenskerLektionSide.tsx`):**
  * Den lille 'Ryd valg' knap er fjernet for at undgå forvirring; den store '🗑️ Ryd alle ønsker' i modalens bund bevares.
- [x] **/lektion – Strømlinet heste-omplacering (`LektionSide.tsx`):**
  * Drag/grabber-strippen i venstre kant og den lille inline "Skift hest"-knap er fjernet.
  * Erstatning styres nu centralt via `Redigér heste` knappen i toppen, som aktiverer store, tydelige `Erstat hest` knapper for rytterne.

---

## 11. Springheste-indstilling, Header-optimering & Særtilladelser [GENNEMFØRT]

### 11.1 Kabale & Algoritme
- [x] **Ny indstilling: "Reserver spring-heste til springhold først" (`KabaleSide.tsx`, `contracts`, `domain`, `api`):**
  * Ny toggle i indstillingsmodalen på kabalen (`reserver_spring_heste` / `reserverSpringHeste`).
  * Når aktiveret, prioriterer MRV-solveren springhold først i køen og pålægger en fradragsscore (-200 point) ved tildeling af spring-godkendte heste til ikke-springhold.
  * Forklaring af kapacitet: De 4 springhold tirsdag har 24 rytterpladser, men der er 19 spring-godkendte heste under HC-05 (max 1 springlektion/uge), hvoraf eventuelle tirsdags-hviledage reducerer kapaciteten yderligere. Indstillingen sikrer maksimal udnyttelse af springhestene til springhold frem for almindelige hold.

### 11.2 Admin Heste (`/heste`)
- [x] **Horisontal pladsfrigivelse & ingen linjeskift ved sorteringspile (`HesteSide.tsx`):**
  * Tilføjet `whitespace-nowrap px-2.5 py-2 text-xs` på samtlige tabeloverskrifter, så sorteringspilen `↕` aldrig tvinges ned på en ny linje.
  * Erstattet den brede "Redigér" tekstknap med et kompakt blyant-ikon `✏️` med tooltip `title="Redigér [hest]"`, og reduceret kolonnebredden.

### 11.3 Admin Kabale (`/kabale`)
- [x] **Særtilladelse & "Særtildel alle (dispensation)" (`KabaleSide.tsx`, `justering-service.ts`, `routes.ts`):**
  * I popup-modalen for "Elever uden hestetildeling" er der tilføjet en infoboks, som forklarer, at niveau-mismatch er en **soft constraint** (et pædagogisk hensyn snarere end en fysisk velfærdsgrænse; hestevelfærd som dagsbelastning, max vægt og hviledag overholdes stadig 100%).
  * Tilføjet en automatisk handlingsknap `⚡ Særtildel alle (dispensation)`, der i én arbejdsgang tildeler lovlige kandidatheste til ufordelte elever med niveau-dispensation under fuld overholdelse af alle fysiske velfærdsregler.

### 11.4 Tablet Stald (`/stald/i-dag`)
- [x] **Husker valgt dato ved retur fra hold (`IDagSide.tsx`):**
  * Den valgte dato gemmes og hentes løbende via `sessionStorage` (`stald_valgt_dato`), så når man navigerer tilbage fra en lektion, forbliver man på den valgte dato i stedet for at hoppe tilbage til "i dag".

---

## 12. Kapacitetsfilter, Ønske-tags & Staldopdatering [GENNEMFØRT]

### 12.1 Admin Dashboard & Heste (`/dashboard` & `/heste`)
- [x] **Interaktive Egenskabs- og Temperamentkort med Filter-banner:**
  * Både på [`HesteSide.tsx`](file:///c:/Users/Hunte/Documents/EK/EK-Kode/3.%20semester/Tv%C3%A6rfagligt/CASE-Ridecenter/apps/web/src/admin/heste/HesteSide.tsx) og [`DashboardSide.tsx`](file:///c:/Users/Hunte/Documents/EK/EK-Kode/3.%20semester/Tv%C3%A6rfagligt/CASE-Ridecenter/apps/web/src/admin/DashboardSide.tsx) (over Heatmappet) er kortene for "Egenskaber & kapacitet" (Begyndervenlig, Er skånehest, Må springe) og "Temperamentsoversigt" (Rolig, Normal, Frisk) gjort klikbare.
  * Ved klik filtreres tabellen nedenunder øjeblikkeligt til kun at vise matchende heste.
  * Der vises et tydeligt gult banner over tabellen: `Viser Egenskaber & kapacitet: Er skånehest. [Reset]` (eller `Viser Temperamentsoversigt: Rolig. [Reset]`).
  * Et klik på `[Reset]` (eller genklik på samme kort) nulstiller filteret straks.

### 12.2 Tablet Stald – Elevønsker (`/stald/oensker`)
- [x] **Relevante Tags og Reservations-hjælp på Hestekort (`OenskerLektionSide.tsx`):**
  * På hestekortene i modalen vises nu tydelige badges: `👶 Begynderhest`, `🏇 Springhest` og `🛡️ Skånehest`.
  * For elever på letøvet og øvet niveau vises vejledningsteksten `💡 Forbeholdt begynderhold ved kabale` på begyndergodkendte heste, så elever og ridelærere ved, at hestene kan ønskes, men primært prioriteres til begynderhold ved algoritmisk fordeling.

### 12.3 Tablet Stald – Temperament & Skåne Opdatering for Staldelever (`/stald/heste`)
- [x] **Rettigheds- og redigeringsudvidelse (`routes.ts`, `HesteOversigtSide.tsx`, `dexie-db.ts`):**
  * Backend API tillader nu, at rollerne `Staldelev`, `Ridelaerer` og `Ledelse` kan opdatere felterne `temperament`, `skaane` og `staldnoter`.
  * Administrative stamdata såsom stangmål, max ryttervægt, begyndergodkendelse, springforbud og hviledag er fortsat strengt beskyttet og forbeholdt ledelse/ridelærere.
  * Modalen i stald-appen er udvidet med store touch-knapper til Temperament (`Rolig`, `Normal`, `Frisk`), en One-Touch toggle til `🛡️ Skånehest` og tekstfelt til `Staldnoter`.
  * Hestekortene på stald-tabletten viser nu aktive badges for hestens temperament og skånehest-status.



