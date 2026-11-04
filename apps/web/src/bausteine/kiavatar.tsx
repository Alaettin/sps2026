import { useEffect, useRef, useState } from "react";
import { ApiFehler, api } from "../lib/api.js";
import { fehlertext } from "../lib/fehler.js";
import { useSprache } from "../lib/sprache.js";
import { Fehlerhinweis, Knopf, cn } from "./basis.js";

/**
 * Ein Bild per KI erstellen, am Terminal, seit dem 04.11.2026. Nach dem Konfigurator der
 * HMI-App (messeapp, `StepAvatar.tsx`), mit kürzerer Auswahl: die Merkmale kommen vom Server
 * (`/api/kiosk/avatare`), der den Prompt allein aus ihnen baut. Ein Freitextfeld gibt es nicht.
 *
 * Das erzeugte Bild ist ein **Entwurf**. „Übernehmen“ nimmt es in die Galerie, dann steht es
 * allen zur Auswahl; „Neu erzeugen“ und das Verlassen der Seite verwerfen es.
 */

export interface KiMerkmal {
  id: string;
  de: string;
  en: string;
  werte: { id: string; de: string; en: string }[];
}

/** Dieselbe Regel wie `entfaellt` im Server: ausgeblendet heißt, es geht nicht in den Prompt. */
function entfaellt(merkmal: string, wahl: Record<string, string>): boolean {
  if (merkmal === "haarfarbe") return wahl["frisur"] === "glatze";
  if (merkmal === "bart") return wahl["geschlecht"] === "weiblich";
  return false;
}

