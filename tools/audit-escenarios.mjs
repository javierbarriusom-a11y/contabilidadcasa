// Auditoría de las cinco pantallas que dependen del motor de escenarios: comprueba, contra el
// artefacto que se publica (`dist/`, que es lo que despliega Pages), que cada una devuelve cifras
// de verdad y no se queda en blanco.
//
// Nació el 10 de agosto de 2026, al descubrir que el sitio publicado llevaba desde E20 sin
// `canonical-scenario-*.js`: las cinco pantallas se quedaban vacías **sin un solo error de consola**,
// así que ninguna prueba ni ninguna QA lo notó. Los canarios de `build-public-site.mjs` y
// `smoke-public.mjs` impiden ya que vuelva a faltar un archivo; esto comprueba lo otro, que las
// pantallas hagan su trabajo de punta a punta.
//
// No entra en `npm run verify` porque necesita Chromium y un servidor. Se ejecuta a mano:
//
//   npm run build:site
//   (cd dist && python3 -m http.server 4183 &)
//   npm run audit:escenarios              # con el motor, espera 17/17
//
// Para reproducir lo que estuvo publicado, sirve una copia de `dist` sin `canonical-scenario-*.js`
// y apunta ahí con AUDIT_BASE.
//
// Referencias esperadas: **17/17 con el motor** y **7/17 sin él**. La comprobación decimoséptima la
// añadió V3-3 («Consolidar» sin oferta no inventa cifras) y pasa en los dos modos, porque no depende
// del motor sino de la oferta.
//
// Ojo con la cifra del modo degradado: fue 8/16 y bajó a 6/16 a propósito, no por una regresión.
// T-5 hizo que el modo degradado deje de fingir resultados, y esta herramienta mide «¿devuelve
// cifras?», así que las dos mejoras cuentan aquí como comprobaciones rotas:
//   - el comparador escribe «—» en coste y caja mínima en vez de un 0,00 € que se lee como respuesta;
//   - simular rechaza la decisión si falta el esquema, en vez de aceptarla sin validar.
// En ese modo lo que hay que mirar es que las cinco pantallas enseñen su aviso rojo, que es lo que
// comprueban `tests/t5-aviso-dependencia.test.cjs` y la QA de navegador.
import { chromium } from "playwright";

const BASE = process.env.AUDIT_BASE || "http://127.0.0.1:4183/";
const modo = process.argv[2] || "con-motor";

const vacio = (t) => !t || !t.trim() || t.trim() === "—";
const tieneNumero = (t) => /\d/.test(String(t || ""));

const hallazgos = [];
const anotar = (pantalla, comprobacion, ok, detalle = "") => {
  hallazgos.push({ pantalla, comprobacion, ok, detalle });
  console.log(`${ok ? "OK  " : "ROTO"} · ${pantalla} · ${comprobacion}${detalle ? ` — ${detalle}` : ""}`);
};

const ir = async (page, id) => {
  await page.evaluate((view) => { window.location.hash = `#${view}`; }, id);
  await page.waitForTimeout(700);
};

// PLAYWRIGHT_EXECUTABLE_PATH permite apuntar al Chromium ya instalado en el entorno; sin ella,
// Playwright resuelve el suyo.
const launchOptions = process.env.PLAYWRIGHT_EXECUTABLE_PATH
  ? { executablePath: process.env.PLAYWRIGHT_EXECUTABLE_PATH }
  : {};
const browser = await chromium.launch(launchOptions);
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const errores = [];
page.on("pageerror", (e) => errores.push(String(e)));
await page.goto(BASE, { waitUntil: "networkidle" });
await page.waitForSelector("#homeKpis .e19-kpi");

const hayMotor = await page.evaluate(() => Boolean(window.FinanceCanonicalScenarioEngine));
console.log(`\n=== modo: ${modo} · motor cargado: ${hayMotor} ===\n`);

// ---- V3-1 + V3-3 · #deuda-comparar (mockups 1c y 4d) ------------------------------------------
await ir(page, "deuda-comparar");
const leerTarjetas = () => page.$$eval(".deuda-decidir-strategy-card", (els) =>
  els.map((el) => ({
    titulo: el.querySelector("h3")?.textContent.trim(),
    kpis: [...el.querySelectorAll(".deuda-decidir-strategy-kpis div")].map((d) => ({
      etiqueta: d.querySelector("span")?.textContent.trim(),
      valor: d.querySelector("strong")?.textContent.trim(),
    })),
  })),
);

