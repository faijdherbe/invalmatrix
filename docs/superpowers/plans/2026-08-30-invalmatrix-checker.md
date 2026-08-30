# Invalmatrix invalcheck Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Een statische pagina op GitHub Pages waarop een teammanager bron- en doelteam invult en een groen of rood oordeel krijgt met voorwaarden en de letterlijke artikelteksten uit het Bondsreglement 2026.

**Architecture:** Native ES-modules zonder bundler. `data.js` bevat de seizoensgegevens, `rules.js` bevat pure beoordelingsfuncties zonder DOM-kennis, `articles.js` wordt gegenereerd uit de bron-PDF, `app.js` koppelt formulier aan uitkomst. Tests draaien met `node --test` en importeren `rules.js` rechtstreeks.

**Tech Stack:** Vanilla JavaScript (ES-modules), `node --test` (Node 18 of hoger), `pdftotext` uit poppler-utils voor de artikelextractie. Geen npm-dependencies.

## Global Constraints

- Nederlands in alle uitvoer, code-commentaar en commitberichten. Casual en direct.
- Geen em-dash en geen emoji, in geen enkel bestand.
- Geen npm-dependencies. `package.json` bestaat alleen om `"type": "module"` en het testcommando te zetten.
- Geen build-stap. GitHub Pages serveert de repository-root ongewijzigd.
- Volledige bestanden schrijven in plaats van inline patches.
- Geen uitlijning van assignments over meerdere regels.
- Elke wijziging gaat met tests.
- Seizoen 2026-2027, peildatum 1 oktober 2026, veldhockey, categorie II. Deze waarden staan als constante in `data.js` en nergens anders hardcoded.
- Bestaande bestanden `build.py`, `HANDOVER.md` en `invalmatrix-meisjes-2026-2027.pdf` blijven ongewijzigd.

---

## Bestandsoverzicht

| Bestand | Verantwoordelijkheid |
|---|---|
| `package.json` | `"type": "module"` en `npm test` |
| `data.js` | Seizoensconstanten, categorieen, klassen, niveautabel, categorie I-lijst, leeftijdsgrenzen |
| `rules.js` | `niveau()`, `beoordeelKlasse()`, `beoordeelLeeftijd()`, `assess()`. Puur, kent de DOM niet |
| `articles.js` | Gegenereerd. Letterlijke artikelteksten uit het Bondsreglement |
| `tools/extract-articles.mjs` | Genereert `articles.js` uit `bronnen/bondsreglement-2026.pdf` |
| `test/rules.test.js` | Alle regelvoorbeelden uit reglement en `build.py` |
| `test/articles.test.js` | Bewaakt dat `articles.js` woordelijk gelijk is aan de PDF |
| `index.html` | Formulier en resultaatgebied |
| `app.js` | Vult keuzelijsten, leest formulier, rendert resultaat |
| `style.css` | Opmaak, inclusief mobiel |
| `.nojekyll` | Voorkomt dat GitHub Pages de map door Jekyll haalt |

---

### Task 1: Seizoensgegevens en niveaubepaling

**Files:**
- Create: `package.json`
- Create: `data.js`
- Create: `rules.js`
- Test: `test/rules.test.js`

**Interfaces:**
- Consumes: niets.
- Produces: `data.js` exporteert `SEIZOEN` (string), `PEILDATUM` (Date), `CATEGORIEEN` (string[]), `KLASSEN` (object van categorie naar array van `{id, label}`), `NIVEAU` (object van categorie naar object van klasse-id naar number). `rules.js` exporteert `niveau(categorie, klasseId)` die een number teruggeeft.

- [ ] **Step 1: Schrijf de falende test**

Maak `test/rules.test.js`:

```js
import { test } from "node:test";
import assert from "node:assert/strict";
import { KLASSEN } from "../data.js";
import { niveau } from "../rules.js";

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
```

- [ ] **Step 2: Draai de test en controleer dat hij faalt**

Run: `node --test test/`
Expected: FAIL, met `Cannot find module` voor `../rules.js`.

- [ ] **Step 3: Schrijf package.json**

```json
{
  "name": "invalmatrix",
  "version": "1.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "test": "node --test test/"
  }
}
```

- [ ] **Step 4: Schrijf data.js**

De niveaunummers komen uit de KNHB tabel klassengrenzen veld/zaalhockey 2026-2027, pagina 1. Elk nummer is het rijnummer in die tabel. Lager getal is hoger niveau.

```js
// Seizoensgegevens voor de invalcheck. Alles wat per seizoen wijzigt staat hier.
// Bron 1: KNHB Bondsreglement 2026.
// Bron 2: KNHB Tabel klassengrenzen veld/zaalhockey seizoen 2026-2027.

export const SEIZOEN = "2026-2027";
export const PEILDATUM = new Date(Date.UTC(2026, 9, 1));
export const TAK = "veldhockey";

export const CATEGORIEEN = ["O11", "O12", "O14", "O16", "O18"];

const LAGE_KLASSEN = [
  { id: "5e", label: "5e klasse" },
  { id: "6e", label: "6e klasse" },
  { id: "7e", label: "7e klasse" },
  { id: "8e", label: "8e klasse" },
];

const GEWONE_KLASSEN = [
  { id: "1e", label: "1e klasse" },
  { id: "2e", label: "2e klasse" },
  { id: "3e", label: "3e klasse" },
  { id: "4e", label: "4e klasse" },
];

export const KLASSEN = {
  O11: [...GEWONE_KLASSEN, ...LAGE_KLASSEN],
  O12: [...GEWONE_KLASSEN, ...LAGE_KLASSEN],
  O14: [
    { id: "super", label: "Super O14 / IDC-O14 / Topklasse" },
    { id: "subtop", label: "Subtopklasse" },
    ...GEWONE_KLASSEN,
    ...LAGE_KLASSEN,
  ],
  O16: [
    { id: "landelijk", label: "Landelijk" },
    { id: "super", label: "Super O16 / Topklasse" },
    { id: "subtop", label: "Subtopklasse" },
    ...GEWONE_KLASSEN,
    ...LAGE_KLASSEN,
  ],
  O18: [
    { id: "landelijk", label: "Landelijk" },
    { id: "super", label: "Super O18 / Topklasse" },
    { id: "subtop", label: "Subtopklasse" },
    ...GEWONE_KLASSEN,
    ...LAGE_KLASSEN,
  ],
};

// Rijnummer in de tabel klassengrenzen. De 5e klasse en alles daaronder deelt een rij.
function ladder(start) {
  return {
    "1e": start,
    "2e": start + 1,
    "3e": start + 2,
    "4e": start + 3,
    "5e": start + 4,
    "6e": start + 4,
    "7e": start + 4,
    "8e": start + 4,
  };
}

export const NIVEAU = {
  O11: ladder(7),
  O12: ladder(7),
  O14: { super: 4, subtop: 5, ...ladder(6) },
  O16: { landelijk: 2, super: 3, subtop: 4, ...ladder(5) },
  O18: { landelijk: 1, super: 2, subtop: 3, ...ladder(4) },
};
```

- [ ] **Step 5: Schrijf rules.js**

```js
import { NIVEAU } from "./data.js";

// Absoluut niveau volgens de tabel klassengrenzen. Lager getal is hoger niveau.
export function niveau(categorie, klasseId) {
  const kolom = NIVEAU[categorie];
  if (!kolom) throw new Error(`onbekende categorie: ${categorie}`);
  const rij = kolom[klasseId];
  if (rij === undefined) throw new Error(`onbekende klasse ${klasseId} voor ${categorie}`);
  return rij;
}
```

