import type { FastifyInstance, FastifyRequest } from "fastify";
import { badRequest } from "../errors.js";
import type { Kontext } from "../kontext.js";
import {
  aendereDokument,
  aendereExponat,
  aendereLink,
  besucherVonExponat,
  betreuerVonExponat,
  findeExponat,
  inhalteVonExponat,
  legeDokumentAn,
  legeExponatAn,
  legeLinkAn,
  listeExponate,
  loescheExponat,
  loescheInhalt,
  type Upload,
} from "../services/exponate.js";
import { aendereKontakt, legeKontaktAn, leseKontakt } from "../services/kontakte.js";
import { verlangeExponatBearbeiten, verlangeExponatZugriff } from "../services/zugriff.js";

type Art = "dokument" | "link" | "kontakt";

function alsArt(wert: string): Art {
  if (wert !== "dokument" && wert !== "link" && wert !== "kontakt") {
    throw badRequest("art-ungueltig", 'Path segment art must be "dokument", "link" or "kontakt".');
  }
  return wert;
}

/** Text aus einem JSON-Rumpf, `undefined` wenn nicht mitgeschickt. */
function text(wert: unknown): string | undefined {
  return typeof wert === "string" ? wert : undefined;
}

/**
 * Liest ein Dokument aus einem Multipart-Koerper: `titel`, `beschreibung`, optional die Datei
 * `datei`. **Ein Aufruf**, wie bei den Nachrichten: eine Datei, die hochgeladen, aber nie an ein
 * Dokument gehaengt wurde, kann so nicht entstehen. Nicht mitgeschickte Felder bleiben
 * `undefined` und beim Aendern unberuehrt.
 */
async function leseDokument(
  req: FastifyRequest,
): Promise<{ datei?: Upload; titel?: string; beschreibung?: string | null }> {
  if (!req.isMultipart()) {
    throw badRequest("multipart-erwartet", "Send the document as multipart/form-data.");
  }
  const eingabe: { datei?: Upload; titel?: string; beschreibung?: string | null } = {};
  for await (const teil of req.parts()) {
    if (teil.type === "file") {
      // Der Strom muss gelesen werden, auch wenn das Feld nicht passt; sonst haengt die Antwort.
      const inhalt = await teil.toBuffer();
      if (teil.fieldname === "datei") eingabe.datei = { name: teil.filename, inhalt };
      continue;
    }
    const wert = typeof teil.value === "string" ? teil.value : "";
    if (teil.fieldname === "titel") eingabe.titel = wert;
    else if (teil.fieldname === "beschreibung") eingabe.beschreibung = wert;
  }
  return eingabe;
}

