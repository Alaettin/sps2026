import { createHash, createPublicKey, generateKeyPairSync, randomBytes, verify } from "node:crypto";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ConfigError, readEnv } from "../src/env.js";
import { signiere, ladeSchluessel } from "../src/services/oidc.js";
import { TEST_SECRET, alsBesucher, melde, starte, type Pruefstand } from "./hilfe.js";

/**
 * Der Passport als OIDC-Anbieter fuer Keycloak der DTI, seit dem 04.11.2026.
 */

const ISSUER = "https://passport.example";
const CLIENT_ID = "dti-keycloak";
const CLIENT_SECRET = "geheim-geheim-geheim-geheim-geheim-42";
const REDIRECT = "https://auth.dti.example/realms/dti/broker/idta-passport/endpoint";
const ADMIN = { ADMIN_EMAIL: "admin@idta-passport.de", ADMIN_PASSWORT: "startpasswort-123" };

function neuerSchluessel(): string {
  return generateKeyPairSync("ec", { namedCurve: "P-256" })
    .privateKey.export({ format: "pem", type: "pkcs8" })
    .toString();
}
const SCHLUESSEL = neuerSchluessel();

const OIDC = {
  PUBLIC_BASE_URL: ISSUER,
  OIDC_CLIENT_ID: CLIENT_ID,
  OIDC_CLIENT_SECRET: CLIENT_SECRET,
  OIDC_REDIRECT_URIS: REDIRECT,
  OIDC_SIGNATUR_SCHLUESSEL: SCHLUESSEL,
};

let stand: Pruefstand | null = null;
afterEach(async () => {
  vi.useRealTimers();
  await stand?.ende();
  stand = null;
});

async function aufbau(zusatz: Record<string, string> = OIDC) {
  stand = await starte({ ...ADMIN, ...zusatz });
  const s = stand;
  const admin = await melde(s, ADMIN.ADMIN_EMAIL, ADMIN.ADMIN_PASSWORT);
  const besucher = await alsBesucher(s, admin);
  return { s, admin, besucher };
}

function pkce() {
  const verifier = randomBytes(32).toString("base64url");
  const challenge = createHash("sha256").update(verifier).digest("base64url");
  return { verifier, challenge };
}

function authorizeUrl(werte: Record<string, string | undefined> = {}) {
  const p = new URLSearchParams();
  const alle: Record<string, string | undefined> = {
    client_id: CLIENT_ID,
    redirect_uri: REDIRECT,
    response_type: "code",
    scope: "openid email profile",
    state: "zustand-1",
    nonce: "nonce-1",
    code_challenge_method: "S256",
    ...werte,
  };
  for (const [k, v] of Object.entries(alle)) if (v !== undefined) p.set(k, v);
  return `/oauth/authorize?${p.toString()}`;
}

async function holeCode(s: Pruefstand, keks: string, challenge: string) {
  const antwort = await s.app.inject({
    method: "GET",
    url: authorizeUrl({ code_challenge: challenge }),
    headers: { cookie: keks },
  });
  expect(antwort.statusCode).toBe(302);
  const ziel = new URL(antwort.headers.location as string);
  expect(`${ziel.origin}${ziel.pathname}`).toBe(REDIRECT);
  expect(ziel.searchParams.get("state")).toBe("zustand-1");
  expect(ziel.searchParams.get("iss")).toBe(ISSUER);
  const code = ziel.searchParams.get("code");
  expect(code).not.toBeNull();
  return code as string;
}

function tausche(s: Pruefstand, werte: Record<string, string>, kopf: Record<string, string> = {}) {
  return s.app.inject({
    method: "POST",
    url: "/oauth/token",
    headers: { "content-type": "application/x-www-form-urlencoded", ...kopf },
    payload: new URLSearchParams(werte).toString(),
  });
}

function tauschWerte(code: string, verifier: string) {
  return {
    grant_type: "authorization_code",
    code,
    redirect_uri: REDIRECT,
    code_verifier: verifier,
    client_id: CLIENT_ID,
    client_secret: CLIENT_SECRET,
  };
}

