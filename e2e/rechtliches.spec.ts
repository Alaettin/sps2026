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

/**
 * Ein Link der „Rechtlichen Hinweise“, in der Fusszeile oder in der Linkzeile der Anmeldung,
 * genau beim Namen: das Impressum nennt `datenschutz@idtwin.org`, und ohne `exact` traefe
 * „Datenschutz“ auch diesen Link.
 */
function fussLink(page: Page, name: string) {
  return page
    .getByRole("navigation", { name: "Rechtliche Hinweise" })
    .getByRole("link", { name, exact: true });
}

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
    "/cookie-einstellungen",
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

test("Anmeldung trägt nur die Linkzeile, die Rechtsseiten öffnen ohne Anmeldung", async ({
  page,
}) => {
  await page.goto("/anmeldung");
  // Seit dem 03.11.2026 keine grosse Fusszeile auf der Anmeldung, nur die schmale Linkzeile.
  await expect(page.locator("footer")).toHaveCount(0);
  for (const [name, ziel] of [
    ["Impressum", "/impressum"],
    ["Datenschutz", "/datenschutz"],
    ["Cookie-Einstellungen", "/cookie-einstellungen"],
  ] as const) {
    await expect(fussLink(page, name)).toBeVisible();
    await expect(fussLink(page, name)).toHaveAttribute("href", ziel);
  }
  await page.evaluate(() => {
    window.scrollTo(10_000, window.scrollY);
  });
  expect(await page.evaluate(() => window.scrollX)).toBe(0);

  await fussLink(page, "Impressum").click();
  await expect(page).toHaveURL(/\/impressum$/);
  await expect(page.getByRole("heading", { name: "Impressum" })).toBeVisible();
  await expect(page.getByText("VR 16747", { exact: false })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Technischer Betrieb" })).toBeVisible();
  await expect(page.getByText("HRB 726560", { exact: false })).toBeVisible();
  await pruefeFusszeile(page, "Impressum");

  await fussLink(page, "Datenschutz").click();
  await expect(page.getByRole("heading", { name: "Datenschutzhinweis" })).toBeVisible();
  await expect(page.getByText(/Fassung vom \d{4}-\d{2}-\d{2}/)).toBeVisible();
  // Das lange Wort lief bei 390 px aus dem weissen Feld; die Seite selbst scrollte dabei nicht.
  // Gemessen wird der Text, nicht der Kasten: der schrumpft mit `min-w-0` auch ohne Umbruch.
  const ueberstand = await page
    .getByRole("heading", { name: "Datenschutzhinweis" })
    .evaluate((h) => {
      const bereich = document.createRange();
      bereich.selectNodeContents(h);
      const feld = h.closest("main > div")?.getBoundingClientRect();
      return bereich.getBoundingClientRect().right - (feld?.right ?? 0);
    });
  expect(ueberstand).toBeLessThanOrEqual(0);
  // Seit Fassung 2026-11-02.3 ohne Platzhalter.
  await expect(page.getByText("30.11.2027", { exact: false })).toBeVisible();
  expect(await page.locator("main").innerText()).not.toContain("[[");

  await fussLink(page, "Cookie-Einstellungen").click();
  await expect(page).toHaveURL(/\/cookie-einstellungen$/);
  await expect(page.getByRole("heading", { name: "Cookie-Einstellungen" })).toBeVisible();
  await expect(page.getByText("nur ein technisch notwendiges Cookie")).toBeVisible();

  // Zurück führt den Weg zurück, hier auf den Datenschutz.
  await page.getByRole("button", { name: "Zurück" }).click();
  await expect(page).toHaveURL(/\/datenschutz$/);

  // Die englischen Adressen gelten auch hier; die Sprache bleibt die des Umschalters.
  await page.goto("/imprint");
  await expect(page).toHaveURL(/\/imprint$/);
  await expect(page.getByRole("heading", { name: "Impressum" })).toBeVisible();
  await page.goto("/privacy");
  await expect(page.getByRole("heading", { name: "Datenschutzhinweis" })).toBeVisible();
  await page.goto("/cookie-settings");
  await expect(page.getByRole("heading", { name: "Cookie-Einstellungen" })).toBeVisible();
  // Die erste Adresse bleibt gültig.
  await page.goto("/cookies");
  await expect(page).toHaveURL(/\/cookies$/);
  await expect(page.getByRole("heading", { name: "Cookie-Einstellungen" })).toBeVisible();
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

  await fussLink(page, "Datenschutz").click();
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
