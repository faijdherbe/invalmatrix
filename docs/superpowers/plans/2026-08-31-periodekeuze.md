# Periodekeuze binnen het seizoen: implementatieplan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** De gebruiker kiest in welke periode van het seizoen de wedstrijd valt, zodat de tool ook
een oordeel geeft over de drie klassen die halverwege het seizoen van categorie I naar categorie II
gaan.

**Architecture:** De periode is puur een filter op de categorie-indeling. `data.js` krijgt de
periodes en per wisselende klasse de laatste periode waarin die nog categorie I is. `rules.js`
krijgt de periode als laatste parameter door tot in `categoryINotice`, dat de enige functie is die
er iets mee doet. Een nieuwe module `selection.js` bevat de tekst voor een onvolledige keuze.
`app.js` blijft weergave.

**Tech Stack:** ES-modules die de browser direct laadt, geen build-stap, geen framework. Tests met
`node --test`. Draaien met `npm test`.

## Global Constraints

- Code is Engels: variabelen, functies, constanten, bestandsnamen, DOM-id's, CSS-klassen,
  commentaar en testnamen. Alles wat een mens leest is Nederlands.
- Geen em-dash, geen emoji, in geen enkele taal.
- De toon van het Nederlands is casual en direct.
- Enige bron voor een regelbeslissing is `bronnen/bondsreglement-2026.pdf`.
- Alle regellogica in `rules.js`, alle seizoensgegevens in `data.js`. `app.js` rekent niets uit
  over invalregels.
- Noem in tekst die de gebruiker ziet het artikelnummer of hoofdstuk dat het oordeel draagt.
- Geen uitlijning van assignments over meerdere regels.
- `articles.js` wordt nooit met de hand bewerkt.
- Elke wijziging gaat vergezeld van tests. Sneuvelt een bestaande test, pas hem aan en leg in het
  commitbericht uit waarom de oude verwachting achterhaald was. Verwijder hem niet.
- Ontwerp: `docs/superpowers/specs/2026-08-31-periodekeuze-design.md`.

## Bestandsoverzicht

| bestand | wat het doet na dit plan |
|---|---|
| `data.js` | krijgt `PERIODS` en `CATEGORY_I_UNTIL`, verliest `CATEGORY_I_PERIOD` |
| `rules.js` | `categoryINotice`, `assess` en `overview` kennen de periode; nieuwe export `periodCategoryIClasses` |
| `selection.js` | nieuw, en klein: `listWithAnd` en `missingChoicesSentence` |
| `index.html` | derde keuze erbij, en een alinea voor de onvolledige keuze |
| `app.js` | vult en leest de derde keuze, geen standaardwaarden meer, voetnoot noemt de periode |
| `test/rules.test.js` | tests voor de periode |
| `test/selection.test.js` | nieuw, tests voor `selection.js` |
| `test/page-text.test.js` | tests dat de pagina de derde keuze bevat |
| `README.md` | periodekeuze, nieuwe bestanden, nieuwe namen in "Nieuw seizoen" |

---

### Task 1: de periode door `rules.js`

**Files:**
- Modify: `data.js:88-100`
- Modify: `rules.js:1-12`, `rules.js:262-272`, `rules.js:371`, `rules.js:483`
- Test: `test/rules.test.js`

**Interfaces:**
- Produces: `PERIODS` (array van `{ id, label }`, in seizoensvolgorde), `CATEGORY_I_UNTIL`
  (`{ [category]: { [classId]: { until, phrase, contested? } } }`),
  `categoryINotice(team, periodId = null)`, `assess(lender, borrower, dateOfBirth, periodId = null)`,
  `overview(borrower, periodId = null)`.
- `periodId` is `null` zolang er geen periode is gekozen, en anders een `id` uit `PERIODS`.

- [ ] **Step 1: Schrijf de falende tests**

Voeg toe aan `test/rules.test.js`, direct onder de bestaande blok tests over `categoryINotice`
(na de test op regel 335, `"the category I notices name both chapter 2 and chapter 4"`):

