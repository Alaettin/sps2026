import { useEffect, useState, type ChangeEvent, type ReactNode } from "react";
import { Link, useNavigate, useParams } from "react-router";
import QRCode from "qrcode";
import { ApiFehler, api, useAbruf } from "../lib/api.js";
import {
  Abschnitt,
  Fehlerhinweis,
  Feld,
  Knopf,
  knopfKlassen,
  Markierung,
  Seitenkopf,
  Ueberschrift,
  Zustand,
} from "../bausteine/basis.js";
import { Rueckfrage, Schaufenster } from "../bausteine/dialog.js";
import { KontaktFormular, type Kontakt } from "../bausteine/kontaktformular.js";
import type { Ich } from "../lib/ich.js";
import { ANSPRECHPARTNERFELDER } from "../lib/personenfelder.js";

/** Obergrenzen, dieselben wie im Modell auf dem Server. */
const MAX = { dokumente: 10, links: 10, kontakte: 5 };

/**
 * Ist das ein Bild, das sich in einem Fenster zeigen lässt?
 *
 * **Nicht `startsWith("image/")`.** `image/vnd.dwg` und `image/vnd.dxf` sind bei IANA unter
 * `image/` registriert, sind aber CAD-Zeichnungen, die kein Browser darstellt. Dieselbe
 * Regel steht serverseitig in `services/mime.ts`; sie ist hier wiederholt, weil die
 * Oberfläche sie ohne Rückfrage braucht.
 */
function istBild(mimeType: string | null): boolean {
  if (mimeType === null || !mimeType.startsWith("image/")) return false;
  return !mimeType.startsWith("image/vnd.");
}

interface Dokument {
  id: string;
  platz: number;
  titel: string;
  beschreibung: string | null;
  dateiId: string;
  mimeType: string | null;
  originalName: string | null;
  groesse: number | null;
}

interface LinkEintrag {
  id: string;
  platz: number;
  titel: string;
  url: string;
}

interface ExponatDaten {
  id: string;
  kennung: string;
  name: string;
  beschreibung: string | null;
  /** Der geheime Teil des QR-Codes, nur für den Admin. */
  scanCode?: string;
  dokumente: Dokument[];
  links: LinkEintrag[];
  kontakte: Kontakt[];
  betreuer: string[];
  /** Besucher, die dieses Exponat aufgenommen haben. */
  betroffeneBesucher: number;
}

/** Ein Symbol, das eine Adresse in einem neuen Tab öffnet. */
function OeffnenLink({ ziel, titel }: { ziel: string; titel: string }) {
  return (
    <a
      href={ziel}
      target="_blank"
      /*
       * Ein gewöhnlicher Link, **kein `window.open` mit Feature-String**: der öffnet unter
       * iOS keinen Tab. `noreferrer` hält die Adresse dieser Seite aus dem Protokoll des
       * Ziels, und sie trägt die Kennung des Exponats.
       */
      rel="noreferrer"
      aria-label={titel}
      title={titel}
      className="flex size-9 shrink-0 items-center justify-center text-text-hinweis hover:text-primaer-dunkel"
    >
      <svg
        width="17"
        height="17"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
        <path d="M15 3h6v6" />
        <path d="M10 14L21 3" />
      </svg>
    </a>
  );
}

/** Ein Symbol, das etwas in einem Fenster zeigt. */
function AnsehenKnopf({ titel, aufKlick }: { titel: string; aufKlick: () => void }) {
  return (
    <button
      type="button"
      aria-label={titel}
      title={titel}
      onClick={aufKlick}
      className="flex size-9 shrink-0 items-center justify-center text-text-hinweis hover:text-primaer-dunkel"
    >
      <svg
        width="17"
        height="17"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z" />
        <circle cx="12" cy="12" r="3" />
      </svg>
    </button>
  );
}

/**
 * Ein Exponat und seine Inhalte.
 *
 * Seit dem 02.11.2026 pflegt der **Betreuer** Dokumente, Links und Ansprechpartner seines
 * Exponats selbst; vorher scannte er hier die Pässe der Besucher. Name und Löschen des
 * Exponats bleiben beim Admin, ebenso der QR-Code, den der Besucher am Stand scannt.
 */
