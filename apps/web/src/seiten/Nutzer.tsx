import { useEffect, useState } from "react";
import { api, useAbruf } from "../lib/api.js";
import { Blaetterleiste, useBlaettern, useSprungZuEintrag } from "../bausteine/blaettern.js";
import {
  Abschnitt,
  cn,
  Fehlerhinweis,
  Feld,
  Flaeche,
  Knopf,
  Kopfzelle,
  Markierung,
  Monowert,
  Reihe,
  Seitenkopf,
  Tabellenflaeche,
  Ueberschrift,
  Zelle,
  Zustand,
} from "../bausteine/basis.js";
import { Rueckfrage, Schaufenster } from "../bausteine/dialog.js";
import type { Ich } from "../lib/ich.js";
import { useSprache } from "../lib/sprache.js";
import { fehlertext } from "../lib/fehler.js";

type Rolle = "admin" | "betreuer" | "kiosk";

interface Nutzerzeile {
  id: string;
  name: string;
  email: string;
  rolle: Rolle;
  aktiv: boolean;
  zuletztAngemeldet: number | null;
  exponate: string[];
}

export function Nutzer({ ich }: { ich: Ich }) {
  const { t } = useSprache();
  const abruf = useAbruf<Nutzerzeile[]>("/api/nutzer");
  const { seite, zuSeite, sichtbar, gesamt } = useBlaettern(abruf.daten ?? []);
  const springeZu = useSprungZuEintrag(abruf.daten ?? [], zuSeite);
  const [fehler, setzeFehler] = useState<string | null>(null);
  /** Wird genau einmal angezeigt, nach dem Anlegen oder Zuruecksetzen. */
  const [passwortFuer, setzePasswortFuer] = useState<{
    id: string;
    name: string;
    email: string;
  } | null>(null);
  const [startpasswort, setzeStartpasswort] = useState<{ email: string; wert: string } | null>(
    null,
  );
  const [name, setzeName] = useState("");
  const [email, setzeEmail] = useState("");
  const [rolle, setzeRolle] = useState<Rolle>("betreuer");
  const [frage, setzeFrage] = useState<Nutzerzeile | null>(null);
  const [zuweisen, setzeZuweisen] = useState<Nutzerzeile | null>(null);
  const [zuLoeschen, setzeZuLoeschen] = useState<Nutzerzeile | null>(null);

  function melde(ursache: unknown, ersatz: [string, string]) {
    setzeFehler(fehlertext(ursache, t, ersatz));
  }

  return (
    <>
      <Seitenkopf>
        <Ueberschrift>{t("Nutzer", "Users")}</Ueberschrift>
      </Seitenkopf>

      {fehler !== null && <Fehlerhinweis>{fehler}</Fehlerhinweis>}

      {startpasswort !== null && (
        <Flaeche className="flex flex-col gap-3 border-l-4 border-primaer p-6">
          <h2 className="text-lg font-semibold">
            {t("Startpasswort für", "Initial password for")} {startpasswort.email}
          </h2>
          <Monowert wert={startpasswort.wert} />
          <p className="text-[13px] text-text-hinweis">
            {t("Es wird", "It is shown")} <b>{t("nur jetzt", "only now")}</b>{" "}
            {t(
              "angezeigt und nirgends gespeichert. Geht es verloren, setzt du einfach ein neues.",
              "and stored nowhere. If it gets lost, simply set a new one.",
            )}
          </p>
          <Knopf
            art="rand"
            className="self-start"
            onClick={() => {
              setzeStartpasswort(null);
            }}
          >
            {t("Verstanden", "Got it")}
          </Knopf>
        </Flaeche>
      )}

      <Abschnitt titel={t("Nutzer anlegen", "Add user")}>
        <form
          className="flex flex-wrap items-end gap-4"
          onSubmit={(ev) => {
            ev.preventDefault();
            setzeFehler(null);
            void api<{ id: string; email: string; startpasswort: string }>("/api/nutzer", {
              method: "POST",
              body: JSON.stringify({ name, email, rolle }),
            })
              .then((angelegt) => {
                setzeStartpasswort({ email: angelegt.email, wert: angelegt.startpasswort });
                setzeName("");
                setzeEmail("");
                abruf.neu();
                springeZu(angelegt.id);
              })
              .catch((u: unknown) => {
                melde(u, ["Anlegen nicht möglich.", "Could not create."]);
              });
          }}
        >
          <label className="flex min-w-[12rem] flex-1 flex-col gap-2 text-[13px] font-semibold">
            {t("Name", "Name")}
            <Feld
              required
              value={name}
              onChange={(e) => {
                setzeName(e.target.value);
              }}
            />
          </label>
          <label className="flex min-w-[14rem] flex-1 flex-col gap-2 text-[13px] font-semibold">
            {t("E-Mail", "Email")}
            <Feld
              type="email"
              required
              value={email}
              onChange={(e) => {
                setzeEmail(e.target.value);
              }}
            />
          </label>
          <label className="flex flex-col gap-2 text-[13px] font-semibold">
            {t("Rolle", "Role")}
            <select
              value={rolle}
              onChange={(e) => {
                setzeRolle(e.target.value as Rolle);
              }}
              className="h-11 rounded-none border border-linie-feld bg-flaeche px-3 text-[15px]"
            >
              <option value="betreuer">{t("Betreuer", "Stand staff")}</option>
              <option value="admin">{t("Admin", "Admin")}</option>
              {/*
                Das Selbstbedienungsgeraet am Stand. Es sieht keine Verwaltung, sondern nur
                den Scan und danach die Daten des einen gescannten Besuchers.

                **Nur der Anzeigename ist "Terminal".** Gespeichert, in den Waechtern und in
                den Routen heisst die Rolle weiterhin `kiosk`; das umzubenennen waere eine
                Migration fuer einen Namen, den niemand sieht.
              */}
              <option value="kiosk">{t("Terminal", "Terminal")}</option>
            </select>
          </label>
          <Knopf type="submit">{t("Anlegen", "Create")}</Knopf>
        </form>
      </Abschnitt>

      <Zustand laedt={abruf.laedt} fehler={abruf.fehler}>
        <Tabellenflaeche>
          <table className="w-full border-collapse text-sm max-sm:block sm:min-w-[780px]">
            <thead className="max-sm:hidden">
              <tr>
                <Kopfzelle>{t("Name", "Name")}</Kopfzelle>
                <Kopfzelle>{t("E-Mail", "Email")}</Kopfzelle>
                <Kopfzelle>{t("Rolle", "Role")}</Kopfzelle>
                <Kopfzelle>{t("Exponate", "Exhibits")}</Kopfzelle>
                <Kopfzelle className="text-right">
                  <span className="sr-only">{t("Aktionen", "Actions")}</span>
                </Kopfzelle>
              </tr>
            </thead>
            <tbody className="max-sm:block">
              {sichtbar.map((n) => (
                <Reihe key={n.id}>
                  <Zelle className="font-semibold">
                    <span className="flex items-center gap-2">
                      {n.name}
                      {!n.aktiv && (
                        <Markierung text={t("GESPERRT", "LOCKED")} farbe="var(--color-fehler)" />
                      )}
                    </span>
                  </Zelle>
                  <Zelle titel={t("E-Mail", "Email")} className="text-text-zweit">
                    {n.email}
                  </Zelle>
                  <Zelle titel={t("Rolle", "Role")}>
                    {n.rolle === "admin" ? (
                      <Markierung text={t("ADMIN", "ADMIN")} />
                    ) : n.rolle === "kiosk" ? (
                      <Markierung
                        text={t("TERMINAL", "TERMINAL")}
                        farbe="var(--color-primaer-dunkel)"
                      />
                    ) : (
                      <Markierung
                        text={t("BETREUER", "STAND STAFF")}
                        farbe="var(--color-text-zweit)"
                      />
                    )}
                  </Zelle>
                  <Zelle titel={t("Exponate", "Exhibits")}>
                    {n.rolle === "admin" ? (
                      // Ein Admin kommt an jedes Exponat, eine Zuweisung waere ohne Wirkung.
                      <span className="text-text-hinweis">{t("alle", "all")}</span>
                    ) : (
                      <Knopf
                        art="still"
                        className="h-8 px-3 text-[13px]"
                        onClick={() => {
                          setzeFehler(null);
                          setzeZuweisen(n);
                        }}
                      >
                        {n.exponate.length} {t("zuweisen", "assign")}
                      </Knopf>
                    )}
                  </Zelle>
                  <Zelle className="text-right">
                    <span className="flex flex-wrap justify-end gap-2">
                      <Knopf
                        art="still"
                        className="h-8 px-3 text-[13px]"
                        onClick={() => {
                          setzeFehler(null);
                          setzePasswortFuer({ id: n.id, name: n.name, email: n.email });
                        }}
                      >
                        {t("Passwort", "Password")}
                      </Knopf>
                      <Knopf
                        art="still"
                        className="h-8 px-3 text-[13px]"
                        onClick={() => {
                          setzeFehler(null);
                          if (n.aktiv) {
                            setzeFrage(n);
                            return;
                          }
                          void api(`/api/nutzer/${n.id}/aktiv`, {
                            method: "POST",
                            body: JSON.stringify({ aktiv: true }),
                          })
                            .then(abruf.neu)
                            .catch((u: unknown) => {
                              melde(u, ["Nicht möglich.", "Not possible."]);
                            });
                        }}
                      >
                        {n.aktiv ? t("Deaktivieren", "Deactivate") : t("Aktivieren", "Activate")}
                      </Knopf>
                      {/* Die eigene Zeile hat keinen Knopf; der Server lehnt es ohnehin ab. */}
                      {n.id !== ich.id && (
                        <Knopf
                          art="still"
                          className="h-8 px-3 text-[13px] text-fehler"
                          onClick={() => {
                            setzeFehler(null);
                            setzeZuLoeschen(n);
                          }}
                        >
                          {t("Löschen", "Delete")}
                        </Knopf>
                      )}
                    </span>
                  </Zelle>
                </Reihe>
              ))}
            </tbody>
          </table>
        </Tabellenflaeche>
      </Zustand>

      <Blaetterleiste seite={seite} gesamt={gesamt} aufSeite={zuSeite} />

      <Passwortfenster
        nutzer={passwortFuer}
        aufSchliessen={() => {
          setzePasswortFuer(null);
        }}
        aufGesetzt={(email, wert) => {
          setzeStartpasswort({ email, wert });
          setzePasswortFuer(null);
        }}
        aufFehler={setzeFehler}
      />

      <ExponatZuweisung
        nutzer={zuweisen}
        aufSchliessen={() => {
          setzeZuweisen(null);
        }}
        aufGespeichert={abruf.neu}
        aufFehler={setzeFehler}
      />

      <Rueckfrage
        offen={frage !== null}
        aufOffen={(o) => {
          if (!o) setzeFrage(null);
        }}
        titel={t("Nutzer deaktivieren?", "Deactivate user?")}
        bestaetigenText={t("Deaktivieren", "Deactivate")}
        art="gefahr"
        aufBestaetigen={() => {
          if (frage === null) return;
          void api(`/api/nutzer/${frage.id}/aktiv`, {
            method: "POST",
            body: JSON.stringify({ aktiv: false }),
          })
            .then(() => {
              setzeFrage(null);
              abruf.neu();
            })
            .catch((u: unknown) => {
              melde(u, ["Nicht möglich.", "Not possible."]);
              setzeFrage(null);
            });
        }}
      >
        <p>
          <b>{frage?.name}</b>{" "}
          {t(
            "kann sich danach nicht mehr anmelden, und eine laufende Sitzung endet bei der nächsten Anfrage.",
            "will no longer be able to sign in, and a running session ends with the next request.",
          )}
        </p>
        <p>
          {t(
            "Der Zugang bleibt bestehen und lässt sich jederzeit wieder aktivieren. Was er an seinen Exponaten gepflegt hat, bleibt.",
            "The account remains and can be reactivated at any time. Whatever it maintained on its exhibits stays.",
          )}
        </p>
      </Rueckfrage>

      <Rueckfrage
        offen={zuLoeschen !== null}
        aufOffen={(o) => {
          if (!o) setzeZuLoeschen(null);
        }}
        titel={t("Nutzer löschen?", "Delete user?")}
        bestaetigenText={t("Löschen", "Delete")}
        art="gefahr"
        aufBestaetigen={() => {
          if (zuLoeschen === null) return;
          void api(`/api/nutzer/${zuLoeschen.id}`, { method: "DELETE" })
            .then(() => {
              setzeZuLoeschen(null);
              abruf.neu();
            })
            .catch((u: unknown) => {
              melde(u, ["Löschen nicht möglich.", "Could not delete."]);
              setzeZuLoeschen(null);
            });
        }}
      >
        <p>
          <b>{zuLoeschen?.name}</b> ({zuLoeschen?.email}){" "}
          {t(
            "wird endgültig gelöscht und kann sich nicht mehr anmelden. Das lässt sich nicht rückgängig machen.",
            "will be deleted permanently and can no longer sign in. This cannot be undone.",
          )}
        </p>
        <p>
          {t(
            "Was dieser Zugang an seinen Exponaten gepflegt hat, bleibt. Soll der Zugang nur vorübergehend ruhen, ist Deaktivieren der umkehrbare Weg.",
            "Whatever this account maintained on its exhibits stays. If the account should only pause for a while, deactivating is the reversible way.",
          )}
        </p>
      </Rueckfrage>
    </>
  );
}

