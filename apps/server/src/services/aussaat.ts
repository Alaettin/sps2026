import type { Db } from "../db/client.js";
import type { Dateiablage } from "../ablage/dateien.js";
import { exponate } from "../db/schema.js";
import { conflict } from "../errors.js";
import { legeBesucherAn } from "./besucher.js";
import { legeDokumentAn, legeExponatAn, legeLinkAn } from "./exponate.js";
import { legeKontaktAn } from "./kontakte.js";
import { setzeBesuch } from "./besuche.js";

/**
 * Beispieldaten fuer Entwicklung und Abnahme.
 *
 * Sechs Exponate und 50 Besucher, angelehnt an die Beispieldaten des Design-Pakets. Die
 * Personen und Firmen sind **erfunden**; das steht so schon in der Uebergabe.
 *
 * Die Aussaat laeuft nur gegen eine Datenbank **ohne** Exponate. Ein zweiter Lauf wuerde
 * sonst die Kennungen doppelt vergeben und mitten darin abbrechen.
 */

/** Zehn Exponate, wie sie auf der SPS stehen koennten. */
const EXPONATE = [
  {
    kennung: "E01",
    name: "Modulare Prozessautomation",
    beschreibung: "MTP-basierte Modulintegration",
  },
  {
    kennung: "E02",
    name: "Ethernet-APL Feldgeraete",
    beschreibung: "Zweileitertechnik bis in die Zone 0",
  },
  {
    kennung: "E03",
    name: "Verwaltungsschale in der Praxis",
    beschreibung: "AAS vom Typschild bis zur Wartung",
  },
  {
    kennung: "E04",
    name: "NOA Diagnose",
    beschreibung: "Zustandsueberwachung ohne Eingriff in die Kernautomation",
  },
  { kennung: "E05", name: "Digitale Typschilder", beschreibung: "ID-Link nach IDTA-01002" },
  {
    kennung: "E06",
    name: "Offene Leitsysteme",
    beschreibung: "Herstelleruebergreifende Bedienbilder",
  },
  { kennung: "E07", name: "Funk in der Anlage", beschreibung: "WirelessHART und 5G im Vergleich" },
  {
    kennung: "E08",
    name: "Durchflussmessung",
    beschreibung: "Coriolis und Ultraschall nebeneinander",
  },
  { kennung: "E09", name: "Explosionsschutz", beschreibung: "Zuendschutzarten und ihre Grenzen" },
  { kennung: "E10", name: "Alarmmanagement", beschreibung: "Von der Flut zur brauchbaren Meldung" },
];

const FIRMEN = [
  "Mueller Prozesstechnik",
  "Nordwerk Automation",
  "Rheinsteuer AG",
  "Hansa Messtechnik",
  "Alpenland Chemie",
  "Weserwerke",
  "Ostsee Anlagenbau",
  "Taunus Regeltechnik",
  "Spreewerk Verfahrenstechnik",
  "Isar Analytik",
  "Eifel Armaturen",
  "Lausitz Energie",
  "Harzer Leittechnik",
  "Bodensee Sensorik",
  "Ruhrpol Engineering",
  "Saarstahl Automation",
];

/*
 * 40 Vornamen und 40 Nachnamen ergeben 1600 unterschiedliche Paare.
 *
 * Die Paarung laeuft ueber `vorname[i % 40]` und `nachname[Math.floor(i / 40)]`: damit ist
 * **jedes Paar eindeutig**, solange weniger als 1600 Besucher entstehen. Einzelne Vor- und
 * Nachnamen wiederholen sich dabei, das ist bei 700 Personen unvermeidlich und richtig.
 *
 * Die fruehere Fassung zog beide per Modulo aus 25er-Listen und erzeugte dadurch dieselbe
 * Person mehrfach.
 */
