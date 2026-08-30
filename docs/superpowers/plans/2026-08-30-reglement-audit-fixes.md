# Plan: fouten uit de reglement-audit repareren

Herkomst: een volledige doorloop van alle 2401 combinaties van leeftijdscategorie en klasse,
getoetst aan `bronnen/bondsreglement-2026.pdf`. Resultaat staat als 18 tickets op
https://github.com/faijdherbe/invalmatrix/issues

Dit plan pakt alleen de tickets op waar het Bondsreglement het antwoord eenduidig geeft en er dus
niemand bevraagd hoeft te worden: #1, #2, #4, #5, #6, #7, #8, #9, #10.

Bewust NIET in dit plan (wachten op de competitieleiding): #3, #11, #12, #13, #14, #15, #16, #17,
#18.

Branch: `fix/reglement-audit`. Basis: commit 7ffc5cb op main. 91 tests groen bij aanvang.

## Global Constraints

Deze gelden voor elke taak in dit plan. Een reviewer toetst hierop.

1. **Het Bondsreglement is de enige bron voor een regelbeslissing.** Niet HANDOVER.md, niet
   README.md, niet bestaand codecommentaar. De tabel klassengrenzen mag alleen worden gebruikt
   voor niveauvergelijking, omdat artikel 5.3.5 daar expliciet naar doorverwijst.
2. **Nederlands.** Alle code, commentaar, commitberichten en gebruikerstekst in het Nederlands.
3. **Geen em-dash, geen emoji.** Nergens, ook niet in commitberichten.
4. **Elke wijziging met tests.** Een test die aantoonbaar faalt op de oude situatie en slaagt op
   de nieuwe. Draaien met `npm test` (`node --test test/`). Bestaande tests mogen niet sneuvelen,
   tenzij de taak expliciet zegt dat een test achterhaald is; dan aanpassen, niet verwijderen.
5. **Geen uitlijning van assignments over meerdere regels.**
6. **`app.js` rekent niets zelf uit.** Alle regellogica hoort in `rules.js`, alle seizoensgegevens
   in `data.js`. `app.js` doet alleen weergave.
7. **`articles.js` wordt nooit met de hand bewerkt.** Het bestand wordt gegenereerd met
   `node tools/extract-articles.mjs`. `test/articles.test.js` draait dezelfde extractie opnieuw en
   vergelijkt; die test moet groen blijven.
8. **Verwijs in gebruikerstekst naar het artikelnummer** dat het oordeel draagt, zoals de rest van
   de tool dat al doet.
9. Commitbericht in de stijl van het project: kleine letter na het type, bijvoorbeeld
   `fix: ...` of `feat: ...`.

## Taak 1: periodetekst O16 Subtopklasse (ticket #7)

`data.js` zegt nu:

```js
export const CATEGORIE_I_PERIODE = {
  O16: { subtop: "tot de winterstop" },
  O18: { subtop: "tot en met de herfstvakantie" },
};
```

Hoofdstuk 2 van het Bondsreglement zegt letterlijk:

> O16: Landelijke Topklasse, Landelijke Subtopklasse (tot en met de winterstop), Landelijke
> Competitie en Super Competitie

Wijzig de waarde voor O16 naar exact `"tot en met de winterstop"`. De waarde voor O18 klopt al en
blijft ongewijzigd.

Test: leg in `test/rules.test.js` vast dat `categorieIMelding({ categorie: "O16", klasse: "subtop" })`
de tekst `"tot en met de winterstop"` bevat.

## Taak 2: IDC-O14 losknippen van Super O14 (ticket #5)

`data.js` plakt nu Super O14 en IDC-O14 samen in een klasse `super` en zet die volledig onder
categorie I:

```js
O14: [
  { id: "super", label: "Super O14 / IDC-O14" },
  { id: "top", label: "Topklasse" },
  ...
],
export const CATEGORIE_I = { O14: ["super"], ... };
```

Wat het Bondsreglement zegt, hoofdstuk 2:

> Onder de categorie I vallen de volgende competities:
> - Veldhockey:
>   - O14: Super Competitie

en

> Onder categorie II vallen dus ook de Landelijke Subtopklasse O18 vanaf de herfstvakantie en de
> Landelijke Subtopklasse O16 vanaf de winterstop en IDC O14 vanaf de winterstop

