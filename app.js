import { AGE_CATEGORIES, CLASSES, COLUMNS, CATEGORY_I, PERIODS, SEASON, DISCIPLINE } from "./data.js";
import { assess, overview, categoryINotice, periodCategoryIClasses, periodLabel } from "./rules.js";
import { listWithAnd, missingChoicesSentence } from "./selection.js";
import { ARTICLES } from "./articles.js";
import { toBlocks } from "./article-text.js";
import { uncertaintyHeading, uncertaintyLines, cellMarkers } from "./uncertainty-text.js";

const period = document.getElementById("period");
const missingChoices = document.getElementById("missing-choices");
const borrowerCategory = document.getElementById("borrower-category");
const borrowerClass = document.getElementById("borrower-class");
const grid = document.getElementById("grid");
const mobileOverview = document.getElementById("mobile-overview");
const gridFootnote = document.getElementById("grid-footnote");
const detailBlock = document.getElementById("detail-block");
const detailHeading = document.getElementById("detail-heading");
const birthDateField = document.getElementById("birth-date-field");
const birthDate = document.getElementById("birth-date");
const result = document.getElementById("result");

let selectedLender = null;

document.getElementById("context").textContent = `${DISCIPLINE}, categorie II`;

// Also safe inside an attribute (title, data-*): innerHTML already escapes angle brackets and
// the ampersand, but not the quote character that always surrounds the attributes here.
function escape(text) {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML.replaceAll('"', "&quot;").replaceAll("'", "&#39;");
}

function label(category, classId) {
  const found = CLASSES[category].find((c) => c.id === classId);
  return found ? found.label : classId;
}

// The empty option that every choice starts on. Its value is the empty string, so
// missingChoicesSentence sees it as not chosen.
function addPlaceholder(select, text) {
  const option = document.createElement("option");
  option.value = "";
  option.textContent = text;
  select.append(option);
}

function fillPeriods() {
  addPlaceholder(period, `Kies een periode in ${SEASON}`);
  for (const item of PERIODS) {
    const option = document.createElement("option");
    option.value = item.id;
    option.textContent = `${SEASON}, ${item.label}`;
    period.append(option);
  }
}

function fillCategories() {
  addPlaceholder(borrowerCategory, "Kies een leeftijdscategorie");
  for (const category of AGE_CATEGORIES) {
    const option = document.createElement("option");
    option.value = category;
    option.textContent = category;
    borrowerCategory.append(option);
  }
}

// The class choice depends on the age category, so it stays disabled until there is one.
function fillClasses() {
  const current = borrowerClass.value;
  borrowerClass.innerHTML = "";
  if (!borrowerCategory.value) {
    addPlaceholder(borrowerClass, "Kies eerst een leeftijdscategorie");
    borrowerClass.disabled = true;
    return;
  }
  borrowerClass.disabled = false;
  addPlaceholder(borrowerClass, "Kies een klasse");
  for (const classItem of CLASSES[borrowerCategory.value]) {
    const option = document.createElement("option");
    option.value = classItem.id;
    option.textContent = classItem.label;
    borrowerClass.append(option);
  }
  const exists = CLASSES[borrowerCategory.value].some((c) => c.id === current);
  borrowerClass.value = exists ? current : "";
}

function currentSelection() {
  return { period: period.value, category: borrowerCategory.value, classId: borrowerClass.value };
}

// rules.js expects null for "no period chosen", while an unchosen select yields the empty string.
// Everything that goes into rules.js passes through here.
function currentPeriod() {
  return period.value || null;
}

function currentBorrower() {
  return { category: borrowerCategory.value, classId: borrowerClass.value };
}

function columnLabel(column) {
  if (column === "idc") return "IDC-O14";
  if (column === "top") return "Top";
  if (column === "subtop") return "Subtop";
  return column;
}

