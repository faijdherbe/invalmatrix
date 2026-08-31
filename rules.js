import {
  LEVELS,
  CLASSES,
  AGE_CATEGORIES,
  COLUMNS,
  CATEGORY_I,
  CATEGORY_I_UNTIL,
  PERIODS,
  AGE_LIMITS,
  OLDER_PLAYER_EXCEPTION,
  O14_LEVEL_GROUPS,
  REFERENCE_DATE,
} from "./data.js";
import { uncertaintiesFor } from "./uncertainties.js";

const MONTH_NAMES = ["januari", "februari", "maart", "april", "mei", "juni", "juli", "augustus", "september", "oktober", "november", "december"];

export function formatDateDutch(date) {
  const day = date.getUTCDate();
  const month = MONTH_NAMES[date.getUTCMonth()];
  const year = date.getUTCFullYear();
  return `${day} ${month} ${year}`;
}

// Absolute level according to the class boundaries table. A lower number is a higher level.
export function level(category, classId) {
  const column = LEVELS[category];
  if (!column) throw new Error(`unknown age category: ${category}`);
  const row = column[classId];
  if (row === undefined) throw new Error(`unknown class ${classId} for ${category}`);
  return row;
}

const AGE_CATEGORY_ORDER = ["O11", "O12", "O14", "O16", "O18"];

const LOW_CLASS_ORDER = ["5e", "6e", "7e", "8e"];

function isFifthOrLower(classId) {
  return LOW_CLASS_ORDER.includes(classId);
}

// Class number within the low classes: the 5th class gets the lowest number, the 8th class the
// highest. A lower number means a higher class, so "the lender plays higher than the borrower"
// comes down to lowClassNumber(lender) < lowClassNumber(borrower).
function lowClassNumber(classId) {
  return LOW_CLASS_ORDER.indexOf(classId);
}

function classLabel(category, classId) {
  const found = CLASSES[category].find((k) => k.id === classId);
  return found ? found.label : classId;
}

function describe(team) {
  return `${team.category} ${classLabel(team.category, team.classId)}`;
}

// Article 5.3.5.1 defines what counts as an equal or lower playing team across an age category
// boundary, and that definition is what decides the verdict as soon as lender and borrower sit in
// different age categories. So the article and its counting rule belong in the explanation on
// every ground, also where the verdict is no (ticket #21). Returns null within the same age
// category, which is why ground fifth-class never gets this line: that ground applies within one
// age category by definition.
//
// The article's second bullet reads "per leeftijdscategorie een klasse bij komt"; the wording
// used below is "per extra leeftijdscategorie". That reading is deliberate: the article's own
// example only works on it (JO18-2 in the 3e klasse borrowing from JO14-2 in the 1e klasse, two
// age categories and two classes apart, so the first category already accounts for the base "one
// class higher" and only the second, "extra" category adds the second class).
function ageCategoryReasoning(lender, borrower) {
  const lenderIndex = AGE_CATEGORY_ORDER.indexOf(lender.category);
  const borrowerIndex = AGE_CATEGORY_ORDER.indexOf(borrower.category);
  const steps = Math.abs(lenderIndex - borrowerIndex);
  if (steps === 0) return null;

  // Ticket #11 is open: whether O11 and O12 count as one age category apart, as
  // AGE_CATEGORY_ORDER does here, or as the same level. LEVELS in data.js gives O11 and O12 the
  // identical ladder, so the class boundaries table applies no class shift between them. Printing
  // a sentence here that invokes article 5.3.5.1's category-crossing count would commit this page
  // to one side of that open question, and would contradict the table it stands right next to: a
  // wrong sentence that reads like a settled rule is worse than an open question (CLAUDE.md). The
  // conservative side is to say nothing. Determined generically from the data rather than
  // hard-coded to O11/O12, by comparing the level of the same class ("1e") in both categories:
  // zero means the table applies no shift. When this returns null for that reason, article
  // 5.3.5.1 must not be added by the caller either; on ground equal-or-lower it is still added
  // separately below, and that stays correct and unaffected.
  const categoryLevelShift = level(lender.category, "1e") - level(borrower.category, "1e");
  if (categoryLevelShift === 0) return null;

  if (lenderIndex > borrowerIndex) {
    // The third bullet names no increase per age category. Whether it applies in this direction
    // too is the open question of ticket #12, so no number is written out here.
    return "Het uitlenende team speelt in een hogere leeftijdscategorie. Artikel 5.3.5.1 staat dat toe als dat team minimaal een klasse lager speelt dan het team waarin wordt ingevallen.";
  }
  const opening = `${lender.category} en ${borrower.category} schelen ${steps} leeftijdscategorie${steps === 1 ? "" : "en"}.`;
  const rule = "Artikel 5.3.5.1 zegt dat een team uit een lagere leeftijdscategorie maximaal een klasse hoger mag spelen";
  if (steps === 1) return `${opening} ${rule}.`;
  return `${opening} ${rule}, en dat er per extra leeftijdscategorie een klasse bij komt.`;
}

