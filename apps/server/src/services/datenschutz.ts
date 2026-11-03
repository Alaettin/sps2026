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
 * **Deutsch und Englisch gleichwertig**, seit Fassung `2026-11-03.1`: beide Texte sagen
 * dasselbe, und beim Besucher steht neben der Fassung die Sprache, in der er zugestimmt hat.
 * Wer den einen Text aendert, aendert den anderen mit.
 *
 * Fassung `2026-11-03.2` nennt die Kontakte unter Besuchern.
 *
 * **Jede inhaltliche Aenderung bekommt eine neue `DATENSCHUTZ_FASSUNG`.** Gespeichert wird beim
 * Besucher die Fassung, der er zugestimmt hat; eine Registrierung mit einer alten Fassung lehnt
 * der Server ab, damit niemand einem Text zustimmt, der nicht mehr gilt.
 */

export const DATENSCHUTZ_FASSUNG = "2026-11-03.2";

export type Sprache = "de" | "en";

/** `en` nur, wenn ausdruecklich verlangt; alles andere ist Deutsch. */
export function spracheAus(wert: unknown): Sprache {
  return wert === "en" ? "en" : "de";
}

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
      "Die Kennung deines Besucherpasses; die Angaben, die du hier einträgst (Titel, Vorname, Nachname, Alias, Firma, Position, Anschrift, E-Mail-Adresse, Website); das Bild, das du aus unserer Auswahl wählst (kein Foto von dir); dein Passwort, gespeichert nur als nicht umkehrbarer Hashwert; welche Exponate du durch Scannen ihres QR-Codes aufgenommen hast, mit dem Zeitpunkt; welche anderen Besucher du durch Scannen ihres Passes als Kontakt gespeichert hast, mit dem Zeitpunkt; Zeitpunkt und Fassung deiner Einwilligung.",
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
      "Scannt ein anderer angemeldeter Besucher deinen Pass, speichert er dich als Kontakt. Er sieht dann in seiner Kontaktliste deinen Namen, deine Firma und den Link zu deinem Viewer, solange dein Datensatz besteht. Eine Nachricht darüber bekommst du nicht.",
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

export const EINWILLIGUNGSTEXT_EN =
  "I have read the privacy notice and consent to IDTA e. V. processing the data I have " +
  "provided for the purposes described. I can withdraw my consent at any time with effect " +
  "for the future.";

export const ABSCHNITTE_EN: Abschnitt[] = [
  {
    titel: "Controller",
    absaetze: [
      "Industrial Digital Twin Association e. V. (IDTA), Lyoner Straße 18, 60528 Frankfurt am Main, Germany, phone +49 69 6603 1939, email info@idtwin.org.",
      "Data protection contact: datenschutz@idtwin.org.",
    ],
  },
  {
    titel: "What data we process",
    absaetze: [
      "The ID of your visitor pass; the details you enter here (title, first name, last name, alias, company, position, address, email address, website); the picture you choose from our selection (not a photo of you); your password, stored only as an irreversible hash; which exhibits you have added by scanning their QR code, with the time; which other visitors you have saved as contacts by scanning their pass, with the time; the time and version of your consent.",
      "When you scan, your browser analyses the camera image only on your device to read the QR code. It is neither stored nor transmitted.",
      "After you sign in, a technically necessary session cookie keeps you signed in; details are under “Cookie settings”. We do not store IP addresses. They are held only briefly in the server's memory to limit the number of requests.",
    ],
  },
  {
    titel: "Purpose",
    absaetze: [
      "So that your pass works: when you scan the QR code on an exhibit after signing in, we store that and when you added it. You can then find its content (such as data sheets, links, contacts) in the viewer, which you open via the QR code on your pass, always in the exhibitor's current version.",
      "So that you can sign in with your email address and password and change your details yourself.",
      "So that we can evaluate which stands were visited.",
    ],
  },
  {
    titel: "Legal basis",
    absaetze: [
      "Your consent under Art. 6(1)(a) GDPR. Registration is voluntary. Without it you cannot add exhibits.",
    ],
  },
  {
    titel: "Who sees your data",
    absaetze: [
      "An exhibitor's stand staff do not see your details, not even when you add their exhibit.",
      "If another signed-in visitor scans your pass, they save you as a contact. Their contact list then shows your name, your company and the link to your viewer for as long as your record exists. You are not notified about this.",
      "The viewer can be reached via the address on your pass without signing in. Anyone who knows this address, for example from a photo of the QR code, can retrieve the details and content shown there. So do not hand your pass to others.",
      "Neoception GmbH, Mallaustraße 50-56, 68219 Mannheim, Germany, operates this application, the AXON platform and the viewer on behalf of IDTA (data processing under Art. 28 GDPR). The application runs at Sliplane GmbH, Berlin, on a server in Germany; AXON and the viewer run at Neoception in the European Union.",
      "No data is transferred to a country outside the European Union.",
    ],
  },
  {
    titel: "How long",
    absaetze: [
      "We store your data until twelve months after the end of SPS 2026 and delete it on 30 November 2027 at the latest. If you withdraw your consent, we delete it earlier.",
    ],
  },
  {
    titel: "Your rights",
    absaetze: [
      "You have the right of access (Art. 15 GDPR), rectification (Art. 16), erasure (Art. 17), restriction of processing (Art. 18) and data portability (Art. 20). You can change your details yourself at any time after signing in.",
      "You can withdraw your consent at any time with effect for the future (Art. 7(3) GDPR), by email to datenschutz@idtwin.org or at the IDTA stand. Processing carried out until then remains lawful.",
      "You have the right to lodge a complaint with a data protection supervisory authority (Art. 77 GDPR), for example the one responsible for IDTA: Der Hessische Beauftragte für Datenschutz und Informationsfreiheit, Postfach 3163, 65021 Wiesbaden, Germany.",
      "There is no automated decision-making.",
    ],
  },
];

/** Text und Einwilligungssatz in einer Sprache, fuer die drei Routen, die ihn ausliefern. */
export function datenschutzText(sprache: Sprache): {
  abschnitte: Abschnitt[];
  einwilligungstext: string;
} {
  return sprache === "en"
    ? { abschnitte: ABSCHNITTE_EN, einwilligungstext: EINWILLIGUNGSTEXT_EN }
    : { abschnitte: ABSCHNITTE, einwilligungstext: EINWILLIGUNGSTEXT };
}

const PLATZHALTER = /\[\[[^\]]+\]\]/g;

/** Alle noch offenen Platzhalter, in der Reihenfolge des Textes. */
export function offenePlatzhalter(): string[] {
  const text = [
    EINWILLIGUNGSTEXT,
    EINWILLIGUNGSTEXT_EN,
    ...[...ABSCHNITTE, ...ABSCHNITTE_EN].flatMap((a) => [a.titel, ...a.absaetze]),
  ].join("\n");
  return text.match(PLATZHALTER) ?? [];
}

/** Ist der Text noch ein Entwurf? Dann zeigt das Tablet es sichtbar an. */
export function istEntwurf(): boolean {
  return offenePlatzhalter().length > 0;
}
