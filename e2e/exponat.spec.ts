import { expect, test, type APIRequestContext } from "@playwright/test";
import { legeDokumentAn, legeExponatAn, raeumeExponateAuf } from "./exponate.js";

/**
 * Die Exponatbearbeitung: Links und Ansprechpartner anlegen und ändern, Inhalte ansehen,
 * der QR-Code für Besucher.
 *
 * Das war die Lücke: der Server konnte beides von Anfang an, die Oberfläche zeigte sie nur
 * an und bot kein Formular.
 */

/** Legt ein leeres Exponat an und liefert seine Id. */
async function exponat(request: APIRequestContext): Promise<string> {
  const marke = String(Math.floor(Math.random() * 900) + 100);
  return (await legeExponatAn(request, `Prüfexponat ${marke}`)).id;
}

// Jeder Fall gibt seine Kennungen zurück, siehe die Begründung in `exponate.ts`.
test.afterEach(async ({ request }) => {
  await raeumeExponateAuf(request);
});

test("ein Link lässt sich anlegen und öffnen", async ({ page, request }) => {
  const id = await exponat(request);
  await page.goto(`/exponate/${id}`);

  await page.getByLabel("Titel", { exact: true }).fill("IDTA");
  await page.getByLabel("Adresse").fill("https://industrialdigitaltwin.org/");
  await page.getByRole("button", { name: "Link hinzufügen" }).click();

  // Er steht in der Liste, mit Adresse als Unterzeile.
  await expect(page.getByText("https://industrialdigitaltwin.org/")).toBeVisible();
  await expect(page.getByText("Links (1 von 10)")).toBeVisible();

  /*
   * Das Symbol ist ein echter Link auf die Adresse, **kein** `window.open`: der öffnet
   * unter iOS keinen Tab.
   */
  const oeffnen = page.getByRole("link", { name: "Link in neuem Tab öffnen" });
  await expect(oeffnen).toHaveAttribute("href", "https://industrialdigitaltwin.org/");
  await expect(oeffnen).toHaveAttribute("target", "_blank");
});

/**
 * Ansprechpartner gehören seit dem 02.11.2026 dem Exponat: hier anlegen, ansehen, ändern.
 */
test("ein Ansprechpartner lässt sich am Exponat anlegen, ansehen und ändern", async ({
  page,
  request,
}) => {
  const id = await exponat(request);
  await page.goto(`/exponate/${id}`);

  await page.getByRole("button", { name: "Ansprechpartner hinzufügen" }).click();
  const formular = page.getByRole("dialog");
  await formular.getByLabel("Vorname").fill("Miriam");
  await formular.getByLabel("Nachname").fill("Osterkamp");
  await formular.getByLabel("Firma").fill("Novaplast AG");
  await formular.getByRole("button", { name: "Speichern" }).click();
  await expect(formular).toHaveCount(0);

  await expect(page.getByText("Ansprechpartner (1 von 5)")).toBeVisible();
  await expect(page.getByText("Miriam Osterkamp")).toBeVisible();

  await page.getByRole("button", { name: "Ansprechpartner ansehen" }).click();
  const schau = page.getByRole("dialog");
  await expect(schau.getByRole("heading", { name: "Miriam Osterkamp" })).toBeVisible();
  await expect(schau.getByText("Novaplast AG")).toBeVisible();
  // Kein Foto: Ansprechpartner tragen keines.
  await expect(schau.getByRole("img")).toHaveCount(0);
  await page.keyboard.press("Escape");

  // Ändern: die Firma, der Platz bleibt.
  const zeile = page.getByRole("listitem").filter({ hasText: "Miriam Osterkamp" });
  await zeile.getByRole("button", { name: "Bearbeiten" }).click();
  await expect(page.getByRole("dialog").getByLabel("Vorname")).toHaveValue("Miriam");
  await page.getByRole("dialog").getByLabel("Firma").fill("Novaplast GmbH");
  await page.getByRole("dialog").getByRole("button", { name: "Speichern" }).click();
  await expect(page.getByText(/Novaplast GmbH/)).toBeVisible();

  const gespeichert = (await (await request.get(`/api/exponate/${id}`)).json()) as {
    kontakte: { firma: string; platz: number }[];
  };
  expect(gespeichert.kontakte).toEqual([
    expect.objectContaining({ firma: "Novaplast GmbH", platz: 1 }),
  ]);
});

/** Der QR-Code für Besucher, nur für den Admin, als geladenes Bild und zum Herunterladen. */
test("der Admin sieht den QR-Code des Exponats", async ({ page, request }) => {
  const id = await exponat(request);
  const { scanCode } = (await (await request.get(`/api/exponate/${id}`)).json()) as {
    scanCode: string;
  };
  await page.goto(`/exponate/${id}`);

  await expect(page.getByRole("heading", { name: "QR-Code für Besucher" })).toBeVisible();
  const bild = page.getByRole("img", { name: /QR-Code von/ });
  await expect
    .poll(() => bild.evaluate((e: HTMLImageElement) => e.naturalWidth))
    .toBeGreaterThan(0);
  await expect(page.getByText(`/mein/scan/${scanCode}`)).toBeVisible();
  await expect(page.getByRole("link", { name: "PNG laden" })).toHaveAttribute(
    "download",
    /QR E\d+\.png/,
  );
});

test("ein Bild öffnet sich im Fenster, ein PDF als Link in den Tab", async ({ page, request }) => {
  const id = await exponat(request);

  // Ein Bild und ein PDF über die API einhängen, das spart den Dateidialog.
  for (const [name, typ, inhalt] of [
    [
      "vorschau.png",
      "image/png",
      Buffer.from(
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
        "base64",
      ),
    ],
    ["blatt.pdf", "application/pdf", Buffer.from("%PDF-1.4\n%%EOF\n")],
  ] as const) {
    await legeDokumentAn(request, id, name.replace(/\.[^.]+$/, ""), {
      name,
      mimeType: typ,
      buffer: inhalt,
    });
  }

  await page.goto(`/exponate/${id}`);
  await expect(page.getByText("Dokumente (2 von 10)")).toBeVisible();

  // Das PDF bekommt einen Link in den neuen Tab.
  const pdfLink = page.getByRole("link", { name: "In neuem Tab öffnen" });
  await expect(pdfLink).toHaveAttribute("target", "_blank");
  await expect(pdfLink).toHaveAttribute("href", /\/api\/dateien\//);

  // Das Bild bekommt ein Auge und erscheint groß im Fenster.
  await page.getByRole("button", { name: "Bild ansehen" }).click();
  const schau = page.getByRole("dialog");
  await expect(schau.getByRole("heading", { name: "vorschau" })).toBeVisible();
  await expect(schau.getByRole("img", { name: "vorschau" })).toBeVisible();
});

test("der Hinweis zum Abholweg ist entfernt", async ({ page, request }) => {
  const id = await exponat(request);
  await page.goto(`/exponate/${id}`);
  await expect(page.getByText(/Abholweg/)).toHaveCount(0);
  await expect(page.getByText(/Datenblatt-DE/)).toHaveCount(0);
});