```js
test("O18 Subtopklasse is category I up to and including the herfstvakantie and category II after", () => {
  const team = { category: "O18", classId: "subtop" };
  assert.ok(categoryINotice(team, "early"));
  assert.equal(categoryINotice(team, "mid"), null);
  assert.equal(categoryINotice(team, "late"), null);
});

test("O16 Subtopklasse is category I up to and including the winterstop and category II after", () => {
  const team = { category: "O16", classId: "subtop" };
  assert.ok(categoryINotice(team, "early"));
  assert.ok(categoryINotice(team, "mid"));
  assert.equal(categoryINotice(team, "late"), null);
});

test("IDC-O14 gets a verdict from the lentecompetitie on and none before that", () => {
  const team = { category: "O14", classId: "idc" };
  assert.ok(categoryINotice(team, "early"));
  assert.ok(categoryINotice(team, "mid"));
  assert.equal(categoryINotice(team, "late"), null);
});

test("the notice of a switching class names the chosen period", () => {
  const notice = categoryINotice({ category: "O16", classId: "subtop" }, "mid");
  assert.match(notice, /voorcompetitie na de herfstvakantie/);
});

test("the notice of IDC-O14 claims no category, because the reglement does not settle that", () => {
  for (const periodId of [null, "early", "mid"]) {
    const notice = categoryINotice({ category: "O14", classId: "idc" }, periodId);
    assert.match(notice, /vanaf de winterstop/);
    assert.match(notice, /geen uitspraak/);
    assert.doesNotMatch(notice, /onder categorie I/);
  }
});

test("Super O14 stays category I in every period, chapter 2 names no period there", () => {
  for (const periodId of [null, "early", "mid", "late"]) {
    assert.ok(categoryINotice({ category: "O14", classId: "super" }, periodId));
  }
});

test("without a chosen period a switching class keeps giving no verdict", () => {
  assert.ok(categoryINotice({ category: "O18", classId: "subtop" }));
  assert.ok(categoryINotice({ category: "O16", classId: "subtop" }));
  assert.ok(categoryINotice({ category: "O14", classId: "idc" }));
});

test("assess passes the period on: O18 Subtopklasse gets a verdict from the mid period on", () => {
  const lender = { category: "O18", classId: "subtop" };
  const borrower = { category: "O18", classId: "1e" };
  assert.equal(assess(lender, borrower, null, "early").verdict, "out-of-scope");
  assert.notEqual(assess(lender, borrower, null, "mid").verdict, "out-of-scope");
});

test("assess passes the period on with the switching class as the borrower too", () => {
  const lender = { category: "O16", classId: "1e" };
  const borrower = { category: "O16", classId: "subtop" };
  assert.equal(assess(lender, borrower, null, "mid").verdict, "out-of-scope");
  assert.notEqual(assess(lender, borrower, null, "late").verdict, "out-of-scope");
});

test("overview passes the period on: the Subtopklasse column of O16 fills up in the lentecompetitie", () => {
  const borrower = { category: "O16", classId: "1e" };
  const early = overview(borrower, "early").find((r) => r.category === "O16");
  assert.equal(early.cells.find((c) => c.classId === "subtop").status, "out-of-scope");
  const late = overview(borrower, "late").find((r) => r.category === "O16");
  assert.notEqual(late.cells.find((c) => c.classId === "subtop").status, "out-of-scope");
});

test("article 5.3.5.4 gives the same conditions in every period, the period does not filter it", () => {
  const lender = { category: "O14", classId: "top" };
  const borrower = { category: "O14", classId: "subtop" };
  const conditions = ["early", "mid", "late"].map((p) => assess(lender, borrower, null, p).conditions);
  assert.deepEqual(conditions[1], conditions[0]);
  assert.deepEqual(conditions[2], conditions[0]);
  assert.ok(conditions[0].some((c) => /eerste team/.test(c)));
});
```

Pas daarnaast de bestaande test op regel 314 aan. De oude verwachting beweert dat IDC-O14 tot de
winterstop categorie I is, en die bewering laat het reglement juist in het midden. Vervang:

```js
test("IDC-O14 falls under category I until the winter break and after that the tool makes no statement", () => {
  const notice = categoryINotice({ category: "O14", classId: "idc" });
  assert.match(notice, /tot de winterstop/);
  assert.match(notice, /geen uitspraak/);
});
```

door:

```js
// The old expectation here was that IDC-O14 is category I until the winter break. That is a
// statement chapter 2 does not make: it names IDC-O14 nowhere in the category I list and only says
// that it falls under category II from the winter break on. The notice therefore no longer claims
// a category, see the design of 31 August 2026.
test("IDC-O14 gets no verdict without a chosen period, and the notice claims no category", () => {
  const notice = categoryINotice({ category: "O14", classId: "idc" });
  assert.match(notice, /vanaf de winterstop/);
  assert.match(notice, /geen uitspraak/);
  assert.doesNotMatch(notice, /onder categorie I/);
});
```

- [ ] **Step 2: Draai de tests en stel vast dat ze falen om de goede reden**

Run: `npm test 2>&1 | grep -E "^# (pass|fail)"`
Expected: FAIL. In de uitvoer staan fouten als `ReferenceError` op onbekende periodes of
`assert.ok(...)` op `null`, omdat `categoryINotice` de tweede parameter nog negeert.

- [ ] **Step 3: Zet de periodes in `data.js`**

Vervang in `data.js` het blok `CATEGORY_I_PERIOD` (regel 96-100) door:

```js
// Periods within the season. The two boundaries are the ones chapter 2 of the Bondsreglement
// names: the herfstvakantie and the winterstop. The labels voorcompetitie and lentecompetitie come
// from articles 4.3.8, 4.3.9 and 5.3.5.4. The reglement does not say where the boundary between
// voorcompetitie and lentecompetitie lies; this tool puts it at the winterstop.
// The order of this array is the order of the season, and it is the only place where that order is
// recorded.
export const PERIODS = [
  { id: "early", label: "voorcompetitie tot de herfstvakantie" },
  { id: "mid", label: "voorcompetitie na de herfstvakantie" },
  { id: "late", label: "lentecompetitie" },
];

// Classes that are category I during only part of the season. until is the last period in which
// the class is still category I; from the period after that it is category II. phrase is the
// wording chapter 2 itself uses, so the rule stands next to its source.
// contested marks a class about which the reglement does not settle the category before the
// boundary. The notice for such a class claims no category at all, see the design document of
// 31 August 2026.
export const CATEGORY_I_UNTIL = {
  // Chapter 2: "de Landelijke Subtopklasse O18 vanaf de herfstvakantie".
  O18: { subtop: { until: "early", phrase: "tot en met de herfstvakantie" } },
  // Chapter 2: "de Landelijke Subtopklasse O16 vanaf de winterstop".
  O16: { subtop: { until: "mid", phrase: "tot en met de winterstop" } },
  // Chapter 2 names IDC-O14 nowhere under category I and only says that it falls under category II
  // from the winter break. What holds before that, and whether it is played at all then, articles
  // 4.3.9 and 5.3.5.4 leave open.
  O14: { idc: { until: "mid", phrase: "voor de winterstop", contested: true } },
};
```

