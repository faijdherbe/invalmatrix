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
