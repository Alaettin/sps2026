import { and, asc, eq, sql } from "drizzle-orm";
import type { Db } from "../db/client.js";
import { besucher, besucherKontakte } from "../db/schema.js";
import { badRequest, notFound } from "../errors.js";
import { pruefeGuid } from "./besucher.js";

/**
 * Kontakte unter Besuchern, seit dem 03.11.2026.
 *
 * Ein Besucher scannt den Pass eines anderen und hat ihn danach in seiner Liste, mit Link in
 * dessen Viewer. **Nur registrierte Paesse**: steht die GUID nicht in `besucher`, gibt es nichts
 * aufzunehmen. Einseitig; der Gescannte bekommt keinen Eintrag und keine Nachricht.
 */

/**
 * Nimmt den Kontakt auf. Der Besitzer kommt **aus der Sitzung**, nie aus dem Rumpf.
 * Dass es den Besitzer gibt, hat `verlangeBesucher` schon nachgeschlagen.
 * Idempotent wie der Exponatscan: ein zweiter Scan meldet `neu: false`, der Zeitpunkt bleibt.
 *
 * Die Antwort nennt Name und Firma fuer die Bestaetigung, also genau das, was danach auch in
 * der Liste steht.
 */
export function nimmKontaktAuf(db: Db, guid: string, roheGuid: string) {
  const kontaktGuid = pruefeGuid(roheGuid);
  if (kontaktGuid === guid) {
    throw badRequest("kontakt-selbst", "You cannot add your own pass as a contact.");
  }
  const k = db
    .select({
      guid: besucher.guid,
      titel: besucher.titel,
      vorname: besucher.vorname,
      nachname: besucher.nachname,
      firma: besucher.firma,
    })
    .from(besucher)
    .where(eq(besucher.guid, kontaktGuid))
    .get();
  if (k === undefined) throw notFound("pass-nicht-registriert", "This pass is not registered.");

  const ergebnis = db
    .insert(besucherKontakte)
    .values({ besitzerGuid: guid, kontaktGuid, zeitpunkt: Date.now() })
    .onConflictDoNothing()
    .run();
  return { ...k, neu: ergebnis.changes > 0 };
}

/**
 * Die eigenen Kontakte, in der Folge der Aufnahme.
 *
 * **Ausdruecklich aufgezaehlt**: was ein anderer Besucher von dir sieht, soll hier dastehen
 * und nicht von der Tabelle abhaengen. Keine E-Mail, keine Anschrift.
 */
export function meineKontakte(db: Db, guid: string) {
  return (
    db
      .select({
        guid: besucher.guid,
        titel: besucher.titel,
        vorname: besucher.vorname,
        nachname: besucher.nachname,
        firma: besucher.firma,
        zeitpunkt: besucherKontakte.zeitpunkt,
      })
      .from(besucherKontakte)
      .innerJoin(besucher, eq(besucher.guid, besucherKontakte.kontaktGuid))
      .where(eq(besucherKontakte.besitzerGuid, guid))
      // Bei gleicher Millisekunde entscheidet die Einfuegefolge, wie bei `meineExponate`.
      .orderBy(asc(besucherKontakte.zeitpunkt), sql`${besucherKontakte}.rowid`)
      .all()
  );
}

/** Nimmt den Kontakt heraus. Fehlt er, ist das kein Fehler: der Sollzustand ist erreicht. */
export function entferneKontakt(db: Db, guid: string, kontaktGuid: string): void {
  db.delete(besucherKontakte)
    .where(
      and(eq(besucherKontakte.besitzerGuid, guid), eq(besucherKontakte.kontaktGuid, kontaktGuid)),
    )
    .run();
}