// Assesses the class rules only. The age check lives in assessAge.
export function assessLevel(lender, borrower) {
  const lenderLevel = level(lender.category, lender.classId);
  const borrowerLevel = level(borrower.category, borrower.classId);
  const fromOlderCategory =
    AGE_CATEGORY_ORDER.indexOf(lender.category) > AGE_CATEGORY_ORDER.indexOf(borrower.category);
  const fromYoungerCategory =
    AGE_CATEGORY_ORDER.indexOf(lender.category) < AGE_CATEGORY_ORDER.indexOf(borrower.category);

  const conditions = [];
  const reasoning = [];
  const articles = [];
  const caveats = [];

  // Articles are collected in several places and may overlap, for example 5.3.5.1 from the age
  // category explanation below and from ground equal-or-lower. The list is what the page renders,
  // so every number appears in it at most once.
  function addArticles(...numbers) {
    for (const number of numbers) {
      if (!articles.includes(number)) articles.push(number);
    }
  }

  // Three caveats about articles that can reverse the verdict, but on which this tool cannot make
  // a statement: it does not know the match day, the round, the club or the matches played. They
  // do not change the verdict.

  // Article 5.3.4 has two halves. The first: a player who within the club appears as often or
  // more often for a higher playing team than for her own team gets that higher level as her level
  // determination. That touches ground equal-or-lower, because there the player substitutes
  // upward. The second, the closing sentence of the article: the player may afterwards no longer
  // appear for lower playing teams. That touches the grounds one-higher and fifth-class instead,
  // because there the player substitutes downward and an earlier changed level determination can
  // still forbid that appearance. So this applies, like the two caveats below, to every allowed
  // verdict.
  const levelDeterminationCaveat = "Komt de speler binnen de vereniging evenveel of vaker uit voor een hoger spelend team dan voor het team waar zij gewoonlijk voor uitkomt, dan wordt dat hogere niveau de niveaubepaling en mag de speler daarna niet meer voor lager spelende teams uitkomen, dus ook niet voor het team waarin hier wordt ingevallen (artikel 5.3.4). Deze tool kent de speelgeschiedenis van de speler niet en kan dit niet beoordelen.";

  // Articles 5.3.6 and 5.3.6.1: in a deciding match only a player who already has an established
  // level determination may substitute. This applies regardless of the ground for substituting, so
  // to every allowed verdict.
  const decidingMatchCaveat = "In een beslissingswedstrijd (de laatste een tot drie speelronden van de competitie, een kampioenschap, of een wedstrijd die de competitieleiding als zodanig heeft aangewezen) mag alleen invallen wie al een vastgestelde niveaubepaling heeft (artikel 5.3.6 en 5.3.6.1). Deze tool kent de speelronde niet en kan dit niet beoordelen.";

  // Article 5.1.1: a substitute from another club may not appear in teams of different clubs in
  // the same pool and may appear for at most three clubs this season. This applies regardless of
  // the ground for substituting, so to every allowed verdict.
  const differentClubsCaveat = "Komt de invaller van een andere vereniging, controleer dan dat de twee teams niet in dezelfde poule spelen en dat de speler dit seizoen nog niet voor drie verschillende verenigingen is uitgekomen (artikel 5.1.1). Deze tool kent de poule-indeling en de speelgeschiedenis van de speler niet.";

  if (lenderLevel === borrowerLevel) {
    reasoning.push(`${describe(lender)} en ${describe(borrower)} staan volgens de tabel klassengrenzen op hetzelfde niveau.`);
  } else if (lenderLevel > borrowerLevel) {
    reasoning.push(`${describe(lender)} speelt volgens de tabel klassengrenzen ${lenderLevel - borrowerLevel} niveau${lenderLevel - borrowerLevel === 1 ? "" : "s"} lager dan ${describe(borrower)}.`);
  } else {
    reasoning.push(`${describe(lender)} speelt volgens de tabel klassengrenzen ${borrowerLevel - lenderLevel} niveau${borrowerLevel - lenderLevel === 1 ? "" : "s"} hoger dan ${describe(borrower)}.`);
  }

  // Explains, in the terms of article 5.3.5.1, how a class is counted across an age category
  // boundary. The line comes right after the level line from the class boundaries table, so the
  // article stands next to the table instead of replacing it. Within the same age category this
  // yields null and nothing changes, which also covers ground fifth-class.
  const ageCategoryLine = ageCategoryReasoning(lender, borrower);
  if (ageCategoryLine) {
    reasoning.push(ageCategoryLine);
    addArticles("5.3.5.1");
  }

  // Add the age information for every case except when the level difference is too large.
  // lenderLevel - borrowerLevel > -2 means the difference is 0 or -1 (equal or one higher).
  if (fromOlderCategory && lenderLevel - borrowerLevel > -2) {
    conditions.push(`De speler moet voldoen aan de leeftijdsgrenzen van ${borrower.category}, de categorie waarin zij invalt.`);
    addArticles("3.1.1", "3.1.3");
    reasoning.push(`De speler komt uit een oudere leeftijdscategorie, dus de leeftijdsgrens van ${borrower.category} is bepalend.`);
  }

  // Article 5.3.5.4: additional rule for O14 field hockey. The article has two level groups, each
  // in its own period of the season (the voorcompetitie with Topklasse and Subtopklasse, the
  // lentecompetitie with Super O14 and IDC-O14). Within a group the players of the first team may
  // not substitute for the other teams at that level without permission from the competition
  // management. The tool has no team list and therefore cannot know whether a team is the first
  // team, so this condition always applies here as a warning.
  if (lender.category === "O14" && borrower.category === "O14") {
    const group = O14_LEVEL_GROUPS.find(
      (g) => g.classes.includes(lender.classId) && g.classes.includes(borrower.classId),
    );
    if (group) {
      const classNames = group.classes.map((k) => classLabel("O14", k));
      conditions.push(
        `In de ${group.period} geldt: als de vereniging meerdere teams in de ${classNames.join(" of de ")} heeft, zijn de spelers van het eerste team hier zonder toestemming van de competitieleiding niet speelgerechtigd.`,
      );
      addArticles("5.3.5.4");
      reasoning.push(`Beide teams spelen O14 in dezelfde niveaugroep van artikel 5.3.5.4 (${group.period}: ${classNames.join(" en ")}).`);
    }
  }

  // Ticket #3: article 5.3.5.1 already covers every situation where the lender plays in the same
  // class or a lower class than the borrower, without a maximum. The exception of article 5.3.5.3
  // (the maximum of two) is therefore only needed for the opposite direction: the lender plays in
  // a higher class than the borrower, both within the 5th class or lower and the same age
  // category.
  const sameCategory = lender.category === borrower.category;
  const lenderPlaysHigherWithinLowClasses =
    sameCategory &&
    isFifthOrLower(lender.classId) &&
    isFifthOrLower(borrower.classId) &&
    lowClassNumber(lender.classId) < lowClassNumber(borrower.classId);
  if (lenderPlaysHigherWithinLowClasses) {
    conditions.push("Er mogen maximaal twee spelers invallen zonder toestemming van de competitieleiding.");
    // Whether this maximum always applies or only with eleven or more of its own players is
    // uncertainty #13 in uncertainties.js. It is not a condition a team can meet, so it does not
    // belong in this list.
    addArticles("5.3.5.3");
    reasoning.push("De bron speelt in een hogere klasse dan de doel, allebei in de 5e klasse of lager binnen dezelfde leeftijdscategorie, dus de uitzondering van artikel 5.3.5.3 geldt.");
    caveats.push(levelDeterminationCaveat, decidingMatchCaveat, differentClubsCaveat);
    addArticles("5.3.4", "5.3.6", "5.3.6.1", "5.1.1");
    return { allowed: true, ground: "fifth-class", conditions, reasoning, articles, caveats };
  }

  if (lenderLevel >= borrowerLevel) {
    addArticles("5.3.5.1");
    reasoning.push("Lenen uit een team op gelijk of lager niveau mag altijd, ongeacht het aantal eigen spelers.");
    // Borrowing from a younger age category is what article 5.3.5.1 gives an example of, while
    // article 3.1.3 and the class boundaries table always let the age limits decide. That
    // contradiction is uncertainty #15 in uncertainties.js; here only the article number remains.
    if (fromYoungerCategory) addArticles("3.1.3");
    caveats.push(levelDeterminationCaveat, decidingMatchCaveat, differentClubsCaveat);
    addArticles("5.3.4", "5.3.6", "5.3.6.1", "5.1.1");
    return { allowed: true, ground: "equal-or-lower", conditions, reasoning, articles, caveats };
  }

  if (lenderLevel === borrowerLevel - 1) {
    const playerCount = borrower.category === "O11" ? 9 : 11;
    conditions.push(`Het team waarin wordt ingevallen heeft aantoonbaar maximaal ${playerCount} spelers beschikbaar uit het eigen of een lager spelend niveau.`);
    conditions.push("Er zijn aantoonbaar geen invallers beschikbaar uit een gelijk of lager spelend niveau.");
    conditions.push("Er mogen maximaal twee spelers invallen, inclusief een vaste doelverdediger.");
    conditions.push("Voor het inlenen van een doelverdediger geldt de eis over het aantal eigen spelers niet.");
    addArticles("5.3.5.2");
    reasoning.push("Lenen uit een team dat precies een niveau hoger speelt mag alleen als aan alle voorwaarden van artikel 5.3.5.2 is voldaan.");
    // Borrowing from a younger age category is what article 5.3.5.1 gives an example of, while
    // article 3.1.3 and the class boundaries table always let the age limits decide. That
    // contradiction is uncertainty #15 in uncertainties.js; here only the article number remains.
    if (fromYoungerCategory) addArticles("3.1.3");
    caveats.push(levelDeterminationCaveat, decidingMatchCaveat, differentClubsCaveat);
    addArticles("5.3.4", "5.3.6", "5.3.6.1", "5.1.1");
    return { allowed: true, ground: "one-higher", conditions, reasoning, articles, caveats };
  }

  addArticles("5.3.5.2");
  reasoning.push("Meer dan een niveau verschil is niet toegestaan zonder dispensatie van de competitieleiding.");
  return { allowed: false, ground: "too-high", conditions: [], reasoning, articles, caveats: [] };
}

