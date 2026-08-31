import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

// Reads the page and the README as plain text. Ticket #24: a tab, a bookmark, a search result and
// a shared link must say what this is about. That means naming the sport and the association, and
// it means not opening with the association, because the page is not a product of the KNHB and the
// footer says so in so many words.
const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
const readme = readFileSync(new URL("../README.md", import.meta.url), "utf8");

function tagContent(source, tag) {
  const match = source.match(new RegExp(`<${tag}[^>]*>([^<]*)</${tag}>`));
  return match ? match[1].trim() : null;
}

test("the title names both field hockey and the KNHB", () => {
  const title = tagContent(html, "title");
  assert.ok(title, "no title tag found");
  assert.match(title, /veldhockey/i);
  assert.match(title, /KNHB/);
});

test("the title does not open with the KNHB, so it does not read as their product", () => {
  const title = tagContent(html, "title");
  assert.ok(!/^KNHB/.test(title), title);
  assert.ok(!/officiele/i.test(title), title);
});

test("the heading names both field hockey and the KNHB", () => {
  const heading = tagContent(html, "h1");
  assert.ok(heading, "no h1 found");
  assert.match(heading, /veldhockey/i);
  assert.match(heading, /KNHB/);
});

test("there is a meta description that names the KNHB", () => {
  const match = html.match(/<meta\s+name="description"\s+content="([^"]*)"/);
  assert.ok(match, "no meta description found");
  assert.match(match[1], /KNHB/);
  assert.ok(match[1].length > 60, "the description is too short to be useful in a link preview");
});

test("the first heading of the README names both field hockey and the KNHB", () => {
  const heading = readme.split("\n").find((line) => line.startsWith("# "));
  assert.ok(heading, "no first level heading found in README.md");
  assert.match(heading, /veldhockey/i);
  assert.match(heading, /KNHB/);
});

test("the page asks in which period the match is played, before the team question", () => {
  const period = html.indexOf('id="period"');
  const category = html.indexOf('id="borrower-category"');
  assert.ok(period > -1, "no select with id period found");
  assert.ok(period < category, "the period choice must come before the team choice");
  assert.match(html, /Wanneer wordt de wedstrijd gespeeld\?/);
});

test("there is a place for the message about an incomplete choice", () => {
  assert.match(html, /id="missing-choices"/);
});

test("the page holds no hard preselected age category or class", () => {
  const appJs = readFileSync(new URL("../app.js", import.meta.url), "utf8");
  assert.ok(!/borrowerCategory\.value = "/.test(appJs));
  assert.ok(!/borrowerClass\.value = "/.test(appJs));
});
