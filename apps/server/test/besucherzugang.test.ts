import { afterEach, describe, expect, it } from "vitest";
import { STANDARD_AVATAR_ID } from "../src/services/standardavatar.js";
import { melde, starte, type Pruefstand } from "./hilfe.js";

/**
 * Besucher melden sich selbst an, seit dem 23.10.2026.
 *
 * Login ist die E-Mail, vorerst gilt fuer alle das Standardpasswort. Der Besucher sieht und
 * aendert, was das Terminal zeigt; die GUID kommt dabei **nur aus der Sitzung**.
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
  const ruf = (keks: string, method: "GET" | "POST" | "PATCH", url: string, payload?: object) =>
    s.app.inject({ method, url, headers: { cookie: keks }, payload });

  for (const [guid, vorname, email] of [
    ["BZ-1", "Anna", "anna@example.invalid"],
    ["BZ-2", "Bernd", "bernd@example.invalid"],
  ] as const) {
    const antwort = await ruf(admin, "POST", "/api/besucher", {
      guid,
      vorname,
      nachname: "Zugang",
      email,
    });
    expect(antwort.statusCode).toBe(201);
  }
  return { s, admin, ruf };
}

describe("Anmeldung als Besucher", () => {
  it("klappt mit E-Mail und Standardpasswort, ohne Gross- und Kleinschreibung", async () => {
    const { s, ruf } = await aufbau();
    const keks = await melde(s, "ANNA@example.invalid", "password");

    const ich = (await ruf(keks, "GET", "/api/auth/ich")).json<Record<string, unknown>>();
    expect(ich).toMatchObject({ rolle: "besucher", guid: "BZ-1", email: "anna@example.invalid" });
  });

  it("weist ein falsches Passwort und eine unbekannte E-Mail gleich ab", async () => {
    const { s } = await aufbau();
    for (const [email, passwort] of [
      ["anna@example.invalid", "falsch"],
      ["niemand@example.invalid", "password"],
    ]) {
      const antwort = await s.app.inject({
        method: "POST",
        url: "/api/auth/anmelden",
        payload: { email, passwort },
      });
      expect(antwort.statusCode, email).toBe(401);
    }
  });

  it("laesst das Personal vor, wenn es dieselbe E-Mail gibt", async () => {
    const { s, admin, ruf } = await aufbau();
    // Ein Besucher mit der E-Mail des Admins. Mit dem Standardpasswort kommt niemand hinein.
    await ruf(admin, "POST", "/api/besucher", {
      guid: "BZ-ADMIN",
      vorname: "Doppel",
      nachname: "Gaenger",
      email: "admin@idta-passport.de",
    });
    const antwort = await s.app.inject({
      method: "POST",
      url: "/api/auth/anmelden",
      payload: { email: "admin@idta-passport.de", passwort: "password" },
    });
    expect(antwort.statusCode).toBe(401);
  });
});

describe("Die Besuchersitzung", () => {
  /**
   * **Die wichtigste Pruefung.** Eine Besuchersitzung ist keine Anmeldung fuer die Verwaltung,
   * das Terminal oder die Ablage.
   */
  it("kommt an keine Personalroute", async () => {
    const { s, ruf } = await aufbau();
    const keks = await melde(s, "anna@example.invalid", "password");

    for (const url of [
      "/api/besucher",
      "/api/besucher/BZ-2",
      "/api/exponate",
      "/api/kiosk/besucher/BZ-2",
      "/api/kiosk/avatare",
      `/api/dateien/${STANDARD_AVATAR_ID}`,
      "/api/standard-avatar",
      "/api/nutzer",
    ]) {
      expect((await ruf(keks, "GET", url)).statusCode, url).toBe(401);
    }
  });

  /**
   * **Die Art der Sitzung entscheidet, nicht der Zufall der Kennung.** Eine GUID ist frei
   * waehlbar; traegt ein Besucher die Id eines Admins als GUID, darf seine Sitzung trotzdem
   * nicht als dieser Admin gelten.
   */
  it("wird nicht zum Personal, auch wenn die GUID einer Nutzer-Id gleicht", async () => {
    const { s, admin, ruf } = await aufbau();
    const adminId = (await ruf(admin, "GET", "/api/auth/ich")).json<{ id: string }>().id;
    const angelegt = await ruf(admin, "POST", "/api/besucher", {
      guid: adminId,
      vorname: "Gleiche",
      nachname: "Kennung",
      email: "gleich@example.invalid",
    });
    expect(angelegt.statusCode).toBe(201);

    const keks = await melde(s, "gleich@example.invalid", "password");
    expect((await ruf(keks, "GET", "/api/besucher")).statusCode).toBe(401);
    expect((await ruf(keks, "GET", "/api/auth/ich")).json()).toMatchObject({ rolle: "besucher" });
  });

  it("zeigt und aendert nur den eigenen Datensatz", async () => {
    const { s, admin, ruf } = await aufbau();
    const keks = await melde(s, "anna@example.invalid", "password");

    expect((await ruf(keks, "GET", "/api/mein")).json()).toMatchObject({ guid: "BZ-1" });

    // Eine fremde GUID im Rumpf wird nicht beachtet.
    const geaendert = await ruf(keks, "PATCH", "/api/mein", { guid: "BZ-2", firma: "Neu GmbH" });
    expect(geaendert.statusCode).toBe(200);
    expect(geaendert.json()).toMatchObject({ guid: "BZ-1", firma: "Neu GmbH" });

    const fremd = (await ruf(admin, "GET", "/api/besucher/BZ-2")).json<{ firma: string | null }>();
    expect(fremd.firma).toBeNull();
  });

  it("verlangt die E-Mail und haelt sie eindeutig", async () => {
    const { s, ruf } = await aufbau();
    const keks = await melde(s, "anna@example.invalid", "password");

    const leer = await ruf(keks, "PATCH", "/api/mein", { email: "  " });
    expect(leer.statusCode).toBe(400);
    const vergeben = await ruf(keks, "PATCH", "/api/mein", { email: "Bernd@Example.invalid" });
    expect(vergeben.statusCode).toBe(409);
    // Die eigene Adresse, anders geschrieben, ist keine fremde.
    const eigene = await ruf(keks, "PATCH", "/api/mein", { email: "Anna@example.invalid" });
    expect(eigene.statusCode).toBe(200);
  });

  it("waehlt einen Avatar nur aus der Galerie und sieht nur erlaubte Bilder", async () => {
    const { s, admin, ruf } = await aufbau();
    const keks = await melde(s, "anna@example.invalid", "password");

    const auswahl = (await ruf(keks, "GET", "/api/mein/avatare")).json<{ avatare: string[] }>();
    const bild = auswahl.avatare[0];
    expect(bild, "Galerie im Pruefstand leer").toBeDefined();

    expect((await ruf(keks, "PATCH", "/api/mein/avatar", { avatarDateiId: bild })).statusCode).toBe(
      200,
    );
    expect((await ruf(keks, "GET", `/api/mein/bild/${bild!}`)).statusCode).toBe(200);
    expect((await ruf(keks, "GET", `/api/mein/bild/${STANDARD_AVATAR_ID}`)).statusCode).toBe(200);

    // Eine Datei aus der Ablage, die kein Avatar ist.
    const grenze = "----passportzugang";
    const pdf = await s.app.inject({
      method: "POST",
      url: "/api/dateien",
      headers: { cookie: admin, "content-type": `multipart/form-data; boundary=${grenze}` },
      payload: Buffer.concat([
        Buffer.from(
          `--${grenze}\r\nContent-Disposition: form-data; name="datei"; filename="blatt.pdf"\r\n` +
            "Content-Type: application/pdf\r\n\r\n",
        ),
        Buffer.from("%PDF-1.4\n%%EOF\n"),
        Buffer.from(`\r\n--${grenze}--\r\n`),
      ]),
    });
    const fremd = pdf.json<{ id: string }>().id;
    expect((await ruf(keks, "GET", `/api/mein/bild/${fremd}`)).statusCode).toBe(403);
    expect(
      (await ruf(keks, "PATCH", "/api/mein/avatar", { avatarDateiId: fremd })).statusCode,
    ).toBe(400);
  });

  it("endet, wenn der Besucher geloescht wird", async () => {
    const { s, admin, ruf } = await aufbau();
    const keks = await melde(s, "anna@example.invalid", "password");
    await s.app.inject({ method: "DELETE", url: "/api/besucher/BZ-1", headers: { cookie: admin } });
    expect((await ruf(keks, "GET", "/api/mein")).statusCode).toBe(401);
  });
});

describe("Passwort zuruecksetzen", () => {
  it("geht nur fuer Admins, und danach gilt das Standardpasswort", async () => {
    const { s, admin, ruf } = await aufbau();
    const besucher = await melde(s, "anna@example.invalid", "password");

    const url = "/api/besucher/BZ-1/passwort-zuruecksetzen";
    expect((await ruf(besucher, "POST", url)).statusCode).toBe(401);
    expect((await ruf(admin, "POST", url)).statusCode).toBe(200);
    expect(
      (await ruf(admin, "POST", "/api/besucher/GIBT-ES-NICHT/passwort-zuruecksetzen")).statusCode,
    ).toBe(404);

    await expect(melde(s, "anna@example.invalid", "password")).resolves.toBeTruthy();
  });

  it("gibt den Passworthash nie heraus", async () => {
    const { admin, ruf } = await aufbau();
    const einzeln = (await ruf(admin, "GET", "/api/besucher/BZ-1")).body;
    const liste = (await ruf(admin, "GET", "/api/besucher")).body;
    for (const text of [einzeln, liste]) {
      expect(text).not.toContain("passwort");
    }
  });
});
