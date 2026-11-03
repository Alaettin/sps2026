import type { FastifyInstance } from "fastify";
import { DATENSCHUTZ_FASSUNG, datenschutzText, spracheAus } from "../services/datenschutz.js";

/**
 * Der Datenschutzhinweis **ohne Anmeldung**, fuer die Seite `/datenschutz` hinter der
 * Fusszeile, seit dem 02.11.2026. Derselbe Text und dieselbe Fassung wie unter
 * `/api/kiosk/datenschutz`; er enthaelt nichts Persoenliches. Seit dem 03.11.2026 liest ihn
 * auch der angemeldete Besucher hier, `/api/mein/datenschutz` ist entfallen.
 * `?sprache=en` liefert die englische Fassung.
 */
export function rechtlichesRoutes(app: FastifyInstance): void {
  app.get<{ Querystring: { sprache?: string } }>("/api/datenschutz", (req) => ({
    fassung: DATENSCHUTZ_FASSUNG,
    abschnitte: datenschutzText(spracheAus(req.query.sprache)).abschnitte,
  }));
}
