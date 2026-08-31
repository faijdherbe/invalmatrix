# Een hoekje, een blok: implementatieplan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** De matrix draagt nog maar een gekleurd hoekje, en dat hoekje wijst een blok aan dat hetzelfde woord en dezelfde kleur draagt.

**Architecture:** Alleen weergave. `rules.js`, `data.js` en `uncertainties.js` blijven ongemoeid, dus geen enkel oordeel verandert. De weergavegegevens die nu boven in `app.js` staan verhuizen naar een nieuw `cell-text.js`, zodat ze getest kunnen worden: `app.js` raakt bij het importeren de DOM aan en is daarom niet in een test te laden. De markering voor artikel 5.3.5.3 wordt een gewoon voorwaardelabel, de markering voor een openstaande onduidelijkheid verhuist naar rechtsboven en blijft als enige over.

**Tech Stack:** ES-modules die de browser direct laadt, geen build-stap, geen dependencies. Tests met `node --test test/`.

Spec: `docs/superpowers/specs/2026-08-31-een-hoekje-een-blok-design.md`. Ticket: #36.

## Global Constraints

- De code is Engels: variabelen, functies, constanten, bestandsnamen, DOM-id's, CSS-klassen, commentaar in de code, en de namen van tests.
- Alles wat een mens leest is Nederlands: de tekst op de pagina, `README.md`, de tickets en de commitberichten.
- Geen em-dash, geen emoji. Enige uitzondering is het waarschuwingsteken in `style.css` dat er al staat.
- De toon van het Nederlands is casual en direct.
- Geen uitlijning van assignments over meerdere regels.
- Alle regellogica hoort in `rules.js`, alle seizoensgegevens in `data.js`. `app.js` rekent niets zelf uit over invalregels.
- Elke wijziging gaat vergezeld van tests. Sneuvelt een bestaande test, pas hem dan aan en leg in het commentaar uit waarom de oude verwachting achterhaald was. Verwijder hem niet zonder die uitleg.
- `articles.js` is gegenereerd en wordt nooit met de hand bewerkt.
- Werk op branch `hoekjes`.
- Commitberichten in het Nederlands, met deze twee trailers onderaan:
  ```
  Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_0165ybQcTQY6T4KPmmXMSovP
  ```

---

### Task 1: `cell-text.js`, met max twee als voorwaardelabel

De weergavegegevens verhuizen uit `app.js` naar een eigen module, en `max-two` krijgt daarin een
label zoals `mits`, `lft` en `team` er een hebben. Daarmee verdwijnt de enige informatie die
alleen in het gele hoekje zat.

**Files:**
- Create: `cell-text.js`
- Create: `test/cell-text.test.js`
- Modify: `app.js` (regel 1 tot 6 voor de import, regel 110 tot 158 waar de constanten en de drie
  functies nu staan)

**Interfaces:**
- Consumes: `overview()` uit `rules.js`, alleen in de test.
- Produces: `STATUS_ORDER: string[]`, `STATUSES: Record<string, {short, description, groupHeading}>`,
  `REQUIREMENT_ORDER: string[]`, `REQUIREMENTS: Record<string, {short, description}>`,
  `COMBINATION_EXPLANATION: string`, `visibleRequirements(requirements: string[]): string[]`,
  `requirementsLabel(requirements: string[]): string`,
  `cellColor(cell: {status: string, requirements: string[]}): string`.

- [ ] **Step 1: Write the failing test**

Maak `test/cell-text.test.js`:

