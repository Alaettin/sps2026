/** Ein Abschnitt des Datenschutzhinweises, wie ihn der Server liefert. */
export interface Datenschutzabschnitt {
  titel: string;
  absaetze: string[];
}

/**
 * Der Datenschutzhinweis. Der Text kommt immer vom Server, damit die angezeigte Fassung genau
 * die ist, die beim Besucher als Einwilligung gespeichert wird.
 */
export function Datenschutztext({
  abschnitte,
  fassung,
}: {
  abschnitte: Datenschutzabschnitt[];
  fassung: string;
}) {
  return (
    <div className="flex flex-col gap-5 text-[15px] leading-relaxed">
      {abschnitte.map((a) => (
        <section key={a.titel} className="flex flex-col gap-1.5">
          <h3 className="text-[15px] font-semibold">{a.titel}</h3>
          {a.absaetze.map((p) => (
            <p key={p} className="text-text-zweit">
              {p}
            </p>
          ))}
        </section>
      ))}
      <p className="text-xs text-text-hinweis">Fassung vom {fassung}</p>
    </div>
  );
}