- [ ] **Step 4: Laat `rules.js` de periode gebruiken**

Wijzig de import bovenaan `rules.js`: vervang `CATEGORY_I_PERIOD` door `CATEGORY_I_UNTIL` en voeg
`PERIODS` toe.

Vervang `categoryINotice` (regel 261-272) door:

```js
// The place of a period in the season. PERIODS holds that order, so this is the only comparison
// that knows which period comes first.
function periodIndex(periodId) {
  return PERIODS.findIndex((p) => p.id === periodId);
}

function periodLabel(periodId) {
  const found = PERIODS.find((p) => p.id === periodId);
  return found ? found.label : periodId;
}

// Returns an explanation when the team falls outside category II, otherwise null. periodId is null
// as long as the user has chosen no period. The page never draws the grid in that state, but
// rules.js is a module of its own and must never silently assume a period.
export function categoryINotice(team, periodId = null) {
  const fixed = CATEGORY_I[team.category];
  if (fixed && fixed.includes(team.classId)) {
    return `${describe(team)} valt volgens hoofdstuk 2 van het Bondsreglement onder categorie I. Daarvoor gelden de speelgerechtigdheidsregels van hoofdstuk 4, die deze tool niet dekt.`;
  }

  const switching = (CATEGORY_I_UNTIL[team.category] || {})[team.classId];
  if (!switching) return null;

  // From the period after the boundary the class is category II and an ordinary verdict follows.
  // Without a chosen period every period is still possible, and then the conservative side is the
  // one that gives no verdict.
  if (periodId !== null && periodIndex(periodId) > periodIndex(switching.until)) return null;

  const scope = periodId === null
    ? "Zonder gekozen periode doet deze pagina hier geen uitspraak over."
    : `In de ${periodLabel(periodId)} doet deze pagina hier geen uitspraak over.`;

  if (switching.contested) {
    return `Het reglement zet ${describe(team)} vanaf de winterstop onder categorie II, maar laat in het midden wat er ${switching.phrase} geldt en of er dan wordt gespeeld (hoofdstuk 2 van het Bondsreglement, en de artikelen 4.3.9 en 5.3.5.4). ${scope}`;
  }
  return `${describe(team)} valt ${switching.phrase} volgens hoofdstuk 2 van het Bondsreglement onder categorie I, met de speelgerechtigdheidsregels van hoofdstuk 4, en daarna onder categorie II. ${scope}`;
}
```

Wijzig de signatuur van `assess` (regel 371) en de eerste regel eronder:

```js
export function assess(lender, borrower, dateOfBirth, periodId = null) {
  const outOfScope = categoryINotice(lender, periodId) || categoryINotice(borrower, periodId);
```

Wijzig `overview` (regel 483) en de aanroep van `assess` erin:

```js
export function overview(borrower, periodId = null) {
```

```js
      const outcome = assess({ category, classId: column }, borrower, null, periodId);
```

De periode staat achteraan in beide signaturen en niet eerder. Zo blijft elke bestaande aanroep
zonder periode werken, en test de bestaande suite daarmee automatisch het pad zonder periodekeuze.

- [ ] **Step 5: Draai de tests en stel vast dat ze slagen**

Run: `npm test 2>&1 | grep -E "^# (pass|fail)"`
Expected: `# fail 0`, en het aantal geslaagde tests is gestegen met de tien nieuwe tests.

- [ ] **Step 6: Commit**

```bash
git add data.js rules.js test/rules.test.js
git commit -m "feat: laat de periode in het seizoen de indeling in categorie I en II bepalen

De Subtopklasse van O16 en O18 en de IDC-O14 wisselen halverwege het seizoen
van categorie. rules.js kende die periode niet en deed daarom bij die klassen
nooit een uitspraak. PERIODS en CATEGORY_I_UNTIL in data.js leggen de drie
periodes en de grens per klasse vast, en categoryINotice, assess en overview
krijgen de periode als laatste parameter.

De tekst voor IDC-O14 beweert niet langer dat die klasse tot de winterstop
categorie I is. Hoofdstuk 2 noemt IDC-O14 nergens in de opsomming van categorie
I en zegt alleen dat het vanaf de winterstop categorie II is. De bijbehorende
test is daarop aangepast."
```

---

### Task 2: de klassen die in een periode categorie I zijn

**Files:**
- Modify: `rules.js` (nieuwe export onder `categoryINotice`)
- Test: `test/rules.test.js`

**Interfaces:**
- Consumes: `categoryINotice(team, periodId)` uit Task 1.
- Produces: `periodCategoryIClasses(periodId)`, die een array van `{ category, classId }` teruggeeft
  van de wisselende klassen die in die periode categorie I zijn. Alleen de wisselende klassen; de
  vaste categorie I-klassen staan al in `CATEGORY_I` en heeft `app.js` al.

