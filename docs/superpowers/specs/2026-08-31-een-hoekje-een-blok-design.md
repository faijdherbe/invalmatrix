# Ontwerp: een hoekje, een blok

Datum: 31 augustus 2026. Branch: `hoekjes`.

De matrix draagt nu twee gekleurde hoekjes op een vakje, en de detailweergave eronder drie soorten
notitie. Welke notitie bij welk hoekje hoort, is niet af te lezen. Erger nog, de kleur wijst de
verkeerde kant op: het gele hoekje rechtsboven suggereert dat het bij het gele blok "Let op"
hoort, en dat is precies het blok waar het niet bij hoort.

Dit ontwerp brengt het terug tot een hoekje en een blok die elkaar aanwijzen.

## Wat er nu staat

In het overzicht:

- Een **geel hoekje rechtsboven** voor het maximum van twee invallers uit artikel 5.3.5.3. In de
  legenda: "mag, met een kanttekening die je ziet zodra je op het vakje klikt."
- Een **paars hoekje linksonder** als het oordeel rust op een punt dat het reglement openlaat.

In de detailweergave, na een klik:

- Een **paars blok** met de openstaande onduidelijkheden. Dat hoort bij het paarse hoekje.
- Een **geel blok "Let op"** met drie waarschuwingen die deze tool niet kan beoordelen
  (niveaubepaling, beslissingswedstrijd, andere vereniging). Dat hoort bij geen enkel hoekje en
  verschijnt bij elke toegestane uitkomst.
- Een lijst **Voorwaarden**, ongemarkeerd, en daarin staat de regel die bij het gele hoekje hoort.

## Wat de cijfers zeggen

Gemeten over alle 150 overzichten (drie periodes maal elke klasse waarin ingevallen kan worden),
samen 6750 vakjes:

- Het gele hoekje staat op 90 vakjes, en op **elk** van die 90 staat ook het paarse hoekje. Dat is
  geen toeval: onduidelijkheid #13 stelt over datzelfde artikel 5.3.5.3 de vraag of dat maximum
  altijd geldt. Twee hoekjes, twee kleuren, een artikel.
- Het gele hoekje komt nooit samen met een ander voorwaardelabel voor. Het staat altijd alleen.
- Het paarse hoekje staat op 81 procent van de vakjes, per overzicht tussen de 60 en 100 procent.

## Het besluit

**1. Het gele hoekje verdwijnt. Max twee wordt een gewoon label.**

Het maximum van twee invallers is een voorwaarde, net als "mits", "lft" en "team". Het krijgt het
label `max 2` in het vakje en een regel in de legenda, en verliest zijn eigen markering.

**2. Het paarse hoekje verhuist naar rechtsboven.**

Daar komt ruimte vrij, en linksonder botste het hoekje met de leesrichting van de matrix. Er is
daarna nog maar een hoekje in de hele matrix, dus verwarring over welk hoekje bedoeld wordt kan
niet meer ontstaan.

**3. Hoekje en blok delen hetzelfde woord.**

De legendaregel en de kop van het blok in de detailweergave beginnen allebei met "Onduidelijk", en
delen de paarse kleur:

- Legenda: `Onduidelijk: het reglement laat hier iets open. Klik op het vakje om te zien wat.`
- Kop van het blok: `Onduidelijk: het reglement laat hier 3 punten open`

**4. Het blok "Let op" wordt grijs.**

Het hoort bij geen markering en geldt bij elke toegestane uitkomst. Grijs zegt dat. Daarna
betekent geel op de hele pagina nog maar een ding: er geldt een voorwaarde.

**5. De mobiele weergave volgt.**

De gele ring om de pillen vervalt, de paarse blijft, en `max 2` verschijnt als label achter de
klasse, net als in het grid.

## Wat dat doet met het oordeel

Niets. Geen enkele uitkomst verandert, geen enkele voorwaarde vervalt.

Wel verandert de kleur van 90 vakjes: een vakje waarvan max twee de enige voorwaarde was, was
groen ("ja") en wordt geel ("max 2"). Dat is de bestaande regel van `cellColor()`, die geel maakt
zodra er een zichtbare voorwaarde is. Die vakjes waren de enige plek waar een voorwaarde gold en
de kleur dat verzweeg, dus dit repareert meteen een tweede fout: het hoekje was de enige drager
van die informatie en die drager verdwijnt.

## Waar het in de code landt

`rules.js`, `data.js` en `uncertainties.js` blijven ongemoeid. De oordelen veranderen niet, alleen
de weergave.

**Nieuw: `cell-text.js`.** De weergavegegevens die nu boven in `app.js` staan verhuizen naar een
eigen module, zodat ze getest kunnen worden. `app.js` raakt bij het importeren de DOM aan en is
daarom niet te importeren in een test, en dat is precies de reden dat `article-text.js`,
`selection.js` en `uncertainty-text.js` al bestaan. Dit volgt hetzelfde patroon.

Hierheen verhuizen, ongewijzigd op de toevoeging van max twee na:

- `STATUS_ORDER`, `STATUSES`
- `REQUIREMENT_ORDER`, `REQUIREMENTS`, uitgebreid met
  `"max-two": { short: "max 2", description: "er mogen maximaal twee spelers invallen zonder toestemming van de competitieleiding (artikel 5.3.5.3)" }`
