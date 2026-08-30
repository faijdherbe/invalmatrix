import { test } from "node:test";
import assert from "node:assert/strict";
import { CLASSES, REFERENCE_DATE, COLUMNS, AGE_CATEGORIES } from "../data.js";
import {
  level,
  assessLevel,
  categoryINotice,
  ageOnReferenceDate,
  assessAge,
  formatDateDutch,
  assess,
  overview,
  cellFromOutcome,
} from "../rules.js";

const d = (s) => new Date(`${s}T00:00:00Z`);

function check(lenderCategory, lenderClass, borrowerCategory, borrowerClass) {
  return assessLevel(
    { category: lenderCategory, classId: lenderClass },
    { category: borrowerCategory, classId: borrowerClass },
  );
}

// The cell as the grid draws it, for a lender and a borrower team. The grid knows no date of
// birth, so assess() gets no date here either.
function cellFor(lenderCategory, lenderClass, borrowerCategory, borrowerClass) {
  return cellFromOutcome(
    assess({ category: lenderCategory, classId: lenderClass }, { category: borrowerCategory, classId: borrowerClass }, null),
  );
}

// Compact rendering of a cell from overview(), for the grid tests below: the status, and when
// there are requirements those behind it with a plus in between. A class the category does not
// have yields null.
function cellCode(cell) {
  if (!cell.exists) return null;
  return cell.requirements.length > 0 ? `${cell.status}:${cell.requirements.join("+")}` : cell.status;
}

test("O11 and O12 share a column in the class boundaries table", () => {
  assert.equal(level("O11", "1e"), level("O12", "1e"));
  assert.equal(level("O11", "4e"), level("O12", "4e"));
});

test("one class lower is one level lower within the same category", () => {
  assert.equal(level("O14", "2e") - level("O14", "1e"), 1);
  assert.equal(level("O18", "3e") - level("O18", "2e"), 1);
});

test("an older category sits one level higher at an equal class", () => {
  assert.equal(level("O16", "2e") - level("O18", "2e"), 1);
  assert.equal(level("O14", "2e") - level("O16", "2e"), 1);
});

test("O11 1st class is equal to O14 2nd class", () => {
  assert.equal(level("O11", "1e"), level("O14", "2e"));
});

test("O18 3rd class is equal to O14 1st class, article 5.3.5.1", () => {
  assert.equal(level("O18", "3e"), level("O14", "1e"));
});

test("5th class and lower sit at the same level within a category", () => {
  assert.equal(level("O14", "5e"), level("O14", "6e"));
  assert.equal(level("O14", "5e"), level("O14", "8e"));
  assert.equal(level("O11", "5e"), level("O11", "7e"));
});

test("level knows every class from the picker", () => {
  for (const [category, classes] of Object.entries(CLASSES)) {
    for (const classEntry of classes) {
      assert.equal(typeof level(category, classEntry.id), "number", `${category} ${classEntry.id}`);
    }
  }
});

test("article 5.3.5.1: an equal class within the same category is always allowed", () => {
  const r = check("O16", "2e", "O16", "2e");
  assert.equal(r.allowed, true);
  assert.equal(r.ground, "equal-or-lower");
  assert.deepEqual(r.conditions, []);
  assert.ok(r.articles.includes("5.3.5.1"));
});

test("article 5.3.5.1: a lower class within the same category is always allowed", () => {
  const r = check("O16", "3e", "O16", "2e");
  assert.equal(r.allowed, true);
  assert.equal(r.ground, "equal-or-lower");
});

test("article 5.3.5.1: JO18-2 3rd class may borrow from JO14-2 1st class", () => {
  const r = check("O14", "1e", "O18", "3e");
  assert.equal(r.allowed, true);
  assert.equal(r.ground, "equal-or-lower");
  assert.deepEqual(r.conditions, []);
});

test("article 5.3.5.1: MO16-3 2nd class may borrow from MO18-3 3rd class, given the right age", () => {
  const r = check("O18", "3e", "O16", "2e");
  assert.equal(r.allowed, true);
  assert.equal(r.ground, "equal-or-lower");
  assert.equal(r.conditions.length, 1);
  assert.match(r.conditions[0], /leeftijdsgrenzen van O16/);
});

test("article 5.3.5.2: JO16-2 1st class may borrow from JO18-3 1st class under conditions", () => {
  const r = check("O18", "1e", "O16", "1e");
  assert.equal(r.allowed, true);
  assert.equal(r.ground, "one-higher");
  assert.ok(r.conditions.some((v) => /maximaal 11/.test(v)));
  assert.ok(r.conditions.some((v) => /leeftijdsgrenzen van O16/.test(v)));
  assert.ok(r.articles.includes("5.3.5.2"));
});

test("article 5.3.5.2: JO16-3 3rd class may never borrow from JO18-3 2nd class", () => {
  const r = check("O18", "2e", "O16", "3e");
  assert.equal(r.allowed, false);
  assert.equal(r.ground, "too-high");
});

test("article 5.3.5.2: JO16-3 3rd class may borrow from JO18-4 3rd class", () => {
  const r = check("O18", "3e", "O16", "3e");
  assert.equal(r.allowed, true);
  assert.equal(r.ground, "one-higher");
});

test("article 5.3.5.3: MO14-6 6th class may borrow from MO14-5 4th class under conditions", () => {
  const r = check("O14", "4e", "O14", "6e");
  assert.equal(r.allowed, true);
  assert.equal(r.ground, "one-higher");
});

test("article 5.3.5.3: substituting among each other from the 5th class down has a maximum of two", () => {
  const r = check("O14", "5e", "O14", "6e");
  assert.equal(r.allowed, true);
  assert.equal(r.ground, "fifth-class");
  assert.ok(r.conditions.some((v) => /maximaal twee/.test(v)));
  assert.ok(r.articles.includes("5.3.5.3"));
});

// Ticket #3: ground fifth-class only applies when the lender plays in a higher class than the
// borrower. At ground fifth-class article 5.3.5.1 does not apply by definition (that article
// covers the opposite direction, lender equal to or lower than borrower), so that reference no
// longer belongs in the article list of this ground. Was: this test did expect 5.3.5.1 in the
// list.
test("article 5.3.5.3: the article list for ground fifth-class names 5.3.5.3, but not 5.3.5.1", () => {
  const r = check("O14", "5e", "O14", "6e");
  assert.equal(r.ground, "fifth-class");
  assert.ok(r.articles.includes("5.3.5.3"));
  assert.ok(!r.articles.includes("5.3.5.1"));
});

// Was: this test also expected a reference to 5.3.5.1 in the condition text, as a possible
// fallback with fewer than eleven own players. After ticket #3 that is wrong: at ground
// fifth-class the lender plays in a higher class than the borrower, so article 5.3.5.1 does not
// apply there by definition. That sentence has been dropped from the condition text; the open
// question about the maximum (ticket #13) simply remains.
test("article 5.3.5.3: the conditions name the uncertainty about the number of available players", () => {
  const r = check("O14", "5e", "O14", "6e");
  assert.equal(r.ground, "fifth-class");
  assert.ok(r.conditions.some((v) => /elf of meer eigen spelers/.test(v)));
  assert.ok(r.conditions.some((v) => /competitieleiding/.test(v)));
  assert.ok(!r.conditions.some((v) => /5\.3\.5\.1/.test(v)));
});

// Ticket #3: article 5.3.5.1 says a team may always borrow substitutes from a team that plays
// equal or lower. Within the 5th class and below that used to fall wrongly under the exception of
// article 5.3.5.3 as well, with the maximum of two substitutes. Ground fifth-class now only
// applies when the lender plays in a higher class than the borrower: exactly the direction for
// which article 5.3.5.1 is not a safety net.
test("ticket 3: borrower 5th class with lender 5th class (equal class) falls under 5.3.5.1, not the exception", () => {
  const r = check("O14", "5e", "O14", "5e");
  assert.equal(r.ground, "equal-or-lower");
});

