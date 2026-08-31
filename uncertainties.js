// The open questions about the Bondsreglement that the user must be able to see, one per ticket on
// https://github.com/faijdherbe/invalmatrix/issues. CLAUDE.md says that where the reglement leaves
// something open the tool takes the conservative side and files a ticket. This file is what makes
// that choice visible on the page instead of only in the comments.
//
// Every entry stands or falls with its ticket: closes the ticket, then this entry goes too, in the
// same commit. tools/check-uncertainties.mjs guards that.
//
// This file deliberately imports nothing from rules.js. It receives a ready-made context (see
// uncertaintiesFor below), so that the predicate stands right next to the text that explains it and
// there is no cycle between the two modules.
import { CATEGORY_I_UNTIL, O14_LEVEL_GROUPS } from "./data.js";

// A numbered class: 1e through 8e. Everything else is a class at the top of the ladder with a name
// of its own (landelijk, super, top, subtop, idc), and those are the classes articles 4.3.8 and
// 5.3.5.4 list per period.
function isNumberedClass(classId) {
  return /^[1-8]e$/.test(classId);
}

function hasNamedClass(team) {
  return !isNumberedClass(team.classId);
}

// A class whose category or level group shifts halfway through the season: exactly the classes in
// CATEGORY_I_UNTIL and in the level groups of article 5.3.5.4. Read from data.js so this moves
// along when the season data changes.
function isPeriodSensitive(team) {
  if ((CATEGORY_I_UNTIL[team.category] || {})[team.classId]) return true;
  if (team.category !== "O14") return false;
  return O14_LEVEL_GROUPS.some((group) => group.classes.includes(team.classId));
}

