import { createHash, randomBytes } from "node:crypto";
import { expect, request, test, type APIRequestContext } from "@playwright/test";

/**
 * Anmeldung für den DTI-Viewer, seit dem 04.11.2026: Keycloak schickt den Besucher an
 * `/oauth/authorize`, er meldet sich im Passport an und landet mit einem Code wieder bei
 * Keycloak. Keycloak selbst ist hier abgefangen (`keycloak.test`), der echte Broker-Login
 * wird getrennt gegen einen lokalen Keycloak geprüft.
 *
 * Braucht einen Dienst mit OIDC-Konfiguration und dieser Rücksprungadresse in
 * `OIDC_REDIRECT_URIS`; ohne sie werden die Tests übersprungen.
 */

const SITZUNG = "e2e/.sitzung.json";
const RUECKSPRUNG = "https://keycloak.test/realms/dti/broker/idta-passport/endpoint";

let admin: APIRequestContext;
const angelegt: string[] = [];

test.beforeAll(async () => {
  admin = await request.newContext({
    baseURL: test.info().project.use.baseURL,
    storageState: SITZUNG,
  });
});

test.afterEach(async () => {
  for (const guid of angelegt.splice(0)) await admin.delete(`/api/besucher/${guid}`);
});

test.afterAll(async () => {
  await admin.dispose();
});

test.use({ storageState: { cookies: [], origins: [] } });

async function besucher() {
  const guid = `OIDC-${String(Date.now()).slice(-8)}-${randomBytes(2).toString("hex")}`;
  const email = `${guid.toLowerCase()}@example.invalid`;
  const antwort = await admin.post("/api/besucher", {
    data: { guid, vorname: "Olga", nachname: "Idp", email },
  });
  expect(antwort.status()).toBe(201);
  angelegt.push(guid);
  return { guid, email };
}

function authorizeAdresse() {
  const challenge = createHash("sha256")
    .update(randomBytes(32).toString("base64url"))
    .digest("base64url");
  return `/oauth/authorize?${new URLSearchParams({
    client_id: "dti-keycloak",
    redirect_uri: RUECKSPRUNG,
    response_type: "code",
    scope: "openid email profile",
    state: "zustand-e2e",
    nonce: "nonce-e2e",
    code_challenge: challenge,
    code_challenge_method: "S256",
  }).toString()}`;
}

test.beforeEach(async () => {
  const discovery = await admin.get("/.well-known/openid-configuration");
  test.skip(discovery.status() === 404, "Dienst ohne OIDC-Konfiguration");
});

test("vom DTI-Viewer: anmelden und mit Code zurück zu Keycloak", async ({ page }) => {
  const { email } = await besucher();
  await page.goto(authorizeAdresse());
  await expect(page).toHaveURL(/\/anmeldung$/);
  await expect(page.getByTestId("dti-hinweis")).toBeVisible();

  await page.getByLabel("E-Mail").fill(email);
  await page.getByLabel("Passwort").fill("password");
  /*
   * Auf die Anfrage warten statt sie mit `page.route` abzufangen: eine Navigation, die erst
   * durch die 302 des Servers entsteht, erreicht den Abfang nicht. Die Adresse gibt es nicht,
   * die Navigation scheitert danach; geprüft wird nur, wohin sie wollte.
   */
  const anfrage = page.waitForRequest((r) => r.url().startsWith(`${RUECKSPRUNG}?`));
  await page.getByRole("button", { name: "Anmelden" }).click();

  const ziel = new URL((await anfrage).url());
  expect(ziel.searchParams.get("state")).toBe("zustand-e2e");
  expect(ziel.searchParams.get("code")).toMatch(/^[A-Za-z0-9_-]{43}$/);
});

test("ein fremdes Ziel in weiter wird ignoriert", async ({ page }) => {
  const { email } = await besucher();
  await page.goto(`/?weiter=${encodeURIComponent("https://boese.example/fang")}`);
  await expect(page).toHaveURL(/\/anmeldung$/);
  await expect(page.getByTestId("dti-hinweis")).toHaveCount(0);
  await page.getByLabel("E-Mail").fill(email);
  await page.getByLabel("Passwort").fill("password");
  await page.getByRole("button", { name: "Anmelden" }).click();
  await expect(page).toHaveURL(/\/mein$/);
});