test("ticket 3: borrower 5th class with lender 6th class (lender lower) falls under 5.3.5.1, not the exception", () => {
  const r = check("O14", "6e", "O14", "5e");
  assert.equal(r.ground, "equal-or-lower");
});

test("ticket 3: borrower 6th class with lender 5th class (lender higher) stays the exception of 5.3.5.3", () => {
  const r = check("O14", "5e", "O14", "6e");
  assert.equal(r.ground, "fifth-class");
});

// Sixteen ordered pairs (4 classes x 4 classes) per age category, five categories: 80
// combinations. In six of the sixteen pairs per category the lender plays in a strictly higher
// class than the borrower (class number of the lender smaller than the borrower): that is
// 6 x 5 = 30. The other 50 (lender equal to or lower than the borrower) fall under article
// 5.3.5.1 and get ground equal-or-lower.
test("the split between fifth-class and equal-or-lower within the low classes is 30 to 50", () => {
  const lowClasses = ["5e", "6e", "7e", "8e"];
  let fifthClass = 0;
  let equalOrLower = 0;
  let other = 0;
  for (const category of AGE_CATEGORIES) {
    for (const lenderClass of lowClasses) {
      for (const borrowerClass of lowClasses) {
        const r = check(category, lenderClass, category, borrowerClass);
        if (r.ground === "fifth-class") fifthClass += 1;
        else if (r.ground === "equal-or-lower") equalOrLower += 1;
        else other += 1;
      }
    }
  }
  assert.equal(fifthClass, 30);
  assert.equal(equalOrLower, 50);
  assert.equal(other, 0);
});

// The requirement max-two (article 5.3.5.3) only belongs to combinations that keep ground
// fifth-class. The 50 combinations that move to equal-or-lower lose that requirement: article
// 5.3.5.1 has no maximum.
test("the max-two condition disappears at equal-or-lower and stays at fifth-class", () => {
  const lowClasses = ["5e", "6e", "7e", "8e"];
  for (const lenderClass of lowClasses) {
    for (const borrowerClass of lowClasses) {
      const r = check("O14", lenderClass, "O14", borrowerClass);
      const hasMaxTwo = r.conditions.some((v) => /maximaal twee/.test(v));
      if (r.ground === "fifth-class") {
        assert.ok(hasMaxTwo, `${lenderClass} to ${borrowerClass}: max-two should stay`);
      } else {
        assert.ok(!hasMaxTwo, `${lenderClass} to ${borrowerClass}: max-two should disappear`);
      }
    }
  }
});

test("O11 uses nine players instead of eleven in the condition of 5.3.5.2", () => {
  const r = check("O11", "3e", "O11", "4e");
  assert.equal(r.ground, "one-higher");
  assert.ok(r.conditions.some((v) => /maximaal 9/.test(v)));

  // The number nine belongs to the category of the borrower team, not of the lender: a player
  // from O12 substituting into an O11 borrower team must see 9 here too, not 11.
  const r2 = check("O12", "3e", "O11", "4e");
  assert.equal(r2.ground, "one-higher");
  assert.ok(r2.conditions.some((v) => /maximaal 9/.test(v)));
});

test("the twelve cases from build.py give the same outcome", () => {
  const cases = [
    ["O11", "1e", "O11", "1e", true, "equal-or-lower"],
    ["O14", "4e", "O14", "6e", true, "one-higher"],
    ["O14", "5e", "O14", "6e", true, "fifth-class"],
    ["O12", "1e", "O12", "5e", false, "too-high"],
    ["O11", "1e", "O12", "1e", true, "equal-or-lower"],
    ["O12", "1e", "O11", "1e", true, "equal-or-lower"],
    ["O14", "subtop", "O14", "1e", true, "one-higher"],
    ["O11", "3e", "O14", "4e", true, "equal-or-lower"],
    ["O11", "1e", "O14", "4e", false, "too-high"],
    ["O11", "3e", "O14", "6e", true, "one-higher"],
    ["O14", "4e", "O11", "3e", true, "equal-or-lower"],
    ["O14", "5e", "O11", "4e", true, "equal-or-lower"],
  ];
  for (const [bc, bk, dc, dk, allowed, ground] of cases) {
    const r = check(bc, bk, dc, dk);
    assert.equal(r.allowed, allowed, `${bc} ${bk} to ${dc} ${dk}`);
    assert.equal(r.ground, ground, `${bc} ${bk} to ${dc} ${dk}`);
  }
});

test("Landelijk and Super fall under category I at O16 and O18", () => {
  assert.ok(categoryINotice({ category: "O18", classId: "landelijk" }));
  assert.ok(categoryINotice({ category: "O18", classId: "super" }));
  assert.ok(categoryINotice({ category: "O16", classId: "landelijk" }));
  assert.ok(categoryINotice({ category: "O16", classId: "super" }));
});

test("the Super Competitie falls under category I at O14", () => {
  assert.ok(categoryINotice({ category: "O14", classId: "super" }));
});

test("the Subtopklasse of O14 falls under category II and gets no notice", () => {
  assert.equal(categoryINotice({ category: "O14", classId: "subtop" }), null);
});

test("the Subtopklasse of O16 and O18 switches category and gets a notice with a period", () => {
  const o18 = categoryINotice({ category: "O18", classId: "subtop" });
  assert.match(o18, /herfstvakantie/);
  const o16 = categoryINotice({ category: "O16", classId: "subtop" });
  assert.match(o16, /winterstop/);
});

test("the period text of O16 Subtopklasse follows chapter 2 literally: tot en met de winterstop", () => {
  const o16 = categoryINotice({ category: "O16", classId: "subtop" });
  assert.match(o16, /tot en met de winterstop/);
});

test("numbered classes get no notice", () => {
  assert.equal(categoryINotice({ category: "O18", classId: "1e" }), null);
  assert.equal(categoryINotice({ category: "O11", classId: "1e" }), null);
});

test("O14 Topklasse falls under category II and gets no notice, Super O14 does", () => {
  assert.equal(categoryINotice({ category: "O14", classId: "top" }), null);
  assert.ok(categoryINotice({ category: "O14", classId: "super" }));
});

test("O14 Topklasse and Super O14 sit at the same level", () => {
  assert.equal(level("O14", "top"), level("O14", "super"));
});

test("IDC-O14 is a class of its own next to Super O14, at the same level as Super O14 and Topklasse", () => {
  assert.equal(level("O14", "idc"), level("O14", "super"));
  assert.equal(level("O14", "idc"), level("O14", "top"));
});

test("IDC-O14 falls under category I until the winter break and after that the tool makes no statement", () => {
  const notice = categoryINotice({ category: "O14", classId: "idc" });
  assert.match(notice, /tot de winterstop/);
  assert.match(notice, /geen uitspraak/);
});

test("Super O14 stays, apart from IDC-O14, unconditionally under category I", () => {
  const notice = categoryINotice({ category: "O14", classId: "super" });
  assert.ok(notice);
  assert.doesNotMatch(notice, /winterstop/);
});

test("an O14 team in the Topklasse simply gets a verdict from assessLevel", () => {
  const r = check("O14", "top", "O14", "subtop");
  assert.equal(r.allowed, true);
  assert.equal(r.ground, "one-higher");
});

test("the category I notices name both chapter 2 and chapter 4", () => {
  const fixedNotice = categoryINotice({ category: "O18", classId: "super" });
  assert.match(fixedNotice, /hoofdstuk 2/);
  assert.match(fixedNotice, /hoofdstuk 4/);
  const periodNotice = categoryINotice({ category: "O18", classId: "subtop" });
  assert.match(periodNotice, /hoofdstuk 2/);
  assert.match(periodNotice, /hoofdstuk 4/);
});