- [ ] **Step 6: Draai de tests en controleer dat ze slagen**

Run: `node --test test/`
Expected: PASS, 7 tests.

- [ ] **Step 7: Commit**

```bash
git add package.json data.js rules.js test/rules.test.js
git commit -m "feat: niveaubepaling volgens de tabel klassengrenzen"
```

---

### Task 2: Beoordeling op klassenniveau

**Files:**
- Modify: `rules.js`
- Test: `test/rules.test.js`

**Interfaces:**
- Consumes: `niveau(categorie, klasseId)` uit Task 1.
- Produces: `beoordeelKlasse(bron, doel)` waarbij `bron` en `doel` objecten zijn van de vorm `{ categorie, klasse }`. Retourneert `{ toegestaan: boolean, grond: string, voorwaarden: string[], redenering: string[], artikelen: string[] }`. De waarde van `grond` is een van `"gelijk-of-lager"`, `"vijfde-klasse"`, `"een-hoger"`, `"te-hoog"`.

Let op de leesrichting: `bron` is het team waar de speler op de teamlijst staat en dus de speler uitleent. `doel` is het team waarin zij invalt.

- [ ] **Step 1: Schrijf de falende tests**

Werk de importregel voor `rules.js` bovenaan `test/rules.test.js` bij naar:

```js
import { niveau, beoordeelKlasse } from "../rules.js";
```

Voeg daaronder toe:

```js
function check(bronCat, bronKlasse, doelCat, doelKlasse) {
  return beoordeelKlasse(
    { categorie: bronCat, klasse: bronKlasse },
    { categorie: doelCat, klasse: doelKlasse },
  );
}

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
```

- [ ] **Step 2: Draai de tests en controleer dat ze falen**

Run: `node --test test/`
Expected: FAIL, `beoordeelKlasse is not a function` of een importfout.

- [ ] **Step 3: Breid rules.js uit**

Werk eerst de importregel bovenaan `rules.js` bij naar:

```js
import { NIVEAU, KLASSEN } from "./data.js";
```

Voeg daarna onder `niveau()` toe:

```js
const CATEGORIE_VOLGORDE = ["O11", "O12", "O14", "O16", "O18"];

function isVijfdeOfLager(klasseId) {
  return ["5e", "6e", "7e", "8e"].includes(klasseId);
}

function klasseLabel(categorie, klasseId) {
  const gevonden = KLASSEN[categorie].find((k) => k.id === klasseId);
  return gevonden ? gevonden.label : klasseId;
}

function omschrijf(team) {
  return `${team.categorie} ${klasseLabel(team.categorie, team.klasse)}`;
}

// Beoordeelt alleen de klassenregels. De leeftijdstoets zit in beoordeelLeeftijd.
export function beoordeelKlasse(bron, doel) {
  const nBron = niveau(bron.categorie, bron.klasse);
  const nDoel = niveau(doel.categorie, doel.klasse);
  const uitOudereCategorie =
    CATEGORIE_VOLGORDE.indexOf(bron.categorie) > CATEGORIE_VOLGORDE.indexOf(doel.categorie);

  const voorwaarden = [];
  const redenering = [];
  const artikelen = [];

  if (nBron === nDoel) {
    redenering.push(`${omschrijf(bron)} en ${omschrijf(doel)} staan volgens de tabel klassengrenzen op hetzelfde niveau.`);
  } else if (nBron > nDoel) {
    redenering.push(`${omschrijf(bron)} speelt volgens de tabel klassengrenzen ${nBron - nDoel} niveau${nBron - nDoel === 1 ? "" : "s"} lager dan ${omschrijf(doel)}.`);
  } else {
    redenering.push(`${omschrijf(bron)} speelt volgens de tabel klassengrenzen ${nDoel - nBron} niveau${nDoel - nBron === 1 ? "" : "s"} hoger dan ${omschrijf(doel)}.`);
  }

  if (uitOudereCategorie) {
    voorwaarden.push(`De speler moet voldoen aan de leeftijdsgrenzen van ${doel.categorie}, de categorie waarin zij invalt.`);
    artikelen.push("3.1.1", "3.1.3");
    redenering.push(`De speler komt uit een oudere leeftijdscategorie, dus de leeftijdsgrens van ${doel.categorie} is bepalend.`);
  }

  const zelfdeCategorie = bron.categorie === doel.categorie;
  if (zelfdeCategorie && isVijfdeOfLager(bron.klasse) && isVijfdeOfLager(doel.klasse)) {
    voorwaarden.push("Er mogen maximaal twee spelers invallen zonder toestemming van de competitieleiding.");
    artikelen.push("5.3.5.3");
    redenering.push("Beide teams spelen in de 5e klasse of lager binnen dezelfde leeftijdscategorie, dus de uitzondering van artikel 5.3.5.3 geldt.");
    return { toegestaan: true, grond: "vijfde-klasse", voorwaarden, redenering, artikelen };
  }

  if (nBron >= nDoel) {
    artikelen.push("5.3.5.1");
    redenering.push("Lenen uit een team op gelijk of lager niveau mag altijd, ongeacht het aantal eigen spelers.");
    return { toegestaan: true, grond: "gelijk-of-lager", voorwaarden, redenering, artikelen };
  }

  if (nBron === nDoel - 1) {
    const aantal = doel.categorie === "O11" ? 9 : 11;
    voorwaarden.push(`Het invallende team heeft aantoonbaar maximaal ${aantal} spelers beschikbaar uit het eigen of een lager spelend niveau.`);
    voorwaarden.push("Er zijn aantoonbaar geen invallers beschikbaar uit een gelijk of lager spelend niveau.");
    voorwaarden.push("Er mogen maximaal twee spelers invallen, inclusief een vaste doelverdediger.");
    voorwaarden.push("Voor het inlenen van een doelverdediger geldt de eis over het aantal eigen spelers niet.");
    artikelen.push("5.3.5.2");
    redenering.push("Lenen uit een team dat precies een niveau hoger speelt mag alleen als aan alle voorwaarden van artikel 5.3.5.2 is voldaan.");
    return { toegestaan: true, grond: "een-hoger", voorwaarden, redenering, artikelen };
  }

  artikelen.push("5.3.5.2");
  redenering.push("Meer dan een niveau verschil is niet toegestaan zonder dispensatie van de competitieleiding.");
  return { toegestaan: false, grond: "te-hoog", voorwaarden: [], redenering, artikelen };
}
```

- [ ] **Step 4: Draai de tests en controleer dat ze slagen**

Run: `node --test test/`
Expected: PASS, 18 tests.

- [ ] **Step 5: Commit**

```bash
git add rules.js test/rules.test.js
git commit -m "feat: beoordeling op klassenniveau volgens artikel 5.3.5"
```

---

### Task 3: Categorie I buiten scope houden

**Files:**
- Modify: `data.js`
- Modify: `rules.js`
- Test: `test/rules.test.js`

**Interfaces:**
- Consumes: `beoordeelKlasse` uit Task 2.
- Produces: `data.js` exporteert `CATEGORIE_I` en `CATEGORIE_I_PERIODE`. `rules.js` exporteert `categorieIMelding(team)` die `null` of een string teruggeeft.

- [ ] **Step 1: Schrijf de falende tests**

Werk de importregel voor `rules.js` bovenaan `test/rules.test.js` bij naar:

```js
import { niveau, beoordeelKlasse, categorieIMelding } from "../rules.js";
```

