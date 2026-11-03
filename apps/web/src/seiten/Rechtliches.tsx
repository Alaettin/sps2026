import type { ReactNode } from "react";
import { useNavigate } from "react-router";
import { useAbruf } from "../lib/api.js";
import { Flaeche, Knopf, Seitenkopf, Ueberschrift, Zustand, cn } from "../bausteine/basis.js";
import { Logoreihe } from "../bausteine/logos.js";
import { Band, Fusszeile } from "../bausteine/band.js";
import { Datenschutztext, type Datenschutzabschnitt } from "../bausteine/datenschutztext.js";
import { Sprachwahl, useSprache } from "../lib/sprache.js";

/**
 * Impressum, Datenschutz und Cookie-Einstellungen, seit dem 02.11.2026 hinter der Fusszeile.
 *
 * **Oeffentlich**: die Seiten haengen in jedem Routenbaum ausser dem des Terminals, damit sie
 * abgemeldet wie angemeldet unter derselben Adresse stehen. Vom Terminal fuehrt kein Link
 * hierher.
 */

const SPALTE = "mx-auto w-full max-w-[820px] px-6";

function Rechtsseite({ titel, children }: { titel: string; children: ReactNode }) {
  const { t } = useSprache();
  const navigate = useNavigate();
  return (
    <div className="flex min-h-screen flex-col bg-grund text-text">
      <header className="relative z-10 bg-flaeche shadow-kopf">
        <div className={cn("flex h-[72px] items-center justify-between gap-4", SPALTE)}>
          <Logoreihe art="kopf" className="justify-start gap-5" />
          <Sprachwahl />
        </div>
      </header>
      <Band />
      <main
        className={cn("relative -mt-20 flex w-full flex-1 flex-col gap-6 pb-8 sm:-mt-24", SPALTE)}
      >
        <Seitenkopf>
          <Ueberschrift>{titel}</Ueberschrift>
        </Seitenkopf>
        <Flaeche className="flex flex-col gap-4 p-7 text-[15px] leading-relaxed">
          {children}
        </Flaeche>
        <Knopf
          art="rand"
          className="self-start"
          onClick={() => {
            // Wer ueber einen Link von aussen kam, hat keinen Verlauf in der App.
            if (window.history.length > 1) void navigate(-1);
            else void navigate("/");
          }}
        >
          {t("Zurück", "Back")}
        </Knopf>
      </main>
      <Fusszeile />
    </div>
  );
}

function Absatz({ children }: { children: ReactNode }) {
  return <p className="text-text-zweit">{children}</p>;
}

function Titel({ children }: { children: ReactNode }) {
  return <h2 className="pt-2 text-[15px] font-semibold">{children}</h2>;
}

/**
 * Anbieter des IDTA Passport ist die IDTA, den technischen Betrieb macht Neoception;
 * Entscheidung vom 02.11.2026. Die Angaben zur IDTA stammen aus industrialdigitaltwin.org/
 * impressum, die zu Neoception aus neoception.com/impressum (Stand 02.11.2026). Seit dem
 * 03.11.2026 auch auf Englisch; Register und Namen bleiben, wie sie eingetragen sind.
 */
