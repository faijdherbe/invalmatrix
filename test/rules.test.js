import { test } from "node:test";
import assert from "node:assert/strict";
import { CLASSES, REFERENCE_DATE, COLUMNS, AGE_CATEGORIES, PERIODS, CATEGORY_I_UNTIL } from "../data.js";
import {
  level,
  assessLevel,
  categoryINotice,
  periodCategoryIClasses,
  periodLabel,
  ageOnReferenceDate,
  assessAge,
  formatDateDutch,
  assess,
  overview,
  cellFromOutcome,
} from "../rules.js";
import { UNCERTAINTIES } from "../uncertainties.js";

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
// apply there by definition. And since this task the doubt about the maximum is no longer a
// condition either: it was never something a team could meet, so it moved to uncertainties.js as
// ticket #13. What stays here is the condition itself and the article; the ticket is checked
// through assess() below, because check() calls assessLevel and that knows nothing of tickets.
test("article 5.3.5.3: the conditions name the maximum, and the doubt about it is uncertainty #13", () => {
  const r = check("O14", "5e", "O14", "6e");
  assert.equal(r.ground, "fifth-class");
  assert.ok(!r.conditions.some((v) => /elf of meer eigen spelers/.test(v)), JSON.stringify(r.conditions));
  assert.ok(r.conditions.some((v) => /competitieleiding/.test(v)));
  assert.ok(!r.conditions.some((v) => /5\.3\.5\.1/.test(v)));

  const outcome = assess({ category: "O14", classId: "5e" }, { category: "O14", classId: "6e" }, null);
  assert.ok(outcome.uncertainties.map((u) => u.ticket).includes(13));
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

// Twelve combinations from articles 5.3.5.1 up to and including 5.3.5.3 and the class boundaries
// table, kept together as regression cover: they touch every ground once and cross the age
// category boundary in both directions.
test("twelve combinations from the articles and the class boundaries table keep their outcome", () => {
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

// The old expectation here was that IDC-O14 is category I until the winter break. That is a
// statement chapter 2 does not make: it names IDC-O14 nowhere in the category I list and only says
// that it falls under category II from the winter break on. The notice therefore no longer claims
// a category, see the design of 31 August 2026.
test("IDC-O14 gets no verdict without a chosen period, and the notice claims no category", () => {
  const notice = categoryINotice({ category: "O14", classId: "idc" });
  assert.match(notice, /vanaf de winterstop/);
  assert.match(notice, /geen uitspraak/);
  // Use negative lookahead to avoid matching "onder categorie II" when testing for category I.
  assert.doesNotMatch(notice, /onder categorie I(?!I)/);
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
    assert.doesNotMatch(notice, /onder categorie I(?!I)/);
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

test("periodCategoryIClasses names the switching classes that are category I in that period, and marks IDC-O14 as contested", () => {
  assert.deepEqual(periodCategoryIClasses("early"), [
    { category: "O14", classId: "idc", contested: true },
    { category: "O16", classId: "subtop", contested: false },
    { category: "O18", classId: "subtop", contested: false },
  ]);
  assert.deepEqual(periodCategoryIClasses("mid"), [
    { category: "O14", classId: "idc", contested: true },
    { category: "O16", classId: "subtop", contested: false },
  ]);
  assert.deepEqual(periodCategoryIClasses("late"), []);
});

// Ticket for finding 1 of the whole-branch review: a bad or renamed period id used to make
// periodIndex return -1, which sorts before every real period index and silently turns a category
// I class into category II in every period. periodIndex now throws instead, and this is the guard
// against a silent regression on that.
test("periodLabel throws on an unknown period id instead of echoing it into the text", () => {
  assert.equal(periodLabel("early"), "voorcompetitie tot en met de herfstvakantie");
  assert.throws(() => periodLabel("nonsense"), /unknown period id/);
  assert.throws(() => periodLabel(null), /unknown period id/);
});

test("every entry in CATEGORY_I_UNTIL has a real until, a phrase, and a fromPhrase when contested", () => {
  const ids = PERIODS.map((p) => p.id);
  for (const category of Object.keys(CATEGORY_I_UNTIL)) {
    for (const classId of Object.keys(CATEGORY_I_UNTIL[category])) {
      const entry = CATEGORY_I_UNTIL[category][classId];
      assert.ok(ids.includes(entry.until), `${category} ${classId} has until "${entry.until}", not a PERIODS id`);
      assert.equal(typeof entry.phrase, "string", `${category} ${classId} has no string phrase`);
      assert.ok(entry.phrase.length > 0, `${category} ${classId} has an empty phrase`);
      // Without this, a contested entry with no fromPhrase would render "undefined" straight into
      // the sentence categoryINotice builds for it (rules.js), the same species of bug periodLabel
      // above was hardened against.
      if (entry.contested) {
        assert.equal(typeof entry.fromPhrase, "string", `${category} ${classId} is contested but has no string fromPhrase`);
        assert.ok(entry.fromPhrase.length > 0, `${category} ${classId} is contested but has an empty fromPhrase`);
      }
    }
  }
});

test("categoryINotice throws on an unknown period id instead of silently treating it as past every boundary", () => {
  const team = { category: "O18", classId: "subtop" };
  assert.throws(() => categoryINotice(team, "typo-period"));
});

test("categoryINotice does not throw when no period is chosen", () => {
  const team = { category: "O18", classId: "subtop" };
  assert.doesNotThrow(() => categoryINotice(team, null));
  assert.doesNotThrow(() => categoryINotice(team));
});

test("periodCategoryIClasses names them all without a chosen period, because every period is still possible", () => {
  assert.equal(periodCategoryIClasses(null).length, 3);
});

test("periodCategoryIClasses does not name the fixed category I classes, those are not switching", () => {
  const all = ["early", "mid", "late", null].flatMap((p) => periodCategoryIClasses(p));
  assert.ok(!all.some((c) => c.classId === "super" || c.classId === "landelijk"));
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

test("a player who is too young for her own category no longer blocks with an equal lender", () => {
  // Ticket #22: this used to block. The player is on a team list in exactly the borrower
  // category, which the competition management can only have done under article 3.1.3, so that
  // assessment already stands and the tool must not repeat it with a different answer.
  const r = assessAge(
    { category: "O14", classId: "3e" },
    { category: "O14", classId: "4e" },
    d("2016-05-01"),
  );
  assert.equal(r.blocks, false);
  assert.ok(r.messages.some((m) => /dispensatie/.test(m)));
});

test("a player who is too young for her own category is a dispensation case with an older lender", () => {
  const r = assessAge(
    { category: "O16", classId: "3e" },
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

test("uncertainty #15: an equal age category yields nothing about a younger category", () => {
  // Was: no caveat matching /jongere leeftijdscategorie/. That text is now uncertainty #15, so
  // this checks the same thing one level up.
  const r = assess({ category: "O16", classId: "2e" }, { category: "O16", classId: "2e" }, null);
  assert.ok(!r.uncertainties.map((u) => u.ticket).includes(15));
});

test("uncertainty #15: an older lender yields nothing about a younger category", () => {
  // Was: no caveat matching /jongere leeftijdscategorie/. See the previous test for why this now
  // goes through assess().
  const r = assess({ category: "O18", classId: "3e" }, { category: "O16", classId: "2e" }, null);
  assert.ok(!r.uncertainties.map((u) => u.ticket).includes(15));
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
// The line about "Onduidelijk is of dit maximum altijd geldt" stood here until this task. It was
// never a condition a team could meet, but uncertainty about article 5.3.5.3 itself, and it now
// lives in uncertainties.js as ticket #13.
const CONDITION_TO_REQUIREMENT = [
  [/leeftijdsgrenzen van/, "age"],
  [/zijn de spelers van het eerste team hier zonder toestemming van de competitieleiding niet speelgerechtigd/, "first-team"],
  [/^Er mogen maximaal twee spelers invallen zonder toestemming van de competitieleiding\.$/, "max-two"],
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

test("article 5.3.5.1 is named when the verdict is no across an age category boundary", () => {
  // Ticket #21: article 5.3.5.2 says "at most one class higher" but does not say how to count a
  // class across an age category boundary. That counting rule lives in article 5.3.5.1, so it
  // belongs in the list here too.
  const r = check("O14", "top", "O11", "1e");
  assert.equal(r.ground, "too-high");
  assert.ok(r.articles.includes("5.3.5.1"));
});

test("article 5.3.5.1 is named on ground one-higher across an age category boundary", () => {
  const r = check("O18", "2e", "O16", "2e");
  assert.equal(r.ground, "one-higher");
  assert.ok(r.articles.includes("5.3.5.1"));
});

test("the reasoning counts the age categories when the lender is younger", () => {
  // Article 5.3.5.1, second bullet: a team from a lower age category may play at most one class
  // higher, and per extra age category one class is added. O14 and O18 are two steps apart.
  const r = check("O14", "1e", "O18", "3e");
  const line = r.reasoning.find((v) => /leeftijdscategorie/.test(v));
  assert.ok(line, "no reasoning line about age categories");
  assert.ok(/2 leeftijdscategorieen/.test(line), line);
  assert.ok(/per extra leeftijdscategorie een klasse bij komt/.test(line), line);
});

test("one step apart does not claim an extra class", () => {
  const r = check("O12", "1e", "O14", "2e");
  const line = r.reasoning.find((v) => /leeftijdscategorie/.test(v));
  assert.ok(line, "no reasoning line about age categories");
  assert.ok(/1 leeftijdscategorie\b/.test(line), line);
  assert.ok(!/bij komt/.test(line), line);
});

test("the reasoning counts nothing when the lender is older", () => {
  // The third bullet of article 5.3.5.1 names no increase per age category. Whether it applies in
  // that direction too is the open question of ticket #12, so no number is written out here.
  const r = check("O18", "3e", "O16", "3e");
  const line = r.reasoning.find((v) => /Het uitlenende team speelt in een hogere/.test(v));
  assert.ok(line, "no reasoning line about the older lender");
  assert.ok(!/leeftijdscategorieen\./.test(line), line);
  assert.ok(!/bij komt/.test(line), line);
});

test("ground fifth-class keeps its articles unchanged", () => {
  // Ticket #3 deliberately removed 5.3.5.1 here, and this ground only applies within the same age
  // category, so there is no boundary to cross.
  const r = check("O14", "5e", "O14", "6e");
  assert.equal(r.ground, "fifth-class");
  assert.ok(!r.articles.includes("5.3.5.1"));
});

test("within the same age category no reasoning line about age categories appears", () => {
  const r = check("O14", "2e", "O14", "3e");
  assert.ok(!r.reasoning.some((v) => /leeftijdscategorie/.test(v)));
});

// Ticket #11 is open: whether O11 and O12 count as one age category apart or as the same level.
// LEVELS in data.js gives them the identical ladder, so the class boundaries table applies no
// class shift between them, while AGE_CATEGORY_ORDER counts them one step apart. Printing the
// age category sentence there contradicts the verdict right next to it (see the older-lender and
// younger-lender examples below), and commits the page to one side of ticket #11. The fix must
// say nothing on these combinations, determined generically from the data rather than
// hard-coded to O11/O12.
test("no age category sentence on O12 1e to O11 1e, even though the verdict crosses the boundary", () => {
  const r = check("O12", "1e", "O11", "1e");
  assert.equal(r.ground, "equal-or-lower");
  assert.ok(
    !r.reasoning.some((v) => /Het uitlenende team speelt in een hogere leeftijdscategorie/.test(v)),
    JSON.stringify(r.reasoning),
  );
});

test("no age category sentence on O11 1e to O12 2e, even though the verdict crosses the boundary", () => {
  const r = check("O11", "1e", "O12", "2e");
  assert.equal(r.ground, "one-higher");
  assert.ok(
    !r.reasoning.some((v) => /een team uit een lagere leeftijdscategorie maximaal een klasse hoger/.test(v)),
    JSON.stringify(r.reasoning),
  );
});

test("a real age category boundary such as O14 1e to O18 3e still gets its sentence", () => {
  const r = check("O14", "1e", "O18", "3e");
  assert.ok(
    r.reasoning.some((v) => /een team uit een lagere leeftijdscategorie maximaal een klasse hoger/.test(v)),
    "the O11/O12 fix must not suppress a real boundary such as O14 to O18",
  );
});

test("ground equal-or-lower between O11 and O12 still names article 5.3.5.1", () => {
  const r = check("O11", "1e", "O12", "1e");
  assert.equal(r.ground, "equal-or-lower");
  assert.ok(r.articles.includes("5.3.5.1"));
});

test("every article appears at most once in the list of assessLevel", () => {
  for (const lenderCategory of AGE_CATEGORIES) {
    for (const lenderClass of CLASSES[lenderCategory].map((k) => k.id)) {
      for (const borrowerCategory of AGE_CATEGORIES) {
        for (const borrowerClass of CLASSES[borrowerCategory].map((k) => k.id)) {
          const r = check(lenderCategory, lenderClass, borrowerCategory, borrowerClass);
          assert.equal(
            new Set(r.articles).size,
            r.articles.length,
            `${lenderCategory} ${lenderClass} to ${borrowerCategory} ${borrowerClass}`,
          );
        }
      }
    }
  }
});

test("a player already in the borrower category is not blocked on the lower age limit", () => {
  // Ticket #22: an eleven year old can only be on an O14 team list when the competition
  // management placed her there (article 3.1.3), so that assessment has already been made. The
  // tool must not make it again and come to a different answer.
  const outcome = assess(
    { category: "O14", classId: "5e" },
    { category: "O14", classId: "5e" },
    d("2015-08-20"),
  );
  assert.equal(outcome.verdict, "allowed");
});

test("the same player is allowed from a younger category too, and the answers match", () => {
  const fromO12 = assess({ category: "O12", classId: "5e" }, { category: "O14", classId: "5e" }, d("2015-08-20"));
  const fromO14 = assess({ category: "O14", classId: "5e" }, { category: "O14", classId: "5e" }, d("2015-08-20"));
  assert.equal(fromO12.verdict, "allowed");
  assert.equal(fromO14.verdict, fromO12.verdict);
});

test("the age explanation points at the dispensation of article 3.1.3", () => {
  const outcome = assessAge(
    { category: "O14", classId: "5e" },
    { category: "O14", classId: "5e" },
    d("2015-08-20"),
  );
  assert.equal(outcome.blocks, false);
  const line = outcome.messages.find((v) => /3\.1\.3/.test(v));
  assert.ok(line, "no message about article 3.1.3");
  assert.ok(/ondergrens/.test(line), line);
  assert.ok(outcome.articles.includes("3.1.3"));
});

test("an older lender with a player under the lower limit keeps blocking", () => {
  // Whether a dispensation for O16 also makes her eligible in O14 is nowhere in the regulations.
  // CLAUDE.md then prescribes the conservative side, so this stays no until the KNHB answers.
  const outcome = assess(
    { category: "O16", classId: "5e" },
    { category: "O14", classId: "5e" },
    d("2015-08-20"),
  );
  assert.equal(outcome.verdict, "not-allowed");
});

test("too old within the same age category keeps blocking", () => {
  // Article 5.2.4 does say in so many words that those players may only appear for their own team.
  // For too young no comparable provision exists, which is why the two differ.
  const outcome = assessAge(
    { category: "O12", classId: "1e" },
    { category: "O12", classId: "1e" },
    d("2013-08-20"),
  );
  assert.equal(outcome.blocks, true);
});

test("a player within the limits gets no dispensation note", () => {
  const outcome = assessAge(
    { category: "O14", classId: "5e" },
    { category: "O14", classId: "5e" },
    d("2013-08-20"),
  );
  assert.equal(outcome.blocks, false);
  assert.ok(!outcome.messages.some((v) => /3\.1\.3/.test(v)));
});

// Ticket #34 group: the open uncertainties of the Bondsreglement must reach the page, so a coach
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

// The context the predicates in uncertainties.js read is built in two places: test/uncertainties
// .test.js makes its own copy, and uncertaintyContext() in rules.js builds the real one. Those two
// can drift apart without a single test noticing, so this walks every uncertainty through assess()
// once. A field uncertaintyContext forgets to fill shows up here as a ticket that never fires.
const TICKET_THROUGH_ASSESS = [
  { ticket: 11, lender: { category: "O11", classId: "1e" }, borrower: { category: "O12", classId: "1e" }, periodId: "mid", dateOfBirth: null },
  { ticket: 12, lender: { category: "O18", classId: "3e" }, borrower: { category: "O14", classId: "1e" }, periodId: "mid", dateOfBirth: null },
  { ticket: 13, lender: { category: "O14", classId: "5e" }, borrower: { category: "O14", classId: "6e" }, periodId: "mid", dateOfBirth: null },
  { ticket: 14, lender: { category: "O16", classId: "5e" }, borrower: { category: "O14", classId: "6e" }, periodId: "mid", dateOfBirth: null },
  { ticket: 15, lender: { category: "O14", classId: "1e" }, borrower: { category: "O18", classId: "3e" }, periodId: "mid", dateOfBirth: null },
  { ticket: 16, lender: { category: "O14", classId: "3e" }, borrower: { category: "O14", classId: "4e" }, periodId: "mid", dateOfBirth: d("2012-05-01") },
  { ticket: 17, lender: { category: "O12", classId: "1e" }, borrower: { category: "O11", classId: "1e" }, periodId: "mid", dateOfBirth: d("2015-05-01") },
  { ticket: 18, lender: { category: "O14", classId: "top" }, borrower: { category: "O14", classId: "2e" }, periodId: "mid", dateOfBirth: null },
  { ticket: 19, lender: { category: "O14", classId: "idc" }, borrower: { category: "O14", classId: "2e" }, periodId: "early", dateOfBirth: null },
  { ticket: 27, lender: { category: "O14", classId: "super" }, borrower: { category: "O14", classId: "2e" }, periodId: "mid", dateOfBirth: null },
  { ticket: 28, lender: { category: "O16", classId: "subtop" }, borrower: { category: "O16", classId: "2e" }, periodId: "mid", dateOfBirth: null },
  { ticket: 29, lender: { category: "O18", classId: "subtop" }, borrower: { category: "O18", classId: "2e" }, periodId: "mid", dateOfBirth: null },
  { ticket: 30, lender: { category: "O18", classId: "landelijk" }, borrower: { category: "O18", classId: "2e" }, periodId: "mid", dateOfBirth: null },
  { ticket: 32, lender: { category: "O18", classId: "subtop" }, borrower: { category: "O18", classId: "2e" }, periodId: "early", dateOfBirth: null },
];

test("every uncertainty is reachable through assess, so the real context matches the predicates", () => {
  for (const row of TICKET_THROUGH_ASSESS) {
    const outcome = assess(row.lender, row.borrower, row.dateOfBirth, row.periodId);
    const found = outcome.uncertainties.map((u) => u.ticket);
    const where = `${row.lender.category} ${row.lender.classId} to ${row.borrower.category} ${row.borrower.classId} in ${row.periodId}`;
    assert.ok(found.includes(row.ticket), `ticket ${row.ticket} not reachable at ${where}, got ${found}`);
  }
});

test("the walk-through above covers every uncertainty there is", () => {
  const walked = [...new Set(TICKET_THROUGH_ASSESS.map((row) => row.ticket))].sort((a, b) => a - b);
  assert.deepEqual(walked, UNCERTAINTIES.map((u) => u.ticket));
});

// Ticket #16 was open on this: the tool only warned once article 5.2.4 turned up in the age
// assessment, and rules.js only reaches for that article from the 2nd class down. A lender in
// the 1st class got no warning at all, even though such a player can only be there with
// dispensation. oneYearOverLenderLimit in uncertaintyContext() is class-independent on purpose,
// so the warning now fires regardless of the lender's class.
test("#16 fires for a player one year over the limit whether the lender plays 1st or 3rd class", () => {
  const borrower = { category: "O16", classId: "2e" };
  const overAge = d("2012-05-01");
  const fromFirstClass = assess({ category: "O14", classId: "1e" }, borrower, overAge, "mid");
  const fromThirdClass = assess({ category: "O14", classId: "3e" }, borrower, overAge, "mid");
  assert.ok(fromFirstClass.uncertainties.map((u) => u.ticket).includes(16), JSON.stringify(fromFirstClass.uncertainties));
  assert.ok(fromThirdClass.uncertainties.map((u) => u.ticket).includes(16), JSON.stringify(fromThirdClass.uncertainties));
});

test("#16 does not fire for a player who sits neatly within her own category's limits", () => {
  const r = assess({ category: "O14", classId: "1e" }, { category: "O16", classId: "2e" }, d("2013-05-01"), "mid");
  assert.ok(!r.uncertainties.map((u) => u.ticket).includes(16), JSON.stringify(r.uncertainties));
});

// The two gaps the whole-branch review found: a verdict that rests on an open reading of the
// reglement while the page said nothing at all. A "nee" or an unconditional "ja" without a warning
// is worse than no promise, because the tickets #11 and #16 name these exact cases themselves.
test("O11 1e to O14 4e is a nee that must name uncertainty #11", () => {
  const r = assess({ category: "O11", classId: "1e" }, { category: "O14", classId: "4e" }, null, "mid");
  assert.equal(r.verdict, "not-allowed");
  assert.ok(r.uncertainties.map((u) => u.ticket).includes(11), JSON.stringify(r.uncertainties));
});

test("a player one year over the limit from a 1st class team must name uncertainty #16", () => {
  const r = assess({ category: "O14", classId: "1e" }, { category: "O16", classId: "2e" }, d("2012-05-01"), "mid");
  assert.ok(r.uncertainties.map((u) => u.ticket).includes(16), JSON.stringify(r.uncertainties));
});
