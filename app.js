import { CATEGORIEEN, KLASSEN, KOLOMMEN, CATEGORIE_I, SEIZOEN, TAK } from "./data.js";
import { assess, overzicht, categorieIMelding } from "./rules.js";
import { ARTIKELEN } from "./articles.js";
import { naarBlokken } from "./artikeltekst.js";

const doelCategorie = document.getElementById("doel-categorie");
const doelKlasse = document.getElementById("doel-klasse");
const raster = document.getElementById("raster");
const mobielOverzicht = document.getElementById("mobiel-overzicht");
const rasterVoetnoot = document.getElementById("raster-voetnoot");
const detailBlok = document.getElementById("detail-blok");
const detailKop = document.getElementById("detail-kop");
const geboortedatum = document.getElementById("geboortedatum");
const resultaat = document.getElementById("resultaat");

let gekozenBron = null;

document.getElementById("context").textContent = `Seizoen ${SEIZOEN}, ${TAK}, categorie II`;

// Ook veilig binnen een attribuut (title, data-*): innerHTML escapet punthaken en de
// ampersand al, maar niet het aanhalingsteken waarmee attributen hier altijd omsloten worden.
function escape(tekst) {
  const div = document.createElement("div");
  div.textContent = tekst;
  return div.innerHTML.replaceAll('"', "&quot;").replaceAll("'", "&#39;");
}

function label(categorie, klasseId) {
  const gevonden = KLASSEN[categorie].find((k) => k.id === klasseId);
  return gevonden ? gevonden.label : klasseId;
}

function vulCategorieen() {
  for (const categorie of CATEGORIEEN) {
    const optie = document.createElement("option");
    optie.value = categorie;
    optie.textContent = categorie;
    doelCategorie.append(optie);
  }
  doelCategorie.value = "O14";
}

function vulKlassen() {
  const huidige = doelKlasse.value;
  doelKlasse.innerHTML = "";
  for (const klasse of KLASSEN[doelCategorie.value]) {
    const optie = document.createElement("option");
    optie.value = klasse.id;
    optie.textContent = klasse.label;
    doelKlasse.append(optie);
  }
  const bestaat = KLASSEN[doelCategorie.value].some((k) => k.id === huidige);
  doelKlasse.value = bestaat ? huidige : "4e";
}

function huidigDoel() {
  return { categorie: doelCategorie.value, klasse: doelKlasse.value };
}

function kolomLabel(kolom) {
  if (kolom === "top") return "Top";
  if (kolom === "subtop") return "Subtop";
  return kolom;
}

// Een plek voor beide weergaven om uit te putten: het korte tekstje in een rastervakje en de
// omschrijving die zowel de legenda onder het raster als de groepskopjes in de mobiele
// weergave gebruiken. Volgorde: eerst wat mag, dan wat onder voorwaarden mag, dan wat niet mag,
// dan waar geen uitspraak over is. Dat is ook de volgorde waarin groepen in de mobiele weergave
// verschijnen, want de gebruiker zoekt wie er wel mag invallen.
//
// max2 (de uitzondering van 5.3.5.3) toont zich hier niet als eigen soort: die wordt visueel bij
// vrij getrokken, met een asterisk als verwijzing naar de kanttekening in het detailscherm. Zie
// weergaveSoort().
const SOORT_VOLGORDE = ["vrij", "aantallen", "max2", "leeftijd", "nee", "buiten-scope"];

const SOORTEN = {
  vrij: { kort: "ja", omschrijving: "mag altijd" },
  aantallen: { kort: "mits", omschrijving: "mag alleen bij aantoonbaar te weinig spelers" },
  leeftijd: { kort: "lft", omschrijving: "mag, mits de speler de juiste leeftijd heeft" },
  nee: { kort: "nee", omschrijving: "mag niet" },
  "buiten-scope": { kort: "?", omschrijving: "geen uitspraak" },
};

// De soort waarmee een vakje/klasse-knop visueel wordt behandeld (kleur, groepering). max2 deelt
// de groene "mag altijd"-weergave van vrij; de onderliggende soort (voor assess()/detailscherm)
// verandert niet.
function weergaveSoort(soort) {
  return soort === "max2" ? "vrij" : soort;
}

// Dezelfde volgorde als SOORT_VOLGORDE, maar dan van weergavesoorten: max2 valt samen met vrij en
// levert dus geen aparte, tweede "vrij"-groep op.
const WEERGAVE_VOLGORDE = [...new Set(SOORT_VOLGORDE.map(weergaveSoort))];

const ASTERISK_HTML = '<span class="asterisk">*</span>';

// De asterisk zelf verwijst naar de kanttekening bij de max2-uitzondering (artikel 5.3.5.3): het
// mag, maar er is een kanttekening die pas in het detailscherm staat.
function asteriskUitlegHtml() {
  return `${ASTERISK_HTML} betekent: mag, met een kanttekening die je ziet zodra je op het vakje klikt.`;
}

