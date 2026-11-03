import { expect, request, test, type APIRequestContext, type Page } from "@playwright/test";

/**
 * Kontakte unter Besuchern und der eigene Viewer-Link im Menü, seit dem 03.11.2026. Läuft bei
 * 1440 und 390 px. Die Kamera bleibt hier aus dem Spiel; derselbe Weg läuft über die
 * Handeingabe, die die ganze Pass-Adresse annimmt wie ein QR-Code.
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

async function legeAn(kuerzel: string, vorname: string, nachname: string, firma?: string) {
  const guid = `${kuerzel}-${String(Date.now()).slice(-8)}`;
  const email = `${guid.toLowerCase()}@example.invalid`;
  const angelegt = await admin.post("/api/besucher", {
    data: { guid, vorname, nachname, email, firma },
  });
  expect(angelegt.status()).toBe(201);
  besucher.push(guid);
  return { guid, email };
}

async function keinUeberlauf(page: Page, wo: string) {
  await page.evaluate(() => {
    window.scrollTo(10_000, window.scrollY);
  });
  expect(await page.evaluate(() => window.scrollX), `Überlauf auf ${wo}`).toBe(0);
}

test("Viewer-Link im Menü, Kontakt per Pass-Adresse aufnehmen und entfernen", async ({ page }) => {
  const a = await legeAn("KA", "Klara", "Kontakt");
  const b = await legeAn("KB", "Bruno", "Bekannt", "Pumpen AG");

  await page.goto("/anmeldung");
  await page.getByLabel("E-Mail").fill(a.email);
  await page.getByLabel("Passwort").fill("password");
  await page.getByRole("button", { name: "Anmelden" }).click();
  await expect(page).toHaveURL(/\/mein$/);

  const { viewerBaseUrl } = (await (await page.request.get("/api/auth/ich")).json()) as {
    viewerBaseUrl: string;
  };
  const viewer = page.getByRole("link", { name: /Mein Viewer/ });
  await expect(viewer).toHaveAttribute("href", `${viewerBaseUrl}${a.guid}`);
  await expect(viewer).toHaveAttribute("target", "_blank");
  await keinUeberlauf(page, "Besuchermenü");

  await page.getByRole("button", { name: /^Kontakte/ }).click();
  await expect(page).toHaveURL(/\/mein\/kontakte$/);
  await expect(page.getByRole("heading", { name: "Meine Kontakte (0)" })).toBeVisible();
  await page.getByRole("button", { name: "Kontakt scannen" }).click();
  await expect(page).toHaveURL(/\/mein\/kontakte\/scan$/);

  // Ein nicht registrierter Pass wird abgewiesen.
  const feld = page.getByLabel("Passnummer");
  await feld.fill(`${viewerBaseUrl}KX-GIBTESNICHT`);
  await page.getByRole("button", { name: "Aufnehmen" }).click();
  await expect(
    page.getByText("Dieser Pass ist nicht registriert.", { exact: false }),
  ).toBeVisible();

  // Der eigene auch.
  await feld.fill(a.guid);
  await page.getByRole("button", { name: "Aufnehmen" }).click();
  await expect(page.getByText("Das ist dein eigener Pass.")).toBeVisible();

  await feld.fill(`${viewerBaseUrl}${b.guid}`);
  await page.getByRole("button", { name: "Aufnehmen" }).click();
  await expect(page.getByRole("heading", { name: "Kontakt aufgenommen" })).toBeVisible();
  await expect(page.getByText("Bruno Bekannt")).toBeVisible();
  await keinUeberlauf(page, "Kontakt aufgenommen");

  await page.getByRole("button", { name: "Zu meinen Kontakten" }).click();
  await expect(page.getByRole("heading", { name: "Meine Kontakte (1)" })).toBeVisible();
  const zeile = page.getByRole("listitem").filter({ hasText: "Bruno Bekannt" });
  await expect(zeile.getByText("Pumpen AG")).toBeVisible();
  await expect(zeile.getByRole("link", { name: /Viewer öffnen/ })).toHaveAttribute(
    "href",
    `${viewerBaseUrl}${b.guid}`,
  );
  await keinUeberlauf(page, "Kontaktliste");

  await zeile.getByRole("button", { name: "Entfernen" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Entfernen" }).click();
  await expect(page.getByRole("heading", { name: "Meine Kontakte (0)" })).toBeVisible();
});
