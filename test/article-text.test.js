import { test } from "node:test";
import assert from "node:assert/strict";
import { ARTICLES } from "../articles.js";
import { WANTED } from "../tools/extract-articles.mjs";
import { toBlocks } from "../article-text.js";

// Pulls the words out of the source text, with only the bullet characters themselves (• or a
// lone "o" as a list marker) left out. That lets us compare whether toBlocks() drops any
// content, without retyping the internal regex of toBlocks().
function wordsFromSource(text) {
  return text
    .split("\n")
    .map((line) => line.trim().replace(/^[•o]\s+/, ""))
    .join(" ")
    .split(/\s+/)
    .filter(Boolean);
}

function wordsFromBlocks(blocks) {
  return blocks
    .map((block) => block.text)
    .join(" ")
    .split(/\s+/)
    .filter(Boolean);
}

test("toBlocks drops no words and keeps the order, for all articles", () => {
  for (const number of WANTED) {
    const article = ARTICLES[number];
    const blocks = toBlocks(article.text);
    const expected = wordsFromSource(article.text);
    const actual = wordsFromBlocks(blocks);
    assert.deepEqual(actual, expected, `article ${number}: words do not match`);
  }
});

test("a paragraph spanning several source lines ends up in one block without line breaks", () => {
  // The closing paragraph of 3.1.1 spans 4 lines in the source.
  const blocks = toBlocks(ARTICLES["3.1.1"].text);
  const last = blocks[blocks.length - 1];
  assert.equal(last.kind, "paragraph");
  assert.ok(!last.text.includes("\n"), "block still contains a line break");
  assert.ok(last.text.startsWith("Competities voor juniorenteams"));
  assert.ok(last.text.endsWith("vastgesteld."));
});

test("article 5.3.5.2 yields exactly three list items", () => {
  const blocks = toBlocks(ARTICLES["5.3.5.2"].text);
  const items = blocks.filter((block) => block.kind === "item");
  assert.equal(items.length, 3);
  for (const item of items) {
    assert.equal(item.level, 1);
  }
});

test("the examples under the items of 5.3.5.1 get a deeper level than the items themselves", () => {
  const blocks = toBlocks(ARTICLES["5.3.5.1"].text);
  const items = blocks.filter((block) => block.kind === "item");
  const level1 = items.filter((item) => item.level === 1);
  const level2 = items.filter((item) => item.level === 2);
  assert.equal(level1.length, 3, "three main items expected");
  assert.equal(level2.length, 6, "six examples expected");
  for (const example of level2) {
    assert.ok(example.text.startsWith("Voorbeeld:"));
    assert.ok(example.level > level1[0].level);
  }
});

test("article 3.1.1 yields the right number of age limit items", () => {
  // The source text has 10 bullets: O18, O16, O14, O12, O11, O10, O9, O8, O7 and O6.
  const blocks = toBlocks(ARTICLES["3.1.1"].text);
  const items = blocks.filter((block) => block.kind === "item");
  assert.equal(items.length, 10);
  for (const item of items) {
    assert.equal(item.level, 1);
  }
});
