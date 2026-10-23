import { afterEach, describe, expect, it } from "vitest";
import { dateien } from "../src/db/schema.js";
import { FELDER_BESUCHER } from "../src/modell/modell.js";
import { MAX_NACHRICHTEN } from "../src/modell/felder.js";
import { melde, starte, type Pruefstand } from "./hilfe.js";

/**
 * Nachrichten des Besuchers im Messepass, seit dem 23.10.2026: Titel, Text, optional ein Bild,
 * Zeit automatisch. Der Konnektor gibt sie auf festen Plaetzen aus.
 */

const ADMIN = { ADMIN_EMAIL: "admin@idta-passport.de", ADMIN_PASSWORT: "startpasswort-123" };

let stand: Pruefstand | null = null;
afterEach(async () => {
  await stand?.ende();
  stand = null;
});

/** Ein winziges, gueltiges PNG. */
const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);

const GRENZE = "----passportnachricht";

/** Ein Multipart-Koerper aus Feldern und optional einer Datei `bild`. */
function mehrteilig(felder: Record<string, string>, datei?: { name: string; inhalt: Buffer }) {
  const stuecke: Buffer[] = [];
  for (const [name, wert] of Object.entries(felder)) {
    stuecke.push(
      Buffer.from(
        `--${GRENZE}\r\nContent-Disposition: form-data; name="${name}"\r\n\r\n${wert}\r\n`,
      ),
    );
  }
  if (datei !== undefined) {
    stuecke.push(
      Buffer.from(
        `--${GRENZE}\r\nContent-Disposition: form-data; name="bild"; filename="${datei.name}"\r\n` +
          "Content-Type: application/octet-stream\r\n\r\n",
      ),
      datei.inhalt,
      Buffer.from("\r\n"),
    );
  }
  stuecke.push(Buffer.from(`--${GRENZE}--\r\n`));
  return {
    headers: { "content-type": `multipart/form-data; boundary=${GRENZE}` },
    payload: Buffer.concat(stuecke),
  };
}

interface Nachricht {
  id: string;
  platz: number;
  titel: string | null;
  text: string | null;
  bildDateiId: string | null;
  angelegt: number;
}

async function aufbau() {
  stand = await starte(ADMIN);
  const s = stand;
  const admin = await melde(s, "admin@idta-passport.de", "startpasswort-123");
  for (const [guid, email] of [
    ["NA-1", "anna@example.invalid"],
    ["NA-2", "bernd@example.invalid"],
  ]) {
    await s.app.inject({
      method: "POST",
      url: "/api/besucher",
      headers: { cookie: admin },
      payload: { guid, vorname: "Nora", nachname: "Nachricht", email },
    });
  }
  const anna = await melde(s, "anna@example.invalid", "password");
  const bernd = await melde(s, "bernd@example.invalid", "password");

  const lege = (
    keks: string,
    felder: Record<string, string>,
    datei?: { name: string; inhalt: Buffer },
  ) => {
    const k = mehrteilig(felder, datei);
    return s.app.inject({
      method: "POST",
      url: "/api/mein/nachrichten",
      headers: { cookie: keks, ...k.headers },
      payload: k.payload,
    });
  };
  const aendere = (
    keks: string,
    id: string,
    felder: Record<string, string>,
    datei?: { name: string; inhalt: Buffer },
  ) => {
    const k = mehrteilig(felder, datei);
    return s.app.inject({
      method: "PATCH",
      url: `/api/mein/nachrichten/${id}`,
      headers: { cookie: keks, ...k.headers },
      payload: k.payload,
    });
  };
  const liste = async (keks: string) =>
    (await s.app.inject({ url: "/api/mein/nachrichten", headers: { cookie: keks } })).json<
      Nachricht[]
    >();
  const dateiDa = (id: string) =>
    s.ctx.db
      .select()
      .from(dateien)
      .all()
      .some((d) => d.id === id);
  const werte = async (guid: string) =>
    (
      await s.app.inject({ method: "POST", url: `/connector/product/${guid}/values`, payload: {} })
    ).json<{ propertyId: string; value: string; mimeType?: string; needsResolve?: boolean }[]>();

  return { s, admin, anna, bernd, lege, aendere, liste, dateiDa, werte };
}