function leseJwt(token: string) {
  const [kopf, rumpf] = token.split(".") as [string, string, string];
  return {
    kopf: JSON.parse(Buffer.from(kopf, "base64url").toString()) as Record<string, unknown>,
    rumpf: JSON.parse(Buffer.from(rumpf, "base64url").toString()) as Record<string, unknown>,
  };
}

describe("OIDC: Discovery und Schluessel", () => {
  it("nennt Endpunkte, ES256 und PKCE S256", async () => {
    const { s } = await aufbau();
    const antwort = await s.app.inject({ method: "GET", url: "/.well-known/openid-configuration" });
    expect(antwort.statusCode).toBe(200);
    const d = antwort.json<Record<string, unknown>>();
    expect(d["issuer"]).toBe(ISSUER);
    expect(d["authorization_endpoint"]).toBe(`${ISSUER}/oauth/authorize`);
    expect(d["token_endpoint"]).toBe(`${ISSUER}/oauth/token`);
    expect(d["jwks_uri"]).toBe(`${ISSUER}/oauth/jwks`);
    expect(d["userinfo_endpoint"]).toBe(`${ISSUER}/oauth/userinfo`);
    expect(d["id_token_signing_alg_values_supported"]).toEqual(["ES256"]);
    expect(d["code_challenge_methods_supported"]).toEqual(["S256"]);
    expect(d["token_endpoint_auth_methods_supported"]).toContain("client_secret_post");
  });

  it("antwortet ohne Konfiguration auf allen Pfaden 404, auch mit HTML-Wunsch", async () => {
    stand = await starte(ADMIN);
    const s = stand;
    for (const url of [
      "/.well-known/openid-configuration",
      "/oauth/jwks",
      authorizeUrl({ code_challenge: pkce().challenge }),
      "/oauth/userinfo",
    ]) {
      const antwort = await s.app.inject({
        method: "GET",
        url,
        headers: { accept: "text/html" },
      });
      expect(antwort.statusCode, url).toBe(404);
    }
    const token = await tausche(s, { grant_type: "authorization_code" });
    expect(token.statusCode).toBe(404);
  });
});

