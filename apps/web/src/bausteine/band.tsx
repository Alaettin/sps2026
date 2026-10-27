/**
 * Die zwei blauen Flaechen nach industrialdigitaltwin.org: das Band unter der Kopfzeile und
 * die Fusszeile.
 *
 * Gebraucht im Verwaltungsrahmen und im Bereich des Besuchers (`/mein`). Der Kiosk-Ablauf hat
 * beides nicht: dort stehen die Titel mitten in den Schritten, und unten klebt die Knopfleiste.
 */

/**
 * Das blaue Band. **Die Hauptspalte muss es mit negativem Rand ueberlappen** (`-mt-20
 * sm:-mt-24`), damit der Seitenkopf darauf liegt wie das weisse Feld der Vorlage auf ihrem
 * Bild. Die Hoehe hier und der Rand dort gehoeren zusammen.
 */
export function Band() {
  return (
    <div aria-hidden="true" className="relative h-28 overflow-hidden bg-primaer sm:h-36">
      <span className="punktmatrix absolute inset-y-0 right-0 w-2/3" />
    </div>
  );
}

/**
 * Die Fusszeile, ohne Logos: die stehen in der Kopfzeile, und ein zweites sichtbares Logo
 * braeche die Pruefung „genau einmal sichtbar“ in `e2e/logos.ts`, die gerade doppelte
 * Kopfzeilen finden soll.
 */
export function Fusszeile({ appName = "IDTA Passport" }: { appName?: string }) {
  return (
    <footer className="bg-primaer text-white">
      <div className="mx-auto flex max-w-[992px] flex-col gap-2 px-4 py-10">
        <span className="text-xs font-semibold tracking-[0.2em] uppercase">{appName}</span>
        <span className="text-sm text-white/80">
          Neoception AXON für die Industrial Digital Twin Association e. V.
        </span>
      </div>
    </footer>
  );
}