export function ExponatDetail({ ich }: { ich: Ich }) {
  const { id } = useParams();
  const abruf = useAbruf<ExponatDaten>(`/api/exponate/${String(id)}`);
  const [fehler, setzeFehler] = useState<string | null>(null);
  const [exponatLoeschen, setzeExponatLoeschen] = useState(false);
  const navigate = useNavigate();
  const [zuLoeschen, setzeZuLoeschen] = useState<{
    art: string;
    zielId: string;
    betroffene: number;
  } | null>(null);
  const [bildschau, setzeBildschau] = useState<{ dateiId: string; titel: string } | null>(null);
  const [kontaktschau, setzeKontaktschau] = useState<Kontakt | null>(null);
  const [kontaktBearbeiten, setzeKontaktBearbeiten] = useState<Kontakt | "neu" | null>(null);
  const [dokumentBearbeiten, setzeDokumentBearbeiten] = useState<Dokument | null>(null);
  const [linkBearbeiten, setzeLinkBearbeiten] = useState<LinkEintrag | null>(null);

  const istAdmin = ich.rolle === "admin";
  const e = abruf.daten;

  async function ladeDokumenteHoch(ereignis: ChangeEvent<HTMLInputElement>) {
    /*
     * **Erst die Liste sichern, dann das Feld leeren.** `input.value = ""` leert die
     * FileList an Ort und Stelle; wer danach darauf zugreift, schickt nichts hinaus, und
     * im Serverprotokoll fehlt der Aufruf ganz.
     */
    const dateien = Array.from(ereignis.target.files ?? []);
    ereignis.target.value = "";
    if (dateien.length === 0) return;

    setzeFehler(null);
    try {
      // Seit dem 02.11.2026 Datei und Titel in **einem** Aufruf, siehe Server.
      for (const datei of dateien) {
        const formular = new FormData();
        formular.append("titel", datei.name.replace(/\.[^.]+$/, ""));
        formular.append("datei", datei);
        await api(`/api/exponate/${String(id)}/dokumente`, { method: "POST", body: formular });
      }
    } catch (ursache) {
      setzeFehler(ursache instanceof ApiFehler ? ursache.message : "Hochladen nicht möglich.");
    } finally {
      abruf.neu();
    }
  }

  async function frageBetroffene(art: string, zielId: string) {
    try {
      const antwort = await api<{ betroffene: number }>(
        `/api/exponate/${String(id)}/inhalte/${art}/${zielId}/betroffene`,
      );
      setzeZuLoeschen({ art, zielId, betroffene: antwort.betroffene });
    } catch {
      setzeZuLoeschen({ art, zielId, betroffene: 0 });
    }
  }

  /** Eine Zeile im Abschnitt: Platz, Beschriftung, Ansehen, Bearbeiten, Entfernen. */
  function Zeile({
    platz,
    text,
    unterzeile,
    werkzeug,
    art,
    zielId,
    aufBearbeiten,
  }: {
    platz: number;
    text: string;
    unterzeile?: string;
    werkzeug?: ReactNode;
    art: "dokument" | "link" | "kontakt";
    zielId: string;
    aufBearbeiten: () => void;
  }) {
    return (
      <li className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 border-b border-linie py-2.5 text-sm last:border-b-0">
        {/* Mindestbreite, damit die Knöpfe am Handy umbrechen statt den Titel auf drei Buchstaben zu kürzen. */}
        <span className="flex min-w-[12rem] flex-1 items-center gap-3">
          <code className="shrink-0 font-mono text-xs text-text-hinweis">
            {String(platz).padStart(2, "0")}
          </code>
          <span className="flex min-w-0 flex-col">
            <span className="truncate font-medium">{text}</span>
            {unterzeile !== undefined && (
              <span className="truncate text-xs text-text-hinweis">{unterzeile}</span>
            )}
          </span>
        </span>
        <span className="flex shrink-0 flex-wrap items-center justify-end gap-1">
          {werkzeug}
          <Knopf
            art="still"
            className="h-8 px-3 text-[13px]"
            onClick={() => {
              setzeFehler(null);
              aufBearbeiten();
            }}
          >
            Bearbeiten
          </Knopf>
          <Knopf
            art="still"
            className="h-8 px-3 text-[13px]"
            onClick={() => void frageBetroffene(art, zielId)}
          >
            Entfernen
          </Knopf>
        </span>
      </li>
    );
  }

  /**
   * Ein Abschnitt mit festen Plätzen. Die Markierung „voll“ steht unter der blauen Leiste,
   * nicht darin: Rot auf Blau ist kaum zu lesen.
   */
  function Platzabschnitt({
    titel,
    anzahl,
    grenze,
    children,
    formular,
  }: {
    titel: string;
    anzahl: number;
    grenze: number;
    children: ReactNode;
    formular?: ReactNode;
  }) {
    const voll = anzahl >= grenze;
    return (
      <Abschnitt
        titel={
          <>
            {titel} ({anzahl} von {grenze})
          </>
        }
      >
        {voll && (
          <span className="self-start">
            <Markierung text="PLÄTZE VOLL" farbe="var(--color-fehler)" />
          </span>
        )}
        {anzahl === 0 ? (
          <p className="text-sm text-text-hinweis">Noch nichts hinterlegt.</p>
        ) : (
          <ul className="flex flex-col">{children}</ul>
        )}
        {!voll && formular}
        {voll && (
          <p className="text-[13px] text-text-hinweis">
            Alle {grenze} Plätze sind belegt. Erst einen freigeben, dann lässt sich wieder etwas
            hinzufügen. Die Obergrenze zu ändern verlangt ein neues Mapping in Axon.
          </p>
        )}
      </Abschnitt>
    );
  }

  return (
    <>
      <Seitenkopf>
        <Ueberschrift>{e === null ? "Exponat" : `${e.kennung} ${e.name}`}</Ueberschrift>
        <div className="flex flex-wrap items-center gap-4">
          {e !== null && istAdmin && (
            <Knopf
              art="gefahr"
              onClick={() => {
                setzeFehler(null);
                setzeExponatLoeschen(true);
              }}
            >
              Exponat löschen
            </Knopf>
          )}
          <Link to="/exponate" className="text-[13px] font-semibold text-primaer-dunkel">
            ← Zurück zur Liste
          </Link>
        </div>
      </Seitenkopf>

      <Zustand laedt={abruf.laedt} fehler={abruf.fehler}>
        {fehler !== null && <Fehlerhinweis>{fehler}</Fehlerhinweis>}

        {e !== null && (
          <>
            {istAdmin && e.scanCode !== undefined && (
              <QrAbschnitt kennung={e.kennung} code={e.scanCode} />
            )}

            <Platzabschnitt
              titel="Dokumente"
              anzahl={e.dokumente.length}
              grenze={MAX.dokumente}
              formular={
                <div className="flex flex-col gap-2 border-t border-linie pt-4">
                  {/*
                    Feld `sr-only`, Label als Knopf: neben einem sichtbaren Dateifeld setzt
                    der Browser seinen eigenen Text ("Keine Datei ausgewaehlt"), und der
                    ist mit CSS nicht erreichbar.
                  */}
                  <label className={knopfKlassen("rand", "cursor-pointer self-start")}>
                    Dokument hinzufügen
                    <input
                      type="file"
                      multiple
                      onChange={(ev) => void ladeDokumenteHoch(ev)}
                      className="sr-only"
                    />
                  </label>
                </div>
              }
            >
              {e.dokumente.map((d) => (
                <Zeile
                  key={d.id}
                  platz={d.platz}
                  text={d.titel}
                  unterzeile={d.originalName ?? undefined}
                  art="dokument"
                  zielId={d.id}
                  aufBearbeiten={() => {
                    setzeDokumentBearbeiten(d);
                  }}
                  werkzeug={
                    istBild(d.mimeType) ? (
                      <AnsehenKnopf
                        titel="Bild ansehen"
                        aufKlick={() => {
                          setzeBildschau({ dateiId: d.dateiId, titel: d.titel });
                        }}
                      />
                    ) : (
                      <OeffnenLink ziel={`/api/dateien/${d.dateiId}`} titel="In neuem Tab öffnen" />
                    )
                  }
                />
              ))}
            </Platzabschnitt>

            <Platzabschnitt
              titel="Links"
              anzahl={e.links.length}
              grenze={MAX.links}
              formular={
                <LinkFormular
                  exponatId={String(id)}
                  aufAngelegt={abruf.neu}
                  aufFehler={setzeFehler}
                />
              }
            >
              {e.links.map((l) => (
                <Zeile
                  key={l.id}
                  platz={l.platz}
                  text={l.titel}
                  unterzeile={l.url}
                  art="link"
                  zielId={l.id}
                  aufBearbeiten={() => {
                    setzeLinkBearbeiten(l);
                  }}
                  werkzeug={<OeffnenLink ziel={l.url} titel="Link in neuem Tab öffnen" />}
                />
              ))}
            </Platzabschnitt>

            <Platzabschnitt
              titel="Ansprechpartner"
              anzahl={e.kontakte.length}
              grenze={MAX.kontakte}
              formular={
                <div className="border-t border-linie pt-4">
                  <Knopf
                    onClick={() => {
                      setzeFehler(null);
                      setzeKontaktBearbeiten("neu");
                    }}
                  >
                    Ansprechpartner hinzufügen
                  </Knopf>
                </div>
              }
            >
              {e.kontakte.map((c) => (
                <Zeile
                  key={c.id}
                  platz={c.platz}
                  text={`${c.vorname} ${c.nachname}`}
                  unterzeile={[c.firma, c.position].filter(Boolean).join(" · ") || undefined}
                  art="kontakt"
                  zielId={c.id}
                  aufBearbeiten={() => {
                    setzeKontaktBearbeiten(c);
                  }}
                  werkzeug={
                    <AnsehenKnopf
                      titel="Ansprechpartner ansehen"
                      aufKlick={() => {
                        setzeKontaktschau(c);
                      }}
                    />
                  }
                />
              ))}
            </Platzabschnitt>
          </>
        )}
      </Zustand>

      {/* Bild in Groß */}
      <Schaufenster
        offen={bildschau !== null}
        aufOffen={(o) => {
          if (!o) setzeBildschau(null);
        }}
        titel={bildschau?.titel ?? "Bild"}
        breit
      >
        {bildschau !== null && (
          <img
            src={`/api/dateien/${bildschau.dateiId}`}
            alt={bildschau.titel}
            className="max-h-[70dvh] w-full bg-grund object-contain"
          />
        )}
      </Schaufenster>

      {/* Ansprechpartner im Detail */}
      <Schaufenster
        offen={kontaktschau !== null}
        aufOffen={(o) => {
          if (!o) setzeKontaktschau(null);
        }}
        titel={
          kontaktschau === null
            ? "Ansprechpartner"
            : `${kontaktschau.vorname} ${kontaktschau.nachname}`
        }
      >
        {kontaktschau !== null && (
          <div className="flex flex-col gap-5">
            {/* Kein Foto: Ansprechpartner tragen seit dem 08.10.2026 keines mehr. */}
            <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-[8rem_1fr]">
              {ANSPRECHPARTNERFELDER.map((f) => {
                const wert = kontaktschau[f.name];
                if (typeof wert !== "string" || wert === "") return null;
                return (
                  <div key={f.name} className="contents">
                    <dt className="font-semibold">{f.text}</dt>
                    <dd className="break-words text-text-zweit">{wert}</dd>
                  </div>
                );
              })}
            </dl>
          </div>
        )}
      </Schaufenster>

      <KontaktFormular
        exponatId={String(id)}
        kontakt={kontaktBearbeiten}
        aufSchliessen={() => {
          setzeKontaktBearbeiten(null);
        }}
        aufGespeichert={abruf.neu}
      />

      <DokumentFormular
        exponatId={String(id)}
        dokument={dokumentBearbeiten}
        aufSchliessen={() => {
          setzeDokumentBearbeiten(null);
        }}
        aufGespeichert={abruf.neu}
      />

      <LinkBearbeiten
        exponatId={String(id)}
        link={linkBearbeiten}
        aufSchliessen={() => {
          setzeLinkBearbeiten(null);
        }}
        aufGespeichert={abruf.neu}
      />

      <Rueckfrage
        offen={zuLoeschen !== null}
        aufOffen={(o) => {
          if (!o) setzeZuLoeschen(null);
        }}
        titel="Inhalt entfernen?"
        bestaetigenText="Entfernen"
        art="gefahr"
        aufBestaetigen={() => {
          if (zuLoeschen === null) return;
          void api(`/api/exponate/${String(id)}/inhalte/${zuLoeschen.art}/${zuLoeschen.zielId}`, {
            method: "DELETE",
          })
            .catch((u: unknown) => {
              setzeFehler(u instanceof ApiFehler ? u.message : "Entfernen nicht möglich.");
            })
            .finally(() => {
              setzeZuLoeschen(null);
              abruf.neu();
            });
        }}
      >
        <p>
          {zuLoeschen !== null && zuLoeschen.betroffene > 0 ? (
            <>
              <b>{zuLoeschen.betroffene} Besucher</b> haben dieses Exponat aufgenommen. Der Inhalt
              verschwindet auch bei ihnen aus dem Viewer.
            </>
          ) : (
            "Noch kein Besucher hat dieses Exponat aufgenommen."
          )}
        </p>
        <p>Der Platz wird frei und beim nächsten Hinzufügen wieder vergeben.</p>
      </Rueckfrage>

      {/*
        **Das ganze Exponat.** Mit Tippwort, und das Tippwort ist die Kennung: der Vorgang
        ist nicht umkehrbar und trifft Besucher, nicht nur den Bestand. Die Rückfrage nennt
        Zahlen statt "sind Sie sicher"; eine Warnung ohne Zahl ist eine Behauptung.
      */}
      {e !== null && (
        <Rueckfrage
          offen={exponatLoeschen}
          aufOffen={setzeExponatLoeschen}
          titel="Exponat löschen?"
          bestaetigenText="Endgültig löschen"
          art="gefahr"
          tippwort={e.kennung}
          aufBestaetigen={() => {
            void api(`/api/exponate/${String(id)}`, { method: "DELETE" })
              .then(() => {
                setzeExponatLoeschen(false);
                void navigate("/exponate");
              })
              .catch((ursache: unknown) => {
                setzeExponatLoeschen(false);
                setzeFehler(
                  ursache instanceof ApiFehler
                    ? ursache.message
                    : "Das Exponat ließ sich nicht löschen.",
                );
              });
          }}
        >
          <p>
            <b>
              {e.kennung} {e.name}
            </b>{" "}
            verschwindet mit allem, was daran hängt: {e.dokumente.length} Dokumente,{" "}
            {e.links.length} Links und {e.kontakte.length} Ansprechpartner.
          </p>
          <p>
            {e.betroffeneBesucher > 0 ? (
              <>
                <b>{e.betroffeneBesucher} Besucher</b> haben es aufgenommen. Es verschwindet auch
                bei ihnen aus dem Viewer.
              </>
            ) : (
              "Bisher hat kein Besucher dieses Exponat aufgenommen."
            )}
          </p>
        </Rueckfrage>
      )}
    </>
  );
}

