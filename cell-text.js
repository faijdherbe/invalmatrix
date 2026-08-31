// The display data both views draw from: the short text in a grid cell, the description that the
// legend under the grid and the group headings in the mobile view use, and the color that follows
// from the requirements. A cell consists of a status (allowed, not allowed, no verdict) and a list
// of requirements, see cellFromOutcome() in rules.js.
//
// This lives apart from app.js because app.js reaches for the DOM the moment it is imported and
// can therefore not be loaded in a test. Same reason as article-text.js, selection.js and
// uncertainty-text.js.

// Order of the statuses: first what is allowed, then what is not, then what there is no verdict
// about. That is also the order in which the groups appear in the mobile view, because the user
// is looking for who is allowed to fill in. The group "mag" also holds the conditional cases, so
// the heading is "mag" and not "mag altijd": which conditions apply is shown per class behind the
// label.
export const STATUS_ORDER = ["free", "no", "out-of-scope"];

export const STATUSES = {
  free: { short: "ja", description: "mag altijd", groupHeading: "mag" },
  no: { short: "nee", description: "mag niet", groupHeading: "mag niet" },
  "out-of-scope": { short: "?", description: "geen uitspraak", groupHeading: "geen uitspraak" },
};

// The requirements with a short label in the cell, in the order in which rules.js returns them.
// max-two used to be missing here, because it got a triangle in the corner instead of a label.
// That triangle was the only carrier of the condition and it shared its color with a block in the
// detail view that has nothing to do with it, see ticket #36. It is a condition like the others,
// so it is a label like the others.
export const REQUIREMENT_ORDER = ["player-count", "age", "first-team", "max-two"];

export const REQUIREMENTS = {
  "player-count": { short: "mits", description: "mag alleen bij aantoonbaar te weinig spelers (artikel 5.3.5.2)" },
  age: { short: "lft", description: "mag, mits de speler de juiste leeftijd heeft (artikel 5.3.5.1)" },
  "first-team": { short: "team", description: "mag niet voor spelers uit het eerste team, zonder toestemming van de competitieleiding (artikel 5.3.5.4)" },
  "max-two": { short: "max 2", description: "er mogen maximaal twee spelers invallen zonder toestemming van de competitieleiding (artikel 5.3.5.3)" },
};

// Explanation of the combined labels, to go under the legend.
export const COMBINATION_EXPLANATION = "Staan er twee labels met een + ertussen, dan gelden beide voorwaarden.";

// The requirements that get a visible label. Everything rules.js returns has one now, but the
// filter stays: it keeps an unknown requirement out of the cell instead of printing "undefined".
export function visibleRequirements(requirements) {
  return requirements.filter((requirement) => REQUIREMENTS[requirement]);
}

// The short labels of a cell strung together with a plus, for example "mits+lft". Empty when there
// is no visible requirement; the cell then shows the text of its status.
export function requirementsLabel(requirements) {
  return visibleRequirements(requirements).map((requirement) => REQUIREMENTS[requirement].short).join("+");
}

// The color of a cell or class button: green when there is nothing to arrange, yellow as soon as a
// condition applies. The color says whether there are conditions, the text says which. For status
// no and out-of-scope the status itself is the color.
export function cellColor(cell) {
  if (cell.status !== "free") return cell.status;
  return visibleRequirements(cell.requirements).length > 0 ? "conditional" : "free";
}
