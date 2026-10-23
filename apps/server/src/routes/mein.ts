import type { FastifyInstance, FastifyRequest } from "fastify";
import { badRequest, forbidden, unauthorized } from "../errors.js";
import type { Kontext } from "../kontext.js";
import { findeDatei } from "../services/dateien.js";
import {
  aendereNachricht,
  legeNachrichtAn,
  loescheNachricht,
  nachrichtenVon,
  type NachrichtEingabe,
} from "../services/nachrichten.js";
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

  // --- Nachrichten ----------------------------------------------------------------------

  app.get("/api/mein/nachrichten", { preHandler: app.verlangeBesucher }, async (req) =>
    nachrichtenVon(ctx.db, guid(req)),
  );

  app.post("/api/mein/nachrichten", { preHandler: app.verlangeBesucher }, async (req, reply) => {
    const eingabe = await leseNachricht(req);
    void reply.code(201);
    return legeNachrichtAn(ctx.db, ctx.ablage, guid(req), eingabe);
  });

  app.patch<{ Params: { id: string } }>(
    "/api/mein/nachrichten/:id",
    { preHandler: app.verlangeBesucher },
    async (req) =>
      aendereNachricht(ctx.db, ctx.ablage, guid(req), req.params.id, await leseNachricht(req)),
  );

  app.delete<{ Params: { id: string } }>(
    "/api/mein/nachrichten/:id",
    { preHandler: app.verlangeBesucher },
    async (req, reply) => {
      await loescheNachricht(ctx.db, ctx.ablage, guid(req), req.params.id);
      void reply.code(204);
      return null;
    },
  );

  /**
   * Bilder fuer den Besucher: Standard, Galerie, der eigene Avatar und die Bilder seiner
   * Nachrichten.
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

/**
 * Liest eine Nachricht aus einem Multipart-Koerper: `titel`, `text`, optional die Datei `bild`
 * und beim Aendern `bildEntfernen=true`.
 *
 * **Multipart, nicht JSON plus eigener Upload.** So kommen Bild und Nachricht in einem Zug;
 * ein Bild, das hochgeladen, aber nie an eine Nachricht gehaengt wurde, kann nicht entstehen.
 * Felder, die nicht mitkommen, bleiben beim Aendern unberuehrt (`undefined`).
 */
async function leseNachricht(req: FastifyRequest): Promise<NachrichtEingabe> {
  if (!req.isMultipart()) {
    throw badRequest("multipart-erwartet", "Send the message as multipart/form-data.");
  }
  const eingabe: NachrichtEingabe = {};
  for await (const teil of req.parts()) {
    if (teil.type === "file") {
      if (teil.fieldname !== "bild") {
        await teil.toBuffer();
        continue;
      }
      eingabe.bild = { name: teil.filename, inhalt: await teil.toBuffer() };
      continue;
    }
    const wert = typeof teil.value === "string" ? teil.value : "";
    if (teil.fieldname === "titel") eingabe.titel = wert;
    else if (teil.fieldname === "text") eingabe.text = wert;
    else if (teil.fieldname === "bildEntfernen") eingabe.bildEntfernen = wert === "true";
  }
  return eingabe;
}