/**
 * Der QR-Code, den der Besucher am Stand scannt, nur für den Admin.
 *
 * Inhalt ist eine **Adresse dieser App** (`/mein/scan/<code>`), keine nackte Zeichenfolge:
 * so öffnet ihn auch die gewöhnliche Kamera-App eines Handys, und nach der Anmeldung ist das
 * Exponat aufgenommen. Die Adresse kommt aus `window.location.origin`, also von dort, wo der
 * Admin die App gerade aufruft; gedruckt wird deshalb aus der Produktivumgebung.
 */
function QrAbschnitt({ kennung, code }: { kennung: string; code: string }) {
  const adresse = `${window.location.origin}/mein/scan/${code}`;
  const [bild, setzeBild] = useState<string | null>(null);

  useEffect(() => {
    let aktuell = true;
    void QRCode.toDataURL(adresse, { width: 1024, margin: 2, errorCorrectionLevel: "M" }).then(
      (url) => {
        if (aktuell) setzeBild(url);
      },
    );
    return () => {
      aktuell = false;
    };
  }, [adresse]);

  async function svgLaden() {
    const svg = await QRCode.toString(adresse, {
      type: "svg",
      margin: 2,
      errorCorrectionLevel: "M",
    });
    const url = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `QR ${kennung}.svg`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <Abschnitt titel="QR-Code für Besucher">
      <div className="flex flex-wrap items-start gap-6">
        {bild !== null && (
          <img
            src={bild}
            alt={`QR-Code von ${kennung}`}
            className="size-40 shrink-0 border border-linie bg-white"
          />
        )}
        <div className="flex min-w-0 flex-1 flex-col gap-3 text-sm">
          <p className="text-text-zweit">
            Am Exponat aushängen. Besucher scannen ihn nach der Anmeldung und nehmen das Exponat mit
            allen Dokumenten, Links und Ansprechpartnern in ihren Pass auf.
          </p>
          <p className="break-all font-mono text-xs text-text-hinweis">{adresse}</p>
          <div className="flex flex-wrap gap-3">
            {bild !== null && (
              <a href={bild} download={`QR ${kennung}.png`} className={knopfKlassen("rand")}>
                PNG laden
              </a>
            )}
            <Knopf art="rand" onClick={() => void svgLaden()}>
              SVG laden
            </Knopf>
          </div>
        </div>
      </div>
    </Abschnitt>
  );
}

