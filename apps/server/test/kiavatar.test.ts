import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DATENSCHUTZ_FASSUNG } from "../src/services/datenschutz.js";
import { ENTWURF_LEBENSDAUER_MS, bauePrompt, pruefeMerkmale } from "../src/services/kiavatar.js";
import { alsBesucher, melde, multipart, starte, type Pruefstand } from "./hilfe.js";

/**
 * KI-Avatare am Terminal, seit dem 04.11.2026.
 *
 * OpenAI wird nicht gerufen: `fetch` ist ersetzt und liefert eine der mitgelieferten Vorlagen
 * als Bild. Geprueft wird, was hier entschieden ist: nur angeklickte Werte gehen in den Prompt,
 * erst Uebernommenes steht in der Galerie, und das Zuruecksetzen laesst die Galerie stehen.
 */

const ADMIN = { ADMIN_EMAIL: "admin@idta-passport.de", ADMIN_PASSWORT: "startpasswort-123" };
const MIT_KI = { ...ADMIN, OPENAI_API_KEY: "sk-test" };

const BILD = readFileSync(
  fileURLToPath(new URL("../assets/avatare/avatar-01.jpg", import.meta.url)),
);

let stand: Pruefstand | null = null;
afterEach(async () => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
  await stand?.ende();
  stand = null;
});

/** Ersetzt `fetch` und merkt sich, was an OpenAI ginge. */
function bilddienst(
  antwort: () => Response = () => Response.json({ data: [{ b64_json: BILD.toString("base64") }] }),
) {
  const aufrufe: { url: string; rumpf: Record<string, unknown> }[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn((url: string, init: RequestInit) => {
      aufrufe.push({ url, rumpf: JSON.parse(String(init.body)) as Record<string, unknown> });
      return Promise.resolve(antwort());
    }),
  );
  return aufrufe;
}

async function aufbau(env: Record<string, string> = MIT_KI) {
  stand = await starte(env);
  const s = stand;
  const admin = await melde(s, "admin@idta-passport.de", "startpasswort-123");
  const angelegt = await s.app.inject({
    method: "POST",
    url: "/api/nutzer",
    headers: { cookie: admin },
    payload: { name: "Tablet", email: "tablet-ki@idta-passport.de", rolle: "kiosk" },
  });
  const kiosk = await melde(
    s,
    "tablet-ki@idta-passport.de",
    angelegt.json<{ startpasswort: string }>().startpasswort,
  );
  return { s, admin, kiosk };
}

function erzeuge(s: Pruefstand, keks: string, merkmale: unknown = { geschlecht: "weiblich" }) {
  return s.app.inject({
    method: "POST",
    url: "/api/kiosk/avatare/ki",
    headers: { cookie: keks },
    payload: { merkmale },
  });
}

async function galerie(s: Pruefstand, admin: string) {
  return (await s.app.inject({ url: "/api/avatare", headers: { cookie: admin } })).json<{
    avatare: { dateiId: string; herkunft: string }[];
  }>().avatare;
}

function anzahl(s: Pruefstand, tabelle: string): number {
  return (s.ctx.sqlite.prepare(`select count(*) as n from ${tabelle}`).get() as { n: number }).n;
}

describe("Prompt", () => {
  it("entsteht nur aus angeklickten Werten", () => {
    const prompt = bauePrompt(
      pruefeMerkmale({ geschlecht: "weiblich", frisur: "glatze", haarfarbe: "rot", bart: "voll" }),
    );
    expect(prompt).toContain("woman");
    expect(prompt).toContain("completely bald");
    // Glatze ohne Haarfarbe, weiblich ohne Bart: die Oberflaeche blendet sie aus, der Server laesst sie weg.
    // Ganzes Wort: "red" steckt auch in "rendered".
    expect(prompt).not.toMatch(/\bred\b/);
    expect(prompt).not.toContain("beard");
  });

  it("weist Unbekanntes ab, auch eingeschmuggelten Text", () => {
    for (const roh of [
      { name: "Anna Ahrens" },
      { geschlecht: "Anna Ahrens, SPS2026-0001" },
      { geschlecht: 3 },
      "frau",
      null,
      [],
    ]) {
      expect(() => pruefeMerkmale(roh), JSON.stringify(roh)).toThrow();
    }
  });
});

