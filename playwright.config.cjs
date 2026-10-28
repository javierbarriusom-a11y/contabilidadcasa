const { defineConfig, devices } = require("@playwright/test");

module.exports = defineConfig({
  testDir: "./tests",
  fullyParallel: false,
  retries: 0,
  reporter: "line",
  use: {
    baseURL: "http://127.0.0.1:4182",
    browserName: "chromium",
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
  },
  webServer: {
    // Servidor que solo registra las peticiones que fallan: las ~120.000 líneas de peticiones correctas enterraban en el log del
    // CI el error de la prueba que fallaba (tools/serve-dist.py).
    command: "npm run build:site && python3 tools/serve-dist.py 4182 dist",
    url: "http://127.0.0.1:4182/index.html",
    reuseExistingServer: true,
  },
  projects: [
    // e18-visual-regression compara píxeles: fija el canal "chrome" real (no el Chromium empaquetado
    // con Playwright) para que el render de fuentes/GPU sea reproducible entre ejecuciones.
    { name: "desktop", testMatch: "e18-visual-regression.spec.cjs", use: { channel: "chrome", viewport: { width: 1280, height: 720 } } },
    { name: "mobile", testMatch: "e18-visual-regression.spec.cjs", use: { ...devices["iPhone 13"], channel: "chrome", viewport: { width: 390, height: 844 } } },
    // QA-1: acepta comportamiento, no píxeles — sin canal fijado, usa el Chromium que Playwright
    // resuelva en cada máquina (el empaquetado por defecto), sin depender de tener Chrome instalado.
    { name: "e2e", testMatch: "qa1-flujos-completos.spec.cjs", use: { viewport: { width: 1280, height: 720 }, launchOptions: process.env.PLAYWRIGHT_CHROMIUM_PATH ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH } : {} } },
    // OPT-4: axe-core contra las pantallas que QA-1 ya visita. Igual que "e2e", sin canal de Chrome
    // fijado — no comprueba píxeles, así que no necesita el Chrome real del proyecto "desktop".
    { name: "a11y", testMatch: "opt4-axe-accessibility.spec.cjs", use: { viewport: { width: 1280, height: 720 }, launchOptions: process.env.PLAYWRIGHT_CHROMIUM_PATH ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH } : {} } },
    // P4: presupuesto de rendimiento por pantalla (tiempo de apertura + llamadas al desglose de planificación).
    { name: "perf-screens", testMatch: "p4-presupuesto-pantallas.spec.cjs", use: { viewport: { width: 1280, height: 720 }, launchOptions: process.env.PLAYWRIGHT_CHROMIUM_PATH ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH } : {} } },
    // RD-WK (P14 del rediseño, 19/10/2026): las pruebas de las pantallas v2 a 390 px (etiqueta @safari en qa1) repetidas en
    // WebKit, el motor del Safari del iPhone del hogar. Se instala aparte en el CI (`npx playwright install --with-deps webkit`).
    // Un reintento, solo aquí y solo en el CI (decisión del hogar del 28/10/2026): en un día fallaron de vez en cuando tres
    // pruebas distintas que solo corren en WebKit. Lo que pasa al reintentarlo queda como «flaky» y su primer intento, en el
    // registro (paso de Safari en pages.yml); dos fallos seguidos siguen bloqueando. Chromium no reintenta.
    { name: "safari", testMatch: "qa1-flujos-completos.spec.cjs", grep: /@safari/, retries: process.env.CI ? 1 : 0, use: { ...devices["iPhone 13"], browserName: "webkit", viewport: { width: 390, height: 844 } } },
  ],
});
