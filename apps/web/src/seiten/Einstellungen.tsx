import { useState } from "react";
import { api, leseSchalter, setzeSchalter, useAbruf } from "../lib/api.js";
import {
  Abschnitt,
  Fehlerhinweis,
  Feld,
  Flaeche,
  Knopf,
  Markierung,
  Seitenkopf,
  Ueberschrift,
  Zustand,
} from "../bausteine/basis.js";
import { Avatarverwaltung } from "./Avatarverwaltung.js";
import { Sicherung } from "./Sicherung.js";
import { Rueckfrage } from "../bausteine/dialog.js";
import type { Ich } from "../lib/ich.js";
import { useSprache } from "../lib/sprache.js";
import { fehlertext } from "../lib/fehler.js";

/**
 * Einstellungen mit Entwicklermodus.
 *
 * **Der Schalter ist eine Bequemlichkeit je Browser, keine Sicherheitsgrenze.** Er blendet
 * die beiden Knoepfe ein und aus; beide Endpunkte dahinter verlangen serverseitig die
 * Admin-Rolle, und daran aendert der Schalter nichts. Wer die Adresse kennt, kaeme sonst
 * ohne Rolle an das Zuruecksetzen.
 */

const SCHALTER = "passport.entwicklermodus";

interface Bestand {
  besucher: number;
  exponate: number;
  dokumente: number;
  links: number;
  kontakte: number;
  besuche: number;
  dateien: number;
  abrufe: number;
  globaleDaten: number;
  appNutzer: number;
  avatare: number;
  kiAvatare: number;
}

interface KonnektorInfo {
  basisUrl: string;
  basicUser: string | null;
  basicGesetzt: boolean;
  viewerBaseUrl: string;
  viewerAusUmgebung: boolean;
  specVersion: string;
  modell: { datenpunkte: number; jeBesucher: number; exponate: number };
}

