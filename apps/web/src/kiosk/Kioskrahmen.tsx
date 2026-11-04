import { useState, type ReactNode } from "react";
import { useNavigate } from "react-router";
import { api } from "../lib/api.js";
import { Knopf, cn } from "../bausteine/basis.js";
import { Logoreihe } from "../bausteine/logos.js";
import { Band, Fusszeile } from "../bausteine/band.js";
import { Rueckfrage } from "../bausteine/dialog.js";
import { useZeitsperre } from "./zeitsperre.js";
import { Sprachwahl, browsersprache, useSprache } from "../lib/sprache.js";

/**
 * Der Rahmen um alle Kiosk-Bildschirme.
 *
 * **Keine Navigation.** Wer am Tablet steht, soll genau den einen Weg haben: scannen,
 * ändern, fertig. Reiter oder ein Menü wären hier nur Türen zu Seiten, die ein Besucher
 * nicht sehen darf.
 *
 * Er trägt zwei Dinge, die jeder Bildschirm braucht: die Zeitsperre und den Weg hinaus für
 * das Standpersonal.
 *
 * Seit dem 23.10.2026 trägt er auch den Bereich des angemeldeten Besuchers (`besucher`): dort
 * gibt es keine Zeitsperre, und Abmelden fragt nicht nach, denn das Gerät gehört
 * dem Besucher selbst.
 */

/**
 * Die Knöpfe eines Schritts, am unteren Rand klebend.
 *
 * Die Avatargalerie ist höher als ein Tabletbildschirm; ohne das klebende Band müsste man
 * erst scrollen, um überhaupt weiterzukommen, und genau das übersieht jemand, der im Stehen
 * tippt.
 */
export function Knopfleiste({ children }: { children: ReactNode }) {
  return (
    <div className="sticky bottom-0 -mx-6 mt-auto flex flex-wrap gap-4 border-t border-linie bg-grund px-6 py-4">
      {children}
    </div>
  );
}

/**
 * Die Spalte des Kiosks und des Besucherbereichs: schmaler als die Verwaltung, weil hier
 * Formulare und der Datenschutztext stehen, die in 1360 px Zeilenlaenge niemand liest.
 */
const SPALTE = "mx-auto w-full max-w-[820px] px-6";

export function Kioskrahmen({
  children,
  aufAbmelden,
  /** Beim Ablauf der Zeitsperre. Auf dem Scanbildschirm bewusst ohne Wirkung. */
  aufAblauf,
  zeitsperre = true,
  besucher = false,
  /** Haelt die Zeitsperre an, etwa waehrend ein KI-Bild entsteht. */
  angehalten = false,
}: {
  children: ReactNode;
  aufAbmelden: () => void;
  aufAblauf?: () => void;
  zeitsperre?: boolean;
  besucher?: boolean;
  angehalten?: boolean;
}) {
  const { t, zuruecksetzen } = useSprache();
  const navigate = useNavigate();
  const mitSperre = zeitsperre && !besucher;
  // Die Rückfrage vor dem Abmelden am Terminal.
  const [frage, setzeFrage] = useState(false);
  const sperre = useZeitsperre(() => {
    if (!mitSperre) return;
    // Läuft die Zeit ab, während jemand die Rückfrage offen stehen ließ, geht sie mit zu.
    setzeFrage(false);
    // Der naechste Besucher am Tablet beginnt in der Sprache des Geraets, nicht in der
    // seines Vorgaengers: in der des Browsers. Seit dem 03.11.2026.
    zuruecksetzen(browsersprache());
    aufAblauf?.();
  }, angehalten);

  function abmelden() {
    void api("/api/auth/abmelden", { method: "POST" }).finally(() => {
      aufAbmelden();
      void navigate("/anmeldung");
    });
  }

  return (
    /*
      Jede Berührung und jede Eingabe setzt die Uhr zurück. In der Aufnahmephase
      (`capture`), damit es auch dann greift, wenn ein Kind das Ereignis abfängt.
    */
    <div
      className="flex min-h-screen flex-col bg-grund text-text"
      onPointerDownCapture={sperre.melden}
      onKeyDownCapture={sperre.melden}
    >
      {/*
        Kopfzeile, Inhalt und Fusszeile in **einer** Spalte (`SPALTE`), wie im Verwaltungsrahmen.
        Bis zum 27.10.2026 standen die Logos am Fensterrand und der Inhalt zentriert daneben.
      */}
      <header className="relative z-10 bg-flaeche shadow-kopf">
        <div className={cn("flex h-[72px] items-center justify-between gap-4", SPALTE)}>
          <Logoreihe art="kopf" className="justify-start gap-5" />
          {/*
            **Abmelden als sichtbarer Knopf**, seit dem 02.11.2026. Vorher hielt das Personal
            drei Sekunden eine unbeschriftete Fläche gedrückt; wer das nicht wusste, kam bis zum
            Ablauf der Sitzung nicht mehr heraus. Am Terminal fragt der Knopf nach, weil dort auch
            Besucher tippen; im eigenen Bereich des Besuchers meldet er direkt ab.
          */}
          <div className="flex shrink-0 items-center gap-3">
            <Sprachwahl />
            <Knopf
              art="rand"
              className="h-[34px] shrink-0 px-3.5 text-[13px]"
              onClick={() => {
                if (besucher) abmelden();
                else setzeFrage(true);
              }}
            >
              {t("Abmelden", "Sign out")}
            </Knopf>
          </div>
        </div>
      </header>

      {/*
        Band und Fusszeile nur im Bereich des Besuchers. Im Kiosk-Ablauf stehen die Titel mitten
        in den Schritten, und unten klebt die Knopfleiste; ein Band darueber haette dort keinen
        Seitenkopf, auf dem es enden koennte.
      */}
      {besucher && <Band />}
      <main
        className={cn(
          "flex w-full flex-1 flex-col gap-6 py-8",
          SPALTE,
          besucher && "relative -mt-20 pt-0 sm:-mt-24",
        )}
      >
        {children}
      </main>
      {besucher && <Fusszeile />}

      <Rueckfrage
        offen={frage}
        aufOffen={setzeFrage}
        titel={t("Terminal abmelden?", "Sign out terminal?")}
        bestaetigenText={t("Abmelden", "Sign out")}
        aufBestaetigen={abmelden}
      >
        <p>
          {t(
            "Danach muss sich das Standpersonal mit E-Mail und Passwort neu anmelden.",
            "Stand staff will then have to sign in again with email and password.",
          )}
        </p>
      </Rueckfrage>

      {sperre.restSekunden !== null && mitSperre && (
        <div
          role="status"
          className="fixed inset-x-0 bottom-0 z-50 flex flex-wrap items-center justify-center gap-4 border-t border-linie bg-flaeche px-6 py-4 shadow-[0_-8px_24px_rgba(27,29,38,0.12)]"
        >
          <span className="text-[15px] font-medium">
            {t(
              `Noch da? Der Bildschirm wird in ${String(sperre.restSekunden)} Sekunden zurückgesetzt.`,
              `Still there? The screen resets in ${String(sperre.restSekunden)} seconds.`,
            )}
          </span>
          <Knopf onClick={sperre.melden}>{t("Ich bin noch da", "I'm still here")}</Knopf>
        </div>
      )}
    </div>
  );
}