Voeg daaronder toe:

```js
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
```

- [ ] **Step 2: Draai de tests en controleer dat ze falen**

Run: `node --test test/`
Expected: FAIL, `categorieIMelding is not a function`.

- [ ] **Step 3: Breid data.js uit**

Voeg onderaan `data.js` toe. De indeling komt uit hoofdstuk 2 van het Bondsreglement 2026, niet uit de sterretjes in de tabel klassengrenzen. De tabel zet geen sterretje bij Landelijk, terwijl het reglement de Landelijke Competitie wel onder categorie I schaart.

```js
// Klassen die volledig onder categorie I vallen, hoofdstuk 4 van het reglement.
// Deze tool dekt alleen categorie II en doet hier geen uitspraak over.
export const CATEGORIE_I = {
  O14: ["super"],
  O16: ["landelijk", "super"],
  O18: ["landelijk", "super"],
};

// Klassen die gedurende het seizoen van categorie wisselen.
export const CATEGORIE_I_PERIODE = {
  O16: { subtop: "tot de winterstop" },
  O18: { subtop: "tot en met de herfstvakantie" },
};
```

- [ ] **Step 4: Breid rules.js uit**

Voeg toe:

```js
// Geeft een uitleg terug als het team buiten categorie II valt, anders null.
export function categorieIMelding(team) {
  const vast = CATEGORIE_I[team.categorie];
  if (vast && vast.includes(team.klasse)) {
    return `${omschrijf(team)} valt onder categorie I, hoofdstuk 4 van het Bondsreglement. Deze tool dekt alleen categorie II en doet hier geen uitspraak over.`;
  }
  const periode = CATEGORIE_I_PERIODE[team.categorie];
  if (periode && periode[team.klasse]) {
    return `${omschrijf(team)} valt ${periode[team.klasse]} onder categorie I, hoofdstuk 4 van het Bondsreglement, en daarna onder categorie II. Deze tool weet niet in welke periode de wedstrijd valt en doet hier geen uitspraak over.`;
  }
  return null;
}
```

Werk de import bovenaan `rules.js` bij naar:

```js
import { NIVEAU, KLASSEN, CATEGORIE_I, CATEGORIE_I_PERIODE } from "./data.js";
```

- [ ] **Step 5: Draai de tests en controleer dat ze slagen**

Run: `node --test test/`
Expected: PASS, 23 tests.

- [ ] **Step 6: Commit**

```bash
git add data.js rules.js test/rules.test.js
git commit -m "feat: klassen uit categorie I krijgen geen oordeel maar uitleg"
```

---

### Task 4: Leeftijdstoets

**Files:**
- Modify: `data.js`
- Modify: `rules.js`
- Test: `test/rules.test.js`

**Interfaces:**
- Consumes: `PEILDATUM` uit Task 1.
- Produces: `data.js` exporteert `LEEFTIJDSGRENZEN` (object van categorie naar `{ min, max }` leeftijd op de peildatum). `rules.js` exporteert `leeftijdOpPeildatum(geboortedatum)` die een number teruggeeft, en `beoordeelLeeftijd(bron, doel, geboortedatum)` die `{ leeftijd, blokkeert, meldingen, artikelen }` teruggeeft.

- [ ] **Step 1: Schrijf de falende tests**

Werk de importregel voor `rules.js` bovenaan `test/rules.test.js` bij naar:

```js
import {
  niveau,
  beoordeelKlasse,
  categorieIMelding,
  leeftijdOpPeildatum,
  beoordeelLeeftijd,
} from "../rules.js";
```

Voeg daaronder toe:

```js
const d = (s) => new Date(`${s}T00:00:00Z`);

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

test("een speler die te jong is voor de doelcategorie heeft dispensatie nodig", () => {
  const r = beoordeelLeeftijd(
    { categorie: "O11", klasse: "1e" },
    { categorie: "O14", klasse: "4e" },
    d("2016-05-01"),
  );
  assert.equal(r.blokkeert, true);
  assert.ok(r.meldingen.some((m) => /dispensatie/.test(m)));
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
```

- [ ] **Step 2: Draai de tests en controleer dat ze falen**

Run: `node --test test/`
Expected: FAIL, `leeftijdOpPeildatum is not a function`.

- [ ] **Step 3: Breid data.js uit**

```js
// Leeftijd op de peildatum, artikel 3.1.1 van het Bondsreglement 2026.
export const LEEFTIJDSGRENZEN = {
  O11: { min: 10, max: 10 },
  O12: { min: 11, max: 11 },
  O14: { min: 12, max: 13 },
  O16: { min: 14, max: 15 },
  O18: { min: 16, max: 17 },
};

// Artikel 5.2.4 geldt voor deze categorieen, in de 2e klasse en lager.
export const OUDERE_SPELER_UITZONDERING = {
  categorieen: ["O12", "O14", "O16", "O18"],
  klassen: ["2e", "3e", "4e", "5e", "6e", "7e", "8e"],
};
```

- [ ] **Step 4: Breid rules.js uit**

```js
export function leeftijdOpPeildatum(geboortedatum) {
  let leeftijd = PEILDATUM.getUTCFullYear() - geboortedatum.getUTCFullYear();
  const maandVerschil = PEILDATUM.getUTCMonth() - geboortedatum.getUTCMonth();
  const dagVerschil = PEILDATUM.getUTCDate() - geboortedatum.getUTCDate();
  if (maandVerschil < 0 || (maandVerschil === 0 && dagVerschil < 0)) leeftijd -= 1;
  return leeftijd;
}

export function beoordeelLeeftijd(bron, doel, geboortedatum) {
  const leeftijd = leeftijdOpPeildatum(geboortedatum);
  const meldingen = [];
  const artikelen = [];
  let blokkeert = false;

  const grensDoel = LEEFTIJDSGRENZEN[doel.categorie];
  if (leeftijd > grensDoel.max) {
    blokkeert = true;
    meldingen.push(`Op 1 oktober 2026 is de speler ${leeftijd} jaar en daarmee te oud voor ${doel.categorie}, waar de grens ${grensDoel.max} jaar is. Uitkomen in een categorie waarin zij volgens de leeftijdsgrenzen niet past mag alleen met dispensatie van de competitieleiding.`);
    artikelen.push("3.1.1", "3.1.3");
  } else if (leeftijd < grensDoel.min) {
    blokkeert = true;
    meldingen.push(`Op 1 oktober 2026 is de speler ${leeftijd} jaar en daarmee te jong voor ${doel.categorie}, waar de ondergrens ${grensDoel.min} jaar is. Dit mag alleen met dispensatie van de competitieleiding.`);
    artikelen.push("3.1.1", "3.1.3");
  } else {
    meldingen.push(`Op 1 oktober 2026 is de speler ${leeftijd} jaar en past daarmee binnen ${doel.categorie}.`);
  }

  const grensBron = LEEFTIJDSGRENZEN[bron.categorie];
  const valtOnderUitzondering =
    OUDERE_SPELER_UITZONDERING.categorieen.includes(bron.categorie) &&
    OUDERE_SPELER_UITZONDERING.klassen.includes(bron.klasse) &&
    leeftijd === grensBron.max + 1;
  if (valtOnderUitzondering) {
    blokkeert = true;
    meldingen.push(`De speler is een jaar ouder dan de grens van ${bron.categorie}. Zij kan op de teamlijst staan als een van de twee spelers die volgens artikel 5.2.4 maximaal een jaar ouder mogen zijn, maar die spelers mogen uitsluitend uitkomen voor het team waarop zij op de teamlijst staan en dus nooit invallen.`);
    artikelen.push("5.2.4");
  }

  if (geboortedatum.getUTCMonth() === 9 && geboortedatum.getUTCDate() === 1) {
    meldingen.push("Deze geboortedatum valt precies op 1 oktober. Het reglement gebruikt 'voor 1 oktober' en 'op 1 oktober' door elkaar, dus dit is een randgeval. Leg dit voor aan de competitieleiding.");
  }

  return { leeftijd, blokkeert, meldingen, artikelen };
}
```

