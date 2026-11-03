import { ApiFehler } from "./api.js";

/**
 * Was ein Fehler des Servers dem Menschen sagt, auf Deutsch und Englisch. Seit dem 03.11.2026.
 *
 * Der Server meldet je Grund einen eigenen `code` und eine englische `message` fuer Protokolle
 * (`apps/server/src/errors.ts`). Angezeigt wird der Satz aus dieser Tabelle; fehlt der Code
 * hier, der Rueckfall der Stelle, die den Fehler zeigt. Auf Englisch darf dann die Meldung des
 * Servers stehen, auf Deutsch nie: sie ist englisch.
 */

const TEXTE: Record<string, [string, string]> = {
  netzwerk: ["Keine Verbindung zum Dienst.", "No connection to the service."],
  "nicht-angemeldet": ["Nicht angemeldet.", "Not signed in."],
  "nur-admin": ["Das darf nur ein Admin.", "Only an admin can do this."],
  "pflicht-fehlt": [
    "Vorname, Nachname und E-Mail dürfen nicht leer sein.",
    "First name, last name and email must not be empty.",
  ],
  "feld-fehlt": ["Bitte alle Pflichtfelder ausfüllen.", "Please fill in all required fields."],
  "felder-fehlen": ["Bitte alle Pflichtfelder ausfüllen.", "Please fill in all required fields."],
  "feld-zu-lang": ["Eine Angabe ist zu lang.", "One of the entries is too long."],
  "email-ungueltig": ["Die E-Mail-Adresse ist ungültig.", "The email address is not valid."],
  "email-vergeben": [
    "Diese E-Mail-Adresse ist schon vergeben.",
    "This email address is already in use.",
  ],
  "guid-vergeben": ["Diese Passnummer ist schon vergeben.", "This pass number is already in use."],
  "guid-ungueltig": ["Diese Passnummer ist ungültig.", "This pass number is not valid."],
  "bereits-registriert": ["Dieser Pass ist schon registriert.", "This pass is already registered."],
  "passwort-zu-kurz": ["Das Passwort ist zu kurz.", "The password is too short."],
  "einwilligung-fehlt": [
    "Bitte dem Datenschutzhinweis zustimmen.",
    "Please consent to the privacy notice.",
  ],
  "datenschutz-veraltet": [
    "Der Datenschutzhinweis hat sich geändert. Bitte neu laden und den aktuellen Text lesen.",
    "The privacy notice has changed. Please reload and read the current version.",
  ],
  "avatar-unbekannt": ["Dieses Bild gibt es nicht.", "This picture does not exist."],
  "code-unbekannt": [
    "Diesen Code kennen wir nicht. Bitte den QR-Code am Exponat scannen.",
    "We don't recognise this code. Please scan the QR code on the exhibit.",
  ],
  "exponat-unbekannt": ["Dieses Exponat gibt es nicht.", "This exhibit does not exist."],
  "besucher-unbekannt": ["Diesen Besucher gibt es nicht.", "This visitor does not exist."],
  "nutzer-unbekannt": ["Diesen Nutzer gibt es nicht.", "This user does not exist."],
  "element-unbekannt": [
    "Dieser Eintrag gehört nicht zu diesem Exponat.",
    "This item does not belong to this exhibit.",
  ],
  "kontakt-unbekannt": [
    "Diesen Ansprechpartner gibt es an diesem Exponat nicht.",
    "This contact does not exist at this exhibit.",
  ],
  "url-ungueltig": [
    "Der Link muss mit http:// oder https:// beginnen.",
    "The link must start with http:// or https://.",
  ],
  "datei-fehlt": ["Bitte eine Datei wählen.", "Please choose a file."],
  "kontingent-erschoepft": ["Alle Plätze sind belegt.", "All slots are taken."],
  "sicherung-inkonsistent": [
    "Die Sicherung enthält Verweise ins Leere.",
    "The backup contains dangling references.",
  ],
  "letzter-admin": [
    "Der letzte aktive Admin lässt sich nicht deaktivieren oder herabstufen.",
    "The last active admin cannot be deactivated or demoted.",
  ],
  "selbst-loeschen": [
    "Das eigene Konto lässt sich nicht löschen.",
    "You cannot delete your own account.",
  ],
  "rolle-ungueltig": ["Diese Rolle gibt es nicht.", "This role does not exist."],
  "csv-leer": ["Die Datei ist leer.", "The file is empty."],
  "csv-unlesbar": ["Die Datei ließ sich nicht lesen.", "The file could not be read."],
  "sicherung-unlesbar": [
    "Die Datei ist kein lesbares ZIP-Archiv.",
    "The file is not a readable ZIP archive.",
  ],
  "sicherung-fremd": [
    "Das Archiv ist die Sicherung einer anderen App.",
    "The archive is a backup of a different app.",
  ],
  "sicherung-unvollstaendig": [
    "Das Archiv ist keine Sicherung dieser App.",
    "The archive is not a backup of this app.",
  ],
  "sicherung-db-defekt": [
    "Die Datenbank in der Sicherung ist beschädigt oder passt nicht.",
    "The database in the backup is damaged or does not match.",
  ],
  "sicherung-pfad": ["Das Archiv enthält ungültige Pfade.", "The archive contains invalid paths."],
  "global-unbekannt": [
    "Diesen globalen Datenpunkt gibt es nicht.",
    "This global data point does not exist.",
  ],
  "art-passt-nicht": [
    "Dieser Datenpunkt hat eine andere Art.",
    "This data point is of a different kind.",
  ],
  "anmeldung-falsch": [
    "E-Mail oder Passwort ist nicht korrekt.",
    "Email or password is not correct.",
  ],
};

/**
 * Der anzuzeigende Satz zu einem Fehler.
 *
 * `rueckfall` ist der Satz der Stelle, etwa „Speichern nicht möglich.“, und gilt, wenn der
 * Code hier fehlt oder der Fehler nicht vom Server kommt.
 */
export function fehlertext(
  ursache: unknown,
  t: (de: string, en: string) => string,
  rueckfall: [string, string],
): string {
  if (ursache instanceof ApiFehler) {
    const eintrag = TEXTE[ursache.code];
    if (eintrag !== undefined) return t(eintrag[0], eintrag[1]);
    return t(rueckfall[0], ursache.message);
  }
  return t(rueckfall[0], rueckfall[1]);
}
