import { useState, type ChangeEvent } from "react";
import { api } from "../lib/api.js";
import { bieteAlsDatei } from "../lib/download.js";
import { Abschnitt, Fehlerhinweis, Knopf, knopfKlassen } from "../bausteine/basis.js";
import { Rueckfrage } from "../bausteine/dialog.js";
import { useSprache } from "../lib/sprache.js";
import { fehlertext } from "../lib/fehler.js";

/**
 * Sicherung und Auswertung, zwei Abschnitte der Einstellungen. Seit dem 19.10.2026.
 *
 * **Nicht hinter dem Entwicklermodus:** beides ist Betrieb, nicht Entwicklung. Die Rechte
 * prueft der Server, beide Wege verlangen die Admin-Rolle.
 */

interface Bestand {
  besucher: number;
  exponate: number;
  besuche: number;
  dateien: number;
  /** Fehlt in Sicherungen vor dem 20.10.2026. */
  globaleDaten?: number;
  appNutzer: number;
  /** Fehlen in Sicherungen vor dem 04.11.2026. */
  avatare?: number;
  kiAvatare?: number;
}

interface Pruefergebnis {
  sicherung: { erstellt: string; fassung: string; bestand: Bestand; dateien: number };
  aktuell: Bestand;
}

const ZEILEN: [keyof Bestand, string, string][] = [
  ["besucher", "Besucher", "Visitors"],
  ["exponate", "Exponate", "Exhibits"],
  ["besuche", "Aufgenommene Exponate", "Added exhibits"],
  ["dateien", "Dateien", "Files"],
  ["globaleDaten", "Globale Daten", "Global data"],
  ["avatare", "Avatare zur Auswahl", "Avatars to choose from"],
  ["kiAvatare", "davon mit KI erstellt", "of them created with AI"],
  ["appNutzer", "Anmeldungen", "Sign-ins"],
];

export function Sicherung() {
  const { t, datumLang } = useSprache();
  const [datei, setzeDatei] = useState<File | null>(null);
  const [pruefung, setzePruefung] = useState<Pruefergebnis | null>(null);
  const [laeuft, setzeLaeuft] = useState(false);
  const [fehler, setzeFehler] = useState<string | null>(null);

  async function waehle(ereignis: ChangeEvent<HTMLInputElement>) {
    // Erst die Liste sichern, dann das Feld leeren: `value = ""` leert die FileList.
    const erste = Array.from(ereignis.target.files ?? [])[0];
    ereignis.target.value = "";
    if (erste === undefined) return;

    setzeFehler(null);
    setzeLaeuft(true);
    try {
      const formular = new FormData();
      formular.append("datei", erste);
      setzePruefung(
        await api<Pruefergebnis>("/api/sicherung/pruefen", { method: "POST", body: formular }),
      );
      setzeDatei(erste);
    } catch (ursache) {
      setzeFehler(
        fehlertext(ursache, t, ["Die Datei ließ sich nicht lesen.", "The file could not be read."]),
      );
    } finally {
      setzeLaeuft(false);
    }
  }

  async function spieleEin() {
    if (datei === null) return;
    setzeLaeuft(true);
    setzeFehler(null);
    try {
      const formular = new FormData();
      formular.append("datei", datei);
      await api("/api/sicherung", { method: "POST", body: formular });
      /*
       * **Neu laden statt weiterarbeiten.** Jede geladene Liste ist jetzt veraltet, und das
       * eigene Konto kann im eingespielten Bestand fehlen; dann fuehrt das Neuladen zur
       * Anmeldung.
       */
      window.location.reload();
    } catch (ursache) {
      setzeFehler(
        fehlertext(ursache, t, [
          "Das Einspielen ist nicht durchgekommen.",
          "The import did not go through.",
        ]),
      );
      setzeLaeuft(false);
    }
  }

  async function auswertung() {
    setzeFehler(null);
    try {
      const { dateiname, inhalt } = await api<{ dateiname: string; inhalt: string }>(
        "/api/auswertung",
      );
      bieteAlsDatei(inhalt, dateiname);
    } catch (ursache) {
      setzeFehler(
        fehlertext(ursache, t, [
          "Die Auswertung ließ sich nicht laden.",
          "The evaluation could not be loaded.",
        ]),
      );
    }
  }

  return (
    <>
      {fehler !== null && pruefung === null && <Fehlerhinweis>{fehler}</Fehlerhinweis>}

      <Abschnitt titel={t("Sicherung", "Backup")}>
        <div className="flex flex-wrap gap-3">
          {/* Ein echter Link: der Browser lädt die Datei selbst und zeigt den Fortschritt. */}
          <a href="/api/sicherung" download className={knopfKlassen("primaer")}>
            {t("Export", "Export")}
          </a>
          <label
            className={knopfKlassen(
              "rand",
              laeuft ? "pointer-events-none opacity-50" : "cursor-pointer",
            )}
          >
            {t("Import", "Import")}
            <input
              type="file"
              accept=".zip,application/zip"
              onChange={(e) => void waehle(e)}
              className="sr-only"
              disabled={laeuft}
            />
          </label>
        </div>
      </Abschnitt>

      <Abschnitt titel={t("Auswertung", "Evaluation")}>
        <div>
          <Knopf art="rand" onClick={() => void auswertung()}>
            {t("Download CSV", "Download CSV")}
          </Knopf>
        </div>
      </Abschnitt>

      <Rueckfrage
        offen={pruefung !== null}
        aufOffen={(o) => {
          if (!o) {
            setzePruefung(null);
            setzeDatei(null);
            setzeFehler(null);
          }
        }}
        titel={t("Sicherung einspielen?", "Import backup?")}
        bestaetigenText={t("Bestand ersetzen", "Replace data")}
        art="gefahr"
        tippwort="EINSPIELEN"
        laeuft={laeuft}
        fehler={fehler}
        aufBestaetigen={() => void spieleEin()}
      >
        {pruefung !== null && (
          <>
            <p>
              {t("Sicherung vom", "Backup of")}{" "}
              <b>{datumLang(new Date(pruefung.sicherung.erstellt))}</b>, {t("Fassung", "version")}{" "}
              {pruefung.sicherung.fassung}.{" "}
              {t(
                "Der aktuelle Bestand wird vollständig ersetzt:",
                "The current data will be replaced completely:",
              )}
            </p>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[11px] tracking-[0.08em] text-text-hinweis uppercase">
                  <th className="py-1 font-semibold" />
                  <th className="py-1 text-right font-semibold">{t("Jetzt", "Now")}</th>
                  <th className="py-1 text-right font-semibold">{t("Sicherung", "Backup")}</th>
                </tr>
              </thead>
              <tbody>
                {ZEILEN.map(([feld, text, en]) => (
                  <tr key={feld} className="border-t border-linie">
                    <td className="py-1">{t(text, en)}</td>
                    <td className="py-1 text-right tabular-nums">{pruefung.aktuell[feld] ?? 0}</td>
                    <td className="py-1 text-right font-semibold tabular-nums">
                      {pruefung.sicherung.bestand[feld] ?? 0}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p>
              {t(
                "Auch die Anmeldungen kommen aus der Sicherung. Fehlt dein Konto dort, wirst du danach abgemeldet.",
                "The sign-ins also come from the backup. If your account is missing there, you will be signed out afterwards.",
              )}
            </p>
          </>
        )}
      </Rueckfrage>
    </>
  );
}
