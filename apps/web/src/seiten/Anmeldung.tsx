import { useState, type FormEvent } from "react";
import { ApiFehler, api } from "../lib/api.js";
import { Feld, Fehlerhinweis, Knopf } from "../bausteine/basis.js";
import { Logoreihe } from "../bausteine/logos.js";

/**
 * Anmeldung mit E-Mail und Passwort.
 *
 * Es gibt **keine Selbstregistrierung** und kein "Passwort vergessen": Zugaenge vergibt die
 * Orga, und ein neues Startpasswort setzt ein Admin.
 */
export function Anmeldung({ aufAngemeldet }: { aufAngemeldet: () => void }) {
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
          ? "Zu viele Versuche. Bitte in einigen Minuten erneut probieren."
          : status === 0
            ? "Keine Verbindung zum Dienst."
            : "E-Mail oder Passwort ist nicht korrekt.",
      );
    } finally {
      setzeLaeuft(false);
    }
  }

  return (
    <div
      data-hintergrund
      className="relative min-h-screen overflow-hidden bg-primaer bg-linear-to-br from-primaer to-primaer-dunkel"
    >
      {/*
        **Im Stil des Heros auf industrialdigitaltwin.org**, seit dem 02.11.2026: Blau mit
        Punktraster, links die Überschrift in Weiß, rechts die helle Karte. Ohne Foto, damit
        keine fremden Bildrechte im Spiel sind. Das AXON-Keyvisual, das hier bis dahin stand,
        ist entfallen; die Logos stehen in der Karte.
      */}
      <span aria-hidden="true" className="punktmatrix absolute inset-0" />
      <div className="relative mx-auto flex min-h-screen max-w-spalte flex-col items-center justify-center gap-8 px-4 py-12 sm:px-8 lg:flex-row lg:justify-between lg:gap-16">
        <div className="flex w-full max-w-[420px] flex-col gap-3 text-white lg:max-w-xl lg:gap-5">
          <p className="text-[32px] leading-tight font-medium tracking-[-0.01em] lg:text-[56px]">
            IDTA Passport
          </p>
          <p className="text-[15px] leading-relaxed text-white/85 lg:text-lg">
            Der digitale Messepass der SPS 2026. Exponate scannen, Infos sammeln und alles später im
            Viewer wiederfinden.
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
              Anmelden
            </h1>
          </div>

          {fehler !== null && <Fehlerhinweis>{fehler}</Fehlerhinweis>}

          <form className="flex flex-col gap-4.5" onSubmit={(e) => void absenden(e)}>
            <label className="flex flex-col gap-2 text-[13px] font-semibold">
              E-Mail
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
              Passwort
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
              {laeuft ? "Wird geprüft …" : "Anmelden"}
            </Knopf>
          </form>
        </main>
      </div>
    </div>
  );
}