export function Einstellungen({
  ich,
  aufIchGeaendert,
}: {
  ich: Ich;
  /** Holt `/api/auth/ich` neu, damit Terminal und Besucherdetail die neue Viewer-Adresse sehen. */
  aufIchGeaendert: () => void;
}) {
  const { t } = useSprache();
  // Nur beim ersten Rendern aus dem Speicher lesen; danach ist der Zustand hier die
  // Wahrheit und wird beim Umschalten zurueckgeschrieben.
  const [entwickler, setzeEntwickler] = useState(() => leseSchalter(SCHALTER));

  const bestand = useAbruf<Bestand>(entwickler ? "/api/entwickler/bestand" : null);
  const info = useAbruf<KonnektorInfo>("/api/konnektor/info");

  const [dialog, setzeDialog] = useState<"aussaat" | "reset" | null>(null);
  const [laeuft, setzeLaeuft] = useState(false);
  const [fehler, setzeFehler] = useState<string | null>(null);
  const [meldung, setzeMeldung] = useState<string | null>(null);

  async function fuehreAus(was: "aussaat" | "reset") {
    setzeLaeuft(true);
    setzeFehler(null);
    try {
      if (was === "aussaat") {
        const e = await api<{
          exponate: number;
          besucher: number;
          besuche: number;
        }>("/api/aussaat", { method: "POST" });
        setzeMeldung(
          t(
            `Testdaten eingespielt: ${String(e.exponate)} Exponate, ${String(e.besucher)} Besucher, ${String(e.besuche)} aufgenommene Exponate.`,
            `Test data loaded: ${String(e.exponate)} exhibits, ${String(e.besucher)} visitors, ${String(e.besuche)} added exhibits.`,
          ),
        );
      } else {
        const e = await api<{ geloescht: Bestand }>("/api/entwickler/zuruecksetzen", {
          method: "POST",
          body: JSON.stringify({ bestaetigung: "ZURUECKSETZEN" }),
        });
        setzeMeldung(
          t(
            `Zurückgesetzt: ${String(e.geloescht.besucher)} Besucher, ${String(e.geloescht.exponate)} Exponate, ${String(e.geloescht.dateien)} Dateien entfernt. Die Anmeldungen sind geblieben.`,
            `Reset: ${String(e.geloescht.besucher)} visitors, ${String(e.geloescht.exponate)} exhibits, ${String(e.geloescht.dateien)} files removed. The sign-ins remain.`,
          ),
        );
      }
      setzeDialog(null);
      bestand.neu();
      info.neu();
    } catch (ursache) {
      setzeFehler(
        fehlertext(ursache, t, [
          "Der Aufruf ist nicht durchgekommen.",
          "The request did not go through.",
        ]),
      );
    } finally {
      setzeLaeuft(false);
    }
  }

  const b = bestand.daten;
  // Galerie und Standardbild bleiben beim Zuruecksetzen; geloescht wird der Rest.
  const geloeschteDateien = Math.max(0, (b?.dateien ?? 0) - (b?.avatare ?? 0) - 1);
  const leer = b !== null && b.besucher === 0 && b.exponate === 0;

  return (
    <>
      <Seitenkopf>
        <Ueberschrift>{t("Einstellungen", "Settings")}</Ueberschrift>
      </Seitenkopf>

      {meldung !== null && (
        <div
          role="status"
          className="flex items-center gap-2.5 bg-primaer-dunkel/10 px-3.5 py-3 text-sm font-medium"
        >
          <span className="size-2 shrink-0 rounded-full bg-primaer-dunkel" aria-hidden="true" />
          {meldung}
        </div>
      )}

      <Abschnitt titel={t("Diese Instanz", "This instance")}>
        <Zustand laedt={info.laedt} fehler={info.fehler}>
          <dl className="grid gap-x-8 gap-y-3 text-sm sm:grid-cols-[14rem_1fr]">
            <dt className="font-semibold">{t("Angezeigter Name", "Display name")}</dt>
            <dd className="text-text-zweit">
              {ich.appName === "" ? "IDTA Passport" : ich.appName}
            </dd>
            <dt className="font-semibold">
              {t("Konnektor-Spezifikation", "Connector specification")}
            </dt>
            <dd className="text-text-zweit">{info.daten?.specVersion}</dd>
            <dt className="font-semibold">
              {t("Datenpunkte im Modell", "Data points in the model")}
            </dt>
            <dd className="text-text-zweit">
              {info.daten?.modell.datenpunkte} {t("bei", "with")} {info.daten?.modell.exponate}{" "}
              {t("Exponaten", "exhibits")}
            </dd>
          </dl>
        </Zustand>
      </Abschnitt>

      {info.daten !== null && (
        <ViewerEinstellung
          // Nach dem Speichern neu vorbelegen: der Schluessel wechselt mit dem Wert.
          key={`${info.daten.viewerBaseUrl}|${String(info.daten.viewerAusUmgebung)}`}
          url={info.daten.viewerBaseUrl}
          ausUmgebung={info.daten.viewerAusUmgebung}
          aufGespeichert={() => {
            info.neu();
            aufIchGeaendert();
          }}
        />
      )}

      <Avatarverwaltung />

      <Sicherung />

      <Flaeche className="flex flex-col gap-5 p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex flex-col gap-1">
            <h2 className="flex items-center gap-3 text-lg font-semibold">
              {t("Entwicklermodus", "Developer mode")}
              {entwickler && <Markierung text={t("AKTIV", "ACTIVE")} farbe="var(--color-fehler)" />}
            </h2>
            <p className="max-w-prose text-sm text-text-zweit">
              {t(
                "Blendet Werkzeuge zum Befüllen und Leeren der Datenbank ein. Die Einstellung gilt nur in diesem Browser und ersetzt keine Berechtigung: beide Aufrufe verlangen auf dem Server die Admin-Rolle.",
                "Shows tools to fill and empty the database. The setting only applies in this browser and grants no permission: both requests require the admin role on the server.",
              )}
            </p>
          </div>
          <Knopf
            art={entwickler ? "rand" : "primaer"}
            aria-pressed={entwickler}
            onClick={() => {
              const neu = !entwickler;
              setzeEntwickler(neu);
              setzeSchalter(SCHALTER, neu);
              setzeMeldung(null);
            }}
          >
            {entwickler ? t("Ausschalten", "Switch off") : t("Einschalten", "Switch on")}
          </Knopf>
        </div>

        {entwickler && (
          <div className="flex flex-col gap-5 border-t border-linie pt-5">
            <Zustand laedt={bestand.laedt} fehler={bestand.fehler}>
              <dl className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm sm:grid-cols-4">
                {[
                  [t("Besucher", "Visitors"), b?.besucher],
                  [t("Exponate", "Exhibits"), b?.exponate],
                  [t("Aufgenommene Exponate", "Added exhibits"), b?.besuche],
                  [t("Dateien", "Files"), b?.dateien],
                ].map(([text, zahl]) => (
                  <div key={String(text)} className="flex flex-col">
                    <dt className="text-[11px] font-semibold tracking-[0.08em] text-text-hinweis uppercase">
                      {text}
                    </dt>
                    <dd className="text-2xl font-medium text-primaer">{zahl ?? 0}</dd>
                  </div>
                ))}
              </dl>
            </Zustand>

            <div className="flex flex-wrap gap-3">
              <Knopf
                onClick={() => {
                  setzeFehler(null);
                  setzeDialog("aussaat");
                }}
                disabled={b !== null && !leer}
                title={
                  b !== null && !leer
                    ? t("Es sind bereits Daten vorhanden", "Data already exists")
                    : undefined
                }
              >
                {t("Testdaten einspielen", "Load test data")}
              </Knopf>
              <Knopf
                art="gefahr"
                onClick={() => {
                  setzeFehler(null);
                  setzeDialog("reset");
                }}
                disabled={leer}
              >
                {t("Alles zurücksetzen", "Reset everything")}
              </Knopf>
            </div>

            {b !== null && !leer && (
              <p className="text-[13px] text-text-hinweis">
                {t(
                  "Testdaten lassen sich nur auf einen leeren Bestand einspielen. Erst zurücksetzen.",
                  "Test data can only be loaded into an empty database. Reset first.",
                )}
              </p>
            )}
          </div>
        )}
      </Flaeche>

      <Rueckfrage
        offen={dialog === "aussaat"}
        aufOffen={(o) => {
          if (!o) setzeDialog(null);
        }}
        titel={t("Testdaten einspielen?", "Load test data?")}
        bestaetigenText={t("Einspielen", "Load")}
        laeuft={laeuft}
        fehler={fehler}
        aufBestaetigen={() => void fuehreAus("aussaat")}
      >
        <p>
          {t(
            "Angelegt werden 6 Exponate mit Dokumenten, Links und Ansprechpartnern, dazu 50 Besucher, von denen jeder dritte ein Exponat aufgenommen hat.",
            "6 exhibits with documents, links and contacts are created, plus 50 visitors, every third of whom has added an exhibit.",
          )}
        </p>
        <p>
          {t(
            "Die Daten sind erfunden und nur für Entwicklung und Abnahme gedacht. Sie erscheinen danach auch im Viewer, sobald der Konnektor in Axon eingetragen ist.",
            "The data is made up and intended only for development and acceptance testing. It will also appear in the viewer once the connector is registered in Axon.",
          )}
        </p>
      </Rueckfrage>

      <Rueckfrage
        offen={dialog === "reset"}
        aufOffen={(o) => {
          if (!o) setzeDialog(null);
        }}
        titel={t("Wirklich alles zurücksetzen?", "Really reset everything?")}
        bestaetigenText={t("Endgültig löschen", "Delete permanently")}
        art="gefahr"
        tippwort="ZURUECKSETZEN"
        laeuft={laeuft}
        fehler={fehler}
        aufBestaetigen={() => void fuehreAus("reset")}
      >
        {/*
          Die Rueckfrage **nennt die Zahlen**. Ein "Sind Sie sicher?" klickt man weg; was
          verschwindet, soll dastehen.
        */}
        <p>{t("Gelöscht werden unwiderruflich:", "The following will be deleted irrevocably:")}</p>
        <ul className="list-disc pl-5">
          <li>
            <b>{b?.besucher ?? 0}</b> {t("Besucher samt Fotos", "visitors including photos")}
          </li>
          <li>
            <b>{b?.exponate ?? 0}</b>{" "}
            {t(
              `Exponate mit ${String(b?.dokumente ?? 0)} Dokumenten, ${String(b?.links ?? 0)} Links und ${String(b?.kontakte ?? 0)} Ansprechpartnern`,
              `exhibits with ${String(b?.dokumente ?? 0)} documents, ${String(b?.links ?? 0)} links and ${String(b?.kontakte ?? 0)} contacts`,
            )}
          </li>
          <li>
            <b>{b?.besuche ?? 0}</b>{" "}
            {t(
              `aufgenommene Exponate und ${String(geloeschteDateien)} hochgeladene Dateien`,
              `added exhibits and ${String(geloeschteDateien)} uploaded files`,
            )}
          </li>
          <li>
            {t("die Abrufzähler für", "the request counters for")} <b>{b?.abrufe ?? 0}</b> GUIDs
          </li>
          <li>
            <b>{b?.globaleDaten ?? 0}</b> {t("globale Datenpunkte", "global data points")}
          </li>
        </ul>
        <p>
          <b>
            {t(
              `Die ${String(b?.appNutzer ?? 0)} Anmeldungen bleiben erhalten`,
              `The ${String(b?.appNutzer ?? 0)} sign-ins remain`,
            )}
          </b>
          {t(
            ", sonst käme danach niemand mehr hinein.",
            ", otherwise nobody could get in afterwards.",
          )}
        </p>
        {/* Seit dem 04.11.2026: die Auswahl wächst mit jedem KI-Bild und übersteht den Reset. */}
        <p>
          <b>
            {t(
              `Die Avatarauswahl mit ${String(b?.avatare ?? 0)} Bildern bleibt erhalten`,
              `The avatar selection with ${String(b?.avatare ?? 0)} pictures remains`,
            )}
          </b>
          {t(
            `, davon ${String(b?.kiAvatare ?? 0)} mit KI erstellt.`,
            `, ${String(b?.kiAvatare ?? 0)} of them created with AI.`,
          )}
        </p>
      </Rueckfrage>
    </>
  );
}

