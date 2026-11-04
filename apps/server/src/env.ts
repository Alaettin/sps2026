import { createPrivateKey } from "node:crypto";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Die Projektwurzel, an **dieser Datei** verankert statt am Arbeitsverzeichnis.
 *
 * `pnpm dev:server` startet im Paketverzeichnis, `start.bat` in der Wurzel. Ein relatives
 * `DATA_DIR` meinte dadurch zwei verschiedene Datenbanken, und die zweite sah aus wie eine
 * fehlgeschlagene Migration: Drizzle fand dort einen aelteren Journaleintrag und legte
 * Tabellen ein zweites Mal an.
 *
 * Gebaut liegt alles in `apps/server/dist/index.js`, also auf derselben Tiefe wie
 * `apps/server/src/env.ts`. Beide Wege kommen hier auf dieselbe Wurzel.
 */
/**
 * Die Viewer-Adresse mit genau einem abschliessenden Schraegstrich. Gilt fuer die Umgebung und
 * fuer den Wert aus den Einstellungen (`services/einstellungen.ts`), damit beide gleich enden.
 */
export function normalisiereViewerUrl(roh: string): string {
  return roh.trim().replace(/\/*$/, "/");
}

export const PROJEKT_WURZEL = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");

/**
 * Konfiguration aus der Umgebung, einmal gelesen und geprueft.
 *
 * Fehlt ein Pflichtwert, bricht der **Start** ab, nicht der erste Anmeldeversuch. Ein
 * Server, der mit leerem SESSION_SECRET laeuft, signiert Sitzungen mit nichts und faellt
 * erst auf, wenn jemand das Cookie faelscht.
 */

export interface ServerEnv {
  readonly port: number;
  readonly host: string;
  readonly logLevel: string;
  readonly production: boolean;
  /** Wurzel fuer die Datenbank und die Dateiablage. */
  readonly dataDir: string;
  /** Die eine SQLite-Datei. */
  readonly dbPfad: string;
  /** Ordner der hochgeladenen Dateien. */
  readonly dateienDir: string;
  readonly sessionSecret: string;
  readonly sessionTtlMs: number;
  readonly maxUploadBytes: number;
  /**
   * Bootstrap des ersten Admins. Beide zusammen oder keiner.
   *
   * Greift nur, solange **kein** Admin existiert. Danach wird nichts getan, auch nicht
   * das Passwort zurueckgesetzt: sonst holte ein Neustart ein weggeworfenes Startpasswort
   * zurueck.
   */
  readonly bootstrapAdmin: { readonly email: string; readonly passwort: string } | null;
  /**
   * Zugang fuer Axon zur Konnektor-API. Erst in Auftrag 2 benutzt, hier schon gelesen,
   * damit eine unvollstaendige Umgebung beim Start auffaellt und nicht bei der ersten
   * Abfrage aus Axon.
   */
  readonly connectorBasic: { readonly user: string; readonly passwort: string } | null;
  /**
   * Die oeffentliche Basis-Adresse ohne abschliessenden Schraegstrich, oder `null`.
   *
   * Sie schlaegt den `Host`-Kopf, denn der kommt vom Klienten und ist damit Nutzerdaten.
   */
  readonly publicBaseUrl: string | null;
  /** Basis des Viewers, mit abschliessendem Schraegstrich. Die GUID wird angehaengt. */
  readonly viewerBaseUrl: string;
  /**
   * Angezeigter Name der App.
   *
   * Leer heisst: die Oberflaeche zeigt "IDTA Passport". "Event Manager" aus dem Design-Paket
   * ist bei Neoception ein anderes Produkt und gehoert hier nicht hin.
   */
  readonly appName: string;
  /**
   * KI-Avatare am Terminal, seit dem 04.11.2026. Ohne Schluessel ist der Weg aus und das
   * Terminal zeigt nur die Galerie. Das Modell ist eine Variable, weil OpenAI Bildmodelle
   * stilllegt (`gpt-image-1` im Oktober 2026, "does not exist").
   */
  readonly openai: { readonly apiKey: string; readonly bildModell: string } | null;
  /**
   * Der Passport als OpenID-Connect-Anbieter fuer Keycloak der DTI, seit dem 04.11.2026.
   * Besucher melden sich damit im DTI-Viewer an. Aus, solange nicht alles gesetzt ist.
   */
  readonly oidc: OidcEnv | null;
}

export interface OidcEnv {
  /** Die oeffentliche Adresse des Passports, ohne abschliessenden Schraegstrich. */
  readonly issuer: string;
  readonly clientId: string;
  readonly clientSecret: string;
  /** Exakt verglichen, kein Praefix: sonst waere jede Unteradresse ein Ziel fuer Codes. */
  readonly redirectUris: readonly string[];
  /** EC P-256 als PKCS8-PEM. */
  readonly signaturSchluessel: string;
  /** Gehen als Claim `roles` ins Token. */
  readonly rollen: readonly string[];
}

/**
 * Liest die OIDC-Werte. Alle vier oder keiner; halb gesetzt bricht den Start ab, aus demselben
 * Grund wie bei `paar`: es saehe eingerichtet aus und liefe nie.
 */
function leseOidc(source: NodeJS.ProcessEnv, publicBaseUrl: string | null): OidcEnv | null {
  const namen = [
    "OIDC_CLIENT_ID",
    "OIDC_CLIENT_SECRET",
    "OIDC_REDIRECT_URIS",
    "OIDC_SIGNATUR_SCHLUESSEL",
  ] as const;
  const werte = namen.map((name) => source[name]?.trim() ?? "");
  const gesetzt = namen.filter((_, i) => werte[i] !== "");
  if (gesetzt.length === 0) return null;
  if (gesetzt.length < namen.length) {
    const fehlend = namen.filter((_, i) => werte[i] === "");
    throw new ConfigError(
      `OIDC ist nur halb eingerichtet, es fehlen: ${fehlend.join(", ")}. Alle vier oder keiner.`,
    );
  }
  const [clientId, clientSecret, uris, schluessel] = werte as [string, string, string, string];
  if (clientSecret.length < 32) {
    throw new ConfigError("OIDC_CLIENT_SECRET ist zu kurz, mindestens 32 Zeichen sind noetig.");
  }
  if (publicBaseUrl === null) {
    throw new ConfigError("OIDC braucht PUBLIC_BASE_URL, sie ist der Issuer der Tokens.");
  }
  const redirectUris = uris
    .split(",")
    .map((u) => u.trim())
    .filter((u) => u !== "");
  for (const uri of redirectUris) {
    let adresse: URL;
    try {
      adresse = new URL(uri);
    } catch {
      throw new ConfigError(`OIDC_REDIRECT_URIS enthaelt keine gueltige Adresse: "${uri}".`);
    }
    if (adresse.hash !== "") {
      throw new ConfigError(`OIDC_REDIRECT_URIS darf kein #-Fragment enthalten: "${uri}".`);
    }
  }
  const rollen = (source["OIDC_ROLLEN"]?.trim() || "idta-passport-besucher")
    .split(",")
    .map((r) => r.trim())
    .filter((r) => r !== "");
  // Sliplane speichert Werte einzeilig; ein PEM kommt dort mit `\n` statt Zeilenumbruechen.
  const pem = schluessel.replaceAll("\\n", "\n");
  /*
   * Hier pruefen, nicht erst beim ersten Token: ein kaputter Schluessel soll den Start
   * abbrechen, nicht die erste Anmeldung eines Besuchers am Messestand.
   */
  let kurve: string | undefined;
  try {
    const schluesselObjekt = createPrivateKey(pem);
    kurve =
      schluesselObjekt.asymmetricKeyType === "ec"
        ? schluesselObjekt.asymmetricKeyDetails?.namedCurve
        : undefined;
  } catch {
    throw new ConfigError("OIDC_SIGNATUR_SCHLUESSEL ist kein lesbarer privater Schluessel (PEM).");
  }
  if (kurve !== "prime256v1") {
    throw new ConfigError(
      "OIDC_SIGNATUR_SCHLUESSEL muss ein EC-Schluessel auf P-256 sein (ES256).",
    );
  }
  if (redirectUris.length === 0) {
    throw new ConfigError("OIDC_REDIRECT_URIS ist leer.");
  }
  return {
    issuer: publicBaseUrl,
    clientId,
    clientSecret,
    redirectUris,
    signaturSchluessel: pem,
    rollen,
  };
}

export class ConfigError extends Error {}

function required(name: string, value: string | undefined): string {
  if (value === undefined || value.trim() === "") {
    throw new ConfigError(
      `${name} fehlt. Ohne diesen Wert startet der Server nicht, siehe .env.example.`,
    );
  }
  return value;
}

function number(name: string, value: string | undefined, fallback: number): number {
  if (value === undefined || value.trim() === "") return fallback;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new ConfigError(`${name} muss eine positive Zahl sein, gelesen wurde "${value}".`);
  }
  return parsed;
}

/**
 * Liest ein Paar, das nur vollstaendig oder gar nicht gesetzt sein darf.
 *
 * Die Haelfte davon ist der gefaehrliche Fall: ein gesetztes ADMIN_EMAIL ohne Passwort
 * sieht nach eingerichtetem Bootstrap aus, legt aber nie einen Admin an, und das faellt
 * erst auf, wenn sich niemand anmelden kann.
 */
function paar(
  nameA: string,
  nameB: string,
  a: string | undefined,
  b: string | undefined,
): { a: string; b: string } | null {
  const hatA = a !== undefined && a.trim() !== "";
  const hatB = b !== undefined && b.trim() !== "";
  if (!hatA && !hatB) return null;
  if (!hatA || !hatB) {
    throw new ConfigError(
      `${nameA} und ${nameB} gehoeren zusammen. Gesetzt ist nur ${hatA ? nameA : nameB}.`,
    );
  }
  return { a: a as string, b: b as string };
}

export function readEnv(source: NodeJS.ProcessEnv = process.env): ServerEnv {
  // Ein absoluter Wert bleibt absolut (im Container `/data`), ein relativer haengt an der
  // Wurzel. `resolve` erledigt beides, die Basis faellt beim absoluten Pfad weg.
  const dataDir = resolve(PROJEKT_WURZEL, source["DATA_DIR"] ?? "./data");
  const ttlHours = number("SESSION_TTL_HOURS", source["SESSION_TTL_HOURS"], 12);
  const maxUploadMb = number("MAX_UPLOAD_MB", source["MAX_UPLOAD_MB"], 50);

  /*
   * Ein kurzes Geheimnis ist kein Geheimnis. Der Wert signiert jedes Sitzungscookie; wer
   * ihn erraet, meldet sich selbst an. 32 Zeichen sind die Untergrenze, und ein
   * `SESSION_SECRET=test` soll den Start abbrechen statt jahrelang offen zu stehen.
   */
  const sessionSecret = required("SESSION_SECRET", source["SESSION_SECRET"]);
  if (sessionSecret.length < 32) {
    throw new ConfigError(
      `SESSION_SECRET ist mit ${String(sessionSecret.length)} Zeichen zu kurz, ` +
        "mindestens 32 sind noetig.",
    );
  }

  const admin = paar(
    "ADMIN_EMAIL",
    "ADMIN_PASSWORT",
    source["ADMIN_EMAIL"],
    source["ADMIN_PASSWORT"],
  );
  const basic = paar(
    "CONNECTOR_BASIC_USER",
    "CONNECTOR_BASIC_PASSWORT",
    source["CONNECTOR_BASIC_USER"],
    source["CONNECTOR_BASIC_PASSWORT"],
  );

  const publicBaseUrl = (() => {
    const roh = source["PUBLIC_BASE_URL"]?.trim();
    return roh === undefined || roh === "" ? null : roh.replace(/\/+$/, "");
  })();

  return {
    port: number("PORT", source["PORT"], 3230),
    host: source["HOST"] ?? "0.0.0.0",
    logLevel: source["LOG_LEVEL"] ?? "info",
    production: source["NODE_ENV"] === "production",
    dataDir,
    dbPfad: resolve(dataDir, "passport.db"),
    dateienDir: resolve(dataDir, "dateien"),
    sessionSecret,
    sessionTtlMs: ttlHours * 60 * 60 * 1000,
    maxUploadBytes: maxUploadMb * 1024 * 1024,
    bootstrapAdmin:
      admin === null ? null : { email: admin.a.trim().toLowerCase(), passwort: admin.b },
    connectorBasic: basic === null ? null : { user: basic.a, passwort: basic.b },
    publicBaseUrl,
    // Mit genau einem abschliessenden Schraegstrich, egal wie er gesetzt wurde: der Scan
    // vergleicht den QR-Inhalt gegen diesen Praefix, und ein fehlender Schraegstrich
    // liesse `.../abc` auf `.../abcdef` passen.
    viewerBaseUrl: normalisiereViewerUrl(
      source["VIEWER_BASE_URL"] ?? "https://viewer-sps2026.aas.neoception.dev/",
    ),
    appName: source["APP_NAME"]?.trim() ?? "",
    openai: (() => {
      const schluessel = source["OPENAI_API_KEY"]?.trim();
      if (schluessel === undefined || schluessel === "") return null;
      const modell = source["OPENAI_IMAGE_MODEL"]?.trim();
      return {
        apiKey: schluessel,
        bildModell: modell === undefined || modell === "" ? "gpt-image-2" : modell,
      };
    })(),
    oidc: leseOidc(source, publicBaseUrl),
  };
}