- `COMBINATION_EXPLANATION`
- `visibleRequirements()`, `requirementsLabel()`, `cellColor()`

`app.js` importeert ze en houdt alleen de HTML-opbouw. De filter in `visibleRequirements()` kan
blijven zoals hij is: hij laat door wat in `REQUIREMENTS` staat, en max twee staat daar nu in.

**`app.js`:**

- `SR_ONLY_CAVEAT`, `caveatExampleHtml()`, `caveatExplanationHtml()` en de `MARKERS`-tabel
  verdwijnen. Er is nog maar een markering, dus de tabel heeft geen werk meer: `cellHtml()` en de
  mobiele lijst kijken rechtstreeks naar `cell.uncertain`.
- `SR_ONLY_UNCERTAIN` wordt `" (onduidelijk: het reglement laat hier iets open)"`, hetzelfde woord
  als in de legenda.
- `uncertaintyExplanationHtml()` krijgt de nieuwe tekst uit punt 3.
- `cautionBlockHtml()` blijft, alleen de CSS eronder verandert.
- De naam `caveat-example` in de legenda slaat straks nergens meer op en wordt `marker-example`.

**`uncertainty-text.js`:**

- `cellMarkers()` verdwijnt. Hij bestond om twee markeringen in een vaste volgorde te zetten en er
  is er nog maar een.
- `uncertaintyHeading(count)` krijgt de nieuwe tekst:
  `Onduidelijk: het reglement laat hier ${count} punt${count === 1 ? "" : "en"} open`.

**`style.css`:**

- `.corner-triangle` en `.caveat-example` verdwijnen, `.marker-example` komt ervoor terug.
- `.uncertain-corner` tekent rechtsboven, met `::after` in plaats van `::before`. Het commentaar
  dat uitlegt waarom er twee hoeken en twee pseudo-elementen nodig waren, vervalt met de reden.
- `.mobile-class.caveat` en `.mobile-class.caveat.uncertain` verdwijnen, `.mobile-class.uncertain`
  blijft.
- `.caution` krijgt `border-left: 5px solid var(--grey)` en `background: var(--grey-surface)`, en
  de kop erin de grijze kleur in plaats van de gele.

**`README.md`:** de passage die de twee hoekjes beschrijft, gaat mee.

## Tests

Eerst de test, dan de code, zoals `CLAUDE.md` voorschrijft.

Nieuw `test/cell-text.test.js`:

- `max 2` staat in `REQUIREMENTS` en in `REQUIREMENT_ORDER`, met het artikelnummer 5.3.5.3 in de
  beschrijving.
- `requirementsLabel({ requirements: ["max-two"] })` geeft `"max 2"`, en een combinatie met een
  ander label geeft ze in de vaste volgorde van `REQUIREMENT_ORDER`.
- `cellColor()` geeft `conditional` voor een vakje waarvan max twee de enige voorwaarde is. Dat is
  de kleurverandering van 90 vakjes, en die moet vastliggen.
- Elke waarde in `REQUIREMENT_ORDER` heeft een `short` en een `description`, zodat een nieuwe
  voorwaarde niet stilletjes zonder legendaregel kan blijven.

Aanpassen in `test/uncertainty-text.test.js`:

- De vijf tests op `cellMarkers()` vervallen met de functie. Ze legden vast dat een vakje met
  `max-two` de gele markering kreeg en dat beide markeringen in een vaste volgorde stonden. Die
  verwachting is achterhaald: er is nog maar een markering en `max-two` is een voorwaarde
  geworden. Ze worden vervangen door tests op de nieuwe tekst van `uncertaintyHeading()`, enkelvoud
  en meervoud, die allebei met "Onduidelijk" beginnen.

`test/rules.test.js` verandert niet. De oordelen en de `requirements`-lijsten blijven precies wat
ze waren, en dat de tests daar blijven staan is het bewijs dat dit een weergavewijziging is.

## Wat expliciet blijft staan

- Ticket #13 blijft open. De vraag of dat maximum altijd geldt is niet beantwoord, alleen de
  dubbele markering ervoor verdwijnt. De onduidelijkheid blijft in het paarse blok staan waar hij
  hoort, en `uncertainties.js` verandert niet.
- Het blok "Let op" blijft inhoudelijk hetzelfde en blijft bij elke toegestane uitkomst staan.
- Het paarse hoekje blijft per vakje zichtbaar, ook al staat het op 81 procent van de vakjes. Dat
  is bewust: liever een markering die vaak staat dan een coach die een antwoord voor harder aanziet
  dan het is.

## Ticket

Dit is een fout in de pagina, dus er komt een ticket op
https://github.com/faijdherbe/invalmatrix/issues dat beschrijft dat de twee hoekjes en de drie
notitieblokken niet te koppelen zijn, met deze spec als oplossingsrichting. Het ticket gaat dicht
in dezelfde ronde als waarin dit is doorgevoerd, met de commit erbij en met hoe is vastgesteld dat
het echt klopt.

Het is geen `Onzeker:`-ticket, dus er hoort geen regel in `uncertainties.js` bij en
`tools/check-uncertainties.mjs` blijft er stil onder.