```js
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  COMBINATION_EXPLANATION,
  REQUIREMENTS,
  REQUIREMENT_ORDER,
  STATUSES,
  STATUS_ORDER,
  cellColor,
  requirementsLabel,
  visibleRequirements,
} from "../cell-text.js";
import { overview } from "../rules.js";

// Article 5.3.5.3 used to get a yellow triangle in the corner instead of a label. That marker was
// the only carrier of the condition, and it sat in the same color as a block in the detail view
// that has nothing to do with it (ticket #36). It is a condition like any other, so it gets a
// label like any other.
test("max-two carries a label of its own and names its article", () => {
  assert.equal(REQUIREMENTS["max-two"].short, "max 2");
  assert.match(REQUIREMENTS["max-two"].description, /5\.3\.5\.3/);
});

test("max-two is part of the requirement order, last, as rules.js returns it", () => {
  assert.deepEqual(REQUIREMENT_ORDER, ["player-count", "age", "first-team", "max-two"]);
});

// A requirement without a label or without a description would show up in a cell without ever
// being explained in the legend.
test("every requirement in the order has a short label and a description", () => {
  for (const requirement of REQUIREMENT_ORDER) {
    assert.ok(REQUIREMENTS[requirement], `${requirement} is missing from REQUIREMENTS`);
    assert.ok(REQUIREMENTS[requirement].short, `${requirement} has no short label`);
    assert.ok(REQUIREMENTS[requirement].description, `${requirement} has no description`);
  }
});

test("every status has a short label, a description and a group heading", () => {
  for (const status of STATUS_ORDER) {
    assert.ok(STATUSES[status].short, `${status} has no short label`);
    assert.ok(STATUSES[status].description, `${status} has no description`);
    assert.ok(STATUSES[status].groupHeading, `${status} has no group heading`);
  }
});

test("the labels of a cell are strung together in the order rules.js hands them over", () => {
  assert.equal(requirementsLabel(["player-count", "max-two"]), "mits+max 2");
  assert.equal(requirementsLabel(["max-two"]), "max 2");
  assert.equal(requirementsLabel([]), "");
});

test("an unknown requirement yields no label", () => {
  assert.deepEqual(visibleRequirements(["player-count", "unknown"]), ["player-count"]);
});

// The color says whether there are conditions. max-two is a condition, so a cell whose only
// condition is max-two is yellow now, where it used to be green with a triangle.
test("a cell whose only requirement is max-two is conditional", () => {
  assert.equal(cellColor({ status: "free", requirements: ["max-two"] }), "conditional");
});

test("a cell without requirements stays free, and no and out-of-scope keep their own color", () => {
  assert.equal(cellColor({ status: "free", requirements: [] }), "free");
  assert.equal(cellColor({ status: "no", requirements: [] }), "no");
  assert.equal(cellColor({ status: "out-of-scope", requirements: [] }), "out-of-scope");
});

// The combination of a real overview: substituting into O14 8th class, a lender from O14 5th class
// plays in a higher low class within the same age category, so article 5.3.5.3 applies there. That
// cell has to read the label and be yellow, because that is the whole point of this change.
test("in a real overview the max-two cell reads its label and turns yellow", () => {
  const rows = overview({ category: "O14", classId: "8e" }, "mid");
  const cell = rows.find((row) => row.category === "O14").cells.find((v) => v.classId === "5e");
  assert.deepEqual(cell.requirements, ["max-two"]);
  assert.equal(requirementsLabel(cell.requirements), "max 2");
  assert.equal(cellColor(cell), "conditional");
});

test("the explanation of the combined labels is there for the legend", () => {
  assert.match(COMBINATION_EXPLANATION, /\+/);
});

// The whole point of this module: it may reach for no DOM, otherwise it cannot be tested. Same
// check as in uncertainty-text.test.js.
test("the module carries no reference to the document", () => {
  const source = readFileSync(new URL("../cell-text.js", import.meta.url), "utf8");
  assert.ok(!/\bdocument\b/.test(source), "cell-text.js must stay free of the DOM");
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test test/cell-text.test.js`

Expected: FAIL, `Cannot find module` voor `../cell-text.js`.

- [ ] **Step 3: Write the module**

Maak `cell-text.js`:

```js
// The display data both views draw from: the short text in a grid cell, the description that the
// legend under the grid and the group headings in the mobile view use, and the color that follows
// from the requirements. A cell consists of a status (allowed, not allowed, no verdict) and a list
// of requirements, see cellFromOutcome() in rules.js.
//
// This lives apart from app.js because app.js reaches for the DOM the moment it is imported and
// can therefore not be loaded in a test. Same reason as article-text.js, selection.js and
// uncertainty-text.js.

// Order of the statuses: first what is allowed, then what is not, then what there is no verdict
// about. That is also the order in which the groups appear in the mobile view, because the user
// is looking for who is allowed to fill in. The group "mag" also holds the conditional cases, so
// the heading is "mag" and not "mag altijd": which conditions apply is shown per class behind the
// label.
export const STATUS_ORDER = ["free", "no", "out-of-scope"];

export const STATUSES = {
  free: { short: "ja", description: "mag altijd", groupHeading: "mag" },
  no: { short: "nee", description: "mag niet", groupHeading: "mag niet" },
  "out-of-scope": { short: "?", description: "geen uitspraak", groupHeading: "geen uitspraak" },
};

// The requirements with a short label in the cell, in the order in which rules.js returns them.
// max-two used to be missing here, because it got a triangle in the corner instead of a label.
// That triangle was the only carrier of the condition and it shared its color with a block in the
// detail view that has nothing to do with it, see ticket #36. It is a condition like the others,
// so it is a label like the others.
export const REQUIREMENT_ORDER = ["player-count", "age", "first-team", "max-two"];

export const REQUIREMENTS = {
  "player-count": { short: "mits", description: "mag alleen bij aantoonbaar te weinig spelers (artikel 5.3.5.2)" },
  age: { short: "lft", description: "mag, mits de speler de juiste leeftijd heeft (artikel 5.3.5.1)" },
  "first-team": { short: "team", description: "mag niet voor spelers uit het eerste team, zonder toestemming van de competitieleiding (artikel 5.3.5.4)" },
  "max-two": { short: "max 2", description: "er mogen maximaal twee spelers invallen zonder toestemming van de competitieleiding (artikel 5.3.5.3)" },
};

// Explanation of the combined labels, to go under the legend.
export const COMBINATION_EXPLANATION = "Staan er twee labels met een + ertussen, dan gelden beide voorwaarden.";

// The requirements that get a visible label. Everything rules.js returns has one now, but the
// filter stays: it keeps an unknown requirement out of the cell instead of printing "undefined".
export function visibleRequirements(requirements) {
  return requirements.filter((requirement) => REQUIREMENTS[requirement]);
}

// The short labels of a cell strung together with a plus, for example "mits+lft". Empty when there
// is no visible requirement; the cell then shows the text of its status.
export function requirementsLabel(requirements) {
  return visibleRequirements(requirements).map((requirement) => REQUIREMENTS[requirement].short).join("+");
}

// The color of a cell or class button: green when there is nothing to arrange, yellow as soon as a
// condition applies. The color says whether there are conditions, the text says which. For status
// no and out-of-scope the status itself is the color.
export function cellColor(cell) {
  if (cell.status !== "free") return cell.status;
  return visibleRequirements(cell.requirements).length > 0 ? "conditional" : "free";
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test test/cell-text.test.js`

Expected: PASS, elf tests.

- [ ] **Step 5: Let `app.js` de module gebruiken**

Voeg in `app.js` onder de bestaande imports (na regel 6) toe:

```js
import {
  COMBINATION_EXPLANATION,
  REQUIREMENTS,
  REQUIREMENT_ORDER,
  STATUSES,
  STATUS_ORDER,
  cellColor,
  requirementsLabel,
  visibleRequirements,
} from "./cell-text.js";
```

Verwijder daarna uit `app.js` het hele blok dat nu bij `// One place for both views to draw from:`
begint en eindigt met de sluitende accolade van `cellColor()`: dat zijn `STATUS_ORDER`, `STATUSES`,
`REQUIREMENT_ORDER`, `REQUIREMENTS`, `COMBINATION_EXPLANATION`, `visibleRequirements()`,
`requirementsLabel()` en `cellColor()`, met hun commentaar. Het commentaar is meeverhuisd naar
`cell-text.js`, dus het blijft niet dubbel staan.

`SR_ONLY_CAVEAT` en alles wat daaronder komt blijft in deze taak staan zoals het is.