Werk de import bovenaan `rules.js` bij naar:

```js
import {
  NIVEAU,
  KLASSEN,
  CATEGORIE_I,
  CATEGORIE_I_PERIODE,
  LEEFTIJDSGRENZEN,
  OUDERE_SPELER_UITZONDERING,
  PEILDATUM,
} from "./data.js";
```

- [ ] **Step 5: Draai de tests en controleer dat ze slagen**

Run: `node --test test/`
Expected: PASS, 30 tests.

- [ ] **Step 6: Commit**

```bash
git add data.js rules.js test/rules.test.js
git commit -m "feat: leeftijdstoets inclusief de uitzondering van artikel 5.2.4"
```

---

### Task 5: assess() als enige ingang

**Files:**
- Modify: `rules.js`
- Test: `test/rules.test.js`

**Interfaces:**
- Consumes: `categorieIMelding`, `beoordeelKlasse`, `beoordeelLeeftijd`.
- Produces: `assess(bron, doel, geboortedatum)` waarbij `geboortedatum` een `Date` of `null` is. Retourneert `{ verdict, samenvatting, voorwaarden, redenering, leeftijd, artikelen }` met `verdict` uit `"toegestaan"`, `"niet-toegestaan"`, `"buiten-scope"`. `artikelen` is ontdubbeld en gesorteerd. Dit is de enige functie die `app.js` aanroept.

- [ ] **Step 1: Schrijf de falende tests**

Werk de importregel voor `rules.js` bovenaan `test/rules.test.js` bij naar:

```js
import {
  niveau,
  beoordeelKlasse,
  categorieIMelding,
  leeftijdOpPeildatum,
  beoordeelLeeftijd,
  assess,
} from "../rules.js";
```

Voeg daaronder toe:

```js
test("assess geeft buiten-scope voor categorie I, ook als maar een van beide teams erin valt", () => {
  const r = assess({ categorie: "O18", klasse: "landelijk" }, { categorie: "O18", klasse: "1e" }, null);
  assert.equal(r.verdict, "buiten-scope");
  assert.equal(r.voorwaarden.length, 0);
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
```

- [ ] **Step 2: Draai de tests en controleer dat ze falen**

Run: `node --test test/`
Expected: FAIL, `assess is not a function`.

- [ ] **Step 3: Breid rules.js uit**

```js
// De enige functie die de gebruikersinterface aanroept.
export function assess(bron, doel, geboortedatum) {
  const buitenScope = categorieIMelding(bron) || categorieIMelding(doel);
  if (buitenScope) {
    return {
      verdict: "buiten-scope",
      samenvatting: buitenScope,
      voorwaarden: [],
      redenering: [],
      leeftijd: null,
      artikelen: [],
    };
  }

  const klasse = beoordeelKlasse(bron, doel);
  const leeftijd = geboortedatum ? beoordeelLeeftijd(bron, doel, geboortedatum) : null;
  const toegestaan = klasse.toegestaan && !(leeftijd && leeftijd.blokkeert);
  const artikelen = [...new Set([...klasse.artikelen, ...(leeftijd ? leeftijd.artikelen : [])])].sort();

  let samenvatting;
  if (!klasse.toegestaan) {
    samenvatting = `Nee. ${omschrijf(bron)} speelt te veel niveaus hoger dan ${omschrijf(doel)}. Dit mag alleen met dispensatie van de competitieleiding.`;
  } else if (leeftijd && leeftijd.blokkeert) {
    samenvatting = `Nee. De klassengrens staat het toe, maar de leeftijd van de speler niet.`;
  } else if (klasse.voorwaarden.length > 0) {
    samenvatting = `Ja, mits aan de voorwaarden hieronder is voldaan.`;
  } else {
    samenvatting = `Ja. Een speler uit ${omschrijf(bron)} mag invallen in ${omschrijf(doel)}.`;
  }

  return {
    verdict: toegestaan ? "toegestaan" : "niet-toegestaan",
    samenvatting,
    voorwaarden: klasse.toegestaan ? klasse.voorwaarden : [],
    redenering: klasse.redenering,
    leeftijd,
    artikelen,
  };
}
```

- [ ] **Step 4: Draai de tests en controleer dat ze slagen**

Run: `node --test test/`
Expected: PASS, 35 tests.

- [ ] **Step 5: Commit**

```bash
git add rules.js test/rules.test.js
git commit -m "feat: assess als enige ingang voor de beoordeling"
```

---

### Task 6: Letterlijke artikelteksten uit het reglement

**Files:**
- Create: `tools/extract-articles.mjs`
- Create: `articles.js` (gegenereerd, wel committen)
- Test: `test/articles.test.js`

**Interfaces:**
- Consumes: `bronnen/bondsreglement-2026.pdf`.
- Produces: `articles.js` exporteert `ARTIKELEN`, een object van artikelnummer naar `{ titel, tekst }`. `tekst` is de letterlijke tekst van het sub-artikel met behouden regeleindes.

Achtergrond: `pdftotext -layout` levert de tekst met formfeeds op paginabreuken en een voettekst `KNHB Bondsreglement <nummer>` op elke pagina. Kopregels zien eruit als `5.3.5.2 Invallers vanuit een hoger spelend niveau`. De inhoudsopgave bevat dezelfde nummers maar met puntjeslijnen, die filteren we op `....`. De titel van artikel 5.3.3 loopt in de PDF over twee regels en krijgt daarom een expliciete correctie.

- [ ] **Step 1: Controleer dat pdftotext beschikbaar is**

Run: `pdftotext -v`
Expected: versieregel van poppler. Zo niet: `sudo apt install poppler-utils`.

- [ ] **Step 2: Schrijf tools/extract-articles.mjs**

