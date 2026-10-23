/** Wer angemeldet ist, aus `GET /api/auth/ich`. */
export interface Ich {
  id: string;
  name: string;
  email: string;
  /**
   * `kiosk` ist das Selbstbedienungs-Tablet am Stand, siehe `kiosk/Kiosk.tsx`. `besucher` ist
   * ein angemeldeter Besucher; er sieht nur seinen eigenen Bereich unter `/mein`.
   */
  rolle: "admin" | "betreuer" | "kiosk" | "besucher";
  /** Nur bei `besucher`: seine GUID. */
  guid?: string;
  /** Leer heisst: noch nicht gesetzt, dann zeigt die Oberflaeche "IDTA Passport". */
  appName: string;
  /** Mit abschliessendem Schraegstrich. Die GUID wird angehaengt. */
  viewerBaseUrl: string;
}
