import { test } from "node:test";
import assert from "node:assert/strict";
import { ARTIKELEN } from "../articles.js";
import { GEWENST, leesRegels, extraheer } from "../tools/extract-articles.mjs";

test("articles.js bevat elk gevraagd artikel", () => {
  for (const nummer of GEWENST) {
    assert.ok(ARTIKELEN[nummer], `artikel ${nummer} ontbreekt`);
    assert.ok(ARTIKELEN[nummer].tekst.length > 0, `artikel ${nummer} is leeg`);
  }
});

test("elke artikeltekst is nog woordelijk gelijk aan het Bondsreglement", () => {
  const vers = extraheer(leesRegels());
  for (const nummer of GEWENST) {
    assert.equal(ARTIKELEN[nummer].tekst, vers[nummer].tekst, `artikel ${nummer} wijkt af van de PDF`);
    assert.equal(ARTIKELEN[nummer].titel, vers[nummer].titel, `titel van ${nummer} wijkt af`);
  }
});

test("de artikelen die de regellogica noemt zijn allemaal opgenomen", () => {
  for (const nummer of ["3.1.1", "3.1.3", "5.2.4", "5.3.5.1", "5.3.5.2", "5.3.5.3"]) {
    assert.ok(ARTIKELEN[nummer], `artikel ${nummer} wordt genoemd maar is niet opgenomen`);
  }
});
