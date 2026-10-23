import { expect, test, type APIRequestContext, type Page } from "@playwright/test";

/**
 * Das Tablet am Stand, angemeldet als Rolle `kiosk`: Besucher registrieren sich hier selbst,
 * seit dem 23.10.2026.
 *
 * **Der Scanschritt bleibt hier aus.** Der Prüfstand hat keine Kamera, und ein gefälschtes
 * Videogerät liefert ein Testbild ohne QR-Code. Geprüft wird alles **nach** dem Scan: die
 * Seite `/kiosk/<GUID>`, auf die der Scan führt. Dass ein echter Pass vor einer Tabletkamera
 * erkannt wird, bleibt dem Feldtest.
 */

function neueGuid(): string {
  return `REG-${String(Date.now()).slice(-8)}`;
}

/** Meldet den API-Kontext als Admin an; die Seite bleibt das Tablet. */
async function alsAdmin(request: APIRequestContext): Promise<void> {
  const antwort = await request.post("/api/auth/anmelden", {
    data: { email: process.env["ADMIN_EMAIL"], passwort: process.env["ADMIN_PASSWORT"] },
  });
  expect(antwort.status()).toBe(200);
}

async function raeumeAuf(request: APIRequestContext, guid: string): Promise<void> {
  await alsAdmin(request);
  await request.delete(`/api/besucher/${guid}`);
  await request.post("/api/auth/abmelden");
}

/** Füllt die Schritte bis einschließlich Datenschutz aus, ohne abzuschließen. */
async function bisZumDatenschutz(page: Page, guid: string, email: string): Promise<void> {
  await page.goto(`/kiosk/${guid}`);
  await expect(page.getByRole("heading", { name: "Deine Daten" })).toBeVisible();

  await page.getByLabel("Vorname").fill("Rita");
  await page.getByLabel("Nachname").fill("Registriert");
  await page.getByLabel("Firma", { exact: true }).fill("Tablet GmbH");
  await page.getByLabel("E-Mail").fill(email);
  await page.getByRole("button", { name: "Weiter" }).click();

  await expect(page.getByRole("heading", { name: "Passwort festlegen" })).toBeVisible();
  await page.getByLabel("Passwort", { exact: true }).fill("geheim-123");
  await page.getByLabel("Passwort wiederholen").fill("geheim-123");
  await page.getByRole("button", { name: "Weiter" }).click();

  await expect(page.getByRole("heading", { name: "Dein Bild" })).toBeVisible();
  await page.getByRole("button", { name: "Bild auswählen" }).first().click();
  await page.getByRole("button", { name: "Weiter" }).click();

  await expect(page.getByRole("heading", { name: "Datenschutz" })).toBeVisible();
}

test("die Verwaltung bleibt unerreichbar und landet wieder beim Scan", async ({ page }) => {
  for (const pfad of ["/nutzer", "/besucher", "/", "/monitoring", "/mein"]) {
    await page.goto(pfad);
    await expect(page, `${pfad} war erreichbar`).toHaveURL(/\/kiosk$/);
  }
  await expect(page.getByRole("heading", { name: "Pass scannen" })).toBeVisible();
});

/**
 * **Die GUID lässt sich auch von Hand eingeben**, falls Kamera oder QR-Code versagen: als
 * Passnummer oder als ganze Adresse vom Pass. Beides führt zur selben Registrierung.
 */
test("eine GUID von Hand führt zur Registrierung", async ({ page }) => {
  const guid = neueGuid();
  const feld = page.getByLabel("GUID vom Pass");

  await page.goto("/kiosk");
  await feld.fill(guid);
  await page.getByRole("button", { name: "Weiter" }).click();
  await expect(page).toHaveURL(new RegExp(`/kiosk/${guid}$`));
  await expect(page.getByRole("heading", { name: "Deine Daten" })).toBeVisible();

  // Die ganze Adresse vom Pass, so wie sie im QR-Code steht.
  const ich = (await (await page.request.get("/api/auth/ich")).json()) as { viewerBaseUrl: string };
  await page.goto("/kiosk");
  await feld.fill(`${ich.viewerBaseUrl}${guid}`);
  await page.getByRole("button", { name: "Weiter" }).click();
  await expect(page).toHaveURL(new RegExp(`/kiosk/${guid}$`));
});

