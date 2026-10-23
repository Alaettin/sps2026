import { eq, sql } from "drizzle-orm";
import type { Db } from "../db/client.js";
import { besucher } from "../db/schema.js";
import { hashePasswort, pruefeInsLeere, pruefePasswort } from "../auth/passwort.js";
import { findeBesucher } from "./besucher.js";

/**
 * Die Anmeldung der Besucher, seit dem 23.10.2026.
 *
 * Besucher sind keine App-Nutzer: sie bleiben in `besucher` und bekommen eine eigene Art von
 * Sitzung (`art: "besucher"`, siehe `auth/session.ts`). Der Login ist ihre E-Mail.
 *
 * **Vorerst haben alle dasselbe Passwort.** `passwort_hash = NULL` heisst: es gilt
 * `STANDARD_BESUCHERPASSWORT`. So gilt es sofort fuer Bestand, Aussaat und Neuanlage, ohne je
 * Besucher einen Hash zu rechnen, und Zuruecksetzen ist `NULL`. Wie Besucher spaeter zu einem
 * eigenen Passwort kommen, ist offen.
 */
export const STANDARD_BESUCHERPASSWORT = "password";

/**
 * Der Hash des Standardpassworts, einmal je Prozess.
 *
 * Geprueft wird **gegen einen echten Hash**, nicht per Textvergleich: so kostet jede Anmeldung
 * dieselbe argon2-Zeit, egal ob ein eigenes oder das Standardpasswort gilt.
 */
let standardHash: Promise<string> | null = null;

/** Die GUID des Besuchers, wenn E-Mail und Passwort stimmen, sonst `null`. */
export async function pruefeBesucherAnmeldung(
  db: Db,
  email: string,
  passwort: string,
): Promise<string | null> {
  const reihe = db
    .select({ guid: besucher.guid, passwortHash: besucher.passwortHash })
    .from(besucher)
    .where(sql`lower(${besucher.email}) = lower(${email.trim()})`)
    .get();

  if (reihe === undefined) {
    // Auch ohne Treffer hashen, siehe `pruefeInsLeere`.
    await pruefeInsLeere(passwort);
    return null;
  }

  standardHash ??= hashePasswort(STANDARD_BESUCHERPASSWORT);
  const stimmt = await pruefePasswort(reihe.passwortHash ?? (await standardHash), passwort);
  return stimmt ? reihe.guid : null;
}

/**
 * Setzt das Passwort eines Besuchers zurueck. Vorerst heisst das: zurueck auf das
 * Standardpasswort. Was hier spaeter genau passiert, ist noch nicht entschieden.
 */
export function setzeBesucherPasswortZurueck(db: Db, guid: string): void {
  findeBesucher(db, guid);
  db.update(besucher).set({ passwortHash: null }).where(eq(besucher.guid, guid)).run();
}
