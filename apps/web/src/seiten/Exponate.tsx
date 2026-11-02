import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router";
import { ApiFehler, api, useAbruf } from "../lib/api.js";
import { Blaetterleiste, useBlaettern } from "../bausteine/blaettern.js";
import {
  Fehlerhinweis,
  Feld,
  Flaeche,
  Knopf,
  Kopfzelle,
  Markierung,
  Reihe,
  Seitenkopf,
  Tabellenflaeche,
  Ueberschrift,
  Zaehlerreihe,
  Zelle,
  Zustand,
} from "../bausteine/basis.js";
import type { Ich } from "../lib/ich.js";

interface Exponatzeile {
  id: string;
  kennung: string;
  name: string;
  beschreibung: string | null;
  anzahl: { dokumente: number; links: number; kontakte: number };
}

/**
 * Für wen die Weiterleitung ins Exponat schon geschah, **je Anmeldung**.
 *
 * Ein `useRef` lebte nur so lange wie die eingehängte Seite: „Zurück zur Liste“ hängt sie neu
 * ein, und es ginge sofort wieder ins Exponat. An die Id gebunden, damit der nächste Betreuer
 * am selben Gerät wieder direkt dort landet.
 */
let weitergeleitetFuer: string | null = null;

export function Exponate({ ich }: { ich: Ich }) {
  const navigate = useNavigate();
  const { daten, laedt, fehler } = useAbruf<Exponatzeile[]>("/api/exponate");
  const { seite, zuSeite, sichtbar, gesamt } = useBlaettern(daten ?? []);

  /*
   * **Ein Betreuer mit genau einem Exponat landet direkt in dessen Pflege**, seit dem
   * 02.11.2026 (vorher im Scan, den es nicht mehr gibt). Eine Liste mit einem Eintrag muss
   * niemand durchklicken. Nur einmal je Anmeldung, sonst kommt er nie zur Liste zurück.
   */
  useEffect(() => {
    if (weitergeleitetFuer === ich.id || daten === null || ich.rolle === "admin") return;
    if (daten.length === 1 && daten[0] !== undefined) {
      weitergeleitetFuer = ich.id;
      void navigate(`/exponate/${daten[0].id}`, { replace: true });
    }
  }, [daten, ich.id, ich.rolle, navigate]);

  const [anlegen, setzeAnlegen] = useState(false);
  const [name, setzeName] = useState("");
  const [anlegefehler, setzeAnlegefehler] = useState<string | null>(null);

  const istAdmin = ich.rolle === "admin";

  return (
    <>
      <Seitenkopf>
        <Ueberschrift>Exponate</Ueberschrift>
        {istAdmin && (
          <Knopf
            onClick={() => {
              setzeAnlegen((a) => !a);
            }}
          >
            Exponat anlegen
          </Knopf>
        )}
      </Seitenkopf>

      {istAdmin && anlegen && (
        <Flaeche className="flex flex-col gap-4 p-6">
          {anlegefehler !== null && <Fehlerhinweis>{anlegefehler}</Fehlerhinweis>}
          <form
            className="flex flex-wrap items-end gap-4"
            onSubmit={(e) => {
              e.preventDefault();
              setzeAnlegefehler(null);
              void api<{ id: string }>("/api/exponate", {
                method: "POST",
                body: JSON.stringify({ name }),
              })
                .then((angelegt) => {
                  setzeName("");
                  setzeAnlegen(false);
                  void navigate(`/exponate/${angelegt.id}`);
                })
                .catch((u: unknown) => {
                  setzeAnlegefehler(u instanceof ApiFehler ? u.message : "Anlegen nicht möglich.");
                });
            }}
          >
            <label className="flex min-w-[16rem] flex-1 flex-col gap-2 text-[13px] font-semibold">
              Name
              <Feld
                required
                value={name}
                onChange={(e) => {
                  setzeName(e.target.value);
                }}
              />
            </label>
            <Knopf type="submit">Anlegen</Knopf>
          </form>
        </Flaeche>
      )}

      <Zustand
        laedt={laedt}
        fehler={fehler}
        leer={daten !== null && daten.length === 0}
        leerText={
          istAdmin
            ? "Noch keine Exponate angelegt."
            : "Dir ist noch kein Exponat zugewiesen. Melde dich bei der Orga."
        }
      >
        <Tabellenflaeche>
          <table className="w-full border-collapse text-sm max-sm:block sm:min-w-[720px]">
            <thead className="max-sm:hidden">
              <tr>
                <Kopfzelle>Kennung</Kopfzelle>
                <Kopfzelle>Name</Kopfzelle>
                <Kopfzelle>Inhalte</Kopfzelle>
                <Kopfzelle>Status</Kopfzelle>
                <Kopfzelle className="text-right">
                  <span className="sr-only">Aktion</span>
                </Kopfzelle>
              </tr>
            </thead>
            <tbody className="max-sm:block">
              {sichtbar.map((e) => (
                <Reihe key={e.id}>
                  <Zelle titel="Kennung" className="font-mono text-xs font-semibold">
                    {e.kennung}
                  </Zelle>
                  <Zelle className="font-semibold">{e.name}</Zelle>
                  <Zelle titel="Inhalte">
                    <Zaehlerreihe
                      className="max-sm:justify-end"
                      werte={[
                        { zahl: e.anzahl.dokumente, text: "Dok." },
                        { zahl: e.anzahl.links, text: "Links" },
                        { zahl: e.anzahl.kontakte, text: "Kontakte" },
                      ]}
                    />
                  </Zelle>
                  <Zelle titel="Status">
                    {e.anzahl.dokumente + e.anzahl.links + e.anzahl.kontakte > 0 ? (
                      <Markierung text="BEREIT" />
                    ) : (
                      <Markierung text="OHNE INHALT" farbe="var(--color-fehler)" />
                    )}
                  </Zelle>
                  <Zelle className="text-right">
                    <Link
                      to={`/exponate/${e.id}`}
                      className="text-[13px] font-semibold whitespace-nowrap text-primaer-dunkel"
                    >
                      Bearbeiten →
                    </Link>
                  </Zelle>
                </Reihe>
              ))}
            </tbody>
          </table>
        </Tabellenflaeche>
      </Zustand>

      <Blaetterleiste seite={seite} gesamt={gesamt} aufSeite={zuSeite} />
    </>
  );
}
