/**
 * Die Felder einer Person, gruppiert. Eine Liste für alle Masken.
 *
 * **Vorher stand dieselbe Liste viermal da**: in der Besucherdetailseite, am Tablet, bei den
 * Ansprechpartnern und noch einmal im Server. Beim ersten neuen Feld fiel das auf: der
 * Titel war in drei Masken eingetragen und fehlte in der vierten Abfrage, stand also in der
 * Datenbank und kam nie im Viewer an.
 *
 * Die Gruppen sind der eigentliche Zweck: zehn Felder am Stück liest niemand, und am Tablet
 * steht jemand dabei.
 */

export type Feldgruppe = "Person" | "Firma" | "Anschrift" | "Kontakt";

export interface Personenfeld {
  name: string;
  text: string;
  /** Die Beschriftung auf Englisch, seit dem 03.11.2026. */
  en: string;
  gruppe: Feldgruppe;
  /**
   * `true`: ueberall Pflicht. `"besucher"`: nur beim Besucher, dort ist die E-Mail sein Login;
   * ein Ansprechpartner braucht keine.
   */
  pflicht?: boolean | "besucher";
  typ?: "text" | "email";
  /** Nur in der Besuchermaske, nicht bei den Ansprechpartnern. */
  nurBesucher?: boolean;
}

export const PERSONENFELDER: Personenfeld[] = [
  { name: "titel", text: "Titel", en: "Title", gruppe: "Person" },
  { name: "vorname", text: "Vorname", en: "First name", gruppe: "Person", pflicht: true },
  { name: "nachname", text: "Nachname", en: "Last name", gruppe: "Person", pflicht: true },
  { name: "alias", text: "Alias", en: "Alias", gruppe: "Person", nurBesucher: true },
  { name: "firma", text: "Firma", en: "Company", gruppe: "Firma" },
  { name: "position", text: "Position", en: "Position", gruppe: "Firma" },
  { name: "strasse", text: "Straße", en: "Street", gruppe: "Anschrift" },
  { name: "plz", text: "PLZ", en: "Postcode", gruppe: "Anschrift" },
  { name: "ort", text: "Ort", en: "City", gruppe: "Anschrift" },
  { name: "land", text: "Land", en: "Country", gruppe: "Anschrift" },
  {
    name: "email",
    text: "E-Mail",
    en: "Email",
    gruppe: "Kontakt",
    typ: "email",
    pflicht: "besucher",
  },
  { name: "website", text: "Website", en: "Website", gruppe: "Kontakt" },
];

/** Pflicht in einer Besuchermaske (Verwaltung, Terminal, eigener Bereich). */
export function pflichtBeimBesucher(f: Personenfeld): boolean {
  return f.pflicht === true || f.pflicht === "besucher";
}

/**
 * Die Meldungen zu den Fehlern, die ein Besucherdatensatz beim Speichern bekommen kann.
 * `null`, wenn der Code keiner davon ist.
 */
export function besucherFehlertext(
  code: string | undefined,
  t: (de: string, en: string) => string,
): string | null {
  switch (code) {
    case "pflicht-fehlt":
    case "feld-fehlt":
      return t(
        "Vorname, Nachname und E-Mail dürfen nicht leer sein.",
        "First name, last name and email must not be empty.",
      );
    case "email-ungueltig":
      return t("Die E-Mail-Adresse ist ungültig.", "The email address is not valid.");
    case "email-vergeben":
      return t("Diese E-Mail-Adresse ist schon vergeben.", "This email address is already in use.");
    default:
      return null;
  }
}

/** Die Beschriftung eines Feldes in der aktuellen Sprache. */
export function feldtext(f: Personenfeld, t: (de: string, en: string) => string): string {
  return t(f.text, f.en);
}

const GRUPPENTEXT: Record<Feldgruppe, string> = {
  Person: "Person",
  Firma: "Company",
  Anschrift: "Address",
  Kontakt: "Contact",
};

/** Die Ueberschrift einer Gruppe in der aktuellen Sprache. */
export function gruppentext(g: Feldgruppe, t: (de: string, en: string) => string): string {
  return t(g, GRUPPENTEXT[g]);
}

/** In Anzeigereihenfolge, damit keine Maske eine eigene Folge erfindet. */
export const GRUPPEN: Feldgruppe[] = ["Person", "Firma", "Anschrift", "Kontakt"];

/**
 * Die Felder eines Ansprechpartners: dieselbe Liste ohne die reinen Besucherfelder.
 *
 * Der Alias hat dort keine Spalte und im Konnektor-Modell keinen Datenpunkt; ein Feld in der
 * Maske nähme Eingaben an, die der Server still verwirft.
 */
export const ANSPRECHPARTNERFELDER: Personenfeld[] = PERSONENFELDER.filter((f) => !f.nurBesucher);

/** Die Felder einer Gruppe, in der Reihenfolge der Liste oben. */
export function felderDerGruppe(
  gruppe: Feldgruppe,
  liste: Personenfeld[] = PERSONENFELDER,
): Personenfeld[] {
  return liste.filter((f) => f.gruppe === gruppe);
}

/**
 * Titel und Vorname, wie sie zusammen gelesen werden.
 *
 * Dieselbe Regel wie in der Konnektor-Antwort: ohne Titel bleibt der Vorname unverändert,
 * insbesondere **ohne** führendes Leerzeichen.
 */
export function mitTitel(titel: string | null | undefined, vorname: string): string {
  const t = (titel ?? "").trim();
  return t === "" ? vorname : `${t} ${vorname}`;
}
