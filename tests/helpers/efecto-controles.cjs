// DUO-01 · D-N34 (duodécima auditoría, 23/11/2026; decisión del hogar: «ok»): «prueba de efecto». El escenario de supuestos estuvo
// publicado sin cambiar ninguna cifra (D-N33) y ninguna prueba lo vio: se probaba que los controles se pintan, no que hacen algo.
//
// Regla: todo control que el hogar puede tocar en una pantalla v2 mueve alguna cifra visible o dice por qué no. Dos piezas:
//  1. **Censo:** en cada pantalla se listan los controles visibles (campos, selectores, casillas, botones con estado). Cada uno tiene
//     que estar en `EFECTOS` (con su comprobación) o en `EXCEPCIONES` (con el motivo). Un control nuevo sin ninguna de las dos hace
//     fallar la prueba: es lo que obliga D-N34 antes de publicar.
//  2. **Efecto:** cada entrada de `EFECTOS` toca su control y espera que cambien las cifras de la zona que observa (o, si declara
//     `oExplica`, que la pantalla diga por qué no cambian).
// Se ejecuta tras `arrancarEnCaliente` (datos guardados con la forma del real, todo FICTICIO), en el orden de la lista: cada entrada
// parte del estado que dejó la anterior.
const { expect } = require("@playwright/test");

// Clave estable de un control para el censo: id; si no, el grupo de radio con su valor; si no, su primer atributo data-* (sin valor, así
// una familia de controles repetidos por fila cuenta como uno).
const CLAVE_JS = `(el) => {
  if (el.id) return "#" + el.id;
  if (el.type === "radio" && el.name) return "radio:" + (el.dataset && Object.keys(el.dataset).length ? "[data-" + Object.keys(el.dataset)[0].replace(/[A-Z]/g, (m) => "-" + m.toLowerCase()) + "]" : el.name) + "=" + el.value;
  const data = [...el.attributes].find((a) => a.name.startsWith("data-"));
  if (data) return el.tagName.toLowerCase() + "[" + data.name + "]";
  return el.tagName.toLowerCase() + ":" + (el.getAttribute("aria-label") || el.textContent || "").trim().slice(0, 30);
}`;

const SELECTOR_CONTROLES = 'input:not([type="hidden"]), select, textarea, button[aria-pressed], [role="switch"], [role="tab"]';

async function censarControles(page, raiz) {
  return page.evaluate(({ raiz, selector, claveJs }) => {
    const clave = new Function(`return (${claveJs})`)();
    const vistos = new Set();
    document.querySelectorAll(raiz).forEach((r) => r.querySelectorAll(selector).forEach((el) => {
      if (!el.getClientRects().length || el.disabled) return;
      vistos.add(clave(el));
    }));
    return [...vistos].sort();
  }, { raiz, selector: SELECTOR_CONTROLES, claveJs: CLAVE_JS });
}

// Lo que se compara: las cifras de la zona (importes, porcentajes, fechas, meses), no el texto, para que un rótulo que cambia solo (lo que
// pasó en D-N33) no cuente como efecto. `modo: "texto"` para los pocos controles cuyo efecto es enseñar algo (p. ej. los campos de
// una estrategia del simulador).
async function huella(page, selector, modo = "cifras") {
  return page.evaluate(({ selector, modo }) => {
    const texto = [...document.querySelectorAll(selector)].map((el) => el.textContent || "").join(" ¦ ").replace(/\s+/g, " ");
    if (modo === "texto") return texto;
    return (texto.match(/-?\d[\d.,]*/g) || []).join(" ");
  }, { selector, modo });
}

async function actuar(page, efecto) {
  const control = page.locator(efecto.control).first();
  if (efecto.abrir) await efecto.abrir(page);
  await control.scrollIntoViewIfNeeded();
  const { tipo, valor } = efecto.accion;
  if (tipo === "rellenar") {
    await control.fill(String(valor));
    await control.press("Tab");
  } else if (tipo === "rango") {
    await control.evaluate((el, v) => { el.value = String(v); el.dispatchEvent(new Event("input", { bubbles: true })); el.dispatchEvent(new Event("change", { bubbles: true })); }, valor);
  } else if (tipo === "marcar") {
    await control.check();
  } else if (tipo === "alternar") {
    await control.click();
  } else {
    throw new Error(`acción desconocida: ${tipo}`);
  }
}

async function comprobarEfecto(page, efecto) {
  const antes = await huella(page, efecto.observa, efecto.modo);
  await actuar(page, efecto);
  await expect.poll(async () => {
    const ahora = await huella(page, efecto.observa, efecto.modo);
    if (ahora !== antes) return "cambia";
    if (efecto.oExplica && await page.locator(efecto.observa).filter({ hasText: efecto.oExplica }).count()) return "lo explica";
    return "nada";
  }, { message: `${efecto.nombre}: al tocar ${efecto.control} no cambia ninguna cifra de ${efecto.observa}${efecto.oExplica ? " ni dice por qué" : ""}`, timeout: 10000 }).not.toBe("nada");
}

