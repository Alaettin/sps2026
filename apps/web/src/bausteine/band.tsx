import { Link } from "react-router";
import bildFusszeile from "../assets/idta/bild-footer.jpg";
import mitglied from "../assets/idta/mitglied.svg";
import plattformI40 from "../assets/idta/plattform-industrie-4-0.png";
import { useSprache } from "../lib/sprache.js";

/**
 * Die zwei blauen Flaechen nach industrialdigitaltwin.org: das Band unter der Kopfzeile und
 * die Fusszeile.
 *
 * Gebraucht im Verwaltungsrahmen, im Bereich des Besuchers (`/mein`), auf der Anmeldung und den
 * Rechtsseiten. Der Kiosk-Ablauf hat beides nicht: dort stehen die Titel mitten in den
 * Schritten, unten klebt die Knopfleiste, und vom Tablet soll kein Weg nach aussen fuehren.
 */

/**
 * Das blaue Band. **Die Hauptspalte muss es mit negativem Rand ueberlappen** (`-mt-20
 * sm:-mt-24`), damit der Seitenkopf darauf liegt wie das weisse Feld der Vorlage auf ihrem
 * Bild. Die Hoehe hier und der Rand dort gehoeren zusammen.
 */
export function Band() {
  return (
    <div aria-hidden="true" className="relative h-28 overflow-hidden bg-primaer sm:h-36">
      <span className="punktmatrix absolute inset-y-0 right-0 w-2/3" />
    </div>
  );
}

const EXTERN = { target: "_blank", rel: "noopener noreferrer" } as const;

/** Auf Englisch die englischen Seiten der IDTA, wie deren eigene Fusszeile unter `/en/`. */
const NUETZLICH = [
  {
    text: "Mitglied werden",
    en: "Become a member",
    ziel: "https://industrialdigitaltwin.org/ueber-idta/mitglied-werden",
    zielEn: "https://industrialdigitaltwin.org/en/about-idta/become-a-member-en",
  },
  {
    text: "Kontakt",
    en: "Contact",
    ziel: "https://industrialdigitaltwin.org/kontakt",
    zielEn: "https://industrialdigitaltwin.org/en/contact",
  },
  {
    text: "Use Cases",
    en: "Use Cases",
    ziel: "https://industrialdigitaltwin.org/use-cases",
    zielEn: "https://industrialdigitaltwin.org/en/use-cases",
  },
  {
    text: "Newsletter abonnieren",
    en: "Subscribe to newsletter",
    ziel: "https://tff74802a.emailsys1a.net/3/7950/2c74420202/subscribe/form.html?_g=1699349471",
    zielEn: "https://tff74802a.emailsys1a.net/3/7950/2c74420202/subscribe/form.html?_g=1699349471",
  },
];

/**
 * Bei der IDTA fuehren diese drei auf deren Seiten; hier auf die eigenen der App. Auch die
 * Linkzeile der Anmeldung nutzt sie. Seit dem 03.11.2026 je Sprache eine eigene Adresse
 * (`App.tsx` kennt beide).
 */
export const RECHTLICH = [
  { text: "Impressum", en: "Imprint", ziel: "/impressum", zielEn: "/imprint" },
  { text: "Datenschutz", en: "Privacy", ziel: "/datenschutz", zielEn: "/privacy" },
  {
    text: "Cookie-Einstellungen",
    en: "Cookie settings",
    ziel: "/cookie-einstellungen",
    zielEn: "/cookie-settings",
  },
];

const SOZIAL = [
  {
    name: "GitHub",
    ziel: "https://github.com/admin-shell-io",
    box: "0 0 24 24",
    pfad: "M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12",
  },
  {
    name: "LinkedIn",
    ziel: "https://www.linkedin.com/company/industrial-digital-twin-association/",
    box: "0 0 448 512",
    pfad: "M100.28 448H7.4V148.9h92.88zM53.79 108.1C24.09 108.1 0 83.5 0 53.8a53.79 53.79 0 0 1 107.58 0c0 29.7-24.1 54.3-53.79 54.3zM447.9 448h-92.68V302.4c0-34.7-.7-79.2-48.29-79.2-48.29 0-55.69 37.7-55.69 76.7V448h-92.78V148.9h89.08v40.8h1.3c12.4-23.5 42.69-48.3 87.88-48.3 94 0 111.28 61.9 111.28 142.3V448z",
  },
  {
    name: "YouTube",
    ziel: "https://www.youtube.com/channel/UCvYk-bRkF9-x0HdpJfEcV7g",
    box: "0 0 576 512",
    pfad: "M549.655 124.083c-6.281-23.65-24.787-42.276-48.284-48.597C458.781 64 288 64 288 64S117.22 64 74.629 75.486c-23.497 6.322-42.003 24.947-48.284 48.597-11.412 42.867-11.412 132.305-11.412 132.305s0 89.438 11.412 132.305c6.281 23.65 24.787 41.5 48.284 47.821C117.22 448 288 448 288 448s170.78 0 213.371-11.486c23.497-6.321 42.003-24.171 48.284-47.821 11.412-42.867 11.412-132.305 11.412-132.305s0-89.438-11.412-132.305zm-317.51 213.508V175.185l142.739 81.205-142.739 81.201z",
  },
];

/** Farben und Masse aus dem Stylesheet der Vorlage: Grau #c7c7c7, Hover Orange #ff500f. */
const LINK = "text-sm text-[#c7c7c7] transition-colors duration-300 hover:text-fokus";
const TITEL =
  "mb-4 border-b border-white/25 pb-2 text-xs tracking-[0.25em] text-[#c7c7c7] uppercase";