test("eine ungültige Passnummer bleibt auf dem Scan", async ({ page }) => {
  await page.goto("/kiosk");
  for (const falsch of ["mit leerzeichen", "https://example.com/SPS2026-0001", "x".repeat(51)]) {
    await page.getByLabel("GUID vom Pass").fill(falsch);
    await page.getByRole("button", { name: "Weiter" }).click();
    await expect(page.getByText(/keine gültige Passnummer/), falsch).toBeVisible();
    await expect(page, falsch).toHaveURL(/\/kiosk$/);
  }
});

test("eine schon registrierte GUID von Hand zeigt nur den Hinweis", async ({ page, request }) => {
  const guid = neueGuid();
  await alsAdmin(request);
  await request.post("/api/besucher", {
    data: { guid, vorname: "Schon", nachname: "Da", email: `${guid}@example.invalid` },
  });
  try {
    await page.goto("/kiosk");
    await page.getByLabel("GUID vom Pass").fill(guid);
    await page.getByRole("button", { name: "Weiter" }).click();
    await expect(page.getByRole("heading", { name: /schon registriert/ })).toBeVisible();
  } finally {
    await raeumeAuf(request, guid);
  }
});

test("ein Besucher registriert sich und meldet sich danach selbst an", async ({
  page,
  request,
  browser,
}) => {
  const guid = neueGuid();
  const email = `${guid.toLowerCase()}@example.invalid`;
  try {
    await bisZumDatenschutz(page, guid, email);

    // Ohne Haken geht es nicht weiter; der Haken ist nicht vorbelegt.
    const abschliessen = page.getByRole("button", { name: "Registrierung abschließen" });
    const haken = page.getByRole("checkbox");
    await expect(haken).not.toBeChecked();
    await expect(abschliessen).toBeDisabled();
    await expect(page.getByText(/Verantwortlicher/)).toBeVisible();

    await haken.check();
    await abschliessen.click();
    await expect(page.getByRole("heading", { name: "Registrierung abgeschlossen" })).toBeVisible();
    await expect(page.getByText(email)).toBeVisible();

    // Danach führt der Pass zum Hinweis, nicht zurück ins Formular.
    await page.goto(`/kiosk/${guid}`);
    await expect(page.getByRole("heading", { name: /schon registriert/ })).toBeVisible();
    await expect(page.getByRole("textbox")).toHaveCount(0);

    // Die Einwilligung steht beim Besucher, mit Fassung.
    await alsAdmin(request);
    const gespeichert = (await (await request.get(`/api/besucher/${guid}`)).json()) as {
      firma: string;
      einwilligungAm: number | null;
      einwilligungFassung: string | null;
    };
    expect(gespeichert.firma).toBe("Tablet GmbH");
    expect(gespeichert.einwilligungAm).not.toBeNull();
    expect(gespeichert.einwilligungFassung).not.toBeNull();

    /*
     * Anmelden als Besucher, in einem eigenen Kontext. **Die leere Sitzung muss ausdrücklich
     * dastehen**: `browser.newContext()` erbt im Testlauf die Projekteinstellungen, also die
     * Sitzung des Tablets, und landete sonst wieder beim Scan.
     */
    const kontext = await browser.newContext({ storageState: { cookies: [], origins: [] } });
    const besucher = await kontext.newPage();
    await besucher.goto("/anmeldung");
    await besucher.getByLabel("E-Mail").fill(email);
    await besucher.getByLabel("Passwort").fill("geheim-123");
    await besucher.getByRole("button", { name: "Anmelden" }).click();
    await expect(besucher.getByRole("heading", { name: /Hallo Rita Registriert/ })).toBeVisible();
    await besucher.getByRole("button", { name: /Datenschutzhinweis/ }).click();
    await expect(besucher.getByRole("heading", { name: "Datenschutzhinweis" })).toBeVisible();
    await kontext.close();
  } finally {
    await raeumeAuf(request, guid);
  }
});

