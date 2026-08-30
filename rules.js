import { NIVEAU, KLASSEN, CATEGORIE_I, CATEGORIE_I_PERIODE } from "./data.js";

// Absoluut niveau volgens de tabel klassengrenzen. Lager getal is hoger niveau.
export function niveau(categorie, klasseId) {
  const kolom = NIVEAU[categorie];
  if (!kolom) throw new Error(`onbekende categorie: ${categorie}`);
  const rij = kolom[klasseId];
  if (rij === undefined) throw new Error(`onbekende klasse ${klasseId} voor ${categorie}`);
  return rij;
}

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
