# Kontrakt: Offline-sync-protokol (stald-enhed ↔ API)

**Gælder for**: FR-004, FR-005, FR-013, FR-017, US1 AS3/AS4 og edge case *Offline synkroniseringskonflikt*
**Endpoints**: `POST /sync/push`, `GET /sync/pull`, `GET /events` og `GET /stald/dag/{dato}` ([openapi.yaml](./openapi.yaml))
**Beslutninger**: [research.md R4, R6, R7, R9](../research.md)

## 1. Principper

1. **Lokal først**: hver brugerhandling i stalden skrives straks og synkront til IndexedDB. UI'et opdateres fra den lokale tilstand. Netværket er aldrig i den kritiske sti, og der vises ingen fejl eller blokering offline (US1 AS3).
2. **Kommandoer, ikke tilstand**: enheden sender *hvad der skete* (en kommando) og ikke *hvordan rækken ser ud nu*. Serveren er autoritativ og validerer alle kommandoer igen med samme domænepakke.
3. **Idempotens**: hver kommando har et klientgenereret `kommando_id` (UUID v7, tidssorterbar). Serveren gemmer det med en unik nøgle. Gensendelse giver `AlleredeAnvendt` og har ingen bivirkning.
4. **Rækkefølge**: kommandoer fra én enhed sendes i outbox-rækkefølge. Mellem enheder afgøres rækkefølgen af `klient_tidspunkt` (LWW, se §5).
5. **Dataminimering**: pull-svar indeholder kun stald-projektionen ([data-model.md §9](../data-model.md#9-lokal-enhedsmodel-indexeddb-på-stald-tablet)).

## 2. Kommandokuvert

```json
{
  "kommando_id": "0192f1c4-…",
  "type": "RegistrerFremmoede",
  "klient_tidspunkt": "2026-10-09T13:02:11.481Z",
  "bruger_id": "…",
  "session_id": "…",
  "payload": { }
}
```

## 3. Kommandotyper

| Type | Payload | Roller | Serverens validering | Bivirkninger |
|---|---|---|---|---|
| `RegistrerFremmoede` | `{ lektion_id, registreringer: [{ lektionsplads_id, status }] }`. Batch, så "Markér alle fremmødt" er én kommando | Ridelærer, Vikar | Pladsen tilhører lektionen. Status ∈ {Fremmoedt, Udeblevet}. Vikar: kun lektioner på vikardatoen | N × `Fremmoederegistrering` 🧾⛓ |
| `KorrigerFremmoede` | `{ fremmoederegistrering_id, ny_status, begrundelse }` | Ridelærer, Ledelse | Begrundelse på mindst 5 tegn (US1 AS5) | Ny række med `erstatter_id` + `AuditHaendelse(FREMMOEDE_KORRIGERET)` |
| `RegistrerAfbud` | `{ lektionsplads_id, modtaget_tidspunkt? }` | Ridelærer, Ledelse | `modtaget_tidspunkt ≤ klient_tidspunkt`. Rettidighed beregnes af `klassificerAfbud` (R10) | Række med `Afbud_*`. Ved rettidigt afbud + aktiv venteliste oprettes `Genbesaettelsesforslag` (< 5 sek. efter modtagelse, SC-006) |
| `MeldHestStatus` | `{ hest_id, type, alvorlighed, beskrivelse }` | Staldelev, Ridelærer, Vikar, Ledelse | Beskrivelse på højst 500 tegn | `Hestestatusmelding` 🧾. Ved `KanIkkeBruges` sættes `sundhedsstatus = Sygemeldt`, berørte pladser advares, og der sendes SSE `hest.status` (US3 AS3) |
| `GodkendOmplacering` | `{ lektionsplads_id, til_hest_id, aarsag, forslag_snapshot }` | Ridelærer, Vikar | **Welfare Guard køres igen på serveren** med serverens aktuelle belastning | `aktuel_hest_id` opdateres (felt-LWW) + `Omplacering` 🧾⛓ + SSE `plads.opdateret` (US3 AS5) |
| `RegistrerOensker` | `{ rytter_id, maaned, hest_ids: [1., 2., 3.] }` | Ridelærer | Rytteren er på et af underviserens hold. Højst 3 unikke heste | `Elevoenske` upsert |
| `VikarLogin` | `{ vikarkode_id, fulde_navn }` | (anonym på betroet enhed) | Koden er `Aktiv` på server og ikke udløbet | Kode → `Anvendt`, `AuditHaendelse(VIKAR_LOGIN)` + `DashboardNotifikation` (US3 AS2) |

### Åbent fremmøde og korrektion

En lektions fremmøde er **åbent** fra 30 min. før start, indtil ridelæreren trykker "Afslut hold". Senest 30 min. efter lektionens slut lukkes det automatisk (`Lektion.fremmoede_lukket`).

- **Mens det er åbent**: ændringer sendes som nye `RegistrerFremmoede`-rækker uden begrundelse. De er stadig append-only og auditlogges. Det bevarer SC-001, fordi undtagelser efter "Markér alle" ikke kræver tekst.
- **Når det er lukket**: alle ændringer er `KorrigerFremmoede` med påkrævet begrundelse (US1 AS5, FR-017). Offline afgøres "åben/lukket" ud fra lektionens tider og enhedens ur. Serveren validerer igen.

## 4. Push-svar pr. kommando

| `status` | Betydning | Enhedens reaktion |
|---|---|---|
| `Anvendt` | Gemt på serveren | Fjern fra outbox |
| `AlleredeAnvendt` | Duplikat (idempotent) | Fjern fra outbox |
| `Konflikt` | Gemt, men tabt i LWW eller samtidig modstridende hændelse. Konflikt logget | Fjern fra outbox. Anvend serverens tilstand ved næste pull |
| `Afvist` | Valideringsfejl (f.eks. `HC01_DAGSGRAENSE` ved omplacering, fordi en anden enhed allerede har brugt hestens 3. lektion) | Fjern fra outbox, vis ikke-blokerende advarsel og tilbyd nye top-3. Afvisningen auditlogges |

**Vigtigt for velfærd**: en omplacering, der var lovlig offline, kan blive ulovlig, når andre enheders hændelser når serveren. Serveren afviser den så (Princip I har forrang for LWW). Ridelæreren får besked ved næste sync og kan vælge ny hest. Risikoen er begrænset til samme dag og samme hest og vises som `SYNK_KONFLIKT` på dashboardet.

## 5. Konfliktregler

| Data | Regel |
|---|---|
| Fremmøde (append-only) | Begge hændelser gemmes. Afledt status = højeste `klient_tidspunkt`. Forskellige statusser fra forskellige enheder for samme plads inden for 10 min. giver `SYNK_KONFLIKT` |
| `LektionsPlads.aktuel_hest_id` | Felt-LWW på `klient_tidspunkt`, men kun hvis Welfare Guard består. Ellers `Afvist` |
| `Hest.sundhedsstatus` | **Fail-safe**: ude af drift vinder altid over `Aktiv`, hvis de ligger inden for samme sync-vindue. Ellers LWW. Altid logget |
| `VikarEngangskode` brugt på 2 enheder offline | Begge sessioner gælder den dag. Kode `Anvendt` af den første. `SYNK_KONFLIKT` + notifikation |
| Clock-skew | Hvis serveren registrerer, at `klient_tidspunkt` afviger mere end 5 min. fra servertiden ved online-push, markeres enheden, og afvigelsen gemmes. LWW bruger stadig klienttid (spec) |

## 6. Pull

`GET /sync/pull?cursor=<opaque>` returnerer `{ cursor, aendringer[] }` for entiteterne `lektion`, `plads`, `hest`, `bruger` (PIN-hashes til lokal oplåsning) og `vikarkode` (kun hashes af aktive koder). Vinduet er **i dag + 6 dage**. Ældre data slettes lokalt (dataminimering).

## 7. Offline-oplåsning

1. Brugeren taster en 4-cifret PIN.
2. Enheden udregner PBKDF2(PIN, salt pr. bruger) og sammenligner med de cachede hashes. Ved match oprettes en lokal session, og en `AuditHaendelse(LOGIN_PIN)` lægges i outboxen. Mål: under 500 ms, krav: under 2 sek. (US1 AS1).
3. Efter 5 fejl spærres i 60 sek.
4. En 6-cifret kode matches mod de cachede vikarkode-hashes. Ved match kræves fulde navn, og `VikarLogin` lægges i outboxen. Koden markeres lokalt som brugt.

## 8. Sync-triggere

Sync udløses ved: `online`-event, app-fokus, efter hver ny kommando (debounce 2 sek.), hvert 30. sek. når enheden er online, og manuelt via synkikonet. Outboxen tømmes i batches på højst 500.

## 9. Synlig status (UI-kontrakt)

Synkindikatoren er altid synlig i staldens topbar:

- 🟢 **Online – alt synkroniseret**
- 🟡 **Offline – N ændringer gemt lokalt** (ingen fejlfarve; offline er normal drift)
- 🔵 **Synkroniserer…**
- 🟠 **N advarsler fra sync** (f.eks. en afvist omplacering). Tryk for at se detaljer.
