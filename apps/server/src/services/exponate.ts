import { randomBytes, randomUUID } from "node:crypto";
import { and, asc, count, eq } from "drizzle-orm";
import type { Db } from "../db/client.js";
import type { Dateiablage } from "../ablage/dateien.js";
import {
  besuche,
  dateien,
  exponate,
  exponatBetreuer,
  exponatDokumente,
  exponatKontakte,
  exponatLinks,
} from "../db/schema.js";
import { badRequest, kontingentErschoepft, notFound } from "../errors.js";
import { MAX_DOKUMENTE, MAX_LINKS } from "../modell/felder.js";
import { loescheDatei, speichereDatei } from "./dateien.js";
import { kontakteVonExponat } from "./kontakte.js";

/**
 * Exponate und ihre Inhalte.
 *
 * Der **Platz** eines Elements ist die Bruecke zum Konnektor-Modell: aus Platz 3 eines
 * Dokuments am Exponat `E03` wird `E03_Doc03_Title`, und genau das hat der Content-Admin
 * in Axon gemappt. Deshalb aendert sich ein einmal vergebener Platz nie.
 */

/**
 * Vergibt die naechste Kennung: **die kleinste freie Nummer**, `E01`, `E02`, …
 *
 * Entschieden am 08.10.2026. Zur Folge, damit sie nachlesbar bleibt: wird `E03` geloescht
 * und ein neues Exponat angelegt, heisst dieses wieder `E03` und **erbt das Axon-Mapping
 * des geloeschten**. Steht dort schon ein Mapping, zeigt der Viewer die Datenpunkte des
 * neuen Exponats an der Stelle des alten. Die Rueckfrage beim Loeschen sagt das.
 *
 * Der Nutzer gibt die Kennung nicht mehr ein und kann sie nicht aendern: sie steht in jedem
 * `propertyId` dieses Exponats, und ein Wechsel bricht das Mapping.
 */
export function naechsteKennung(db: Db): string {
  const belegt = new Set(
    db
      .select({ kennung: exponate.kennung })
      .from(exponate)
      .all()
      .map((e) => e.kennung),
  );
  for (let n = 1; n <= 99; n++) {
    const kennung = `E${String(n).padStart(2, "0")}`;
    if (!belegt.has(kennung)) return kennung;
  }
  throw kontingentErschoepft("All 99 exhibit codes are in use.", { obergrenze: 99 });
}

export function findeExponat(db: Db, id: string) {
  const reihe = db.select().from(exponate).where(eq(exponate.id, id)).get();
  if (reihe === undefined) throw notFound("exponat-unbekannt", "Unknown exhibit.");
  return reihe;
}

export function listeExponate(db: Db) {
  return db.select().from(exponate).orderBy(asc(exponate.kennung)).all();
}

export function legeExponatAn(db: Db, eingabe: { name: string; beschreibung?: string | null }) {
  if (eingabe.name.trim() === "") throw badRequest("feld-fehlt", "Field name is required.");

  const reihe = {
    id: randomUUID(),
    // Vom Server vergeben, siehe `naechsteKennung`.
    kennung: naechsteKennung(db),
    name: eingabe.name.trim(),
    beschreibung: eingabe.beschreibung?.trim() ?? null,
    // Der geheime Teil des QR-Codes am Exponat, siehe `exponate.scanCode`.
    scanCode: randomBytes(16).toString("base64url"),
    angelegt: Date.now(),
  };
  db.insert(exponate).values(reihe).run();
  return reihe;
}

/**
 * Aendert Name und Beschreibung eines Exponats.
 *
 * **Die Kennung laesst sich nicht aendern.** Sie steht in jedem `propertyId` dieses
 * Exponats; ein Wechsel benennt alle Datenpunkte um und bricht das Mapping in Axon. Der
 * frueher dafuer vorgesehene Weg mit ausdruecklicher Bestaetigung ist entfallen, weil die
 * Kennung jetzt ohnehin vom Server vergeben wird.
 */
