import {
  NIVEAU,
  KLASSEN,
  CATEGORIEEN,
  KOLOMMEN,
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

  // Artikel 5.3.5.4: aanvullende regel voor O14-veldhockey. Bij Topklasse en Subtopklasse mogen
  // spelers van het eerste team niet zonder toestemming van de competitieleiding invallen bij de
  // andere teams op dat niveau. De tool kent geen teamlijst en kan dus niet weten of een team het
  // eerste team is, dus deze voorwaarde geldt hier altijd als waarschuwing.
  const O14_TOP_SUBTOP = ["top", "subtop"];
  const beideO14TopOfSubtop =
    bron.categorie === "O14" &&
    doel.categorie === "O14" &&
    O14_TOP_SUBTOP.includes(bron.klasse) &&
    O14_TOP_SUBTOP.includes(doel.klasse);
  if (beideO14TopOfSubtop) {
    voorwaarden.push(
      "Als de vereniging meerdere O14-teams op de Topklasse of de Subtopklasse heeft, zijn de spelers van het eerste team hier zonder toestemming van de competitieleiding niet speelgerechtigd.",
    );
    artikelen.push("5.3.5.4");
    redenering.push("Beide teams spelen O14 in de Topklasse of de Subtopklasse, dus de aanvullende regel van artikel 5.3.5.4 geldt.");
  }

  const zelfdeCategorie = bron.categorie === doel.categorie;
  if (zelfdeCategorie && isVijfdeOfLager(bron.klasse) && isVijfdeOfLager(doel.klasse)) {
    voorwaarden.push("Er mogen maximaal twee spelers invallen zonder toestemming van de competitieleiding.");
    voorwaarden.push(
      "Onduidelijk is of dit maximum altijd geldt, of alleen als het team elf of meer eigen spelers beschikbaar heeft. Heeft het team minder spelers beschikbaar, dan zou artikel 5.3.5.1 gelden, dat geen maximum kent. Vraag dit na bij de competitieleiding.",
    );
    artikelen.push("5.3.5.3", "5.3.5.1");
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
    voorwaarden.push(`Het team waarin wordt ingevallen heeft aantoonbaar maximaal ${aantal} spelers beschikbaar uit het eigen of een lager spelend niveau.`);
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
  if (Number.isNaN(geboortedatum.getTime())) {
    throw new Error("leeftijdOpPeildatum heeft een geldige geboortedatum nodig, dit is een ongeldige datum");
  }
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
    if (doel.categorie === "O11" && leeftijd === grensDoel.max + 1) {
      meldingen.push(
        "Artikel 5.2.5 maakt hierop een uitzondering: verenigingen die op basis van aantallen problemen hebben om tot volledige teams te komen in de O11- en O12-categorie, mogen O12-jarigen indelen in de O11-categorie. Een individueel dispensatieverzoek is daarvoor niet nodig, mits de vereniging deze aantallenproblemen heeft.",
      );
      artikelen.push("5.2.5");
    }
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

function heeftGeldigeGeboortedatum(geboortedatum) {
  return geboortedatum instanceof Date && !Number.isNaN(geboortedatum.getTime());
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
      grond: null,
    };
  }

  const klasse = beoordeelKlasse(bron, doel);
  // Een onleesbare geboortedatum wordt behandeld als "geen geboortedatum opgegeven": de
  // leeftijdstoets draait dan gewoon niet. leeftijdOpPeildatum geeft wel een duidelijke fout als
  // hij direct met een ongeldige datum wordt aangeroepen, zie de toelichting in het rapport.
  const leeftijd = heeftGeldigeGeboortedatum(geboortedatum) ? beoordeelLeeftijd(bron, doel, geboortedatum) : null;

  // Omstreden: de bron komt uit een jongere leeftijdscategorie dan het doel, de klassenregels
  // staan het toe, maar de speler is volgens de leeftijdsgrenzen te jong voor het doel. Artikel
  // 5.3.5.1 geeft dit als voorbeeld van iets dat mag (de derde bullet noemt de leeftijdseis
  // alleen bij lenen uit een oudere categorie, niet hierbij), terwijl artikel 3.1.3 en de
  // voetnoot bij de tabel klassengrenzen zeggen dat de leeftijdsgrenzen altijd bepalend zijn. De
  // tool doet hier geen uitspraak over, maar waarschuwt.
  const bronUitJongereCategorie =
    CATEGORIE_VOLGORDE.indexOf(bron.categorie) < CATEGORIE_VOLGORDE.indexOf(doel.categorie);
  const teJongVoorDoel = leeftijd !== null && leeftijd.leeftijd < LEEFTIJDSGRENZEN[doel.categorie].min;
  const omstreden = klasse.toegestaan && bronUitJongereCategorie && teJongVoorDoel;

  let artikelen;
  if (omstreden) {
    artikelen = [...new Set([...klasse.artikelen, "5.3.5.1", "3.1.3", ...leeftijd.artikelen])].sort();
  } else if (klasse.toegestaan) {
    artikelen = [...new Set([...klasse.artikelen, ...(leeftijd ? leeftijd.artikelen : [])])].sort();
  } else {
    artikelen = [...new Set(klasse.artikelen)].sort();
  }

  let verdict;
  let samenvatting;
  if (omstreden) {
    verdict = "omstreden";
    samenvatting = `Omstreden: het Bondsreglement spreekt zichzelf hier tegen. Artikel 5.3.5.1 geeft lenen uit een jongere leeftijdscategorie als voorbeeld van iets dat mag, maar artikel 3.1.3 en de tabel klassengrenzen zeggen dat de leeftijdsgrenzen altijd bepalend zijn, en de speler is met ${leeftijd.leeftijd} jaar volgens die grenzen te jong voor ${doel.categorie}. Deze tool doet hier geen uitspraak over. Leg dit voor aan de competitieleiding.`;
  } else if (!klasse.toegestaan) {
    verdict = "niet-toegestaan";
    samenvatting = `Nee. ${omschrijf(bron)} speelt te veel niveaus hoger dan ${omschrijf(doel)}. Dit mag alleen met dispensatie van de competitieleiding.`;
  } else if (leeftijd && leeftijd.blokkeert) {
    verdict = "niet-toegestaan";
    samenvatting = `Nee. De klassengrens staat het toe, maar de leeftijd van de speler niet.`;
  } else if (klasse.voorwaarden.length > 0) {
    verdict = "toegestaan";
    samenvatting = `Ja, mits aan de voorwaarden hieronder is voldaan.`;
  } else {
    verdict = "toegestaan";
    samenvatting = `Ja. Een speler uit ${omschrijf(bron)} mag invallen in ${omschrijf(doel)}.`;
  }

  return {
    verdict,
    samenvatting,
    voorwaarden: klasse.toegestaan ? klasse.voorwaarden : [],
    redenering: klasse.redenering,
    leeftijd,
    artikelen,
    grond: klasse.grond,
  };
}

