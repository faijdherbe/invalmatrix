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
const geboorteVeld = document.getElementById("geboorte-veld");
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
// omschrijving die zowel de legenda onder het raster als de groepskopjes in de mobiele weergave
// gebruiken. Een vakje bestaat uit een basis (mag, mag niet, geen uitspraak) en een lijst eisen,
// zie vakjeVanUitkomst() in rules.js.
//
// Volgorde van de basissen: eerst wat mag, dan wat niet mag, dan waar geen uitspraak over is. Dat
// is ook de volgorde waarin de groepen in de mobiele weergave verschijnen, want de gebruiker
// zoekt wie er wel mag invallen. De groep "mag" bevat ook de voorwaardelijke gevallen, dus de kop
// is "mag" en niet "mag altijd": welke voorwaarden er gelden staat per klasse achter het label.
const BASIS_VOLGORDE = ["vrij", "nee", "buiten-scope"];

const BASIS = {
  vrij: { kort: "ja", omschrijving: "mag altijd", groepskop: "mag" },
  nee: { kort: "nee", omschrijving: "mag niet", groepskop: "mag niet" },
  "buiten-scope": { kort: "?", omschrijving: "geen uitspraak", groepskop: "geen uitspraak" },
};

// De eisen met een eigen kort label in het vakje, in de volgorde waarin rules.js ze teruggeeft.
// De eis max2 (artikel 5.3.5.3) staat hier niet in: die krijgt geen tekst maar het driehoekje
// rechtsboven in het vakje, zie hoek-driehoek in style.css en SR_ONLY_KANTTEKENING hieronder.
const EIS_VOLGORDE = ["aantallen", "leeftijd", "eerste-team"];

const EISEN = {
  aantallen: { kort: "mits", omschrijving: "mag alleen bij aantoonbaar te weinig spelers (artikel 5.3.5.2)" },
  leeftijd: { kort: "lft", omschrijving: "mag, mits de speler de juiste leeftijd heeft (artikel 5.3.5.1)" },
  "eerste-team": { kort: "team", omschrijving: "mag niet voor spelers uit het eerste team, zonder toestemming van de competitieleiding (artikel 5.3.5.4)" },
};

// Uitleg bij de gecombineerde labels, voor onder de legenda.
const COMBINATIE_UITLEG = "Staan er twee labels met een + ertussen, dan gelden beide voorwaarden.";

// De eisen die een zichtbaar label krijgen, in de vaste volgorde van rules.js. max2 valt hier af.
function zichtbareEisen(eisen) {
  return eisen.filter((eis) => EISEN[eis]);
}

// De korte labels van een vakje aan elkaar met een plus, bijvoorbeeld "mits+lft". Leeg als er
// geen zichtbare eis is; dan toont het vakje de tekst van zijn basis.
function eisenLabel(eisen) {
  return zichtbareEisen(eisen).map((eis) => EISEN[eis].kort).join("+");
}

// De kleur van een vakje of klasse-knop: groen als er niets te regelen valt (geen eis, of alleen
// max2), geel zodra er een voorwaarde geldt. De kleur zegt of er voorwaarden zijn, de tekst zegt
// welke. Bij basis nee en buiten-scope is de basis zelf de kleur.
function vakjeKleur(vakje) {
  if (vakje.basis !== "vrij") return vakje.basis;
  return zichtbareEisen(vakje.eisen).length > 0 ? "voorwaarde" : "vrij";
}

// Tekst die niet in beeld staat maar wel wordt voorgelezen: de driehoekjesmarkering zelf is puur
// visueel (kleur), dus dit is voor schermlezers en voor wie kleur niet ziet de manier om alsnog
// te weten dat er een kanttekening bij dit vakje hoort.
const SR_ONLY_KANTTEKENING = '<span class="sr-only"> (met een kanttekening)</span>';