- [ ] **Step 1: Schrijf de falende test**

Voeg toe aan `test/rules.test.js`, direct onder de tests uit Task 1:

```js
test("periodCategoryIClasses names the switching classes that are category I in that period", () => {
  assert.deepEqual(periodCategoryIClasses("early"), [
    { category: "O14", classId: "idc" },
    { category: "O16", classId: "subtop" },
    { category: "O18", classId: "subtop" },
  ]);
  assert.deepEqual(periodCategoryIClasses("mid"), [
    { category: "O14", classId: "idc" },
    { category: "O16", classId: "subtop" },
  ]);
  assert.deepEqual(periodCategoryIClasses("late"), []);
});

test("periodCategoryIClasses names them all without a chosen period, because every period is still possible", () => {
  assert.equal(periodCategoryIClasses(null).length, 3);
});

test("periodCategoryIClasses does not name the fixed category I classes, those are not switching", () => {
  const all = ["early", "mid", "late", null].flatMap((p) => periodCategoryIClasses(p));
  assert.ok(!all.some((c) => c.classId === "super" || c.classId === "landelijk"));
});
```

Voeg `periodCategoryIClasses` toe aan de importlijst bovenaan `test/rules.test.js`.

De volgorde in de eerste test is de volgorde van `AGE_CATEGORIES` in `data.js`, dus O11, O12, O14,
O16, O18.

- [ ] **Step 2: Draai de test en stel vast dat hij faalt**

Run: `npm test 2>&1 | grep -E "periodCategoryIClasses|^# fail"`
Expected: FAIL met `SyntaxError` of `periodCategoryIClasses is not a function`, omdat de export nog
niet bestaat.

- [ ] **Step 3: Schrijf de implementatie**

Voeg toe aan `rules.js`, direct onder `categoryINotice`:

```js
// The switching classes that are category I in this period, for the footnote under the grid. Asks
// categoryINotice itself, so there is one place that decides when a class is category I.
export function periodCategoryIClasses(periodId) {
  const found = [];
  for (const category of AGE_CATEGORIES) {
    for (const classId of Object.keys(CATEGORY_I_UNTIL[category] || {})) {
      if (categoryINotice({ category, classId }, periodId)) found.push({ category, classId });
    }
  }
  return found;
}
```

- [ ] **Step 4: Draai de tests en stel vast dat ze slagen**

Run: `npm test 2>&1 | grep -E "^# (pass|fail)"`
Expected: `# fail 0`, drie tests meer dan na Task 1.

- [ ] **Step 5: Commit**

```bash
git add rules.js test/rules.test.js
git commit -m "feat: geef per periode terug welke wisselende klassen categorie I zijn

De voetnoot onder het raster moet naast de vaste categorie I-klassen ook de
klassen noemen die in de gekozen periode categorie I zijn. periodCategoryIClasses
vraagt dat aan categoryINotice zelf, zodat er een plek blijft die beslist wanneer
een klasse categorie I is."
```

---

### Task 3: de tekst voor een onvolledige keuze

**Files:**
- Create: `selection.js`
- Create: `test/selection.test.js`

**Interfaces:**
- Produces: `listWithAnd(items)` en `missingChoicesSentence(selection)`, waarbij `selection` een
  object is met de sleutels `period`, `category` en `classId`. Een lege of ontbrekende waarde geldt
  als niet gekozen. De functie geeft `""` terug als alles gekozen is.
- `app.js` gaat in Task 4 zijn eigen `listWithAnd` (`app.js:169-172`) hiervoor inruilen.

- [ ] **Step 1: Schrijf de falende tests**

Maak `test/selection.test.js`:

```js
import { test } from "node:test";
import assert from "node:assert/strict";
import { listWithAnd, missingChoicesSentence } from "../selection.js";

test("listWithAnd joins with commas and an en before the last item", () => {
  assert.equal(listWithAnd([]), "");
  assert.equal(listWithAnd(["een periode"]), "een periode");
  assert.equal(listWithAnd(["een periode", "een klasse"]), "een periode en een klasse");
  assert.equal(listWithAnd(["a", "b", "c"]), "a, b en c");
});

test("a complete selection yields no sentence", () => {
  assert.equal(missingChoicesSentence({ period: "late", category: "O14", classId: "1e" }), "");
});

test("the sentence names only what is missing, in the order of the page", () => {
  assert.equal(
    missingChoicesSentence({ period: "", category: "", classId: "" }),
    "Kies eerst een periode, een leeftijdscategorie en een klasse.",
  );
  assert.equal(
    missingChoicesSentence({ period: "late", category: "", classId: "" }),
    "Kies eerst een leeftijdscategorie en een klasse.",
  );
  assert.equal(
    missingChoicesSentence({ period: "", category: "O14", classId: "1e" }),
    "Kies eerst een periode.",
  );
  assert.equal(
    missingChoicesSentence({ period: "late", category: "O14", classId: "" }),
    "Kies eerst een klasse.",
  );
});

test("a missing key counts as not chosen", () => {
  assert.equal(missingChoicesSentence({}), "Kies eerst een periode, een leeftijdscategorie en een klasse.");
});
```

- [ ] **Step 2: Draai de test en stel vast dat hij faalt**