test("age is calculated on 1 October 2026", () => {
  assert.equal(ageOnReferenceDate(d("2016-10-01")), 10);
  assert.equal(ageOnReferenceDate(d("2016-10-02")), 9);
  assert.equal(ageOnReferenceDate(d("2015-10-02")), 10);
});

test("a player with the right age for the borrower category does not block", () => {
  const r = assessAge(
    { category: "O14", classId: "4e" },
    { category: "O14", classId: "5e" },
    d("2013-05-01"),
  );
  assert.equal(r.age, 13);
  assert.equal(r.blocks, false);
});

test("a player who is too old for the borrower category may not play there", () => {
  const r = assessAge(
    { category: "O14", classId: "4e" },
    { category: "O11", classId: "4e" },
    d("2013-05-01"),
  );
  assert.equal(r.blocks, true);
  assert.ok(r.messages.some((m) => /te oud voor O11/.test(m)));
  assert.ok(r.articles.includes("3.1.3"));
});

test("a player who is too young for her own category is a dispensation case, also with an equal or older lender", () => {
  const r = assessAge(
    { category: "O14", classId: "3e" },
    { category: "O14", classId: "4e" },
    d("2016-05-01"),
  );
  assert.equal(r.blocks, true);
  assert.ok(r.messages.some((m) => /dispensatie/.test(m)));
});

test("a player who is too young for the borrower category no longer blocks when the lender comes from a younger category", () => {
  const r = assessAge(
    { category: "O11", classId: "1e" },
    { category: "O14", classId: "4e" },
    d("2016-05-01"),
  );
  assert.equal(r.blocks, false);
  assert.ok(!r.messages.some((m) => /dispensatie/.test(m)));
});

test("article 5.2.4: a player who is one year too old may only play for her own team", () => {
  const r = assessAge(
    { category: "O14", classId: "3e" },
    { category: "O14", classId: "4e" },
    d("2012-05-01"),
  );
  assert.equal(r.blocks, true);
  assert.ok(r.messages.some((m) => /uitsluitend/.test(m)));
  assert.ok(r.articles.includes("5.2.4"));
});

test("article 5.2.4 does not apply to the 1st class", () => {
  const r = assessAge(
    { category: "O14", classId: "1e" },
    { category: "O14", classId: "2e" },
    d("2012-05-01"),
  );
  assert.ok(!r.messages.some((m) => /uitsluitend/.test(m)));
});

test("a date of birth of exactly 1 October gives a warning about the edge case", () => {
  const r = assessAge(
    { category: "O14", classId: "4e" },
    { category: "O14", classId: "5e" },
    d("2013-10-01"),
  );
  assert.ok(r.messages.some((m) => /randgeval/.test(m)));
});

test("formatDateDutch gives the correct Dutch date text", () => {
  assert.equal(formatDateDutch(REFERENCE_DATE), "1 oktober 2026");
});

test("messages from assessAge contain the reference date in Dutch", () => {
  const expectedText = formatDateDutch(REFERENCE_DATE);
  const r = assessAge(
    { category: "O14", classId: "4e" },
    { category: "O14", classId: "5e" },
    d("2013-05-01"),
  );
  assert.ok(r.messages.some((m) => m.includes(expectedText)), `No message containing "${expectedText}" found`);
});

test("assess gives out-of-scope for category I, also when only one of the two teams falls into it", () => {
  const r = assess({ category: "O18", classId: "landelijk" }, { category: "O18", classId: "1e" }, null);
  assert.equal(r.verdict, "out-of-scope");
  assert.equal(r.conditions.length, 0);
});

test("assess returns the ground from assessLevel, and null at out-of-scope", () => {
  const outOfScope = assess({ category: "O18", classId: "landelijk" }, { category: "O18", classId: "1e" }, null);
  assert.equal(outOfScope.ground, null);

  const oneHigher = assess({ category: "O14", classId: "3e" }, { category: "O14", classId: "4e" }, null);
  assert.equal(oneHigher.ground, "one-higher");

  const fifthClass = assess({ category: "O14", classId: "5e" }, { category: "O14", classId: "6e" }, null);
  assert.equal(fifthClass.ground, "fifth-class");

  const tooHigh = assess({ category: "O12", classId: "1e" }, { category: "O12", classId: "5e" }, null);
  assert.equal(tooHigh.ground, "too-high");
});

test("assess gives allowed without a date of birth", () => {
  const r = assess({ category: "O16", classId: "3e" }, { category: "O16", classId: "2e" }, null);
  assert.equal(r.verdict, "allowed");
  assert.equal(r.age, null);
});

test("assess lets the age check flip a green verdict to red", () => {
  const r = assess(
    { category: "O14", classId: "4e" },
    { category: "O11", classId: "4e" },
    new Date("2013-05-01T00:00:00Z"),
  );
  assert.equal(r.verdict, "not-allowed");
  assert.ok(r.age.messages.length > 0);
});

test("assess deduplicates and sorts the articles", () => {
  const r = assess(
    { category: "O18", classId: "3e" },
    { category: "O16", classId: "2e" },
    new Date("2011-05-01T00:00:00Z"),
  );
  assert.deepEqual(r.articles, [...new Set(r.articles)].sort());
});

test("assess always gives a summary in plain language", () => {
  for (const testCase of [
    [{ category: "O16", classId: "3e" }, { category: "O16", classId: "2e" }],
    [{ category: "O18", classId: "2e" }, { category: "O16", classId: "3e" }],
    [{ category: "O18", classId: "landelijk" }, { category: "O18", classId: "1e" }],
  ]) {
    const r = assess(testCase[0], testCase[1], null);
    assert.equal(typeof r.summary, "string");
    assert.ok(r.summary.length > 10);
  }
});

// Regression, audit final fix finding 1: the summary of assess() must refer to the conditions
// below as soon as there is a condition, also when that condition does not come from assessLevel
// but only from assessAge. O11 2nd class to O11 1st class yields no class condition of its own
// (ground equal-or-lower), but with a date of birth that puts the player exactly one year above
// the upper limit of O11, assessAge adds the player-number condition of article 5.2.5. Whoever
// stops reading after the first sentence of the summary must not think there is nothing left to
// check.
test("assess refers to the conditions below when only assessAge yields a condition", () => {
  const r = assess(
    { category: "O11", classId: "2e" },
    { category: "O11", classId: "1e" },
    new Date(Date.UTC(2015, 4, 1)),
  );
  assert.equal(r.verdict, "allowed");
  assert.equal(r.ground, "equal-or-lower");
  assert.ok(r.conditions.length > 0, "expected a condition from assessAge (article 5.2.5)");
  assert.match(r.summary, /voorwaarden hieronder/);
});

// Ticket #20: when the class boundary allows the substitution but the age of the player blocks
// it, the summary must not show a conditions block after all. That reads as if the player could
// still get through via those conditions, while the age has already rejected it. O14 Topklasse to
// O14 Subtopklasse is a good case for this: the class check already yields conditions of its own
// (the first-team requirement of article 5.3.5.4 and the player-count requirement of article
// 5.3.5.2, ground one-higher), and a player of fourteen is too old for the borrower category O14
// (limit 13 years), so the age check blocks.
test("assess empties the conditions when the age blocks, even though the class check itself yields conditions", () => {
  const r = assess(
    { category: "O14", classId: "top" },
    { category: "O14", classId: "subtop" },
    new Date(Date.UTC(2012, 4, 1)),
  );
  assert.equal(r.verdict, "not-allowed");
  assert.ok(r.age.blocks);
  assert.deepEqual(r.conditions, []);
  // The articles and the age messages stay: they carry the verdict and explain why it is no.
  assert.ok(r.articles.includes("5.3.5.4"));
  assert.ok(r.age.messages.length > 0);
});

