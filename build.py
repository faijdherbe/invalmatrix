from reportlab.lib.pagesizes import A4, landscape
from reportlab.lib import colors
from reportlab.lib.units import mm
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, PageBreak, KeepTogether

TEAMS = [
    ("MO11-1", "O11", "1e"), ("MO11-2", "O11", "1e"), ("MO11-3", "O11", "3e"),
    ("MO11-4", "O11", "4e"), ("MO11-5", "O11", "4e"),
    ("MO12-1", "O12", "1e"), ("MO12-2", "O12", "5e"), ("MO12-3", "O12", "5e"),
    ("MO14-1", "O14", "Subtop"), ("MO14-2", "O14", "1e"), ("MO14-3", "O14", "4e"),
    ("MO14-4", "O14", "5e"), ("MO14-5", "O14", "6e"),
]
AGE_RANK = {"O11": 0, "O12": 1, "O14": 2}

# Absoluut niveau volgens de KNHB tabel klassengrenzen 2026-2027 (lager getal = hoger niveau).
# O11 en O12 staan in de tabel in dezelfde kolom. O11/O12 1e klasse = O14 2e klasse, enz.
LEVEL = {
    "O14": {"Top": 0, "Subtop": 1, "1e": 2, "2e": 3, "3e": 4, "4e": 5, "5e": 6, "6e": 6},
    "O12": {"1e": 3, "2e": 4, "3e": 5, "4e": 6, "5e": 7, "6e": 7},
    "O11": {"1e": 3, "2e": 4, "3e": 5, "4e": 6, "5e": 7, "6e": 7},
}
KLASSE_NUM = {"Top": 0, "Subtop": 0, "1e": 1, "2e": 2, "3e": 3, "4e": 4, "5e": 5, "6e": 6}


def code(borrower, lender):
    """
    Bepaal of team `borrower` een speler mag lenen uit team `lender`.
    Codes: V = vrij, W = onder voorwaarden (5.3.5.2), 5 = 5e-klasse uitzondering (5.3.5.3),
    L = alleen als de invaller de leeftijd van de jongere categorie heeft (klassenregel: vrij),
    LW = idem, maar klassenregel onder voorwaarden, X = niet toegestaan, - = zelfde team.
    """
    if borrower == lender:
        return "-"
    _, cb, kb = borrower
    _, cl, kl = lender
    lb = LEVEL[cb][kb]
    ll = LEVEL[cl][kl]
    older = AGE_RANK[cl] > AGE_RANK[cb]
    if cb == cl and KLASSE_NUM[kb] >= 5 and KLASSE_NUM[kl] >= 5:
        return "5"
    if ll >= lb:
        return "L" if older else "V"
    if ll == lb - 1:
        return "LW" if older else "W"
    return "X"


def by_name(name):
    return next(t for t in TEAMS if t[0] == name)


# Tests op basis van de voorbeelden in het Bondsreglement 2026 en de tabel klassengrenzen
assert code(by_name("MO11-1"), by_name("MO11-2")) == "V"
assert code(by_name("MO14-5"), by_name("MO14-3")) == "W"  # voorbeeld 4 art. 5.3.5.3
assert code(by_name("MO14-5"), by_name("MO14-4")) == "5"
assert code(by_name("MO12-2"), by_name("MO12-1")) == "X"
assert code(by_name("MO12-1"), by_name("MO11-1")) == "V"  # zelfde kolom in de tabel
assert code(by_name("MO11-1"), by_name("MO12-1")) == "L"  # gelijk niveau, wel leeftijd
assert code(by_name("MO14-2"), by_name("MO14-1")) == "W"
assert code(by_name("MO14-3"), by_name("MO11-3")) == "V"  # O11 3e = O14 4e
assert code(by_name("MO14-3"), by_name("MO11-1")) == "X"  # O11 1e = O14 2e, 2 klassen hoger
assert code(by_name("MO14-5"), by_name("MO11-3")) == "W"  # O11 3e = O14 4e, 1 klasse hoger
assert code(by_name("MO11-3"), by_name("MO14-3")) == "L"  # O14 4e = O11 3e, gelijk niveau
assert code(by_name("MO11-4"), by_name("MO14-4")) == "L"  # O14 5e = O11 4e

CELL_BG = {
    "V": colors.HexColor("#c6efce"),
    "W": colors.HexColor("#ffeb9c"),
    "5": colors.HexColor("#bdd7ee"),
    "L": colors.HexColor("#e2d5f1"),
    "LW": colors.HexColor("#e2d5f1"),
    "X": colors.HexColor("#f4cccc"),
    "-": colors.HexColor("#d9d9d9"),
}