/** Titel, Beschreibung und auf Wunsch eine neue Datei. Der Platz bleibt. */
function DokumentFormular({
  exponatId,
  dokument,
  aufSchliessen,
  aufGespeichert,
}: {
  exponatId: string;
  dokument: Dokument | null;
  aufSchliessen: () => void;
  aufGespeichert: () => void;
}) {
  const [titel, setzeTitel] = useState("");
  const [beschreibung, setzeBeschreibung] = useState("");
  const [datei, setzeDatei] = useState<File | null>(null);
  const [fehler, setzeFehler] = useState<string | null>(null);
  const [laeuft, setzeLaeuft] = useState(false);

  useEffect(() => {
    if (dokument === null) return;
    setzeTitel(dokument.titel);
    setzeBeschreibung(dokument.beschreibung ?? "");
    setzeDatei(null);
    setzeFehler(null);
  }, [dokument]);

  async function speichern() {
    if (dokument === null) return;
    setzeLaeuft(true);
    setzeFehler(null);
    try {
      const formular = new FormData();
      formular.append("titel", titel);
      formular.append("beschreibung", beschreibung);
      if (datei !== null) formular.append("datei", datei);
      await api(`/api/exponate/${exponatId}/dokumente/${dokument.id}`, {
        method: "PATCH",
        body: formular,
      });
      aufGespeichert();
      aufSchliessen();
    } catch (ursache) {
      setzeFehler(ursache instanceof ApiFehler ? ursache.message : "Speichern nicht möglich.");
    } finally {
      setzeLaeuft(false);
    }
  }

  return (
    <Schaufenster
      offen={dokument !== null}
      aufOffen={(o) => {
        if (!o) aufSchliessen();
      }}
      titel="Dokument bearbeiten"
    >
      {fehler !== null && <Fehlerhinweis>{fehler}</Fehlerhinweis>}
      <form
        className="flex flex-col gap-4"
        onSubmit={(ev) => {
          ev.preventDefault();
          void speichern();
        }}
      >
        <label className="flex flex-col gap-2 text-[13px] font-semibold">
          Titel
          <Feld
            required
            value={titel}
            onChange={(ev) => {
              setzeTitel(ev.target.value);
            }}
          />
        </label>
        <label className="flex flex-col gap-2 text-[13px] font-semibold">
          Beschreibung
          <Feld
            value={beschreibung}
            onChange={(ev) => {
              setzeBeschreibung(ev.target.value);
            }}
          />
        </label>
        <div className="flex flex-col gap-2 text-[13px]">
          <span className="font-semibold">Datei</span>
          <span className="text-text-hinweis">
            {datei !== null ? `Neu: ${datei.name}` : (dokument?.originalName ?? "ohne Datei")}
          </span>
          {/* Feld `sr-only`, Label als Knopf, wie beim Hinzufügen. */}
          <label className={knopfKlassen("rand", "cursor-pointer self-start")}>
            Datei ersetzen
            <input
              type="file"
              onChange={(ev) => {
                setzeDatei(ev.target.files?.[0] ?? null);
              }}
              className="sr-only"
            />
          </label>
        </div>
        <div className="flex flex-wrap justify-end gap-3">
          <Knopf art="rand" onClick={aufSchliessen} disabled={laeuft}>
            Abbrechen
          </Knopf>
          <Knopf type="submit" disabled={titel.trim() === "" || laeuft}>
            {laeuft ? "Wird gespeichert …" : "Speichern"}
          </Knopf>
        </div>
      </form>
    </Schaufenster>
  );
}

