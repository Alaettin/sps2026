import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { ApiFehler, api, useAbruf } from "../lib/api.js";
import {
  GRUPPEN,
  PERSONENFELDER,
  besucherFehlertext,
  felderDerGruppe,
  pflichtBeimBesucher,
} from "../lib/personenfelder.js";
import {
  Abschnitt,
  BROTKRUME,
  cn,
  Fehlerhinweis,
  Feld,
  Knopf,
  Monowert,
  Seitenkopf,
  Ueberschrift,
  Zustand,
} from "../bausteine/basis.js";
import { Rueckfrage } from "../bausteine/dialog.js";
import type { Ich } from "../lib/ich.js";
import { BesucherExponate } from "./BesucherExponate.js";
import { Avatarwahl } from "../bausteine/avatarwahl.js";
import { type Nachricht, zeit } from "../besucher/Nachrichten.js";

/**
 * Die zehn Textfelder, dieselben wie im Konnektor-Modell.
 *
 * Ausdruecklich typisiert, damit alle Eintraege dieselbe Form haben: ohne das leitet
 * TypeScript aus der Liste eine Vereinigung ab, in der `pflicht` nur bei manchen
 * Varianten existiert und deshalb nirgends lesbar ist.
 */

type Werte = Record<string, string>;

/**
 * Die geladenen Daten eines Besuchers.
 *
 * `Werte` deckt nur die Textfelder ab; `avatarDateiId` kann `null` sein und passt deshalb
 * nicht in dessen Indexsignatur. Beide stehen hier nebeneinander statt ineinander.
 */
type BesucherDaten = Werte & {
  guid: string;
  avatarDateiId: string | null;
};

/** Die Einwilligung aus der Registrierung am Tablet; `null`, wenn das Personal angelegt hat. */
interface Einwilligung {
  einwilligungAm: number | null;
  einwilligungFassung: string | null;
}

