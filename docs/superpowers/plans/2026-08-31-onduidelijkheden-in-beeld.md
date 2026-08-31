# Onduidelijkheden in beeld: implementatieplan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** De pagina laat per combinatie van periode, teams en geboortedatum zien welke openstaande onduidelijkheden in het Bondsreglement erop van toepassing zijn, met een markering in het raster en een dichtgeklapte accordion in de uitleg.

**Architecture:** Een nieuw bestand `uncertainties.js` houdt dertien onzekerheden vast, elk met ticketnummer, kop, uitleg en een predicaat. `rules.js` bouwt een context en geeft de geldende onzekerheden mee in het resultaat van `assess()`. `app.js` tekent ze als hoekje in het raster en als accordion in de uitleg. Een script plus twee GitHub Actions bewaken dat de lijst gelijk blijft met de tickets.

**Tech Stack:** ES-modules zonder build-stap, `node --test` voor de tests, `gh` voor de ticketcontrole, GitHub Actions voor de bewaking.

## Global Constraints

- Code, bestandsnamen, DOM-id's, CSS-klassen, commentaar en testnamen in het Engels. Alles wat de gebruiker leest, `README.md`, `CLAUDE.md`, commitberichten en tickets in het Nederlands.
- Geen em-dash, geen emoji, in geen enkele taal.
- De toon van het Nederlands is casual en direct.
- Geen uitlijning van assignments over meerdere regels.
- Regellogica in `rules.js`, seizoensgegevens in `data.js`, `app.js` rekent niets zelf uit.
- `articles.js` wordt nooit met de hand bewerkt.
- Elke wijziging gaat vergezeld van tests. Sneuvelt een bestaande test, pas hem dan aan met een toelichting waarom de oude verwachting achterhaald is. Verwijder hem niet.
- Werk op branch `onduidelijkheden`. Die bestaat al.
- Draai `npm test` voor elke commit.

---

## File Structure

| bestand | verantwoordelijkheid |
|---|---|
| `uncertainties.js` (nieuw) | De dertien onzekerheden en `uncertaintiesFor(context)`. Importeert alleen uit `data.js`. |
| `test/uncertainties.test.js` (nieuw) | Test de predicaten los van `rules.js`, op een handgemaakte context. |
| `rules.js` (wijzigen) | Bouwt de context, geeft `uncertainties` mee in `assess()`, en levert de twee verhuisde teksten niet meer als caveat of conditie. |
| `test/rules.test.js` (wijzigen) | Tests op de integratie, en de aangepaste bestaande tests. |
| `app.js` (wijzigen) | De accordion in de uitleg, het hoekje in het raster en de mobiele lijst, de legenda. |
| `style.css` (wijzigen) | De paarse kleur, het hoekje linksonder, de mobiele markering, de accordion. |
| `tools/check-uncertainties.mjs` (nieuw) | Vergelijkt de lijst met GitHub. |
| `.github/workflows/test.yml` (nieuw) | Draait `npm test`. |
| `.github/workflows/onduidelijkheden.yml` (nieuw) | Draait het controlescript. |
| `CLAUDE.md`, `README.md` (wijzigen) | De werkafspraak en de beschrijving. |

---

## Task 1: het bestand met de onzekerheden

**Files:**
- Create: `uncertainties.js`
- Test: `test/uncertainties.test.js`

**Interfaces:**
- Consumes: `CATEGORY_I_UNTIL` en `O14_LEVEL_GROUPS` uit `data.js`.
- Produces:
  - `UNCERTAINTIES`: array van `{ ticket: number, heading: string, explanation: string, needsDateOfBirth: boolean, applies: (context) => boolean }`, oplopend op `ticket`.
  - `uncertaintiesFor(context)`: geeft de elementen van `UNCERTAINTIES` terug waarvoor `applies` waar is, in dezelfde volgorde, zonder het veld `applies`. Dus `{ ticket, heading, explanation, needsDateOfBirth }`.
  - De contextvorm die `applies` verwacht:
    ```js
    {
      lender: { category: "O14", classId: "1e" },
      borrower: { category: "O18", classId: "3e" },
      periodId: "early" | "mid" | "late" | null,
      ground: "fifth-class" | "equal-or-lower" | "one-higher" | "too-high" | null,
      age: null,                       // of het resultaat van assessAge
      categoryDistance: -2,            // index(lender) - index(borrower) in O11, O12, O14, O16, O18
      involves: (category, classId) => boolean,
      bothFifthOrLower: false,
    }
    ```

- [ ] **Step 1: Write the failing test**

Maak `test/uncertainties.test.js`:

```js
import { test } from "node:test";
import assert from "node:assert/strict";
import { UNCERTAINTIES, uncertaintiesFor } from "../uncertainties.js";

const AGE_CATEGORY_ORDER = ["O11", "O12", "O14", "O16", "O18"];
const LOW_CLASSES = ["5e", "6e", "7e", "8e"];

// Builds the context that rules.js will hand over, so the predicates can be tested without
// running the rules. Only the fields the predicates read are filled in; everything else takes a
// neutral default.
function context({ lender, borrower, periodId = null, ground = null, age = null }) {
  return {
    lender,
    borrower,
    periodId,
    ground,
    age,
    categoryDistance:
      AGE_CATEGORY_ORDER.indexOf(lender.category) - AGE_CATEGORY_ORDER.indexOf(borrower.category),
    involves: (category, classId) =>
      (lender.category === category && lender.classId === classId) ||
      (borrower.category === category && borrower.classId === classId),
    bothFifthOrLower: LOW_CLASSES.includes(lender.classId) && LOW_CLASSES.includes(borrower.classId),
  };
}

function tickets(c) {
  return uncertaintiesFor(c).map((u) => u.ticket);
}

test("every uncertainty carries a unique ticket number, a heading and an explanation", () => {
  const seen = new Set();
  for (const uncertainty of UNCERTAINTIES) {
    assert.equal(typeof uncertainty.ticket, "number", JSON.stringify(uncertainty));
    assert.ok(!seen.has(uncertainty.ticket), `ticket ${uncertainty.ticket} appears twice`);
    seen.add(uncertainty.ticket);
    assert.ok(uncertainty.heading.length > 0, `ticket ${uncertainty.ticket} has no heading`);
    assert.ok(uncertainty.explanation.length > 0, `ticket ${uncertainty.ticket} has no explanation`);
    assert.equal(typeof uncertainty.needsDateOfBirth, "boolean", `ticket ${uncertainty.ticket}`);
    assert.equal(typeof uncertainty.applies, "function", `ticket ${uncertainty.ticket}`);
  }
});

test("the list is sorted by ticket number, so the page shows a predictable order", () => {
  const numbers = UNCERTAINTIES.map((u) => u.ticket);
  assert.deepEqual(numbers, [...numbers].sort((a, b) => a - b));
});

// CLAUDE.md: no em-dash and no emoji, in any language.
test("no user-facing text carries an em-dash or an emoji", () => {
  for (const uncertainty of UNCERTAINTIES) {
    for (const text of [uncertainty.heading, uncertainty.explanation]) {
      assert.ok(!text.includes("—"), `em-dash in ticket ${uncertainty.ticket}: ${text}`);
      assert.ok(!/\p{Extended_Pictographic}/u.test(text), `emoji in ticket ${uncertainty.ticket}: ${text}`);
    }
  }
});

test("uncertaintiesFor hands over no predicate, so the page cannot render a function", () => {
  const found = uncertaintiesFor(context({ lender: { category: "O11", classId: "1e" }, borrower: { category: "O12", classId: "1e" } }));
  assert.ok(found.length > 0);
  for (const uncertainty of found) {
    assert.equal(uncertainty.applies, undefined);
    assert.equal(typeof uncertainty.ticket, "number");
  }
});

test("#11 applies between O11 and O12, in both directions", () => {
  assert.ok(tickets(context({ lender: { category: "O11", classId: "1e" }, borrower: { category: "O12", classId: "1e" } })).includes(11));
  assert.ok(tickets(context({ lender: { category: "O12", classId: "1e" }, borrower: { category: "O11", classId: "1e" } })).includes(11));
});

test("#11 does not apply within O11 or between O12 and O14", () => {
  assert.ok(!tickets(context({ lender: { category: "O11", classId: "1e" }, borrower: { category: "O11", classId: "2e" } })).includes(11));
  assert.ok(!tickets(context({ lender: { category: "O12", classId: "1e" }, borrower: { category: "O14", classId: "1e" } })).includes(11));
});

test("#12 applies when the lender is two age categories older, not one", () => {
  assert.ok(tickets(context({ lender: { category: "O18", classId: "3e" }, borrower: { category: "O14", classId: "1e" } })).includes(12));
  assert.ok(!tickets(context({ lender: { category: "O16", classId: "3e" }, borrower: { category: "O14", classId: "1e" } })).includes(12));
});

test("#13 applies on ground fifth-class, not on ground one-higher", () => {
  const both = { lender: { category: "O14", classId: "5e" }, borrower: { category: "O14", classId: "6e" } };
  assert.ok(tickets(context({ ...both, ground: "fifth-class" })).includes(13));
  assert.ok(!tickets(context({ ...both, ground: "one-higher" })).includes(13));
});

test("#14 applies from the 5th class down across an age category, not within one", () => {
  assert.ok(tickets(context({ lender: { category: "O16", classId: "5e" }, borrower: { category: "O14", classId: "6e" } })).includes(14));
  assert.ok(!tickets(context({ lender: { category: "O14", classId: "5e" }, borrower: { category: "O14", classId: "6e" } })).includes(14));
});

test("#14 does not apply when only one of the two plays in the 5th class or lower", () => {
  assert.ok(!tickets(context({ lender: { category: "O16", classId: "4e" }, borrower: { category: "O14", classId: "6e" } })).includes(14));
});

test("#15 applies with a younger lender on the grounds where the tool allows it", () => {
  const younger = { lender: { category: "O14", classId: "1e" }, borrower: { category: "O18", classId: "3e" } };
  assert.ok(tickets(context({ ...younger, ground: "equal-or-lower" })).includes(15));
  assert.ok(tickets(context({ ...younger, ground: "one-higher" })).includes(15));
});

// On ground too-high both articles come out at no, so the contradiction changes nothing there and
// a warning would only be noise.
test("#15 does not apply on ground too-high, nor with an older lender", () => {
  assert.ok(!tickets(context({ lender: { category: "O14", classId: "1e" }, borrower: { category: "O18", classId: "8e" }, ground: "too-high" })).includes(15));
  assert.ok(!tickets(context({ lender: { category: "O18", classId: "3e" }, borrower: { category: "O16", classId: "2e" }, ground: "equal-or-lower" })).includes(15));
});

test("#16 applies as soon as the age assessment reaches for article 5.2.4", () => {
  const teams = { lender: { category: "O14", classId: "3e" }, borrower: { category: "O14", classId: "4e" } };
  assert.ok(tickets(context({ ...teams, age: { articles: ["5.2.4"] } })).includes(16));
  assert.ok(!tickets(context({ ...teams, age: { articles: ["3.1.1"] } })).includes(16));
  assert.ok(!tickets(context(teams)).includes(16));
});

test("#17 applies as soon as the age assessment reaches for article 5.2.5", () => {
  const teams = { lender: { category: "O12", classId: "1e" }, borrower: { category: "O11", classId: "1e" } };
  assert.ok(tickets(context({ ...teams, age: { articles: ["5.2.5"] } })).includes(17));
  assert.ok(!tickets(context(teams)).includes(17));
});

test("#16 and #17 are the only ones that need a date of birth", () => {
  const needing = UNCERTAINTIES.filter((u) => u.needsDateOfBirth).map((u) => u.ticket);
  assert.deepEqual(needing, [16, 17]);
});

test("#18 applies to the Topklasse O14, on either side", () => {
  assert.ok(tickets(context({ lender: { category: "O14", classId: "top" }, borrower: { category: "O14", classId: "2e" } })).includes(18));
  assert.ok(tickets(context({ lender: { category: "O14", classId: "2e" }, borrower: { category: "O14", classId: "top" } })).includes(18));
  assert.ok(!tickets(context({ lender: { category: "O16", classId: "subtop" }, borrower: { category: "O16", classId: "2e" } })).includes(18));
});

test("#19 applies to IDC-O14 before the lentecompetitie, not in it", () => {
  const teams = { lender: { category: "O14", classId: "idc" }, borrower: { category: "O14", classId: "2e" } };
  assert.ok(tickets(context({ ...teams, periodId: "early" })).includes(19));
  assert.ok(tickets(context({ ...teams, periodId: "mid" })).includes(19));
  assert.ok(!tickets(context({ ...teams, periodId: "late" })).includes(19));
});

// Without a chosen period every period is still possible, and the conservative side is the one
// that warns.
test("#19 applies without a chosen period too", () => {
  assert.ok(tickets(context({ lender: { category: "O14", classId: "idc" }, borrower: { category: "O14", classId: "2e" } })).includes(19));
});

test("#27 applies to the Super O14", () => {
  assert.ok(tickets(context({ lender: { category: "O14", classId: "super" }, borrower: { category: "O14", classId: "2e" } })).includes(27));
  assert.ok(!tickets(context({ lender: { category: "O16", classId: "super" }, borrower: { category: "O16", classId: "2e" } })).includes(27));
});

test("#28 applies to the Subtopklasse O16 around the winterstop, not before the herfstvakantie", () => {
  const teams = { lender: { category: "O16", classId: "subtop" }, borrower: { category: "O16", classId: "2e" } };
  assert.ok(tickets(context({ ...teams, periodId: "mid" })).includes(28));
  assert.ok(tickets(context({ ...teams, periodId: "late" })).includes(28));
  assert.ok(!tickets(context({ ...teams, periodId: "early" })).includes(28));
});

test("#29 applies to a class whose category or level shifts with the period", () => {
  assert.ok(tickets(context({ lender: { category: "O18", classId: "subtop" }, borrower: { category: "O18", classId: "2e" }, periodId: "mid" })).includes(29));
  assert.ok(tickets(context({ lender: { category: "O14", classId: "top" }, borrower: { category: "O14", classId: "subtop" }, periodId: "mid" })).includes(29));
  assert.ok(!tickets(context({ lender: { category: "O16", classId: "2e" }, borrower: { category: "O16", classId: "3e" }, periodId: "mid" })).includes(29));
});

test("#30 applies as soon as a class above the numbered classes is involved", () => {
  assert.ok(tickets(context({ lender: { category: "O18", classId: "landelijk" }, borrower: { category: "O18", classId: "2e" } })).includes(30));
  assert.ok(tickets(context({ lender: { category: "O14", classId: "1e" }, borrower: { category: "O14", classId: "idc" } })).includes(30));
  assert.ok(!tickets(context({ lender: { category: "O14", classId: "1e" }, borrower: { category: "O14", classId: "8e" } })).includes(30));
});

test("#32 applies to the Subtopklasse O18 in the early period and to the O16 one in the mid period", () => {
  assert.ok(tickets(context({ lender: { category: "O18", classId: "subtop" }, borrower: { category: "O18", classId: "2e" }, periodId: "early" })).includes(32));
  assert.ok(!tickets(context({ lender: { category: "O18", classId: "subtop" }, borrower: { category: "O18", classId: "2e" }, periodId: "mid" })).includes(32));
  assert.ok(tickets(context({ lender: { category: "O16", classId: "subtop" }, borrower: { category: "O16", classId: "2e" }, periodId: "mid" })).includes(32));
  assert.ok(!tickets(context({ lender: { category: "O16", classId: "subtop" }, borrower: { category: "O16", classId: "2e" }, periodId: "late" })).includes(32));
});

test("an ordinary combination in the numbered classes carries no uncertainty at all", () => {
  const found = tickets(context({
    lender: { category: "O16", classId: "3e" },
    borrower: { category: "O16", classId: "2e" },
    periodId: "mid",
    ground: "one-higher",
  }));
  assert.deepEqual(found, []);
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test`
Expected: FAIL, `Cannot find module ... uncertainties.js`