// De volledige omschrijving van elke eis, ook voor schermlezers. Het title-attribuut van de knop
// blijft het team benoemen, dus deze uitleg gaat via dezelfde sr-only-aanpak als hierboven.
function srOnlyEisenHtml(eisen) {
  const zichtbaar = zichtbareEisen(eisen);
  if (zichtbaar.length === 0) return "";
  const teksten = zichtbaar.map((eis) => EISEN[eis].omschrijving).join("; ");
  return `<span class="sr-only"> (${escape(teksten)})</span>`;
}

// Klein voorbeeld van de driehoekjesmarkering zelf, voor in de uitlegregel. aria-hidden omdat de
// bijbehorende tekst ("mag, met een kanttekening...") al vertelt wat het betekent.
function kanttekeningVoorbeeldHtml() {
  return `<span class="kanttekening-voorbeeld hoek-driehoek" aria-hidden="true">${escape(BASIS.vrij.kort)}</span>`;
}

// Verwijst naar de driehoekjesmarkering bij de max2-uitzondering (artikel 5.3.5.3): het mag, maar
// er is een kanttekening die pas in het detailscherm staat.
function kanttekeningUitlegHtml() {
  return `${kanttekeningVoorbeeldHtml()} betekent: mag, met een kanttekening die je ziet zodra je op het vakje klikt.`;
}

// Een regel in de legenda: een gekleurde badge met het korte label, gevolgd door de omschrijving.
function legendaRegelHtml(kleur, kort, omschrijving) {
  return `<span class="legenda-badge ${escape(kleur)}">${escape(kort)}</span> ${escape(omschrijving)}`;
}

// De uitleg onder de mobiele weergave. Daar staan geen regels voor ja, nee en ?, want die groepen
// hebben er al een kop in woorden. De korte labels achter een klasse hebben wel uitleg nodig.
function mobielUitlegHtml() {
  return [
    ...EIS_VOLGORDE.map((eis) => legendaRegelHtml("voorwaarde", EISEN[eis].kort, EISEN[eis].omschrijving)),
    kanttekeningUitlegHtml(),
    escape(COMBINATIE_UITLEG),
  ].join("<br>");
}

// De inhoud van een rastervakje: de korte labels van de eisen, of de tekst van de basis als er
// geen zichtbare eis is. Daarachter de uitleg voor schermlezers.
function vakjeHtml(vakje) {
  const tekst = eisenLabel(vakje.eisen) || BASIS[vakje.basis].kort;
  const kanttekening = vakje.eisen.includes("max2") ? SR_ONLY_KANTTEKENING : "";
  return `${escape(tekst)}${srOnlyEisenHtml(vakje.eisen)}${kanttekening}`;
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
          const knopKlasse = vakje.eisen.includes("max2") ? ' class="hoek-driehoek"' : "";
          return `<td class="vakje ${escape(vakjeKleur(vakje))}"><button type="button"${knopKlasse} data-categorie="${escape(rij.categorie)}" data-klasse="${escape(vakje.klasse)}" title="${escape(titel)}">${vakjeHtml(vakje)}</button></td>`;
        })
        .join("");
      return `<tr><th scope="row">${escape(rij.categorie)}</th>${cellen}</tr>`;
    })
    .join("");

  // Eerst wat altijd mag, dan de eisen die een vakje voorwaardelijk maken, dan wat niet mag en
  // waar geen uitspraak over is, en tot slot de twee uitlegregels.
  const legenda = [
    legendaRegelHtml("vrij", BASIS.vrij.kort, BASIS.vrij.omschrijving),
    ...EIS_VOLGORDE.map((eis) => legendaRegelHtml("voorwaarde", EISEN[eis].kort, EISEN[eis].omschrijving)),
    legendaRegelHtml("nee", BASIS.nee.kort, BASIS.nee.omschrijving),
    legendaRegelHtml("buiten-scope", BASIS["buiten-scope"].kort, BASIS["buiten-scope"].omschrijving),
    kanttekeningUitlegHtml(),
    escape(COMBINATIE_UITLEG),
  ].join("\n");

  return `<div class="raster-schuif"><table>
<thead><tr><th scope="col">Komt uit</th>${koppen}</tr></thead>
<tbody>${lichaam}</tbody>
</table></div>
<p class="legenda">
${legenda}
</p>`;
}