```js
// Genereert articles.js uit het Bondsreglement. Draaien met: node tools/extract-articles.mjs
// De artikelteksten worden letterlijk overgenomen, alleen paginavoetteksten en formfeeds
// worden verwijderd. test/articles.test.js bewaakt dat dit zo blijft.
import { execFileSync } from "node:child_process";
import { writeFileSync } from "node:fs";

export const PDF = "bronnen/bondsreglement-2026.pdf";

export const GEWENST = [
  "3.1.1",
  "3.1.3",
  "5.2.4",
  "5.2.5",
  "5.3.1",
  "5.3.2",
  "5.3.3",
  "5.3.4",
  "5.3.5",
  "5.3.5.1",
  "5.3.5.2",
  "5.3.5.3",
  "5.3.5.4",
];

// Titels die in de PDF over meerdere regels lopen en dus niet volledig uit de kopregel komen.
const TITEL_CORRECTIE = {
  "5.3.3": "Niveaubepaling niet clubgebonden speler en clubgebonden speler zonder teamlijst",
};

export function leesRegels(pdf = PDF) {
  const ruw = execFileSync("pdftotext", ["-layout", pdf, "-"], { encoding: "utf8", maxBuffer: 32 * 1024 * 1024 });
  return ruw
    .replace(/\f/g, "")
    .split("\n")
    .filter((regel) => !/KNHB Bondsreglement \d+\s*$/.test(regel))
    .map((regel) => regel.replace(/\s+$/, ""));
}

export function extraheer(regels) {
  const KOP = /^(\d+(?:\.\d+)+)\s+(\S.*)$/;
  const koppen = [];
  regels.forEach((regel, index) => {
    const match = regel.match(KOP);
    if (match && !match[2].includes("....")) {
      koppen.push({ index, nummer: match[1], titel: match[2] });
    }
  });

  const artikelen = {};
  for (const nummer of GEWENST) {
    const gevonden = koppen.filter((kop) => kop.nummer === nummer);
    if (gevonden.length !== 1) {
      throw new Error(`artikel ${nummer}: ${gevonden.length} koppen gevonden, verwacht er precies 1`);
    }
    const kop = gevonden[0];
    const volgende = koppen.find((andere) => andere.index > kop.index);
    const eind = volgende ? volgende.index : regels.length;
    const tekst = regels
      .slice(kop.index + 1, eind)
      .join("\n")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
    if (tekst.length === 0) throw new Error(`artikel ${nummer} heeft geen tekst`);
    artikelen[nummer] = { titel: TITEL_CORRECTIE[nummer] || kop.titel, tekst };
  }
  return artikelen;
}

function schrijf(artikelen) {
  const kop = [
    "// Gegenereerd door tools/extract-articles.mjs. Niet met de hand aanpassen.",
    "// Bron: bronnen/bondsreglement-2026.pdf, KNHB Bondsreglement 2026.",
    "",
    "export const ARTIKELEN = ",
  ].join("\n");
  writeFileSync("articles.js", `${kop}${JSON.stringify(artikelen, null, 2)};\n`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const artikelen = extraheer(leesRegels());
  schrijf(artikelen);
  console.log(`${Object.keys(artikelen).length} artikelen geschreven naar articles.js`);
}
```

- [ ] **Step 3: Draai het script**

Run: `node tools/extract-articles.mjs`
Expected: `13 artikelen geschreven naar articles.js`

- [ ] **Step 4: Controleer met het oog dat de tekst klopt**

Run: `node -e 'import("./articles.js").then(m => console.log(m.ARTIKELEN["5.3.5.2"].tekst))'`
Expected: de volledige tekst van artikel 5.3.5.2, beginnend met "Spelers lenen uit een hoger spelend team mag alleen als aan alle volgende regels wordt voldaan:" en eindigend met "doelverdediger, die maximaal een klasse hoger spelen." met de juiste accenten op "een".

- [ ] **Step 5: Schrijf de bewakende test**

Maak `test/articles.test.js`:

```js
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
```

- [ ] **Step 6: Draai de tests en controleer dat ze slagen**

Run: `node --test test/`
Expected: PASS, 38 tests.

- [ ] **Step 7: Commit**

```bash
git add tools/extract-articles.mjs articles.js test/articles.test.js
git commit -m "feat: letterlijke artikelteksten uit het reglement met bewakende test"
```

---

### Task 7: Overzicht van wat er bij een team mag invallen

**Files:**
- Modify: `data.js`
- Modify: `rules.js`
- Test: `test/rules.test.js`

**Interfaces:**
- Consumes: `assess`, `KLASSEN`, `CATEGORIEEN`.
- Produces: `data.js` exporteert `KOLOMMEN`, de klassen die in het raster een kolom krijgen, van hoog
  naar laag niveau. `rules.js` exporteert `overzicht(doel)` die een array van rijen teruggeeft, een
  per leeftijdscategorie, elk met een array vakjes in de volgorde van `KOLOMMEN`.

Achtergrond: de pagina toont na het kiezen van een doelteam een raster met daarin per
leeftijdscategorie en klasse of daar iets vandaan mag komen. Deze taak levert de gegevens voor dat
raster. Alle regelkennis blijft in `rules.js`, `app.js` rekent niets zelf uit.

`KOLOMMEN` bevat niet de klassen `landelijk` en `super`. Die vallen altijd onder categorie I, dus
elk vakje daar zou hetzelfde nietszeggende antwoord geven. De pagina noemt ze in een voetnoot.
`subtop` staat er wel in, want bij O14 valt die onder categorie II en krijgt dus een echt oordeel.
De klasse `top` staat er ook in, die bestaat alleen bij O14.

- [ ] **Step 1: Schrijf de falende tests**

Werk de importregel voor `rules.js` bovenaan `test/rules.test.js` bij zodat `overzicht` erbij staat,
en die voor `data.js` zodat `KOLOMMEN` en `CATEGORIEEN` erbij staan. Voeg daaronder toe:

```js
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
  assert.equal(vijfde.voorwaardelijk, false);
});

test("overzicht laat zien dat een klasse hoger onder voorwaarden mag", () => {
  const rijen = overzicht({ categorie: "O14", klasse: "4e" });
  const o14 = rijen.find((r) => r.categorie === "O14");
  const derde = o14.vakjes.find((v) => v.klasse === "3e");
  assert.equal(derde.verdict, "toegestaan");
  assert.equal(derde.voorwaardelijk, true);
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
```

- [ ] **Step 2: Draai de tests en controleer dat ze falen**

Run: `node --test test/`
Expected: FAIL, `overzicht is not a function` of een importfout op `KOLOMMEN`.

- [ ] **Step 3: Voeg KOLOMMEN toe aan data.js**

Zet dit onder `KLASSEN`:

```js
// De klassen die een kolom krijgen in het overzichtsraster, van hoog naar laag niveau.
// landelijk en super staan er niet in: die vallen altijd onder categorie I, dus daar zou elk
// vakje hetzelfde nietszeggende antwoord geven. De pagina noemt ze in een voetnoot.
export const KOLOMMEN = ["top", "subtop", "1e", "2e", "3e", "4e", "5e", "6e", "7e", "8e"];
```

- [ ] **Step 4: Voeg overzicht toe aan rules.js**

```js
// Bouwt de gegevens voor het overzichtsraster: per leeftijdscategorie een rij, per kolom een vakje.
// Een vakje zonder geboortedatum, want het raster toont wat er op klassenniveau mogelijk is.
export function overzicht(doel) {
  return CATEGORIEEN.map((categorie) => ({
    categorie,
    vakjes: KOLOMMEN.map((kolom) => {
      const klasse = KLASSEN[categorie].find((k) => k.id === kolom);
      if (!klasse) return { klasse: kolom, bestaat: false };
      const uitkomst = assess({ categorie, klasse: kolom }, doel, null);
      return {
        klasse: kolom,
        label: klasse.label,
        bestaat: true,
        verdict: uitkomst.verdict,
        voorwaardelijk: uitkomst.voorwaarden.length > 0,
      };
    }),
  }));
}
```

Werk de importregel bovenaan `rules.js` bij zodat `CATEGORIEEN` en `KOLOMMEN` erbij staan.

- [ ] **Step 5: Draai de tests en controleer dat ze slagen**

Run: `node --test test/`
Expected: PASS, alle bestaande tests plus de elf nieuwe.

- [ ] **Step 6: Commit**

```bash
git add data.js rules.js test/rules.test.js
git commit -m "feat: overzicht van wat er bij een team mag invallen"
```

---

### Task 8: De pagina

**Files:**
- Create: `index.html`
- Create: `app.js`
- Create: `style.css`
- Create: `.nojekyll`

