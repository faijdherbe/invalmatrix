import { test } from "node:test";
import assert from "node:assert/strict";
import { KLASSEN, PEILDATUM, KOLOMMEN, CATEGORIEEN } from "../data.js";
import {
  niveau,
  beoordeelKlasse,
  categorieIMelding,
  leeftijdOpPeildatum,
  beoordeelLeeftijd,
  peildatumNederlands,
  assess,
  overzicht,
} from "../rules.js";

const d = (s) => new Date(`${s}T00:00:00Z`);

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

test("artikel 5.3.5.3: de artikelenlijst bij de grond vijfde-klasse noemt zowel 5.3.5.3 als 5.3.5.1", () => {
  const r = check("O14", "5e", "O14", "6e");
  assert.equal(r.grond, "vijfde-klasse");
  assert.ok(r.artikelen.includes("5.3.5.3"));
  assert.ok(r.artikelen.includes("5.3.5.1"));
});

test("artikel 5.3.5.3: de voorwaarden benoemen de onduidelijkheid over het aantal beschikbare spelers", () => {
  const r = check("O14", "5e", "O14", "6e");
  assert.equal(r.grond, "vijfde-klasse");
  assert.ok(r.voorwaarden.some((v) => /elf of meer eigen spelers/.test(v)));
  assert.ok(r.voorwaarden.some((v) => /5\.3\.5\.1/.test(v)));
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

test("de periodetekst van O16 Subtopklasse volgt hoofdstuk 2 letterlijk: tot en met de winterstop", () => {
  const o16 = categorieIMelding({ categorie: "O16", klasse: "subtop" });
  assert.match(o16, /tot en met de winterstop/);
});

test("gewone klassen krijgen geen melding", () => {
  assert.equal(categorieIMelding({ categorie: "O18", klasse: "1e" }), null);
  assert.equal(categorieIMelding({ categorie: "O11", klasse: "1e" }), null);
});

test("O14 Topklasse valt onder categorie II en krijgt geen melding, Super O14 wel", () => {
  assert.equal(categorieIMelding({ categorie: "O14", klasse: "top" }), null);
  assert.ok(categorieIMelding({ categorie: "O14", klasse: "super" }));
});

test("O14 Topklasse en Super O14 staan op hetzelfde niveau", () => {
  assert.equal(niveau("O14", "top"), niveau("O14", "super"));
});

test("IDC-O14 is een eigen klasse naast Super O14, op hetzelfde niveau als Super O14 en Topklasse", () => {
  assert.equal(niveau("O14", "idc"), niveau("O14", "super"));
  assert.equal(niveau("O14", "idc"), niveau("O14", "top"));
});

test("IDC-O14 valt tot de winterstop onder categorie I en daarna doet de tool geen uitspraak", () => {
  const melding = categorieIMelding({ categorie: "O14", klasse: "idc" });
  assert.match(melding, /tot de winterstop/);
  assert.match(melding, /geen uitspraak/);
});

test("Super O14 blijft, los van IDC-O14, onvoorwaardelijk onder categorie I", () => {
  const melding = categorieIMelding({ categorie: "O14", klasse: "super" });
  assert.ok(melding);
  assert.doesNotMatch(melding, /winterstop/);
});

test("een O14-team in de Topklasse krijgt gewoon een oordeel van beoordeelKlasse", () => {
  const r = check("O14", "top", "O14", "subtop");
  assert.equal(r.toegestaan, true);
  assert.equal(r.grond, "een-hoger");
});

test("de categorie I-meldingen noemen zowel hoofdstuk 2 als hoofdstuk 4", () => {
  const vast = categorieIMelding({ categorie: "O18", klasse: "super" });
  assert.match(vast, /hoofdstuk 2/);
  assert.match(vast, /hoofdstuk 4/);
  const periode = categorieIMelding({ categorie: "O18", klasse: "subtop" });
  assert.match(periode, /hoofdstuk 2/);
  assert.match(periode, /hoofdstuk 4/);
});

test("leeftijd wordt berekend op 1 oktober 2026", () => {
  assert.equal(leeftijdOpPeildatum(d("2016-10-01")), 10);
  assert.equal(leeftijdOpPeildatum(d("2016-10-02")), 9);
  assert.equal(leeftijdOpPeildatum(d("2015-10-02")), 10);
});

test("een speler met de juiste leeftijd voor de doelcategorie levert geen blokkade", () => {
  const r = beoordeelLeeftijd(
    { categorie: "O14", klasse: "4e" },
    { categorie: "O14", klasse: "5e" },
    d("2013-05-01"),
  );
  assert.equal(r.leeftijd, 13);
  assert.equal(r.blokkeert, false);
});

test("een speler die te oud is voor de doelcategorie mag daar niet uitkomen", () => {
  const r = beoordeelLeeftijd(
    { categorie: "O14", klasse: "4e" },
    { categorie: "O11", klasse: "4e" },
    d("2013-05-01"),
  );
  assert.equal(r.blokkeert, true);
  assert.ok(r.meldingen.some((m) => /te oud voor O11/.test(m)));
  assert.ok(r.artikelen.includes("3.1.3"));
});

test("een speler die te jong is voor haar eigen categorie is een dispensatiegeval, ook bij een gelijke of oudere bron", () => {
  const r = beoordeelLeeftijd(
    { categorie: "O14", klasse: "3e" },
    { categorie: "O14", klasse: "4e" },
    d("2016-05-01"),
  );
  assert.equal(r.blokkeert, true);
  assert.ok(r.meldingen.some((m) => /dispensatie/.test(m)));
});

test("een speler die te jong is voor de doelcategorie blokkeert niet meer als de bron uit een jongere categorie komt", () => {
  const r = beoordeelLeeftijd(
    { categorie: "O11", klasse: "1e" },
    { categorie: "O14", klasse: "4e" },
    d("2016-05-01"),
  );
  assert.equal(r.blokkeert, false);
  assert.ok(!r.meldingen.some((m) => /dispensatie/.test(m)));
});

test("artikel 5.2.4: een speler die een jaar te oud is mag uitsluitend voor het eigen team spelen", () => {
  const r = beoordeelLeeftijd(
    { categorie: "O14", klasse: "3e" },
    { categorie: "O14", klasse: "4e" },
    d("2012-05-01"),
  );
  assert.equal(r.blokkeert, true);
  assert.ok(r.meldingen.some((m) => /uitsluitend/.test(m)));
  assert.ok(r.artikelen.includes("5.2.4"));
});

test("artikel 5.2.4 geldt niet voor de 1e klasse", () => {
  const r = beoordeelLeeftijd(
    { categorie: "O14", klasse: "1e" },
    { categorie: "O14", klasse: "2e" },
    d("2012-05-01"),
  );
  assert.ok(!r.meldingen.some((m) => /uitsluitend/.test(m)));
});

test("een geboortedatum van precies 1 oktober levert een waarschuwing over het randgeval", () => {
  const r = beoordeelLeeftijd(
    { categorie: "O14", klasse: "4e" },
    { categorie: "O14", klasse: "5e" },
    d("2013-10-01"),
  );
  assert.ok(r.meldingen.some((m) => /randgeval/.test(m)));
});

test("peildatumNederlands levert de correcte Nederlandse datumtekst", () => {
  assert.equal(peildatumNederlands(PEILDATUM), "1 oktober 2026");
});

test("meldingen van beoordeelLeeftijd bevatten de peildatum in Nederlands", () => {
  const verwachteTekst = peildatumNederlands(PEILDATUM);
  const r = beoordeelLeeftijd(
    { categorie: "O14", klasse: "4e" },
    { categorie: "O14", klasse: "5e" },
    d("2013-05-01"),
  );
  assert.ok(r.meldingen.some((m) => m.includes(verwachteTekst)), `Geen melding met "${verwachteTekst}" gevonden`);
});

test("assess geeft buiten-scope voor categorie I, ook als maar een van beide teams erin valt", () => {
  const r = assess({ categorie: "O18", klasse: "landelijk" }, { categorie: "O18", klasse: "1e" }, null);
  assert.equal(r.verdict, "buiten-scope");
  assert.equal(r.voorwaarden.length, 0);
});

test("assess geeft de grond van beoordeelKlasse terug, en null bij buiten-scope", () => {
  const buitenScope = assess({ categorie: "O18", klasse: "landelijk" }, { categorie: "O18", klasse: "1e" }, null);
  assert.equal(buitenScope.grond, null);

  const eenHoger = assess({ categorie: "O14", klasse: "3e" }, { categorie: "O14", klasse: "4e" }, null);
  assert.equal(eenHoger.grond, "een-hoger");

  const vijfdeKlasse = assess({ categorie: "O14", klasse: "5e" }, { categorie: "O14", klasse: "6e" }, null);
  assert.equal(vijfdeKlasse.grond, "vijfde-klasse");

  const teHoog = assess({ categorie: "O12", klasse: "1e" }, { categorie: "O12", klasse: "5e" }, null);
  assert.equal(teHoog.grond, "te-hoog");
});

test("assess geeft toegestaan zonder geboortedatum", () => {
  const r = assess({ categorie: "O16", klasse: "3e" }, { categorie: "O16", klasse: "2e" }, null);
  assert.equal(r.verdict, "toegestaan");
  assert.equal(r.leeftijd, null);
});

test("assess laat de leeftijdstoets een groen oordeel omslaan naar rood", () => {
  const r = assess(
    { categorie: "O14", klasse: "4e" },
    { categorie: "O11", klasse: "4e" },
    new Date("2013-05-01T00:00:00Z"),
  );
  assert.equal(r.verdict, "niet-toegestaan");
  assert.ok(r.leeftijd.meldingen.length > 0);
});

test("assess ontdubbelt en sorteert de artikelen", () => {
  const r = assess(
    { categorie: "O18", klasse: "3e" },
    { categorie: "O16", klasse: "2e" },
    new Date("2011-05-01T00:00:00Z"),
  );
  assert.deepEqual(r.artikelen, [...new Set(r.artikelen)].sort());
});

test("assess geeft altijd een samenvatting in gewone taal", () => {
  for (const geval of [
    [{ categorie: "O16", klasse: "3e" }, { categorie: "O16", klasse: "2e" }],
    [{ categorie: "O18", klasse: "2e" }, { categorie: "O16", klasse: "3e" }],
    [{ categorie: "O18", klasse: "landelijk" }, { categorie: "O18", klasse: "1e" }],
  ]) {
    const r = assess(geval[0], geval[1], null);
    assert.equal(typeof r.samenvatting, "string");
    assert.ok(r.samenvatting.length > 10);
  }
});

test("afwijzing wegens te groot niveauverschil bevat geen redenering over leeftijd van oudere categorie", () => {
  const r = assess(
    { categorie: "O18", klasse: "1e" },
    { categorie: "O11", klasse: "4e" },
    new Date("2009-05-01T00:00:00Z"),
  );
  assert.equal(r.verdict, "niet-toegestaan");
  const redenering = r.redenering.join(" ");
  assert.ok(!redenering.includes("leeftijdsgrenzen"), "Redenering mag geen leeftijdsgrens bevatten");
  assert.ok(!r.artikelen.includes("3.1.1"), "Artikel 3.1.1 mag niet voorkomen");
  assert.ok(!r.artikelen.includes("3.1.3"), "Artikel 3.1.3 mag niet voorkomen");
});

test("overzicht geeft een rij per leeftijdscategorie", () => {
  const rijen = overzicht({ categorie: "O14", klasse: "4e" });
  assert.equal(rijen.length, CATEGORIEEN.length);
  assert.deepEqual(rijen.map((r) => r.categorie), CATEGORIEEN);
});

test("overzicht geeft per rij een vakje per kolom", () => {
  const rijen = overzicht({ categorie: "O14", klasse: "4e" });
  for (const rij of rijen) {
    assert.equal(rij.vakjes.length, KOLOMMEN.length);
    assert.deepEqual(rij.vakjes.map((v) => v.klasse), KOLOMMEN);
  }
});

test("overzicht markeert klassen die een categorie niet heeft als niet bestaand", () => {
  const rijen = overzicht({ categorie: "O14", klasse: "4e" });
  const o11 = rijen.find((r) => r.categorie === "O11");
  const subtop = o11.vakjes.find((v) => v.klasse === "subtop");
  assert.equal(subtop.bestaat, false);
  const eerste = o11.vakjes.find((v) => v.klasse === "1e");
  assert.equal(eerste.bestaat, true);
});

test("overzicht komt per vakje overeen met assess", () => {
  const doel = { categorie: "O14", klasse: "4e" };
  for (const rij of overzicht(doel)) {
    for (const vakje of rij.vakjes) {
      if (!vakje.bestaat) continue;
      const verwacht = assess({ categorie: rij.categorie, klasse: vakje.klasse }, doel, null);
      assert.equal(vakje.verdict, verwacht.verdict, `${rij.categorie} ${vakje.klasse}`);
    }
  }
});

test("overzicht laat zien dat een team op gelijk niveau vrij mag invallen", () => {
  const rijen = overzicht({ categorie: "O14", klasse: "4e" });
  const o14 = rijen.find((r) => r.categorie === "O14");
  const vijfde = o14.vakjes.find((v) => v.klasse === "5e");
  assert.equal(vijfde.verdict, "toegestaan");
  assert.equal(vijfde.soort, "vrij");
});

test("overzicht laat zien dat een klasse hoger onder de aantallen-eis mag", () => {
  const rijen = overzicht({ categorie: "O14", klasse: "4e" });
  const o14 = rijen.find((r) => r.categorie === "O14");
  const derde = o14.vakjes.find((v) => v.klasse === "3e");
  assert.equal(derde.verdict, "toegestaan");
  assert.equal(derde.soort, "aantallen");
});

test("soort leeg: een klasse die de categorie niet heeft krijgt geen verdere velden", () => {
  const rijen = overzicht({ categorie: "O14", klasse: "4e" });
  const o11 = rijen.find((r) => r.categorie === "O11");
  const subtop = o11.vakjes.find((v) => v.klasse === "subtop");
  assert.equal(subtop.bestaat, false);
  assert.equal(subtop.soort, undefined);
});

test("soort buiten-scope: O16 Subtopklasse valt onder categorie I en krijgt geen klasseoordeel", () => {
  const rijen = overzicht({ categorie: "O14", klasse: "4e" });
  const o16 = rijen.find((r) => r.categorie === "O16");
  const subtop = o16.vakjes.find((v) => v.klasse === "subtop");
  assert.equal(subtop.verdict, "buiten-scope");
  assert.equal(subtop.soort, "buiten-scope");
});

test("soort nee: te groot niveauverschil is niet toegestaan", () => {
  const rijen = overzicht({ categorie: "O14", klasse: "4e" });
  const o14 = rijen.find((r) => r.categorie === "O14");
  const tweede = o14.vakjes.find((v) => v.klasse === "2e");
  assert.equal(tweede.verdict, "niet-toegestaan");
  assert.equal(tweede.soort, "nee");
});

test("soort aantallen: een niveau hoger mag alleen onder de voorwaarden van 5.3.5.2, dat is de zwaarste horde", () => {
  const rijen = overzicht({ categorie: "O14", klasse: "4e" });
  const o14 = rijen.find((r) => r.categorie === "O14");
  const derde = o14.vakjes.find((v) => v.klasse === "3e");
  assert.equal(derde.soort, "aantallen");
});

test("grond een-hoger levert hier leeftijd op: een O18-speler kan nooit aan de O16-leeftijdsgrens voldoen", () => {
  const rijen = overzicht({ categorie: "O16", klasse: "1e" });
  const o18 = rijen.find((r) => r.categorie === "O18");
  const eerste = o18.vakjes.find((v) => v.klasse === "1e");
  assert.equal(eerste.verdict, "toegestaan");
  assert.equal(eerste.soort, "leeftijd");
});

test("soort max2: de grond vijfde-klasse levert max2 op, niet aantallen", () => {
  const rijen = overzicht({ categorie: "O14", klasse: "6e" });
  const o14 = rijen.find((r) => r.categorie === "O14");
  const vijfde = o14.vakjes.find((v) => v.klasse === "5e");
  assert.equal(vijfde.verdict, "toegestaan");
  assert.equal(vijfde.soort, "max2");
});

test("soort leeftijd: O16 speelt vanaf de 5e klasse gelijk aan O14 4e klasse, dan telt alleen de leeftijd", () => {
  const rijen = overzicht({ categorie: "O14", klasse: "4e" });
  const o16 = rijen.find((r) => r.categorie === "O16");
  const vijfde = o16.vakjes.find((v) => v.klasse === "5e");
  assert.equal(vijfde.verdict, "toegestaan");
  assert.equal(vijfde.soort, "leeftijd");
});

test("soort vrij: gelijk niveau binnen dezelfde categorie mag zonder enige voorwaarde", () => {
  const rijen = overzicht({ categorie: "O14", klasse: "4e" });
  const o14 = rijen.find((r) => r.categorie === "O14");
  const vierde = o14.vakjes.find((v) => v.klasse === "4e");
  assert.equal(vierde.verdict, "toegestaan");
  assert.equal(vierde.soort, "vrij");
});

test("overzicht voor O14 4e klasse geeft het volledige raster zoals de opdrachtgever het wil zien", () => {
  const rijen = overzicht({ categorie: "O14", klasse: "4e" });
  // kolommen: idc top subtop 1e 2e 3e 4e 5e 6e 7e 8e
  const verwacht = {
    O11: [null, null, null, "nee", "aantallen", "vrij", "vrij", "vrij", "vrij", "vrij", "vrij"],
    O12: [null, null, null, "nee", "aantallen", "vrij", "vrij", "vrij", "vrij", "vrij", "vrij"],
    O14: ["buiten-scope", "nee", "nee", "nee", "nee", "aantallen", "vrij", "vrij", "vrij", "vrij", "vrij"],
    O16: [null, null, "buiten-scope", "nee", "nee", "nee", "leeftijd", "leeftijd", "leeftijd", "leeftijd", "leeftijd"],
    O18: [null, null, "buiten-scope", "nee", "nee", "nee", "nee", "leeftijd", "leeftijd", "leeftijd", "leeftijd"],
  };
  for (const rij of rijen) {
    const soorten = rij.vakjes.map((v) => (v.bestaat ? v.soort : null));
    assert.deepEqual(soorten, verwacht[rij.categorie], rij.categorie);
  }
});

test("overzicht voor O14 5e klasse geeft max2 voor de vijfde-klasse-uitzondering van 5.3.5.3", () => {
  const rijen = overzicht({ categorie: "O14", klasse: "5e" });
  // kolommen: idc top subtop 1e 2e 3e 4e 5e 6e 7e 8e
  const verwacht = {
    O11: [null, null, null, "nee", "nee", "aantallen", "vrij", "vrij", "vrij", "vrij", "vrij"],
    O12: [null, null, null, "nee", "nee", "aantallen", "vrij", "vrij", "vrij", "vrij", "vrij"],
    O14: ["buiten-scope", "nee", "nee", "nee", "nee", "nee", "aantallen", "max2", "max2", "max2", "max2"],
    O16: [null, null, "buiten-scope", "nee", "nee", "nee", "nee", "leeftijd", "leeftijd", "leeftijd", "leeftijd"],
    O18: [null, null, "buiten-scope", "nee", "nee", "nee", "nee", "nee", "nee", "nee", "nee"],
  };
  for (const rij of rijen) {
    const soorten = rij.vakjes.map((v) => (v.bestaat ? v.soort : null));
    assert.deepEqual(soorten, verwacht[rij.categorie], rij.categorie);
  }
});

test("de idc-kolom bestaat alleen bij O14, de andere categorieen krijgen daar een leeg vakje", () => {
  const rijen = overzicht({ categorie: "O14", klasse: "4e" });
  for (const rij of rijen) {
    assert.equal(rij.vakjes.length, KOLOMMEN.length);
    const idc = rij.vakjes.find((v) => v.klasse === "idc");
    assert.equal(idc.bestaat, rij.categorie === "O14");
  }
});

test("overzicht laat zien dat twee klassen hoger niet mag", () => {
  const rijen = overzicht({ categorie: "O14", klasse: "4e" });
  const o14 = rijen.find((r) => r.categorie === "O14");
  const tweede = o14.vakjes.find((v) => v.klasse === "2e");
  assert.equal(tweede.verdict, "niet-toegestaan");
});

test("overzicht geeft de Subtopklasse van O16 en O18 als buiten scope", () => {
  const rijen = overzicht({ categorie: "O14", klasse: "4e" });
  for (const categorie of ["O16", "O18"]) {
    const rij = rijen.find((r) => r.categorie === categorie);
    const subtop = rij.vakjes.find((v) => v.klasse === "subtop");
    assert.equal(subtop.bestaat, true);
    assert.equal(subtop.verdict, "buiten-scope");
  }
});

test("overzicht geeft de Subtopklasse van O14 wel een echt oordeel", () => {
  const rijen = overzicht({ categorie: "O14", klasse: "4e" });
  const o14 = rijen.find((r) => r.categorie === "O14");
  const subtop = o14.vakjes.find((v) => v.klasse === "subtop");
  assert.notEqual(subtop.verdict, "buiten-scope");
});

test("KOLOMMEN bevat geen klassen die altijd onder categorie I vallen", () => {
  assert.ok(!KOLOMMEN.includes("landelijk"));
  assert.ok(!KOLOMMEN.includes("super"));
});

test("elke kolom bestaat bij minstens een leeftijdscategorie", () => {
  for (const kolom of KOLOMMEN) {
    const bestaat = CATEGORIEEN.some((c) => KLASSEN[c].some((k) => k.id === kolom));
    assert.ok(bestaat, `kolom ${kolom} bestaat bij geen enkele categorie`);
  }
});

// Fout 1 (hersteld): het verdict "omstreden" vuurde altijd bij lenen uit een jongere categorie,
// want een speler uit een jongere categorie is per definitie te jong voor de doelcategorie. Het
// verdict is verwijderd; de kanttekening zit nu in beoordeelKlasse en verandert het oordeel niet.

test("O11 naar O14 levert toegestaan op, met en zonder geboortedatum, met dezelfde uitkomst", () => {
  const zonder = assess({ categorie: "O11", klasse: "3e" }, { categorie: "O14", klasse: "4e" }, null);
  const met = assess({ categorie: "O11", klasse: "3e" }, { categorie: "O14", klasse: "4e" }, d("2016-05-01"));
  assert.equal(zonder.verdict, "toegestaan");
  assert.equal(met.verdict, "toegestaan");
  assert.equal(zonder.verdict, met.verdict);
});

test("kanttekening: bij een jongere bron staat de kanttekening er ook zonder geboortedatum, met artikel 3.1.3", () => {
  const r = check("O14", "1e", "O18", "3e");
  assert.equal(r.toegestaan, true);
  assert.equal(r.kanttekeningen.length, 1);
  assert.match(r.kanttekeningen[0], /jongere leeftijdscategorie/);
  assert.ok(r.artikelen.includes("3.1.3"), "artikel 3.1.3 ontbreekt");
  assert.ok(r.artikelen.includes("5.3.5.1"), "artikel 5.3.5.1 ontbreekt");

  const zonderGeboortedatum = assess({ categorie: "O14", klasse: "1e" }, { categorie: "O18", klasse: "3e" }, null);
  assert.equal(zonderGeboortedatum.verdict, "toegestaan");
  assert.equal(zonderGeboortedatum.kanttekeningen.length, 1);
  assert.ok(zonderGeboortedatum.artikelen.includes("3.1.3"));
});

test("kanttekening: een gelijke categorie levert geen kanttekening over een jongere categorie op", () => {
  const r = check("O16", "2e", "O16", "2e");
  assert.deepEqual(r.kanttekeningen, []);
});

test("kanttekening: een oudere bron levert geen kanttekening over een jongere categorie op", () => {
  const r = check("O18", "3e", "O16", "2e");
  assert.deepEqual(r.kanttekeningen, []);
});

test("de andere richting blijft geblokkeerd: te oud voor de doelcategorie met bron uit een oudere categorie", () => {
  const r = assess(
    { categorie: "O18", klasse: "3e" },
    { categorie: "O16", klasse: "2e" },
    d("2005-05-01"),
  );
  assert.equal(r.verdict, "niet-toegestaan");
});

test("te oud voor de doelcategorie blokkeert nog steeds, ook als de bron uit een jongere categorie komt", () => {
  const r = assess(
    { categorie: "O11", klasse: "3e" },
    { categorie: "O14", klasse: "4e" },
    d("2000-05-01"),
  );
  assert.equal(r.verdict, "niet-toegestaan");
  assert.ok(r.leeftijd.meldingen.some((m) => /te oud/.test(m)));
});

test("artikel 5.2.4 blokkeert nog steeds: O14 5e klasse naar O14 4e klasse met een 14-jarige blijft niet-toegestaan", () => {
  const r = assess(
    { categorie: "O14", klasse: "5e" },
    { categorie: "O14", klasse: "4e" },
    d("2012-05-01"),
  );
  assert.equal(r.verdict, "niet-toegestaan");
});

// Fout 2: artikel 5.3.5.4, de aanvullende regel voor O14 Topklasse en Subtopklasse.

test("artikel 5.3.5.4: O14 Topklasse naar O14 Subtopklasse krijgt de aanvullende voorwaarde over het eerste team", () => {
  const r = check("O14", "top", "O14", "subtop");
  assert.equal(r.toegestaan, true);
  assert.ok(r.artikelen.includes("5.3.5.4"));
  assert.ok(r.voorwaarden.some((v) => /eerste team/.test(v)));
});

test("artikel 5.3.5.4 geldt ook de andere kant op, van Subtopklasse naar Topklasse", () => {
  const r = check("O14", "subtop", "O14", "top");
  assert.equal(r.toegestaan, true);
  assert.ok(r.artikelen.includes("5.3.5.4"));
});

test("artikel 5.3.5.4 geldt niet buiten de Topklasse en Subtopklasse van O14", () => {
  const r = check("O14", "1e", "O14", "2e");
  assert.ok(!r.artikelen.includes("5.3.5.4"));
});

// Fout 3: de voorwaardetekst bij een-hoger moet het team noemen waarin wordt ingevallen.

test("de voorwaarde bij grond een-hoger noemt het team waarin wordt ingevallen, niet het invallende team", () => {
  const r = check("O18", "1e", "O16", "1e");
  assert.ok(r.voorwaarden.some((v) => /^Het team waarin wordt ingevallen/.test(v)));
  assert.ok(!r.voorwaarden.some((v) => /invallende team/.test(v)));
});

// Fout 4: een onleesbare geboortedatum mag niet doorrekenen tot NaN.

test("leeftijdOpPeildatum geeft een duidelijke fout bij een ongeldige datum", () => {
  assert.throws(() => leeftijdOpPeildatum(new Date("niet-een-datum")));
});

test("assess behandelt een ongeldige geboortedatum als geen geboortedatum opgegeven", () => {
  const r = assess(
    { categorie: "O14", klasse: "4e" },
    { categorie: "O14", klasse: "5e" },
    new Date("niet-een-datum"),
  );
  assert.equal(r.verdict, "toegestaan");
  assert.equal(r.leeftijd, null);
});

// Fout 5: artikel 5.2.5, de aantallenuitzondering voor O12-jarigen in de O11-categorie.

test("artikel 5.2.5: een O12-jarige in O11 wijst op de uitzondering voor aantallenproblemen", () => {
  const r = beoordeelLeeftijd(
    { categorie: "O11", klasse: "1e" },
    { categorie: "O11", klasse: "1e" },
    d("2015-05-01"),
  );
  assert.equal(r.leeftijd, 11);
  assert.ok(r.meldingen.some((m) => /5\.2\.5/.test(m)));
  assert.ok(r.meldingen.some((m) => /aantallenproblemen/.test(m)));
  assert.ok(r.artikelen.includes("5.2.5"));
});

// Fout 6: een onmogelijke leeftijdseis moet voorrang krijgen op de aantallen-eis in het raster.

test("een leeftijdseis die nooit haalbaar is krijgt voorrang op de aantallen-eis in het raster", () => {
  const rijen = overzicht({ categorie: "O11", klasse: "4e" });
  const o16 = rijen.find((r) => r.categorie === "O16");
  const vijfde = o16.vakjes.find((v) => v.klasse === "5e");
  assert.equal(vijfde.verdict, "toegestaan");
  assert.equal(vijfde.soort, "leeftijd");
});
