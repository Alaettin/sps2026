import { afterEach, describe, expect, it } from "vitest";
import { alsBesucher, melde, starte, type Pruefstand } from "./hilfe.js";

/**
 * Kontakte unter Besuchern, seit dem 03.11.2026: der Besucher scannt den Pass eines anderen.
 * **Nur registrierte Paesse** werden aufgenommen, und nur in die eigene Liste.
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
  const keks = await melde(s, "admin@idta-passport.de", "startpasswort-123");
  return { s, keks };
}

function nimmKontaktAuf(s: Pruefstand, keks: string, guid: unknown) {
  return s.app.inject({
    method: "POST",
    url: "/api/mein/kontakte",
    headers: { cookie: keks },
    payload: { guid },
  });
}

async function liste(s: Pruefstand, keks: string) {
  const antwort = await s.app.inject({
    method: "GET",
    url: "/api/mein/kontakte",
    headers: { cookie: keks },
  });
  expect(antwort.statusCode).toBe(200);
  return antwort.json<Record<string, unknown>[]>();
}

describe("Kontakte unter Besuchern", () => {
  it("nimmt einen registrierten Pass auf, idempotent, mit Name und Firma", async () => {
    const { s, keks } = await aufbau();
    const a = await alsBesucher(s, keks);
    const b = await alsBesucher(s, keks);
    await s.app.inject({
      method: "PATCH",
      url: `/api/besucher/${b.guid}`,
      headers: { cookie: keks },
      payload: { vorname: "Bert", nachname: "Bauer", firma: "Pumpen AG" },
    });

    const erst = await nimmKontaktAuf(s, a.keks, b.guid);
    expect(erst.statusCode).toBe(200);
    expect(erst.json()).toEqual({
      guid: b.guid,
      titel: null,
      vorname: "Bert",
      nachname: "Bauer",
      firma: "Pumpen AG",
      neu: true,
    });
    const nochmal = await nimmKontaktAuf(s, a.keks, b.guid);
    expect(nochmal.json<{ neu: boolean }>().neu).toBe(false);

    const meine = await liste(s, a.keks);
    expect(meine).toHaveLength(1);
    // Keine E-Mail, keine Anschrift: genau diese Felder sieht ein anderer Besucher.
    expect(Object.keys(meine[0] ?? {}).sort()).toEqual(
      ["firma", "guid", "nachname", "titel", "vorname", "zeitpunkt"].sort(),
    );
    // Einseitig: B hat A nicht in seiner Liste.
    expect(await liste(s, b.keks)).toEqual([]);
  });

  it("weist unregistrierte, ungueltige und den eigenen Pass ab", async () => {
    const { s, keks } = await aufbau();
    const a = await alsBesucher(s, keks);

    const unbekannt = await nimmKontaktAuf(s, a.keks, "SPS2026-9999");
    expect(unbekannt.statusCode).toBe(404);
    expect(unbekannt.json<{ code: string }>().code).toBe("pass-nicht-registriert");

    for (const falsch of ["", "a b", "x".repeat(51), 42]) {
      expect((await nimmKontaktAuf(s, a.keks, falsch)).statusCode, String(falsch)).toBe(400);
    }

    const selbst = await nimmKontaktAuf(s, a.keks, a.guid);
    expect(selbst.statusCode).toBe(400);
    expect(selbst.json<{ code: string }>().code).toBe("kontakt-selbst");

    expect(s.ctx.sqlite.prepare("select count(*) as n from besucher_kontakte").get()).toEqual({
      n: 0,
    });
  });

  it("entfernt nur aus der eigenen Liste", async () => {
    const { s, keks } = await aufbau();
    const a = await alsBesucher(s, keks);
    const b = await alsBesucher(s, keks);
    const c = await alsBesucher(s, keks);
    await nimmKontaktAuf(s, a.keks, c.guid);
    await nimmKontaktAuf(s, b.keks, c.guid);

    const weg = await s.app.inject({
      method: "DELETE",
      url: `/api/mein/kontakte/${c.guid}`,
      headers: { cookie: a.keks },
    });
    expect(weg.statusCode).toBe(204);
    expect(await liste(s, a.keks)).toEqual([]);
    expect(await liste(s, b.keks)).toHaveLength(1);
  });

  it("ein geloeschter Besucher verschwindet aus fremden Listen", async () => {
    const { s, keks } = await aufbau();
    const a = await alsBesucher(s, keks);
    const b = await alsBesucher(s, keks);
    await nimmKontaktAuf(s, a.keks, b.guid);

    const geloescht = await s.app.inject({
      method: "DELETE",
      url: `/api/besucher/${b.guid}`,
      headers: { cookie: keks },
    });
    expect(geloescht.statusCode).toBeLessThan(300);
    expect(await liste(s, a.keks)).toEqual([]);
    expect(s.ctx.sqlite.prepare("select count(*) as n from besucher_kontakte").get()).toEqual({
      n: 0,
    });
  });

  it("ist nur mit Besuchersitzung erreichbar", async () => {
    const { s, keks } = await aufbau();
    const b = await alsBesucher(s, keks);
    expect((await nimmKontaktAuf(s, keks, b.guid)).statusCode).toBe(401);
    expect(
      (await s.app.inject({ method: "GET", url: "/api/mein/kontakte", headers: { cookie: keks } }))
        .statusCode,
    ).toBe(401);
    expect((await s.app.inject({ method: "GET", url: "/api/mein/kontakte" })).statusCode).toBe(401);
  });

  it("begrenzt die Aufnahme je Sitzung, nicht je Netz", async () => {
    const { s, keks } = await aufbau();
    const a = await alsBesucher(s, keks);
    const b = await alsBesucher(s, keks);
    for (let i = 0; i < 30; i++) await nimmKontaktAuf(s, a.keks, `SPS-${String(i)}`);
    expect((await nimmKontaktAuf(s, a.keks, "SPS-x")).statusCode).toBe(429);
    // Ein zweiter Besucher aus demselben Netz ist nicht betroffen.
    expect((await nimmKontaktAuf(s, b.keks, a.guid)).statusCode).toBe(200);
  });
});
