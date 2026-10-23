import { afterEach, describe, expect, it } from "vitest";
import { DATENSCHUTZ_FASSUNG } from "../src/services/datenschutz.js";
import { melde, starte, testEmail, type Pruefstand } from "./hilfe.js";

/**
 * Das Tablet am Stand: Besucher registrieren sich dort selbst, seit dem 23.10.2026.
 *
 * **Der Kern dieser Pruefungen ist nicht, was die Rolle kann, sondern was sie nicht kann.**
 * Das Geraet steht unbeaufsichtigt im Publikum; jede Route, die es zusaetzlich erreicht,
 * ist eine Route zu viel. Es legt Besucher an, liest aber keine.
 */

const ADMIN = { ADMIN_EMAIL: "admin@idta-passport.de", ADMIN_PASSWORT: "startpasswort-123" };

let stand: Pruefstand | null = null;
afterEach(async () => {
  await stand?.ende();
  stand = null;
});

interface Konten {
  s: Pruefstand;
  admin: string;
  kiosk: string;
  betreuer: string;
}

async function konten(): Promise<Konten> {
  stand = await starte(ADMIN);
  const s = stand;
  const admin = await melde(s, "admin@idta-passport.de", "startpasswort-123");

  async function lege(rolle: string, email: string): Promise<string> {
    const angelegt = await s.app.inject({
      method: "POST",
      url: "/api/nutzer",
      headers: { cookie: admin },
      payload: { name: `Probe ${rolle}`, email, rolle },
    });
    expect(angelegt.statusCode, `${rolle} liess sich nicht anlegen`).toBe(201);
    const { startpasswort } = angelegt.json<{ startpasswort: string }>();
    return melde(s, email, startpasswort);
  }

  return {
    s,
    admin,
    kiosk: await lege("kiosk", "tablet@idta-passport.de"),
    betreuer: await lege("betreuer", "betreuer-kiosk@idta-passport.de"),
  };
}

/** Die Galerie ueber die Schnittstelle, statt feste Ids anzunehmen. */
async function galerie(s: Pruefstand, keks: string): Promise<string[]> {
  const antwort = await s.app.inject({ url: "/api/kiosk/avatare", headers: { cookie: keks } });
  return antwort.json<{ avatare: string[] }>().avatare;
}

/** Ein Besucher, den das Personal angelegt hat; sein Pass ist damit schon registriert. */
async function legeBesucher(s: Pruefstand, keks: string, guid: string): Promise<string> {
  const email = testEmail();
  await s.app.inject({
    method: "POST",
    url: "/api/besucher",
    headers: { cookie: keks },
    payload: { guid, vorname: "Schon", nachname: "Da", firma: "Alt GmbH", email },
  });
  return email;
}

/** Ein vollstaendiger, gueltiger Rumpf; jeder Fall veraendert genau eine Stelle davon. */
function rumpf(guid: string, aenderung: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    guid,
    vorname: "Rita",
    nachname: "Registriert",
    firma: "Neu GmbH",
    email: `${guid.toLowerCase()}@example.invalid`,
    passwort: "geheim-123",
    avatarDateiId: null,
    einwilligung: { erteilt: true, fassung: DATENSCHUTZ_FASSUNG },
    ...aenderung,
  };
}

async function registriere(s: Pruefstand, keks: string, payload: Record<string, unknown>) {
  return s.app.inject({
    method: "POST",
    url: "/api/kiosk/registrierung",
    headers: { cookie: keks },
    payload,
  });
}

async function pass(s: Pruefstand, keks: string, guid: string) {
  return (await s.app.inject({ url: `/api/kiosk/pass/${guid}`, headers: { cookie: keks } })).json();
}

