import { test } from "node:test";
import assert from "node:assert/strict";
import { listWithAnd, missingChoicesSentence } from "../selection.js";

test("listWithAnd joins with commas and an en before the last item", () => {
  assert.equal(listWithAnd([]), "");
  assert.equal(listWithAnd(["een periode"]), "een periode");
  assert.equal(listWithAnd(["een periode", "een klasse"]), "een periode en een klasse");
  assert.equal(listWithAnd(["a", "b", "c"]), "a, b en c");
});

test("a complete selection yields no sentence", () => {
  assert.equal(missingChoicesSentence({ period: "late", category: "O14", classId: "1e" }), "");
});

test("the sentence names only what is missing, in the order of the page", () => {
  assert.equal(
    missingChoicesSentence({ period: "", category: "", classId: "" }),
    "Kies eerst een periode, een leeftijdscategorie en een klasse.",
  );
  assert.equal(
    missingChoicesSentence({ period: "late", category: "", classId: "" }),
    "Kies eerst een leeftijdscategorie en een klasse.",
  );
  assert.equal(
    missingChoicesSentence({ period: "", category: "O14", classId: "1e" }),
    "Kies eerst een periode.",
  );
  assert.equal(
    missingChoicesSentence({ period: "late", category: "O14", classId: "" }),
    "Kies eerst een klasse.",
  );
});

test("a missing key counts as not chosen", () => {
  assert.equal(missingChoicesSentence({}), "Kies eerst een periode, een leeftijdscategorie en een klasse.");
});
