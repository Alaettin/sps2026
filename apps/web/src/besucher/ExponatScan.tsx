import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router";
import { ApiFehler, api } from "../lib/api.js";
import { Feld, Fehlerhinweis, Flaeche, Knopf, Ueberschrift } from "../bausteine/basis.js";
import { Kamera, kameraMoeglich, type Kamerafehler } from "../scan/Kamera.js";
import { Kioskrahmen } from "../kiosk/Kioskrahmen.js";

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
  const navigate = useNavigate();
  const { code: ausAdresse } = useParams();
  const [zustand, setzeZustand] = useState<Zustand>({ art: "scannen" });
  const [fehler, setzeFehler] = useState<string | null>(null);
  const [eingabe, setzeEingabe] = useState("");

  const nimmAuf = useCallback((code: string) => {
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
            ? "Diesen Code kennen wir nicht. Bitte den QR-Code am Exponat scannen."
            : "Das hat nicht geklappt. Bitte noch einmal versuchen.",
        );
      });
  }, []);

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
      setzeFehler("Diesen Code kennen wir nicht. Bitte den QR-Code am Exponat scannen.");
      return;
    }
    nimmAuf(code);
  }, [ausAdresse, nimmAuf]);

  const ausQr = useCallback(
    (inhalt: string) => {
      const code = codeAus(inhalt, true);
      if (code === null) {
        setzeFehler("Das ist kein QR-Code eines Exponats.");
        return;
      }
      nimmAuf(code);
    },
    [nimmAuf],
  );

  if (zustand.art === "fertig") {
    return (
      <Kioskrahmen aufAbmelden={aufAbmelden} besucher>
        <Flaeche className="flex flex-col gap-4 p-7">
          <Ueberschrift>{zustand.neu ? "Exponat aufgenommen" : "Schon aufgenommen"}</Ueberschrift>
          <p className="text-[17px] leading-relaxed text-text-zweit">
            <b className="text-text">
              {zustand.kennung} {zustand.name}
            </b>{" "}
            {zustand.neu
              ? "steht jetzt in deinem Messepass. Dokumente, Links und Ansprechpartner findest du im Viewer."
              : "stand schon in deinem Messepass."}
          </p>
          <div className="flex flex-wrap gap-3">
            <Knopf
              onClick={() => {
                setzeZustand({ art: "scannen" });
                void navigate("/mein/scan", { replace: true });
              }}
            >
              Weiteres Exponat scannen
            </Knopf>
            <Knopf
              art="rand"
              onClick={() => {
                void navigate("/mein");
              }}
            >
              Zum Menü
            </Knopf>
          </div>
        </Flaeche>
      </Kioskrahmen>
    );
  }

  return (
    <Kioskrahmen aufAbmelden={aufAbmelden} besucher>
      <Ueberschrift>Exponat scannen</Ueberschrift>
      <p className="text-[17px] leading-relaxed text-text-zweit">
        Halte die Kamera auf den QR-Code am Exponat. Es landet mit allen Infos in deinem Messepass.
      </p>

      {fehler !== null && <Fehlerhinweis>{fehler}</Fehlerhinweis>}

      {ausAdresse === undefined &&
        (kameraMoeglich() ? (
          <div className="overflow-hidden bg-black">
            <Kamera
              pausiert={zustand.art === "laeuft"}
              aufTreffer={ausQr}
              aufFehler={(art: Kamerafehler) => {
                setzeFehler(
                  art === "verweigert"
                    ? "Die Kamera ist für diese Seite gesperrt. Gib sie in den Einstellungen des Browsers frei, oder scanne den QR-Code mit der Kamera-App deines Handys."
                    : "Die Kamera lässt sich nicht starten. Scanne den QR-Code mit der Kamera-App deines Handys.",
                );
              }}
            />
          </div>
        ) : (
          <Fehlerhinweis>
            Die Kamera ist hier nicht verfügbar. Scanne den QR-Code mit der Kamera-App deines
            Handys.
          </Fehlerhinweis>
        ))}

      <form
        className="flex flex-col gap-3 bg-flaeche p-6 shadow-flaeche"
        onSubmit={(ev) => {
          ev.preventDefault();
          const code = codeAus(eingabe, false);
          if (code === null) {
            setzeFehler("Das ist kein gültiger Code. Bitte so eingeben, wie er am Exponat steht.");
            return;
          }
          nimmAuf(code);
        }}
      >
        <h2 className="text-[15px] font-semibold">Kein QR-Code lesbar? Code von Hand eingeben</h2>
        <div className="flex flex-wrap items-end gap-3">
          <label className="flex min-w-0 flex-1 flex-col gap-2 text-[14px] font-semibold">
            Code vom Exponat
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
            className="h-12 px-8"
            disabled={eingabe.trim() === "" || zustand.art === "laeuft"}
          >
            Aufnehmen
          </Knopf>
        </div>
      </form>

      <button
        type="button"
        className="self-start text-[14px] font-semibold text-primaer-dunkel underline underline-offset-2"
        onClick={() => {
          void navigate("/mein");
        }}
      >
        Zurück zum Menü
      </button>
    </Kioskrahmen>
  );
}