describe("Kiosk: was die Rolle nicht darf", () => {
  /**
   * **Jede Route einzeln.** Eine Stichprobe belegt die anderen nicht, und genau hier faellt
   * eine kuenftige Route auf, die aus Versehen nur `verlangeAnmeldung` traegt.
   */
  it("kommt an keine Verwaltungsroute", async () => {
    const { s, kiosk } = await konten();
    const keks = { cookie: kiosk };

    const versuche = [
      { was: "Besucherliste", lauf: () => s.app.inject({ url: "/api/besucher", headers: keks }) },
      { was: "Nutzerliste", lauf: () => s.app.inject({ url: "/api/nutzer", headers: keks }) },
      { was: "Dashboard", lauf: () => s.app.inject({ url: "/api/dashboard", headers: keks }) },
      { was: "Monitoring", lauf: () => s.app.inject({ url: "/api/monitoring", headers: keks }) },
      {
        was: "Exponat anlegen",
        lauf: () =>
          s.app.inject({
            method: "POST" as const,
            url: "/api/exponate",
            headers: keks,
            payload: { name: "Verboten" },
          }),
      },
      {
        was: "Datei hochladen",
        lauf: () =>
          s.app.inject({
            method: "POST" as const,
            url: "/api/dateien",
            headers: keks,
            payload: {},
          }),
      },
      {
        was: "Besucher anlegen",
        lauf: () =>
          s.app.inject({
            method: "POST" as const,
            url: "/api/besucher",
            headers: keks,
            payload: { guid: "SCHLEICH-1", vorname: "A", nachname: "B", email: testEmail() },
          }),
      },
    ];

    for (const v of versuche) {
      expect((await v.lauf()).statusCode, `${v.was} war erreichbar`).toBe(403);
    }
  });

  /** Die Rolle ist **eng**, nicht nur anders: auch ein Betreuer bleibt draussen. */
  it("laesst Betreuer, Besucher und Unangemeldete nicht an die Kiosk-Routen", async () => {
    const { s, admin, betreuer } = await konten();
    const email = await legeBesucher(s, admin, "KIOSK-0001");
    const besucher = await melde(s, email, "password");

    const wer: [string, Record<string, string>, number][] = [
      ["Betreuer", { cookie: betreuer }, 403],
      ["Besucher", { cookie: besucher }, 401],
      ["niemand", {}, 401],
    ];
    for (const [name, kopf, erwartet] of wer) {
      for (const url of [
        "/api/kiosk/pass/KIOSK-0001",
        "/api/kiosk/avatare",
        "/api/kiosk/datenschutz",
      ]) {
        const antwort = await s.app.inject({ url, headers: kopf });
        expect(antwort.statusCode, `${name} ${url}`).toBe(erwartet);
      }
      const reg = await s.app.inject({
        method: "POST",
        url: "/api/kiosk/registrierung",
        headers: kopf,
        payload: rumpf("KIOSK-FREMD"),
      });
      expect(reg.statusCode, `${name} registriert`).toBe(erwartet);
    }
  });

  /** Das Tablet liest keine Besucherdaten mehr; die alten Lese- und Aenderungswege sind weg. */
  it("kommt an keine Besucherdaten", async () => {
    const { s, admin, kiosk } = await konten();
    await legeBesucher(s, admin, "KIOSK-0002");

    const lesen = await s.app.inject({
      url: "/api/kiosk/besucher/KIOSK-0002",
      headers: { cookie: kiosk },
    });
    expect(lesen.statusCode).toBe(404);
    const aendern = await s.app.inject({
      method: "PATCH",
      url: "/api/kiosk/besucher/KIOSK-0002",
      headers: { cookie: kiosk },
      payload: { firma: "X" },
    });
    expect(aendern.statusCode).toBe(404);
    const verwaltung = await s.app.inject({
      url: "/api/besucher/KIOSK-0002",
      headers: { cookie: kiosk },
    });
    expect(verwaltung.statusCode).toBe(403);

    // Zu einer GUID erfaehrt das Tablet nur den Status, sonst nichts.
    expect(await pass(s, kiosk, "KIOSK-0002")).toEqual({ status: "registriert" });
  });
});