describe("KI-Avatar am Terminal", () => {
  it("erzeugt einen Entwurf, der erst nach dem Uebernehmen in der Galerie steht", async () => {
    const { s, admin, kiosk } = await aufbau();
    const aufrufe = bilddienst();
    const vorher = (await galerie(s, admin)).length;

    const antwort = await erzeuge(s, kiosk, { geschlecht: "maennlich", bart: "voll" });
    expect(antwort.statusCode, antwort.body).toBe(201);
    const { dateiId } = antwort.json<{ dateiId: string }>();

    expect(aufrufe).toHaveLength(1);
    expect(aufrufe[0]?.url).toBe("https://api.openai.com/v1/images/generations");
    expect(aufrufe[0]?.rumpf["model"]).toBe("gpt-image-2");
    expect(aufrufe[0]?.rumpf["output_format"]).toBe("jpeg");
    expect(String(aufrufe[0]?.rumpf["prompt"])).toContain("a full beard");

    // Der Entwurf ist zu sehen, aber nicht waehlbar.
    expect(
      (await s.app.inject({ url: `/api/dateien/${dateiId}`, headers: { cookie: kiosk } }))
        .statusCode,
    ).toBe(200);
    expect(await galerie(s, admin)).toHaveLength(vorher);

    const uebernommen = await s.app.inject({
      method: "POST",
      url: `/api/kiosk/avatare/ki/${dateiId}/uebernehmen`,
      headers: { cookie: kiosk },
    });
    expect(uebernommen.statusCode).toBe(200);
    const nachher = await galerie(s, admin);
    expect(nachher).toHaveLength(vorher + 1);
    expect(nachher.at(-1)).toMatchObject({ dateiId, herkunft: "ki" });
    expect(anzahl(s, "avatar_entwuerfe")).toBe(0);

    // Und am Terminal registrierbar.
    const registriert = await s.app.inject({
      method: "POST",
      url: "/api/kiosk/registrierung",
      headers: { cookie: kiosk },
      payload: {
        guid: "KI-0001",
        vorname: "Kira",
        nachname: "Kunst",
        email: "kira@example.invalid",
        passwort: "geheim-123",
        avatarDateiId: dateiId,
        einwilligung: { erteilt: true, fassung: DATENSCHUTZ_FASSUNG, sprache: "de" },
      },
    });
    expect(registriert.statusCode, registriert.body).toBe(201);
  });

  it("laesst einen Entwurf nicht waehlen, weder am Terminal noch im Besucherbereich", async () => {
    const { s, admin, kiosk } = await aufbau();
    bilddienst();
    const { dateiId } = (await erzeuge(s, kiosk)).json<{ dateiId: string }>();

    const besucher = await alsBesucher(s, admin);
    const mein = await s.app.inject({
      method: "PATCH",
      url: "/api/mein/avatar",
      headers: { cookie: besucher.keks },
      payload: { avatarDateiId: dateiId },
    });
    expect(mein.statusCode).toBe(400);
    // Der Besucherbereich hat keinen KI-Weg.
    expect(
      (
        await s.app.inject({
          method: "POST",
          url: "/api/kiosk/avatare/ki",
          headers: { cookie: besucher.keks },
          payload: { merkmale: {} },
        })
      ).statusCode,
    ).toBe(401);
  });

  it("verwirft einen Entwurf samt Datei, aber nie ein Galeriebild", async () => {
    const { s, admin, kiosk } = await aufbau();
    bilddienst();
    const { dateiId } = (await erzeuge(s, kiosk)).json<{ dateiId: string }>();
    const dateienVorher = anzahl(s, "dateien");

    const weg = await s.app.inject({
      method: "DELETE",
      url: `/api/kiosk/avatare/ki/${dateiId}`,
      headers: { cookie: kiosk },
    });
    expect(weg.statusCode).toBe(204);
    expect(anzahl(s, "dateien")).toBe(dateienVorher - 1);
    expect(anzahl(s, "avatar_entwuerfe")).toBe(0);

    const vorlage = (await galerie(s, admin))[0]?.dateiId ?? "";
    const versuch = await s.app.inject({
      method: "DELETE",
      url: `/api/kiosk/avatare/ki/${vorlage}`,
      headers: { cookie: kiosk },
    });
    expect(versuch.statusCode).toBe(404);
    expect((await galerie(s, admin)).map((a) => a.dateiId)).toContain(vorlage);
  });

  it("raeumt liegengebliebene Entwuerfe nach einer Stunde weg", async () => {
    const { s, kiosk } = await aufbau();
    bilddienst();
    await erzeuge(s, kiosk);
    expect(anzahl(s, "avatar_entwuerfe")).toBe(1);

    vi.useFakeTimers({ now: Date.now() + ENTWURF_LEBENSDAUER_MS + 1000, toFake: ["Date"] });
    await erzeuge(s, kiosk);
    // Der alte ist weg, der neue steht.
    expect(anzahl(s, "avatar_entwuerfe")).toBe(1);
  });

  it("reicht die Meldung des Bilddienstes durch", async () => {
    const { s, kiosk } = await aufbau();
    bilddienst(() =>
      Response.json(
        { error: { message: "The model 'gpt-image-2' does not exist" } },
        { status: 400 },
      ),
    );
    const antwort = await erzeuge(s, kiosk);
    expect(antwort.statusCode).toBe(502);
    expect(antwort.json<{ code: string; message: string }>()).toMatchObject({
      code: "ki-fehlgeschlagen",
      message: "The model 'gpt-image-2' does not exist",
    });
    expect(anzahl(s, "avatar_entwuerfe")).toBe(0);
  });

  it("weist ein zu grosses Bild ab, statt es zu speichern", async () => {
    const { s, kiosk } = await aufbau();
    bilddienst(() =>
      Response.json({ data: [{ b64_json: Buffer.alloc(400 * 1024).toString("base64") }] }),
    );
    const antwort = await erzeuge(s, kiosk);
    expect(antwort.statusCode).toBe(502);
    expect(anzahl(s, "avatar_entwuerfe")).toBe(0);
  });

  it("ist ohne Schluessel aus, und das Terminal erfaehrt es", async () => {
    const { s, kiosk } = await aufbau(ADMIN);
    const aufrufe = bilddienst();
    const auswahl = (
      await s.app.inject({ url: "/api/kiosk/avatare", headers: { cookie: kiosk } })
    ).json<{
      ki: boolean;
      merkmale: unknown[];
    }>();
    expect(auswahl.ki).toBe(false);
    expect(auswahl.merkmale.length).toBeGreaterThan(0);

    const antwort = await erzeuge(s, kiosk);
    expect(antwort.statusCode).toBe(503);
    expect(antwort.json<{ code: string }>().code).toBe("ki-aus");
    expect(aufrufe).toHaveLength(0);
  });

  it("weist ein unbekanntes Merkmal ab, ohne OpenAI zu rufen", async () => {
    const { s, kiosk } = await aufbau();
    const aufrufe = bilddienst();
    const antwort = await erzeuge(s, kiosk, { freitext: "Anna Ahrens" });
    expect(antwort.statusCode).toBe(400);
    expect(antwort.json<{ code: string }>().code).toBe("merkmal-ungueltig");
    expect(aufrufe).toHaveLength(0);
  });

  it("ist nur fuer das Terminal, und begrenzt je Sitzung", async () => {
    const { s, admin, kiosk } = await aufbau();
    bilddienst();
    const betreuerAnlage = await s.app.inject({
      method: "POST",
      url: "/api/nutzer",
      headers: { cookie: admin },
      payload: { name: "Kai", email: "kai-ki@idta-passport.de", rolle: "betreuer" },
    });
    const betreuer = await melde(
      s,
      "kai-ki@idta-passport.de",
      betreuerAnlage.json<{ startpasswort: string }>().startpasswort,
    );
    expect((await erzeuge(s, betreuer)).statusCode).toBe(403);
    expect(
      (
        await s.app.inject({
          method: "POST",
          url: "/api/kiosk/avatare/ki",
          payload: { merkmale: {} },
        })
      ).statusCode,
    ).toBe(401);

    for (let i = 0; i < 10; i++) expect((await erzeuge(s, kiosk)).statusCode).toBe(201);
    expect((await erzeuge(s, kiosk)).statusCode).toBe(429);
  });
});

