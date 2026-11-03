/** Dasselbe Muster wie `pruefeGuid` im Server. */
const GUID_MUSTER = /^[A-Za-z0-9_-]{1,50}$/;

/**
 * Die GUID aus einer Pass-Adresse (`…/SPS2026-0001`), oder `null`.
 *
 * Kamera und Handeingabe nutzen dieselbe Auswertung, damit beide Wege zum selben Ergebnis
 * kommen. Von Hand darf auch die GUID allein stehen; ein QR-Code muss die ganze Adresse sein,
 * sonst liefe jeder Werbe-QR-Code in eine Serverabfrage. Seit dem 03.11.2026 hier, weil
 * neben dem Terminal auch der Kontaktscan des Besuchers Pässe liest.
 */
export function guidAus(inhalt: string, basis: string, nurAdresse: boolean): string | null {
  const text = inhalt.trim();
  let guid: string;
  if (text.startsWith(basis)) {
    // Der hintere Teil der Adresse ist die GUID.
    guid = decodeURIComponent(text.slice(basis.length).split(/[/?#]/)[0] ?? "");
  } else if (nurAdresse) {
    return null;
  } else {
    guid = text;
  }
  return GUID_MUSTER.test(guid) ? guid : null;
}

/** Die Viewer-Adresse eines Passes, wie sie im QR-Code steht. */
export function viewerAdresse(basis: string, guid: string): string {
  return `${basis}${encodeURIComponent(guid)}`;
}
