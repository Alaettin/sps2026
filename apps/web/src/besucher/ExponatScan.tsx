import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router";
import { ApiFehler, api } from "../lib/api.js";
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
import { useSprache } from "../lib/sprache.js";

/**
 * Der Besucher nimmt ein Exponat auf, seit dem 02.11.2026: QR-Code am Exponat scannen, fertig.
 *
 * Zwei Wege führen hierher. In der App die Kachel „Exponat scannen“ mit der Kamera, und von
 * außen die Handykamera: der QR-Code ist die Adresse `/mein/scan/<code>`, die nach der
 * Anmeldung sofort aufnimmt. Aufgenommen wird das ganze Exponat, und zwar live; was der
 * Aussteller später ergänzt, erscheint ebenfalls im Viewer.
 */

/** Dasselbe Alphabet wie der Code auf dem Server (base64url oder hex). */
const CODE_MUSTER = /^[A-Za-z0-9_-]{16,64}$/;

/**
 * Der Code aus dem Inhalt eines QR-Codes oder einer Eingabe, oder `null`.
 *
 * Ein QR-Code muss die Adresse mit `/mein/scan/` sein, sonst liefe jeder Werbe-QR-Code in
 * eine Serverabfrage. Von Hand darf auch der Code allein stehen.
 */
