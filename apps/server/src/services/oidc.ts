import {
  createHash,
  createPrivateKey,
  createPublicKey,
  randomBytes,
  sign,
  timingSafeEqual,
  verify,
  type KeyObject,
} from "node:crypto";
import { eq, lt } from "drizzle-orm";
import type { Db } from "../db/client.js";
import { besucher, oidcCodes } from "../db/schema.js";

/**
 * Der Passport als OpenID-Connect-Anbieter fuer Keycloak der DTI, seit dem 04.11.2026.
 *
 * Besucher melden sich im DTI-Viewer mit ihrem Passport-Konto an: Keycloak schickt sie
 * hierher, der Passport prueft E-Mail und Passwort wie immer und gibt Keycloak ein signiertes
 * ID-Token zurueck. Keycloak legt daraus einen eigenen Nutzer an und steckt ihn in die Gruppe
 * `dti-external`. **Passwoerter verlassen den Passport nie**, es gibt nichts abzugleichen.
 *
 * Nur `node:crypto`, keine JOSE-Bibliothek: es gibt genau ein Verfahren (ES256), genau einen
 * Schluessel und genau einen Client, und das ist in wenigen Zeilen vollstaendig pruefbar.
 */

/** Ein Code gilt eine Minute; Keycloak tauscht ihn binnen Millisekunden. */
export const CODE_LEBENSDAUER_MS = 60_000;
/** ID- und Access-Token gelten fuenf Minuten. Keycloak braucht sie nur fuer die Anmeldung. */
export const TOKEN_LEBENSDAUER_S = 300;

export interface Signaturschluessel {
  readonly privat: KeyObject;
  readonly oeffentlich: KeyObject;
  readonly kid: string;
  /** Der oeffentliche Teil als JWK, so wie er im JWKS steht. */
  readonly jwk: Readonly<Record<string, string>>;
}

export function base64url(daten: Buffer | string): string {
  return Buffer.from(daten).toString("base64url");
}

function sha256(daten: string): Buffer {
  return createHash("sha256").update(daten, "utf8").digest();
}

/**
 * Laedt den Signaturschluessel. Die Kennung `kid` ist der JWK-Daumenabdruck nach RFC 7638:
 * die Pflichtfelder in lexikalischer Reihenfolge, ohne Leerzeichen, SHA-256. Damit aendert
 * sie sich genau dann, wenn sich der Schluessel aendert, und Keycloak holt das JWKS neu.
 */
export function ladeSchluessel(pem: string): Signaturschluessel {
  const privat = createPrivateKey(pem);
  const oeffentlich = createPublicKey(privat);
  const roh = oeffentlich.export({ format: "jwk" });
  const crv = String(roh.crv);
  const x = String(roh.x);
  const y = String(roh.y);
  const kid = base64url(sha256(JSON.stringify({ crv, kty: "EC", x, y })));
  return {
    privat,
    oeffentlich,
    kid,
    jwk: { kty: "EC", crv, x, y, kid, use: "sig", alg: "ES256" },
  };
}

/**
 * Signiert ein JWT mit ES256.
 *
 * `ieee-p1363` ist **Pflicht**: JWS verlangt die Signatur als `r || s` mit je 32 Byte. Die
 * Vorgabe von Node ist DER, und eine DER-Signatur lehnt jeder JWT-Pruefer ab, obwohl sie
 * mathematisch dieselbe ist.
 */
export function signiere(
  schluessel: Signaturschluessel,
  nutzlast: Record<string, unknown>,
  typ = "JWT",
): string {
  const kopf = base64url(JSON.stringify({ alg: "ES256", typ, kid: schluessel.kid }));
  const rumpf = base64url(JSON.stringify(nutzlast));
  const signatur = sign("sha256", Buffer.from(`${kopf}.${rumpf}`), {
    key: schluessel.privat,
    dsaEncoding: "ieee-p1363",
  });
  return `${kopf}.${rumpf}.${base64url(signatur)}`;
}

/**
 * Prueft ein selbst ausgestelltes JWT (das Access-Token am Userinfo-Endpunkt).
 *
 * Der Kopf muss **genau** ES256 und den eigenen `kid` nennen; ein Token mit `alg: none` oder
 * einem fremden Verfahren faellt damit durch, bevor die Signatur ueberhaupt gelesen wird.
 */
export function pruefeJwt(
  schluessel: Signaturschluessel,
  token: string,
  erwartet: { readonly iss: string; readonly typ: string },
): Record<string, unknown> | null {
  const teile = token.split(".");
  if (teile.length !== 3) return null;
  const [kopfRoh, rumpfRoh, signaturRoh] = teile as [string, string, string];
  try {
    const kopf = JSON.parse(Buffer.from(kopfRoh, "base64url").toString("utf8")) as Record<
      string,
      unknown
    >;
    if (kopf["alg"] !== "ES256" || kopf["kid"] !== schluessel.kid || kopf["typ"] !== erwartet.typ) {
      return null;
    }
    const stimmt = verify(
      "sha256",
      Buffer.from(`${kopfRoh}.${rumpfRoh}`),
      { key: schluessel.oeffentlich, dsaEncoding: "ieee-p1363" },
      Buffer.from(signaturRoh, "base64url"),
    );
    if (!stimmt) return null;
    const rumpf = JSON.parse(Buffer.from(rumpfRoh, "base64url").toString("utf8")) as Record<
      string,
      unknown
    >;
    if (rumpf["iss"] !== erwartet.iss) return null;
    if (typeof rumpf["exp"] !== "number" || rumpf["exp"] * 1000 <= Date.now()) return null;
    if (typeof rumpf["sub"] !== "string") return null;
    return rumpf;
  } catch {
    return null;
  }
}