// One place for both views to draw from: the short text in a grid cell and the description that
// both the legend under the grid and the group headings in the mobile view use. A cell consists
// of a status (allowed, not allowed, no verdict) and a list of requirements, see cellFromOutcome()
// in rules.js.
//
// Order of the statuses: first what is allowed, then what is not, then what there is no verdict
// about. That is also the order in which the groups appear in the mobile view, because the user
// is looking for who is allowed to fill in. The group "mag" also holds the conditional cases, so
// the heading is "mag" and not "mag altijd": which conditions apply is shown per class behind the
// label.
const STATUS_ORDER = ["free", "no", "out-of-scope"];

const STATUSES = {
  free: { short: "ja", description: "mag altijd", groupHeading: "mag" },
  no: { short: "nee", description: "mag niet", groupHeading: "mag niet" },
  "out-of-scope": { short: "?", description: "geen uitspraak", groupHeading: "geen uitspraak" },
};

// The requirements with a short label of their own in the cell, in the order in which rules.js
// returns them. The requirement max-two (article 5.3.5.3) is not in here: it gets no text but the
// triangle in the top right of the cell, see corner-triangle in style.css and SR_ONLY_CAVEAT below.
const REQUIREMENT_ORDER = ["player-count", "age", "first-team"];

const REQUIREMENTS = {
  "player-count": { short: "mits", description: "mag alleen bij aantoonbaar te weinig spelers (artikel 5.3.5.2)" },
  age: { short: "lft", description: "mag, mits de speler de juiste leeftijd heeft (artikel 5.3.5.1)" },
  "first-team": { short: "team", description: "mag niet voor spelers uit het eerste team, zonder toestemming van de competitieleiding (artikel 5.3.5.4)" },
};

// Explanation of the combined labels, to go under the legend.
const COMBINATION_EXPLANATION = "Staan er twee labels met een + ertussen, dan gelden beide voorwaarden.";

// The requirements that get a visible label, in the fixed order of rules.js. max-two drops out here.
function visibleRequirements(requirements) {
  return requirements.filter((requirement) => REQUIREMENTS[requirement]);
}

// The short labels of a cell strung together with a plus, for example "mits+lft". Empty when there
// is no visible requirement; the cell then shows the text of its status.
function requirementsLabel(requirements) {
  return visibleRequirements(requirements).map((requirement) => REQUIREMENTS[requirement].short).join("+");
}

// The color of a cell or class button: green when there is nothing to arrange (no requirement, or
// only max-two), yellow as soon as a condition applies. The color says whether there are
// conditions, the text says which. For status no and out-of-scope the status itself is the color.
function cellColor(cell) {
  if (cell.status !== "free") return cell.status;
  return visibleRequirements(cell.requirements).length > 0 ? "conditional" : "free";
}

// Text that is not on screen but is read aloud: the triangle marker itself is purely visual
// (color), so this is how screen reader users and people who do not see color can still know that
// this cell carries a caveat.
const SR_ONLY_CAVEAT = '<span class="sr-only"> (met een kanttekening)</span>';

// Same approach as SR_ONLY_CAVEAT above: the purple corner is purely visual, so this is how
// someone who does not see color still learns that this cell rests on an open uncertainty.
const SR_ONLY_UNCERTAIN = '<span class="sr-only"> (met een openstaande onduidelijkheid)</span>';

// The CSS class per marker from cellMarkers(), and the text that is read aloud for it.
const MARKERS = {
  "max-two": { className: "corner-triangle", srOnly: SR_ONLY_CAVEAT },
  uncertain: { className: "uncertain-corner", srOnly: SR_ONLY_UNCERTAIN },
};

// The full description of every requirement, for screen readers too. The title attribute of the
// button keeps naming the team, so this explanation goes through the same sr-only approach as above.
function srOnlyRequirementsHtml(requirements) {
  const visible = visibleRequirements(requirements);
  if (visible.length === 0) return "";
  const texts = visible.map((requirement) => REQUIREMENTS[requirement].description).join("; ");
  return `<span class="sr-only"> (${escape(texts)})</span>`;
}

// A small example of the triangle marker itself, for the explanation line. aria-hidden because the
// accompanying text ("mag, met een kanttekening...") already tells what it means.
function caveatExampleHtml() {
  return `<span class="caveat-example corner-triangle" aria-hidden="true">${escape(STATUSES.free.short)}</span>`;
}

