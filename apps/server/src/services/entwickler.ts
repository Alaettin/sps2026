import { eq, notInArray, sql } from "drizzle-orm";
import type { Db } from "../db/client.js";
import type { Dateiablage } from "../ablage/dateien.js";
import { STANDARD_AVATAR_ID, stelleStandardAvatarSicher } from "./standardavatar.js";
import { SCHLUESSEL_UNBEKANNT } from "./abrufe.js";
import {
  appNutzer,
  avatare,
  besucher,
  dateien,
  exponate,
  exponatBetreuer,
  exponatDokumente,
  besuche,
  exponatKontakte,
  einstellungen,
  exponatLinks,
  globaleDaten,
  konnektorAbrufe,
} from "../db/schema.js";

/**
 * Testdaten einspielen und alles zuruecksetzen, fuer den Entwicklermodus.
 *
 * Beides laeuft nur fuer Admins, siehe die Routen. **Der Schalter in der Oberflaeche ist
 * keine Sicherheitsgrenze**, er blendet die Knoepfe nur aus; wer die Adresse kennt, kaeme
 * sonst ohne Rolle daran.
 */

export interface Bestand {
  besucher: number;
  exponate: number;
  dokumente: number;
  links: number;
  kontakte: number;
  /** Aufgenommene Exponate, seit dem 02.11.2026; vorher `zuordnungen`. */
  besuche: number;
  dateien: number;
  /** GUIDs mit mindestens einem Konnektor-Abruf, siehe `services/abrufe.ts`. */
  abrufe: number;
  /** Datenpunkte, die jeder Besucher gleich bekommt, seit dem 20.10.2026. */
  globaleDaten: number;
  /** Bleiben beim Zuruecksetzen erhalten. Nur zur Anzeige im Rueckfragedialog. */
  appNutzer: number;
  /**
   * Die Avatarauswahl, seit dem 04.11.2026 gezaehlt: sie bleibt beim Zuruecksetzen und waechst
   * mit jedem uebernommenen KI-Bild. Die Sicherung nennt beide Zahlen.
   */
  avatare: number;
  kiAvatare: number;
}

/**
 * Was beim Zuruecksetzen verschwindet, in Zahlen.
 *
 * Der Rueckfragedialog nennt sie. Ein "Sind Sie sicher?" ohne Zahlen klickt man weg; eine
 * Rueckfrage, die weiss, wovon sie spricht, haelt einen Moment auf.
 */
export function leseBestand(db: Db): Bestand {
  const n = (abfrage: { get: () => { n: number } | undefined }) => abfrage.get()?.n ?? 0;

  return {
    besucher: n(db.select({ n: sql<number>`count(*)` }).from(besucher)),
    exponate: n(db.select({ n: sql<number>`count(*)` }).from(exponate)),
    dokumente: n(db.select({ n: sql<number>`count(*)` }).from(exponatDokumente)),
    links: n(db.select({ n: sql<number>`count(*)` }).from(exponatLinks)),
    kontakte: n(db.select({ n: sql<number>`count(*)` }).from(exponatKontakte)),
    besuche: n(db.select({ n: sql<number>`count(*)` }).from(besuche)),
    dateien: n(db.select({ n: sql<number>`count(*)` }).from(dateien)),
    abrufe: n(db.select({ n: sql<number>`count(*)` }).from(konnektorAbrufe)),
    globaleDaten: n(db.select({ n: sql<number>`count(*)` }).from(globaleDaten)),
    appNutzer: n(db.select({ n: sql<number>`count(*)` }).from(appNutzer)),
    avatare: n(db.select({ n: sql<number>`count(*)` }).from(avatare)),
    kiAvatare: n(
      db
        .select({ n: sql<number>`count(*)` })
        .from(avatare)
        .where(eq(avatare.herkunft, "ki")),
    ),
  };
}

