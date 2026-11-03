import { afterEach, describe, expect, it } from "vitest";
import { melde, starte, type Pruefstand } from "./hilfe.js";

/**
 * Die Viewer-Adresse in den Einstellungen, seit dem 03.11.2026: der gesetzte Wert geht vor,
 * leer gesetzt gilt wieder `VIEWER_BASE_URL` aus der Umgebung.
 */

const ADMIN = {
  ADMIN_EMAIL: "admin@idta-passport.de",
  ADMIN_PASSWORT: "startpasswort-123",
  VIEWER_BASE_URL: "https://viewer.umgebung.example",
};

let stand: Pruefstand | null = null;
afterEach(async () => {
  await stand?.ende();
  stand = null;
});

async function aufbau() {
  stand = await starte(ADMIN);
  const s = stand;
  const keks = await melde(s, "admin@idta-passport.de", "startpasswort-123");
  const ich = async () =>
    (await s.app.inject({ url: "/api/auth/ich", headers: { cookie: keks } })).json<{
      viewerBaseUrl: string;
    }>().viewerBaseUrl;
  const setze = (url: unknown, cookie = keks) =>
    s.app.inject({
      method: "PATCH",
      url: "/api/einstellungen/viewer",
      headers: { cookie },
      payload: { url },
    });
  return { s, keks, ich, setze };
}

describe("Viewer-Adresse in den Einstellungen", () => {
  it("gilt vor der Umgebung, normalisiert, und leer setzt zurück", async () => {
    const { s, keks, ich, setze } = await aufbau();
    expect(await ich()).toBe("https://viewer.umgebung.example/");

    const gesetzt = await setze("  https://viewer.messe.example/pass//  ");
    expect(gesetzt.statusCode).toBe(200);
    expect(gesetzt.json()).toEqual({
      viewerBaseUrl: "https://viewer.messe.example/pass/",
      ausUmgebung: false,
    });
    expect(await ich()).toBe("https://viewer.messe.example/pass/");

    const info = (
      await s.app.inject({ url: "/api/konnektor/info", headers: { cookie: keks } })
    ).json<{ viewerBaseUrl: string; viewerAusUmgebung: boolean }>();
    expect(info.viewerBaseUrl).toBe("https://viewer.messe.example/pass/");
    expect(info.viewerAusUmgebung).toBe(false);

    const zurueck = await setze("");
    expect(zurueck.json()).toEqual({
      viewerBaseUrl: "https://viewer.umgebung.example/",
      ausUmgebung: true,
    });
    expect(await ich()).toBe("https://viewer.umgebung.example/");
  });

  it("lehnt alles ausser http und https ab und lässt den alten Wert stehen", async () => {
    const { ich, setze } = await aufbau();
    await setze("https://gilt.example/");
    for (const falsch of ["ftp://viewer.example/", "viewer.example", "javascript:alert(1)", 42]) {
      const antwort = await setze(falsch);
      expect(antwort.statusCode, String(falsch)).toBe(400);
      expect(antwort.json<{ code: string }>().code).toBe("url-ungueltig");
    }
    expect(await ich()).toBe("https://gilt.example/");
  });

  it("darf nur ein Admin", async () => {
    const { s, keks, setze } = await aufbau();
    expect((await setze("https://x.example/", "")).statusCode).toBe(401);

    const angelegt = (
      await s.app.inject({
        method: "POST",
        url: "/api/nutzer",
        headers: { cookie: keks },
        payload: { name: "Betty", email: "betty@example.invalid", rolle: "betreuer" },
      })
    ).json<{ startpasswort: string }>();
    const betreuer = await melde(s, "betty@example.invalid", angelegt.startpasswort);
    expect((await setze("https://x.example/", betreuer)).statusCode).toBe(403);
  });
});
