import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { ISSUE_URL, uncertaintyHeading, uncertaintyLines, cellMarkers } from "../uncertainty-text.js";

const two = [
  { ticket: 19, heading: "Kop van negentien", explanation: "Uitleg van negentien.", needsDateOfBirth: false },
  { ticket: 30, heading: "Kop van dertig", explanation: "Uitleg van dertig.", needsDateOfBirth: false },
];

test("the heading counts the uncertainties and uses the singular for one", () => {
  assert.equal(uncertaintyHeading(1), "Het reglement is hier op 1 punt onduidelijk");
});

test("the heading uses the plural from two upwards", () => {
  assert.equal(uncertaintyHeading(2), "Het reglement is hier op 2 punten onduidelijk");
  assert.equal(uncertaintyHeading(4), "Het reglement is hier op 4 punten onduidelijk");
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

// The markers a cell carries in the grid: the yellow triangle for the max-two caveat of article
// 5.3.5.3, and the purple corner for an open uncertainty. Which of the two a cell gets is a
// decision, so it is tested here rather than buried in the HTML of app.js.
test("a cell without markers yields an empty list", () => {
  assert.deepEqual(cellMarkers({ requirements: [], uncertain: false }), []);
});

test("the max-two requirement yields the caveat marker", () => {
  assert.deepEqual(cellMarkers({ requirements: ["max-two"], uncertain: false }), ["max-two"]);
});

test("an uncertain cell yields the uncertainty marker", () => {
  assert.deepEqual(cellMarkers({ requirements: [], uncertain: true }), ["uncertain"]);
});

test("a cell can carry both markers, always in the same order", () => {
  assert.deepEqual(cellMarkers({ requirements: ["max-two", "age"], uncertain: true }), ["max-two", "uncertain"]);
});

test("another requirement yields no marker of its own", () => {
  assert.deepEqual(cellMarkers({ requirements: ["player-count", "age"], uncertain: false }), []);
});
