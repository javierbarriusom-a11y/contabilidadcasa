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
});

module.exports = { ...base, test, marcarCierreEsperado };
