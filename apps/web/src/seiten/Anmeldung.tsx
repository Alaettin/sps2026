import { useState, type FormEvent } from "react";
import { Link } from "react-router";
import { ApiFehler, api } from "../lib/api.js";
import { Feld, Fehlerhinweis, Knopf } from "../bausteine/basis.js";
import { Logoreihe } from "../bausteine/logos.js";
import { RECHTLICH } from "../bausteine/band.js";
import { Sprachwahl, useSprache } from "../lib/sprache.js";

/**
 * Anmeldung mit E-Mail und Passwort.
 *
 * Es gibt **keine Selbstregistrierung** und kein "Passwort vergessen": Zugaenge vergibt die
 * Orga, und ein neues Startpasswort setzt ein Admin.
 */
export function Anmeldung({ aufAngemeldet }: { aufAngemeldet: () => void }) {
  const { t } = useSprache();
  const [email, setzeEmail] = useState("");
  const [passwort, setzePasswort] = useState("");
  const [fehler, setzeFehler] = useState<string | null>(null);
  const [laeuft, setzeLaeuft] = useState(false);

  async function absenden(e: FormEvent) {
    e.preventDefault();
    setzeLaeuft(true);
    setzeFehler(null);
    try {
      await api("/api/auth/anmelden", {
        method: "POST",
        body: JSON.stringify({ email, passwort }),
      });
      aufAngemeldet();
    } catch (ursache) {
      /*
       * **Eine Meldung fuer jeden Fall**, wie im Entwurf: weder wird verraten, ob die
       * E-Mail bekannt ist, noch ob das Konto deaktiviert wurde. Eine Sperre mit Countdown
       * gibt es laut Design nicht.
       *
       * Der 429-Zweig bleibt stehen, obwohl die Anmeldegrenze am 09.10.2026 entfernt
       * wurde: andere Grenzen des Servers koennen ihn weiterhin ausloesen, und ein
       * unbehandelter 429 saehe aus wie ein falsches Passwort.
       */
      const status = ursache instanceof ApiFehler ? ursache.status : 0;
      setzeFehler(
        status === 429
          ? t(
              "Zu viele Versuche. Bitte in einigen Minuten erneut probieren.",
              "Too many attempts. Please try again in a few minutes.",
            )
          : status === 0
            ? t("Keine Verbindung zum Dienst.", "No connection to the service.")
            : t("E-Mail oder Passwort ist nicht korrekt.", "Email or password is not correct."),
      );
    } finally {
      setzeLaeuft(false);
    }
  }

  return (
    <div
      data-hintergrund
      className="relative flex min-h-screen flex-col overflow-hidden bg-primaer bg-linear-to-br from-primaer to-primaer-dunkel"
    >
      {/*
        **Im Stil des Heros auf industrialdigitaltwin.org**, seit dem 02.11.2026: Blau mit
        Punktraster, links die Überschrift in Weiß, rechts die helle Karte. Ohne Foto, damit
        keine fremden Bildrechte im Spiel sind. Das AXON-Keyvisual, das hier bis dahin stand,
        ist entfallen; die Logos stehen in der Karte.
      */}
      <span aria-hidden="true" className="punktmatrix absolute inset-0" />
      {/* Die Sprache oben rechts, wo ein Besucher sie zuerst sucht. Seit dem 03.11.2026. */}
      <div className="absolute top-4 right-4 z-10 sm:top-6 sm:right-8">
        <Sprachwahl hell />
      </div>
      <div className="relative mx-auto flex w-full max-w-spalte flex-1 flex-col items-center justify-center gap-8 px-4 py-12 sm:px-8 lg:flex-row lg:justify-between lg:gap-16">
        {/*
          Zwei Ebenen statt eines Absatzes, seit dem 02.11.2026: der eine Satz lief bei 640 px
          in drei Zeilen mit einem einzelnen Wort am Ende aus.
        */}
        <div className="flex w-full max-w-[420px] flex-col gap-3 text-white lg:max-w-xl lg:gap-4">
          <p className="text-[36px] leading-none font-semibold tracking-[-0.02em] lg:text-[64px]">
            IDTA Passport
          </p>
          <p className="text-xl leading-snug font-medium text-balance lg:text-[28px]">
            {t(
              "Dein digitaler Messepass für die SPS 2026",
              "Your digital trade fair pass for SPS 2026",
            )}
          </p>
          <p className="text-[15px] leading-relaxed text-balance text-white/80 lg:text-lg">
            {t(
              "QR-Code am Exponat scannen, alle Infos später im Viewer.",
              "Scan the QR code on an exhibit, find everything later in the viewer.",
            )}
          </p>
        </div>
        <main className="relative flex w-full max-w-[420px] flex-col gap-7 bg-flaeche p-6 shadow-[0_18px_48px_rgba(27,29,38,0.13)] sm:p-10">
          <div className="flex flex-col gap-5">
            {/*
            AXON und IDTA. Die Karte ist bei 390 px innen rund 310 px breit; die Masse im
            Baustein sind darauf abgestimmt.
          */}
            <Logoreihe art="anmeldung" />
            <h1 className="text-[32px] leading-tight font-medium tracking-[-0.01em] text-primaer">
              {t("Anmelden", "Sign in")}
            </h1>
          </div>

          {fehler !== null && <Fehlerhinweis>{fehler}</Fehlerhinweis>}

          <form className="flex flex-col gap-4.5" onSubmit={(e) => void absenden(e)}>
            <label className="flex flex-col gap-2 text-[13px] font-semibold">
              {t("E-Mail", "Email")}
              <Feld
                type="email"
                autoComplete="username"
                required
                value={email}
                onChange={(e) => {
                  setzeEmail(e.target.value);
                }}
              />
            </label>
            <label className="flex flex-col gap-2 text-[13px] font-semibold">
              {t("Passwort", "Password")}
              <Feld
                type="password"
                autoComplete="current-password"
                required
                value={passwort}
                onChange={(e) => {
                  setzePasswort(e.target.value);
                }}
              />
            </label>
            <Knopf type="submit" className="mt-1.5 h-12 text-base" disabled={laeuft}>
              {laeuft ? t("Wird geprüft …", "Checking …") : t("Anmelden", "Sign in")}
            </Knopf>
          </form>
        </main>
      </div>
      {/*
          **Keine grosse Fusszeile hier**, seit dem 03.11.2026: die IDTA-Fusszeile mit Foto und
          Spalten passte nach Ansicht des Nutzers nicht zum Anmeldebildschirm. Impressum und
          Datenschutz muessen trotzdem von jeder Seite aus erreichbar sein, deshalb diese
          schmale Zeile im Blau.
        */}
      <div className="relative mx-auto w-full max-w-spalte px-4 sm:px-8">
        <div className="flex flex-col gap-2 border-t border-white/20 py-5 text-[13px] text-white/80 sm:flex-row sm:items-center sm:justify-between">
          <span>© 2026 Industrial Digital Twin Association e.V.</span>
          <nav aria-label={t("Rechtliche Hinweise", "Legal information")}>
            <ul className="flex flex-wrap gap-x-5 gap-y-1">
              {RECHTLICH.map((l) => (
                <li key={l.ziel}>
                  <Link className="transition-colors hover:text-white" to={l.ziel}>
                    {t(l.text, l.en)}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        </div>
      </div>
    </div>
  );
}