export function KiAvatar({
  merkmale,
  aufLaeuft,
  aufUebernommen,
}: {
  merkmale: KiMerkmal[];
  /** Solange ein Bild entsteht, hält das Terminal seine Zeitsperre an. */
  aufLaeuft: (laeuft: boolean) => void;
  aufUebernommen: (dateiId: string) => void;
}) {
  const { t } = useSprache();
  const [wahl, setzeWahl] = useState<Record<string, string>>(() =>
    Object.fromEntries(merkmale.map((m) => [m.id, m.werte[0]?.id ?? ""])),
  );
  const [entwurf, setzeEntwurf] = useState<string | null>(null);
  const [laeuft, setzeLaeuft] = useState(false);
  const [fehler, setzeFehler] = useState<{ text: string; ursache: string | null } | null>(null);

  /*
   * Der offene Entwurf im Ref, damit das Aufräumen beim Verlassen ihn kennt, ohne bei jeder
   * Änderung neu einzuhängen. Wer weggeht, ohne zu übernehmen, hinterlässt kein Bild.
   */
  const offen = useRef<string | null>(null);
  useEffect(
    () => () => {
      if (offen.current !== null) {
        void api(`/api/kiosk/avatare/ki/${offen.current}`, { method: "DELETE" }).catch(() => {
          // Bleibt er liegen, räumt ihn der Server nach einer Stunde weg.
        });
      }
    },
    [],
  );

  const laufe = (ja: boolean) => {
    setzeLaeuft(ja);
    aufLaeuft(ja);
  };

  async function erzeuge() {
    setzeFehler(null);
    laufe(true);
    const vorher = offen.current;
    try {
      const merkmaleFuerServer = Object.fromEntries(
        Object.entries(wahl).filter(([m]) => !entfaellt(m, wahl)),
      );
      const { dateiId } = await api<{ dateiId: string }>("/api/kiosk/avatare/ki", {
        method: "POST",
        body: JSON.stringify({ merkmale: merkmaleFuerServer }),
      });
      offen.current = dateiId;
      setzeEntwurf(dateiId);
      if (vorher !== null) {
        void api(`/api/kiosk/avatare/ki/${vorher}`, { method: "DELETE" }).catch(() => {
          // Siehe oben: der Server räumt nach einer Stunde auf.
        });
      }
    } catch (ursache) {
      setzeFehler({
        text: fehlertext(ursache, t, [
          "Das Bild ließ sich nicht erstellen. Bitte noch einmal versuchen.",
          "The picture could not be created. Please try again.",
        ]),
        // Die Meldung des Bilddienstes nennt die Ursache, etwa ein stillgelegtes Modell.
        ursache:
          ursache instanceof ApiFehler && ursache.code === "ki-fehlgeschlagen"
            ? ursache.message
            : null,
      });
    } finally {
      laufe(false);
    }
  }

  async function uebernimm() {
    if (entwurf === null) return;
    setzeFehler(null);
    try {
      await api(`/api/kiosk/avatare/ki/${entwurf}/uebernehmen`, { method: "POST" });
      offen.current = null;
      aufUebernommen(entwurf);
    } catch (ursache) {
      setzeFehler({
        text: fehlertext(ursache, t, [
          "Das Bild ließ sich nicht übernehmen. Bitte noch einmal erstellen.",
          "The picture could not be added. Please create it again.",
        ]),
        ursache: null,
      });
    }
  }

  return (
    <div className="flex flex-col gap-5">
      {fehler !== null && (
        <Fehlerhinweis>
          {fehler.text}
          {fehler.ursache !== null && (
            <span className="mt-1 block text-[13px] opacity-80">{fehler.ursache}</span>
          )}
        </Fehlerhinweis>
      )}

      {entwurf !== null && (
        <div className="flex flex-col items-center gap-4 bg-flaeche p-5 shadow-flaeche sm:flex-row">
          <img
            src={`/api/dateien/${entwurf}`}
            alt={t("Dein KI-Bild", "Your AI picture")}
            className="size-40 shrink-0 rounded-full object-cover"
          />
          <div className="flex flex-col gap-3 max-sm:items-center">
            <p className="text-[15px] text-text-zweit max-sm:text-center">
              {t(
                "Gefällt es dir? Übernommen steht es auch anderen Besuchern zur Auswahl.",
                "Do you like it? Once added, other visitors can choose it too.",
              )}
            </p>
            <Knopf
              className="h-12 self-start px-6 max-sm:self-center"
              onClick={() => void uebernimm()}
              disabled={laeuft}
            >
              {t("Übernehmen", "Use this picture")}
            </Knopf>
          </div>
        </div>
      )}

      <div className="flex flex-col bg-flaeche shadow-flaeche">
        {merkmale
          .filter((m) => !entfaellt(m.id, wahl))
          .map((m) => (
            <div
              key={m.id}
              role="group"
              aria-label={t(m.de, m.en)}
              className="flex flex-col gap-2.5 border-b border-linie px-5 py-4 last:border-b-0"
            >
              <h3 className="text-[12px] font-semibold tracking-[0.08em] text-text-hinweis uppercase">
                {t(m.de, m.en)}
              </h3>
              <div className="flex flex-wrap gap-2">
                {m.werte.map((w) => {
                  const gewaehlt = wahl[m.id] === w.id;
                  return (
                    <button
                      key={w.id}
                      type="button"
                      aria-pressed={gewaehlt}
                      disabled={laeuft}
                      onClick={() => {
                        setzeWahl({ ...wahl, [m.id]: w.id });
                      }}
                      className={cn(
                        "h-11 rounded-full px-5 text-[15px] font-medium transition-colors disabled:opacity-60",
                        gewaehlt
                          ? "bg-primaer text-white"
                          : "border border-linie bg-flaeche text-text-zweit hover:border-primaer hover:text-primaer",
                      )}
                    >
                      {t(w.de, w.en)}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
      </div>

      <div className="flex flex-wrap items-center gap-4">
        <Knopf
          art={entwurf === null ? "primaer" : "rand"}
          className="h-14 px-8 text-[17px]"
          disabled={laeuft}
          onClick={() => void erzeuge()}
        >
          {laeuft
            ? t("Bild wird erstellt …", "Creating picture …")
            : entwurf === null
              ? t("Bild erstellen", "Create picture")
              : t("Neu erstellen", "Create again")}
        </Knopf>
        {laeuft && (
          <span role="status" className="text-[15px] text-text-hinweis">
            {t("Das dauert etwa 30 Sekunden.", "This takes about 30 seconds.")}
          </span>
        )}
      </div>
    </div>
  );
}
