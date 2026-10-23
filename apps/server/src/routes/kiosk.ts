import type { FastifyInstance } from "fastify";
import type { Kontext } from "../kontext.js";
import {
  aendereSelbst,
  avatarAuswahl,
  selbstAnsicht,
  waehleAvatar,
} from "../services/selbstbedienung.js";

/**
 * Das Selbstbedienungs-Tablet am Stand.
 *
 * Ein Besucher scannt seinen eigenen Pass und pflegt danach seine Stammdaten oder waehlt
 * einen Avatar. Mehr nicht. Was er sehen und aendern darf, steht in
 * `services/selbstbedienung.ts`, gemeinsam mit dem angemeldeten Besucher (`routes/mein.ts`).
 *
 * **Eigene Routen statt geweiteter Rechte.** Die Verwaltungsrouten bleiben Admin-Sache;
 * haette man sie fuer `kiosk` geoeffnet, waere die enge Rolle eine Frage von Wachsamkeit
 * bei jeder kuenftigen Aenderung. Hier ist sie eine Frage des Routenbaums.
 *
 * **Es gibt bewusst keine Listenroute.** Ein Tablet im Publikum darf nie erfahren, welche
 * GUIDs es gibt.
 *
 * **Was diese Routen nicht leisten koennen:** Die GUIDs sind fortlaufend. Wer eine kennt,
 * kennt alle, und der Server kann nicht unterscheiden, ob eine GUID von der Kamera kam
 * oder erfunden wurde. Der Schutz ist der physische Pass und ein Geraet im Kioskmodus;
 * deshalb hat die Oberflaeche kein Eingabefeld fuer die GUID.
 */
export function kioskRoutes(app: FastifyInstance, ctx: Kontext): void {
  app.get<{ Params: { guid: string } }>(
    "/api/kiosk/besucher/:guid",
    { preHandler: app.verlangeKiosk },
    async (req) => selbstAnsicht(ctx.db, req.params.guid),
  );

  // Die GUID steht im Pfad und wird nie aus dem Rumpf gelesen.
  app.patch<{ Params: { guid: string }; Body: Record<string, unknown> }>(
    "/api/kiosk/besucher/:guid",
    { preHandler: app.verlangeKiosk },
    async (req) => aendereSelbst(ctx.db, req.params.guid, req.body ?? {}),
  );

  // Nur Ids; die Bilder holt der Klient ueber `/api/dateien/:id`.
  app.get("/api/kiosk/avatare", { preHandler: app.verlangeKiosk }, () => avatarAuswahl(ctx.db));

  app.patch<{ Params: { guid: string }; Body: { avatarDateiId?: unknown } }>(
    "/api/kiosk/besucher/:guid/avatar",
    { preHandler: app.verlangeKiosk },
    async (req) => waehleAvatar(ctx.db, req.params.guid, req.body?.avatarDateiId ?? null),
  );
}