export function aendereExponat(
  db: Db,
  id: string,
  eingabe: { name?: string; beschreibung?: string | null },
) {
  findeExponat(db, id);
  const aenderung: Record<string, unknown> = {};

  if (eingabe.name !== undefined) {
    if (eingabe.name.trim() === "") throw badRequest("feld-fehlt", "Field name must not be empty.");
    aenderung["name"] = eingabe.name.trim();
  }
  if ("beschreibung" in eingabe) aenderung["beschreibung"] = eingabe.beschreibung?.trim() ?? null;

  if (Object.keys(aenderung).length > 0) {
    db.update(exponate).set(aenderung).where(eq(exponate.id, id)).run();
  }
  return findeExponat(db, id);
}

export function loescheExponat(db: Db, id: string): void {
  findeExponat(db, id);
  db.delete(exponate).where(eq(exponate.id, id)).run();
}

// --- Plaetze ---------------------------------------------------------------------------

/**
 * Die kleinste freie Nummer, eins-basiert.
 *
 * **Nicht `max + 1`.** Wird Platz 3 von fuenf geloescht, soll der naechste Upload dort
 * landen statt auf Platz 6: sonst waechst die Nummer immer weiter, obwohl Plaetze frei
 * sind, und die Obergrenze waere nach zehn Loeschvorgaengen erreicht, ohne dass zehn
 * Dokumente da sind.
 */
export function kleinsterFreierPlatz(belegt: number[], obergrenze: number, was: string): number {
  const genommen = new Set(belegt);
  for (let p = 1; p <= obergrenze; p++) {
    if (!genommen.has(p)) return p;
  }
  throw kontingentErschoepft(`All ${String(obergrenze)} ${was} slots of this exhibit are in use.`, {
    obergrenze,
    was,
  });
}

function belegtePlaetze(
  db: Db,
  tabelle: typeof exponatDokumente | typeof exponatLinks,
  exponatId: string,
) {
  return db
    .select({ platz: tabelle.platz })
    .from(tabelle)
    .where(eq(tabelle.exponatId, exponatId))
    .all()
    .map((d) => d.platz);
}

/** Eine hochgeladene Datei aus einem Multipart-Koerper. */
export interface Upload {
  name: string;
  inhalt: Buffer;
}

/**
 * Legt ein Dokument **samt Datei** an, seit dem 02.11.2026 in einem Aufruf.
 *
 * Der Platz wird **vor** dem Speichern der Datei geprueft: sind alle zehn belegt, soll keine
 * Datei in der Ablage liegen bleiben, an der nichts haengt.
 */
export async function legeDokumentAn(
  db: Db,
  ablage: Dateiablage,
  exponatId: string,
  eingabe: { datei: Upload; titel: string; beschreibung?: string | null },
) {
  findeExponat(db, exponatId);
  if (eingabe.titel.trim() === "") throw badRequest("feld-fehlt", "Field titel is required.");
  const platz = kleinsterFreierPlatz(
    belegtePlaetze(db, exponatDokumente, exponatId),
    MAX_DOKUMENTE,
    "document",
  );

  const datei = await speichereDatei(db, ablage, eingabe.datei.name, eingabe.datei.inhalt);
  const reihe = {
    id: randomUUID(),
    exponatId,
    platz,
    dateiId: datei.id,
    titel: eingabe.titel.trim(),
    beschreibung: leerAlsNull(eingabe.beschreibung),
  };
  db.insert(exponatDokumente).values(reihe).run();
  return reihe;
}

/**
 * Aendert Titel, Beschreibung oder die Datei eines Dokuments. Der Platz bleibt, also auch das
 * Mapping in Axon. Eine ersetzte Datei wird geloescht, **nachdem** das Dokument auf die neue
 * zeigt; andersherum wiese SQLite das Loeschen ab (kein `set null` an dieser Stelle).
 */
