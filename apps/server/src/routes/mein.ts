import type { FastifyInstance, FastifyRequest } from "fastify";
import { readSession } from "../auth/session.js";
import { badRequest, forbidden, unauthorized } from "../errors.js";
import type { Kontext } from "../kontext.js";
import { entferneBesuch, meineExponate, nimmAuf } from "../services/besuche.js";
import { entferneKontakt, meineKontakte, nimmKontaktAuf } from "../services/besucherkontakte.js";
import { findeDatei } from "../services/dateien.js";
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
   * Der Besucher scannt den Pass eines anderen und nimmt ihn als Kontakt auf, seit dem
   * 03.11.2026. Die Oberflaeche liest die GUID aus der Viewer-Adresse im QR-Code.
   *
   * **Begrenzt je Sitzung**, weil Passnummern fortlaufend sind und die Antwort den Namen
   * nennt: ohne Grenze liesse sich die Besucherliste der Messe durchprobieren. Nicht je IP,
   * denn am Stand haengen alle Handys im selben WLAN.
   */
  app.post<{ Body: { guid?: unknown } }>(
    "/api/mein/kontakte",
    {
      preHandler: app.verlangeBesucher,
      config: {
        rateLimit: {
          max: 30,
          timeWindow: "1 minute",
          keyGenerator: (req: FastifyRequest) => readSession(req)?.sub ?? req.ip,
        },
      },
    },
    async (req) => {
      const kontakt = req.body?.guid;
      if (typeof kontakt !== "string") throw badRequest("guid-fehlt", "Field guid is required.");
      return nimmKontaktAuf(ctx.db, guid(req), kontakt);
    },
  );

  /** Die eigenen Kontakte, fuer den Kasten „Kontakte“. */
  app.get("/api/mein/kontakte", { preHandler: app.verlangeBesucher }, async (req) =>
    meineKontakte(ctx.db, guid(req)),
  );

  /** Nimmt einen Kontakt heraus. Trifft nur die eigene Liste. */
  app.delete<{ Params: { guid: string } }>(
    "/api/mein/kontakte/:guid",
    { preHandler: app.verlangeBesucher },
    async (req, reply) => {
      entferneKontakt(ctx.db, guid(req), req.params.guid);
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