// Grond waarbij de aantallen-eis van artikel 5.3.5.2 geldt: een niveau hoger. Als daarbij ook
// een leeftijdsvoorwaarde geldt, weegt die zwaarder voor het vakje, zie soortVanVakje hieronder.
const AANTALLEN_GRONDEN = ["een-hoger"];

// Grond waarbij artikel 5.3.5.3 geldt: de uitzondering vanaf de 5e klasse binnen dezelfde
// leeftijdscategorie. Daar geldt de aantallen-eis juist niet, alleen een maximum van twee
// invallers zonder toestemming van de competitieleiding.
const MAX2_GRONDEN = ["vijfde-klasse"];

// Bepaalt hoe een vakje in het overzichtsraster getekend moet worden.
// Volgorde van zwaarte: een leeftijdsvoorwaarde weegt het zwaarst, want daar valt voor de
// vereniging niets aan te regelen. Pas daarna volgen de aantallen-eis (5.3.5.2) en de
// max-twee-uitzondering (5.3.5.3), waar de vereniging wel iets aan kan doen. Een vakje kan zowel
// de aantallen-eis als een leeftijdsvoorwaarde hebben (lenen uit een oudere categorie die een
// klasse hoger speelt); dan krijgt het soort leeftijd, niet aantallen, want een onhaalbare
// leeftijdsgrens kan nooit groen worden.
function soortVanVakje(uitkomst) {
  if (uitkomst.verdict === "buiten-scope") return "buiten-scope";
  if (uitkomst.verdict === "niet-toegestaan") return "nee";
  // overzicht() roept assess() altijd zonder geboortedatum aan, dus dit gebeurt in de praktijk
  // niet, maar de afhandeling staat er voor de volledigheid.
  if (uitkomst.verdict === "omstreden") return "omstreden";
  if (uitkomst.voorwaarden.some((v) => /leeftijdsgrenzen van/.test(v))) return "leeftijd";
  if (AANTALLEN_GRONDEN.includes(uitkomst.grond)) return "aantallen";
  if (MAX2_GRONDEN.includes(uitkomst.grond)) return "max2";
  if (uitkomst.voorwaarden.length > 0) return "leeftijd";
  return "vrij";
}

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
        soort: soortVanVakje(uitkomst),
      };
    }),
  }));
}
