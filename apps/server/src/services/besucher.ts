import { randomUUID } from "node:crypto";
import { and, asc, eq, getTableColumns, like, ne, or, sql } from "drizzle-orm";
import type { Db } from "../db/client.js";
import { besucher, zuordnungen } from "../db/schema.js";
import { badRequest, conflict, notFound } from "../errors.js";
import { avatarFuer } from "./standardavatar.js";

/**
 * Besucher der Konferenz. Sie melden sich mit ihrer E-Mail an (siehe
 * `services/besucherzugang.ts`); eine Selbstregistrierung gibt es nicht.
 *
 * Die GUID ist der Primaerschluessel und zugleich die `itemId` fuer Axon. Sie steht im
 * QR-Code des Passes und in der Adresse des Viewers.
 */

/**
 * Erlaubt sind `A-Z a-z 0-9 - _`, 1 bis 50 Zeichen.
 *
 * Das ist **strenger als die Spec**, die bis zu 2048 Zeichen aus dem XML-Vorrat zulaesst,
 * und lehnt trotzdem niemanden ab, den Axon annaehme: der Guide empfiehlt selbst
 * hoechstens 50. Wer strenger prueft als die Gegenseite, erzeugt keine Faelle, die dort
 * scheitern.
 */
const GUID_MUSTER = /^[A-Za-z0-9_-]{1,50}$/;

export function pruefeGuid(guid: string): string {
  const sauber = guid.trim();
  if (!GUID_MUSTER.test(sauber)) {
    throw badRequest(
      "guid-ungueltig",
      "GUID must be 1 to 50 chars of A-Z, a-z, 0-9, hyphen or underscore.",
    );
  }
  return sauber;
}

export const TEXTFELDER = [
  "titel",
  "vorname",
  "nachname",
  "alias",
  "firma",
  "position",
  "email",
  "strasse",
  "plz",
  "ort",
  "land",
  "website",
] as const;

type Textfeld = (typeof TEXTFELDER)[number];

export interface BesucherEingabe {
  guid?: string;
  titel?: string | null;
  vorname: string;
  nachname: string;
  alias?: string | null;
  firma?: string | null;
  position?: string | null;
  email: string;
  strasse?: string | null;
  plz?: string | null;
  ort?: string | null;
  land?: string | null;
  website?: string | null;
  avatarDateiId?: string | null;
}

/**
 * Alle Spalten **ausser dem Passworthash**. Jede Antwort, die einen Besucher zeigt, geht
 * ueber diese Auswahl; so kann der Hash nicht aus Versehen mit hinausgehen.
 */
const { passwortHash: _hash, ...OEFFENTLICH } = getTableColumns(besucher);

/** Das Muster, das schon der CSV-Import nutzt. */
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Prueft die E-Mail: Pflicht, plausibles Format, eindeutig ohne Gross- und Kleinschreibung.
 *
 * `ausser` ist der Besucher selbst beim Aendern, damit seine eigene Adresse nicht als
 * vergeben gilt. Der Index in der Datenbank haelt dieselbe Regel; hier steht sie, damit die
 * Antwort eine 409 mit Namen ist und kein Constraint-Fehler.
 */
function pruefeEmail(db: Db, roh: unknown, ausser: string | null): string {
  const email = typeof roh === "string" ? roh.trim() : "";
  if (email === "") throw badRequest("pflicht-fehlt", "Field email is required.");
  if (!EMAIL.test(email))
    throw badRequest("email-ungueltig", "Field email is not a valid address.");
  const gleich = sql`lower(${besucher.email}) = lower(${email})`;
  const vergeben = db
    .select({ guid: besucher.guid })
    .from(besucher)
    .where(ausser === null ? gleich : and(gleich, ne(besucher.guid, ausser)))
    .get();
  if (vergeben !== undefined) {
    throw conflict("email-vergeben", "Another visitor already uses this email address.");
  }
  return email;
}

export function findeBesucher(db: Db, guid: string) {
  const reihe = db.select(OEFFENTLICH).from(besucher).where(eq(besucher.guid, guid)).get();
  if (reihe === undefined) throw notFound("besucher-unbekannt", "Unknown visitor.");
  return reihe;
}

/**
 * Legt einen Besucher an.
 *
 * Ohne GUID wird eine UUID v4 erzeugt. Sie ist 36 Zeichen lang und passt damit in das
 * Muster und in die Empfehlung des Guides.
 */
export function legeBesucherAn(db: Db, eingabe: BesucherEingabe) {
  const guid =
    eingabe.guid === undefined || eingabe.guid.trim() === ""
      ? randomUUID()
      : pruefeGuid(eingabe.guid);

  if (db.select({ guid: besucher.guid }).from(besucher).where(eq(besucher.guid, guid)).get()) {
    throw conflict("guid-vergeben", "A visitor with this GUID already exists.");
  }
  if (eingabe.vorname.trim() === "" || eingabe.nachname.trim() === "") {
    throw badRequest("feld-fehlt", "Fields vorname and nachname are required.");
  }
  const email = pruefeEmail(db, eingabe.email, null);

  const jetzt = Date.now();
  const reihe = {
    guid,
    ...leseTextfelder(eingabe),
    email,
    /*
     * **Jeder neue Besucher traegt den Standard-Avatar**, auch der aus dem CSV-Import: der
     * laeuft durch dieselbe Funktion. `avatarFuer` liefert ihn nur, wenn die Zeile wirklich
     * existiert; ein fester Wert wuerde den Fremdschluessel verletzen, sobald das Bild im
     * Repo fehlt, und das Anlegen scheitern lassen. Eine mitgegebene Id gewinnt.
     */
    avatarDateiId: avatarFuer(db, eingabe.avatarDateiId ?? null),
    angelegt: jetzt,
    geaendert: jetzt,
  };
  db.insert(besucher).values(reihe).run();
  return findeBesucher(db, guid);
}

