import { randomUUID } from "node:crypto";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { clearSession, readSession } from "../auth/session.js";
import type { OidcEnv } from "../env.js";
import { notFound } from "../errors.js";
import type { Kontext } from "../kontext.js";
import {
  CHALLENGE_MUSTER,
  TOKEN_LEBENSDAUER_S,
  atHash,
  besucherclaims,
  geheimnisStimmt,
  ladeSchluessel,
  loeseCodeEin,
  pkceStimmt,
  pruefeJwt,
  signiere,
  stelleCodeAus,
  type Signaturschluessel,
} from "../services/oidc.js";

/**
 * OpenID Connect fuer Keycloak der DTI, seit dem 04.11.2026. Fachlich siehe
 * `services/oidc.ts`.
 *
 * Unterstuetzt ist genau, was Keycloak als "OpenID Connect v1.0"-Anbieter braucht:
 * Authorization Code mit PKCE S256, ein vertraulicher Client (Geheimnis per Post oder Basic),
 * ID-Token und Userinfo. Kein Implicit, kein Refresh-Token, kein Logout-Endpunkt.
 *
 * Ohne Konfiguration antworten alle Pfade 404, als gaebe es sie nicht.
 */

const PFAD_AUTHORIZE = "/oauth/authorize";

type Abfrage = Record<string, string | string[] | undefined>;

/** Ein Parameter, der hoechstens einmal vorkommen darf (RFC 6749, 3.1). */
function einzeln(abfrage: Abfrage, name: string): string | undefined | null {
  const wert = abfrage[name];
  if (Array.isArray(wert)) return null;
  return wert === undefined || wert === "" ? undefined : wert;
}

/** Eine Seite fuer Fehler, bei denen **nicht** umgeleitet werden darf. */
function fehlerseite(reply: FastifyReply, status: number, de: string, en: string) {
  return reply
    .code(status)
    .header("content-type", "text/html; charset=utf-8")
    .header("cache-control", "no-store")
    .send(
      `<!doctype html><html lang="de"><head><meta charset="utf-8">` +
        `<meta name="viewport" content="width=device-width,initial-scale=1">` +
        `<title>IDTA Passport</title></head>` +
        `<body style="font-family:system-ui,sans-serif;max-width:36rem;margin:3rem auto;padding:0 1rem">` +
        `<h1 style="font-size:1.25rem">IDTA Passport</h1><p>${de}</p><p lang="en">${en}</p>` +
        `</body></html>`,
    );
}

/** Ein Fehler im OAuth-Format am Token- und Userinfo-Endpunkt. */
function oauthFehler(reply: FastifyReply, status: number, error: string, beschreibung: string) {
  return reply
    .code(status)
    .header("cache-control", "no-store")
    .send({ error, error_description: beschreibung });
}

/**
 * Liest die Client-Anmeldung aus Basic oder aus dem Rumpf. Beides zugleich ist nach RFC 6749
 * (2.3.1) verboten; die Kennung und das Geheimnis sind in Basic formularkodiert.
 */
function clientAusAnfrage(
  req: FastifyRequest,
  rumpf: Record<string, string>,
): { id: string; geheimnis: string; basic: boolean } | "beides" | null {
  const kopf = req.headers.authorization;
  const imRumpf = rumpf["client_secret"] !== undefined;
  if (kopf?.startsWith("Basic ") === true) {
    if (imRumpf) return "beides";
    const roh = Buffer.from(kopf.slice(6), "base64").toString("utf8");
    const trenner = roh.indexOf(":");
    if (trenner < 0) return null;
    try {
      return {
        id: decodeURIComponent(roh.slice(0, trenner).replaceAll("+", " ")),
        geheimnis: decodeURIComponent(roh.slice(trenner + 1).replaceAll("+", " ")),
        basic: true,
      };
    } catch {
      return null;
    }
  }
  const id = rumpf["client_id"];
  const geheimnis = rumpf["client_secret"];
  if (id === undefined || geheimnis === undefined) return null;
  return { id, geheimnis, basic: false };
}

