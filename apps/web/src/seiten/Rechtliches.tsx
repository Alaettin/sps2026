import type { ReactNode } from "react";
import { useNavigate } from "react-router";
import { useAbruf } from "../lib/api.js";
import { Flaeche, Knopf, Seitenkopf, Ueberschrift, Zustand, cn } from "../bausteine/basis.js";
import { Logoreihe } from "../bausteine/logos.js";
import { Band, Fusszeile } from "../bausteine/band.js";
import { Datenschutztext, type Datenschutzabschnitt } from "../bausteine/datenschutztext.js";

/**
 * Impressum, Datenschutz und Cookie-Einstellungen, seit dem 02.11.2026 hinter der Fusszeile.
 *
 * **Oeffentlich**: die Seiten haengen in jedem Routenbaum ausser dem des Terminals, damit sie
 * abgemeldet wie angemeldet unter derselben Adresse stehen. Vom Terminal fuehrt kein Link
 * hierher.
 */

const SPALTE = "mx-auto w-full max-w-[820px] px-6";

function Rechtsseite({ titel, children }: { titel: string; children: ReactNode }) {
  const navigate = useNavigate();
  return (
    <div className="flex min-h-screen flex-col bg-grund text-text">
      <header className="relative z-10 bg-flaeche shadow-kopf">
        <div className={cn("flex h-[72px] items-center", SPALTE)}>
          <Logoreihe art="kopf" className="justify-start gap-5" />
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
          Zurück
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
 * impressum, die zu Neoception aus neoception.com/impressum (Stand 02.11.2026).
 */
export function Impressum() {
  return (
    <Rechtsseite titel="Impressum">
      <Titel>Anbieter des IDTA Passport</Titel>
      <Absatz>
        Industrial Digital Twin Association e.V. (IDTA)
        <br />
        Lyoner Straße 18
        <br />
        60528 Frankfurt am Main
      </Absatz>
      <Absatz>
        Telefon: <a href="tel:+496966031939">+49 69 6603 1939</a>
        <br />
        E-Mail: <a href="mailto:info@idtwin.org">info@idtwin.org</a>
      </Absatz>
      <Absatz>Vereinsregister beim Amtsgericht Frankfurt am Main Nr. VR 16747</Absatz>
      <Absatz>Vertretungsberechtigter Vorstand:</Absatz>
      <ul className="list-disc pl-6 text-text-zweit">
        <li>Dr. Matthias Bölke (Vorstandsvorsitzender)</li>
        <li>Dr. Horst Heinol-Heikkinen (Stellvertretender Vorstandsvorsitzender)</li>
        <li>Karsten Schneider (Schatzmeister)</li>
      </ul>
      <Absatz>Geschäftsführung: Dr. Christian Mosch</Absatz>
      <Absatz>
        Anschrift jeweils: Industrial Digital Twin Association e.V., Lyoner Straße 18, 60528
        Frankfurt am Main.
      </Absatz>
      <Absatz>
        Inhaltlich verantwortlich gem. § 18 Abs. 2 MStV: Dr. Christian Mosch, Anschrift wie oben.
      </Absatz>

      <hr className="border-linie" />
      <Titel>Technischer Betrieb</Titel>
      <Absatz>
        Neoception GmbH
        <br />
        Mallaustraße 50-56
        <br />
        68219 Mannheim
      </Absatz>
      <Absatz>
        E-Mail: <a href="mailto:info@neoception.com">info@neoception.com</a>
      </Absatz>
      <Absatz>
        Registergericht: Amtsgericht Mannheim, HRB 726560
        <br />
        Geschäftsführer: Dr.-Ing. Jörg Nagel, Michael Blüm
      </Absatz>
      <Absatz>
        Neoception betreibt den IDTA Passport, die Plattform AXON und den Viewer im Auftrag der
        IDTA.
      </Absatz>

      <hr className="border-linie" />
      <Titel>Inhalte der Exponate</Titel>
      <Absatz>
        Dokumente, Links und Ansprechpartner zu den Exponaten stellen die jeweiligen Aussteller ein
        und verantworten sie. Die IDTA übernimmt für ihre Aktualität, Richtigkeit und
        Vollständigkeit keine Gewähr. Wird eine Rechtsverletzung bekannt, entfernen wir den Inhalt
        umgehend.
      </Absatz>
      <Titel>Externe Links</Titel>
      <Absatz>
        Der IDTA Passport verweist auf Internetseiten Dritter, etwa in der Fußzeile oder in den
        Links der Aussteller. Für deren Inhalte sind allein die jeweiligen Anbieter verantwortlich;
        auf sie haben IDTA und Neoception keinen Einfluss.
      </Absatz>
      <Titel>Bildmaterial</Titel>
      <Absatz>
        Das Foto der Fußzeile sowie die Logos der IDTA und der Plattform Industrie 4.0 stammen von
        industrialdigitaltwin.org. Die Besucherbilder sind Grafiken aus einer festen Auswahl.
      </Absatz>
      <Titel>Kontakt</Titel>
      <Absatz>
        Fragen zum IDTA Passport an <a href="mailto:info@idtwin.org">info@idtwin.org</a>, zum
        Datenschutz an <a href="mailto:datenschutz@idtwin.org">datenschutz@idtwin.org</a>.
      </Absatz>
    </Rechtsseite>
  );
}

/** Derselbe Hinweis, dem Besucher am Terminal zustimmen, ohne Anmeldung lesbar. */
export function Datenschutz() {
  const abruf = useAbruf<{ fassung: string; abschnitte: Datenschutzabschnitt[] }>(
    "/api/datenschutz",
  );
  return (
    <Rechtsseite titel="Datenschutzhinweis">
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
  return (
    <Rechtsseite titel="Cookie-Einstellungen">
      <Absatz>
        Der IDTA Passport setzt <b className="text-text">nur ein technisch notwendiges Cookie</b>:
        das Sitzungscookie, das dich nach der Anmeldung angemeldet hält. Es entsteht erst mit der
        Anmeldung, enthält keine Werbe- oder Analysedaten und ist für Skripte nicht lesbar. Es
        verfällt nach 12 Stunden oder sobald du dich abmeldest.
      </Absatz>
      <Absatz>
        Analyse-, Tracking- oder Werbecookies gibt es nicht, auch keine Dienste von Drittanbietern,
        die Cookies setzen. Deshalb gibt es hier nichts ein- oder auszuschalten.
      </Absatz>
      <Absatz>
        Für das Standpersonal merkt sich der Browser im lokalen Speicher, ob in den Einstellungen
        die Entwickleransicht eingeschaltet ist. Das ist eine Einstellung, die man selbst vornimmt,
        und sie verlässt das Gerät nicht.
      </Absatz>
      <Absatz>
        Schriften und Bilder liefert der IDTA Passport selbst aus; beim Aufruf lädt er nichts von
        Drittanbietern. Das Kamerabild beim Scannen eines QR-Codes wertet nur dein Browser aus, es
        wird weder gespeichert noch übertragen.
      </Absatz>
    </Rechtsseite>
  );
}