describe("Nachrichten: anlegen, aendern, loeschen", () => {
  it("legt eine Nachricht mit Bild an und zeigt das Bild dem Besucher", async () => {
    const { s, anna, lege, liste } = await aufbau();
    const antwort = await lege(
      anna,
      { titel: "Hallo", text: "Erster Tag" },
      { name: "foto.png", inhalt: PNG },
    );
    expect(antwort.statusCode).toBe(201);
    const n = antwort.json<Nachricht>();
    expect(n).toMatchObject({ platz: 1, titel: "Hallo", text: "Erster Tag" });
    expect(n.bildDateiId).not.toBeNull();
    expect(typeof n.angelegt).toBe("number");

    expect(await liste(anna)).toHaveLength(1);
    const bild = await s.app.inject({
      url: `/api/mein/bild/${n.bildDateiId!}`,
      headers: { cookie: anna },
    });
    expect(bild.statusCode).toBe(200);
  });

  it("aendert Text und Bild; das alte Bild ist danach weg, die Zeit bleibt", async () => {
    const { anna, lege, aendere, dateiDa } = await aufbau();
    const n = (await lege(anna, { titel: "A" }, { name: "a.png", inhalt: PNG })).json<Nachricht>();

    const ersetzt = (
      await aendere(anna, n.id, { text: "Neu" }, { name: "b.png", inhalt: PNG })
    ).json<Nachricht>();
    expect(ersetzt).toMatchObject({ titel: "A", text: "Neu", angelegt: n.angelegt });
    expect(ersetzt.bildDateiId).not.toBe(n.bildDateiId);
    expect(dateiDa(n.bildDateiId!), "altes Bild liegt noch in der Ablage").toBe(false);

    const ohne = (await aendere(anna, n.id, { bildEntfernen: "true" })).json<Nachricht>();
    expect(ohne.bildDateiId).toBeNull();
    expect(dateiDa(ersetzt.bildDateiId!)).toBe(false);
  });

  it("loescht samt Bild und gibt den Platz frei", async () => {
    const { s, anna, lege, liste, dateiDa } = await aufbau();
    const eins = (
      await lege(anna, { titel: "1" }, { name: "a.png", inhalt: PNG })
    ).json<Nachricht>();
    await lege(anna, { titel: "2" });

    const weg = await s.app.inject({
      method: "DELETE",
      url: `/api/mein/nachrichten/${eins.id}`,
      headers: { cookie: anna },
    });
    expect(weg.statusCode).toBe(204);
    expect(dateiDa(eins.bildDateiId!)).toBe(false);

    const neu = (await lege(anna, { titel: "3" })).json<Nachricht>();
    expect(neu.platz, "der freie Platz 1 wird wieder vergeben").toBe(1);
    expect((await liste(anna)).map((n) => n.platz).sort()).toEqual([1, 2]);
  });

  it(`nimmt hoechstens ${String(MAX_NACHRICHTEN)} Nachrichten an`, async () => {
    const { anna, lege } = await aufbau();
    for (let i = 1; i <= MAX_NACHRICHTEN; i++) {
      expect((await lege(anna, { titel: `N${String(i)}` })).statusCode).toBe(201);
    }
    const zuviel = await lege(anna, { titel: "eine zu viel" }, { name: "a.png", inhalt: PNG });
    expect(zuviel.statusCode).toBe(409);
    expect(zuviel.json<{ code: string }>().code).toBe("kontingent-erschoepft");
  });

  it("weist Leeres, zu Langes, Nicht-Bilder und zu grosse Bilder ab", async () => {
    const { anna, lege, liste } = await aufbau();
    const faelle: [
      string,
      Record<string, string>,
      { name: string; inhalt: Buffer } | undefined,
      number,
    ][] = [
      ["leer", { titel: " ", text: "" }, undefined, 400],
      ["Titel zu lang", { titel: "x".repeat(101) }, undefined, 400],
      ["Text zu lang", { text: "x".repeat(2001) }, undefined, 400],
      ["PDF", { titel: "T" }, { name: "datei.pdf", inhalt: Buffer.from("%PDF-1.4") }, 400],
      [
        "zu gross",
        { titel: "T" },
        { name: "gross.jpg", inhalt: Buffer.alloc(5 * 1024 * 1024 + 1) },
        413,
      ],
    ];
    for (const [was, felder, datei, status] of faelle) {
      expect((await lege(anna, felder, datei)).statusCode, was).toBe(status);
    }
    expect(await liste(anna), "ein abgewiesener Fall hat etwas angelegt").toHaveLength(0);
  });
});

