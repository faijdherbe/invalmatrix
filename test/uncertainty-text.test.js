import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { ISSUE_URL, uncertaintyHeading, uncertaintyLines } from "../uncertainty-text.js";

const two = [
  { ticket: 19, heading: "Kop van negentien", explanation: "Uitleg van negentien.", needsDateOfBirth: false },
  { ticket: 30, heading: "Kop van dertig", explanation: "Uitleg van dertig.", needsDateOfBirth: false },
];

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

// Nothing to warn about means no block at all, so the screen stays as it was.
test("no uncertainties yields an empty heading", () => {
  assert.equal(uncertaintyHeading(0), "");
});

test("every line carries a link to its own ticket", () => {
  const lines = uncertaintyLines(two);
  assert.equal(lines.length, 2);
  assert.equal(lines[0].url, `${ISSUE_URL}/19`);
  assert.equal(lines[0].linkText, "ticket #19");
  assert.equal(lines[1].url, `${ISSUE_URL}/30`);
  assert.equal(lines[1].linkText, "ticket #30");
});

test("a line keeps the heading and the explanation of its uncertainty, in the given order", () => {
  const lines = uncertaintyLines(two);
  assert.equal(lines[0].heading, "Kop van negentien");
  assert.equal(lines[0].explanation, "Uitleg van negentien.");
  assert.deepEqual(lines.map((line) => line.ticket), [19, 30]);
});

test("an empty list yields no lines", () => {
  assert.deepEqual(uncertaintyLines([]), []);
});

// The whole point of this module: it may reach for no DOM, otherwise it cannot be tested.
test("the module carries no reference to the document", () => {
  const source = readFileSync(new URL("../uncertainty-text.js", import.meta.url), "utf8");
  assert.ok(!/\bdocument\b/.test(source), "uncertainty-text.js must stay free of the DOM");
});

// Was: five tests on cellMarkers(), which put the yellow max-two marker and the purple uncertainty
// marker in a fixed order. That expectation is stale: max-two is a condition with a label of its
// own now (see cell-text.js) and there is only one marker left, so a list of markers has nothing
// left to order. app.js reads cell.uncertain directly.
test("the module no longer hands out markers", async () => {
  const module = await import("../uncertainty-text.js");
  assert.equal(module.cellMarkers, undefined);
});
