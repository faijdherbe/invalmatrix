// Seizoensgegevens voor de invalcheck. Alles wat per seizoen wijzigt staat hier.
// Bron 1: KNHB Bondsreglement 2026.
// Bron 2: KNHB Tabel klassengrenzen veld/zaalhockey seizoen 2026-2027.

export const SEIZOEN = "2026-2027";
export const PEILDATUM = new Date(Date.UTC(2026, 9, 1));
export const TAK = "veldhockey";

export const CATEGORIEEN = ["O11", "O12", "O14", "O16", "O18"];

const LAGE_KLASSEN = [
  { id: "5e", label: "5e klasse" },
  { id: "6e", label: "6e klasse" },
  { id: "7e", label: "7e klasse" },
  { id: "8e", label: "8e klasse" },
];

const GEWONE_KLASSEN = [
  { id: "1e", label: "1e klasse" },
  { id: "2e", label: "2e klasse" },
  { id: "3e", label: "3e klasse" },
  { id: "4e", label: "4e klasse" },
];

export const KLASSEN = {
  O11: [...GEWONE_KLASSEN, ...LAGE_KLASSEN],
  O12: [...GEWONE_KLASSEN, ...LAGE_KLASSEN],
  O14: [
    { id: "super", label: "Super O14 / IDC-O14" },
    { id: "top", label: "Topklasse" },
    { id: "subtop", label: "Subtopklasse" },
    ...GEWONE_KLASSEN,
    ...LAGE_KLASSEN,
  ],
  O16: [
    { id: "landelijk", label: "Landelijk" },
    { id: "super", label: "Super O16 / Topklasse" },
    { id: "subtop", label: "Subtopklasse" },
    ...GEWONE_KLASSEN,
    ...LAGE_KLASSEN,
  ],
  O18: [
    { id: "landelijk", label: "Landelijk" },
    { id: "super", label: "Super O18 / Topklasse" },
    { id: "subtop", label: "Subtopklasse" },
    ...GEWONE_KLASSEN,
    ...LAGE_KLASSEN,
  ],
};

// De klassen die een kolom krijgen in het overzichtsraster, van hoog naar laag niveau.
// landelijk en super staan er niet in: die vallen altijd onder categorie I, dus daar zou elk
// vakje hetzelfde nietszeggende antwoord geven. De pagina noemt ze in een voetnoot.
export const KOLOMMEN = ["top", "subtop", "1e", "2e", "3e", "4e", "5e", "6e", "7e", "8e"];

// Rijnummer in de tabel klassengrenzen. De 5e klasse en alles daaronder deelt een rij.
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

export const NIVEAU = {
  O11: ladder(7),
  O12: ladder(7),
  O14: { super: 4, top: 4, subtop: 5, ...ladder(6) },
  O16: { landelijk: 2, super: 3, subtop: 4, ...ladder(5) },
  O18: { landelijk: 1, super: 2, subtop: 3, ...ladder(4) },
};

// Klassen die volgens de indeling van hoofdstuk 2 onder categorie I vallen.
// Voor categorie I gelden de speelgerechtigdheidsregels van hoofdstuk 4.
// Deze tool dekt alleen categorie II en doet hier geen uitspraak over.
export const CATEGORIE_I = {
  O14: ["super"],
  O16: ["landelijk", "super"],
  O18: ["landelijk", "super"],
};

// Klassen die gedurende het seizoen van categorie wisselen.
export const CATEGORIE_I_PERIODE = {
  O16: { subtop: "tot en met de winterstop" },
  O18: { subtop: "tot en met de herfstvakantie" },
};

// Leeftijd op de peildatum, artikelen 3.1.1, 5.2.4 en 5.2.5 van het Bondsreglement 2026.
export const LEEFTIJDSGRENZEN = {
  O11: { min: 10, max: 10 },
  O12: { min: 11, max: 11 },
  O14: { min: 12, max: 13 },
  O16: { min: 14, max: 15 },
  O18: { min: 16, max: 17 },
};

// Artikel 5.2.4 geldt voor deze categorieen, in de 2e klasse en lager.
export const OUDERE_SPELER_UITZONDERING = {
  categorieen: ["O12", "O14", "O16", "O18"],
  klassen: ["2e", "3e", "4e", "5e", "6e", "7e", "8e"],
};
