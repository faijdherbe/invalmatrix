// The text the page shows while the choice is still incomplete. Kept apart from app.js because
// app.js reaches for the DOM at module level and can therefore not be imported in a test.

// Dutch enumeration: "a, b en c". With one item or none no commas or "en" are needed.
export function listWithAnd(items) {
  if (items.length <= 1) return items.join("");
  return `${items.slice(0, -1).join(", ")} en ${items[items.length - 1]}`;
}

// The choices in the order in which they appear on the page, so the sentence follows the eye.
const CHOICES = [
  { key: "period", name: "een periode" },
  { key: "category", name: "een leeftijdscategorie" },
  { key: "classId", name: "een klasse" },
];

// Names only the choices that are still missing. Returns an empty string once everything has been
// chosen, and the caller then draws the grid.
export function missingChoicesSentence(selection) {
  const missing = CHOICES.filter((choice) => !selection[choice.key]).map((choice) => choice.name);
  if (missing.length === 0) return "";
  return `Kies eerst ${listWithAnd(missing)}.`;
}
