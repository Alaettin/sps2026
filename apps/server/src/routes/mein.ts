import type { FastifyInstance, FastifyRequest } from "fastify";
import { forbidden, unauthorized } from "../errors.js";
import type { Kontext } from "../kontext.js";
import { findeDatei } from "../services/dateien.js";
import { ABSCHNITTE, DATENSCHUTZ_FASSUNG } from "../services/datenschutz.js";
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
  app.get("/api/mein/datenschutz", { preHandler: app.verlangeBesucher }, () => ({
    fassung: DATENSCHUTZ_FASSUNG,
    abschnitte: ABSCHNITTE,
  }));

  app.get("/api/mein/avatare", { preHandler: app.verlangeBesucher }, () => avatarAuswahl(ctx.db));

  app.patch<{ Body: { avatarDateiId?: unknown } }>(
    "/api/mein/avatar",
    { preHandler: app.verlangeBesucher },
    async (req) => waehleAvatar(ctx.db, guid(req), req.body?.avatarDateiId ?? null),
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
