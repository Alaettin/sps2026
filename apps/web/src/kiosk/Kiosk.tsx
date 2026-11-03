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
import { useSprache } from "../lib/sprache.js";
import { guidAus } from "../lib/pass.js";

/**
 * Das Tablet am Stand: **Besucher registrieren sich hier**, seit dem 23.10.2026.
 *
 * Pass scannen, dann in Schritten: Daten, Passwort, Bild, Datenschutz, fertig. Alles bleibt
 * im Zustand dieser Seite und geht erst am Ende in **einem** Aufruf an den Server; wer
 * mittendrin weggeht, hinterlässt nichts, und die Zeitsperre wirft die Eingaben weg.
 *
 * **Die GUID lässt sich auch von Hand eingeben**, seit dem 23.10.2026, falls Kamera oder
 * QR-Code versagen. Das war vorher ausgeschlossen, weil das Tablet damals fremde Daten lesen
 * und ändern konnte. Heute registriert es nur freie Pässe; das Restrisiko ist, dass jemand eine
 * fremde, noch freie Passnummer belegt. Der echte Inhaber sieht dann „schon registriert“, und
 * das Personal kann den Datensatz löschen.
 */

// --- Scannen --------------------------------------------------------------------------

export function KioskScan({ ich, aufAbmelden }: { ich: Ich; aufAbmelden: () => void }) {
  const { t } = useSprache();
  const navigate = useNavigate();
  const [fehler, setzeFehler] = useState<string | null>(null);
  const [laeuft, setzeLaeuft] = useState(false);
  const [eingabe, setzeEingabe] = useState("");
  // Startet die Kamera nicht, bliebe nur ein schwarzer Kasten; dann blenden wir ihn aus.
  const [kameraAus, setzeKameraAus] = useState(false);

  const oeffne = useCallback(
    (guid: string) => {
      setzeLaeuft(true);
      void navigate(`/kiosk/${encodeURIComponent(guid)}`);
    },
    [navigate],
  );

  const ausQr = useCallback(
    (inhalt: string) => {
      const guid = guidAus(inhalt, ich.viewerBaseUrl, true);
      if (guid === null) {
        setzeFehler(
          t(
            "Das ist kein Konferenzpass. Bitte den QR-Code auf dem Pass zeigen.",
            "This is not a conference pass. Please show the QR code on your pass.",
          ),
        );
        return;
      }
      oeffne(guid);
    },
    [ich.viewerBaseUrl, oeffne, t],
  );

  return (
    <Kioskrahmen aufAbmelden={aufAbmelden} zeitsperre={false}>
      <Ueberschrift>{t("Pass scannen", "Scan pass")}</Ueberschrift>
      <p className="text-[17px] leading-relaxed text-text-zweit">
        {t(
          "Halte den QR-Code deines Konferenzpasses vor die Kamera. Danach registrierst du dich in wenigen Schritten.",
          "Hold the QR code of your conference pass in front of the camera. Then register in a few steps.",
        )}
      </p>

      {fehler !== null && <Fehlerhinweis>{fehler}</Fehlerhinweis>}

      {kameraAus ? null : kameraMoeglich() ? (
        <div className="overflow-hidden bg-black">
          <Kamera
            pausiert={laeuft}
            aufTreffer={ausQr}
            aufFehler={(art: Kamerafehler) => {
              setzeKameraAus(true);
              setzeFehler(
                art === "verweigert"
                  ? t(
                      "Die Kamera ist für diese Seite gesperrt. Bitte das Standpersonal ansprechen.",
                      "The camera is blocked for this page. Please ask the stand staff.",
                    )
                  : t(
                      "Die Kamera lässt sich nicht starten. Bitte das Standpersonal ansprechen.",
                      "The camera cannot be started. Please ask the stand staff.",
                    ),
              );
            }}
          />
        </div>
      ) : (
        <Fehlerhinweis>
          {t(
            "Die Kamera ist hier nicht verfügbar. Browser geben sie nur über HTTPS frei. Bitte das Standpersonal ansprechen.",
            "The camera is not available here. Browsers only allow it over HTTPS. Please ask the stand staff.",
          )}
        </Fehlerhinweis>
      )}

      <form
        className="flex flex-col gap-3 bg-flaeche p-6 shadow-flaeche"
        onSubmit={(ev) => {
          ev.preventDefault();
          const guid = guidAus(eingabe, ich.viewerBaseUrl, false);
          if (guid === null) {
            setzeFehler(
              t(
                "Das ist keine gültige Passnummer. Bitte so eingeben, wie sie auf dem Pass steht.",
                "This is not a valid pass number. Please enter it exactly as shown on the pass.",
              ),
            );
            return;
          }
          oeffne(guid);
        }}
      >
        <h2 className="text-[15px] font-semibold">
          {t(
            "Kein QR-Code lesbar? GUID von Hand eingeben",
            "QR code not readable? Enter the GUID by hand",
          )}
        </h2>
        <div className="flex flex-wrap items-end gap-3">
          <label className="flex min-w-0 flex-1 flex-col gap-2 text-[14px] font-semibold">
            {t("GUID vom Pass", "GUID from the pass")}
            <Feld
              value={eingabe}
              onChange={(ev) => {
                setzeEingabe(ev.target.value);
              }}
              placeholder="SPS2026-0001"
              className="h-12 font-mono text-[16px] font-normal"
              autoComplete="off"
              autoCapitalize="characters"
              spellCheck={false}
            />
          </label>
          <Knopf type="submit" className="h-12 px-8" disabled={eingabe.trim() === "" || laeuft}>
            {t("Weiter", "Next")}
          </Knopf>
        </div>
      </form>
    </Kioskrahmen>
  );
}