/**
 * Vergleicht zwei Geheimnisse in gleicher Zeit. Ueber die Hashes, damit auch verschiedene
 * Laengen nicht frueher abbrechen und so die Laenge verraten.
 */
export function geheimnisStimmt(gegeben: string, erwartet: string): boolean {
  return timingSafeEqual(sha256(gegeben), sha256(erwartet));
}

/** PKCE-Challenge: 43 Zeichen base64url, so lang ist ein SHA-256 ohne Auffuellung. */
export const CHALLENGE_MUSTER = /^[A-Za-z0-9_-]{43}$/;
/** PKCE-Verifier nach RFC 7636: 43 bis 128 Zeichen aus der erlaubten Menge. */
const VERIFIER_MUSTER = /^[A-Za-z0-9._~-]{43,128}$/;

export function pkceStimmt(verifier: string, challenge: string): boolean {
  if (!VERIFIER_MUSTER.test(verifier)) return false;
  return geheimnisStimmt(base64url(sha256(verifier)), challenge);
}

/** `at_hash` nach OIDC Core 3.1.3.6: linke Haelfte des SHA-256 des Access-Tokens. */
export function atHash(accessToken: string): string {
  return base64url(sha256(accessToken).subarray(0, 16));
}

export interface CodeAnfrage {
  readonly besucherGuid: string;
  readonly clientId: string;
  readonly redirectUri: string;
  readonly codeChallenge: string;
  readonly nonce: string | null;
  readonly scope: string;
  readonly authTime: number;
}

/**
 * Stellt einen Einmal-Code aus und gibt ihn **roh** zurueck; gespeichert wird nur sein Hash.
 * Abgelaufene Codes raeumt derselbe Aufruf weg, ein eigener Zeitplan lohnt dafuer nicht.
 */
export function stelleCodeAus(db: Db, anfrage: CodeAnfrage): string {
  const jetzt = Date.now();
  db.delete(oidcCodes).where(lt(oidcCodes.ablauf, jetzt)).run();
  const code = base64url(randomBytes(32));
  db.insert(oidcCodes)
    .values({
      codeHash: base64url(sha256(code)),
      ...anfrage,
      ablauf: jetzt + CODE_LEBENSDAUER_MS,
    })
    .run();
  return code;
}

/**
 * Loest einen Code ein: holt **und loescht** ihn in einer Anweisung. Ein zweiter Versuch
 * findet nichts mehr, auch wenn der erste an einer spaeteren Pruefung scheitert; so laesst
 * sich ein abgefangener Code nicht mit geratenen Verifiern durchprobieren.
 *
 * Abgelaufen zaehlt wie unbekannt.
 */
export function loeseCodeEin(db: Db, code: string): (CodeAnfrage & { ablauf: number }) | null {
  const reihe = db
    .delete(oidcCodes)
    .where(eq(oidcCodes.codeHash, base64url(sha256(code))))
    .returning()
    .get();
  if (reihe === undefined || reihe.ablauf <= Date.now()) return null;
  return reihe;
}

export interface Besucherclaims {
  readonly sub: string;
  readonly email?: string;
  readonly email_verified?: boolean;
  readonly name?: string;
  readonly given_name?: string;
  readonly family_name?: string;
  readonly preferred_username?: string;
  readonly roles: readonly string[];
}

/**
 * Die Angaben ueber den Besucher, je nach angefragtem `scope`. `null`, wenn es ihn nicht mehr
 * gibt.
 *
 * **`email_verified: false`**, weil es stimmt: die Adresse wurde am Terminal eingetippt und
 * nie bestaetigt. Keycloak uebernimmt sie trotzdem, wenn beim Anbieter "Trust email" an ist.
 * Mehr ist hier nicht drin: Name und E-Mail, keine Firma, keine Anschrift.
 */
export function besucherclaims(
  db: Db,
  guid: string,
  scope: string,
  rollen: readonly string[],
): Besucherclaims | null {
  const person = db
    .select({
      guid: besucher.guid,
      vorname: besucher.vorname,
      nachname: besucher.nachname,
      email: besucher.email,
    })
    .from(besucher)
    .where(eq(besucher.guid, guid))
    .get();
  if (person === undefined) return null;
  const bereiche = new Set(scope.split(" "));
  return {
    sub: person.guid,
    ...(bereiche.has("email") ? { email: person.email, email_verified: false } : {}),
    ...(bereiche.has("profile")
      ? {
          name: `${person.vorname} ${person.nachname}`,
          given_name: person.vorname,
          family_name: person.nachname,
          preferred_username: person.email,
        }
      : {}),
    roles: rollen,
  };
}