// Regression protection for the fix above: in an allowed case with conditions from the class
// check itself (so not only from assessAge, which the test further on already covers) the summary
// must keep referring to "mits aan de voorwaarden hieronder". The same combination as above, but
// with a date of birth that does fall within the age limits of O14.
test("assess keeps the summary 'mits aan de voorwaarden' for an allowed case with class conditions", () => {
  const r = assess(
    { category: "O14", classId: "top" },
    { category: "O14", classId: "subtop" },
    new Date(Date.UTC(2013, 4, 1)),
  );
  assert.equal(r.verdict, "allowed");
  assert.ok(r.conditions.length > 0);
  assert.match(r.summary, /voorwaarden hieronder/);
});

test("a rejection for too large a level difference contains no reasoning about the age of an older category", () => {
  const r = assess(
    { category: "O18", classId: "1e" },
    { category: "O11", classId: "4e" },
    new Date("2009-05-01T00:00:00Z"),
  );
  assert.equal(r.verdict, "not-allowed");
  const reasoning = r.reasoning.join(" ");
  assert.ok(!reasoning.includes("leeftijdsgrenzen"), "the reasoning must not contain an age limit");
  assert.ok(!r.articles.includes("3.1.1"), "article 3.1.1 must not appear");
  assert.ok(!r.articles.includes("3.1.3"), "article 3.1.3 must not appear");
});

test("overview gives one row per age category", () => {
  const rows = overview({ category: "O14", classId: "4e" });
  assert.equal(rows.length, AGE_CATEGORIES.length);
  assert.deepEqual(rows.map((r) => r.category), AGE_CATEGORIES);
});

test("overview gives one cell per column per row", () => {
  const rows = overview({ category: "O14", classId: "4e" });
  for (const row of rows) {
    assert.equal(row.cells.length, COLUMNS.length);
    assert.deepEqual(row.cells.map((v) => v.classId), COLUMNS);
  }
});

test("overview marks classes a category does not have as not existing", () => {
  const rows = overview({ category: "O14", classId: "4e" });
  const o11 = rows.find((r) => r.category === "O11");
  const subtop = o11.cells.find((v) => v.classId === "subtop");
  assert.equal(subtop.exists, false);
  const first = o11.cells.find((v) => v.classId === "1e");
  assert.equal(first.exists, true);
});

test("overview matches assess per cell", () => {
  const borrower = { category: "O14", classId: "4e" };
  for (const row of overview(borrower)) {
    for (const cell of row.cells) {
      if (!cell.exists) continue;
      const expected = assess({ category: row.category, classId: cell.classId }, borrower, null);
      assert.equal(cell.verdict, expected.verdict, `${row.category} ${cell.classId}`);
    }
  }
});

test("overview shows that a team at an equal level may substitute freely", () => {
  const rows = overview({ category: "O14", classId: "4e" });
  const o14 = rows.find((r) => r.category === "O14");
  const fifth = o14.cells.find((v) => v.classId === "5e");
  assert.equal(fifth.verdict, "allowed");
  assert.equal(fifth.status, "free");
  assert.deepEqual(fifth.requirements, []);
});

test("overview shows that one class higher is allowed under the player-count requirement", () => {
  const rows = overview({ category: "O14", classId: "4e" });
  const o14 = rows.find((r) => r.category === "O14");
  const third = o14.cells.find((v) => v.classId === "3e");
  assert.equal(third.verdict, "allowed");
  assert.equal(third.status, "free");
  assert.deepEqual(third.requirements, ["player-count"]);
});

test("empty cell: a class the category does not have gets no further fields", () => {
  const rows = overview({ category: "O14", classId: "4e" });
  const o11 = rows.find((r) => r.category === "O11");
  const subtop = o11.cells.find((v) => v.classId === "subtop");
  assert.equal(subtop.exists, false);
  assert.equal(subtop.status, undefined);
  assert.equal(subtop.requirements, undefined);
});

test("status out-of-scope: O16 Subtopklasse falls under category I and gets no class verdict", () => {
  const rows = overview({ category: "O14", classId: "4e" });
  const o16 = rows.find((r) => r.category === "O16");
  const subtop = o16.cells.find((v) => v.classId === "subtop");
  assert.equal(subtop.verdict, "out-of-scope");
  assert.equal(subtop.status, "out-of-scope");
  assert.deepEqual(subtop.requirements, []);
});

test("status no: too large a level difference is not allowed", () => {
  const rows = overview({ category: "O14", classId: "4e" });
  const o14 = rows.find((r) => r.category === "O14");
  const second = o14.cells.find((v) => v.classId === "2e");
  assert.equal(second.verdict, "not-allowed");
  assert.equal(second.status, "no");
  assert.deepEqual(second.requirements, []);
});

test("requirement player-count: one level higher is only allowed under the conditions of 5.3.5.2", () => {
  const rows = overview({ category: "O14", classId: "4e" });
  const o14 = rows.find((r) => r.category === "O14");
  const third = o14.cells.find((v) => v.classId === "3e");
  assert.deepEqual(third.requirements, ["player-count"]);
});

test("ground one-higher from an older category carries both requirements: player-count and age", () => {
  const rows = overview({ category: "O16", classId: "1e" });
  const o18 = rows.find((r) => r.category === "O18");
  const first = o18.cells.find((v) => v.classId === "1e");
  assert.equal(first.verdict, "allowed");
  assert.equal(first.status, "free");
  assert.deepEqual(first.requirements, ["player-count", "age"]);
});

test("requirement max-two: ground fifth-class yields max-two, not player-count", () => {
  const rows = overview({ category: "O14", classId: "6e" });
  const o14 = rows.find((r) => r.category === "O14");
  const fifth = o14.cells.find((v) => v.classId === "5e");
  assert.equal(fifth.verdict, "allowed");
  assert.equal(fifth.status, "free");
  assert.deepEqual(fifth.requirements, ["max-two"]);
});

test("requirement age: from the 5th class down O16 plays equal to O14 4th class, then only the age counts", () => {
  const rows = overview({ category: "O14", classId: "4e" });
  const o16 = rows.find((r) => r.category === "O16");
  const fifth = o16.cells.find((v) => v.classId === "5e");
  assert.equal(fifth.verdict, "allowed");
  assert.equal(fifth.status, "free");
  assert.deepEqual(fifth.requirements, ["age"]);
});

test("status free without requirements: an equal level within the same category is allowed without any condition", () => {
  const rows = overview({ category: "O14", classId: "4e" });
  const o14 = rows.find((r) => r.category === "O14");
  const fourth = o14.cells.find((v) => v.classId === "4e");
  assert.equal(fourth.verdict, "allowed");
  assert.equal(fourth.status, "free");
  assert.deepEqual(fourth.requirements, []);
});

test("overview for O14 4th class gives the full grid as the client wants to see it", () => {
  const rows = overview({ category: "O14", classId: "4e" });
  // columns: idc top subtop 1e 2e 3e 4e 5e 6e 7e 8e
  const expected = {
    O11: [null, null, null, "no", "free:player-count", "free", "free", "free", "free", "free", "free"],
    O12: [null, null, null, "no", "free:player-count", "free", "free", "free", "free", "free", "free"],
    O14: ["out-of-scope", "no", "no", "no", "no", "free:player-count", "free", "free", "free", "free", "free"],
    O16: [null, null, "out-of-scope", "no", "no", "no", "free:player-count+age", "free:age", "free:age", "free:age", "free:age"],
    O18: [null, null, "out-of-scope", "no", "no", "no", "no", "free:player-count+age", "free:player-count+age", "free:player-count+age", "free:player-count+age"],
  };
  for (const row of rows) {
    assert.deepEqual(row.cells.map(cellCode), expected[row.category], row.category);
  }
});

