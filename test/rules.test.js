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
  vakjeVanUitkomst,
} from "../rules.js";

const d = (s) => new Date(`${s}T00:00:00Z`);

function check(bronCat, bronKlasse, doelCat, doelKlasse) {
  return beoordeelKlasse(
    { categorie: bronCat, klasse: bronKlasse },
    { categorie: doelCat, klasse: doelKlasse },
  );
}

// Het vakje zoals het raster het tekent, voor een bron- en doelteam. Het raster kent geen
// geboortedatum, dus assess() krijgt hier ook geen datum mee.
function vakjeVoor(bronCat, bronKlasse, doelCat, doelKlasse) {
  return vakjeVanUitkomst(
    assess({ categorie: bronCat, klasse: bronKlasse }, { categorie: doelCat, klasse: doelKlasse }, null),
  );
}

// Compacte weergave van een vakje uit overzicht(), voor de rastertests hieronder: de basis, en
// als er eisen zijn de eisen erachter met een plus ertussen. Een klasse die de categorie niet
// heeft levert null op.
function vakjeCode(vakje) {
  if (!vakje.bestaat) return null;
  return vakje.eisen.length > 0 ? `${vakje.basis}:${vakje.eisen.join("+")}` : vakje.basis;
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

// Ticket #3: grond vijfde-klasse geldt alleen nog als de bron in een hogere klasse speelt dan de
// doel. Bij grond vijfde-klasse is artikel 5.3.5.1 per definitie niet van toepassing (dat artikel
// dekt juist de omgekeerde richting, bron gelijk aan of lager dan doel), dus die verwijzing hoort
// niet meer in de artikelenlijst van deze grond. Was: deze test verwachtte 5.3.5.1 wel in de
// lijst.
test("artikel 5.3.5.3: de artikelenlijst bij de grond vijfde-klasse noemt 5.3.5.3, maar niet 5.3.5.1", () => {
  const r = check("O14", "5e", "O14", "6e");
  assert.equal(r.grond, "vijfde-klasse");
  assert.ok(r.artikelen.includes("5.3.5.3"));
  assert.ok(!r.artikelen.includes("5.3.5.1"));
});

// Was: deze test verwachtte ook een verwijzing naar 5.3.5.1 in de voorwaardetekst, als mogelijke
// terugvaloptie bij minder dan elf eigen spelers. Na ticket #3 is dat onjuist: bij grond
// vijfde-klasse speelt de bron juist in een hogere klasse dan de doel, en dus geldt artikel
// 5.3.5.1 daar per definitie niet. Die zin is uit de voorwaardetekst geschrapt; de open vraag over
// het maximum (ticket #13) blijft gewoon staan.
test("artikel 5.3.5.3: de voorwaarden benoemen de onduidelijkheid over het aantal beschikbare spelers", () => {
  const r = check("O14", "5e", "O14", "6e");
  assert.equal(r.grond, "vijfde-klasse");
  assert.ok(r.voorwaarden.some((v) => /elf of meer eigen spelers/.test(v)));
  assert.ok(r.voorwaarden.some((v) => /competitieleiding/.test(v)));
  assert.ok(!r.voorwaarden.some((v) => /5\.3\.5\.1/.test(v)));
});

// Ticket #3: artikel 5.3.5.1 zegt dat een team altijd invallers mag lenen uit een team dat gelijk
// of lager speelt. Binnen de 5e klasse en lager viel dat voorheen ten onrechte ook onder de
// uitzondering van artikel 5.3.5.3, met het maximum van twee invallers. Grond vijfde-klasse geldt
// nu alleen nog als de bron in een hogere klasse speelt dan de doel: dat is precies de richting
// waarvoor artikel 5.3.5.1 niet als vangnet dient.
test("ticket 3: doel 5e klasse met bron 5e klasse (gelijke klasse) valt onder 5.3.5.1, niet de uitzondering", () => {
  const r = check("O14", "5e", "O14", "5e");
  assert.equal(r.grond, "gelijk-of-lager");
});

test("ticket 3: doel 5e klasse met bron 6e klasse (bron lager) valt onder 5.3.5.1, niet de uitzondering", () => {
  const r = check("O14", "6e", "O14", "5e");
  assert.equal(r.grond, "gelijk-of-lager");
});

test("ticket 3: doel 6e klasse met bron 5e klasse (bron hoger) blijft de uitzondering van 5.3.5.3", () => {
  const r = check("O14", "5e", "O14", "6e");
  assert.equal(r.grond, "vijfde-klasse");
});

// Zestien geordende paren (4 klassen x 4 klassen) per leeftijdscategorie, vijf categorieen: 80
// combinaties. Bij zes van de zestien paren per categorie speelt de bron in een striktere hogere
// klasse dan de doel (klassenummer bron kleiner dan doel): dat zijn er 6 x 5 = 30. De overige 50
// (bron gelijk of lager dan doel) vallen onder artikel 5.3.5.1 en krijgen grond gelijk-of-lager.
test("de verdeling tussen vijfde-klasse en gelijk-of-lager binnen de lage klassen is 30 om 50", () => {
  const lageKlassen = ["5e", "6e", "7e", "8e"];
  let vijfdeKlasse = 0;
  let gelijkOfLager = 0;
  let overig = 0;
  for (const categorie of CATEGORIEEN) {
    for (const bronKlasse of lageKlassen) {
      for (const doelKlasse of lageKlassen) {
        const r = check(categorie, bronKlasse, categorie, doelKlasse);
        if (r.grond === "vijfde-klasse") vijfdeKlasse += 1;
        else if (r.grond === "gelijk-of-lager") gelijkOfLager += 1;
        else overig += 1;
      }
    }
  }
  assert.equal(vijfdeKlasse, 30);
  assert.equal(gelijkOfLager, 50);
  assert.equal(overig, 0);
});

// De eis max2 (artikel 5.3.5.3) hoort alleen nog bij combinaties die grond vijfde-klasse
// overhouden. De 50 combinaties die naar gelijk-of-lager verhuizen, verliezen die eis: artikel
// 5.3.5.1 kent geen maximum.
test("de max-twee-voorwaarde verdwijnt bij gelijk-of-lager en blijft bij vijfde-klasse", () => {
  const lageKlassen = ["5e", "6e", "7e", "8e"];
  for (const bronKlasse of lageKlassen) {
    for (const doelKlasse of lageKlassen) {
      const r = check("O14", bronKlasse, "O14", doelKlasse);
      const heeftMax2 = r.voorwaarden.some((v) => /maximaal twee/.test(v));
      if (r.grond === "vijfde-klasse") {
        assert.ok(heeftMax2, `${bronKlasse} naar ${doelKlasse}: max2 hoort te blijven`);
      } else {
        assert.ok(!heeftMax2, `${bronKlasse} naar ${doelKlasse}: max2 hoort te verdwijnen`);
      }
    }
  }
});

test("O11 gebruikt negen spelers in plaats van elf in de voorwaarde van 5.3.5.2", () => {
  const r = check("O11", "3e", "O11", "4e");
  assert.equal(r.grond, "een-hoger");
  assert.ok(r.voorwaarden.some((v) => /maximaal 9/.test(v)));

  // Het getal negen hoort bij de categorie van het doelteam, niet van de bron: een speler uit
  // O12 die invalt in een O11-doelteam moet hier ook 9 zien, niet 11.
  const r2 = check("O12", "3e", "O11", "4e");
  assert.equal(r2.grond, "een-hoger");
  assert.ok(r2.voorwaarden.some((v) => /maximaal 9/.test(v)));
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

// Regressie audit-eindfix bevinding 1: de samenvatting van assess() moet naar "de voorwaarden
// hieronder" verwijzen zodra er een voorwaarde is, ook als die voorwaarde niet uit
// beoordeelKlasse komt maar alleen uit beoordeelLeeftijd. O11 2e naar O11 1e klasse levert zelf
// geen klassenvoorwaarde op (grond gelijk-of-lager), maar bij een geboortedatum die de speler
// precies een jaar boven de bovengrens van O11 zet, voegt beoordeelLeeftijd de
// aantallenproblemen-voorwaarde van artikel 5.2.5 toe. Wie na de eerste zin van de samenvatting
// stopt met lezen, mag dan niet denken dat er niets meer te controleren valt.
test("assess verwijst naar de voorwaarden hieronder als alleen beoordeelLeeftijd een voorwaarde oplevert", () => {
  const r = assess(
    { categorie: "O11", klasse: "2e" },
    { categorie: "O11", klasse: "1e" },
    new Date(Date.UTC(2015, 4, 1)),
  );
  assert.equal(r.verdict, "toegestaan");
  assert.equal(r.grond, "gelijk-of-lager");
  assert.ok(r.voorwaarden.length > 0, "verwacht een voorwaarde uit beoordeelLeeftijd (artikel 5.2.5)");
  assert.match(r.samenvatting, /voorwaarden hieronder/);
});

// Ticket #20: staat de klassengrens het invallen toe maar blokkeert de leeftijd van de speler,
// dan moet de samenvatting niet alsnog een voorwaardenblok tonen. Dat leest anders alsof de
// speler er via die voorwaarden nog uit zou kunnen komen, terwijl de leeftijd het al heeft
// afgekeurd. O14 Topklasse naar O14 Subtopklasse is hiervoor een goed geval: de klassentoets
// levert zelf al voorwaarden op (de eerste-teameis van artikel 5.3.5.4 en de aantallen-eis van
// artikel 5.3.5.2, grond een-hoger), en een speler van veertien is te oud voor de doelcategorie
// O14 (grens 13 jaar), dus de leeftijdstoets blokkeert.
test("assess maakt de voorwaarden leeg als de leeftijd blokkeert, ook al levert de klassentoets zelf voorwaarden op", () => {
  const r = assess(
    { categorie: "O14", klasse: "top" },
    { categorie: "O14", klasse: "subtop" },
    new Date(Date.UTC(2012, 4, 1)),
  );
  assert.equal(r.verdict, "niet-toegestaan");
  assert.ok(r.leeftijd.blokkeert);
  assert.deepEqual(r.voorwaarden, []);
  // De artikelen en de leeftijdsmeldingen blijven staan: die dragen het oordeel en leggen uit
  // waarom het nee is.
  assert.ok(r.artikelen.includes("5.3.5.4"));
  assert.ok(r.leeftijd.meldingen.length > 0);
});

// Regressiebescherming voor de fix hierboven: bij een toegestaan geval met voorwaarden uit de
// klassentoets zelf (dus niet alleen uit beoordeelLeeftijd, zoals de test verderop al dekt) moet
// de samenvatting "mits aan de voorwaarden hieronder" blijven verwijzen. Dezelfde combinatie als
// hierboven, maar met een geboortedatum die wel binnen de leeftijdsgrenzen van O14 valt.
test("assess houdt de samenvatting 'mits aan de voorwaarden' bij een toegestaan geval met klassenvoorwaarden", () => {
  const r = assess(
    { categorie: "O14", klasse: "top" },
    { categorie: "O14", klasse: "subtop" },
    new Date(Date.UTC(2013, 4, 1)),
  );
  assert.equal(r.verdict, "toegestaan");
  assert.ok(r.voorwaarden.length > 0);
  assert.match(r.samenvatting, /voorwaarden hieronder/);
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
  assert.equal(vijfde.basis, "vrij");
  assert.deepEqual(vijfde.eisen, []);
});

test("overzicht laat zien dat een klasse hoger onder de aantallen-eis mag", () => {
  const rijen = overzicht({ categorie: "O14", klasse: "4e" });
  const o14 = rijen.find((r) => r.categorie === "O14");
  const derde = o14.vakjes.find((v) => v.klasse === "3e");
  assert.equal(derde.verdict, "toegestaan");
  assert.equal(derde.basis, "vrij");
  assert.deepEqual(derde.eisen, ["aantallen"]);
});

test("vakje leeg: een klasse die de categorie niet heeft krijgt geen verdere velden", () => {
  const rijen = overzicht({ categorie: "O14", klasse: "4e" });
  const o11 = rijen.find((r) => r.categorie === "O11");
  const subtop = o11.vakjes.find((v) => v.klasse === "subtop");
  assert.equal(subtop.bestaat, false);
  assert.equal(subtop.basis, undefined);
  assert.equal(subtop.eisen, undefined);
});

test("basis buiten-scope: O16 Subtopklasse valt onder categorie I en krijgt geen klasseoordeel", () => {
  const rijen = overzicht({ categorie: "O14", klasse: "4e" });
  const o16 = rijen.find((r) => r.categorie === "O16");
  const subtop = o16.vakjes.find((v) => v.klasse === "subtop");
  assert.equal(subtop.verdict, "buiten-scope");
  assert.equal(subtop.basis, "buiten-scope");
  assert.deepEqual(subtop.eisen, []);
});

test("basis nee: te groot niveauverschil is niet toegestaan", () => {
  const rijen = overzicht({ categorie: "O14", klasse: "4e" });
  const o14 = rijen.find((r) => r.categorie === "O14");
  const tweede = o14.vakjes.find((v) => v.klasse === "2e");
  assert.equal(tweede.verdict, "niet-toegestaan");
  assert.equal(tweede.basis, "nee");
  assert.deepEqual(tweede.eisen, []);
});

test("eis aantallen: een niveau hoger mag alleen onder de voorwaarden van 5.3.5.2", () => {
  const rijen = overzicht({ categorie: "O14", klasse: "4e" });
  const o14 = rijen.find((r) => r.categorie === "O14");
  const derde = o14.vakjes.find((v) => v.klasse === "3e");
  assert.deepEqual(derde.eisen, ["aantallen"]);
});

test("grond een-hoger uit een oudere categorie draagt beide eisen: aantallen en leeftijd", () => {
  const rijen = overzicht({ categorie: "O16", klasse: "1e" });
  const o18 = rijen.find((r) => r.categorie === "O18");
  const eerste = o18.vakjes.find((v) => v.klasse === "1e");
  assert.equal(eerste.verdict, "toegestaan");
  assert.equal(eerste.basis, "vrij");
  assert.deepEqual(eerste.eisen, ["aantallen", "leeftijd"]);
});

test("eis max2: de grond vijfde-klasse levert max2 op, niet aantallen", () => {
  const rijen = overzicht({ categorie: "O14", klasse: "6e" });
  const o14 = rijen.find((r) => r.categorie === "O14");
  const vijfde = o14.vakjes.find((v) => v.klasse === "5e");
  assert.equal(vijfde.verdict, "toegestaan");
  assert.equal(vijfde.basis, "vrij");
  assert.deepEqual(vijfde.eisen, ["max2"]);
});

test("eis leeftijd: O16 speelt vanaf de 5e klasse gelijk aan O14 4e klasse, dan telt alleen de leeftijd", () => {
  const rijen = overzicht({ categorie: "O14", klasse: "4e" });
  const o16 = rijen.find((r) => r.categorie === "O16");
  const vijfde = o16.vakjes.find((v) => v.klasse === "5e");
  assert.equal(vijfde.verdict, "toegestaan");
  assert.equal(vijfde.basis, "vrij");
  assert.deepEqual(vijfde.eisen, ["leeftijd"]);
});

test("basis vrij zonder eisen: gelijk niveau binnen dezelfde categorie mag zonder enige voorwaarde", () => {
  const rijen = overzicht({ categorie: "O14", klasse: "4e" });
  const o14 = rijen.find((r) => r.categorie === "O14");
  const vierde = o14.vakjes.find((v) => v.klasse === "4e");
  assert.equal(vierde.verdict, "toegestaan");
  assert.equal(vierde.basis, "vrij");
  assert.deepEqual(vierde.eisen, []);
});

test("overzicht voor O14 4e klasse geeft het volledige raster zoals de opdrachtgever het wil zien", () => {
  const rijen = overzicht({ categorie: "O14", klasse: "4e" });
  // kolommen: idc top subtop 1e 2e 3e 4e 5e 6e 7e 8e
  const verwacht = {
    O11: [null, null, null, "nee", "vrij:aantallen", "vrij", "vrij", "vrij", "vrij", "vrij", "vrij"],
    O12: [null, null, null, "nee", "vrij:aantallen", "vrij", "vrij", "vrij", "vrij", "vrij", "vrij"],
    O14: ["buiten-scope", "nee", "nee", "nee", "nee", "vrij:aantallen", "vrij", "vrij", "vrij", "vrij", "vrij"],
    O16: [null, null, "buiten-scope", "nee", "nee", "nee", "vrij:aantallen+leeftijd", "vrij:leeftijd", "vrij:leeftijd", "vrij:leeftijd", "vrij:leeftijd"],
    O18: [null, null, "buiten-scope", "nee", "nee", "nee", "nee", "vrij:aantallen+leeftijd", "vrij:aantallen+leeftijd", "vrij:aantallen+leeftijd", "vrij:aantallen+leeftijd"],
  };
  for (const rij of rijen) {
    assert.deepEqual(rij.vakjes.map(vakjeCode), verwacht[rij.categorie], rij.categorie);
  }
});

// Ticket #3: de 5e klasse is de hoogste van de lage klassen, dus vanuit geen enkele lage klasse
// kan een bron hoger spelen dan doel O14 5e. Alle vier combinaties (bron 5e, 6e, 7e of 8e) vallen
// daarom onder artikel 5.3.5.1 (grond gelijk-of-lager) en dragen geen max2 meer. Was: deze test
// heette "geeft max2 voor de vijfde-klasse-uitzondering" en verwachtte "vrij:max2" op die vier
// plekken; dat klopte toen elke combinatie binnen de lage klassen grond vijfde-klasse kreeg,
// ongeacht de richting.
test("overzicht voor O14 5e klasse: bron uit de lage klassen mag altijd invallen, zonder max2", () => {
  const rijen = overzicht({ categorie: "O14", klasse: "5e" });
  // kolommen: idc top subtop 1e 2e 3e 4e 5e 6e 7e 8e
  const verwacht = {
    O11: [null, null, null, "nee", "nee", "vrij:aantallen", "vrij", "vrij", "vrij", "vrij", "vrij"],
    O12: [null, null, null, "nee", "nee", "vrij:aantallen", "vrij", "vrij", "vrij", "vrij", "vrij"],
    O14: ["buiten-scope", "nee", "nee", "nee", "nee", "nee", "vrij:aantallen", "vrij", "vrij", "vrij", "vrij"],
    O16: [null, null, "buiten-scope", "nee", "nee", "nee", "nee", "vrij:aantallen+leeftijd", "vrij:aantallen+leeftijd", "vrij:aantallen+leeftijd", "vrij:aantallen+leeftijd"],
    O18: [null, null, "buiten-scope", "nee", "nee", "nee", "nee", "nee", "nee", "nee", "nee"],
  };
  for (const rij of rijen) {
    assert.deepEqual(rij.vakjes.map(vakjeCode), verwacht[rij.categorie], rij.categorie);
  }
});

// Ticket #3: doel O14 8e klasse is de laagste lage klasse, dus daar blijft de uitzondering van
// 5.3.5.3 (max2) juist wel gelden voor elke bron die in een hogere lage klasse speelt (5e, 6e of
// 7e). Alleen bron 8e zelf (gelijke klasse) valt onder 5.3.5.1.
test("overzicht voor O14 8e klasse houdt max2 voor bron uit een hogere lage klasse", () => {
  const rijen = overzicht({ categorie: "O14", klasse: "8e" });
  const o14 = rijen.find((r) => r.categorie === "O14");
  assert.deepEqual(o14.vakjes.find((v) => v.klasse === "5e").eisen, ["max2"]);
  assert.deepEqual(o14.vakjes.find((v) => v.klasse === "6e").eisen, ["max2"]);
  assert.deepEqual(o14.vakjes.find((v) => v.klasse === "7e").eisen, ["max2"]);
  assert.deepEqual(o14.vakjes.find((v) => v.klasse === "8e").eisen, []);
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
  // Was: kanttekeningen.length === 1. Sinds taak 5 krijgt elk oordeel met grond gelijk-of-lager
  // ook de kanttekeningen over de artikelen 5.3.4, 5.3.6/5.3.6.1 en 5.1.1, dus de lengte is niet
  // meer 1. De kern van deze test blijft staan: de jongere-categorie-kanttekening is aanwezig.
  assert.ok(r.kanttekeningen.some((k) => /jongere leeftijdscategorie/.test(k)));
  assert.ok(r.artikelen.includes("3.1.3"), "artikel 3.1.3 ontbreekt");
  assert.ok(r.artikelen.includes("5.3.5.1"), "artikel 5.3.5.1 ontbreekt");

  const zonderGeboortedatum = assess({ categorie: "O14", klasse: "1e" }, { categorie: "O18", klasse: "3e" }, null);
  assert.equal(zonderGeboortedatum.verdict, "toegestaan");
  assert.ok(zonderGeboortedatum.kanttekeningen.some((k) => /jongere leeftijdscategorie/.test(k)));
  assert.ok(zonderGeboortedatum.artikelen.includes("3.1.3"));
});

test("kanttekening: een gelijke categorie levert geen kanttekening over een jongere categorie op", () => {
  const r = check("O16", "2e", "O16", "2e");
  // Was: kanttekeningen deepEqual []. Sinds taak 5 krijgt grond gelijk-of-lager altijd de
  // kanttekeningen over 5.3.4, 5.3.6/5.3.6.1 en 5.1.1, dus de lijst is niet meer leeg. Waar het
  // hier om gaat, blijft gelden: geen kanttekening over een jongere leeftijdscategorie.
  assert.ok(!r.kanttekeningen.some((k) => /jongere leeftijdscategorie/.test(k)));
});

test("kanttekening: een oudere bron levert geen kanttekening over een jongere categorie op", () => {
  const r = check("O18", "3e", "O16", "2e");
  // Was: kanttekeningen deepEqual []. Zie vorige test voor de reden dat de lijst niet meer leeg is.
  assert.ok(!r.kanttekeningen.some((k) => /jongere leeftijdscategorie/.test(k)));
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
// Ticket #6: artikel 5.3.5.4 kent twee niveaugroepen: de voorcompetitie (Topklasse en
// Subtopklasse) en de lentecompetitie (Super O14 en IDC-O14). Beide moeten door
// beoordeelKlasse worden herkend, elk met een voorwaardetekst die de eigen periode noemt.

test("artikel 5.3.5.4: O14 Topklasse naar O14 Subtopklasse krijgt de aanvullende voorwaarde over het eerste team, met de voorcompetitie genoemd", () => {
  const r = check("O14", "top", "O14", "subtop");
  assert.equal(r.toegestaan, true);
  assert.ok(r.artikelen.includes("5.3.5.4"));
  assert.ok(r.voorwaarden.some((v) => /eerste team/.test(v)));
  assert.ok(r.voorwaarden.some((v) => /voorcompetitie/.test(v)));
});

test("artikel 5.3.5.4 geldt ook de andere kant op, van Subtopklasse naar Topklasse", () => {
  const r = check("O14", "subtop", "O14", "top");
  assert.equal(r.toegestaan, true);
  assert.ok(r.artikelen.includes("5.3.5.4"));
});

test("artikel 5.3.5.4: O14 Super O14 naar O14 IDC-O14 krijgt de aanvullende voorwaarde met de lentecompetitie genoemd (via beoordeelKlasse, want assess geeft hier buiten-scope)", () => {
  const r = check("O14", "super", "O14", "idc");
  assert.equal(r.toegestaan, true);
  assert.ok(r.artikelen.includes("5.3.5.4"));
  assert.ok(r.voorwaarden.some((v) => /eerste team/.test(v)));
  assert.ok(r.voorwaarden.some((v) => /lentecompetitie/.test(v)));
});

test("artikel 5.3.5.4 geldt niet tussen O14 Topklasse en O14 1e klasse: die klassen zitten niet samen in een niveaugroep", () => {
  const r = check("O14", "top", "O14", "1e");
  assert.ok(!r.artikelen.includes("5.3.5.4"));
});

test("artikel 5.3.5.4 geldt niet tussen O14 Topklasse en O14 IDC-O14: dat zijn verschillende niveaugroepen", () => {
  const r = check("O14", "top", "O14", "idc");
  assert.ok(!r.artikelen.includes("5.3.5.4"));
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

// Ticket #4: artikel 5.2.5 mag geen "nee" opleveren voor een O12-jarige die op basis van
// aantallenproblemen in de O11-categorie wordt ingedeeld. beoordeelLeeftijd blokkeerde deze
// speler eerder onterecht, terwijl de eerste melding tegelijk beweerde dat dispensatie nodig was,
// wat artikel 5.2.5 juist uitsluit.

test("artikel 5.2.5: een O12-jarige in O11 3e klasse levert toegestaan op met de aantallenvoorwaarde", () => {
  const r = assess(
    { categorie: "O12", klasse: "3e" },
    { categorie: "O11", klasse: "3e" },
    d("2015-05-01"),
  );
  assert.equal(r.verdict, "toegestaan");
  assert.ok(r.voorwaarden.some((v) => /O11/.test(v) && /O12/.test(v) && /aantallen/.test(v)));
  assert.ok(r.artikelen.includes("5.2.5"));
});

test("beoordeelLeeftijd blokkeert niet meer voor de O12-jarige in O11, en de eerste melding beweert geen dispensatie meer", () => {
  const r = beoordeelLeeftijd(
    { categorie: "O12", klasse: "3e" },
    { categorie: "O11", klasse: "3e" },
    d("2015-05-01"),
  );
  assert.equal(r.blokkeert, false);
  assert.ok(
    !r.meldingen.some((m) => /mag alleen met dispensatie/.test(m)),
    "geen enkele melding mag nog beweren dat dispensatie nodig is, dat spreekt artikel 5.2.5 tegen",
  );
  assert.ok(r.voorwaarden.some((v) => /aantallen/.test(v)));
});

test("een speler van twaalf jaar naar O11 blijft niet-toegestaan", () => {
  const r = assess(
    { categorie: "O12", klasse: "3e" },
    { categorie: "O11", klasse: "3e" },
    d("2014-05-01"),
  );
  assert.equal(r.verdict, "niet-toegestaan");
});

test("een speler van veertien jaar naar O12 blijft niet-toegestaan", () => {
  const r = assess(
    { categorie: "O12", klasse: "3e" },
    { categorie: "O12", klasse: "3e" },
    d("2012-05-01"),
  );
  assert.equal(r.verdict, "niet-toegestaan");
});

test("een speler van elf jaar naar O12 blijft gewoon toegestaan zonder de aantallenvoorwaarde", () => {
  const r = assess(
    { categorie: "O12", klasse: "3e" },
    { categorie: "O12", klasse: "3e" },
    d("2015-05-01"),
  );
  assert.equal(r.verdict, "toegestaan");
  assert.ok(!r.voorwaarden.some((v) => /aantallen/.test(v)));
});

// Fout 6 was: een onmogelijke leeftijdseis moest voorrang krijgen op de aantallen-eis in het
// raster. Ticket #2 liet zien dat die voorrang juist het probleem was: het vakje verzweeg dan de
// aantallen-eis van artikel 5.3.5.2. Een vakje draagt nu beide eisen, dus er valt niets meer weg.

test("een onhaalbare leeftijdseis verdringt de aantallen-eis niet meer in het raster", () => {
  const rijen = overzicht({ categorie: "O11", klasse: "4e" });
  const o16 = rijen.find((r) => r.categorie === "O16");
  const vijfde = o16.vakjes.find((v) => v.klasse === "5e");
  assert.equal(vijfde.verdict, "toegestaan");
  assert.equal(vijfde.basis, "vrij");
  assert.deepEqual(vijfde.eisen, ["aantallen", "leeftijd"]);
});

// Ticket #8: artikel 5.3.4, wijziging van niveaubepaling. Een speler die binnen de vereniging
// evenveel of vaker uitkomt voor het hoger spelende team dan voor het eigen team krijgt dat
// hogere niveau als niveaubepaling. De tool kent de speelgeschiedenis niet en kan dit niet
// beoordelen, dus dit hoort als kanttekening bij het oordeel, niet als voorwaarde.
//
// Bevinding audit-eindfix #3: het artikel heeft twee helften. De eerste helft (de niveaubepaling
// wijzigt naar het hogere niveau) raakt grond gelijk-of-lager, want daar valt de speler omhoog
// in. De tweede helft, de slotzin "de speler mag vervolgens niet meer voor lager spelende teams
// uitkomen", raakt juist de gronden een-hoger en vijfde-klasse, want daar valt de speler omlaag
// in en kan een eerder gewijzigde niveaubepaling die invalbeurt alsnog verbieden. Was: de
// kanttekening zat alleen bij grond gelijk-of-lager. Net als de kanttekeningen bij de artikelen
// 5.3.6 en 5.1.1 hieronder hoort deze bij elk toegestaan oordeel, dus bij alle drie de gronden.

test("kanttekening: artikel 5.3.4 verschijnt bij grond gelijk-of-lager, een-hoger en vijfde-klasse", () => {
  const gevallen = [
    ["O16", "3e", "O16", "2e", "gelijk-of-lager"],
    ["O18", "1e", "O16", "1e", "een-hoger"],
    ["O14", "5e", "O14", "6e", "vijfde-klasse"],
  ];
  for (const [bc, bk, dc, dk, grond] of gevallen) {
    const r = check(bc, bk, dc, dk);
    assert.equal(r.grond, grond);
    assert.ok(r.kanttekeningen.some((k) => /5\.3\.4/.test(k)), `${grond}: kanttekening ontbreekt`);
    assert.ok(r.artikelen.includes("5.3.4"), `${grond}: artikel 5.3.4 ontbreekt`);
  }
});

test("kanttekening: artikel 5.3.4 ontbreekt bij grond te-hoog", () => {
  const r = check("O18", "2e", "O16", "3e");
  assert.equal(r.grond, "te-hoog");
  assert.ok(!r.kanttekeningen.some((k) => /5\.3\.4/.test(k)));
  assert.ok(!r.artikelen.includes("5.3.4"));
});

test("kanttekening: artikel 5.3.4 noemt zowel de wijziging van de niveaubepaling als het verbod om nog voor lager spelende teams uit te komen", () => {
  const r = check("O18", "1e", "O16", "1e");
  assert.equal(r.grond, "een-hoger");
  const tekst = r.kanttekeningen.find((k) => /5\.3\.4/.test(k));
  assert.ok(tekst, "kanttekening ontbreekt");
  assert.match(tekst, /niveaubepaling/);
  assert.match(tekst, /niet meer.*lager spelende teams uitkomen/);
});

// Ticket #9: artikel 5.3.6 en 5.3.6.1, beslissingswedstrijden. Tijdens een beslissingswedstrijd
// mag alleen invallen wie al een vastgestelde niveaubepaling heeft. De tool kent de speelronde
// niet, dus dit is een kanttekening bij elk toegestaan oordeel, ongeacht de grond.

test("kanttekening: artikel 5.3.6 en 5.3.6.1 verschijnen bij grond gelijk-of-lager, een-hoger en vijfde-klasse", () => {
  const gevallen = [
    ["O16", "3e", "O16", "2e", "gelijk-of-lager"],
    ["O18", "1e", "O16", "1e", "een-hoger"],
    ["O14", "5e", "O14", "6e", "vijfde-klasse"],
  ];
  for (const [bc, bk, dc, dk, grond] of gevallen) {
    const r = check(bc, bk, dc, dk);
    assert.equal(r.grond, grond);
    assert.ok(r.kanttekeningen.some((k) => /5\.3\.6/.test(k)), `${grond}: kanttekening ontbreekt`);
    assert.ok(r.artikelen.includes("5.3.6"), `${grond}: artikel 5.3.6 ontbreekt`);
    assert.ok(r.artikelen.includes("5.3.6.1"), `${grond}: artikel 5.3.6.1 ontbreekt`);
  }
});

test("kanttekening: artikel 5.3.6 en 5.3.6.1 ontbreken bij grond te-hoog", () => {
  const r = check("O18", "2e", "O16", "3e");
  assert.equal(r.grond, "te-hoog");
  assert.ok(!r.kanttekeningen.some((k) => /5\.3\.6/.test(k)));
  assert.ok(!r.artikelen.includes("5.3.6"));
  assert.ok(!r.artikelen.includes("5.3.6.1"));
});

// Ticket #10: artikel 5.1.1, uitkomen voor verschillende verenigingen. De tool kent de
// poule-indeling en de speelgeschiedenis van de speler niet, dus dit is een kanttekening bij
// elk toegestaan oordeel, ongeacht de grond.

test("kanttekening: artikel 5.1.1 verschijnt bij grond gelijk-of-lager, een-hoger en vijfde-klasse", () => {
  const gevallen = [
    ["O16", "3e", "O16", "2e", "gelijk-of-lager"],
    ["O18", "1e", "O16", "1e", "een-hoger"],
    ["O14", "5e", "O14", "6e", "vijfde-klasse"],
  ];
  for (const [bc, bk, dc, dk, grond] of gevallen) {
    const r = check(bc, bk, dc, dk);
    assert.equal(r.grond, grond);
    assert.ok(r.kanttekeningen.some((k) => /5\.1\.1/.test(k)), `${grond}: kanttekening ontbreekt`);
    assert.ok(r.artikelen.includes("5.1.1"), `${grond}: artikel 5.1.1 ontbreekt`);
  }
});

test("kanttekening: artikel 5.1.1 ontbreekt bij grond te-hoog", () => {
  const r = check("O18", "2e", "O16", "3e");
  assert.equal(r.grond, "te-hoog");
  assert.ok(!r.kanttekeningen.some((k) => /5\.1\.1/.test(k)));
  assert.ok(!r.artikelen.includes("5.1.1"));
});

// Reviewopmerking: de voorwaardetekst van artikel 5.3.5.4 las stroef ("meerdere O14-teams op de
// ..."). Herformuleerd naar "meerdere teams in de ...".

test("artikel 5.3.5.4: de voorwaardetekst leest 'meerdere teams in de', niet 'O14-teams op de'", () => {
  const voorcompetitie = check("O14", "top", "O14", "subtop");
  assert.ok(voorcompetitie.voorwaarden.some((v) => /meerdere teams in de Topklasse of de Subtopklasse heeft/.test(v)));
  assert.ok(!voorcompetitie.voorwaarden.some((v) => /O14-teams op de/.test(v)));

  const lentecompetitie = check("O14", "super", "O14", "idc");
  assert.ok(lentecompetitie.voorwaarden.some((v) => /meerdere teams in de Super O14 of de IDC-O14 heeft/.test(v)));
  assert.ok(!lentecompetitie.voorwaarden.some((v) => /O14-teams op de/.test(v)));
});

// Tickets #1 en #2: het raster verzweeg voorwaarden. Ticket #1: drie vakjes kregen het label
// "leeftijd" terwijl hun enige voorwaarde uit artikel 5.3.5.4 kwam, een teamlijstregel die niets
// met leeftijd te maken heeft. Ticket #2: 121 vakjes toonden alleen de leeftijdseis en verzwegen
// de aantallen-eis van artikel 5.3.5.2, omdat de leeftijdstoets boven de aantallentoets stond.
// Deze regressietest loopt over elk doelteam en elk bronteam en legt beide fouten vast.

// Afbeelding van voorwaardetekst naar eis. overzicht() geeft assess() altijd geboortedatum null
// mee, dus dit dekt precies de voorwaarden die beoordeelKlasse kan opleveren (beoordeelLeeftijd
// draait dan niet mee). Dit is de omkering van de losse checks hierboven: waar die controleren
// "eis X impliceert voorwaardetekst Y", controleert de regressietest hieronder juist "elke
// voorwaardetekst hoort bij een eis". Zonder die omkering zou een nieuw voorwaardetype in
// beoordeelKlasse stilletjes door het raster kunnen glippen zonder dat er ooit een eis bij komt,
// precies zoals bij ticket #1 en #2. Voeg bij een nieuwe voorwaarde in rules.js hier een regel
// toe die de tekst aan de bijbehorende eis koppelt.
const VOORWAARDE_NAAR_EIS = [
  [/leeftijdsgrenzen van/, "leeftijd"],
  [/zijn de spelers van het eerste team hier zonder toestemming van de competitieleiding niet speelgerechtigd/, "eerste-team"],
  [/^Er mogen maximaal twee spelers invallen zonder toestemming van de competitieleiding\.$/, "max2"],
  [/^Onduidelijk is of dit maximum altijd geldt/, "max2"],
  [/heeft aantoonbaar maximaal \d+ spelers beschikbaar uit het eigen of een lager spelend niveau/, "aantallen"],
  [/^Er zijn aantoonbaar geen invallers beschikbaar uit een gelijk of lager spelend niveau\.$/, "aantallen"],
  [/^Er mogen maximaal twee spelers invallen, inclusief een vaste doelverdediger\.$/, "aantallen"],
  [/^Voor het inlenen van een doelverdediger geldt de eis over het aantal eigen spelers niet\.$/, "aantallen"],
];

test("regressie: geen enkel vakje verzwijgt een eis, over alle doel- en broncombinaties heen", () => {
  let metAantallen = 0;
  let metLeeftijd = 0;
  let metEersteTeam = 0;
  for (const doelCategorie of CATEGORIEEN) {
    for (const doelKlasse of KLASSEN[doelCategorie]) {
      const doel = { categorie: doelCategorie, klasse: doelKlasse.id };
      for (const rij of overzicht(doel)) {
        for (const vakje of rij.vakjes) {
          if (!vakje.bestaat) continue;
          const waar = `${rij.categorie} ${vakje.klasse} naar ${doelCategorie} ${doelKlasse.id}`;
          const uitkomst = assess({ categorie: rij.categorie, klasse: vakje.klasse }, doel, null);

          // Grond een-hoger impliceert de aantallen-eis. Dit klopt alleen omdat overzicht() hier
          // altijd geboortedatum null meegeeft: met een blokkerende geboortedatum wordt hetzelfde
          // vakje gewoon "nee" zonder eisen, zie assess() waar een blokkerende leeftijd de
          // voorwaarden van beoordeelKlasse negeert. Dit is dus geen algemene waarheid over de
          // grond een-hoger, maar een eigenschap van het klassenraster zonder geboortedatum.
          if (uitkomst.grond === "een-hoger") {
            assert.ok(vakje.eisen.includes("aantallen"), `${waar}: aantallen-eis ontbreekt`);
            metAantallen += 1;
          }
          if (vakje.eisen.includes("leeftijd")) {
            assert.ok(
              uitkomst.voorwaarden.some((v) => /leeftijdsgrenzen van/.test(v)),
              `${waar}: eis leeftijd zonder leeftijdsvoorwaarde`,
            );
            metLeeftijd += 1;
          }
          if (vakje.eisen.includes("eerste-team")) {
            assert.ok(uitkomst.artikelen.includes("5.3.5.4"), `${waar}: eis eerste-team zonder artikel 5.3.5.4`);
            metEersteTeam += 1;
          }
          if (uitkomst.artikelen.includes("5.3.5.4") && vakje.basis === "vrij") {
            assert.ok(vakje.eisen.includes("eerste-team"), `${waar}: eis eerste-team ontbreekt`);
          }

          // De omkering: elke voorwaarde die assess() hier teruggeeft, moet in de afbeelding
          // hierboven voorkomen en de bijbehorende eis moet ook echt in vakje.eisen staan.
          for (const voorwaarde of uitkomst.voorwaarden) {
            const gevonden = VOORWAARDE_NAAR_EIS.find(([regex]) => regex.test(voorwaarde));
            assert.ok(
              gevonden,
              `${waar}: voorwaarde zonder afbeelding naar een eis: "${voorwaarde}"`,
            );
            const [, eis] = gevonden;
            assert.ok(
              vakje.eisen.includes(eis),
              `${waar}: voorwaarde "${voorwaarde}" hoort bij eis ${eis}, maar die ontbreekt in het raster`,
            );
          }
        }
      }
    }
  }
  // De tellers voorkomen dat deze test stilletjes niets meer toetst als het raster ooit leegloopt.
  assert.ok(metAantallen > 0, "geen enkel vakje met grond een-hoger gevonden");
  assert.ok(metLeeftijd > 0, "geen enkel vakje met de eis leeftijd gevonden");
  assert.ok(metEersteTeam > 0, "geen enkel vakje met de eis eerste-team gevonden");
});

// Kanttekeningen (artikelen 5.3.4, 5.3.6, 5.3.6.1 en 5.1.1) zijn geen voorwaarden en mogen dus
// nooit een eis in het raster opleveren. Een vakje op gelijk of lager niveau binnen dezelfde
// categorie draagt die kanttekeningen wel, maar hoort gewoon leeg te blijven.

test("kanttekeningen leveren geen eis op in het raster", () => {
  const rijen = overzicht({ categorie: "O14", klasse: "4e" });
  const o14 = rijen.find((r) => r.categorie === "O14");
  const vijfde = o14.vakjes.find((v) => v.klasse === "5e");
  const uitkomst = assess({ categorie: "O14", klasse: "5e" }, { categorie: "O14", klasse: "4e" }, null);
  assert.ok(uitkomst.kanttekeningen.length > 0, "dit vakje hoort kanttekeningen te hebben");
  assert.deepEqual(vijfde.eisen, []);
});

// Reviewopmerking: de voorwaardetekst bij artikel 5.2.5 liet een nuance uit de brontekst weg. Het
// artikel spreekt van problemen om tot volledige teams c.q. goede teamsamenstellingen te komen;
// de tekst noemde alleen volledige teams.

test("artikel 5.2.5: de voorwaardetekst noemt ook de goede teamsamenstellingen", () => {
  const r = beoordeelLeeftijd(
    { categorie: "O12", klasse: "3e" },
    { categorie: "O11", klasse: "3e" },
    d("2015-05-01"),
  );
  assert.ok(r.voorwaarden.some((v) => /volledige teams of goede teamsamenstellingen/.test(v)));
  assert.ok(r.meldingen.some((m) => /volledige teams of goede teamsamenstellingen/.test(m)));
});

// Ticket #2: een vakje waar zowel de leeftijdsgrens als de volledige aantallen-eis van artikel
// 5.3.5.2 geldt, toonde alleen de leeftijd. Een coach die de geboortedatum controleerde dacht
// dan dat het mocht.

test("vakjeVanUitkomst: doel O11 1e klasse met bron O14 1e klasse draagt aantallen en leeftijd", () => {
  const vakje = vakjeVoor("O14", "1e", "O11", "1e");
  assert.equal(vakje.basis, "vrij");
  assert.deepEqual(vakje.eisen, ["aantallen", "leeftijd"]);
});

// Ticket #1: de enige voorwaarde komt hier uit artikel 5.3.5.4, een teamlijstregel die niets met
// leeftijd te maken heeft. Het vakje kreeg toch het label "leeftijd".

test("vakjeVanUitkomst: doel O14 Topklasse met bron O14 Topklasse draagt alleen eerste-team", () => {
  const vakje = vakjeVoor("O14", "top", "O14", "top");
  assert.equal(vakje.basis, "vrij");
  assert.deepEqual(vakje.eisen, ["eerste-team"]);
  assert.ok(!vakje.eisen.includes("leeftijd"));
});

test("vakjeVanUitkomst: doel O14 Subtopklasse met bron O14 Topklasse draagt aantallen en eerste-team", () => {
  const vakje = vakjeVoor("O14", "top", "O14", "subtop");
  assert.equal(vakje.basis, "vrij");
  assert.deepEqual(vakje.eisen, ["aantallen", "eerste-team"]);
});

// De tweede niveaugroep van artikel 5.3.5.4 (lentecompetitie: Super O14 en IDC-O14) haalt het
// raster niet: Super O14 valt altijd onder categorie I en IDC-O14 tot de winterstop, dus assess()
// komt daar niet verder dan buiten-scope. De afleiding van eerste-team kijkt naar het artikel en
// niet naar een vaste lijst klassen, dus zij werkt zodra die klassen wel binnen scope komen.

test("vakjeVanUitkomst: de lentecompetitiegroep van artikel 5.3.5.4 valt buiten scope", () => {
  const vakje = vakjeVoor("O14", "super", "O14", "idc");
  assert.equal(vakje.basis, "buiten-scope");
  assert.deepEqual(vakje.eisen, []);
  const klasse = beoordeelKlasse({ categorie: "O14", klasse: "super" }, { categorie: "O14", klasse: "idc" });
  assert.ok(klasse.artikelen.includes("5.3.5.4"), "de klassentoets kent de niveaugroep wel");
});

test("vakjeVanUitkomst: een gewoon gelijk-of-lager geval krijgt basis vrij zonder eisen", () => {
  const vakje = vakjeVoor("O14", "5e", "O14", "4e");
  assert.equal(vakje.basis, "vrij");
  assert.deepEqual(vakje.eisen, []);
});

// Ticket #3: was "doel O14 5e klasse met bron O14 6e klasse draagt max2". Die bron speelt lager
// dan de doel, dus dat valt sinds ticket #3 onder artikel 5.3.5.1 (grond gelijk-of-lager) en
// draagt geen max2 meer. Bron en doel zijn hier omgedraaid, zodat de bron weer hoger speelt dan de
// doel en de test zijn oorspronkelijke doel (de eis max2 controleren) overeind blijft.
test("vakjeVanUitkomst: doel O14 6e klasse met bron O14 5e klasse draagt max2", () => {
  const vakje = vakjeVoor("O14", "5e", "O14", "6e");
  assert.equal(vakje.basis, "vrij");
  assert.deepEqual(vakje.eisen, ["max2"]);
});

test("vakjeVanUitkomst: doel O14 5e klasse met bron O14 6e klasse (bron lager) draagt geen max2", () => {
  const vakje = vakjeVoor("O14", "6e", "O14", "5e");
  assert.equal(vakje.basis, "vrij");
  assert.deepEqual(vakje.eisen, []);
});

test("vakjeVanUitkomst: basis nee en buiten-scope dragen nooit eisen", () => {
  const nee = vakjeVoor("O14", "1e", "O14", "4e");
  assert.equal(nee.basis, "nee");
  assert.deepEqual(nee.eisen, []);

  const buitenScope = vakjeVoor("O16", "subtop", "O14", "4e");
  assert.equal(buitenScope.basis, "buiten-scope");
  assert.deepEqual(buitenScope.eisen, []);
});

test("vakjeVanUitkomst: de eisen staan altijd in de vaste volgorde aantallen, leeftijd, eerste-team, max2", () => {
  const volgorde = ["aantallen", "leeftijd", "eerste-team", "max2"];
  for (const doelCategorie of CATEGORIEEN) {
    for (const doelKlasse of KLASSEN[doelCategorie]) {
      for (const bronCategorie of CATEGORIEEN) {
        for (const bronKlasse of KLASSEN[bronCategorie]) {
          const vakje = vakjeVoor(bronCategorie, bronKlasse.id, doelCategorie, doelKlasse.id);
          const posities = vakje.eisen.map((eis) => volgorde.indexOf(eis));
          assert.deepEqual(posities, [...posities].sort((a, b) => a - b));
          assert.ok(!posities.includes(-1), `onbekende eis in ${JSON.stringify(vakje.eisen)}`);
        }
      }
    }
  }
});