// Groepeert de vakjes van een rij per basis, in de volgorde van BASIS_VOLGORDE, en laat lege
// groepen en niet-bestaande klassen weg. Werkt op dezelfde rijen als de tabel, dus geen tweede
// berekening. De groepering gaat bewust op basis en niet op de eisencombinatie: dat zou een
// wildgroei aan groepjes opleveren. De eisen staan per klasse achter het label.
function mobielGroepen(rij) {
  const bestaande = rij.vakjes.filter((vakje) => vakje.bestaat);
  return BASIS_VOLGORDE
    .map((basis) => ({ basis, vakjes: bestaande.filter((vakje) => vakje.basis === basis) }))
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
          const kanttekening = vakje.eisen.includes("max2");
          const eisen = eisenLabel(vakje.eisen);
          const labelHtml = [
            escape(vakje.label),
            eisen ? ` <span class="mobiel-eisen">${escape(eisen)}</span>` : "",
            srOnlyEisenHtml(vakje.eisen),
            kanttekening ? SR_ONLY_KANTTEKENING : "",
          ].join("");
          const klasse = `mobiel-klasse ${escape(vakjeKleur(vakje))}${kanttekening ? " kanttekening" : ""}`;
          return `<button type="button" class="${klasse}" data-categorie="${escape(rij.categorie)}" data-klasse="${escape(vakje.klasse)}" title="${escape(titel)}">${labelHtml}</button>`;
        })
        .join("");
      return `<div class="mobiel-groep">
<p class="mobiel-groep-kop ${escape(groep.basis)}">${escape(BASIS[groep.basis].groepskop)}</p>
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
    rijen.map(mobielCategorieHtml).join("") + `<p class="mobiel-uitleg">${mobielUitlegHtml()}</p>`;

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

// Toont de kanttekeningen die assess() meegeeft: geen voorwaarde waaraan de gebruiker kan
// voldoen, maar een waarschuwing dat de regel zelf omstreden is (bijvoorbeeld lenen uit een
// jongere leeftijdscategorie, waar artikel 5.3.5.1 een voorbeeld van geeft, maar artikel 3.1.3 en
// de tabel klassengrenzen de leeftijdsgrenzen altijd bepalend laten zijn). Dit is iets anders dan
// de kanttekening-driehoekjes bij max2 in het overzicht (zie kanttekeningVoorbeeldHtml en
// SR_ONLY_KANTTEKENING hierboven); daarom heet dit blok "let op" en niet "kanttekening", om de
// twee niet door elkaar te halen. Staat direct onder de samenvatting, boven de voorwaarden, zodat
// iemand die alleen het oordeel leest deze waarschuwing niet kan missen.
function letOpBlokHtml(kanttekeningen) {
  if (kanttekeningen.length === 0) return "";
  const items = kanttekeningen.map((tekst) => `<li>${escape(tekst)}</li>`).join("");
  return `<div class="let-op"><h3>Let op</h3><ul>${items}</ul></div>`;
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

  // Of de geboortedatum nog iets uitmaakt, staat los van de ingevulde datum: zonder datum kan
  // assess() alleen "toegestaan" teruggeven als de klasse zelf het toestaat (leeftijd is dan
  // null, dus die kan de uitkomst niet blokkeren, zie assess() in rules.js). Is die uitkomst al
  // niet-toegestaan of buiten-scope, dan verandert geen enkele datum daar iets aan en verbergen
  // we het veld. Dit rekent niets zelf uit over invalregels, het hergebruikt alleen assess() met
  // een lege datum.
  const zonderDatum = assess(gekozenBron, doel, null);
  geboorteVeld.hidden = zonderDatum.verdict !== "toegestaan";

  resultaat.className = uitkomst.verdict;
  resultaat.innerHTML = [
    `<p class="oordeel">${escape(uitkomst.samenvatting)}</p>`,
    letOpBlokHtml(uitkomst.kanttekeningen),
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
