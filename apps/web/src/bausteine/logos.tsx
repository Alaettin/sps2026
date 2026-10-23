import { NavLink } from "react-router";
import { cn } from "./basis.js";
import axon from "../assets/axon-logo.svg";
import idta from "../assets/idta.png";

/**
 * Die zwei Logos: Neoception AXON links, IDTA rechts.
 *
 * **Ein Baustein, nicht zweimal dasselbe Markup.** Die Reihe steht an drei Stellen (Anmeldung,
 * breite Kopfzeile, schmale Kopfzeile), und eine spaetere offizielle Datei soll an genau einer
 * Stelle getauscht werden.
 *
 * **Die Masse sind einzeln gesetzt.** AXON ist 2,3:1, IDTA 3,4:1. AXON wird ueber die Breite
 * gefuehrt, IDTA ueber die Hoehe; so stehen beide optisch gleich gross nebeneinander.
 *
 * `alt` traegt echten Text: IDTA ist Partner, keine Zierde, und ein Schirmleser soll es nennen.
 */

/** Die Masse je Stelle. Die jeweils andere Seite ergibt sich aus dem Seitenverhaeltnis. */
const MASSE = {
  kopf: { axon: "w-[72px]", idta: "h-6" },
  anmeldung: { axon: "w-[84px]", idta: "h-7" },
} as const;

export function AxonLogo({ art, className }: { art: keyof typeof MASSE; className?: string }) {
  return (
    <img
      src={axon}
      alt="Neoception AXON"
      className={cn("block h-auto", MASSE[art].axon, className)}
    />
  );
}

export function IdtaLogo({ art, className }: { art: keyof typeof MASSE; className?: string }) {
  return <img src={idta} alt="IDTA" className={cn("block w-auto", MASSE[art].idta, className)} />;
}

/**
 * Beide nebeneinander, aussen angeschlagen.
 *
 * Genutzt auf der Anmeldeseite und in beiden Kopfzeilen.
 */
export function Logoreihe({
  art,
  className,
  zurStartseite = false,
}: {
  art: keyof typeof MASSE;
  className?: string;
  /**
   * Macht **nur AXON** zum Link auf die Startseite.
   *
   * Nur AXON, weil das unsere Anwendung ist: ein Klick auf das IDTA-Zeichen soll nirgendwohin
   * fuehren, erst recht nicht auf unser Dashboard. Auf der Anmeldeseite gibt es keine
   * Startseite, dort bleibt alles unverlinkt.
   */
  zurStartseite?: boolean;
}) {
  const axonbild = <AxonLogo art={art} />;
  return (
    <div className={cn("flex items-center justify-between gap-3", className)}>
      {zurStartseite ? (
        <NavLink to="/" aria-label="Startseite" className="flex shrink-0">
          {axonbild}
        </NavLink>
      ) : (
        axonbild
      )}
      <IdtaLogo art={art} />
    </div>
  );
}
