/**
 * Der Datenschutzhinweis, dem ein Besucher bei der Registrierung am Tablet zustimmt.
 *
 * **Entwurf, keine Rechtsberatung.** Aufgebaut nach den Pflichtangaben aus Art. 13 DSGVO.
 * Was hier nicht bekannt ist, steht als `[[PLATZHALTER]]`; solange einer drinsteht, meldet
 * `istEntwurf()` das, und das Tablet zeigt einen sichtbaren Hinweis. Vor dem Einsatz von der
 * IDTA bzw. einer Rechtsberatung pruefen und freigeben lassen.
 *
 * **Jede inhaltliche Aenderung bekommt eine neue `DATENSCHUTZ_FASSUNG`.** Gespeichert wird beim
 * Besucher die Fassung, der er zugestimmt hat; eine Registrierung mit einer alten Fassung lehnt
 * der Server ab, damit niemand einem Text zustimmt, der nicht mehr gilt.
 */

export const DATENSCHUTZ_FASSUNG = "2026-10-23.2";

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
      "Industrial Digital Twin Association e. V. (IDTA), [[ANSCHRIFT IDTA]], [[KONTAKT IDTA: E-Mail und Telefon]].",
      "Datenschutzbeauftragter: [[DATENSCHUTZBEAUFTRAGTER: Name oder Stelle und Kontakt]].",
    ],
  },
  {
    titel: "Welche Daten wir verarbeiten",
    absaetze: [
      "Die Kennung deines Besucherpasses; die Angaben, die du hier einträgst (Titel, Vorname, Nachname, Alias, Firma, Position, Anschrift, E-Mail-Adresse, Website); das Bild, das du aus unserer Auswahl wählst (kein Foto von dir); dein Passwort, gespeichert nur als nicht umkehrbarer Hashwert; die Inhalte, die dir an den Ständen zugeordnet werden, mit dem Zeitpunkt; die Nachrichten, die du nach der Anmeldung selbst anlegst (Titel, Text, Bild, Zeitpunkt); Zeitpunkt und Fassung deiner Einwilligung.",
    ],
  },
  {
    titel: "Wofür",
    absaetze: [
      "Damit dein Pass funktioniert: Aussteller ordnen dir an ihrem Stand Inhalte zu (etwa Datenblätter, Links, Ansprechpartner), und du findest sie danach im Viewer, den du über den QR-Code deines Passes öffnest.",
      "Damit du dich mit deiner E-Mail-Adresse und deinem Passwort anmelden, deine Angaben selbst ändern und deinem Pass eigene Nachrichten mit Bildern hinzufügen kannst.",
      "Damit wir auswerten können, welche Stände besucht wurden.",
    ],
  },
  {
    titel: "Rechtsgrundlage",
    absaetze: [
      "Deine Einwilligung nach Art. 6 Abs. 1 lit. a DSGVO. Die Registrierung ist freiwillig. Ohne sie können dir keine Inhalte zugeordnet werden.",
    ],
  },
  {
    titel: "Wer deine Daten sieht",
    absaetze: [
      "Das Standpersonal eines Ausstellers sieht deine Angaben, wenn es deinen Pass an seinem Stand scannt.",
      "Die Betreiber der Anwendung können deine Nachrichten einsehen und unangemessene Inhalte löschen.",
      "Der Viewer ist über die Adresse auf deinem Pass ohne Anmeldung erreichbar. Wer diese Adresse kennt, etwa durch ein Foto des QR-Codes, kann die dort angezeigten Angaben und Inhalte abrufen, auch deine Nachrichten und Bilder. Gib deinen Pass deshalb nicht aus der Hand, und lade nichts hoch, was andere nicht sehen sollen.",
      "Neoception GmbH betreibt diese Anwendung und den Viewer im Auftrag der IDTA (Auftragsverarbeitung nach Art. 28 DSGVO). Gehostet wird bei [[HOSTING: Anbieter und Standort]].",
      "Eine Übermittlung in ein Land außerhalb der EU findet [[DRITTLAND: nicht statt / statt, mit Garantie]].",
    ],
  },
  {
    titel: "Wie lange",
    absaetze: ["[[SPEICHERDAUER: zum Beispiel bis X Monate nach der Messe, danach gelöscht]]."],
  },
  {
    titel: "Deine Rechte",
    absaetze: [
      "Du hast das Recht auf Auskunft (Art. 15 DSGVO), Berichtigung (Art. 16), Löschung (Art. 17), Einschränkung der Verarbeitung (Art. 18) und Datenübertragbarkeit (Art. 20). Deine Angaben kannst du nach der Anmeldung jederzeit selbst ändern.",
      "Du kannst deine Einwilligung jederzeit mit Wirkung für die Zukunft widerrufen (Art. 7 Abs. 3 DSGVO), per E-Mail an [[KONTAKT FÜR WIDERRUF]] oder am Stand der IDTA. Die bis dahin erfolgte Verarbeitung bleibt rechtmäßig.",
      "Du hast das Recht, dich bei einer Datenschutzaufsichtsbehörde zu beschweren (Art. 77 DSGVO), zum Beispiel bei [[AUFSICHTSBEHÖRDE am Sitz der IDTA]].",
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