/**
 * Welche Exponate ein Betreuer betreut.
 *
 * Gespeichert wird die **ganze Liste auf einmal**: `setzeExponateVonNutzer` ersetzt, statt
 * zu ergänzen, und zwar in einer Transaktion. Wer ein Häkchen entfernt, erwartet, dass es
 * weg ist.
 *
 * Die Route gab es seit Auftrag 1, nur hatte die Oberfläche nie ein Formular dafür: ein
 * Betreuer ließ sich schlicht keinem Exponat zuweisen.
 */
function ExponatZuweisung({
  nutzer,
  aufSchliessen,
  aufGespeichert,
  aufFehler,
}: {
  nutzer: { id: string; name: string; exponate: string[] } | null;
  aufSchliessen: () => void;
  aufGespeichert: () => void;
  aufFehler: (text: string | null) => void;
}) {
  const { t } = useSprache();
  const abruf = useAbruf<{ id: string; kennung: string; name: string }[]>(
    nutzer === null ? null : "/api/exponate",
  );
  const [gewaehlt, setzeGewaehlt] = useState<Set<string>>(new Set());
  const [laeuft, setzeLaeuft] = useState(false);

  // Beim Öffnen einmal mit dem aktuellen Stand vorbelegen.
  useEffect(() => {
    if (nutzer === null) return;
    setzeGewaehlt(new Set(nutzer.exponate));
  }, [nutzer]);

  async function speichern() {
    if (nutzer === null) return;
    setzeLaeuft(true);
    aufFehler(null);
    try {
      await api(`/api/nutzer/${nutzer.id}/exponate`, {
        method: "PUT",
        body: JSON.stringify({ exponate: [...gewaehlt] }),
      });
      aufGespeichert();
      aufSchliessen();
    } catch (ursache) {
      aufFehler(fehlertext(ursache, t, ["Zuweisen nicht möglich.", "Could not assign."]));
    } finally {
      setzeLaeuft(false);
    }
  }

  return (
    <Schaufenster
      offen={nutzer !== null}
      aufOffen={(o) => {
        if (!o) aufSchliessen();
      }}
      titel={
        nutzer === null
          ? t("Exponate", "Exhibits")
          : t(`Exponate von ${nutzer.name}`, `Exhibits of ${nutzer.name}`)
      }
    >
      <Zustand
        laedt={abruf.laedt}
        fehler={abruf.fehler}
        leer={abruf.daten !== null && abruf.daten.length === 0}
        leerText={t("Es gibt noch keine Exponate.", "There are no exhibits yet.")}
      >
        <ul className="flex max-h-[50dvh] flex-col overflow-y-auto">
          {abruf.daten?.map((e) => (
            <li key={e.id} className="border-b border-linie last:border-b-0">
              <label className="flex cursor-pointer items-center gap-3 py-3 text-sm">
                <input
                  type="checkbox"
                  className="size-5 shrink-0 accent-primaer"
                  checked={gewaehlt.has(e.id)}
                  onChange={(ev) => {
                    const neu = new Set(gewaehlt);
                    if (ev.target.checked) neu.add(e.id);
                    else neu.delete(e.id);
                    setzeGewaehlt(neu);
                  }}
                />
                <span className="flex min-w-0 items-center gap-3">
                  <code className="font-mono text-xs text-text-hinweis">{e.kennung}</code>
                  <span className="truncate font-medium">{e.name}</span>
                </span>
              </label>
            </li>
          ))}
        </ul>
      </Zustand>

      <p className="text-[13px] text-text-hinweis">
        {t(
          "Ein Betreuer sieht nur die hier gewählten Exponate und pflegt dort Dokumente, Links und Ansprechpartner.",
          "Stand staff only see the exhibits chosen here and maintain documents, links and contacts there.",
        )}
      </p>

      <div className="flex flex-wrap justify-end gap-3">
        <Knopf art="rand" onClick={aufSchliessen} disabled={laeuft}>
          {t("Abbrechen", "Cancel")}
        </Knopf>
        <Knopf disabled={laeuft} onClick={() => void speichern()}>
          {laeuft ? t("Wird gespeichert …", "Saving …") : t("Speichern", "Save")}
        </Knopf>
      </div>
    </Schaufenster>
  );
}

