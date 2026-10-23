import { useEffect, useRef, useState, type ReactNode } from "react";
import { useNavigate, useParams } from "react-router";
import { ApiFehler, api, useAbruf } from "../lib/api.js";
import {
  Feld,
  Fehlerhinweis,
  Flaeche,
  Knopf,
  Ueberschrift,
  Zustand,
  knopfKlassen,
} from "../bausteine/basis.js";
import { Rueckfrage } from "../bausteine/dialog.js";
import { Kioskrahmen, Knopfleiste } from "../kiosk/Kioskrahmen.js";
import { verkleinereAufKante } from "../lib/bild.js";

/**
 * Die Nachrichten des Besuchers in seinem Messepass, seit dem 23.10.2026: Titel, Text,
 * optional ein Bild, die Zeit setzt der Server. Sie erscheinen öffentlich im Viewer.
 */

export interface Nachricht {
  id: string;
  platz: number;
  titel: string | null;
  text: string | null;
  bildDateiId: string | null;
  angelegt: number;
}

/** Wie im Server, siehe `services/nachrichten.ts` und `modell/felder.ts`. */
export const MAX_NACHRICHTEN = 10;
const MAX_TITEL = 100;
const MAX_TEXT = 2000;
/** Die längere Kante nach dem Verkleinern. */
const BILDKANTE = 1600;