// V3-3 · antes de introducir la oferta, «Consolidar» debe declararse sin calcular en vez de dar un
// cero. Es la mitad de la entrega: la otra mitad es que con oferta sí calcule.
const sinOferta = (await leerTarjetas()).find((t) => t.titulo === "Consolidar");
anotar(
  "#deuda-comparar",
  "«Consolidar» sin oferta no inventa cifras",
  Boolean(sinOferta) && sinOferta.kpis.every((k) => k.valor === "—"),
  sinOferta ? sinOferta.kpis.map((k) => k.valor).join(" | ") : "sin tarjeta",
);

await page.fill("#deudaCompararOfferTin", "7.5");
await page.fill("#deudaCompararOfferPlazo", "96");
await page.waitForTimeout(400);

const tarjetas = await leerTarjetas();
anotar("#deuda-comparar", "las cuatro estrategias se pintan", tarjetas.length === 4, tarjetas.map((t) => t.titulo).join(", "));
const libres = tarjetas.map((t) => t.kpis.find((k) => k.etiqueta === "Libre de deuda")?.valor);
anotar("#deuda-comparar", "cada estrategia da su fecha libre de deuda", libres.every((v) => !vacio(v) && v !== "—"), libres.join(" | "));
// El coste se lee por posición y no por etiqueta: desde V3-3 cada estrategia dice qué mide su
// cifra («Coste total ejecutado» las tres primeras, «Intereses del nuevo préstamo» consolidar).
const costes = tarjetas.map((t) => t.kpis[1]?.valor);
anotar("#deuda-comparar", "cada estrategia da su coste", costes.every(tieneNumero), costes.join(" | "));
const recomendada = await page.$$eval(".deuda-decidir-strategy-card.is-recommended h3", (e) => e.map((x) => x.textContent.trim()));
anotar("#deuda-comparar", "hay una estrategia recomendada", recomendada.length === 1, recomendada.join(","));

// ---- V3-2 · #deuda-ruta (mockup 1b) -----------------------------------------------------------
await ir(page, "deuda-ruta");
const pasos = await page.$$eval("#deudaRutaTimeline li", (els) =>
  els.map((el) => el.textContent.replace(/\s+/g, " ").trim().slice(0, 90)),
);
anotar("#deuda-ruta", "la línea de tiempo tiene pasos", pasos.length > 0, `${pasos.length} pasos`);
anotar("#deuda-ruta", "los pasos llevan cifras", pasos.length > 0 && pasos.every(tieneNumero), pasos[0] || "sin pasos");

// ---- V2-2 · los once tipos de decisión --------------------------------------------------------
await ir(page, "escenario-simular");
const tipos = await page.$$eval("#escenarioMotorType option", (els) => els.map((el) => el.textContent.trim()));
anotar("#escenario-simular", "el catálogo de tipos de decisión se puebla", tipos.length >= 9, `${tipos.length} tipos`);
const campos = await page.$$eval("#escenarioMotorFields [name], #escenarioMotorFields input, #escenarioMotorFields select", (e) => e.length);
anotar("#escenario-simular", "el formulario pinta los campos del tipo elegido", campos > 0, `${campos} campos`);

