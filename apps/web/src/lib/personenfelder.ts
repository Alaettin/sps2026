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
  { name: "titel", text: "Titel", gruppe: "Person" },
  { name: "vorname", text: "Vorname", gruppe: "Person", pflicht: true },
  { name: "nachname", text: "Nachname", gruppe: "Person", pflicht: true },
  { name: "alias", text: "Alias", gruppe: "Person", nurBesucher: true },
  { name: "firma", text: "Firma", gruppe: "Firma" },
  { name: "position", text: "Position", gruppe: "Firma" },
  { name: "strasse", text: "Straße", gruppe: "Anschrift" },
  { name: "plz", text: "PLZ", gruppe: "Anschrift" },
  { name: "ort", text: "Ort", gruppe: "Anschrift" },
  { name: "land", text: "Land", gruppe: "Anschrift" },
  { name: "email", text: "E-Mail", gruppe: "Kontakt", typ: "email", pflicht: "besucher" },
  { name: "website", text: "Website", gruppe: "Kontakt" },
];

/** Pflicht in einer Besuchermaske (Verwaltung, Terminal, eigener Bereich). */
export function pflichtBeimBesucher(f: Personenfeld): boolean {
  return f.pflicht === true || f.pflicht === "besucher";
}

/**
 * Die deutschen Meldungen zu den Fehlern, die ein Besucherdatensatz beim Speichern bekommen
 * kann. `null`, wenn der Code keiner davon ist.
 */
export function besucherFehlertext(code: string | undefined): string | null {
  switch (code) {
    case "pflicht-fehlt":
    case "feld-fehlt":
      return "Vorname, Nachname und E-Mail dürfen nicht leer sein.";
    case "email-ungueltig":
      return "Die E-Mail-Adresse ist ungültig.";
    case "email-vergeben":
      return "Diese E-Mail-Adresse ist schon vergeben.";
    default:
      return null;
  }
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