describe("OIDC: Authorization Code mit PKCE", () => {
  it("liefert ein ID-Token, das sich mit dem JWKS pruefen laesst, mit Claims und Rolle", async () => {
    const { s, besucher } = await aufbau();
    const { verifier, challenge } = pkce();
    const code = await holeCode(s, besucher.keks, challenge);

    const antwort = await tausche(s, tauschWerte(code, verifier));
    expect(antwort.statusCode).toBe(200);
    expect(antwort.headers["cache-control"]).toBe("no-store");
    const t = antwort.json<{ id_token: string; access_token: string; token_type: string }>();
    expect(t.token_type).toBe("Bearer");

    const jwks = (await s.app.inject({ method: "GET", url: "/oauth/jwks" })).json<{
      keys: Record<string, string>[];
    }>();
    expect(jwks.keys).toHaveLength(1);
    const jwk = jwks.keys[0] as Record<string, string>;
    expect(jwk).not.toHaveProperty("d");
    const oeffentlich = createPublicKey({ key: jwk, format: "jwk" });
    const [kopf, rumpf, signatur] = t.id_token.split(".") as [string, string, string];
    expect(
      verify(
        "sha256",
        Buffer.from(`${kopf}.${rumpf}`),
        { key: oeffentlich, dsaEncoding: "ieee-p1363" },
        Buffer.from(signatur, "base64url"),
      ),
    ).toBe(true);

    const { kopf: k, rumpf: r } = leseJwt(t.id_token);
    expect(k["alg"]).toBe("ES256");
    expect(k["kid"]).toBe(jwk["kid"]);
    expect(r["iss"]).toBe(ISSUER);
    expect(r["aud"]).toBe(CLIENT_ID);
    expect(r["sub"]).toBe(besucher.guid);
    expect(r["nonce"]).toBe("nonce-1");
    expect(r["given_name"]).toBe("Anna");
    expect(r["family_name"]).toBe("Ahrens");
    expect(r["email"]).toMatch(/@example\.invalid$/);
    expect(r["email_verified"]).toBe(false);
    expect(r["roles"]).toEqual(["idta-passport-besucher"]);
    expect(typeof r["auth_time"]).toBe("number");
    expect(r["at_hash"]).toBe(
      createHash("sha256").update(t.access_token).digest().subarray(0, 16).toString("base64url"),
    );
  });

  it("nimmt die Client-Anmeldung auch per Basic", async () => {
    const { s, besucher } = await aufbau();
    const { verifier, challenge } = pkce();
    const code = await holeCode(s, besucher.keks, challenge);
    const { client_id: _id, client_secret: _geheim, ...rest } = tauschWerte(code, verifier);
    const basic = Buffer.from(
      `${encodeURIComponent(CLIENT_ID)}:${encodeURIComponent(CLIENT_SECRET)}`,
    ).toString("base64");
    const antwort = await tausche(s, rest, { authorization: `Basic ${basic}` });
    expect(antwort.statusCode).toBe(200);
  });

  it("lehnt einen falschen Verifier ab, und danach ist der Code verbraucht", async () => {
    const { s, besucher } = await aufbau();
    const { verifier, challenge } = pkce();
    const code = await holeCode(s, besucher.keks, challenge);
    const falsch = await tausche(s, tauschWerte(code, pkce().verifier));
    expect(falsch.statusCode).toBe(400);
    expect(falsch.json()).toMatchObject({ error: "invalid_grant" });
    const richtig = await tausche(s, tauschWerte(code, verifier));
    expect(richtig.json()).toMatchObject({ error: "invalid_grant" });
  });

  it("loest einen Code nur einmal ein", async () => {
    const { s, besucher } = await aufbau();
    const { verifier, challenge } = pkce();
    const code = await holeCode(s, besucher.keks, challenge);
    expect((await tausche(s, tauschWerte(code, verifier))).statusCode).toBe(200);
    const zweimal = await tausche(s, tauschWerte(code, verifier));
    expect(zweimal.statusCode).toBe(400);
    expect(zweimal.json()).toMatchObject({ error: "invalid_grant" });
  });

  it("lehnt einen abgelaufenen Code ab", async () => {
    const { s, besucher } = await aufbau();
    const { verifier, challenge } = pkce();
    const start = new Date("2026-11-04T10:00:00Z");
    vi.useFakeTimers({ now: start, toFake: ["Date"] });
    const code = await holeCode(s, besucher.keks, challenge);
    vi.setSystemTime(new Date(start.getTime() + 61_000));
    const antwort = await tausche(s, tauschWerte(code, verifier));
    expect(antwort.json()).toMatchObject({ error: "invalid_grant" });
  });

  it("lehnt eine andere redirect_uri beim Tausch ab", async () => {
    const { s, besucher } = await aufbau();
    const { verifier, challenge } = pkce();
    const code = await holeCode(s, besucher.keks, challenge);
    const antwort = await tausche(s, {
      ...tauschWerte(code, verifier),
      redirect_uri: `${REDIRECT}/anders`,
    });
    expect(antwort.json()).toMatchObject({ error: "invalid_grant" });
  });

  it("lehnt ein falsches Client-Geheimnis mit 401 ab", async () => {
    const { s, besucher } = await aufbau();
    const { verifier, challenge } = pkce();
    const code = await holeCode(s, besucher.keks, challenge);
    const antwort = await tausche(s, {
      ...tauschWerte(code, verifier),
      client_secret: `${CLIENT_SECRET}x`,
    });
    expect(antwort.statusCode).toBe(401);
    expect(antwort.json()).toMatchObject({ error: "invalid_client" });
  });

  it("verlangt grant_type authorization_code", async () => {
    const { s } = await aufbau();
    const antwort = await tausche(s, {
      grant_type: "password",
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
    });
    expect(antwort.json()).toMatchObject({ error: "unsupported_grant_type" });
  });
});

