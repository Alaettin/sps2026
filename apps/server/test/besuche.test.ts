import { afterEach, describe, expect, it } from "vitest";
import {
  alsBesucher,
  legeDokumentAn,
  melde,
  nimmAuf,
  scanCode,
  starte,
  type Pruefstand,
} from "./hilfe.js";

/**
 * Der Besucher nimmt ein Exponat auf, seit dem 02.11.2026.
 *
 * Er scannt den QR-Code am Exponat; darin steht ein zufaelliger Code. Aufgenommen wird das
 * **ganze Exponat, live**: der Konnektor liefert immer, was es gerade hat.
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
  const exponat = async (name: string) =>
    (
      await s.app.inject({
        method: "POST",
        url: "/api/exponate",
        headers: { cookie: keks },
        payload: { name },
      })
    ).json<{ id: string; kennung: string }>();
  return { s, keks, exponat };
}

async function werte(s: Pruefstand, guid: string) {
  return (
    await s.app.inject({ method: "POST", url: `/connector/product/${guid}/values`, payload: {} })
  ).json<{ propertyId: string; value: string }[]>();
}

describe("Exponat aufnehmen", () => {
  it("nimmt per Code auf und ist idempotent", async () => {
    const { s, keks, exponat } = await aufbau();
    const e = await exponat("Pumpe");
    const besucher = await alsBesucher(s, keks);

    const erst = await nimmAuf(s, besucher.keks, scanCode(s, e.id));
    expect(erst.statusCode).toBe(200);
    expect(erst.json()).toEqual({ kennung: e.kennung, name: "Pumpe", neu: true });

    // Ein zweiter Scan, etwa nach einem Netzfehler: kein Fehler, nichts doppelt.
    const nochmal = await nimmAuf(s, besucher.keks, scanCode(s, e.id));
    expect(nochmal.statusCode).toBe(200);
    expect(nochmal.json<{ neu: boolean }>().neu).toBe(false);
    expect(s.ctx.sqlite.prepare("select count(*) as n from besuche").get()).toEqual({ n: 1 });
  });

  it("weist einen unbekannten Code und die Kennung ab", async () => {
    const { s, keks, exponat } = await aufbau();
    const e = await exponat("Pumpe");
    const besucher = await alsBesucher(s, keks);

    for (const code of ["gibt-es-nicht", e.kennung, e.id, ""]) {
      const antwort = await nimmAuf(s, besucher.keks, code);
      expect(antwort.statusCode, code).toBeGreaterThanOrEqual(400);
      expect(antwort.statusCode, code).toBeLessThan(500);
    }
    expect(s.ctx.sqlite.prepare("select count(*) as n from besuche").get()).toEqual({ n: 0 });
  });

  it("vergibt je Exponat einen eigenen, nicht erratbaren Code", async () => {
    const { s, exponat } = await aufbau();
    const a = scanCode(s, (await exponat("A")).id);
    const b = scanCode(s, (await exponat("B")).id);
    expect(a).not.toBe(b);
    expect(a.length).toBeGreaterThanOrEqual(20);
  });

  /** Die GUID kommt aus der Sitzung; ein mitgeschickter Pass eines anderen zaehlt nicht. */
  it("nimmt fuer den angemeldeten Besucher auf, nie fuer eine GUID aus dem Rumpf", async () => {
    const { s, keks, exponat } = await aufbau();
    const e = await exponat("Pumpe");
    const anna = await alsBesucher(s, keks);
    const bernd = await alsBesucher(s, keks);

    await s.app.inject({
      method: "POST",
      url: "/api/mein/besuche",
      headers: { cookie: anna.keks },
      payload: { code: scanCode(s, e.id), guid: bernd.guid },
    });
    const zeilen = s.ctx.sqlite.prepare("select besucher_guid as guid from besuche").all();
    expect(zeilen).toEqual([{ guid: anna.guid }]);
  });

  it("ist nur fuer Besucher, nicht fuer Personal oder ohne Anmeldung", async () => {
    const { s, keks, exponat } = await aufbau();
    const code = scanCode(s, (await exponat("Pumpe")).id);

    expect((await nimmAuf(s, keks, code)).statusCode).toBe(401);
    expect(
      (await s.app.inject({ method: "POST", url: "/api/mein/besuche", payload: { code } }))
        .statusCode,
    ).toBe(401);
  });

  /** Der Code steht nur beim Admin; die Liste und ein Betreuer sehen ihn nicht. */
  it("zeigt den Code nur dem Admin", async () => {
    const { s, keks, exponat } = await aufbau();
    const e = await exponat("Pumpe");
    const code = scanCode(s, e.id);

    const detail = (
      await s.app.inject({ url: `/api/exponate/${e.id}`, headers: { cookie: keks } })
    ).json<{ scanCode?: string }>();
    expect(detail.scanCode).toBe(code);

    const liste = (await s.app.inject({ url: "/api/exponate", headers: { cookie: keks } })).body;
    expect(liste).not.toContain(code);

    const betreuer = (
      await s.app.inject({
        method: "POST",
        url: "/api/nutzer",
        headers: { cookie: keks },
        payload: {
          name: "Kai",
          email: "kai@idta-passport.de",
          rolle: "betreuer",
          exponate: [e.id],
        },
      })
    ).json<{ email: string; startpasswort: string }>();
    const bk = await melde(s, betreuer.email, betreuer.startpasswort);
    const sicht = await s.app.inject({ url: `/api/exponate/${e.id}`, headers: { cookie: bk } });
    expect(sicht.statusCode).toBe(200);
    expect(sicht.body).not.toContain(code);
  });
});