Run: `node --test test/selection.test.js 2>&1 | tail -5`
Expected: FAIL met `Cannot find module` op `../selection.js`.

- [ ] **Step 3: Schrijf de implementatie**

Maak `selection.js`:

```js
// The text the page shows while the choice is still incomplete. Kept apart from app.js because
// app.js reaches for the DOM at module level and can therefore not be imported in a test.

// Dutch enumeration: "a, b en c". With one item or none no commas or "en" are needed.
export function listWithAnd(items) {
  if (items.length <= 1) return items.join("");
  return `${items.slice(0, -1).join(", ")} en ${items[items.length - 1]}`;
}

// The choices in the order in which they appear on the page, so the sentence follows the eye.
const CHOICES = [
  { key: "period", name: "een periode" },
  { key: "category", name: "een leeftijdscategorie" },
  { key: "classId", name: "een klasse" },
];

// Names only the choices that are still missing. Returns an empty string once everything has been
// chosen, and the caller then draws the grid.
export function missingChoicesSentence(selection) {
  const missing = CHOICES.filter((choice) => !selection[choice.key]).map((choice) => choice.name);
  if (missing.length === 0) return "";
  return `Kies eerst ${listWithAnd(missing)}.`;
}
```

- [ ] **Step 4: Draai de tests en stel vast dat ze slagen**

Run: `npm test 2>&1 | grep -E "^# (pass|fail)"`
Expected: `# fail 0`, vijf tests meer dan na Task 2.

- [ ] **Step 5: Commit**

```bash
git add selection.js test/selection.test.js
git commit -m "feat: voeg de tekst toe voor een nog onvolledige keuze

De pagina krijgt drie keuzes die alle drie leeg beginnen, en toont zolang de
keuze onvolledig is een regel die alleen noemt wat er nog ontbreekt. Die tekst
staat in een eigen module, omdat app.js bij het laden al de DOM aanspreekt en
daardoor niet in een test te importeren is."
```

---

### Task 4: de pagina

**Files:**
- Modify: `index.html:16-32`
- Modify: `app.js:1-19`, `app.js:33-58`, `app.js:169-183`, `app.js:262-285`, `app.js:365-403`
- Test: `test/page-text.test.js`

**Interfaces:**
- Consumes: `PERIODS` en `SEASON` uit `data.js`, `periodCategoryIClasses` uit Task 2,
  `listWithAnd` en `missingChoicesSentence` uit Task 3, en de periodeparameter van `assess` en
  `overview` uit Task 1.

- [ ] **Step 1: Schrijf de falende tests**

Voeg toe aan `test/page-text.test.js`:

```js
test("the page asks in which period the match is played, before the team question", () => {
  const period = html.indexOf('id="period"');
  const category = html.indexOf('id="borrower-category"');
  assert.ok(period > -1, "no select with id period found");
  assert.ok(period < category, "the period choice must come before the team choice");
  assert.match(html, /Wanneer wordt de wedstrijd gespeeld\?/);
});

test("there is a place for the message about an incomplete choice", () => {
  assert.match(html, /id="missing-choices"/);
});

test("the page holds no hard preselected age category or class", () => {
  assert.ok(!/borrowerCategory\.value = "/.test(readFileSync(new URL("../app.js", import.meta.url), "utf8")));
});
```

- [ ] **Step 2: Draai de tests en stel vast dat ze falen**

Run: `node --test test/page-text.test.js 2>&1 | grep -E "^# (pass|fail)"`
Expected: FAIL, drie tests falen omdat `index.html` de derde keuze nog niet heeft en `app.js` nog
`borrowerCategory.value = "O14"` bevat.

- [ ] **Step 3: Zet de derde keuze in `index.html`**

Voeg in `index.html` een sectie toe direct boven de bestaande sectie "Bij welk team moet er worden
ingevallen?":

```html
  <section class="step">
    <h2>Wanneer wordt de wedstrijd gespeeld?</h2>
    <div class="choices">
      <label>Periode
        <select id="period"></select>
      </label>
    </div>
  </section>
```

En voeg in de sectie "Wie mag daar invallen?" een alinea toe, direct boven `<div id="grid" ...>`:

```html
    <p class="missing-choices" id="missing-choices" aria-live="polite"></p>
```

- [ ] **Step 4: Laat `app.js` de derde keuze vullen en lezen**

Wijzig de import bovenaan `app.js`:

```js
import { AGE_CATEGORIES, CLASSES, COLUMNS, CATEGORY_I, PERIODS, SEASON, DISCIPLINE } from "./data.js";
import { assess, overview, categoryINotice, periodCategoryIClasses } from "./rules.js";
import { listWithAnd, missingChoicesSentence } from "./selection.js";
```

Voeg twee elementen toe bij de andere `getElementById`-regels:

```js
const period = document.getElementById("period");
const missingChoices = document.getElementById("missing-choices");
```

Wijzig de contextregel (`app.js:19`), want het seizoen staat vanaf nu in de keuzelijst:

```js
document.getElementById("context").textContent = `${DISCIPLINE}, categorie II`;
```

Verwijder de eigen `listWithAnd` uit `app.js` (regel 168-172, inclusief het commentaar erboven);
die komt nu uit `selection.js`.

Voeg een helper toe voor de lege optie, boven `fillCategories`:

```js
// The empty option that every choice starts on. Its value is the empty string, so
// missingChoicesSentence sees it as not chosen.
function addPlaceholder(select, text) {
  const option = document.createElement("option");
  option.value = "";
  option.textContent = text;
  select.append(option);
}
```

Voeg een vulfunctie voor de periodes toe:

```js
function fillPeriods() {
  addPlaceholder(period, "Kies een periode");
  for (const item of PERIODS) {
    const option = document.createElement("option");
    option.value = item.id;
    option.textContent = `${SEASON}, ${item.label}`;
    period.append(option);
  }
}
```

Vervang `fillCategories` en `fillClasses` (regel 33-53):

```js
function fillCategories() {
  addPlaceholder(borrowerCategory, "Kies een leeftijdscategorie");
  for (const category of AGE_CATEGORIES) {
    const option = document.createElement("option");
    option.value = category;
    option.textContent = category;
    borrowerCategory.append(option);
  }
}

// The class choice depends on the age category, so it stays disabled until there is one.
function fillClasses() {
  const current = borrowerClass.value;
  borrowerClass.innerHTML = "";
  if (!borrowerCategory.value) {
    addPlaceholder(borrowerClass, "Kies eerst een leeftijdscategorie");
    borrowerClass.disabled = true;
    return;
  }
  borrowerClass.disabled = false;
  addPlaceholder(borrowerClass, "Kies een klasse");
  for (const classItem of CLASSES[borrowerCategory.value]) {
    const option = document.createElement("option");
    option.value = classItem.id;
    option.textContent = classItem.label;
    borrowerClass.append(option);
  }
  const exists = CLASSES[borrowerCategory.value].some((c) => c.id === current);
  borrowerClass.value = exists ? current : "";
}
```

Vervang `currentBorrower` (regel 55-57) door een functie die de hele keuze teruggeeft, en houd
`currentBorrower` als afgeleide:

```js
function currentSelection() {
  return { period: period.value, category: borrowerCategory.value, classId: borrowerClass.value };
}

// rules.js expects null for "no period chosen", while an unchosen select yields the empty string.
// Everything that goes into rules.js passes through here.
function currentPeriod() {
  return period.value || null;
}

function currentBorrower() {
  return { category: borrowerCategory.value, classId: borrowerClass.value };
}
```

Laat `categoryIList` ongewijzigd en voeg er direct onder de tweede zin van de voetnoot bij:

```js
// The switching classes that are category I in the chosen period. Those do have a column in the
// grid, unlike the fixed category I classes, so the footnote names them separately.
function periodCategoryIText(periodId) {
  const classes = periodCategoryIClasses(periodId);
  if (classes.length === 0) return "";
  const names = classes.map((item) => `${item.category} ${label(item.category, item.classId)}`);
  const periodName = PERIODS.find((p) => p.id === periodId).label;
  return ` In de ${periodName} valt ${listWithAnd(names)} daar ook onder.`;
}
```

Vervang het begin van `showGrid` (regel 262-285):

```js
function showGrid() {
  const selection = currentSelection();
  const missing = missingChoicesSentence(selection);
  missingChoices.textContent = missing;
  if (missing) {
    grid.innerHTML = "";
    mobileOverview.innerHTML = "";
    gridFootnote.textContent = "";
    hideDetail();
    return;
  }

  const borrower = currentBorrower();
  const notice = categoryINotice(borrower, currentPeriod());
  if (notice) {
    grid.innerHTML = `<p class="out-of-scope-notice">${escape(notice)}</p>`;
    mobileOverview.innerHTML = "";
    gridFootnote.textContent = "";
    hideDetail();
    return;
  }

  const rows = overview(borrower, currentPeriod());
  grid.innerHTML = gridTableHtml(rows);
  mobileOverview.innerHTML =
    rows.map(mobileCategoryHtml).join("") + `<p class="mobile-explanation">${mobileExplanationHtml()}</p>`;

  gridFootnote.textContent =
    `De klassen die onder categorie I vallen (${categoryIList()}) staan niet in dit raster.${periodCategoryIText(currentPeriod())} Daar doet deze pagina geen uitspraak over. Klik op een vakje voor de onderbouwing.`;
```

De rest van `showGrid` blijft ongewijzigd.

Geef in `showDetail` de periode door aan beide aanroepen van `assess` (regel 373 en 380):

```js
  const outcome = assess(selectedLender, borrower, date, currentPeriod());
```

```js
  const withoutDate = assess(selectedLender, borrower, null, currentPeriod());
```

Vervang tot slot de opstartregels onderaan `app.js`:

```js
fillPeriods();
fillCategories();
fillClasses();
showGrid();

period.addEventListener("change", showGrid);
borrowerCategory.addEventListener("change", () => {
  fillClasses();
  showGrid();
});
borrowerClass.addEventListener("change", showGrid);
birthDate.addEventListener("change", showDetail);
```

- [ ] **Step 5: Geef de melding een opmaak in `style.css`**

Voeg onderaan `style.css` toe, in de stijl van de bestaande regels:

```css
.missing-choices:empty {
  display: none;
}
```

- [ ] **Step 6: Draai de tests en stel vast dat ze slagen**

Run: `npm test 2>&1 | grep -E "^# (pass|fail)"`
Expected: `# fail 0`, drie tests meer dan na Task 3.

- [ ] **Step 7: Bekijk de pagina in de browser**