IDC-O14 valt dus vanaf de winterstop onder categorie II en hoort daar een oordeel te krijgen, niet
een weigering.

Te doen:

1. Splits in `KLASSEN.O14` de klasse `super` in twee klassen, in deze volgorde bovenaan:
   - `{ id: "super", label: "Super O14" }`
   - `{ id: "idc", label: "IDC-O14" }`
   - daarna ongewijzigd `{ id: "top", label: "Topklasse" }`, `subtop`, en de rest.
2. Geef `idc` in `NIVEAU.O14` niveau `4`, hetzelfde als `super` en `top`. De tabel klassengrenzen
   zet Super O14, IDC-O14 en Topklasse op een rij.
3. `CATEGORIE_I.O14` blijft `["super"]`. IDC-O14 hoort daar niet meer bij.
4. Voeg toe aan `CATEGORIE_I_PERIODE.O14`: `{ idc: "tot de winterstop" }`. Hoofdstuk 2 zegt
   "vanaf de winterstop" voor categorie II, dus daarvoor is het categorie I.
5. Zet `"idc"` in `KOLOMMEN`, direct voor `"top"`. Reden: `subtop` staat er ook in terwijl die voor
   O16 en O18 periodegebonden is en dan een `?`-vakje geeft. IDC-O14 moet net zo selecteerbaar zijn.

Let op: `KOLOMMEN` wordt door `overzicht()` in `rules.js` gebruikt en levert voor categorieen
zonder die klasse een vakje met `bestaat: false`. Controleer dat O11, O12, O16 en O18 een leeg
vakje krijgen in de `idc`-kolom en niet crashen.

Tests:
- `niveau("O14", "idc")` is 4, gelijk aan `niveau("O14", "super")` en `niveau("O14", "top")`.
- `categorieIMelding({ categorie: "O14", klasse: "idc" })` noemt "tot de winterstop" en meldt dat
  de tool geen uitspraak doet.
- `categorieIMelding({ categorie: "O14", klasse: "super" })` blijft de onvoorwaardelijke
  categorie I-melding geven.
- `overzicht()` geeft voor elke categorie evenveel vakjes als er kolommen zijn, en de `idc`-kolom
  bestaat alleen bij O14.

## Taak 3: artikel 5.3.5.4 ook voor de lentecompetitie (ticket #6)

`rules.js` past artikel 5.3.5.4 nu alleen toe op `["top", "subtop"]`. Het artikel noemt twee
niveaugroepen, elk in een andere periode van het seizoen:

> Voor veldhockey geldt: Voor de O14-jeugd geldt dat wanneer een vereniging met meerdere
> jeugdteams uitkomt op een van onderstaande niveaus, de spelers van het eerste team zonder
> toestemming van de competitieleiding niet speelgerechtigd zijn voor de andere teams die op een
> van deze niveaus uitkomen. Tijdens herindelingsmomenten mag de teamlijst wel worden aangepast en
> mogen dus spelers tussen teams worden geschoven.
>
> De niveaus zijn als volgt:
> - Voorcompetitie: Topklasse en Subtopklasse;
> - Lentecompetitie: Super O14 en IDC-O14.

Te doen:

1. Zet de twee groepen als gegeven in `data.js`, bijvoorbeeld:

   ```js
   export const O14_NIVEAUGROEPEN = [
     { periode: "voorcompetitie", klassen: ["top", "subtop"] },
     { periode: "lentecompetitie", klassen: ["super", "idc"] },
   ];
   ```

2. Laat `beoordeelKlasse` in `rules.js` beide groepen aflopen in plaats van de hardgecodeerde
   `O14_TOP_SUBTOP`. De voorwaarde geldt als bron en doel allebei O14 zijn en allebei in dezelfde
   groep zitten.
3. Noem de periode in de voorwaardetekst, zodat de gebruiker weet wanneer de regel speelt.
   Bijvoorbeeld: "In de voorcompetitie geldt: als de vereniging meerdere O14-teams op de Topklasse
   of de Subtopklasse heeft, zijn de spelers van het eerste team hier zonder toestemming van de
   competitieleiding niet speelgerechtigd." Voor de lentecompetitie idem met Super O14 en IDC-O14.
4. Artikel `5.3.5.4` blijft in de artikelenlijst van de uitkomst.

