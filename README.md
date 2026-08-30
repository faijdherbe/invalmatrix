# Invalmatrix

Beantwoordt de vraag of een speler uit het ene team mag invallen in het andere, volgens het
KNHB Bondsreglement 2026 en de tabel klassengrenzen 2026-2027.

Live op https://faijdherbe.github.io/invalmatrix/

## Wat het wel en niet dekt

Wel: veldhockey, seizoen 2026-2027, jeugdcategorieen O11 tot en met O18, categorie II.

Niet: zaalhockey, senioren, O25, 30+, 45+, reserveteams, combiteams en categorie I (de
Landelijke Competitie en de Super- en Topklasse van O16 en O18, en de Super Competitie en
IDC van O14). Voor die gevallen doet de pagina bewust geen uitspraak.

## Hoe de pagina werkt

Je kiest eerst bij welk team er ingevallen moet worden (leeftijdscategorie en klasse). Daarna
verschijnt een raster met per leeftijdscategorie en klasse wat daar mag invallen. Een klik op
een vakje toont het volledige oordeel, met een optioneel veld voor de geboortedatum van de
speler en de letterlijke artikelteksten waarop het oordeel is gebaseerd.

Een vakje heeft een grondslag en daarbinnen nul of meer eisen. De grondslag:

- **ja** (groen): mag, zonder voorwaarden
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

## Draaien

Er is geen build-stap. Voor lokaal bekijken:

    python3 -m http.server 8000

## Tests

Er zijn 123 tests, voor de regellogica (`rules.js`), de artikeltekst-parser (`artikeltekst.js`)
en de artikeltekst-extractie (`articles.js`):

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

`artikeltekst.js` doet alleen de weergave: het zet de letterlijke tekst uit `articles.js` om in
alinea's en opsommingsitems voor op de pagina. Het verandert de tekst zelf niet.

## Nieuw seizoen

Alles wat per seizoen wijzigt staat in `data.js`: `SEIZOEN`, `PEILDATUM`, `NIVEAU`, `KLASSEN`,
`LEEFTIJDSGRENZEN`, `CATEGORIE_I` en `CATEGORIE_I_PERIODE`. Vervang daarnaast de PDF's in
`bronnen/` en draai de artikelextractie opnieuw (zie hierboven).

## Bestanden

- `index.html`, `app.js`, `style.css`: de pagina zelf.
- `data.js`: seizoensgegevens (niveaus, klassen, leeftijdsgrenzen, categorie I).
- `rules.js`: alle regellogica, inclusief het overzicht voor het raster. `app.js` rekent zelf
  niets uit.
- `articles.js`: letterlijke artikelteksten, gegenereerd (zie hierboven, niet met de hand
  bewerken).
- `artikeltekst.js`: zet de letterlijke tekst uit `articles.js` om in weergeefbare blokken.
- `tools/extract-articles.mjs`: genereert `articles.js` uit de bron-PDF.
- `test/`: de 73 tests.
- `bronnen/`: de twee bron-PDF's van de KNHB.

## Verwant

`build.py` en `invalmatrix-meisjes-2026-2027.pdf` komen uit een eerder project dat een losse
PDF-matrix genereerde voor de meisjesjeugd. Ze staan los van deze pagina en worden er niet door
gebruikt. Zie `HANDOVER.md` voor de achtergrond van dat project en de openstaande vragen voor de
competitieleiding.
