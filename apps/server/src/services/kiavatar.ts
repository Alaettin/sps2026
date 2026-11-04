import { randomUUID } from "node:crypto";
import { eq, lt } from "drizzle-orm";
import type { Dateiablage } from "../ablage/dateien.js";
import type { Db } from "../db/client.js";
import { avatarEntwuerfe, dateien } from "../db/schema.js";
import type { ServerEnv } from "../env.js";
import { AppError, badRequest, notFound } from "../errors.js";
import { HOECHSTGROESSE, haengeAn, type Avatarzeile } from "./avatare.js";

/**
 * KI-Avatare am Terminal, seit dem 04.11.2026, nach dem Vorbild der HMI-App (messeapp,
 * `server/src/services/avatar.ts`).
 *
 * Der Besucher klickt Merkmale an, der Server baut daraus den Prompt und laesst bei OpenAI ein
 * Bild erzeugen. Das Bild ist zuerst ein **Entwurf** (`avatar_entwuerfe`); erst wenn er es
 * uebernimmt, kommt es in die Galerie und steht allen zur Auswahl.
 *
 * **Kein Freitext.** Der Prompt entsteht nur aus den Werten in `MERKMALE`; ein unbekannter
 * Schluessel oder Wert wird abgewiesen. So geht nie ein Name oder eine Passnummer an OpenAI
 * (USA), und in der gemeinsamen Galerie landet nichts, das jemand frei eingetippt hat. So steht
 * es auch im Datenschutzhinweis.
 */

interface Wert {
  id: string;
  de: string;
  en: string;
  /** Der Baustein fuer den Prompt, englisch. */
  prompt: string;
}

export interface Merkmal {
  id: string;
  de: string;
  en: string;
  werte: Wert[];
}

/**
 * Die Auswahl, kuerzer als in der HMI-App: Gesichtsform, Augenfarbe und Statur sind im
 * Kopfbild kaum zu sehen und kosteten nur Tippen; dazu kommt der Hautton, der dort fehlte.
 * Der erste Wert je Merkmal ist die Vorbelegung.
 */