// The place of a period in the season. PERIODS holds that order, so this is the only comparison
// that knows which period comes first. Throws on an id that is not in PERIODS, rather than
// returning -1: a silent -1 would sort before every real period index, so a typo in a
// CATEGORY_I_UNTIL "until" value or a renamed PERIODS id would make categoryINotice below think
// every period is past the boundary and start handing out ordinary category II verdicts for a
// category I class. The caller keeps periodId === null out of this function entirely, so that path
// is unaffected.
function periodIndex(periodId) {
  const index = PERIODS.findIndex((p) => p.id === periodId);
  if (index === -1) throw new Error(`unknown period id: ${periodId}`);
  return index;
}

// Throws on an unknown id for the same reason periodIndex does: a label that quietly falls back to
// the raw id ends up in a sentence the user reads, and "in de null" is worse than a stack trace.
export function periodLabel(periodId) {
  const found = PERIODS.find((p) => p.id === periodId);
  if (!found) throw new Error(`unknown period id: ${periodId}`);
  return found.label;
}

// Returns an explanation when the team falls outside category II, otherwise null. periodId is null
// as long as the user has chosen no period. The page never draws the grid in that state, but
// rules.js is a module of its own and must never silently assume a period.
export function categoryINotice(team, periodId = null) {
  const fixed = CATEGORY_I[team.category];
  if (fixed && fixed.includes(team.classId)) {
    return `${describe(team)} valt volgens hoofdstuk 2 van het Bondsreglement onder categorie I. Daarvoor gelden de speelgerechtigdheidsregels van hoofdstuk 4, die deze tool niet dekt.`;
  }

  const switching = (CATEGORY_I_UNTIL[team.category] || {})[team.classId];
  if (!switching) return null;

  // From the period after the boundary the class is category II and an ordinary verdict follows.
  // Without a chosen period every period is still possible, and then the conservative side is the
  // one that gives no verdict.
  if (periodId !== null && periodIndex(periodId) > periodIndex(switching.until)) return null;

  const scope = periodId === null
    ? "Zonder gekozen periode doet deze pagina hier geen uitspraak over."
    : `In de ${periodLabel(periodId)} doet deze pagina hier geen uitspraak over.`;

  if (switching.contested) {
    return `Het reglement zet ${describe(team)} ${switching.fromPhrase} onder categorie II, maar laat in het midden wat er ${switching.phrase} geldt en of er dan wordt gespeeld (hoofdstuk 2 van het Bondsreglement, en de artikelen 4.3.9 en 5.3.5.4). ${scope}`;
  }
  return `${describe(team)} valt ${switching.phrase} volgens hoofdstuk 2 van het Bondsreglement onder categorie I, met de speelgerechtigdheidsregels van hoofdstuk 4, en daarna onder categorie II. ${scope}`;
}