describe("OIDC: Autorisierung", () => {
  it("leitet bei unbekannter redirect_uri nicht um", async () => {
    const { s, besucher } = await aufbau();
    const antwort = await s.app.inject({
      method: "GET",
      url: authorizeUrl({
        code_challenge: pkce().challenge,
        redirect_uri: "https://boese.example/fang",
      }),
      headers: { cookie: besucher.keks },
    });
    expect(antwort.statusCode).toBe(400);
    expect(antwort.headers.location).toBeUndefined();
    expect(antwort.body).toContain("Rücksprungadresse");
  });

  it("leitet bei unbekanntem Client nicht um", async () => {
    const { s, besucher } = await aufbau();
    const antwort = await s.app.inject({
      method: "GET",
      url: authorizeUrl({ code_challenge: pkce().challenge, client_id: "fremd" }),
      headers: { cookie: besucher.keks },
    });
    expect(antwort.statusCode).toBe(400);
    expect(antwort.headers.location).toBeUndefined();
  });

  it("verlangt PKCE mit S256, sonst Fehler per Ruecksprung", async () => {
    const { s, besucher } = await aufbau();
    for (const werte of [
      { code_challenge: undefined },
      { code_challenge: pkce().challenge, code_challenge_method: "plain" },
    ]) {
      const antwort = await s.app.inject({
        method: "GET",
        url: authorizeUrl(werte),
        headers: { cookie: besucher.keks },
      });
      expect(antwort.statusCode).toBe(302);
      const ziel = new URL(antwort.headers.location as string);
      expect(ziel.searchParams.get("error")).toBe("invalid_request");
      expect(ziel.searchParams.get("code")).toBeNull();
    }
  });

  it("verlangt scope openid", async () => {
    const { s, besucher } = await aufbau();
    const antwort = await s.app.inject({
      method: "GET",
      url: authorizeUrl({ code_challenge: pkce().challenge, scope: "email" }),
      headers: { cookie: besucher.keks },
    });
    expect(new URL(antwort.headers.location as string).searchParams.get("error")).toBe(
      "invalid_scope",
    );
  });

  it("schickt ohne Sitzung zur Anmeldung und danach hierher zurueck", async () => {
    const { s } = await aufbau();
    const url = authorizeUrl({ code_challenge: pkce().challenge, prompt: "login" });
    const antwort = await s.app.inject({ method: "GET", url });
    expect(antwort.statusCode).toBe(302);
    const ort = antwort.headers.location as string;
    expect(ort.startsWith("/?weiter=")).toBe(true);
    const weiter = decodeURIComponent(ort.slice("/?weiter=".length));
    expect(weiter.startsWith("/oauth/authorize?")).toBe(true);
    // `prompt` faellt weg, sonst verlangte die Rueckkehr gleich wieder eine Anmeldung.
    expect(new URLSearchParams(weiter.split("?")[1]).get("prompt")).toBeNull();
    expect(new URLSearchParams(weiter.split("?")[1]).get("state")).toBe("zustand-1");
  });

  it("meldet bei prompt=none ohne Sitzung login_required", async () => {
    const { s } = await aufbau();
    const antwort = await s.app.inject({
      method: "GET",
      url: authorizeUrl({ code_challenge: pkce().challenge, prompt: "none" }),
    });
    expect(antwort.statusCode).toBe(302);
    expect(new URL(antwort.headers.location as string).searchParams.get("error")).toBe(
      "login_required",
    );
  });

  it("gibt einer Personalsitzung keinen Code", async () => {
    const { s, admin } = await aufbau();
    const antwort = await s.app.inject({
      method: "GET",
      url: authorizeUrl({ code_challenge: pkce().challenge }),
      headers: { cookie: admin },
    });
    expect(antwort.statusCode).toBe(403);
    expect(antwort.headers.location).toBeUndefined();
  });

  it("gibt einem geloeschten Besucher keinen Code mehr", async () => {
    const { s, admin, besucher } = await aufbau();
    await s.app.inject({
      method: "DELETE",
      url: `/api/besucher/${besucher.guid}`,
      headers: { cookie: admin },
    });
    const antwort = await s.app.inject({
      method: "GET",
      url: authorizeUrl({ code_challenge: pkce().challenge }),
      headers: { cookie: besucher.keks },
    });
    expect(antwort.headers.location?.startsWith("/?weiter=")).toBe(true);
  });
});

