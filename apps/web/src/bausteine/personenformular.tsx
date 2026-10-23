import { Feld, Flaeche } from "./basis.js";
import { GRUPPEN, felderDerGruppe, pflichtBeimBesucher } from "../lib/personenfelder.js";

/**
 * Die Personenfelder eines Besuchers, je Gruppe eine Fläche, für Bildschirme im Stehen.
 *
 * Genutzt bei der Registrierung am Tablet und im Bereich des angemeldeten Besuchers. Die
 * Werte hält die Seite; der Baustein meldet nur Änderungen.
 */
export function Personenformular({
  werte,
  aufAenderung,
}: {
  werte: Record<string, string>;
  aufAenderung: (feld: string, wert: string) => void;
}) {
  return (
    <>
      {/*
        Je Gruppe eine Fläche. Am Tablet steht jemand dabei und tippt im Stehen; elf Felder am
        Stück sind dort mehr im Weg als am Schreibtisch.
      */}
      {GRUPPEN.map((gruppe) => (
        <Flaeche key={gruppe} className="flex flex-col gap-5 p-7">
          <h2 className="text-[11px] font-semibold tracking-[0.08em] text-text-hinweis uppercase">
            {gruppe}
          </h2>
          <div className="grid gap-5 sm:grid-cols-2">
            {felderDerGruppe(gruppe).map((f) => (
              <label key={f.name} className="flex flex-col gap-2 text-[14px] font-semibold">
                <span>
                  {f.text}
                  {pflichtBeimBesucher(f) && (
                    <span aria-hidden="true" className="text-fehler">
                      {" "}
                      *
                    </span>
                  )}
                </span>
                {pflichtBeimBesucher(f) && <span className="sr-only">Pflichtfeld</span>}
                <Feld
                  type={f.typ ?? "text"}
                  required={pflichtBeimBesucher(f)}
                  className="h-12 text-[16px] font-normal"
                  value={werte[f.name] ?? ""}
                  onChange={(ev) => {
                    aufAenderung(f.name, ev.target.value);
                  }}
                />
              </label>
            ))}
          </div>
        </Flaeche>
      ))}
    </>
  );
}