export async function aendereDokument(
  db: Db,
  ablage: Dateiablage,
  exponatId: string,
  id: string,
  eingabe: { datei?: Upload; titel?: string; beschreibung?: string | null },
) {
  const vorher = findeElement(db, exponatDokumente, exponatId, id);
  const aenderung: Partial<typeof exponatDokumente.$inferInsert> = {};
  if (eingabe.titel !== undefined) {
    if (eingabe.titel.trim() === "")
      throw badRequest("feld-fehlt", "Field titel must not be empty.");
    aenderung.titel = eingabe.titel.trim();
  }
  if ("beschreibung" in eingabe) aenderung.beschreibung = leerAlsNull(eingabe.beschreibung);
  if (eingabe.datei !== undefined) {
    aenderung.dateiId = (
      await speichereDatei(db, ablage, eingabe.datei.name, eingabe.datei.inhalt)
    ).id;
  }

  if (Object.keys(aenderung).length > 0) {
    db.update(exponatDokumente).set(aenderung).where(eq(exponatDokumente.id, id)).run();
  }
  if (aenderung.dateiId !== undefined) await loescheDatei(db, ablage, vorher.dateiId);
  return findeElement(db, exponatDokumente, exponatId, id);
}

/**
 * Nur `http` und `https`. Seit der Betreuer Links selbst anlegt, landet sonst ein
 * `javascript:` ungeprueft im Viewer.
 */
function pruefeUrl(url: string): string {
  const sauber = url.trim();
  let protokoll = "";
  try {
    protokoll = new URL(sauber).protocol;
  } catch {
    // faellt unten durch
  }
  if (protokoll !== "http:" && protokoll !== "https:") {
    throw badRequest("url-ungueltig", "Field url must be an http or https address.");
  }
  return sauber;
}

export function legeLinkAn(db: Db, exponatId: string, eingabe: { url: string; titel: string }) {
  findeExponat(db, exponatId);
  if (eingabe.titel.trim() === "") throw badRequest("feld-fehlt", "Field titel is required.");
  const reihe = {
    id: randomUUID(),
    exponatId,
    platz: kleinsterFreierPlatz(belegtePlaetze(db, exponatLinks, exponatId), MAX_LINKS, "link"),
    url: pruefeUrl(eingabe.url),
    titel: eingabe.titel.trim(),
  };
  db.insert(exponatLinks).values(reihe).run();
  return reihe;
}

export function aendereLink(
  db: Db,
  exponatId: string,
  id: string,
  eingabe: { url?: string; titel?: string },
) {
  findeElement(db, exponatLinks, exponatId, id);
  const aenderung: Partial<typeof exponatLinks.$inferInsert> = {};
  if (eingabe.titel !== undefined) {
    if (eingabe.titel.trim() === "")
      throw badRequest("feld-fehlt", "Field titel must not be empty.");
    aenderung.titel = eingabe.titel.trim();
  }
  if (eingabe.url !== undefined) aenderung.url = pruefeUrl(eingabe.url);
  if (Object.keys(aenderung).length > 0) {
    db.update(exponatLinks).set(aenderung).where(eq(exponatLinks.id, id)).run();
  }
  return findeElement(db, exponatLinks, exponatId, id);
}

function leerAlsNull(wert: string | null | undefined): string | null {
  return wert === null || wert === undefined || wert.trim() === "" ? null : wert.trim();
}

/**
 * Ein Element **dieses** Exponats. Immer ueber Exponat und Id gesucht: sonst aenderte ein
 * Betreuer ueber eine untergeschobene Id ein Dokument an einem fremden Exponat.
 */
function findeElement<T extends typeof exponatDokumente | typeof exponatLinks>(
  db: Db,
  tabelle: T,
  exponatId: string,
  id: string,
): T["$inferSelect"] {
  const reihe = db
    .select()
    .from(tabelle)
    .where(and(eq(tabelle.exponatId, exponatId), eq(tabelle.id, id)))
    .get();
  if (reihe === undefined) throw notFound("element-unbekannt", "No such item at this exhibit.");
  return reihe as T["$inferSelect"];
}

