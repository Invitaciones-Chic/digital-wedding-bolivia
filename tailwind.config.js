/** @type {import('tailwindcss').Config} */
// Config trasladada literalmente desde el bloque inline de index.html.
// Al compilar el CSS, Tailwind ya no corre en el navegador del visitante.
module.exports = {
  content: ['./index.html', './*/index.html'],
  theme: {
      "extend": {
          "colors": {
              "gold": {
                  "DEFAULT": "#C9A227",
                  "ink": "#86690F",
                  "dark": "#A6831A",
                  "light": "#E3CE93",
                  "wash": "#FBF6E9"
              },
              "dark": {
                  "DEFAULT": "#1C1A16",
                  "lighter": "#33302A"
              },
              "gray": {
                  "50": "#FAF8F4",
                  "100": "#F2EEE6",
                  "200": "#E7E1D5",
                  "300": "#D6CEBF",
                  "400": "#A9A091",
                  "500": "#877E70",
                  "600": "#6B6358",
                  "700": "#524B42",
                  "800": "#3A342D",
                  "900": "#26221D"
              },
              "silver": {
                  "DEFAULT": "#C0C0C0",
                  "light": "#E0E0E0"
              }
          },
          "fontFamily": {
              "serif": [
                  "Playfair Display",
                  "Georgia",
                  "serif"
              ],
              "sans": [
                  "Jost",
                  "system-ui",
                  "sans-serif"
              ],
              "display": [
                  "Cormorant Garamond",
                  "Georgia",
                  "serif"
              ]
          },
          "boxShadow": {
              "sm": "0 1px 2px rgba(28,26,22,.05)",
              "DEFAULT": "0 2px 8px -2px rgba(28,26,22,.07)",
              "md": "0 6px 18px -8px rgba(28,26,22,.12)",
              "lg": "0 14px 34px -14px rgba(28,26,22,.16)",
              "xl": "0 24px 50px -20px rgba(28,26,22,.18)",
              "2xl": "0 32px 70px -28px rgba(28,26,22,.22)",
              "gold": "0 18px 40px -18px rgba(166,131,26,.45)"
          },
          "borderRadius": {
              "xl": "0.875rem",
              "2xl": "1.25rem",
              "3xl": "1.75rem"
          },
          "transitionTimingFunction": {
              "premium": "cubic-bezier(0.32, 0.72, 0, 1)"
          },
          // Sustituyen a los valores arbitrarios transition-[a,b,c] que usaba
          // el HTML: el JIT del navegador los generaba al vuelo, pero el
          // extractor del CLI no los reconoce y las transiciones se perdian.
          // Nombrarlas ademas evita repetir la lista de propiedades.
          "transitionProperty": {
              "surface": "background-color, border-color, box-shadow",
              "control": "color, background-color, border-color, box-shadow"
          }
      }
  },
  plugins: [],
};
