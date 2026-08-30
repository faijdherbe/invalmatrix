# Ontwerp: Invalmatrix, invalcheck voor teammanagers

Datum: 2026-08-30
Repo: git@github.com:faijdherbe/invalmatrix.git
Publicatie: GitHub Pages op https://faijdherbe.github.io/invalmatrix/

## Doel

Een teammanager wil op zaterdagochtend weten of een bepaalde speler mag invallen in een
bepaald team. De pagina beantwoordt die vraag met een groen of rood oordeel, de voorwaarden
die er nog bij horen, en de letterlijke tekst van de artikelen waarop het oordeel rust.

De bestaande matrix-PDF en `build.py` blijven ongewijzigd naast dit project bestaan.

## Scope fase 1

In scope:

- Veldhockey.
- Seizoen 2026-2027, vast ingebouwd.
- Jeugdcategorieen O11, O12, O14, O16 en O18, jongens en meisjes.
- Speelgerechtigdheid categorie II, hoofdstuk 5 van het Bondsreglement 2026.

Buiten scope, expliciet benoemd op de pagina:

- Zaalhockey.
- Senioren, O25, 30+, 45+ en reserveteams.
- Combiteams (`-C`).
- Categorie I, hoofdstuk 4.
- Jongste jeugd O10 en lager, die staat niet in de tabel klassengrenzen.

## Invoer

Een formulier, geen knop, het antwoord werkt bij elke wijziging direct bij.

| Veld | Toelichting |
|---|---|
| Bron: categorie | O11, O12, O14, O16, O18. Het team waar de speler op de teamlijst staat. |
| Bron: klasse | Keuzelijst die per categorie de klassen uit de tabel klassengrenzen toont. |
| Geboortedatum | Optioneel. |
| Doel: categorie | Idem. Het team waar zij zou invallen. |
| Doel: klasse | Idem. |

Boven het formulier staat vast vermeld: veldhockey, seizoen 2026-2027.

## Niveaumapping

Overgenomen uit de KNHB tabel klassengrenzen veld/zaalhockey 2026-2027, pagina 1. De tabel is
een ladder waarin elke rij een niveau is en elke kolom een leeftijdscategorie. Het rijnummer is het
absolute niveau. Lager getal is hoger niveau.

| Niveau | O11/O12 | O14 | O16 | O18 |
|---|---|---|---|---|
| 1 | | | | Landelijk |
| 2 | | | Landelijk | Super O18/Topklasse |
| 3 | | | Super O16/Topklasse | Subtopklasse |
| 4 | | Super O14/IDC-O14/Topklasse | Subtopklasse | 1e klasse |
| 5 | | Subtopklasse | 1e klasse | 2e klasse |
| 6 | | 1e klasse | 2e klasse | 3e klasse |
| 7 | 1e klasse | 2e klasse | 3e klasse | 4e klasse |
| 8 | 2e klasse | 3e klasse | 4e klasse | 5e klasse en lager |
| 9 | 3e klasse | 4e klasse | 5e klasse en lager | |
| 10 | 4e klasse | 5e klasse en lager | | |
| 11 | 5e klasse en lager | | | |

O11 en O12 staan in de tabel in dezelfde kolom en spelen bij gelijke klasse dus op gelijk niveau.

Deze mapping is identiek aan `LEVEL` in `build.py` (op een constante verschuiving na) en wordt
bevestigd door alle voorbeelden in artikel 5.3.5.1 tot en met 5.3.5.3.

## Klassen in de keuzelijst

De tabel klassengrenzen vat de onderkant samen als een enkele regel "5e klasse en lager",
maar verenigingen hebben teams die daadwerkelijk in de 6e of 7e klasse spelen. De keuzelijst
biedt daarom per categorie de klassen apart aan tot en met de 8e klasse, waarbij de 5e klasse en
alles daaronder op hetzelfde absolute niveau uitkomt.

| Categorie | Klassen in de keuzelijst |
|---|---|
| O11 | 1e, 2e, 3e, 4e, 5e t/m 8e |
| O12 | 1e, 2e, 3e, 4e, 5e t/m 8e |
| O14 | Super O14/IDC-O14/Topklasse, Subtopklasse, 1e, 2e, 3e, 4e, 5e t/m 8e |
| O16 | Landelijk, Super O16/Topklasse, Subtopklasse, 1e, 2e, 3e, 4e, 5e t/m 8e |
| O18 | Landelijk, Super O18/Topklasse, Subtopklasse, 1e, 2e, 3e, 4e, 5e t/m 8e |

Hierdoor blijft de uitzondering van artikel 5.3.5.3 betekenisvol: twee teams in de 5e klasse en
lager binnen dezelfde categorie staan op gelijk niveau, maar het reglement legt daar een maximum
van twee invallers zonder toestemming op. Dat maximum passen wij toe op alle onderlinge
combinaties vanaf de 5e klasse, ook waar de niveauvergelijking op zichzelf al groen zou geven.
Dat is dezelfde conservatieve keuze als in `build.py` en staat als punt 5 bij de openstaande
punten.

