import { cn } from "./basis.js";

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
 * Die Spalten der Fusszeile, im Aufbau der Fusszeile von industrialdigitaltwin.org.
 *
 * **Alles Platzhalter** in `[[…]]`, wie im Entwurf des Datenschutzhinweises, damit sich offene
 * Stellen per Suche finden. Reiner Text, keine Links: ein Link ohne Ziel fuehrt ins Leere.
 */
const SPALTEN = [
  { titel: "IDTA Passport", zeilen: ["[[Anschrift]]", "[[Kontakt]]"] },
  { titel: "Nützliche Links", zeilen: ["[[Link]]", "[[Link]]"] },
  { titel: "Rechtliche Hinweise", zeilen: ["[[Impressum]]", "[[Datenschutz]]"] },
];

/**
 * Die Fusszeile, ohne Logos: die stehen in der Kopfzeile, und ein zweites sichtbares Logo
 * braeche die Pruefung „genau einmal sichtbar“ in `e2e/logos.ts`, die gerade doppelte
 * Kopfzeilen finden soll.
 */
export function Fusszeile({
  /** Breite und Rand der Spalte, passend zum Rahmen, damit alles auf einer Kante steht. */
  spalte = "mx-auto max-w-spalte px-4 sm:px-8",
}: {
  spalte?: string;
}) {
  return (
    <footer className="bg-primaer text-white">
      <div className={cn("grid gap-8 py-12 sm:grid-cols-3", spalte)}>
        {SPALTEN.map((s) => (
          <div key={s.titel} className="flex flex-col gap-3">
            <span className="border-b border-white/30 pb-3 text-xs font-semibold tracking-[0.2em] uppercase">
              {s.titel}
            </span>
            {s.zeilen.map((z, i) => (
              <span key={String(i)} className="text-sm text-white/80">
                {z}
              </span>
            ))}
          </div>
        ))}
      </div>
    </footer>
  );
}