export function BesucherDetail({ ich }: { ich: Ich }) {
  const { guid } = useParams();
  const navigate = useNavigate();
  const neu = guid === undefined;

  const abruf = useAbruf<
    BesucherDaten &
      Einwilligung & {
        zuordnungen: { id: string }[];
      }
  >(neu ? null : `/api/besucher/${String(guid)}`);

  const [werte, setzeWerte] = useState<Werte>({});
  const [eigeneGuid, setzeEigeneGuid] = useState("");
  const [fehler, setzeFehler] = useState<string | null>(null);
  const [laeuft, setzeLaeuft] = useState(false);
  const [loeschen, setzeLoeschen] = useState(false);
  const [gespeichert, setzeGespeichert] = useState(false);

  // Die Rückmeldung steht drei Sekunden, dann ist sie wieder weg; Muster wie `Monowert`.
  useEffect(() => {
    if (!gespeichert) return;
    const t = setTimeout(() => {
      setzeGespeichert(false);
    }, 3000);
    return () => {
      clearTimeout(t);
    };
  }, [gespeichert]);

  /*
   * Das Formular ist der **einzige** Ort, an dem die Eingaben stehen. Sie werden einmal
   * aus den geladenen Daten vorbelegt und danach nicht mehr nachgezogen; ein `useEffect`,
   * der bei jeder Antwort ueberschreibt, wuerde die Eingabe des Nutzers wegwerfen.
   */
  useEffect(() => {
    if (abruf.daten === null) return;
    const vorbelegt: Werte = {};
    for (const f of PERSONENFELDER) vorbelegt[f.name] = abruf.daten[f.name] ?? "";
    setzeWerte(vorbelegt);
  }, [abruf.daten]);

  async function speichern() {
    setzeLaeuft(true);
    setzeFehler(null);
    setzeGespeichert(false);
    try {
      if (neu) {
        const angelegt = await api<{ guid: string }>("/api/besucher", {
          method: "POST",
          body: JSON.stringify({ ...werte, ...(eigeneGuid === "" ? {} : { guid: eigeneGuid }) }),
        });
        void navigate(`/besucher/${angelegt.guid}`, { replace: true });
      } else {
        /*
         * **Nicht neu laden.** `abruf.neu()` setzte die ganze Seite kurz auf „Wird geladen“:
         * kein sichtbares Ergebnis, nur ein Blinken, und die Exponate klappten wieder zu.
         * Die Antwort ist der gespeicherte Datensatz; aus ihr kommt das Formular, so stehen
         * dort die Werte, wie der Server sie abgelegt hat (getrimmt, leer statt `null`).
         */
        const neuStand = await api<Record<string, string | null>>(`/api/besucher/${String(guid)}`, {
          method: "PATCH",
          body: JSON.stringify(werte),
        });
        const gesetzt: Werte = {};
        for (const f of PERSONENFELDER) gesetzt[f.name] = neuStand[f.name] ?? "";
        setzeWerte(gesetzt);
        setzeGespeichert(true);
      }
    } catch (ursache) {
      setzeFehler(
        ursache instanceof ApiFehler
          ? (besucherFehlertext(ursache.code) ?? ursache.message)
          : "Speichern nicht möglich.",
      );
    } finally {
      setzeLaeuft(false);
    }
  }

  const aktuelleGuid = abruf.daten?.guid ?? "";

  return (
    <>
      <Seitenkopf>
        {/* Der Rueckweg als Brotkrume ueber dem Titel, `basis-full` gibt ihm die eigene Zeile. */}
        <Link to="/besucher" className={cn(BROTKRUME, "basis-full")}>
          ← Zurück zur Liste
        </Link>
        <Ueberschrift>
          {neu ? "Besucher anlegen" : `${werte["vorname"] ?? ""} ${werte["nachname"] ?? ""}`}
        </Ueberschrift>
      </Seitenkopf>

      <Zustand laedt={abruf.laedt} fehler={abruf.fehler}>
        {fehler !== null && <Fehlerhinweis>{fehler}</Fehlerhinweis>}

        <Abschnitt titel="Stammdaten" className="gap-5">
          <form
            className="grid gap-4 sm:grid-cols-2"
            onSubmit={(e) => {
              e.preventDefault();
              void speichern();
            }}
          >
            {/*
              Nach Gruppen, mit Zwischenüberschrift. Elf Felder am Stück sind eine Wand;
              die Anschrift gehört sichtbar zusammen.
            */}
            {GRUPPEN.map((gruppe) => (
              <fieldset key={gruppe} className="contents">
                <legend className="col-span-full pt-2 text-[11px] font-semibold tracking-[0.08em] text-text-hinweis uppercase">
                  {gruppe}
                </legend>
                {felderDerGruppe(gruppe).map((f) => (
                  <label key={f.name} className="flex flex-col gap-2 text-[13px] font-semibold">
                    {f.text}
                    {pflichtBeimBesucher(f) && <span className="sr-only">Pflichtfeld</span>}
                    <Feld
                      type={f.typ ?? "text"}
                      required={pflichtBeimBesucher(f)}
                      value={werte[f.name] ?? ""}
                      onChange={(e) => {
                        setzeWerte((w) => ({ ...w, [f.name]: e.target.value }));
                        // Die Meldung soll nie für ungespeicherte Eingaben stehen.
                        setzeGespeichert(false);
                      }}
                    />
                  </label>
                ))}
              </fieldset>
            ))}

            {neu && (
              <label className="flex flex-col gap-2 text-[13px] font-semibold sm:col-span-2">
                GUID (leer lassen, dann wird eine erzeugt)
                <span className="flex gap-2">
                  <Feld
                    value={eigeneGuid}
                    onChange={(e) => {
                      setzeEigeneGuid(e.target.value);
                    }}
                    placeholder="wird erzeugt"
                    className="font-mono text-sm"
                  />
                  <Knopf
                    art="rand"
                    onClick={() => {
                      setzeEigeneGuid(crypto.randomUUID());
                    }}
                  >
                    Erzeugen
                  </Knopf>
                </span>
                <span className="font-normal text-text-hinweis">
                  Erlaubt sind Buchstaben, Ziffern, Bindestrich und Unterstrich, höchstens 50
                  Zeichen.
                </span>
              </label>
            )}

            <div className="flex flex-wrap items-center gap-3 sm:col-span-2">
              <Knopf type="submit" disabled={laeuft}>
                {laeuft ? "Wird gespeichert …" : "Speichern"}
              </Knopf>
              {/* `role="status"` liest der Bildschirmleser vor, ohne den Fokus zu nehmen. */}
              <span role="status" className="order-last text-sm font-semibold sm:order-none">
                {gespeichert && (
                  <span className="inline-flex items-center gap-1.5 text-primaer-dunkel">
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden="true"
                    >
                      <path d="M20 6L9 17l-5-5" />
                    </svg>
                    Gespeichert
                  </span>
                )}
              </span>
              {!neu && (
                <Knopf
                  art="gefahr"
                  onClick={() => {
                    setzeLoeschen(true);
                  }}
                >
                  Löschen
                </Knopf>
              )}
            </div>
          </form>
        </Abschnitt>

        {!neu && (
          <>
            <Fotobereich
              guid={aktuelleGuid}
              anfang={abruf.daten?.avatarDateiId ?? null}
              aufFehler={setzeFehler}
            />

            <Abschnitt titel="Pass">
              <div className="flex flex-wrap items-center gap-4">
                <Monowert wert={aktuelleGuid} />
                <a
                  href={`${ich.viewerBaseUrl}${encodeURIComponent(aktuelleGuid)}`}
                  target="_blank"
                  rel="noreferrer"
                  className="text-[13px] font-semibold text-primaer-dunkel"
                >
                  Im Viewer öffnen ↗
                </a>
              </div>
            </Abschnitt>

            <Zugangsbereich
              guid={aktuelleGuid}
              email={abruf.daten?.email ?? null}
              einwilligung={{
                einwilligungAm: abruf.daten?.einwilligungAm ?? null,
                einwilligungFassung: abruf.daten?.einwilligungFassung ?? null,
              }}
            />

            <Nachrichtenbereich guid={aktuelleGuid} />

            <BesucherExponate guid={aktuelleGuid} aufFehler={setzeFehler} />
          </>
        )}
      </Zustand>

      <Rueckfrage
        offen={loeschen}
        aufOffen={setzeLoeschen}
        titel="Besucher löschen?"
        bestaetigenText="Löschen"
        art="gefahr"
        aufBestaetigen={() => {
          void api(`/api/besucher/${String(guid)}`, { method: "DELETE" }).then(() => {
            void navigate("/besucher");
          });
        }}
      >
        <p>
          Der Besucher und seine {abruf.daten?.zuordnungen.length ?? 0} Zuordnungen werden entfernt.
          Sein Pass zeigt danach nichts mehr an.
        </p>
      </Rueckfrage>
    </>
  );
}