- [ ] **Step 6: Controleer dat er niets dubbel of vergeten is**

Run: `grep -n "const STATUSES\|const REQUIREMENTS\|function cellColor\|function requirementsLabel\|function visibleRequirements\|const STATUS_ORDER\|const REQUIREMENT_ORDER\|const COMBINATION_EXPLANATION" app.js`

Expected: geen enkele regel. Alles staat nu in `cell-text.js`.

Run: `node --test test/`

Expected: PASS, alle bestaande tests plus de nieuwe.

- [ ] **Step 7: Commit**

```bash
git add cell-text.js test/cell-text.test.js app.js
git commit -F - <<'EOF'
refactor: weergavegegevens naar cell-text.js, met max 2 als label

De labels, de statussen en de kleurregel stonden in app.js, en dat bestand raakt bij het laden de
DOM aan, dus er kon geen test op. Ze staan nu in cell-text.js, net als article-text.js,
selection.js en uncertainty-text.js dat al deden.

Meteen krijgt max-two daar een label, zoals mits, lft en team er een hebben. Het was de enige
voorwaarde zonder label, en de kleur van het vakje verzweeg hem daardoor. Vakjes waar dat de enige
voorwaarde is, worden nu geel in plaats van groen.

Ticket #36.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_0165ybQcTQY6T4KPmmXMSovP
EOF
```

---

### Task 2: nog een markering, rechtsboven

Het gele hoekje verdwijnt uit de matrix, het paarse verhuist naar de vrijgekomen hoek, en de
tekst van het hoekje en de kop van het blok in de detailweergave beginnen allebei met hetzelfde
woord.

**Files:**
- Modify: `uncertainty-text.js` (de functie `uncertaintyHeading` en de functie `cellMarkers`
  helemaal onderaan)
- Modify: `test/uncertainty-text.test.js` (de twee tests op de kop, en de vijf tests op
  `cellMarkers` onderaan)
- Modify: `app.js` (de import op regel 6, `SR_ONLY_CAVEAT` tot en met `uncertaintyExplanationHtml`,
  `cellHtml`, `gridTableHtml`, `mobileExplanationHtml`, `mobileCategoryHtml`)
- Modify: `style.css` (`.corner-triangle`, `.uncertain-corner`, `.caveat-example`,
  `.mobile-class.caveat`)
- Create: `test/style.test.js`

**Interfaces:**
- Consumes: `cellColor()` en `requirementsLabel()` uit `cell-text.js` (taak 1).
- Produces: `uncertaintyHeading(count: number): string` met de nieuwe tekst. `cellMarkers()`
  bestaat niet meer.

- [ ] **Step 1: Write the failing tests**

Pas in `test/uncertainty-text.test.js` de import aan:

```js
import { ISSUE_URL, uncertaintyHeading, uncertaintyLines } from "../uncertainty-text.js";
```

Vervang de twee tests op de kop door deze, met de reden erbij:

```js
// The heading and the legend line of the corner marker have to open with the same word, otherwise
// a reader cannot tell which marker points at which note (ticket #36). Was: "Het reglement is hier
// op 1 punt onduidelijk", which shared no word with the legend line at all.
test("the heading opens with the word of the marker and uses the singular for one", () => {
  assert.equal(uncertaintyHeading(1), "Onduidelijk: het reglement laat hier 1 punt open");
});

test("the heading uses the plural from two upwards", () => {
  assert.equal(uncertaintyHeading(2), "Onduidelijk: het reglement laat hier 2 punten open");
  assert.equal(uncertaintyHeading(4), "Onduidelijk: het reglement laat hier 4 punten open");
});
```

Verwijder de vijf tests op `cellMarkers` onderaan het bestand, met hun commentaarblok, en zet er
deze test voor in de plaats:

```js
// Was: five tests on cellMarkers(), which put the yellow max-two marker and the purple uncertainty
// marker in a fixed order. That expectation is stale: max-two is a condition with a label of its
// own now (see cell-text.js) and there is only one marker left, so a list of markers has nothing
// left to order. app.js reads cell.uncertain directly.
test("the module no longer hands out markers", async () => {
  const module = await import("../uncertainty-text.js");
  assert.equal(module.cellMarkers, undefined);
});
```