export function codeAus(inhalt: string, nurAdresse: boolean): string | null {
  const text = inhalt.trim();
  const marke = "/mein/scan/";
  const stelle = text.indexOf(marke);
  let code: string;
  if (stelle >= 0) {
    code = decodeURIComponent(text.slice(stelle + marke.length).split(/[/?#]/)[0] ?? "");
  } else if (nurAdresse) {
    return null;
  } else {
    code = text;
  }
  return CODE_MUSTER.test(code) ? code : null;
}

type Zustand =
  | { art: "scannen" }
  | { art: "laeuft" }
  | { art: "fertig"; kennung: string; name: string; neu: boolean };

export function MeinExponatScan({ aufAbmelden }: { aufAbmelden: () => void }) {
  const { t } = useSprache();
  const navigate = useNavigate();
  const { code: ausAdresse } = useParams();
  const [zustand, setzeZustand] = useState<Zustand>({ art: "scannen" });
  const [fehler, setzeFehler] = useState<string | null>(null);
  const [eingabe, setzeEingabe] = useState("");
  // Startet die Kamera nicht, bleibt nur ein schwarzer Kasten; dann blenden wir ihn aus.
  const [kameraAus, setzeKameraAus] = useState(false);

  const nimmAuf = useCallback(
    (code: string) => {
      setzeFehler(null);
      setzeZustand({ art: "laeuft" });
      api<{ kennung: string; name: string; neu: boolean }>("/api/mein/besuche", {
        method: "POST",
        body: JSON.stringify({ code }),
      })
        .then((antwort) => {
          setzeZustand({ art: "fertig", ...antwort });
        })
        .catch((ursache: unknown) => {
          setzeZustand({ art: "scannen" });
          setzeFehler(
            ursache instanceof ApiFehler && ursache.status === 404
              ? t(
                  "Diesen Code kennen wir nicht. Bitte den QR-Code am Exponat scannen.",
                  "We don't recognise this code. Please scan the QR code on the exhibit.",
                )
              : t(
                  "Das hat nicht geklappt. Bitte noch einmal versuchen.",
                  "That did not work. Please try again.",
                ),
          );
        });
    },
    [t],
  );

  /*
   * Kam der Code über die Adresse, einmal aufnehmen. Der Ref hält den zweiten Aufruf ab, den
   * React im Entwicklungsmodus durch doppeltes Einhängen auslöst; der Server wäre zwar
   * idempotent, die Bestätigung hieße dann aber „schon aufgenommen“.
   */
  const schonGesendet = useRef(false);
  useEffect(() => {
    if (ausAdresse === undefined || schonGesendet.current) return;
    schonGesendet.current = true;
    const code = codeAus(ausAdresse, false);
    if (code === null) {
      setzeFehler(
        t(
          "Diesen Code kennen wir nicht. Bitte den QR-Code am Exponat scannen.",
          "We don't recognise this code. Please scan the QR code on the exhibit.",
        ),
      );
      return;
    }
    nimmAuf(code);
  }, [ausAdresse, nimmAuf, t]);

  const ausQr = useCallback(
    (inhalt: string) => {
      const code = codeAus(inhalt, true);
      if (code === null) {
        setzeFehler(t("Das ist kein QR-Code eines Exponats.", "This is not an exhibit QR code."));
        return;
      }
      nimmAuf(code);
    },
    [nimmAuf, t],
  );

  if (zustand.art === "fertig") {
    return (
      <Kioskrahmen aufAbmelden={aufAbmelden} besucher>
        <Flaeche className="flex flex-col gap-4 p-7">
          <Ueberschrift>
            {zustand.neu
              ? t("Exponat aufgenommen", "Exhibit added")
              : t("Schon aufgenommen", "Already added")}
          </Ueberschrift>
          <p className="text-[17px] leading-relaxed text-text-zweit">
            <b className="text-text">
              {zustand.kennung} {zustand.name}
            </b>{" "}
            {zustand.neu
              ? t(
                  "steht jetzt in deinem Messepass. Dokumente, Links und Ansprechpartner findest du im Viewer.",
                  "is now in your trade fair pass. You will find documents, links and contacts in the viewer.",
                )
              : t("stand schon in deinem Messepass.", "was already in your trade fair pass.")}
          </p>
          <div className="flex flex-wrap gap-3">
            <Knopf
              onClick={() => {
                setzeZustand({ art: "scannen" });
                void navigate("/mein/scan", { replace: true });
              }}
            >
              {t("Weiteres Exponat scannen", "Scan another exhibit")}
            </Knopf>
            <Knopf
              art="rand"
              onClick={() => {
                void navigate("/mein/exponate");
              }}
            >
              {t("Zu meinen Exponaten", "To my exhibits")}
            </Knopf>
          </div>
        </Flaeche>
      </Kioskrahmen>
    );
  }

  return (
    <Kioskrahmen aufAbmelden={aufAbmelden} besucher>
      {/*
        Im weißen Seitenkopf wie auf den anderen Unterseiten: direkt auf dem blauen Band
        verschwand die blaue Überschrift, und der Text lag halb im Blau.
      */}
      <Seitenkopf>
        <div className="flex min-w-0 flex-col gap-2">
          <Ueberschrift>{t("Exponat scannen", "Scan exhibit")}</Ueberschrift>
          <p className="text-[17px] leading-relaxed text-text-zweit">
            {t(
              "Halte die Kamera auf den QR-Code am Exponat. Es landet mit allen Infos in deinem Messepass.",
              "Point the camera at the QR code on the exhibit. It goes into your trade fair pass with all its information.",
            )}
          </p>
        </div>
      </Seitenkopf>

      {fehler !== null && <Fehlerhinweis>{fehler}</Fehlerhinweis>}

      {ausAdresse === undefined &&
        !kameraAus &&
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
                        "Die Kamera ist für diese Seite gesperrt. Gib sie in den Einstellungen des Browsers frei, oder scanne den QR-Code mit der Kamera-App deines Handys.",
                        "The camera is blocked for this page. Allow it in the browser settings, or scan the QR code with your phone's camera app.",
                      )
                    : t(
                        "Die Kamera lässt sich nicht starten. Scanne den QR-Code mit der Kamera-App deines Handys.",
                        "The camera cannot be started. Scan the QR code with your phone's camera app.",
                      ),
                );
              }}
            />
          </div>
        ) : (
          <Fehlerhinweis>
            {t(
              "Die Kamera ist hier nicht verfügbar. Scanne den QR-Code mit der Kamera-App deines Handys.",
              "The camera is not available here. Scan the QR code with your phone's camera app.",
            )}
          </Fehlerhinweis>
        ))}

      <form
        className="flex flex-col gap-3 bg-flaeche p-6 shadow-flaeche"
        onSubmit={(ev) => {
          ev.preventDefault();
          const code = codeAus(eingabe, false);
          if (code === null) {
            setzeFehler(
              t(
                "Das ist kein gültiger Code. Bitte so eingeben, wie er am Exponat steht.",
                "This is not a valid code. Please enter it exactly as shown on the exhibit.",
              ),
            );
            return;
          }
          nimmAuf(code);
        }}
      >
        <h2 className="text-[15px] font-semibold">
          {t(
            "Kein QR-Code lesbar? Code von Hand eingeben",
            "QR code not readable? Enter the code by hand",
          )}
        </h2>
        <div className="flex flex-wrap items-end gap-3">
          <label className="flex w-full min-w-0 flex-col gap-2 text-[14px] font-semibold sm:w-auto sm:flex-1">
            {t("Code vom Exponat", "Code from the exhibit")}
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
          void navigate("/mein/exponate");
        }}
      >
        {t("Zurück", "Back")}
      </Knopf>
    </Kioskrahmen>
  );
}
