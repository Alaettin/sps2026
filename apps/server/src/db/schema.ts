import { sql } from "drizzle-orm";
import { index, integer, sqliteTable, text, unique, uniqueIndex } from "drizzle-orm/sqlite-core";

/**
 * Das vollstaendige Schema nach der Uebergabe, in einer Datei und einer Datenbank.
 *
 * Auch die Tabellen, die erst Auftrag 2 fuellt, stehen schon hier: das Modell ist
 * entschieden, und eine Migration ist billiger als zwei.
 *
 * Zeitstempel sind Millisekunden seit 1970 als `integer`. SQLite kennt keinen eigenen
 * Zeittyp; eine Zahl laesst sich vergleichen und sortieren, ein ISO-Text nur zufaellig
 * richtig.
 */

const jetzt = sql`(unixepoch() * 1000)`;

// --- Nutzer und Rollen ---------------------------------------------------------------

export const appNutzer = sqliteTable(
  "app_nutzer",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    /** Immer klein geschrieben gespeichert, siehe `normalisiereEmail`. */
    email: text("email").notNull().unique(),
    passwortHash: text("passwort_hash").notNull(),
    /*
     * Reines `text` ohne CHECK in SQLite, der Aufzaehlungstyp wirkt nur in TypeScript.
     * Eine weitere Rolle braucht deshalb **keine Migration**.
     *
     * `kiosk` ist das Selbstbedienungs-Tablet am Stand: es darf genau einen Besucher
     * lesen und aendern, nachdem dessen Pass gescannt wurde, und sonst nichts.
     */
    rolle: text("rolle", { enum: ["admin", "betreuer", "kiosk"] }).notNull(),
    /*
     * Deaktivierte Nutzer bleiben stehen, statt geloescht zu werden: ihre Kennung haengt
     * an jeder Zuordnung, die sie vorgenommen haben, und die soll nachvollziehbar bleiben.
     */
    aktiv: integer("aktiv", { mode: "boolean" }).notNull().default(true),
    angelegt: integer("angelegt").notNull().default(jetzt),
    zuletztAngemeldet: integer("zuletzt_angemeldet"),
  },
  (t) => [index("app_nutzer_email_idx").on(t.email)],
);

export const exponatBetreuer = sqliteTable(
  "exponat_betreuer",
  {
    exponatId: text("exponat_id")
      .notNull()
      .references(() => exponate.id, { onDelete: "cascade" }),
    appNutzerId: text("app_nutzer_id")
      .notNull()
      .references(() => appNutzer.id, { onDelete: "cascade" }),
  },
  (t) => [
    unique("exponat_betreuer_paar").on(t.exponatId, t.appNutzerId),
    index("exponat_betreuer_nutzer_idx").on(t.appNutzerId),
  ],
);

// --- Dateien -------------------------------------------------------------------------

export const dateien = sqliteTable("dateien", {
  id: text("id").primaryKey(),
  /** Relativ zu `DATA_DIR/dateien`, nie absolut: der Pfad muss einen Umzug ueberleben. */
  pfad: text("pfad").notNull(),
  /** Aus der Dateiendung bestimmt, nicht aus dem Kopf des Browsers. */
  mimeType: text("mime_type").notNull(),
  groesse: integer("groesse").notNull(),
  originalName: text("original_name").notNull(),
  sha256: text("sha256").notNull(),
  angelegt: integer("angelegt").notNull().default(jetzt),
});

// --- Besucher ------------------------------------------------------------------------

