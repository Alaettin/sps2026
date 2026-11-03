import { NavLink, Outlet, useLocation, useNavigate } from "react-router";
import { DropdownMenu } from "radix-ui";
import { meldeAb } from "../lib/api.js";
import { Knopf, cn } from "../bausteine/basis.js";
import { Logoreihe } from "../bausteine/logos.js";
import { Band, Fusszeile } from "../bausteine/band.js";
import type { Ich } from "../lib/ich.js";
import { Sprachwahl, useSprache } from "../lib/sprache.js";

/**
 * Kopfzeile und Inhaltsspalte.
 *
 * **Ein Layout, eine Kopfzeile.** In den Entwuerfen ist sie in jede Datei kopiert; das ist
 * ein Artefakt des Werkzeugs und keine Vorgabe.
 *
 * **Zwei Formen derselben Navigation.** Ab `kopf` (1280 px) die Reiter in der Kopfzeile,
 * darunter ein Menue hinter drei Strichen. Seit dem 27.10.2026 stehen die Reiter in derselben
 * Zeile wie Logos und Abmelden und brauchen deshalb mehr Breite als frueher ab `lg`. Sieben Reiter passen bei 390 px nicht nebeneinander, und eine waagerecht
 * scrollbare Zeile versteckt genau das, was rechts steht: niemand sucht dort. Die Eintraege
 * kommen in beiden Formen aus derselben Liste, damit keine Form einen Punkt verliert.
 */

const REITER_HAUPT = [
  { pfad: "/", text: "Dashboard", en: "Dashboard", genau: true },
  { pfad: "/besucher", text: "Besucher", en: "Visitors" },
  { pfad: "/exponate", text: "Exponate", en: "Exhibits" },
  { pfad: "/nutzer", text: "Nutzer", en: "Users" },
  { pfad: "/globale-daten", text: "Globale Daten", en: "Global data" },
];

/**
 * Seltener gebraucht, in der Reiterzeile unter „Mehr“, seit dem 20.10.2026. Mit „Globale
 * Daten“ waren es zehn Reiter, und die Zeile bekam einen Scrollbalken. Im Menü hinter den
 * drei Strichen stehen sie weiter in einer Liste mit den anderen.
 */
const REITER_MEHR = [
  { pfad: "/api", text: "API", en: "API" },
  { pfad: "/monitoring", text: "Monitoring", en: "Monitoring" },
  { pfad: "/einstellungen", text: "Einstellungen", en: "Settings" },
];

const REITER_ADMIN = [...REITER_HAUPT, ...REITER_MEHR];

/** Ein Betreuer sieht nur seine Exponate und pflegt dort deren Inhalte. */
const REITER_BETREUER = [{ pfad: "/exponate", text: "Exponate", en: "Exhibits", genau: true }];

/**
 * Ein Reiter in der Kopfzeile, wie die Navigation von industrialdigitaltwin.org: grau, aktiv
 * blau, die Linie an der Unterkante der Kopfzeile. Fuer die Links und fuer „Mehr“.
 */
const REITER_KLASSEN = "flex h-full shrink-0 items-center px-2.5 text-[15px]";

function reiterZustand(aktiv: boolean): string {
  return aktiv
    ? "font-medium text-primaer shadow-[inset_0_-2px_0_var(--color-primaer)]"
    : "text-text-zweit hover:text-primaer";
}

interface Reiter {
  pfad: string;
  text: string;
  en: string;
  genau?: boolean;
}

/**
 * Ob ein Reiter zur aktuellen Seite gehört. **Aus dem Pfad bestimmt**, nicht nachgehalten:
 * ein zweiter Zustand neben der Adresse könnte abweichen. Dieselbe Regel wie `NavLink end`.
 */
function istAktiv(pathname: string, r: Reiter): boolean {
  return r.genau === true
    ? pathname === r.pfad
    : pathname === r.pfad || pathname.startsWith(`${r.pfad}/`);
}

