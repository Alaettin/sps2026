import { useEffect, useState, type ChangeEvent } from "react";
import { api, useAbruf } from "../lib/api.js";
import {
  Abschnitt,
  Fehlerhinweis,
  Feld,
  Flaeche,
  Knopf,
  knopfKlassen,
  Markierung,
  Monowert,
  Seitenkopf,
  Ueberschrift,
  Zustand,
} from "../bausteine/basis.js";
import { Rueckfrage } from "../bausteine/dialog.js";
import { useSprache } from "../lib/sprache.js";
import { fehlertext } from "../lib/fehler.js";

/**
 * Globale Daten: Datenpunkte, die der Konnektor jedem Besucher gleich ausliefert.
 *
 * Seit dem 20.10.2026. Die propertyId (`Global01`, ...) vergibt der Server; jede neue muss in
 * Axon gemappt werden, bevor sie im Viewer erscheint.
 */

interface Eintrag {
  id: string;
  propertyId: string;
  name: string;
  art: "text" | "datei";
  text: string | null;
  dateiId: string | null;
  dateiname: string | null;
  mimeType: string | null;
}

export function GlobaleDaten() {
  const { t } = useSprache();
  const abruf = useAbruf<Eintrag[]>("/api/globale-daten");
  const [name, setzeName] = useState("");
  const [art, setzeArt] = useState<"text" | "datei">("text");
  const [fehler, setzeFehler] = useState<string | null>(null);
  const [zuLoeschen, setzeZuLoeschen] = useState<Eintrag | null>(null);
  // Die Liste aus dem Abruf, lokal nachgeführt, damit Speichern die Seite nicht neu lädt.
  const [liste, setzeListe] = useState<Eintrag[] | null>(null);
  useEffect(() => {
    if (abruf.daten !== null) setzeListe(abruf.daten);
  }, [abruf.daten]);

  async function anlegen() {
    setzeFehler(null);
    try {
      await api("/api/globale-daten", { method: "POST", body: JSON.stringify({ name, art }) });
      setzeName("");
      abruf.neu();
    } catch (ursache) {
      setzeFehler(fehlertext(ursache, t, ["Anlegen nicht möglich.", "Could not create."]));
    }
  }

  function ersetze(neu: Eintrag) {
    setzeListe((l) => (l ?? []).map((e) => (e.id === neu.id ? neu : e)));
  }

  return (
    <>
      <Seitenkopf>
        <Ueberschrift>{t("Globale Daten", "Global data")}</Ueberschrift>
      </Seitenkopf>
      <p className="text-sm text-text-zweit">
        {t(
          "Gelten für jeden Besucher gleich. Neue Datenpunkte müssen in Axon gemappt werden.",
          "Apply equally to every visitor. New data points must be mapped in Axon.",
        )}
      </p>

      {fehler !== null && <Fehlerhinweis>{fehler}</Fehlerhinweis>}

      <Abschnitt titel={t("Datenpunkt anlegen", "Add data point")}>
        <form
          className="flex flex-wrap items-end gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            void anlegen();
          }}
        >
          <label className="flex min-w-[14rem] flex-1 flex-col gap-2 text-[13px] font-semibold">
            {t("Name", "Name")}
            <Feld
              required
              value={name}
              onChange={(e) => {
                setzeName(e.target.value);
              }}
            />
          </label>
          <fieldset className="flex items-center gap-4 text-sm">
            <legend className="sr-only">{t("Art", "Kind")}</legend>
            {/* Die Arten sind Werte fuer den Server, die Beschriftung steht darunter. */}
            {/* eslint-disable-next-line i18next/no-literal-string */}
            {(["text", "datei"] as const).map((a) => (
              <label key={a} className="flex min-h-11 cursor-pointer items-center gap-2">
                <input
                  type="radio"
                  name="art"
                  checked={art === a}
                  onChange={() => {
                    setzeArt(a);
                  }}
                  className="size-5 accent-primaer"
                />
                {a === "text" ? t("Text", "Text") : t("Datei", "File")}
              </label>
            ))}
          </fieldset>
          <Knopf type="submit">{t("Anlegen", "Create")}</Knopf>
        </form>
      </Abschnitt>

      <Zustand
        laedt={abruf.laedt && liste === null}
        fehler={abruf.fehler}
        leer={liste !== null && liste.length === 0}
        leerText={t("Noch keine globalen Daten.", "No global data yet.")}
      >
        <ul className="flex flex-col gap-3">
          {liste?.map((e) => (
            <Karte
              key={e.id}
              e={e}
              aufGespeichert={ersetze}
              aufFehler={setzeFehler}
              aufLoeschen={() => {
                setzeZuLoeschen(e);
              }}
            />
          ))}
        </ul>
      </Zustand>

      <Rueckfrage
        offen={zuLoeschen !== null}
        aufOffen={(o) => {
          if (!o) setzeZuLoeschen(null);
        }}
        titel={t(
          `${zuLoeschen?.propertyId ?? ""} löschen?`,
          `Delete ${zuLoeschen?.propertyId ?? ""}?`,
        )}
        bestaetigenText={t("Löschen", "Delete")}
        art="gefahr"
        aufBestaetigen={() => {
          const ziel = zuLoeschen;
          if (ziel === null) return;
          void api(`/api/globale-daten/${ziel.id}`, { method: "DELETE" })
            .then(() => {
              setzeZuLoeschen(null);
              abruf.neu();
            })
            .catch((u: unknown) => {
              setzeFehler(fehlertext(u, t, ["Löschen nicht möglich.", "Could not delete."]));
            });
        }}
      >
        <p>
          <b>{zuLoeschen?.name}</b>{" "}
          {t(
            "verschwindet für alle Besucher. Ein Mapping in Axon greift danach ins Leere; die Nummer wird nicht wieder vergeben.",
            "will disappear for all visitors. A mapping in Axon will then point to nothing; the number is not reused.",
          )}
        </p>
      </Rueckfrage>
    </>
  );
}