async function abrirDetalles(page, selector) {
  const det = page.locator(selector);
  if ((await det.getAttribute("open")) === null) await det.locator("summary").click();
}

// Pantallas v2 del censo. `raiz`: dónde se buscan los controles. `entrar`: cómo se llega y qué se espera ver antes de tocar nada.
const PANTALLAS = [
  {
    nombre: "Hoy", hash: "#home", raiz: "#hoyV2",
    entrar: async (page) => expect(page.locator("#hoyV2 .hoy-v2-figure")).toBeVisible({ timeout: 15000 }),
  },
  {
    nombre: "Movimientos", hash: "#movements", raiz: "#movimientosV2",
    entrar: async (page) => expect(page.locator("#movimientosV2")).toBeVisible({ timeout: 15000 }),
  },
  {
    nombre: "Plan › Mes", hash: "#plan", raiz: "#planV2Lado",
    entrar: async (page) => expect(page.locator("#planV2Lado")).toBeVisible({ timeout: 15000 }),
  },
  {
    nombre: "Cierre", hash: "#cierre", raiz: "#cierreV2",
    entrar: async (page) => expect(page.locator("#cierreV2")).toHaveAttribute("data-modo", "v2", { timeout: 15000 }),
  },
  {
    nombre: "Deuda › Plan", hash: "#deuda-ruta", raiz: "#planOptimoCard, #caminoDeudaCard",
    entrar: async (page) => {
      await expect(page.locator("#planOptimoResultado .cam-hero").first()).toBeVisible({ timeout: 20000 });
      await abrirDetalles(page, "#planOptimoQuitas");
      await abrirDetalles(page, "#planOptimoMargen");
    },
  },
  {
    nombre: "Deuda › Ofertas › Simulador visual", hash: "#deuda-simulador", raiz: "#deudaSimuladorV2",
    entrar: async (page) => expect(page.locator("#deudaSimuladorV2")).toContainText("Banco FICTICIO", { timeout: 20000 }),
  },
  {
    nombre: "Registrar › Importar", hash: "#datos-importar", raiz: "#importarV2",
    entrar: async (page) => expect(page.locator("#importarV2 .imp-v2-fuente")).toBeVisible({ timeout: 15000 }),
  },
  {
    nombre: "Ajustes › Escenario de supuestos", hash: "#ajustes", raiz: "#escenarioAjustesCard",
    entrar: async (page, { abrirAreaDeAjustes }) => {
      await abrirAreaDeAjustes(page, "#escenarioAjustesCard");
      await expect(page.locator("#escenarioAjustesCard #miniSavingsRate")).not.toBeEmpty({ timeout: 15000 });
    },
  },
  {
    // DUO-04: la tarjeta de salud del cálculo (plegada) en Ajustes › Uso de la app.
    nombre: "Ajustes › Salud del cálculo", hash: "#ajustes", raiz: "#saludMotorCard",
    entrar: async (page, { abrirAreaDeAjustes }) => {
      await abrirAreaDeAjustes(page, "#saludMotorCard");
      const card = page.locator("#saludMotorCard");
      if ((await card.getAttribute("open")) === null) await card.locator("summary").click();
      await expect(card.locator("[data-salud-recalcular]")).toBeVisible({ timeout: 15000 });
    },
  },
];

const PLAN = "#planOptimoResultado";
const CAMINO = "#caminoDeudaResultado";
const COINCIDEN = /los dos órdenes coinciden/;

