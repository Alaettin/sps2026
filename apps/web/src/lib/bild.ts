/**
 * Bilder im Browser verkleinern, bevor sie hochgeladen werden.
 *
 * **Im Browser, nicht auf dem Server**: das spart eine Bildbibliothek im Server, und ein
 * natives Modul wäre im Container der nächste Stolperstein. Der Server verlässt sich darauf
 * nicht, er prüft Typ und Größe selbst.
 */

/** Zeichenfläche als JPEG. */
export async function alsJpeg(flaeche: HTMLCanvasElement, guete: number): Promise<Blob> {
  return await new Promise<Blob>((loese, scheitere) => {
    flaeche.toBlob(
      (b) => {
        if (b === null) scheitere(new Error("Das Bild ließ sich nicht umwandeln."));
        else loese(b);
      },
      "image/jpeg",
      guete,
    );
  });
}

/**
 * Verkleinert ein Foto so, dass die längere Kante höchstens `kante` Pixel misst, und gibt
 * JPEG zurück. Das Seitenverhältnis bleibt; kleinere Bilder werden nicht vergrößert.
 *
 * Für Nachrichtenbilder: ein Handyfoto hat 12 Megapixel und mehrere MB, im Viewer geht es
 * als Base64 mitten in die Antwort des Konnektors. 1600 px reichen für jeden Bildschirm.
 */
export async function verkleinereAufKante(datei: Blob, kante: number, guete = 0.85): Promise<Blob> {
  const bild = await createImageBitmap(datei);
  const faktor = Math.min(1, kante / Math.max(bild.width, bild.height));
  const flaeche = document.createElement("canvas");
  flaeche.width = Math.round(bild.width * faktor);
  flaeche.height = Math.round(bild.height * faktor);
  const stift = flaeche.getContext("2d");
  if (stift === null) throw new Error("Kein 2D-Kontext verfügbar.");
  stift.drawImage(bild, 0, 0, flaeche.width, flaeche.height);
  bild.close();
  return alsJpeg(flaeche, guete);
}
