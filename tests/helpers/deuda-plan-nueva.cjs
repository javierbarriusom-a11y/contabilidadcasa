// TRE-D1 (25/11/2026): Deuda › Plan abre la vista nueva (views/deuda-plan-v2.js) y lo de siempre queda detrás de «Ver todo el detalle».
// Las pruebas de los controles de siempre (plan óptimo, camino, orden de ataque, seguimiento…) siguen probando lo de siempre, que no se
// ha retirado: un `beforeEach` de cada fichero deja `localStorage["deuda-plan-v2-modo"] = "anterior"` en cada carga (el mismo
// mecanismo que `cierre-v2-modo` para el asistente del cierre). Las pruebas de la vista nueva lo desactivan con `deudaPlanNueva`.
const MODO = "deuda-plan-v2-modo";
const MARCA = "dpv2-prueba-nueva";

// TRE-D4 (25/11/2026): lo mismo con Deuda › Contratos (views/deuda-contratos-v2.js). El arranque en caliente da de alta los contratos
// FICTICIOS por «Pegar varios» de lo de siempre: sin esto, ninguna prueba arrancaría. Las de la vista nueva lo desactivan con
// `deudaContratosNueva`.
const MODO_CONTRATOS = "deuda-contratos-v2-modo";
const MARCA_CONTRATOS = "dcv2-prueba-nueva";
// TRE-D5a: y con Deuda › Ofertas (views/deuda-ofertas-v2.js). Las pruebas de la bandeja lo desactivan con `deudaOfertasNueva`.
const MODO_OFERTAS = "deuda-ofertas-v2-modo";
const MARCA_OFERTAS = "dov2-prueba-nueva";

/** En cada carga de la página, «todo el detalle» salvo que la prueba haya pedido la vista nueva (marca en sessionStorage). */
function deudaDeSiempre(page) {
  return page.addInitScript(({ pares }) => {
    try {
      pares.forEach(([modo, marca]) => { if (sessionStorage.getItem(marca) !== "1") localStorage.setItem(modo, "anterior"); });
    } catch {
      /* sin almacenamiento */
    }
  }, { pares: [[MODO, MARCA], [MODO_CONTRATOS, MARCA_CONTRATOS], [MODO_OFERTAS, MARCA_OFERTAS]] });
}

/** La vista nueva de Deuda › Contratos para esta prueba (sobrevive a recargas) y la repinta si ya se está en ella. */
async function deudaContratosNueva(page) {
  await page.evaluate(({ modo, marca }) => {
    sessionStorage.setItem(marca, "1");
    localStorage.removeItem(modo);
    globalThis.renderDeudaContratosV2?.();
  }, { modo: MODO_CONTRATOS, marca: MARCA_CONTRATOS });
}

/** La vista nueva de Deuda › Plan para esta prueba (sobrevive a recargas) y la repinta si ya se está en ella. */
async function deudaPlanNueva(page) {
  await page.evaluate(({ modo, marca }) => {
    sessionStorage.setItem(marca, "1");
    localStorage.removeItem(modo);
    globalThis.renderDeudaPlanV2?.();
  }, { modo: MODO, marca: MARCA });
}

/** La bandeja nueva de Deuda › Ofertas para esta prueba (sobrevive a recargas) y la repinta si ya se está en ella. */
async function deudaOfertasNueva(page) {
  await page.evaluate(({ modo, marca }) => {
    sessionStorage.setItem(marca, "1");
    localStorage.removeItem(modo);
    globalThis.renderDeudaOfertasV2?.();
  }, { modo: MODO_OFERTAS, marca: MARCA_OFERTAS });
}

module.exports = { deudaDeSiempre, deudaPlanNueva, deudaContratosNueva, deudaOfertasNueva, MODO, MODO_CONTRATOS, MODO_OFERTAS };
