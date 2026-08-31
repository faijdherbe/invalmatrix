# Werkafspraken voor dit project

Deze pagina beantwoordt of een jeugdhockeyspeler uit het ene team mag invallen in het andere,
volgens het KNHB Bondsreglement. Doelgroep: coaches en teammanagers. Geen build-stap, geen
framework, alleen ES-modules die de browser direct laadt.

## Taal

De code is Engels, alles wat een mens leest is Nederlands.

**Engels:** variabelen, functies, constanten, bestandsnamen, DOM-id's, CSS-klassen, waarden die
alleen intern gebruikt worden (zoals de namen van gronden en eisen), commentaar in de code, en de
namen van tests.

**Nederlands:** elke tekst die de gebruiker op de pagina te zien krijgt, de letterlijke
artikelcitaten uit het Bondsreglement, `README.md`, dit bestand, de tickets op
GitHub, en commitberichten.

Waarom die splitsing: de code wordt in het Engels onderhouden, maar de doelgroep is Nederlands en
de bron is een Nederlandstalig reglement. Een artikelcitaat vertalen zou de onderbouwing waardeloos
maken, want dan staat er niet meer wat er in het reglement staat.

Verder in alle talen: geen em-dash, geen emoji. Een uitzondering: het waarschuwingsteken voor het
blok met openstaande onduidelijkheden, in `style.css`. Dat moet in een oogopslag als waarschuwing
lezen, en een uitgeschreven variant wordt door een schermlezer als losse leestekens voorgelezen.

De toon van het Nederlands is casual en direct.

## Het reglement is de enige bron

Voor elke beslissing over een invalregel geldt uitsluitend `bronnen/bondsreglement-2026.pdf`.
Niet `README.md`, en niet het commentaar dat al in de code staat. Die kunnen
achterhaald zijn, en een fout die daaruit is overgenomen plant zich voort.

De tabel klassengrenzen (`bronnen/tabel-klassengrenzen-veld-zaal-2026-2027.pdf`) mag alleen worden
gebruikt om niveaus van klassen te vergelijken, omdat artikel 5.3.5 daar expliciet naar
doorverwijst. Voor al het andere is het reglement leidend.

Lezen kan met `pdftotext -layout -f <van> -l <tot> bronnen/bondsreglement-2026.pdf -`.

Doe geen aannames. Laat het reglement iets in het midden, of spreekt het zichzelf tegen, dan kies
je de behoudende kant (die nooit ten onrechte "ja" zegt), leg je de keuze vast in het commentaar,
en maak je er een ticket van. Zie hieronder.

## Superpowers

Het gebruik van de superpowers-skills is verplicht, niet optioneel.

- Roep aan het begin van een taak de skills aan die van toepassing zijn, vóór je iets anders doet.
- Implementatiewerk gaat via subagents, niet in de hoofdsessie.
- Test-driven: eerst de test, die aantoonbaar faalt om de juiste reden, dan pas de code.
- Per taak een implementer en daarna een aparte reviewer, die zowel op spec-naleving als op
  codekwaliteit oordeelt.
- Aan het eind een review over de hele branch.
- Houd de voortgang bij in een ledger, want die overleeft een samengevat gesprek en je geheugen
  niet.

## Tickets

Elke fout en elke onzekerheid wordt een ticket op https://github.com/faijdherbe/invalmatrix/issues

- Vind je iets dat niet klopt, maak er een ticket van, ook als je het meteen zelf oplost.
- **Sluit een ticket zodra de taak is afgerond.** Zet er een toelichting bij die vertelt wat er is
  gewijzigd, in welke commit, en hoe je hebt vastgesteld dat het echt opgelost is.
- Los je iets maar gedeeltelijk op, sluit het ticket dan niet. Zet erbij wat er nog open staat.
- Onzekerheden die een antwoord van de KNHB-competitieleiding nodig hebben blijven open staan.
  Die kun je niet zelf beslissen, en een gok die eruitziet als een besluit is erger dan een open
  vraag.

### Onduidelijkheden op de pagina

Elke onzekerheid die het oordeel van de gebruiker raakt staat twee keer vast: als ticket op GitHub
en als regel in `uncertainties.js`. De pagina toont die regel bij elke combinatie waarvoor hij
geldt, zodat een coach ziet dat het antwoord op een keuze rust die het reglement niet uitspreekt.

- Vind je een nieuwe onduidelijkheid, maak dan het ticket en zet in dezelfde commit de regel in
  `uncertainties.js`, met een predicaat dat precies de combinaties raakt die het betreft.
- Sluit je een ticket, haal dan in dezelfde commit die regel weg, samen met de tests erbij.
- Los je iets maar gedeeltelijk op, dan blijft de regel staan. Pas wel de tekst aan als er nu iets
  anders onduidelijk is dan eerst.
- `node tools/check-uncertainties.mjs` controleert beide richtingen: een gesloten ticket dat nog een
  waarschuwing heeft, en een openstaand `Onzeker:`-ticket dat er geen heeft. Het script praat met
  GitHub en zit daarom bewust niet in `npm test`.

### De bewaking

Twee GitHub Actions draaien mee: `tests` draait `npm test` bij elke push, en `onduidelijkheden`
draait het controlescript bij elke push en elke maandagochtend. Kijk aan het begin van een taak met
`gh run list --limit 5` of de laatste runs groen staan, en repareer wat rood staat voor je aan iets
nieuws begint.

## Huisregels voor de code

- Elke wijziging gaat vergezeld van tests. Sneuvelt een bestaande test, pas hem dan aan en leg uit
  waarom de oude verwachting achterhaald was. Verwijder hem niet.
- Alle regellogica hoort in `rules.js`, alle seizoensgegevens in `data.js`. `app.js` rekent niets
  zelf uit over invalregels; dat is alleen weergave.
- `articles.js` is gegenereerd en wordt nooit met de hand bewerkt. Draai `node tools/extract-articles.mjs`.
  `test/articles.test.js` draait die extractie opnieuw en vergelijkt, dus handmatige bewerkingen
  vallen door de mand.
- Noem in tekst die de gebruiker ziet het artikelnummer dat het oordeel draagt.
- Geen uitlijning van assignments over meerdere regels.

## Commando's

```
npm test                             # de testsuite, draait node --test test/
node tools/extract-articles.mjs      # genereert articles.js opnieuw uit de bron-PDF
node tools/check-uncertainties.mjs   # controleert of de waarschuwingen bij de open tickets passen
python3 -m http.server 8000          # de pagina lokaal bekijken
```

## Nieuw seizoen

Alles wat per seizoen wijzigt staat in `data.js`. Vervang daarnaast de PDF's in `bronnen/` en draai
de artikelextractie opnieuw.
