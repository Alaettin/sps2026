import { afterEach, describe, expect, it } from "vitest";
import { DATENSCHUTZ_FASSUNG } from "../src/services/datenschutz.js";
import { alsBesucher, melde, starte, type Pruefstand } from "./hilfe.js";

/** Die Seite `/datenschutz` hinter der Fusszeile liest ohne Anmeldung, seit dem 02.11.2026. */

const ADMIN = { ADMIN_EMAIL: "admin@idta-passport.de", ADMIN_PASSWORT: "startpasswort-123" };

let stand: Pruefstand | null = null;
afterEach(async () => {
  await stand?.ende();
  stand = null;
});

describe("Oeffentlicher Datenschutzhinweis", () => {
  it("antwortet ohne Sitzung mit demselben Text wie im Besucherbereich", async () => {
    stand = await starte(ADMIN);
    const s = stand;
    const offen = await s.app.inject({ url: "/api/datenschutz" });
    expect(offen.statusCode).toBe(200);
    expect(offen.headers["set-cookie"]).toBeUndefined();

    const keks = await melde(s, "admin@idta-passport.de", "startpasswort-123");
    const besucher = await alsBesucher(s, keks);
    const mein = await s.app.inject({
      url: "/api/mein/datenschutz",
      headers: { cookie: besucher.keks },
    });
    expect(offen.json()).toEqual(mein.json());
    expect(offen.json<{ fassung: string }>().fassung).toBe(DATENSCHUTZ_FASSUNG);
  });
});

describe("Server-Log ohne IP-Adresse", () => {
  it("schreibt je Anfrage nur Methode und Pfad, keine Adresse und keinen Port", async () => {
    stand = await starte(ADMIN);
    const log = stand.app.log as unknown as Record<symbol, unknown>;
    const sym = Object.getOwnPropertySymbols(log).find((x) => x.description === "pino.serializers");
    const serialisierer = (sym === undefined ? {} : log[sym]) as {
      req?: (r: unknown) => Record<string, unknown>;
    };
    expect(serialisierer.req).toBeTypeOf("function");
    const zeile = serialisierer.req?.({
      method: "GET",
      url: "/api/health",
      ip: "203.0.113.7",
      hostname: "idta-passport.sliplane.app",
      socket: { remoteAddress: "203.0.113.7", remotePort: 51234 },
      raw: { socket: { remoteAddress: "203.0.113.7" } },
    });
    expect(zeile).toEqual({ method: "GET", url: "/api/health" });
    expect(JSON.stringify(zeile)).not.toContain("203.0.113.7");
  });
});