/**
 * Das Foto und seine Auswahl aus der Galerie, seit dem 20.10.2026.
 *
 * **Nur Galerie oder Standard**, wie am Tablet; ein eigenes Hochladen je Besucher gibt es
 * nicht. Der Server prüft das selbst (`pruefeAvatarWahl`). Nach dem Übernehmen wechselt das
 * Bild ohne Neuladen der Seite.
 */
/**
 * Die Anmeldung des Besuchers: seine E-Mail ist der Login, seit dem 23.10.2026.
 *
 * „Passwort zurücksetzen“ setzt vorerst auf das Standardpasswort zurück. Was hier später
 * genau passieren soll, ist noch offen; der Knopf steht schon, damit der Weg feststeht.
 */
/**
 * Die Nachrichten, die der Besucher selbst angelegt hat, zur Moderation: sie gehen öffentlich in
 * den Viewer, und wer etwas Unpassendes hochlädt, soll es nicht bis zum Ende der Messe dort
 * stehen haben.
 */
function Nachrichtenbereich({ guid }: { guid: string }) {
  const abruf = useAbruf<Nachricht[]>(`/api/besucher/${encodeURIComponent(guid)}/nachrichten`);
  const [zuLoeschen, setzeZuLoeschen] = useState<Nachricht | null>(null);
  const [laeuft, setzeLaeuft] = useState(false);
  const [fehler, setzeFehler] = useState<string | null>(null);
  const alle = [...(abruf.daten ?? [])].sort((a, b) => b.angelegt - a.angelegt);

  async function loesche() {
    if (zuLoeschen === null) return;
    setzeLaeuft(true);
    setzeFehler(null);
    try {
      await api(`/api/besucher/${encodeURIComponent(guid)}/nachrichten/${zuLoeschen.id}`, {
        method: "DELETE",
      });
      setzeZuLoeschen(null);
      abruf.neu();
    } catch (ursache) {
      setzeFehler(ursache instanceof ApiFehler ? ursache.message : "Löschen nicht möglich.");
    } finally {
      setzeLaeuft(false);
    }
  }

  return (
    <Abschnitt titel={<>Nachrichten ({alle.length})</>}>
      <Zustand laedt={abruf.laedt} fehler={abruf.fehler}>
        {alle.length === 0 ? (
          <p className="text-sm text-text-hinweis">Der Besucher hat keine Nachrichten angelegt.</p>
        ) : (
          <ul className="flex flex-col divide-y divide-linie">
            {alle.map((n) => (
              <li key={n.id} className="flex flex-wrap items-start gap-4 py-3">
                {n.bildDateiId !== null && (
                  <img
                    src={`/api/dateien/${n.bildDateiId}`}
                    alt=""
                    className="size-20 shrink-0 object-cover"
                  />
                )}
                <div className="flex min-w-0 flex-1 flex-col gap-1">
                  <span className="text-xs text-text-hinweis">
                    Platz {String(n.platz).padStart(2, "0")} · {zeit(n.angelegt)}
                  </span>
                  {n.titel !== null && <b className="break-words">{n.titel}</b>}
                  {n.text !== null && (
                    <p className="text-sm whitespace-pre-line text-text-zweit break-words">
                      {n.text}
                    </p>
                  )}
                </div>
                <Knopf
                  art="rand"
                  onClick={() => {
                    setzeFehler(null);
                    setzeZuLoeschen(n);
                  }}
                >
                  Löschen
                </Knopf>
              </li>
            ))}
          </ul>
        )}
      </Zustand>
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
        Die Nachricht wird mit Bild gelöscht und verschwindet aus dem Viewer. Der Besucher wird
        nicht benachrichtigt.
      </Rueckfrage>
    </Abschnitt>
  );
}

