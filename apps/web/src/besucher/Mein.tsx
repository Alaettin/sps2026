import { useState, type ReactNode } from "react";
import { useNavigate } from "react-router";
import { ApiFehler, api, useAbruf } from "../lib/api.js";
import {
  Abschnitt,
  Fehlerhinweis,
  Flaeche,
  Knopf,
  Seitenkopf,
  Ueberschrift,
  Zustand,
} from "../bausteine/basis.js";
import { PERSONENFELDER, besucherFehlertext, mitTitel } from "../lib/personenfelder.js";
import { Kioskrahmen, Knopfleiste } from "../kiosk/Kioskrahmen.js";
import { Avatarwahl } from "../bausteine/avatarwahl.js";
import { Personenformular } from "../bausteine/personenformular.js";
import { Datenschutztext, type Datenschutzabschnitt } from "../bausteine/datenschutztext.js";
import { Rueckfrage } from "../bausteine/dialog.js";

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
            <Seitenkopf className="justify-start gap-5">
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
            </Seitenkopf>

            <div className="grid gap-4 sm:grid-cols-2">
              {/* Seit dem 02.11.2026 die Haupthandlung am Stand, deshalb vorn. */}
              <Kachel
                titel="Exponate"
                text="Exponate per QR-Code scannen und deine aufgenommenen ansehen."
                aufKlick={() => {
                  void navigate("/mein/exponate");
                }}
              />
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

interface MeinExponat {
  exponatId: string;
  kennung: string;
  name: string;
  zeitpunkt: number;
}

const datum = new Intl.DateTimeFormat("de-DE", { dateStyle: "short", timeStyle: "short" });

/**
 * Die Unterseite „Exponate“, seit dem 02.11.2026: Knopf zum Scannen und die aufgenommenen
 * Exponate als einfache Liste, jedes mit Rückfrage entfernbar. Entfernt verschwindet es aus dem
 * Viewer; zurück kommt es nur durch erneutes Scannen am Exponat.
 */
export function MeinExponate({ aufAbmelden }: { aufAbmelden: () => void }) {
  const navigate = useNavigate();
  const abruf = useAbruf<MeinExponat[]>("/api/mein/besuche");
  const [zuEntfernen, setzeZuEntfernen] = useState<MeinExponat | null>(null);
  const [laeuft, setzeLaeuft] = useState(false);
  const [fehler, setzeFehler] = useState<string | null>(null);
  const liste = abruf.daten ?? [];

  async function entferne() {
    if (zuEntfernen === null) return;
    setzeLaeuft(true);
    setzeFehler(null);
    try {
      await api(`/api/mein/besuche/${zuEntfernen.exponatId}`, { method: "DELETE" });
      setzeZuEntfernen(null);
      abruf.neu();
    } catch (ursache) {
      setzeFehler(ursache instanceof ApiFehler ? ursache.message : "Entfernen nicht möglich.");
    } finally {
      setzeLaeuft(false);
    }
  }

  return (
    <Rahmen aufAbmelden={aufAbmelden}>
      <Seitenkopf>
        <Ueberschrift>Exponate</Ueberschrift>
        <Knopf
          onClick={() => {
            void navigate("/mein/scan");
          }}
        >
          Exponat scannen
        </Knopf>
      </Seitenkopf>

      <Abschnitt titel={<>Meine Exponate ({liste.length})</>}>
        <Zustand laedt={abruf.laedt} fehler={abruf.fehler}>
          {liste.length === 0 ? (
            <p className="text-[15px] text-text-hinweis">
              Noch kein Exponat aufgenommen. Scanne den QR-Code an einem Exponat.
            </p>
          ) : (
            <ul className="flex flex-col">
              {liste.map((e) => (
                <li
                  key={e.exponatId}
                  className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 border-b border-linie py-3 last:border-b-0"
                >
                  <span className="flex min-w-[12rem] flex-1 flex-col">
                    <span className="text-[15px] font-semibold">
                      <span className="mr-2 text-text-hinweis">{e.kennung}</span>
                      {e.name}
                    </span>
                    <span className="text-[13px] text-text-hinweis">
                      aufgenommen {datum.format(e.zeitpunkt)}
                    </span>
                  </span>
                  <Knopf
                    art="still"
                    className="h-9 px-3 text-[13px]"
                    onClick={() => {
                      setzeFehler(null);
                      setzeZuEntfernen(e);
                    }}
                  >
                    Entfernen
                  </Knopf>
                </li>
              ))}
            </ul>
          )}
        </Zustand>

        <Rueckfrage
          offen={zuEntfernen !== null}
          aufOffen={(o) => {
            if (!o) setzeZuEntfernen(null);
          }}
          titel="Exponat entfernen?"
          bestaetigenText="Entfernen"
          art="gefahr"
          laeuft={laeuft}
          fehler={fehler}
          aufBestaetigen={() => void entferne()}
        >
          <p>
            <b>
              {zuEntfernen?.kennung} {zuEntfernen?.name}
            </b>{" "}
            verschwindet aus deinem Messepass und deinem Viewer.
          </p>
          <p>Um es wieder aufzunehmen, scanne den QR-Code am Exponat erneut.</p>
        </Rueckfrage>
      </Abschnitt>

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

function Kachel({ titel, text, aufKlick }: { titel: string; text: string; aufKlick: () => void }) {
  return (
    <button
      type="button"
      onClick={aufKlick}
      className="flex flex-col gap-2 bg-flaeche p-7 text-left shadow-flaeche hover:brightness-[0.98]"
    >
      <span className="text-xl font-medium tracking-[-0.01em] text-primaer">{titel}</span>
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
      <Seitenkopf>
        <Ueberschrift>Deine Daten</Ueberschrift>
      </Seitenkopf>
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
      <Seitenkopf>
        <Ueberschrift>Dein Bild</Ueberschrift>
      </Seitenkopf>
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
      <Seitenkopf>
        <Ueberschrift>Datenschutzhinweis</Ueberschrift>
      </Seitenkopf>
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