// The switching classes that are category I in this period, for the footnote under the grid. Asks
// categoryINotice itself, so there is one place that decides when a class is category I. contested
// is carried along so the footnote can tell apart the classes chapter 2 actually places under
// category I from the one it leaves open (see the design document of 31 August 2026): both get a
// column with no verdict, but for a different reason, and the footnote must not blur that.
export function periodCategoryIClasses(periodId) {
  const found = [];
  for (const category of AGE_CATEGORIES) {
    for (const classId of Object.keys(CATEGORY_I_UNTIL[category] || {})) {
      if (categoryINotice({ category, classId }, periodId)) {
        found.push({ category, classId, contested: Boolean(CATEGORY_I_UNTIL[category][classId].contested) });
      }
    }
  }
  return found;
}

export function ageOnReferenceDate(dateOfBirth) {
  if (Number.isNaN(dateOfBirth.getTime())) {
    throw new Error("ageOnReferenceDate needs a valid date of birth, this is an invalid date");
  }
  let age = REFERENCE_DATE.getUTCFullYear() - dateOfBirth.getUTCFullYear();
  const monthDiff = REFERENCE_DATE.getUTCMonth() - dateOfBirth.getUTCMonth();
  const dayDiff = REFERENCE_DATE.getUTCDate() - dateOfBirth.getUTCDate();
  if (monthDiff < 0 || (monthDiff === 0 && dayDiff < 0)) age -= 1;
  return age;
}