/** Titel und Adresse eines vorhandenen Links. Der Platz bleibt. */
function LinkBearbeiten({
  exponatId,
  link,
  aufSchliessen,
  aufGespeichert,
}: {
  exponatId: string;
  link: LinkEintrag | null;
  aufSchliessen: () => void;
  aufGespeichert: () => void;
}) {
  const [titel, setzeTitel] = useState("");
  const [url, setzeUrl] = useState("");
  const [fehler, setzeFehler] = useState<string | null>(null);
  const [laeuft, setzeLaeuft] = useState(false);

  useEffect(() => {
    if (link === null) return;
    setzeTitel(link.titel);
    setzeUrl(link.url);
    setzeFehler(null);
  }, [link]);

  return (
    <Schaufenster
      offen={link !== null}
      aufOffen={(o) => {
        if (!o) aufSchliessen();
      }}
      titel="Link bearbeiten"
    >
      {fehler !== null && <Fehlerhinweis>{fehler}</Fehlerhinweis>}
      <form
        className="flex flex-col gap-4"
        onSubmit={(ev) => {
          ev.preventDefault();
          if (link === null) return;
          setzeLaeuft(true);
          setzeFehler(null);
          void api(`/api/exponate/${exponatId}/links/${link.id}`, {
            method: "PATCH",
            body: JSON.stringify({ titel, url }),
          })
            .then(() => {
              aufGespeichert();
              aufSchliessen();
            })
            .catch((u: unknown) => {
              setzeFehler(u instanceof ApiFehler ? u.message : "Speichern nicht möglich.");
            })
            .finally(() => {
              setzeLaeuft(false);
            });
        }}
      >
        <label className="flex flex-col gap-2 text-[13px] font-semibold">
          Titel
          <Feld
            required
            value={titel}
            onChange={(ev) => {
              setzeTitel(ev.target.value);
            }}
          />
        </label>
        <label className="flex flex-col gap-2 text-[13px] font-semibold">
          Adresse
          <Feld
            required
            type="url"
            value={url}
            onChange={(ev) => {
              setzeUrl(ev.target.value);
            }}
          />
        </label>
        <div className="flex flex-wrap justify-end gap-3">
          <Knopf art="rand" onClick={aufSchliessen} disabled={laeuft}>
            Abbrechen
          </Knopf>
          <Knopf type="submit" disabled={laeuft}>
            {laeuft ? "Wird gespeichert …" : "Speichern"}
          </Knopf>
        </div>
      </form>
    </Schaufenster>
  );
}

