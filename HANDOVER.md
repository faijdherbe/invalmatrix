# Handover: invalmatrix meisjesjeugd 2026-2027

## Doel

Een PDF met een matrix die per team laat zien uit welke andere teams van de club invallers mogen worden geleend, volgens het KNHB Bondsreglement 2026 en de KNHB tabel klassengrenzen 2026-2027. Doelgroep: coaches en teammanagers van de meisjesjeugd.

## Bestanden in deze zip

- `build.py`: genereert `invalmatrix-meisjes-2026-2027.pdf` met reportlab. Bevat de teamlijst, de niveaumapping, de regellogica en asserts als tests.
- `invalmatrix-meisjes-2026-2027.pdf`: huidige output (3 pagina's: matrix + legenda, toelichting).
- `bondsreglement-2026.pdf`: bron 1. Relevante artikelen: 3.1.1, 3.1.3, 5.2.4, 5.2.5, 5.3.1 t/m 5.3.5.4.
- `tabel-klassengrenzen-veld-zaal-2026-2027.pdf`: bron 2. Pagina 1 is de niveautabel, pagina 2 en 3 bevatten toelichting op invalregels.

## Bouwen

```
pip install reportlab --break-system-packages
python3 build.py
```

Output pad staat hardcoded in `build.py` (`/mnt/user-data/outputs/...`); pas aan naar wens. Preview: `pdftoppm -r 60 -png <pdf> prev`.

## Teams (input)

| Team | Categorie | Klasse |
|---|---|---|
| MO11-1, MO11-2 | O11 | 1e |
| MO11-3 | O11 | 3e |
| MO11-4, MO11-5 | O11 | 4e |
| MO12-1 | O12 | 1e |
| MO12-2, MO12-3 | O12 | 5e |
| MO14-1 | O14 | Subtop |
| MO14-2 | O14 | 1e |
| MO14-3 | O14 | 4e |
| MO14-4 | O14 | 5e |
| MO14-5 | O14 | 6e |

Alle teams vallen in categorie II van het reglement (hoofdstuk 5). MO14 Subtop in de voorcompetitie is categorie II (zie art. 5.3.5.4). Bij herindeling moet de klasse in `TEAMS` worden bijgewerkt en de PDF opnieuw gegenereerd.

## Regellogica zoals geimplementeerd in `code(borrower, lender)`

1. Niveaus worden vertaald naar een absoluut getal via `LEVEL`, afgeleid van de tabel klassengrenzen (pagina 1). Lager getal is hoger niveau.
   - O14: Top/Super 0, Subtop 1, 1e 2, 2e 3, 3e 4, 4e 5, 5e en lager 6.
   - O11 en O12 staan in de tabel in dezelfde kolom: 1e 3, 2e 4, 3e 5, 4e 6, 5e en lager 7.
   - Dus O11/O12 1e klasse = O14 2e klasse, enz.
2. Zelfde categorie en beide teams 5e klasse of lager: code `5` (art. 5.3.5.3, onderling invallen, max 2 zonder toestemming).
3. Lener op gelijk of lager niveau dan de ontvanger: `V` (art. 5.3.5.1). Als de lener uit een oudere leeftijdscategorie komt: `L` (leeftijdsgrens van de jongere categorie is bepalend, art. 5.3.5.1 en 3.1.1).
4. Lener precies 1 niveau hoger: `W` (art. 5.3.5.2: max 11 spelers beschikbaar, O11 max 9; geen invallers uit gelijk/lager niveau; max 2 invallers incl. vaste keeper; keeper vrijgesteld van de aantallen-eis). Uit oudere categorie: `LW`.
5. Meer dan 1 niveau hoger: `X`.

Leeftijd voor `L`/`LW` cellen: maximale leeftijd op 1 oktober 2026 van de ontvangende categorie (`MAX_AGE`), met voetnoot onder de matrix. O11: max 10 jaar (geboren op of na 2 oktober 2015). O12: max 11 jaar (geboren op of na 2 oktober 2014). O14: max 13 jaar (geboren op of na 2 oktober 2012). Peildatum is 1 oktober, niet de speeldag.

Matrixorientatie: rij = team dat uitleent, kolom = team dat een invaller nodig heeft.

## Tests

De asserts in `build.py` dekken de voorbeelden uit art. 5.3.5.1 t/m 5.3.5.3 en de tabel klassengrenzen. Bij wijziging van de logica: asserts uitbreiden, niet verwijderen. Overweeg de asserts naar een pytest-bestand te verplaatsen en `code()` los te trekken van de PDF-bouw.

## Interpretatiekeuzes (bewust gemaakt, nog niet extern bevestigd)

1. `LEVEL` mapping tussen O11/O12 en O14 komt uit de tabel klassengrenzen. De tekst van art. 5.3.5.1 ("per leeftijdscategorie een klasse erbij") zou O11 en O12 als aparte stappen kunnen lezen; de tabel zet ze in een kolom. De tabel is gevolgd.
2. Art. 5.3.5.3 (5e klasse en lager): de "max 2 zonder toestemming" is toegepast op alle onderlinge combinaties binnen 5e klasse en lager, ook al staan 5e en 6e in de tabel op hetzelfde niveau (waar normaal `V` zonder maximum zou gelden). Conservatieve keuze.
3. Reglement gebruikt "voor 1 oktober" en "op 1 oktober" door elkaar. Geboortedatum precies 1 oktober is een randgeval; niet opgelost.
4. Regel 5.3.4 (wijziging niveaubepaling na vaker hoger spelen) staat in de toelichting maar zit niet in de matrix; de matrix gaat uit van de teamlijst.
5. Art. 5.2.4: max 2 spelers per team (2e klasse of lager, alleen O12/O14) die 1 jaar te oud zijn mogen uitsluitend voor het eigen team spelen. Staat in de toelichting, niet in de matrix.

## Openstaande acties

- Onafhankelijke review van elke cel tegen art. 5.3.5 t/m 5.3.5.4 en de tabel klassengrenzen. Aanbevolen prompt: "Controleer elke cel van de matrix op pagina 1 tegen art. 5.3.5 t/m 5.3.5.4 van het Bondsreglement 2026 en de tabel klassengrenzen 2026-2027. Noem per afwijking de cel, de huidige code, de verwachte code en het artikel."
- Interpretatiekeuzes 1 t/m 3 voorleggen aan de competitieleiding of wedstrijdsecretaris.
- Eventueel uitbreiden naar jongensteams en oudere categorieen (O16/O18 hebben eigen kolommen in de tabel; O16/O18 in Landelijk/Top/Subtop vallen deels in categorie I, hoofdstuk 4, met extra regels in 4.3.8).
- Eventueel zaalhockey: andere aantallen (6 spelers) en andere klassenindeling in de tabel.

## Vragen voor de competitieleiding

Gevonden bij het bouwen van de webversie, nog niet voorgelegd:

1. De toelichting bij de tabel klassengrenzen zegt "O12- en O14-spelers mogen invallen bij O25-
   en seniorenteams", terwijl de bijbehorende tabellen alleen mappings voor O16- en O18-spelers
   geven. Dat leest als een fout in de tabel.
2. De tabel zet bij O16 en O18 geen sterretje bij Landelijk, terwijl hoofdstuk 2 van het
   reglement de Landelijke Competitie wel onder categorie I schaart.
3. Het reglement gebruikt "voor 1 oktober" (art. 3.1.1) en "op 1 oktober" (art. 5.2.4, 5.2.5)
   door elkaar.
4. O11 en O12 staan in de tabel in dezelfde kolom, terwijl art. 5.3.5.1 spreekt van een klasse
   erbij per leeftijdscategorie.
5. Art. 5.3.5.3 legt een maximum van twee invallers op bij de 5e klasse en lager, terwijl die
   klassen volgens de tabel op gelijk niveau staan en art. 5.3.5.1 daar geen maximum kent.
6. Hoofdstuk 2 noemt bij O14 veldhockey alleen de Super Competitie onder categorie I. De tabel
   klassengrenzen zet wel een sterretje bij Super O14, IDC-O14 en Topklasse samen, waardoor het
   lijkt alsof alle drie categorie I zijn. Artikel 5.3.5.4 staat in hoofdstuk 5 en gaat juist
   expliciet over O14 Topklasse en Subtopklasse. De tool behandelt O14 Topklasse daarom als
   categorie II, en Super O14 samen met IDC-O14 als categorie I.
7. Hoofdstuk 2 zegt dat IDC-O14 vanaf de winterstop onder categorie II valt, maar IDC-O14 staat
   in de tabel klassengrenzen in dezelfde regel als Super O14, dat altijd categorie I is. De tool
   behandelt die combinatie daarom altijd als categorie I. Dat is de veilige kant, maar voor
   IDC-O14 na de winterstop mogelijk te streng.
8. Artikel 5.3.5.3 legt bij de 5e klasse en lager een maximum van twee invallers op, terwijl die
   klassen volgens de tabel klassengrenzen op gelijk niveau staan en artikel 5.3.5.1 daar geen
   maximum kent (zie ook punt 5 hierboven, specifiek voor de webversie). De opdrachtgever heeft
   een scherpere vraag gesteld: geldt dat maximum van twee altijd, of alleen als het team elf of
   meer eigen spelers beschikbaar heeft? De tekst is er niet eenduidig over.
   - Voor "alleen bij elf of meer" pleit dat 5.3.5.3 bijna een variant is op 5.3.5.2, dat
     maximaal 11 beschikbare spelers eist en dan twee invallers toestaat. Artikel 5.3.5.3 laat
     die aantallen-eis vallen met "ook bij meer dan 11 eigen spelers" en houdt de twee invallers
     over; "hierbij" zou dan naar die uitzonderingssituatie verwijzen. Heeft het team te weinig
     spelers, dan valt het terug op artikel 5.3.5.1, dat expliciet "ongeacht het aantal eigen
     spelers" zegt en geen maximum noemt.
   - Voor "altijd" pleit dat "hierbij" grammaticaal terugslaat op de hoofdzin ("mag er bij elkaar
     worden ingevallen") en niet op de bijzin over de elf spelers.
   De tool kent het aantal beschikbare spelers niet en kan dus niet kiezen. De webversie toont
   daarom bij deze combinaties beide lezingen, vermeldt artikel 5.3.5.1 als mogelijk alternatief,
   en raadt de gebruiker aan dit na te vragen bij de competitieleiding. Komt er een antwoord, dan
   kan de voorwaarde in `rules.js` bij de grond `vijfde-klasse` weer eenduidig worden gemaakt.
9. Artikel 5.3.5.1 staat lenen uit een jongere leeftijdscategorie toe en geeft er zelfs een
   voorbeeld van (JO18-2 in de 3e klasse mag lenen uit JO14-2 in de 1e klasse), terwijl artikel
   3.1.3 zegt dat spelers zonder dispensatie niet mogen uitkomen in een leeftijdscategorie waar ze
   volgens de leeftijdsgrenzen niet in mogen, en de tabel klassengrenzen vermeldt dat de
   leeftijdsgrenzen altijd bepalend blijven. Voor zo'n invaller is dat bijna altijd het geval: een
   speler uit een jongere categorie is per definitie meestal te jong voor de doelcategorie. De tool
   staat dit toe en toont een kanttekening die op deze tegenstrijdigheid wijst, zonder dat de
   kanttekening het oordeel verandert.

## Stijlvoorkeuren van de opdrachtgever

- Nederlands, casual en direct.
- Geen em-dash, geen emoji.
- Volledige bestanden regenereren in plaats van inline patches.
- Wijzigingen altijd met tests.
- Geen uitlijning van assignments over meerdere regels.
