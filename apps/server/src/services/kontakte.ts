import { randomUUID } from "node:crypto";
import { and, asc, eq } from "drizzle-orm";
import type { Db } from "../db/client.js";
import { exponatKontakte } from "../db/schema.js";
import { badRequest, notFound } from "../errors.js";
import { MAX_KONTAKTE } from "../modell/felder.js";
import { findeExponat, kleinsterFreierPlatz } from "./exponate.js";

/**
 * Ansprechpartner **eines Exponats**, seit dem 02.11.2026.
 *
 * Der Betreuer pflegt sie an seinem Exponat. Derselbe Mensch an zwei Exponaten ist bewusst
 * zweimal im Bestand: sonst aenderte ein Betreuer einen Datensatz, der auch an einem fremden
 * Exponat steht. Die zentralen Stammdaten vom 19.10.2026 sind damit entfallen.
 */

export const TEXTFELDER = [
  "titel",
  "vorname",
  "nachname",
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
type Optionale = Exclude<Textfeld, "vorname" | "nachname">;

export type Eingabe = Partial<Record<Textfeld, string | null>>;

/** Getrimmt, Leeres wird `null`. Vor- und Nachname sind Pflicht und nie `null`. */
function felder(eingabe: Eingabe): Record<Optionale, string | null> & {
  vorname: string;
  nachname: string;
} {
  const optional = {} as Record<Optionale, string | null>;
  for (const feld of TEXTFELDER) {
    if (feld === "vorname" || feld === "nachname") continue;
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

/** Die Ansprechpartner eines Exponats, nach Platz sortiert. */
export function kontakteVonExponat(db: Db, exponatId: string) {
  return db
    .select()
    .from(exponatKontakte)
    .where(eq(exponatKontakte.exponatId, exponatId))
    .orderBy(asc(exponatKontakte.platz))
    .all();
}

/** Sucht immer ueber Exponat **und** Id: ein Betreuer erreicht so nie den Kontakt eines fremden. */
function findeKontakt(db: Db, exponatId: string, id: string) {
  const reihe = db
    .select()
    .from(exponatKontakte)
    .where(and(eq(exponatKontakte.exponatId, exponatId), eq(exponatKontakte.id, id)))
    .get();
  if (reihe === undefined)
    throw notFound("kontakt-unbekannt", "No contact with this id at this exhibit.");
  return reihe;
}

/**
 * Legt einen Ansprechpartner an. Der Platz ist die kleinste freie Nummer bis `MAX_KONTAKTE`
 * und aendert sich danach nie: aus ihm entsteht `{K}_Contact03_Email`.
 */
export function legeKontaktAn(db: Db, exponatId: string, eingabe: Eingabe) {
  findeExponat(db, exponatId);
  const werte = felder(eingabe);
  if (werte.vorname === "" || werte.nachname === "") {
    throw badRequest("feld-fehlt", "Fields vorname and nachname are required.");
  }
  const belegt = kontakteVonExponat(db, exponatId).map((k) => k.platz);
  const jetzt = Date.now();
  const reihe = {
    id: randomUUID(),
    exponatId,
    platz: kleinsterFreierPlatz(belegt, MAX_KONTAKTE, "contact"),
    ...werte,
    angelegt: jetzt,
    geaendert: jetzt,
  };
  db.insert(exponatKontakte).values(reihe).run();
  return reihe;
}

/** Aendert nur mitgeschickte Felder; der Platz bleibt. */
export function aendereKontakt(db: Db, exponatId: string, id: string, eingabe: Eingabe) {
  const vorher = findeKontakt(db, exponatId, id);
  const werte = felder({ ...vorher, ...eingabe });
  if (werte.vorname === "" || werte.nachname === "") {
    throw badRequest("feld-fehlt", "Fields vorname and nachname must not be empty.");
  }
  db.update(exponatKontakte)
    .set({ ...werte, geaendert: Date.now() })
    .where(eq(exponatKontakte.id, id))
    .run();
  return findeKontakt(db, exponatId, id);
}

/** Liest die Felder aus einem JSON-Rumpf; Unbekanntes und Nicht-Texte fallen weg. */
export function leseKontakt(rumpf: unknown): Eingabe {
  const o = (typeof rumpf === "object" && rumpf !== null ? rumpf : {}) as Record<string, unknown>;
  const eingabe: Eingabe = {};
  for (const feld of TEXTFELDER) {
    const wert = o[feld];
    if (typeof wert === "string" || wert === null) eingabe[feld] = wert;
  }
  return eingabe;
}
