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
