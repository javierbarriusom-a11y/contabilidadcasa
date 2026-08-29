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
    command: "npm run build:site && python3 -m http.server 4182 --bind 127.0.0.1 -d dist",
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
  ],
});
