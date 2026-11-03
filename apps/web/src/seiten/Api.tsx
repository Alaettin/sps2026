import { type ReactNode, useState } from "react";
import { api, useAbruf } from "../lib/api.js";
import {
  Abschnitt,
  Fehlerhinweis,
  Feld,
  Flaeche,
  Knopf,
  Markierung,
  Monowert,
  Seitenkopf,
  Ueberschrift,
  Zustand,
} from "../bausteine/basis.js";
import { useSprache } from "../lib/sprache.js";
import { fehlertext } from "../lib/fehler.js";

/**
 * Der Bildschirm API.
 *
 * Aufbau und Erscheinung wie im Entwurf, **der Inhalt ist ersetzt**: `Api.dc.html`
 * beschreibt die „Connector API v3" mit `/identification`, `?itemId=` und Keycloak. Das ist
 * die Seite **von Axon Core**, nicht die API, die dieser Dienst liefert. Maßgeblich ist die
 * Connector-Spezifikation 1.0.0 mit ihren neun Endpunkten unter `/connector`.
 */

/** Die Zugangsangaben der Schnittstelle. */
interface Zugangsdaten {
  basisUrl: string;
  basicUser: string | null;
  basicGesetzt: boolean;
  /** Ob die Schnittstelle eine Basic-Authentifizierung verlangt. Vorgabe: nein. */
  anmeldungVerlangt: boolean;
}

interface Info extends Zugangsdaten {
  specVersion: string;
  endpunkte: Endpunkt[];
  /** Eine echte GUID aus dem Bestand, als Vorbelegung des Prüfstands. */
  beispielGuid: string | null;
}

interface Endpunkt {
  kennung: string;
  methode: "GET" | "POST";
  anzeigePfad: string;
  guid: boolean;
  rumpfVorschlag: string | null;
}

interface Ergebnis {
  status: number;
  dauerMs: number;
  contentType: string | null;
  koerper: string;
  groesse: number;
  gekuerzt: boolean;
}

export function Api() {
  const { t } = useSprache();
  const { daten, laedt, fehler, neu } = useAbruf<Info>("/api/konnektor/info");
  const [laeuft, setzeLaeuft] = useState(false);
  const [schalterFehler, setzeSchalterFehler] = useState<string | null>(null);

  /**
   * Legt den Schalter um und holt die Auskunft neu.
   *
   * **Kein eigener Zustand für die Stellung.** Sie käme sonst aus zwei Quellen, und nach
   * einem abgelehnten Aufruf stünde in der Oberfläche etwas anderes als auf dem Server.
   * Maßgeblich ist, was `/api/konnektor/info` meldet.
   */
  async function lege(pfad: string, an: boolean) {
    setzeLaeuft(true);
    setzeSchalterFehler(null);
    try {
      await api(pfad, { method: "PATCH", body: JSON.stringify({ anmeldungVerlangt: an }) });
      neu();
    } catch (ursache) {
      setzeSchalterFehler(
        fehlertext(ursache, t, [
          "Der Schalter ließ sich nicht umlegen.",
          "The switch could not be toggled.",
        ]),
      );
    } finally {
      setzeLaeuft(false);
    }
  }

  return (
    <>
      <Seitenkopf>
        <Ueberschrift>{t("API", "API")}</Ueberschrift>
      </Seitenkopf>

      <Zustand laedt={laedt} fehler={fehler}>
        {daten !== null && (
          <>
            <Zugangsblock
              titel={t("Zugang AXON Connector", "Access AXON Connector")}
              zugang={daten}
              pfadName="/connector"
              userVar="CONNECTOR_BASIC_USER"
              passwortVar="CONNECTOR_BASIC_PASSWORT"
              laeuft={laeuft}
              fehler={schalterFehler}
              aufSchalten={(an) => {
                void lege("/api/konnektor/zugang", an);
              }}
            >
              <code className="font-mono text-xs">/health</code>{" "}
              {t(
                "bleibt in beiden Stellungen anonym erreichbar, sonst meldete der Dienst sich selbst als krank.",
                "stays reachable anonymously in both positions, otherwise the service would report itself as unhealthy.",
              )}
            </Zugangsblock>

            <Abschnitt
              titel={t("Endpunkte AXON Connector", "Endpoints AXON Connector")}
              className="gap-3"
            >
              <Endpunktliste endpunkte={daten.endpunkte} beispielGuid={daten.beispielGuid} />
            </Abschnitt>
          </>
        )}
      </Zustand>
    </>
  );
}

/**
 * Der Zugang einer Schnittstelle: Basis-Adresse, Schalter, Zugangsdaten.
 */
