# Ontwerp: openstaande onduidelijkheden in beeld

Datum: 31 augustus 2026. Branch: `onduidelijkheden`.

Er staan veertien tickets open waarin het Bondsreglement iets in het midden laat of zichzelf
tegenspreekt. `CLAUDE.md` schrijft voor dat de tool dan de behoudende kant kiest en er een ticket
van maakt. Dat gebeurt ook, maar de gebruiker ziet er niets van: het oordeel op het scherm ziet
eruit als een vaststaand antwoord, ook waar het op een keuze rust die het reglement niet uitspreekt.

Dit ontwerp laat de pagina per combinatie van waarden zien welke openstaande onduidelijkheden
erop van toepassing zijn.

## Wat een combinatie is

De pagina rekent met vier waarden: de periode (`early`, `mid`, `late`), het uitlenende team
(leeftijdscategorie plus klasse), het team waarin wordt ingevallen (idem), en optioneel de
geboortedatum van de speler. Een onduidelijkheid geldt voor een deel van die ruimte, niet voor de
hele ruimte, en niet voor precies een cel.

## Reikwijdte

Alleen de tickets met het label `question`, waarvan de titel met `Onzeker:` begint. Openstaande
bugs (#25) en verbeterpunten (#33) blijven erbuiten: die zeggen iets over de tool, niet over het
reglement, en horen thuis in de tickets zelf.

## Waar de onzekerheden staan

Nieuw bestand `uncertainties.js`. Een lijst, per onzekerheid:

```js
{
  ticket: 19,
  heading: "Valt IDC-O14 voor de winterstop onder categorie I of II?",
  explanation: "Hoofdstuk 2 noemt IDC-O14 alleen vanaf de winterstop onder categorie II en zegt niets over de periode daarvoor. Deze tool houdt de behoudende kant aan en doet voor die periode geen uitspraak.",
  needsDateOfBirth: false,
  applies: (c) => c.involves("O14", "idc") && c.periodId !== "late",
}
```

Het predicaat krijgt een context die `rules.js` klaarzet, met de ruwe keuzes en de afgeleide
waarden die de predicaten nodig hebben:

```js
{
  lender, borrower, periodId, ground, age,
  categoryDistance,      // index(lender) - index(borrower), negatief als de uitlener jonger is
  involves(category, classId),
  bothFifthOrLower,
}
```

Zo importeert `uncertainties.js` niets uit `rules.js`, en staat het predicaat pal naast de tekst
die het uitlegt. Dat is de reden voor een apart bestand: `CLAUDE.md` wil alle regellogica in
`rules.js`, maar dit is geen regellogica. Het is een uitspraak over de staat van de kennis, en die
moet op een plek staan waar hij per ticket te vinden en te verwijderen is.

`rules.js` roept `uncertaintiesFor(context)` aan in `assess()` en geeft het resultaat mee als
`uncertainties`, naast het bestaande `caveats`.

## Welke combinatie welk ticket raakt

| ticket | geldt bij |
|---|---|
| #11 | uitlener en inlener zijn O11 en O12, in welke volgorde dan ook |
| #12 | uitlener staat twee of meer leeftijdscategorieen hoger |
| #13 | grond `fifth-class` |
| #14 | beide 5e klasse of lager, verschillende leeftijdscategorie |
| #15 | uitlener uit een jongere leeftijdscategorie |
| #16 | speler precies een jaar te oud, uitlener in de 2e klasse of lager |
| #17 | inlener O11, speler elf jaar |
| #18 | Topklasse O14 aan een van beide kanten |
| #19 | IDC-O14 aan een van beide kanten, periode `early` of `mid` |
| #27 | Super O14 aan een van beide kanten |
| #28 | Subtopklasse O16 aan een van beide kanten, periode `mid` of nog niet gekozen |
| #29 | een klasse betrokken die in `CATEGORY_I_UNTIL` of `O14_LEVEL_GROUPS` voorkomt |
| #30 | een klasse betrokken die niet genummerd is (landelijk, super, top, subtop, idc) |
| #32 | Subtopklasse O18 in periode `early`, of Subtopklasse O16 in periode `mid`, bij beide ook zonder gekozen periode |

De predicaten worden afgeleid uit `data.js` waar dat kan, zodat ze meebewegen als de
seizoensgegevens wijzigen. #29 leest `CATEGORY_I_UNTIL` en `O14_LEVEL_GROUPS`: dat zijn precies de
plekken waar de periodegrens het oordeel bepaalt. #30 gaat over de klassen die de artikelen 4.3.8
en 5.3.5.4 per periode opsommen, en herkent die aan hun id: elke klasse-id die niet een genummerde
klasse is (`1e` tot en met `8e`), dus landelijk, super, top, subtop en idc.

#16 en #17 dragen `needsDateOfBirth: true`. Die verschijnen alleen in de detailuitleg zodra er een
geboortedatum is ingevuld, en nooit in het raster: het raster rekent zonder geboortedatum, en een
waarschuwing over een leeftijdsregel die daar niet draait zou nergens op slaan.

## De detailuitleg

Direct onder het oordeel, boven het blok "Let op", een dichtgeklapte accordion. Hetzelfde
`<details>`-patroon dat `articleBlock()` al gebruikt voor de artikelteksten:

```
/!\ Het reglement is hier op 2 punten onduidelijk
```

Uitgeklapt per punt: de kop, de uitleg, en een link `ticket #19` naar
`https://github.com/faijdherbe/invalmatrix/issues/19`. Bij een punt de tekst in enkelvoud
("op 1 punt onduidelijk").

Raakt de combinatie geen enkele onzekerheid, dan verschijnt er geen accordion en verandert er
niets aan het scherm.

De accordion staat onder het oordeel en niet erboven, zodat het antwoord bovenaan blijft staan
waar de coach het zoekt. Dichtgeklapt, omdat een cel tot vier onduidelijkheden kan dragen en het
scherm anders onleesbaar wordt.

### Wat er uit "Let op" verhuist

Twee bestaande teksten gaan onduidelijkheid over het reglement zelf en horen daarmee in het nieuwe
blok, met ticketnummer erbij:

- De kanttekening over lenen uit een jongere leeftijdscategorie (`youngerCategoryCaveat` in
  `rules.js`) is ticket #15.
- De voorwaarde "Onduidelijk is of dit maximum altijd geldt, of alleen als het team elf of meer
  eigen spelers beschikbaar heeft" bij de grond `fifth-class` is ticket #13. Die staat nu in
  `conditions`, wat verkeerd is: het is geen voorwaarde waaraan een team kan voldoen.

In "Let op" blijven de drie kanttekeningen over wat de tool niet kan weten: de niveaubepaling
(artikel 5.3.4), de beslissingswedstrijd (5.3.6) en de andere vereniging (5.1.1). Die gaan niet
over een onduidelijk reglement maar over ontbrekende gegevens, en daar is geen ticket voor omdat
er niets aan te repareren valt.

Het verwijderen van de #13-tekst uit `conditions` verandert het oordeel niet: bij die grond staat
de max-twee-voorwaarde er nog, dus `conditions.length > 0` blijft gelden en de samenvatting blijft
"Ja, mits aan de voorwaarden hieronder is voldaan". `cellFromOutcome()` leest die tekst niet.

## Het raster

Een tweede hoekje, linksonder in de cel, in een eigen kleur (`--purple: #5b3d8f`), zodat het niet
botst met het gele driehoekje rechtsboven voor de max-twee-kanttekening en zichtbaar blijft op de
groene, gele, rode en grijze celachtergronden. Kleur alleen is niet genoeg, dus dezelfde
`sr-only`-tekst als `SR_ONLY_CAVEAT` nu doet: " (met een openstaande onduidelijkheid)".

`cellFromOutcome()` krijgt er een veld `uncertain` bij, waar in het raster op wordt gestuurd.
`overview()` geeft dat door. De mobiele lijst krijgt hetzelfde hoekje op de klasseknop.

De legenda onder het raster en de uitleg onder de mobiele lijst krijgen er een regel bij, in
dezelfde vorm als de bestaande regel over het gele driehoekje.

Dit hoekje verschijnt op elke celstatus, dus ook op "nee" en op "?". Juist daar is de melding
nuttig: dat een cel "nee" zegt op grond van een keuze die het reglement niet uitspreekt, is
precies wat een coach moet weten.

## Bewaking

### De testsuite als GitHub Action

`.github/workflows/test.yml` draait `npm test` op elke push en pull request. De suite heeft geen
dependencies, dus dit is Node opzetten en `npm test` draaien.

### De controle op de lijst

`tools/check-uncertainties.mjs` vergelijkt de ticketnummers in `uncertainties.js` met GitHub via
`gh issue list`. Het meldt twee dingen:

- een ticket in de lijst dat op GitHub gesloten is: de waarschuwing had weg gemoeten;
- een open ticket met het label `question` en een titel die met `Onzeker:` begint dat niet in de
  lijst staat: er hoort een waarschuwing bij.

Afsluitcode 1 als er iets te melden valt. `.github/workflows/onduidelijkheden.yml` draait dit
wekelijks en bij elke push, met de `GITHUB_TOKEN` die Actions zelf meegeeft.

De controle zit bewust niet in `npm test`: de testsuite moet offline en zonder `gh` blijven
draaien.

## Tests

- Per onzekerheid: een test die aantoont welke combinaties hij raakt en dat een aangrenzende
  combinatie hem niet raakt. Veertien tickets, dus veertien paren.
- Een test die de hele ruimte doorloopt en vaststelt dat elke `applies` zonder fout draait voor
  alle combinaties van periode, categorie en klasse.
- Een test dat elk `ticket` uniek is, elke `heading` en `explanation` gevuld, en dat geen tekst een
  em-dash of emoji bevat (`CLAUDE.md`).
- Een test dat `needsDateOfBirth`-onzekerheden nooit in `overview()` opduiken.
- Een test dat de #13-tekst niet meer in `conditions` staat, en dat de #15-tekst niet meer in
  `caveats` staat, allebei met de reden erbij dat ze naar de accordion zijn verhuisd.
- De bestaande tests die die twee teksten controleren worden aangepast, niet verwijderd, met een
  toelichting waarom de oude verwachting achterhaald is.

## Wat in CLAUDE.md komt

Een sectie onder "Tickets":

- Elke onzekerheid die de gebruiker raakt krijgt naast een ticket ook een regel in
  `uncertainties.js`, in dezelfde commit.
- Sluit je een ticket, dan haal je die regel in dezelfde commit weg, samen met de bijbehorende
  tests.
- `node tools/check-uncertainties.mjs` bewaakt dat, en draait ook als Action.
- Kijk aan het begin van een taak met `gh run list --limit 5` of de laatste runs groen staan.

## Wat hier niet in zit

Geen samenvattende waarschuwing boven het raster, en geen filter om de gemarkeerde cellen op te
zoeken. Het hoekje plus de accordion is genoeg om de onzekerheid te vinden; een derde plek maakt
het scherm alleen drukker.