// Cada entrada: `pantalla`, `clave` (la del censo, o una expresión regular para una familia), `control` (selector que se toca), `accion`,
// `observa` y, si hace falta, `oExplica`, `modo` o `abrir`.
const EFECTOS = [
  { pantalla: "Deuda › Plan", nombre: "Importe fijo al mes", clave: "#planOptimoMensual", control: "#planOptimoMensual", accion: { tipo: "rellenar", valor: 350 }, observa: PLAN },
  { pantalla: "Deuda › Plan", nombre: "Modo: lo que permita la previsión", clave: "radio:planOptimoModo=prevision", control: 'input[name="planOptimoModo"][value="prevision"]', accion: { tipo: "marcar" }, observa: PLAN },
  { pantalla: "Deuda › Plan", nombre: "Modo: un importe fijo", clave: "radio:planOptimoModo=fijo", control: 'input[name="planOptimoModo"][value="fijo"]', accion: { tipo: "marcar" }, observa: PLAN },
  { pantalla: "Deuda › Plan", nombre: "Pago inicial", clave: "#planOptimoPago", control: "#planOptimoPago", accion: { tipo: "rellenar", valor: 1000 }, observa: PLAN },
  { pantalla: "Deuda › Plan", nombre: "Oferta de quita", clave: "input[data-plan-optimo-quita]", control: "input[data-plan-optimo-quita]", accion: { tipo: "rellenar", valor: 1500 }, observa: PLAN },
  { pantalla: "Deuda › Plan", nombre: "Orden: bola de nieve", clave: "radio:planOptimoOrden=bola-nieve", control: 'input[name="planOptimoOrden"][value="bola-nieve"]', accion: { tipo: "marcar" }, observa: PLAN, oExplica: COINCIDEN },
  { pantalla: "Deuda › Plan", nombre: "Orden: avalancha", clave: "radio:planOptimoOrden=avalancha", control: 'input[name="planOptimoOrden"][value="avalancha"]', accion: { tipo: "marcar" }, observa: PLAN, oExplica: COINCIDEN },
  { pantalla: "Deuda › Plan", nombre: "Margen en %", clave: "#planOptimoMargenPct", control: "#planOptimoMargenPct", accion: { tipo: "rellenar", valor: 40 }, observa: PLAN, oExplica: COINCIDEN },
  { pantalla: "Deuda › Plan", nombre: "Margen en euros", clave: "#planOptimoMargenAbs", control: "#planOptimoMargenAbs", accion: { tipo: "rellenar", valor: 5000 }, observa: PLAN, oExplica: COINCIDEN },
  { pantalla: "Deuda › Plan", nombre: "Camino: extra al mes", clave: "#caminoDeudaExtra", control: "#caminoDeudaExtra", accion: { tipo: "rellenar", valor: 200 }, observa: CAMINO },
  { pantalla: "Deuda › Plan", nombre: "Camino: deslizador del extra", clave: "#caminoDeudaRango", control: "#caminoDeudaRango", accion: { tipo: "rango", valor: 500 }, observa: CAMINO },
  { pantalla: "Deuda › Ofertas › Simulador visual", nombre: "Las cuotas de hoy ya están en el plan", clave: "input[data-sim-v2-cuotas-en-plan]", control: "[data-sim-v2-cuotas-en-plan]", accion: { tipo: "alternar" }, observa: "#deudaSimuladorV2 [data-sim-v2-cifras]" },
  // La estrategia de cada contrato: su efecto es enseñar los campos de esa estrategia (las cifras cambian al rellenarlos; eso lo prueba SVD).
  { pantalla: "Deuda › Ofertas › Simulador visual", nombre: "Estrategia de un contrato", clave: /^radio:\[data-sim-v2-campo\]=/, control: '[data-sim-v2-campo$="_strategy"][value="refi"]', accion: { tipo: "marcar" }, observa: "#deudaSimuladorV2 .sim-v2-cuentas", modo: "texto" },
  { pantalla: "Ajustes › Escenario de supuestos", nombre: "Escenario Prudente", clave: "button[data-escenario-elegir]", control: '[data-escenario-elegir="prudente"]', accion: { tipo: "alternar" }, observa: "#escenarioAjustesCard .escenario-cifras" },
  { pantalla: "Ajustes › Escenario de supuestos", nombre: "Escenario Ahorro alto", clave: "button[data-escenario-elegir]", control: '[data-escenario-elegir="ahorro"]', accion: { tipo: "alternar" }, observa: "#escenarioAjustesCard .escenario-cifras" },
  { pantalla: "Ajustes › Escenario de supuestos", nombre: "Volver a Base", clave: "button[data-escenario-elegir]", control: '[data-escenario-elegir="base"]', accion: { tipo: "alternar" }, observa: "#escenarioAjustesCard .escenario-cifras" },
  // «Recalcular todo» con los mismos datos no tiene por qué mover cifras: dice que se ha recalculado y a qué hora.
  { pantalla: "Ajustes › Salud del cálculo", nombre: "Recalcular todo", clave: "button[data-salud-recalcular]", control: "[data-salud-recalcular]", accion: { tipo: "alternar" }, observa: "#saludMotorCard [data-salud-estado-recalculo]", modo: "texto", oExplica: /Recalculado a las/ },
];

// Controles que no tienen que mover cifras, con el motivo. Una excepción nueva se razona aquí; «no sé qué hace» no es un motivo.
const EXCEPCIONES = [
  { pantalla: "Hoy", clave: /^#hoyV2Tab-/, motivo: "navegación: cambia de área de Hoy (lo prueba la e2e de las áreas)" },
  { pantalla: "Plan › Mes", clave: "button[data-plan-v2-sobres]", motivo: "activa o apaga la función Sobres (vista), no un supuesto del cálculo" },
  { pantalla: "Registrar › Importar", clave: "#importarV2PdfTexto", motivo: "entrada de datos: el efecto es importar, lo prueban las e2e de Importar" },
];

function coincide(clave, patron) {
  return patron instanceof RegExp ? patron.test(clave) : patron === clave;
}

function sinCubrir(pantalla, claves) {
  const cubre = [...EFECTOS, ...EXCEPCIONES].filter((item) => item.pantalla === pantalla);
  return claves.filter((clave) => !cubre.some((item) => coincide(clave, item.clave)));
}

module.exports = { PANTALLAS, EFECTOS, EXCEPCIONES, censarControles, comprobarEfecto, huella, sinCubrir, coincide };
