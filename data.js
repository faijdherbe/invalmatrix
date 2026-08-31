// Season data for the substitution check. Everything that changes per season lives here.
// Source 1: KNHB Bondsreglement 2026.
// Source 2: KNHB Tabel klassengrenzen veld/zaalhockey seizoen 2026-2027.

export const SEASON = "2026-2027";
export const REFERENCE_DATE = new Date(Date.UTC(2026, 9, 1));
export const DISCIPLINE = "veldhockey";

export const AGE_CATEGORIES = ["O11", "O12", "O14", "O16", "O18"];

const LOW_CLASSES = [
  { id: "5e", label: "5e klasse" },
  { id: "6e", label: "6e klasse" },
  { id: "7e", label: "7e klasse" },
  { id: "8e", label: "8e klasse" },
];

const NUMBERED_CLASSES = [
  { id: "1e", label: "1e klasse" },
  { id: "2e", label: "2e klasse" },
  { id: "3e", label: "3e klasse" },
  { id: "4e", label: "4e klasse" },
];

export const CLASSES = {
  O11: [...NUMBERED_CLASSES, ...LOW_CLASSES],
  O12: [...NUMBERED_CLASSES, ...LOW_CLASSES],
  O14: [
    { id: "super", label: "Super O14" },
    { id: "idc", label: "IDC-O14" },
    { id: "top", label: "Topklasse" },
    { id: "subtop", label: "Subtopklasse" },
    ...NUMBERED_CLASSES,
    ...LOW_CLASSES,
  ],
  O16: [
    { id: "landelijk", label: "Landelijk" },
    { id: "super", label: "Super O16 / Topklasse" },
    { id: "subtop", label: "Subtopklasse" },
    ...NUMBERED_CLASSES,
    ...LOW_CLASSES,
  ],
  O18: [
    { id: "landelijk", label: "Landelijk" },
    { id: "super", label: "Super O18 / Topklasse" },
    { id: "subtop", label: "Subtopklasse" },
    ...NUMBERED_CLASSES,
    ...LOW_CLASSES,
  ],
};

// The classes that get a column in the overview grid, from high to low level.
// landelijk and super are left out: those always fall under category I, so every cell there
// would give the same meaningless answer. The page names them in a footnote.
export const COLUMNS = ["idc", "top", "subtop", "1e", "2e", "3e", "4e", "5e", "6e", "7e", "8e"];

// Row number in the class boundaries table. The 5th class and everything below shares one row.
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

export const LEVELS = {
  O11: ladder(7),
  O12: ladder(7),
  O14: { super: 4, idc: 4, top: 4, subtop: 5, ...ladder(6) },
  O16: { landelijk: 2, super: 3, subtop: 4, ...ladder(5) },
  O18: { landelijk: 1, super: 2, subtop: 3, ...ladder(4) },
};

// Article 5.3.5.4: level groups for the additional O14 rule. Within a group the players of the
// first team are not eligible, without permission from the competition management, for the other
// teams of the club in a class from that same group.
// The period field here is the string vocabulary of articles 4.3.8/4.3.9/5.3.5.4 (voorcompetitie,
// lentecompetitie), not the id vocabulary of PERIODS below (early, mid, late). The two stay
// deliberately unlinked: article 5.3.5.4 is a restriction with its own periods and not a place to
// apply the PERIODS boundary, see "Reikwijdte" in the design document of 31 August 2026.
export const O14_LEVEL_GROUPS = [
  { period: "voorcompetitie", classes: ["top", "subtop"] },
  { period: "lentecompetitie", classes: ["super", "idc"] },
];

// Classes that fall under category I according to the classification of chapter 2.
// For category I the eligibility rules of chapter 4 apply.
// This tool only covers category II and makes no statement about these.
export const CATEGORY_I = {
  O14: ["super"],
  O16: ["landelijk", "super"],
  O18: ["landelijk", "super"],
};

