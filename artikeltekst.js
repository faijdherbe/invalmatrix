// Zet de letterlijke artikeltekst uit articles.js (met harde regeleindes zoals ze uit de PDF
// komen, afgebroken op paginabreedte) om in een array leesbare blokken. Puur op tekst, geen
// DOM-gebruik: het resultaat kan door app.js gerenderd worden, of door tests gecontroleerd.
//
// Een blok ziet er zo uit:
//   { soort: "alinea", tekst }             doorlopende tekst zonder regeleindes
//   { soort: "item", niveau, tekst }       een opsommingsitem, niveau 1 of 2
//
// In de brontekst worden blokken gescheiden door een lege regel. Een opsommingsitem begint
// met een bullet-teken: "•" voor niveau 1, of de letter "o" gevolgd door een spatie voor
// niveau 2 (de voorbeelden onder een opsommingsitem). Alle andere regels zijn vervolgregels
// van het lopende blok en worden met een spatie aan de tekst geplakt, ook als ze niet
// beginnen met een bullet-teken maar wel na een punt op een nieuwe regel starten.
export function naarBlokken(tekst) {
  const regels = tekst.split("\n");
  const blokken = [];
  let huidig = null;

  function sluitAf() {
    if (huidig) {
      blokken.push(huidig);
      huidig = null;
    }
  }

  function voegToe(deel) {
    huidig.tekst = huidig.tekst.length > 0 ? `${huidig.tekst} ${deel}` : deel;
  }

  for (const regel of regels) {
    const getrimd = regel.trim();
    if (getrimd.length === 0) {
      sluitAf();
      continue;
    }

    const niveau1 = getrimd.match(/^•\s+(.*)$/);
    const niveau2 = getrimd.match(/^o\s+(.*)$/);

    if (niveau1) {
      sluitAf();
      huidig = { soort: "item", niveau: 1, tekst: "" };
      voegToe(niveau1[1]);
    } else if (niveau2) {
      sluitAf();
      huidig = { soort: "item", niveau: 2, tekst: "" };
      voegToe(niveau2[1]);
    } else if (huidig) {
      voegToe(getrimd);
    } else {
      huidig = { soort: "alinea", tekst: "" };
      voegToe(getrimd);
    }
  }
  sluitAf();

  return blokken;
}