Run: `python3 -m http.server 8000`, open `http://localhost:8000` en controleer met de hand:

1. Bij het laden staan alle drie de keuzes leeg, de klasse-keuze is uitgeschakeld, en er staat
   "Kies eerst een periode, een leeftijdscategorie en een klasse."
2. Kies alleen een periode: de regel wordt "Kies eerst een leeftijdscategorie en een klasse."
3. Kies daarna een leeftijdscategorie: de klasse-keuze wordt bruikbaar en gevuld.
4. Kies `voorcompetitie tot de herfstvakantie`, O18, 1e klasse. De kolom Subtop van O18 geeft `?`,
   en de voetnoot noemt O18 Subtopklasse.
5. Zet de periode op `lentecompetitie`. Diezelfde cel geeft nu een oordeel, en de voetnoot noemt
   die klasse niet meer.
6. Kies O16 als inlener en `Subtopklasse` als klasse in de voorcompetitie: het raster maakt plaats
   voor de melding dat het team zelf categorie I is.

- [ ] **Step 8: Commit**

```bash
git add index.html app.js style.css test/page-text.test.js
git commit -m "feat: laat de gebruiker de periode kiezen en start met een lege keuze

De pagina vraagt nu eerst wanneer de wedstrijd gespeeld wordt, en geeft daarna
pas het raster. De leeftijdscategorie en de klasse hadden een harde
standaardwaarde (O14 en 4e klasse); die zijn eruit, zodat de pagina niet meer
een antwoord toont op een vraag die de gebruiker niet heeft gesteld. Zolang de
keuze onvolledig is staat er een regel die alleen noemt wat er nog ontbreekt.

Het seizoen verhuist van de contextregel naar de keuzelijst, want het twee keer
noemen wordt verwarrend zodra er een tweede seizoen bij komt."
```

---

### Task 5: documentatie en tickets

**Files:**
- Modify: `README.md`
- Geen testbestanden; deze taak verandert geen gedrag.

**Interfaces:**
- Consumes: alles uit Task 1 tot en met 4.

- [ ] **Step 1: Stel het werkelijke aantal tests vast**

Run: `npm test 2>&1 | grep -E "^# (tests|pass|fail)"`
Noteer het getal achter `# tests`. Dat getal gaat op beide plekken in de README.

De README noemt nu twee verschillende aantallen: "Er zijn 158 tests" onder "Tests" en "de 154
tests" onder "Bestanden". Dat is een bestaande fout die in stap 4 een ticket wordt.

- [ ] **Step 2: Werk de README bij**

Vier plekken:

1. Onder "Wat het wel en niet dekt": de IDC van O14 valt niet meer volledig buiten de tool. Vervang
   de zin over categorie I door:

```
Niet: zaalhockey, senioren, O25, 30+, 45+, reserveteams, combiteams en categorie I (de
Landelijke Competitie en de Super- en Topklasse van O16 en O18, en de Super Competitie van
O14). Voor die gevallen doet de pagina bewust geen uitspraak.

Drie klassen wisselen halverwege het seizoen van categorie: de Subtopklasse van O18 (vanaf de
herfstvakantie), de Subtopklasse van O16 en de IDC-O14 (beide vanaf de winterstop). Daarom
vraagt de pagina eerst in welke periode van het seizoen de wedstrijd valt.
```

2. Onder "Hoe de pagina werkt": laat de eerste alinea beginnen bij de periode.

```
Je kiest eerst wanneer de wedstrijd gespeeld wordt, en daarna bij welk team er ingevallen moet
worden (leeftijdscategorie en klasse). Alle drie de keuzes beginnen leeg. Zijn ze gevuld, dan
verschijnt een raster met per leeftijdscategorie en klasse wat daar mag invallen. Een klik op
een vakje toont het volledige oordeel, met een optioneel veld voor de geboortedatum van de
speler en de letterlijke artikelteksten waarop het oordeel is gebaseerd.
```

3. Onder "Nieuw seizoen": vervang `CATEGORY_I_PERIOD` door `PERIODS` en `CATEGORY_I_UNTIL`.

```
Alles wat per seizoen wijzigt staat in `data.js`: `SEASON`, `REFERENCE_DATE`, `PERIODS`,
`LEVELS`, `CLASSES`, `AGE_LIMITS`, `CATEGORY_I` en `CATEGORY_I_UNTIL`. Vervang daarnaast de
PDF's in `bronnen/` en draai de artikelextractie opnieuw (zie hierboven).
```

4. Onder "Bestanden": voeg `selection.js` toe, direct onder de regel over `data.js`.

```
- `selection.js`: de tekst die de pagina toont zolang de keuze onvolledig is.
```

5. Zet het aantal tests uit stap 1 op beide plekken waar het nu staat. Onder "Tests" luidt de zin
   nu "Er zijn 158 tests, voor de regellogica (`rules.js`), ..."; noem daar ook `selection.js` en
   het nieuwe aantal:

```
Er zijn <aantal uit stap 1> tests, voor de regellogica (`rules.js`), de artikeltekst-parser
(`article-text.js`), de artikeltekst-extractie (`articles.js`), de tekst voor een onvolledige
keuze (`selection.js`) en de tekst op de pagina zelf (`test/page-text.test.js`):
```

   En onder "Bestanden" staat nu "- `test/`: de 154 tests." Zet daar hetzelfde getal neer:

```
- `test/`: de <aantal uit stap 1> tests.
```

- [ ] **Step 3: Commit de README**

```bash
git add README.md
git commit -m "docs: beschrijf de periodekeuze in de README

De pagina vraagt nu eerst wanneer de wedstrijd gespeeld wordt, drie klassen
wisselen halverwege het seizoen van categorie, en data.js kent PERIODS en
CATEGORY_I_UNTIL in plaats van CATEGORY_I_PERIOD. De twee aantallen tests
stonden niet gelijk (158 en 154) en zijn allebei op de werkelijke telling gezet."
```

- [ ] **Step 4: Maak de tickets aan**

Zes stuks op https://github.com/faijdherbe/invalmatrix/issues. De eerste vier blijven open, want
`CLAUDE.md` schrijft voor dat een onzekerheid die een antwoord van de KNHB-competitieleiding nodig
heeft niet zelf beslist wordt.

Ticket A, label `question`. Titel: "Onzeker: hoofdstuk 2 en hoofdstuk 4 noemen de Super O14
verschillend". Inhoud: de opsomming van categorie I staat twee keer in het reglement, op PDF-pagina
16 (hoofdstuk 2, "Onder de categorie I vallen de volgende competities") en op PDF-pagina 27
(hoofdstuk 4, "Deze speelgerechtigdheidsregels zijn van toepassing op ..."). Beide lijsten zijn
woord voor woord gelijk, behalve dat pagina 27 bij O14 `(vanaf de winterstop)` toevoegt. Neem de
aangehouden lezing op uit het ontwerpdocument, met de vier onderbouwingen (consequente haakjes per
hoofdstuk, Super O14 ontbreekt in beide categorie II-opsommingen, artikel 4.3.9 heeft geen regel
voor de voorcompetitie terwijl 5.3.5.4 die wel heeft, artikel 4.9 kent voor O14 alleen Super) en de
drie tegenwerpingen. Sluit af met de vraag aan de competitieleiding of die lezing klopt. Vermeld dat
de tool niets verandert: `CATEGORY_I.O14` blijft `["super"]`.

Ticket B, label `question`. Titel: "Onzeker: 'vanaf de winterstop' tegenover 'vanaf na de
winterstop' bij de Subtopklasse O16". Inhoud: PDF-pagina 16 schrijft "de Landelijke Subtopklasse
O16 vanaf de winterstop", PDF-pagina 38 schrijft "de Landelijke Subtopklasse O16 vanaf na de
winterstop". Dezelfde zin, niet gelijk overgetypt. Redactioneel, maar het laat zien dat deze
opsomming met de hand is gekopieerd, wat meeweegt bij ticket A.

Ticket C, label `question`. Titel: "Onzeker: waar ligt de grens tussen voorcompetitie en
lentecompetitie?". Inhoud: de artikelen 4.3.8, 4.3.9 en 5.3.5.4 gebruiken beide termen, en het
reglement zegt nergens waar de grens ligt of welke weken erbij horen. De tool houdt de winterstop
aan, omdat hoofdstuk 2 IDC-O14 vanaf de winterstop onder categorie II zet en artikel 5.3.5.4
IDC-O14 in de lentecompetitie plaatst. Dat is een gevolgtrekking en geen citaat. Vermeld dat de
keuze in `data.js` staat, in het commentaar boven `PERIODS`, en vul in dat commentaar het nummer van
dit ticket in.

Ticket D, label `question`. Titel: "Onzeker: verschilt het klassenaanbod aan de top per periode?".
Inhoud: artikel 4.3.8 noemt voor de voorcompetitie de Landelijke Topklasse en Subtopklasse en voor
de lentecompetitie Landelijk en Super; artikel 4.3.9 en 5.3.5.4 noemen voor O14 de Topklasse en
Subtopklasse tegenover Super O14 en IDC-O14. Dat suggereert dat het klassenaanbod aan de top per
periode verschilt. De artikelen zeggen letterlijk alleen "de niveaus zijn als volgt", en dan voor de
eerste-team-regel. De tool doet er daarom niets mee: `CLASSES` in `data.js` blijft per
leeftijdscategorie een lijst die niet van de periode afhangt.

Ticket E, label `bug`, meteen sluiten. Titel: "README noemt twee verschillende aantallen tests (158
en 154)". Inhoud: onder "Tests" stond 158 en onder "Bestanden" 154. Vermeld in de sluittoelichting
in welke commit beide op de werkelijke telling zijn gezet en met welk commando dat aantal is
vastgesteld.

Werk daarna ticket #19 bij met een reactie: de aangehouden lezing uit ticket A maakt de vraag
mogelijk niet-bestaand, want als IDC-O14 voor de winterstop niet gespeeld wordt is er geen periode
waarin de vraag opkomt. Verwijs naar ticket A en ticket D. Het ticket blijft open, want dat is een
interpretatie en geen citaat. Vermeld dat de tool sinds deze branch voor IDC-O14 geen categorie meer
beweert en alleen zegt dat het reglement het in het midden laat.

- [ ] **Step 5: Draai de hele suite nog een keer**

Run: `npm test 2>&1 | grep -E "^# (tests|pass|fail)"`
Expected: `# fail 0`, en het aantal achter `# tests` is gelijk aan wat er in de README staat.
