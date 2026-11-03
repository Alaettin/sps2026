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
  // Seit Fassung 2026-11-02.3 ohne Platzhalter, also kein Entwurfshinweis mehr.
  await expect(page.getByText("noch nicht freigegeben", { exact: false })).toHaveCount(0);
}

test("die Verwaltung bleibt unerreichbar und landet wieder beim Scan", async ({ page }) => {
  for (const pfad of ["/nutzer", "/besucher", "/", "/monitoring", "/mein", "/impressum"]) {
    await page.goto(pfad);
    await expect(page, `${pfad} war erreichbar`).toHaveURL(/\/kiosk$/);
  }
  await expect(page.getByRole("heading", { name: "Pass scannen" })).toBeVisible();
  // Keine Fusszeile am Terminal: von dort soll kein Link nach aussen fuehren.
  await expect(page.locator("footer")).toHaveCount(0);
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

/**
 * Abmelden über den sichtbaren Knopf mit Rückfrage, seit dem 02.11.2026 (vorher drei Sekunden
 * auf einer unbeschrifteten Fläche halten). In einem **eigenen Kontext mit eigener Anmeldung**:
 * die abgelegte Sitzung der übrigen Fälle bleibt so unberührt.
 */
test("das Terminal meldet sich über den Knopf ab, Abbrechen lässt es angemeldet", async ({
  browser,
}) => {
  const kontext = await browser.newContext({ storageState: { cookies: [], origins: [] } });
  const seite = await kontext.newPage();
  const anmeldung = await seite.request.post("/api/auth/anmelden", {
    data: { email: "tablet-abnahme@idta-passport.de", passwort: "tablet-abnahme-2026" },
  });
  expect(anmeldung.status()).toBe(200);
  await seite.goto("/kiosk");
  await expect(seite.getByRole("heading", { name: "Pass scannen" })).toBeVisible();

  // Abbrechen: das Terminal bleibt angemeldet.
  await seite.getByRole("button", { name: "Abmelden" }).click();
  const dialog = seite.getByRole("dialog");
  await expect(dialog.getByRole("heading", { name: "Terminal abmelden?" })).toBeVisible();
  await dialog.getByRole("button", { name: "Abbrechen" }).click();
  await expect(seite.getByRole("dialog")).toHaveCount(0);
  expect((await seite.request.get("/api/auth/ich")).status()).toBe(200);

  // Bestätigen: abgemeldet, zurück auf der Anmeldung.
  await seite.getByRole("button", { name: "Abmelden" }).click();
  await seite.getByRole("dialog").getByRole("button", { name: "Abmelden" }).click();
  await expect(seite).toHaveURL(/\/anmeldung$/);
  expect((await seite.request.get("/api/auth/ich")).status()).toBe(401);
  await kontext.close();
});

/**
 * **Englisch am Terminal**, seit dem 03.11.2026. Ein Gerät mit englischem Browser startet
 * englisch; die Einwilligung wird mit der Sprache gespeichert, in der der Text zu lesen war.
 */
test.describe("auf Englisch", () => {
  test.use({ locale: "en-US" });

  test("ein Besucher registriert sich auf Englisch, die Einwilligung trägt en", async ({
    page,
    request,
  }) => {
    const guid = neueGuid();
    const email = `${guid.toLowerCase()}@example.invalid`;
    try {
      await page.goto("/kiosk");
      await expect(page.getByRole("heading", { name: "Scan pass" })).toBeVisible();
      await expect(page.locator("html")).toHaveAttribute("lang", "en");

      await page.goto(`/kiosk/${guid}`);
      await expect(page.getByRole("heading", { name: "Your details" })).toBeVisible();
      await page.getByLabel("First name").fill("Rita");
      await page.getByLabel("Last name").fill("Registered");
      await page.getByLabel("Email").fill(email);
      await page.getByRole("button", { name: "Next" }).click();

      await expect(page.getByRole("heading", { name: "Set password" })).toBeVisible();
      await page.getByLabel("Password", { exact: true }).fill("secret-123");
      await page.getByLabel("Repeat password").fill("secret-123");
      await page.getByRole("button", { name: "Next" }).click();

      await expect(page.getByRole("heading", { name: "Your picture" })).toBeVisible();
      await page.getByRole("button", { name: "Next" }).click();

      await expect(page.getByRole("heading", { name: "Privacy" })).toBeVisible();
      await expect(page.getByText("Controller", { exact: true })).toBeVisible();
      await expect(page.getByText(/I have read the privacy notice/)).toBeVisible();
      // Zugestimmt wird dem Text, der zu sehen ist: ein Sprachwechsel nimmt den Haken zurück.
      await page.getByRole("checkbox").check();
      await page.getByRole("button", { name: "Deutsch" }).click();
      await expect(page.getByText("Verantwortlicher", { exact: true })).toBeVisible();
      await expect(page.getByRole("checkbox")).not.toBeChecked();
      await page.getByRole("button", { name: "English" }).click();
      await expect(page.getByText("Controller", { exact: true })).toBeVisible();
      await page.getByRole("checkbox").check();
      await page.getByRole("button", { name: "Complete registration" }).click();
      await expect(page.getByRole("heading", { name: "Registration complete" })).toBeVisible();

      await alsAdmin(request);
      const gespeichert = (await (await request.get(`/api/besucher/${guid}`)).json()) as {
        einwilligungSprache: string | null;
      };
      expect(gespeichert.einwilligungSprache).toBe("en");
    } finally {
      await raeumeAuf(request, guid);
    }
  });

  test("Eingaben überleben einen Sprachwechsel, die Zeitsperre setzt die Sprache zurück", async ({
    page,
  }) => {
    const guid = neueGuid();
    await page.clock.install();
    await page.goto(`/kiosk/${guid}`);
    await page.getByLabel("First name").fill("Wechsel");
    await page.getByRole("button", { name: "Deutsch" }).click();
    await expect(page.getByRole("heading", { name: "Deine Daten" })).toBeVisible();
    // Die Eingabe überlebt den Wechsel.
    await expect(page.getByLabel("Vorname")).toHaveValue("Wechsel");

    // Nach Ablauf der Zeitsperre gilt wieder die Sprache des Geräts.
    await page.clock.runFor(96_000);
    await expect(page).toHaveURL(/\/kiosk$/);
    await expect(page.getByRole("heading", { name: "Scan pass" })).toBeVisible();
  });
});