// Refers to the triangle marker for the max-two exception (article 5.3.5.3): it is allowed, but
// there is a caveat that only shows up in the detail view.
function caveatExplanationHtml() {
  return `${caveatExampleHtml()} betekent: mag, met een kanttekening die je ziet zodra je op het vakje klikt.`;
}

// A small example of the purple corner, for the explanation line, next to the yellow one.
function uncertaintyExampleHtml() {
  return `<span class="caveat-example uncertain-corner" aria-hidden="true">${escape(STATUSES.free.short)}</span>`;
}

// Refers to the purple corner: the verdict in this cell rests on a point the Bondsreglement leaves
// open, and the detail view says which one.
function uncertaintyExplanationHtml() {
  return `${uncertaintyExampleHtml()} betekent: het reglement is hier onduidelijk over, klik op het vakje om te zien waarover.`;
}

// A line in the legend: a colored badge with the short label, followed by the description.
function legendLineHtml(color, short, description) {
  return `<span class="legend-badge ${escape(color)}">${escape(short)}</span> ${escape(description)}`;
}

// The explanation under the mobile view. There are no lines for ja, nee and ? there, because those
// groups already have a heading in words. The short labels behind a class do need an explanation.
function mobileExplanationHtml() {
  return [
    ...REQUIREMENT_ORDER.map((requirement) => legendLineHtml("conditional", REQUIREMENTS[requirement].short, REQUIREMENTS[requirement].description)),
    caveatExplanationHtml(),
    uncertaintyExplanationHtml(),
    escape(COMBINATION_EXPLANATION),
  ].join("<br>");
}

// The content of a grid cell: the short labels of the requirements, or the text of the status when
// there is no visible requirement. Behind that the explanation for screen readers.
function cellHtml(cell) {
  const text = requirementsLabel(cell.requirements) || STATUSES[cell.status].short;
  const srOnly = cellMarkers(cell).map((marker) => MARKERS[marker].srOnly).join("");
  return `${escape(text)}${srOnlyRequirementsHtml(cell.requirements)}${srOnly}`;
}

// Sums up which classes fall under category I, for the footnote under the grid. Generated from
// CATEGORY_I and CLASSES, so the text follows along automatically when that data changes.
function categoryIList() {
  return AGE_CATEGORIES.filter((category) => CATEGORY_I[category])
    .map((category) => {
      const labels = CATEGORY_I[category].map((classId) => label(category, classId));
      return `${category}: ${listWithAnd(labels)}`;
    })
    .join("; ");
}

// The switching classes that are category I in the chosen period. Those do have a column in the
// grid, unlike the fixed category I classes, so the footnote names them separately, and never
// claims they are missing from the grid: they are right there, they just show "?" instead of a
// verdict. Two different sentences for two different reasons: chapter 2 itself puts some classes
// under category I in this period (settled), while for IDC-O14 the reglement leaves the category
// open (contested, see periodCategoryIClasses in rules.js and the design document of 31 August
// 2026). Each sentence is only rendered when its list is non-empty.
function periodCategoryIText(periodId) {
  // Without a chosen period there is no period to name, and showGrid does not draw the grid then
  // either. periodCategoryIClasses does return every switching class for a null period, so this
  // guard has to come first.
  if (periodId === null) return "";
  const classes = periodCategoryIClasses(periodId);
  if (classes.length === 0) return "";
  const periodName = periodLabel(periodId);
  const names = (items) => listWithAnd(items.map((item) => `${item.category} ${label(item.category, item.classId)}`));

  const settled = classes.filter((item) => !item.contested);
  const contested = classes.filter((item) => item.contested);

  const sentences = [];
  if (settled.length > 0) {
    // Verb and column noun agree with the number of classes: valt/geeft (singular) or
    // vallen/geven (plural).
    const plural = settled.length > 1;
    const verb = plural ? "vallen" : "valt";
    const give = plural ? "geven" : "geeft";
    const column = plural ? "kolommen" : "kolom";
    sentences.push(` Volgens hoofdstuk 2 ${verb} ${names(settled)} in de ${periodName} ook onder categorie I, dus ${give} die ${column} daar geen oordeel.`);
  }
  if (contested.length > 0) {
    const plural = contested.length > 1;
    const give = plural ? "geven" : "geeft";
    const column = plural ? "kolommen" : "kolom";
    // With a sentence about category I in front of it the period has just been named, so this one
    // says "dan" instead of repeating the whole label, and "ook" belongs with the column: it is
    // that column that gives no verdict either. Standing alone the sentence has to name the period
    // itself, and there is no earlier column for "ook" to point back to.
    sentences.push(settled.length > 0
      ? ` Voor ${names(contested)} laat het reglement in het midden wat er dan geldt, dus ${give} ook die ${column} geen oordeel.`
      : ` Wat er in de ${periodName} voor ${names(contested)} geldt, laat het reglement in het midden, dus ${give} die ${column} geen oordeel.`);
  }
  return sentences.join("");
}