/**
 * Die Viewer-Adresse, seit dem 03.11.2026 hier statt nur in `VIEWER_BASE_URL`. Der Server
 * prüft und speichert sie (`services/einstellungen.ts`); leer gespeichert gilt wieder die
 * Umgebung.
 */
function ViewerEinstellung({
  url,
  ausUmgebung,
  aufGespeichert,
}: {
  url: string;
  ausUmgebung: boolean;
  aufGespeichert: () => void;
}) {
  const { t } = useSprache();
  const [entwurf, setzeEntwurf] = useState(url);
  const [laeuft, setzeLaeuft] = useState(false);
  const [fehler, setzeFehler] = useState<string | null>(null);

  async function speichere(wert: string) {
    setzeLaeuft(true);
    setzeFehler(null);
    try {
      await api("/api/einstellungen/viewer", {
        method: "PATCH",
        body: JSON.stringify({ url: wert }),
      });
      aufGespeichert();
    } catch (ursache) {
      setzeFehler(fehlertext(ursache, t, ["Speichern nicht möglich.", "Could not save."]));
    } finally {
      setzeLaeuft(false);
    }
  }

  return (
    <Abschnitt titel={t("Viewer", "Viewer")}>
      <form
        className="flex flex-col gap-3"
        onSubmit={(ev) => {
          ev.preventDefault();
          void speichere(entwurf);
        }}
      >
        <label className="flex flex-col gap-2 text-[13px] font-semibold">
          {t("Adresse des Viewers", "Viewer address")}
          <Feld
            type="url"
            value={entwurf}
            onChange={(ev) => {
              setzeEntwurf(ev.target.value);
            }}
            className="font-mono text-sm font-normal"
            spellCheck={false}
            autoComplete="off"
          />
        </label>
        <p className="text-[13px] text-text-hinweis">
          {ausUmgebung
            ? t(
                "Kommt aus der Umgebung (VIEWER_BASE_URL). Ein hier gespeicherter Wert geht vor.",
                "Comes from the environment (VIEWER_BASE_URL). A value saved here takes precedence.",
              )
            : t("In den Einstellungen gesetzt.", "Set in the settings.")}{" "}
          {t(
            "Die Pässe tragen diese Adresse plus GUID im QR-Code; das Terminal erkennt nur Pässe mit dieser Adresse. Schon gedruckte Pässe mit einer anderen Adresse lassen sich am Terminal weiter per Passnummer eingeben.",
            "Passes carry this address plus GUID in their QR code; the terminal only recognises passes with this address. Passes already printed with a different address can still be entered by pass number at the terminal.",
          )}
        </p>
        {fehler !== null && <Fehlerhinweis>{fehler}</Fehlerhinweis>}
        <div className="flex flex-wrap gap-3">
          <Knopf type="submit" disabled={laeuft || entwurf.trim() === "" || entwurf.trim() === url}>
            {laeuft ? t("Wird gespeichert …", "Saving …") : t("Speichern", "Save")}
          </Knopf>
          {!ausUmgebung && (
            <Knopf
              art="rand"
              disabled={laeuft}
              onClick={() => {
                void speichere("");
              }}
            >
              {t("Auf Vorgabe zurücksetzen", "Reset to default")}
            </Knopf>
          )}
        </div>
      </form>
    </Abschnitt>
  );
}