## Categorie I

Deze klassen vallen onder hoofdstuk 4 en krijgen geen groen of rood oordeel maar een melding
dat de tool ze niet dekt:

- O18 Landelijk, Super O18/Topklasse.
- O16 Landelijk, Super O16/Topklasse.
- O14 Super O14/IDC-O14/Topklasse.

Deze klassen wisselen gedurende het seizoen van categorie en krijgen een melding met uitleg in
plaats van een oordeel:

- O18 Subtopklasse: categorie I tot en met de herfstvakantie, daarna categorie II.
- O16 Subtopklasse: categorie I tot de winterstop, daarna categorie II.

O14 Subtopklasse is categorie II en wordt gewoon beoordeeld.

## Regellogica

`assess(bron, doel, geboortedatum)` is een pure functie en geeft terug:

```
{
  verdict: "toegestaan" | "niet toegestaan" | "buiten scope",
  samenvatting: string,
  voorwaarden: string[],
  redenering: string[],
  leeftijd: null | { leeftijdOpPeildatum, meldingen: string[] },
  artikelen: string[]
}
```

Volgorde van beoordelen:

1. Valt de bron of het doel in categorie I, dan `buiten scope` met uitleg. Ook als maar een van
   beide daarin valt, want dan gelden de regels van hoofdstuk 4 die deze tool niet kent. Klaar.
2. Zelfde leeftijdscategorie en beide teams 5e klasse of lager, dan toegestaan met de
   voorwaarde van artikel 5.3.5.3 (maximaal 2 invallers zonder toestemming van de
   competitieleiding).
3. Bron op gelijk of lager niveau dan doel, dan toegestaan zonder voorwaarden over aantallen,
   artikel 5.3.5.1.
4. Bron precies een niveau hoger dan doel, dan toegestaan onder de voorwaarden van artikel
   5.3.5.2: aantoonbaar maximaal 11 beschikbare spelers (O11: 9) uit eigen of lager niveau,
   aantoonbaar geen invallers uit gelijk of lager niveau, maximaal 2 invallers inclusief een vaste
   doelverdediger. Voor het inlenen van een doelverdediger geldt de eis over het aantal eigen
   spelers niet.
5. Anders niet toegestaan zonder dispensatie van de competitieleiding.

Komt de bron uit een oudere leeftijdscategorie dan het doel, dan komt daar altijd de voorwaarde
bij dat de speler moet voldoen aan de leeftijdsgrenzen van de categorie waarin zij invalt
(artikel 5.3.5.1, derde bullet, en 3.1.3).

## Leeftijdstoets

Alleen actief als de geboortedatum is ingevuld. Peildatum is 1 oktober 2026.

Leeftijdsgrenzen volgens artikel 3.1.1, uitgedrukt als leeftijd op de peildatum:

| Categorie | Leeftijd | Geboren |
|---|---|---|
| O11 | 10 | 2 oktober 2015 t/m 1 oktober 2016 |
| O12 | 11 | 2 oktober 2014 t/m 1 oktober 2015 |
| O14 | 12 of 13 | 2 oktober 2012 t/m 1 oktober 2014 |
| O16 | 14 of 15 | 2 oktober 2010 t/m 1 oktober 2012 |
| O18 | 16 of 17 | 2 oktober 2008 t/m 1 oktober 2010 |

Drie controles:

1. Voldoet de speler aan de leeftijdsgrenzen van de doelcategorie? Zo nee en zij is te oud, dan
   wordt een groen oordeel alsnog rood: uitkomen in een categorie waar je niet in past mag niet
   zonder dispensatie (artikel 3.1.3).
2. Is zij te jong voor de doelcategorie, dan mag het alleen met dispensatie. Ook rood, met de
   toevoeging dat dispensatie mogelijk is.
3. Is zij maximaal 1 jaar te oud voor haar eigen categorie en staat haar bronteam in de 2e klasse
   of lager, dan valt zij onder de uitzondering van artikel 5.2.4 en mag zij uitsluitend uitkomen
   voor het team waarop zij op de teamlijst staat. Dat maakt invallen altijd rood, ongeacht de
   klassengrens. Dit geldt voor O12 tot en met O18.

De tool kan niet weten of de speler daadwerkelijk een van de twee toegestane oudere spelers op
de teamlijst is; controle 3 meldt daarom dat dit het geval is als zij onder die uitzondering valt.

Randgeval: het reglement gebruikt "voor 1 oktober" (artikel 3.1.1) en "op 1 oktober"
(artikel 5.2.4, 5.2.5) door elkaar. Wij hanteren 1 oktober als peildatum, gelijk aan `build.py`.
Bij een geboortedatum van precies 1 oktober toont de pagina een waarschuwing dat dit een
randgeval is dat bij de competitieleiding nagevraagd moet worden.

## Artikelteksten

Elke artikelverwijzing in het resultaat toont het volledige sub-artikel, woordelijk gelijk aan het
Bondsreglement 2026, inclusief de opsommingen en de voorbeelden.