/**
 * Die Inhalte eines Exponats, **mit den Angaben zur hinterlegten Datei**.
 *
 * `mimeType`, `originalName` und `groesse` kommen aus `dateien` dazu. Ohne sie kann die
 * Oberflaeche nicht entscheiden, ob ein Dokument als Bild in einem Fenster erscheint oder
 * als PDF in einem neuen Tab, und muesste je Zeile einzeln nachfragen.
 *
 * `leftJoin`, nicht `innerJoin`: fehlt die Datei (geloescht, Volume weg), soll das Dokument
 * trotzdem in der Liste stehen und sich entfernen lassen.
 */
export function inhalteVonExponat(db: Db, exponatId: string) {
  const dokumente = db
    .select({
      id: exponatDokumente.id,
      exponatId: exponatDokumente.exponatId,
      platz: exponatDokumente.platz,
      dateiId: exponatDokumente.dateiId,
      titel: exponatDokumente.titel,
      beschreibung: exponatDokumente.beschreibung,
      mimeType: dateien.mimeType,
      originalName: dateien.originalName,
      groesse: dateien.groesse,
    })
    .from(exponatDokumente)
    .leftJoin(dateien, eq(dateien.id, exponatDokumente.dateiId))
    .where(eq(exponatDokumente.exponatId, exponatId))
    .orderBy(asc(exponatDokumente.platz))
    .all();

  return {
    dokumente,
    links: db
      .select()
      .from(exponatLinks)
      .where(eq(exponatLinks.exponatId, exponatId))
      .orderBy(asc(exponatLinks.platz))
      .all(),
    kontakte: kontakteVonExponat(db, exponatId),
  };
}

/**
 * Wie viele Besucher dieses Exponat aufgenommen haben.
 *
 * Seit dem 02.11.2026 dieselbe Zahl fuer jedes Element: aufgenommen wird das ganze Exponat,
 * und jeder dieser Besucher verliert ein geloeschtes Dokument im Viewer. Die Oberflaeche nennt
 * die Zahl **vor** dem Loeschen.
 */
export function besucherVonExponat(db: Db, exponatId: string): number {
  return (
    db.select({ n: count() }).from(besuche).where(eq(besuche.exponatId, exponatId)).get()?.n ?? 0
  );
}

/**
 * Loescht ein Element. Ein Dokument nimmt seit dem 02.11.2026 seine Datei mit: der Betreuer
 * loescht am Stand, und verwaiste Dateien saehe niemand mehr.
 */
export async function loescheInhalt(
  db: Db,
  ablage: Dateiablage,
  exponatId: string,
  art: "dokument" | "link" | "kontakt",
  zielId: string,
): Promise<void> {
  if (art === "dokument") {
    const d = findeElement(db, exponatDokumente, exponatId, zielId);
    db.delete(exponatDokumente).where(eq(exponatDokumente.id, zielId)).run();
    await loescheDatei(db, ablage, d.dateiId);
  } else if (art === "link") {
    findeElement(db, exponatLinks, exponatId, zielId);
    db.delete(exponatLinks).where(eq(exponatLinks.id, zielId)).run();
  } else {
    const weg = db
      .delete(exponatKontakte)
      .where(and(eq(exponatKontakte.exponatId, exponatId), eq(exponatKontakte.id, zielId)))
      .run();
    if (weg.changes === 0)
      throw notFound("kontakt-unbekannt", "No contact with this id at this exhibit.");
  }
}

// --- Betreuer ---------------------------------------------------------------------------

export function betreuerVonExponat(db: Db, exponatId: string): string[] {
  return db
    .select({ id: exponatBetreuer.appNutzerId })
    .from(exponatBetreuer)
    .where(eq(exponatBetreuer.exponatId, exponatId))
    .all()
    .map((b) => b.id);
}

export function istBetreuer(db: Db, exponatId: string, nutzerId: string): boolean {
  return (
    db
      .select({ id: exponatBetreuer.appNutzerId })
      .from(exponatBetreuer)
      .where(
        and(eq(exponatBetreuer.exponatId, exponatId), eq(exponatBetreuer.appNutzerId, nutzerId)),
      )
      .get() !== undefined
  );
}
