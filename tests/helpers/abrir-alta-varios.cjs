// Abrir «Dar de alta varios contratos a la vez» (Deuda › Contratos) sin perder el toque. En Safari (WebKit), recién recargada la página,
// el toque en el <summary> puede no abrir el desplegable: el CI de #678 (23/11/2026) falló así en UND-01 y UND-13, mientras la prueba del
// plan óptimo, con los mismos pasos, pasaba en la misma ejecución. Es la carrera de #672 y del 1518: se arregla la prueba, no se relanza.
// Se repite el toque mientras el desplegable siga cerrado hasta ver el campo; tocarlo abierto lo cerraría, por eso se mira antes.
const { expect } = require("@playwright/test");

async function abrirAltaVarios(page) {
  const varios = page.locator("#deudaContratosDetectados .deuda-varios");
  const campo = page.locator("#deudaContratosVarios");
  await expect(async () => {
    if (!(await varios.evaluate((d) => d.open))) await varios.locator("summary").click();
    await expect(campo).toBeVisible({ timeout: 2000 });
  }, "se abre el alta de varios contratos").toPass({ timeout: 20000 });
  return varios;
}

module.exports = { abrirAltaVarios };