// Builds the table for wide screens from the same rows as the mobile view.
function gridTableHtml(rows) {
  const headings = COLUMNS.map((column) => `<th scope="col">${escape(columnLabel(column))}</th>`).join("");
  const body = rows
    .map((row) => {
      const cells = row.cells
        .map((cell) => {
          if (!cell.exists) return `<td class="cell empty"></td>`;
          const title = `${row.category} ${cell.label}`;
          const markers = cellMarkers(cell).map((marker) => MARKERS[marker].className);
          const buttonClass = markers.length > 0 ? ` class="${markers.join(" ")}"` : "";
          return `<td class="cell ${escape(cellColor(cell))}"><button type="button"${buttonClass} data-category="${escape(row.category)}" data-class-id="${escape(cell.classId)}" title="${escape(title)}">${cellHtml(cell)}</button></td>`;
        })
        .join("");
      return `<tr><th scope="row">${escape(row.category)}</th>${cells}</tr>`;
    })
    .join("");

  // First what is always allowed, then the requirements that make a cell conditional, then what is
  // not allowed and what there is no verdict about, and finally the two explanation lines.
  const legend = [
    legendLineHtml("free", STATUSES.free.short, STATUSES.free.description),
    ...REQUIREMENT_ORDER.map((requirement) => legendLineHtml("conditional", REQUIREMENTS[requirement].short, REQUIREMENTS[requirement].description)),
    legendLineHtml("no", STATUSES.no.short, STATUSES.no.description),
    legendLineHtml("out-of-scope", STATUSES["out-of-scope"].short, STATUSES["out-of-scope"].description),
    caveatExplanationHtml(),
    uncertaintyExplanationHtml(),
    escape(COMBINATION_EXPLANATION),
  ].join("\n");

  return `<div class="grid-scroll"><table>
<thead><tr><th scope="col">Komt uit</th>${headings}</tr></thead>
<tbody>${body}</tbody>
</table></div>
<p class="legend">
${legend}
</p>`;
}

// Groups the cells of a row by status, in the order of STATUS_ORDER, and leaves out empty groups
// and classes that do not exist. Works on the same rows as the table, so no second calculation.
// The grouping deliberately goes by status and not by the combination of requirements: that would
// yield a proliferation of small groups. The requirements are shown per class behind the label.
function mobileGroups(row) {
  const existing = row.cells.filter((cell) => cell.exists);
  return STATUS_ORDER
    .map((status) => ({ status, cells: existing.filter((cell) => cell.status === status) }))
    .filter((group) => group.cells.length > 0);
}