function Zugangsblock({
  titel,
  zugang,
  pfadName,
  userVar,
  passwortVar,
  laeuft,
  fehler,
  aufSchalten,
  children,
}: {
  titel: string;
  zugang: Zugangsdaten;
  pfadName: string;
  userVar: string;
  passwortVar: string;
  laeuft: boolean;
  fehler: string | null;
  aufSchalten: (an: boolean) => void;
  children: ReactNode;
}) {
  const { t } = useSprache();
  // Ein `<section>` mit Namen: Screenreader und Abnahme finden den Block darüber.
  return (
    <Flaeche className="flex flex-col p-0">
      <section aria-label={titel} className="flex flex-col gap-5 p-6">
        <h2 className="text-lg font-semibold">{titel}</h2>

        <dl className="grid gap-x-8 gap-y-3 text-sm sm:grid-cols-[12rem_1fr]">
          <dt className="font-semibold">{t("Basis-Adresse", "Base address")}</dt>
          <dd>
            <Monowert wert={zugang.basisUrl} />
          </dd>
        </dl>

        <div className="flex flex-wrap items-start justify-between gap-4 border-t border-linie pt-5">
          <div className="flex flex-col gap-1">
            <h3 className="flex items-center gap-3 text-[15px] font-semibold">
              {t("Anmeldung verlangen", "Require sign-in")}
              {!zugang.anmeldungVerlangt && (
                <Markierung text={t("AUS", "OFF")} farbe="var(--color-fehler)" />
              )}
            </h3>
            <p className="max-w-prose text-sm text-text-zweit">
              {t(
                "Steht der Schalter an, verlangt jeder Aufruf unter",
                "When the switch is on, every request under",
              )}{" "}
              <code className="font-mono text-xs">{pfadName}</code>{" "}
              {t("eine Basic-Authentifizierung.", "requires basic authentication.")} {children}
            </p>
          </div>
          <Knopf
            art={zugang.anmeldungVerlangt ? "rand" : "primaer"}
            aria-pressed={zugang.anmeldungVerlangt}
            disabled={laeuft}
            onClick={() => {
              aufSchalten(!zugang.anmeldungVerlangt);
            }}
          >
            {zugang.anmeldungVerlangt
              ? t("Ausschalten", "Switch off")
              : t("Einschalten", "Switch on")}
          </Knopf>
        </div>

        {fehler !== null && <Fehlerhinweis>{fehler}</Fehlerhinweis>}

        {zugang.anmeldungVerlangt ? (
          <>
            <dl className="grid gap-x-8 gap-y-3 text-sm sm:grid-cols-[12rem_1fr]">
              <dt className="font-semibold">{t("Verfahren", "Method")}</dt>
              <dd className="text-text-zweit">
                {t("Basic-Authentifizierung", "Basic authentication")}
              </dd>
              <dt className="font-semibold">{t("Benutzer", "User")}</dt>
              <dd className="font-mono text-xs">
                {zugang.basicUser ?? t("nicht gesetzt", "not set")}
              </dd>
              <dt className="font-semibold">{t("Passwort", "Password")}</dt>
              <dd className="text-text-zweit">
                {/*
                  Das Passwort wird **nicht angezeigt**, auch nicht hinter der Anmeldung. Eine
                  Seite, die ein Geheimnis ausgibt, ist eine Seite, von der man Bildschirmfotos
                  macht.
                */}
                {zugang.basicGesetzt ? (
                  <>
                    {t("steht in der Umgebung unter", "is in the environment under")}{" "}
                    <code className="font-mono text-xs">{passwortVar}</code>
                  </>
                ) : (
                  <Markierung text={t("NICHT GESETZT", "NOT SET")} farbe="var(--color-fehler)" />
                )}
              </dd>
            </dl>
            {!zugang.basicGesetzt && (
              <p className="text-[13px] text-fehler">
                {t(
                  "Die Anmeldung ist verlangt, aber es sind keine Zugangsdaten gesetzt: damit ist die Schnittstelle vollständig gesperrt und niemand erreicht sie. Setze",
                  "Sign-in is required, but no credentials are set: the interface is therefore completely locked and nobody can reach it. Set",
                )}{" "}
                <code className="font-mono text-xs">{userVar}</code> {t("und", "and")}{" "}
                <code className="font-mono text-xs">{passwortVar}</code>{" "}
                {t("in der Umgebung.", "in the environment.")}
              </p>
            )}
          </>
        ) : (
          /*
           * Der Hinweis steht hier **im Klartext**, nicht als beiläufige Zeile. Die Vorgabe ist
           * aus, und wer die Seite aufmacht, soll nicht erst nachrechnen müssen, was das bedeutet.
           */
          <p className="max-w-prose text-[13px] text-fehler">
            <b>
              {t(
                "Die Schnittstelle ist ohne Anmeldung erreichbar.",
                "The interface is reachable without sign-in.",
              )}
            </b>
          </p>
        )}
      </section>
    </Flaeche>
  );
}

/** Die aufklappbaren Endpunkte. */
function Endpunktliste({
  endpunkte,
  beispielGuid,
}: {
  endpunkte: Endpunkt[];
  beispielGuid: string | null;
}) {
  return (
    <ul className="flex flex-col divide-y divide-linie border-t border-linie">
      {endpunkte.map((e) => (
        <EndpunktProbe key={e.kennung} endpunkt={e} beispielGuid={beispielGuid} />
      ))}
    </ul>
  );
}

