import { useCallback, useState } from "react";
import { useNavigate, useParams } from "react-router";
import { ApiFehler, api, useAbruf } from "../lib/api.js";
import { Feld, Fehlerhinweis, Flaeche, Knopf, Ueberschrift, Zustand } from "../bausteine/basis.js";
import { Kamera, kameraMoeglich, type Kamerafehler } from "../scan/Kamera.js";
import type { Ich } from "../lib/ich.js";
import { PERSONENFELDER, besucherFehlertext } from "../lib/personenfelder.js";
import { Kioskrahmen, Knopfleiste } from "./Kioskrahmen.js";
import { Avatarwahl } from "../bausteine/avatarwahl.js";
import { Personenformular } from "../bausteine/personenformular.js";
import { Datenschutztext, type Datenschutzabschnitt } from "../bausteine/datenschutztext.js";

/**
 * Das Tablet am Stand: **Besucher registrieren sich hier**, seit dem 23.10.2026.
 *
 * Pass scannen, dann in Schritten: Daten, Passwort, Bild, Datenschutz, fertig. Alles bleibt
 * im Zustand dieser Seite und geht erst am Ende in **einem** Aufruf an den Server; wer
 * mittendrin weggeht, hinterlässt nichts, und die Zeitsperre wirft die Eingaben weg.
 *
 * **Kein Eingabefeld für die GUID.** Die GUIDs sind fortlaufend; mit einem Feld könnte am
 * Tablet jeder einen fremden Pass registrieren, einfach durch Hochzählen. Der Schutz ist der
 * physische Pass vor der Kamera, und das Gerät gehört in den Kioskmodus des Browsers.
 */

// --- Scannen --------------------------------------------------------------------------