export const besucher = sqliteTable(
  "besucher",
  {
    /** Die GUID ist der Schluessel, nicht eine eigene Id: sie ist die `itemId` fuer Axon. */
    guid: text("guid").primaryKey(),
    /** Akademischer Titel, etwa "Dr." oder "Prof. Dr.". Freitext, weil die Formen zu viele sind. */
    titel: text("titel"),
    vorname: text("vorname").notNull(),
    nachname: text("nachname").notNull(),
    /**
     * Freitext, optional, nicht eindeutig. **Nur beim Besucher**, nicht bei den
     * Ansprechpartnern; geht als eigene Eigenschaft `Visitor_Alias` an Axon.
     */
    alias: text("alias"),
    firma: text("firma"),
    position: text("position"),
    /**
     * **Pflicht und eindeutig**, ohne Gross- und Kleinschreibung: sie ist der Login des
     * Besuchers. Eindeutig ueber den Index unten, die freundliche 409 kommt aus dem Service.
     */
    email: text("email").notNull(),
    strasse: text("strasse"),
    plz: text("plz"),
    ort: text("ort"),
    land: text("land"),
    website: text("website"),
    /*
     * `set null`, nicht `cascade`: wird ein Bild geloescht, verliert der Besucher sein
     * Avatar, aber nicht seinen Datensatz.
     */
    avatarDateiId: text("avatar_datei_id").references(() => dateien.id, { onDelete: "set null" }),
    /**
     * argon2id-Hash des eigenen Passworts. **`null` heisst: es gilt das Standardpasswort**,
     * siehe `services/besucherzugang.ts`. Verlaesst den Server nie.
     */
    passwortHash: text("passwort_hash"),
    /**
     * Die Einwilligung in die Datenverarbeitung, seit dem 23.10.2026: Zeitpunkt und Fassung des
     * Datenschutztextes, dem der Besucher bei der Registrierung am Tablet zugestimmt hat.
     * `null` bei Besuchern, die das Personal angelegt hat.
     */
    einwilligungAm: integer("einwilligung_am"),
    einwilligungFassung: text("einwilligung_fassung"),
    angelegt: integer("angelegt").notNull().default(jetzt),
    geaendert: integer("geaendert").notNull().default(jetzt),
  },
  (t) => [uniqueIndex("besucher_email_eindeutig").on(sql`lower(${t.email})`)],
);

// --- Exponate und ihre Inhalte -------------------------------------------------------

export const exponate = sqliteTable("exponate", {
  id: text("id").primaryKey(),
  /** Zum Beispiel `E03`. Steht in den propertyIds des Modells, deshalb eng begrenzt. */
  kennung: text("kennung").notNull().unique(),
  name: text("name").notNull(),
  beschreibung: text("beschreibung"),
  /**
   * Der geheime Teil des QR-Codes am Exponat, seit dem 02.11.2026. Der Besucher scannt ihn und
   * nimmt das Exponat damit auf. **Zufaellig, nicht die Kennung**: `E01` bis `E10` waeren
   * erratbar, und man koennte jedes Exponat aufnehmen, ohne am Stand gewesen zu sein.
   */
  scanCode: text("scan_code").notNull().unique(),
  angelegt: integer("angelegt").notNull().default(jetzt),
});

/**
 * `platz` ist die Bruecke zum Modell der Konnektor-API.
 *
 * Er wird beim Anlegen als kleinste freie Nummer vergeben und aendert sich danach nie:
 * aus ihm entsteht `{K}_Doc03_Title`, und der Content-Admin hat das in Axon gemappt.
 * Loeschen gibt den Platz frei.
 */
export const exponatDokumente = sqliteTable(
  "exponat_dokumente",
  {
    id: text("id").primaryKey(),
    exponatId: text("exponat_id")
      .notNull()
      .references(() => exponate.id, { onDelete: "cascade" }),
    platz: integer("platz").notNull(),
    dateiId: text("datei_id")
      .notNull()
      .references(() => dateien.id),
    titel: text("titel").notNull(),
    beschreibung: text("beschreibung"),
  },
  (t) => [unique("exponat_dokumente_platz").on(t.exponatId, t.platz)],
);

export const exponatLinks = sqliteTable(
  "exponat_links",
  {
    id: text("id").primaryKey(),
    exponatId: text("exponat_id")
      .notNull()
      .references(() => exponate.id, { onDelete: "cascade" }),
    platz: integer("platz").notNull(),
    url: text("url").notNull(),
    titel: text("titel").notNull(),
  },
  (t) => [unique("exponat_links_platz").on(t.exponatId, t.platz)],
);