// ---- V2-1 · simular produce impacto ------------------------------------------------------------
// Se añade una amortización real y se mira si la pantalla devuelve cifras y habilita «Aplicar».
const simulacion = await page.evaluate(async () => {
  const select = document.getElementById("escenarioMotorType");
  if (!select) return { error: "sin selector" };
  const deudas = typeof escenarioMotorDebtOptions === "function" ? escenarioMotorDebtOptions() : [];
  if (!deudas.length) return { error: "sin deudas" };
  select.value = "amortizacion";
  select.dispatchEvent(new Event("change", { bubbles: true }));
  await new Promise((r) => setTimeout(r, 300));
  const form = document.getElementById("escenarioMotorForm");
  // Los campos del motor se marcan con `data-escenario-motor-field`, no con `name`.
  const deudaField = form?.querySelector('[data-escenario-motor-field="deudaId"]');
  const importeField = form?.querySelector('[data-escenario-motor-field="importe"]');
  if (deudaField) { deudaField.value = deudas[0].id; deudaField.dispatchEvent(new Event("change", { bubbles: true })); }
  if (importeField) { importeField.value = "500"; importeField.dispatchEvent(new Event("input", { bubbles: true })); }
  form?.querySelector('button[type="submit"]')?.click();
  await new Promise((r) => setTimeout(r, 900));
  return {
    decisiones: document.querySelectorAll("#escenarioMotorDecisionsList li").length,
    errorForm: document.getElementById("escenarioMotorFormError")?.hidden === false
      ? document.getElementById("escenarioMotorFormErrorList")?.textContent.trim().slice(0, 120)
      : "",
    kpis: [...document.querySelectorAll("#escenarioMotorKpis .e19-kpi, #escenarioMotorKpis > *")].map((el) => el.textContent.replace(/\s+/g, " ").trim().slice(0, 70)),
    grafico: document.querySelectorAll("#escenarioMotorChart *").length,
    aplicarHabilitado: !document.getElementById("escenarioMotorGoApply")?.disabled,
  };
});
if (simulacion.error) {
  anotar("#escenario-simular", "se puede añadir una decisión", false, simulacion.error);
} else {
  anotar("#escenario-simular", "la decisión entra en la lista", simulacion.decisiones > 0, `${simulacion.decisiones}`);
  anotar("#escenario-simular", "el impacto devuelve cifras", simulacion.kpis.length > 0 && simulacion.kpis.some(tieneNumero), simulacion.kpis.slice(0, 3).join(" || ") || "vacío");
  anotar("#escenario-simular", "la gráfica de liquidez se dibuja", simulacion.grafico > 0, `${simulacion.grafico} nodos`);
  anotar("#escenario-simular", "«Aplicar al plan» se habilita", Boolean(simulacion.aplicarHabilitado));
}

// ---- mockup 2d · #escenario-aplicar ------------------------------------------------------------
const aplicar = await page.evaluate(async () => {
  document.getElementById("escenarioMotorGoApply")?.click();
  await new Promise((r) => setTimeout(r, 800));
  return {
    visible: !document.getElementById("escenario-aplicar")?.hidden,
    kpis: [...document.querySelectorAll("#escenarioAplicarKpis > *")].map((el) => el.textContent.replace(/\s+/g, " ").trim().slice(0, 70)),
    filas: document.querySelectorAll("#escenarioAplicarDiffBody tr").length,
  };
});
anotar("#escenario-aplicar", "se abre desde simular", Boolean(aplicar.visible));
anotar("#escenario-aplicar", "enseña el impacto antes de confirmar", aplicar.kpis.length > 0 && aplicar.kpis.some(tieneNumero), aplicar.kpis.slice(0, 2).join(" || ") || "vacío");
anotar("#escenario-aplicar", "enseña los cambios del plan", aplicar.filas > 0, `${aplicar.filas} filas`);

// ---- mockup 2e · #escenario-guardados ----------------------------------------------------------
await ir(page, "escenario-guardados");
const guardados = await page.evaluate(() => ({
  tarjetas: document.querySelectorAll("#escenarioGuardadosList > *").length,
  vacioVisible: !document.getElementById("escenarioGuardadosEmpty")?.hidden,
}));
anotar("#escenario-guardados", "lista o estado vacío coherente", guardados.tarjetas > 0 || guardados.vacioVisible,
  `${guardados.tarjetas} guardados · vacío=${guardados.vacioVisible}`);

console.log(`\nErrores de consola: ${errores.length}${errores.length ? ` → ${errores.slice(0, 3).join(" | ")}` : ""}`);
const rotos = hallazgos.filter((h) => !h.ok);
console.log(`\n${hallazgos.length - rotos.length}/${hallazgos.length} comprobaciones OK en modo «${modo}»`);
if (rotos.length) console.log("Rotas: " + rotos.map((r) => `${r.pantalla}·${r.comprobacion}`).join("; "));
process.exitCode = rotos.length ? 1 : 0;

await browser.close();
