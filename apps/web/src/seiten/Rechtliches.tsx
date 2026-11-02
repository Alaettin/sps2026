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

/** Wortgleich von industrialdigitaltwin.org/impressum, Stand 02.11.2026. */
export function Impressum() {
  return (
    <Rechtsseite titel="Impressum">
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
        <li>Dr. Matthias Bölke (Vorstandsvorsitzender);</li>
        <li>Dr. Horst Heinol-Heikkinen (Stellvertretender Vorstandsvorsitzender);</li>
        <li>Karsten Schneider (Schatzmeister);</li>
      </ul>
      <Absatz>
        Anschrift jeweils: Industrial Digital Twin Association e.V., Lyoner Straße 18, 60528
        Frankfurt am Main.
      </Absatz>
      <Absatz>Geschäftsführung:</Absatz>
      <ul className="list-disc pl-6 text-text-zweit">
        <li>Dr. Christian Mosch</li>
      </ul>
      <Absatz>Anschrift:</Absatz>
      <Absatz>
        Industrial Digital Twin Association e.V.
        <br />
        Lyoner Straße 18
        <br />
        60528 Frankfurt am Main
      </Absatz>
      <hr className="border-linie" />
      <Absatz>
        Industrial Digital Twin Applications GmbH (IDTA)
        <br />
        Lyoner Straße 18
        <br />
        60528 Frankfurt am Main
      </Absatz>
      <Absatz>
        E-Mail: <a href="mailto:info@idtwin.org">info@idtwin.org</a>
        <br />
        Telefon: <a href="tel:+4915154385054">+49 151 5438 5054</a>
      </Absatz>
      <Absatz>
        Registergericht: Amtsgericht Frankfurt am Main, HRB 138244
        <br />
        Umsatzsteuer-Identifikationsnummer gemäß § 27a UStG: DE453943742
      </Absatz>
      <Absatz>Vertretungsberechtigter Geschäftsführer: Meik Billmann</Absatz>
      <Absatz>Anschrift:</Absatz>
      <Absatz>
        Industrial Digital Twin Applications GmbH
        <br />
        Lyoner Straße 18
        <br />
        60528 Frankfurt am Main
      </Absatz>
      <hr className="border-linie" />
      <Absatz>Inhaltliche Verantwortliche gem. § 18 Abs. 2 MStV:</Absatz>
      <ul className="list-disc pl-6 text-text-zweit">
        <li>Dr. Christian Mosch</li>
        <li>Meik Billmann</li>
      </ul>
      <Titel>Haftungshinweis:</Titel>
      <Absatz>
        Für die Aktualität, Richtigkeit und Vollständigkeit der in dem Internetangebot des
        Industrial Digital Twin Association e.V. (nachfolgend „IDTA“) bereitgestellten Informationen
        wird keine Gewähr übernommen. Das Internetangebot des IDTA kann Verweise in Form von
        Hyperlinks auf Internetseiten Dritter enthalten. Auf die Inhalte dieser externen
        Internetseiten sowie die zugehörigen gehörigen Domains hat der IDTA keinen Einfluss.
      </Absatz>
      <Absatz>
        Sowohl für die Inhalte wie auch für die zugehörigen Domains sind die jeweiligen Anbieter
        bzw. Betreiber verantwortlich. Der IDTA übt keine inhaltliche Überwachung der verlinkten
        Internetseiten aus. Im Falle des Bekanntwerdens von konkreten Rechtsverletzungen werden
        entsprechende Links umgehend entfernt. Datenübertragungen im Internet, wie beispielsweise
        per E-Mail, bergen stets ein gewisses Sicherheitsrisiko.
      </Absatz>
      <Absatz>
        Ein absoluter Schutz von Daten vor unbefugtem Zugriff durch Dritte ist nicht möglich. Der
        IDTA weist daher auf dieses Sicherheitsrisiko hin und rät zu einem bedachten Umgang mit
        Kommunikationsmitteln. Der IDTA widerspricht der Nutzung der auf seinen Internetseiten
        veröffentlichten Kontaktdaten durch Dritte von nicht ausdrücklich angeforderter Werbung
        gleich welcher Form. Bei Zuwiderhandeln werden ausdrücklich rechtliche Schritte vorbehalten.
      </Absatz>
      <Titel>Bildmaterial:</Titel>
      <Absatz>
        Industrialdigitaltwin.org verwendet unter anderem Fotos und Grafiken von adobe.stock.com,
        Lenze SE, Homag Group AG
      </Absatz>
      <Titel>Redaktion:</Titel>
      <Absatz>
        Die Online-Redaktion erreichen Sie unter{" "}
        <a href="mailto:info@idtwin.org">info@idtwin.org</a>
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
    </Rechtsseite>
  );
}