/**
 * Ansprechpartner **gehoeren einem Exponat**, seit dem 02.11.2026 wieder.
 *
 * Vom 19.10. bis 02.11.2026 waren sie zentrale Stammdaten, die nur der Admin pflegte. Seit der
 * Betreuer die Inhalte seines Exponats selbst pflegt, gehoeren sie dorthin: ein Betreuer soll
 * keinen Datensatz aendern koennen, der zugleich an einem fremden Exponat steht. Derselbe Mensch
 * an zwei Exponaten ist deshalb bewusst zweimal im Bestand.
 *
 * `platz` ist die Bruecke zum Modell (`{K}_Contact03_Email`), vergeben als kleinste freie Nummer,
 * danach unveraendert. **Kein Foto**, `{K}_Contact{NN}_Image` gibt es nicht.
 */
export const exponatKontakte = sqliteTable(
  "exponat_kontakte",
  {
    id: text("id").primaryKey(),
    exponatId: text("exponat_id")
      .notNull()
      .references(() => exponate.id, { onDelete: "cascade" }),
    platz: integer("platz").notNull(),
    /** Siehe `besucher.titel`: dieselbe Feldliste traegt beide. */
    titel: text("titel"),
    vorname: text("vorname").notNull(),
    nachname: text("nachname").notNull(),
    firma: text("firma"),
    position: text("position"),
    email: text("email"),
    strasse: text("strasse"),
    plz: text("plz"),
    ort: text("ort"),
    land: text("land"),
    website: text("website"),
    angelegt: integer("angelegt").notNull().default(jetzt),
    geaendert: integer("geaendert").notNull().default(jetzt),
  },
  (t) => [unique("exponat_kontakte_platz").on(t.exponatId, t.platz)],
);

// --- Besuche -------------------------------------------------------------------------

/**
 * Welcher Besucher welches Exponat aufgenommen hat, seit dem 02.11.2026.
 *
 * Der Besucher scannt den QR-Code am Exponat selbst. **Aufgenommen wird das Exponat, nicht
 * einzelne Inhalte**: der Konnektor liefert immer den aktuellen Stand aller Dokumente, Links und
 * Ansprechpartner. Was der Betreuer spaeter ergaenzt, kommt an; was er loescht, verschwindet.
 * Vorher hakte der Betreuer beim Scan des Passes einzelne Elemente an (`zuordnungen`).
 *
 * Das Paar ist eindeutig: ein zweiter Scan legt nichts an.
 */
export const besuche = sqliteTable(
  "besuche",
  {
    besucherGuid: text("besucher_guid")
      .notNull()
      .references(() => besucher.guid, { onDelete: "cascade" }),
    exponatId: text("exponat_id")
      .notNull()
      .references(() => exponate.id, { onDelete: "cascade" }),
    zeitpunkt: integer("zeitpunkt").notNull().default(jetzt),
  },
  (t) => [
    unique("besuche_paar").on(t.besucherGuid, t.exponatId),
    index("besuche_exponat_idx").on(t.exponatId),
  ],
);

// --- Einstellungen zur Laufzeit ------------------------------------------------------

/**
 * Schalter, die sich im Betrieb aendern lassen, als Schluessel und Wert.
 *
 * Warum eine Tabelle und nicht die Umgebung: der Nutzer soll sie in der Oberflaeche
 * umlegen koennen, ohne den Dienst neu zu starten. Und warum nicht der localStorage wie
 * beim Entwicklermodus: die Auswertung steht auf dem **Server**, ein Wert im Browser
 * waere dort nur eine Behauptung.
 *
 * Der Wert ist Text, nicht `integer`: hier landen spaeter auch Schluessel, die keine
 * Schalter sind, und ein Typ je Schluessel waere eine Spalte je Schluessel.
 */
export const einstellungen = sqliteTable("einstellungen", {
  schluessel: text("schluessel").primaryKey(),
  wert: text("wert").notNull(),
  geaendert: integer("geaendert").notNull().default(jetzt),
});

// --- Monitoring der Konnektor-Abrufe --------------------------------------------------

