import type { FastifyInstance } from "fastify";
import { ABSCHNITTE, DATENSCHUTZ_FASSUNG } from "../services/datenschutz.js";

/**
 * Der Datenschutzhinweis **ohne Anmeldung**, fuer die Seite `/datenschutz` hinter der
 * Fusszeile, seit dem 02.11.2026. Derselbe Text und dieselbe Fassung wie unter
 * `/api/mein/datenschutz` und `/api/kiosk/datenschutz`; er enthaelt nichts Persoenliches.
 */
export function rechtlichesRoutes(app: FastifyInstance): void {
  app.get("/api/datenschutz", () => ({
    fassung: DATENSCHUTZ_FASSUNG,
    abschnitte: ABSCHNITTE,
  }));
}
