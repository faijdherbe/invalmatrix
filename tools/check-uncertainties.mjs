// Checks that the list in uncertainties.js matches the open tickets on GitHub. Two directions:
// a ticket in the list that is closed means a warning stayed on the page too long, and an open
// "Onzeker:" ticket that is not in the list means a warning is missing. See CLAUDE.md.
//
// Deliberately not part of npm test: that suite must keep running offline and without gh.
import { execFileSync } from "node:child_process";
import { UNCERTAINTIES } from "../uncertainties.js";

const REPO = "faijdherbe/invalmatrix";

function issues(state) {
  const output = execFileSync(
    "gh",
    ["issue", "list", "--repo", REPO, "--state", state, "--limit", "200", "--json", "number,title,state"],
    { encoding: "utf8" },
  );
  return JSON.parse(output);
}

// An uncertainty ticket is recognised by its title, the wording CLAUDE.md prescribes for these.
function isUncertaintyTicket(issue) {
  return /^Onzeker:/.test(issue.title);
}

const listed = new Set(UNCERTAINTIES.map((uncertainty) => uncertainty.ticket));
const open = issues("open");
const openNumbers = new Set(open.map((issue) => issue.number));

const problems = [];

for (const ticket of [...listed].sort((a, b) => a - b)) {
  if (!openNumbers.has(ticket)) {
    problems.push(`ticket #${ticket} staat in uncertainties.js maar is niet meer open. Haal de waarschuwing weg, samen met de tests erbij.`);
  }
}

for (const issue of open.filter(isUncertaintyTicket).sort((a, b) => a.number - b.number)) {
  if (!listed.has(issue.number)) {
    problems.push(`ticket #${issue.number} staat open maar heeft geen waarschuwing in uncertainties.js: ${issue.title}`);
  }
}

if (problems.length === 0) {
  console.log(`In orde: ${listed.size} waarschuwingen, allemaal met een openstaand ticket.`);
  process.exit(0);
}

console.error("De lijst in uncertainties.js loopt uit de pas met de tickets:");
for (const problem of problems) {
  console.error(`  - ${problem}`);
}
process.exit(1);