// Builds the mobile view: a block per age category, and within it the classes grouped by what is
// allowed. A category without an allowed option does not disappear, it then simply shows only the
// groups that do exist.
function mobileCategoryHtml(row) {
  const groupsHtml = mobileGroups(row)
    .map((group) => {
      const buttons = group.cells
        .map((cell) => {
          const title = `${row.category} ${cell.label}`;
          const markers = cellMarkers(cell);
          const requirements = requirementsLabel(cell.requirements);
          const labelHtml = [
            escape(cell.label),
            requirements ? ` <span class="mobile-requirements">${escape(requirements)}</span>` : "",
            srOnlyRequirementsHtml(cell.requirements),
            ...markers.map((marker) => MARKERS[marker].srOnly),
          ].join("");
          // The mobile list uses class names of its own for the markers (see .mobile-class.caveat
          // and .mobile-class.uncertain in style.css): a corner on a fully round pill floats loose
          // from the shape, so there they are borders instead of corners.
          const className = [
            "mobile-class",
            escape(cellColor(cell)),
            markers.includes("max-two") ? "caveat" : "",
            markers.includes("uncertain") ? "uncertain" : "",
          ].filter(Boolean).join(" ");
          return `<button type="button" class="${className}" data-category="${escape(row.category)}" data-class-id="${escape(cell.classId)}" title="${escape(title)}">${labelHtml}</button>`;
        })
        .join("");
      return `<div class="mobile-group">
<p class="mobile-group-heading ${escape(group.status)}">${escape(STATUSES[group.status].groupHeading)}</p>
<div class="mobile-classes">${buttons}</div>
</div>`;
    })
    .join("");
  return `<div class="mobile-category"><h3>${escape(row.category)}</h3>${groupsHtml}</div>`;
}

function showGrid() {
  const selection = currentSelection();
  const missing = missingChoicesSentence(selection);
  missingChoices.textContent = missing;
  if (missing) {
    grid.innerHTML = "";
    mobileOverview.innerHTML = "";
    gridFootnote.textContent = "";
    hideDetail();
    return;
  }

  const borrower = currentBorrower();
  const notice = categoryINotice(borrower, currentPeriod());
  if (notice) {
    grid.innerHTML = `<p class="out-of-scope-notice">${escape(notice)}</p>`;
    mobileOverview.innerHTML = "";
    gridFootnote.textContent = "";
    hideDetail();
    return;
  }

  const rows = overview(borrower, currentPeriod());
  grid.innerHTML = gridTableHtml(rows);
  mobileOverview.innerHTML =
    rows.map(mobileCategoryHtml).join("") + `<p class="mobile-explanation">${mobileExplanationHtml()}</p>`;

  gridFootnote.textContent =
    `De klassen die onder categorie I vallen (${categoryIList()}) staan niet in dit raster; daar doet deze pagina geen uitspraak over.${periodCategoryIText(currentPeriod())} Klik op een vakje voor de onderbouwing.`;

  for (const button of [...grid.querySelectorAll("button[data-category]"), ...mobileOverview.querySelectorAll("button[data-category]")]) {
    button.addEventListener("click", () => {
      selectedLender = { category: button.dataset.category, classId: button.dataset.classId };
      markSelected();
      showDetail();
    });
  }

  if (selectedLender && !CLASSES[selectedLender.category].some((c) => c.id === selectedLender.classId)) {
    selectedLender = null;
  }
  if (selectedLender) {
    markSelected();
    showDetail();
  } else {
    hideDetail();
  }
}

function markSelected() {
  for (const button of grid.querySelectorAll("button[data-category]")) {
    const active =
      selectedLender &&
      button.dataset.category === selectedLender.category &&
      button.dataset.classId === selectedLender.classId;
    button.parentElement.classList.toggle("selected", Boolean(active));
  }
  for (const button of mobileOverview.querySelectorAll("button[data-category]")) {
    const active =
      selectedLender &&
      button.dataset.category === selectedLender.category &&
      button.dataset.classId === selectedLender.classId;
    button.classList.toggle("selected", Boolean(active));
  }
}

function hideDetail() {
  detailBlock.hidden = true;
  result.innerHTML = "";
}

function list(title, lines) {
  if (lines.length === 0) return "";
  const items = lines.map((line) => `<li>${escape(line)}</li>`).join("");
  return `<h3>${title}</h3><ul>${items}</ul>`;
}

