import { useCallback, useState } from "react";
import { useNavigate } from "react-router";
import { api } from "../lib/api.js";
import {
  Feld,
  Fehlerhinweis,
  Flaeche,
  Knopf,
  Seitenkopf,
  Ueberschrift,
} from "../bausteine/basis.js";
import { Kamera, kameraMoeglich, type Kamerafehler } from "../scan/Kamera.js";
import { Kioskrahmen } from "../kiosk/Kioskrahmen.js";
import type { Ich } from "../lib/ich.js";
import { fehlertext } from "../lib/fehler.js";
import { mitTitel } from "../lib/personenfelder.js";
import { guidAus } from "../lib/pass.js";
import { useSprache } from "../lib/sprache.js";

/**
 * Der Besucher nimmt einen anderen Besucher als Kontakt auf, seit dem 03.11.2026: den QR-Code
 * auf dessen Pass scannen. Darin steht die Viewer-Adresse mit der GUID, dieselbe, die das
 * Terminal liest (`lib/pass.ts`). Ob der Pass registriert ist, entscheidet der Server.
 *
 * Anders als beim Exponat gibt es keinen Weg über die Handykamera: der QR-Code öffnet dort
 * den Viewer, nicht diese App.
 */

type Zustand =
  | { art: "scannen" }
  | { art: "laeuft" }
  | { art: "fertig"; name: string; firma: string | null; neu: boolean };

interface Antwort {
  titel: string | null;
  vorname: string;
  nachname: string;
  firma: string | null;
  neu: boolean;
}

