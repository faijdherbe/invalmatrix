// Turns the verbatim article text from articles.js (with the hard line breaks as they come out
// of the PDF, wrapped at page width) into an array of readable blocks. Purely text based, no
// DOM use: the result can be rendered by app.js, or checked by tests.
//
// A block looks like this:
//   { kind: "paragraph", text }        running text without line breaks
//   { kind: "item", level, text }      a list item, level 1 or 2
//
// In the source text blocks are separated by an empty line. A list item starts with a bullet
// character: "•" for level 1, or the letter "o" followed by a space for level 2 (the examples
// underneath a list item). All other lines are continuation lines of the current block and are
// glued to the text with a space, even when they do not start with a bullet character but do
// start on a new line after a full stop.
export function toBlocks(text) {
  const lines = text.split("\n");
  const blocks = [];
  let current = null;

  function close() {
    if (current) {
      blocks.push(current);
      current = null;
    }
  }

  function append(part) {
    current.text = current.text.length > 0 ? `${current.text} ${part}` : part;
  }

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.length === 0) {
      close();
      continue;
    }

    const level1 = trimmed.match(/^•\s+(.*)$/);
    const level2 = trimmed.match(/^o\s+(.*)$/);

    if (level1) {
      close();
      current = { kind: "item", level: 1, text: "" };
      append(level1[1]);
    } else if (level2) {
      close();
      current = { kind: "item", level: 2, text: "" };
      append(level2[1]);
    } else if (current) {
      append(trimmed);
    } else {
      current = { kind: "paragraph", text: "" };
      append(trimmed);
    }
  }
  close();

  return blocks;
}