- [ ] **Step 3: Write the implementation**

Maak `uncertainties.js`:

```js
// The open questions about the Bondsreglement that the user must be able to see, one per ticket on
// https://github.com/faijdherbe/invalmatrix/issues. CLAUDE.md says that where the reglement leaves
// something open the tool takes the conservative side and files a ticket. This file is what makes
// that choice visible on the page instead of only in the comments.
//
// Every entry stands or falls with its ticket: closes the ticket, then this entry goes too, in the
// same commit. tools/check-uncertainties.mjs guards that.
//
// This file deliberately imports nothing from rules.js. It receives a ready-made context (see
// uncertaintiesFor below), so that the predicate stands right next to the text that explains it and
// there is no cycle between the two modules.
import { CATEGORY_I_UNTIL, O14_LEVEL_GROUPS } from "./data.js";

// A numbered class: 1e through 8e. Everything else is a class at the top of the ladder with a name
// of its own (landelijk, super, top, subtop, idc), and those are the classes articles 4.3.8 and
// 5.3.5.4 list per period.
function isNumberedClass(classId) {
  return /^[1-8]e$/.test(classId);
}

function hasNamedClass(team) {
  return !isNumberedClass(team.classId);
}

// A class whose category or level group shifts halfway through the season: exactly the classes in
// CATEGORY_I_UNTIL and in the level groups of article 5.3.5.4. Read from data.js so this moves
// along when the season data changes.
function isPeriodSensitive(team) {
  if ((CATEGORY_I_UNTIL[team.category] || {})[team.classId]) return true;
  if (team.category !== "O14") return false;
  return O14_LEVEL_GROUPS.some((group) => group.classes.includes(team.classId));
}

export const UNCERTAINTIES = [
  {
    ticket: 11,
    heading: "Zijn O11 en O12 een niveau of twee leeftijdscategorieen?",
    explanation:
      "Artikel 3.1.1 noemt O11 en O12 twee aparte leeftijdscategorieen, maar de tabel klassengrenzen zet ze in een gedeelde kolom. Deze tool volgt de tabel en rekent dus geen klasse verschil tussen O11 en O12.",
    needsDateOfBirth: false,
    applies: (c) => {
      const categories = [c.lender.category, c.borrower.category];
      return categories.includes("O11") && categories.includes("O12");
    },
  },
  {
    ticket: 12,
    heading: "Hoeveel klassen lager moet een team uit een oudere leeftijdscategorie spelen?",
    explanation:
      "Artikel 5.3.5.1 zegt alleen 'minimaal een klasse lager', zonder ophoging per leeftijdscategorie. De tabel klassengrenzen hoogt wel per categorie op. Deze tool volgt de tabel, en dat is hier de strengste lezing.",
    needsDateOfBirth: false,
    applies: (c) => c.categoryDistance >= 2,
  },
  {
    ticket: 13,
    heading: "Geldt het maximum van twee invallers altijd?",
    explanation:
      "Artikel 5.3.5.3 zegt dat er zonder toestemming van de competitieleiding maximaal twee spelers mogen invallen. Of dat altijd geldt of alleen als het team elf of meer eigen spelers beschikbaar heeft, hangt af van waar het woord 'hierbij' naar terugslaat. Vraag dit na bij de competitieleiding.",
    needsDateOfBirth: false,
    applies: (c) => c.ground === "fifth-class",
  },
  {
    ticket: 14,
    heading: "Geldt de uitzondering voor de 5e klasse ook tussen leeftijdscategorieen?",
    explanation:
      "Artikel 5.3.5.3 begint met 'binnen dezelfde leeftijdscategorie', maar sluit af met 'dit klassenverschil geldt dus ook tussen (leeftijds-)categorieen'. Deze tool past de uitzondering alleen binnen dezelfde categorie toe, de strengste lezing.",
    needsDateOfBirth: false,
    applies: (c) => c.bothFifthOrLower && c.lender.category !== c.borrower.category,
  },
  {
    ticket: 15,
    heading: "Artikel 3.1.3 verbiedt wat artikel 5.3.5.1 uitdrukkelijk toestaat",
    explanation:
      "Artikel 5.3.5.1 staat lenen uit een jongere leeftijdscategorie toe en geeft er een voorbeeld van dat alleen kan werken met een speler die te jong is voor de categorie waarin zij invalt. Artikel 3.1.3 verbiedt precies dat zonder dispensatie, en de tabel klassengrenzen zegt dat de leeftijdsgrenzen altijd bepalend zijn. Bij twijfel beslist de competitieleiding.",
    needsDateOfBirth: false,
    // On ground too-high both readings come out at no, so there the contradiction changes nothing
    // and the warning would only be noise. Out of scope has no ground at all and no verdict to
    // warn about either.
    applies: (c) => c.categoryDistance < 0 && (c.ground === "equal-or-lower" || c.ground === "one-higher"),
  },
  {
    ticket: 16,
    heading: "Valt elke speler die een jaar te oud is onder artikel 5.2.4?",
    explanation:
      "Deze tool gaat ervan uit dat een speler die precies een jaar boven de grens van haar eigen categorie zit, een van de twee spelers is die volgens artikel 5.2.4 op de teamlijst mogen staan, en dus nooit mag invallen. Het reglement zegt dat niet met zoveel woorden.",
    needsDateOfBirth: true,
    applies: (c) => c.age !== null && c.age.articles.includes("5.2.4"),
  },
  {
    ticket: 17,
    heading: "Bedoelt artikel 5.2.5 elfjarigen of twaalfjarigen?",
    explanation:
      "Artikel 5.2.5 spreekt over 'O12-jarigen' die in de O11-categorie mogen worden ingedeeld. Deze tool leest dat als spelers uit de O12-categorie, dus elfjarigen. Letterlijk gelezen zou het ook twaalfjarigen kunnen betekenen, en dat scheelt een heel jaar.",
    needsDateOfBirth: true,
    applies: (c) => c.age !== null && c.age.articles.includes("5.2.5"),
  },
  {
    ticket: 18,
    heading: "Valt de Topklasse O14 onder categorie I of categorie II?",
    explanation:
      "Hoofdstuk 2 noemt bij O14 alleen de Super Competitie onder categorie I, dus valt de Topklasse onder categorie II. De tabel klassengrenzen zet de Topklasse O14 juist met een sterretje bij de categorie I-competities. Deze tool volgt hoofdstuk 2 en doet dus wel een uitspraak over deze klasse.",
    needsDateOfBirth: false,
    applies: (c) => c.involves("O14", "top"),
  },
  {
    ticket: 19,
    heading: "Valt IDC-O14 voor de winterstop onder categorie I of categorie II?",
    explanation:
      "Hoofdstuk 2 noemt IDC-O14 alleen vanaf de winterstop onder categorie II, en zegt niets over de periode daarvoor. Deze tool doet voor die periode geen uitspraak, de kant die nooit ten onrechte ja zegt.",
    needsDateOfBirth: false,
    applies: (c) => c.involves("O14", "idc") && c.periodId !== "late",
  },
  {
    ticket: 27,
    heading: "Hoofdstuk 2 en hoofdstuk 4 noemen de Super O14 verschillend",
    explanation:
      "Hoofdstuk 2 zet de Super Competitie O14 zonder voorbehoud onder categorie I, hoofdstuk 4 zet er 'vanaf de winterstop' bij. Deze tool volgt hoofdstuk 2 en houdt de Super O14 het hele seizoen buiten beeld.",
    needsDateOfBirth: false,
    applies: (c) => c.involves("O14", "super"),
  },
  {
    ticket: 28,
    heading: "Vanaf de winterstop of vanaf na de winterstop bij de Subtopklasse O16?",
    explanation:
      "Dezelfde zin staat twee keer in het reglement en niet gelijk overgetypt: hoofdstuk 2 zegt 'vanaf de winterstop', hoofdstuk 5 zegt 'vanaf na de winterstop'. Dat scheelt een week. Deze tool houdt de winterstopweek zelf bij categorie I.",
    needsDateOfBirth: false,
    applies: (c) => c.involves("O16", "subtop") && c.periodId !== "early",
  },
  {
    ticket: 29,
    heading: "Waar ligt de grens tussen de voorcompetitie en de lentecompetitie?",
    explanation:
      "De artikelen 4.3.8, 4.3.9 en 5.3.5.4 gebruiken beide termen, maar geen van alle zegt waar de grens ligt of welke weken bij welke periode horen. Deze tool houdt de winterstop aan.",
    needsDateOfBirth: false,
    applies: (c) => isPeriodSensitive(c.lender) || isPeriodSensitive(c.borrower),
  },
  {
    ticket: 30,
    heading: "Verschilt het klassenaanbod aan de top per periode?",
    explanation:
      "De artikelen 4.3.8 en 5.3.5.4 sommen per periode andere klassen op, wat erop wijst dat teams aan de top halverwege het seizoen van klasse wisselen. Deze tool laat je in elke periode elke klasse kiezen en gaat ervan uit dat jij weet in welke klasse je team op de speeldag zelf uitkomt.",
    needsDateOfBirth: false,
    applies: (c) => hasNamedClass(c.lender) || hasNamedClass(c.borrower),
  },
  {
    ticket: 32,
    heading: "Valt de herfstvakantie of de winterstop zelf onder categorie I of categorie II?",
    explanation:
      "Hoofdstuk 2 claimt die week twee keer: 'tot en met de herfstvakantie' onder categorie I en 'vanaf de herfstvakantie' onder categorie II, en bij de winterstop gebeurt hetzelfde. Deze tool zet die week bij categorie I, de kant die nooit ten onrechte ja zegt.",
    needsDateOfBirth: false,
    applies: (c) =>
      (c.involves("O18", "subtop") && c.periodId === "early") ||
      (c.involves("O16", "subtop") && c.periodId === "mid"),
  },
];

// The uncertainties that apply to one combination, in the order of UNCERTAINTIES, so the page
// always shows them in the same sequence. The predicate itself is left out: what comes back here
// goes straight to the screen and a function has no business there.
export function uncertaintiesFor(context) {
  return UNCERTAINTIES.filter((uncertainty) => uncertainty.applies(context)).map(
    ({ ticket, heading, explanation, needsDateOfBirth }) => ({ ticket, heading, explanation, needsDateOfBirth }),
  );
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm test`
Expected: PASS, alle tests inclusief de bestaande 183.

