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
import { useSprache } from "../lib/sprache.js";
import { fehlertext } from "../lib/fehler.js";
import type { Ich } from "../lib/ich.js";
import { viewerAdresse } from "../lib/pass.js";

/**
 * Der Bereich des angemeldeten Besuchers, seit dem 23.10.2026: Begrüßung, Daten ändern, Bild
 * aussuchen, Datenschutzhinweis nachlesen, seit dem 03.11.2026 Kontakte sammeln. Die GUID steht nirgends in der Adresse; der Server
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

export function MeinMenue({ ich, aufAbmelden }: { ich: Ich; aufAbmelden: () => void }) {
  const { t } = useSprache();
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
                  alt={t("Dein Bild", "Your picture")}
                  className="size-20 shrink-0 object-cover"
                />
              )}
              <div className="flex min-w-0 flex-col">
                <Ueberschrift>
                  {t("Hallo", "Hello")} {mitTitel(b.titel, b.vorname ?? "")} {b.nachname}
                </Ueberschrift>
                <span className="text-[15px] text-text-hinweis">
                  {b.firma ?? t("ohne Firma", "no company")}
                </span>
                {/* Seit dem 03.11.2026: dieselbe Adresse wie im QR-Code des Passes. */}
                <a
                  href={viewerAdresse(ich.viewerBaseUrl, b.guid)}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-1 text-[13px] font-semibold break-all text-primaer-dunkel"
                >
                  {t("Mein Viewer", "My viewer")}: {viewerAdresse(ich.viewerBaseUrl, b.guid)} ↗
                </a>
              </div>
            </Seitenkopf>

            <div className="grid gap-4 sm:grid-cols-2">
              {/* Seit dem 02.11.2026 die Haupthandlung am Stand, deshalb vorn. */}
              <Kachel
                titel={t("Exponate", "Exhibits")}
                text={t(
                  "Exponate per QR-Code scannen und deine aufgenommenen ansehen.",
                  "Scan exhibits by QR code and see the ones you have added.",
                )}
                aufKlick={() => {
                  void navigate("/mein/exponate");
                }}
              />
              <Kachel
                titel={t("Kontakte", "Contacts")}
                text={t(
                  "Pässe anderer Besucher scannen und deine Kontakte ansehen.",
                  "Scan other visitors' passes and see your contacts.",
                )}
                aufKlick={() => {
                  void navigate("/mein/kontakte");
                }}
              />
              <Kachel
                titel={t("Daten ändern", "Edit details")}
                text={t(
                  "Name, Firma, Anschrift und Kontakt.",
                  "Name, company, address and contact.",
                )}
                aufKlick={() => {
                  void navigate("/mein/stammdaten");
                }}
              />
              <Kachel
                titel={t("Bild aussuchen", "Choose picture")}
                text={t(
                  "Wähle ein Bild, das im Viewer erscheint.",
                  "Choose a picture to appear in the viewer.",
                )}
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
              {t("Datenschutzhinweis und Widerruf", "Privacy notice and withdrawal")}
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

/**
 * Die Unterseite „Exponate“, seit dem 02.11.2026: Knopf zum Scannen und die aufgenommenen
 * Exponate als einfache Liste, jedes mit Rückfrage entfernbar. Entfernt verschwindet es aus dem
 * Viewer; zurück kommt es nur durch erneutes Scannen am Exponat.
 */