const VORNAMEN = [
  "Anna",
  "Bernd",
  "Claudia",
  "Dirk",
  "Eva",
  "Frank",
  "Gesa",
  "Holger",
  "Ina",
  "Jens",
  "Katrin",
  "Lars",
  "Maren",
  "Nils",
  "Olga",
  "Peter",
  "Quirin",
  "Rita",
  "Sven",
  "Tanja",
  "Udo",
  "Vera",
  "Wolf",
  "Xenia",
  "Yvonne",
  "Zacharias",
  "Birgit",
  "Clemens",
  "Doris",
  "Emil",
  "Franziska",
  "Gerrit",
  "Heike",
  "Ingo",
  "Johanna",
  "Konrad",
  "Luise",
  "Markus",
  "Nadine",
  "Oskar",
];

const NACHNAMEN = [
  "Ahrens",
  "Brandt",
  "Clausen",
  "Dietrich",
  "Ebert",
  "Fischer",
  "Groth",
  "Hoffmann",
  "Iversen",
  "Jansen",
  "Kempf",
  "Lindner",
  "Mohr",
  "Neumann",
  "Osterloh",
  "Pfeiffer",
  "Quandt",
  "Richter",
  "Schulte",
  "Thiele",
  "Ulrich",
  "Vogt",
  "Wendt",
  "Zimmer",
  "Adler",
  "Bauer",
  "Christiansen",
  "Dreyer",
  "Engel",
  "Falk",
  "Giesen",
  "Hartmann",
  "Imhof",
  "Jungclaus",
  "Kettler",
  "Lorenz",
  "Marquardt",
  "Nolte",
  "Oelze",
  "Petersen",
];

if (VORNAMEN.length !== 40 || NACHNAMEN.length !== 40) {
  // Die Eindeutigkeit der Paare haengt an genau diesen Laengen.
  throw new Error("VORNAMEN und NACHNAMEN muessen je 40 Eintraege haben");
}

const STAEDTE: [string, string][] = [
  ["Leverkusen", "51373"],
  ["Ludwigshafen", "67061"],
  ["Marl", "45772"],
  ["Hamburg", "20095"],
  ["Frankfurt", "60311"],
  ["Koeln", "50667"],
  ["Dortmund", "44135"],
  ["Bremen", "28195"],
  ["Mannheim", "68159"],
  ["Burghausen", "84489"],
  ["Gendorf", "84508"],
  ["Schkopau", "06258"],
];

/** So viele Besucher legt die Aussaat an. */
const BESUCHER_ANZAHL = 700;

/** Ein winziges, gueltiges PNG: ein Pixel. Als Avatar genug, um den Wertweg zu pruefen. */
const EIN_PIXEL_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);

export interface AussaatErgebnis {
  exponate: number;
  besucher: number;
  dokumente: number;
  links: number;
  kontakte: number;
  besuche: number;
}

