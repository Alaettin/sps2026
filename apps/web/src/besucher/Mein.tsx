import { useState, type ReactNode } from "react";
import { useNavigate } from "react-router";
import { ApiFehler, api, useAbruf } from "../lib/api.js";
import { Fehlerhinweis, Flaeche, Knopf, Ueberschrift, Zustand } from "../bausteine/basis.js";
import { PERSONENFELDER, besucherFehlertext, mitTitel } from "../lib/personenfelder.js";
import { Kioskrahmen, Knopfleiste } from "../kiosk/Kioskrahmen.js";
import { Avatarwahl } from "../bausteine/avatarwahl.js";
import { Personenformular } from "../bausteine/personenformular.js";
import { Datenschutztext, type Datenschutzabschnitt } from "../bausteine/datenschutztext.js";

/**
 * Der Bereich des angemeldeten Besuchers, seit dem 23.10.2026: Begrüßung, Daten ändern, Bild
 * aussuchen, Datenschutzhinweis nachlesen. Die GUID steht nirgends in der Adresse; der Server
 * nimmt sie aus der Sitzung (`/api/mein`).
 */

interface Besucher extends Record<string, string | null> {
  guid: string;
  avatarDateiId: string | null;
}

const bild = (id: string) => `/api/mein/bild/${id}`;

function Rahmen({ aufAbmelden, children }: { aufAbmelden: () => void; children: ReactNode }) {
  return (
    <Kioskrahmen aufAbmelden={aufAbmelden} besucher>
      {children}
    </Kioskrahmen>
  );
}

// --- Menü -----------------------------------------------------------------------------

export function MeinMenue({ aufAbmelden }: { aufAbmelden: () => void }) {
  const navigate = useNavigate();
  const abruf = useAbruf<Besucher>("/api/mein");
  const b = abruf.daten;

  return (
    <Rahmen aufAbmelden={aufAbmelden}>
      <Zustand laedt={abruf.laedt} fehler={abruf.fehler}>
        {b !== null && (
          <>
            <div className="flex flex-wrap items-center gap-5">
              {b.avatarDateiId !== null && (
                <img
                  src={bild(b.avatarDateiId)}
                  alt="Dein Bild"
                  className="size-20 shrink-0 object-cover"
                />
              )}
              <div className="flex min-w-0 flex-col">
                <Ueberschrift>
                  Hallo {mitTitel(b.titel, b.vorname ?? "")} {b.nachname}
                </Ueberschrift>
                <span className="text-[15px] text-text-hinweis">{b.firma ?? "ohne Firma"}</span>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <Kachel
                titel="Daten ändern"
                text="Name, Firma, Anschrift und Kontakt."
                aufKlick={() => {
                  void navigate("/mein/stammdaten");
                }}
              />
              <Kachel
                titel="Bild aussuchen"
                text="Wähle ein Bild, das im Viewer erscheint."
                aufKlick={() => {
                  void navigate("/mein/avatar");
                }}
              />
            </div>

            <button
              type="button"
              className="self-start text-[14px] font-semibold text-primaer-dunkel underline underline-offset-2"
              onClick={() => {
                void navigate("/mein/datenschutz");
              }}
            >
              Datenschutzhinweis und Widerruf
            </button>
          </>
        )}
      </Zustand>
    </Rahmen>
  );
}

function Kachel({ titel, text, aufKlick }: { titel: string; text: string; aufKlick: () => void }) {
  return (
    <button
      type="button"
      onClick={aufKlick}
      className="flex flex-col gap-2 bg-flaeche p-7 text-left shadow-flaeche hover:brightness-[0.98]"
    >
      <span className="text-xl font-bold tracking-[-0.01em]">{titel}</span>
      <span className="text-[15px] text-text-zweit">{text}</span>
    </button>
  );
}

// --- Stammdaten -----------------------------------------------------------------------

