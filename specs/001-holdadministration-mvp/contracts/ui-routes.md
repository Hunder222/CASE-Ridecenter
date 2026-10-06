# Kontrakt: Brugerflader, ruter og RBAC

**Gælder for**: alle user stories. Én PWA (`apps/web`) med to adskilte rutetræer: **Stald** (tablet/mobil, offline-first) og **Admin** (desktop, online).
**Beslutninger**: [research.md R4, R7, R14](../research.md)

## RBAC-matrix

| Kapabilitet | Ledelse | Ridelærer | Vikar | Staldelev |
|---|:---:|:---:|:---:|:---:|
| Lås stald op med PIN | ✅ | ✅ | ✅ (engangskode + navn) | ✅ |
| Se dagens holdlister og heste | ✅ | ✅ alle dagens hold | ✅ kun vikardatoen | 🔸 kun heste, ingen ryttere |
| Cheat Sheet (koder + anonymiseret instruks) | ✅ | ✅ | ✅ | ❌ |
| Fremmøde (batch) | ✅ | ✅ | ✅ | ❌ |
| Korrektion af fremmøde (med begrundelse) | ✅ | ✅ | ❌ | ❌ |
| Registrér afbud | ✅ | ✅ | ❌ | ❌ |
| Meld hestestatus / sæt hest ude af drift | ✅ | ✅ | ✅ | ✅ |
| Sæt hest i drift igen | ✅ | ✅ | ❌ | ❌ |
| Top-3 erstatning + godkend omplacering | ✅ | ✅ | ✅ | ❌ |
| Registrér elevønsker (F1.1) | ✅ | ✅ | ❌ | ❌ |
| Kør, justér og godkend kabale | ✅ | ✅ egne hold | ❌ | ❌ |
| Publicér kabale | ✅ | ❌ | ❌ | ❌ |
| Stamdata (heste, ryttere, hold) | ✅ | 👁 heste/hold | ❌ | ❌ |
| **Fuld sikkerhedsprofil (Art. 9)** | ✅ (auditlogget) | ❌ | ❌ | ❌ |
| Vægt, højde, fødselsdato, kontaktinfo | ✅ | ❌ | ❌ | ❌ |
| Venteliste + genbesættelsesforslag | ✅ | ❌ | ❌ | ❌ |
| Vikarkoder (udsted/spær) | ✅ | ❌ | ❌ | ❌ |
| Dashboard, kommunerapport, audit | ✅ | ❌ | ❌ | ❌ |

Forældre og elever har **ingen** adgang i POC'en. F1.5/F1.6 er deprioriteret efter forfatningen. API'et er versioneret (`/api/v1`), så en forældreportal senere kan få sine egne endpoints uden at ændre kernemotoren.

## Stald-ruter (`/stald/*`): offline-first, touch-optimeret

| Rute | Formål | Story / krav | Offline | Nøgleinteraktion og mål |
|---|---|---|:---:|---|
| `/stald/laas` | PIN-tastatur (store taster) + knappen "Jeg er vikar" | US1 AS1, FR-004 | ✅ | Oplåst på under 2 sek. Brugernavn vises efter oplåsning |
| `/stald/vikar` | 6-cifret kode → fulde navn → adgang | US3 AS1–2, FR-013 | ✅ | Navn påkrævet (mindst 3 tegn) |
| `/stald/i-dag` | Dagens lektioner som store kort med tid, niveau, underviser, ⚠ ved syge heste og afbud | US1, US3 AS3 | ✅ | Ét tryk åbner holdet |
| `/stald/lektion/:id` | Holdliste: rytter, hest, status. **"Markér alle fremmødt"** + tryk på undtagelser | US1 AS2, SC-001 | ✅ | **Under 15 sek. for 10 ryttere** (mål under 5 sek.). Hvert tryk gemmes lokalt på under 100 ms. "Afslut hold" lukker fremmødet |
| `/stald/lektion/:id/cheat-sheet` | Holdets sikkerhedskort: pr. rytter vises koder + instruks, ingen diagnoser | US3 AS6, FR-012 | ✅ | Kan åbnes fra holdlisten med ét tryk |
| `/stald/plads/:id/erstat` | Top-3 erstatningsheste med dagsbelastning og årsag. "Godkend omplacering" | US3 AS4–5, FR-011, SC-005 | ✅ | Forslag på under 2 sek. Godkend med ét tryk |
| `/stald/plads/:id/korriger` | Korrektion med påkrævet begrundelse | US1 AS5 | ✅ | Begrundelse vælges som hurtigvalg eller fritekst |
| `/stald/heste` | Hesteoversigt + "Meld status" (Helbred/Adfærd, Info/Obs/Kan ikke bruges) | F2.1, US3 AS3 | ✅ | Staldelevens primære skærm |
| `/stald/oensker/:lektionId` | Registrér 3 ønsker pr. rytter (sidste lektion i måneden) | F1.1 | ✅ | Hestevælger med store fliser |

**Fælles stald-krav**: touch-mål på mindst 56 px, tekst på mindst 18 px, kontrast mindst 7:1, synkindikator altid synlig ([sync-protocol.md §9](./sync-protocol.md#9-synlig-status-ui-kontrakt)), automatisk lås efter 5 min. inaktivitet og ingen persondata i URL'er.

## Admin-ruter (`/admin/*`): desktop, online

| Rute | Formål | Story / krav |
|---|---|---|
| `/admin/login` | E-mail + adgangskode | — |
| `/admin` (dashboard) | Nøgletal: holdudnyttelse, hestebelastning (heatmap hest × ugedag med max-linje), heste ude af drift, aktive vikarkoder, gentaget fravær, afventende forslag, synkkonflikter. Live via SSE | US4 AS5, FR-016 |
| `/admin/notifikationer` | Vikarlogin (med "Udsted ny kode"), kapacitetsmangel, konflikter | US3 AS2, FR-013 |
| `/admin/heste` · `/admin/heste/:id` | Stamdata + statushistorik | FR-001 |
| `/admin/ryttere` · `/admin/ryttere/:id` | Stamdata, opsigelse (viser beregnet slutdato) | FR-002, FR-015 |
| `/admin/ryttere/:id/sikkerhed` | Art. 9-profil: forbudte og påkrævede heste, Cheat Sheet-koder, anonymiseret instruks med live-advarsel ved diagnoseord. Læsning auditlogges | FR-003, FR-012 |
| `/admin/hold` | Hold, tilmeldinger, kapacitet | — |
| `/admin/oensker/:maaned` | Overblik over ønsker og hvilke der ikke kan opfyldes | F1.1 |
| `/admin/kabale/:maaned` | Kør motor → kladde. Tabel pr. hold med ønskeopfyldelse, alternativer og ikke-tildelte. Klik på en tildeling viser **begrundelse**. Manuel justering med live Welfare Guard (ulovlige heste er grå og viser årsag). Godkend → Publicér. Varighed vises (SC-004) | US2, FR-006–FR-010 |
| `/admin/venteliste` | Venteliste + genbesættelsesforslag med kontaktinfo. Godkend/afvis efter manuel kontakt | US4 AS2/AS4, FR-014 |
| `/admin/vikarkoder` | Udsted (klartekst vises én gang, kan printes), status, spær | FR-013, edge case |
| `/admin/rapporter` | Periodevælger + **"Generer kommunal tilsynsrapport"**. Viser SHA-256 og kædehash. Historik | US4 AS6, FR-018, SC-009 |
| `/admin/audit` | Søgbart revisionsspor + "Verificér hashkæde" | FR-017, Princip III |