/**
 * Loescht den gesamten Fachbestand. **App-Nutzer bleiben, und die Avatarauswahl bleibt.**
 *
 * Die Auswahl bleibt seit dem 04.11.2026: sie waechst mit jedem KI-Bild, das am Terminal
 * uebernommen wird, und soll das Leeren des Testbestands vor der Messe ueberstehen. Vorher
 * wurde sie geloescht und mit den 20 mitgelieferten Bildern neu angelegt. Wer sie leeren will,
 * loescht in der Avatarverwaltung.
 *
 * Wuerden sie mitgeloescht, kaeme nach dem Zuruecksetzen niemand mehr hinein: der
 * Bootstrap aus `ADMIN_EMAIL` greift erst beim naechsten **Start** und nur, solange kein
 * Admin existiert. Ein Knopf, der die eigene Anmeldung mitnimmt, ist kein Reset, sondern
 * eine Falle.
 *
 * Reihenfolge wie in `loescheDatei`: **erst die Datenbank in einer Transaktion, dann die
 * Dateien von der Platte.** Andersherum bliebe bei einem Abbruch ein Datensatz stehen, der
 * auf nichts zeigt; eine Datei ohne Datensatz belegt dagegen nur Platz.
 */
export async function setzeZurueck(db: Db, ablage: Dateiablage): Promise<Bestand> {
  const vorher = leseBestand(db);

  /*
   * Was bleibt: die Bilder der Galerie und der Standard-Avatar. Alles andere in `dateien` geht,
   * auch nicht uebernommene KI-Entwuerfe (per cascade samt Zeile in `avatar_entwuerfe`).
   */
  const bleiben = [
    STANDARD_AVATAR_ID,
    ...db
      .select({ id: avatare.dateiId })
      .from(avatare)
      .all()
      .map((a) => a.id),
  ];
  const weg = notInArray(dateien.id, bleiben);

  // Pfade vor dem Loeschen merken, danach sind sie weg.
  const pfade = db
    .select({ pfad: dateien.pfad })
    .from(dateien)
    .where(weg)
    .all()
    .map((d) => d.pfad);

  db.transaction((tx) => {
    /*
     * Reihenfolge von innen nach aussen. `on delete cascade` wuerde das meiste ohnehin
     * erledigen, aber nur solange `foreign_keys = ON` wirklich gesetzt ist; ausdrueckliches
     * Loeschen haengt nicht an einem PRAGMA.
     */
    /*
     * Die Abrufzaehler zuerst: sie haengen an `besucher`, und ein stehengebliebener
     * Zaehler waere nach dem Zuruecksetzen eine Zahl ohne Besucher dahinter.
     */
    tx.delete(konnektorAbrufe).run();
    /*
     * Und der Zaehler fuer unbekannte GUIDs, der an keinem Besucher haengt. **Gezielt
     * dieser eine Schluessel**, nicht die ganze Tabelle `einstellungen`: dort steht auch
     * der Schalter fuer die Konnektor-Anmeldung, und der ist eine Einstellung des
     * Betreibers, kein Fachbestand.
     */
    tx.delete(einstellungen).where(eq(einstellungen.schluessel, SCHLUESSEL_UNBEKANNT)).run();
    tx.delete(besuche).run();
    tx.delete(exponatDokumente).run();
    tx.delete(exponatLinks).run();
    tx.delete(exponatKontakte).run();
    tx.delete(exponatBetreuer).run();
    tx.delete(exponate).run();
    tx.delete(besucher).run();
    /*
     * **Die globalen Daten gehen mit**, seit dem 20.10.2026; vorher blieben sie stehen und
     * verloren nur ihre Datei. **Ihr Nummernzaehler in `einstellungen` bleibt**: sonst bekaeme
     * der naechste wieder `Global01` und erbte das Axon-Mapping eines geloeschten.
     */
    tx.delete(globaleDaten).run();
    tx.delete(dateien).where(weg).run();
  });

  // Erst jetzt die Platte. Ein Fehler hier laesst eine Waise liegen, keine Luecke.
  for (const pfad of pfade) await ablage.loesche(pfad);

  /*
   * **Den Standard-Avatar sicherstellen.** Er bleibt oben stehen; fehlte er schon vorher, legt
   * das ihn an. Bis zum 08.10.2026 war er nach einem Zuruecksetzen bis zum naechsten Neustart
   * weg, `/api/standard-avatar` antwortete 404 und jeder Besucher erschien ohne Bild.
   */
  await stelleStandardAvatarSicher(db, ablage, () => {
    // Fehlt das Bild im Repo, ist das kein Grund, das Zuruecksetzen scheitern zu lassen.
  });

  return vorher;
}