**Interfaces:**
- Consumes: `assess` en `overzicht` uit `rules.js`, `CATEGORIEEN`, `KLASSEN`, `KOLOMMEN`, `SEIZOEN`,
  `TAK` uit `data.js`, `ARTIKELEN` uit `articles.js`.
- Produces: niets voor latere taken.

De flow volgt de vraag die de teammanager echt heeft. Hij heeft een gat in een team en zoekt wie dat
mag vullen, dus het doelteam komt eerst.

1. Bovenaan kiest hij het team waar ingevallen moet worden: leeftijdscategorie en klasse.
2. Daaronder verschijnt het raster met wat daar vandaan mag komen.
3. Klikt hij op een vakje, dan verschijnt eronder het volledige oordeel, met een veld voor de
   geboortedatum en de letterlijke artikelteksten.

- [ ] **Step 1: Schrijf index.html**

```html
<!doctype html>
<html lang="nl">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Invalmatrix</title>
<link rel="stylesheet" href="style.css">
</head>
<body>
<header>
  <h1>Invalmatrix</h1>
  <p class="context" id="context"></p>
</header>

<main>
  <section class="stap">
    <h2>Bij welk team moet er worden ingevallen?</h2>
    <div class="keuzes">
      <label>Leeftijdscategorie
        <select id="doel-categorie"></select>
      </label>
      <label>Klasse
        <select id="doel-klasse"></select>
      </label>
    </div>
  </section>

  <section class="stap">
    <h2>Wie mag daar invallen?</h2>
    <div id="raster" aria-live="polite"></div>
    <p class="voetnoot" id="raster-voetnoot"></p>
  </section>

  <section class="stap" id="detail-blok" hidden>
    <h2 id="detail-kop"></h2>
    <label class="geboorte">Geboortedatum van de speler (optioneel)
      <input type="date" id="geboortedatum">
    </label>
    <div id="resultaat" aria-live="polite"></div>
  </section>
</main>

<footer>
  <p>Deze pagina beoordeelt alleen veldhockey in categorie II van het Bondsreglement, voor de
  leeftijdscategorieen O11 tot en met O18. Zaalhockey, senioren, O25, 30+, 45+, reserveteams,
  combiteams en categorie I vallen erbuiten. Bij twijfel beslist de competitieleiding.</p>
  <p>Bronnen:
    <a href="bronnen/bondsreglement-2026.pdf">KNHB Bondsreglement 2026</a> en
    <a href="bronnen/tabel-klassengrenzen-veld-zaal-2026-2027.pdf">Tabel klassengrenzen 2026-2027</a>.
  </p>
</footer>

<script type="module" src="app.js"></script>
</body>
</html>
```

- [ ] **Step 2: Schrijf app.js**

```js
import { CATEGORIEEN, KLASSEN, KOLOMMEN, SEIZOEN, TAK } from "./data.js";
import { assess, overzicht, categorieIMelding } from "./rules.js";
import { ARTIKELEN } from "./articles.js";

const doelCategorie = document.getElementById("doel-categorie");
const doelKlasse = document.getElementById("doel-klasse");
const raster = document.getElementById("raster");
const rasterVoetnoot = document.getElementById("raster-voetnoot");
const detailBlok = document.getElementById("detail-blok");
const detailKop = document.getElementById("detail-kop");
const geboortedatum = document.getElementById("geboortedatum");
const resultaat = document.getElementById("resultaat");

let gekozenBron = null;

document.getElementById("context").textContent = `Seizoen ${SEIZOEN}, ${TAK}, categorie II`;

function escape(tekst) {
  const div = document.createElement("div");
  div.textContent = tekst;
  return div.innerHTML;
}

function label(categorie, klasseId) {
  const gevonden = KLASSEN[categorie].find((k) => k.id === klasseId);
  return gevonden ? gevonden.label : klasseId;
}

function vulCategorieen() {
  for (const categorie of CATEGORIEEN) {
    const optie = document.createElement("option");
    optie.value = categorie;
    optie.textContent = categorie;
    doelCategorie.append(optie);
  }
  doelCategorie.value = "O14";
}

function vulKlassen() {
  const huidige = doelKlasse.value;
  doelKlasse.innerHTML = "";
  for (const klasse of KLASSEN[doelCategorie.value]) {
    const optie = document.createElement("option");
    optie.value = klasse.id;
    optie.textContent = klasse.label;
    doelKlasse.append(optie);
  }
  const bestaat = KLASSEN[doelCategorie.value].some((k) => k.id === huidige);
  doelKlasse.value = bestaat ? huidige : "4e";
}

function huidigDoel() {
  return { categorie: doelCategorie.value, klasse: doelKlasse.value };
}

function kolomLabel(kolom) {
  if (kolom === "top") return "Top";
  if (kolom === "subtop") return "Subtop";
  return kolom;
}

function vakjeKlasse(vakje) {
  if (!vakje.bestaat) return "leeg";
  if (vakje.verdict === "buiten-scope") return "buiten-scope";
  if (vakje.verdict === "niet-toegestaan") return "nee";
  return vakje.voorwaardelijk ? "mits" : "ja";
}

function vakjeTekst(vakje) {
  if (!vakje.bestaat) return "";
  if (vakje.verdict === "buiten-scope") return "?";
  if (vakje.verdict === "niet-toegestaan") return "nee";
  return vakje.voorwaardelijk ? "mits" : "ja";
}

function toonRaster() {
  const doel = huidigDoel();
  const melding = categorieIMelding(doel);
  if (melding) {
    raster.innerHTML = `<p class="buiten-scope-melding">${escape(melding)}</p>`;
    rasterVoetnoot.textContent = "";
    verbergDetail();
    return;
  }

  const rijen = overzicht(doel);
  const koppen = KOLOMMEN.map((kolom) => `<th scope="col">${escape(kolomLabel(kolom))}</th>`).join("");
  const lichaam = rijen
    .map((rij) => {
      const cellen = rij.vakjes
        .map((vakje) => {
          const soort = vakjeKlasse(vakje);
          if (!vakje.bestaat) return `<td class="vakje leeg"></td>`;
          const titel = `${rij.categorie} ${vakje.label}`;
          return `<td class="vakje ${soort}"><button type="button" data-categorie="${escape(rij.categorie)}" data-klasse="${escape(vakje.klasse)}" title="${escape(titel)}">${escape(vakjeTekst(vakje))}</button></td>`;
        })
        .join("");
      return `<tr><th scope="row">${escape(rij.categorie)}</th>${cellen}</tr>`;
    })
    .join("");

  raster.innerHTML = `<div class="raster-schuif"><table>
