# Ontwerp: periodekeuze binnen het seizoen

Datum: 31 augustus 2026. Branch: `periodekeuze`.

Drie klassen wisselen halverwege het seizoen van categorie. Omdat de tool niet weet wanneer de
wedstrijd gespeeld wordt, houdt hij zich bij die klassen op de vlakte. Dit ontwerp geeft de
gebruiker een keuze voor de periode, zodat die uitspraken alsnog gedaan kunnen worden.

Bron voor elke regelbeslissing hieronder is `bronnen/bondsreglement-2026.pdf`, zoals `CLAUDE.md`
voorschrijft.

## Het probleem

`rules.js:269` geeft bij de wisselende klassen deze uitkomst:

> ... valt tot de winterstop onder categorie I, met de speelgerechtigdheidsregels van hoofdstuk 4,
> en daarna onder categorie II. Deze tool weet niet in welke periode de wedstrijd valt en doet hier
> geen uitspraak over.

Dat raakt drie klassen, uit `data.js:97`:

| klasse | categorie I volgens hoofdstuk 2 |
|---|---|
| Subtopklasse O18 | tot en met de herfstvakantie |
| Subtopklasse O16 | tot en met de winterstop |
| IDC-O14 | tot de winterstop |

Een volledige doorloop van het raster telt 2250 cellen. Daarvan blijven er 261 leeg om uitsluitend
deze reden. Los daarvan zijn er 225 cellen die echt buiten scope vallen omdat een van beide teams
het hele seizoen categorie I is; die veranderen niet.

## Wat het reglement zegt

### De grenzen

Hoofdstuk 2, PDF-pagina 16, categorie I:

> - Veldhockey:
>   - O18: Landelijke Topklasse, Landelijke Subtopklasse (tot en met de herfstvakantie), Landelijke Competitie en Super Competitie
>   - O16: Landelijke Topklasse, Landelijke Subtopklasse (tot en met de winterstop), Landelijke Competitie en Super Competitie
>   - O14: Super Competitie

Hoofdstuk 2, PDF-pagina 16, categorie II:

> - O18 tot en met O11 competitie behoudens competities genoemd onder categorie I
> - Onder categorie II vallen dus ook de Landelijke Subtopklasse O18 vanaf de herfstvakantie en de Landelijke Subtopklasse O16 vanaf de winterstop en IDC O14 vanaf de winterstop

Het reglement kent dus twee grensmomenten, de herfstvakantie en de winterstop. Daarmee valt het
seizoen in drie stukken uiteen. Wanneer die momenten op de kalender vallen staat niet in het
reglement en ook niet in de tabel klassengrenzen, dus de tool noemt geen data.

### De periodenamen

De artikelen 4.3.8, 4.3.9 en 5.3.5.4 gebruiken de termen `voorcompetitie` en `lentecompetitie`.
Artikel 4.3.8, PDF-pagina 30:

> - Voorcompetitie: Landelijke Topklasse en Landelijke Subtopklasse;
> - Lentecompetitie: Landelijk en Super.

Artikel 5.3.5.4:

> - Voorcompetitie: Topklasse en Subtopklasse;
> - Lentecompetitie: Super O14 en IDC-O14.

Waar de grens tussen die twee ligt staat nergens. Dit ontwerp legt hem op de winterstop, omdat
hoofdstuk 2 zegt dat IDC-O14 vanaf de winterstop categorie II is en artikel 5.3.5.4 IDC-O14 in de
lentecompetitie plaatst. Dat is een gevolgtrekking en geen citaat, en gaat als ticket naar de
competitieleiding.

## De twee opsommingen van categorie I

Het reglement somt de categorie I-competities twee keer op, en de tweede keer staat er iets meer.

Hoofdstuk 2, PDF-pagina 16, onder "Onder de categorie I vallen de volgende competities":

> - O14: Super Competitie

Hoofdstuk 4, PDF-pagina 27, onder "Deze speelgerechtigdheidsregels zijn van toepassing op spelers
die uitkomen of invallen in een van onderstaande competities":

> - O14: Super Competitie (vanaf de winterstop)

De rest van beide opsommingen is woord voor woord gelijk.

