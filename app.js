import { CATEGORIEEN, KLASSEN, KOLOMMEN, SEIZOEN, TAK } from "./data.js";
import { assess, overzicht, categorieIMelding } from "./rules.js";
import { ARTIKELEN } from "./articles.js";

const doelCategorie = document.getElementById("doel-categorie");
const doelKlasse = document.getElementById("doel-klasse");
const raster = document.getElementById("raster");
const rasterVoetnoot = document.getElementById("raster-voetnoot");
const detailBlok = document.getElementById("detail-blok");
const detailKop = document.getElementById("detail-kop");
const geboortedatum = document.getElementById("geboortedatum");
const resultaat = document.getElementById("resultaat");

let gekozenBron = null;

document.getElementById("context").textContent = `Seizoen ${SEIZOEN}, ${TAK}, categorie II`;

function escape(tekst) {
  const div = document.createElement("div");
  div.textContent = tekst;
  return div.innerHTML;
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

// De soorten uit overzicht() vertaald naar wat het vakje toont.
const VAKJE_TEKST = {
  vrij: "ja",
  aantallen: "mits",
  max2: "max 2",
  leeftijd: "lft",
  nee: "nee",
  "buiten-scope": "?",
};

function vakjeTekst(vakje) {
  return VAKJE_TEKST[vakje.soort] || "";
}

function toonRaster() {
  const doel = huidigDoel();
  const melding = categorieIMelding(doel);
  if (melding) {
    raster.innerHTML = `<p class="buiten-scope-melding">${escape(melding)}</p>`;
    rasterVoetnoot.textContent = "";
    verbergDetail();
    return;
  }

  const rijen = overzicht(doel);
  const koppen = KOLOMMEN.map((kolom) => `<th scope="col">${escape(kolomLabel(kolom))}</th>`).join("");
  const lichaam = rijen
    .map((rij) => {
      const cellen = rij.vakjes
        .map((vakje) => {
          if (!vakje.bestaat) return `<td class="vakje leeg"></td>`;
          const titel = `${rij.categorie} ${vakje.label}`;
          return `<td class="vakje ${escape(vakje.soort)}"><button type="button" data-categorie="${escape(rij.categorie)}" data-klasse="${escape(vakje.klasse)}" title="${escape(titel)}">${escape(vakjeTekst(vakje))}</button></td>`;
        })
        .join("");
      return `<tr><th scope="row">${escape(rij.categorie)}</th>${cellen}</tr>`;
    })
    .join("");

  raster.innerHTML = `<div class="raster-schuif"><table>
<thead><tr><th scope="col">Komt uit</th>${koppen}</tr></thead>
<tbody>${lichaam}</tbody>
</table></div>
<p class="legenda">
<span class="vrij">ja</span> mag altijd
<span class="aantallen">mits</span> mag alleen bij aantoonbaar te weinig spelers
<span class="max2">max 2</span> mag altijd, hooguit twee invallers zonder toestemming
<span class="leeftijd">lft</span> mag, mits de speler de juiste leeftijd heeft
<span class="nee">nee</span> mag niet
<span class="buiten-scope">?</span> geen uitspraak
</p>`;

  rasterVoetnoot.textContent =
    "De Landelijke Competitie en de Super- en Topklasse van O16 en O18, en de Super Competitie en IDC van O14, staan niet in dit raster. Die vallen onder categorie I en daar doet deze pagina geen uitspraak over. Klik op een vakje voor de onderbouwing.";

  for (const knop of raster.querySelectorAll("button[data-categorie]")) {
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

function artikelBlok(nummers) {
  if (nummers.length === 0) return "";
  const items = nummers
    .map((nummer) => {
      const artikel = ARTIKELEN[nummer];
      if (!artikel) return "";
      return `<details><summary>Artikel ${escape(nummer)}: ${escape(artikel.titel)}</summary><pre>${escape(artikel.tekst)}</pre></details>`;
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
