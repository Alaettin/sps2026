import { expect, test } from "@playwright/test";
import { pruefeLogoreihe } from "./logos.js";

/**
 * Die Anmeldung selbst, **ohne** abgelegte Sitzung.
 *
 * Bewusst sparsam: jeder Fehlversuch verbraucht einen der 10 je Viertelstunde, und die
 * Grenze gilt je E-Mail. Deshalb eine nicht vergebene Adresse fuer den Fehlerfall, damit
 * das Kontingent des Admins fuer die Einrichtung frei bleibt.
 */

test("die Anmeldung laesst sich direkt aufrufen", async ({ page }) => {
  /*
   * Ein direkter Aufruf aus einem Lesezeichen muss genauso gehen wie der Weg ueber `/`.
   * Im AXON Connector hing die Anmeldemaske am Waechter der geschuetzten Routen und zeigte
   * beim direkten Einstieg eine leere Karte samt "Schnittstelle antwortet nicht".
   */
  await page.goto("/anmeldung");
  await expect(page.getByRole("heading", { name: "Anmelden" })).toBeVisible();
  await expect(page.getByText("IDTA Passport").first()).toBeVisible();
  // "Event Manager" ist bei Neoception ein anderes Produkt.
  await expect(page.getByText("Event Manager")).toHaveCount(0);
});

test("eine geschuetzte Route fuehrt zur Anmeldung", async ({ page }) => {
  await page.goto("/einstellungen");
  await expect(page.getByRole("heading", { name: "Anmelden" })).toBeVisible();
});

test("falsche Zugangsdaten nennen nur einen Grund", async ({ page }) => {
  await page.goto("/anmeldung");
  await page.getByLabel("E-Mail").fill("niemand@idta-passport.invalid");
  await page.getByLabel("Passwort").fill("falsch");
  await page.getByRole("button", { name: "Anmelden" }).click();
  await expect(page.getByRole("alert")).toHaveText(/E-Mail oder Passwort ist nicht korrekt/);
});

/**
 * **Der blaue Hintergrund deckt den Sichtbereich ab, auch jenseits des Entwurfs.**
 *
 * Seit dem 02.11.2026 Blau mit Punktraster im Stil von industrialdigitaltwin.org statt des
 * AXON-Keyvisuals. Die Prüfung von damals bleibt: am 08.10.2026 hing das Bild auf
 * `w-[1700px]` und ließ auf einem 3440 px breiten Schirm links und rechts je rund 870 px grau.
 * Gemessen wird in **drei** Größen am Kasten des Hintergrunds, nicht am Augenschein.
 */
test("der blaue Hintergrund füllt den Sichtbereich in jeder Fenstergröße", async ({ page }) => {
  await page.goto("/anmeldung");
  const flaeche = page.locator("[data-hintergrund]");
  await expect(flaeche).toHaveCount(1);
  // Das Keyvisual ist fort: kein Schmuckbild mehr, nur die Logos mit echtem `alt`.
  await expect(page.locator('img[aria-hidden="true"]')).toHaveCount(0);
  // Wirklich IDTA-Blau, nicht das Grau des Grundes.
  expect(await flaeche.evaluate((e) => getComputedStyle(e).backgroundImage)).toContain(
    "rgb(0, 40, 205)",
  );

  for (const groesse of [
    { width: 3440, height: 1440 }, // sehr breit, hier lag der gemeldete Fehler
    { width: 1440, height: 900 }, // der bisherige Normalfall
    { width: 390, height: 844 }, // das Telefon
  ]) {
    await page.setViewportSize(groesse);
    const luecke = await flaeche.evaluate((e) => {
      const k = e.getBoundingClientRect();
      return {
        links: Math.round(k.left),
        oben: Math.round(k.top),
        rechts: Math.round(window.innerWidth - k.right),
        unten: Math.round(window.innerHeight - k.bottom),
      };
    });

    const wo = `${String(groesse.width)}x${String(groesse.height)}`;
    expect(luecke.links, `graue Fläche links bei ${wo}`).toBeLessThanOrEqual(0);
    expect(luecke.oben, `graue Fläche oben bei ${wo}`).toBeLessThanOrEqual(0);
    expect(luecke.rechts, `graue Fläche rechts bei ${wo}`).toBeLessThanOrEqual(0);
    expect(luecke.unten, `graue Fläche unten bei ${wo}`).toBeLessThanOrEqual(0);

    // Kein waagerechter Überlauf.
    await page.evaluate(() => {
      window.scrollTo(10_000, 0);
    });
    expect(await page.evaluate(() => window.scrollX), `Überlauf bei ${wo}`).toBe(0);
  }
});

/** Seit dem 03.11.2026 ohne grosse Fusszeile: auf dem Desktop ist die Anmeldung ein Bildschirm. */
test("die Anmeldung passt bei 1440 x 900 ohne senkrechtes Scrollen", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/anmeldung");
  await expect(page.getByRole("button", { name: "Anmelden" })).toBeVisible();
  await page.evaluate(() => {
    window.scrollTo(0, 99_999);
  });
  expect(await page.evaluate(() => window.scrollY)).toBe(0);
});

test("die Anmeldemaske nennt die Konferenz-Orga nicht mehr", async ({ page }) => {
  await page.goto("/anmeldung");
  await expect(page.getByRole("button", { name: "Anmelden" })).toBeVisible();
  await expect(page.getByText("Konferenz-Orga")).toHaveCount(0);
});

/** Die Logos auf der Anmeldekarte, siehe `logos.ts` zur Begründung des Helfers. */
test("die Anmeldung zeigt beide Logos in der richtigen Folge", async ({ page }) => {
  await page.goto("/anmeldung");
  await expect(page.getByRole("button", { name: "Anmelden" })).toBeVisible();
  await pruefeLogoreihe(page, "der Anmeldung");
});