describe("Nachrichten: wer darf was", () => {
  it("laesst einen Besucher nicht an fremde Nachrichten", async () => {
    const { s, anna, bernd, lege, aendere, liste } = await aufbau();
    const n = (
      await lege(anna, { titel: "Annas" }, { name: "a.png", inhalt: PNG })
    ).json<Nachricht>();

    expect((await aendere(bernd, n.id, { titel: "Bernds" })).statusCode).toBe(404);
    const weg = await s.app.inject({
      method: "DELETE",
      url: `/api/mein/nachrichten/${n.id}`,
      headers: { cookie: bernd },
    });
    expect(weg.statusCode).toBe(404);
    const bild = await s.app.inject({
      url: `/api/mein/bild/${n.bildDateiId!}`,
      headers: { cookie: bernd },
    });
    expect(bild.statusCode).toBe(403);

    expect(await liste(bernd)).toHaveLength(0);
    expect((await liste(anna))[0]?.titel).toBe("Annas");
  });

  it("laesst Unangemeldete und Personal nicht an den Besucherbereich", async () => {
    const { s, admin } = await aufbau();
    expect((await s.app.inject({ url: "/api/mein/nachrichten" })).statusCode).toBe(401);
    expect(
      (await s.app.inject({ url: "/api/mein/nachrichten", headers: { cookie: admin } })).statusCode,
    ).toBe(401);
  });

  it("zeigt sie dem Admin und laesst ihn loeschen", async () => {
    const { s, admin, anna, bernd, lege, liste, dateiDa } = await aufbau();
    const n = (
      await lege(anna, { titel: "Unpassend" }, { name: "a.png", inhalt: PNG })
    ).json<Nachricht>();

    const sicht = await s.app.inject({
      url: "/api/besucher/NA-1/nachrichten",
      headers: { cookie: admin },
    });
    expect(sicht.json<Nachricht[]>().map((x) => x.titel)).toEqual(["Unpassend"]);

    // Ein Besucher kommt an diese Route nicht.
    expect(
      (await s.app.inject({ url: "/api/besucher/NA-1/nachrichten", headers: { cookie: bernd } }))
        .statusCode,
    ).toBe(401);
    // Unter der falschen GUID ist die Nachricht nicht zu finden.
    const falsch = await s.app.inject({
      method: "DELETE",
      url: `/api/besucher/NA-2/nachrichten/${n.id}`,
      headers: { cookie: admin },
    });
    expect(falsch.statusCode).toBe(404);

    const weg = await s.app.inject({
      method: "DELETE",
      url: `/api/besucher/NA-1/nachrichten/${n.id}`,
      headers: { cookie: admin },
    });
    expect(weg.statusCode).toBe(204);
    expect(await liste(anna)).toHaveLength(0);
    expect(dateiDa(n.bildDateiId!)).toBe(false);
  });

  it("raeumt die Bilder weg, wenn der Besucher geloescht wird", async () => {
    const { s, admin, anna, lege, dateiDa } = await aufbau();
    const n = (
      await lege(anna, { titel: "Weg" }, { name: "a.png", inhalt: PNG })
    ).json<Nachricht>();
    await s.app.inject({ method: "DELETE", url: "/api/besucher/NA-1", headers: { cookie: admin } });
    expect(dateiDa(n.bildDateiId!)).toBe(false);
  });
});

describe("Nachrichten im Konnektor", () => {
  it("hat alle Plaetze im Modell, das Bild als Dokument", async () => {
    const { s } = await aufbau();
    const felder = (await s.app.inject({ url: "/connector/model" })).json<
      { id: string; type: number }[]
    >();
    const plaetze = felder.filter((f) => f.id.startsWith("Visitor_Msg"));
    expect(plaetze).toHaveLength(MAX_NACHRICHTEN * 4);
    expect(felder.find((f) => f.id === "Visitor_Msg10_Image")?.type).toBe(1);
    expect(felder.filter((f) => f.id.startsWith("Visitor_"))).toHaveLength(FELDER_BESUCHER);
  });

  it("liefert Titel, Text, Zeit und Bild, auch ohne Zuordnung am Exponat", async () => {
    const { anna, lege, werte } = await aufbau();
    await lege(anna, { titel: "Hallo", text: "Grüße" }, { name: "foto.png", inhalt: PNG });
    await lege(anna, { text: "Nur Text" });

    const w = await werte("NA-1");
    const wert = (id: string) => w.find((x) => x.propertyId === id);
    expect(wert("Visitor_Msg01_Title")?.value).toBe("Hallo");
    expect(wert("Visitor_Msg01_Text")?.value).toBe("Grüße");
    expect(wert("Visitor_Msg01_Time")?.value).toMatch(/^\d{2}\.\d{2}\.\d{4}, \d{2}:\d{2}$/);
    // Bild geht By Value, nie ueber den Ticketweg.
    expect(wert("Visitor_Msg01_Image")).toMatchObject({
      mimeType: "image/png",
      needsResolve: false,
    });
    expect(wert("Visitor_Msg01_Image")?.value).toBe(PNG.toString("base64"));
    // Leere Teile fallen aus.
    expect(wert("Visitor_Msg02_Title")).toBeUndefined();
    expect(wert("Visitor_Msg02_Image")).toBeUndefined();
    expect(wert("Visitor_Msg02_Text")?.value).toBe("Nur Text");
  });

  it("nimmt eine geloeschte Nachricht aus den Werten", async () => {
    const { s, anna, lege, werte } = await aufbau();
    const n = (await lege(anna, { titel: "Kurz" })).json<Nachricht>();
    await s.app.inject({
      method: "DELETE",
      url: `/api/mein/nachrichten/${n.id}`,
      headers: { cookie: anna },
    });
    expect((await werte("NA-1")).filter((x) => x.propertyId.startsWith("Visitor_Msg"))).toEqual([]);
  });
});