/**
 * Passwort setzen oder erzeugen.
 *
 * **Warum ein Fenster und nicht ein Klick.** Bis zum 08.10.2026 würfelte der Knopf sofort
 * ein neues Passwort. Ein Fehlklick in der Zeile eines Betreuers sperrte ihn damit mitten
 * am Stand aus, ohne Rückfrage und ohne Weg zurück.
 *
 * Ein leeres Feld heißt **erzeugen**, das ist der alte Weg. Steht etwas drin, wird genau das
 * gesetzt. Die Untergrenze prüft der Server; hier steht sie nur als Hinweis, damit man sie
 * vor dem Absenden sieht.
 */
const MIN_PASSWORTLAENGE = 12;

function Passwortfenster({
  nutzer,
  aufSchliessen,
  aufGesetzt,
  aufFehler,
}: {
  nutzer: { id: string; name: string; email: string } | null;
  aufSchliessen: () => void;
  aufGesetzt: (email: string, wert: string) => void;
  aufFehler: (text: string | null) => void;
}) {
  const { t } = useSprache();
  const [wunsch, setzeWunsch] = useState("");
  const [laeuft, setzeLaeuft] = useState(false);

  // Beim Öffnen leeren, sonst steht die Eingabe vom letzten Nutzer noch da.
  useEffect(() => {
    setzeWunsch("");
  }, [nutzer]);

  async function setze(eigenes: boolean) {
    if (nutzer === null) return;
    setzeLaeuft(true);
    aufFehler(null);
    try {
      const antwort = await api<{ startpasswort: string }>(`/api/nutzer/${nutzer.id}/passwort`, {
        method: "POST",
        body: JSON.stringify(eigenes ? { passwort: wunsch } : {}),
      });
      aufGesetzt(nutzer.email, antwort.startpasswort);
    } catch (ursache) {
      aufFehler(
        fehlertext(ursache, t, [
          "Passwort ließ sich nicht setzen.",
          "The password could not be set.",
        ]),
      );
    } finally {
      setzeLaeuft(false);
    }
  }

  const zuKurz = wunsch !== "" && wunsch.length < MIN_PASSWORTLAENGE;

  return (
    <Schaufenster
      offen={nutzer !== null}
      aufOffen={(o) => {
        if (!o) aufSchliessen();
      }}
      titel={
        nutzer === null
          ? t("Passwort", "Password")
          : t(`Passwort für ${nutzer.name}`, `Password for ${nutzer.name}`)
      }
    >
      <div className="flex flex-col gap-4">
        <label className="flex flex-col gap-2 text-[13px] font-semibold">
          {t("Neues Passwort", "New password")}
          <Feld
            type="text"
            value={wunsch}
            autoComplete="off"
            spellCheck={false}
            placeholder={t("leer lassen zum Erzeugen", "leave empty to generate")}
            onChange={(ev) => {
              setzeWunsch(ev.target.value);
            }}
          />
        </label>
        <p className={cn("text-[13px]", zuKurz ? "text-fehler" : "text-text-hinweis")}>
          {zuKurz
            ? t(
                `Mindestens ${String(MIN_PASSWORTLAENGE)} Zeichen, aktuell ${String(wunsch.length)}.`,
                `At least ${String(MIN_PASSWORTLAENGE)} characters, currently ${String(wunsch.length)}.`,
              )
            : t(
                `Mindestens ${String(MIN_PASSWORTLAENGE)} Zeichen. Leer gelassen wird eines erzeugt.`,
                `At least ${String(MIN_PASSWORTLAENGE)} characters. Left empty, one is generated.`,
              )}
        </p>
        <div className="flex flex-wrap gap-2.5">
          <Knopf
            disabled={laeuft || wunsch === "" || zuKurz}
            onClick={() => {
              void setze(true);
            }}
          >
            {t("Setzen", "Set")}
          </Knopf>
          <Knopf
            art="rand"
            disabled={laeuft}
            onClick={() => {
              void setze(false);
            }}
          >
            {t("Erzeugen", "Generate")}
          </Knopf>
        </div>
      </div>
    </Schaufenster>
  );
}
