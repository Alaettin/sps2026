import { useCallback, useEffect, useState } from "react";
import { BrowserRouter, Navigate, Route, Routes, useLocation } from "react-router";
import { api } from "./lib/api.js";
import type { Ich } from "./lib/ich.js";
import { Rahmen } from "./layout/Rahmen.js";
import { Anmeldung } from "./seiten/Anmeldung.js";
import { dtiWeiter } from "./lib/weiter.js";
import { Api } from "./seiten/Api.js";
import { GlobaleDaten } from "./seiten/GlobaleDaten.js";
import { Besucher } from "./seiten/Besucher.js";
import { BesucherDetail } from "./seiten/BesucherDetail.js";
import { Dashboard } from "./seiten/Dashboard.js";
import { Einstellungen } from "./seiten/Einstellungen.js";
import { Monitoring } from "./seiten/Monitoring.js";
import { KioskRegistrierung, KioskScan } from "./kiosk/Kiosk.js";
import {
  MeinAvatar,
  MeinExponate,
  MeinKontakte,
  MeinMenue,
  MeinStammdaten,
} from "./besucher/Mein.js";
import { MeinExponatScan } from "./besucher/ExponatScan.js";
import { MeinKontaktScan } from "./besucher/KontaktScan.js";
import { ExponatDetail } from "./seiten/ExponatDetail.js";
import { Exponate } from "./seiten/Exponate.js";
import { Nutzer } from "./seiten/Nutzer.js";
import { Cookies, Datenschutz, Impressum } from "./seiten/Rechtliches.js";
import { useSprache } from "./lib/sprache.js";

/**
 * Die Seiten hinter der Fusszeile, seit dem 02.11.2026. **In jedem Baum ausser dem des
 * Terminals**, damit dieselbe Adresse abgemeldet wie angemeldet gilt. Seit dem 03.11.2026
 * auch unter englischer Adresse; die Sprache der Seite folgt weiter dem Umschalter.
 */
const RECHTSSEITEN = (
  <>
    <Route path="/impressum" element={<Impressum />} />
    <Route path="/imprint" element={<Impressum />} />
    <Route path="/datenschutz" element={<Datenschutz />} />
    <Route path="/privacy" element={<Datenschutz />} />
    <Route path="/cookie-einstellungen" element={<Cookies />} />
    <Route path="/cookie-settings" element={<Cookies />} />
    {/* Die erste Adresse bis zum 03.11.2026; bleibt, damit geteilte Links weiter gehen. */}
    <Route path="/cookies" element={<Cookies />} />
  </>
);

/**
 * Der Anmeldezustand kommt aus `GET /api/auth/ich`, bei jedem Start.
 *
 * **Kein localStorage-Zwischenspeicher mit sofortigem Rendern.** Der zeigte den Stand von
 * gestern: ein deaktivierter Nutzer saehe die Verwaltung aufblitzen, bevor der Server ihn
 * abweist, und eine geaenderte Rolle griffe erst nach dem Neuladen.
 */