export function assessAge(lender, borrower, dateOfBirth) {
  const age = ageOnReferenceDate(dateOfBirth);
  const messages = [];
  const articles = [];
  const conditions = [];
  let blocks = false;

  const dateText = formatDateDutch(REFERENCE_DATE);
  const borrowerLimits = AGE_LIMITS[borrower.category];
  // A lender from a younger age category is by definition often too young for the borrower
  // category: that is precisely the normal situation when borrowing from a younger category
  // (article 5.3.5.1), not a deviation. So this must not block. Too old for the borrower category
  // and the exception of article 5.2.4 still block, also with a younger lender. And "too young"
  // no longer blocks when lender and borrower sit in the same age category either: the player is
  // then on a team list in exactly that category (ticket #22). Only with an older lender does it
  // still block.
  const lenderFromYoungerCategory =
    AGE_CATEGORY_ORDER.indexOf(lender.category) < AGE_CATEGORY_ORDER.indexOf(borrower.category);
  // Article 5.2.5 makes the O11 category an exception to "too old": a player of O12 age (one year
  // above the upper limit of O11) may be placed there when the club, on the basis of player
  // numbers, has trouble forming complete teams or good team compositions in the O11 and O12
  // categories. That is explicitly not a dispensation case (article 3.1.3), so this must not block
  // and the first message must not claim that dispensation is needed.
  const isO11PlayerCountException =
    borrower.category === "O11" && age === borrowerLimits.max + 1;
  if (age > borrowerLimits.max) {
    articles.push("3.1.1", "3.1.3");
    if (isO11PlayerCountException) {
      messages.push(`Op ${dateText} is de speler ${age} jaar, een jaar boven de bovengrens van ${borrowerLimits.max} jaar voor ${borrower.category}.`);
      messages.push(
        "Artikel 5.2.5 maakt hierop een uitzondering: verenigingen die op basis van aantallen problemen hebben om tot volledige teams of goede teamsamenstellingen te komen in de O11- en O12-categorie, mogen O12-jarigen indelen in de O11-categorie. Een individueel dispensatieverzoek is daarvoor niet nodig, mits de vereniging deze aantallenproblemen heeft.",
      );
      articles.push("5.2.5");
      conditions.push(
        "De vereniging moet op basis van de ingeschreven aantallen problemen hebben om tot volledige teams of goede teamsamenstellingen te komen in de O11- en O12-categorie (artikel 5.2.5).",
      );
    } else {
      blocks = true;
      messages.push(`Op ${dateText} is de speler ${age} jaar en daarmee te oud voor ${borrower.category}, waar de grens ${borrowerLimits.max} jaar is. Uitkomen in een categorie waarin zij volgens de leeftijdsgrenzen niet past mag alleen met dispensatie van de competitieleiding.`);
    }
  } else if (age < borrowerLimits.min) {
    if (lenderFromYoungerCategory) {
      messages.push(`Op ${dateText} is de speler ${age} jaar. Dat is jonger dan de ondergrens van ${borrowerLimits.min} jaar voor ${borrower.category}, maar de speler komt uit een jongere leeftijdscategorie, dus dat is hier de normale situatie en geen afwijking.`);
    } else if (lender.category === borrower.category) {
      // Ticket #22: the player is on a team list in exactly the category she substitutes in. She
      // can only be there because the competition management placed her there, and article 3.1.3
      // says that body decides in advance in which age category a player is placed. So that
      // question has already been answered and the tool must not answer it again. What remains is
      // a note: check that the dispensation is really there.
      messages.push(`Op ${dateText} is de speler ${age} jaar, jonger dan de ondergrens van ${borrowerLimits.min} jaar voor ${borrower.category}. Zij staat al op een teamlijst in ${borrower.category}, dus de competitieleiding heeft die indeling al beoordeeld (artikel 3.1.3). Ga na dat die dispensatie er is.`);
      articles.push("3.1.1", "3.1.3");
    } else {
      // The lender comes from an older age category. Whether a dispensation for that older
      // category also makes her eligible here is nowhere in the regulations, so this keeps
      // blocking: the conservative side, see the ticket about those cases.
      blocks = true;
      messages.push(`Op ${dateText} is de speler ${age} jaar en daarmee te jong voor ${borrower.category}, waar de ondergrens ${borrowerLimits.min} jaar is. Dit mag alleen met dispensatie van de competitieleiding.`);
      articles.push("3.1.1", "3.1.3");
    }
  } else {
    messages.push(`Op ${dateText} is de speler ${age} jaar en past daarmee binnen ${borrower.category}.`);
  }

  const lenderLimits = AGE_LIMITS[lender.category];
  const fallsUnderException =
    OLDER_PLAYER_EXCEPTION.categories.includes(lender.category) &&
    OLDER_PLAYER_EXCEPTION.classes.includes(lender.classId) &&
    age === lenderLimits.max + 1;
  if (fallsUnderException) {
    blocks = true;
    messages.push(`De speler is een jaar ouder dan de grens van ${lender.category}. Zij kan op de teamlijst staan als een van de twee spelers die volgens artikel 5.2.4 maximaal een jaar ouder mogen zijn, maar die spelers mogen uitsluitend uitkomen voor het team waarop zij op de teamlijst staan en dus nooit invallen.`);
    articles.push("5.2.4");
  }

  if (dateOfBirth.getUTCMonth() === REFERENCE_DATE.getUTCMonth() && dateOfBirth.getUTCDate() === REFERENCE_DATE.getUTCDate()) {
    messages.push(`Deze geboortedatum valt precies op ${dateText}. Het reglement gebruikt 'voor ${dateText}' en 'op ${dateText}' door elkaar, dus dit is een randgeval. Leg dit voor aan de competitieleiding.`);
  }

  return { age, blocks, messages, articles, conditions };
}