// --- Registrieren ---------------------------------------------------------------------

type Schritt = "daten" | "passwort" | "bild" | "datenschutz" | "fertig";

const SCHRITTE: { id: Exclude<Schritt, "fertig">; text: string; en: string }[] = [
  { id: "daten", text: "Deine Daten", en: "Your details" },
  { id: "passwort", text: "Passwort", en: "Password" },
  { id: "bild", text: "Bild", en: "Picture" },
  { id: "datenschutz", text: "Datenschutz", en: "Privacy" },
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
  const { sprache, t } = useSprache();
  const { guid = "" } = useParams();
  const navigate = useNavigate();
  const pass = useAbruf<{ status: "frei" | "registriert" }>(
    `/api/kiosk/pass/${encodeURIComponent(guid)}`,
  );
  // In der Sprache, die gerade gilt; die Einwilligung nennt dieselbe Sprache.
  const datenschutz = useAbruf<Datenschutz>(`/api/kiosk/datenschutz?sprache=${sprache}`);
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

  /*
   * Wechselt die Sprache, gilt das Kaestchen nicht mehr: zugestimmt wird dem Text, der zu
   * sehen war. Nach dem Ereignis zurueckgesetzt, nicht in einem Effekt.
   */
  const [sprachstand, setzeSprachstand] = useState(sprache);
  if (sprachstand !== sprache) {
    setzeSprachstand(sprache);
    setzeEinverstanden(false);
  }

  const zumScan = () => {
    void navigate("/kiosk", { replace: true });
  };

  function gehe(ziel: Schritt) {
    setzeFehler(null);
    setzeSchritt(ziel);
  }

  function weiterNachDaten() {
    if ((werte["vorname"] ?? "").trim() === "" || (werte["nachname"] ?? "").trim() === "") {
      setzeFehler(
        t("Bitte Vorname und Nachname eintragen.", "Please enter first name and last name."),
      );
      return;
    }
    if (!EMAIL.test((werte["email"] ?? "").trim())) {
      setzeFehler(
        t(
          "Bitte eine gültige E-Mail-Adresse eintragen. Mit ihr meldest du dich später an.",
          "Please enter a valid email address. You will use it to sign in later.",
        ),
      );
      return;
    }
    gehe("passwort");
  }

  function weiterNachPasswort() {
    const min = datenschutz.daten?.minPasswort ?? 8;
    if (passwort.length < min) {
      setzeFehler(
        t(
          `Das Passwort braucht mindestens ${String(min)} Zeichen.`,
          `The password needs at least ${String(min)} characters.`,
        ),
      );
      return;
    }
    if (passwort !== wiederholung) {
      setzeFehler(
        t("Die beiden Passwörter stimmen nicht überein.", "The two passwords do not match."),
      );
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
          einwilligung: { erteilt: true, fassung: d.fassung, sprache },
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
        setzeFehler(
          t(
            "Der Datenschutzhinweis wurde geändert. Bitte lies ihn noch einmal.",
            "The privacy notice has changed. Please read it again.",
          ),
        );
      } else if (code === "passwort-zu-kurz") {
        gehe("passwort");
        setzeFehler(t("Das Passwort ist zu kurz.", "The password is too short."));
      } else if (besucherFehlertext(code, t) !== null) {
        gehe("daten");
        setzeFehler(besucherFehlertext(code, t));
      } else {
        setzeFehler(
          t(
            "Die Registrierung hat nicht geklappt. Bitte noch einmal versuchen.",
            "Registration did not work. Please try again.",
          ),
        );
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
            <Ueberschrift>
              {t("Dieser Pass ist schon registriert", "This pass is already registered")}
            </Ueberschrift>
            <p className="text-[17px] leading-relaxed text-text-zweit">
              {t(
                "Deine Angaben kannst du ändern, wenn du dich mit deiner E-Mail-Adresse und deinem Passwort in der App anmeldest.",
                "You can change your details by signing in to the app with your email address and password.",
              )}
            </p>
            <Knopf className="h-14 self-start px-8 text-[17px]" onClick={zumScan}>
              {t("Zurück zum Scan", "Back to scan")}
            </Knopf>
          </>
        ) : schritt === "fertig" ? (
          <>
            <Ueberschrift>{t("Registrierung abgeschlossen", "Registration complete")}</Ueberschrift>
            <p className="text-[17px] leading-relaxed text-text-zweit">
              {t(
                `Danke, ${werte["vorname"] ?? ""}! Dein Pass ist jetzt aktiv. Melde dich unter`,
                `Thank you, ${werte["vorname"] ?? ""}! Your pass is now active. Sign in at`,
              )}{" "}
              <b>{window.location.host}</b> {t("mit", "with")} <b>{werte["email"]}</b>{" "}
              {t(
                "und deinem Passwort an, um deine Angaben zu ändern.",
                "and your password to change your details.",
              )}
            </p>
            <Knopf className="h-14 self-start px-8 text-[17px]" onClick={zumScan}>
              {t("Fertig", "Done")}
            </Knopf>
          </>
        ) : (
          <>
            <div className="flex flex-col gap-2">
              <span className="text-xs font-semibold tracking-[0.14em] text-text-hinweis uppercase">
                {t(
                  `Schritt ${String(nummer)} von ${String(SCHRITTE.length)}`,
                  `Step ${String(nummer)} of ${String(SCHRITTE.length)}`,
                )}
              </span>
              <ol className="flex flex-wrap gap-2" aria-label={t("Schritte", "Steps")}>
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
                    {t(s.text, s.en)}
                  </li>
                ))}
              </ol>
            </div>

            {fehler !== null && <Fehlerhinweis>{fehler}</Fehlerhinweis>}

            {schritt === "daten" && (
              <>
                <Ueberschrift>{t("Deine Daten", "Your details")}</Ueberschrift>
                <p className="text-[15px] text-text-zweit">
                  {t(
                    "Felder mit * sind Pflicht. Deine E-Mail-Adresse ist später deine Anmeldung.",
                    "Fields marked * are required. Your email address will be your sign-in.",
                  )}
                </p>
                <Personenformular
                  werte={werte}
                  aufAenderung={(feld, wert) => {
                    setzeWerte((w) => ({ ...w, [feld]: wert }));
                  }}
                />
                <Knopfleiste>
                  <Knopf className="h-14 px-8 text-[17px]" onClick={weiterNachDaten}>
                    {t("Weiter", "Next")}
                  </Knopf>
                  <Knopf art="rand" className="h-14 px-8 text-[17px]" onClick={zumScan}>
                    {t("Abbrechen", "Cancel")}
                  </Knopf>
                </Knopfleiste>
              </>
            )}

            {schritt === "passwort" && (
              <>
                <Ueberschrift>{t("Passwort festlegen", "Set password")}</Ueberschrift>
                <Flaeche className="flex flex-col gap-5 p-7">
                  <p className="text-[15px] text-text-zweit">
                    {t("Mit deiner E-Mail-Adresse", "With your email address")}{" "}
                    <b>{werte["email"]}</b>{" "}
                    {t(
                      `und diesem Passwort meldest du dich später an. Mindestens ${String(datenschutz.daten?.minPasswort ?? 8)} Zeichen.`,
                      `and this password you will sign in later. At least ${String(datenschutz.daten?.minPasswort ?? 8)} characters.`,
                    )}
                  </p>
                  <label className="flex flex-col gap-2 text-[14px] font-semibold">
                    {t("Passwort", "Password")}
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
                    {t("Passwort wiederholen", "Repeat password")}
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
                    {t("Weiter", "Next")}
                  </Knopf>
                  <Knopf
                    art="rand"
                    className="h-14 px-8 text-[17px]"
                    onClick={() => {
                      gehe("daten");
                    }}
                  >
                    {t("Zurück", "Back")}
                  </Knopf>
                </Knopfleiste>
              </>
            )}

            {schritt === "bild" && galerie.daten !== null && (
              <>
                <Ueberschrift>{t("Dein Bild", "Your picture")}</Ueberschrift>
                <p className="text-[15px] text-text-zweit">
                  {t(
                    "Wähle ein Bild, das im Viewer erscheint. Du kannst es später ändern.",
                    "Choose a picture to appear in the viewer. You can change it later.",
                  )}
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
                    {t("Weiter", "Next")}
                  </Knopf>
                  <Knopf
                    art="rand"
                    className="h-14 px-8 text-[17px]"
                    onClick={() => {
                      gehe("passwort");
                    }}
                  >
                    {t("Zurück", "Back")}
                  </Knopf>
                </Knopfleiste>
              </>
            )}

            {schritt === "datenschutz" && datenschutz.daten !== null && (
              <>
                <Ueberschrift>{t("Datenschutz", "Privacy")}</Ueberschrift>
                {datenschutz.daten.entwurf && (
                  <p
                    role="note"
                    className="border-l-4 border-akzent bg-flaeche px-4 py-3 text-[14px] font-semibold"
                  >
                    {t(
                      "Entwurf: dieser Hinweis ist noch nicht freigegeben und enthält Platzhalter.",
                      "Draft: this notice has not been approved yet and contains placeholders.",
                    )}
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
                    {laeuft
                      ? t("Wird registriert …", "Registering …")
                      : t("Registrierung abschließen", "Complete registration")}
                  </Knopf>
                  <Knopf
                    art="rand"
                    className="h-14 px-8 text-[17px]"
                    disabled={laeuft}
                    onClick={() => {
                      gehe("bild");
                    }}
                  >
                    {t("Zurück", "Back")}
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
