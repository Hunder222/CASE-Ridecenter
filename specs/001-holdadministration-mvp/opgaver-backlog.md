# Ridecenter MVP - Opgave Backlog

Dette dokument samler de specificerede forbedringer og opgaver til Stald-appen, Admin Dashboardet og datasimuleringen, som udføres ved næste iteration.

---

## 1. Stald App (`/stald`)

### 1.1 Vikar Login UI (Tablet-venlig numpad)
* **Problem:** Vikar-login er i øjeblikket et simpelt web-formularfelt, som ikke er optimeret til store touchskærme på væggen eller i stalden.
* **Løsning:** 
  * Header med vikarnavn i toppen.
  * Stor, touch-venlig numpad til indtastning af 4-cifret vikarkode og PIN.
  * Tydelige feedback-cirkler (`● ● ○ ○`) og stor "Log ind"-knap.

### 1.2 Fejlretning & Forbedring: Elevønsker Sync & Rydning
* **Løst:**
  * **FK Constraint fix:** I `sync-service.ts` faldt backend tidligere tilbage til `'00000000-0000-0000-0000-000000000000'`. Der er nu indført automatisk fallback til en aktiv bruger i databasen, så PostgreSQL-transaktionen ikke ruller tilbage med foreign key fejl.
  * **Rydning af ønsker:** Tilføjet `🗑️ Ryd alle ønsker` i bunden af modalen og `Ryd valg` i statuslinjen. Når ønsker ryddes, opdateres elevkortet straks i matrixen (skifter fra grøn til gul/mangler), og den ryddede tilstand persisteres og synkroniseres.

### 1.3 "Heste" Siden - Sundheds- og Kapacitetsoverblik
* **Løsning:**
  * I toppen af `/stald/heste`: Implementer en KPI-overbliksbjælke.
  * Tæller for: **Raske & Aktive heste** (grøn), **Syge heste** (rød), **Skadede heste** (orange), **Hviledag i dag** (blå).
  * Hurtig filtrering ved klik på statuskortene.

### 1.4 Datonavigation & Månedskalender Pop-up
* **Placer fredagshold tilbage på fredag:** Onsdag skal vise "Ingen hold i dag".
* **Smart navigation:** Knapperne "Forrige dag" og "Næste dag" omdøbes/ændres til **"Forrige program"** og **"Næste program"**, så et klik automatisk springer frem/tilbage til den nærmeste dato med faktiske holdlektioner.
* **Månedskalender pop-up:** En modal med oversigt over hele måneden, hvor datoer med planlagte lektioner er tydeligt markeret med prikker/badges, så man med ét tryk kan skifte til en specifik undervisningsdag.

---

## 2. Admin Dashboard (`/admin`)

### 2.1 Vikarkoder - Skjul/Vis med Øje-ikon
* **Løsning:**
  * Koderne maskeres som udgangspunkt (fx `••••••` eller `****-****`).
  * Et øje-ikon (`👁️` / `👁️‍🗨️`) tilføjes ud for hver kode i tabellen for at vise/skjule klartekstkoden on-demand.
  * Knap til hurtig kopiering til udklipsholder.

### 2.2 Vikarkode Styling (Light Mode)
* **Løsning:**
  * Vikarkode-siden styles fuldt ud i light mode svarende til resten af Admin Dashboardet (`bg-white`, `border-slate-200`, `text-slate-800`).

### 2.3 Administrative Indtastningsmuligheder
* **Løsning:**
  * Administratorer skal have adgang til de samme indtastningsmuligheder fra Admin Dashboardet som staldtablet har:
    * Manuel registrering og redigering af elevønsker pr. måned i admin.
    * Hurtig redigering af hestesundhed og staldnoter fra hestefanen.
    * Elevtilmeldinger og sikkerhedsprofiler.

---

## 3. Komplet Holdplan & Demodata (Casebeskrivelse)

### 3.1 Fuld Ugeplan (Mandag - Søndag)
Baseret på `_resources/teacher/_case-01-Holdoversigt, uge.md`:
* **Mandag (Malene):** Letøvet, Øvet, Letøvet, Letøvet
* **Tirsdag (Malene):** Letøvet spring, Letøvet spring, Øvet spring, Øvet spring
* **Onsdag (Camilla):** Begynder, Letøvet, Letøvet, Begynder
* **Torsdag (Malene):** Letøvet, Letøvet, Øvet, Øvet
* **Fredag (Marie):** Begynder, Letøvet, Øvet, Letøvet
* **Lørdag (Marie):** Begynder, Trækhold x 4
* **Søndag (Birgit):** Parthold, Trækhold x 3

### 3.2 Simuleret Status Oktober vs. November
* **Oktober (Nuværende måned):** Færdig holdtildeling og afsluttede/aktive lektioner for alle hold.
* **November (Næste måned):** Ufærdig holdtildeling (elever har afgivet ønsker, men kabalen er endnu ikke låst/udført), så administratorer kan køre kabalen og se fordelingen i Admin Dashboardet.

