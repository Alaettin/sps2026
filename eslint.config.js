import js from "@eslint/js";
import tseslint from "typescript-eslint";
import prettier from "eslint-config-prettier";
import globals from "globals";
import i18next from "eslint-plugin-i18next";

export default tseslint.config(
  {
    ignores: [
      "**/dist/**",
      "**/node_modules/**",
      "**/coverage/**",
      "**/*.d.ts",
      // Die Entwuerfe aus Claude Design sind Vorlage, nicht Quelltext dieses Projekts.
      "design/**",
      "apps/server/drizzle/**",
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      "@typescript-eslint/consistent-type-imports": "error",
    },
  },
  {
    files: ["apps/web/**/*.{ts,tsx}"],
    languageOptions: { globals: { ...globals.browser, ...globals.worker } },
  },
  /*
   * **Kein sichtbarer Text ohne Uebersetzung**, seit dem 03.11.2026: jeder Text in JSX und in
   * sichtbaren Attributen geht durch `t(de, en)` aus `lib/sprache.tsx`. Ausgenommen sind
   * Attribute, die nie angezeigt werden (Klassen, Ziele, Bausteinvarianten).
   */
  {
    files: ["apps/web/src/**/*.tsx"],
    plugins: { i18next },
    rules: {
      "i18next/no-literal-string": [
        "error",
        {
          mode: "jsx-only",
          "jsx-attributes": {
            exclude: [
              "className",
              "style",
              "type",
              "key",
              "id",
              "width",
              "height",
              "to",
              "href",
              "src",
              "rel",
              "target",
              "lang",
              "role",
              "name",
              "autoComplete",
              "autoCapitalize",
              "inputMode",
              "accept",
              "art",
              "viewBox",
              "d",
              "fill",
              "stroke",
              "strokeWidth",
              "strokeLinecap",
              "strokeLinejoin",
              "method",
              "spalte",
              "data-.*",
              "aria-hidden",
              "aria-live",
              "aria-current",
              "loading",
              "decoding",
              "pattern",
              "form",
              "htmlFor",
              "wert",
              "groesse",
              "breite",
              "mime",
              "feld",
              "variante",
              "ausrichtung",
              "dir",
              "enterKeyHint",
              "capture",
              "download",
              "spellCheck",
              "tabIndex",
              "xmlns",
              "value",
              "align",
              "side",
              "farbe",
              "spalten",
              "pfadName",
              "path",
              "placeholder=https.*",
            ],
          },
          /*
           * Nicht zu uebersetzen: Zeichen und Zahlen, Pfade und Adressen, Farbwerte, Eigennamen
           * (Personen, Firmen, Anschriften im Impressum) und Fachbegriffe der Konnektor-Spec, die
           * auch auf Deutsch englisch heissen.
           */
          words: {
            exclude: [
              "[0-9!-/:-@[-`{-~ ·…→←↑↓×–©|●☀☾▸▾↗—]+",
              "[A-Z_-]+",
              "(IDTA|AXON|SPS|Neoception|Industrial Digital Twin Association|Plattform INDUSTRIE)[\\s\\S]*",
              "https?://[\\s\\S]*",
              "mailto:[\\s\\S]*",
              "/[\\s\\S]*",
              "var\\(.*\\)",
              "[a-z0-9.-]+@[a-z0-9.-]+",
              "(©|Copyright)[\\s\\S]*",
              "\\d{5} [\\s\\S]*",
              "Lyoner Straße 18|Mallaustraße 50-56",
              "Dr\\. [\\s\\S]*|Dr\\.-Ing\\. [\\s\\S]*|Karsten Schneider[\\s\\S]*",
              "Deutsch|English",
              "Dashboard|Monitoring|Hierarchy|Values|Documents|GUIDs|ms",
              "grid-cols-[\\s\\S]*",
            ],
          },
          callees: {
            exclude: [
              "t",
              "fehlertext",
              "melde",
              "navigate",
              "gehe",
              "lege",
              "fuehreAus",
              "knopf",
              "api",
              "useAbruf",
              "setze[A-Z].*",
              "require",
              "addEventListener",
              "removeEventListener",
              "includes",
              "startsWith",
              "endsWith",
            ],
          },
        },
      ],
    },
  },
  /*
   * Der CSV-Import ist seit dem 23.10.2026 abgeschaltet und nirgends eingehaengt. Beim
   * Wiedereinschalten diese Ausnahme streichen und die Seite uebersetzen.
   */
  {
    files: ["apps/web/src/seiten/CsvImport.tsx"],
    rules: { "i18next/no-literal-string": "off" },
  },
  {
    files: ["apps/server/**/*.{ts,mjs}", "scripts/**/*.mjs", "*.config.{js,ts,mjs}"],
    languageOptions: { globals: globals.node },
  },
  prettier,
);