function vakjeHtml(vakje) {
  if (vakje.soort === "max2") return `${escape(SOORTEN.vrij.kort)}${ASTERISK_HTML}`;
  const soort = SOORTEN[vakje.soort];
  return soort ? escape(soort.kort) : "";
}

// Nederlandse opsomming: "a, b en c". Bij een of geen item geen komma's of "en" nodig.
function opsommingMetEn(items) {
  if (items.length <= 1) return items.join("");
  return `${items.slice(0, -1).join(", ")} en ${items[items.length - 1]}`;
}

// Somt op welke klassen onder categorie I vallen, voor de voetnoot onder het raster. Gegenereerd
// uit CATEGORIE_I en KLASSEN, zodat de tekst automatisch meebeweegt als die gegevens wijzigen.
function categorieILijst() {
  return CATEGORIEEN.filter((categorie) => CATEGORIE_I[categorie])
    .map((categorie) => {
      const labels = CATEGORIE_I[categorie].map((klasseId) => label(categorie, klasseId));
      return `${categorie}: ${opsommingMetEn(labels)}`;
    })
    .join("; ");
}

// Bouwt de tabel voor brede schermen uit dezelfde rijen als de mobiele weergave.
function rasterTabelHtml(rijen) {
  const koppen = KOLOMMEN.map((kolom) => `<th scope="col">${escape(kolomLabel(kolom))}</th>`).join("");
  const lichaam = rijen
    .map((rij) => {
      const cellen = rij.vakjes
        .map((vakje) => {
          if (!vakje.bestaat) return `<td class="vakje leeg"></td>`;
          const titel = `${rij.categorie} ${vakje.label}`;
          return `<td class="vakje ${escape(weergaveSoort(vakje.soort))}"><button type="button" data-categorie="${escape(rij.categorie)}" data-klasse="${escape(vakje.klasse)}" title="${escape(titel)}">${vakjeHtml(vakje)}</button></td>`;
        })
        .join("");
      return `<tr><th scope="row">${escape(rij.categorie)}</th>${cellen}</tr>`;
    })
    .join("");

  const legenda = WEERGAVE_VOLGORDE
    .map((soort) => `<span class="legenda-badge ${escape(soort)}">${escape(SOORTEN[soort].kort)}</span> ${escape(SOORTEN[soort].omschrijving)}`)
    .concat(asteriskUitlegHtml())
    .join("\n");

  return `<div class="raster-schuif"><table>
<thead><tr><th scope="col">Komt uit</th>${koppen}</tr></thead>
<tbody>${lichaam}</tbody>
</table></div>
<p class="legenda">
${legenda}
</p>`;
}

// Groepeert de vakjes van een rij per weergavesoort, in de volgorde van WEERGAVE_VOLGORDE, en
// laat lege groepen en niet-bestaande klassen weg. Werkt op dezelfde rijen als de tabel, dus geen
// tweede berekening. max2-klassen komen hier in de vrij-groep terecht (zie weergaveSoort()).
function mobielGroepen(rij) {
  const bestaande = rij.vakjes.filter((vakje) => vakje.bestaat);
  return WEERGAVE_VOLGORDE
    .map((soort) => ({ soort, vakjes: bestaande.filter((vakje) => weergaveSoort(vakje.soort) === soort) }))
    .filter((groep) => groep.vakjes.length > 0);
}

// Bouwt de mobiele weergave: per leeftijdscategorie een blok, daarbinnen de klassen gegroepeerd
// op wat er mag. Een categorie zonder toegestane optie verdwijnt niet, die toont dan gewoon
// alleen de groepen die er wel zijn.
function mobielCategorieHtml(rij) {
  const groepenHtml = mobielGroepen(rij)
    .map((groep) => {
      const knoppen = groep.vakjes
        .map((vakje) => {
          const titel = `${rij.categorie} ${vakje.label}`;
          const labelHtml = vakje.soort === "max2" ? `${escape(vakje.label)}${ASTERISK_HTML}` : escape(vakje.label);
          return `<button type="button" class="mobiel-klasse ${escape(groep.soort)}" data-categorie="${escape(rij.categorie)}" data-klasse="${escape(vakje.klasse)}" title="${escape(titel)}">${labelHtml}</button>`;
        })
        .join("");
      return `<div class="mobiel-groep">
<p class="mobiel-groep-kop ${escape(groep.soort)}">${escape(SOORTEN[groep.soort].omschrijving)}</p>
<div class="mobiel-klassen">${knoppen}</div>
</div>`;
    })
    .join("");
  return `<div class="mobiel-categorie"><h3>${escape(rij.categorie)}</h3>${groepenHtml}</div>`;
}

