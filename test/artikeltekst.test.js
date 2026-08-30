import { test } from "node:test";
import assert from "node:assert/strict";
import { ARTIKELEN } from "../articles.js";
import { GEWENST } from "../tools/extract-articles.mjs";
import { naarBlokken } from "../artikeltekst.js";

// Haalt de woorden uit de brontekst, met alleen de bullet-tekens zelf (• of een losse "o"
// als opsommingsteken) weggelaten. Zo kunnen we vergelijken of naarBlokken() geen inhoud
// laat vallen, zonder de interne regex van naarBlokken() over te typen.
function woordenUitBron(tekst) {
  return tekst
    .split("\n")
    .map((regel) => regel.trim().replace(/^[•o]\s+/, ""))
    .join(" ")
    .split(/\s+/)
    .filter(Boolean);
}

function woordenUitBlokken(blokken) {
  return blokken
    .map((blok) => blok.tekst)
    .join(" ")
    .split(/\s+/)
    .filter(Boolean);
}

test("naarBlokken laat geen woorden weg en behoudt de volgorde, voor alle artikelen", () => {
  for (const nummer of GEWENST) {
    const artikel = ARTIKELEN[nummer];
    const blokken = naarBlokken(artikel.tekst);
    const verwacht = woordenUitBron(artikel.tekst);
    const gekregen = woordenUitBlokken(blokken);
    assert.deepEqual(gekregen, verwacht, `artikel ${nummer}: woorden komen niet overeen`);
  }
});

test("een alinea die over meerdere brontekst-regels loopt komt in een blok zonder regeleindes", () => {
  // De slotalinea van 3.1.1 loopt in de bron over 4 regels.
  const blokken = naarBlokken(ARTIKELEN["3.1.1"].tekst);
  const slot = blokken[blokken.length - 1];
  assert.equal(slot.soort, "alinea");
  assert.ok(!slot.tekst.includes("\n"), "blok bevat nog een regeleinde");
  assert.ok(slot.tekst.startsWith("Competities voor juniorenteams"));
  assert.ok(slot.tekst.endsWith("vastgesteld."));
});

test("artikel 5.3.5.2 levert precies drie opsommingsitems op", () => {
  const blokken = naarBlokken(ARTIKELEN["5.3.5.2"].tekst);
  const items = blokken.filter((blok) => blok.soort === "item");
  assert.equal(items.length, 3);
  for (const item of items) {
    assert.equal(item.niveau, 1);
  }
});

test("de voorbeelden onder de items van 5.3.5.1 krijgen een dieper niveau dan de items zelf", () => {
  const blokken = naarBlokken(ARTIKELEN["5.3.5.1"].tekst);
  const items = blokken.filter((blok) => blok.soort === "item");
  const niveau1 = items.filter((item) => item.niveau === 1);
  const niveau2 = items.filter((item) => item.niveau === 2);
  assert.equal(niveau1.length, 3, "drie hoofditems verwacht");
  assert.equal(niveau2.length, 6, "zes voorbeelden verwacht");
  for (const voorbeeld of niveau2) {
    assert.ok(voorbeeld.tekst.startsWith("Voorbeeld:"));
    assert.ok(voorbeeld.niveau > niveau1[0].niveau);
  }
});

test("artikel 3.1.1 levert het juiste aantal leeftijdsgrenzen-items op", () => {
  // In de brontekst staan er 10 bullets: O18, O16, O14, O12, O11, O10, O9, O8, O7 en O6.
  const blokken = naarBlokken(ARTIKELEN["3.1.1"].tekst);
  const items = blokken.filter((blok) => blok.soort === "item");
  assert.equal(items.length, 10);
  for (const item of items) {
    assert.equal(item.niveau, 1);
  }
});