- [ ] **Step 5: Commit**

```bash
git add uncertainties.js test/uncertainties.test.js
git commit -m "feat: leg de openstaande onduidelijkheden vast met een predicaat per ticket"
```

---

## Task 2: rules.js geeft de onzekerheden mee

**Files:**
- Modify: `rules.js` (imports bovenaan, `assessLevel` rond regel 126 en 216, `assess` rond regel 424)
- Test: `test/rules.test.js` (nieuwe tests achteraan, plus de aanpassing van vier bestaande tests)

**Interfaces:**
- Consumes: `uncertaintiesFor(context)` uit Task 1.
- Produces: `assess()` geeft er een veld `uncertainties` bij, een array van `{ ticket, heading, explanation, needsDateOfBirth }`. Ook bij `verdict: "out-of-scope"` en bij `verdict: "not-allowed"`.

- [ ] **Step 1: Write the failing test**

Voeg achteraan `test/rules.test.js` toe:

```js
// Ticket #26 group: the open uncertainties of the Bondsreglement must reach the page, so a coach
// can see that a verdict rests on a choice the reglement does not make. uncertainties.js holds the
// list; these tests check that assess() hands it over on every kind of verdict.

test("assess hands over the uncertainties that apply to the combination", () => {
  const r = assess({ category: "O14", classId: "idc" }, { category: "O14", classId: "2e" }, null, "early");
  const numbers = r.uncertainties.map((u) => u.ticket);
  assert.ok(numbers.includes(19), `ticket 19 missing: ${numbers}`);
  assert.ok(numbers.includes(30), `ticket 30 missing: ${numbers}`);
});

test("an ordinary combination in the numbered classes gets an empty list", () => {
  const r = assess({ category: "O16", classId: "3e" }, { category: "O16", classId: "2e" }, null, "mid");
  assert.deepEqual(r.uncertainties, []);
});

test("a verdict of not-allowed carries its uncertainties too", () => {
  const r = assess({ category: "O14", classId: "top" }, { category: "O14", classId: "8e" }, null, "mid");
  assert.equal(r.verdict, "not-allowed");
  assert.ok(r.uncertainties.map((u) => u.ticket).includes(18));
});

test("a verdict of out-of-scope carries its uncertainties too, because that verdict rests on one", () => {
  const r = assess({ category: "O14", classId: "super" }, { category: "O14", classId: "2e" }, null, "mid");
  assert.equal(r.verdict, "out-of-scope");
  assert.ok(r.uncertainties.map((u) => u.ticket).includes(27));
});

test("ticket #16 only shows up once a date of birth reaches article 5.2.4", () => {
  const teams = [{ category: "O14", classId: "3e" }, { category: "O14", classId: "4e" }];
  const without = assess(teams[0], teams[1], null, "mid");
  assert.ok(!without.uncertainties.map((u) => u.ticket).includes(16));
  const withDate = assess(teams[0], teams[1], d("2012-05-01"), "mid");
  assert.ok(withDate.uncertainties.map((u) => u.ticket).includes(16));
});

test("every uncertainty in an outcome carries a heading and an explanation, ready for the page", () => {
  const r = assess({ category: "O14", classId: "idc" }, { category: "O14", classId: "2e" }, null, "early");
  for (const uncertainty of r.uncertainties) {
    assert.ok(uncertainty.heading.length > 0);
    assert.ok(uncertainty.explanation.length > 0);
    assert.equal(uncertainty.applies, undefined);
  }
});

// Ticket #15 used to sit in caveats without a ticket number, ticket #13 sat in conditions. Both are
// uncertainty about the reglement itself and now live in uncertainties.js, where they carry their
// number and a link. The old spots must therefore be empty.
test("the younger-category text is no longer a caveat, it is uncertainty #15", () => {
  const r = assess({ category: "O14", classId: "1e" }, { category: "O18", classId: "3e" }, null, "mid");
  assert.ok(!r.caveats.some((k) => /jongere leeftijdscategorie/.test(k)), JSON.stringify(r.caveats));
  assert.ok(r.uncertainties.map((u) => u.ticket).includes(15));
});

test("the max-two doubt is no longer a condition, it is uncertainty #13", () => {
  const r = assess({ category: "O14", classId: "5e" }, { category: "O14", classId: "6e" }, null, "mid");
  assert.equal(r.ground, "fifth-class");
  assert.ok(!r.conditions.some((v) => /^Onduidelijk is of dit maximum altijd geldt/.test(v)), JSON.stringify(r.conditions));
  assert.ok(r.conditions.some((v) => /^Er mogen maximaal twee spelers invallen zonder toestemming/.test(v)), "the max-two condition itself must stay");
  assert.ok(r.uncertainties.map((u) => u.ticket).includes(13));
});

test("the verdict on ground fifth-class stays 'ja, mits', because the max-two condition remains", () => {
  const r = assess({ category: "O14", classId: "5e" }, { category: "O14", classId: "6e" }, null, "mid");
  assert.equal(r.verdict, "allowed");
  assert.match(r.summary, /^Ja, mits/);
});

test("every combination of period, category and class yields a working list of uncertainties", () => {
  for (const period of PERIODS) {
    for (const borrowerCategory of AGE_CATEGORIES) {
      for (const borrowerClass of CLASSES[borrowerCategory]) {
        const borrower = { category: borrowerCategory, classId: borrowerClass.id };
        for (const lenderCategory of AGE_CATEGORIES) {
          for (const lenderClass of CLASSES[lenderCategory]) {
            const lender = { category: lenderCategory, classId: lenderClass.id };
            const r = assess(lender, borrower, null, period.id);
            assert.ok(Array.isArray(r.uncertainties), `${period.id} ${lenderCategory} ${lenderClass.id} to ${borrowerCategory} ${borrowerClass.id}`);
          }
        }
      }
    }
  }
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test`
Expected: FAIL. De nieuwe tests falen op `r.uncertainties` is `undefined`. Vier bestaande tests falen nog niet, die sneuvelen pas in stap 3.