// Periods within the season. The two boundaries are the ones chapter 2 of the Bondsreglement
// names: the herfstvakantie and the winterstop. The labels voorcompetitie and lentecompetitie come
// from articles 4.3.8, 4.3.9 and 5.3.5.4. The reglement does not say where the boundary between
// voorcompetitie and lentecompetitie lies; this tool puts it at the winterstop. See ticket #29.
// The early period is labeled "tot en met de herfstvakantie", chapter 2's own words for the O18
// Subtopklasse category I line. Chapter 2 also has a category II line for that class, "vanaf de
// herfstvakantie", which claims the herfstvakantie itself too: chapter 2 overlaps itself there. A
// match played in the herfstvakantie week has no period the reglement clearly assigns it to. This
// tool puts that week on the category I side, because that is the side that never wrongly says
// "ja". See ticket #32.
// The same self-overlap exists at the winterstop, for the O16 Subtopklasse: chapter 2's category I
// line says "tot en met de winterstop", its category II line says "vanaf de winterstop", so the
// winterstop week itself is claimed twice too. The mid period is labeled "tot en met de
// winterstop" for the same reason as early above, and that week is resolved on the category I side
// for the same reason: it is the side that never wrongly says "ja". Also ticket #32.
// This array's ids (early/mid/late) are a vocabulary of their own, separate from the
// voorcompetitie/lentecompetitie strings O14_LEVEL_GROUPS above uses; see the comment there for why
// they are not unified.
// The order of this array is the order of the season, and it is the only place where that order is
// recorded.
export const PERIODS = [
  { id: "early", label: "voorcompetitie tot en met de herfstvakantie" },
  { id: "mid", label: "voorcompetitie na de herfstvakantie tot en met de winterstop" },
  { id: "late", label: "lentecompetitie" },
];

// Classes that are category I during only part of the season. until is the last period in which
// the class is still category I; from the period after that it is category II. For the two
// Subtopklassen, phrase is the wording chapter 2 itself uses for the category I side, so the rule
// stands next to its source. contested marks a class about which the reglement does not settle the
// category before the boundary; for that class (O14.idc) chapter 2 has no category I side at all,
// so phrase there is this tool's own inversion of chapter 2's category II wording, not a quote. The
// notice for a contested class claims no category at all. See ticket #19. fromPhrase is only used
// for a contested class: it is chapter 2's own wording for the category II side, so that wording
// also stands next to its source instead of being written out again in rules.js.
export const CATEGORY_I_UNTIL = {
  // Chapter 2: "de Landelijke Subtopklasse O18 vanaf de herfstvakantie".
  O18: { subtop: { until: "early", phrase: "tot en met de herfstvakantie" } },
  // Chapter 2: "de Landelijke Subtopklasse O16 vanaf de winterstop".
  O16: { subtop: { until: "mid", phrase: "tot en met de winterstop" } },
  // Chapter 2 names IDC-O14 nowhere under category I and only says that it falls under category II
  // from the winter break. What holds before that, and whether it is played at all then, articles
  // 4.3.9 and 5.3.5.4 leave open.
  O14: { idc: { until: "mid", phrase: "voor de winterstop", fromPhrase: "vanaf de winterstop", contested: true } },
};

// Age on the reference date, articles 3.1.1, 5.2.4 and 5.2.5 of the Bondsreglement 2026.
export const AGE_LIMITS = {
  O11: { min: 10, max: 10 },
  O12: { min: 11, max: 11 },
  O14: { min: 12, max: 13 },
  O16: { min: 14, max: 15 },
  O18: { min: 16, max: 17 },
};

// Article 5.2.4 applies to these categories, in the 2nd class and below.
export const OLDER_PLAYER_EXCEPTION = {
  categories: ["O12", "O14", "O16", "O18"],
  classes: ["2e", "3e", "4e", "5e", "6e", "7e", "8e"],
};
