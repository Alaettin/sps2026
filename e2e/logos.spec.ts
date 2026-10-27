import { expect, test } from "@playwright/test";
import { pruefeLogoreihe } from "./logos.js";

/**
 * Die Logos in der Kopfzeile der App.
 *
 * Die Anmeldeseite prüft `anmeldung.spec.ts`: sie laeuft als eigenes Projekt **ohne**
 * abgelegte Sitzung, denn mit Sitzung leitet `/anmeldung` auf `/` um.
 */

test("die Kopfzeile zeigt beide Logos in der richtigen Folge", async ({ page }) => {
  await page.goto("/exponate");
  await expect(page.getByRole("heading", { name: "Exponate" })).toBeVisible();
  await pruefeLogoreihe(page, "der Kopfzeile");
});

/**
 * Die Kopfzeile hat seit dem 27.10.2026 nur noch eine Logoreihe; die Navigation wechselt bei
 * 1280 px zwischen Reitern und Menü. Geprüft wird ausdrücklich auch eine Breite **unter**
 * diesem Wechsel und über `sm` (820 px), die sonst kein Projekt ansteuert: dort stehen
 * Logos, Name, „Abmelden“ und Menü zugleich in der Zeile.
 */
test("die Kopfzeile trägt die Logos in jeder Breite genau einmal", async ({ page }) => {
  await page.goto("/exponate");
  await expect(page.getByRole("heading", { name: "Exponate" })).toBeVisible();

  for (const groesse of [
    { width: 1440, height: 900 },
    { width: 820, height: 1180 }, // zwischen sm und lg, der kritische Bereich
    { width: 390, height: 844 },
  ]) {
    await page.setViewportSize(groesse);
    await pruefeLogoreihe(page, `${String(groesse.width)} px`);
  }
});