export const MERKMALE: Merkmal[] = [
  {
    id: "geschlecht",
    de: "Geschlecht",
    en: "Gender",
    werte: [
      { id: "maennlich", de: "Männlich", en: "Male", prompt: "man" },
      { id: "weiblich", de: "Weiblich", en: "Female", prompt: "woman" },
      {
        id: "divers",
        de: "Divers",
        en: "Diverse",
        prompt: "person with an androgynous appearance",
      },
    ],
  },
  {
    id: "alter",
    de: "Alter",
    en: "Age",
    werte: [
      { id: "20", de: "20 bis 30", en: "20 to 30", prompt: "in their twenties" },
      { id: "30", de: "30 bis 40", en: "30 to 40", prompt: "in their thirties" },
      { id: "40", de: "40 bis 50", en: "40 to 50", prompt: "in their forties" },
      { id: "50", de: "50 bis 60", en: "50 to 60", prompt: "in their fifties" },
      { id: "60", de: "über 60", en: "over 60", prompt: "in their sixties or older" },
    ],
  },
  {
    id: "hautton",
    de: "Hautton",
    en: "Skin tone",
    werte: [
      { id: "hell", de: "Hell", en: "Light", prompt: "light skin" },
      { id: "mittel", de: "Mittel", en: "Medium", prompt: "medium skin tone" },
      { id: "oliv", de: "Oliv", en: "Olive", prompt: "olive skin tone" },
      { id: "braun", de: "Braun", en: "Brown", prompt: "brown skin" },
      { id: "dunkel", de: "Dunkel", en: "Dark", prompt: "dark skin" },
    ],
  },
  {
    id: "frisur",
    de: "Frisur",
    en: "Hairstyle",
    werte: [
      { id: "kurz", de: "Kurz", en: "Short", prompt: "short hair" },
      { id: "mittel", de: "Mittellang", en: "Medium length", prompt: "medium-length hair" },
      { id: "lang", de: "Lang", en: "Long", prompt: "long hair" },
      { id: "locken", de: "Locken", en: "Curly", prompt: "curly hair" },
      { id: "zopf", de: "Zopf", en: "Ponytail", prompt: "hair tied back in a ponytail" },
      { id: "glatze", de: "Glatze", en: "Bald", prompt: "bald" },
    ],
  },
  {
    id: "haarfarbe",
    de: "Haarfarbe",
    en: "Hair colour",
    werte: [
      { id: "braun", de: "Braun", en: "Brown", prompt: "brown" },
      { id: "schwarz", de: "Schwarz", en: "Black", prompt: "black" },
      { id: "blond", de: "Blond", en: "Blonde", prompt: "blonde" },
      { id: "rot", de: "Rot", en: "Red", prompt: "red" },
      { id: "grau", de: "Grau", en: "Grey", prompt: "grey" },
    ],
  },
  {
    id: "bart",
    de: "Bart",
    en: "Beard",
    werte: [
      { id: "kein", de: "Kein Bart", en: "No beard", prompt: "" },
      { id: "dreitage", de: "Dreitagebart", en: "Stubble", prompt: "light stubble" },
      { id: "voll", de: "Vollbart", en: "Full beard", prompt: "a full beard" },
      { id: "schnurr", de: "Schnurrbart", en: "Moustache", prompt: "a moustache" },
    ],
  },
  {
    id: "brille",
    de: "Brille",
    en: "Glasses",
    werte: [
      { id: "keine", de: "Keine", en: "None", prompt: "" },
      { id: "brille", de: "Brille", en: "Glasses", prompt: "wearing glasses" },
    ],
  },
  {
    id: "kleidung",
    de: "Kleidung",
    en: "Clothing",
    werte: [
      { id: "anzug", de: "Anzug", en: "Suit", prompt: "wearing a dark business suit" },
      {
        id: "business",
        de: "Business casual",
        en: "Business casual",
        prompt: "wearing a business casual blazer over a shirt",
      },
      { id: "hemd", de: "Hemd", en: "Shirt", prompt: "wearing a button-up shirt" },
      { id: "bluse", de: "Bluse", en: "Blouse", prompt: "wearing a blouse" },
      { id: "polo", de: "Polo", en: "Polo", prompt: "wearing a polo shirt" },
      { id: "tshirt", de: "T-Shirt", en: "T-shirt", prompt: "wearing a plain t-shirt" },
    ],
  },
];

/**
 * Welche Merkmale nicht gelten. Die Oberflaeche blendet sie aus, der Server laesst sie aus dem
 * Prompt: bei Glatze gibt es keine Haarfarbe, und "weiblich mit Vollbart" ist kein Fall, den die
 * Auswahl anbieten muss.
 */
export function entfaellt(merkmal: string, wahl: Record<string, string>): boolean {
  if (merkmal === "haarfarbe") return wahl["frisur"] === "glatze";
  if (merkmal === "bart") return wahl["geschlecht"] === "weiblich";
  return false;
}

/** Prueft die Auswahl und fuellt Fehlendes mit der Vorbelegung. Unbekanntes ist ein Fehler. */
export function pruefeMerkmale(roh: unknown): Record<string, string> {
  if (typeof roh !== "object" || roh === null || Array.isArray(roh)) {
    throw badRequest("merkmal-ungueltig", "Field merkmale must be an object.");
  }
  const eingabe = roh as Record<string, unknown>;
  for (const schluessel of Object.keys(eingabe)) {
    if (!MERKMALE.some((m) => m.id === schluessel)) {
      throw badRequest("merkmal-ungueltig", `Unknown feature ${schluessel}.`);
    }
  }
  const wahl: Record<string, string> = {};
  for (const m of MERKMALE) {
    const wert = eingabe[m.id];
    if (wert === undefined) {
      wahl[m.id] = m.werte[0]?.id ?? "";
    } else if (typeof wert === "string" && m.werte.some((w) => w.id === wert)) {
      wahl[m.id] = wert;
    } else {
      throw badRequest("merkmal-ungueltig", `Unknown value for ${m.id}.`);
    }
  }
  return wahl;
}