- [ ] **Step 3: Write the implementation**

In `rules.js`, voeg de import toe onder de bestaande import uit `./data.js`:

```js
import { uncertaintiesFor } from "./uncertainties.js";
```

Verwijder in `assessLevel` de vier regels van `youngerCategoryCaveat` (de constante zelf, inclusief het commentaarblok erboven, en de twee `caveats.push(youngerCategoryCaveat);` regels met de `if (fromYoungerCategory) {` eromheen). Op de twee plekken waar dat blok stond, blijft alleen het toevoegen van artikel 3.1.3 over. Dus dit:

```js
    if (fromYoungerCategory) {
      caveats.push(youngerCategoryCaveat);
      addArticles("3.1.3");
    }
```

wordt op beide plekken:

```js
    // Borrowing from a younger age category is what article 5.3.5.1 gives an example of, while
    // article 3.1.3 and the class boundaries table always let the age limits decide. That
    // contradiction is uncertainty #15 in uncertainties.js; here only the article number remains.
    if (fromYoungerCategory) addArticles("3.1.3");
```

Verwijder in het blok `if (lenderPlaysHigherWithinLowClasses) {` de tweede `conditions.push`, die met "Onduidelijk is of dit maximum altijd geldt", inclusief het commentaar over ticket #13 erboven. Zet daarvoor in de plaats:

```js
    // Whether this maximum always applies or only with eleven or more of its own players is
    // uncertainty #13 in uncertainties.js. It is not a condition a team can meet, so it does not
    // belong in this list.
```

Vervang de body van `assess` vanaf het begin tot en met de `return` aan het eind door:

```js
export function assess(lender, borrower, dateOfBirth, periodId = null) {
  const outOfScope = categoryINotice(lender, periodId) || categoryINotice(borrower, periodId);
  if (outOfScope) {
    return {
      verdict: "out-of-scope",
      summary: outOfScope,
      conditions: [],
      reasoning: [],
      age: null,
      articles: [],
      ground: null,
      caveats: [],
      // Out of scope is itself a verdict resting on the classification of chapter 2, and that is
      // exactly what several tickets are about, so the uncertainties belong here too.
      uncertainties: uncertaintiesFor(uncertaintyContext(lender, borrower, periodId, null, null)),
    };
  }

  const levelOutcome = assessLevel(lender, borrower);
  // An unreadable date of birth is treated as "no date of birth given": the age check simply does
  // not run then. ageOnReferenceDate does throw a clear error when it is called directly with an
  // invalid date, see the explanation in the report.
  const age = hasValidDateOfBirth(dateOfBirth) ? assessAge(lender, borrower, dateOfBirth) : null;
```

en voeg vlak voor de afsluitende `return` van `assess` toe:

```js
  const uncertainties = uncertaintiesFor(
    uncertaintyContext(lender, borrower, periodId, levelOutcome.ground, age),
  );
```

en zet `uncertainties,` in het teruggegeven object, achter `caveats`.

Zet boven `assess` de functie die de context bouwt:

```js
// The context the predicates in uncertainties.js read. Everything they need is calculated here, so
// that file needs nothing from rules.js and there is no cycle between the two.
function uncertaintyContext(lender, borrower, periodId, ground, age) {
  return {
    lender,
    borrower,
    periodId,
    ground,
    age,
    categoryDistance:
      AGE_CATEGORY_ORDER.indexOf(lender.category) - AGE_CATEGORY_ORDER.indexOf(borrower.category),
    involves: (category, classId) =>
      (lender.category === category && lender.classId === classId) ||
      (borrower.category === category && borrower.classId === classId),
    bothFifthOrLower: isFifthOrLower(lender.classId) && isFifthOrLower(borrower.classId),
  };
}
```

- [ ] **Step 4: Fix the four tests that now fail for the right reason**

`npm test` meldt nu ook vier bestaande tests in `test/rules.test.js` die op de verhuisde teksten sturen. Pas ze aan, verwijder ze niet.

De test op regel 944, `caveat: with a younger lender the caveat is there without a date of birth too, with article 3.1.3`, wordt:

```js
test("uncertainty #15: with a younger lender it is there without a date of birth too, with article 3.1.3", () => {
  const r = check("O14", "1e", "O18", "3e");
  assert.equal(r.allowed, true);
  // Was: a caveat matching /jongere leeftijdscategorie/. That text was uncertainty about the
  // reglement itself, not a caveat about what this tool cannot know, so it moved to
  // uncertainties.js as ticket #15. assessLevel does not know about uncertainties, so what is left
  // to check here is the article; the ticket itself is checked through assess() below.
  assert.ok(r.articles.includes("3.1.3"), "article 3.1.3 missing");
  assert.ok(r.articles.includes("5.3.5.1"), "article 5.3.5.1 missing");

  const withoutDateOfBirth = assess({ category: "O14", classId: "1e" }, { category: "O18", classId: "3e" }, null);
  assert.equal(withoutDateOfBirth.verdict, "allowed");
  assert.ok(withoutDateOfBirth.uncertainties.map((u) => u.ticket).includes(15));
  assert.ok(withoutDateOfBirth.articles.includes("3.1.3"));
});
```

De test op regel 960, `caveat: an equal category yields no caveat about a younger category`, wordt:

```js
test("uncertainty #15: an equal age category yields nothing about a younger category", () => {
  // Was: no caveat matching /jongere leeftijdscategorie/. That text is now uncertainty #15, so
  // this checks the same thing one level up.
  const r = assess({ category: "O16", classId: "2e" }, { category: "O16", classId: "2e" }, null);
  assert.ok(!r.uncertainties.map((u) => u.ticket).includes(15));
});
```

De test op regel 968, `caveat: an older lender yields no caveat about a younger category`, wordt:

```js
test("uncertainty #15: an older lender yields nothing about a younger category", () => {
  // Was: no caveat matching /jongere leeftijdscategorie/. See the previous test for why this now
  // goes through assess().
  const r = assess({ category: "O18", classId: "3e" }, { category: "O16", classId: "2e" }, null);
  assert.ok(!r.uncertainties.map((u) => u.ticket).includes(15));
});
```

Haal in `CONDITION_TO_REQUIREMENT` rond regel 1282 de regel `[/^Onduidelijk is of dit maximum altijd geldt/, "max-two"],` weg en zet er dit commentaar boven de array bij:

```js
// The line about "Onduidelijk is of dit maximum altijd geldt" stood here until this task. It was
// never a condition a team could meet, but uncertainty about article 5.3.5.3 itself, and it now
// lives in uncertainties.js as ticket #13.
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npm test`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add rules.js test/rules.test.js
git commit -m "feat: geef de geldende onduidelijkheden mee met elk oordeel"
```

---

## Task 3: de onzekerheden bereiken het raster

**Files:**
- Modify: `rules.js` (`cellFromOutcome` rond regel 512, `overview` rond regel 540)
- Test: `test/rules.test.js`

**Interfaces:**
- Consumes: `outcome.uncertainties` uit Task 2.
- Produces: `cellFromOutcome()` geeft er een veld `uncertain: boolean` bij, ook bij status `no` en `out-of-scope`. `overview()` zet dat veld op elke bestaande cel.

- [ ] **Step 1: Write the failing test**

Voeg toe aan `test/rules.test.js`:

```js
test("cellFromOutcome marks a cell as uncertain when the outcome carries an uncertainty", () => {
  const outcome = assess({ category: "O14", classId: "idc" }, { category: "O14", classId: "2e" }, null, "early");
  assert.equal(cellFromOutcome(outcome).uncertain, true);
});

test("cellFromOutcome leaves an ordinary cell alone", () => {
  const outcome = assess({ category: "O16", classId: "3e" }, { category: "O16", classId: "2e" }, null, "mid");
  assert.equal(cellFromOutcome(outcome).uncertain, false);
});

// A "nee" that rests on a choice the reglement does not make is exactly what a coach needs to
// know, so the marker must survive on that status too.
test("a cell with status no or out-of-scope can be uncertain as well", () => {
  const no = assess({ category: "O14", classId: "top" }, { category: "O14", classId: "8e" }, null, "mid");
  assert.equal(cellFromOutcome(no).status, "no");
  assert.equal(cellFromOutcome(no).uncertain, true);

  const outOfScope = assess({ category: "O14", classId: "super" }, { category: "O14", classId: "2e" }, null, "mid");
  assert.equal(cellFromOutcome(outOfScope).status, "out-of-scope");
  assert.equal(cellFromOutcome(outOfScope).uncertain, true);
});

test("overview passes the marker on for every cell that exists", () => {
  const rows = overview({ category: "O14", classId: "2e" }, "early");
  const idc = rows.find((row) => row.category === "O14").cells.find((cell) => cell.classId === "idc");
  assert.equal(idc.uncertain, true);
  for (const row of rows) {
    for (const cell of row.cells) {
      if (!cell.exists) continue;
      assert.equal(typeof cell.uncertain, "boolean", `${row.category} ${cell.classId}`);
    }
  }
});

