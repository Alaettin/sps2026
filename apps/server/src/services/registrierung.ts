import { eq } from "drizzle-orm";
import type { Db } from "../db/client.js";
import { besucher } from "../db/schema.js";
import { badRequest, conflict } from "../errors.js";
import { hashePasswort } from "../auth/passwort.js";
import { legeBesucherAn, pruefeGuid, TEXTFELDER, type BesucherEingabe } from "./besucher.js";
import { pruefeAvatarWahl } from "./avatare.js";
import { DATENSCHUTZ_FASSUNG } from "./datenschutz.js";

/**
 * Die Registrierung am Tablet, seit dem 23.10.2026.
 *
 * Der Besucher scannt seinen vorgedruckten Pass; dessen GUID gibt es in der Datenbank noch
 * nicht. Er traegt seine Daten ein, setzt ein Passwort, waehlt ein Bild und willigt in die
 * Verarbeitung ein. **Alles kommt in einem Aufruf am Ende**: bis dahin liegt nichts auf dem
 * Server, und wer mittendrin weggeht, hinterlaesst keinen halben Datensatz.
 *
 * Ein schon registrierter Pass wird **nicht** ueberschrieben. Wer einen fremden Pass in der
 * Hand hat, soll dessen Daten am Tablet weder sehen noch ersetzen koennen.
 */

/** Mindestlaenge des eigenen Passworts. Fuer das Personal gelten 12, siehe `nutzer.ts`. */
export const MIN_BESUCHERPASSWORT = 8;

export type Passstatus = "frei" | "registriert";

export function passstatus(db: Db, roheGuid: string): Passstatus {
  const guid = pruefeGuid(roheGuid);
  const da = db.select({ guid: besucher.guid }).from(besucher).where(eq(besucher.guid, guid)).get();
  return da === undefined ? "frei" : "registriert";
}

export async function registriere(db: Db, roh: Record<string, unknown>): Promise<void> {
  // --- Pruefen, bevor irgendetwas geschrieben oder gehasht wird ------------------------
  const einwilligung = roh["einwilligung"] as { erteilt?: unknown; fassung?: unknown } | undefined;
  if (einwilligung?.erteilt !== true) {
    throw badRequest("einwilligung-fehlt", "Consent to the privacy notice is required.");
  }
  if (einwilligung.fassung !== DATENSCHUTZ_FASSUNG) {
    throw conflict(
      "datenschutz-veraltet",
      "The privacy notice has changed. Please reload and read the current version.",
    );
  }

  const passwort = roh["passwort"];
  if (typeof passwort !== "string" || passwort.length < MIN_BESUCHERPASSWORT) {
    throw badRequest(
      "passwort-zu-kurz",
      `Password must be at least ${String(MIN_BESUCHERPASSWORT)} characters.`,
    );
  }

  const guid = roh["guid"];
  if (typeof guid !== "string") throw badRequest("guid-ungueltig", "Field guid is required.");
  if (passstatus(db, guid) === "registriert") {
    throw conflict("bereits-registriert", "This pass is already registered.");
  }

  const eingabe: Record<string, unknown> = { guid };
  for (const feld of TEXTFELDER) {
    if (typeof roh[feld] === "string") eingabe[feld] = roh[feld];
  }
  if (typeof eingabe["vorname"] !== "string" || typeof eingabe["nachname"] !== "string") {
    throw badRequest("pflicht-fehlt", "Fields vorname and nachname are required.");
  }
  // Nur Standard oder Galerie, wie ueberall, wo ein Avatar gesetzt wird.
  eingabe["avatarDateiId"] = pruefeAvatarWahl(db, roh["avatarDateiId"] ?? null);

  const hash = await hashePasswort(passwort);

  // --- Schreiben, in einem Zug ---------------------------------------------------------
  db.transaction(() => {
    // Prueft E-Mail (Pflicht, eindeutig), Namen und GUID noch einmal und legt an.
    const angelegt = legeBesucherAn(db, eingabe as unknown as BesucherEingabe);
    db.update(besucher)
      .set({
        passwortHash: hash,
        einwilligungAm: Date.now(),
        einwilligungFassung: DATENSCHUTZ_FASSUNG,
      })
      .where(eq(besucher.guid, angelegt.guid))
      .run();
  });
}