export function MeinStammdaten({ aufAbmelden }: { aufAbmelden: () => void }) {
  const navigate = useNavigate();
  const abruf = useAbruf<Besucher>("/api/mein");
  const [entwurf, setzeEntwurf] = useState<Record<string, string> | null>(null);
  const [fehler, setzeFehler] = useState<string | null>(null);
  const [laeuft, setzeLaeuft] = useState(false);

  const b = abruf.daten;
  /*
   * Der Entwurf entsteht beim ersten Rendern mit Daten, nicht in einem Effekt: ein Effekt,
   * der auf `b` hört, überschriebe die Eingaben bei jedem erneuten Abruf.
   */
  const werte =
    entwurf ??
    (b === null ? null : Object.fromEntries(PERSONENFELDER.map((f) => [f.name, b[f.name] ?? ""])));

  async function speichere() {
    if (werte === null) return;
    setzeLaeuft(true);
    setzeFehler(null);
    try {
      await api("/api/mein", { method: "PATCH", body: JSON.stringify(werte) });
      void navigate("/mein");
    } catch (ursache) {
      setzeFehler(
        (ursache instanceof ApiFehler ? besucherFehlertext(ursache.code) : null) ??
          "Das Speichern hat nicht geklappt. Bitte noch einmal versuchen.",
      );
    } finally {
      setzeLaeuft(false);
    }
  }

  return (
    <Rahmen aufAbmelden={aufAbmelden}>
      <Ueberschrift>Deine Daten</Ueberschrift>
      <Zustand laedt={abruf.laedt} fehler={abruf.fehler}>
        {werte !== null && (
          <>
            {fehler !== null && <Fehlerhinweis>{fehler}</Fehlerhinweis>}
            <Personenformular
              werte={werte}
              aufAenderung={(feld, wert) => {
                setzeEntwurf({ ...werte, [feld]: wert });
              }}
            />
            <Knopfleiste>
              <Knopf
                className="h-14 px-8 text-[17px]"
                disabled={laeuft}
                onClick={() => void speichere()}
              >
                {laeuft ? "Speichert …" : "Speichern"}
              </Knopf>
              <Knopf
                art="rand"
                className="h-14 px-8 text-[17px]"
                disabled={laeuft}
                onClick={() => {
                  void navigate("/mein");
                }}
              >
                Abbrechen
              </Knopf>
            </Knopfleiste>
          </>
        )}
      </Zustand>
    </Rahmen>
  );
}

// --- Avatar ---------------------------------------------------------------------------

interface Galerie {
  standard: string;
  avatare: string[];
}

export function MeinAvatar({ aufAbmelden }: { aufAbmelden: () => void }) {
  const navigate = useNavigate();
  const besucher = useAbruf<Besucher>("/api/mein");
  const galerie = useAbruf<Galerie>("/api/mein/avatare");
  const [gewaehlt, setzeGewaehlt] = useState<string | null>(null);
  const [fehler, setzeFehler] = useState<string | null>(null);
  const [laeuft, setzeLaeuft] = useState(false);

  const g = galerie.daten;
  const aktuell = gewaehlt ?? besucher.daten?.avatarDateiId ?? g?.standard ?? null;

  async function speichere() {
    setzeLaeuft(true);
    setzeFehler(null);
    try {
      await api("/api/mein/avatar", {
        method: "PATCH",
        body: JSON.stringify({ avatarDateiId: aktuell }),
      });
      void navigate("/mein");
    } catch {
      setzeFehler("Das Speichern hat nicht geklappt. Bitte noch einmal versuchen.");
    } finally {
      setzeLaeuft(false);
    }
  }

  return (
    <Rahmen aufAbmelden={aufAbmelden}>
      <Ueberschrift>Dein Bild</Ueberschrift>
      <Zustand laedt={besucher.laedt || galerie.laedt} fehler={besucher.fehler ?? galerie.fehler}>
        {g !== null && (
          <>
            {fehler !== null && <Fehlerhinweis>{fehler}</Fehlerhinweis>}
            <Avatarwahl
              standard={g.standard}
              avatare={g.avatare}
              gewaehlt={aktuell}
              aufWahl={setzeGewaehlt}
              bild={bild}
            />
            <Knopfleiste>
              <Knopf
                className="h-14 px-8 text-[17px]"
                disabled={laeuft}
                onClick={() => void speichere()}
              >
                {laeuft ? "Speichert …" : "Speichern"}
              </Knopf>
              <Knopf
                art="rand"
                className="h-14 px-8 text-[17px]"
                disabled={laeuft}
                onClick={() => {
                  void navigate("/mein");
                }}
              >
                Abbrechen
              </Knopf>
            </Knopfleiste>
          </>
        )}
      </Zustand>
    </Rahmen>
  );
}

// --- Datenschutz ----------------------------------------------------------------------

export function MeinDatenschutz({ aufAbmelden }: { aufAbmelden: () => void }) {
  const navigate = useNavigate();
  const abruf = useAbruf<{ fassung: string; abschnitte: Datenschutzabschnitt[] }>(
    "/api/mein/datenschutz",
  );

  return (
    <Rahmen aufAbmelden={aufAbmelden}>
      <Ueberschrift>Datenschutzhinweis</Ueberschrift>
      <Zustand laedt={abruf.laedt} fehler={abruf.fehler}>
        {abruf.daten !== null && (
          <Flaeche className="p-7">
            <Datenschutztext abschnitte={abruf.daten.abschnitte} fassung={abruf.daten.fassung} />
          </Flaeche>
        )}
      </Zustand>
      <Knopf
        art="rand"
        className="self-start"
        onClick={() => {
          void navigate("/mein");
        }}
      >
        Zurück
      </Knopf>
    </Rahmen>
  );
}
