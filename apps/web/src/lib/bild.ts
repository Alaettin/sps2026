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
