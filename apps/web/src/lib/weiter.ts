/**
 * Das Ziel nach der Anmeldung, wenn der Besucher vom DTI-Viewer kommt, seit dem 04.11.2026.
 *
 * Keycloak der DTI schickt ihn an `/oauth/authorize`; ohne Sitzung leitet der Server weiter
 * auf `/?weiter=<dieselbe Anfrage>`. Nach der Anmeldung geht es dorthin zurück, und der
 * Server stellt den Code aus.
 *
 * **Nur dieser eine Pfad gilt.** Jeder andere Wert wird verworfen; sonst wäre `weiter` eine
 * offene Weiterleitung mit der Anmeldeseite des Passports davor. Der Präfix beginnt mit genau
 * einem Schrägstrich und einem festen Pfad, `//fremd.example` passt also nie.
 */
export function dtiWeiter(suche: string): string | null {
  const wert = new URLSearchParams(suche).get("weiter");
  return wert !== null && wert.startsWith("/oauth/authorize?") ? wert : null;
}
