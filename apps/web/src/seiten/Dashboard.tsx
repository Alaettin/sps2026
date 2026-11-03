import { Link } from "react-router";
import { useAbruf } from "../lib/api.js";
import { Abschnitt, Flaeche, Seitenkopf, Ueberschrift, Zustand } from "../bausteine/basis.js";
import { useSprache } from "../lib/sprache.js";

interface Dashboarddaten {
  kennzahlen: {
    besucherGesamt: number;
    exponateGesamt: number;
    /** Admins und Betreuer zusammen. */
    personalGesamt: number;
    dokumenteGesamt: number;
    linksGesamt: number;
    /** Angelegte Personen, **nicht** ihre Zuweisungen an Exponate. */
    ansprechpartnerGesamt: number;
  };
  jeExponat: { id: string; kennung: string; name: string; besuche: number }[];
}

function Kennzahl({ text, wert }: { text: string; wert: number }) {
  return (
    <Flaeche className="flex flex-col gap-1 p-5">
      <span className="text-[11px] font-semibold tracking-[0.08em] text-text-hinweis uppercase">
        {text}
      </span>
      <span className="text-4xl font-medium tracking-[-0.01em] text-primaer">{wert}</span>
    </Flaeche>
  );
}

export function Dashboard() {
  const { t } = useSprache();
  const { daten, laedt, fehler } = useAbruf<Dashboarddaten>("/api/dashboard");
  const groesster = Math.max(1, ...(daten?.jeExponat.map((e) => e.besuche) ?? [0]));

  return (
    <>
      <Seitenkopf>
        <Ueberschrift>Dashboard</Ueberschrift>
      </Seitenkopf>
      <Zustand laedt={laedt} fehler={fehler}>
        {daten !== null && (
          <>
            {/*
              Sechs Kacheln in **einem** Raster, nicht zwei Rasterblöcke: bei drei Spalten
              bricht es von allein in zwei Reihen zu dritt um, und am Handy stehen sie
              untereinander, ohne dass eine Reihe für sich eine Regel braucht.
            */}
            {/*
              Eine benannte Gruppe, kein nacktes `div`: „Besucher" und „Exponate" stehen auch
              in der Hauptnavigation, und ohne Namen ist die Kachel von ihrem Reiter weder für
              einen Screenreader noch für eine Prüfung zu unterscheiden.
            */}
            <section
              aria-label={t("Kennzahlen", "Key figures")}
              className="grid gap-4 sm:grid-cols-3"
            >
              <Kennzahl text={t("Besucher", "Visitors")} wert={daten.kennzahlen.besucherGesamt} />
              <Kennzahl text={t("Exponate", "Exhibits")} wert={daten.kennzahlen.exponateGesamt} />
              <Kennzahl text={t("Personal", "Staff")} wert={daten.kennzahlen.personalGesamt} />
              <Kennzahl
                text={t("Dokumente", "Documents")}
                wert={daten.kennzahlen.dokumenteGesamt}
              />
              <Kennzahl text={t("Links", "Links")} wert={daten.kennzahlen.linksGesamt} />
              <Kennzahl
                text={t("Ansprechpartner", "Contacts")}
                wert={daten.kennzahlen.ansprechpartnerGesamt}
              />
            </section>

            <Abschnitt titel={t("Aufnahmen je Exponat", "Additions per exhibit")}>
              {daten.jeExponat.length === 0 ? (
                <p className="text-sm text-text-hinweis">
                  {t("Noch keine Exponate angelegt.", "No exhibits created yet.")}
                </p>
              ) : (
                <ul className="flex flex-col gap-3">
                  {daten.jeExponat.map((e) => (
                    <li key={e.id} className="flex flex-col gap-1.5">
                      <span className="flex items-baseline justify-between gap-4 text-sm">
                        <Link
                          to={`/exponate/${e.id}`}
                          className="font-semibold text-primaer-dunkel"
                        >
                          <span className="font-mono text-xs">{e.kennung}</span> {e.name}
                        </Link>
                        <span className="shrink-0 tabular-nums">{e.besuche}</span>
                      </span>
                      {/* Der Balken ist Zierde, die Zahl steht daneben: deshalb aria-hidden. */}
                      <span aria-hidden="true" className="h-2 w-full bg-linie">
                        <span
                          className="block h-full bg-primaer"
                          style={{
                            width: `${String(Math.round((e.besuche / groesster) * 100))}%`,
                          }}
                        />
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </Abschnitt>
          </>
        )}
      </Zustand>
    </>
  );
}