test("Pflichtangaben und Passwort werden vor dem Weitergehen geprüft", async ({ page }) => {
  await page.goto(`/kiosk/${neueGuid()}`);
  await page.getByLabel("Vorname").fill("Ohne");
  await page.getByLabel("Nachname").fill("Mail");
  await page.getByRole("button", { name: "Weiter" }).click();
  await expect(page.getByText(/gültige E-Mail-Adresse/)).toBeVisible();
  await expect(page.getByRole("heading", { name: "Deine Daten" })).toBeVisible();

  await page.getByLabel("E-Mail").fill("ohne.mail@example.invalid");
  await page.getByRole("button", { name: "Weiter" }).click();
  await page.getByLabel("Passwort", { exact: true }).fill("kurz");
  await page.getByLabel("Passwort wiederholen").fill("kurz");
  await page.getByRole("button", { name: "Weiter" }).click();
  await expect(page.getByText(/mindestens 8 Zeichen/)).toBeVisible();

  await page.getByLabel("Passwort", { exact: true }).fill("lang-genug-1");
  await page.getByLabel("Passwort wiederholen").fill("lang-genug-2");
  await page.getByRole("button", { name: "Weiter" }).click();
  await expect(page.getByText(/stimmen nicht überein/)).toBeVisible();
});

test("ein vom Personal angelegter Pass zeigt nur den Hinweis", async ({ page, request }) => {
  const guid = neueGuid();
  await alsAdmin(request);
  await request.post("/api/besucher", {
    data: { guid, vorname: "Schon", nachname: "Da", email: `${guid}@example.invalid` },
  });
  try {
    await page.goto(`/kiosk/${guid}`);
    await expect(page.getByRole("heading", { name: /schon registriert/ })).toBeVisible();
    // Keine Daten des Besuchers auf dem Bildschirm.
    await expect(page.getByText("Schon", { exact: true })).toHaveCount(0);
  } finally {
    await raeumeAuf(request, guid);
  }
});

/**
 * **Die Zeitsperre wird gemessen, nicht geglaubt.** Mit `page.clock` wird die Uhr vorgestellt
 * statt gewartet. Geprüft wird, dass die Warnung erscheint, der Bildschirm danach zum Scan
 * springt und die Eingaben dabei verloren sind.
 */
test("nach 90 Sekunden Untätigkeit springt die Registrierung zurück und vergisst alles", async ({
  page,
}) => {
  const guid = neueGuid();
  await page.clock.install();
  await page.goto(`/kiosk/${guid}`);
  await page.getByLabel("Vorname").fill("Vergessen");

  await page.clock.runFor(80_000);
  await expect(page.getByRole("status")).toContainText("Noch da?");
  await expect(page).toHaveURL(new RegExp(`/kiosk/${guid}$`));

  await page.clock.runFor(15_000);
  await expect(page).toHaveURL(/\/kiosk$/);
  await expect(page.getByRole("heading", { name: "Pass scannen" })).toBeVisible();

  await page.goto(`/kiosk/${guid}`);
  await expect(page.getByLabel("Vorname")).toHaveValue("");
});

test("der Hinweis 'Ich bin noch da' hält den Bildschirm", async ({ page }) => {
  const guid = neueGuid();
  await page.clock.install();
  await page.goto(`/kiosk/${guid}`);
  await expect(page.getByRole("heading", { name: "Deine Daten" })).toBeVisible();

  await page.clock.runFor(80_000);
  await page.getByRole("button", { name: "Ich bin noch da" }).click();

  // Wäre die Uhr nicht zurückgesetzt, wäre die Frist jetzt längst abgelaufen.
  await page.clock.runFor(80_000);
  await expect(page).toHaveURL(new RegExp(`/kiosk/${guid}$`));
});