// Ticket #3: the 5th class is the highest of the low classes, so from no low class at all can a
// lender play higher than borrower O14 5th. All four combinations (lender 5th, 6th, 7th or 8th)
// therefore fall under article 5.3.5.1 (ground equal-or-lower) and no longer carry max-two. Was:
// this test was called "geeft max2 voor de vijfde-klasse-uitzondering" and expected "vrij:max2"
// in those four places; that was right when every combination within the low classes got ground
// fifth-class, regardless of the direction.
test("overview for O14 5th class: a lender from the low classes may always substitute, without max-two", () => {
  const rows = overview({ category: "O14", classId: "5e" });
  // columns: idc top subtop 1e 2e 3e 4e 5e 6e 7e 8e
  const expected = {
    O11: [null, null, null, "no", "no", "free:player-count", "free", "free", "free", "free", "free"],
    O12: [null, null, null, "no", "no", "free:player-count", "free", "free", "free", "free", "free"],
    O14: ["out-of-scope", "no", "no", "no", "no", "no", "free:player-count", "free", "free", "free", "free"],
    O16: [null, null, "out-of-scope", "no", "no", "no", "no", "free:player-count+age", "free:player-count+age", "free:player-count+age", "free:player-count+age"],
    O18: [null, null, "out-of-scope", "no", "no", "no", "no", "no", "no", "no", "no"],
  };
  for (const row of rows) {
    assert.deepEqual(row.cells.map(cellCode), expected[row.category], row.category);
  }
});

// Ticket #3: borrower O14 8th class is the lowest low class, so there the exception of 5.3.5.3
// (max-two) does keep applying for every lender that plays in a higher low class (5th, 6th or
// 7th). Only lender 8th itself (equal class) falls under 5.3.5.1.
test("overview for O14 8th class keeps max-two for a lender from a higher low class", () => {
  const rows = overview({ category: "O14", classId: "8e" });
  const o14 = rows.find((r) => r.category === "O14");
  assert.deepEqual(o14.cells.find((v) => v.classId === "5e").requirements, ["max-two"]);
  assert.deepEqual(o14.cells.find((v) => v.classId === "6e").requirements, ["max-two"]);
  assert.deepEqual(o14.cells.find((v) => v.classId === "7e").requirements, ["max-two"]);
  assert.deepEqual(o14.cells.find((v) => v.classId === "8e").requirements, []);
});

test("the idc column exists only at O14, the other categories get an empty cell there", () => {
  const rows = overview({ category: "O14", classId: "4e" });
  for (const row of rows) {
    assert.equal(row.cells.length, COLUMNS.length);
    const idc = row.cells.find((v) => v.classId === "idc");
    assert.equal(idc.exists, row.category === "O14");
  }
});

test("overview shows that two classes higher is not allowed", () => {
  const rows = overview({ category: "O14", classId: "4e" });
  const o14 = rows.find((r) => r.category === "O14");
  const second = o14.cells.find((v) => v.classId === "2e");
  assert.equal(second.verdict, "not-allowed");
});

test("overview gives the Subtopklasse of O16 and O18 as out of scope", () => {
  const rows = overview({ category: "O14", classId: "4e" });
  for (const category of ["O16", "O18"]) {
    const row = rows.find((r) => r.category === category);
    const subtop = row.cells.find((v) => v.classId === "subtop");
    assert.equal(subtop.exists, true);
    assert.equal(subtop.verdict, "out-of-scope");
  }
});

test("overview does give the Subtopklasse of O14 a real verdict", () => {
  const rows = overview({ category: "O14", classId: "4e" });
  const o14 = rows.find((r) => r.category === "O14");
  const subtop = o14.cells.find((v) => v.classId === "subtop");
  assert.notEqual(subtop.verdict, "out-of-scope");
});

test("COLUMNS contains no classes that always fall under category I", () => {
  assert.ok(!COLUMNS.includes("landelijk"));
  assert.ok(!COLUMNS.includes("super"));
});

test("every column exists at at least one age category", () => {
  for (const column of COLUMNS) {
    const exists = AGE_CATEGORIES.some((c) => CLASSES[c].some((k) => k.id === column));
    assert.ok(exists, `column ${column} exists at no age category at all`);
  }
});

// Error 1 (fixed): the verdict "omstreden" always fired when borrowing from a younger category,
// because a player from a younger category is by definition too young for the borrower category.
// The verdict has been removed; the caveat now lives in assessLevel and does not change the
// verdict.

test("O11 to O14 yields allowed, with and without a date of birth, with the same outcome", () => {
  const without = assess({ category: "O11", classId: "3e" }, { category: "O14", classId: "4e" }, null);
  const withDate = assess({ category: "O11", classId: "3e" }, { category: "O14", classId: "4e" }, d("2016-05-01"));
  assert.equal(without.verdict, "allowed");
  assert.equal(withDate.verdict, "allowed");
  assert.equal(without.verdict, withDate.verdict);
});

test("caveat: with a younger lender the caveat is there without a date of birth too, with article 3.1.3", () => {
  const r = check("O14", "1e", "O18", "3e");
  assert.equal(r.allowed, true);
  // Was: caveats.length === 1. Since task 5 every verdict with ground equal-or-lower also gets
  // the caveats about articles 5.3.4, 5.3.6/5.3.6.1 and 5.1.1, so the length is no longer 1. The
  // core of this test stands: the younger-category caveat is present.
  assert.ok(r.caveats.some((k) => /jongere leeftijdscategorie/.test(k)));
  assert.ok(r.articles.includes("3.1.3"), "article 3.1.3 missing");
  assert.ok(r.articles.includes("5.3.5.1"), "article 5.3.5.1 missing");

  const withoutDateOfBirth = assess({ category: "O14", classId: "1e" }, { category: "O18", classId: "3e" }, null);
  assert.equal(withoutDateOfBirth.verdict, "allowed");
  assert.ok(withoutDateOfBirth.caveats.some((k) => /jongere leeftijdscategorie/.test(k)));
  assert.ok(withoutDateOfBirth.articles.includes("3.1.3"));
});

test("caveat: an equal category yields no caveat about a younger category", () => {
  const r = check("O16", "2e", "O16", "2e");
  // Was: caveats deepEqual []. Since task 5 ground equal-or-lower always gets the caveats about
  // 5.3.4, 5.3.6/5.3.6.1 and 5.1.1, so the list is no longer empty. What this is about still
  // holds: no caveat about a younger age category.
  assert.ok(!r.caveats.some((k) => /jongere leeftijdscategorie/.test(k)));
});

test("caveat: an older lender yields no caveat about a younger category", () => {
  const r = check("O18", "3e", "O16", "2e");
  // Was: caveats deepEqual []. See the previous test for why the list is no longer empty.
  assert.ok(!r.caveats.some((k) => /jongere leeftijdscategorie/.test(k)));
});

test("the other direction stays blocked: too old for the borrower category with a lender from an older category", () => {
  const r = assess(
    { category: "O18", classId: "3e" },
    { category: "O16", classId: "2e" },
    d("2005-05-01"),
  );
  assert.equal(r.verdict, "not-allowed");
});

test("too old for the borrower category still blocks, also when the lender comes from a younger category", () => {
  const r = assess(
    { category: "O11", classId: "3e" },
    { category: "O14", classId: "4e" },
    d("2000-05-01"),
  );
  assert.equal(r.verdict, "not-allowed");
  assert.ok(r.age.messages.some((m) => /te oud/.test(m)));
});