describe("Konnektor liefert live", () => {
  it("liefert, was das Exponat jetzt hat, auch nach dem Scan Ergaenztes", async () => {
    const { s, keks, exponat } = await aufbau();
    const e = await exponat("Pumpe");
    const besucher = await alsBesucher(s, keks);
    await nimmAuf(s, besucher.keks, scanCode(s, e.id));

    const vorher = (await werte(s, besucher.guid)).map((w) => w.propertyId);
    expect(vorher).toContain(`${e.kennung}_Name`);
    expect(vorher).not.toContain(`${e.kennung}_Doc01_Title`);

    // Nach dem Scan legt jemand ein Dokument, einen Link und einen Ansprechpartner an.
    const dok = (await legeDokumentAn(s, keks, e.id, "Neu")).json<{ id: string }>();
    await s.app.inject({
      method: "POST",
      url: `/api/exponate/${e.id}/links`,
      headers: { cookie: keks },
      payload: { url: "https://industrialdigitaltwin.org/", titel: "IDTA" },
    });
    await s.app.inject({
      method: "POST",
      url: `/api/exponate/${e.id}/kontakte`,
      headers: { cookie: keks },
      payload: { vorname: "Dirk", nachname: "Jansen", email: "dirk@example.invalid" },
    });

    const danach = await werte(s, besucher.guid);
    const ids = danach.map((w) => w.propertyId);
    expect(ids).toContain(`${e.kennung}_Doc01_Title`);
    expect(ids).toContain(`${e.kennung}_Link01_Url`);
    expect(danach.find((w) => w.propertyId === `${e.kennung}_Contact01_Email`)?.value).toBe(
      "dirk@example.invalid",
    );

    // Geloescht verschwindet es wieder.
    await s.app.inject({
      method: "DELETE",
      url: `/api/exponate/${e.id}/inhalte/dokument/${dok.id}`,
      headers: { cookie: keks },
    });
    expect((await werte(s, besucher.guid)).map((w) => w.propertyId)).not.toContain(
      `${e.kennung}_Doc01_Title`,
    );
  });

  it("liefert nichts von Exponaten, die der Besucher nicht aufgenommen hat", async () => {
    const { s, keks, exponat } = await aufbau();
    const e = await exponat("Pumpe");
    await legeDokumentAn(s, keks, e.id);
    const besucher = await alsBesucher(s, keks);

    const ids = (await werte(s, besucher.guid)).map((w) => w.propertyId);
    expect(ids.some((id) => id.startsWith(`${e.kennung}_`))).toBe(false);
  });
});

describe("Besuche im Besucherdetail", () => {
  it("setzt und nimmt einen Besuch von Hand, nur als Admin", async () => {
    const { s, keks, exponat } = await aufbau();
    const e = await exponat("Pumpe");
    const besucher = await alsBesucher(s, keks);
    const besucht = async () =>
      (
        await s.app.inject({
          url: `/api/besucher/${besucher.guid}/exponate`,
          headers: { cookie: keks },
        })
      ).json<{ id: string; besucht: boolean }[]>()[0]?.besucht;

    expect(await besucht()).toBe(false);
    const setzen = await s.app.inject({
      method: "PUT",
      url: `/api/besucher/${besucher.guid}/besuche/${e.id}`,
      headers: { cookie: keks },
    });
    expect(setzen.json()).toEqual({ neu: true });
    expect(await besucht()).toBe(true);

    expect(
      (
        await s.app.inject({
          method: "DELETE",
          url: `/api/besucher/${besucher.guid}/besuche/${e.id}`,
          headers: { cookie: keks },
        })
      ).statusCode,
    ).toBe(204);
    expect(await besucht()).toBe(false);

    // Ein Besucher kommt an diese Route nicht.
    expect(
      (
        await s.app.inject({
          method: "PUT",
          url: `/api/besucher/${besucher.guid}/besuche/${e.id}`,
          headers: { cookie: besucher.keks },
        })
      ).statusCode,
    ).toBe(401);
  });
});