<thead><tr><th scope="col">Komt uit</th>${koppen}</tr></thead>
<tbody>${lichaam}</tbody>
</table></div>
<p class="legenda">
<span class="ja">ja</span> mag altijd
<span class="mits">mits</span> mag onder voorwaarden
<span class="nee">nee</span> mag niet
<span class="buiten-scope">?</span> geen uitspraak
</p>`;

  rasterVoetnoot.textContent =
    "De Landelijke Competitie en de Super- en Topklasse van O16 en O18, en de Super Competitie en IDC van O14, staan niet in dit raster. Die vallen onder categorie I en daar doet deze pagina geen uitspraak over. Klik op een vakje voor de onderbouwing.";

  for (const knop of raster.querySelectorAll("button[data-categorie]")) {
    knop.addEventListener("click", () => {
      gekozenBron = { categorie: knop.dataset.categorie, klasse: knop.dataset.klasse };
      markeerGekozen();
      toonDetail();
    });
  }

  if (gekozenBron && !KLASSEN[gekozenBron.categorie].some((k) => k.id === gekozenBron.klasse)) {
    gekozenBron = null;
  }
  if (gekozenBron) {
    markeerGekozen();
    toonDetail();
  } else {
    verbergDetail();
  }
}

function markeerGekozen() {
  for (const knop of raster.querySelectorAll("button[data-categorie]")) {
    const actief =
      gekozenBron &&
      knop.dataset.categorie === gekozenBron.categorie &&
      knop.dataset.klasse === gekozenBron.klasse;
    knop.parentElement.classList.toggle("gekozen", Boolean(actief));
  }
}

function verbergDetail() {
  detailBlok.hidden = true;
  resultaat.innerHTML = "";
}

function lijst(titel, regels) {
  if (regels.length === 0) return "";
  const items = regels.map((regel) => `<li>${escape(regel)}</li>`).join("");
  return `<h3>${titel}</h3><ul>${items}</ul>`;
}

function artikelBlok(nummers) {
  if (nummers.length === 0) return "";
  const items = nummers
    .map((nummer) => {
      const artikel = ARTIKELEN[nummer];
      if (!artikel) return "";
      return `<details><summary>Artikel ${escape(nummer)}: ${escape(artikel.titel)}</summary><pre>${escape(artikel.tekst)}</pre></details>`;
    })
    .join("");
  return `<h3>De artikelen zelf</h3>${items}`;
}

function toonDetail() {
  if (!gekozenBron) return;
  const doel = huidigDoel();
  detailBlok.hidden = false;
  detailKop.textContent = `Een speler uit ${gekozenBron.categorie} ${label(gekozenBron.categorie, gekozenBron.klasse)} laten invallen in ${doel.categorie} ${label(doel.categorie, doel.klasse)}`;

  const ingevoerd = geboortedatum.value;
  const datum = ingevoerd ? new Date(`${ingevoerd}T00:00:00Z`) : null;
  const uitkomst = assess(gekozenBron, doel, datum);

  resultaat.className = uitkomst.verdict;
  resultaat.innerHTML = [
    `<p class="oordeel">${escape(uitkomst.samenvatting)}</p>`,
    lijst("Voorwaarden", uitkomst.voorwaarden),
    uitkomst.leeftijd ? lijst("Leeftijd", uitkomst.leeftijd.meldingen) : "",
    lijst("Waarom", uitkomst.redenering),
    artikelBlok(uitkomst.artikelen),
  ].join("");
}

vulCategorieen();
vulKlassen();
toonRaster();

doelCategorie.addEventListener("change", () => {
  vulKlassen();
  toonRaster();
});
doelKlasse.addEventListener("change", toonRaster);
geboortedatum.addEventListener("change", toonDetail);
```

- [ ] **Step 3: Schrijf style.css**

```css
:root {
  --groen: #1b7f3b;
  --groen-vlak: #e4f4e9;
  --geel: #8a6100;
  --geel-vlak: #fdf3d7;
  --rood: #b3261e;
  --rood-vlak: #fbe9e7;
  --grijs: #5b5b5b;
  --grijs-vlak: #eeeeee;
  --rand: #cfcfcf;
}

* { box-sizing: border-box; }

body {
  margin: 0 auto;
  padding: 1.5rem 1rem 3rem;
  max-width: 52rem;
  font: 16px/1.55 system-ui, -apple-system, "Segoe UI", sans-serif;
  color: #1a1a1a;
}

h1 { margin: 0 0 0.25rem; font-size: 1.6rem; }

.context {
  margin: 0 0 1.5rem;
  color: var(--grijs);
  font-size: 0.9rem;
}

.stap { margin-bottom: 2rem; }

.stap h2 {
  margin: 0 0 0.75rem;
  font-size: 1.05rem;
}

.keuzes {
  display: flex;
  gap: 1rem;
  flex-wrap: wrap;
}

label {
  display: block;
  font-size: 0.9rem;
}

select, input {
  display: block;
  margin-top: 0.25rem;
  padding: 0.45rem 0.5rem;
  min-width: 12rem;
  border: 1px solid var(--rand);
  border-radius: 4px;
  font: inherit;
  background: #fff;
}

.raster-schuif { overflow-x: auto; }

table {
  border-collapse: collapse;
  font-size: 0.85rem;
}

th, td {
  border: 1px solid var(--rand);
  text-align: center;
}

thead th, tbody th {
  padding: 0.35rem 0.5rem;
  background: var(--grijs-vlak);
  font-weight: 600;
  white-space: nowrap;
}

.vakje { padding: 0; }

.vakje button {
  display: block;
  padding: 0.4rem 0.3rem;
  width: 100%;
  min-width: 3.1rem;
  border: 0;
  background: none;
  font: inherit;
  font-size: 0.78rem;
  cursor: pointer;
}

.vakje.ja { background: var(--groen-vlak); color: var(--groen); }
.vakje.mits { background: var(--geel-vlak); color: var(--geel); }
.vakje.nee { background: var(--rood-vlak); color: var(--rood); }
.vakje.buiten-scope { background: var(--grijs-vlak); color: var(--grijs); }
.vakje.leeg { background: repeating-linear-gradient(45deg, #fff, #fff 4px, #f4f4f4 4px, #f4f4f4 8px); }

.vakje.gekozen { outline: 3px solid #1a1a1a; outline-offset: -3px; }

.legenda {
  margin: 0.6rem 0 0;
  color: var(--grijs);
  font-size: 0.8rem;
}

.legenda span {
  margin-left: 0.9rem;
  margin-right: 0.15rem;
  padding: 0.1rem 0.35rem;
  border-radius: 3px;
  font-weight: 600;
}

.legenda span:first-child { margin-left: 0; }
.legenda .ja { background: var(--groen-vlak); color: var(--groen); }
.legenda .mits { background: var(--geel-vlak); color: var(--geel); }
.legenda .nee { background: var(--rood-vlak); color: var(--rood); }
.legenda .buiten-scope { background: var(--grijs-vlak); color: var(--grijs); }

.voetnoot, .buiten-scope-melding {
  margin: 0.75rem 0 0;
  color: var(--grijs);
  font-size: 0.85rem;
}

.buiten-scope-melding {
  padding: 0.9rem 1.1rem;
  border-left: 5px solid var(--grijs);
  border-radius: 4px;
  background: var(--grijs-vlak);
  color: #1a1a1a;
  font-size: 1rem;
}

.geboorte { margin-bottom: 1rem; }

#resultaat {
  padding: 1rem 1.25rem;
  border-left: 5px solid var(--grijs);
  border-radius: 4px;
  background: var(--grijs-vlak);
}

#resultaat.toegestaan { border-color: var(--groen); background: var(--groen-vlak); }
#resultaat.niet-toegestaan { border-color: var(--rood); background: var(--rood-vlak); }

.oordeel { margin: 0; font-size: 1.15rem; font-weight: 600; }

#resultaat h3 {
  margin: 1.25rem 0 0.4rem;
  font-size: 0.8rem;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--grijs);
}

#resultaat ul { margin: 0; padding-left: 1.2rem; }
#resultaat li { margin-bottom: 0.35rem; }

details {
  margin-bottom: 0.4rem;
  padding: 0.5rem 0.7rem;
  border: 1px solid var(--rand);
  border-radius: 4px;
  background: #fff;
}

summary { cursor: pointer; font-weight: 600; font-size: 0.92rem; }

details pre {
  margin: 0.7rem 0 0.2rem;
  font: 0.85rem/1.5 ui-monospace, "SF Mono", Menlo, Consolas, monospace;
  white-space: pre-wrap;
}

footer {
  margin-top: 2.5rem;
  padding-top: 1rem;
  border-top: 1px solid var(--rand);
  color: var(--grijs);
  font-size: 0.85rem;
}
```