function hasValidDateOfBirth(dateOfBirth) {
  return dateOfBirth instanceof Date && !Number.isNaN(dateOfBirth.getTime());
}

// The context the predicates in uncertainties.js read. Everything they need is calculated here, so
// that file needs nothing from rules.js and there is no cycle between the two.
function uncertaintyContext(lender, borrower, periodId, ground, age) {
  return {
    lender,
    borrower,
    periodId,
    ground,
    age,
    categoryDistance:
      AGE_CATEGORY_ORDER.indexOf(lender.category) - AGE_CATEGORY_ORDER.indexOf(borrower.category),
    involves: (category, classId) =>
      (lender.category === category && lender.classId === classId) ||
      (borrower.category === category && borrower.classId === classId),
    bothFifthOrLower: isFifthOrLower(lender.classId) && isFifthOrLower(borrower.classId),
  };
}

// The only function the user interface calls.
export function assess(lender, borrower, dateOfBirth, periodId = null) {
  const outOfScope = categoryINotice(lender, periodId) || categoryINotice(borrower, periodId);
  if (outOfScope) {
    return {
      verdict: "out-of-scope",
      summary: outOfScope,
      conditions: [],
      reasoning: [],
      age: null,
      articles: [],
      ground: null,
      caveats: [],
      // Out of scope is itself a verdict resting on the classification of chapter 2, and that is
      // exactly what several tickets are about, so the uncertainties belong here too.
      uncertainties: uncertaintiesFor(uncertaintyContext(lender, borrower, periodId, null, null)),
    };
  }

  const levelOutcome = assessLevel(lender, borrower);
  // An unreadable date of birth is treated as "no date of birth given": the age check simply does
  // not run then. ageOnReferenceDate does throw a clear error when it is called directly with an
  // invalid date, see the explanation in the report.
  const age = hasValidDateOfBirth(dateOfBirth) ? assessAge(lender, borrower, dateOfBirth) : null;

  // Conditions and articles from assessAge only belong here when the class already allows it. When
  // the class itself blocks (ground too-high), the age is no longer relevant and that information
  // must not sneak in after all.
  let articles;
  let conditions;
  if (levelOutcome.allowed) {
    articles = [...new Set([...levelOutcome.articles, ...(age ? age.articles : [])])].sort();
    conditions = [...levelOutcome.conditions, ...(age ? age.conditions : [])];
  } else {
    articles = [...new Set(levelOutcome.articles)].sort();
    conditions = [];
  }

  let verdict;
  let summary;
  if (!levelOutcome.allowed) {
    verdict = "not-allowed";
    summary = `Nee. ${describe(lender)} speelt te veel niveaus hoger dan ${describe(borrower)}. Dit mag alleen met dispensatie van de competitieleiding.`;
  } else if (age && age.blocks) {
    verdict = "not-allowed";
    summary = `Nee. De klassengrens staat het toe, maar de leeftijd van de speler niet.`;
  } else if (conditions.length > 0) {
    verdict = "allowed";
    summary = `Ja, mits aan de voorwaarden hieronder is voldaan.`;
  } else {
    verdict = "allowed";
    summary = `Ja. Een speler uit ${describe(lender)} mag invallen in ${describe(borrower)}.`;
  }

  // When the verdict is not-allowed, no conditions remain: they would suggest that the player
  // could still meet them, while the verdict is already settled. This holds both when the class
  // check itself rejects and when the class allows it but the age blocks. The summary above has
  // already been determined, so this no longer affects that choice.
  if (verdict === "not-allowed") {
    conditions = [];
  }

  const uncertainties = uncertaintiesFor(
    uncertaintyContext(lender, borrower, periodId, levelOutcome.ground, age),
  );

  return {
    verdict,
    summary,
    conditions,
    reasoning: levelOutcome.reasoning,
    age,
    articles,
    ground: levelOutcome.ground,
    caveats: levelOutcome.caveats,
    uncertainties,
  };
}

