import { afterEach, describe, expect, it } from "vitest";
import { legeDokumentAn, melde, multipart, starte, type Pruefstand } from "./hilfe.js";

/**
 * Der Betreuer pflegt die Inhalte seines Exponats, seit dem 02.11.2026: Dokumente, Links und
 * Ansprechpartner anlegen, aendern, loeschen. Am fremden Exponat bekommt er 404, das Exponat
 * selbst (Name, Loeschen) bleibt beim Admin. Die Grenzen 10/10/5 gelten weiter.
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
  const exponat = async (name: string) =>
    (
      await s.app.inject({
        method: "POST",
        url: "/api/exponate",
        headers: { cookie: admin },
        payload: { name },
      })
    ).json<{ id: string; kennung: string }>().id;
  const eigen = await exponat("Eigen");
  const fremd = await exponat("Fremd");
  const betreuer = (
    await s.app.inject({
      method: "POST",
      url: "/api/nutzer",
      headers: { cookie: admin },
      payload: { name: "Kai", email: "kai@idta-passport.de", rolle: "betreuer", exponate: [eigen] },
    })
  ).json<{ email: string; startpasswort: string }>();
  const keks = await melde(s, betreuer.email, betreuer.startpasswort);
  const ruf = (method: "POST" | "PATCH" | "DELETE" | "GET", url: string, payload?: object) =>
    s.app.inject({ method, url, headers: { cookie: keks }, payload });
  return { s, admin, keks, ruf, eigen, fremd };
}

describe("Betreuer pflegt sein Exponat", () => {
  it("legt Dokument, Link und Ansprechpartner an und aendert sie", async () => {
    const { s, keks, ruf, eigen } = await aufbau();

    const dok = await legeDokumentAn(s, keks, eigen, "Datenblatt");
    expect(dok.statusCode).toBe(201);
    const { id: dokId, dateiId: alteDatei } = dok.json<{ id: string; dateiId: string }>();

    // Titel aendern und Datei ersetzen in einem Aufruf.
    const { payload, headers } = multipart(
      { titel: "Datenblatt neu", beschreibung: "Stand 11/2026" },
      { name: "neu.pdf", inhalt: Buffer.from("%PDF-1.4 neu\n") },
    );
    const geaendert = await s.app.inject({
      method: "PATCH",
      url: `/api/exponate/${eigen}/dokumente/${dokId}`,
      headers: { ...headers, cookie: keks },
      payload,
    });
    expect(geaendert.statusCode).toBe(200);
    const d = geaendert.json<{
      titel: string;
      beschreibung: string;
      platz: number;
      dateiId: string;
    }>();
    expect(d).toMatchObject({ titel: "Datenblatt neu", beschreibung: "Stand 11/2026", platz: 1 });
    expect(d.dateiId).not.toBe(alteDatei);
    // Die alte Datei ist fort, nicht verwaist.
    expect(
      s.ctx.sqlite.prepare("select count(*) as n from dateien where id = ?").get(alteDatei),
    ).toEqual({ n: 0 });

    const link = (
      await ruf("POST", `/api/exponate/${eigen}/links`, { url: "https://a.example/", titel: "A" })
    ).json<{ id: string }>();
    const linkNeu = await ruf("PATCH", `/api/exponate/${eigen}/links/${link.id}`, { titel: "B" });
    expect(linkNeu.json()).toMatchObject({ titel: "B", url: "https://a.example/", platz: 1 });

    const kontakt = await ruf("POST", `/api/exponate/${eigen}/kontakte`, {
      vorname: "Dirk",
      nachname: "Jansen",
    });
    expect(kontakt.statusCode).toBe(201);
    const k = kontakt.json<{ id: string; platz: number }>();
    expect(k.platz).toBe(1);
    const kNeu = await ruf("PATCH", `/api/exponate/${eigen}/kontakte/${k.id}`, {
      email: "dirk@example.invalid",
    });
    expect(kNeu.json()).toMatchObject({ vorname: "Dirk", email: "dirk@example.invalid", platz: 1 });

    for (const [art, id] of [
      ["dokument", dokId],
      ["link", link.id],
      ["kontakt", k.id],
    ] as const) {
      expect(
        (await ruf("DELETE", `/api/exponate/${eigen}/inhalte/${art}/${id}`)).statusCode,
        art,
      ).toBe(204);
    }
    const detail = (await ruf("GET", `/api/exponate/${eigen}`)).json<Record<string, unknown[]>>();
    expect([detail["dokumente"], detail["links"], detail["kontakte"]]).toEqual([[], [], []]);
  });

  it("kommt an ein fremdes Exponat nicht heran, auch nicht ueber eine fremde Id", async () => {
    const { s, admin, keks, ruf, eigen, fremd } = await aufbau();
    expect((await legeDokumentAn(s, keks, fremd)).statusCode).toBe(404);
    expect(
      (await ruf("POST", `/api/exponate/${fremd}/links`, { url: "https://a.example/", titel: "A" }))
        .statusCode,
    ).toBe(404);
    expect(
      (await ruf("POST", `/api/exponate/${fremd}/kontakte`, { vorname: "A", nachname: "B" }))
        .statusCode,
    ).toBe(404);

    // Ein Link des fremden Exponats, angesprochen ueber das eigene: ebenfalls 404.
    const fremderLink = (
      await s.app.inject({
        method: "POST",
        url: `/api/exponate/${fremd}/links`,
        headers: { cookie: admin },
        payload: { url: "https://fremd.example/", titel: "Fremd" },
      })
    ).json<{ id: string }>();
    expect(
      (await ruf("PATCH", `/api/exponate/${eigen}/links/${fremderLink.id}`, { titel: "X" }))
        .statusCode,
    ).toBe(404);
    expect(
      (await ruf("DELETE", `/api/exponate/${eigen}/inhalte/link/${fremderLink.id}`)).statusCode,
    ).toBe(404);
    const unveraendert = (
      await s.app.inject({ url: `/api/exponate/${fremd}`, headers: { cookie: admin } })
    ).json<{ links: { titel: string }[] }>();
    expect(unveraendert.links.map((l) => l.titel)).toEqual(["Fremd"]);
  });

  it("darf das Exponat selbst weder umbenennen noch loeschen", async () => {
    const { ruf, eigen } = await aufbau();
    expect((await ruf("PATCH", `/api/exponate/${eigen}`, { name: "Neu" })).statusCode).toBe(403);
    expect((await ruf("DELETE", `/api/exponate/${eigen}`)).statusCode).toBe(403);
  });

  it("haelt die Grenzen: 10 Links, 5 Ansprechpartner", async () => {
    const { ruf, eigen } = await aufbau();
    for (let i = 1; i <= 10; i++) {
      expect(
        (
          await ruf("POST", `/api/exponate/${eigen}/links`, {
            url: "https://a.example/",
            titel: `L${String(i)}`,
          })
        ).statusCode,
      ).toBe(201);
    }
    const elfter = await ruf("POST", `/api/exponate/${eigen}/links`, {
      url: "https://a.example/",
      titel: "zu viel",
    });
    expect(elfter.statusCode).toBe(409);

    for (let i = 1; i <= 5; i++) {
      expect(
        (
          await ruf("POST", `/api/exponate/${eigen}/kontakte`, {
            vorname: "A",
            nachname: String(i),
          })
        ).statusCode,
      ).toBe(201);
    }
    const sechster = await ruf("POST", `/api/exponate/${eigen}/kontakte`, {
      vorname: "A",
      nachname: "zu viel",
    });
    expect(sechster.statusCode).toBe(409);
    expect(sechster.json<{ code: string }>().code).toBe("kontingent-erschoepft");
  });

  it("legt bei vollen Dokumentplaetzen keine Datei ab", async () => {
    const { s, keks, eigen } = await aufbau();
    for (let i = 1; i <= 10; i++) await legeDokumentAn(s, keks, eigen, `D${String(i)}`);
    const dateien = () => s.ctx.sqlite.prepare("select count(*) as n from dateien").get();
    const vorher = dateien();
    expect((await legeDokumentAn(s, keks, eigen, "zu viel")).statusCode).toBe(409);
    expect(dateien()).toEqual(vorher);
  });

  it("nimmt nur http- und https-Links an", async () => {
    const { ruf, eigen } = await aufbau();
    for (const url of ["javascript:alert(1)", "ftp://a.example/", "keine adresse"]) {
      const antwort = await ruf("POST", `/api/exponate/${eigen}/links`, { url, titel: "X" });
      expect(antwort.statusCode, url).toBe(400);
    }
  });
});