Maak `test/style.test.js`:

```js
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

// The stylesheet carries decisions that no other test can see: which corner a marker sits in, and
// which color a block gets. Ticket #36 was about exactly that, so it is checked here. Reading the
// file as text is the same approach page-text.test.js takes for index.html and the README.
const css = readFileSync(new URL("../style.css", import.meta.url), "utf8");

function rule(selector) {
  const match = css.match(new RegExp(`${selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*\\{[^}]*\\}`));
  return match ? match[0] : null;
}

test("the grid carries only one corner marker", () => {
  assert.ok(!/\.corner-triangle/.test(css), "the yellow max-two triangle has to be gone");
});

test("the uncertainty corner sits in the top right", () => {
  const marker = rule(".uncertain-corner::after");
  assert.ok(marker, "no .uncertain-corner::after rule found");
  assert.match(marker, /top:\s*0/);
  assert.match(marker, /right:\s*0/);
});

test("the mobile list carries no yellow ring", () => {
  assert.ok(!/\.mobile-class\.caveat/.test(css), "the yellow ring around the pill has to be gone");
});

test("the small example in the legend has a name that does not name the old marker", () => {
  assert.ok(!/\.caveat-example/.test(css));
  assert.ok(rule(".marker-example"), "no .marker-example rule found");
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `node --test test/uncertainty-text.test.js test/style.test.js`

Expected: FAIL. De kop geeft nog de oude tekst, `cellMarkers` bestaat nog, `.corner-triangle` staat
nog in de CSS, en `.uncertain-corner::after` bestaat nog niet.

- [ ] **Step 3: Pas `uncertainty-text.js` aan**

Vervang de functie `uncertaintyHeading` door:

```js
// The heading above the collapsed block. It opens with the same word as the legend line of the
// corner marker in the grid, so that a reader sees which marker points here (ticket #36). An empty
// string when there is nothing to warn about; the caller then draws no block at all and the screen
// stays as it was.
export function uncertaintyHeading(count) {
  if (count === 0) return "";
  return `Onduidelijk: het reglement laat hier ${count} punt${count === 1 ? "" : "en"} open`;
}
```

Verwijder de functie `cellMarkers` helemaal, met haar commentaarblok. Zij bestond om twee
markeringen in een vaste volgorde te zetten en er is er nog maar een.

- [ ] **Step 4: Pas `app.js` aan**

Wijzig de import op regel 6:

```js
import { uncertaintyHeading, uncertaintyLines } from "./uncertainty-text.js";
```

Verwijder `SR_ONLY_CAVEAT`, de tabel `MARKERS`, `caveatExampleHtml()` en `caveatExplanationHtml()`,
met hun commentaar.

Vervang `SR_ONLY_UNCERTAIN` en het voorbeeldje eronder door:

```js
// Text that is not on screen but is read aloud: the corner marker is purely visual (color), so
// this is how someone who does not see it still learns that this cell rests on an open point of
// the reglement. Same word as the legend line and as the heading of the block in the detail view.
const SR_ONLY_UNCERTAIN = '<span class="sr-only"> (onduidelijk: het reglement laat hier iets open)</span>';

// A small example of the corner marker itself, for the explanation line. aria-hidden because the
// text next to it already says what it means.
function markerExampleHtml() {
  return `<span class="marker-example uncertain-corner" aria-hidden="true">${escape(STATUSES.free.short)}</span>`;
}

// Refers to the corner marker: the verdict in this cell rests on a point the Bondsreglement leaves
// open, and the detail view says which one. Opens with the same word as that block.
function uncertaintyExplanationHtml() {
  return `${markerExampleHtml()} Onduidelijk: het reglement laat hier iets open. Klik op het vakje om te zien wat.`;
}
```

Vervang in `cellHtml()` de regel met `cellMarkers`:

```js
  const srOnly = cell.uncertain ? SR_ONLY_UNCERTAIN : "";
