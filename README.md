# Invalmatrix voor de veldhockeycompetities van de KNHB

Beantwoordt de vraag of een speler uit het ene team mag invallen in het andere, volgens het
KNHB Bondsreglement 2026 en de tabel klassengrenzen 2026-2027.

Live op https://faijdherbe.github.io/invalmatrix/

## Wat het wel en niet dekt

Wel: veldhockey, seizoen 2026-2027, jeugdcategorieen O11 tot en met O18, categorie II.

Niet: zaalhockey, senioren, O25, 30+, 45+, reserveteams, combiteams en categorie I (de
Landelijke Competitie en de Super- en Topklasse van O16 en O18, en de Super Competitie van
O14). Voor die gevallen doet de pagina bewust geen uitspraak.

Drie klassen wisselen halverwege het seizoen van categorie: de Subtopklasse van O18 (vanaf de
herfstvakantie), de Subtopklasse van O16 en de IDC-O14 (beide vanaf de winterstop). Daarom
vraagt de pagina eerst in welke periode van het seizoen de wedstrijd valt.

## Hoe de pagina werkt

Je kiest eerst wanneer de wedstrijd gespeeld wordt, en daarna bij welk team er ingevallen moet
worden (leeftijdscategorie en klasse). Alle drie de keuzes beginnen leeg. Zijn ze gevuld, dan
verschijnt een raster met per leeftijdscategorie en klasse wat daar mag invallen. Een klik op
een vakje toont het volledige oordeel, met een optioneel veld voor de geboortedatum van de
speler en de letterlijke artikelteksten waarop het oordeel is gebaseerd.

Een vakje heeft een grondslag en daarbinnen nul of meer eisen. De grondslag:

- **ja** (groen): mag altijd
- **nee**: mag niet
- **?**: geen uitspraak (categorie I)

Geldt er wel een voorwaarde, dan is het vakje geel en staan de korte labels van de eisen erin,
aan elkaar met een `+` als er meerdere gelden (bijvoorbeeld `mits+lft`):

- **mits**: mag alleen bij aantoonbaar te weinig spelers (artikel 5.3.5.2)
- **lft**: mag, mits de speler de juiste leeftijd heeft (artikel 5.3.5.1)
- **team**: mag niet voor spelers uit het eerste team, zonder toestemming van de
  competitieleiding (artikel 5.3.5.4)

De uitzondering van artikel 5.3.5.3 (maximaal twee invallers zonder toestemming) krijgt geen
label maar een driehoekje rechtsboven in het vakje.

## Taal in deze repo

De code is Engels: variabelen, functies, commentaar, testnamen, bestandsnamen, DOM-id's en
CSS-klassen. Alles wat een mens leest is Nederlands: de tekst op de pagina, de letterlijke
artikelcitaten, deze README, de tickets en de commitberichten. Zie `CLAUDE.md`.

## Draaien

Er is geen build-stap. Voor lokaal bekijken:

    python3 -m http.server 8000

## Tests

Er zijn 179 tests, voor de regellogica (`rules.js`), de artikeltekst-parser
(`article-text.js`), de artikeltekst-extractie (`articles.js`), de tekst voor een onvolledige
keuze (`selection.js`) en de tekst op de pagina zelf (`test/page-text.test.js`):

    npm test

of:

    node --test test/

## Artikelteksten bijwerken

De letterlijke artikelteksten in `articles.js` worden gegenereerd uit de bron-PDF met
`tools/extract-articles.mjs`. `articles.js` zelf wordt dus niet met de hand bewerkt.

    node tools/extract-articles.mjs

`test/articles.test.js` draait dezelfde extractie opnieuw en vergelijkt de uitkomst met
`articles.js`. Die test faalt zodra `articles.js` afwijkt van wat er (opnieuw) uit de PDF komt,
bijvoorbeeld na een wijziging in de bron-PDF zonder dat de extractie opnieuw is gedraaid.

`article-text.js` doet alleen de weergave: het zet de letterlijke tekst uit `articles.js` om in
alinea's en opsommingsitems voor op de pagina. Het verandert de tekst zelf niet.

## Nieuw seizoen

Alles wat per seizoen wijzigt staat in `data.js`: `SEASON`, `REFERENCE_DATE`, `PERIODS`,
`LEVELS`, `CLASSES`, `AGE_LIMITS`, `CATEGORY_I` en `CATEGORY_I_UNTIL`. Vervang daarnaast de
PDF's in `bronnen/` en draai de artikelextractie opnieuw (zie hierboven).

## Bestanden

- `index.html`, `app.js`, `style.css`: de pagina zelf.
- `data.js`: seizoensgegevens (niveaus, klassen, leeftijdsgrenzen, categorie I).
- `selection.js`: de tekst die de pagina toont zolang de keuze onvolledig is.
- `rules.js`: alle regellogica, inclusief het overzicht voor het raster. `app.js` rekent zelf
  niets uit.
- `articles.js`: letterlijke artikelteksten, gegenereerd (zie hierboven, niet met de hand
  bewerken).
- `article-text.js`: zet de letterlijke tekst uit `articles.js` om in weergeefbare blokken.
- `tools/extract-articles.mjs`: genereert `articles.js` uit de bron-PDF.
- `test/`: de 179 tests.
- `bronnen/`: de twee bron-PDF's van de KNHB.
- `CLAUDE.md`: de werkafspraken, waaronder de taalregel hieronder.