export function Rahmen({ ich, aufAbmelden }: { ich: Ich; aufAbmelden: () => void }) {
  const { t } = useSprache();
  const navigate = useNavigate();
  const reiter = ich.rolle === "admin" ? REITER_ADMIN : REITER_BETREUER;
  const leiste = ich.rolle === "admin" ? REITER_HAUPT : REITER_BETREUER;
  const mehr = ich.rolle === "admin" ? REITER_MEHR : [];

  const abmelden = () => {
    void meldeAb().then(() => {
      aufAbmelden();
      void navigate("/anmeldung");
    });
  };

  return (
    <div className="flex min-h-screen flex-col bg-grund text-text">
      {/*
        **Eine Zeile wie bei industrialdigitaltwin.org:** Logos, Name, Reiter, rechts Name und
        Abmelden, alles in derselben Spalte wie Seitenkopf und Fusszeile. Bis zum 27.10.2026
        waren es zwei Zeilen mit verschiedenen Kanten (Logos am Fensterrand, Reiter auf 992 px
        zentriert), und nichts stand untereinander.

        Schatten statt Linie; `z-10` hebt ihn ueber das Band. Die Kopfzeile klebt nicht.
      */}
      <header className="relative z-10 bg-flaeche shadow-kopf">
        <div className="mx-auto flex h-[72px] max-w-spalte items-center gap-3 px-4 sm:gap-4 sm:px-8">
          {/*
            **Nur eine `Logoreihe`** fuer alle Breiten. Bei 390 px passen beide Logos und die
            drei Striche in eine Zeile; die eigene Logozeile fuer schmale Fenster entfiel.
          */}
          <Logoreihe art="kopf" zurStartseite className="shrink-0 justify-start" />
          <span aria-hidden="true" className="hidden h-7 w-px shrink-0 bg-linie sm:block" />
          {/*
            Nur **einmal** der Name, blau und gesperrt. Unter `sm` ausgeblendet, damit Logos
            und Menue Platz haben; er bleibt ein Element, die Abnahme zaehlt ihn.
          */}
          <span className="hidden shrink-0 text-xs font-semibold tracking-[0.14em] text-primaer-dunkel sm:inline">
            {ich.appName === "" ? "IDTA Passport" : ich.appName}
          </span>

          <nav
            aria-label={t("Hauptnavigation", "Main navigation")}
            className="hidden h-full kopf:block"
          >
            {/* Kein `overflow-x-auto`: die Zeile passt, und ein Scrollbalken versteckt. */}
            <div className="flex h-full">
              {leiste.map((r) => (
                <NavLink
                  key={r.pfad}
                  to={r.pfad}
                  end={r.genau === true}
                  className={({ isActive }) => cn(REITER_KLASSEN, reiterZustand(isActive))}
                >
                  {t(r.text, r.en)}
                </NavLink>
              ))}
              {mehr.length > 0 && <MehrMenue reiter={mehr} />}
            </div>
          </nav>

          {/* Ab `sm`: Name und Abmelden stehen offen in der Kopfzeile. */}
          <span className="ml-auto hidden min-w-0 items-center gap-3 sm:flex">
            <span className="min-w-0 truncate text-sm font-medium">{ich.name}</span>
            <Sprachwahl />
            <Knopf art="rand" className="h-[34px] shrink-0 px-3.5 text-[13px]" onClick={abmelden}>
              {t("Abmelden", "Sign out")}
            </Knopf>
          </span>

          {/* Unter `kopf`: alles im Menue. Ab `sm` steht davor schon Name und Abmelden. */}
          <span className="ml-auto flex sm:ml-0 kopf:hidden">
            <Hauptmenue reiter={reiter} ich={ich} aufAbmelden={abmelden} />
          </span>
        </div>
      </header>

      <Band />
      <main className="relative mx-auto -mt-20 flex w-full max-w-spalte flex-1 flex-col gap-6 px-4 pb-16 sm:-mt-24 sm:px-8">
        <Outlet />
      </main>
      <Fusszeile />
    </div>
  );
}

/**
 * Die drei Striche und das, was darunter aufklappt.
 *
 * Radix statt Eigenbau: Tastaturbedienung, Fokusfalle, Escape, Scroll-Sperre und
 * `aria-expanded` sind hier keine Kuer. Ein handgebautes Menue hat davon erfahrungsgemaess
 * die Haelfte, und was fehlt, faellt erst am Stand auf.
 *
 * Der aktive Eintrag wird **aus dem Pfad** bestimmt und nicht nachgehalten: ein zweiter
 * Zustand neben der Adresse koennte abweichen, und dann zeigte das Menue etwas anderes als
 * die Seite. Dieselbe Regel wie bei `NavLink end`.
 */
