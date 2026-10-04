
# Feature Architecture & Prioritization Matrix

---

## 1. Feature Breakdown by Operational Phase

### Fase 1: Månedlig proces – Oprettelse af holdlister

* **F1.1 – Elevønsker i database:** Elevers ønsker lagres digitalt i en database.


* **F1.2 – Digitalisering af tavs viden:** Tavs viden digitaliseres i en database under hensyntagen til GDPR.


* **F1.3 – Hestedatabase:** Database over heste med registrering af adfærd, helbred, højde mv.


* **F1.4 – Algoritmisk holdlistegenerering:** Lave holdlister digitalt, hvor kabalen automatisk løses af en algoritme.


* **F1.5 – Selvbetjening (ønsker):** Elever og forældre kan indsende ønsker direkte via en platform.


* **F1.6 – Selvbetjening (afbud):** Elever og forældre kan melde sygdom og afbud via en platform.



### Fase 2: Proces før og under undervisning

* **F2.1 – Staldelevers statusmeldinger:** Hestens helbred og adfærd kan indmeldes løbende af staldelever.


* **F2.2 – Akut heste-omplacering:** Syg hest håndteres ved, at kabale-algoritmen finder et nyt match mellem hest og elev.


* **F2.3 – Vikardækning ved lærersygdom:** Ved syg lærer kan hold- og afkrydsningslister findes digitalt af en vikar uden involvering fra den sygemeldte lærer.



### Fase 3: Afvikling af undervisning og fremmøderegistrering

* **F3.1 – Digital fremmøderegistrering:** Afkrydsningsliste udfyldes og lagres digitalt.



---

## 2. Priority Matrix (Impact vs. Effort)


|**Dimension**|**Lille indsats (Lav indsats)**|**Stor indsats (Høj indsats)**|
|---|---|---|
|**Stor Effekt**|**Hurtige gevinster (Quick Wins)**<br><br>  <br>  <br><br>• Elevers ønsker lagres digitalt i database<br><br>  <br>  <br><br>• Heste Database med adfærd, helbred, højde, etc.<br><br>  <br>  <br><br>• Heste helbred/adfærd- kan meldes af staldelever<br><br>  <br>  <br><br>• Syg Lærer – Hold og afkrydsningsliste kan hurtigt findes digitalt af ny lærer, uden hjælp af syge lærer<br><br>  <br>  <br><br>• Afkrydsningsliste udfyldes og lagres digitalt|**Strategiske nøgleprojekter**<br><br>  <br>  <br><br>• Tavs viden digitaliseres i database (GDPR-venligt)<br><br>  <br>  <br><br>• Lave holdlister digitalt Kabalen løses af en algoritme<br><br>  <br>  <br><br>• Syg Hest – Kabale algoritme kan finde ny match mellem hest og elev|
|**Lille Effekt**|_(Ingen identificerede elementer)_|**Lav prioritet (Undgå / Udskyd)**<br><br>  <br>  <br><br>• Elever/forældre kan indsende ønsker via platform<br><br>  <br>  <br><br>• Elever/forældre kan melde sygdom/afbud via platform|


## 3. Structured Data Model for Agentic Workflows

```yaml
features:
  - id: F1.1
    title: "Elevers ønsker lagres digitalt i database"
    phase: "Fase 1 - månedlig proces, oprettelse af holdlister"
    impact: High
    effort: Low
    quadrant: "Quick Win"

  - id: F1.2
    title: "Tavs viden digitaliseres i database (GDPR venligt)"
    phase: "Fase 1 - månedlig proces, oprettelse af holdlister"
    impact: High
    effort: High
    quadrant: "Strategic Project"

  - id: F1.3
    title: "Heste Database med adfærd, helbred, højde, etc"
    phase: "Fase 1 - månedlig proces, oprettelse af holdlister"
    impact: High
    effort: Low
    quadrant: "Quick Win"

  - id: F1.4
    title: "Lave holdlister digitalt Kabalen løses af en algoritme"
    phase: "Fase 1 - månedlig proces, oprettelse af holdlister"
    impact: High
    effort: High
    quadrant: "Strategic Project"

  - id: F1.5
    title: "Elever/forældre kan indsende ønsker via platform"
    phase: "Fase 1 - månedlig proces, oprettelse af holdlister"
    impact: Low
    effort: High
    quadrant: "Deprioritize / Reconsider"

  - id: F1.6
    title: "Elever/forældre kan melde sygdom/afbud via platform"
    phase: "Fase 1 - månedlig proces, oprettelse af holdlister"
    impact: Low
    effort: High
    quadrant: "Deprioritize / Reconsider"

  - id: F2.1
    title: "Heste helbred/adfærd- kan meldes af staldelever"
    phase: "Fase 2 - proces før/under undervisning"
    impact: High
    effort: Low
    quadrant: "Quick Win"

  - id: F2.2
    title: "Syg Hest - Kabale algoritme kan finde ny match mellem hest og elev"
    phase: "Fase 2 - proces før/under undervisning"
    impact: High
    effort: High
    quadrant: "Strategic Project"

  - id: F2.3
    title: "Syg Lærer - Hold og afkrydsningsliste kan hurtigt findes digitalt af ny lærer, uden hjælp af syge lærer"
    phase: "Fase 2 - proces før/under undervisning"
    impact: High
    effort: Low
    quadrant: "Quick Win"

  - id: F3.1
    title: "Afkrydsningsliste udfyldes og lagers digitalt"
    phase: "Fase 3 - afvikling af undervisning og fremmøderegistrering"
    impact: High
    effort: Low
    quadrant: "Quick Win"

```