styles = getSampleStyleSheet()
h1 = styles["Heading1"]
h2 = styles["Heading2"]
body = ParagraphStyle("body", parent=styles["Normal"], fontSize=9.5, leading=13)
small = ParagraphStyle("small", parent=body, fontSize=8, leading=10.5)
cell = ParagraphStyle("cell", parent=body, fontSize=7.5, leading=9, alignment=1)

doc = SimpleDocTemplate(
    "/mnt/user-data/outputs/invalmatrix-meisjes-2026-2027.pdf",
    pagesize=landscape(A4),
    leftMargin=12 * mm, rightMargin=12 * mm, topMargin=12 * mm, bottomMargin=12 * mm,
    title="Invalmatrix meisjesjeugd seizoen 2026-2027",
)
story = []

story.append(Paragraph("Invalmatrix meisjesjeugd seizoen 2026-2027", h1))
story.append(Paragraph(
    "Gebaseerd op het KNHB Bondsreglement 2026, hoofdstuk 5 (speelgerechtigdheid categorie II) en de "
    "KNHB Tabel klassengrenzen veld/zaalhockey seizoen 2026-2027. "
    "Lees de rij: <b>het team waaruit geleend wordt</b>. Lees de kolom: <b>het team dat een invaller nodig heeft</b>.",
    body))
story.append(Spacer(1, 4 * mm))

header = [Paragraph("<b>Leent uit &darr; / in &rarr;</b>", cell)]
for name, _, kl in TEAMS:
    header.append(Paragraph(f"<b>{name}</b><br/>{kl}", cell))
data = [header]
tstyle = [
    ("GRID", (0, 0), (-1, -1), 0.5, colors.grey),
    ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#e7e6e6")),
    ("BACKGROUND", (0, 0), (0, -1), colors.HexColor("#e7e6e6")),
    ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
    ("FONTNAME", (1, 1), (-1, -1), "Helvetica-Bold"),
    ("FONTSIZE", (1, 1), (-1, -1), 8),
    ("ALIGN", (1, 1), (-1, -1), "CENTER"),
]
MAX_AGE = {"O11": "max 10 jr*", "O12": "max 11 jr*", "O14": "max 13 jr*"}

for r, lender in enumerate(TEAMS, start=1):
    row = [Paragraph(f"<b>{lender[0]}</b><br/>{lender[2]}", cell)]
    for c, borrower in enumerate(TEAMS, start=1):
        v = code(borrower, lender)
        if v in ("L", "LW"):
            row.append(Paragraph(f"<b>{v}</b><br/>{MAX_AGE[borrower[1]]}", cell))
        else:
            row.append(v)
        tstyle.append(("BACKGROUND", (c, r), (c, r), CELL_BG[v]))
    data.append(row)

col_w = [26 * mm] + [17.5 * mm] * len(TEAMS)
table = Table(data, colWidths=col_w, rowHeights=[9 * mm] + [7.4 * mm] * len(TEAMS))
table.setStyle(TableStyle(tstyle))
story.append(table)
story.append(Spacer(1, 1.5 * mm))
story.append(Paragraph(
    "* Leeftijd op 1 oktober 2026, niet op de speeldag (art. 3.1.1, 5.2.4). Max 10 jr = geboren op of na 2 oktober 2015, "
    "max 11 jr = geboren op of na 2 oktober 2014. Deze grens geldt het hele seizoen, ook als de speler daarna jarig is.", small))
story.append(Spacer(1, 3 * mm))

legend = [
    ("V", "Vrij: altijd toegestaan, ongeacht het aantal eigen spelers (art. 5.3.5.1)."),
    ("W", "Onder voorwaarden: alleen bij max. 11 (O11: 9) beschikbare spelers en geen invallers uit gelijk/lager niveau; max. 2 invallers incl. vaste keeper (art. 5.3.5.2)."),
    ("5", "5e-klasse uitzondering: binnen dezelfde leeftijdscategorie vanaf de 5e klasse onderling invallen, ook bij meer dan 11 eigen spelers; max. 2 zonder toestemming competitieleiding (art. 5.3.5.3)."),
    ("L", "Alleen mogelijk als de invaller voldoet aan de leeftijdsgrens van de jongere categorie waarin zij invalt (art. 5.3.5.1, 3.1.1). De cel toont de maximale leeftijd van de invaller (zie voetnoot *). Een speler uit een ouder team heeft die leeftijd normaal niet, tenzij zij met dispensatie in het oudere team speelt (art. 3.1.3). Qua klassenregel vrij. LW: idem, maar qua klassenregel onder voorwaarden (art. 5.3.5.2). In de praktijk komt dit vrijwel nooit voor."),
    ("X", "Niet toegestaan zonder dispensatie van de competitieleiding."),
]
ldata = [[Paragraph(f"<b>{k}</b>", cell), Paragraph(t, small)] for k, t in legend]
ltable = Table(ldata, colWidths=[12 * mm, 238 * mm])
ltable.setStyle(TableStyle(
    [("BACKGROUND", (0, i), (0, i), CELL_BG[k]) for i, (k, _) in enumerate(legend)]
    + [("GRID", (0, 0), (0, -1), 0.5, colors.grey), ("VALIGN", (0, 0), (-1, -1), "MIDDLE")]
))
story.append(ltable)

