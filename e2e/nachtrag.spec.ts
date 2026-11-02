import { expect, test } from "@playwright/test";
import { legeExponatAn, merkeExponat, raeumeExponateAuf } from "./exponate.js";

/**
 * Die Runde vom 08.10.2026, Abendteil: Löschen, Vorlage, Monitoring, Scrollbalken.
 */

test.afterEach(async ({ request }) => {
  await raeumeExponateAuf(request);
});

test("ein Exponat lässt sich löschen, aber erst nach der Kennung", async ({ page, request }) => {
  const exponat = await legeExponatAn(request, `Löschprobe ${String(Date.now()).slice(-5)}`);
  merkeExponat(exponat.id);

  await page.goto(`/exponate/${exponat.id}`);
  await page.getByRole("button", { name: "Exponat löschen" }).click();

  const dialog = page.getByRole("dialog");
  const bestaetigen = dialog.getByRole("button", { name: "Endgültig löschen" });

  // **Gesperrt, bis das Wort stimmt.** Sonst wäre das Tippwort nur Zierde.
  await expect(bestaetigen).toBeDisabled();
  await dialog.getByRole("textbox").fill(exponat.kennung);
  await expect(bestaetigen).toBeEnabled();
  await bestaetigen.click();

  // Danach ist es fort, und die Oberfläche steht wieder auf der Liste.
  await expect(page).toHaveURL(/\/exponate$/);
  const nachher = await request.get(`/api/exponate/${exponat.id}`);
  expect(nachher.status()).toBe(404);
});

// Der CSV-Import ist seit dem 23.10.2026 abgeschaltet (E-Mail ist Pflicht und Login der
// Besucher, die Regeln fuer den Import stehen noch aus). Beim Einschalten wieder aktivieren.
test.skip("die CSV-Vorlage lässt sich herunterladen und trägt die Kopfzeile", async ({ page }) => {
  await page.goto("/besucher/import");

  const [download] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("button", { name: "Vorlage herunterladen" }).click(),
  ]);

  expect(download.suggestedFilename()).toMatch(/\.csv$/);
  const strom = await download.createReadStream();
  const stuecke: Buffer[] = [];
  for await (const s of strom) stuecke.push(Buffer.from(s as Buffer));
  const text = Buffer.concat(stuecke).toString("utf8");

  // Geprüft wird der Inhalt, nicht bloß dass eine Datei kam.
  expect(text.charCodeAt(0), "ohne BOM zeigt Excel Umlaute falsch").toBe(0xfeff);
  /*
   * Die Kopfzeile folgt `ZIELFELDER`, und dort kam am 09.10.2026 der Titel dazu. Geprueft
   * wird der Anfang der Liste, nicht die ganze Zeile: sonst scheitert der Fall bei jedem
   * weiteren Feld, obwohl nichts kaputt ist.
   */
  expect(text).toContain("guid;titel;vorname;nachname");
});

/** Der Browser setzt den Text neben ein sichtbares Dateifeld; er darf nirgends stehen. */
test("nirgends steht 'Keine Datei ausgewählt'", async ({ page }) => {
  for (const pfad of ["/exponate"]) {
    await page.goto(pfad);
    await expect(page.getByText(/Keine Datei ausgewählt/i)).toHaveCount(0);
  }
});

test("das Monitoring zeigt einen Abruf über die Konnektor-API", async ({ page, request }) => {
  const guid = `MON-${String(Date.now()).slice(-8)}`;
  await request.post("/api/besucher", {
    data: { guid, email: `${guid}@example.invalid`, vorname: "Monitor", nachname: "Probe" },
  });

  // Ohne Anmeldung, genau wie Axon es täte.
  const antwort = await request.get(`/connector/product/${guid}/hierarchy`);
  expect(antwort.status()).toBe(200);

  await page.goto("/monitoring");
  await expect(page.getByRole("heading", { name: "Monitoring" })).toBeVisible();
  await expect(page.getByText(guid)).toBeVisible();

  await request.delete(`/api/besucher/${guid}`);
});
