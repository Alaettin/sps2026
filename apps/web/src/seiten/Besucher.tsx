import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router";
import { useAbruf } from "../lib/api.js";
import { Blaetterleiste } from "../bausteine/blaettern.js";
import {
  Feld,
  Knopf,
  Kopfzelle,
  Monowert,
  Reihe,
  Seitenkopf,
  Tabellenflaeche,
  Ueberschrift,
  Zelle,
  Zustand,
} from "../bausteine/basis.js";
import { useSprache } from "../lib/sprache.js";

interface Besucherzeile {
  guid: string;
  vorname: string;
  nachname: string;
  firma: string | null;
  position: string | null;
  email: string | null;
}

interface Liste {
  eintraege: Besucherzeile[];
  gesamt: number;
  seite: { nummer: number; groesse: number };
}

export function Besucher() {
  const { t } = useSprache();
  const [parameter, setzeParameter] = useSearchParams();
  const suche = parameter.get("suche") ?? "";
  const seite = Number(parameter.get("seite") ?? "1");

  /*
   * Das Eingabefeld haelt seinen eigenen Zustand und schreibt ihn **verzoegert** in die
   * Adresse. Ohne die Verzoegerung liefe je Tastendruck eine Anfrage, und die Adresse
   * bekaeme einen Verlaufseintrag je Buchstabe.
   */
  const [eingabe, setzeEingabe] = useState(suche);
  useEffect(() => {
    const uhr = setTimeout(() => {
      if (eingabe === suche) return;
      setzeParameter(eingabe === "" ? {} : { suche: eingabe }, { replace: true });
    }, 250);
    return () => {
      clearTimeout(uhr);
    };
  }, [eingabe, suche, setzeParameter]);

  const pfad = `/api/besucher?seite=${String(seite)}&groesse=25${suche === "" ? "" : `&suche=${encodeURIComponent(suche)}`}`;
  const { daten, laedt, fehler } = useAbruf<Liste>(pfad);

  const gesamt = daten?.gesamt ?? 0;

  function zuSeite(nummer: number) {
    const neu: Record<string, string> = { seite: String(nummer) };
    if (suche !== "") neu["suche"] = suche;
    setzeParameter(neu);
  }

  return (
    <>
      <Seitenkopf>
        <Ueberschrift>{t("Besucher", "Visitors")}</Ueberschrift>
        <div className="flex flex-wrap gap-2.5">
          {/* Der CSV-Import ist seit dem 23.10.2026 abgeschaltet, siehe `app.ts` im Server. */}
          <Link to="/besucher/neu">
            <Knopf>{t("Besucher anlegen", "Add visitor")}</Knopf>
          </Link>
        </div>
      </Seitenkopf>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <Feld
          type="search"
          placeholder={t("Nach Name, Firma, E-Mail oder GUID", "By name, company, email or GUID")}
          aria-label={t("Suchen", "Search")}
          className="w-full max-w-[320px]"
          value={eingabe}
          onChange={(e) => {
            setzeEingabe(e.target.value);
          }}
        />
        <span className="text-[13px] text-text-hinweis">
          {gesamt} {gesamt === 1 ? t("Besucher", "visitor") : t("Besucher", "visitors")}
        </span>
      </div>

      <Zustand
        laedt={laedt}
        fehler={fehler}
        leer={daten !== null && daten.eintraege.length === 0}
        leerText={
          suche === ""
            ? t("Noch keine Besucher. Lege einen von Hand an.", "No visitors yet. Add one by hand.")
            : t("Kein Besucher passt zu dieser Suche.", "No visitor matches this search.")
        }
      >
        <Tabellenflaeche>
          <table className="w-full border-collapse text-sm max-sm:block sm:min-w-[800px]">
            <thead className="max-sm:hidden">
              <tr>
                <Kopfzelle>{t("Name", "Name")}</Kopfzelle>
                <Kopfzelle>{t("Firma und Position", "Company and position")}</Kopfzelle>
                <Kopfzelle>{t("E-Mail", "Email")}</Kopfzelle>
                <Kopfzelle>GUID</Kopfzelle>
                <Kopfzelle className="text-right">
                  <span className="sr-only">{t("Aktion", "Action")}</span>
                </Kopfzelle>
              </tr>
            </thead>
            <tbody className="max-sm:block">
              {daten?.eintraege.map((b) => (
                <Reihe key={b.guid}>
                  <Zelle className="font-semibold">
                    {b.vorname} {b.nachname}
                  </Zelle>
                  <Zelle titel={t("Firma", "Company")}>
                    <span className="flex flex-col gap-0.5">
                      <span className="font-medium">{b.firma ?? "—"}</span>
                      {b.position !== null && (
                        <span className="text-xs text-text-hinweis">{b.position}</span>
                      )}
                    </span>
                  </Zelle>
                  <Zelle titel={t("E-Mail", "Email")} className="text-text-zweit">
                    {b.email ?? "—"}
                  </Zelle>
                  <Zelle titel="GUID" className="py-1.5">
                    <Monowert wert={b.guid} kurz />
                  </Zelle>
                  <Zelle className="text-right">
                    <Link
                      to={`/besucher/${b.guid}`}
                      className="text-[13px] font-semibold whitespace-nowrap text-primaer-dunkel"
                    >
                      {t("Ansehen", "View")} →
                    </Link>
                  </Zelle>
                </Reihe>
              ))}
            </tbody>
          </table>
        </Tabellenflaeche>
      </Zustand>

      <Blaetterleiste seite={seite} gesamt={gesamt} jeSeite={25} aufSeite={zuSeite} />
    </>
  );
}
