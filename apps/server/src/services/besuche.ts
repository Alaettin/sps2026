import { and, asc, desc, eq, sql } from "drizzle-orm";
import type { Db } from "../db/client.js";
import { besuche, besucher, exponate } from "../db/schema.js";
import { badRequest, notFound } from "../errors.js";
import { findeExponat, inhalteVonExponat } from "./exponate.js";

/**
 * Welcher Besucher welches Exponat aufgenommen hat, seit dem 02.11.2026.
 *
 * Der Besucher scannt den QR-Code am Exponat selbst. **Aufgenommen wird das Exponat**, nicht
 * einzelne Inhalte: der Konnektor liefert immer, was das Exponat gerade hat. Vorher hakte der
 * Betreuer beim Scan des Passes einzelne Dokumente und Links an.
 */

function pruefeBesucher(db: Db, guid: string): void {
  if (
    db.select({ guid: besucher.guid }).from(besucher).where(eq(besucher.guid, guid)).get() ===
    undefined
  ) {
    throw notFound("besucher-unbekannt", "Unknown visitor.");
  }
}

/**
 * Legt den Besuch an, falls es ihn noch nicht gibt. **Idempotent**: ein zweiter Scan, etwa nach
 * einem Netzfehler, legt nichts an und meldet `neu: false`. Der Zeitpunkt bleibt der erste.
 */
function trageEin(db: Db, guid: string, exponatId: string): boolean {
  const ergebnis = db
    .insert(besuche)
    .values({ besucherGuid: guid, exponatId, zeitpunkt: Date.now() })
    .onConflictDoNothing()
    .run();
  return ergebnis.changes > 0;
}

/**
 * Der Scan des Besuchers. Die GUID kommt **aus der Sitzung**, nie aus dem Rumpf; sonst nimmt
 * jeder Besucher Exponate fuer fremde Paesse auf.
 *
 * Ein unbekannter Code gibt 404, ohne zu verraten, ob es das Exponat gibt.
 */
export function nimmAuf(db: Db, guid: string, code: string) {
  const sauber = code.trim();
  if (sauber === "") throw badRequest("code-fehlt", "Field code is required.");
  pruefeBesucher(db, guid);

  const e = db.select().from(exponate).where(eq(exponate.scanCode, sauber)).get();
  if (e === undefined) throw notFound("code-unbekannt", "Unknown exhibit code.");

  return { kennung: e.kennung, name: e.name, neu: trageEin(db, guid, e.id) };
}

/** Setzt den Besuch von Hand, fuer den Admin im Besucherdetail. Idempotent wie der Scan. */
export function setzeBesuch(db: Db, guid: string, exponatId: string): { neu: boolean } {
  pruefeBesucher(db, guid);
  findeExponat(db, exponatId);
  return { neu: trageEin(db, guid, exponatId) };
}

/** Nimmt den Besuch zurueck. Fehlt er, ist das kein Fehler: der Sollzustand ist erreicht. */
export function entferneBesuch(db: Db, guid: string, exponatId: string): void {
  pruefeBesucher(db, guid);
  findeExponat(db, exponatId);
  db.delete(besuche)
    .where(and(eq(besuche.besucherGuid, guid), eq(besuche.exponatId, exponatId)))
    .run();
}

/**
 * Die aufgenommenen Exponate des Besuchers fuer seinen Bereich `/mein`, seit dem 02.11.2026:
 * Kennung, Name und Zeitpunkt, in der Folge der Aufnahme.
 */
export function meineExponate(db: Db, guid: string) {
  return (
    db
      .select({
        exponatId: besuche.exponatId,
        kennung: exponate.kennung,
        name: exponate.name,
        zeitpunkt: besuche.zeitpunkt,
      })
      .from(besuche)
      .innerJoin(exponate, eq(exponate.id, besuche.exponatId))
      .where(eq(besuche.besucherGuid, guid))
      // Bei gleicher Millisekunde entscheidet die Einfuegefolge, sonst waere die Reihe zufaellig.
      .orderBy(asc(besuche.zeitpunkt), sql`${besuche}.rowid`)
      .all()
  );
}

export function besucheVonBesucher(db: Db, guid: string) {
  return db
    .select()
    .from(besuche)
    .where(eq(besuche.besucherGuid, guid))
    .orderBy(asc(besuche.zeitpunkt))
    .all();
}

/**
 * Alle Exponate aus Sicht eines Besuchers, fuer das Besucherdetail: je Exponat `besucht` mit
 * Zeitpunkt und die Inhalte, die er damit im Viewer sieht.
 */
export function exponateFuerBesucher(db: Db, guid: string) {
  const meine = new Map(besucheVonBesucher(db, guid).map((b) => [b.exponatId, b.zeitpunkt]));

  return db
    .select()
    .from(exponate)
    .orderBy(asc(exponate.kennung))
    .all()
    .map((e) => {
      const inhalte = inhalteVonExponat(db, e.id);
      return {
        id: e.id,
        kennung: e.kennung,
        name: e.name,
        besucht: meine.has(e.id),
        zeitpunkt: meine.get(e.id) ?? null,
        anzahl: {
          dokumente: inhalte.dokumente.length,
          links: inhalte.links.length,
          kontakte: inhalte.kontakte.length,
        },
      };
    });
}

/** Die letzten Besuche, fuer das Dashboard. */
export function letzteBesuche(db: Db, grenze: number) {
  return db.select().from(besuche).orderBy(desc(besuche.zeitpunkt)).limit(grenze).all();
}
