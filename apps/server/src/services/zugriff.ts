import type { FastifyRequest } from "fastify";
import type { Kontext } from "../kontext.js";
import { notFound, unauthorized } from "../errors.js";
import { findeExponat, istBetreuer } from "./exponate.js";

/**
 * Darf dieser Nutzer dieses Exponat sehen?
 *
 * **An einer Stelle entschieden.** Stuende die Regel in jeder Route einzeln, genuegte eine
 * vergessene Zeile, damit ein Betreuer ein fremdes Exponat bearbeitet; und das faellt
 * niemandem auf, weil die Oberflaeche es ihm gar nicht erst anbietet.
 *
 * **404 statt 403.** Ob es ein Exponat mit dieser Kennung gibt, ist fuer einen fremden
 * Betreuer keine Auskunft, die ihm zusteht. Ein 403 bestaetigte die Existenz.
 */
export function verlangeExponatZugriff(ctx: Kontext, req: FastifyRequest, exponatId: string): void {
  const nutzer = req.nutzer;
  if (nutzer === null) throw unauthorized();

  // Wirft 404, wenn es das Exponat ueberhaupt nicht gibt. Fuer Admin und Betreuer gleich.
  findeExponat(ctx.db, exponatId);

  if (nutzer.rolle === "admin") return;
  if (istBetreuer(ctx.db, exponatId, nutzer.id)) return;

  throw notFound("exponat-unbekannt", "Unknown exhibit.");
}

/**
 * Darf dieser Nutzer die **Inhalte** dieses Exponats aendern (Dokumente, Links,
 * Ansprechpartner)?
 *
 * Seit dem 02.11.2026 Admin **und** Betreuer dieses Exponats; vorher nur der Admin, und der
 * Betreuer scannte. Name, Beschreibung und Loeschen des Exponats bleiben beim Admin
 * (`verlangeAdmin` an der Route). Die Plaetze vergibt weiter der Server, das Mapping in Axon
 * bleibt also stabil, egal wer anlegt.
 */
export function verlangeExponatBearbeiten(
  ctx: Kontext,
  req: FastifyRequest,
  exponatId: string,
): void {
  verlangeExponatZugriff(ctx, req, exponatId);
}