test("article 5.2.4 still blocks: O14 5th class to O14 4th class with a 14-year-old stays not-allowed", () => {
  const r = assess(
    { category: "O14", classId: "5e" },
    { category: "O14", classId: "4e" },
    d("2012-05-01"),
  );
  assert.equal(r.verdict, "not-allowed");
});

// Error 2: article 5.3.5.4, the additional rule for O14 Topklasse and Subtopklasse.
// Ticket #6: article 5.3.5.4 has two level groups: the voorcompetitie (Topklasse and
// Subtopklasse) and the lentecompetitie (Super O14 and IDC-O14). assessLevel must recognise both,
// each with a condition text that names its own period.

test("article 5.3.5.4: O14 Topklasse to O14 Subtopklasse gets the additional condition about the first team, naming the voorcompetitie", () => {
  const r = check("O14", "top", "O14", "subtop");
  assert.equal(r.allowed, true);
  assert.ok(r.articles.includes("5.3.5.4"));
  assert.ok(r.conditions.some((v) => /eerste team/.test(v)));
  assert.ok(r.conditions.some((v) => /voorcompetitie/.test(v)));
});

test("article 5.3.5.4 applies the other way round too, from Subtopklasse to Topklasse", () => {
  const r = check("O14", "subtop", "O14", "top");
  assert.equal(r.allowed, true);
  assert.ok(r.articles.includes("5.3.5.4"));
});

test("article 5.3.5.4: O14 Super O14 to O14 IDC-O14 gets the additional condition naming the lentecompetitie (via assessLevel, because assess gives out-of-scope here)", () => {
  const r = check("O14", "super", "O14", "idc");
  assert.equal(r.allowed, true);
  assert.ok(r.articles.includes("5.3.5.4"));
  assert.ok(r.conditions.some((v) => /eerste team/.test(v)));
  assert.ok(r.conditions.some((v) => /lentecompetitie/.test(v)));
});

test("article 5.3.5.4 does not apply between O14 Topklasse and O14 1st class: those classes are not in one level group", () => {
  const r = check("O14", "top", "O14", "1e");
  assert.ok(!r.articles.includes("5.3.5.4"));
});

test("article 5.3.5.4 does not apply between O14 Topklasse and O14 IDC-O14: those are different level groups", () => {
  const r = check("O14", "top", "O14", "idc");
  assert.ok(!r.articles.includes("5.3.5.4"));
});

test("article 5.3.5.4 does not apply outside the Topklasse and Subtopklasse of O14", () => {
  const r = check("O14", "1e", "O14", "2e");
  assert.ok(!r.articles.includes("5.3.5.4"));
});

// Error 3: the condition text at one-higher must name the team being substituted into.

test("the condition at ground one-higher names the team being substituted into, not the substituting team", () => {
  const r = check("O18", "1e", "O16", "1e");
  assert.ok(r.conditions.some((v) => /^Het team waarin wordt ingevallen/.test(v)));
  assert.ok(!r.conditions.some((v) => /invallende team/.test(v)));
});

// Error 4: an unreadable date of birth must not calculate on into NaN.

test("ageOnReferenceDate throws a clear error on an invalid date", () => {
  assert.throws(() => ageOnReferenceDate(new Date("not-a-date")));
});

test("assess treats an invalid date of birth as no date of birth given", () => {
  const r = assess(
    { category: "O14", classId: "4e" },
    { category: "O14", classId: "5e" },
    new Date("not-a-date"),
  );
  assert.equal(r.verdict, "allowed");
  assert.equal(r.age, null);
});

// Error 5: article 5.2.5, the player-number exception for players of O12 age in the O11
// category.

test("article 5.2.5: a player of O12 age in O11 points to the exception for player-number problems", () => {
  const r = assessAge(
    { category: "O11", classId: "1e" },
    { category: "O11", classId: "1e" },
    d("2015-05-01"),
  );
  assert.equal(r.age, 11);
  assert.ok(r.messages.some((m) => /5\.2\.5/.test(m)));
  assert.ok(r.messages.some((m) => /aantallenproblemen/.test(m)));
  assert.ok(r.articles.includes("5.2.5"));
});

// Ticket #4: article 5.2.5 must not yield a "no" for a player of O12 age who is placed in the
// O11 category on the basis of player-number problems. assessAge used to block this player
// wrongly, while the first message at the same time claimed that dispensation was needed, which
// article 5.2.5 rules out.

test("article 5.2.5: a player of O12 age in O11 3rd class yields allowed with the player-number condition", () => {
  const r = assess(
    { category: "O12", classId: "3e" },
    { category: "O11", classId: "3e" },
    d("2015-05-01"),
  );
  assert.equal(r.verdict, "allowed");
  assert.ok(r.conditions.some((v) => /O11/.test(v) && /O12/.test(v) && /aantallen/.test(v)));
  assert.ok(r.articles.includes("5.2.5"));
});

test("assessAge no longer blocks for the player of O12 age in O11, and the first message no longer claims dispensation", () => {
  const r = assessAge(
    { category: "O12", classId: "3e" },
    { category: "O11", classId: "3e" },
    d("2015-05-01"),
  );
  assert.equal(r.blocks, false);
  assert.ok(
    !r.messages.some((m) => /mag alleen met dispensatie/.test(m)),
    "no message may still claim that dispensation is needed, that contradicts article 5.2.5",
  );
  assert.ok(r.conditions.some((v) => /aantallen/.test(v)));
});

test("a player of twelve to O11 stays not-allowed", () => {
  const r = assess(
    { category: "O12", classId: "3e" },
    { category: "O11", classId: "3e" },
    d("2014-05-01"),
  );
  assert.equal(r.verdict, "not-allowed");
});

test("a player of fourteen to O12 stays not-allowed", () => {
  const r = assess(
    { category: "O12", classId: "3e" },
    { category: "O12", classId: "3e" },
    d("2012-05-01"),
  );
  assert.equal(r.verdict, "not-allowed");
});

test("a player of eleven to O12 simply stays allowed without the player-number condition", () => {
  const r = assess(
    { category: "O12", classId: "3e" },
    { category: "O12", classId: "3e" },
    d("2015-05-01"),
  );
  assert.equal(r.verdict, "allowed");
  assert.ok(!r.conditions.some((v) => /aantallen/.test(v)));
});

// Error 6 was: an impossible age requirement had to take precedence over the player-count
// requirement in the grid. Ticket #2 showed that this precedence was the problem: the cell then
// kept the player-count requirement of article 5.3.5.2 quiet. A cell now carries both
// requirements, so nothing falls away any more.

test("an unreachable age requirement no longer pushes the player-count requirement out of the grid", () => {
  const rows = overview({ category: "O11", classId: "4e" });
  const o16 = rows.find((r) => r.category === "O16");
  const fifth = o16.cells.find((v) => v.classId === "5e");
  assert.equal(fifth.verdict, "allowed");
  assert.equal(fifth.status, "free");
  assert.deepEqual(fifth.requirements, ["player-count", "age"]);
});

// Ticket #8: article 5.3.4, change of level determination. A player who within the club appears
// as often or more often for the higher playing team than for her own team gets that higher level
// as her level determination. The tool does not know the playing history and cannot assess this,
// so this belongs with the verdict as a caveat, not as a condition.
//
// Audit final fix finding #3: the article has two halves. The first half (the level determination
// changes to the higher level) touches ground equal-or-lower, because there the player
// substitutes upward. The second half, the closing sentence "the player may subsequently no
// longer appear for lower playing teams", touches the grounds one-higher and fifth-class instead,
// because there the player substitutes downward and an earlier changed level determination can
// still forbid that appearance. Was: the caveat sat only at ground equal-or-lower. Like the
// caveats about articles 5.3.6 and 5.1.1 below, this one belongs to every allowed verdict, so to
// all three grounds.