/**
 * Die Fusszeile von industrialdigitaltwin.org, seit dem 02.11.2026 **im Aufbau eins zu eins**:
 * Foto unter 90 % Blau, Anschrift mit Logos, Nuetzliche Links, Rechtliche Hinweise, darunter
 * Copyright und die drei Kanaele. Die Nuetzlichen Links zeigen auf die IDTA, die Rechtlichen
 * auf die eigenen Seiten der App.
 *
 * Abweichung: das Copyright ist #a8a8a8 statt #8b8b8b; das Grau der Vorlage liegt auf dem Blau
 * unter WCAG AA.
 *
 * Das IDTA-Logo hier ist ein SVG mit eigenem Namen, nicht das `img` „IDTA“ der Kopfzeile;
 * `e2e/logos.ts` zaehlt genau jenes, um doppelte Kopfzeilen zu finden.
 */
export function Fusszeile() {
  const { sprache, t } = useSprache();
  return (
    <footer
      className="relative bg-cover bg-center bg-no-repeat px-4 pt-8 pb-4 md:px-8"
      style={{ backgroundImage: `url(${bildFusszeile})` }}
    >
      <div aria-hidden="true" className="absolute inset-0 bg-primaer opacity-90" />
      <div className="relative mx-auto flex w-full max-w-spalte flex-row flex-wrap py-16">
        <div className="w-full sm:w-1/2 sm:pr-8 md:w-1/4">
          <svg
            role="img"
            aria-label="Industrial Digital Twin Association"
            className="mb-4 w-full max-w-[200px]"
            viewBox="0 0 179.24 39.022"
          >
            <path
              fill="#d0d0d0"
              d="M0 0h11.342v39.021H0zM142.969 0h-33.573v9.656h11.115v29.365h11.342V9.656h11.116V0zM90.555 0H16.04v39.022h74.515A18.441 18.441 0 0 0 109 20.581V18.44A18.44 18.44 0 0 0 90.555 0Zm7.284 21.02a8.784 8.784 0 0 1-8.784 8.78H27.38V9.233h61.675a8.785 8.785 0 0 1 8.784 8.785ZM150.1 39.021l1.9-5.709h13.216l1.9 5.709h12.124L164.778 0h-11.632l-14.407 39.02Zm7.033-21.221q.544-1.529.983-3.221.217-.929.491-1.8h.109q.273.875.492 1.8.436 1.692.983 3.221l2.457 7.646h-8.082Z"
            />
          </svg>
          <div className="mb-6 flex flex-col gap-4 text-sm text-[#c7c7c7]">
            <p>
              Industrial Digital Twin Association e. V.
              <br />
              Lyoner Straße 18 60528 Frankfurt am Main
            </p>
            <p>
              {t("Telefon:", "Phone:")}{" "}
              <a className={LINK} href="tel:+496966031939">
                +49 69 6603 1939
              </a>
              <br />
              {t("E-Mail:", "Email:")}{" "}
              <a className={LINK} href="mailto:info@idtwin.org">
                info@idtwin.org
              </a>
            </p>
          </div>
          <a href="https://www.plattform-i40.de/IP/Navigation/DE/Home/home.html" {...EXTERN}>
            <img
              className="mb-8 w-full max-w-[200px]"
              src={plattformI40}
              alt="Plattform INDUSTRIE 4.0"
            />
          </a>
        </div>

        <nav
          aria-label={t("Nützliche Links", "Useful links")}
          className="mb-6 w-full sm:w-1/2 sm:pl-4 md:w-1/4 md:px-8"
        >
          <h3 className={TITEL}>{t("Nützliche Links", "Useful links")}</h3>
          <ul>
            {NUETZLICH.map((l, i) => (
              <li key={l.ziel} className="mb-2">
                <a
                  className={`${LINK} ${i === 0 ? "inline-flex items-center gap-2" : ""}`}
                  href={sprache === "de" ? l.ziel : l.zielEn}
                  {...EXTERN}
                >
                  {i === 0 && <img src={mitglied} alt="" className="h-[19px] w-[26px]" />}
                  {t(l.text, l.en)}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        <nav
          aria-label={t("Rechtliche Hinweise", "Legal information")}
          className="mb-6 w-full sm:w-1/2 sm:pr-4 md:w-1/4 md:px-8"
        >
          <h3 className={TITEL}>{t("Rechtliche Hinweise", "Legal information")}</h3>
          <ul>
            {RECHTLICH.map((l) => (
              <li key={l.ziel} className="mb-2">
                <Link className={LINK} to={sprache === "de" ? l.ziel : l.zielEn}>
                  {t(l.text, l.en)}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </div>

      <div className="relative mx-auto flex w-full max-w-[1440px] flex-row flex-wrap border-t border-white/25 pt-2">
        <div className="w-1/3" />
        <p className="w-1/3 pt-6 pb-4 text-center text-xs leading-4 text-[#a8a8a8] md:pt-8 md:pb-6">
          Copyright © 2026
          <br />
          Industrial Digital Twin Association e.V.
        </p>
        <ul className="flex w-1/3 flex-row justify-end gap-4 pt-4">
          {SOZIAL.map((s) => (
            <li key={s.name}>
              <a
                href={s.ziel}
                {...EXTERN}
                aria-label={t(`IDTA auf ${s.name}`, `IDTA on ${s.name}`)}
                className="flex h-4 w-4 items-center text-[#c7c7c7] transition-colors duration-300 hover:text-white"
              >
                <svg aria-hidden="true" className="h-4 w-4" viewBox={s.box}>
                  <path fill="currentColor" d={s.pfad} />
                </svg>
              </a>
            </li>
          ))}
        </ul>
      </div>
    </footer>
  );
}
