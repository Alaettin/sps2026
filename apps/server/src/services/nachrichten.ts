import { randomUUID } from "node:crypto";
import { and, asc, eq } from "drizzle-orm";
import type { Db } from "../db/client.js";
import { nachrichten } from "../db/schema.js";
import type { Dateiablage } from "../ablage/dateien.js";
import { AppError, badRequest, kontingentErschoepft, notFound } from "../errors.js";
import { MAX_NACHRICHTEN } from "../modell/felder.js";
import { loescheDatei, speichereDatei } from "./dateien.js";
import { mimeAusName } from "./mime.js";

/**
 * Nachrichten, die ein Besucher seinem Messepass hinzufuegt, seit dem 23.10.2026.
 *
 * **Jede Funktion nimmt die GUID des Besuchers mit.** Eine Nachricht wird immer ueber das Paar
 * (GUID, Id) gesucht, nie ueber die Id allein; so kann eine fremde Id hoechstens ein 404
 * ergeben, nie die Nachricht eines anderen.
 *
 * **Bilder gehoeren der Nachricht.** Wird es ersetzt, entfernt oder die Nachricht geloescht,
 * geht die Datei mit; sonst wuechse die Ablage um Bilder, die niemand mehr zeigt, und die
 * Loeschung, die ein Besucher erwartet, waere keine.
 */

export const MAX_TITEL = 100;
export const MAX_TEXT = 2000;
/** Das Tablet und der Browser verkleinern vorher; das hier ist nur die harte Grenze. */
export const MAX_BILD_BYTES = 5 * 1024 * 1024;

/** Nur Fotoformate, die jeder Browser und der Viewer anzeigen. */
const BILDTYPEN = new Set(["image/jpeg", "image/png", "image/webp"]);

export interface Bild {
  name: string;
  inhalt: Buffer;
}

export interface NachrichtEingabe {
  titel?: string | null;
  text?: string | null;
  bild?: Bild | null;
  /** Nur beim Aendern: das vorhandene Bild entfernen. */
  bildEntfernen?: boolean;
}

export type Nachricht = typeof nachrichten.$inferSelect;

export function nachrichtenVon(db: Db, guid: string): Nachricht[] {
  return db
    .select()
    .from(nachrichten)
    .where(eq(nachrichten.besucherGuid, guid))
    .orderBy(asc(nachrichten.platz))
    .all();
}

function findeNachricht(db: Db, guid: string, id: string): Nachricht {
  const reihe = db
    .select()
    .from(nachrichten)
    .where(and(eq(nachrichten.besucherGuid, guid), eq(nachrichten.id, id)))
    .get();
  if (reihe === undefined) throw notFound("nachricht-unbekannt", "Unknown message.");
  return reihe;
}

/** Leeres wird `null`, Zu-Langes abgewiesen. */
function textfeld(wert: string | null | undefined, max: number, feld: string): string | null {
  const sauber = (wert ?? "").trim();
  if (sauber.length > max) {
    throw badRequest("feld-zu-lang", `Field ${feld} must be at most ${String(max)} characters.`);
  }
  return sauber === "" ? null : sauber;
}

function pruefeBild(bild: Bild): void {
  if (!BILDTYPEN.has(mimeAusName(bild.name))) {
    throw badRequest("bild-ungueltig", "Only JPEG, PNG or WebP images are allowed.");
  }
  if (bild.inhalt.length > MAX_BILD_BYTES) {
    throw new AppError(413, "bild-zu-gross", "The image must be at most 5 MB.");
  }
  if (bild.inhalt.length === 0) throw badRequest("bild-ungueltig", "The image is empty.");
}

function kleinsterFreierPlatz(db: Db, guid: string): number {
  const belegt = new Set(nachrichtenVon(db, guid).map((n) => n.platz));
  for (let p = 1; p <= MAX_NACHRICHTEN; p++) if (!belegt.has(p)) return p;
  throw kontingentErschoepft(`All ${String(MAX_NACHRICHTEN)} message slots are in use.`, {
    obergrenze: MAX_NACHRICHTEN,
  });
}

