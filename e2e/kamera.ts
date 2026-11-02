import { expect, type APIRequestContext, type Page } from "@playwright/test";
import { merkeBesucher } from "./exponate.js";

/**
 * Hilfen für die Kamerafälle.
 *
 * Chromium täuscht mit `--use-fake-device-for-media-stream` Kameras vor, mit
 * `device-count=N` auch mehrere. Die Startoptionen gelten je Datei, deshalb eine Datei je
 * Gerätezahl. Über `localhost` gilt der Kontext als sicher.
 */
export function kameraOptionen(anzahl: number) {
  return {
    permissions: ["camera"],
    launchOptions: {
      args: [
        "--use-fake-ui-for-media-stream",
        `--use-fake-device-for-media-stream=device-count=${String(anzahl)}`,
      ],
    },
  };
}

/**
 * Meldet einen frischen Besucher an, öffnet die Scan-Seite und wartet, bis ein Bild läuft.
 *
 * Seit dem 02.11.2026 scannt der Besucher, nicht mehr der Betreuer; die Kamera steht deshalb
 * unter `/mein/scan`. Die Anmeldung ersetzt im Kontext dieses Falls die Admin-Sitzung.
 */
export async function oeffneKamera(page: Page, request: APIRequestContext): Promise<void> {
  const guid = `KAM-${String(Date.now()).slice(-8)}`;
  const email = `${guid.toLowerCase()}@example.invalid`;
  expect(
    (
      await request.post("/api/besucher", {
        data: { guid, vorname: "Kai", nachname: "Kamera", email },
      })
    ).status(),
  ).toBe(201);
  merkeBesucher(guid);
  expect(
    (
      await page.request.post("/api/auth/anmelden", { data: { email, passwort: "password" } })
    ).status(),
  ).toBe(200);
  await page.goto("/mein/scan");
  await expect
    .poll(() => page.evaluate(() => document.querySelector("video")?.videoWidth ?? 0))
    .toBeGreaterThan(0);
}

/** Von welchem Gerät der laufende Videostrom kommt. */
export function geraet(page: Page): Promise<string | undefined> {
  return page.evaluate(() => {
    const strom = document.querySelector("video")?.srcObject;
    return strom instanceof MediaStream
      ? strom.getVideoTracks()[0]?.getSettings().deviceId
      : undefined;
  });
}
