import { useState } from "react";
import { Link } from "react-router";
import { ApiFehler, api, useAbruf } from "../lib/api.js";
import { Abschnitt } from "../bausteine/basis.js";

/**
 * Die Exponate eines Besuchers, je eines mit Kästchen „aufgenommen“.
 *
 * Seit dem 02.11.2026 eines je Exponat statt je Dokument und Link: der Besucher nimmt das
 * ganze Exponat auf, indem er den QR-Code am Stand scannt, und sieht im Viewer immer alles,
 * was es gerade hat. Hier lässt sich das von Hand setzen oder zurücknehmen. **Jede Änderung
 * geht sofort hinaus**; ein Speichern-Knopf ließe die Kästchen etwas zeigen, das noch nicht gilt.
 */

interface ExponatSicht {
  id: string;
  kennung: string;
  name: string;
  besucht: boolean;
  zeitpunkt: number | null;
  anzahl: { dokumente: number; links: number; kontakte: number };
}

const zeit = new Intl.DateTimeFormat("de-DE", { dateStyle: "short", timeStyle: "short" });

export function BesucherExponate({
  guid,
  aufFehler,
}: {
  guid: string;
  aufFehler: (text: string | null) => void;
}) {
  const abruf = useAbruf<ExponatSicht[]>(`/api/besucher/${encodeURIComponent(guid)}/exponate`);
  const [sendet, setzeSendet] = useState(false);

  async function setze(exponatId: string, an: boolean) {
    setzeSendet(true);
    aufFehler(null);
    try {
      await api(`/api/besucher/${encodeURIComponent(guid)}/besuche/${exponatId}`, {
        method: an ? "PUT" : "DELETE",
      });
      abruf.neu();
    } catch (ursache) {
      aufFehler(ursache instanceof ApiFehler ? ursache.message : "Ändern nicht möglich.");
    } finally {
      setzeSendet(false);
    }
  }

  const liste = abruf.daten;
  const besucht = liste?.filter((e) => e.besucht).length ?? 0;

  return (
    <Abschnitt
      titel={
        <>
          Exponate ({besucht} von {liste?.length ?? 0} aufgenommen)
        </>
      }
    >
      {liste !== null && liste.length === 0 && (
        <p className="text-sm text-text-hinweis">Es gibt noch keine Exponate.</p>
      )}
      <ul className="flex flex-col divide-y divide-linie border border-linie">
        {liste?.map((e) => (
          <li
            key={e.id}
            className="flex min-h-[52px] flex-wrap items-center justify-between gap-3 px-4 py-2"
          >
            <label className="flex min-w-[15rem] flex-1 cursor-pointer items-center gap-3">
              <input
                type="checkbox"
                className="size-6 shrink-0 accent-primaer"
                aria-label={`${e.kennung} ${e.name} aufgenommen`}
                checked={e.besucht}
                disabled={sendet}
                onChange={(ev) => void setze(e.id, ev.target.checked)}
              />
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="text-[15px] font-semibold hyphens-auto">
                  <span className="mr-2 text-text-hinweis">{e.kennung}</span>
                  {e.name}
                </span>
                <span className="text-[13px] text-text-hinweis">
                  {e.anzahl.dokumente} Dok. · {e.anzahl.links} Links · {e.anzahl.kontakte} Kontakte
                  {e.zeitpunkt !== null && ` · aufgenommen ${zeit.format(e.zeitpunkt)}`}
                </span>
              </span>
            </label>
            <Link
              to={`/exponate/${e.id}`}
              className="ml-auto text-[13px] font-semibold text-primaer-dunkel"
            >
              Exponat ansehen
            </Link>
          </li>
        ))}
      </ul>
    </Abschnitt>
  );
}
