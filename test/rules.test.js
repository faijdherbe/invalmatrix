import { test } from "node:test";
import assert from "node:assert/strict";
import { KLASSEN } from "../data.js";
import { niveau, beoordeelKlasse, categorieIMelding } from "../rules.js";

function check(bronCat, bronKlasse, doelCat, doelKlasse) {
  return beoordeelKlasse(
    { categorie: bronCat, klasse: bronKlasse },
    { categorie: doelCat, klasse: doelKlasse },
  );
}

test("O11 en O12 staan in dezelfde kolom van de tabel klassengrenzen", () => {
  assert.equal(niveau("O11", "1e"), niveau("O12", "1e"));
  assert.equal(niveau("O11", "4e"), niveau("O12", "4e"));
});

test("een klasse lager is een niveau lager binnen dezelfde categorie", () => {
  assert.equal(niveau("O14", "2e") - niveau("O14", "1e"), 1);
  assert.equal(niveau("O18", "3e") - niveau("O18", "2e"), 1);
});

test("een oudere categorie ligt een niveau hoger bij gelijke klasse", () => {
  assert.equal(niveau("O16", "2e") - niveau("O18", "2e"), 1);
  assert.equal(niveau("O14", "2e") - niveau("O16", "2e"), 1);
});

test("O11 1e klasse staat gelijk aan O14 2e klasse", () => {
  assert.equal(niveau("O11", "1e"), niveau("O14", "2e"));
});

test("O18 3e klasse staat gelijk aan O14 1e klasse, artikel 5.3.5.1", () => {
  assert.equal(niveau("O18", "3e"), niveau("O14", "1e"));
});

test("5e klasse en lager valt binnen een categorie op hetzelfde niveau", () => {
  assert.equal(niveau("O14", "5e"), niveau("O14", "6e"));
  assert.equal(niveau("O14", "5e"), niveau("O14", "8e"));
  assert.equal(niveau("O11", "5e"), niveau("O11", "7e"));
});

test("niveau kent elke klasse uit de keuzelijst", () => {
  for (const [categorie, klassen] of Object.entries(KLASSEN)) {
    for (const klasse of klassen) {
      assert.equal(typeof niveau(categorie, klasse.id), "number", `${categorie} ${klasse.id}`);
    }
  }
});

test("artikel 5.3.5.1: gelijke klasse binnen dezelfde categorie mag altijd", () => {
  const r = check("O16", "2e", "O16", "2e");
  assert.equal(r.toegestaan, true);
  assert.equal(r.grond, "gelijk-of-lager");
  assert.deepEqual(r.voorwaarden, []);
  assert.ok(r.artikelen.includes("5.3.5.1"));
});

test("artikel 5.3.5.1: lagere klasse binnen dezelfde categorie mag altijd", () => {
  const r = check("O16", "3e", "O16", "2e");
  assert.equal(r.toegestaan, true);
  assert.equal(r.grond, "gelijk-of-lager");
});

test("artikel 5.3.5.1: JO18-2 3e klasse mag lenen uit JO14-2 1e klasse", () => {
  const r = check("O14", "1e", "O18", "3e");
  assert.equal(r.toegestaan, true);
  assert.equal(r.grond, "gelijk-of-lager");
  assert.deepEqual(r.voorwaarden, []);
});

test("artikel 5.3.5.1: MO16-3 2e klasse mag lenen uit MO18-3 3e klasse, mits juiste leeftijd", () => {
  const r = check("O18", "3e", "O16", "2e");
  assert.equal(r.toegestaan, true);
  assert.equal(r.grond, "gelijk-of-lager");
  assert.equal(r.voorwaarden.length, 1);
  assert.match(r.voorwaarden[0], /leeftijdsgrenzen van O16/);
});

test("artikel 5.3.5.2: JO16-2 1e klasse mag lenen uit JO18-3 1e klasse onder voorwaarden", () => {
  const r = check("O18", "1e", "O16", "1e");
  assert.equal(r.toegestaan, true);
  assert.equal(r.grond, "een-hoger");
  assert.ok(r.voorwaarden.some((v) => /maximaal 11/.test(v)));
  assert.ok(r.voorwaarden.some((v) => /leeftijdsgrenzen van O16/.test(v)));
  assert.ok(r.artikelen.includes("5.3.5.2"));
});

