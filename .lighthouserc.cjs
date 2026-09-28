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
//
// Umbrales estrechados el 28-sep-2026 (auditoría de optimización pedida por el usuario). Los
// originales (LCP 6000/TBT 8000) daban margen tanto sobre la mediana templada como sobre el peor
// caso en frío documentado arriba — es decir, absorbían casi cualquier ejecución, buena o mala, y no
// detectarían que la app se hubiera vuelto sensiblemente más lenta mientras siguiera por debajo de
// ese techo. Los nuevos valores (LCP 4000/TBT 5000) dejan ~2,5-3x de margen sobre la mediana
// templada citada arriba, para seguir absorbiendo el ruido normal de CI sin ser un semáforo en rojo
// permanente, pero ya no toleran una deriva silenciosa hacia el peor caso. Sin medición propia
// fiable para fijarlos más ajustados todavía: la comprobación de este cambio en un contenedor de
// desarrollo dio medianas muy por encima incluso del peor caso en frío aquí documentado (arranque de
// Chrome en un contenedor con CPU compartida, no una regresión real de la app), así que no sirve
// como referencia. Confirmar en el CI real (GitHub Actions, entorno estable) antes de estrechar más
// — si estos valores dan problemas de ruido ahí, es la señal real para relajarlos, no una suposición
// de partida.
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
        "largest-contentful-paint": ["error", { maxNumericValue: 4000 }],
        "total-blocking-time": ["error", { maxNumericValue: 5000 }],
        "cumulative-layout-shift": ["error", { maxNumericValue: 0.1 }],
      },
    },
    upload: {
      target: "filesystem",
      outputDir: "./.lighthouseci",
    },
  },
};