// The grid calculates without a date of birth, so an uncertainty about an age rule can never run
// there. This guards that a new uncertainty with needsDateOfBirth does not sneak into the grid.
test("no uncertainty that needs a date of birth ever reaches the grid", () => {
  const needing = new Set(UNCERTAINTIES.filter((u) => u.needsDateOfBirth).map((u) => u.ticket));
  for (const period of PERIODS) {
    for (const borrowerCategory of AGE_CATEGORIES) {
      for (const borrowerClass of CLASSES[borrowerCategory]) {
        const borrower = { category: borrowerCategory, classId: borrowerClass.id };
        for (const row of overview(borrower, period.id)) {
          for (const cell of row.cells) {
            if (!cell.exists) continue;
            const outcome = assess({ category: row.category, classId: cell.classId }, borrower, null, period.id);
            for (const uncertainty of outcome.uncertainties) {
              assert.ok(!needing.has(uncertainty.ticket), `ticket ${uncertainty.ticket} in the grid at ${row.category} ${cell.classId}`);
            }
          }
        }
      }
    }
  }
});
```

Voeg `UNCERTAINTIES` toe aan de imports bovenaan `test/rules.test.js`:

```js
import { UNCERTAINTIES } from "../uncertainties.js";
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test`
Expected: FAIL, `expected undefined to equal true` op `cellFromOutcome(outcome).uncertain`.

- [ ] **Step 3: Write the implementation**

In `rules.js`, `cellFromOutcome`: vervang de twee vroege returns en de slotregel zodat elke tak het veld draagt.

```js
export function cellFromOutcome(outcome) {
  // A cell rests on an open uncertainty regardless of its status: a "nee" or a "geen uitspraak"
  // that follows from a choice the reglement does not make is exactly what a coach must see.
  const uncertain = outcome.uncertainties.length > 0;
  if (outcome.verdict === "out-of-scope") return { status: "out-of-scope", requirements: [], uncertain };
  if (outcome.verdict === "not-allowed") return { status: "no", requirements: [], uncertain };
```

en aan het eind van diezelfde functie:

```js
  return { status: "free", requirements, uncertain };
```

In `overview`, voeg `uncertain` toe aan het teruggegeven celobject, achter `requirements`:

```js
        requirements: cell.requirements,
        uncertain: cell.uncertain,
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add rules.js test/rules.test.js
git commit -m "feat: markeer rastercellen die op een openstaande onduidelijkheid rusten"
```

---

## Task 4: de accordion in de uitleg

**Files:**
- Modify: `app.js` (rond `cautionBlockHtml` op regel 426 en `showDetail` op regel 455)
- Modify: `style.css` (achteraan)

**Interfaces:**
- Consumes: `outcome.uncertainties` uit Task 2.
- Produces: niets voor latere taken.

- [ ] **Step 1: Write the implementation**

Er is nog geen DOM-testharnas (ticket #33), dus deze taak heeft geen unit-test. Hij wordt in de browser nagelopen in stap 2.

Voeg in `app.js` boven `cautionBlockHtml` toe:

```js
const ISSUE_URL = "https://github.com/faijdherbe/invalmatrix/issues";

// The open uncertainties about the Bondsreglement that apply to this combination, from
// uncertainties.js through assess(). Collapsed, because a combination can carry four of them at
// once and the verdict must stay readable. It sits directly under the verdict and above "Let op",
// so the answer stays where the eye lands and the warning is still the first thing after it.
function uncertaintyBlockHtml(uncertainties) {
  if (uncertainties.length === 0) return "";
  const count = uncertainties.length;
  const heading = `Het reglement is hier op ${count} punt${count === 1 ? "" : "en"} onduidelijk`;
  const items = uncertainties
    .map((uncertainty) => {
      const link = `<a href="${ISSUE_URL}/${uncertainty.ticket}" target="_blank" rel="noopener">ticket #${uncertainty.ticket}</a>`;
      return `<li><strong>${escape(uncertainty.heading)}</strong><br>${escape(uncertainty.explanation)} (${link})</li>`;
    })
    .join("");
  return `<details class="uncertainty"><summary>${escape(heading)}</summary><ul>${items}</ul></details>`;
}
```

Zet in `showDetail` de aanroep tussen het oordeel en het blok "Let op":

```js
  result.innerHTML = [
    `<p class="verdict">${escape(outcome.summary)}</p>`,
    uncertaintyBlockHtml(outcome.uncertainties),
    cautionBlockHtml(outcome.caveats),
    list("Voorwaarden", outcome.conditions),
    outcome.age ? list("Leeftijd", outcome.age.messages) : "",
    list("Waarom", outcome.reasoning),
    articleBlock(outcome.articles),
  ].join("");
```

Voeg achteraan `style.css` toe:

```css
/* The block with the open uncertainties, directly under the verdict. Purple, so it is not confused
   with the yellow of a condition or the red of a rejection: this says nothing about the verdict
   itself, only that the verdict rests on a choice the reglement does not make. Collapsed by
   default, because a combination can carry four uncertainties at once. */
.uncertainty {
  margin: 0.75rem 0;
  border-left: 5px solid var(--purple);
  background: var(--purple-surface);
  padding: 0.5rem 0.75rem;
  border-radius: 3px;
}

.uncertainty > summary {
  cursor: pointer;
  font-weight: 600;
  color: var(--purple);
}

/* The warning sign before the heading. A character rather than an image, and aria-hidden is not
   needed: the text right after it says the same thing in words. */
.uncertainty > summary::before {
  content: "/!\\  ";
  white-space: pre;
}

.uncertainty ul {
  margin: 0.5rem 0 0;
  padding-left: 1.2rem;
}

.uncertainty li + li {
  margin-top: 0.5rem;
}
```

Voeg de twee kleuren toe aan `:root` bovenaan `style.css`, onder `--red-surface`:

```css
  --purple: #5b3d8f;
  --purple-surface: #f0eaf8;
```

- [ ] **Step 2: Check it in the browser**

Run: `python3 -m http.server 8000`
Open `http://localhost:8000`, kies periode "voorcompetitie tot en met de herfstvakantie", categorie O14, klasse 2e klasse, en klik het vakje van O14 IDC-O14 aan.
Expected: onder het oordeel staat een dichtgeklapte regel "/!\ Het reglement is hier op 3 punten onduidelijk". Uitklappen toont de koppen van #19, #29 en #30, elk met uitleg en een werkende link naar GitHub.
Kies daarna O16 3e klasse en klik O16 4e klasse aan.
Expected: geen accordion, het scherm ziet eruit als voorheen.

- [ ] **Step 3: Commit**

```bash
git add app.js style.css
git commit -m "feat: toon de openstaande onduidelijkheden onder het oordeel"
```

---

## Task 5: het hoekje in het raster en de mobiele lijst

**Files:**
- Modify: `app.js` (rond regel 161 tot 200, `gridTableHtml` op regel 265, `mobileCategoryHtml` op regel 315)
- Modify: `style.css`

**Interfaces:**
- Consumes: `cell.uncertain` uit Task 3.
- Produces: niets voor latere taken.

- [ ] **Step 1: Write the implementation**

Voeg in `app.js` onder `SR_ONLY_CAVEAT` toe:

```js
// Same approach as SR_ONLY_CAVEAT above: the purple corner is purely visual, so this is how
// someone who does not see color still learns that this cell rests on an open uncertainty.
const SR_ONLY_UNCERTAIN = '<span class="sr-only"> (met een openstaande onduidelijkheid)</span>';
```

Voeg onder `caveatExplanationHtml` toe:

```js
// A small example of the purple corner, for the explanation line, next to the yellow one.
function uncertaintyExampleHtml() {
  return `<span class="caveat-example uncertain-corner" aria-hidden="true">${escape(STATUSES.free.short)}</span>`;
}

// Refers to the purple corner: the verdict in this cell rests on a point the Bondsreglement leaves
// open, and the detail view says which one.
function uncertaintyExplanationHtml() {
  return `${uncertaintyExampleHtml()} betekent: het reglement is hier onduidelijk over, klik op het vakje om te zien waarover.`;
}
```

Breid `cellHtml` uit, zodat de onzichtbare tekst meekomt:

```js
function cellHtml(cell) {
  const text = requirementsLabel(cell.requirements) || STATUSES[cell.status].short;
  const caveat = cell.requirements.includes("max-two") ? SR_ONLY_CAVEAT : "";
  const uncertain = cell.uncertain ? SR_ONLY_UNCERTAIN : "";
  return `${escape(text)}${srOnlyRequirementsHtml(cell.requirements)}${caveat}${uncertain}`;
}
```

Vervang in `gridTableHtml` de regel met `buttonClass` door:

```js
          const markers = [
            cell.requirements.includes("max-two") ? "corner-triangle" : "",
            cell.uncertain ? "uncertain-corner" : "",
          ].filter(Boolean);
          const buttonClass = markers.length > 0 ? ` class="${markers.join(" ")}"` : "";
```

Zet in `gridTableHtml` de nieuwe uitlegregel in de legenda, direct onder `caveatExplanationHtml()`:

```js
    caveatExplanationHtml(),
    uncertaintyExplanationHtml(),
```

Doe hetzelfde in `mobileExplanationHtml`:

```js
    caveatExplanationHtml(),
    uncertaintyExplanationHtml(),
```

Vervang in `mobileCategoryHtml` het blok binnen de `map` door:

```js
          const title = `${row.category} ${cell.label}`;
          const caveat = cell.requirements.includes("max-two");
          const requirements = requirementsLabel(cell.requirements);
          const labelHtml = [
            escape(cell.label),
            requirements ? ` <span class="mobile-requirements">${escape(requirements)}</span>` : "",
            srOnlyRequirementsHtml(cell.requirements),
            caveat ? SR_ONLY_CAVEAT : "",
            cell.uncertain ? SR_ONLY_UNCERTAIN : "",
          ].join("");
          const className = [
            "mobile-class",
            escape(cellColor(cell)),
            caveat ? "caveat" : "",
            cell.uncertain ? "uncertain" : "",
          ].filter(Boolean).join(" ");
          return `<button type="button" class="${className}" data-category="${escape(row.category)}" data-class-id="${escape(cell.classId)}" title="${escape(title)}">${labelHtml}</button>`;
```

Voeg in `style.css` onder het blok `.corner-triangle::after` toe:

```css
/* Small triangle in the bottom left of the cell: the verdict here rests on a point the
   Bondsreglement leaves open (see uncertainties.js). Deliberately a different corner and a
   different color than the yellow triangle above, because a cell can carry both. It uses ::before
   where the yellow one uses ::after, for the same reason. Purple, so it stands out against the
   green, yellow, red and grey cell backgrounds alike. The marker is purely visual; see
   SR_ONLY_UNCERTAIN in app.js for the textual counterpart. */
.uncertain-corner {
  position: relative;
}

.uncertain-corner::before {
  content: "";
  position: absolute;
  bottom: 0;
  left: 0;
  width: 0;
  height: 0;
  border-bottom: 0.6rem solid var(--purple);
  border-right: 0.6rem solid transparent;
}
```

Voeg onder `.mobile-class.caveat` toe:

```css
/* In the mobile list the same reason as for .mobile-class.caveat above: a corner on a fully round
   pill floats loose from the shape, so this is a border too. Carries a cell both markers, then the
   purple ring sits inside the yellow one. */
.mobile-class.uncertain {
  box-shadow: inset 0 0 0 2px var(--purple);
}

.mobile-class.caveat.uncertain {
  box-shadow: inset 0 0 0 2px var(--yellow), inset 0 0 0 4px var(--purple);
}
```

- [ ] **Step 2: Check it in the browser**

Run: `python3 -m http.server 8000`
Open `http://localhost:8000`, kies periode "voorcompetitie na de herfstvakantie tot en met de winterstop", categorie O16, klasse 2e klasse. Dit zijn de vakjes zoals het dan moet staan:

- De kolommen IDC-O14, Top en Subtop dragen overal een paars hoekje linksonder.
- De rijen O16 en O18 blijven in de genummerde kolommen schoon: daar is niets onduidelijk.
- De rijen O11, O12 en O14 dragen in de genummerde kolommen wel een hoekje, want daar leent een jongere leeftijdscategorie uit en dat is onduidelijkheid #15.
- De legenda onder het raster noemt het paarse hoekje, onder de regel over het gele driehoekje.

Klik het vakje O16 Subtop aan.
Expected: de accordion zegt "op 4 punten onduidelijk" en noemt de tickets #28, #29, #30 en #32.

Maak het venster smal.
Expected: de mobiele lijst toont dezelfde klassen met een paarse binnenrand, en de uitleg eronder noemt het hoekje. Een klasse die zowel de gele als de paarse markering draagt toont de paarse ring binnen de gele.

- [ ] **Step 3: Run the tests**

Run: `npm test`
Expected: PASS. `app.js` heeft geen tests, maar `test/page-text.test.js` leest de pagina en mag niet sneuvelen.

- [ ] **Step 4: Commit**

```bash
git add app.js style.css
git commit -m "feat: markeer onduidelijke vakjes in het raster en de mobiele lijst"
```

---

## Task 6: het controlescript

**Files:**
- Create: `tools/check-uncertainties.mjs`

**Interfaces:**
- Consumes: `UNCERTAINTIES` uit Task 1, en `gh` op het pad.
- Produces: een uitvoerbaar script, afsluitcode 0 als de lijst klopt en 1 als er iets te melden valt.

- [ ] **Step 1: Write the implementation**

Dit script praat met GitHub en hoort daarom niet in `npm test`: de testsuite moet offline en zonder `gh` blijven draaien. Er is dus geen unit-test; stap 2 draait het echt.

Maak `tools/check-uncertainties.mjs`:

```js
// Checks that the list in uncertainties.js matches the open tickets on GitHub. Two directions:
// a ticket in the list that is closed means a warning stayed on the page too long, and an open
// "Onzeker:" ticket that is not in the list means a warning is missing. See CLAUDE.md.
//
// Deliberately not part of npm test: that suite must keep running offline and without gh.
import { execFileSync } from "node:child_process";
import { UNCERTAINTIES } from "../uncertainties.js";

const REPO = "faijdherbe/invalmatrix";

function issues(state) {
  const output = execFileSync(
    "gh",
    ["issue", "list", "--repo", REPO, "--state", state, "--limit", "200", "--json", "number,title,state"],
    { encoding: "utf8" },
  );
  return JSON.parse(output);
}

// An uncertainty ticket is recognised by its title, the wording CLAUDE.md prescribes for these.
function isUncertaintyTicket(issue) {
  return /^Onzeker:/.test(issue.title);
}

const listed = new Set(UNCERTAINTIES.map((uncertainty) => uncertainty.ticket));
const open = issues("open");
const openNumbers = new Set(open.map((issue) => issue.number));

const problems = [];

for (const ticket of [...listed].sort((a, b) => a - b)) {
  if (!openNumbers.has(ticket)) {
    problems.push(`ticket #${ticket} staat in uncertainties.js maar is niet meer open. Haal de waarschuwing weg, samen met de tests erbij.`);
  }
}