// Ground on which the player-count requirement of article 5.3.5.2 applies: one level higher.
const PLAYER_COUNT_GROUNDS = ["one-higher"];

// Ground on which article 5.3.5.3 applies: the exception from the 5th class down within the same
// age category. There the player-count requirement does not apply, only a maximum of two
// substitutes without permission from the competition management.
const MAX_TWO_GROUNDS = ["fifth-class"];

// Determines how a cell in the overview grid must be drawn: a status plus the list of
// requirements that actually apply.
//
// A cell can carry more than one requirement. This function used to pick one and throw the rest
// away, which made the grid keep conditions quiet: a cell where both the age limit and the
// player-count requirement of article 5.3.5.2 applied showed only the age, and a cell whose only
// condition came from article 5.3.5.4 wrongly got the age label.
//
// The order of the requirements is fixed, so that the labels in the grid are predictable.
// Caveats (outcome.caveats) are not conditions and therefore yield no requirement.
export function cellFromOutcome(outcome) {
  // A cell rests on an open uncertainty regardless of its status: a "nee" or a "geen uitspraak"
  // that follows from a choice the reglement does not make is exactly what a coach must see.
  const uncertain = outcome.uncertainties.length > 0;
  if (outcome.verdict === "out-of-scope") return { status: "out-of-scope", requirements: [], uncertain };
  if (outcome.verdict === "not-allowed") return { status: "no", requirements: [], uncertain };

  const requirements = [];
  // Article 5.3.5.2: borrowing from a team that plays one level higher is only allowed with
  // demonstrably too few own players.
  if (PLAYER_COUNT_GROUNDS.includes(outcome.ground)) requirements.push("player-count");
  // Article 5.3.5.1, third bullet: the substitute must meet the age limits of the category she
  // substitutes in.
  if (outcome.conditions.some((v) => /leeftijdsgrenzen van/.test(v))) requirements.push("age");
  // Article 5.3.5.4: players of the first team are not eligible for the other teams within the
  // same O14 level group. The article carries this condition, so the presence of the article
  // number is what it is derived from here.
  if (outcome.articles.includes("5.3.5.4")) requirements.push("first-team");
  // Article 5.3.5.3: from the 5th class down within the same age category at most two players may
  // substitute without permission from the competition management.
  if (MAX_TWO_GROUNDS.includes(outcome.ground)) requirements.push("max-two");

  return { status: "free", requirements, uncertain };
}

// Builds the data for the overview grid: one row per age category, one cell per column.
// A cell without a date of birth, because the grid shows what is possible at class level.
export function overview(borrower, periodId = null) {
  return AGE_CATEGORIES.map((category) => ({
    category,
    cells: COLUMNS.map((column) => {
      const classEntry = CLASSES[category].find((k) => k.id === column);
      if (!classEntry) return { classId: column, exists: false };
      const outcome = assess({ category, classId: column }, borrower, null, periodId);
      const cell = cellFromOutcome(outcome);
      return {
        classId: column,
        label: classEntry.label,
        exists: true,
        verdict: outcome.verdict,
        status: cell.status,
        requirements: cell.requirements,
        uncertain: cell.uncertain,
      };
    }),
  }));
}