function baustein(merkmal: string, wahl: Record<string, string>): string {
  if (entfaellt(merkmal, wahl)) return "";
  const m = MERKMALE.find((x) => x.id === merkmal);
  return m?.werte.find((w) => w.id === wahl[merkmal])?.prompt ?? "";
}

/**
 * Der Prompt, im Stil der HMI-App: 3D-Animationsfigur, laechelnd, einfarbiger Hintergrund und
 * ausdruecklich nichts sonst im Bild. Der Hintergrund im IDTA-Blau statt Neoception-Tuerkis.
 */
export function bauePrompt(wahl: Record<string, string>): string {
  const b = (m: string) => baustein(m, wahl);
  const haare =
    wahl["frisur"] === "glatze"
      ? "completely bald with a smooth head and no hair at all"
      : `with ${[b("haarfarbe"), b("frisur")].filter(Boolean).join(" ")}`;
  const teile = [
    `a ${b("geschlecht")} ${b("alter")}`,
    `with ${b("hautton")}`,
    haare,
    b("bart") === "" ? "" : `with ${b("bart")}`,
    b("brille"),
    b("kleidung"),
  ].filter((t) => t !== "");
  return (
    `A 3D rendered headshot of ${teile.join(", ")}. ` +
    "The person is smiling warmly at the camera. Soft studio lighting, solid deep blue background (#0028CD). " +
    "Rendered in a warm, approachable 3D animation style similar to Disney or DreamWorks characters with smooth skin and expressive eyes. " +
    "The image must contain absolutely nothing else: no text, no logos, no icons, no colour swatches, no shapes, " +
    "no borders, no frames, no UI. Just the person on the plain background."
  );
}

/** Wie lange ein Entwurf liegen darf, bevor ihn das naechste Erzeugen wegraeumt. */
export const ENTWURF_LEBENSDAUER_MS = 60 * 60 * 1000;

/**
 * Gemessen in der HMI-App: `gpt-image-2` mit `quality: medium` braucht rund 32 s. Das Terminal
 * sperrt nach 90 s ohne Eingabe; waehrend des Erzeugens haelt die Oberflaeche die Uhr an.
 */
const ZEITLIMIT_MS = 75_000;

/**
 * JPEG mit Kompression, damit das Bild unter `HOECHSTGROESSE` bleibt: es geht als Base64 in
 * jede `values`-Antwort des Konnektors, und ein PNG mit 1024 px waere ein Mehrfaches davon.
 */
const KOMPRESSION = 70;

const kiFehler = (message: string) => new AppError(502, "ki-fehlgeschlagen", message);

