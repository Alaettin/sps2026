import { afterEach, describe, expect, it } from "vitest";
import { nimmKontaktAuf } from "../src/services/besucherkontakte.js";
import { setzeViewerBasisUrl } from "../src/services/einstellungen.js";
import { alsBesucher, melde, starte, testEmail, type Pruefstand } from "./hilfe.js";

/**
 * Die gescannten Kontakte eines Besuchers im Konnektor, seit dem 04.11.2026: je Platz
 * `Visitor_ContactNN_Name` (Vorname Nachname) und `Visitor_ContactNN_ViewerUrl`, hoechstens 50.
 */

const ADMIN = { ADMIN_EMAIL: "admin@idta-passport.de", ADMIN_PASSWORT: "startpasswort-123" };
const VIEWER = "https://viewer.example/";

let stand: Pruefstand | null = null;
afterEach(async () => {
  await stand?.ende();
  stand = null;
});

async function aufbau() {
  stand = await starte({ ...ADMIN, VIEWER_BASE_URL: VIEWER });
  const s = stand;
  const admin = await melde(s, ADMIN.ADMIN_EMAIL, ADMIN.ADMIN_PASSWORT);
  return { s, admin };
}

/** Legt einen Besucher an, ohne ihn anzumelden. */
async function legeAn(s: Pruefstand, admin: string, vorname: string, nachname: string) {
  const antwort = await s.app.inject({
    method: "POST",
    url: "/api/besucher",
    headers: { cookie: admin },
    payload: { vorname, nachname, titel: "Dr.", email: testEmail() },
  });
  expect(antwort.statusCode).toBe(201);
  return antwort.json<{ guid: string }>().guid;
}

function nimmAuf(s: Pruefstand, keks: string, guid: string) {
  return s.app.inject({
    method: "POST",
    url: "/api/mein/kontakte",
    headers: { cookie: keks },
    payload: { guid },
  });
}

async function kontaktwerte(s: Pruefstand, guid: string) {
  const antwort = await s.app.inject({
    method: "POST",
    url: `/connector/product/${guid}/values`,
    payload: {},
  });
  expect(antwort.statusCode).toBe(200);
  return Object.fromEntries(
    antwort
      .json<{ propertyId: string; value: string }[]>()
      .filter((w) => w.propertyId.startsWith("Visitor_Contact"))
      .map((w) => [w.propertyId, w.value]),
  );
}

describe("Kontakte im Konnektor", () => {
  it("nennt alle 50 Plaetze im Modell", async () => {
    const { s } = await aufbau();
    const modell = (await s.app.inject({ method: "GET", url: "/connector/model" })).json<
      { id: string }[]
    >();
    const ids = modell.map((f) => f.id);
    expect(ids.filter((id) => id.startsWith("Visitor_Contact"))).toHaveLength(100);
    expect(ids).toContain("Visitor_Contact01_Name");
    expect(ids).toContain("Visitor_Contact50_ViewerUrl");
    expect(ids).not.toContain("Visitor_Contact51_Name");
  });

  it("liefert Name ohne Titel und Viewer-Link in der Folge der Aufnahme, Nachruecken beim Entfernen", async () => {
    const { s, admin } = await aufbau();
    const ich = await alsBesucher(s, admin);
    const a = await legeAn(s, admin, "Ada", "Lovelace");
    const b = await legeAn(s, admin, "Bert", "Brecht");

    expect(await kontaktwerte(s, ich.guid)).toEqual({});

    expect((await nimmAuf(s, ich.keks, a)).statusCode).toBe(200);
    expect((await nimmAuf(s, ich.keks, b)).statusCode).toBe(200);
    expect(await kontaktwerte(s, ich.guid)).toEqual({
      Visitor_Contact01_Name: "Ada Lovelace",
      Visitor_Contact01_ViewerUrl: `${VIEWER}${a}`,
      Visitor_Contact02_Name: "Bert Brecht",
      Visitor_Contact02_ViewerUrl: `${VIEWER}${b}`,
    });

    await s.app.inject({
      method: "DELETE",
      url: `/api/mein/kontakte/${a}`,
      headers: { cookie: ich.keks },
    });
    expect(await kontaktwerte(s, ich.guid)).toEqual({
      Visitor_Contact01_Name: "Bert Brecht",
      Visitor_Contact01_ViewerUrl: `${VIEWER}${b}`,
    });

    // Die Viewer-Adresse aus den Einstellungen geht vor der Umgebung.
    setzeViewerBasisUrl(s.ctx.db, "https://anders.example/viewer");
    expect((await kontaktwerte(s, ich.guid))["Visitor_Contact01_ViewerUrl"]).toBe(
      `https://anders.example/viewer/${b}`,
    );
  });

  it("nimmt hoechstens 50 Kontakte auf, ein vorhandener geht weiter", async () => {
    const { s, admin } = await aufbau();
    const ich = await alsBesucher(s, admin);
    const guids: string[] = [];
    for (let i = 1; i <= 51; i++) guids.push(await legeAn(s, admin, `K${String(i)}`, "Test"));

    /*
     * Die ersten 49 ueber den Dienst: die Route ist auf 30 je Minute und Sitzung begrenzt, und
     * diese Grenze griffe sonst vor der hier gepruefte. Der 50. und der 51. gehen ueber die Route.
     */
    for (const g of guids.slice(0, 49)) nimmKontaktAuf(s.ctx.db, ich.guid, g);
    expect((await nimmAuf(s, ich.keks, guids[49] as string)).statusCode).toBe(200);
    const voll = await nimmAuf(s, ich.keks, guids[50] as string);
    expect(voll.statusCode).toBe(409);
    expect(voll.json()).toMatchObject({ code: "kontakte-voll" });

    const nochmal = await nimmAuf(s, ich.keks, guids[0] as string);
    expect(nochmal.statusCode).toBe(200);
    expect(nochmal.json()).toMatchObject({ neu: false });

    const werte = await kontaktwerte(s, ich.guid);
    expect(Object.keys(werte)).toHaveLength(100);
    expect(werte["Visitor_Contact50_Name"]).toBe("K50 Test");
  });
});