/** Titel und Adresse, direkt im Abschnitt. Zwei Felder brauchen kein eigenes Fenster. */
function LinkFormular({
  exponatId,
  aufAngelegt,
  aufFehler,
}: {
  exponatId: string;
  aufAngelegt: () => void;
  aufFehler: (text: string | null) => void;
}) {
  const [titel, setzeTitel] = useState("");
  const [url, setzeUrl] = useState("");
  const [laeuft, setzeLaeuft] = useState(false);

  return (
    <form
      className="flex flex-wrap items-end gap-3 border-t border-linie pt-4"
      onSubmit={(ev) => {
        ev.preventDefault();
        aufFehler(null);
        setzeLaeuft(true);
        void api(`/api/exponate/${exponatId}/links`, {
          method: "POST",
          body: JSON.stringify({ titel, url }),
        })
          .then(() => {
            setzeTitel("");
            setzeUrl("");
            aufAngelegt();
          })
          .catch((u: unknown) => {
            aufFehler(u instanceof ApiFehler ? u.message : "Link ließ sich nicht anlegen.");
          })
          .finally(() => {
            setzeLaeuft(false);
          });
      }}
    >
      <label className="flex min-w-[12rem] flex-1 flex-col gap-2 text-[13px] font-semibold">
        Titel
        <Feld
          required
          value={titel}
          onChange={(ev) => {
            setzeTitel(ev.target.value);
          }}
          placeholder="Produktseite"
        />
      </label>
      <label className="flex min-w-[16rem] flex-[2] flex-col gap-2 text-[13px] font-semibold">
        Adresse
        <Feld
          required
          type="url"
          value={url}
          onChange={(ev) => {
            setzeUrl(ev.target.value);
          }}
          placeholder="https://"
        />
      </label>
      <Knopf type="submit" disabled={laeuft}>
        {laeuft ? "Wird angelegt …" : "Link hinzufügen"}
      </Knopf>
    </form>
  );
}
