// The texts the page shows for the open uncertainties of uncertainties.js. Purely text based, no
// DOM use: the result can be rendered by app.js, or checked by tests. Same reason as
// article-text.js and selection.js, which keep their text apart for the same reason.
export const ISSUE_URL = "https://github.com/faijdherbe/invalmatrix/issues";

// The heading above the collapsed block. An empty string when there is nothing to warn about; the
// caller then draws no block at all and the screen stays as it was.
export function uncertaintyHeading(count) {
  if (count === 0) return "";
  return `Het reglement is hier op ${count} punt${count === 1 ? "" : "en"} onduidelijk`;
}

// One line per uncertainty, in the order they come in, with the link to its ticket alongside. The
// ticket number is what makes a warning traceable: a coach who wants to know where this comes from
// can read the question and the answer of the competition management there.
export function uncertaintyLines(uncertainties) {
  return uncertainties.map((uncertainty) => ({
    ticket: uncertainty.ticket,
    heading: uncertainty.heading,
    explanation: uncertainty.explanation,
    linkText: `ticket #${uncertainty.ticket}`,
    url: `${ISSUE_URL}/${uncertainty.ticket}`,
  }));
}