export function aendereBesucher(db: Db, guid: string, eingabe: Partial<BesucherEingabe>) {
  findeBesucher(db, guid);
  const aenderung: Record<string, unknown> = { geaendert: Date.now() };
  for (const feld of TEXTFELDER) {
    if (feld in eingabe) {
      const wert = eingabe[feld];
      aenderung[feld] = wert === null || wert === undefined ? null : String(wert).trim();
    }
  }
  if ("email" in eingabe) aenderung["email"] = pruefeEmail(db, eingabe.email, guid);
  if ("avatarDateiId" in eingabe) aenderung["avatarDateiId"] = eingabe.avatarDateiId ?? null;
  db.update(besucher).set(aenderung).where(eq(besucher.guid, guid)).run();
  return findeBesucher(db, guid);
}

/**
 * Loescht einen Besucher samt seiner Zuordnungen.
 *
 * Die Zuordnungen gehen ueber `on delete cascade` mit. Die hochgeladenen Dateien bleiben:
 * sie koennen an einem Exponat haengen und gehoeren dann nicht diesem Besucher.
 */
export function loescheBesucher(db: Db, guid: string): void {
  findeBesucher(db, guid);
  db.delete(besucher).where(eq(besucher.guid, guid)).run();
}

export interface Seite {
  /** Eins-basiert, wie in der Oberflaeche. */
  nummer: number;
  groesse: number;
}

/**
 * Liste mit Suche und Seitenumschaltung.
 *
 * Gesucht wird ueber Vorname, Nachname, Alias, Firma, E-Mail und GUID. Die Gesamtzahl wird mit
 * **demselben** Filter gezaehlt wie die Seite selbst: zwei Abfragen, von denen nur eine
 * den Filter kennt, ergeben eine Seitenumschaltung, die nicht aufgeht, und kein Test
 * schlaegt darauf an.
 */
export function listeBesucher(db: Db, suche: string, seite: Seite) {
  const begriff = suche.trim();
  const bedingung =
    begriff === ""
      ? undefined
      : or(
          like(besucher.vorname, `%${begriff}%`),
          like(besucher.nachname, `%${begriff}%`),
          like(besucher.alias, `%${begriff}%`),
          like(besucher.firma, `%${begriff}%`),
          like(besucher.email, `%${begriff}%`),
          like(besucher.guid, `%${begriff}%`),
        );

  const gesamt = db
    .select({ anzahl: sql<number>`count(*)` })
    .from(besucher)
    .where(bedingung)
    .get();

  const eintraege = db
    .select(OEFFENTLICH)
    .from(besucher)
    .where(bedingung)
    .orderBy(asc(besucher.nachname), asc(besucher.vorname))
    .limit(seite.groesse)
    .offset((seite.nummer - 1) * seite.groesse)
    .all();

  return { eintraege, gesamt: gesamt?.anzahl ?? 0, seite };
}

/** Die Zuordnungen eines Besuchers, nach Exponat gruppiert. Fuer die Detailansicht. */
export function zuordnungenVonBesucher(db: Db, guid: string) {
  return db
    .select()
    .from(zuordnungen)
    .where(eq(zuordnungen.besucherGuid, guid))
    .orderBy(asc(zuordnungen.zeitpunkt))
    .all();
}

export function zaehleZuordnungen(db: Db, guid: string, exponatId: string): number {
  return db
    .select({ id: zuordnungen.id })
    .from(zuordnungen)
    .where(and(eq(zuordnungen.besucherGuid, guid), eq(zuordnungen.exponatId, exponatId)))
    .all().length;
}

/**
 * Die Textfelder, getrimmt. Leeres wird `null`, nicht `""`.
 *
 * Vor- und Nachname sind in der Tabelle `not null` und tragen das auch im Typ: `sammleWerte`
 * laesst leere Felder aus, und ein Besucher ohne Namen waere im Viewer eine leere Karte.
 * Die Pflicht wird in `legeBesucherAn` geprueft, bevor diese Funktion laeuft.
 */
type Optionale = Exclude<Textfeld, "vorname" | "nachname" | "email">;

function leseTextfelder(
  eingabe: Partial<BesucherEingabe>,
): Record<Optionale, string | null> & { vorname: string; nachname: string } {
  const optional = {} as Record<Optionale, string | null>;
  for (const feld of TEXTFELDER) {
    // Die E-Mail prueft und setzt `pruefeEmail`.
    if (feld === "vorname" || feld === "nachname" || feld === "email") continue;
    const wert = eingabe[feld];
    optional[feld] =
      wert === null || wert === undefined || String(wert).trim() === ""
        ? null
        : String(wert).trim();
  }
  return {
    ...optional,
    vorname: (eingabe.vorname ?? "").trim(),
    nachname: (eingabe.nachname ?? "").trim(),
  };
}
