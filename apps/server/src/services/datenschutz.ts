/**
 * Der Datenschutzhinweis, dem ein Besucher bei der Registrierung am Tablet zustimmt.
 *
 * Aufgebaut nach den Pflichtangaben aus Art. 13 DSGVO, **seit Fassung `2026-11-02.3` ohne
 * Platzhalter**. Quellen: Anschrift und Datenschutzkontakt aus der Datenschutzerklaerung von
 * industrialdigitaltwin.org, Hosting aus Sliplane (Server `fsn`, Falkenstein), Speicherdauer,
 * Ort von Axon und Viewer sowie die Rollen als Entscheidung des Projekts vom 02.11.2026. Keine
 * Rechtsberatung; die rechtliche Pruefung steht in der Projektakte.
 *
 * Ein neuer `[[PLATZHALTER]]` bleibt erkennbar: `istEntwurf()` meldet ihn, das Tablet zeigt
 * dann einen sichtbaren Hinweis, und ein Test in `kiosk.test.ts` faellt.
 *
 * **Jede inhaltliche Aenderung bekommt eine neue `DATENSCHUTZ_FASSUNG`.** Gespeichert wird beim
 * Besucher die Fassung, der er zugestimmt hat; eine Registrierung mit einer alten Fassung lehnt
 * der Server ab, damit niemand einem Text zustimmt, der nicht mehr gilt.
 */

export const DATENSCHUTZ_FASSUNG = "2026-11-02.3";

export interface Abschnitt {
  titel: string;
  absaetze: string[];
}

/** Der Satz neben dem Kaestchen. Er gehoert zur Fassung wie der Text darueber. */
export const EINWILLIGUNGSTEXT =
  "Ich habe die Datenschutzhinweise gelesen und willige ein, dass die IDTA e. V. meine " +
  "angegebenen Daten zu den beschriebenen Zwecken verarbeitet. Meine Einwilligung kann ich " +
  "jederzeit mit Wirkung für die Zukunft widerrufen.";

export const ABSCHNITTE: Abschnitt[] = [
  {
    titel: "Verantwortlicher",
    absaetze: [
      "Industrial Digital Twin Association e. V. (IDTA), Lyoner Straße 18, 60528 Frankfurt am Main, Telefon +49 69 6603 1939, E-Mail info@idtwin.org.",
      "Kontakt zum Datenschutz: datenschutz@idtwin.org.",
    ],
  },
  {
    titel: "Welche Daten wir verarbeiten",
    absaetze: [
      "Die Kennung deines Besucherpasses; die Angaben, die du hier einträgst (Titel, Vorname, Nachname, Alias, Firma, Position, Anschrift, E-Mail-Adresse, Website); das Bild, das du aus unserer Auswahl wählst (kein Foto von dir); dein Passwort, gespeichert nur als nicht umkehrbarer Hashwert; welche Exponate du durch Scannen ihres QR-Codes aufgenommen hast, mit dem Zeitpunkt; Zeitpunkt und Fassung deiner Einwilligung.",
      "Beim Scannen wertet dein Browser das Kamerabild nur auf deinem Gerät aus, um den QR-Code zu lesen. Es wird weder gespeichert noch übertragen.",
      "Nach der Anmeldung hält ein technisch notwendiges Sitzungscookie dich angemeldet; Einzelheiten stehen unter „Cookie-Einstellungen“. IP-Adressen speichern wir nicht. Sie liegen nur kurz im Arbeitsspeicher des Servers, um die Zahl der Anfragen zu begrenzen.",
    ],
  },
  {
    titel: "Wofür",
    absaetze: [
      "Damit dein Pass funktioniert: Scannst du nach der Anmeldung den QR-Code an einem Exponat, speichern wir, dass und wann du es aufgenommen hast. Seine Inhalte (etwa Datenblätter, Links, Ansprechpartner) findest du danach im Viewer, den du über den QR-Code deines Passes öffnest, jeweils im aktuellen Stand des Ausstellers.",
      "Damit du dich mit deiner E-Mail-Adresse und deinem Passwort anmelden, deine Angaben selbst ändern kannst.",
      "Damit wir auswerten können, welche Stände besucht wurden.",
    ],
  },
  {
    titel: "Rechtsgrundlage",
    absaetze: [
      "Deine Einwilligung nach Art. 6 Abs. 1 lit. a DSGVO. Die Registrierung ist freiwillig. Ohne sie kannst du keine Exponate aufnehmen.",
    ],
  },
  {
    titel: "Wer deine Daten sieht",
    absaetze: [
      "Das Standpersonal eines Ausstellers sieht deine Angaben nicht, auch nicht, wenn du sein Exponat aufnimmst.",
      "Der Viewer ist über die Adresse auf deinem Pass ohne Anmeldung erreichbar. Wer diese Adresse kennt, etwa durch ein Foto des QR-Codes, kann die dort angezeigten Angaben und Inhalte abrufen. Gib deinen Pass deshalb nicht aus der Hand.",
      "Die Neoception GmbH, Mallaustraße 50-56, 68219 Mannheim, betreibt diese Anwendung, die Plattform AXON und den Viewer im Auftrag der IDTA (Auftragsverarbeitung nach Art. 28 DSGVO). Die Anwendung läuft bei der Sliplane GmbH, Berlin, auf einem Server in Deutschland; AXON und der Viewer laufen bei Neoception in der Europäischen Union.",
      "Eine Übermittlung in ein Land außerhalb der Europäischen Union findet nicht statt.",
    ],
  },
  {
    titel: "Wie lange",
    absaetze: [
      "Wir speichern deine Daten bis zwölf Monate nach dem Ende der SPS 2026 und löschen sie spätestens am 30.11.2027. Widerrufst du deine Einwilligung, löschen wir sie früher.",
    ],
  },
  {
    titel: "Deine Rechte",
    absaetze: [
      "Du hast das Recht auf Auskunft (Art. 15 DSGVO), Berichtigung (Art. 16), Löschung (Art. 17), Einschränkung der Verarbeitung (Art. 18) und Datenübertragbarkeit (Art. 20). Deine Angaben kannst du nach der Anmeldung jederzeit selbst ändern.",
      "Du kannst deine Einwilligung jederzeit mit Wirkung für die Zukunft widerrufen (Art. 7 Abs. 3 DSGVO), per E-Mail an datenschutz@idtwin.org oder am Stand der IDTA. Die bis dahin erfolgte Verarbeitung bleibt rechtmäßig.",
      "Du hast das Recht, dich bei einer Datenschutzaufsichtsbehörde zu beschweren (Art. 77 DSGVO), zum Beispiel bei der für die IDTA zuständigen: Der Hessische Beauftragte für Datenschutz und Informationsfreiheit, Postfach 3163, 65021 Wiesbaden.",
      "Eine automatisierte Entscheidungsfindung findet nicht statt.",
    ],
  },
];

const PLATZHALTER = /\[\[[^\]]+\]\]/g;

/** Alle noch offenen Platzhalter, in der Reihenfolge des Textes. */
export function offenePlatzhalter(): string[] {
  const text = [EINWILLIGUNGSTEXT, ...ABSCHNITTE.flatMap((a) => [a.titel, ...a.absaetze])].join(
    "\n",
  );
  return text.match(PLATZHALTER) ?? [];
}

/** Ist der Text noch ein Entwurf? Dann zeigt das Tablet es sichtbar an. */
export function istEntwurf(): boolean {
  return offenePlatzhalter().length > 0;
}