test("caveat: article 5.3.4 appears at grounds equal-or-lower, one-higher and fifth-class", () => {
  const cases = [
    ["O16", "3e", "O16", "2e", "equal-or-lower"],
    ["O18", "1e", "O16", "1e", "one-higher"],
    ["O14", "5e", "O14", "6e", "fifth-class"],
  ];
  for (const [bc, bk, dc, dk, ground] of cases) {
    const r = check(bc, bk, dc, dk);
    assert.equal(r.ground, ground);
    assert.ok(r.caveats.some((k) => /5\.3\.4/.test(k)), `${ground}: caveat missing`);
    assert.ok(r.articles.includes("5.3.4"), `${ground}: article 5.3.4 missing`);
  }
});

test("caveat: article 5.3.4 is missing at ground too-high", () => {
  const r = check("O18", "2e", "O16", "3e");
  assert.equal(r.ground, "too-high");
  assert.ok(!r.caveats.some((k) => /5\.3\.4/.test(k)));
  assert.ok(!r.articles.includes("5.3.4"));
});

test("caveat: article 5.3.4 names both the change of the level determination and the ban on still playing for lower playing teams", () => {
  const r = check("O18", "1e", "O16", "1e");
  assert.equal(r.ground, "one-higher");
  const text = r.caveats.find((k) => /5\.3\.4/.test(k));
  assert.ok(text, "caveat missing");
  assert.match(text, /niveaubepaling/);
  assert.match(text, /niet meer.*lager spelende teams uitkomen/);
});

// Ticket #9: articles 5.3.6 and 5.3.6.1, deciding matches. During a deciding match only a player
// who already has an established level determination may substitute. The tool does not know the
// round, so this is a caveat with every allowed verdict, regardless of the ground.

test("caveat: articles 5.3.6 and 5.3.6.1 appear at grounds equal-or-lower, one-higher and fifth-class", () => {
  const cases = [
    ["O16", "3e", "O16", "2e", "equal-or-lower"],
    ["O18", "1e", "O16", "1e", "one-higher"],
    ["O14", "5e", "O14", "6e", "fifth-class"],
  ];
  for (const [bc, bk, dc, dk, ground] of cases) {
    const r = check(bc, bk, dc, dk);
    assert.equal(r.ground, ground);
    assert.ok(r.caveats.some((k) => /5\.3\.6/.test(k)), `${ground}: caveat missing`);
    assert.ok(r.articles.includes("5.3.6"), `${ground}: article 5.3.6 missing`);
    assert.ok(r.articles.includes("5.3.6.1"), `${ground}: article 5.3.6.1 missing`);
  }
});

test("caveat: articles 5.3.6 and 5.3.6.1 are missing at ground too-high", () => {
  const r = check("O18", "2e", "O16", "3e");
  assert.equal(r.ground, "too-high");
  assert.ok(!r.caveats.some((k) => /5\.3\.6/.test(k)));
  assert.ok(!r.articles.includes("5.3.6"));
  assert.ok(!r.articles.includes("5.3.6.1"));
});

// Ticket #10: article 5.1.1, appearing for different clubs. The tool does not know the pool
// division or the playing history of the player, so this is a caveat with every allowed verdict,
// regardless of the ground.

test("caveat: article 5.1.1 appears at grounds equal-or-lower, one-higher and fifth-class", () => {
  const cases = [
    ["O16", "3e", "O16", "2e", "equal-or-lower"],
    ["O18", "1e", "O16", "1e", "one-higher"],
    ["O14", "5e", "O14", "6e", "fifth-class"],
  ];
  for (const [bc, bk, dc, dk, ground] of cases) {
    const r = check(bc, bk, dc, dk);
    assert.equal(r.ground, ground);
    assert.ok(r.caveats.some((k) => /5\.1\.1/.test(k)), `${ground}: caveat missing`);
    assert.ok(r.articles.includes("5.1.1"), `${ground}: article 5.1.1 missing`);
  }
});

test("caveat: article 5.1.1 is missing at ground too-high", () => {
  const r = check("O18", "2e", "O16", "3e");
  assert.equal(r.ground, "too-high");
  assert.ok(!r.caveats.some((k) => /5\.1\.1/.test(k)));
  assert.ok(!r.articles.includes("5.1.1"));
});

// Review remark: the condition text of article 5.3.5.4 read awkwardly ("meerdere O14-teams op de
// ..."). Rephrased to "meerdere teams in de ...".

test("article 5.3.5.4: the condition text reads 'meerdere teams in de', not 'O14-teams op de'", () => {
  const preCompetition = check("O14", "top", "O14", "subtop");
  assert.ok(preCompetition.conditions.some((v) => /meerdere teams in de Topklasse of de Subtopklasse heeft/.test(v)));
  assert.ok(!preCompetition.conditions.some((v) => /O14-teams op de/.test(v)));

  const springCompetition = check("O14", "super", "O14", "idc");
  assert.ok(springCompetition.conditions.some((v) => /meerdere teams in de Super O14 of de IDC-O14 heeft/.test(v)));
  assert.ok(!springCompetition.conditions.some((v) => /O14-teams op de/.test(v)));
});

// Tickets #1 and #2: the grid kept conditions quiet. Ticket #1: three cells got the age label
// while their only condition came from article 5.3.5.4, a team list rule that has nothing to do
// with age. Ticket #2: 121 cells showed only the age requirement and kept the player-count
// requirement of article 5.3.5.2 quiet, because the age check ranked above the player-count
// check. This regression test walks over every borrower team and every lender team and pins down
// both errors.

// Mapping from condition text to requirement. overview() always passes date of birth null to
// assess(), so this covers exactly the conditions assessLevel can yield (assessAge does not run
// then). This is the reverse of the separate checks above: where those verify "requirement X
// implies condition text Y", the regression test below verifies "every condition text belongs to
// a requirement". Without that reversal a new kind of condition in rules.js could slip through
// the grid unnoticed without ever gaining a requirement, exactly as in tickets #1 and #2. When
// adding a condition in rules.js, add a line here that links the text to its requirement.
const CONDITION_TO_REQUIREMENT = [
  [/leeftijdsgrenzen van/, "age"],
  [/zijn de spelers van het eerste team hier zonder toestemming van de competitieleiding niet speelgerechtigd/, "first-team"],
  [/^Er mogen maximaal twee spelers invallen zonder toestemming van de competitieleiding\.$/, "max-two"],
  [/^Onduidelijk is of dit maximum altijd geldt/, "max-two"],
  [/heeft aantoonbaar maximaal \d+ spelers beschikbaar uit het eigen of een lager spelend niveau/, "player-count"],
  [/^Er zijn aantoonbaar geen invallers beschikbaar uit een gelijk of lager spelend niveau\.$/, "player-count"],
  [/^Er mogen maximaal twee spelers invallen, inclusief een vaste doelverdediger\.$/, "player-count"],
  [/^Voor het inlenen van een doelverdediger geldt de eis over het aantal eigen spelers niet\.$/, "player-count"],
];

