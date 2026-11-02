import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import Database from "better-sqlite3";
import { describe, expect, it } from "vitest";
import { MIGRATIONEN } from "./hilfe.js";

/**
 * Migration 0004/0005 vom 02.11.2026 auf einem Bestand im alten Modell: zentrale
 * Ansprechpartner werden je Exponat kopiert, Zuordnungen werden Besuche, jedes Exponat
 * bekommt einen Scan-Code.
 */

function wende(db: Database.Database, datei: string): void {
  const sqlText = readFileSync(join(MIGRATIONEN, datei), "utf8");
  for (const teil of sqlText.split("--> statement-breakpoint")) {
    if (teil.trim() !== "") db.exec(teil);
  }
}

describe("Migration auf Besuche und Kontakte je Exponat", () => {
  it("kopiert geteilte Ansprechpartner je Exponat und fasst Zuordnungen zu Besuchen", () => {
    const dateien = readdirSync(MIGRATIONEN)
      .filter((d) => d.endsWith(".sql"))
      .sort();
    const alt = dateien.filter((d) => d < "0004");
    const neu = dateien.filter((d) => d >= "0004");
    expect(neu).toHaveLength(2);

    const db = new Database(":memory:");
    db.pragma("foreign_keys = ON");
    for (const d of alt) wende(db, d);

    db.exec(`
      insert into exponate (id, kennung, name) values ('e1', 'E01', 'Eins'), ('e2', 'E02', 'Zwei');
      insert into besucher (guid, vorname, nachname, email) values ('B1', 'A', 'B', 'a@x'), ('B2', 'C', 'D', 'c@x');
      insert into dateien (id, pfad, mime_type, groesse, original_name, sha256)
        values ('f1', 'p', 'application/pdf', 1, 'a.pdf', 'h');
      insert into exponat_dokumente (id, exponat_id, platz, datei_id, titel) values ('d1', 'e1', 1, 'f1', 'Blatt');
      insert into exponat_links (id, exponat_id, platz, url, titel) values ('l1', 'e1', 1, 'https://a/', 'A');
      insert into ansprechpartner (id, titel, vorname, nachname, email) values
        ('k1', 'Dr.', 'Hendrik', 'Sassenberg', 'h@x'), ('k2', null, 'Nur', 'Zentral', null);
      insert into exponat_ansprechpartner (exponat_id, ansprechpartner_id, platz) values ('e1', 'k1', 1), ('e2', 'k1', 3);
      insert into zuordnungen (id, besucher_guid, exponat_id, art, ziel_id, zeitpunkt) values
        ('z1', 'B1', 'e1', 'dokument', 'd1', 2000), ('z2', 'B1', 'e1', 'link', 'l1', 1000);
    `);

    for (const d of neu) wende(db, d);

    const kontakte = db
      .prepare(
        "select exponat_id, platz, titel, vorname, email from exponat_kontakte order by exponat_id",
      )
      .all();
    // Derselbe Mensch an zwei Exponaten: zwei Datensaetze, jeder mit seinem alten Platz.
    expect(kontakte).toEqual([
      { exponat_id: "e1", platz: 1, titel: "Dr.", vorname: "Hendrik", email: "h@x" },
      { exponat_id: "e2", platz: 3, titel: "Dr.", vorname: "Hendrik", email: "h@x" },
    ]);
    const ids = db.prepare("select id from exponat_kontakte").all() as { id: string }[];
    expect(new Set(ids.map((r) => r.id)).size).toBe(2);

    // Zwei Zuordnungen am selben Exponat werden ein Besuch, mit dem fruehesten Zeitpunkt.
    expect(db.prepare("select * from besuche").all()).toEqual([
      { besucher_guid: "B1", exponat_id: "e1", zeitpunkt: 1000 },
    ]);

    const codes = db.prepare("select scan_code from exponate").all() as { scan_code: string }[];
    expect(codes).toHaveLength(2);
    expect(codes[0]?.scan_code).toMatch(/^[0-9a-f]{32}$/);
    expect(codes[0]?.scan_code).not.toBe(codes[1]?.scan_code);

    const tabellen = (
      db.prepare("select name from sqlite_master where type = 'table'").all() as { name: string }[]
    ).map((t) => t.name);
    expect(tabellen).not.toContain("zuordnungen");
    expect(tabellen).not.toContain("ansprechpartner");
    expect(tabellen).not.toContain("exponat_ansprechpartner");
    db.close();
  });
});