Merk op: de lentecompetitiegroep is in het raster alleen zichtbaar bij combinaties die niet al
buiten scope vallen. Super O14 is altijd categorie I, IDC-O14 alleen tot de winterstop. De
voorwaarde moet dus wel door `beoordeelKlasse` worden gezet, ook als `assess()` er daarna
misschien een buiten-scope-melding overheen legt.

Tests:
- bron O14 top, doel O14 subtop: voorwaarde noemt de voorcompetitie en artikel 5.3.5.4 zit in de
  artikelen.
- bron O14 super, doel O14 idc: voorwaarde noemt de lentecompetitie en artikel 5.3.5.4 zit in de
  artikelen. Gebruik `beoordeelKlasse` direct, want `assess` geeft hier buiten-scope.
- bron O14 top, doel O14 1e klasse: geen 5.3.5.4-voorwaarde, want die klassen zitten niet samen in
  een groep.
- bron O14 top, doel O14 idc: geen 5.3.5.4-voorwaarde, want top en idc zitten in verschillende
  groepen.

## Taak 4: artikel 5.2.5 mag geen "nee" opleveren (ticket #4)

Reproductie: bron O12 3e klasse, doel O11 3e klasse, geboortedatum 1 mei 2015 (elf jaar op de
peildatum). De tool geeft nu:

```
verdict: niet-toegestaan
samenvatting: Nee. De klassengrens staat het toe, maar de leeftijd van de speler niet.

- Op 1 oktober 2026 is de speler 11 jaar en daarmee te oud voor O11 (...) mag alleen met
  dispensatie van de competitieleiding.
- Artikel 5.2.5 maakt hierop een uitzondering (...) Een individueel dispensatieverzoek is
  daarvoor niet nodig, mits de vereniging deze aantallenproblemen heeft.
```

De twee meldingen spreken elkaar tegen en het oordeel volgt de verkeerde.

Wat het Bondsreglement zegt, artikel 5.2.5:

> Voor de O11-competitie geldt dat de spelers op 1 oktober van het lopende seizoen moeten voldoen
> aan de leeftijdsgrenzen van die categorie. Voor alle verenigingen die op basis van aantallen
> problemen hebben om tot volledige teams c.q. goede teamsamenstellingen in de O11 en
> O12-categorie te komen, is het mogelijk dat O12-jarigen worden ingedeeld in de O11-categorie.
> Individuele dispensatieverzoeken zijn in dat geval op basis van de ingeschreven aantallen per
> team niet nodig.

En artikel 3.1.3 bevestigt dat dit geen dispensatiegeval is:

> Voor sommige leeftijdscategorieen zijn er enkele uitzonderingen, waarbij er geen dispensatie
> hoeft te worden gevraagd, indien een speler niet de juiste leeftijd heeft. Deze uitzonderingen
> zijn opgenomen in artikel 5.2 en 6.2.2 van dit reglement.

Te doen in `beoordeelLeeftijd` in `rules.js`:

- Valt de speler precies een jaar boven de bovengrens van O11 en is het doelteam O11, dan mag
  `blokkeert` niet op `true`. In plaats daarvan komt er een voorwaarde bij die de gebruiker kan
  beoordelen: dat de vereniging op basis van aantallen problemen moet hebben om tot volledige
  teams te komen in de O11 en O12.
- De eerste melding mag niet meer zeggen dat het alleen met dispensatie mag, want dat spreekt
  artikel 5.2.5 tegen. Herschrijf die melding voor dit geval.
- Alle andere gevallen van "te oud" blijven blokkeren, ongewijzigd.
- Artikel `5.2.5` blijft in de artikelen staan, `3.1.1` en `3.1.3` mogen erbij.

Aandachtspunt voor de plek van de voorwaarde: `assess()` haalt voorwaarden nu alleen uit
`beoordeelKlasse`. `beoordeelLeeftijd` kent geen voorwaarden. Voeg een `voorwaarden`-lijst toe aan
de uitkomst van `beoordeelLeeftijd` en voeg die in `assess()` samen met die van `beoordeelKlasse`,
zodat de bestaande weergave in `app.js` hem vanzelf toont. Laat de bestaande volgorde intact:
klassenvoorwaarden eerst, leeftijdsvoorwaarden erna.

Niet doen: de dubbelzinnigheid van het woord "O12-jarigen" oplossen. Dat is ticket #17 en ligt bij
de competitieleiding. De tool houdt de huidige lezing aan (spelers uit de O12-categorie, dus elf
jaar op de peildatum).