function toonRaster() {
  const doel = huidigDoel();
  const melding = categorieIMelding(doel);
  if (melding) {
    raster.innerHTML = `<p class="buiten-scope-melding">${escape(melding)}</p>`;
    mobielOverzicht.innerHTML = "";
    rasterVoetnoot.textContent = "";
    verbergDetail();
    return;
  }

  const rijen = overzicht(doel);
  raster.innerHTML = rasterTabelHtml(rijen);
  mobielOverzicht.innerHTML =
    rijen.map(mobielCategorieHtml).join("") + `<p class="mobiel-asterisk-uitleg">${asteriskUitlegHtml()}</p>`;

  rasterVoetnoot.textContent =
    `De klassen die onder categorie I vallen (${categorieILijst()}) staan niet in dit raster. Daar doet deze pagina geen uitspraak over. Klik op een vakje voor de onderbouwing.`;

  for (const knop of [...raster.querySelectorAll("button[data-categorie]"), ...mobielOverzicht.querySelectorAll("button[data-categorie]")]) {
    knop.addEventListener("click", () => {
      gekozenBron = { categorie: knop.dataset.categorie, klasse: knop.dataset.klasse };
      markeerGekozen();
      toonDetail();
    });
  }

  if (gekozenBron && !KLASSEN[gekozenBron.categorie].some((k) => k.id === gekozenBron.klasse)) {
    gekozenBron = null;
  }
  if (gekozenBron) {
    markeerGekozen();
    toonDetail();
  } else {
    verbergDetail();
  }
}

function markeerGekozen() {
  for (const knop of raster.querySelectorAll("button[data-categorie]")) {
    const actief =
      gekozenBron &&
      knop.dataset.categorie === gekozenBron.categorie &&
      knop.dataset.klasse === gekozenBron.klasse;
    knop.parentElement.classList.toggle("gekozen", Boolean(actief));
  }
  for (const knop of mobielOverzicht.querySelectorAll("button[data-categorie]")) {
    const actief =
      gekozenBron &&
      knop.dataset.categorie === gekozenBron.categorie &&
      knop.dataset.klasse === gekozenBron.klasse;
    knop.classList.toggle("gekozen", Boolean(actief));
  }
}

function verbergDetail() {
  detailBlok.hidden = true;
  resultaat.innerHTML = "";
}

function lijst(titel, regels) {
  if (regels.length === 0) return "";
  const items = regels.map((regel) => `<li>${escape(regel)}</li>`).join("");
  return `<h3>${titel}</h3><ul>${items}</ul>`;
}

// Rendert een blok uit naarBlokken() als een leesbaar HTML-element. Een alinea wordt een
// gewone paragraaf, een item krijgt een bullet via CSS (zie style.css) en de bijbehorende
// inspringing op basis van het niveau.
function blokHtml(blok) {
  if (blok.soort === "item") {
    return `<p class="artikel-item artikel-item-${blok.niveau}">${escape(blok.tekst)}</p>`;
  }
  return `<p class="artikel-alinea">${escape(blok.tekst)}</p>`;
}

function artikelBlok(nummers) {
  if (nummers.length === 0) return "";
  const items = nummers
    .map((nummer) => {
      const artikel = ARTIKELEN[nummer];
      if (!artikel) return "";
      const blokken = naarBlokken(artikel.tekst).map(blokHtml).join("");
      return `<details><summary>Artikel ${escape(nummer)}: ${escape(artikel.titel)}</summary><div class="artikel-tekst">${blokken}</div></details>`;
    })
    .join("");
  return `<h3>De artikelen zelf</h3>${items}`;
}

function toonDetail() {
  if (!gekozenBron) return;
  const doel = huidigDoel();
  detailBlok.hidden = false;
  detailKop.textContent = `Een speler uit ${gekozenBron.categorie} ${label(gekozenBron.categorie, gekozenBron.klasse)} laten invallen in ${doel.categorie} ${label(doel.categorie, doel.klasse)}`;

  const ingevoerd = geboortedatum.value;
  const datum = ingevoerd ? new Date(`${ingevoerd}T00:00:00Z`) : null;
  const uitkomst = assess(gekozenBron, doel, datum);

  resultaat.className = uitkomst.verdict;
  resultaat.innerHTML = [
    `<p class="oordeel">${escape(uitkomst.samenvatting)}</p>`,
    lijst("Voorwaarden", uitkomst.voorwaarden),
    uitkomst.leeftijd ? lijst("Leeftijd", uitkomst.leeftijd.meldingen) : "",
    lijst("Waarom", uitkomst.redenering),
    artikelBlok(uitkomst.artikelen),
  ].join("");
}

vulCategorieen();
vulKlassen();
toonRaster();

doelCategorie.addEventListener("change", () => {
  vulKlassen();
  toonRaster();
});
doelKlasse.addEventListener("change", toonRaster);
geboortedatum.addEventListener("change", toonDetail);