function Karte({
  e,
  aufGespeichert,
  aufFehler,
  aufLoeschen,
}: {
  e: Eintrag;
  aufGespeichert: (neu: Eintrag) => void;
  aufFehler: (text: string | null) => void;
  aufLoeschen: () => void;
}) {
  const { t } = useSprache();
  const [text, setzeText] = useState(e.text ?? "");
  const [laeuft, setzeLaeuft] = useState(false);
  const [gespeichert, setzeGespeichert] = useState(false);

  useEffect(() => {
    if (!gespeichert) return;
    const uhr = setTimeout(() => {
      setzeGespeichert(false);
    }, 3000);
    return () => {
      clearTimeout(uhr);
    };
  }, [gespeichert]);

  async function setze(koerper: object) {
    setzeLaeuft(true);
    aufFehler(null);
    try {
      await api(`/api/globale-daten/${e.id}`, { method: "PATCH", body: JSON.stringify(koerper) });
      // Die Liste neu holen, damit Dateiname und Typ stimmen; nur dieser Eintrag ändert sich.
      const alle = await api<Eintrag[]>("/api/globale-daten");
      const neu = alle.find((x) => x.id === e.id);
      if (neu !== undefined) aufGespeichert(neu);
      setzeGespeichert(true);
    } catch (ursache) {
      aufFehler(fehlertext(ursache, t, ["Speichern nicht möglich.", "Could not save."]));
    } finally {
      setzeLaeuft(false);
    }
  }

  async function waehleDatei(ereignis: ChangeEvent<HTMLInputElement>) {
    // Erst die Liste sichern, dann das Feld leeren: `value = ""` leert die FileList.
    const datei = Array.from(ereignis.target.files ?? [])[0];
    ereignis.target.value = "";
    if (datei === undefined) return;
    setzeLaeuft(true);
    try {
      const formular = new FormData();
      formular.append("datei", datei);
      const hoch = await api<{ id: string }>("/api/dateien", { method: "POST", body: formular });
      await setze({ dateiId: hoch.id });
    } catch (ursache) {
      aufFehler(fehlertext(ursache, t, ["Hochladen nicht möglich.", "Could not upload."]));
      setzeLaeuft(false);
    }
  }

  const istBild = e.mimeType?.startsWith("image/") === true && !e.mimeType.startsWith("image/vnd.");

  return (
    <li>
      <Flaeche className="flex flex-col gap-4 p-5">
        <div className="flex flex-col gap-1">
          {/* Name in eigener Zeile: bei 390 px quetschte ihn sonst das Etikett zusammen. */}
          <div className="flex items-center gap-3">
            <Monowert wert={e.propertyId} />
            <Markierung
              text={e.art === "text" ? t("TEXT", "TEXT") : t("DATEI", "FILE")}
              farbe="var(--color-text-hinweis)"
            />
            <Knopf art="still" className="ml-auto h-9 px-3 text-[13px]" onClick={aufLoeschen}>
              {t("Löschen", "Delete")}
            </Knopf>
          </div>
          <span className="text-[15px] font-semibold break-words">{e.name}</span>
        </div>

        {e.art === "text" ? (
          <form
            className="flex flex-col gap-3"
            onSubmit={(ev) => {
              ev.preventDefault();
              void setze({ text });
            }}
          >
            <textarea
              aria-label={t(`Text für ${e.propertyId}`, `Text for ${e.propertyId}`)}
              value={text}
              rows={3}
              onChange={(ev) => {
                setzeText(ev.target.value);
                setzeGespeichert(false);
              }}
              className="w-full rounded-none border border-linie-feld bg-flaeche p-3 text-[15px]"
            />
            <div className="flex items-center gap-3">
              <Knopf type="submit" disabled={laeuft}>
                {laeuft ? t("Wird gespeichert …", "Saving …") : t("Speichern", "Save")}
              </Knopf>
              <span role="status" className="text-sm font-semibold text-primaer-dunkel">
                {gespeichert && t("Gespeichert", "Saved")}
              </span>
            </div>
          </form>
        ) : (
          <div className="flex flex-wrap items-center gap-4">
            {e.dateiId !== null &&
              (istBild ? (
                <img
                  src={`/api/dateien/${e.dateiId}`}
                  alt={t(`Vorschau ${e.propertyId}`, `Preview ${e.propertyId}`)}
                  className="size-24 border border-linie object-contain"
                />
              ) : (
                <a
                  href={`/api/dateien/${e.dateiId}`}
                  target="_blank"
                  rel="noreferrer"
                  className="text-sm font-semibold text-primaer-dunkel"
                >
                  {t(`${e.dateiname ?? "Datei"} öffnen`, `Open ${e.dateiname ?? "file"}`)} ↗
                </a>
              ))}
            {/* Das Feld ist `sr-only`, das Label trägt das Aussehen, wie beim CSV-Import. */}
            <label
              className={knopfKlassen(
                "rand",
                laeuft ? "pointer-events-none opacity-50" : "cursor-pointer",
              )}
            >
              {e.dateiId === null
                ? t("Datei hochladen", "Upload file")
                : t("Datei ersetzen", "Replace file")}
              <input
                type="file"
                className="sr-only"
                disabled={laeuft}
                onChange={(ev) => void waehleDatei(ev)}
              />
            </label>
            <span role="status" className="text-sm font-semibold text-primaer-dunkel">
              {gespeichert && t("Gespeichert", "Saved")}
            </span>
          </div>
        )}
      </Flaeche>
    </li>
  );
}