Tests:
- de reproductie hierboven geeft verdict `toegestaan` met een voorwaarde die de aantallenproblemen
  in O11 en O12 noemt, en artikel 5.2.5 in de artikelen.
- een speler van twaalf jaar naar O11 blijft `niet-toegestaan`.
- een speler van veertien jaar naar O12 blijft `niet-toegestaan`.
- een speler van elf jaar naar O12 blijft gewoon toegestaan zonder die voorwaarde.

## Taak 5: ontbrekende artikelen als kanttekening (tickets #8, #9, #10)

Drie artikelen uit hoofdstuk 5 kunnen het antwoord omdraaien maar komen nergens voor. De tool kan
er geen oordeel over vellen, want hij kent de wedstrijddag, de speelronde, de vereniging en de
gespeelde wedstrijden niet. De gebruiker hoort ze wel te zien.

Gebruik het bestaande kanttekeningmechanisme: `beoordeelKlasse` vult `kanttekeningen`, `assess`
geeft ze door, en `app.js` toont ze in het "Let op"-blok boven de voorwaarden. Dat verandert het
oordeel niet.

### Ticket #8, artikel 5.3.4

Toevoegen bij elk oordeel met grond `gelijk-of-lager`. De tekst van het artikel:

> Je hebt een niveaubepaling aan het begin van het seizoen aan de hand van de spelerslijst,
> teamopgave of teamlijst. Er wordt geteld vanaf de eerste wedstrijd die de speler speelt. In de
> eerste drie wedstrijden die een speler speelt mag een speler maximaal 1x op een hoger niveau
> uitkomen, zonder dat de niveaubepaling wijzigt. Als een speler binnen de vereniging evenveel of
> meer uitkomt voor het hoger spelende team dan voor het team waar de speler gewoonlijk voor
> uitkomt, dan wordt het hogere niveau de niveaubepaling. De speler mag vervolgens niet meer voor
> lager spelende teams uitkomen.

Kern voor de kanttekening: een speler die binnen de vereniging evenveel of vaker voor een hoger
spelend team uitkomt dan voor het eigen team, krijgt dat hogere niveau als niveaubepaling en mag
daarna niet meer voor lager spelende teams uitkomen. Artikel `5.3.4` erbij in de artikelen.

### Ticket #9, artikel 5.3.6

Toevoegen bij elk toegestaan oordeel, ongeacht de grond. De relevante zinnen:

> De laatste competitierondes van een competitie. Afhankelijk van de lengte van de competitie is
> bepaald hoeveel wedstrijden er als beslissingswedstrijden worden aangewezen (...)

> Tijdens beslissingswedstrijden mogen dus alleen spelers uitkomen die ook daadwerkelijk een
> niveaubepaling hebben verkregen.

En artikel 5.3.6.1:

> - Bij een competitie van tot en met 9 wedstrijden is de laatste wedstrijd een
>   beslissingswedstrijd.
> - Bij een competitie van 10 wedstrijden of meer zijn de laatste drie wedstrijden
>   beslissingswedstrijden.

Kern voor de kanttekening: in een beslissingswedstrijd (de laatste een tot drie speelronden, een
kampioenschap, of een door de competitieleiding aangewezen wedstrijd) mag alleen invallen wie een
vastgestelde niveaubepaling heeft. Artikelen `5.3.6` en `5.3.6.1` erbij.

De artikelteksten van 5.3.6 en 5.3.6.1 staan nog niet in `articles.js`. Breid
`tools/extract-articles.mjs` uit met die twee nummers en draai de extractie opnieuw. Bewerk
`articles.js` niet met de hand. `test/articles.test.js` moet groen blijven.

### Ticket #10, artikel 5.1.1

Toevoegen bij elk toegestaan oordeel. De tekst:

> Een speler mag gedurende een veldhockey competitieseizoen voor maximaal drie verschillende
> verenigingen uitkomen. Een speler mag niet in teams van verschillende verenigingen in dezelfde
> poule uitkomen.

Kern voor de kanttekening: komt de invaller van een andere vereniging, controleer dan dat de twee
teams niet in dezelfde poule zitten en dat de speler dit seizoen nog niet bij drie verenigingen
heeft gespeeld. Artikel `5.1.1` erbij, en ook toevoegen aan de artikelextractie.

