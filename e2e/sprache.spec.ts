import { expect, request, test, type APIRequestContext, type Page } from "@playwright/test";

/**
 * Deutsch und Englisch, seit dem 03.11.2026. Die App startet in der Sprache des Browsers,
 * der Umschalter „DE | EN“ wechselt sie und wird auf dem Gerät gemerkt. Läuft bei 1440 und
 * 390 px; das Terminal prüft `kiosk.spec.ts`.
 */

const SITZUNG = "e2e/.sitzung.json";

let admin: APIRequestContext;
const besucher: string[] = [];

test.beforeEach(async () => {
  admin = await request.newContext({
    baseURL: test.info().project.use.baseURL,
    storageState: SITZUNG,
  });
});

test.afterEach(async () => {
  for (const guid of besucher.splice(0)) await admin.delete(`/api/besucher/${guid}`);
  await admin.dispose();
});

async function keinUeberlauf(page: Page, wo: string) {
  await page.evaluate(() => {
    window.scrollTo(10_000, window.scrollY);
  });
  expect(await page.evaluate(() => window.scrollX), `Überlauf auf ${wo}`).toBe(0);
}

test.describe("ohne Anmeldung", () => {
  test.use({ storageState: { cookies: [], origins: [] }, locale: "en-US" });

  test("englischer Browser startet englisch, der Umschalter wechselt und bleibt", async ({
    page,
  }) => {
    await page.goto("/anmeldung");
    await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
    await expect(page.locator("html")).toHaveAttribute("lang", "en");
    await expect(page.getByText("Your digital trade fair pass for SPS 2026")).toBeVisible();
    await expect(page.getByRole("button", { name: "English" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await keinUeberlauf(page, "Anmeldung englisch");

    await page.getByRole("button", { name: "Deutsch" }).click();
    await expect(page.getByRole("heading", { name: "Anmelden" })).toBeVisible();
    await expect(page.locator("html")).toHaveAttribute("lang", "de");

    // Gemerkt auf dem Gerät: nach dem Neuladen gilt die Wahl, nicht der Browser.
    await page.reload();
    await expect(page.getByRole("heading", { name: "Anmelden" })).toBeVisible();
  });

  test("Rechtsseiten und Fußzeile auf Englisch", async ({ page }) => {
    await page.goto("/datenschutz");
    await expect(page.getByRole("heading", { name: "Privacy notice" })).toBeVisible();
    await expect(page.getByText("Controller", { exact: true })).toBeVisible();
    await expect(page.getByText(/30 November 2027/)).toBeVisible();

    const fuss = page.locator("footer");
    await expect(fuss.getByRole("heading", { name: "Useful links" })).toBeVisible();
    await expect(fuss.getByRole("link", { name: "Become a member" })).toHaveAttribute(
      "href",
      "https://industrialdigitaltwin.org/en/about-idta/become-a-member-en",
    );

    // Seit dem 03.11.2026 zeigen die Links auf Englisch auf die englischen Adressen.
    await expect(fuss.getByRole("link", { name: "Privacy", exact: true })).toHaveAttribute(
      "href",
      "/privacy",
    );
    await fuss.getByRole("link", { name: "Imprint", exact: true }).click();
    await expect(page).toHaveURL(/\/imprint$/);
    await expect(page.getByRole("heading", { name: "Imprint" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Technical operation" })).toBeVisible();

    await fuss.getByRole("link", { name: "Cookie settings", exact: true }).click();
    await expect(page.getByText("only one technically necessary cookie")).toBeVisible();
    await keinUeberlauf(page, "Cookie-Seite englisch");
  });

  test("englische Adressen öffnen die Rechtsseiten direkt, auch auf der Anmeldung verlinkt", async ({
    page,
  }) => {
    await page.goto("/anmeldung");
    const zeile = page.getByRole("navigation", { name: "Legal information" });
    await expect(zeile.getByRole("link", { name: "Imprint", exact: true })).toHaveAttribute(
      "href",
      "/imprint",
    );
    await expect(zeile.getByRole("link", { name: "Privacy", exact: true })).toHaveAttribute(
      "href",
      "/privacy",
    );

    await page.goto("/imprint");
    await expect(page).toHaveURL(/\/imprint$/);
    await expect(page.getByRole("heading", { name: "Imprint" })).toBeVisible();
    await page.goto("/privacy");
    await expect(page).toHaveURL(/\/privacy$/);
    await expect(page.getByRole("heading", { name: "Privacy notice" })).toBeVisible();
  });
});

test.describe("als Besucher", () => {
  test.use({ storageState: { cookies: [], origins: [] }, locale: "en-US" });

  test("der Besucherbereich ist englisch, der Datenschutz kommt in der Sprache", async ({
    page,
  }) => {
    const guid = `SP-${String(Date.now()).slice(-8)}`;
    const email = `${guid.toLowerCase()}@example.invalid`;
    const angelegt = await admin.post("/api/besucher", {
      data: { guid, vorname: "Sam", nachname: "Speaker", email },
    });
    expect(angelegt.status()).toBe(201);
    besucher.push(guid);

    await page.goto("/anmeldung");
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Password").fill("password");
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page.getByRole("heading", { name: /Hello Sam Speaker/ })).toBeVisible();
    await expect(page.getByRole("button", { name: /Exhibits/ })).toBeVisible();
    await keinUeberlauf(page, "Besuchermenü englisch");

    await page.getByRole("button", { name: /Exhibits/ }).click();
    await expect(page.getByRole("heading", { name: "My exhibits (0)" })).toBeVisible();
    await page.getByRole("button", { name: "Back" }).click();

    await page.getByRole("button", { name: /Privacy notice/ }).click();
    await expect(page.getByRole("heading", { name: "Privacy notice" })).toBeVisible();
    await expect(page.getByText("Controller", { exact: true })).toBeVisible();

    // Umschalten lädt den deutschen Text nach.
    await page.getByRole("button", { name: "Deutsch" }).click();
    await expect(page.getByText("Verantwortlicher", { exact: true })).toBeVisible();
  });
});

test.describe("in der Verwaltung", () => {
  test.use({ locale: "en-US" });

  test("Kopfzeile, Listen und Fehlermeldungen auf Englisch", async ({ page }) => {
    await page.goto("/besucher");
    await expect(page.getByRole("heading", { name: "Visitors" })).toBeVisible();
    await expect(page.getByPlaceholder("By name, company, email or GUID")).toBeVisible();
    await keinUeberlauf(page, "Besucherliste englisch");

    await page.goto("/exponate");
    await expect(page.getByRole("heading", { name: "Exhibits" })).toBeVisible();
    // Am Desktop als Spaltenkopf, am Handy als Beschriftung je Zeile.
    await expect(
      page.getByText("Content", { exact: true }).locator("visible=true").first(),
    ).toBeVisible();

    await page.goto("/einstellungen");
    await expect(page.getByRole("heading", { name: "Settings" })).toBeVisible();

    // Ein Serverfehler erscheint übersetzt: eine vergebene E-Mail beim Anlegen.
    const guid = `SP-${String(Date.now()).slice(-8)}`;
    const email = `${guid.toLowerCase()}@example.invalid`;
    expect(
      (
        await admin.post("/api/besucher", { data: { guid, vorname: "A", nachname: "B", email } })
      ).status(),
    ).toBe(201);
    besucher.push(guid);
    await page.goto("/besucher/neu");
    await page.getByLabel("First name").fill("Zweite");
    await page.getByLabel("Last name").fill("Person");
    await page.getByLabel("Email").fill(email);
    await page.getByRole("button", { name: "Save" }).click();
    await expect(page.getByRole("alert")).toHaveText("This email address is already in use.");
  });
});
