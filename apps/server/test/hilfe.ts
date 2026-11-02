import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { buildServer, type GebauterServer } from "../src/app.js";
import { readEnv, type ServerEnv } from "../src/env.js";
import { SCHLUESSEL_ANMELDUNG, setzeSchalter } from "../src/services/einstellungen.js";

/**
 * Ein Server je Test, auf einem eigenen Ordner.
 *
 * `__APP_VERSION__` ersetzt in Tests niemand, deshalb hier gesetzt.
 */
(globalThis as Record<string, unknown>)["__APP_VERSION__"] ??= "test";

export const MIGRATIONEN = fileURLToPath(new URL("../drizzle", import.meta.url));

/**
 * Eine eindeutige E-Mail fuer einen Testbesucher. Seit dem 23.10.2026 ist sie Pflicht und
 * eindeutig; jeder Test, der einen Besucher anlegt, braucht deshalb eine eigene.
 */
let emailZaehler = 0;
export function testEmail(): string {
  emailZaehler++;
  return `besucher-${String(emailZaehler)}@example.invalid`;
}

/** 32 Zeichen, die Untergrenze. Kein echtes Geheimnis, nur ein gueltiges. */
export const TEST_SECRET = "0123456789abcdef0123456789abcdef";

export interface Pruefstand extends GebauterServer {
  readonly env: ServerEnv;
  /** Raeumt Server **und** Ordner weg. */
  readonly ende: () => Promise<void>;
}

export async function starte(zusatz: Record<string, string | undefined> = {}): Promise<Pruefstand> {
  const ordner = mkdtempSync(join(tmpdir(), "passport-test-"));
  const env = readEnv({
    DATA_DIR: ordner,
    SESSION_SECRET: TEST_SECRET,
    LOG_LEVEL: "silent",
    ...zusatz,
  } as NodeJS.ProcessEnv);

  const server = await buildServer(env, MIGRATIONEN);
  return {
    ...server,
    env,
    /*
     * **Der Pruefstand raeumt selbst auf**, und zwar beides: der Ordner haelt eine
     * SQLite-Datei, und ein stehengebliebener Rueckstand verfaelscht still den naechsten
     * Lauf. `force` schluckt den Fall, dass der Ordner schon weg ist.
     */
    ende: async () => {
      await server.close();
      rmSync(ordner, { recursive: true, force: true });
    },
  };
}

/** Meldet sich an und gibt die Cookie-Kopfzeile fuer weitere Aufrufe zurueck. */
export async function melde(stand: Pruefstand, email: string, passwort: string): Promise<string> {
  const antwort = await stand.app.inject({
    method: "POST",
    url: "/api/auth/anmelden",
    payload: { email, passwort },
  });
  if (antwort.statusCode !== 200) {
    throw new Error(`Anmeldung fehlgeschlagen: ${String(antwort.statusCode)} ${antwort.body}`);
  }
  const keks = antwort.cookies.find((c) => c.name === "idta_passport_sitzung");
  if (keks === undefined) throw new Error("kein Sitzungscookie in der Antwort");
  return `idta_passport_sitzung=${keks.value}`;
}

/**
 * Legt den Schalter um, ob die Konnektor-API eine Anmeldung verlangt.
 *
 * **Seit dem 08.10.2026 steht er per Vorgabe auf aus**, die Schnittstelle ist also ohne
 * Zugangsdaten erreichbar. Jeder Test, der die Anmeldung selbst prueft, muss ihn deshalb
 * zuerst einschalten; sonst prueft er, dass etwas durchkommt, was ohnehin durchkommt.
 */
export function verlangeAnmeldung(stand: Pruefstand, an: boolean): void {
  setzeSchalter(stand.ctx.db, SCHLUESSEL_ANMELDUNG, an);
}

/**
 * Ein Multipart-Koerper aus Textfeldern und hoechstens einer Datei, fuer `inject`.
 *
 * Dokumente gehen seit dem 02.11.2026 samt Datei in **einem** Aufruf an das Exponat.
 */
export function multipart(
  felder: Record<string, string>,
  datei?: { feld?: string; name: string; inhalt: Buffer },
): { payload: Buffer; headers: Record<string, string> } {
  const grenze = "----passport";
  const teile: Buffer[] = [];
  for (const [name, wert] of Object.entries(felder)) {
    teile.push(
      Buffer.from(
        `--${grenze}\r\nContent-Disposition: form-data; name="${name}"\r\n\r\n${wert}\r\n`,
        "utf8",
      ),
    );
  }
  if (datei !== undefined) {
    teile.push(
      Buffer.from(
        `--${grenze}\r\nContent-Disposition: form-data; name="${datei.feld ?? "datei"}"; filename="${datei.name}"\r\n` +
          "Content-Type: application/octet-stream\r\n\r\n",
        "utf8",
      ),
      datei.inhalt,
      Buffer.from("\r\n", "utf8"),
    );
  }
  teile.push(Buffer.from(`--${grenze}--\r\n`, "utf8"));
  return {
    payload: Buffer.concat(teile),
    headers: { "content-type": `multipart/form-data; boundary=${grenze}` },
  };
}

/** Legt ein PDF-Dokument an einem Exponat an und gibt die Antwort zurueck. */
export async function legeDokumentAn(
  stand: Pruefstand,
  keks: string,
  exponatId: string,
  titel = "Datenblatt",
) {
  const { payload, headers } = multipart(
    { titel },
    { name: "blatt.pdf", inhalt: Buffer.from("%PDF-1.4 test\n") },
  );
  return stand.app.inject({
    method: "POST",
    url: `/api/exponate/${exponatId}/dokumente`,
    headers: { ...headers, cookie: keks },
    payload,
  });
}

/** Der geheime Code des QR-Codes am Exponat, direkt aus der Datenbank. */
export function scanCode(stand: Pruefstand, exponatId: string): string {
  const reihe = stand.ctx.sqlite
    .prepare("select scan_code as code from exponate where id = ?")
    .get(exponatId) as { code: string } | undefined;
  if (reihe === undefined) throw new Error(`kein Exponat ${exponatId}`);
  return reihe.code;
}

/**
 * Legt einen Besucher an (als Admin), meldet ihn mit dem Standardpasswort an und gibt GUID
 * und Cookie zurueck.
 */
export async function alsBesucher(stand: Pruefstand, adminKeks: string) {
  const email = testEmail();
  const besucher = (
    await stand.app.inject({
      method: "POST",
      url: "/api/besucher",
      headers: { cookie: adminKeks },
      payload: { vorname: "Anna", nachname: "Ahrens", email },
    })
  ).json<{ guid: string }>();
  return { guid: besucher.guid, keks: await melde(stand, email, "password") };
}

/** Der Besucher scannt den QR-Code am Exponat. */
export function nimmAuf(stand: Pruefstand, besucherKeks: string, code: string) {
  return stand.app.inject({
    method: "POST",
    url: "/api/mein/besuche",
    headers: { cookie: besucherKeks },
    payload: { code },
  });
}