### Aandachtspunten

- De kanttekeningen komen nu uit `beoordeelKlasse`, die ze alleen bij bepaalde gronden zet. Zorg
  dat de nieuwe kanttekeningen bij de juiste gronden landen en niet bij grond `te-hoog`, want daar
  is het antwoord toch nee. Kijk hoe `assess()` de artikelen samenvoegt: bij een niet toegestaan
  oordeel worden de leeftijdsartikelen weggelaten.
- Drie kanttekeningen plus de bestaande over de jongere leeftijdscategorie maakt het "Let op"-blok
  lang. Dat is acceptabel, het staat in een eigen blok en het oordeel staat erboven.

Tests: per artikel een test die aantoont dat de kanttekening verschijnt bij een passende
combinatie en ontbreekt bij grond `te-hoog`. Plus een test die aantoont dat 5.3.6, 5.3.6.1 en
5.1.1 in `ARTIKELEN` zitten met een niet-lege tekst.

## Taak 6: het raster mag geen voorwaarden verzwijgen (tickets #1 en #2)

Dit is de grootste taak. Lees hem helemaal voor je begint.

### Het probleem

`soortVanVakje` in `rules.js` kiest een van vijf soorten en gooit de rest weg:

```js
function soortVanVakje(uitkomst) {
  if (uitkomst.verdict === "buiten-scope") return "buiten-scope";
  if (uitkomst.verdict === "niet-toegestaan") return "nee";
  if (uitkomst.voorwaarden.some((v) => /leeftijdsgrenzen van/.test(v))) return "leeftijd";
  if (AANTALLEN_GRONDEN.includes(uitkomst.grond)) return "aantallen";
  if (MAX2_GRONDEN.includes(uitkomst.grond)) return "max2";
  if (uitkomst.voorwaarden.length > 0) return "leeftijd";
  return "vrij";
}
```

Dat levert twee aantoonbare fouten op:

**Ticket #1, 3 cellen.** De laatste `return "leeftijd"` vangt vakjes waarvan de enige voorwaarde
uit artikel 5.3.5.4 komt, een teamlijstregel die niets met leeftijd te maken heeft. Het gaat om
bron en doel allebei O14 in de Topklasse of de Subtopklasse. De legenda vertelt de gebruiker dan
"mag, mits de speler de juiste leeftijd heeft", wat feitelijk onjuist is.

**Ticket #2, 121 cellen.** De leeftijdstoets staat boven de aantallentoets, dus een vakje waar
zowel de leeftijdsgrens als de volledige aantallen-eis van artikel 5.3.5.2 geldt, toont alleen
`lft`. Voorbeelden: doel O11 1e klasse met bron O14 1e klasse, doel O11 2e klasse met bron O12 1e
klasse. Die vakjes hebben vijf voorwaarden. Artikel 5.3.5.2 eist:

> - Het team heeft aantoonbaar maximaal 9 (O11) of 11 spelers (veldhockey) of 6 spelers
>   (zaalhockey) beschikbaar vanuit het eigen niveau of een lager spelend niveau;
> - Er zijn aantoonbaar geen invallers beschikbaar vanuit een gelijk of lager spelend niveau;
> - Voor het inlenen van doelverdedigers is het aantal eigen spelers niet van toepassing!

Een coach die `lft` leest en de geboortedatum controleert, denkt dat het mag.

### De oplossing

Een vakje kan meer dan een eis dragen. Vervang het enkele `soort` door een grondslag plus een
lijst eisen.

`soortVanVakje` wordt `vakjeVanUitkomst(uitkomst)` en geeft terug:

```js
{ basis: "vrij" | "nee" | "buiten-scope", eisen: [...] }
```

- `basis` is `"buiten-scope"` bij verdict `buiten-scope`, `"nee"` bij verdict `niet-toegestaan`,
  anders `"vrij"`.
- `eisen` is leeg bij basis `nee` en `buiten-scope`. Bij basis `vrij` bevat het, in deze vaste
  volgorde, de eisen die daadwerkelijk gelden:
  - `"aantallen"` als de grond `een-hoger` is (artikel 5.3.5.2)
  - `"leeftijd"` als er een voorwaarde is die matcht op `/leeftijdsgrenzen van/` (artikel 5.3.5.1
    derde bullet)
  - `"eerste-team"` als artikel `5.3.5.4` in `uitkomst.artikelen` zit
  - `"max2"` als de grond `vijfde-klasse` is (artikel 5.3.5.3)

