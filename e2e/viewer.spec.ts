import { expect, test } from "@playwright/test";

/**
 * Die Viewer-Adresse in den Einstellungen, seit dem 03.11.2026. Gesetzt wirkt sie sofort im
 * Besucherdetail, ohne neu anzumelden. Danach wird zurückgesetzt, damit die Terminal-Fälle die
 * Vorgabe behalten.
 */

test.afterEach(async ({ request }) => {
  await request.patch("/api/einstellungen/viewer", { data: { url: "" } });
});

test("die Viewer-Adresse lässt sich setzen und wirkt im Besucherdetail", async ({
  page,
  request,
}) => {
  const liste = (await (await request.get("/api/besucher?groesse=1")).json()) as {
    eintraege: { guid: string }[];
  };
  const guid = liste.eintraege[0]?.guid;
  expect(guid, "Testbestand ohne Besucher").toBeTruthy();

  await page.goto("/einstellungen");
  const feld = page.getByLabel("Adresse des Viewers");
  await expect(feld).toBeVisible();
  await expect(page.getByText(/Kommt aus der Umgebung/)).toBeVisible();

  await feld.fill("https://viewer.test.example/pass");
  await page.getByRole("button", { name: "Speichern", exact: true }).click();
  await expect(page.getByText("In den Einstellungen gesetzt.", { exact: false })).toBeVisible();
  await expect(feld).toHaveValue("https://viewer.test.example/pass/");

  /*
   * **Ohne Neuladen**, innerhalb der App navigiert: so zeigt sich, dass sie `/api/auth/ich`
   * nach dem Speichern neu geholt hat. `page.goto` lüde alles neu und bewiese nichts.
   */
  await page.evaluate(
    (ziel) => {
      window.history.pushState({}, "", ziel);
      window.dispatchEvent(new PopStateEvent("popstate"));
    },
    `/besucher/${String(guid)}`,
  );
  await expect(page.getByRole("link", { name: /Im Viewer öffnen/ })).toHaveAttribute(
    "href",
    `https://viewer.test.example/pass/${String(guid)}`,
  );

  // Ungültig wird abgelehnt und erklärt.
  await page.goto("/einstellungen");
  await page.getByLabel("Adresse des Viewers").fill("ftp://falsch.example/");
  await page.getByRole("button", { name: "Speichern", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("http://");

  // Zurück auf die Vorgabe.
  await page.reload();
  await page.getByRole("button", { name: "Auf Vorgabe zurücksetzen" }).click();
  await expect(page.getByText(/Kommt aus der Umgebung/)).toBeVisible();
});
