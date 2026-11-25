// Abrir Registrar › Importar extracto sin perder el toque. En Safari (WebKit), recién cargada la página, el toque en la pestaña puede
// perderse: el despliegue 1562 de main (b7cba35d, 24/11/2026; solo cambiaba PROJECT_STATE) falló así en «Rediseño A4 · Importar v2» a
// 390 px, dos veces seguidas, con Registrar aún en «Saldo de cuentas», mientras el mismo código había pasado en el CI de #681 y #682.
// Es la carrera de #672, del 1518 y de abrirAltaVarios: se arregla la prueba, no se relanza. setRegistrarTab es idempotente, así que
// repetir el toque mientras no se vea la revisión de Importar v2 no cambia nada más.
const { expect } = require("@playwright/test");

async function abrirImportarRegistrar(page) {
  const pestana = page.locator('[data-registrar-tab="import"]');
  const fuente = page.locator("#importarV2 .imp-v2-fuente");
  await expect(async () => {
    await pestana.click();
    await expect(fuente).toBeVisible({ timeout: 3000 });
  }, "se abre Registrar › Importar extracto").toPass({ timeout: 20000 });
}

module.exports = { abrirImportarRegistrar };
