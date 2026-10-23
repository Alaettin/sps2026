import type { FastifyInstance } from "fastify";
import { pruefePasswort } from "../auth/passwort.js";
import { clearSession, issueSession, readSession } from "../auth/session.js";
import { anmeldungFalsch, badRequest } from "../errors.js";
import type { Kontext } from "../kontext.js";
import { findeNutzerPerEmail, merkeAnmeldung } from "../services/nutzer.js";
import { findeBesucher } from "../services/besucher.js";
import { pruefeBesucherAnmeldung } from "../services/besucherzugang.js";

interface AnmeldeKoerper {
  email?: unknown;
  passwort?: unknown;
}

export function authRoutes(app: FastifyInstance, ctx: Kontext): void {
  app.post<{ Body: AnmeldeKoerper }>(
    "/api/auth/anmelden",
    {
      /*
       * **Keine Anmeldegrenze.** Bis zum 09.10.2026 standen hier 10 Versuche je
       * Viertelstunde und E-Mail. Auf ausdrueckliche Entscheidung entfernt: am Stand
       * sperrte sie einen Betreuer mit Tippfehler fuer eine Viertelstunde aus, und sie
       * legte wiederholt die eigene Abnahme lahm.
       *
       * **Was damit wegfaellt:** das Durchprobieren von Passwoertern ist jetzt
       * unbegrenzt. Wer eine Betreuer-E-Mail kennt, kann beliebig raten. Geblieben sind
       * argon2id beim Hashen und die gleiche Fehlermeldung fuer jeden Fall, also kein
       * Hinweis darauf, ob eine Adresse existiert.
       */
    },
    async (req, reply) => {
      const { email, passwort } = req.body ?? {};
      if (typeof email !== "string" || typeof passwort !== "string") {
        throw badRequest("felder-fehlen", "Fields email and passwort are required.");
      }

      const reihe = findeNutzerPerEmail(ctx.db, email);

      /*
       * **Kein Personal mit dieser E-Mail: dann vielleicht ein Besucher.** Gibt es die Adresse
       * bei beiden, gewinnt das Personal; der Besucher kommt dann nicht hinein, statt dass
       * ein Passwort entscheidet, welches Konto gemeint war.
       */
      if (reihe === null) {
        const guid = await pruefeBesucherAnmeldung(ctx.db, email, passwort);
        if (guid === null) throw anmeldungFalsch();
        const person = findeBesucher(ctx.db, guid);
        issueSession(
          req,
          reply,
          { art: "besucher", sub: guid, exp: Date.now() + ctx.env.sessionTtlMs },
          ctx.env,
        );
        return {
          id: guid,
          name: `${person.vorname} ${person.nachname}`,
          email: person.email,
          rolle: "besucher",
        };
      }

      /*
       * Ohne Treffer hasht `pruefeBesucherAnmeldung` ins Leere, siehe `pruefeInsLeere`.
       *
       * Deaktivierte Nutzer laufen durch dieselbe Pruefung und bekommen dieselbe Meldung:
       * ob jemand gesperrt ist, geht die Anmeldemaske nichts an.
       */
      const stimmt = await pruefePasswort(reihe.passwortHash, passwort);
      if (!reihe.aktiv || !stimmt) throw anmeldungFalsch();

      merkeAnmeldung(ctx.db, reihe.id);
      issueSession(
        req,
        reply,
        { art: "nutzer", sub: reihe.id, exp: Date.now() + ctx.env.sessionTtlMs },
        ctx.env,
      );
      return {
        id: reihe.id,
        name: reihe.name,
        email: reihe.email,
        rolle: reihe.rolle,
      };
    },
  );

  app.post("/api/auth/abmelden", async (req, reply) => {
    clearSession(req, reply);
    return { abgemeldet: true };
  });

  /**
   * Wer bin ich.
   *
   * Die Oberflaeche ruft das beim Start und richtet sich danach. Sie hat **keinen**
   * Zwischenspeicher im localStorage, der sofort rendert: der haette den Anmeldezustand
   * von gestern, und ein deaktivierter Nutzer saehe die Verwaltung aufblitzen.
   */
  app.get("/api/auth/ich", async (req) => {
    /*
     * Beide Arten von Sitzung. Der Besucher bekommt die Rolle `besucher` und seine GUID; die
     * Oberflaeche zeigt ihm danach nur seinen eigenen Bereich.
     */
    if (readSession(req)?.art === "besucher") {
      await app.verlangeBesucher(req);
      const person = findeBesucher(ctx.db, req.besucherGuid ?? "");
      return {
        id: person.guid,
        guid: person.guid,
        name: `${person.vorname} ${person.nachname}`,
        email: person.email,
        rolle: "besucher",
        appName: ctx.env.appName,
        viewerBaseUrl: ctx.env.viewerBaseUrl,
      };
    }

    await app.verlangeAnmeldung(req);
    const nutzer = req.nutzer;
    return {
      id: nutzer?.id,
      name: nutzer?.name,
      email: nutzer?.email,
      rolle: nutzer?.rolle,
      appName: ctx.env.appName,
      viewerBaseUrl: ctx.env.viewerBaseUrl,
    };
  });
}
