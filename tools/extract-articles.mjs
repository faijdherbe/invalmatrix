// Genereert articles.js uit het Bondsreglement. Draaien met: node tools/extract-articles.mjs
// De artikelteksten worden letterlijk overgenomen, alleen paginavoetteksten en formfeeds
// worden verwijderd. test/articles.test.js bewaakt dat dit zo blijft.
import { execFileSync } from "node:child_process";
import { writeFileSync } from "node:fs";

export const PDF = "bronnen/bondsreglement-2026.pdf";

export const GEWENST = [
  "3.1.1",
  "3.1.3",
  "5.1.1",
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
  "5.3.6",
  "5.3.6.1",
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

// Haalt overtollige spaties weg zodat een ingesprongen vervolgregel te vergelijken is
// met de rest van de titel.
function normaliseer(tekst) {
  return tekst.replace(/\s+/g, " ").trim();
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
    let tekstRegels = regels.slice(kop.index + 1, eind);

    // Als de titel over meerdere regels loopt, staan de vervolgregels van de kop
    // aan het begin van tekstRegels. Bouw de titel stap voor stap op en sla precies
    // zoveel regels over als nodig is om bij de gecorrigeerde titel uit te komen.
    const titel = TITEL_CORRECTIE[nummer] || kop.titel;
    if (TITEL_CORRECTIE[nummer]) {
      const doel = normaliseer(titel);
      let opgebouwd = normaliseer(kop.titel);
      while (opgebouwd !== doel && tekstRegels.length > 0 && doel.startsWith(`${opgebouwd} `)) {
        opgebouwd = normaliseer(`${opgebouwd} ${tekstRegels[0]}`);
        tekstRegels = tekstRegels.slice(1);
      }
      if (opgebouwd !== doel) {
        throw new Error(`titelcorrectie voor artikel ${nummer} komt niet overeen met de regels na de kop`);
      }
    }

    const tekst = tekstRegels
      .join("\n")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
    if (tekst.length === 0) throw new Error(`artikel ${nummer} heeft geen tekst`);
    artikelen[nummer] = { titel, tekst };
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
