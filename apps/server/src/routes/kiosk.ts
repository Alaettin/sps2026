import type { FastifyInstance } from "fastify";
import type { Kontext } from "../kontext.js";
import { avatarAuswahl } from "../services/selbstbedienung.js";
import {
  ABSCHNITTE,
  DATENSCHUTZ_FASSUNG,
  EINWILLIGUNGSTEXT,
  istEntwurf,
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

  app.get("/api/kiosk/datenschutz", { preHandler: app.verlangeKiosk }, () => ({
    fassung: DATENSCHUTZ_FASSUNG,
    abschnitte: ABSCHNITTE,
    einwilligungstext: EINWILLIGUNGSTEXT,
    entwurf: istEntwurf(),
    minPasswort: MIN_BESUCHERPASSWORT,
  }));

  // Nur Ids; die Bilder holt das Tablet ueber `/api/dateien/:id`.
  app.get("/api/kiosk/avatare", { preHandler: app.verlangeKiosk }, () => avatarAuswahl(ctx.db));

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
