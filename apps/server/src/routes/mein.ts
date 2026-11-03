import type { FastifyInstance, FastifyRequest } from "fastify";
import { badRequest, forbidden, unauthorized } from "../errors.js";
import type { Kontext } from "../kontext.js";
import { entferneBesuch, meineExponate, nimmAuf } from "../services/besuche.js";
import { findeDatei } from "../services/dateien.js";
import { DATENSCHUTZ_FASSUNG, datenschutzText, spracheAus } from "../services/datenschutz.js";
import {
  aendereSelbst,
  avatarAuswahl,
  darfBildSehen,
  selbstAnsicht,
  waehleAvatar,
} from "../services/selbstbedienung.js";

/**
 * Der Bereich des angemeldeten Besuchers, seit dem 23.10.2026.
 *
 * Er sieht und aendert dasselbe wie am Terminal, nur ohne Scan: **die GUID kommt allein aus
 * der Sitzung**, nie aus Pfad oder Rumpf. Damit gibt es hier keine Adresse, unter der ein
 * Besucher die Daten eines anderen erreichen koennte.
 */
export function meinRoutes(app: FastifyInstance, ctx: Kontext): void {
  const guid = (req: FastifyRequest): string => {
    if (req.besucherGuid === null) throw unauthorized();
    return req.besucherGuid;
  };

  app.get("/api/mein", { preHandler: app.verlangeBesucher }, async (req) =>
    selbstAnsicht(ctx.db, guid(req)),
  );

  app.patch<{ Body: Record<string, unknown> }>(
    "/api/mein",
    { preHandler: app.verlangeBesucher },
    async (req) => aendereSelbst(ctx.db, guid(req), req.body ?? {}),
  );

  // Derselbe Hinweis, dem der Besucher zugestimmt hat, zum Nachlesen und fuer den Widerruf.
  app.get<{ Querystring: { sprache?: string } }>(
    "/api/mein/datenschutz",
    { preHandler: app.verlangeBesucher },
    (req) => ({
      fassung: DATENSCHUTZ_FASSUNG,
      abschnitte: datenschutzText(spracheAus(req.query.sprache)).abschnitte,
    }),
  );

  app.get("/api/mein/avatare", { preHandler: app.verlangeBesucher }, () => avatarAuswahl(ctx.db));

  app.patch<{ Body: { avatarDateiId?: unknown } }>(
    "/api/mein/avatar",
    { preHandler: app.verlangeBesucher },
    async (req) => waehleAvatar(ctx.db, guid(req), req.body?.avatarDateiId ?? null),
  );

  /**
   * Der Besucher scannt den QR-Code am Exponat und nimmt es auf, seit dem 02.11.2026.
   * Idempotent; die Antwort sagt, ob es neu war, fuer die Bestaetigung.
   */
  app.post<{ Body: { code?: unknown } }>(
    "/api/mein/besuche",
    { preHandler: app.verlangeBesucher },
    async (req) => {
      const code = req.body?.code;
      if (typeof code !== "string") throw badRequest("code-fehlt", "Field code is required.");
      return nimmAuf(ctx.db, guid(req), code);
    },
  );

  /** Die eigenen aufgenommenen Exponate, fuer den Kasten „Meine Exponate“. */
  app.get("/api/mein/besuche", { preHandler: app.verlangeBesucher }, async (req) =>
    meineExponate(ctx.db, guid(req)),
  );

  /**
   * Nimmt ein Exponat wieder heraus. Es verschwindet aus dem Viewer des Besuchers; wer es
   * zurueck will, scannt den QR-Code erneut. Trifft nur die eigene Zeile.
   */
  app.delete<{ Params: { exponatId: string } }>(
    "/api/mein/besuche/:exponatId",
    { preHandler: app.verlangeBesucher },
    async (req, reply) => {
      entferneBesuch(ctx.db, guid(req), req.params.exponatId);
      void reply.code(204);
      return null;
    },
  );

  /**
   * Bilder fuer den Besucher: Standard, Galerie und der eigene Avatar.
   *
   * `/api/dateien/:id` bleibt dem Personal; dort liegen auch die Dokumente der Exponate, und
   * die gehen einen Besucher nur ueber die Zuordnung im Viewer etwas an.
   */
  app.get<{ Params: { id: string } }>(
    "/api/mein/bild/:id",
    { preHandler: app.verlangeBesucher },
    async (req, reply) => {
      if (!darfBildSehen(ctx.db, guid(req), req.params.id)) {
        throw forbidden("bild-nicht-erlaubt", "This image is not available to visitors.");
      }
      const reihe = findeDatei(ctx.db, req.params.id);
      void reply
        .header("content-type", reihe.mimeType)
        .header("content-length", String(reihe.groesse))
        .header("cache-control", "private, max-age=3600");
      return ctx.ablage.lies(reihe.pfad);
    },
  );
}
