import type { Db } from "../db/client.js";
import { badRequest } from "../errors.js";
import { aendereBesucher, findeBesucher, TEXTFELDER } from "./besucher.js";
import { galerieIds, pruefeAvatarWahl } from "./avatare.js";
import { STANDARD_AVATAR_ID } from "./standardavatar.js";

/**
 * Was ein angemeldeter Besucher an sich selbst sehen und aendern darf (`routes/mein.ts`, GUID
 * aus der Sitzung). Das Tablet liest seit dem 23.10.2026 keine Besucherdaten mehr, es
 * registriert nur noch; die Auswahl der Avatare teilt es sich mit diesem Bereich.
 */

/**
 * Der Besucher, wie er sich selbst sieht.
 *
 * **Ausdruecklich aufgezaehlt, nicht durchgereicht.** `findeBesucher` liefert auch
 * Zeitstempel und interne Felder; was ein Geraet im Publikum sieht, soll hier dastehen und
 * nicht davon abhaengen, was eine andere Funktion spaeter ergaenzt.
 */
export function selbstAnsicht(db: Db, guid: string) {
  const b = findeBesucher(db, guid);
  const felder = Object.fromEntries(TEXTFELDER.map((f) => [f, b[f]]));
  return { guid: b.guid, ...felder, avatarDateiId: b.avatarDateiId };
}

/**
 * Stammdaten aendern. Nur `TEXTFELDER`; `avatarDateiId` aus dem Rumpf wird **verworfen**,
 * damit dieser Weg nicht am Galerie-Filter von `waehleAvatar` vorbeifuehrt. Die E-Mail
 * prueft `aendereBesucher` (Pflicht, eindeutig).
 */
export function aendereSelbst(db: Db, guid: string, roh: Record<string, unknown>) {
  const eingabe: Record<string, unknown> = {};
  for (const feld of TEXTFELDER) {
    if (feld in roh) eingabe[feld] = roh[feld];
  }
  if (typeof eingabe["vorname"] === "string" && eingabe["vorname"].trim() === "") {
    throw badRequest("pflicht-fehlt", "Field vorname must not be empty.");
  }
  if (typeof eingabe["nachname"] === "string" && eingabe["nachname"].trim() === "") {
    throw badRequest("pflicht-fehlt", "Field nachname must not be empty.");
  }
  aendereBesucher(db, guid, eingabe);
  return selbstAnsicht(db, guid);
}

/** Einen Avatar setzen. `null` bedeutet den Standard; sonst nur Ids aus der Galerie. */
export function waehleAvatar(db: Db, guid: string, roh: unknown) {
  const b = aendereBesucher(db, guid, { avatarDateiId: pruefeAvatarWahl(db, roh) });
  return { guid: b.guid, avatarDateiId: b.avatarDateiId };
}

/**
 * Die Auswahl der Avatare. `standard` steht getrennt daneben, weil er kein Galeriebild ist,
 * aber waehlbar sein soll.
 */
export function avatarAuswahl(db: Db) {
  return { standard: STANDARD_AVATAR_ID, avatare: galerieIds(db) };
}

/**
 * Welche Bilder ein Besucher abrufen darf: Standard, Galerie und sein eigener Avatar.
 * Alles andere in der Ablage (Dokumente der Exponate, fremde Dateien) bleibt Personalsache.
 */
export function darfBildSehen(db: Db, guid: string, dateiId: string): boolean {
  if (dateiId === STANDARD_AVATAR_ID) return true;
  if (findeBesucher(db, guid).avatarDateiId === dateiId) return true;
  return galerieIds(db).includes(dateiId);
}