### De aangehouden lezing

De twee lijsten hebben verschillende taken. Hoofdstuk 2 deelt in: welke competities zijn categorie
I. Hoofdstuk 4 bakent af: op welke competities is dit hoofdstuk van toepassing. Het haakje
`(vanaf de winterstop)` is dan geen categoriegrens maar een mededeling over wanneer de Super
O14-competitie gespeeld wordt. Onder die lezing spreken de twee zinnen elkaar niet tegen en bevat
geen van beide een fout.

Wat daarvoor pleit:

1. Binnen elk hoofdstuk zijn de haakjes dan consequent. In hoofdstuk 4 markeert elk haakje het
   venster waarin dat hoofdstuk geldt, of de reden nu een categoriewissel is of het ontbreken van
   de competitie. In hoofdstuk 2 markeert elk haakje een categoriegrens, en Super O14 heeft er
   geen.
2. Super O14 ontbreekt in beide categorie II-opsommingen (PDF-pagina 16 en 38), terwijl die juist
   uitputtend opsommen wat men ten onrechte voor categorie I zou houden.
3. Artikel 4.3.9 (hoofdstuk 4, categorie I) heeft alleen een regel voor de lentecompetitie, terwijl
   het gelijkluidende artikel 5.3.5.4 (hoofdstuk 5, categorie II) er ook een heeft voor de
   voorcompetitie. In de O14-voorcompetitie bestaat er dus geen categorie I-niveau.
4. Artikel 4.9 noemt voor O18 en O16 vier competities en voor O14 alleen "Super", zonder
   voorbehoud. Hoofdstuk 4 kent geen andere O14-competitie.

Wat er tegen pleit:

1. Het reglement zegt nergens letterlijk dat Super O14 voor de winterstop niet gespeeld wordt. Dat
   volgt uit het samenlezen van 4.3.9 en 5.3.5.4 als volledige opsomming per periode, en die
   opsommingen zijn geschreven voor de eerste-team-regel, niet als competitieaanbod.
2. De categorie II-opsomming wordt er intern gemengd van: Subtop O18 en Subtop O16 zijn dan
   categoriewissels en IDC O14 is een bestaansmoment, met hetzelfde zinsdeel.
3. Hoofdstuk 2 schrijft bij Subtop O16 "vanaf de winterstop" en hoofdstuk 5 "vanaf na de
   winterstop". Dezelfde zin, niet gelijk overgetypt. Dit document bevat dus aantoonbaar
   kopieerverschillen, en dan is "beide zinnen zijn waar" niet gegarandeerd.

Deze lezing is de best onderbouwde, maar blijft een lezing. Ze gaat als ticket naar de
competitieleiding en wordt niet als vaststaand behandeld.

### Gevolgen voor de gegevens

Super O14 blijft onder beide lezingen het hele seizoen categorie I. `CATEGORY_I.O14 = ["super"]`
in `data.js:92` blijft dus ongewijzigd.

Voor IDC-O14 verschillen de lezingen wel. Onder de aangehouden lezing is IDC-O14 altijd categorie
II en zou de klasse uit de periodetabel moeten verdwijnen. De tool houdt hem er toch in, om twee
redenen. De behoudende kant is die welke nooit ten onrechte "ja" zegt, en dat is hier de kant die
geen uitspraak doet. En het kost niets: de twee lezingen verschillen alleen over IDC-O14 in de
voorcompetitie, en onder de aangehouden lezing bestaat dat geval helemaal niet, dus er gaat geen
bruikbare cel verloren.

Wel wordt de tekst aangepast. De huidige tekst beweert dat IDC-O14 tot de winterstop categorie I
is, en dat is onder de aangehouden lezing waarschijnlijk onwaar. De nieuwe tekst beweert niets over
de categorie en zegt alleen dat het reglement er niet eenduidig over is.

## Reikwijdte

De periodekeuze raakt uitsluitend de indeling in categorie I en II. Wat de keuze uitdrukkelijk
niet doet:

- **De klassenlijst blijft ongewijzigd.** De artikelen 4.3.8 en 4.3.9 suggereren dat het
  klassenaanbod aan de top per periode verschilt (Landelijke Topklasse en Subtopklasse tegenover
  Landelijk en Super bij O18 en O16, Topklasse en Subtopklasse tegenover Super O14 en IDC-O14 bij
  O14). Die artikelen zeggen letterlijk alleen "de niveaus zijn als volgt" voor de eerste-team-regel.
  Dat het ook het volledige aanbod per periode is, is een lezing. Wordt een ticket, geen code.
- **Artikel 5.3.5.4 blijft ongemoeid.** Dat artikel kent zijn eigen periodes, maar het is een
  beperking en geen toestemming. Een groep eruit filteren op grond van een grens die het reglement
  niet trekt, maakt de tool ruimer in plaats van strenger, en dat is de verkeerde kant. Beide
  niveaugroepen blijven dus in elke periode zichtbaar. De periodenaam staat al in de tekst van de
  voorwaarde zelf ("In de voorcompetitie geldt: ...").

## Ontwerp

### `data.js`

De periodes komen erbij:

```js
// Periods within the season. The two boundaries are the ones chapter 2 names: the herfstvakantie
// and the winterstop. The labels voorcompetitie and lentecompetitie come from articles 4.3.8,
// 4.3.9 and 5.3.5.4. The reglement does not say where the boundary between voorcompetitie and
// lentecompetitie lies; this tool puts it at the winterstop, see ticket #3 below (the real
// number goes in here once the ticket exists).
export const PERIODS = [
  { id: "early", label: "voorcompetitie tot de herfstvakantie" },
  { id: "mid", label: "voorcompetitie na de herfstvakantie" },
  { id: "late", label: "lentecompetitie" },
];
```

`CATEGORY_I` blijft zoals hij is: de klassen die het hele seizoen categorie I zijn.

`CATEGORY_I_PERIOD` wordt vervangen door `CATEGORY_I_UNTIL`. De waarde is de laatste periode
waarin de klasse nog categorie I is; vanaf de periode daarna is hij categorie II. Of een periode
voor of na die grens ligt volgt uit de plek in `PERIODS`, dus die array is de enige plaats waar de
volgorde van het seizoen vastligt. De letterlijke zin uit het reglement gaat als commentaar mee,
zodat de regel naast zijn bron staat.

```js
export const CATEGORY_I_UNTIL = {
  O14: { idc: "mid" },      // chapter 2: "IDC O14 vanaf de winterstop"
  O16: { subtop: "mid" },   // chapter 2: "tot en met de winterstop"
  O18: { subtop: "early" }, // chapter 2: "tot en met de herfstvakantie"
};
```

`SEASON` blijft staan en wordt door `app.js` in de labels van de keuzelijst verwerkt.

### `rules.js`

`categoryINotice(team, periodId)` krijgt de periode erbij. `periodId` is `null` zolang de gebruiker
niets heeft gekozen. Vier uitkomsten:

| situatie | uitkomst |
|---|---|
| klasse staat in `CATEGORY_I` | huidige tekst, ongewijzigd |
| klasse staat in `CATEGORY_I_UNTIL`, geen periode gekozen | tekst die zegt dat de periode nog gekozen moet worden |
| klasse staat in `CATEGORY_I_UNTIL`, periode tot en met de grens | tekst die de gekozen periode noemt en naar hoofdstuk 4 verwijst |
| klasse staat in `CATEGORY_I_UNTIL`, periode na de grens | `null`, er volgt een gewoon oordeel |

Voor IDC-O14 wijkt de tekst af van die van de twee Subtopklassen, conform de afweging hierboven:
die tekst noemt geen categorie maar zegt dat het reglement er niet eenduidig over is, met een
verwijzing naar het openstaande ticket.

`assess(lender, borrower, dateOfBirth, periodId)` en `overview(borrower, periodId)` krijgen de
periode als laatste parameter en geven hem door aan `categoryINotice`. Laatste parameter en niet
eerder, zodat elke bestaande aanroep zonder periode blijft werken en daarmee automatisch het pad
"geen periode gekozen" test. De hele bestaande testsuite wordt zo het bewijs dat de tool zonder
keuze precies doet wat hij nu doet.

Verder rekent er niets nieuws. De periode is een filter op de categorie-indeling, meer niet.