export function zeit(ms: number): string {
  return new Date(ms).toLocaleString("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

const bild = (id: string) => `/api/mein/bild/${id}`;

function Rahmen({ aufAbmelden, children }: { aufAbmelden: () => void; children: ReactNode }) {
  return (
    <Kioskrahmen aufAbmelden={aufAbmelden} besucher>
      {children}
    </Kioskrahmen>
  );
}

function Oeffentlich() {
  return (
    <p className="border-l-4 border-akzent bg-flaeche px-4 py-3 text-[14px]">
      Deine Nachrichten sind <b>öffentlich im Viewer</b> sichtbar, für jeden mit der Adresse deines
      Passes. Lade nichts hoch, was andere nicht sehen sollen.
    </p>
  );
}

// --- Liste ----------------------------------------------------------------------------

export function MeinNachrichten({ aufAbmelden }: { aufAbmelden: () => void }) {
  const navigate = useNavigate();
  const abruf = useAbruf<Nachricht[]>("/api/mein/nachrichten");
  const [zuLoeschen, setzeZuLoeschen] = useState<Nachricht | null>(null);
  const [laeuft, setzeLaeuft] = useState(false);
  const [fehler, setzeFehler] = useState<string | null>(null);

  const alle = [...(abruf.daten ?? [])].sort((a, b) => b.angelegt - a.angelegt);
  const voll = alle.length >= MAX_NACHRICHTEN;

  async function loesche() {
    if (zuLoeschen === null) return;
    setzeLaeuft(true);
    setzeFehler(null);
    try {
      await api(`/api/mein/nachrichten/${zuLoeschen.id}`, { method: "DELETE" });
      setzeZuLoeschen(null);
      abruf.neu();
    } catch {
      setzeFehler("Die Nachricht ließ sich nicht löschen.");
    } finally {
      setzeLaeuft(false);
    }
  }

  return (
    <Rahmen aufAbmelden={aufAbmelden}>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <Ueberschrift>Meine Nachrichten</Ueberschrift>
        <span className="text-[15px] text-text-hinweis">
          {alle.length} von {MAX_NACHRICHTEN}
        </span>
      </div>
      <Oeffentlich />

      <Zustand laedt={abruf.laedt} fehler={abruf.fehler}>
        {alle.length === 0 ? (
          <p className="text-[15px] text-text-zweit">Noch keine Nachricht.</p>
        ) : (
          <ul className="flex flex-col gap-4">
            {alle.map((n) => (
              <li key={n.id}>
                <Flaeche className="flex flex-col gap-4 p-6 sm:flex-row">
                  {n.bildDateiId !== null && (
                    <img
                      src={bild(n.bildDateiId)}
                      alt=""
                      className="aspect-[4/3] w-full shrink-0 object-cover sm:w-48"
                    />
                  )}
                  <div className="flex min-w-0 flex-1 flex-col gap-2">
                    <span className="text-xs text-text-hinweis">{zeit(n.angelegt)}</span>
                    {n.titel !== null && (
                      <h2 className="text-lg font-semibold break-words">{n.titel}</h2>
                    )}
                    {n.text !== null && (
                      <p className="text-[15px] whitespace-pre-line text-text-zweit break-words">
                        {n.text}
                      </p>
                    )}
                    <div className="mt-auto flex flex-wrap gap-3 pt-2">
                      <Knopf
                        art="rand"
                        onClick={() => {
                          void navigate(`/mein/nachrichten/${n.id}`);
                        }}
                      >
                        Bearbeiten
                      </Knopf>
                      <Knopf
                        art="rand"
                        onClick={() => {
                          setzeFehler(null);
                          setzeZuLoeschen(n);
                        }}
                      >
                        Löschen
                      </Knopf>
                    </div>
                  </div>
                </Flaeche>
              </li>
            ))}
          </ul>
        )}
      </Zustand>

      <Knopfleiste>
        <Knopf
          className="h-14 px-8 text-[17px]"
          disabled={voll}
          onClick={() => {
            void navigate("/mein/nachrichten/neu");
          }}
        >
          Neue Nachricht
        </Knopf>
        <Knopf
          art="rand"
          className="h-14 px-8 text-[17px]"
          onClick={() => {
            void navigate("/mein");
          }}
        >
          Zurück
        </Knopf>
        {voll && (
          <span className="self-center text-[14px] text-text-hinweis">
            Alle {MAX_NACHRICHTEN} Plätze sind belegt. Lösche eine, um eine neue zu schreiben.
          </span>
        )}
      </Knopfleiste>

      <Rueckfrage
        offen={zuLoeschen !== null}
        aufOffen={(offen) => {
          if (!offen) setzeZuLoeschen(null);
        }}
        titel="Nachricht löschen?"
        bestaetigenText="Löschen"
        art="gefahr"
        laeuft={laeuft}
        fehler={fehler}
        aufBestaetigen={() => void loesche()}
      >
        „{zuLoeschen?.titel ?? zuLoeschen?.text?.slice(0, 40) ?? ""}“ wird mit Bild gelöscht und
        verschwindet aus dem Viewer.
      </Rueckfrage>
    </Rahmen>
  );
}

// --- Schreiben ------------------------------------------------------------------------

function fehlertext(ursache: unknown): string {
  const code = ursache instanceof ApiFehler ? ursache.code : undefined;
  switch (code) {
    case "nachricht-leer":
      return "Bitte einen Titel oder einen Text eingeben.";
    case "feld-zu-lang":
      return "Titel oder Text ist zu lang.";
    case "bild-ungueltig":
      return "Das Bild muss ein JPEG, PNG oder WebP sein.";
    case "bild-zu-gross":
      return "Das Bild ist zu groß.";
    case "kontingent-erschoepft":
      return `Alle ${String(MAX_NACHRICHTEN)} Plätze sind belegt.`;
    default:
      return "Das Speichern hat nicht geklappt. Bitte noch einmal versuchen.";
  }
}

export function MeinNachricht({ aufAbmelden }: { aufAbmelden: () => void }) {
  const { id } = useParams();
  const neu = id === undefined;
  const navigate = useNavigate();
  const abruf = useAbruf<Nachricht[]>(neu ? null : "/api/mein/nachrichten");
  const vorhanden = abruf.daten?.find((n) => n.id === id) ?? null;

  const [titel, setzeTitel] = useState<string | null>(null);
  const [text, setzeText] = useState<string | null>(null);
  const [neuesBild, setzeNeuesBild] = useState<Blob | null>(null);
  const [vorschau, setzeVorschau] = useState<string | null>(null);
  const [bildEntfernen, setzeBildEntfernen] = useState(false);
  const [fehler, setzeFehler] = useState<string | null>(null);
  const [laeuft, setzeLaeuft] = useState(false);
  const feld = useRef<HTMLInputElement | null>(null);

  // Vorgabe aus dem Bestand, bis der Besucher selbst etwas ändert.
  const titelWert = titel ?? vorhanden?.titel ?? "";
  const textWert = text ?? vorhanden?.text ?? "";
  const altesBild = bildEntfernen ? null : (vorhanden?.bildDateiId ?? null);

  // Die Vorschau-Adresse freigeben, wenn sie nicht mehr gebraucht wird.
  useEffect(() => {
    return () => {
      if (vorschau !== null) URL.revokeObjectURL(vorschau);
    };
  }, [vorschau]);

  async function waehle(dateien: FileList | null) {
    // **Erst die Datei sichern, dann das Feld leeren**, sonst ist die Liste beim Zugriff weg.
    const datei = dateien?.[0] ?? null;
    if (feld.current !== null) feld.current.value = "";
    if (datei === null) return;
    setzeFehler(null);
    try {
      const klein = await verkleinereAufKante(datei, BILDKANTE);
      setzeNeuesBild(klein);
      setzeVorschau(URL.createObjectURL(klein));
      setzeBildEntfernen(false);
    } catch {
      setzeFehler("Dieses Bild lässt sich nicht verarbeiten. Bitte ein JPEG oder PNG wählen.");
    }
  }

  function entferneBild() {
    setzeNeuesBild(null);
    setzeVorschau(null);
    setzeBildEntfernen(true);
  }

  async function speichere() {
    if (titelWert.trim() === "" && textWert.trim() === "") {
      setzeFehler("Bitte einen Titel oder einen Text eingeben.");
      return;
    }
    setzeLaeuft(true);
    setzeFehler(null);
    const form = new FormData();
    form.append("titel", titelWert);
    form.append("text", textWert);
    if (neuesBild !== null) form.append("bild", neuesBild, "bild.jpg");
    else if (bildEntfernen && !neu) form.append("bildEntfernen", "true");
    try {
      await api(neu ? "/api/mein/nachrichten" : `/api/mein/nachrichten/${String(id)}`, {
        method: neu ? "POST" : "PATCH",
        body: form,
      });
      void navigate("/mein/nachrichten");
    } catch (ursache) {
      setzeFehler(fehlertext(ursache));
    } finally {
      setzeLaeuft(false);
    }
  }

  const zeigeBild = vorschau ?? (altesBild === null ? null : bild(altesBild));

  return (
    <Rahmen aufAbmelden={aufAbmelden}>
      <Ueberschrift>{neu ? "Neue Nachricht" : "Nachricht bearbeiten"}</Ueberschrift>
      <Oeffentlich />

      <Zustand laedt={!neu && abruf.laedt} fehler={neu ? null : abruf.fehler}>
        {!neu && abruf.daten !== null && vorhanden === null ? (
          <Fehlerhinweis>Diese Nachricht gibt es nicht mehr.</Fehlerhinweis>
        ) : (
          <>
            {fehler !== null && <Fehlerhinweis>{fehler}</Fehlerhinweis>}
            <Flaeche className="flex flex-col gap-5 p-7">
              <label className="flex flex-col gap-2 text-[14px] font-semibold">
                Titel
                <Feld
                  className="h-12 text-[16px] font-normal"
                  maxLength={MAX_TITEL}
                  value={titelWert}
                  onChange={(ev) => {
                    setzeTitel(ev.target.value);
                  }}
                />
              </label>
              <label className="flex flex-col gap-2 text-[14px] font-semibold">
                Text
                <textarea
                  className="min-h-40 w-full rounded-none border border-linie-feld bg-flaeche px-3 py-2 text-[16px] font-normal text-text"
                  maxLength={MAX_TEXT}
                  value={textWert}
                  onChange={(ev) => {
                    setzeText(ev.target.value);
                  }}
                />
                <span className="self-end text-xs font-normal text-text-hinweis">
                  {textWert.length} / {MAX_TEXT}
                </span>
              </label>

              <div className="flex flex-col gap-3">
                <span className="text-[14px] font-semibold">Bild (optional)</span>
                {zeigeBild !== null && (
                  <img
                    src={zeigeBild}
                    alt="Gewähltes Bild"
                    className="max-h-72 self-start object-contain"
                  />
                )}
                <div className="flex flex-wrap gap-3">
                  {/* Das native Dateifeld ist versteckt; das Label ist der Knopf. */}
                  <label className={knopfKlassen("rand", "cursor-pointer")}>
                    {zeigeBild === null ? "Bild wählen" : "Bild ersetzen"}
                    <input
                      ref={feld}
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      disabled={laeuft}
                      onChange={(ev) => void waehle(ev.target.files)}
                      className="sr-only"
                    />
                  </label>
                  {zeigeBild !== null && (
                    <Knopf art="rand" onClick={entferneBild}>
                      Bild entfernen
                    </Knopf>
                  )}
                </div>
              </div>
            </Flaeche>

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
                  void navigate("/mein/nachrichten");
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