describe("Kiosk: Registrierung", () => {
  it("legt den Besucher an, mit eigenem Passwort und Einwilligung", async () => {
    const { s, admin, kiosk } = await konten();
    expect(await pass(s, kiosk, "SPS2026-0042")).toEqual({ status: "frei" });

    const bild = (await galerie(s, kiosk))[0];
    const antwort = await registriere(s, kiosk, rumpf("SPS2026-0042", { avatarDateiId: bild }));
    expect(antwort.statusCode).toBe(201);
    expect(antwort.json()).toEqual({ registriert: true });

    const b = (
      await s.app.inject({ url: "/api/besucher/SPS2026-0042", headers: { cookie: admin } })
    ).json<Record<string, unknown>>();
    expect(b).toMatchObject({
      vorname: "Rita",
      firma: "Neu GmbH",
      avatarDateiId: bild,
      einwilligungFassung: DATENSCHUTZ_FASSUNG,
    });
    expect(typeof b["einwilligungAm"]).toBe("number");
    expect(await pass(s, kiosk, "SPS2026-0042")).toEqual({ status: "registriert" });

    // Das eigene Passwort gilt, das Standardpasswort nicht.
    await expect(melde(s, "sps2026-0042@example.invalid", "geheim-123")).resolves.toBeTruthy();
    await expect(melde(s, "sps2026-0042@example.invalid", "password")).rejects.toThrow();
  });

  it("ueberschreibt einen schon registrierten Pass nicht", async () => {
    const { s, admin, kiosk } = await konten();
    await legeBesucher(s, admin, "KIOSK-0003");

    const antwort = await registriere(s, kiosk, rumpf("KIOSK-0003"));
    expect(antwort.statusCode).toBe(409);
    expect(antwort.json<{ code: string }>().code).toBe("bereits-registriert");

    const b = (
      await s.app.inject({ url: "/api/besucher/KIOSK-0003", headers: { cookie: admin } })
    ).json<{ vorname: string; firma: string }>();
    expect(b).toMatchObject({ vorname: "Schon", firma: "Alt GmbH" });
  });

  /**
   * **Jeder abgelehnte Fall hinterlaesst nichts.** Geprueft wird danach, dass der Pass weiter
   * frei ist; sonst koennte ein halber Datensatz die echte Registrierung blockieren.
   */
  it("lehnt Unvollstaendiges ab und legt dabei nichts an", async () => {
    const { s, admin, kiosk } = await konten();
    const vergeben = await legeBesucher(s, admin, "KIOSK-0004");

    const faelle: [string, Record<string, unknown>, number, string][] = [
      ["ohne Einwilligung", { einwilligung: undefined }, 400, "einwilligung-fehlt"],
      [
        "Einwilligung nicht erteilt",
        { einwilligung: { erteilt: false, fassung: DATENSCHUTZ_FASSUNG } },
        400,
        "einwilligung-fehlt",
      ],
      [
        "alte Fassung",
        { einwilligung: { erteilt: true, fassung: "1999-01-01" } },
        409,
        "datenschutz-veraltet",
      ],
      ["Passwort zu kurz", { passwort: "kurz" }, 400, "passwort-zu-kurz"],
      ["ohne E-Mail", { email: undefined }, 400, "pflicht-fehlt"],
      ["E-Mail vergeben", { email: vergeben.toUpperCase() }, 409, "email-vergeben"],
      ["ohne Nachname", { nachname: undefined }, 400, "pflicht-fehlt"],
      ["fremde Datei als Bild", { avatarDateiId: "gibt-es-nicht" }, 400, "avatar-unbekannt"],
    ];
    for (const [was, aenderung, status, code] of faelle) {
      const antwort = await registriere(s, kiosk, rumpf("KIOSK-NEU", aenderung));
      expect(antwort.statusCode, was).toBe(status);
      expect(antwort.json<{ code: string }>().code, was).toBe(code);
      expect(await pass(s, kiosk, "KIOSK-NEU"), `${was}: Pass nicht mehr frei`).toEqual({
        status: "frei",
      });
    }

    const ungueltig = await registriere(s, kiosk, rumpf("mit leerzeichen"));
    expect(ungueltig.json<{ code: string }>().code).toBe("guid-ungueltig");
  });

  it("liefert den Datenschutzhinweis mit Fassung und Einwilligungssatz", async () => {
    const { s, kiosk } = await konten();
    const d = (
      await s.app.inject({ url: "/api/kiosk/datenschutz", headers: { cookie: kiosk } })
    ).json<{ fassung: string; abschnitte: { titel: string }[]; einwilligungstext: string }>();
    expect(d.fassung).toBe(DATENSCHUTZ_FASSUNG);
    expect(d.einwilligungstext).toMatch(/widerrufen/);
    // Die Pflichtangaben nach Art. 13 DSGVO, je als eigener Abschnitt.
    expect(d.abschnitte.map((a) => a.titel)).toEqual(
      expect.arrayContaining([
        "Verantwortlicher",
        "Welche Daten wir verarbeiten",
        "Wofür",
        "Rechtsgrundlage",
        "Wer deine Daten sieht",
        "Wie lange",
        "Deine Rechte",
      ]),
    );
  });

  it.todo("Datenschutzhinweis ohne Platzhalter (wartet auf die Angaben der IDTA)");
});