De tweede rij van die tabel, geen periode gekozen, is vanuit de pagina niet te bereiken: het raster
verschijnt pas als alle drie de keuzes gevuld zijn, en het detailblok hangt aan het raster. Die tak
blijft er toch in, omdat `rules.js` een losse module is die nooit stilzwijgend een periode mag
aannemen. Hij wordt gedekt door de bestaande testsuite, die `assess` en `overview` overal zonder
periode aanroept.

### `app.js`

Drie keuzes, alle drie leeg bij het laden van de pagina. De harde standaardwaarden `O14`
(`app.js:40`) en `4e` (`app.js:53`) verdwijnen.

```
Wanneer wordt de wedstrijd gespeeld?
[ Kies een periode                            v ]
    2026-2027, voorcompetitie tot de herfstvakantie
    2026-2027, voorcompetitie na de herfstvakantie
    2026-2027, lentecompetitie

Bij welk team moet er worden ingevallen?
[ Kies een leeftijdscategorie v ]  [ Kies eerst een leeftijdscategorie v ]
```

De klasse-keuze staat op `disabled` zolang er geen leeftijdscategorie is gekozen.

Het blok "Wie mag daar invallen?" blijft staan zolang de keuze onvolledig is, met een regel die
alleen opsomt wat er nog ontbreekt. Het raster verschijnt pas als alle drie de keuzes gevuld zijn.

De contextregel bovenaan (`app.js:19`) laat het seizoen vallen en wordt `veldhockey, categorie II`.
Het seizoen staat vanaf nu in de keuzelijst, en het twee keer noemen wordt verwarrend zodra er een
tweede seizoen bij komt.

De voetnoot onder het raster somt nu alleen de vaste categorie I-klassen op. Daar komt een tweede
zin bij die de klassen noemt die in de gekozen periode categorie I zijn en die daarom wel een kolom
hebben maar geen oordeel geven.

### Tests

- Per wisselende klasse een test aan beide kanten van zijn grens, als uitlener en als inlener.
- Een test dat een lege periodekeuze exact het huidige gedrag oplevert, voor alle drie de klassen.
- Een test dat artikel 5.3.5.4 in alle drie de periodes dezelfde voorwaarden geeft, zodat niemand
  dat later per ongeluk gaat filteren.
- Een test dat Super O14 in alle drie de periodes categorie I blijft.
- In `test/page-text.test.js` de lege staat: de regel noemt alleen wat er ontbreekt.

De bestaande tests in `test/rules.test.js` roepen `assess` en `overview` zonder periode aan en
blijven ongewijzigd.

## Tickets

Vijf stuks. Vier blijven open voor de competitieleiding, omdat `CLAUDE.md` voorschrijft dat een
gok die eruitziet als een besluit erger is dan een open vraag.

1. **Hoofdstuk 2 en hoofdstuk 4 over Super O14.** De opsomming staat er twee keer, en alleen op
   PDF-pagina 27 staat `(vanaf de winterstop)`. Met de aangehouden lezing erbij (indelen tegenover
   afbakenen) en de vier onderbouwingen. Vraag: klopt die lezing, of hoort er in een van beide
   opsommingen iets anders te staan?
2. **"vanaf de winterstop" tegenover "vanaf na de winterstop".** Dezelfde zin over Subtop O16 op
   PDF-pagina 16 en 38, niet gelijk overgetypt. Redactioneel, maar het laat zien dat deze
   opsomming met de hand is gekopieerd.
3. **De grens tussen voorcompetitie en lentecompetitie.** Het reglement gebruikt beide termen in
   4.3.8, 4.3.9 en 5.3.5.4 maar zegt nergens waar de grens ligt. De tool houdt de winterstop aan.
4. **Klassenaanbod per periode.** De artikelen 4.3.8 en 4.3.9 suggereren dat de klassen aan de top
   per periode verschillen. De tool doet daar bewust niets mee.
5. **Ticket #19 bijwerken.** De aangehouden lezing erbij als best onderbouwde kandidaat, met een
   verwijzing naar ticket 4. Het ticket blijft open, want het antwoord is een interpretatie en geen
   citaat.