for (const issue of open.filter(isUncertaintyTicket).sort((a, b) => a.number - b.number)) {
  if (!listed.has(issue.number)) {
    problems.push(`ticket #${issue.number} staat open maar heeft geen waarschuwing in uncertainties.js: ${issue.title}`);
  }
}

if (problems.length === 0) {
  console.log(`In orde: ${listed.size} waarschuwingen, allemaal met een openstaand ticket.`);
  process.exit(0);
}

console.error("De lijst in uncertainties.js loopt uit de pas met de tickets:");
for (const problem of problems) {
  console.error(`  - ${problem}`);
}
process.exit(1);
```

- [ ] **Step 2: Run the script to verify it passes**

Run: `node tools/check-uncertainties.mjs`
Expected: `In orde: 13 waarschuwingen, allemaal met een openstaand ticket.` en afsluitcode 0.

- [ ] **Step 3: Verify it catches a mismatch**

Run:
```bash
node -e "
import('./uncertainties.js').then(m => {
  const numbers = m.UNCERTAINTIES.map(u => u.ticket);
  console.log('tickets in de lijst:', numbers.join(', '));
});
"
```
Haal daarna tijdelijk het element met `ticket: 32` uit `uncertainties.js`, draai `node tools/check-uncertainties.mjs`.
Expected: afsluitcode 1 met de regel `ticket #32 staat open maar heeft geen waarschuwing in uncertainties.js`. Zet het element daarna terug en draai het script opnieuw.
Expected: weer `In orde: 13 waarschuwingen`.

- [ ] **Step 4: Commit**

```bash
git add tools/check-uncertainties.mjs
git commit -m "feat: controleer of de waarschuwingen gelijk lopen met de tickets"
```

---

## Task 7: de bewaking en de werkafspraak

**Files:**
- Create: `.github/workflows/test.yml`
- Create: `.github/workflows/onduidelijkheden.yml`
- Modify: `CLAUDE.md`
- Modify: `README.md`

**Interfaces:**
- Consumes: `npm test` en `tools/check-uncertainties.mjs`.
- Produces: niets voor latere taken.

- [ ] **Step 1: Write the workflows**

Maak `.github/workflows/test.yml`:

```yaml
name: tests

on:
  push:
  pull_request:

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: "22"
      - run: npm test
```

Maak `.github/workflows/onduidelijkheden.yml`:

```yaml
name: onduidelijkheden

on:
  push:
  schedule:
    # Elke maandagochtend, zodat een ticket dat in de week ervoor is gesloten meteen opvalt.
    - cron: "0 6 * * 1"
  workflow_dispatch:

jobs:
  check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: "22"
      - run: node tools/check-uncertainties.mjs
        env:
          GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

- [ ] **Step 2: Update CLAUDE.md**

Voeg onder de bestaande sectie `## Tickets`, na de laatste bullet, dit blok toe:

```markdown
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
```

Voeg aan de sectie `## Commando's` een regel toe:

```
node tools/check-uncertainties.mjs   # controleert of de waarschuwingen bij de open tickets passen
```

- [ ] **Step 3: Update README.md**

Voeg aan de beschrijving van wat de pagina toont een alinea toe, in de stijl van de rest van het bestand:

```markdown
Waar het Bondsreglement iets in het midden laat, zegt de pagina dat erbij. Onder het oordeel staat
dan een dichtgeklapte regel die vertelt op hoeveel punten het reglement hier onduidelijk is, met
per punt de uitleg en een link naar het ticket. In het raster dragen die vakjes een paars hoekje.
```

Werk in `README.md` het genoemde testaantal bij naar het aantal dat `npm test` nu meldt.

- [ ] **Step 4: Run everything one more time**

Run: `npm test`
Expected: PASS. Noteer het aantal tests en zet dat in `README.md` als het afwijkt.

Run: `node tools/check-uncertainties.mjs`
Expected: `In orde: 13 waarschuwingen, allemaal met een openstaand ticket.`

- [ ] **Step 5: Commit**

```bash
git add .github CLAUDE.md README.md
git commit -m "chore: laat de tests en de ticketcontrole als Action draaien"
```

---

## Task 8: het ticket en de review over de branch

**Files:** geen

- [ ] **Step 1: Open a ticket for the work itself**

`CLAUDE.md` wil een ticket per stuk werk. Maak het ticket dat deze branch afsluit:

```bash
gh issue create --title "De pagina zegt niet dat een oordeel op een openstaande onduidelijkheid rust" \
  --label enhancement \
  --body "Er staan dertien tickets open waarin het Bondsreglement iets in het midden laat. De tool kiest dan de behoudende kant, maar het scherm laat daar niets van zien: het oordeel ziet eruit als een vaststaand antwoord.

Deze branch voegt \`uncertainties.js\` toe, met per ticket een predicaat dat bepaalt welke combinaties het raakt. De uitleg krijgt een dichtgeklapte accordion onder het oordeel, het raster een paars hoekje. \`tools/check-uncertainties.mjs\` plus twee GitHub Actions bewaken dat de lijst gelijk blijft met de tickets.

Ontwerp: \`docs/superpowers/specs/2026-08-31-onduidelijkheden-in-beeld-design.md\`."
```

- [ ] **Step 2: Review over the whole branch**

**REQUIRED SUB-SKILL:** Use superpowers:requesting-code-review over de hele branch, tegen `main`.

- [ ] **Step 3: Close the ticket**

Sluit het ticket uit stap 1 met een toelichting: wat er is gewijzigd, in welke commits, en hoe is vastgesteld dat het werkt (`npm test`, `node tools/check-uncertainties.mjs`, en de controle in de browser).