function Hauptmenue({
  reiter,
  ich,
  aufAbmelden,
}: {
  reiter: Reiter[];
  ich: Ich;
  aufAbmelden: () => void;
}) {
  const { t } = useSprache();
  const navigate = useNavigate();
  const { pathname } = useLocation();

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <button
          type="button"
          aria-label={t("Menü", "Menu")}
          className="flex size-10 items-center justify-center border border-linie text-text"
        >
          <svg
            width="22"
            height="22"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            aria-hidden="true"
          >
            <path d="M4 7h16" />
            <path d="M4 12h16" />
            <path d="M4 17h16" />
          </svg>
        </button>
      </DropdownMenu.Trigger>

      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="end"
          sideOffset={6}
          className="z-50 flex w-[min(16rem,calc(100vw-2rem))] flex-col bg-flaeche py-1 shadow-[0_18px_48px_rgba(27,29,38,0.22)]"
        >
          {reiter.map((r) => (
            <DropdownMenu.Item
              key={r.pfad}
              onSelect={() => {
                void navigate(r.pfad);
              }}
              className={cn(
                "flex h-11 cursor-pointer items-center px-4 text-sm outline-none select-none",
                "data-[highlighted]:bg-grund",
                istAktiv(pathname, r)
                  ? "font-semibold text-primaer shadow-[inset_3px_0_0_var(--color-primaer)]"
                  : "font-medium text-text-hinweis",
              )}
            >
              {t(r.text, r.en)}
            </DropdownMenu.Item>
          ))}

          <DropdownMenu.Separator className="my-1 h-px bg-linie" />
          {/* Unter `sm` steht die Sprachwahl nicht in der Kopfzeile, also hier. */}
          <div className="px-2.5 py-1 sm:hidden">
            <Sprachwahl />
          </div>

          {/*
            Der Name steht hier als Beschriftung, nicht als Eintrag: er ist nichts zum
            Anklicken, und ein Label faengt keinen Tastaturfokus.
          */}
          <DropdownMenu.Label className="truncate px-4 pt-1 pb-2 text-xs text-text-hinweis">
            {t("Angemeldet als", "Signed in as")} {ich.name}
          </DropdownMenu.Label>
          <DropdownMenu.Item
            onSelect={aufAbmelden}
            className="flex h-11 cursor-pointer items-center px-4 text-sm font-medium text-text outline-none select-none data-[highlighted]:bg-grund"
          >
            {t("Abmelden", "Sign out")}
          </DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}

/**
 * „Mehr ▾“ am Ende der Reiterzeile.
 *
 * Sieht aus wie ein Reiter und ist unterstrichen, wenn die aktuelle Seite darin steckt; dann
 * steht dort deren Name statt „Mehr“, damit man sieht, wo man ist.
 */
function MehrMenue({ reiter }: { reiter: Reiter[] }) {
  const { t } = useSprache();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const aktiv = reiter.find((r) => istAktiv(pathname, r));

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <button
          type="button"
          className={cn(REITER_KLASSEN, "gap-1.5", reiterZustand(aktiv !== undefined))}
        >
          {aktiv === undefined ? t("Mehr", "More") : t(aktiv.text, aktiv.en)}
          <span aria-hidden="true" className="text-xs">
            ▾
          </span>
        </button>
      </DropdownMenu.Trigger>

      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="end"
          sideOffset={2}
          className="z-50 flex min-w-[12rem] flex-col bg-flaeche py-1 shadow-[0_18px_48px_rgba(27,29,38,0.22)]"
        >
          {reiter.map((r) => (
            <DropdownMenu.Item
              key={r.pfad}
              onSelect={() => {
                void navigate(r.pfad);
              }}
              className={cn(
                "flex h-11 cursor-pointer items-center px-4 text-sm outline-none select-none",
                "data-[highlighted]:bg-grund",
                istAktiv(pathname, r)
                  ? "font-semibold text-primaer shadow-[inset_3px_0_0_var(--color-primaer)]"
                  : "font-medium text-text-hinweis",
              )}
            >
              {t(r.text, r.en)}
            </DropdownMenu.Item>
          ))}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