```

Vervang in `gridTableHtml()` de twee regels met `markers`:

```js
          const buttonClass = cell.uncertain ? ` class="uncertain-corner"` : "";
```

Haal in `gridTableHtml()` de regel `caveatExplanationHtml(),` uit de array `legend`, en in
`mobileExplanationHtml()` dezelfde regel uit de array daar.

Vervang in `mobileCategoryHtml()` het blok dat de knop opbouwt door:

```js
          const title = `${row.category} ${cell.label}`;
          const requirements = requirementsLabel(cell.requirements);
          const labelHtml = [
            escape(cell.label),
            requirements ? ` <span class="mobile-requirements">${escape(requirements)}</span>` : "",
            srOnlyRequirementsHtml(cell.requirements),
            cell.uncertain ? SR_ONLY_UNCERTAIN : "",
          ].join("");
          const className = [
            "mobile-class",
            escape(cellColor(cell)),
            cell.uncertain ? "uncertain" : "",
          ].filter(Boolean).join(" ");
```

- [ ] **Step 5: Pas `style.css` aan**

Verwijder de regels `.corner-triangle` en `.corner-triangle::after`, met hun commentaarblok.

Vervang het commentaarblok en de twee regels van `.uncertain-corner` door:

```css
/* Small triangle in the top right of the cell: the verdict here rests on a point the
   Bondsreglement leaves open (see uncertainties.js). It is the only marker in the grid, so it sits
   in the corner where the eye lands. Purple, so it stands out against the green, yellow, red and
   grey cell backgrounds alike, and the same purple as the block it points at in the detail view.
   The marker is purely visual; see SR_ONLY_UNCERTAIN in app.js for the textual counterpart. */
.uncertain-corner {
  position: relative;
}

.uncertain-corner::after {
  content: "";
  position: absolute;
  top: 0;
  right: 0;
  width: 0;
  height: 0;
  border-top: 0.6rem solid var(--purple);
  border-left: 0.6rem solid transparent;
}
```

Hernoem `.caveat-example` naar `.marker-example` en pas het commentaar erboven aan:

```css
/* Small example of the marker itself, used in the explanation line of the legend and under the
   mobile view. */
