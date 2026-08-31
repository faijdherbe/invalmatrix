// Checks that the list in uncertainties.js matches the open tickets on GitHub. Two directions:
// a ticket in the list that is closed means a warning stayed on the page too long, and an open
// "Onzeker:" ticket that is not in the list means a warning is missing. See CLAUDE.md.
//
// Deliberately not part of npm test: that suite must keep running offline and without gh.
import { execFileSync } from "node:child_process";
import { UNCERTAINTIES } from "../uncertainties.js";

const REPO = "faijdherbe/invalmatrix";

// The ceiling on what gh hands back. It is a lot more than this repo will realistically have, but
// gh stays silent when it truncates, so issues() checks below whether the ceiling was reached.
const LIMIT = 200;

function issues(state) {
  let output;
  try {
    output = execFileSync(
      "gh",
      ["issue", "list", "--repo", REPO, "--state", state, "--limit", String(LIMIT), "--json", "number,title,state"],
      { encoding: "utf8" },
    );
  } catch (error) {
    // Without this the script dies on a raw Node stack trace, which tells whoever runs it nothing.
    // The two ways this fails in practice are gh not being installed and gh not being logged in,
    // so the message names both and then shows what gh itself said.
    console.error("Kan 'gh issue list' niet draaien. Is gh geinstalleerd, en ben je ingelogd?");
    const detail = String(error.stderr || error.message || "").trim();
    if (detail) console.error(`  ${detail}`);
    process.exit(1);
  }

  const parsed = JSON.parse(output);
  // gh truncates silently. Without this check the script could report "in orde" while a ticket
  // just outside the window has no warning at all.
  if (parsed.length >= LIMIT) {
    console.error(`Er zijn minstens ${LIMIT} tickets met de status ${state}, en dat is de limiet van dit script. Verhoog LIMIT in tools/check-uncertainties.mjs.`);
    process.exit(1);
  }
  return parsed;
}

// An uncertainty ticket is recognised by its title, the wording CLAUDE.md prescribes for these.
function isUncertaintyTicket(issue) {
  return /^Onzeker:/.test(issue.title);
}

const listed = new Set(UNCERTAINTIES.map((uncertainty) => uncertainty.ticket));
const open = issues("open");
const closed = issues("closed");
const openNumbers = new Set(open.map((issue) => issue.number));
const closedNumbers = new Set(closed.map((issue) => issue.number));

const problems = [];

for (const ticket of [...listed].sort((a, b) => a - b)) {
  if (openNumbers.has(ticket)) continue;
  if (closedNumbers.has(ticket)) {
    problems.push(`ticket #${ticket} staat in uncertainties.js maar is niet meer open. Haal de waarschuwing weg, samen met de tests erbij.`);
  } else {
    problems.push(`ticket #${ticket} staat in uncertainties.js maar bestaat niet op GitHub. Controleer of het ticketnummer klopt.`);
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
