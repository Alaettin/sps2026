import { expect, test, type APIRequestContext, type Page } from "@playwright/test";

/**
 * Der Betreuer pflegt sein Exponat, seit dem 02.11.2026: Dokumente, Links und Ansprechpartner
 * anlegen, ändern, löschen. Den Scan hat er nicht mehr, und den QR-Code sieht nur der Admin.
 *
 * Mit genau einem Exponat landet er nach der Anmeldung direkt darin, und kommt über „Zurück
 * zur Liste“ heraus, ohne gleich wieder hineingeleitet zu werden. Abmelden geht über den Rahmen.
 *
 * Dieser Fall braucht eine **eigene Anmeldung** als Betreuer, deshalb ohne abgelegte
 * Sitzung; die Verwaltungsaufrufe laufen über einen eigenen Admin-Kontext.
 */

test.use({ storageState: { cookies: [], origins: [] } });

/** Ein festes Konto, wie beim Tablet; es bleibt über die Läufe stehen. */
const EMAIL = "betreuer-abnahme@idta-passport.de";
const PASSWORT = "betreuer-abnahme-2026";

let admin: APIRequestContext;
let exponatId = "";

test.beforeEach(async ({ playwright }, info) => {
  admin = await playwright.request.newContext({
    baseURL: info.project.use.baseURL,
    storageState: "e2e/.sitzung.json",
  });

  const exponat = await (
    await admin.post("/api/exponate", {
      data: { name: `Betreuer ${String(Date.now()).slice(-5)}` },
    })
  ).json();
  exponatId = exponat.id as string;

  const alle = (await (await admin.get("/api/nutzer")).json()) as { id: string; email: string }[];
  let id = alle.find((n) => n.email === EMAIL)?.id;
  if (id === undefined) {
    const angelegt = await admin.post("/api/nutzer", {
      data: { name: "Betreuer Abnahme", email: EMAIL, rolle: "betreuer" },
    });
    expect(angelegt.status()).toBe(201);
    id = ((await angelegt.json()) as { id: string }).id;
  }
  expect(
    (await admin.post(`/api/nutzer/${id}/passwort`, { data: { passwort: PASSWORT } })).status(),
  ).toBe(200);
  // **Genau ein Exponat**, sonst gibt es keine Weiterleitung.
  expect(
    (await admin.put(`/api/nutzer/${id}/exponate`, { data: { exponate: [exponatId] } })).status(),
  ).toBe(200);
});

test.afterEach(async () => {
  await admin.delete(`/api/exponate/${exponatId}`);
  await admin.dispose();
});

async function melde(page: Page) {
  await page.goto("/anmeldung");
  await page.getByLabel("E-Mail").fill(EMAIL);
  await page.getByLabel("Passwort").fill(PASSWORT);
  await page.getByRole("button", { name: "Anmelden" }).click();
  // Mit genau einem Exponat direkt darin.
  await expect(page).toHaveURL(new RegExp(`/exponate/${exponatId}$`));
}

test("ein Betreuer pflegt Link und Ansprechpartner, ohne Scan und ohne QR-Code", async ({
  page,
}) => {
  await melde(page);
  await expect(page.getByRole("heading", { name: "QR-Code für Besucher" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: /Scannen/ })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Exponat löschen" })).toHaveCount(0);

  // Link anlegen und ändern.
  await page.getByLabel("Titel", { exact: true }).fill("IDTA");
  await page.getByLabel("Adresse").fill("https://industrialdigitaltwin.org/");
  await page.getByRole("button", { name: "Link hinzufügen" }).click();
  await expect(page.getByText("Links (1 von 10)")).toBeVisible();
  await page
    .getByRole("listitem")
    .filter({ hasText: "industrialdigitaltwin.org" })
    .getByRole("button", { name: "Bearbeiten" })
    .click();
  await page.getByRole("dialog").getByLabel("Titel").fill("IDTA Startseite");
  await page.getByRole("dialog").getByRole("button", { name: "Speichern" }).click();
  await expect(page.getByText("IDTA Startseite")).toBeVisible();

  // Ansprechpartner anlegen und wieder entfernen.
  await page.getByRole("button", { name: "Ansprechpartner hinzufügen" }).click();
  await page.getByRole("dialog").getByLabel("Vorname").fill("Bea");
  await page.getByRole("dialog").getByLabel("Nachname").fill("Betreut");
  await page.getByRole("dialog").getByRole("button", { name: "Speichern" }).click();
  await expect(page.getByText("Ansprechpartner (1 von 5)")).toBeVisible();
  await page
    .getByRole("listitem")
    .filter({ hasText: "Bea Betreut" })
    .getByRole("button", { name: "Entfernen" })
    .click();
  await page.getByRole("dialog").getByRole("button", { name: "Entfernen" }).click();
  await expect(page.getByText("Ansprechpartner (0 von 5)")).toBeVisible();

  const stand = (await (await admin.get(`/api/exponate/${exponatId}`)).json()) as {
    links: { titel: string }[];
    kontakte: unknown[];
  };
  expect(stand.links.map((l) => l.titel)).toEqual(["IDTA Startseite"]);
  expect(stand.kontakte).toEqual([]);
});

test("Zurück zur Liste führt nicht wieder ins Exponat, Abmelden geht", async ({ page }) => {
  await melde(page);

  await page.getByRole("link", { name: "← Zurück zur Liste" }).click();
  await expect(page).toHaveURL(/\/exponate$/);
  await expect(page.getByRole("heading", { name: "Exponate" })).toBeVisible();

  // Am Desktop offen in der Kopfzeile; am Handy ist der Knopf ausgeblendet und steht im Menü.
  const offen = page.getByRole("button", { name: "Abmelden" });
  if (await offen.isVisible()) {
    await offen.click();
  } else {
    await page.getByRole("button", { name: "Menü" }).click();
    await page.getByRole("menuitem", { name: "Abmelden" }).click();
  }
  await expect(page.getByRole("heading", { name: "Anmelden" })).toBeVisible();
  expect((await page.request.get("/api/auth/ich")).status()).toBe(401);
});