.marker-example {
```

Verwijder de regels `.mobile-class.caveat` en `.mobile-class.caveat.uncertain`, met hun
commentaar. Laat `.mobile-class.uncertain` staan en pas het commentaar erboven aan:

```css
/* In the mobile list a corner on a fully round pill would float loose from the shape, so there the
   same marker is a ring around the pill. */
.mobile-class.uncertain {
  box-shadow: inset 0 0 0 2px var(--purple);
}
```

- [ ] **Step 6: Run the tests to verify they pass**

Run: `node --test test/`

Expected: PASS, alles groen.

Run: `grep -n "cellMarkers\|MARKERS\|corner-triangle\|caveat" app.js style.css uncertainty-text.js`

Expected: geen enkele regel meer.

- [ ] **Step 7: Commit**

```bash
git add uncertainty-text.js test/uncertainty-text.test.js test/style.test.js app.js style.css
git commit -F - <<'EOF'
fix: nog een hoekje in de matrix, rechtsboven

Het gele hoekje voor artikel 5.3.5.3 is weg, dat is nu een label. Het paarse hoekje voor een
openstaande onduidelijkheid verhuist naar de hoek die daardoor vrijkomt, en is als enige over.

Het hoekje en het blok waar het naar wijst beginnen nu allebei met het woord Onduidelijk, zodat de
koppeling geen uitleg nodig heeft.

Ticket #36.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_0165ybQcTQY6T4KPmmXMSovP
EOF
```

---

### Task 3: het blok "Let op" wordt grijs

Dat blok hoort bij geen enkele markering en verschijnt bij elke toegestane uitkomst. Zolang het
geel is, leest het als de tegenhanger van een gele markering. Grijs zegt wat het is, en daarna
betekent geel op de hele pagina nog maar een ding: er geldt een voorwaarde.

**Files:**
- Modify: `style.css` (`.caution` en `#result .caution h3`)
- Modify: `test/style.test.js` (een test erbij)

**Interfaces:**
- Consumes: niets uit eerdere taken.
- Produces: niets voor latere taken.

- [ ] **Step 1: Write the failing test**

Voeg onderaan `test/style.test.js` toe:

```js
// The caution block belongs to no marker and shows up at every allowed verdict. In yellow it read
// as the counterpart of the yellow corner marker, which is exactly the confusion of ticket #36.
// Grey, so yellow means one thing on this page: a condition applies.
test("the caution block is grey, not yellow", () => {
  const block = rule(".caution");
  assert.ok(block, "no .caution rule found");
  assert.ok(!/--yellow/.test(block), ".caution may not use the yellow of a condition");
  assert.match(block, /--grey/);
});

test("the heading inside the caution block is grey too", () => {
  const heading = rule("#result .caution h3");
  assert.ok(heading, "no #result .caution h3 rule found");
  assert.ok(!/--yellow/.test(heading), "the heading may not use the yellow of a condition");
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `node --test test/style.test.js`

Expected: FAIL, `.caution may not use the yellow of a condition`.

- [ ] **Step 3: Pas `style.css` aan**

Vervang het commentaar en de regel `.caution` door:

```css
/* Block for outcome.caveats: not a condition to meet, but a warning that this tool cannot judge
   the match day, the round, the club or the matches played. It sits directly under the summary,
   above the conditions (see cautionBlockHtml in app.js). Grey, because it belongs to no marker in
   the grid and shows up at every allowed verdict: in yellow it read as the counterpart of a yellow
   marker, and that was ticket #36. Yellow now means one thing on this page: a condition applies. */
.caution {
  margin: 1rem 0 0;
  padding: 0.75rem 1rem;
  border-left: 5px solid var(--grey);
  border-radius: 4px;
  background: var(--grey-surface);
}
```

En de kop erin:

```css
#result .caution h3 {
  margin: 0 0 0.4rem;
  color: var(--grey);
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `node --test test/`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add style.css test/style.test.js
git commit -F - <<'EOF'
fix: het blok Let op wordt grijs

Dat blok hoort bij geen markering in het raster en staat er bij elke toegestane uitkomst. In het
geel las het als de tegenhanger van het gele hoekje, en dat was precies de verwarring. Geel
betekent op deze pagina nu nog maar een ding: er geldt een voorwaarde.

Ticket #36.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_0165ybQcTQY6T4KPmmXMSovP
EOF
```

---

### Task 4: de README beschrijft wat er nu staat

**Files:**
- Modify: `README.md` (de alinea over de labels, de alinea over het driehoekje, en de alinea over
  het paarse hoekje, samen regel 37 tot 50)
- Modify: `test/page-text.test.js` (twee tests erbij)

**Interfaces:**
- Consumes: niets uit eerdere taken.
- Produces: niets voor latere taken.

- [ ] **Step 1: Write the failing test**

Voeg onderaan `test/page-text.test.js` toe:

```js
// Ticket #36: the page carries one corner marker now, and max-two is a label like the others. The
// README described two corners, so it would send a reader looking for something that is not there.
test("the README describes max-two as a label, not as a corner", () => {
  assert.match(readme, /\*\*max 2\*\*/);
  assert.ok(!/driehoekje/.test(readme), "the README may not describe a triangle any more");
});

test("the README puts the one remaining corner in the top right", () => {
  assert.match(readme, /paars hoekje rechtsboven/);
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `node --test test/page-text.test.js`

Expected: FAIL, de README noemt `max 2` nog niet en bevat nog het woord `driehoekje`.

- [ ] **Step 3: Pas `README.md` aan**

Voeg onder de drie bestaande labels de vierde toe:

```markdown
- **max 2**: er mogen maximaal twee spelers invallen zonder toestemming van de competitieleiding
  (artikel 5.3.5.3)
```

Verwijder daarna de alinea die begint met "De uitzondering van artikel 5.3.5.3", en vervang de
alinea over de onduidelijkheden door:

```markdown
Waar het Bondsreglement iets in het midden laat, zegt de pagina dat erbij. Onder het oordeel staat
dan een dichtgeklapte regel die vertelt hoeveel punten het reglement hier openlaat, met per punt de
uitleg en een link naar het ticket. In het raster dragen die vakjes een paars hoekje rechtsboven,
en dat hoekje en die regel beginnen allebei met het woord "Onduidelijk".
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `node --test test/`

Expected: PASS, alles groen.

- [ ] **Step 5: Commit**

```bash
git add README.md test/page-text.test.js
git commit -F - <<'EOF'
docs: de README beschrijft nog een hoekje

Max 2 staat nu bij de labels waar het thuishoort, en het hoekje dat overblijft zit rechtsboven.

Ticket #36.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_0165ybQcTQY6T4KPmmXMSovP
EOF
```

---

### Task 5: de pagina zelf nagelopen

Er is geen DOM-testharnas (ticket #33), dus de opbouw van `app.js` is alleen in een browser te
zien. Deze taak levert geen code op, maar wel de vaststelling dat het echt werkt.

**Files:**
- Geen.

**Interfaces:**
- Consumes: het resultaat van taak 1 tot en met 4.
- Produces: de tekst waarmee ticket #36 dicht kan.

- [ ] **Step 1: Draai de hele testsuite**

Run: `node --test test/`

Expected: PASS, geen enkele test rood.

- [ ] **Step 2: Start de pagina lokaal**

Run: `python3 -m http.server 8000`

Open `http://localhost:8000/`.

- [ ] **Step 3: Loop deze vier dingen na**

1. Kies periode "tussen de herfstvakantie en de winterstop", leeftijdscategorie O14, klasse 8e.
   Het vakje op rij O14 in kolom 5e leest `max 2` en is geel, niet groen met een hoekje.
2. Datzelfde vakje draagt rechtsboven een paars hoekje, en nergens in het raster staat nog een geel
   hoekje.
3. Klik op dat vakje. De dichtgeklapte regel onder het oordeel begint met "Onduidelijk", in
   dezelfde paarse kleur als het hoekje. Het blok "Let op" eronder is grijs.
4. Maak het venster smaller dan 640 pixels. De pillen in de lijst dragen alleen nog een paarse
   ring, `max 2` staat als label achter de klasse, en de uitleg onder de lijst noemt `max 2` en
   het hoekje, en niet meer de gele kanttekening.

- [ ] **Step 4: Sluit ticket #36**

```bash
gh issue close 36 --repo faijdherbe/invalmatrix --comment "Opgelost op branch hoekjes. Het gele hoekje is weg: artikel 5.3.5.3 heeft nu het label max 2 in het vakje, en die vakjes zijn daardoor geel in plaats van groen. Het paarse hoekje zit rechtsboven en is het enige hoekje dat over is. Het hoekje en het blok in de detailweergave beginnen allebei met het woord Onduidelijk en delen de paarse kleur. Het blok Let op is grijs, want dat hoort bij geen markering en staat er bij elke toegestane uitkomst. Vastgesteld met node --test test/ (alles groen, waaronder de nieuwe test/cell-text.test.js en test/style.test.js) en door de pagina lokaal na te lopen op het raster, het detail en de smalle weergave."
```

Vul in het commentaar de commit-hashes aan die de vier taken hebben opgeleverd.

---

## Wat expliciet blijft staan

- Ticket #13 blijft open. De vraag of het maximum van twee altijd geldt is niet beantwoord, alleen
  de dubbele markering ervoor verdwijnt. `uncertainties.js` verandert niet.
- `rules.js`, `data.js` en `uncertainties.js` worden in geen enkele taak aangeraakt. Verandert daar
  toch iets, dan is dat een fout in de uitvoering: dit is een weergavewijziging.
- `test/rules.test.js` verandert niet. Blijft die suite groen, dan is dat het bewijs dat geen
  enkel oordeel is verschoven.