function Zugangsbereich({
  guid,
  email,
  einwilligung,
}: {
  guid: string;
  email: string | null;
  einwilligung: Einwilligung;
}) {
  const [frage, setzeFrage] = useState(false);
  const [laeuft, setzeLaeuft] = useState(false);
  const [fehler, setzeFehler] = useState<string | null>(null);
  const [erledigt, setzeErledigt] = useState(false);

  async function setzeZurueck() {
    setzeLaeuft(true);
    setzeFehler(null);
    try {
      await api(`/api/besucher/${encodeURIComponent(guid)}/passwort-zuruecksetzen`, {
        method: "POST",
      });
      setzeFrage(false);
      setzeErledigt(true);
    } catch (ursache) {
      setzeFehler(ursache instanceof ApiFehler ? ursache.message : "Zurücksetzen nicht möglich.");
    } finally {
      setzeLaeuft(false);
    }
  }

  return (
    <Abschnitt titel="Anmeldung">
      <p className="text-sm text-text-zweit">
        Der Besucher meldet sich mit seiner E-Mail an
        {email === null ? (
          ""
        ) : (
          <>
            {" "}
            (<span className="font-mono text-xs">{email}</span>)
          </>
        )}
        .
      </p>
      <p className="text-sm text-text-zweit">
        Einwilligung Datenschutz:{" "}
        {einwilligung.einwilligungAm === null ? (
          <b>liegt nicht vor</b>
        ) : (
          <b>
            erteilt am {new Date(einwilligung.einwilligungAm).toLocaleString("de-DE")} (Fassung{" "}
            {einwilligung.einwilligungFassung})
          </b>
        )}
      </p>
      <div className="flex flex-wrap items-center gap-3">
        <Knopf
          art="rand"
          onClick={() => {
            setzeErledigt(false);
            setzeFrage(true);
          }}
        >
          Passwort zurücksetzen
        </Knopf>
        <span role="status" className="text-sm font-semibold text-primaer-dunkel">
          {erledigt && "Passwort zurückgesetzt."}
        </span>
      </div>

      <Rueckfrage
        offen={frage}
        aufOffen={setzeFrage}
        titel="Passwort zurücksetzen?"
        bestaetigenText="Zurücksetzen"
        laeuft={laeuft}
        fehler={fehler}
        aufBestaetigen={() => void setzeZurueck()}
      >
        Das Passwort dieses Besuchers wird auf das Standardpasswort zurückgesetzt.
      </Rueckfrage>
    </Abschnitt>
  );
}