test("artikel 5.3.5.2: JO16-3 3e klasse mag nooit lenen uit JO18-3 2e klasse", () => {
  const r = check("O18", "2e", "O16", "3e");
  assert.equal(r.toegestaan, false);
  assert.equal(r.grond, "te-hoog");
});

test("artikel 5.3.5.2: JO16-3 3e klasse mag wel lenen uit JO18-4 3e klasse", () => {
  const r = check("O18", "3e", "O16", "3e");
  assert.equal(r.toegestaan, true);
  assert.equal(r.grond, "een-hoger");
});

test("artikel 5.3.5.3: MO14-6 6e klasse mag lenen uit MO14-5 4e klasse onder voorwaarden", () => {
  const r = check("O14", "4e", "O14", "6e");
  assert.equal(r.toegestaan, true);
  assert.equal(r.grond, "een-hoger");
});

test("artikel 5.3.5.3: onderling invallen vanaf de 5e klasse kent een maximum van twee", () => {
  const r = check("O14", "5e", "O14", "6e");
  assert.equal(r.toegestaan, true);
  assert.equal(r.grond, "vijfde-klasse");
  assert.ok(r.voorwaarden.some((v) => /maximaal twee/.test(v)));
  assert.ok(r.artikelen.includes("5.3.5.3"));
});

test("O11 gebruikt negen spelers in plaats van elf in de voorwaarde van 5.3.5.2", () => {
  const r = check("O11", "3e", "O11", "4e");
  assert.equal(r.grond, "een-hoger");
  assert.ok(r.voorwaarden.some((v) => /maximaal 9/.test(v)));
});

test("de twaalf gevallen uit build.py leveren dezelfde uitkomst", () => {
  const gevallen = [
    ["O11", "1e", "O11", "1e", true, "gelijk-of-lager"],
    ["O14", "4e", "O14", "6e", true, "een-hoger"],
    ["O14", "5e", "O14", "6e", true, "vijfde-klasse"],
    ["O12", "1e", "O12", "5e", false, "te-hoog"],
    ["O11", "1e", "O12", "1e", true, "gelijk-of-lager"],
    ["O12", "1e", "O11", "1e", true, "gelijk-of-lager"],
    ["O14", "subtop", "O14", "1e", true, "een-hoger"],
    ["O11", "3e", "O14", "4e", true, "gelijk-of-lager"],
    ["O11", "1e", "O14", "4e", false, "te-hoog"],
    ["O11", "3e", "O14", "6e", true, "een-hoger"],
    ["O14", "4e", "O11", "3e", true, "gelijk-of-lager"],
    ["O14", "5e", "O11", "4e", true, "gelijk-of-lager"],
  ];
  for (const [bc, bk, dc, dk, toegestaan, grond] of gevallen) {
    const r = check(bc, bk, dc, dk);
    assert.equal(r.toegestaan, toegestaan, `${bc} ${bk} naar ${dc} ${dk}`);
    assert.equal(r.grond, grond, `${bc} ${bk} naar ${dc} ${dk}`);
  }
});

test("Landelijk en Super vallen bij O16 en O18 onder categorie I", () => {
  assert.ok(categorieIMelding({ categorie: "O18", klasse: "landelijk" }));
  assert.ok(categorieIMelding({ categorie: "O18", klasse: "super" }));
  assert.ok(categorieIMelding({ categorie: "O16", klasse: "landelijk" }));
  assert.ok(categorieIMelding({ categorie: "O16", klasse: "super" }));
});

test("de Super Competitie valt bij O14 onder categorie I", () => {
  assert.ok(categorieIMelding({ categorie: "O14", klasse: "super" }));
});

test("de Subtopklasse van O14 valt onder categorie II en krijgt geen melding", () => {
  assert.equal(categorieIMelding({ categorie: "O14", klasse: "subtop" }), null);
});

test("de Subtopklasse van O16 en O18 wisselt van categorie en krijgt een melding met periode", () => {
  const o18 = categorieIMelding({ categorie: "O18", klasse: "subtop" });
  assert.match(o18, /herfstvakantie/);
  const o16 = categorieIMelding({ categorie: "O16", klasse: "subtop" });
  assert.match(o16, /winterstop/);
});

test("gewone klassen krijgen geen melding", () => {
  assert.equal(categorieIMelding({ categorie: "O18", klasse: "1e" }), null);
  assert.equal(categorieIMelding({ categorie: "O11", klasse: "1e" }), null);
});
