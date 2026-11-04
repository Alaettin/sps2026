import type { FastifyInstance, FastifyRequest } from "fastify";
import { readSession } from "../auth/session.js";
import type { Kontext } from "../kontext.js";
import {
  MERKMALE,
  erzeugeEntwurf,
  uebernimmEntwurf,
  verwirfEntwurf,
} from "../services/kiavatar.js";
import { avatarAuswahl } from "../services/selbstbedienung.js";
import {
  DATENSCHUTZ_FASSUNG,
  datenschutzText,
  istEntwurf,
  spracheAus,
} from "../services/datenschutz.js";
import { MIN_BESUCHERPASSWORT, passstatus, registriere } from "../services/registrierung.js";

/**
 * Das Tablet am Stand: **Besucher registrieren sich hier**, seit dem 23.10.2026.
 *
 * Pass scannen, Daten eintragen, Passwort setzen, Bild waehlen, einwilligen. Siehe
 * `services/registrierung.ts`.
 *
 * **Das Tablet liest keine Besucherdaten.** Es erfaehrt zu einer GUID nur, ob sie frei oder
 * schon registriert ist, und legt neu an. Aendern kann ein Besucher seine Daten nur nach der
 * Anmeldung mit E-Mail und Passwort (`routes/mein.ts`). Vorher konnte jeder, der einen Pass in
 * der Hand hatte, am Tablet dessen Anschrift lesen und aendern.
 *
 * **Eigene Routen statt geweiteter Rechte.** Die Verwaltungsrouten bleiben Admin-Sache; die
 * enge Rolle ist eine Frage des Routenbaums, nicht der Wachsamkeit bei jeder Aenderung.
 */
export function kioskRoutes(app: FastifyInstance, ctx: Kontext): void {
  app.get<{ Params: { guid: string } }>(
    "/api/kiosk/pass/:guid",
    { preHandler: app.verlangeKiosk },
    async (req) => ({ status: passstatus(ctx.db, req.params.guid) }),
  );

  // `?sprache=en` liefert die englische Fassung, sonst die deutsche.
  app.get<{ Querystring: { sprache?: string } }>(
    "/api/kiosk/datenschutz",
    { preHandler: app.verlangeKiosk },
    (req) => ({
      fassung: DATENSCHUTZ_FASSUNG,
      ...datenschutzText(spracheAus(req.query.sprache)),
      entwurf: istEntwurf(),
      minPasswort: MIN_BESUCHERPASSWORT,
    }),
  );

  /*
   * Nur Ids; die Bilder holt das Tablet ueber `/api/dateien/:id`. Seit dem 04.11.2026 dazu, ob
   * der KI-Weg an ist, und seine Merkmale: die Oberflaeche zeigt genau, was der Server annimmt.
   */
  app.get("/api/kiosk/avatare", { preHandler: app.verlangeKiosk }, () => ({
    ...avatarAuswahl(ctx.db),
    ki: ctx.env.openai !== null,
    merkmale: MERKMALE.map((m) => ({
      id: m.id,
      de: m.de,
      en: m.en,
      werte: m.werte.map((w) => ({ id: w.id, de: w.de, en: w.en })),
    })),
  }));

  /**
   * Ein KI-Bild erzeugen, als Entwurf. **Begrenzt je Sitzung**: jeder Aufruf kostet bei OpenAI
   * Geld, und am Stand haengen alle Tablets im selben Netz.
   */
  app.post<{ Body: { merkmale?: unknown } }>(
    "/api/kiosk/avatare/ki",
    {
      preHandler: app.verlangeKiosk,
      config: {
        rateLimit: {
          max: 10,
          timeWindow: "1 minute",
          keyGenerator: (req: FastifyRequest) => readSession(req)?.sub ?? req.ip,
        },
      },
    },
    async (req, reply) => {
      const entwurf = await erzeugeEntwurf(ctx.db, ctx.ablage, ctx.env.openai, req.body?.merkmale);
      void reply.code(201);
      return entwurf;
    },
  );

  /** Den Entwurf uebernehmen: er kommt in die Galerie und ist ab dann fuer alle waehlbar. */
  app.post<{ Params: { dateiId: string } }>(
    "/api/kiosk/avatare/ki/:dateiId/uebernehmen",
    { preHandler: app.verlangeKiosk },
    async (req) => uebernimmEntwurf(ctx.db, req.params.dateiId),
  );

  /** Den Entwurf verwerfen, etwa bei "Neu erzeugen". Galeriebilder trifft das nicht. */
  app.delete<{ Params: { dateiId: string } }>(
    "/api/kiosk/avatare/ki/:dateiId",
    { preHandler: app.verlangeKiosk },
    async (req, reply) => {
      await verwirfEntwurf(ctx.db, ctx.ablage, req.params.dateiId);
      void reply.code(204);
      return null;
    },
  );

  app.post<{ Body: Record<string, unknown> }>(
    "/api/kiosk/registrierung",
    { preHandler: app.verlangeKiosk },
    async (req, reply) => {
      await registriere(ctx.db, req.body ?? {});
      void reply.code(201);
      // Bewusst ohne Daten: das Tablet bekommt nichts zurueck, was es anzeigen koennte.
      return { registriert: true };
    },
  );
}
