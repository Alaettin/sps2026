import { useEffect, useState } from "react";
import { api } from "../lib/api.js";
import {
  ANSPRECHPARTNERFELDER,
  GRUPPEN,
  feldtext,
  felderDerGruppe,
  gruppentext,
} from "../lib/personenfelder.js";
import { Fehlerhinweis, Feld, Knopf } from "./basis.js";
import { Schaufenster } from "./dialog.js";
import { useSprache } from "../lib/sprache.js";
import { fehlertext } from "../lib/fehler.js";

/**
 * Ein Ansprechpartner **an einem Exponat**, seit dem 02.11.2026: die Felder plus der Platz.
 * Ohne Foto, das gibt es seit dem 08.10.2026 nicht mehr.
 */
export interface Kontakt {
  id: string;
  platz: number;
  titel: string | null;
  vorname: string;
  nachname: string;
  firma: string | null;
  position: string | null;
  email: string | null;
  strasse: string | null;
  plz: string | null;
  ort: string | null;
  land: string | null;
  website: string | null;
  /** Die Masken lesen die Felder ueber `ANSPRECHPARTNERFELDER`, also ueber den Namen. */
  [feld: string]: unknown;
}

/**
 * Anlegen und Bearbeiten eines Ansprechpartners am Exponat; das Formular unterscheidet nur am
 * Titel und an der Adresse. Bis zum 02.11.2026 stand es auf der Seite der zentralen
 * Ansprechpartner.
 */
export function KontaktFormular({
  exponatId,
  kontakt,
  aufSchliessen,
  aufGespeichert,
}: {
  exponatId: string;
  kontakt: Kontakt | "neu" | null;
  aufSchliessen: () => void;
  aufGespeichert: () => void;
}) {
  const { t } = useSprache();
  const [werte, setzeWerte] = useState<Record<string, string>>({});
  const [fehler, setzeFehler] = useState<string | null>(null);
  const [laeuft, setzeLaeuft] = useState(false);

  /*
   * Beim Öffnen einmal vorbelegen. Die Abhängigkeit ist `kontakt` selbst: ein neuer Aufruf
   * mit einem anderen füllt neu, ein erneutes Rendern mit demselben nicht.
   */
  useEffect(() => {
    if (kontakt === null) return;
    setzeFehler(null);
    if (kontakt === "neu") {
      setzeWerte({});
      return;
    }
    const vorbelegt: Record<string, string> = {};
    for (const f of ANSPRECHPARTNERFELDER) {
      const wert = kontakt[f.name];
      vorbelegt[f.name] = typeof wert === "string" ? wert : "";
    }
    setzeWerte(vorbelegt);
  }, [kontakt]);

  async function speichern() {
    if (kontakt === null) return;
    setzeLaeuft(true);
    setzeFehler(null);
    try {
      await api(
        kontakt === "neu"
          ? `/api/exponate/${exponatId}/kontakte`
          : `/api/exponate/${exponatId}/kontakte/${kontakt.id}`,
        { method: kontakt === "neu" ? "POST" : "PATCH", body: JSON.stringify(werte) },
      );
      aufGespeichert();
      aufSchliessen();
    } catch (ursache) {
      setzeFehler(fehlertext(ursache, t, ["Speichern nicht möglich.", "Could not save."]));
    } finally {
      setzeLaeuft(false);
    }
  }

  const vollstaendig =
    (werte["vorname"] ?? "").trim() !== "" && (werte["nachname"] ?? "").trim() !== "";

  return (
    <Schaufenster
      offen={kontakt !== null}
      aufOffen={(o) => {
        if (!o) aufSchliessen();
      }}
      titel={
        kontakt === "neu"
          ? t("Ansprechpartner anlegen", "Add contact")
          : t("Ansprechpartner bearbeiten", "Edit contact")
      }
    >
      {fehler !== null && <Fehlerhinweis>{fehler}</Fehlerhinweis>}

      <form
        className="flex flex-col gap-4"
        onSubmit={(ev) => {
          ev.preventDefault();
          void speichern();
        }}
      >
        <div className="grid gap-4 sm:grid-cols-2">
          {GRUPPEN.map((gruppe) => (
            <fieldset key={gruppe} className="contents">
              <legend className="col-span-full pt-2 text-[11px] font-semibold tracking-[0.08em] text-text-hinweis uppercase">
                {gruppentext(gruppe, t)}
              </legend>
              {felderDerGruppe(gruppe, ANSPRECHPARTNERFELDER).map((f) => (
                <label key={f.name} className="flex flex-col gap-2 text-[13px] font-semibold">
                  {feldtext(f, t)}
                  <Feld
                    type={f.typ ?? "text"}
                    required={f.pflicht === true}
                    value={werte[f.name] ?? ""}
                    onChange={(ev) => {
                      setzeWerte((w) => ({ ...w, [f.name]: ev.target.value }));
                    }}
                  />
                </label>
              ))}
            </fieldset>
          ))}
        </div>

        <div className="flex flex-wrap justify-end gap-3">
          <Knopf art="rand" onClick={aufSchliessen} disabled={laeuft}>
            {t("Abbrechen", "Cancel")}
          </Knopf>
          <Knopf type="submit" disabled={!vollstaendig || laeuft}>
            {laeuft ? t("Wird gespeichert …", "Saving …") : t("Speichern", "Save")}
          </Knopf>
        </div>
      </form>
    </Schaufenster>
  );
}