/**
 * Wie oft und wann Axon eine GUID abgefragt hat.
 *
 * **Eine Zeile je Besucher, nicht je Anfrage.** Ein vollstaendiges Abrufprotokoll gab es
 * hier schon einmal und flog am 08.10.2026 wieder raus, weil es unbegrenzt waechst. Diese
 * Fassung beantwortet dieselbe Frage mit Zaehlern: die Tabelle kann nie groesser werden
 * als die Besucherzahl, und je Anfrage faellt genau ein Upsert an.
 *
 * **Nur bekannte GUIDs stehen hier.** Die Konnektor-API verlangt bewusst keine Anmeldung;
 * legte jede unbekannte GUID eine Zeile an, koennte sie jeder beliebig aufblaehen. Abrufe
 * auf Unbekanntes zaehlt deshalb ein einzelner Wert in `einstellungen`.
 *
 * Die drei Spalten sind die drei Endpunkte mit GUID. Getrennt, weil die Frage am Stand
 * nicht "wurde abgefragt" lautet, sondern "kam der Viewer bis zu den Dokumenten".
 */
export const konnektorAbrufe = sqliteTable("konnektor_abrufe", {
  guid: text("guid")
    .primaryKey()
    .references(() => besucher.guid, { onDelete: "cascade" }),
  hierarchy: integer("hierarchy").notNull().default(0),
  werte: integer("werte").notNull().default(0),
  dokumente: integer("dokumente").notNull().default(0),
  zuerst: integer("zuerst").notNull().default(jetzt),
  zuletzt: integer("zuletzt").notNull().default(jetzt),
});

// --- Avatare zur Auswahl am Tablet ----------------------------------------------------

/**
 * Welche Bilder am Selbstbedienungs-Tablet zur Auswahl stehen, und in welcher Folge.
 *
 * **Zeilen statt Dateien im Repo.** Bis zum 09.10.2026 war die Galerie eine feste Liste von
 * 20 Ids, die der Start bei jedem Fehlen neu anlegte. Sobald ein Admin eines loeschen darf,
 * ist genau das falsch: der geloeschte Avatar kaeme beim naechsten Neustart zurueck. Die
 * Erstbefuellung ist deshalb einmalig, siehe `services/avatare.ts`.
 *
 * `datei_id` ist der Schluessel: eine Datei ist genau einmal in der Galerie. `cascade`,
 * damit das Loeschen der Datei die Zeile mitnimmt; die Besucher daran haengen ueber
 * `on delete set null` und fallen auf den Standard zurueck.
 */
export const avatare = sqliteTable("avatare", {
  dateiId: text("datei_id")
    .primaryKey()
    .references(() => dateien.id, { onDelete: "cascade" }),
  /** Eins-basiert und beim Umsortieren neu vergeben, damit keine Luecken entstehen. */
  sortierung: integer("sortierung").notNull(),
  angelegt: integer("angelegt").notNull().default(jetzt),
});

// --- Globale Daten --------------------------------------------------------------------

/**
 * Datenpunkte, die der Konnektor **jedem** Besucher gleich ausliefert, seit dem 20.10.2026.
 *
 * Die propertyId ergibt sich aus `nummer` (`Global01`, `Global02`, ...). **Nummern werden
 * nicht wiederverwendet**: eine freigewordene Nummer erbte sonst das Axon-Mapping eines
 * geloeschten Datenpunkts, und dort erschiene ploetzlich etwas anderes. Bei den
 * Exponatkennungen ist es umgekehrt entschieden; dort ist die Wiederverwendung gewollt.
 *
 * `art` legt den Typ im Modell fest: `text` ist eine Property, `datei` ein Document (Bild By
 * Value, alles andere By Ticket, wie bei den Exponat-Dokumenten).
 */
export const globaleDaten = sqliteTable("globale_daten", {
  id: text("id").primaryKey(),
  nummer: integer("nummer").notNull().unique(),
  name: text("name").notNull(),
  art: text("art", { enum: ["text", "datei"] }).notNull(),
  text: text("text"),
  dateiId: text("datei_id").references(() => dateien.id, { onDelete: "set null" }),
  angelegt: integer("angelegt").notNull().default(jetzt),
});
