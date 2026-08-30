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

test("de artikeltekst begint niet met een restje van de eigen titel", () => {
  // Als een titel in de PDF over meerdere regels loopt en de kopregex mist een vervolgregel,
  // belandt dat stukje titel als eerste regel in de tekst. Zo'n stukje is (na het wegnemen
  // van overtollige spaties) altijd het slot van de titel, terwijl de echte artikeltekst
  // een eigen zin is die daar niet mee overeenkomt. Werkt voor elk artikel, niet alleen 5.3.3.
  for (const nummer of GEWENST) {
    const artikel = ARTIKELEN[nummer];
    const eersteRegel = artikel.tekst.split("\n")[0].replace(/\s+/g, " ").trim().toLowerCase();
    const titel = artikel.titel.replace(/\s+/g, " ").trim().toLowerCase();
    const isTitelrestje = eersteRegel.length > 1 && titel.endsWith(eersteRegel);
    assert.ok(
      !isTitelrestje,
      `artikel ${nummer}: eerste regel van de tekst ("${artikel.tekst.split("\n")[0]}") lijkt een restje van de titel te zijn`
    );
  }
});
