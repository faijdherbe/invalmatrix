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
  assert.match(heading, /--grey/);
});
