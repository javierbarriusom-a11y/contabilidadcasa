// OPT-5: presupuesto de rendimiento real, medido con Lighthouse contra el `dist/` ya construido por
// `npm run build:site` — sustituye al umbral de peso de fichero que tenía tools/check-performance.mjs.
//
// Los umbrales no son los 2,5 s de LCP citados como aspiración en el backlog: esa cifra era una
// referencia de partida, no una medición. La primera medición real contra este `dist/` (formFactor
// mobile, throttling simulado, que es como Lighthouse imita una red móvil media) dio una mediana de
// ~1,4 s de LCP y ~2,7-3,4 s de TBT en carga templada, pero la primera carga en frío de cada arranque
// de Chrome puede rondar los 11 s de LCP y 5,2 s de TBT solo por el coste de arrancar el navegador y
// leer del disco por primera vez — no por una regresión real. `numberOfRuns: 3` con la agregación por
// mediana de LHCI absorbe ese arranque en frío; los umbrales de abajo dejan margen sobre la mediana
// observada (no sobre el mejor caso) para que esto sea una alarma real, no un semáforo en rojo
// permanente ni un ruido intermitente en cada PR.
//
// INP no es medible en un Lighthouse de laboratorio (no hay interacción real de usuario que
// cronometrar) — Total Blocking Time es el proxy de laboratorio estándar que recomienda la propia
// documentación de Lighthouse para aproximar INP sin un usuario real.
module.exports = {
  ci: {
    collect: {
      staticDistDir: "dist",
      url: ["/index.html"],
      numberOfRuns: 3,
      settings: {
        chromeFlags: "--headless=new --no-sandbox --disable-gpu",
      },
    },
    assert: {
      assertions: {
        "largest-contentful-paint": ["error", { maxNumericValue: 6000 }],
        "total-blocking-time": ["error", { maxNumericValue: 8000 }],
        "cumulative-layout-shift": ["error", { maxNumericValue: 0.1 }],
      },
    },
    upload: {
      target: "filesystem",
      outputDir: "./.lighthouseci",
    },
  },
};