export function oidcRoutes(app: FastifyInstance, ctx: Kontext): void {
  const oidc = ctx.env.oidc;
  const schluessel = oidc === null ? null : ladeSchluessel(oidc.signaturSchluessel);

  function verlange(): { oidc: OidcEnv; schluessel: Signaturschluessel } {
    if (oidc === null || schluessel === null) {
      throw notFound("route-unbekannt", "Unknown route.");
    }
    return { oidc, schluessel };
  }

  app.get("/.well-known/openid-configuration", async (_req, reply) => {
    const { oidc } = verlange();
    void reply.header("cache-control", "public, max-age=300");
    return {
      issuer: oidc.issuer,
      authorization_endpoint: `${oidc.issuer}${PFAD_AUTHORIZE}`,
      token_endpoint: `${oidc.issuer}/oauth/token`,
      userinfo_endpoint: `${oidc.issuer}/oauth/userinfo`,
      jwks_uri: `${oidc.issuer}/oauth/jwks`,
      response_types_supported: ["code"],
      response_modes_supported: ["query"],
      grant_types_supported: ["authorization_code"],
      subject_types_supported: ["public"],
      id_token_signing_alg_values_supported: ["ES256"],
      code_challenge_methods_supported: ["S256"],
      token_endpoint_auth_methods_supported: ["client_secret_post", "client_secret_basic"],
      scopes_supported: ["openid", "email", "profile"],
      claims_supported: [
        "sub",
        "iss",
        "aud",
        "exp",
        "iat",
        "auth_time",
        "nonce",
        "email",
        "email_verified",
        "name",
        "given_name",
        "family_name",
        "preferred_username",
        "roles",
      ],
      prompt_values_supported: ["none", "login"],
      authorization_response_iss_parameter_supported: true,
    };
  });

  app.get("/oauth/jwks", async (_req, reply) => {
    const { schluessel } = verlange();
    void reply.header("cache-control", "public, max-age=300");
    return { keys: [schluessel.jwk] };
  });

  app.get<{ Querystring: Abfrage }>(PFAD_AUTHORIZE, async (req, reply) => {
    const { oidc } = verlange();
    const abfrage = req.query;
    void reply.header("cache-control", "no-store");

    /*
     * **Erst Client und Ruecksprung, dann alles andere.** Solange nicht feststeht, dass
     * `redirect_uri` genau eine eingetragene Adresse ist, wird nirgendwohin umgeleitet, auch
     * nicht mit einer Fehlermeldung: sonst waere dieser Pfad eine offene Weiterleitung mit
     * dem Namen des Passports davor.
     */
    const clientId = einzeln(abfrage, "client_id");
    const redirectUri = einzeln(abfrage, "redirect_uri");
    if (clientId !== oidc.clientId || typeof redirectUri !== "string") {
      return fehlerseite(
        reply,
        400,
        "Diese Anmeldeanfrage ist ungültig: unbekannter Client.",
        "This sign-in request is invalid: unknown client.",
      );
    }
    if (!oidc.redirectUris.includes(redirectUri)) {
      return fehlerseite(
        reply,
        400,
        "Diese Anmeldeanfrage ist ungültig: die Rücksprungadresse ist nicht eingetragen.",
        "This sign-in request is invalid: the redirect address is not registered.",
      );
    }

    const state = einzeln(abfrage, "state");
    function zurueck(werte: Record<string, string>) {
      const ziel = new URL(redirectUri as string);
      for (const [name, wert] of Object.entries(werte)) ziel.searchParams.set(name, wert);
      if (typeof state === "string") ziel.searchParams.set("state", state);
      ziel.searchParams.set("iss", oidc.issuer);
      return reply.redirect(ziel.toString(), 302);
    }
    function fehler(error: string, beschreibung: string) {
      return zurueck({ error, error_description: beschreibung });
    }

    const namen = [
      "response_type",
      "scope",
      "state",
      "nonce",
      "code_challenge",
      "code_challenge_method",
      "prompt",
      "max_age",
    ];
    if (namen.some((name) => einzeln(abfrage, name) === null)) {
      return fehler("invalid_request", "A parameter was given more than once.");
    }
    if (einzeln(abfrage, "response_type") !== "code") {
      return fehler("unsupported_response_type", "Only response_type=code is supported.");
    }
    const scope = einzeln(abfrage, "scope") ?? "";
    if (!scope.split(" ").includes("openid")) {
      return fehler("invalid_scope", "The scope must contain openid.");
    }
    if (
      einzeln(abfrage, "request") !== undefined ||
      einzeln(abfrage, "request_uri") !== undefined
    ) {
      return fehler("request_not_supported", "Request objects are not supported.");
    }
    const challenge = einzeln(abfrage, "code_challenge");
    if (typeof challenge !== "string" || einzeln(abfrage, "code_challenge_method") !== "S256") {
      return fehler("invalid_request", "PKCE with code_challenge_method=S256 is required.");
    }
    if (!CHALLENGE_MUSTER.test(challenge)) {
      return fehler("invalid_request", "The code_challenge is malformed.");
    }
    const prompt = new Set((einzeln(abfrage, "prompt") ?? "").split(" ").filter((p) => p !== ""));
    if (prompt.has("none") && prompt.size > 1) {
      return fehler("invalid_request", "prompt=none cannot be combined with other values.");
    }
    const maxAgeRoh = einzeln(abfrage, "max_age");
    const maxAge = maxAgeRoh === undefined ? null : Number(maxAgeRoh);
    if (maxAge !== null && (!Number.isInteger(maxAge) || maxAge < 0)) {
      return fehler("invalid_request", "max_age must be a non-negative integer.");
    }

    /*
     * Die Sitzung. Nur ein **Besucher** bekommt einen Code; Personal hat in der DTI ueber
     * diesen Weg nichts verloren, und ein Code fuer ein Personalkonto truege als `sub` eine
     * Kennung, die kein Besucher ist.
     */
    const sitzung = readSession(req);
    const authTime =
      sitzung === null ? null : Math.floor((sitzung.exp - ctx.env.sessionTtlMs) / 1000);
    const besucherDa =
      sitzung?.art === "besucher" &&
      besucherclaims(ctx.db, sitzung.sub, "openid", oidc.rollen) !== null;
    const zuAlt = maxAge !== null && authTime !== null && Date.now() / 1000 - authTime > maxAge;

    if (sitzung?.art === "nutzer") {
      return fehlerseite(
        reply,
        403,
        "Sie sind im IDTA Passport als Personal angemeldet. Bitte dort abmelden und mit dem Besucherkonto erneut versuchen.",
        "You are signed in to IDTA Passport as staff. Please sign out there and try again with your visitor account.",
      );
    }

    if (!besucherDa || prompt.has("login") || zuAlt) {
      if (prompt.has("none")) {
        return fehler("login_required", "The visitor is not signed in.");
      }
      /*
       * Zur Anmeldung und danach **hierher zurueck**, ohne `prompt` und `max_age`: sonst
       * verlangte die Rueckkehr gleich wieder eine Anmeldung, und der Besucher kaeme nie an.
       * Bei `prompt=login` wird die bestehende Sitzung beendet, damit wirklich neu
       * angemeldet wird.
       */
      if (besucherDa) clearSession(req, reply);
      const weiter = new URLSearchParams();
      for (const [name, wert] of Object.entries(abfrage)) {
        if (typeof wert === "string" && name !== "prompt" && name !== "max_age") {
          weiter.set(name, wert);
        }
      }
      const ziel = `${PFAD_AUTHORIZE}?${weiter.toString()}`;
      return reply.redirect(`/?weiter=${encodeURIComponent(ziel)}`, 302);
    }

    const nonce = einzeln(abfrage, "nonce");
    const code = stelleCodeAus(ctx.db, {
      besucherGuid: (sitzung as { sub: string }).sub,
      clientId,
      redirectUri,
      codeChallenge: challenge,
      nonce: typeof nonce === "string" ? nonce : null,
      scope,
      authTime: authTime ?? Math.floor(Date.now() / 1000),
    });
    req.log.info("oidc: Code fuer einen Besucher ausgestellt");
    return zurueck({ code });
  });

  /*
   * Der Token-Endpunkt bekommt Formulare (`application/x-www-form-urlencoded`), alles andere
   * im Server JSON. Der Parser haengt deshalb nur in diesem gekapselten Teil.
   */
  void app.register(async (bereich) => {
    bereich.addContentTypeParser(
      "application/x-www-form-urlencoded",
      { parseAs: "string" },
      (_req, rumpf, fertig) => {
        const werte: Record<string, string> = {};
        const doppelt = new Set<string>();
        for (const [name, wert] of new URLSearchParams(rumpf as string)) {
          if (name in werte) doppelt.add(name);
          werte[name] = wert;
        }
        // Doppelte Parameter sind ungueltig (RFC 6749, 3.2); die Route meldet das.
        if (doppelt.size > 0) werte["__doppelt"] = "1";
        fertig(null, werte);
      },
    );

    bereich.post<{ Body: Record<string, string> | undefined }>(
      "/oauth/token",
      { config: { rateLimit: { max: 30, timeWindow: "1 minute" } } },
      async (req, reply) => {
        const { oidc, schluessel } = verlange();
        const rumpf = req.body ?? {};
        if (
          typeof rumpf !== "object" ||
          req.headers["content-type"]?.startsWith("application/x-www-form-urlencoded") !== true
        ) {
          return oauthFehler(reply, 400, "invalid_request", "Expected a form body.");
        }

        const client = clientAusAnfrage(req, rumpf);
        if (client === "beides") {
          return oauthFehler(
            reply,
            400,
            "invalid_request",
            "Use one client authentication method.",
          );
        }
        if (
          client === null ||
          client.id !== oidc.clientId ||
          !geheimnisStimmt(client.geheimnis, oidc.clientSecret)
        ) {
          if (client?.basic === true) {
            void reply.header("www-authenticate", 'Basic realm="idta-passport"');
          }
          return oauthFehler(reply, 401, "invalid_client", "Client authentication failed.");
        }
        if (rumpf["__doppelt"] !== undefined) {
          return oauthFehler(
            reply,
            400,
            "invalid_request",
            "A parameter was given more than once.",
          );
        }
        if (rumpf["grant_type"] !== "authorization_code") {
          return oauthFehler(
            reply,
            400,
            "unsupported_grant_type",
            "Only authorization_code is supported.",
          );
        }
        const code = rumpf["code"];
        const redirectUri = rumpf["redirect_uri"];
        const verifier = rumpf["code_verifier"];
        if (code === undefined || redirectUri === undefined || verifier === undefined) {
          return oauthFehler(
            reply,
            400,
            "invalid_request",
            "code, redirect_uri and code_verifier are required.",
          );
        }

        const eintrag = loeseCodeEin(ctx.db, code);
        if (
          eintrag === null ||
          eintrag.clientId !== client.id ||
          eintrag.redirectUri !== redirectUri ||
          !pkceStimmt(verifier, eintrag.codeChallenge)
        ) {
          return oauthFehler(reply, 400, "invalid_grant", "The code is invalid or expired.");
        }
        const claims = besucherclaims(ctx.db, eintrag.besucherGuid, eintrag.scope, oidc.rollen);
        if (claims === null) {
          return oauthFehler(reply, 400, "invalid_grant", "The visitor no longer exists.");
        }

        const iat = Math.floor(Date.now() / 1000);
        const exp = iat + TOKEN_LEBENSDAUER_S;
        const accessToken = signiere(
          schluessel,
          {
            iss: oidc.issuer,
            sub: claims.sub,
            aud: `${oidc.issuer}/oauth/userinfo`,
            client_id: client.id,
            scope: eintrag.scope,
            iat,
            exp,
            jti: randomUUID(),
          },
          "at+jwt",
        );
        const idToken = signiere(schluessel, {
          ...claims,
          iss: oidc.issuer,
          aud: client.id,
          azp: client.id,
          iat,
          exp,
          auth_time: eintrag.authTime,
          ...(eintrag.nonce === null ? {} : { nonce: eintrag.nonce }),
          at_hash: atHash(accessToken),
        });
        req.log.info("oidc: Token fuer einen Besucher ausgegeben");
        void reply.header("cache-control", "no-store").header("pragma", "no-cache");
        return {
          access_token: accessToken,
          token_type: "Bearer",
          expires_in: TOKEN_LEBENSDAUER_S,
          id_token: idToken,
          scope: eintrag.scope,
        };
      },
    );
  });

  const userinfo = async (req: FastifyRequest, reply: FastifyReply) => {
    const { oidc, schluessel } = verlange();
    void reply.header("cache-control", "no-store");
    const kopf = req.headers.authorization;
    const token = kopf?.startsWith("Bearer ") === true ? kopf.slice(7).trim() : "";
    const nutzlast =
      token === "" ? null : pruefeJwt(schluessel, token, { iss: oidc.issuer, typ: "at+jwt" });
    const claims =
      nutzlast === null
        ? null
        : besucherclaims(
            ctx.db,
            nutzlast["sub"] as string,
            typeof nutzlast["scope"] === "string" ? nutzlast["scope"] : "openid",
            oidc.rollen,
          );
    if (claims === null) {
      void reply.header("www-authenticate", 'Bearer error="invalid_token"');
      return oauthFehler(reply, 401, "invalid_token", "The access token is invalid or expired.");
    }
    return claims;
  };
  // Nur GET: Keycloak fragt so ab, und ein POST braeuchte hier den Formularparser ein zweites Mal.
  app.get("/oauth/userinfo", userinfo);
}