describe("Galerie ueber Zuruecksetzen und Sicherung", () => {
  async function mitKiBild() {
    const { s, admin, kiosk } = await aufbau();
    bilddienst();
    const { dateiId } = (await erzeuge(s, kiosk)).json<{ dateiId: string }>();
    await s.app.inject({
      method: "POST",
      url: `/api/kiosk/avatare/ki/${dateiId}/uebernehmen`,
      headers: { cookie: kiosk },
    });
    return { s, admin, kiosk, dateiId };
  }

  it("Zuruecksetzen laesst Vorlagen und KI-Bilder samt Datei stehen", async () => {
    const { s, admin, kiosk, dateiId } = await mitKiBild();
    // Ein offener Entwurf und ein Besucher, beide sollen gehen.
    await erzeuge(s, kiosk);
    await alsBesucher(s, admin);
    const vorher = await galerie(s, admin);

    const zurueck = await s.app.inject({
      method: "POST",
      url: "/api/entwickler/zuruecksetzen",
      headers: { cookie: admin },
      payload: { bestaetigung: "ZURUECKSETZEN" },
    });
    expect(zurueck.statusCode).toBe(200);

    expect(await galerie(s, admin)).toEqual(vorher);
    expect(
      (await s.app.inject({ url: `/api/dateien/${dateiId}`, headers: { cookie: admin } }))
        .statusCode,
    ).toBe(200);
    expect(anzahl(s, "besucher")).toBe(0);
    expect(anzahl(s, "avatar_entwuerfe")).toBe(0);
    // Galerie und Standardbild, sonst nichts.
    expect(anzahl(s, "dateien")).toBe(vorher.length + 1);
  });

  it("die Sicherung nimmt KI-Bilder mit und nennt sie", async () => {
    const { s, admin, dateiId } = await mitKiBild();
    const zip = (await s.app.inject({ url: "/api/sicherung", headers: { cookie: admin } }))
      .rawPayload;

    // Das Bild entfernen, dann die Sicherung pruefen und einspielen: es muss zurueck sein.
    await s.app.inject({
      method: "DELETE",
      url: `/api/avatare/${dateiId}`,
      headers: { cookie: admin },
    });
    const teil = multipart({}, { name: "s.zip", inhalt: zip });
    const pruefung = await s.app.inject({
      method: "POST",
      url: "/api/sicherung/pruefen",
      headers: { cookie: admin, ...teil.headers },
      payload: teil.payload,
    });
    expect(
      pruefung.json<{ sicherung: { bestand: { kiAvatare: number } } }>().sicherung.bestand
        .kiAvatare,
    ).toBe(1);

    const eingespielt = await s.app.inject({
      method: "POST",
      url: "/api/sicherung",
      headers: { cookie: admin, ...teil.headers },
      payload: teil.payload,
    });
    expect(eingespielt.statusCode, eingespielt.body).toBe(200);
    const neu = await melde(s, "admin@idta-passport.de", "startpasswort-123");
    expect((await galerie(s, neu)).at(-1)).toMatchObject({ dateiId, herkunft: "ki" });
    const bild = await s.app.inject({ url: `/api/dateien/${dateiId}`, headers: { cookie: neu } });
    expect(bild.statusCode).toBe(200);
    expect(bild.rawPayload.equals(BILD)).toBe(true);
  });
});
