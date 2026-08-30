import {
  NIVEAU,
  KLASSEN,
  CATEGORIEEN,
  KOLOMMEN,
  CATEGORIE_I,
  CATEGORIE_I_PERIODE,
  LEEFTIJDSGRENZEN,
  OUDERE_SPELER_UITZONDERING,
  O14_NIVEAUGROEPEN,
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
  const uitJongereCategorie =
    CATEGORIE_VOLGORDE.indexOf(bron.categorie) < CATEGORIE_VOLGORDE.indexOf(doel.categorie);

  const voorwaarden = [];
  const redenering = [];
  const artikelen = [];
  const kanttekeningen = [];

  // Lenen uit een jongere leeftijdscategorie is precies waar artikel 5.3.5.1 een voorbeeld van
  // geeft, en de meest voorkomende invalsituatie van allemaal. Maar artikel 3.1.3 en de tabel
  // klassengrenzen zeggen dat de leeftijdsgrenzen altijd bepalend zijn, en bij twijfel beslist de
  // competitieleiding. Dat is geen voorwaarde waaraan de gebruiker iets kan doen, maar een
  // kanttekening bij de regel zelf: die geldt altijd als de bron jonger is, ongeacht geboortedatum,
  // en verandert het oordeel niet.
  const jongereCategorieKanttekening = `De speler komt uit een jongere leeftijdscategorie dan ${doel.categorie}. Artikel 5.3.5.1 staat dat toe en geeft er zelfs een voorbeeld van, maar artikel 3.1.3 en de tabel klassengrenzen zeggen dat de leeftijdsgrenzen altijd bepalend zijn. Bij twijfel beslist de competitieleiding.`;

  // Drie kanttekeningen bij artikelen die het oordeel kunnen omdraaien, maar waarover deze tool
  // geen uitspraak kan doen: hij kent de wedstrijddag, de speelronde, de vereniging en de
  // gespeelde wedstrijden niet. Ze veranderen het oordeel niet, net als de kanttekening hierboven.

  // Artikel 5.3.4: wie binnen de vereniging evenveel of vaker uitkomt voor het hoger spelende
  // team dan voor het eigen team, krijgt dat hogere niveau als niveaubepaling en mag daarna niet
  // meer voor lager spelende teams uitkomen. Dit hoort alleen bij grond gelijk-of-lager, want
  // alleen dan speelt de bron op of onder het niveau van het doelteam.
  const wijzigingNiveaubepalingKanttekening = "Komt de speler binnen de vereniging evenveel of vaker uit voor het hoger spelende team dan voor het team waar zij gewoonlijk voor uitkomt, dan wordt dat hogere niveau de niveaubepaling en mag de speler daarna niet meer voor lager spelende teams uitkomen (artikel 5.3.4). Deze tool kent de speelgeschiedenis van de speler niet en kan dit niet beoordelen.";

  // Artikel 5.3.6 en 5.3.6.1: in een beslissingswedstrijd mag alleen invallen wie al een
  // vastgestelde niveaubepaling heeft. Dit geldt ongeacht de grond waarop is ingevallen, dus bij
  // elk toegestaan oordeel.
  const beslissingswedstrijdKanttekening = "In een beslissingswedstrijd (de laatste een tot drie speelronden van de competitie, een kampioenschap, of een wedstrijd die de competitieleiding als zodanig heeft aangewezen) mag alleen invallen wie al een vastgestelde niveaubepaling heeft (artikel 5.3.6 en 5.3.6.1). Deze tool kent de speelronde niet en kan dit niet beoordelen.";

  // Artikel 5.1.1: een invaller van een andere vereniging mag niet in teams van verschillende
  // verenigingen in dezelfde poule uitkomen en mag dit seizoen voor maximaal drie verenigingen
  // uitkomen. Dit geldt ongeacht de grond waarop is ingevallen, dus bij elk toegestaan oordeel.
  const verschillendeVerenigingenKanttekening = "Komt de invaller van een andere vereniging, controleer dan dat de twee teams niet in dezelfde poule spelen en dat de speler dit seizoen nog niet voor drie verschillende verenigingen is uitgekomen (artikel 5.1.1). Deze tool kent de poule-indeling en de speelgeschiedenis van de speler niet.";

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

  // Artikel 5.3.5.4: aanvullende regel voor O14-veldhockey. Het artikel kent twee
  // niveaugroepen, elk in een eigen periode van het seizoen (de voorcompetitie met Topklasse en
  // Subtopklasse, de lentecompetitie met Super O14 en IDC-O14). Binnen een groep mogen spelers
  // van het eerste team niet zonder toestemming van de competitieleiding invallen bij de andere
  // teams op dat niveau. De tool kent geen teamlijst en kan dus niet weten of een team het
  // eerste team is, dus deze voorwaarde geldt hier altijd als waarschuwing.
  if (bron.categorie === "O14" && doel.categorie === "O14") {
    const groep = O14_NIVEAUGROEPEN.find(
      (g) => g.klassen.includes(bron.klasse) && g.klassen.includes(doel.klasse),
    );
    if (groep) {
      const klasseNamen = groep.klassen.map((k) => klasseLabel("O14", k));
      voorwaarden.push(
        `In de ${groep.periode} geldt: als de vereniging meerdere teams in de ${klasseNamen.join(" of de ")} heeft, zijn de spelers van het eerste team hier zonder toestemming van de competitieleiding niet speelgerechtigd.`,
      );
      artikelen.push("5.3.5.4");
      redenering.push(`Beide teams spelen O14 in dezelfde niveaugroep van artikel 5.3.5.4 (${groep.periode}: ${klasseNamen.join(" en ")}).`);
    }
  }

  const zelfdeCategorie = bron.categorie === doel.categorie;
  if (zelfdeCategorie && isVijfdeOfLager(bron.klasse) && isVijfdeOfLager(doel.klasse)) {
    voorwaarden.push("Er mogen maximaal twee spelers invallen zonder toestemming van de competitieleiding.");
    voorwaarden.push(
      "Onduidelijk is of dit maximum altijd geldt, of alleen als het team elf of meer eigen spelers beschikbaar heeft. Heeft het team minder spelers beschikbaar, dan zou artikel 5.3.5.1 gelden, dat geen maximum kent. Vraag dit na bij de competitieleiding.",
    );
    artikelen.push("5.3.5.3", "5.3.5.1");
    redenering.push("Beide teams spelen in de 5e klasse of lager binnen dezelfde leeftijdscategorie, dus de uitzondering van artikel 5.3.5.3 geldt.");
    kanttekeningen.push(beslissingswedstrijdKanttekening, verschillendeVerenigingenKanttekening);
    artikelen.push("5.3.6", "5.3.6.1", "5.1.1");
    return { toegestaan: true, grond: "vijfde-klasse", voorwaarden, redenering, artikelen, kanttekeningen };
  }

  if (nBron >= nDoel) {
    artikelen.push("5.3.5.1");
    redenering.push("Lenen uit een team op gelijk of lager niveau mag altijd, ongeacht het aantal eigen spelers.");
    if (uitJongereCategorie) {
      kanttekeningen.push(jongereCategorieKanttekening);
      artikelen.push("3.1.3");
    }
    kanttekeningen.push(wijzigingNiveaubepalingKanttekening, beslissingswedstrijdKanttekening, verschillendeVerenigingenKanttekening);
    artikelen.push("5.3.4", "5.3.6", "5.3.6.1", "5.1.1");
    return { toegestaan: true, grond: "gelijk-of-lager", voorwaarden, redenering, artikelen, kanttekeningen };
  }

  if (nBron === nDoel - 1) {
    const aantal = doel.categorie === "O11" ? 9 : 11;
    voorwaarden.push(`Het team waarin wordt ingevallen heeft aantoonbaar maximaal ${aantal} spelers beschikbaar uit het eigen of een lager spelend niveau.`);
    voorwaarden.push("Er zijn aantoonbaar geen invallers beschikbaar uit een gelijk of lager spelend niveau.");
    voorwaarden.push("Er mogen maximaal twee spelers invallen, inclusief een vaste doelverdediger.");
    voorwaarden.push("Voor het inlenen van een doelverdediger geldt de eis over het aantal eigen spelers niet.");
    artikelen.push("5.3.5.2");
    redenering.push("Lenen uit een team dat precies een niveau hoger speelt mag alleen als aan alle voorwaarden van artikel 5.3.5.2 is voldaan.");
    if (uitJongereCategorie) {
      kanttekeningen.push(jongereCategorieKanttekening);
      artikelen.push("3.1.3");
    }
    kanttekeningen.push(beslissingswedstrijdKanttekening, verschillendeVerenigingenKanttekening);
    artikelen.push("5.3.6", "5.3.6.1", "5.1.1");
    return { toegestaan: true, grond: "een-hoger", voorwaarden, redenering, artikelen, kanttekeningen };
  }

  artikelen.push("5.3.5.2");
  redenering.push("Meer dan een niveau verschil is niet toegestaan zonder dispensatie van de competitieleiding.");
  return { toegestaan: false, grond: "te-hoog", voorwaarden: [], redenering, artikelen, kanttekeningen: [] };
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
  const voorwaarden = [];
  let blokkeert = false;

  const datumTekst = peildatumNederlands(PEILDATUM);
  const grensDoel = LEEFTIJDSGRENZEN[doel.categorie];
  // Een bron uit een jongere leeftijdscategorie is per definitie vaak te jong voor de
  // doelcategorie: dat is nu juist de normale situatie bij lenen uit een jongere categorie
  // (artikel 5.3.5.1), geen afwijking. Dit mag dus niet blokkeren. Te oud voor de doelcategorie
  // en de uitzondering van artikel 5.2.4 blokkeren onverminderd, ook bij een jongere bron. En
  // "te jong" bij een gelijke of oudere bron blijft gewoon een dispensatiegeval.
  const bronUitJongereCategorie =
    CATEGORIE_VOLGORDE.indexOf(bron.categorie) < CATEGORIE_VOLGORDE.indexOf(doel.categorie);
  // Artikel 5.2.5 maakt de O11-categorie een uitzondering op "te oud": een O12-jarige (een jaar
  // boven de bovengrens van O11) mag daar worden ingedeeld als de vereniging op basis van
  // aantallen problemen heeft om tot volledige teams te komen in de O11- en O12-categorie. Dat is
  // uitdrukkelijk geen dispensatiegeval (artikel 3.1.3), dus dit mag niet blokkeren en de eerste
  // melding mag niet beweren dat dispensatie nodig is.
  const isAantallenuitzonderingO11 =
    doel.categorie === "O11" && leeftijd === grensDoel.max + 1;
  if (leeftijd > grensDoel.max) {
    artikelen.push("3.1.1", "3.1.3");
    if (isAantallenuitzonderingO11) {
      meldingen.push(`Op ${datumTekst} is de speler ${leeftijd} jaar, een jaar boven de bovengrens van ${grensDoel.max} jaar voor ${doel.categorie}.`);
      meldingen.push(
        "Artikel 5.2.5 maakt hierop een uitzondering: verenigingen die op basis van aantallen problemen hebben om tot volledige teams te komen in de O11- en O12-categorie, mogen O12-jarigen indelen in de O11-categorie. Een individueel dispensatieverzoek is daarvoor niet nodig, mits de vereniging deze aantallenproblemen heeft.",
      );
      artikelen.push("5.2.5");
      voorwaarden.push(
        "De vereniging moet op basis van de ingeschreven aantallen problemen hebben om tot volledige teams te komen in de O11- en O12-categorie (artikel 5.2.5).",
      );
    } else {
      blokkeert = true;
      meldingen.push(`Op ${datumTekst} is de speler ${leeftijd} jaar en daarmee te oud voor ${doel.categorie}, waar de grens ${grensDoel.max} jaar is. Uitkomen in een categorie waarin zij volgens de leeftijdsgrenzen niet past mag alleen met dispensatie van de competitieleiding.`);
    }
  } else if (leeftijd < grensDoel.min && !bronUitJongereCategorie) {
    blokkeert = true;
    meldingen.push(`Op ${datumTekst} is de speler ${leeftijd} jaar en daarmee te jong voor ${doel.categorie}, waar de ondergrens ${grensDoel.min} jaar is. Dit mag alleen met dispensatie van de competitieleiding.`);
    artikelen.push("3.1.1", "3.1.3");
  } else if (leeftijd < grensDoel.min) {
    meldingen.push(`Op ${datumTekst} is de speler ${leeftijd} jaar. Dat is jonger dan de ondergrens van ${grensDoel.min} jaar voor ${doel.categorie}, maar de speler komt uit een jongere leeftijdscategorie, dus dat is hier de normale situatie en geen afwijking.`);
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

  return { leeftijd, blokkeert, meldingen, artikelen, voorwaarden };
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
      kanttekeningen: [],
    };
  }

  const klasse = beoordeelKlasse(bron, doel);
  // Een onleesbare geboortedatum wordt behandeld als "geen geboortedatum opgegeven": de
  // leeftijdstoets draait dan gewoon niet. leeftijdOpPeildatum geeft wel een duidelijke fout als
  // hij direct met een ongeldige datum wordt aangeroepen, zie de toelichting in het rapport.
  const leeftijd = heeftGeldigeGeboortedatum(geboortedatum) ? beoordeelLeeftijd(bron, doel, geboortedatum) : null;

  // Voorwaarden en artikelen uit beoordeelLeeftijd horen er alleen bij als de klasse het al
  // toestaat. Blokkeert de klasse zelf (grond te-hoog), dan is de leeftijd niet meer relevant en
  // mag die informatie niet alsnog binnensluipen.
  let artikelen;
  let voorwaarden;
  if (klasse.toegestaan) {
    artikelen = [...new Set([...klasse.artikelen, ...(leeftijd ? leeftijd.artikelen : [])])].sort();
    voorwaarden = [...klasse.voorwaarden, ...(leeftijd ? leeftijd.voorwaarden : [])];
  } else {
    artikelen = [...new Set(klasse.artikelen)].sort();
    voorwaarden = [];
  }

  let verdict;
  let samenvatting;
  if (!klasse.toegestaan) {
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
    voorwaarden,
    redenering: klasse.redenering,
    leeftijd,
    artikelen,
    grond: klasse.grond,
    kanttekeningen: klasse.kanttekeningen,
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
