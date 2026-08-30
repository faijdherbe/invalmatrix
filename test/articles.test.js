import { test } from "node:test";
import assert from "node:assert/strict";
import { ARTICLES } from "../articles.js";
import { WANTED, readLines, extract } from "../tools/extract-articles.mjs";

test("articles.js contains every requested article", () => {
  for (const number of WANTED) {
    assert.ok(ARTICLES[number], `article ${number} is missing`);
    assert.ok(ARTICLES[number].text.length > 0, `article ${number} is empty`);
  }
});

test("every article text still matches the Bondsreglement word for word", () => {
  const fresh = extract(readLines());
  for (const number of WANTED) {
    assert.equal(ARTICLES[number].text, fresh[number].text, `article ${number} differs from the PDF`);
    assert.equal(ARTICLES[number].title, fresh[number].title, `title of ${number} differs`);
  }
});

test("the articles the rule logic names are all included", () => {
  for (const number of [
    "3.1.1",
    "3.1.3",
    "5.1.1",
    "5.2.4",
    "5.3.4",
    "5.3.5.1",
    "5.3.5.2",
    "5.3.5.3",
    "5.3.6",
    "5.3.6.1",
  ]) {
    assert.ok(ARTICLES[number], `article ${number} is named but not included`);
  }
});

// Ticket #8, #9 and #10: these three articles can flip the answer but were missing from the
// extraction entirely. An explicit test next to the generic WANTED tests above, so it is clear
// which three articles this task adds.
test("article 5.3.6, 5.3.6.1 and 5.1.1 are in ARTICLES with a non-empty text", () => {
  for (const number of ["5.3.6", "5.3.6.1", "5.1.1"]) {
    assert.ok(ARTICLES[number], `article ${number} is missing`);
    assert.ok(ARTICLES[number].text.length > 0, `article ${number} is empty`);
  }
});

test("the article text does not start with a leftover of its own title", () => {
  // When a title spans multiple lines in the PDF and the heading regex misses a continuation
  // line, that piece of title ends up as the first line of the text. Such a piece is (after
  // stripping redundant spaces) always the tail of the title, whereas the real article text
  // is a sentence of its own that does not match it. Works for every article, not just 5.3.3.
  for (const number of WANTED) {
    const article = ARTICLES[number];
    const firstLine = article.text.split("\n")[0].replace(/\s+/g, " ").trim().toLowerCase();
    const title = article.title.replace(/\s+/g, " ").trim().toLowerCase();
    const isTitleLeftover = firstLine.length > 1 && title.endsWith(firstLine);
    assert.ok(
      !isTitleLeftover,
      `article ${number}: first line of the text ("${article.text.split("\n")[0]}") looks like a leftover of the title`
    );
  }
});