- [ ] **Step 4: Maak .nojekyll**

```bash
touch .nojekyll
```

- [ ] **Step 5: Controleer dat de pagina laadt zonder fouten**

Start een server: `python3 -m http.server 8000`

Controleer met curl dat de bestanden geserveerd worden en dat de modules bestaan:

```bash
curl -sf http://localhost:8000/ > /dev/null && echo "index ok"
curl -sf http://localhost:8000/app.js > /dev/null && echo "app ok"
curl -sf http://localhost:8000/rules.js > /dev/null && echo "rules ok"
curl -sf http://localhost:8000/data.js > /dev/null && echo "data ok"
curl -sf http://localhost:8000/articles.js > /dev/null && echo "articles ok"
curl -sf http://localhost:8000/bronnen/bondsreglement-2026.pdf > /dev/null && echo "pdf ok"
```

Alle zes moeten "ok" melden. Stop de server daarna.

Controleer daarnaast dat `app.js` alleen dingen importeert die ook echt bestaan:

```bash
node -e 'import("./rules.js").then(m => console.log(["assess","overzicht","categorieIMelding"].map(n => n + ": " + typeof m[n]).join(", ")))'
node -e 'import("./data.js").then(m => console.log(["CATEGORIEEN","KLASSEN","KOLOMMEN","SEIZOEN","TAK"].map(n => n + ": " + (m[n] === undefined ? "ONTBREEKT" : "ok")).join(", ")))'
```

Geen enkele mag ONTBREEKT of undefined melden.

- [ ] **Step 6: Draai alle tests nog een keer**

Run: `node --test test/`
Expected: PASS, alle tests.

- [ ] **Step 7: Commit**

```bash
git add index.html app.js style.css .nojekyll
git commit -m "feat: de pagina met doelteam eerst en een klikbaar overzicht"
```

---
### Task 9: README en openstaande punten

**Files:**
- Create: `README.md`
- Modify: `HANDOVER.md`

**Interfaces:**
- Consumes: niets.
- Produces: niets.

- [ ] **Step 1: Schrijf README.md**

```markdown
# Invalmatrix

Beantwoordt de vraag of een speler uit het ene team mag invallen in het andere, volgens het
KNHB Bondsreglement 2026 en de tabel klassengrenzen 2026-2027.

Live op https://faijdherbe.github.io/invalmatrix/

## Wat het wel en niet dekt

Wel: veldhockey, seizoen 2026-2027, jeugdcategorieen O11 tot en met O18, categorie II.

Niet: zaalhockey, senioren, O25, 30+, 45+, reserveteams, combiteams en categorie I. Voor die
gevallen doet de pagina bewust geen uitspraak.

## Draaien

Er is geen build-stap. Voor lokaal bekijken:

    python3 -m http.server 8000

Tests:

    npm test

## Artikelteksten bijwerken

De letterlijke artikelteksten in `articles.js` worden gegenereerd uit de bron-PDF:

    node tools/extract-articles.mjs

`test/articles.test.js` faalt zodra `articles.js` afwijkt van de PDF.

## Nieuw seizoen

Alles wat per seizoen wijzigt staat in `data.js`: `SEIZOEN`, `PEILDATUM`, `NIVEAU`, `KLASSEN`,
`LEEFTIJDSGRENZEN`, `CATEGORIE_I` en `CATEGORIE_I_PERIODE`. Vervang daarnaast de PDF's in
`bronnen/` en draai de artikelextractie opnieuw.

## Verwant

`build.py` genereert de invalmatrix-PDF voor de meisjesjeugd en staat los van deze pagina. Zie
`HANDOVER.md`.
```

- [ ] **Step 2: Voeg de openstaande punten toe aan HANDOVER.md**

Voeg onderaan `HANDOVER.md` toe, boven de sectie over stijlvoorkeuren:

```markdown
## Vragen voor de competitieleiding

Gevonden bij het bouwen van de webversie, nog niet voorgelegd:

1. De toelichting bij de tabel klassengrenzen zegt "O12- en O14-spelers mogen invallen bij O25-
   en seniorenteams", terwijl de bijbehorende tabellen alleen mappings voor O16- en O18-spelers
   geven. Dat leest als een fout in de tabel.
2. De tabel zet bij O16 en O18 geen sterretje bij Landelijk, terwijl hoofdstuk 2 van het
   reglement de Landelijke Competitie wel onder categorie I schaart.
3. Het reglement gebruikt "voor 1 oktober" (art. 3.1.1) en "op 1 oktober" (art. 5.2.4, 5.2.5)
   door elkaar.
4. O11 en O12 staan in de tabel in dezelfde kolom, terwijl art. 5.3.5.1 spreekt van een klasse
   erbij per leeftijdscategorie.
5. Art. 5.3.5.3 legt een maximum van twee invallers op bij de 5e klasse en lager, terwijl die
   klassen volgens de tabel op gelijk niveau staan en art. 5.3.5.1 daar geen maximum kent.
```

- [ ] **Step 3: Commit en push**

```bash
git add README.md HANDOVER.md
git commit -m "docs: README en de openstaande vragen voor de competitieleiding"
git push
```

---

## Zelfcontrole van dit plan tegen de spec

| Spec-onderdeel | Taak |
|---|---|
| Scope fase 1 en wat erbuiten valt | Task 3, Task 8 (voettekst), Task 9 (README) |
| Invoer: doelteam eerst, dan herkomst, dan optionele geboortedatum | Task 8 |
| Niveaumapping uit de tabel klassengrenzen | Task 1 |
| Klassen in de keuzelijst tot en met de 8e klasse | Task 1 |
| Categorie I, vast en periodegebonden | Task 3 |
| Regellogica, vijf stappen | Task 2 en Task 5 |
| Leeftijdstoets, drie controles en het randgeval | Task 4 |
| Letterlijke artikelteksten met bewakende test | Task 6 |
| Overzicht van wat er bij een team mag invallen | Task 7 |
| Weergave: raster, dan oordeel met voorwaarden, redenering, leeftijd en artikelen | Task 8 |
| Bestandsindeling | alle taken |
| Tests: build.py-asserts en reglementvoorbeelden | Task 2 |
| Deploy | Task 8 en Task 9 |
| Openstaande punten voor de competitieleiding | Task 9 |

## Wijzigingen ten opzichte van de eerste versie

De interfaceflow is op verzoek van de opdrachtgever omgedraaid. De oorspronkelijke taak 7 vroeg eerst
de herkomst van de speler en dan het doelteam. Dat sluit niet aan bij de vraag die een teammanager
werkelijk heeft: hij heeft een gat in een team en zoekt wie dat mag vullen. De nieuwe opzet vraagt
eerst het doelteam, toont dan een raster met wat daar mag invallen, en pas na een klik op een vakje
het volledige oordeel.

Daardoor is de oude taak 7 gesplitst. De overzichtslogica is nu taak 7 en heeft eigen tests, zodat
alle regelkennis in rules.js blijft en app.js niets zelf uitrekent. De pagina is taak 8 geworden en
README plus de openstaande punten zijn taak 9.
