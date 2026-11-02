import type { InjectOptions } from "fastify";
import { afterEach, describe, expect, it } from "vitest";
import { besuche, exponatBetreuer } from "../src/db/schema.js";
import { melde, starte, testEmail, type Pruefstand } from "./hilfe.js";

/**
 * Nutzer loeschen, seit dem 20.10.2026.
 *
 * Die Kernzusage: **was ein Betreuer am Exponat gepflegt hat, bleibt.** Seit dem 02.11.2026
 * pflegt er Dokumente, Links und Ansprechpartner selbst; sie gehoeren dem Exponat, nicht ihm.
 */

const ADMIN = { ADMIN_EMAIL: "admin@idta-passport.de", ADMIN_PASSWORT: "startpasswort-123" };

let stand: Pruefstand | null = null;
afterEach(async () => {
  await stand?.ende();
  stand = null;
});

async function aufbau() {
  stand = await starte(ADMIN);
  const s = stand;
  const admin = await melde(s, "admin@idta-passport.de", "startpasswort-123");
  const ruf = async <T>(keks: string, opt: InjectOptions, status: number): Promise<T> => {
    const antwort = await s.app.inject({ ...opt, headers: { cookie: keks } });
    expect(antwort.statusCode, `${String(opt.method)} ${String(opt.url)}: ${antwort.body}`).toBe(
      status,
    );
    return (antwort.body === "" ? undefined : antwort.json()) as T;
  };

  const exponat = await ruf<{ id: string }>(
    admin,
    { method: "POST", url: "/api/exponate", payload: { name: "Ventil" } },
    201,
  );
  const neu = async (name: string, rolle: string) =>
    ruf<{ id: string; email: string; startpasswort: string }>(
      admin,
      {
        method: "POST",
        url: "/api/nutzer",
        payload: { name, email: `${name}@idta-passport.de`, rolle, exponate: [exponat.id] },
      },
      201,
    );
  return { s, admin, ruf, exponat, neu };
}

describe("Nutzer loeschen", () => {
  it("entfernt einen Betreuer, laesst aber stehen, was er gepflegt hat", async () => {
    const { s, admin, ruf, exponat, neu } = await aufbau();
    const betreuer = await neu("betreuer", "betreuer");
    const bk = await melde(s, betreuer.email, betreuer.startpasswort);

    // Der Betreuer legt am eigenen Exponat einen Link an.
    await ruf(
      bk,
      {
        method: "POST",
        url: `/api/exponate/${exponat.id}/links`,
        payload: { url: "https://industrialdigitaltwin.org/loeschen", titel: "Bleibt" },
      },
      201,
    );
    await ruf(
      admin,
      {
        method: "POST",
        url: "/api/besucher",
        payload: { guid: "LOE-1", vorname: "G", nachname: "H", email: testEmail() },
      },
      201,
    );
    await ruf(admin, { method: "PUT", url: `/api/besucher/LOE-1/besuche/${exponat.id}` }, 200);

    await ruf(admin, { method: "DELETE", url: `/api/nutzer/${betreuer.id}` }, 204);

    // Weg aus der Liste, seine Exponat-Zuweisung per Kaskade auch.
    const liste = await ruf<{ id: string }[]>(admin, { method: "GET", url: "/api/nutzer" }, 200);
    expect(liste.map((n) => n.id)).not.toContain(betreuer.id);
    expect(s.ctx.db.select().from(exponatBetreuer).all()).toEqual([]);

    // Besuch und Link stehen noch, der Besucher bekommt den Link im Konnektor weiter.
    expect(s.ctx.db.select().from(besuche).all()).toHaveLength(1);
    const werte = (
      await s.app.inject({ method: "POST", url: "/connector/product/LOE-1/values", payload: {} })
    ).json<{ value: string }[]>();
    expect(werte.map((w) => w.value)).toContain("https://industrialdigitaltwin.org/loeschen");

    // Seine Sitzung endet bei der naechsten Anfrage.
    await ruf(bk, { method: "GET", url: "/api/auth/ich" }, 401);
  });

  it("verbietet, sich selbst zu loeschen", async () => {
    const { admin, ruf } = await aufbau();
    const ich = await ruf<{ id: string }>(admin, { method: "GET", url: "/api/auth/ich" }, 200);
    await ruf(admin, { method: "DELETE", url: `/api/nutzer/${ich.id}` }, 409);
    await ruf(admin, { method: "GET", url: "/api/auth/ich" }, 200);
  });

  it("laesst einen Admin einen anderen Admin loeschen", async () => {
    const { s, admin, ruf, neu } = await aufbau();
    const zweiter = await neu("zweiter", "admin");
    await ruf(admin, { method: "DELETE", url: `/api/nutzer/${zweiter.id}` }, 204);
    await expect(melde(s, zweiter.email, zweiter.startpasswort)).rejects.toThrow();
  });

  it("antwortet 404 fuer Unbekannte und 403 fuer Betreuer", async () => {
    const { s, admin, ruf, neu } = await aufbau();
    await ruf(admin, { method: "DELETE", url: "/api/nutzer/gibt-es-nicht" }, 404);

    const betreuer = await neu("betreuer", "betreuer");
    const anderer = await neu("anderer", "betreuer");
    const bk = await melde(s, betreuer.email, betreuer.startpasswort);
    await ruf(bk, { method: "DELETE", url: `/api/nutzer/${anderer.id}` }, 403);
    const liste = await ruf<{ id: string }[]>(admin, { method: "GET", url: "/api/nutzer" }, 200);
    expect(liste.map((n) => n.id)).toContain(anderer.id);
  });
});