describe("OIDC: Userinfo", () => {
  async function token(s: Pruefstand, keks: string) {
    const { verifier, challenge } = pkce();
    const code = await holeCode(s, keks, challenge);
    return (await tausche(s, tauschWerte(code, verifier))).json<{ access_token: string }>()
      .access_token;
  }

  it("liefert die Claims zum gueltigen Access-Token", async () => {
    const { s, besucher } = await aufbau();
    const at = await token(s, besucher.keks);
    const antwort = await s.app.inject({
      method: "GET",
      url: "/oauth/userinfo",
      headers: { authorization: `Bearer ${at}` },
    });
    expect(antwort.statusCode).toBe(200);
    expect(antwort.json()).toMatchObject({
      sub: besucher.guid,
      given_name: "Anna",
      roles: ["idta-passport-besucher"],
    });
  });

  it("lehnt ein fremd signiertes, ein abgelaufenes und ein ID-Token ab", async () => {
    const { s, besucher } = await aufbau();
    const fremd = signiere(
      ladeSchluessel(neuerSchluessel()),
      { iss: ISSUER, sub: besucher.guid, exp: Math.floor(Date.now() / 1000) + 60 },
      "at+jwt",
    );
    const echt = await token(s, besucher.keks);
    const { verifier, challenge } = pkce();
    const idToken = (
      await tausche(s, tauschWerte(await holeCode(s, besucher.keks, challenge), verifier))
    ).json<{ id_token: string }>().id_token;

    for (const t of [fremd, idToken, `${echt}x`]) {
      const antwort = await s.app.inject({
        method: "GET",
        url: "/oauth/userinfo",
        headers: { authorization: `Bearer ${t}` },
      });
      expect(antwort.statusCode).toBe(401);
    }

    vi.useFakeTimers({ now: Date.now() + 301_000, toFake: ["Date"] });
    const abgelaufen = await s.app.inject({
      method: "GET",
      url: "/oauth/userinfo",
      headers: { authorization: `Bearer ${echt}` },
    });
    expect(abgelaufen.statusCode).toBe(401);
  });

  it("lehnt das Token eines inzwischen geloeschten Besuchers ab", async () => {
    const { s, admin, besucher } = await aufbau();
    const at = await token(s, besucher.keks);
    await s.app.inject({
      method: "DELETE",
      url: `/api/besucher/${besucher.guid}`,
      headers: { cookie: admin },
    });
    const antwort = await s.app.inject({
      method: "GET",
      url: "/oauth/userinfo",
      headers: { authorization: `Bearer ${at}` },
    });
    expect(antwort.statusCode).toBe(401);
  });
});

describe("OIDC: Konfiguration", () => {
  const basis = { SESSION_SECRET: TEST_SECRET, ...OIDC } as NodeJS.ProcessEnv;

  it("ist aus, wenn nichts gesetzt ist", () => {
    expect(readEnv({ SESSION_SECRET: TEST_SECRET } as NodeJS.ProcessEnv).oidc).toBeNull();
  });

  it("bricht bei halber Konfiguration den Start ab", () => {
    expect(() => readEnv({ ...basis, OIDC_CLIENT_SECRET: "" })).toThrow(/halb eingerichtet/);
  });

  it("verlangt PUBLIC_BASE_URL, ein langes Geheimnis und einen P-256-Schluessel", () => {
    expect(() => readEnv({ ...basis, PUBLIC_BASE_URL: "" })).toThrow(ConfigError);
    expect(() => readEnv({ ...basis, OIDC_CLIENT_SECRET: "kurz" })).toThrow(/zu kurz/);
    const rsa = generateKeyPairSync("rsa", { modulusLength: 2048 })
      .privateKey.export({ format: "pem", type: "pkcs8" })
      .toString();
    expect(() => readEnv({ ...basis, OIDC_SIGNATUR_SCHLUESSEL: rsa })).toThrow(/P-256/);
    expect(() => readEnv({ ...basis, OIDC_SIGNATUR_SCHLUESSEL: "kein pem" })).toThrow(/lesbarer/);
  });

  it("nimmt einen einzeiligen Schluessel mit \\n wie auf Sliplane", () => {
    const einzeilig = SCHLUESSEL.trim().split("\n").join("\\n");
    expect(readEnv({ ...basis, OIDC_SIGNATUR_SCHLUESSEL: einzeilig }).oidc).not.toBeNull();
  });
});