export function MeinExponate({ aufAbmelden }: { aufAbmelden: () => void }) {
  const { t, datum } = useSprache();
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
      setzeFehler(fehlertext(ursache, t, ["Entfernen nicht möglich.", "Could not remove."]));
    } finally {
      setzeLaeuft(false);
    }
  }

  return (
    <Rahmen aufAbmelden={aufAbmelden}>
      <Seitenkopf>
        <Ueberschrift>{t("Exponate", "Exhibits")}</Ueberschrift>
        <Knopf
          onClick={() => {
            void navigate("/mein/scan");
          }}
        >
          {t("Exponat scannen", "Scan exhibit")}
        </Knopf>
      </Seitenkopf>

      <Abschnitt
        titel={
          <>
            {t(`Meine Exponate (${String(liste.length)})`, `My exhibits (${String(liste.length)})`)}
          </>
        }
      >
        <Zustand laedt={abruf.laedt} fehler={abruf.fehler}>
          {liste.length === 0 ? (
            <p className="text-[15px] text-text-hinweis">
              {t(
                "Noch kein Exponat aufgenommen. Scanne den QR-Code an einem Exponat.",
                "No exhibit added yet. Scan the QR code on an exhibit.",
              )}
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
                      {t("aufgenommen", "added")} {datum(e.zeitpunkt)}
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
                    {t("Entfernen", "Remove")}
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
          titel={t("Exponat entfernen?", "Remove exhibit?")}
          bestaetigenText={t("Entfernen", "Remove")}
          art="gefahr"
          laeuft={laeuft}
          fehler={fehler}
          aufBestaetigen={() => void entferne()}
        >
          <p>
            <b>
              {zuEntfernen?.kennung} {zuEntfernen?.name}
            </b>{" "}
            {t(
              "verschwindet aus deinem Messepass und deinem Viewer.",
              "will disappear from your trade fair pass and your viewer.",
            )}
          </p>
          <p>
            {t(
              "Um es wieder aufzunehmen, scanne den QR-Code am Exponat erneut.",
              "To add it again, scan the QR code on the exhibit once more.",
            )}
          </p>
        </Rueckfrage>
      </Abschnitt>

      <Knopf
        art="rand"
        className="self-start"
        onClick={() => {
          void navigate("/mein");
        }}
      >
        {t("Zurück", "Back")}
      </Knopf>
    </Rahmen>
  );
}

interface MeinKontakt {
  guid: string;
  titel: string | null;
  vorname: string;
  nachname: string;
  firma: string | null;
  zeitpunkt: number;
}

/**
 * Die Unterseite „Kontakte“, seit dem 03.11.2026, gebaut wie „Exponate“: Knopf zum Scannen,
 * die gesammelten Besucher mit Link in ihren Viewer, jeder mit Rückfrage entfernbar.
 */
export function MeinKontakte({ ich, aufAbmelden }: { ich: Ich; aufAbmelden: () => void }) {
  const { t, datum } = useSprache();
  const navigate = useNavigate();
  const abruf = useAbruf<MeinKontakt[]>("/api/mein/kontakte");
  const [zuEntfernen, setzeZuEntfernen] = useState<MeinKontakt | null>(null);
  const [laeuft, setzeLaeuft] = useState(false);
  const [fehler, setzeFehler] = useState<string | null>(null);
  const liste = abruf.daten ?? [];
  const name = (k: MeinKontakt) => `${mitTitel(k.titel, k.vorname)} ${k.nachname}`;

  async function entferne() {
    if (zuEntfernen === null) return;
    setzeLaeuft(true);
    setzeFehler(null);
    try {
      await api(`/api/mein/kontakte/${encodeURIComponent(zuEntfernen.guid)}`, {
        method: "DELETE",
      });
      setzeZuEntfernen(null);
      abruf.neu();
    } catch (ursache) {
      setzeFehler(fehlertext(ursache, t, ["Entfernen nicht möglich.", "Could not remove."]));
    } finally {
      setzeLaeuft(false);
    }
  }

  return (
    <Rahmen aufAbmelden={aufAbmelden}>
      <Seitenkopf>
        <Ueberschrift>{t("Kontakte", "Contacts")}</Ueberschrift>
        <Knopf
          onClick={() => {
            void navigate("/mein/kontakte/scan");
          }}
        >
          {t("Kontakt scannen", "Scan contact")}
        </Knopf>
      </Seitenkopf>

      <Abschnitt
        titel={
          <>
            {t(`Meine Kontakte (${String(liste.length)})`, `My contacts (${String(liste.length)})`)}
          </>
        }
      >
        <Zustand laedt={abruf.laedt} fehler={abruf.fehler}>
          {liste.length === 0 ? (
            <p className="text-[15px] text-text-hinweis">
              {t(
                "Noch kein Kontakt gespeichert. Scanne den QR-Code auf dem Pass eines anderen Besuchers.",
                "No contact saved yet. Scan the QR code on another visitor's pass.",
              )}
            </p>
          ) : (
            <ul className="flex flex-col">
              {liste.map((k) => (
                <li
                  key={k.guid}
                  className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 border-b border-linie py-3 last:border-b-0"
                >
                  <span className="flex min-w-[12rem] flex-1 flex-col">
                    <span className="text-[15px] font-semibold">{name(k)}</span>
                    {k.firma !== null && (
                      <span className="text-[14px] text-text-zweit">{k.firma}</span>
                    )}
                    <span className="text-[13px] text-text-hinweis">
                      {t("aufgenommen", "added")} {datum(k.zeitpunkt)}
                    </span>
                  </span>
                  <span className="flex items-center gap-3">
                    <a
                      href={viewerAdresse(ich.viewerBaseUrl, k.guid)}
                      target="_blank"
                      rel="noreferrer"
                      className="text-[13px] font-semibold text-primaer-dunkel"
                    >
                      {t("Viewer öffnen", "Open viewer")} ↗
                    </a>
                    <Knopf
                      art="still"
                      className="h-9 px-3 text-[13px]"
                      onClick={() => {
                        setzeFehler(null);
                        setzeZuEntfernen(k);
                      }}
                    >
                      {t("Entfernen", "Remove")}
                    </Knopf>
                  </span>
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
          titel={t("Kontakt entfernen?", "Remove contact?")}
          bestaetigenText={t("Entfernen", "Remove")}
          art="gefahr"
          laeuft={laeuft}
          fehler={fehler}
          aufBestaetigen={() => void entferne()}
        >
          <p>
            <b>{zuEntfernen !== null && name(zuEntfernen)}</b>{" "}
            {t("verschwindet aus deiner Kontaktliste.", "will disappear from your contact list.")}
          </p>
          <p>
            {t(
              "Um den Kontakt wieder aufzunehmen, scanne seinen Pass erneut.",
              "To add the contact again, scan their pass once more.",
            )}
          </p>
        </Rueckfrage>
      </Abschnitt>

      <Knopf
        art="rand"
        className="self-start"
        onClick={() => {
          void navigate("/mein");
        }}
      >
        {t("Zurück", "Back")}
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
  const { t } = useSprache();
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
        (ursache instanceof ApiFehler ? besucherFehlertext(ursache.code, t) : null) ??
          t(
            "Das Speichern hat nicht geklappt. Bitte noch einmal versuchen.",
            "Saving did not work. Please try again.",
          ),
      );
    } finally {
      setzeLaeuft(false);
    }
  }

  return (
    <Rahmen aufAbmelden={aufAbmelden}>
      <Seitenkopf>
        <Ueberschrift>{t("Deine Daten", "Your details")}</Ueberschrift>
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
                {laeuft ? t("Speichert …", "Saving …") : t("Speichern", "Save")}
              </Knopf>
              <Knopf
                art="rand"
                className="h-14 px-8 text-[17px]"
                disabled={laeuft}
                onClick={() => {
                  void navigate("/mein");
                }}
              >
                {t("Abbrechen", "Cancel")}
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
  const { t } = useSprache();
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
      setzeFehler(
        t(
          "Das Speichern hat nicht geklappt. Bitte noch einmal versuchen.",
          "Saving did not work. Please try again.",
        ),
      );
    } finally {
      setzeLaeuft(false);
    }
  }

  return (
    <Rahmen aufAbmelden={aufAbmelden}>
      <Seitenkopf>
        <Ueberschrift>{t("Dein Bild", "Your picture")}</Ueberschrift>
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
                {laeuft ? t("Speichert …", "Saving …") : t("Speichern", "Save")}
              </Knopf>
              <Knopf
                art="rand"
                className="h-14 px-8 text-[17px]"
                disabled={laeuft}
                onClick={() => {
                  void navigate("/mein");
                }}
              >
                {t("Abbrechen", "Cancel")}
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
  const { sprache, t } = useSprache();
  const navigate = useNavigate();
  const abruf = useAbruf<{ fassung: string; abschnitte: Datenschutzabschnitt[] }>(
    `/api/mein/datenschutz?sprache=${sprache}`,
  );

  return (
    <Rahmen aufAbmelden={aufAbmelden}>
      <Seitenkopf>
        <Ueberschrift>{t("Datenschutzhinweis", "Privacy notice")}</Ueberschrift>
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
        {t("Zurück", "Back")}
      </Knopf>
    </Rahmen>
  );
}
