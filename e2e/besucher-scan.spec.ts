import { expect, request, test, type APIRequestContext, type Page } from "@playwright/test";
import { legeExponatAn, raeumeExponateAuf, scanCode } from "./exponate.js";

/**
 * Der Besucher nimmt ein Exponat auf, seit dem 02.11.2026: QR-Code am Exponat scannen.
 *
 * Der Prüfstand hat keine Kamera mit QR-Code im Bild; geprüft werden deshalb die beiden Wege,
 * die ohne sie auskommen: die Adresse im QR-Code (so öffnet ihn die Kamera-App des Handys),
 * mit der Anmeldung dazwischen, und die Handeingabe des Codes. Läuft bei 1440 und 390 px.
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
  await raeumeExponateAuf(admin);
  await admin.dispose();
});

async function neuerBesucher(): Promise<{ guid: string; email: string }> {
  const guid = `BS-${String(Date.now()).slice(-8)}`;
  const email = `${guid.toLowerCase()}@example.invalid`;
  const angelegt = await admin.post("/api/besucher", {
    data: { guid, vorname: "Sven", nachname: "Scan", email },
  });
  expect(angelegt.status()).toBe(201);
  besucher.push(guid);
  return { guid, email };
}

async function meldeAn(page: Page, email: string) {
  await page.getByLabel("E-Mail").fill(email);
  await page.getByLabel("Passwort").fill("password");
  await page.getByRole("button", { name: "Anmelden" }).click();
}

async function besucht(guid: string, exponatId: string): Promise<boolean | undefined> {
  const liste = (await (await admin.get(`/api/besucher/${guid}/exponate`)).json()) as {
    id: string;
    besucht: boolean;
  }[];
  return liste.find((e) => e.id === exponatId)?.besucht;
}

test("die Adresse aus dem QR-Code nimmt nach der Anmeldung auf", async ({ page }) => {
  const exponat = await legeExponatAn(admin, `Scanziel ${String(Date.now()).slice(-5)}`);
  const code = await scanCode(admin, exponat.id);
  const { guid, email } = await neuerBesucher();

  // Nicht angemeldet: erst die Anmeldung, danach zurück zum Code statt ins Menü.
  await page.goto(`/mein/scan/${code}`);
  await expect(page).toHaveURL(/\/anmeldung$/);
  await meldeAn(page, email);

  await expect(page.getByRole("heading", { name: "Exponat aufgenommen" })).toBeVisible();
  await expect(page.getByText(`${exponat.kennung} ${exponat.name}`)).toBeVisible();
  expect(await besucht(guid, exponat.id)).toBe(true);

  // Im Konnektor steht das Exponat jetzt beim Besucher.
  const werte = (await (
    await admin.post(`/connector/product/${guid}/values`, { data: {} })
  ).json()) as { propertyId: string }[];
  expect(werte.map((w) => w.propertyId)).toContain(`${exponat.kennung}_Name`);

  await page.getByRole("button", { name: "Weiteres Exponat scannen" }).click();
  await expect(page).toHaveURL(/\/mein\/scan$/);
  await expect(page.getByRole("heading", { name: "Exponat scannen" })).toBeVisible();
});

test("über die Kachel mit Handeingabe, ein zweites Mal heißt schon aufgenommen", async ({
  page,
}) => {
  const exponat = await legeExponatAn(admin, `Handeingabe ${String(Date.now()).slice(-5)}`);
  const code = await scanCode(admin, exponat.id);
  const { guid, email } = await neuerBesucher();

  await page.goto("/anmeldung");
  await meldeAn(page, email);
  await expect(page).toHaveURL(/\/mein$/);

  // Kachel „Exponate“, dort der Knopf zum Scannen.
  await page.getByRole("button", { name: /^Exponate/ }).click();
  await expect(page).toHaveURL(/\/mein\/exponate$/);
  await page.getByRole("button", { name: "Exponat scannen" }).click();
  await expect(page).toHaveURL(/\/mein\/scan$/);

  // Ein falscher Code bleibt auf der Seite und sagt es.
  await page.getByLabel("Code vom Exponat").fill("ganz-sicher-kein-gueltiger-code");
  await page.getByRole("button", { name: "Aufnehmen" }).click();
  await expect(page.getByText("Diesen Code kennen wir nicht.", { exact: false })).toBeVisible();
  expect(await besucht(guid, exponat.id)).toBe(false);

  // Die ganze Adresse geht auch, so wie sie unter dem QR-Code steht.
  await page.getByLabel("Code vom Exponat").fill(`https://beispiel.invalid/mein/scan/${code}`);
  await page.getByRole("button", { name: "Aufnehmen" }).click();
  await expect(page.getByRole("heading", { name: "Exponat aufgenommen" })).toBeVisible();
  expect(await besucht(guid, exponat.id)).toBe(true);

  await page.getByRole("button", { name: "Weiteres Exponat scannen" }).click();
  await page.getByLabel("Code vom Exponat").fill(code);
  await page.getByRole("button", { name: "Aufnehmen" }).click();
  await expect(page.getByRole("heading", { name: "Schon aufgenommen" })).toBeVisible();

  // Kein waagerechter Überlauf, auch bei 390 px.
  await page.evaluate(() => {
    window.scrollTo(10_000, 0);
  });
  expect(await page.evaluate(() => window.scrollX)).toBe(0);
});

/** Seit dem 02.11.2026: die Unterseite „Exponate“ mit der Liste, Entfernen mit Rückfrage. */
test("Meine Exponate zeigt das Aufgenommene und entfernt es nach Rückfrage", async ({ page }) => {
  const exponat = await legeExponatAn(admin, `Kasten ${String(Date.now()).slice(-5)}`);
  const code = await scanCode(admin, exponat.id);
  const { guid, email } = await neuerBesucher();

  await page.goto("/anmeldung");
  await meldeAn(page, email);
  await expect(page).toHaveURL(/\/mein$/);
  await page.getByRole("button", { name: /^Exponate/ }).click();
  await expect(page.getByRole("heading", { name: "Exponate", exact: true })).toBeVisible();
  const kasten = page
    .locator("section")
    .filter({ has: page.getByRole("heading", { name: /Meine Exponate/ }) });
  await expect(kasten.getByText("Noch kein Exponat aufgenommen", { exact: false })).toBeVisible();

  await page.goto(`/mein/scan/${code}`);
  await expect(page.getByRole("heading", { name: "Exponat aufgenommen" })).toBeVisible();
  await page.getByRole("button", { name: "Zu meinen Exponaten" }).click();
  await expect(page).toHaveURL(/\/mein\/exponate$/);

  await expect(page.getByRole("heading", { name: "Meine Exponate (1)" })).toBeVisible();
  const zeile = kasten.getByRole("listitem").filter({ hasText: exponat.name });
  await expect(zeile).toContainText(exponat.kennung);

  // Abbrechen lässt es stehen.
  await zeile.getByRole("button", { name: "Entfernen" }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toContainText("scanne den QR-Code am Exponat erneut");
  await dialog.getByRole("button", { name: "Abbrechen" }).click();
  expect(await besucht(guid, exponat.id)).toBe(true);

  await zeile.getByRole("button", { name: "Entfernen" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Entfernen" }).click();
  await expect(page.getByRole("heading", { name: "Meine Exponate (0)" })).toBeVisible();
  expect(await besucht(guid, exponat.id)).toBe(false);

  // Kein waagerechter Überlauf, auch bei 390 px.
  await page.evaluate(() => {
    window.scrollTo(10_000, 0);
  });
  expect(await page.evaluate(() => window.scrollX)).toBe(0);
});

test("Personal landet mit der Scan-Adresse nicht im Besucherbereich", async ({ browser }) => {
  const exponat = await legeExponatAn(admin, `Personal ${String(Date.now()).slice(-5)}`);
  const code = await scanCode(admin, exponat.id);
  const kontext = await browser.newContext({ storageState: SITZUNG });
  const seite = await kontext.newPage();
  await seite.goto(`/mein/scan/${code}`);
  await expect(seite).not.toHaveURL(/\/mein\//);
  await kontext.close();
});