export async function legeNachrichtAn(
  db: Db,
  ablage: Dateiablage,
  guid: string,
  eingabe: NachrichtEingabe,
): Promise<Nachricht> {
  const titel = textfeld(eingabe.titel, MAX_TITEL, "titel");
  const text = textfeld(eingabe.text, MAX_TEXT, "text");
  if (titel === null && text === null) {
    throw badRequest("nachricht-leer", "A message needs a title or a text.");
  }
  if (eingabe.bild) pruefeBild(eingabe.bild);
  // Vor dem Speichern des Bildes: bei vollem Kontingent soll keine Datei liegen bleiben.
  const platz = kleinsterFreierPlatz(db, guid);

  const bild = eingabe.bild
    ? await speichereDatei(db, ablage, eingabe.bild.name, eingabe.bild.inhalt)
    : null;
  const jetzt = Date.now();
  const reihe: Nachricht = {
    id: randomUUID(),
    besucherGuid: guid,
    platz,
    titel,
    text,
    bildDateiId: bild?.id ?? null,
    angelegt: jetzt,
    geaendert: jetzt,
  };
  db.insert(nachrichten).values(reihe).run();
  return reihe;
}

export async function aendereNachricht(
  db: Db,
  ablage: Dateiablage,
  guid: string,
  id: string,
  eingabe: NachrichtEingabe,
): Promise<Nachricht> {
  const alt = findeNachricht(db, guid, id);
  const titel =
    eingabe.titel === undefined ? alt.titel : textfeld(eingabe.titel, MAX_TITEL, "titel");
  const text = eingabe.text === undefined ? alt.text : textfeld(eingabe.text, MAX_TEXT, "text");
  if (titel === null && text === null) {
    throw badRequest("nachricht-leer", "A message needs a title or a text.");
  }
  if (eingabe.bild) pruefeBild(eingabe.bild);

  let bildDateiId = alt.bildDateiId;
  if (eingabe.bild) {
    bildDateiId = (await speichereDatei(db, ablage, eingabe.bild.name, eingabe.bild.inhalt)).id;
  } else if (eingabe.bildEntfernen === true) {
    bildDateiId = null;
  }

  db.update(nachrichten)
    .set({ titel, text, bildDateiId, geaendert: Date.now() })
    .where(eq(nachrichten.id, alt.id))
    .run();

  // Erst nach dem Umhaengen: das alte Bild hat dann keinen Verweis mehr.
  if (alt.bildDateiId !== null && alt.bildDateiId !== bildDateiId) {
    await loescheDatei(db, ablage, alt.bildDateiId);
  }
  return findeNachricht(db, guid, id);
}

export async function loescheNachricht(
  db: Db,
  ablage: Dateiablage,
  guid: string,
  id: string,
): Promise<void> {
  const alt = findeNachricht(db, guid, id);
  db.delete(nachrichten).where(eq(nachrichten.id, alt.id)).run();
  if (alt.bildDateiId !== null) await loescheDatei(db, ablage, alt.bildDateiId);
}

/**
 * Alle Nachrichten eines Besuchers samt Bildern, etwa bevor der Besucher selbst geloescht wird.
 * Die Zeilen nimmt die Kaskade mit; die Dateien muessen ausdruecklich weg.
 */
export async function loescheAlleNachrichten(
  db: Db,
  ablage: Dateiablage,
  guid: string,
): Promise<void> {
  for (const n of nachrichtenVon(db, guid)) await loescheNachricht(db, ablage, guid, n.id);
}

/** Gehoert dieses Bild zu einer Nachricht dieses Besuchers? Fuer `/api/mein/bild`. */
export function istEigenesNachrichtenbild(db: Db, guid: string, dateiId: string): boolean {
  return nachrichtenVon(db, guid).some((n) => n.bildDateiId === dateiId);
}