export function exponatRoutes(app: FastifyInstance, ctx: Kontext): void {
  /** Die Liste. Ein Admin sieht alle, ein Betreuer **nur die eigenen**. */
  app.get("/api/exponate", { preHandler: app.verlangeAnmeldung }, async (req) => {
    const nutzer = req.nutzer;
    const alle = listeExponate(ctx.db);
    const sichtbar =
      nutzer?.rolle === "admin"
        ? alle
        : alle.filter((e) => betreuerVonExponat(ctx.db, e.id).includes(nutzer?.id ?? ""));

    return sichtbar.map(({ scanCode: _code, ...e }) => {
      const i = inhalteVonExponat(ctx.db, e.id);
      return {
        ...e,
        anzahl: {
          dokumente: i.dokumente.length,
          links: i.links.length,
          kontakte: i.kontakte.length,
        },
      };
    });
  });

  app.get<{ Params: { id: string } }>(
    "/api/exponate/:id",
    { preHandler: app.verlangeAnmeldung },
    async (req) => {
      verlangeExponatZugriff(ctx, req, req.params.id);
      const { scanCode, ...exponat } = findeExponat(ctx.db, req.params.id);
      return {
        ...exponat,
        /*
         * Der Code des QR-Codes **nur fuer den Admin**: er druckt ihn. Ein Betreuer koennte ihn
         * sonst weitergeben, und Besucher naehmen das Exponat auf, ohne am Stand zu sein.
         */
        ...(req.nutzer?.rolle === "admin" ? { scanCode } : {}),
        ...inhalteVonExponat(ctx.db, req.params.id),
        betreuer: betreuerVonExponat(ctx.db, req.params.id),
        // Fuer die Rueckfrage vor dem Loeschen: eine Warnung ohne Zahl ist eine Behauptung.
        betroffeneBesucher: besucherVonExponat(ctx.db, req.params.id),
      };
    },
  );

  app.post<{ Body: { name?: unknown; beschreibung?: unknown } }>(
    "/api/exponate",
    { preHandler: app.verlangeAdmin },
    async (req, reply) => {
      const { name, beschreibung } = req.body ?? {};
      if (typeof name !== "string") throw badRequest("feld-fehlt", "Field name is required.");
      // Die Kennung vergibt der Server, siehe `naechsteKennung`.
      void reply.code(201);
      const { scanCode: _code, ...exponat } = legeExponatAn(ctx.db, {
        name,
        beschreibung: typeof beschreibung === "string" ? beschreibung : null,
      });
      return exponat;
    },
  );

  app.patch<{ Params: { id: string }; Body: { name?: unknown; beschreibung?: unknown } }>(
    "/api/exponate/:id",
    { preHandler: app.verlangeAdmin },
    async (req) => {
      const { name, beschreibung } = req.body ?? {};
      /*
       * **Die Kennung wird hier nicht angenommen.** Sie steht in jedem `propertyId` dieses
       * Exponats; ein Wechsel benennt alle Datenpunkte um und bricht das Mapping in Axon.
       * Seit dem 08.10.2026 vergibt sie der Server und sie bleibt unveraendert.
       */
      const { scanCode: _code, ...exponat } = aendereExponat(ctx.db, req.params.id, {
        ...(typeof name === "string" ? { name } : {}),
        ...("beschreibung" in (req.body ?? {})
          ? { beschreibung: typeof beschreibung === "string" ? beschreibung : null }
          : {}),
      });
      return exponat;
    },
  );

  app.delete<{ Params: { id: string } }>(
    "/api/exponate/:id",
    { preHandler: app.verlangeAdmin },
    async (req, reply) => {
      loescheExponat(ctx.db, req.params.id);
      void reply.code(204);
      return null;
    },
  );

  // --- Inhalte ------------------------------------------------------------------------
  /*
   * Seit dem 02.11.2026 fuer Admin **und** Betreuer dieses Exponats, siehe
   * `verlangeExponatBearbeiten`. Ein fremder Betreuer bekommt 404.
   */

  app.post<{ Params: { id: string } }>(
    "/api/exponate/:id/dokumente",
    { preHandler: app.verlangeAnmeldung },
    async (req, reply) => {
      verlangeExponatBearbeiten(ctx, req, req.params.id);
      const { datei, titel, beschreibung } = await leseDokument(req);
      if (datei === undefined)
        throw badRequest("datei-fehlt", "Multipart field datei is required.");
      if (titel === undefined || titel.trim() === "") {
        throw badRequest("felder-fehlen", "Field titel is required.");
      }
      void reply.code(201);
      return legeDokumentAn(ctx.db, ctx.ablage, req.params.id, { datei, titel, beschreibung });
    },
  );

  app.patch<{ Params: { id: string; dokumentId: string } }>(
    "/api/exponate/:id/dokumente/:dokumentId",
    { preHandler: app.verlangeAnmeldung },
    async (req) => {
      verlangeExponatBearbeiten(ctx, req, req.params.id);
      return aendereDokument(
        ctx.db,
        ctx.ablage,
        req.params.id,
        req.params.dokumentId,
        await leseDokument(req),
      );
    },
  );

  app.post<{ Params: { id: string }; Body: { url?: unknown; titel?: unknown } }>(
    "/api/exponate/:id/links",
    { preHandler: app.verlangeAnmeldung },
    async (req, reply) => {
      verlangeExponatBearbeiten(ctx, req, req.params.id);
      const url = text(req.body?.url);
      const titel = text(req.body?.titel);
      if (url === undefined || titel === undefined || url.trim() === "" || titel.trim() === "") {
        throw badRequest("felder-fehlen", "Fields url and titel are required.");
      }
      void reply.code(201);
      return legeLinkAn(ctx.db, req.params.id, { url, titel });
    },
  );

  app.patch<{ Params: { id: string; linkId: string }; Body: { url?: unknown; titel?: unknown } }>(
    "/api/exponate/:id/links/:linkId",
    { preHandler: app.verlangeAnmeldung },
    async (req) => {
      verlangeExponatBearbeiten(ctx, req, req.params.id);
      const url = text(req.body?.url);
      const titel = text(req.body?.titel);
      return aendereLink(ctx.db, req.params.id, req.params.linkId, {
        ...(url !== undefined ? { url } : {}),
        ...(titel !== undefined ? { titel } : {}),
      });
    },
  );

  app.post<{ Params: { id: string } }>(
    "/api/exponate/:id/kontakte",
    { preHandler: app.verlangeAnmeldung },
    async (req, reply) => {
      verlangeExponatBearbeiten(ctx, req, req.params.id);
      void reply.code(201);
      return legeKontaktAn(ctx.db, req.params.id, leseKontakt(req.body));
    },
  );

  app.patch<{ Params: { id: string; kontaktId: string } }>(
    "/api/exponate/:id/kontakte/:kontaktId",
    { preHandler: app.verlangeAnmeldung },
    async (req) => {
      verlangeExponatBearbeiten(ctx, req, req.params.id);
      return aendereKontakt(ctx.db, req.params.id, req.params.kontaktId, leseKontakt(req.body));
    },
  );

  /**
   * Wie viele Besucher ein Loeschen betrifft. Seit dem 02.11.2026 fuer jede Art dieselbe Zahl:
   * alle, die das Exponat aufgenommen haben. `art` und `zielId` bleiben im Pfad, damit die
   * Oberflaeche nicht wissen muss, dass es so ist.
   */
  app.get<{ Params: { id: string; art: string; zielId: string } }>(
    "/api/exponate/:id/inhalte/:art/:zielId/betroffene",
    { preHandler: app.verlangeAnmeldung },
    async (req) => {
      verlangeExponatBearbeiten(ctx, req, req.params.id);
      alsArt(req.params.art);
      return { betroffene: besucherVonExponat(ctx.db, req.params.id) };
    },
  );

  app.delete<{ Params: { id: string; art: string; zielId: string } }>(
    "/api/exponate/:id/inhalte/:art/:zielId",
    { preHandler: app.verlangeAnmeldung },
    async (req, reply) => {
      verlangeExponatBearbeiten(ctx, req, req.params.id);
      await loescheInhalt(
        ctx.db,
        ctx.ablage,
        req.params.id,
        alsArt(req.params.art),
        req.params.zielId,
      );
      void reply.code(204);
      return null;
    },
  );
}