async function rufeOpenAi(
  openai: NonNullable<ServerEnv["openai"]>,
  prompt: string,
): Promise<Buffer> {
  let antwort: Response;
  try {
    antwort = await fetch("https://api.openai.com/v1/images/generations", {
      method: "POST",
      headers: {
        authorization: `Bearer ${openai.apiKey}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: openai.bildModell,
        prompt,
        size: "1024x1024",
        quality: "medium",
        n: 1,
        output_format: "jpeg",
        output_compression: KOMPRESSION,
      }),
      signal: AbortSignal.timeout(ZEITLIMIT_MS),
    });
  } catch (ursache) {
    throw kiFehler(
      ursache instanceof Error && ursache.name === "TimeoutError"
        ? "The image service did not answer in time."
        : "The image service is not reachable.",
    );
  }
  const daten = (await antwort.json().catch(() => null)) as {
    data?: { b64_json?: string }[];
    error?: { message?: string };
  } | null;
  if (!antwort.ok) {
    // Die Meldung von OpenAI nennt die Ursache, etwa ein stillgelegtes Modell. Sie muss bis in
    // die Oberflaeche, sonst steht dort nur "fehlgeschlagen" (HMI-App, Oktober 2026).
    throw kiFehler(
      daten?.error?.message ?? `The image service answered ${String(antwort.status)}.`,
    );
  }
  const b64 = daten?.data?.[0]?.b64_json;
  if (b64 === undefined || b64 === "") throw kiFehler(`${openai.bildModell} returned no image.`);
  return Buffer.from(b64, "base64");
}

/** Raeumt Entwuerfe weg, die niemand uebernommen oder verworfen hat. */
export async function raeumeEntwuerfeAuf(db: Db, ablage: Dateiablage, jetzt = Date.now()) {
  const alt = db
    .select({ id: dateien.id, pfad: dateien.pfad })
    .from(avatarEntwuerfe)
    .innerJoin(dateien, eq(dateien.id, avatarEntwuerfe.dateiId))
    .where(lt(avatarEntwuerfe.angelegt, jetzt - ENTWURF_LEBENSDAUER_MS))
    .all();
  for (const d of alt) {
    // Die Zeile in `dateien` nimmt den Entwurf per cascade mit; erst dann die Platte.
    db.delete(dateien).where(eq(dateien.id, d.id)).run();
    await ablage.loesche(d.pfad);
  }
}

/** Erzeugt ein Bild und legt es als Entwurf ab. */
export async function erzeugeEntwurf(
  db: Db,
  ablage: Dateiablage,
  openai: ServerEnv["openai"],
  roheMerkmale: unknown,
): Promise<{ dateiId: string }> {
  if (openai === null) {
    throw new AppError(503, "ki-aus", "AI avatars are not configured on this server.");
  }
  const wahl = pruefeMerkmale(roheMerkmale);
  await raeumeEntwuerfeAuf(db, ablage);

  const bild = await rufeOpenAi(openai, bauePrompt(wahl));
  if (bild.byteLength > HOECHSTGROESSE) {
    throw kiFehler(
      `The generated image has ${String(Math.round(bild.byteLength / 1024))} KB, more than the ${String(Math.round(HOECHSTGROESSE / 1024))} KB allowed for avatars.`,
    );
  }

  const { pfad, sha256, groesse } = await ablage.lege(bild);
  const id = randomUUID();
  const jetzt = Date.now();
  db.transaction((tx) => {
    tx.insert(dateien)
      .values({
        id,
        pfad,
        mimeType: "image/jpeg",
        groesse,
        originalName: "ki-avatar.jpg",
        sha256,
        angelegt: jetzt,
      })
      .run();
    tx.insert(avatarEntwuerfe).values({ dateiId: id, angelegt: jetzt }).run();
  });
  return { dateiId: id };
}

function istEntwurf(db: Db, dateiId: string): boolean {
  return (
    db
      .select({ id: avatarEntwuerfe.dateiId })
      .from(avatarEntwuerfe)
      .where(eq(avatarEntwuerfe.dateiId, dateiId))
      .get() !== undefined
  );
}

/** Nimmt einen Entwurf in die Galerie auf. Danach kann ihn jeder waehlen. */
export function uebernimmEntwurf(db: Db, dateiId: string): Avatarzeile {
  if (!istEntwurf(db, dateiId)) {
    throw notFound("entwurf-unbekannt", "No AI draft with this id.");
  }
  return db.transaction((tx) => {
    tx.delete(avatarEntwuerfe).where(eq(avatarEntwuerfe.dateiId, dateiId)).run();
    return haengeAn(tx, dateiId, "ki");
  });
}

/** Verwirft einen Entwurf samt Datei. Ein Galeriebild ist kein Entwurf und bleibt. */
export async function verwirfEntwurf(db: Db, ablage: Dateiablage, dateiId: string): Promise<void> {
  if (!istEntwurf(db, dateiId)) {
    throw notFound("entwurf-unbekannt", "No AI draft with this id.");
  }
  const datei = db
    .select({ pfad: dateien.pfad })
    .from(dateien)
    .where(eq(dateien.id, dateiId))
    .get();
  db.delete(dateien).where(eq(dateien.id, dateiId)).run();
  if (datei !== undefined) await ablage.loesche(datei.pfad);
}