Om te voorkomen dat overgetypte tekst gaat afwijken van de bron:

- `tools/extract-articles.mjs` haalt de artikelen uit `bronnen/bondsreglement-2026.pdf` via
  `pdftotext -layout` en schrijft `articles.js`.
- Een test vergelijkt elke opgenomen artikeltekst opnieuw met de PDF en faalt bij elk verschil.
- Regeleindes en opsommingstekens blijven behouden. Kop- en voetteksten en paginanummers
  van de PDF worden verwijderd, dat is de enige toegestane bewerking en de test houdt daar
  rekening mee.

Op te nemen artikelen: 3.1.1, 3.1.3, 5.2.4, 5.2.5, 5.3.1, 5.3.2, 5.3.3, 5.3.4, 5.3.5, 5.3.5.1,
5.3.5.2, 5.3.5.3, 5.3.5.4, plus de definitie van categorie I en II uit hoofdstuk 2.

De artikelen staan in het resultaat ingeklapt, uitklappen toont de letterlijke tekst.

## Weergave van het resultaat

In deze volgorde:

1. Balk, groen of rood, met een zin in gewone taal.
2. Voorwaarden, alleen die op dit geval van toepassing zijn. Staat direct onder de balk, want
   groen met voorwaarden is de gebruikelijke uitkomst bij lenen uit een hoger team.
3. Waarom, de redenering uitgeschreven met de niveauvergelijking erin.
4. Leeftijd, alleen bij ingevulde geboortedatum.
5. Artikelen, ingeklapt, met de letterlijke tekst.

Onderaan een vaste voetnoot: welk seizoen, welke bronnen, dat het om veldhockey en categorie II
gaat, en dat bij twijfel de competitieleiding beslist. De twee bron-PDF's worden meegepubliceerd
en gelinkt.

## Bestanden

```
index.html
style.css
app.js                    formulier en weergave, enige bestand dat de DOM kent
rules.js                  assess() en hulpfuncties, puur
data.js                   niveautabel, klassen per categorie, leeftijdsgrenzen, categorie I-lijst
articles.js               gegenereerd, letterlijke artikelteksten
tools/extract-articles.mjs
test/rules.test.js
test/articles.test.js
bronnen/bondsreglement-2026.pdf
bronnen/tabel-klassengrenzen-veld-zaal-2026-2027.pdf
```

Native ES-modules, geen bundler en geen build-stap. GitHub Pages serveert de map zoals hij is.
Tests draaien met `node --test`, zonder dependencies.

## Tests

`test/rules.test.js` dekt in elk geval:

- De twaalf asserts uit `build.py`, ongewijzigd overgenomen.
- De vier voorbeelden uit artikel 5.3.5.1: JO16-3 uit JO16-2, MO16-1 uit MO16-2,
  JO18-2 uit JO14-2, MO16-3 uit MO18-3.
- De vier voorbeelden uit artikel 5.3.5.2 en 5.3.5.3, voor zover ze over jeugdteams gaan:
  JO16-2 (1e) uit JO18-3 (1e) onder voorwaarden, JO16-3 (3e) uit JO18-3 (2e) nooit,
  JO16-3 (3e) uit JO18-4 (3e) onder voorwaarden, MO14-6 (6e) uit MO14-5 (4e) onder voorwaarden.
- Categorie I-invoer levert `buiten scope`, niet groen of rood.
- Leeftijd: te oud voor de doelcategorie maakt groen rood, te jong meldt dispensatie, de
  uitzondering van 5.2.4 maakt groen rood, en een geboortedatum van precies 1 oktober geeft de
  randgevalwaarschuwing.

`test/articles.test.js` vergelijkt elke artikeltekst in `articles.js` met de PDF.

## Deploy

De repo heeft nog geen commits en staat op `master`. Hernoemen naar `main`, eerste commit,
pushen, daarna Pages aanzetten op main en de root van de repo.

## Openstaande punten voor de competitieleiding

Deze staan niet in de code maar horen op de lijst met vragen:

1. De tabel klassengrenzen zegt bij de toelichting "O12- en O14-spelers mogen invallen bij O25-
   en seniorenteams", terwijl de bijbehorende tabellen alleen mappings voor O16- en O18-spelers
   geven. Dat leest als een fout in de tabel.
2. De tabel zet bij O16 en O18 geen sterretje bij Landelijk, terwijl hoofdstuk 2 van het reglement
   de Landelijke Competitie wel onder categorie I schaart.
3. Het reglement gebruikt "voor 1 oktober" en "op 1 oktober" door elkaar.
4. O11 en O12 staan in de tabel in dezelfde kolom, terwijl artikel 5.3.5.1 spreekt van een klasse
   erbij per leeftijdscategorie. Wij volgen de tabel, net als `build.py`.
5. Artikel 5.3.5.3 legt een maximum van twee invallers op bij de 5e klasse en lager, terwijl die
   klassen volgens de tabel op gelijk niveau staan en artikel 5.3.5.1 daar geen maximum kent.
   Wij passen het maximum toe op alle combinaties vanaf de 5e klasse.
