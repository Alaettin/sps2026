import { expect, request, test, type APIRequestContext } from "@playwright/test";

/**
 * Der Besucher meldet sich selbst an, seit dem 23.10.2026.
 *
 * Er sieht dasselbe wie am Terminal (Begrüßung, „Daten ändern“, „Bild aussuchen“), aber
 * nichts von der Verwaltung. Läuft in den Projekten `desktop` und `handy`, also bei 1440 und
 * 390 px; die Seite selbst startet **ohne** die abgelegte Admin-Sitzung.
 */

const SITZUNG = "e2e/.sitzung.json";

/** Ein eigener API-Kontext als Admin, unabhängig von der leeren Sitzung der Seite. */
async function alsAdmin(): Promise<APIRequestContext> {
  return request.newContext({
    baseURL: test.info().project.use.baseURL,
    storageState: SITZUNG,
  });
}

test.describe("als Besucher", () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test("anmelden, Daten ändern, Bild wählen, abmelden", async ({ page }) => {
    const admin = await alsAdmin();
    const guid = `BL-${String(Date.now()).slice(-8)}`;
    const email = `${guid.toLowerCase()}@example.invalid`;
    const angelegt = await admin.post("/api/besucher", {
      data: { guid, vorname: "Bea", nachname: "Login", email },
    });
    expect(angelegt.status()).toBe(201);

    try {
      await page.goto("/anmeldung");
      await page.getByLabel("E-Mail").fill(email.toUpperCase());
      await page.getByLabel("Passwort").fill("password");
      await page.getByRole("button", { name: "Anmelden" }).click();

      await expect(page).toHaveURL(/\/mein$/);
      await expect(page.getByRole("heading", { name: /Hallo Bea Login/ })).toBeVisible();
      // Nichts aus der Verwaltung: keine Reiter, kein Terminal-„Fertig“.
      await expect(page.getByRole("link", { name: "Besucher" })).toHaveCount(0);
      await expect(page.getByRole("button", { name: "Fertig" })).toHaveCount(0);

      // Eine Verwaltungsadresse führt zurück in den eigenen Bereich.
      await page.goto("/besucher");
      await expect(page).toHaveURL(/\/mein$/);

      // Daten ändern.
      await page.getByRole("button", { name: /Daten ändern/ }).click();
      await page.getByLabel("Firma", { exact: true }).fill("Login GmbH");
      await page.getByRole("button", { name: "Speichern" }).click();
      await expect(page).toHaveURL(/\/mein$/);
      await expect(page.getByText("Login GmbH")).toBeVisible();

      // Bild aussuchen: das erste Galeriebild, danach steht es im Menü und ist geladen.
      await page.getByRole("button", { name: /Bild aussuchen/ }).click();
      await page.getByRole("button", { name: "Bild auswählen" }).first().click();
      await page.getByRole("button", { name: "Speichern" }).click();
      await expect(page).toHaveURL(/\/mein$/);
      const bild = page.getByRole("img", { name: "Dein Bild" });
      await expect
        .poll(() => bild.evaluate((e: HTMLImageElement) => e.naturalWidth))
        .toBeGreaterThan(0);

      const gespeichert = (await (await admin.get(`/api/besucher/${guid}`)).json()) as {
        firma: string;
        avatarDateiId: string;
      };
      expect(gespeichert.firma).toBe("Login GmbH");
      expect(gespeichert.avatarDateiId).not.toBe("00000000-0000-4000-8000-000000000a7a");

      await page.getByRole("button", { name: "Abmelden" }).click();
      await expect(page).toHaveURL(/\/anmeldung$/);
    } finally {
      await admin.delete(`/api/besucher/${guid}`);
      await admin.dispose();
    }
  });

  test("falsche Zugangsdaten lassen nicht hinein", async ({ page }) => {
    await page.goto("/anmeldung");
    await page.getByLabel("E-Mail").fill("sps2026-0001@example.invalid");
    await page.getByLabel("Passwort").fill("falsch");
    await page.getByRole("button", { name: "Anmelden" }).click();
    await expect(page).toHaveURL(/\/anmeldung$/);
  });
});

test("im Besucherdetail lässt sich das Passwort zurücksetzen", async ({ page, request }) => {
  const guid = `PWR-${String(Date.now()).slice(-8)}`;
  await request.post("/api/besucher", {
    data: { guid, vorname: "Paul", nachname: "Reset", email: `${guid}@example.invalid` },
  });
  try {
    await page.goto(`/besucher/${guid}`);
    await expect(page.getByRole("heading", { name: "Anmeldung" })).toBeVisible();
    await page.getByRole("button", { name: "Passwort zurücksetzen" }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Zurücksetzen" }).click();
    await expect(page.getByText("Passwort zurückgesetzt.")).toBeVisible();
  } finally {
    await request.delete(`/api/besucher/${guid}`);
  }
});