De vaste volgorde houdt de labels voorspelbaar.

Laat `overzicht()` per vakje `basis` en `eisen` teruggeven in plaats van `soort`.

### Weergave in `app.js`

Korte labels per eis, voor in het vakje:

- `aantallen` -> `mits`
- `leeftijd` -> `lft`
- `eerste-team` -> `team`
- `max2` -> geen tekst, dat blijft het bestaande driehoekje rechtsboven

Regels:

- Basis `nee` toont `nee`, basis `buiten-scope` toont `?`, precies zoals nu.
- Basis `vrij` zonder eisen toont `ja`, groen, precies zoals nu.
- Basis `vrij` met alleen `max2` toont `ja` met het driehoekje, precies zoals nu.
- Basis `vrij` met een of meer andere eisen toont de korte labels aan elkaar met een `+`, dus
  `mits`, `lft`, `team`, `mits+lft`, `lft+team`, `mits+lft+team`. Zit `max2` er ook bij, dan komt
  het driehoekje erbij.
- Kleur: groen als er geen eis is of alleen `max2`, verder geel (`--geel`, `--geel-vlak`). De
  bestaande blauwe leeftijdskleur vervalt; de kleur zegt nu of er voorwaarden zijn, de tekst zegt
  welke. Haal de dan ongebruikte `.leeftijd`-regels weg uit `style.css`.
- Het bestaande `title`-attribuut op de knop blijft `"<categorie> <klasselabel>"`.
- Voor schermlezers: elke eis krijgt ook zijn volledige omschrijving mee in het `title`-attribuut
  of via de bestaande `sr-only`-aanpak. De bestaande `SR_ONLY_KANTTEKENING` voor `max2` blijft.

Legenda onder het raster: per eis een regel met het korte label en de omschrijving.

- `mits`: mag alleen bij aantoonbaar te weinig spelers (artikel 5.3.5.2)
- `lft`: mag, mits de speler de juiste leeftijd heeft (artikel 5.3.5.1)
- `team`: mag niet voor spelers uit het eerste team, zonder toestemming van de competitieleiding
  (artikel 5.3.5.4)
- plus de bestaande regels voor `ja`, `nee`, `?` en het driehoekje.
- Voeg een regel toe die uitlegt dat labels gecombineerd kunnen worden, bijvoorbeeld: "Staan er
  twee labels met een `+` ertussen, dan gelden beide voorwaarden."

Mobiele weergave: groepeer op `basis`, niet op de eisencombinatie, anders krijg je een wildgroei
aan groepjes. Binnen de groep `vrij` toont elke klasse-knop zijn eigen korte labels achter het
klasselabel. De koppen boven de groepen worden dan "mag", "mag niet" en "geen uitspraak"; kies
formuleringen die kloppen nu de groep `vrij` ook voorwaardelijke gevallen bevat.

### Tests

- `vakjeVanUitkomst` geeft `eisen: ["aantallen", "leeftijd"]` voor doel O11 1e klasse met bron
  O14 1e klasse.
- `vakjeVanUitkomst` geeft `eisen: ["eerste-team"]` voor doel O14 Topklasse met bron O14
  Topklasse, en `leeftijd` zit er niet bij.
- `vakjeVanUitkomst` geeft `eisen: ["aantallen", "eerste-team"]` voor doel O14 Subtopklasse met
  bron O14 Topklasse.
- `vakjeVanUitkomst` geeft `eisen: []` en basis `vrij` voor een gewoon gelijk-of-lager geval.
- `vakjeVanUitkomst` geeft `eisen: ["max2"]` voor doel O14 5e klasse met bron O14 6e klasse.
- Een regressietest die over alle combinaties heen loopt en vastlegt dat geen enkel vakje met
  grond `een-hoger` de eis `aantallen` mist, en dat geen enkel vakje de eis `leeftijd` draagt
  zonder dat er een voorwaarde met "leeftijdsgrenzen van" in zit. Dat is precies wat tickets #1
  en #2 aantoonden.

### Niet doen

Niet de vraag oplossen of artikel 5.3.5.3 wel op al die 80 combinaties van toepassing is. Dat is
ticket #3 en ligt bij de competitieleiding. `max2` blijft doen wat het nu doet.