export function App() {
  const { t } = useSprache();
  const [ich, setzeIch] = useState<Ich | null>(null);
  const [geprueft, setzeGeprueft] = useState(false);
  /*
   * Kommt der Besucher vom DTI-Viewer, steht das Ziel einmal in der Adresse. Im Zustand der
   * App gehalten, weil der Weg zur Anmeldemaske die Adresse ändert.
   */
  const [weiter] = useState(() => dtiWeiter(window.location.search));
  const zurDti = geprueft && ich !== null && weiter !== null;

  useEffect(() => {
    // Angemeldet: zurück zum Server, der den Code für Keycloak ausstellt.
    if (zurDti && weiter !== null) window.location.assign(weiter);
  }, [zurDti, weiter]);

  const pruefe = useCallback(() => {
    api<Ich>("/api/auth/ich")
      .then((daten) => {
        setzeIch(daten);
      })
      .catch(() => {
        /*
         * 401 ist hier kein Fehler, sondern die Antwort "nicht angemeldet". Jeder andere
         * Fehler endet ebenso bei der Anmeldung: ohne diese Auskunft laesst sich die
         * Oberflaeche nicht sinnvoll zeigen, und ein halb geladener Zustand waere
         * schlimmer als die Maske.
         */
        setzeIch(null);
      })
      .finally(() => {
        setzeGeprueft(true);
      });
  }, []);

  useEffect(() => {
    pruefe();
  }, [pruefe]);

  /** Einmal definiert: die Kiosk-Routen brauchen dasselbe wie der Rahmen. */
  const abmelden = () => {
    setzeIch(null);
  };

  // Bis die Auskunft da ist, wird nichts gezeigt. Sonst blitzt die Anmeldung auf, obwohl
  // die Sitzung gueltig ist.
  if (!geprueft || zurDti) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-grund">
        <p className="text-sm text-text-hinweis">
          {zurDti
            ? t("Weiter zum DTI-Viewer …", "Continuing to the DTI Viewer …")
            : t("Wird geladen …", "Loading …")}
        </p>
      </div>
    );
  }

  return (
    <BrowserRouter>
      {ich === null ? (
        <Routes>
          <Route
            path="/anmeldung"
            element={<Anmeldung aufAngemeldet={pruefe} fuerDti={weiter !== null} />}
          />
          {RECHTSSEITEN}
          {/*
            Die Anmeldemaske haengt an **keiner** anderen Route. Ein direkter Aufruf von
            /anmeldung aus einem Lesezeichen muss genauso gehen wie der Weg ueber /.
          */}
          <Route path="*" element={<ZurAnmeldung />} />
        </Routes>
      ) : ich.rolle === "kiosk" ? (
        /*
          **Ein eigener Baum, nicht ein paar versteckte Reiter.** Das Tablet steht
          unbeaufsichtigt im Publikum; es soll die Verwaltungsseiten gar nicht erst
          enthalten. Jede andere Adresse landet wieder beim Scan.
        */
        <Routes>
          <Route path="/kiosk" element={<KioskScan ich={ich} aufAbmelden={abmelden} />} />
          {/* Seit dem 23.10.2026 registriert sich der Besucher hier; das Tablet liest nichts. */}
          <Route path="/kiosk/:guid" element={<KioskRegistrierung aufAbmelden={abmelden} />} />
          <Route path="*" element={<Navigate to="/kiosk" replace />} />
        </Routes>
      ) : ich.rolle === "besucher" ? (
        /*
          **Der angemeldete Besucher**, seit dem 23.10.2026. Die GUID steht nicht in der Adresse;
          der Server nimmt sie aus der Sitzung. Jede andere Adresse landet in seinem Menü.
        */
        <Routes>
          <Route path="/mein" element={<MeinMenue ich={ich} aufAbmelden={abmelden} />} />
          <Route
            path="/mein/kontakte"
            element={<MeinKontakte ich={ich} aufAbmelden={abmelden} />}
          />
          <Route
            path="/mein/kontakte/scan"
            element={<MeinKontaktScan ich={ich} aufAbmelden={abmelden} />}
          />
          <Route path="/mein/stammdaten" element={<MeinStammdaten aufAbmelden={abmelden} />} />
          <Route path="/mein/avatar" element={<MeinAvatar aufAbmelden={abmelden} />} />
          <Route path="/mein/exponate" element={<MeinExponate aufAbmelden={abmelden} />} />
          <Route path="/mein/scan" element={<MeinExponatScan aufAbmelden={abmelden} />} />
          <Route path="/mein/scan/:code" element={<MeinExponatScan aufAbmelden={abmelden} />} />
          {RECHTSSEITEN}
          <Route path="*" element={<ZumZiel />} />
        </Routes>
      ) : (
        <Routes>
          <Route path="/anmeldung" element={<Navigate to="/" replace />} />
          {RECHTSSEITEN}
          <Route
            element={
              <Rahmen
                ich={ich}
                aufAbmelden={() => {
                  setzeIch(null);
                }}
              />
            }
          >
            {/* Ein Betreuer hat kein Dashboard; fuer ihn ist die Exponatliste die Startseite. */}
            <Route
              path="/"
              element={ich.rolle === "admin" ? <Dashboard /> : <Navigate to="/exponate" replace />}
            />
            <Route path="/besucher" element={<Besucher />} />
            <Route path="/besucher/neu" element={<BesucherDetail ich={ich} />} />
            <Route path="/besucher/:guid" element={<BesucherDetail ich={ich} />} />
            <Route path="/exponate" element={<Exponate ich={ich} />} />
            <Route path="/exponate/:id" element={<ExponatDetail ich={ich} />} />
            <Route path="/nutzer" element={<Nutzer ich={ich} />} />
            <Route path="/api" element={<Api />} />
            <Route path="/globale-daten" element={<GlobaleDaten />} />
            <Route path="/monitoring" element={<Monitoring />} />
            <Route
              path="/einstellungen"
              element={<Einstellungen ich={ich} aufIchGeaendert={pruefe} />}
            />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      )}
    </BrowserRouter>
  );
}

/**
 * Leitet zur Anmeldung und **merkt sich das Ziel**, seit dem 02.11.2026. Der QR-Code am Exponat
 * ist die Adresse `/mein/scan/<code>`; wer ihn mit der Handykamera öffnet und noch nicht
 * angemeldet ist, soll danach dort landen und nicht im Menü.
 *
 * Das Ziel steht im Zustand des Verlaufseintrags, nicht im Speicher des Browsers: es
 * überlebt den Wechsel des Routenbaums nach der Anmeldung und verschwindet mit dem Tab.
 */
function ZurAnmeldung() {
  const { pathname } = useLocation();
  return <Navigate to="/anmeldung" replace state={{ ziel: pathname }} />;
}

/** Nach der Anmeldung als Besucher: zum gemerkten Ziel, wenn es in seinem Bereich liegt. */
function ZumZiel() {
  const { state } = useLocation() as { state: { ziel?: unknown } | null };
  const ziel = state?.ziel;
  return (
    <Navigate to={typeof ziel === "string" && ziel.startsWith("/mein/") ? ziel : "/mein"} replace />
  );
}