/**
 * Ein Endpunkt zum Ausprobieren: aufklappen, Werte eintragen, senden.
 *
 * `<details>` statt eines eigenen Auf-und-Zu: Tastatur und Screenreader können das ohne
 * Zutun, und der Zustand überlebt ein erneutes Rendern der Liste.
 *
 * Gesendet wird an `/api/konnektor/probe`, **nicht** direkt an `/connector`: ist die
 * Anmeldung eingeschaltet, bräuchte der Browser die Basic-Zugangsdaten, und das Passwort
 * wird auf dieser Seite bewusst nie ausgegeben.
 */
function EndpunktProbe({
  endpunkt,
  beispielGuid,
}: {
  endpunkt: Endpunkt;
  beispielGuid: string | null;
}) {
  const { t } = useSprache();
  const [guid, setzeGuid] = useState(beispielGuid ?? "");
  const [rumpf, setzeRumpf] = useState(endpunkt.rumpfVorschlag ?? "");
  const [laeuft, setzeLaeuft] = useState(false);
  const [ergebnis, setzeErgebnis] = useState<Ergebnis | null>(null);
  const [fehler, setzeFehler] = useState<string | null>(null);

  async function sende() {
    setzeLaeuft(true);
    setzeFehler(null);
    try {
      setzeErgebnis(
        await api<Ergebnis>("/api/konnektor/probe", {
          method: "POST",
          body: JSON.stringify({ endpunkt: endpunkt.kennung, guid, rumpf }),
        }),
      );
    } catch (ursache) {
      setzeErgebnis(null);
      setzeFehler(fehlertext(ursache, t, ["Aufruf nicht möglich.", "Request not possible."]));
    } finally {
      setzeLaeuft(false);
    }
  }

  return (
    <li>
      <details className="group">
        <summary className="flex cursor-pointer list-none items-center gap-3 py-3">
          <span className="w-12 shrink-0 font-mono text-xs font-semibold">{endpunkt.methode}</span>
          <span className="min-w-0 flex-1 truncate font-mono text-xs">{endpunkt.anzeigePfad}</span>
          <span aria-hidden="true" className="text-text-hinweis group-open:hidden">
            ▸
          </span>
          <span aria-hidden="true" className="hidden text-text-hinweis group-open:inline">
            ▾
          </span>
        </summary>

        <div className="flex flex-col gap-3 pb-4">
          {endpunkt.guid && (
            <label className="flex flex-col gap-1.5 text-[13px] font-semibold">
              GUID
              <Feld
                value={guid}
                onChange={(ev) => {
                  setzeGuid(ev.target.value);
                }}
                className="max-w-[320px] font-mono text-xs"
              />
            </label>
          )}

          {endpunkt.rumpfVorschlag !== null && (
            <label className="flex flex-col gap-1.5 text-[13px] font-semibold">
              {t("Rumpf (JSON)", "Body (JSON)")}
              <textarea
                value={rumpf}
                rows={4}
                spellCheck={false}
                onChange={(ev) => {
                  setzeRumpf(ev.target.value);
                }}
                className="w-full border border-linie-feld bg-flaeche p-3 font-mono text-xs"
              />
            </label>
          )}

          <Knopf
            className="self-start"
            disabled={laeuft}
            onClick={() => {
              void sende();
            }}
          >
            {laeuft ? t("Läuft …", "Running …") : t("Senden", "Send")}
          </Knopf>

          {fehler !== null && <Fehlerhinweis>{fehler}</Fehlerhinweis>}

          {ergebnis !== null && (
            <div className="flex flex-col gap-2">
              <div className="flex flex-wrap items-center gap-3 text-[13px]">
                <Markierung
                  text={`HTTP ${String(ergebnis.status)}`}
                  farbe={
                    ergebnis.status >= 400 ? "var(--color-fehler)" : "var(--color-primaer-dunkel)"
                  }
                />
                <span className="text-text-hinweis">{ergebnis.dauerMs} ms</span>
                <span className="text-text-hinweis">{(ergebnis.groesse / 1024).toFixed(1)} KB</span>
              </div>
              {ergebnis.gekuerzt && (
                <p className="text-[13px] text-fehler">
                  {t(
                    `Die Antwort ist gekürzt dargestellt. Vollständig sind es ${(ergebnis.groesse / 1024).toFixed(1)} KB.`,
                    `The response is shown shortened. In full it is ${(ergebnis.groesse / 1024).toFixed(1)} KB.`,
                  )}
                </p>
              )}
              <pre className="max-h-80 overflow-auto bg-grund p-4 font-mono text-xs leading-relaxed">
                {huebsch(ergebnis.koerper, t("(leerer Rumpf)", "(empty body)"))}
              </pre>
            </div>
          )}
        </div>
      </details>
    </li>
  );
}

/**
 * JSON eingerückt, alles andere unverändert.
 *
 * `/health` antwortet mit leerem Rumpf, und eine gekürzte Antwort ist kein gültiges JSON
 * mehr. Beides darf die Anzeige nicht umwerfen, deshalb der Rückfall auf den Rohtext.
 */
function huebsch(text: string, leer: string): string {
  if (text.trim() === "") return leer;
  try {
    return JSON.stringify(JSON.parse(text), null, 2);
  } catch {
    return text;
  }
}
