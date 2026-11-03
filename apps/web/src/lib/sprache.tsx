import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";

/**
 * Deutsch und Englisch fuer die ganze Oberflaeche, seit dem 03.11.2026.
 *
 * **Texte paarweise an der Stelle ihrer Verwendung**: `t("Anmelden", "Sign in")`. Kein
 * Schluesselkatalog, der mit dem Code auseinanderlaeuft; wer einen Text aendert, sieht die
 * Uebersetzung daneben. Eingegebene Inhalte (Exponatnamen, Titel) bleiben, wie sie sind.
 *
 * Die Sprache startet nach dem Browser und wird danach auf dem Geraet gemerkt. Am Terminal
 * setzt die Zeitsperre sie zurueck (`zuruecksetzen`), ohne die gemerkte Wahl zu aendern.
 */

export type Sprache = "de" | "en";

const SPEICHER = "passport.sprache";

/** Die Sprache des Browsers: Deutsch, wenn er Deutsch will, sonst Englisch. */
export function browsersprache(): Sprache {
  const liste = typeof navigator === "undefined" ? [] : [...(navigator.languages ?? [])];
  const erste = liste[0] ?? (typeof navigator === "undefined" ? "" : navigator.language);
  return erste.toLowerCase().startsWith("de") ? "de" : "en";
}

function gemerkt(): Sprache | null {
  try {
    const wert = window.localStorage.getItem(SPEICHER);
    return wert === "de" || wert === "en" ? wert : null;
  } catch {
    return null;
  }
}

function merke(sprache: Sprache): void {
  try {
    window.localStorage.setItem(SPEICHER, sprache);
  } catch {
    // Absichtlich still: ohne Speicher gilt die Wahl nur bis zum Neuladen.
  }
}

/** Die Sprache, mit der eine Seite startet: gemerkt, sonst die des Browsers. */
export function startsprache(): Sprache {
  return gemerkt() ?? browsersprache();
}

export interface Sprachwerkzeug {
  sprache: Sprache;
  /** Waehlt die Sprache und merkt sie auf dem Geraet. */
  setzeSprache: (s: Sprache) => void;
  /** Zurueck auf die Startsprache, fuer die Zeitsperre am Terminal. Merkt nichts. */
  zuruecksetzen: (s: Sprache) => void;
  t: (de: string, en: string) => string;
  /** Datum und Uhrzeit kurz, in der Schreibweise der Sprache. */
  datum: (ms: number | Date) => string;
  /** Datum und Uhrzeit wie `toLocaleString`. */
  datumLang: (ms: number | Date) => string;
  /** `de-DE` oder `en-GB`, fuer eigene `Intl`-Aufrufe. */
  gebiet: string;
}

const Kontext = createContext<Sprachwerkzeug | null>(null);

export function SpracheProvider({ children }: { children: ReactNode }) {
  const [sprache, setzeIntern] = useState<Sprache>(startsprache);

  // Silbentrennung und Bildschirmleser haengen an `lang`.
  useEffect(() => {
    document.documentElement.lang = sprache;
  }, [sprache]);

  const setzeSprache = useCallback((s: Sprache) => {
    merke(s);
    setzeIntern(s);
  }, []);

  const wert = useMemo<Sprachwerkzeug>(() => {
    const gebiet = sprache === "de" ? "de-DE" : "en-GB";
    const kurz = new Intl.DateTimeFormat(gebiet, { dateStyle: "short", timeStyle: "short" });
    return {
      sprache,
      setzeSprache,
      zuruecksetzen: setzeIntern,
      t: (de, en) => (sprache === "de" ? de : en),
      datum: (ms) => kurz.format(ms),
      datumLang: (ms) => new Date(ms).toLocaleString(gebiet),
      gebiet,
    };
  }, [sprache, setzeSprache]);

  return <Kontext.Provider value={wert}>{children}</Kontext.Provider>;
}

export function useSprache(): Sprachwerkzeug {
  const wert = useContext(Kontext);
  if (wert === null) throw new Error("useSprache ausserhalb von SpracheProvider");
  return wert;
}

/** Der Umschalter „DE | EN“. `hell` fuer blauen Grund (Anmeldung). */
export function Sprachwahl({ hell = false }: { hell?: boolean }) {
  const { sprache, setzeSprache, t } = useSprache();
  const knopf = (s: Sprache, kurz: string, name: string) => (
    <button
      type="button"
      lang={s}
      aria-pressed={sprache === s}
      aria-label={name}
      onClick={() => {
        setzeSprache(s);
      }}
      className={
        hell
          ? `px-1.5 py-0.5 text-[13px] font-semibold ${sprache === s ? "text-white underline underline-offset-4" : "text-white/70 hover:text-white"}`
          : `px-1.5 py-0.5 text-[13px] font-semibold ${sprache === s ? "text-primaer underline underline-offset-4" : "text-text-hinweis hover:text-primaer"}`
      }
    >
      {kurz}
    </button>
  );
  return (
    <div role="group" aria-label={t("Sprache", "Language")} className="flex items-center">
      {knopf("de", "DE", "Deutsch")}
      <span aria-hidden="true" className={hell ? "text-white/50" : "text-linie"}>
        |
      </span>
      {knopf("en", "EN", "English")}
    </div>
  );
}