export async function saeAus(db: Db, ablage: Dateiablage): Promise<AussaatErgebnis> {
  if (db.select({ id: exponate.id }).from(exponate).all().length > 0) {
    throw conflict(
      "aussaat-nicht-leer",
      "The database already contains exhibits. Seeding only runs on an empty set.",
    );
  }

  const ergebnis: AussaatErgebnis = {
    exponate: 0,
    besucher: 0,
    dokumente: 0,
    links: 0,
    kontakte: 0,
    besuche: 0,
  };

  const angelegteExponate: string[] = [];

  for (const e of EXPONATE) {
    // Die Kennung vergibt der Server; `e.kennung` dient nur noch der Benennung der Dateien.
    const exponat = legeExponatAn(db, { name: e.name, beschreibung: e.beschreibung });
    ergebnis.exponate++;

    /*
     * Zwei Dokumente je Exponat, und zwar **ein Bild und ein PDF**. Das ist Absicht: nur
     * so laeuft in jeder Abnahme beides durch, der Wertweg und der Ticketweg.
     */
    await legeDokumentAn(db, ablage, exponat.id, {
      datei: {
        name: `Datenblatt ${e.kennung} (DE).pdf`,
        inhalt: Buffer.from(`%PDF-1.4\nDatenblatt zum Exponat ${e.kennung}.\n%%EOF\n`, "utf8"),
      },
      titel: `Datenblatt ${e.kennung}`,
      beschreibung: "Technische Daten",
    });
    ergebnis.dokumente++;

    await legeDokumentAn(db, ablage, exponat.id, {
      datei: { name: `vorschau-${e.kennung}.png`, inhalt: EIN_PIXEL_PNG },
      titel: `Vorschau ${e.kennung}`,
      beschreibung: null,
    });
    ergebnis.dokumente++;

    legeLinkAn(db, exponat.id, { url: "https://industrialdigitaltwin.org/", titel: "IDTA" });
    legeLinkAn(db, exponat.id, { url: "https://www.neoception.com/", titel: "Neoception" });
    ergebnis.links += 2;

    /*
     * Zwei Ansprechpartner je Exponat. Der zweite steht an jedem Exponat, seit dem 02.11.2026
     * als eigener Datensatz je Exponat: Ansprechpartner gehoeren wieder dem Exponat.
     */
    legeKontaktAn(db, exponat.id, {
      vorname: VORNAMEN[ergebnis.exponate % VORNAMEN.length] ?? "Anna",
      nachname: NACHNAMEN[(ergebnis.exponate * 3) % NACHNAMEN.length] ?? "Ahrens",
      firma: "Neoception GmbH",
      position: "Produktmanagement",
      email: `kontakt-${e.kennung.toLowerCase()}@example.invalid`,
      ort: "Mannheim",
      plz: "68163",
      land: "Deutschland",
    });
    legeKontaktAn(db, exponat.id, {
      vorname: "Hendrik",
      nachname: "Sassenberg",
      firma: "IDTA Geschaeftsstelle",
      position: "Organisation",
      email: "orga@example.invalid",
      ort: "Leverkusen",
      plz: "51373",
      land: "Deutschland",
    });
    ergebnis.kontakte += 2;

    angelegteExponate.push(exponat.id);
  }

  for (let i = 0; i < BESUCHER_ANZAHL; i++) {
    /*
     * **Jedes Paar genau einmal.** Der Vorname laeuft schnell durch, der Nachname wechselt
     * erst nach 40 Besuchern: so entsteht bis 1600 kein Paar doppelt.
     */
    const vorname = VORNAMEN[i % VORNAMEN.length] ?? "Anna";
    const nachname = NACHNAMEN[Math.floor(i / VORNAMEN.length)] ?? "Ahrens";
    const stadt = STAEDTE[i % STAEDTE.length] ?? ["Mannheim", "68163"];
    const person = legeBesucherAn(db, {
      guid: `SPS2026-${String(i + 1).padStart(4, "0")}`,
      vorname,
      nachname,
      // Jeder vierte traegt einen Alias, damit Verwaltung und Viewer beides zeigen.
      alias: i % 4 === 0 ? `${vorname}${String(i + 1)}` : null,
      firma: FIRMEN[i % FIRMEN.length] ?? "Mueller Prozesstechnik",
      position: i % 3 === 0 ? "Leitung Instandhaltung" : "Fachplanung EMSR",
      // Mit laufender Nummer, sonst waere die Adresse bei gleichem Paar nicht eindeutig.
      email: `${vorname.toLowerCase()}.${nachname.toLowerCase()}${String(i + 1)}@example.invalid`,
      strasse: `Werkstrasse ${String((i % 40) + 1)}`,
      plz: stadt[1] ?? null,
      ort: stadt[0] ?? null,
      land: "Deutschland",
      website: null,
    });
    ergebnis.besucher++;

    /*
     * **Keine Avatare mehr.** Seit dem 08.10.2026 bekommt jeder Besucher den
     * Standard-Avatar als Rueckfall, `avatarDateiId` bleibt `null`. Vorher legte die
     * Aussaat je Besucher eine eigene Datei an; das waren 356 der 419 Dateien im Bestand,
     * alle mit demselben Ein-Pixel-Bild.
     */

    /*
     * Jeder dritte Besucher hat ein Exponat aufgenommen. Die uebrigen bleiben ohne: `values`
     * muss fuer sie **nur** die Stammdaten liefern, und genau das ist eine der Gegenproben.
     */
    if (i % 3 === 0) {
      const ziel = angelegteExponate[i % angelegteExponate.length];
      if (ziel !== undefined && setzeBesuch(db, person.guid, ziel).neu) ergebnis.besuche++;
    }
  }

  return ergebnis;
}
