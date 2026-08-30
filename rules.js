import {
  NIVEAU,
  KLASSEN,
  CATEGORIE_I,
  CATEGORIE_I_PERIODE,
  LEEFTIJDSGRENZEN,
  OUDERE_SPELER_UITZONDERING,
  PEILDATUM,
} from "./data.js";

const MAANDNAMEN = ["januari", "februari", "maart", "april", "mei", "juni", "juli", "augustus", "september", "oktober", "november", "december"];

export function peildatumNederlands(peildatum) {
  const dag = peildatum.getUTCDate();
  const maand = MAANDNAMEN[peildatum.getUTCMonth()];
  const jaar = peildatum.getUTCFullYear();
  return `${dag} ${maand} ${jaar}`;
}

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

  // Voeg leeftijds-info toe voor alle gevallen behalve wanneer het niveauverschil te groot is.
  // nBron - nDoel > -2 betekent dat het verschil 0 of -1 is (gelijk of een hoger).
  if (uitOudereCategorie && nBron - nDoel > -2) {
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
    return `${omschrijf(team)} valt volgens hoofdstuk 2 van het Bondsreglement onder categorie I. Daarvoor gelden de speelgerechtigdheidsregels van hoofdstuk 4, die deze tool niet dekt.`;
  }
  const periode = CATEGORIE_I_PERIODE[team.categorie];
  if (periode && periode[team.klasse]) {
    return `${omschrijf(team)} valt ${periode[team.klasse]} volgens hoofdstuk 2 van het Bondsreglement onder categorie I, met de speelgerechtigdheidsregels van hoofdstuk 4, en daarna onder categorie II. Deze tool weet niet in welke periode de wedstrijd valt en doet hier geen uitspraak over.`;
  }
  return null;
}

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

  const datumTekst = peildatumNederlands(PEILDATUM);
  const grensDoel = LEEFTIJDSGRENZEN[doel.categorie];
  if (leeftijd > grensDoel.max) {
    blokkeert = true;
    meldingen.push(`Op ${datumTekst} is de speler ${leeftijd} jaar en daarmee te oud voor ${doel.categorie}, waar de grens ${grensDoel.max} jaar is. Uitkomen in een categorie waarin zij volgens de leeftijdsgrenzen niet past mag alleen met dispensatie van de competitieleiding.`);
    artikelen.push("3.1.1", "3.1.3");
  } else if (leeftijd < grensDoel.min) {
    blokkeert = true;
    meldingen.push(`Op ${datumTekst} is de speler ${leeftijd} jaar en daarmee te jong voor ${doel.categorie}, waar de ondergrens ${grensDoel.min} jaar is. Dit mag alleen met dispensatie van de competitieleiding.`);
    artikelen.push("3.1.1", "3.1.3");
  } else {
    meldingen.push(`Op ${datumTekst} is de speler ${leeftijd} jaar en past daarmee binnen ${doel.categorie}.`);
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

  if (geboortedatum.getUTCMonth() === PEILDATUM.getUTCMonth() && geboortedatum.getUTCDate() === PEILDATUM.getUTCDate()) {
    meldingen.push(`Deze geboortedatum valt precies op ${datumTekst}. Het reglement gebruikt 'voor ${datumTekst}' en 'op ${datumTekst}' door elkaar, dus dit is een randgeval. Leg dit voor aan de competitieleiding.`);
  }

  return { leeftijd, blokkeert, meldingen, artikelen };
}

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
  const artikelen = klasse.toegestaan
    ? [...new Set([...klasse.artikelen, ...(leeftijd ? leeftijd.artikelen : [])])].sort()
    : [...new Set(klasse.artikelen)].sort();

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