export const UNCERTAINTIES = [
  {
    ticket: 11,
    heading: "Zijn O11 en O12 een niveau of twee leeftijdscategorieen?",
    explanation:
      "Artikel 3.1.1 noemt O11 en O12 twee aparte leeftijdscategorieen, maar de tabel klassengrenzen zet ze in een gedeelde kolom. Deze tool volgt de tabel en rekent dus geen klasse verschil tussen O11 en O12.",
    needsDateOfBirth: false,
    applies: (c) => {
      const categories = [c.lender.category, c.borrower.category];
      return categories.includes("O11") && categories.includes("O12");
    },
  },
  {
    ticket: 12,
    heading: "Hoeveel klassen lager moet een team uit een oudere leeftijdscategorie spelen?",
    explanation:
      "Artikel 5.3.5.1 zegt alleen 'minimaal een klasse lager', zonder ophoging per leeftijdscategorie. De tabel klassengrenzen hoogt wel per categorie op. Deze tool volgt de tabel, en dat is hier de strengste lezing.",
    needsDateOfBirth: false,
    applies: (c) => c.categoryDistance >= 2,
  },
  {
    ticket: 13,
    heading: "Geldt het maximum van twee invallers altijd?",
    explanation:
      "Artikel 5.3.5.3 zegt dat er zonder toestemming van de competitieleiding maximaal twee spelers mogen invallen. Of dat altijd geldt of alleen als het team elf of meer eigen spelers beschikbaar heeft, hangt af van waar het woord 'hierbij' naar terugslaat. Vraag dit na bij de competitieleiding.",
    needsDateOfBirth: false,
    applies: (c) => c.ground === "fifth-class",
  },
  {
    ticket: 14,
    heading: "Geldt de uitzondering voor de 5e klasse ook tussen leeftijdscategorieen?",
    explanation:
      "Artikel 5.3.5.3 begint met 'binnen dezelfde leeftijdscategorie', maar sluit af met 'dit klassenverschil geldt dus ook tussen (leeftijds-)categorieen'. Deze tool past de uitzondering alleen binnen dezelfde categorie toe, de strengste lezing.",
    needsDateOfBirth: false,
    applies: (c) => c.bothFifthOrLower && c.lender.category !== c.borrower.category,
  },
  {
    ticket: 15,
    heading: "Artikel 3.1.3 verbiedt wat artikel 5.3.5.1 uitdrukkelijk toestaat",
    explanation:
      "Artikel 5.3.5.1 staat lenen uit een jongere leeftijdscategorie toe en geeft er een voorbeeld van dat alleen kan werken met een speler die te jong is voor de categorie waarin zij invalt. Artikel 3.1.3 verbiedt precies dat zonder dispensatie, en de tabel klassengrenzen zegt dat de leeftijdsgrenzen altijd bepalend zijn. Bij twijfel beslist de competitieleiding.",
    needsDateOfBirth: false,
    // On ground too-high both readings come out at no, so there the contradiction changes nothing
    // and the warning would only be noise. Out of scope has no ground at all and no verdict to
    // warn about either.
    applies: (c) => c.categoryDistance < 0 && (c.ground === "equal-or-lower" || c.ground === "one-higher"),
  },
  {
    ticket: 16,
    heading: "Valt elke speler die een jaar te oud is onder artikel 5.2.4?",
    explanation:
      "Deze tool gaat ervan uit dat een speler die precies een jaar boven de grens van haar eigen categorie zit, een van de twee spelers is die volgens artikel 5.2.4 op de teamlijst mogen staan, en dus nooit mag invallen. Het reglement zegt dat niet met zoveel woorden.",
    needsDateOfBirth: true,
    applies: (c) => c.age !== null && c.age.articles.includes("5.2.4"),
  },
  {
    ticket: 17,
    heading: "Bedoelt artikel 5.2.5 elfjarigen of twaalfjarigen?",
    explanation:
      "Artikel 5.2.5 spreekt over 'O12-jarigen' die in de O11-categorie mogen worden ingedeeld. Deze tool leest dat als spelers uit de O12-categorie, dus elfjarigen. Letterlijk gelezen zou het ook twaalfjarigen kunnen betekenen, en dat scheelt een heel jaar.",
    needsDateOfBirth: true,
    applies: (c) => c.age !== null && c.age.articles.includes("5.2.5"),
  },
  {
    ticket: 18,
    heading: "Valt de Topklasse O14 onder categorie I of categorie II?",
    explanation:
      "Hoofdstuk 2 noemt bij O14 alleen de Super Competitie onder categorie I, dus valt de Topklasse onder categorie II. De tabel klassengrenzen zet de Topklasse O14 juist met een sterretje bij de categorie I-competities. Deze tool volgt hoofdstuk 2 en doet dus wel een uitspraak over deze klasse.",
    needsDateOfBirth: false,
    applies: (c) => c.involves("O14", "top"),
  },
  {
    ticket: 19,
    heading: "Valt IDC-O14 voor de winterstop onder categorie I of categorie II?",
    explanation:
      "Hoofdstuk 2 noemt IDC-O14 alleen vanaf de winterstop onder categorie II, en zegt niets over de periode daarvoor. Deze tool doet voor die periode geen uitspraak, de kant die nooit ten onrechte ja zegt.",
    needsDateOfBirth: false,
    applies: (c) => c.involves("O14", "idc") && c.periodId !== "late",
  },
  {
    ticket: 27,
    heading: "Hoofdstuk 2 en hoofdstuk 4 noemen de Super O14 verschillend",
    explanation:
      "Hoofdstuk 2 zet de Super Competitie O14 zonder voorbehoud onder categorie I, hoofdstuk 4 zet er 'vanaf de winterstop' bij. Deze tool volgt hoofdstuk 2 en houdt de Super O14 het hele seizoen buiten beeld.",
    needsDateOfBirth: false,
    applies: (c) => c.involves("O14", "super"),
  },
  {
    ticket: 28,
    heading: "Vanaf de winterstop of vanaf na de winterstop bij de Subtopklasse O16?",
    explanation:
      "Dezelfde zin staat twee keer in het reglement en niet gelijk overgetypt: hoofdstuk 2 zegt 'vanaf de winterstop', hoofdstuk 5 zegt 'vanaf na de winterstop'. Dat scheelt een week. Deze tool houdt de winterstopweek zelf bij categorie I.",
    needsDateOfBirth: false,
    // Only in the period up to and including the winterstop, and as long as no period has been
    // chosen. In the lentecompetitie the winterstop is behind us and both readings come out at
    // category II, so there the warning would be noise.
    applies: (c) => c.involves("O16", "subtop") && (c.periodId === "mid" || c.periodId === null),
  },
  {
    ticket: 29,
    heading: "Waar ligt de grens tussen de voorcompetitie en de lentecompetitie?",
    explanation:
      "De artikelen 4.3.8, 4.3.9 en 5.3.5.4 gebruiken beide termen, maar geen van alle zegt waar de grens ligt of welke weken bij welke periode horen. Deze tool houdt de winterstop aan.",
    needsDateOfBirth: false,
    applies: (c) => isPeriodSensitive(c.lender) || isPeriodSensitive(c.borrower),
  },
  {
    ticket: 30,
    heading: "Verschilt het klassenaanbod aan de top per periode?",
    explanation:
      "De artikelen 4.3.8 en 5.3.5.4 sommen per periode andere klassen op, wat erop wijst dat teams aan de top halverwege het seizoen van klasse wisselen. Deze tool laat je in elke periode elke klasse kiezen en gaat ervan uit dat jij weet in welke klasse je team op de speeldag zelf uitkomt.",
    needsDateOfBirth: false,
    applies: (c) => hasNamedClass(c.lender) || hasNamedClass(c.borrower),
  },
  {
    ticket: 32,
    heading: "Valt de herfstvakantie of de winterstop zelf onder categorie I of categorie II?",
    explanation:
      "Hoofdstuk 2 claimt die week twee keer: 'tot en met de herfstvakantie' onder categorie I en 'vanaf de herfstvakantie' onder categorie II, en bij de winterstop gebeurt hetzelfde. Deze tool zet die week bij categorie I, de kant die nooit ten onrechte ja zegt.",
    needsDateOfBirth: false,
    // Without a chosen period every period is still possible, so then this warns too, the same way
    // #19 and #28 do. rules.js must never silently assume a period, see categoryINotice there.
    applies: (c) =>
      (c.involves("O18", "subtop") && (c.periodId === "early" || c.periodId === null)) ||
      (c.involves("O16", "subtop") && (c.periodId === "mid" || c.periodId === null)),
  },
];

// The uncertainties that apply to one combination, in the order of UNCERTAINTIES, so the page
// always shows them in the same sequence. The predicate itself is left out: what comes back here
// goes straight to the screen and a function has no business there.
export function uncertaintiesFor(context) {
  return UNCERTAINTIES.filter((uncertainty) => uncertainty.applies(context)).map(
    ({ ticket, heading, explanation, needsDateOfBirth }) => ({ ticket, heading, explanation, needsDateOfBirth }),
  );
}