export function Impressum() {
  const { t } = useSprache();
  return (
    <Rechtsseite titel={t("Impressum", "Imprint")}>
      <Titel>{t("Anbieter des IDTA Passport", "Provider of IDTA Passport")}</Titel>
      <Absatz>
        Industrial Digital Twin Association e.V. (IDTA)
        <br />
        Lyoner Straße 18
        <br />
        60528 Frankfurt am Main{t("", ", Germany")}
      </Absatz>
      <Absatz>
        {t("Telefon:", "Phone:")} <a href="tel:+496966031939">+49 69 6603 1939</a>
        <br />
        {t("E-Mail:", "Email:")} <a href="mailto:info@idtwin.org">info@idtwin.org</a>
      </Absatz>
      <Absatz>
        {t(
          "Vereinsregister beim Amtsgericht Frankfurt am Main Nr. VR 16747",
          "Register of associations at the Frankfurt am Main local court, no. VR 16747",
        )}
      </Absatz>
      <Absatz>{t("Vertretungsberechtigter Vorstand:", "Board authorised to represent:")}</Absatz>
      <ul className="list-disc pl-6 text-text-zweit">
        <li>Dr. Matthias Bölke ({t("Vorstandsvorsitzender", "Chairman")})</li>
        <li>
          Dr. Horst Heinol-Heikkinen (
          {t("Stellvertretender Vorstandsvorsitzender", "Deputy chairman")})
        </li>
        <li>Karsten Schneider ({t("Schatzmeister", "Treasurer")})</li>
      </ul>
      <Absatz>{t("Geschäftsführung:", "Managing director:")} Dr. Christian Mosch</Absatz>
      <Absatz>
        {t("Anschrift jeweils:", "Address in each case:")} Industrial Digital Twin Association e.V.,
        Lyoner Straße 18, 60528 Frankfurt am Main.
      </Absatz>
      <Absatz>
        {t(
          "Inhaltlich verantwortlich gem. § 18 Abs. 2 MStV: Dr. Christian Mosch, Anschrift wie oben.",
          "Responsible for content under § 18(2) MStV: Dr. Christian Mosch, address as above.",
        )}
      </Absatz>

      <hr className="border-linie" />
      <Titel>{t("Technischer Betrieb", "Technical operation")}</Titel>
      <Absatz>
        Neoception GmbH
        <br />
        Mallaustraße 50-56
        <br />
        68219 Mannheim{t("", ", Germany")}
      </Absatz>
      <Absatz>
        {t("E-Mail:", "Email:")} <a href="mailto:info@neoception.com">info@neoception.com</a>
      </Absatz>
      <Absatz>
        {t(
          "Registergericht: Amtsgericht Mannheim, HRB 726560",
          "Register court: Mannheim local court, HRB 726560",
        )}
        <br />
        {t("Geschäftsführer:", "Managing directors:")} Dr.-Ing. Jörg Nagel, Michael Blüm
      </Absatz>
      <Absatz>
        {t(
          "Neoception betreibt den IDTA Passport, die Plattform AXON und den Viewer im Auftrag der IDTA.",
          "Neoception operates IDTA Passport, the AXON platform and the viewer on behalf of IDTA.",
        )}
      </Absatz>

      <hr className="border-linie" />
      <Titel>{t("Inhalte der Exponate", "Exhibit content")}</Titel>
      <Absatz>
        {t(
          "Dokumente, Links und Ansprechpartner zu den Exponaten stellen die jeweiligen Aussteller ein und verantworten sie. Die IDTA übernimmt für ihre Aktualität, Richtigkeit und Vollständigkeit keine Gewähr. Wird eine Rechtsverletzung bekannt, entfernen wir den Inhalt umgehend.",
          "Documents, links and contacts for the exhibits are provided by the respective exhibitors, who are responsible for them. IDTA accepts no liability for their being up to date, correct and complete. If we become aware of an infringement, we remove the content immediately.",
        )}
      </Absatz>
      <Titel>{t("Externe Links", "External links")}</Titel>
      <Absatz>
        {t(
          "Der IDTA Passport verweist auf Internetseiten Dritter, etwa in der Fußzeile oder in den Links der Aussteller. Für deren Inhalte sind allein die jeweiligen Anbieter verantwortlich; auf sie haben IDTA und Neoception keinen Einfluss.",
          "IDTA Passport links to third-party websites, for example in the footer or in the exhibitors' links. Their providers alone are responsible for their content; IDTA and Neoception have no influence over it.",
        )}
      </Absatz>
      <Titel>{t("Bildmaterial", "Images")}</Titel>
      <Absatz>
        {t(
          "Das Foto der Fußzeile sowie die Logos der IDTA und der Plattform Industrie 4.0 stammen von industrialdigitaltwin.org. Die Besucherbilder sind Grafiken aus einer festen Auswahl.",
          "The footer photo and the logos of IDTA and Plattform Industrie 4.0 are taken from industrialdigitaltwin.org. The visitor pictures are graphics from a fixed selection.",
        )}
      </Absatz>
      <Titel>{t("Kontakt", "Contact")}</Titel>
      <Absatz>
        {t("Fragen zum IDTA Passport an", "Questions about IDTA Passport to")}{" "}
        <a href="mailto:info@idtwin.org">info@idtwin.org</a>,{" "}
        {t("zum Datenschutz an", "about data protection to")}{" "}
        <a href="mailto:datenschutz@idtwin.org">datenschutz@idtwin.org</a>.
      </Absatz>
    </Rechtsseite>
  );
}