function Fotobereich({
  guid,
  anfang,
  aufFehler,
}: {
  guid: string;
  anfang: string | null;
  aufFehler: (text: string | null) => void;
}) {
  const [bild, setzeBild] = useState<string | null>(anfang);
  const [offen, setzeOffen] = useState(false);
  const [gewaehlt, setzeGewaehlt] = useState<string | null>(null);
  const [laeuft, setzeLaeuft] = useState(false);
  const [gespeichert, setzeGespeichert] = useState(false);
  // Die Galerie erst laden, wenn jemand auswählen will.
  const galerie = useAbruf<{ standard: string; avatare: { dateiId: string }[] }>(
    offen ? "/api/avatare" : null,
  );

  useEffect(() => {
    setzeBild(anfang);
  }, [anfang]);

  useEffect(() => {
    if (!gespeichert) return;
    const t = setTimeout(() => {
      setzeGespeichert(false);
    }, 3000);
    return () => {
      clearTimeout(t);
    };
  }, [gespeichert]);

  async function uebernehmen() {
    const ziel = gewaehlt ?? galerie.daten?.standard ?? null;
    if (ziel === null) return;
    setzeLaeuft(true);
    aufFehler(null);
    try {
      const b = await api<{ avatarDateiId: string }>(
        `/api/besucher/${encodeURIComponent(guid)}/avatar`,
        { method: "PATCH", body: JSON.stringify({ avatarDateiId: ziel }) },
      );
      setzeBild(b.avatarDateiId);
      setzeOffen(false);
      setzeGespeichert(true);
    } catch (ursache) {
      aufFehler(ursache instanceof ApiFehler ? ursache.message : "Bild nicht übernommen.");
    } finally {
      setzeLaeuft(false);
    }
  }

  const g = galerie.daten;
  return (
    <Abschnitt titel="Foto">
      <Avatarbild dateiId={bild} />
      <div className="flex flex-wrap items-center gap-3">
        <Knopf
          art="rand"
          onClick={() => {
            setzeGewaehlt(bild ?? g?.standard ?? null);
            setzeOffen(true);
          }}
        >
          Bild ändern
        </Knopf>
        <span role="status" className="text-sm font-semibold text-primaer-dunkel">
          {gespeichert && "Bild übernommen"}
        </span>
      </div>

      <Rueckfrage
        offen={offen}
        aufOffen={setzeOffen}
        titel="Bild auswählen"
        bestaetigenText="Übernehmen"
        laeuft={laeuft}
        aufBestaetigen={() => void uebernehmen()}
      >
        {g === null ? (
          <p>Wird geladen …</p>
        ) : (
          <Avatarwahl
            standard={g.standard}
            avatare={g.avatare.map((a) => a.dateiId)}
            gewaehlt={gewaehlt ?? g.standard}
            aufWahl={setzeGewaehlt}
            spalten="grid-cols-3 sm:grid-cols-4"
          />
        )}
      </Rueckfrage>
    </Abschnitt>
  );
}

/**
 * Das Foto eines Besuchers, zur Anzeige.
 *
 * Steht dort nichts, wird trotzdem ein Bild gezeigt: der Server fällt in `values` auf den
 * Standard zurück, und eine Maske, die „kein Foto" behauptet, während der Viewer eines
 * zeigt, wäre schlicht falsch.
 */
function Avatarbild({ dateiId }: { dateiId: string | null }) {
  const quelle = dateiId === null ? "/api/standard-avatar" : `/api/dateien/${dateiId}`;
  return (
    <img
      src={quelle}
      alt="Foto des Besuchers"
      className="size-40 shrink-0 rounded-full bg-grund object-cover"
    />
  );
}
