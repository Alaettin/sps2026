import { readFileSync } from "node:fs";
import { expect, request, test, type APIRequestContext, type Page } from "@playwright/test";

/**
 * Nachrichten des Besuchers im Messepass, seit dem 23.10.2026. Läuft in `desktop` und
 * `handy`; die Seite startet **ohne** die abgelegte Admin-Sitzung, der Admin arbeitet in einem
 * eigenen Kontext.
 */

const SITZUNG = "e2e/.sitzung.json";
const LEER = { cookies: [], origins: [] };

/**
 * Ein echtes Foto aus der Avatar-Galerie im Repo. Ein von Hand gebautes Mini-PNG lehnte
 * `createImageBitmap` ab, die Seite meldete das korrekt, und der Test prüfte dann nur den
 * Fehlerfall.
 */
const FOTO = readFileSync("apps/server/assets/avatare/avatar-01.jpg");

async function alsAdmin(): Promise<APIRequestContext> {
  return request.newContext({ baseURL: test.info().project.use.baseURL, storageState: SITZUNG });
}

async function anmelden(page: Page, email: string): Promise<void> {
  await page.goto("/anmeldung");
  await page.getByLabel("E-Mail").fill(email);
  await page.getByLabel("Passwort").fill("password");
  await page.getByRole("button", { name: "Anmelden" }).click();
  await expect(page).toHaveURL(/\/mein$/);
}

async function bildGeladen(page: Page, name?: string): Promise<void> {
  const bild =
    name === undefined ? page.locator("main img").first() : page.getByRole("img", { name });
  await expect
    .poll(() => bild.evaluate((e: HTMLImageElement) => e.naturalWidth))
    .toBeGreaterThan(0);
}

test.describe("Nachrichten", () => {
  test.use({ storageState: LEER });

  test("Besucher schreibt, bearbeitet und löscht; der Admin moderiert", async ({
    page,
    browser,
  }) => {
    const admin = await alsAdmin();
    const guid = `MSG-${String(Date.now()).slice(-8)}`;
    const email = `${guid.toLowerCase()}@example.invalid`;
    expect(
      (
        await admin.post("/api/besucher", {
          data: { guid, vorname: "Mia", nachname: "Message", email },
        })
      ).status(),
    ).toBe(201);

    try {
      await anmelden(page, email);
      await page.getByRole("button", { name: /Meine Nachrichten/ }).click();
      await expect(page.getByText("Noch keine Nachricht.")).toBeVisible();
      await expect(page.getByText(/öffentlich im Viewer/)).toBeVisible();

      // Anlegen mit Bild.
      await page.getByRole("button", { name: "Neue Nachricht" }).click();
      await page.getByLabel("Titel").fill("Erster Messetag");
      await page.getByLabel("Text").fill("Viele gute Gespräche.");
      await page.locator('input[type="file"]').setInputFiles({
        name: "foto.jpg",
        mimeType: "image/jpeg",
        buffer: FOTO,
      });
      await bildGeladen(page, "Gewähltes Bild");
      await page.getByRole("button", { name: "Speichern" }).click();
      await expect(page).toHaveURL(/\/mein\/nachrichten$/);
      await expect(page.getByRole("heading", { name: "Erster Messetag" })).toBeVisible();
      await expect(page.getByText("1 von 10")).toBeVisible();
      await bildGeladen(page);

      // Bearbeiten: Titel ändern, Bild entfernen.
      await page.getByRole("button", { name: "Bearbeiten" }).click();
      await expect(page.getByLabel("Titel")).toHaveValue("Erster Messetag");
      await page.getByLabel("Titel").fill("Tag eins");
      await page.getByRole("button", { name: "Bild entfernen" }).click();
      await page.getByRole("button", { name: "Speichern" }).click();
      await expect(page.getByRole("heading", { name: "Tag eins" })).toBeVisible();
      await expect(page.locator("main img")).toHaveCount(0);

      // Eine zweite, die der Besucher selbst löscht.
      await page.getByRole("button", { name: "Neue Nachricht" }).click();
      await page.getByLabel("Titel").fill("Wieder weg");
      await page.getByRole("button", { name: "Speichern" }).click();
      await expect(page.getByText("2 von 10")).toBeVisible();
      await page
        .getByRole("listitem")
        .filter({ hasText: "Wieder weg" })
        .getByRole("button", { name: "Löschen" })
        .click();
      await page.getByRole("dialog").getByRole("button", { name: "Löschen" }).click();
      await expect(page.getByText("1 von 10")).toBeVisible();
      await expect(page.getByRole("heading", { name: "Wieder weg" })).toHaveCount(0);

      // Der Admin sieht die verbliebene im Besucherdetail und löscht sie.
      const kontext = await browser.newContext({ storageState: SITZUNG });
      const verwaltung = await kontext.newPage();
      await verwaltung.goto(`/besucher/${guid}`);
      await expect(verwaltung.getByRole("heading", { name: "Nachrichten (1)" })).toBeVisible();
      await expect(verwaltung.getByText("Tag eins")).toBeVisible();
      await verwaltung
        .getByRole("listitem")
        .filter({ hasText: "Tag eins" })
        .getByRole("button", { name: "Löschen" })
        .click();
      await verwaltung.getByRole("dialog").getByRole("button", { name: "Löschen" }).click();
      await expect(verwaltung.getByRole("heading", { name: "Nachrichten (0)" })).toBeVisible();
      await kontext.close();

      await page.reload();
      await expect(page.getByText("Noch keine Nachricht.")).toBeVisible();
    } finally {
      await admin.delete(`/api/besucher/${guid}`);
      await admin.dispose();
    }
  });
});