test("regression: no cell hides a requirement, across all borrower and lender combinations", () => {
  let withPlayerCount = 0;
  let withAge = 0;
  let withFirstTeam = 0;
  for (const borrowerCategory of AGE_CATEGORIES) {
    for (const borrowerClass of CLASSES[borrowerCategory]) {
      const borrower = { category: borrowerCategory, classId: borrowerClass.id };
      for (const row of overview(borrower)) {
        for (const cell of row.cells) {
          if (!cell.exists) continue;
          const where = `${row.category} ${cell.classId} to ${borrowerCategory} ${borrowerClass.id}`;
          const outcome = assess({ category: row.category, classId: cell.classId }, borrower, null);

          // Ground one-higher implies the player-count requirement. This only holds because
          // overview() always passes date of birth null here: with a blocking date of birth the
          // same cell simply becomes "no" without requirements, see assess() where a blocking age
          // ignores the conditions from assessLevel. So this is not a general truth about ground
          // one-higher, but a property of the class grid without a date of birth.
          if (outcome.ground === "one-higher") {
            assert.ok(cell.requirements.includes("player-count"), `${where}: player-count requirement missing`);
            withPlayerCount += 1;
          }
          if (cell.requirements.includes("age")) {
            assert.ok(
              outcome.conditions.some((v) => /leeftijdsgrenzen van/.test(v)),
              `${where}: requirement age without an age condition`,
            );
            withAge += 1;
          }
          if (cell.requirements.includes("first-team")) {
            assert.ok(outcome.articles.includes("5.3.5.4"), `${where}: requirement first-team without article 5.3.5.4`);
            withFirstTeam += 1;
          }
          if (outcome.articles.includes("5.3.5.4") && cell.status === "free") {
            assert.ok(cell.requirements.includes("first-team"), `${where}: requirement first-team missing`);
          }

          // The reversal: every condition assess() returns here must appear in the mapping above
          // and the matching requirement must really be in cell.requirements.
          for (const condition of outcome.conditions) {
            const found = CONDITION_TO_REQUIREMENT.find(([regex]) => regex.test(condition));
            assert.ok(
              found,
              `${where}: condition without a mapping to a requirement: "${condition}"`,
            );
            const [, requirement] = found;
            assert.ok(
              cell.requirements.includes(requirement),
              `${where}: condition "${condition}" belongs to requirement ${requirement}, but that one is missing in the grid`,
            );
          }
        }
      }
    }
  }
  // The counters keep this test from quietly testing nothing if the grid ever runs empty.
  assert.ok(withPlayerCount > 0, "no cell with ground one-higher found");
  assert.ok(withAge > 0, "no cell with requirement age found");
  assert.ok(withFirstTeam > 0, "no cell with requirement first-team found");
});

// Caveats (articles 5.3.4, 5.3.6, 5.3.6.1 and 5.1.1) are not conditions and must therefore never
// yield a requirement in the grid. A cell at an equal or lower level within the same category
// does carry those caveats, but should simply stay empty.

test("caveats yield no requirement in the grid", () => {
  const rows = overview({ category: "O14", classId: "4e" });
  const o14 = rows.find((r) => r.category === "O14");
  const fifth = o14.cells.find((v) => v.classId === "5e");
  const outcome = assess({ category: "O14", classId: "5e" }, { category: "O14", classId: "4e" }, null);
  assert.ok(outcome.caveats.length > 0, "this cell should have caveats");
  assert.deepEqual(fifth.requirements, []);
});

// Review remark: the condition text at article 5.2.5 left out a nuance from the source text. The
// article speaks of trouble forming complete teams or good team compositions; the text named only
// complete teams.

test("article 5.2.5: the condition text also names the good team compositions", () => {
  const r = assessAge(
    { category: "O12", classId: "3e" },
    { category: "O11", classId: "3e" },
    d("2015-05-01"),
  );
  assert.ok(r.conditions.some((v) => /volledige teams of goede teamsamenstellingen/.test(v)));
  assert.ok(r.messages.some((m) => /volledige teams of goede teamsamenstellingen/.test(m)));
});

// Ticket #2: a cell where both the age limit and the full player-count requirement of article
// 5.3.5.2 applied showed only the age. A coach who checked the date of birth then thought it was
// allowed.

test("cellFromOutcome: borrower O11 1st class with lender O14 1st class carries player-count and age", () => {
  const cell = cellFor("O14", "1e", "O11", "1e");
  assert.equal(cell.status, "free");
  assert.deepEqual(cell.requirements, ["player-count", "age"]);
});

// Ticket #1: the only condition here comes from article 5.3.5.4, a team list rule that has
// nothing to do with age. The cell got the age label anyway.

test("cellFromOutcome: borrower O14 Topklasse with lender O14 Topklasse carries only first-team", () => {
  const cell = cellFor("O14", "top", "O14", "top");
  assert.equal(cell.status, "free");
  assert.deepEqual(cell.requirements, ["first-team"]);
  assert.ok(!cell.requirements.includes("age"));
});

test("cellFromOutcome: borrower O14 Subtopklasse with lender O14 Topklasse carries player-count and first-team", () => {
  const cell = cellFor("O14", "top", "O14", "subtop");
  assert.equal(cell.status, "free");
  assert.deepEqual(cell.requirements, ["player-count", "first-team"]);
});

// The second level group of article 5.3.5.4 (lentecompetitie: Super O14 and IDC-O14) does not
// reach the grid: Super O14 always falls under category I and IDC-O14 until the winter break, so
// assess() gets no further than out-of-scope there. The derivation of first-team looks at the
// article and not at a fixed list of classes, so it works as soon as those classes do come within
// scope.

test("cellFromOutcome: the lentecompetitie group of article 5.3.5.4 falls out of scope", () => {
  const cell = cellFor("O14", "super", "O14", "idc");
  assert.equal(cell.status, "out-of-scope");
  assert.deepEqual(cell.requirements, []);
  const classId = assessLevel({ category: "O14", classId: "super" }, { category: "O14", classId: "idc" });
  assert.ok(classId.articles.includes("5.3.5.4"), "the class check does know the level group");
});

test("cellFromOutcome: an ordinary equal-or-lower case gets status free without requirements", () => {
  const cell = cellFor("O14", "5e", "O14", "4e");
  assert.equal(cell.status, "free");
  assert.deepEqual(cell.requirements, []);
});

// Ticket #3: was "doel O14 5e klasse met bron O14 6e klasse draagt max2". That lender plays lower
// than the borrower, so since ticket #3 that falls under article 5.3.5.1 (ground equal-or-lower)
// and no longer carries max-two. Lender and borrower are swapped here, so that the lender plays
// higher than the borrower again and the original purpose of the test (checking the requirement
// max-two) stands.
test("cellFromOutcome: borrower O14 6th class with lender O14 5th class carries max-two", () => {
  const cell = cellFor("O14", "5e", "O14", "6e");
  assert.equal(cell.status, "free");
  assert.deepEqual(cell.requirements, ["max-two"]);
});

test("cellFromOutcome: borrower O14 5th class with lender O14 6th class (lender lower) carries no max-two", () => {
  const cell = cellFor("O14", "6e", "O14", "5e");
  assert.equal(cell.status, "free");
  assert.deepEqual(cell.requirements, []);
});

test("cellFromOutcome: status no and out-of-scope never carry requirements", () => {
  const noCell = cellFor("O14", "1e", "O14", "4e");
  assert.equal(noCell.status, "no");
  assert.deepEqual(noCell.requirements, []);

  const outOfScope = cellFor("O16", "subtop", "O14", "4e");
  assert.equal(outOfScope.status, "out-of-scope");
  assert.deepEqual(outOfScope.requirements, []);
});

test("cellFromOutcome: the requirements are always in the fixed order player-count, age, first-team, max-two", () => {
  const order = ["player-count", "age", "first-team", "max-two"];
  for (const borrowerCategory of AGE_CATEGORIES) {
    for (const borrowerClass of CLASSES[borrowerCategory]) {
      for (const lenderCategory of AGE_CATEGORIES) {
        for (const lenderClass of CLASSES[lenderCategory]) {
          const cell = cellFor(lenderCategory, lenderClass.id, borrowerCategory, borrowerClass.id);
          const positions = cell.requirements.map((requirement) => order.indexOf(requirement));
          assert.deepEqual(positions, [...positions].sort((a, b) => a - b));
          assert.ok(!positions.includes(-1), `unknown requirement in ${JSON.stringify(cell.requirements)}`);
        }
      }
    }
  }
});