export function KioskScan({ ich, aufAbmelden }: { ich: Ich; aufAbmelden: () => void }) {
  const navigate = useNavigate();
  const [fehler, setzeFehler] = useState<string | null>(null);
  const [laeuft, setzeLaeuft] = useState(false);

  const ausQr = useCallback(
    (inhalt: string) => {
      // Ohne diese Prüfung liefe jeder Werbe-QR-Code in eine Serverabfrage.
      if (!inhalt.startsWith(ich.viewerBaseUrl)) {
        setzeFehler("Das ist kein Konferenzpass. Bitte den QR-Code auf dem Pass zeigen.");
        return;
      }
      // Der hintere Teil der Adresse ist die GUID: …/SPS2026-0001.
      const guid = inhalt.slice(ich.viewerBaseUrl.length).split(/[/?#]/)[0] ?? "";
      if (guid === "") {
        setzeFehler("Das ist kein Konferenzpass. Bitte den QR-Code auf dem Pass zeigen.");
        return;
      }
      setzeLaeuft(true);
      void navigate(`/kiosk/${encodeURIComponent(decodeURIComponent(guid))}`);
    },
    [ich.viewerBaseUrl, navigate],
  );

  return (
    <Kioskrahmen aufAbmelden={aufAbmelden} zeitsperre={false}>
      <Ueberschrift>Pass scannen</Ueberschrift>
      <p className="text-[17px] leading-relaxed text-text-zweit">
        Halte den QR-Code deines Konferenzpasses vor die Kamera. Danach registrierst du dich in
        wenigen Schritten.
      </p>

      {fehler !== null && <Fehlerhinweis>{fehler}</Fehlerhinweis>}

      {kameraMoeglich() ? (
        <div className="overflow-hidden bg-black">
          <Kamera
            pausiert={laeuft}
            aufTreffer={ausQr}
            aufFehler={(art: Kamerafehler) => {
              setzeFehler(
                art === "verweigert"
                  ? "Die Kamera ist für diese Seite gesperrt. Bitte das Standpersonal ansprechen."
                  : "Die Kamera lässt sich nicht starten. Bitte das Standpersonal ansprechen.",
              );
            }}
          />
        </div>
      ) : (
        <Fehlerhinweis>
          Die Kamera ist hier nicht verfügbar. Browser geben sie nur über HTTPS frei. Bitte das
          Standpersonal ansprechen.
        </Fehlerhinweis>
      )}
    </Kioskrahmen>
  );
}

// --- Registrieren ---------------------------------------------------------------------

type Schritt = "daten" | "passwort" | "bild" | "datenschutz" | "fertig";

const SCHRITTE: { id: Exclude<Schritt, "fertig">; text: string }[] = [
  { id: "daten", text: "Deine Daten" },
  { id: "passwort", text: "Passwort" },
  { id: "bild", text: "Bild" },
  { id: "datenschutz", text: "Datenschutz" },
];

interface Datenschutz {
  fassung: string;
  abschnitte: Datenschutzabschnitt[];
  einwilligungstext: string;
  entwurf: boolean;
  minPasswort: number;
}

interface Galerie {
  standard: string;
  avatare: string[];
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function KioskRegistrierung({ aufAbmelden }: { aufAbmelden: () => void }) {
  const { guid = "" } = useParams();
  const navigate = useNavigate();
  const pass = useAbruf<{ status: "frei" | "registriert" }>(
    `/api/kiosk/pass/${encodeURIComponent(guid)}`,
  );
  const datenschutz = useAbruf<Datenschutz>("/api/kiosk/datenschutz");
  const galerie = useAbruf<Galerie>("/api/kiosk/avatare");

  const [schritt, setzeSchritt] = useState<Schritt>("daten");
  const [werte, setzeWerte] = useState<Record<string, string>>(() =>
    Object.fromEntries(PERSONENFELDER.map((f) => [f.name, ""])),
  );
  const [passwort, setzePasswort] = useState("");
  const [wiederholung, setzeWiederholung] = useState("");
  const [avatar, setzeAvatar] = useState<string | null>(null);
  const [einverstanden, setzeEinverstanden] = useState(false);
  const [fehler, setzeFehler] = useState<string | null>(null);
  const [laeuft, setzeLaeuft] = useState(false);
  const [schonRegistriert, setzeSchonRegistriert] = useState(false);

  const zumScan = () => {
    void navigate("/kiosk", { replace: true });
  };

  function gehe(ziel: Schritt) {
    setzeFehler(null);
    setzeSchritt(ziel);
  }

  function weiterNachDaten() {
    if ((werte["vorname"] ?? "").trim() === "" || (werte["nachname"] ?? "").trim() === "") {
      setzeFehler("Bitte Vorname und Nachname eintragen.");
      return;
    }
    if (!EMAIL.test((werte["email"] ?? "").trim())) {
      setzeFehler(
        "Bitte eine gültige E-Mail-Adresse eintragen. Mit ihr meldest du dich später an.",
      );
      return;
    }
    gehe("passwort");
  }

  function weiterNachPasswort() {
    const min = datenschutz.daten?.minPasswort ?? 8;
    if (passwort.length < min) {
      setzeFehler(`Das Passwort braucht mindestens ${String(min)} Zeichen.`);
      return;
    }
    if (passwort !== wiederholung) {
      setzeFehler("Die beiden Passwörter stimmen nicht überein.");
      return;
    }
    gehe("bild");
  }

  async function registriere() {
    const d = datenschutz.daten;
    if (d === null || !einverstanden) return;
    setzeLaeuft(true);
    setzeFehler(null);
    try {
      await api("/api/kiosk/registrierung", {
        method: "POST",
        body: JSON.stringify({
          guid,
          ...werte,
          passwort,
          avatarDateiId: avatar,
          einwilligung: { erteilt: true, fassung: d.fassung },
        }),
      });
      setzeSchritt("fertig");
    } catch (ursache) {
      const code = ursache instanceof ApiFehler ? ursache.code : undefined;
      if (code === "bereits-registriert") {
        setzeSchonRegistriert(true);
      } else if (code === "datenschutz-veraltet") {
        // Den aktuellen Text laden; die Einwilligung gilt nur für den, der gelesen wurde.
        setzeEinverstanden(false);
        datenschutz.neu();
        setzeFehler("Der Datenschutzhinweis wurde geändert. Bitte lies ihn noch einmal.");
      } else if (code === "passwort-zu-kurz") {
        gehe("passwort");
        setzeFehler("Das Passwort ist zu kurz.");
      } else if (besucherFehlertext(code) !== null) {
        gehe("daten");
        setzeFehler(besucherFehlertext(code));
      } else {
        setzeFehler("Die Registrierung hat nicht geklappt. Bitte noch einmal versuchen.");
      }
    } finally {
      setzeLaeuft(false);
    }
  }

  const registriert = schonRegistriert || pass.daten?.status === "registriert";
  const nummer = SCHRITTE.findIndex((s) => s.id === schritt) + 1;

  return (
    <Kioskrahmen aufAbmelden={aufAbmelden} aufAblauf={zumScan}>
      <Zustand
        laedt={pass.laedt || datenschutz.laedt || galerie.laedt}
        fehler={pass.fehler ?? datenschutz.fehler ?? galerie.fehler}
      >
        {registriert ? (
          <>
            <Ueberschrift>Dieser Pass ist schon registriert</Ueberschrift>
            <p className="text-[17px] leading-relaxed text-text-zweit">
              Deine Angaben kannst du ändern, wenn du dich mit deiner E-Mail-Adresse und deinem
              Passwort in der App anmeldest.
            </p>
            <Knopf className="h-14 self-start px-8 text-[17px]" onClick={zumScan}>
              Zurück zum Scan
            </Knopf>
          </>
        ) : schritt === "fertig" ? (
          <>
            <Ueberschrift>Registrierung abgeschlossen</Ueberschrift>
            <p className="text-[17px] leading-relaxed text-text-zweit">
              Danke, {werte["vorname"]}! Dein Pass ist jetzt aktiv. Melde dich unter{" "}
              <b>{window.location.host}</b> mit <b>{werte["email"]}</b> und deinem Passwort an, um
              deine Angaben zu ändern.
            </p>
            <Knopf className="h-14 self-start px-8 text-[17px]" onClick={zumScan}>
              Fertig
            </Knopf>
          </>
        ) : (
          <>
            <div className="flex flex-col gap-2">
              <span className="text-xs font-semibold tracking-[0.14em] text-text-hinweis uppercase">
                Schritt {nummer} von {SCHRITTE.length}
              </span>
              <ol className="flex flex-wrap gap-2" aria-label="Schritte">
                {SCHRITTE.map((s, i) => (
                  <li
                    key={s.id}
                    aria-current={s.id === schritt ? "step" : undefined}
                    className={`px-3 py-1 text-[13px] font-semibold ${
                      s.id === schritt
                        ? "bg-primaer text-white"
                        : i + 1 < nummer
                          ? "bg-flaeche text-primaer-dunkel"
                          : "bg-flaeche text-text-hinweis"
                    }`}
                  >
                    {s.text}
                  </li>
                ))}
              </ol>
            </div>

            {fehler !== null && <Fehlerhinweis>{fehler}</Fehlerhinweis>}

            {schritt === "daten" && (
              <>
                <Ueberschrift>Deine Daten</Ueberschrift>
                <p className="text-[15px] text-text-zweit">
                  Felder mit * sind Pflicht. Deine E-Mail-Adresse ist später deine Anmeldung.
                </p>
                <Personenformular
                  werte={werte}
                  aufAenderung={(feld, wert) => {
                    setzeWerte((w) => ({ ...w, [feld]: wert }));
                  }}
                />
                <Knopfleiste>
                  <Knopf className="h-14 px-8 text-[17px]" onClick={weiterNachDaten}>
                    Weiter
                  </Knopf>
                  <Knopf art="rand" className="h-14 px-8 text-[17px]" onClick={zumScan}>
                    Abbrechen
                  </Knopf>
                </Knopfleiste>
              </>
            )}

            {schritt === "passwort" && (
              <>
                <Ueberschrift>Passwort festlegen</Ueberschrift>
                <Flaeche className="flex flex-col gap-5 p-7">
                  <p className="text-[15px] text-text-zweit">
                    Mit deiner E-Mail-Adresse <b>{werte["email"]}</b> und diesem Passwort meldest du
                    dich später an. Mindestens {datenschutz.daten?.minPasswort ?? 8} Zeichen.
                  </p>
                  <label className="flex flex-col gap-2 text-[14px] font-semibold">
                    Passwort
                    <Feld
                      type="password"
                      autoComplete="new-password"
                      className="h-12 text-[16px] font-normal"
                      value={passwort}
                      onChange={(ev) => {
                        setzePasswort(ev.target.value);
                      }}
                    />
                  </label>
                  <label className="flex flex-col gap-2 text-[14px] font-semibold">
                    Passwort wiederholen
                    <Feld
                      type="password"
                      autoComplete="new-password"
                      className="h-12 text-[16px] font-normal"
                      value={wiederholung}
                      onChange={(ev) => {
                        setzeWiederholung(ev.target.value);
                      }}
                    />
                  </label>
                </Flaeche>
                <Knopfleiste>
                  <Knopf className="h-14 px-8 text-[17px]" onClick={weiterNachPasswort}>
                    Weiter
                  </Knopf>
                  <Knopf
                    art="rand"
                    className="h-14 px-8 text-[17px]"
                    onClick={() => {
                      gehe("daten");
                    }}
                  >
                    Zurück
                  </Knopf>
                </Knopfleiste>
              </>
            )}

            {schritt === "bild" && galerie.daten !== null && (
              <>
                <Ueberschrift>Dein Bild</Ueberschrift>
                <p className="text-[15px] text-text-zweit">
                  Wähle ein Bild, das im Viewer erscheint. Du kannst es später ändern.
                </p>
                <Avatarwahl
                  standard={galerie.daten.standard}
                  avatare={galerie.daten.avatare}
                  gewaehlt={avatar ?? galerie.daten.standard}
                  aufWahl={setzeAvatar}
                />
                <Knopfleiste>
                  <Knopf
                    className="h-14 px-8 text-[17px]"
                    onClick={() => {
                      gehe("datenschutz");
                    }}
                  >
                    Weiter
                  </Knopf>
                  <Knopf
                    art="rand"
                    className="h-14 px-8 text-[17px]"
                    onClick={() => {
                      gehe("passwort");
                    }}
                  >
                    Zurück
                  </Knopf>
                </Knopfleiste>
              </>
            )}

            {schritt === "datenschutz" && datenschutz.daten !== null && (
              <>
                <Ueberschrift>Datenschutz</Ueberschrift>
                {datenschutz.daten.entwurf && (
                  <p
                    role="note"
                    className="border-l-4 border-akzent bg-flaeche px-4 py-3 text-[14px] font-semibold"
                  >
                    Entwurf: dieser Hinweis ist noch nicht freigegeben und enthält Platzhalter.
                  </p>
                )}
                <Flaeche className="max-h-[50dvh] overflow-y-auto p-7">
                  <Datenschutztext
                    abschnitte={datenschutz.daten.abschnitte}
                    fassung={datenschutz.daten.fassung}
                  />
                </Flaeche>
                {/*
                  Das Kästchen steht **im klebenden Band**, direkt über dem Knopf. Unter dem Text
                  läge es am Tablet hinter dem Band und wäre erst nach dem Scrollen zu sehen.
                */}
                <Knopfleiste>
                  <label className="flex w-full items-start gap-3 text-[15px] leading-relaxed">
                    <input
                      type="checkbox"
                      className="mt-1 size-6 shrink-0 accent-primaer"
                      checked={einverstanden}
                      onChange={(ev) => {
                        setzeEinverstanden(ev.target.checked);
                      }}
                    />
                    <span>{datenschutz.daten.einwilligungstext}</span>
                  </label>
                  <Knopf
                    className="h-14 px-8 text-[17px]"
                    disabled={!einverstanden || laeuft}
                    onClick={() => void registriere()}
                  >
                    {laeuft ? "Wird registriert …" : "Registrierung abschließen"}
                  </Knopf>
                  <Knopf
                    art="rand"
                    className="h-14 px-8 text-[17px]"
                    disabled={laeuft}
                    onClick={() => {
                      gehe("bild");
                    }}
                  >
                    Zurück
                  </Knopf>
                </Knopfleiste>
              </>
            )}
          </>
        )}
      </Zustand>
    </Kioskrahmen>
  );
}