export function MeinKontaktScan({ ich, aufAbmelden }: { ich: Ich; aufAbmelden: () => void }) {
  const { t } = useSprache();
  const navigate = useNavigate();
  const [zustand, setzeZustand] = useState<Zustand>({ art: "scannen" });
  const [fehler, setzeFehler] = useState<string | null>(null);
  const [eingabe, setzeEingabe] = useState("");
  // Startet die Kamera nicht, bleibt nur ein schwarzer Kasten; dann blenden wir ihn aus.
  const [kameraAus, setzeKameraAus] = useState(false);

  const nimmAuf = useCallback(
    (guid: string) => {
      setzeFehler(null);
      setzeZustand({ art: "laeuft" });
      api<Antwort>("/api/mein/kontakte", { method: "POST", body: JSON.stringify({ guid }) })
        .then((a) => {
          setzeZustand({
            art: "fertig",
            name: `${mitTitel(a.titel, a.vorname)} ${a.nachname}`,
            firma: a.firma,
            neu: a.neu,
          });
        })
        .catch((ursache: unknown) => {
          setzeZustand({ art: "scannen" });
          setzeFehler(
            fehlertext(ursache, t, [
              "Das hat nicht geklappt. Bitte noch einmal versuchen.",
              "That did not work. Please try again.",
            ]),
          );
        });
    },
    [t],
  );

  const ausQr = useCallback(
    (inhalt: string) => {
      const guid = guidAus(inhalt, ich.viewerBaseUrl, true);
      if (guid === null) {
        setzeFehler(
          t("Das ist kein QR-Code eines Messepasses.", "This is not a trade fair pass QR code."),
        );
        return;
      }
      nimmAuf(guid);
    },
    [ich.viewerBaseUrl, nimmAuf, t],
  );

  if (zustand.art === "fertig") {
    return (
      <Kioskrahmen aufAbmelden={aufAbmelden} besucher>
        <Flaeche className="flex flex-col gap-4 p-7">
          <Ueberschrift>
            {zustand.neu
              ? t("Kontakt aufgenommen", "Contact added")
              : t("Schon in deiner Liste", "Already in your list")}
          </Ueberschrift>
          <p className="text-[17px] leading-relaxed text-text-zweit">
            <b className="text-text">{zustand.name}</b>
            {zustand.firma !== null && <> ({zustand.firma})</>}{" "}
            {zustand.neu
              ? t("steht jetzt in deinen Kontakten.", "is now in your contacts.")
              : t("stand schon in deinen Kontakten.", "was already in your contacts.")}
          </p>
          <div className="flex flex-wrap gap-3">
            <Knopf
              onClick={() => {
                setzeEingabe("");
                setzeZustand({ art: "scannen" });
              }}
            >
              {t("Weiteren Kontakt scannen", "Scan another contact")}
            </Knopf>
            <Knopf
              art="rand"
              onClick={() => {
                void navigate("/mein/kontakte");
              }}
            >
              {t("Zu meinen Kontakten", "To my contacts")}
            </Knopf>
          </div>
        </Flaeche>
      </Kioskrahmen>
    );
  }

  return (
    <Kioskrahmen aufAbmelden={aufAbmelden} besucher>
      <Seitenkopf>
        <div className="flex min-w-0 flex-col gap-2">
          <Ueberschrift>{t("Kontakt scannen", "Scan contact")}</Ueberschrift>
          <p className="text-[17px] leading-relaxed text-text-zweit">
            {t(
              "Halte die Kamera auf den QR-Code auf dem Pass eines anderen Besuchers. Er landet mit Link zu seinem Viewer in deinen Kontakten.",
              "Point the camera at the QR code on another visitor's pass. They go into your contacts with a link to their viewer.",
            )}
          </p>
        </div>
      </Seitenkopf>

      {fehler !== null && <Fehlerhinweis>{fehler}</Fehlerhinweis>}

      {!kameraAus &&
        (kameraMoeglich() ? (
          <div className="overflow-hidden bg-black">
            <Kamera
              pausiert={zustand.art === "laeuft"}
              aufTreffer={ausQr}
              aufFehler={(art: Kamerafehler) => {
                setzeKameraAus(true);
                setzeFehler(
                  art === "verweigert"
                    ? t(
                        "Die Kamera ist für diese Seite gesperrt. Gib sie in den Einstellungen des Browsers frei, oder gib die Passnummer unten von Hand ein.",
                        "The camera is blocked for this page. Allow it in the browser settings, or enter the pass number below by hand.",
                      )
                    : t(
                        "Die Kamera lässt sich nicht starten. Gib die Passnummer unten von Hand ein.",
                        "The camera cannot be started. Enter the pass number below by hand.",
                      ),
                );
              }}
            />
          </div>
        ) : (
          <Fehlerhinweis>
            {t(
              "Die Kamera ist hier nicht verfügbar. Gib die Passnummer unten von Hand ein.",
              "The camera is not available here. Enter the pass number below by hand.",
            )}
          </Fehlerhinweis>
        ))}

      <form
        className="flex flex-col gap-3 bg-flaeche p-6 shadow-flaeche"
        onSubmit={(ev) => {
          ev.preventDefault();
          const guid = guidAus(eingabe, ich.viewerBaseUrl, false);
          if (guid === null) {
            setzeFehler(
              t(
                "Das ist keine gültige Passnummer. Bitte so eingeben, wie sie auf dem Pass steht.",
                "This is not a valid pass number. Please enter it exactly as shown on the pass.",
              ),
            );
            return;
          }
          nimmAuf(guid);
        }}
      >
        <h2 className="text-[15px] font-semibold">
          {t(
            "Kein QR-Code lesbar? Passnummer von Hand eingeben",
            "QR code not readable? Enter the pass number by hand",
          )}
        </h2>
        <div className="flex flex-wrap items-end gap-3">
          <label className="flex w-full min-w-0 flex-col gap-2 text-[14px] font-semibold sm:w-auto sm:flex-1">
            {t("Passnummer", "Pass number")}
            <Feld
              value={eingabe}
              onChange={(ev) => {
                setzeEingabe(ev.target.value);
              }}
              className="h-12 font-mono text-[16px] font-normal"
              autoComplete="off"
              autoCapitalize="none"
              spellCheck={false}
            />
          </label>
          <Knopf
            type="submit"
            className="h-12 w-full px-8 sm:w-auto"
            disabled={eingabe.trim() === "" || zustand.art === "laeuft"}
          >
            {t("Aufnehmen", "Add")}
          </Knopf>
        </div>
      </form>

      <Knopf
        art="rand"
        className="self-start"
        onClick={() => {
          void navigate("/mein/kontakte");
        }}
      >
        {t("Zurück", "Back")}
      </Knopf>
    </Kioskrahmen>
  );
}