story.append(PageBreak())
story.append(Paragraph("Toelichting op de regels", h1))

sections = [
    ("1. Niveaubepaling (art. 5.3.1 t/m 5.3.4)", [
        "Het niveau van een speler wordt bepaald door de teamlijst waar zij op staat (art. 5.3.2). Dat niveau bepaalt in welke teams zij mag invallen.",
        "Een speler die nergens op een teamlijst staat, heeft pas een niveau nadat zij drie keer op hetzelfde niveau is uitgekomen. Tot die tijd mag zij op verschillende niveaus spelen (art. 5.3.3).",
        "In de eerste drie gespeelde wedstrijden mag een speler maximaal 1x hoger uitkomen zonder dat haar niveau wijzigt. Speelt zij daarna evenveel of vaker voor een hoger team dan voor haar eigen team, dan wordt het hogere niveau haar niveaubepaling en mag zij niet meer voor lagere teams uitkomen (art. 5.3.4).",
        "Voor alles in dit hoofdstuk kan de vereniging dispensatie aanvragen bij de competitieleiding.",
    ]),
    ("2. Klassengrenzen tussen leeftijdscategorieen (tabel klassengrenzen 2026-2027)", [
        "Het reglement verwijst voor het vergelijken van klassen naar de KNHB tabel klassengrenzen (art. 5.3.5). Die tabel zet O11 en O12 in dezelfde kolom: een O11-team en een O12-team in dezelfde klasse spelen op gelijk niveau.",
        "Tussen O11/O12 en O14 geldt volgens de tabel: O11/O12 1e klasse = O14 2e klasse; 2e = 3e; 3e = 4e; 4e = 5e klasse en lager. O11/O12 5e klasse en lager heeft geen O14-equivalent en ligt daar dus onder.",
        "Binnen O14 is de volgorde: Super O14 / IDC-O14 / Topklasse, Subtopklasse, 1e, 2e, 3e, 4e, 5e klasse en lager. Subtop ligt dus 1 klasse boven de 1e klasse, en 5e en 6e klasse gelden als hetzelfde niveau.",
        "Toegepast op deze teams, van hoog naar laag: MO14-1 (Subtop) | MO14-2 (1e) | MO11-1, MO11-2, MO12-1 (1e) | MO11-3 (3e), MO14-3 (4e) | MO11-4, MO11-5 (4e), MO14-4 (5e), MO14-5 (6e) | MO12-2, MO12-3 (5e).",
    ]),
    ("3. Invallen uit gelijk of lager niveau: altijd toegestaan (art. 5.3.5.1)", [
        "Een team mag altijd invallers lenen uit een team op gelijk of lager niveau volgens de tabel klassengrenzen, ongeacht hoeveel eigen spelers beschikbaar zijn.",
        "Voorbeeld zelfde categorie: MO11-3 (3e) leent uit MO11-4 (4e).",
        "Voorbeeld jongere categorie: MO14-3 (4e) leent uit MO11-3 (3e), want O11 3e = O14 4e.",
        "Voorbeeld oudere categorie: MO11-4 (4e) leent uit MO14-4 (5e), mits de speler O11-leeftijd heeft. Omdat een speler zonder dispensatie niet in een verkeerde leeftijdscategorie mag uitkomen (art. 3.1.3), heeft een speler uit een ouder team die leeftijd normaal niet. Deze cellen staan daarom als L / LW in de matrix.",
    ]),
    ("4. Invallen uit hoger niveau: alleen onder voorwaarden (art. 5.3.5.2)", [
        "Lenen uit een team dat volgens de tabel klassengrenzen precies 1 klasse hoger speelt mag alleen als aan alle volgende voorwaarden is voldaan:",
        "- het team heeft aantoonbaar maximaal 11 spelers (O11: 9 spelers) beschikbaar uit het eigen of een lager niveau;",
        "- er zijn aantoonbaar geen invallers beschikbaar uit een gelijk of lager niveau;",
        "- er mogen dan maximaal 2 spelers invallen, inclusief een vaste keeper.",
        "Voor het lenen van een keeper geldt de eis over het aantal eigen spelers niet.",
        "Meer dan 1 klasse verschil is nooit toegestaan zonder dispensatie. Voorbeeld: MO14-3 (4e) mag niet lenen uit MO11-1 (1e), want O11 1e = O14 2e, dat is 2 klassen hoger.",
    ]),
    ("5. Uitzondering 5e klasse en lager (art. 5.3.5.3)", [
        "Binnen dezelfde leeftijdscategorie mogen teams vanaf de 5e klasse (5e, 6e en lager) bij elkaar invallen, ook als het team meer dan 11 eigen spelers heeft. Zonder toestemming van de competitieleiding mogen maximaal 2 spelers invallen.",
        "Lenen uit de 4e klasse valt onder de gewone voorwaarden van art. 5.3.5.2 (voorbeeld 4 in het reglement). Toegepast: MO14-5 (6e) uit MO14-3 (4e).",
        "Van toepassing op: MO12-2 en MO12-3 (beide 5e) onderling; MO14-4 (5e) en MO14-5 (6e) onderling.",
    ]),
    ("6. Aanvullende regels O14 (art. 5.3.5.4)", [
        "Als een vereniging met meerdere O14-teams uitkomt in de Topklasse of Subtopklasse (voorcompetitie) of Super O14 / IDC-O14 (lentecompetitie), zijn spelers van het eerste team niet speelgerechtigd voor de andere teams op die niveaus. Met alleen MO14-1 in de Subtop is dit nu niet van toepassing, maar let hierop als MO14-2 in de lente ook op zo'n niveau wordt ingedeeld.",
    ]),
    ("7. Leeftijdsgrenzen seizoen 2026-2027 per team (art. 3.1.1, 5.2.4, 5.2.5)", [
        "Peildatum is 1 oktober 2026. De leeftijdsgrenzen zijn altijd bepalend, ook als de klassengrens invallen zou toestaan.",
        "<b>O11 (MO11-1 t/m MO11-5):</b> 10 jaar op 1 oktober 2026, geboren van 2 oktober 2015 t/m 1 oktober 2016. Geen 1-jaar-ouder uitzondering. Bij aantallenproblemen mag de club O12-jarigen (geboren 2 oktober 2014 t/m 1 oktober 2015) in O11 indelen zonder individuele dispensatie (art. 5.2.5).",
        "<b>O12 (MO12-1 t/m MO12-3):</b> 11 jaar op 1 oktober 2026, geboren van 2 oktober 2014 t/m 1 oktober 2015. Voor MO12-2 en MO12-3 (5e klasse) mogen per team 2 spelers op de teamlijst maximaal 1 jaar ouder zijn (geboren 2 oktober 2013 t/m 1 oktober 2014). Deze spelers mogen alleen voor dat team uitkomen en dus niet invallen. Voor MO12-1 (1e) geldt deze uitzondering niet.",
        "<b>O14 (MO14-1 t/m MO14-5):</b> 12 of 13 jaar op 1 oktober 2026, geboren van 2 oktober 2012 t/m 1 oktober 2014. Voor MO14-3, MO14-4 en MO14-5 (4e t/m 6e klasse) mogen per team 2 spelers maximaal 1 jaar ouder zijn (geboren 2 oktober 2011 t/m 1 oktober 2012), uitsluitend uitkomend voor het eigen team. Voor MO14-1 (Subtop) en MO14-2 (1e) geldt deze uitzondering niet.",
        "Meer dan 2 te oude spelers in een team: dispensatie aanvragen voor alle te oude spelers (art. 5.2.4). Te jonge spelers in een ouder team: alleen met dispensatie (art. 3.1.3).",
        "Kanttekening: het reglement gebruikt 'voor 1 oktober' en 'op 1 oktober' door elkaar. Voor een speler die precies op 1 oktober jarig is, is het verstandig dit bij de competitieleiding te checken.",
    ]),
    ("8. Overig", [
        "De matrix gaat uit van de klassen zoals opgegeven aan het begin van het seizoen. Na een herindeling moet de matrix opnieuw worden bepaald.",
        "O12- en O14-spelers mogen volgens de tabel klassengrenzen ook invallen bij senioren- en O25-teams; dat valt buiten deze matrix.",
    ]),
]
for title, paras in sections:
    block = [Paragraph(title, h2)]
    for p in paras:
        block.append(Paragraph(p, body))
    block.append(Spacer(1, 2 * mm))
    story.append(KeepTogether(block))

doc.build(story)
print("ok")