// The open uncertainties about the Bondsreglement that apply to this combination, from
// uncertainties.js through assess(). Collapsed, because a combination can carry four of them at
// once and the verdict must stay readable. It sits directly under the verdict and above "Let op",
// so the answer stays where the eye lands and the warning is still the first thing after it. The
// texts themselves come from uncertainty-text.js, so they can be tested; here only the HTML.
function uncertaintyBlockHtml(uncertainties) {
  if (uncertainties.length === 0) return "";
  const items = uncertaintyLines(uncertainties)
    .map((line) => {
      const link = `<a href="${escape(line.url)}" target="_blank" rel="noopener">${escape(line.linkText)}</a>`;
      return `<li><strong>${escape(line.heading)}</strong><br>${escape(line.explanation)} (${link})</li>`;
    })
    .join("");
  return `<details class="uncertainty"><summary>${escape(uncertaintyHeading(uncertainties.length))}</summary><ul>${items}</ul></details>`;
}

// Shows the caveats that assess() hands over: not a condition the user can meet, but a warning
// that the rule itself is contested (for example borrowing from a younger age category, which
// article 5.3.5.1 gives an example of, while article 3.1.3 and the class boundaries table always
// let the age limits decide). This is something different from the caveat triangles for max-two in
// the overview (see caveatExampleHtml and SR_ONLY_CAVEAT above); that is why this block is called
// "let op" and not "kanttekening", so the two are not mixed up. It sits directly under the summary,
// above the conditions, so that someone who only reads the verdict cannot miss this warning.
function cautionBlockHtml(caveats) {
  if (caveats.length === 0) return "";
  const items = caveats.map((text) => `<li>${escape(text)}</li>`).join("");
  return `<div class="caution"><h3>Let op</h3><ul>${items}</ul></div>`;
}

// Renders a block from toBlocks() as a readable HTML element. A paragraph becomes an ordinary
// paragraph, an item gets a bullet through CSS (see style.css) and the matching indentation based
// on its level.
function blockHtml(block) {
  if (block.kind === "item") {
    return `<p class="article-item article-item-${block.level}">${escape(block.text)}</p>`;
  }
  return `<p class="article-paragraph">${escape(block.text)}</p>`;
}

function articleBlock(numbers) {
  if (numbers.length === 0) return "";
  const items = numbers
    .map((number) => {
      const article = ARTICLES[number];
      if (!article) return "";
      const blocks = toBlocks(article.text).map(blockHtml).join("");
      return `<details><summary>Artikel ${escape(number)}: ${escape(article.title)}</summary><div class="article-text">${blocks}</div></details>`;
    })
    .join("");
  return `<h3>De artikelen zelf</h3>${items}`;
}

function showDetail() {
  if (!selectedLender) return;
  const borrower = currentBorrower();
  detailBlock.hidden = false;
  detailHeading.textContent = `Een speler uit ${selectedLender.category} ${label(selectedLender.category, selectedLender.classId)} laten invallen in ${borrower.category} ${label(borrower.category, borrower.classId)}`;

  const entered = birthDate.value;
  const date = entered ? new Date(`${entered}T00:00:00Z`) : null;
  const outcome = assess(selectedLender, borrower, date, currentPeriod());

  // Whether the date of birth still matters is independent of the date that was entered: without a
  // date assess() can only return "allowed" when the class itself permits it (age is null then, so
  // it cannot block the outcome, see assess() in rules.js). Is that outcome already not-allowed or
  // out-of-scope, then no date changes anything about it and we hide the field. This calculates
  // nothing about substitution rules itself, it only reuses assess() with an empty date.
  const withoutDate = assess(selectedLender, borrower, null, currentPeriod());
  birthDateField.hidden = withoutDate.verdict !== "allowed";

  result.className = outcome.verdict;
  result.innerHTML = [
    `<p class="verdict">${escape(outcome.summary)}</p>`,
    uncertaintyBlockHtml(outcome.uncertainties),
    cautionBlockHtml(outcome.caveats),
    list("Voorwaarden", outcome.conditions),
    outcome.age ? list("Leeftijd", outcome.age.messages) : "",
    list("Waarom", outcome.reasoning),
    articleBlock(outcome.articles),
  ].join("");
}

fillPeriods();
fillCategories();
fillClasses();
showGrid();

period.addEventListener("change", showGrid);
borrowerCategory.addEventListener("change", () => {
  fillClasses();
  showGrid();
});
borrowerClass.addEventListener("change", showGrid);
birthDate.addEventListener("change", showDetail);
