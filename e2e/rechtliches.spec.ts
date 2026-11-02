import { expect, request, test, type APIRequestContext, type Page } from "@playwright/test";

/**
 * Die Fusszeile von industrialdigitaltwin.org und die Seiten dahinter, seit dem 02.11.2026.
 * Läuft bei 1440 und 390 px.
 */

const SITZUNG = "e2e/.sitzung.json";

test.use({ storageState: { cookies: [], origins: [] } });

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

/** Fusszeile da, Foto geladen, Links wie in der Vorlage, kein waagerechter Überlauf. */
async function pruefeFusszeile(page: Page, wo: string) {
  const fuss = page.locator("footer");
  await expect(fuss, `keine Fusszeile auf ${wo}`).toHaveCount(1);
  await fuss.scrollIntoViewIfNeeded();
  await expect(fuss).toBeVisible();

  // Das Foto ist ein CSS-Hintergrund; geladen heisst: dieselbe Adresse liefert ein Bild.
  const bild = await fuss.evaluate((e) => getComputedStyle(e).backgroundImage);
  const adresse = /url\("?([^")]+)"?\)/.exec(bild)?.[1];
  expect(adresse, `kein Hintergrundbild auf ${wo}`).toBeTruthy();
  const antwort = await page.request.get(adresse ?? "");
  expect(antwort.status()).toBe(200);
  expect(antwort.headers()["content-type"]).toContain("image/jpeg");

  const nuetzlich = fuss.getByRole("navigation", { name: "Nützliche Links" });
  for (const name of ["Mitglied werden", "Kontakt", "Use Cases", "Newsletter abonnieren"]) {
    const link = nuetzlich.getByRole("link", { name });
    await expect(link).toHaveAttribute("target", "_blank");
    await expect(link).toHaveAttribute("href", /^https:\/\//);
  }
  const rechtlich = fuss.getByRole("navigation", { name: "Rechtliche Hinweise" });
  await expect(rechtlich.getByRole("link", { name: "Impressum" })).toHaveAttribute(
    "href",
    "/impressum",
  );
  await expect(rechtlich.getByRole("link", { name: "Datenschutz" })).toHaveAttribute(
    "href",
    "/datenschutz",
  );
  await expect(rechtlich.getByRole("link", { name: "Cookie-Einstellungen" })).toHaveAttribute(
    "href",
    "/cookies",
  );
  await expect(fuss.getByRole("img", { name: "Plattform INDUSTRIE 4.0" })).toHaveJSProperty(
    "complete",
    true,
  );
  expect(
    await fuss
      .getByRole("img", { name: "Plattform INDUSTRIE 4.0" })
      .evaluate((e: HTMLImageElement) => e.naturalWidth),
  ).toBeGreaterThan(0);
  for (const name of ["GitHub", "LinkedIn", "YouTube"]) {
    await expect(fuss.getByRole("link", { name: `IDTA auf ${name}` })).toHaveAttribute(
      "target",
      "_blank",
    );
  }

  await page.evaluate(() => {
    window.scrollTo(10_000, window.scrollY);
  });
  expect(await page.evaluate(() => window.scrollX), `Überlauf auf ${wo}`).toBe(0);
}

test("Anmeldung trägt die IDTA-Fusszeile, die Rechtsseiten öffnen ohne Anmeldung", async ({
  page,
}) => {
  await page.goto("/anmeldung");
  await pruefeFusszeile(page, "Anmeldung");

  await page.getByRole("link", { name: "Impressum" }).click();
  await expect(page).toHaveURL(/\/impressum$/);
  await expect(page.getByRole("heading", { name: "Impressum" })).toBeVisible();
  await expect(page.getByText("VR 16747", { exact: false })).toBeVisible();
  await pruefeFusszeile(page, "Impressum");

  await page.getByRole("link", { name: "Datenschutz" }).click();
  await expect(page.getByRole("heading", { name: "Datenschutzhinweis" })).toBeVisible();
  await expect(page.getByText(/Fassung vom \d{4}-\d{2}-\d{2}/)).toBeVisible();

  await page.getByRole("link", { name: "Cookie-Einstellungen" }).click();
  await expect(page.getByRole("heading", { name: "Cookie-Einstellungen" })).toBeVisible();
  await expect(page.getByText("nur ein technisch notwendiges Cookie")).toBeVisible();

  // Zurück führt den Weg zurück, hier auf den Datenschutz.
  await page.getByRole("button", { name: "Zurück" }).click();
  await expect(page).toHaveURL(/\/datenschutz$/);
});

test("Der Besucherbereich trägt die Fusszeile, die Rechtsseiten bleiben angemeldet erreichbar", async ({
  page,
}) => {
  const guid = `RS-${String(Date.now()).slice(-8)}`;
  const email = `${guid.toLowerCase()}@example.invalid`;
  const angelegt = await admin.post("/api/besucher", {
    data: { guid, vorname: "Rita", nachname: "Recht", email },
  });
  expect(angelegt.status()).toBe(201);
  besucher.push(guid);

  await page.goto("/anmeldung");
  await page.getByLabel("E-Mail").fill(email);
  await page.getByLabel("Passwort").fill("password");
  await page.getByRole("button", { name: "Anmelden" }).click();
  await expect(page).toHaveURL(/\/mein$/);
  await pruefeFusszeile(page, "Besuchermenü");

  await page.getByRole("link", { name: "Datenschutz" }).click();
  await expect(page).toHaveURL(/\/datenschutz$/);
  await expect(page.getByRole("heading", { name: "Datenschutzhinweis" })).toBeVisible();
  // Angemeldet geblieben: zurück ins Menü statt auf die Anmeldung.
  await page.getByRole("button", { name: "Zurück" }).click();
  await expect(page).toHaveURL(/\/mein$/);
});

test("Das Favicon ist das der IDTA", async ({ page }) => {
  await page.goto("/anmeldung");
  for (const pfad of ["/favicon.ico", "/favicon-32x32.png", "/apple-touch-icon-180x180.png"]) {
    expect((await page.request.get(pfad)).status(), pfad).toBe(200);
  }
  await expect(page.locator('link[rel="icon"][sizes="32x32"]')).toHaveAttribute(
    "href",
    "/favicon-32x32.png",
  );
});