/** Derselbe Hinweis, dem Besucher am Terminal zustimmen, ohne Anmeldung lesbar. */
export function Datenschutz() {
  const { sprache, t } = useSprache();
  const abruf = useAbruf<{ fassung: string; abschnitte: Datenschutzabschnitt[] }>(
    `/api/datenschutz?sprache=${sprache}`,
  );
  return (
    <Rechtsseite titel={t("Datenschutzhinweis", "Privacy notice")}>
      <Zustand laedt={abruf.laedt} fehler={abruf.fehler}>
        {abruf.daten !== null && (
          <Datenschutztext abschnitte={abruf.daten.abschnitte} fassung={abruf.daten.fassung} />
        )}
      </Zustand>
    </Rechtsseite>
  );
}

/**
 * Die App setzt nur das Sitzungscookie (`auth/session.ts`). Einzustellen gibt es darum nichts,
 * und ein Banner waere eine Einwilligung in nichts.
 */
export function Cookies() {
  const { t } = useSprache();
  return (
    <Rechtsseite titel={t("Cookie-Einstellungen", "Cookie settings")}>
      <Absatz>
        {t("Der IDTA Passport setzt", "IDTA Passport sets")}{" "}
        <b className="text-text">
          {t("nur ein technisch notwendiges Cookie", "only one technically necessary cookie")}
        </b>
        {t(
          ": das Sitzungscookie, das dich nach der Anmeldung angemeldet hält. Es entsteht erst mit der Anmeldung, enthält keine Werbe- oder Analysedaten und ist für Skripte nicht lesbar. Es verfällt nach 12 Stunden oder sobald du dich abmeldest.",
          ": the session cookie that keeps you signed in. It is only created when you sign in, contains no advertising or analytics data and cannot be read by scripts. It expires after 12 hours or as soon as you sign out.",
        )}
      </Absatz>
      <Absatz>
        {t(
          "Analyse-, Tracking- oder Werbecookies gibt es nicht, auch keine Dienste von Drittanbietern, die Cookies setzen. Deshalb gibt es hier nichts ein- oder auszuschalten.",
          "There are no analytics, tracking or advertising cookies, and no third-party services that set cookies. That is why there is nothing to switch on or off here.",
        )}
      </Absatz>
      <Absatz>
        {t(
          "Im lokalen Speicher des Browsers merkt sich die App die gewählte Sprache und, für das Standpersonal, ob in den Einstellungen die Entwickleransicht eingeschaltet ist. Beides sind Einstellungen, die man selbst vornimmt, und sie verlassen das Gerät nicht.",
          "In the browser's local storage the app remembers the language you chose and, for stand staff, whether the developer view is switched on in the settings. Both are settings you make yourself, and they never leave the device.",
        )}
      </Absatz>
      <Absatz>
        {t(
          "Schriften und Bilder liefert der IDTA Passport selbst aus; beim Aufruf lädt er nichts von Drittanbietern. Das Kamerabild beim Scannen eines QR-Codes wertet nur dein Browser aus, es wird weder gespeichert noch übertragen.",
          "IDTA Passport serves its fonts and images itself; it loads nothing from third parties. When you scan a QR code, only your browser analyses the camera image; it is neither stored nor transmitted.",
        )}
      </Absatz>
    </Rechtsseite>
  );
}
