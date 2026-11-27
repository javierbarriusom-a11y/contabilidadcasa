// Chromium se cae solo de vez en cuando, entre una prueba y la siguiente: «Received signal 11 SEGV_MAPERR 0x1b0», justo
// después de «InitializeSandbox() called with multiple threads in process gpu-process». Pasa en el CI y en local
// (4 de 264 el 29/10/2026), con `--disable-gpu` también, y siempre igual: la prueba que viene detrás falla al crear su
// contexto («browser.newContext: Target page, context or browser has been closed»), antes de ejecutar una sola línea
// suya. Tumbó #567 y #568 el mismo día.
//
// Esto relanza el navegador UNA vez, y solo en ese caso exacto: al crear el contexto de una prueba, el navegador ya está
// desconectado y el error es el de navegador cerrado. Nada más se reintenta: si el navegador se cae DURANTE una prueba,
// esa prueba falla como siempre; si el relanzado vuelve a fallar, el error sale tal cual; y ninguna prueba se salta ni
// se repite. Cada relanzamiento queda en el registro del CI como aviso (`::warning`), con el título de la prueba.
const base = require("@playwright/test");

const NAVEGADOR_CERRADO = /Target page, context or browser has been closed|Browser has been closed|browser has disconnected/i;
let cierreEsperado = false;

// Para la prueba que comprueba el propio relanzamiento: su cierre es a propósito y no debe salir como aviso.
function marcarCierreEsperado() {
  cierreEsperado = true;
}

// La opción `reducedMotion` del proyecto no es un fixture: se lee de la configuración del proyecto de la prueba en curso.
function pideMenosMovimiento(browserName) {
  return browserName === "webkit" && base.test.info().project.use?.reducedMotion === "reduce";
}

const test = base.test.extend({
  browser: [
    async ({ browser, playwright, browserName }, use) => {
      let actual = browser;
      const proxy = new Proxy(browser, {
        get(_, prop) {
          if (prop === "newContext") {
            return async (options) => {
              try {
                return await actual.newContext(options);
              } catch (error) {
                if (actual.isConnected() || !NAVEGADOR_CERRADO.test(String(error?.message))) throw error;
                const prueba = base.test.info().titlePath.slice(1).join(" › ");
                const linea = `${browserName} se había cerrado solo antes de «${prueba}»; se relanza una vez (tests/helpers/navegador-resiliente.cjs).`;
                console.warn(cierreEsperado ? linea : `::warning title=Navegador relanzado::${linea}`);
                cierreEsperado = false;
                actual = await playwright[browserName].launch();
                return actual.newContext(options);
              }
            };
          }
          const value = Reflect.get(actual, prop, actual);
          return typeof value === "function" ? value.bind(actual) : value;
        },
      });
      await use(proxy);
      if (actual !== browser) await actual.close({ reason: "Test ended." }).catch(() => {});
    },
    { scope: "worker", timeout: 0 },
  ],
  // WebKit (26.5, el del proyecto «safari») no aplica la opción de contexto `reducedMotion: "reduce"`: dentro de la página,
  // `matchMedia("(prefers-reduced-motion: reduce)")` da `false` y sigue el `html { scroll-behavior: smooth }` de styles.css. Cada
  // desplazamiento de Playwright antes de un clic se animaba: la página seguía moviéndose cuando tocaba, y el toque caía en el
  // elemento de al lado (el radio de «bola de nieve» en vez del de «avalancha», la barra de arriba, la tarjeta). En el CI de #692,
  // #693 y #694 colgó «plan óptimo · pregunta antes», TRE-D3c y las de Plan › Previsión. `page.emulateMedia` sí lo aplica: se pide
  // lo mismo que ya dice la configuración, en cada página que se abre.
  context: async ({ context, browserName }, use) => {
    if (pideMenosMovimiento(browserName)) {
      context.on("page", (nueva) => { nueva.emulateMedia({ reducedMotion: "reduce" }).catch(() => {}); });
    }
    await use(context);
  },
  page: async ({ page, browserName }, use) => {
    if (pideMenosMovimiento(browserName)) await page.emulateMedia({ reducedMotion: "reduce" });
    await use(page);
  },
});

module.exports = { ...base, test, marcarCierreEsperado };
