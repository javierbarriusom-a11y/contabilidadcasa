const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.resolve(__dirname, "..");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const app = fs.readFileSync(path.join(root, "app.js"), "utf8");

test("Actualizar abre la matriz temporal y Movimientos queda en Versiones anteriores", () => {
  const home = html.indexOf('href="#home"');
  const update = html.indexOf('href="#update-hub"');
  const primaryPlan = html.indexOf('href="#new-life-definitive"');
  const debtRoadmap = html.indexOf('href="#debt-roadmap"');
  // «Escenarios de vida y deuda» ya no encabeza Decidir: V2-8 lo relegó. Quien abre ese grupo
  // ahora se encuentra primero los escenarios nuevos.
  const scenarios = html.indexOf('href="#escenario-simular"');
  // El encabezado se localiza por su atributo, no por el final de la etiqueta de clase: al añadirle
  // `data-e17-nav-label` en T-0 la búsqueda anterior dejó de encontrarlo y la comparación pasaba
  // sola con -1, sin comprobar nada.
  const dataLabel = html.indexOf('data-e17-nav-label="datos"');
  const legacyLabel = html.indexOf('data-e17-nav-label="legacy"');
  const dataEntry = html.indexOf('href="#data-entry"');
  const dataAudit = html.indexOf('href="#data-audit"');

  assert.ok(home < update && update < primaryPlan, "Actualizar debe aparecer inmediatamente después de Hoy");
  // V3-5 relegó `#debt-roadmap`: ya no basta con que aparezca tras los escenarios nuevos, tiene que
  // estar dentro de «Versiones anteriores». Lo primero lo cumpliría también si se hubiera quedado en
  // Decidir, así que la comprobación se aprieta en vez de dejarla pasando por el sitio equivocado.
  assert.ok(scenarios < debtRoadmap, "Plan de deuda debe aparecer tras los escenarios nuevos");
  assert.ok(dataLabel > 0 && legacyLabel > dataLabel, "«Versiones anteriores» cierra el menú avanzado");
  assert.ok(debtRoadmap > legacyLabel, "Plan de deuda ya no está en Decidir: se relegó en V3-5");
  assert.ok(dataLabel < dataEntry && dataEntry < dataAudit, "Carga de datos y auditoría siguen en Datos");
  // M-1 (14 de agosto) promueve Movimientos de «Versiones anteriores» a enlace principal, bajo
  // «Día a día» junto a Hoy — supera la relegación de V4-6, que solo hablaba del menú avanzado.
  assert.match(html, /<a href="#movements" class="nav-primary-link">/);
  assert.doesNotMatch(html, /<a href="#movements" data-e17-group="legacy">/);
  assert.match(html, /id="visual-detail"[^>]*view-section|view-section[^>]*id="visual-detail"/);
  assert.match(html, /id="update-hub"[^>]*view-section|view-section[^>]*id="update-hub"/);
  assert.match(html, /id="debt-roadmap"[^>]*view-section|view-section[^>]*id="debt-roadmap"/);
  assert.match(app, /case "update-data":\s*renderMonthlyDetails\(\)/);
  assert.match(app, /case "visual-detail":\s*renderVisualDetail\(\)/);
  assert.match(app, /case "update-hub":\s*renderUpdateHub\(\)/);
});

// Canario de la composición del menú avanzado: cada relegación lo actualiza a propósito, y una
// pantalla que desapareciera del menú sin querer rompería esta prueba en vez de pasar inadvertida.
test("el menú avanzado tiene exactamente los enlaces esperados en cada grupo", () => {
  const links = [...html.matchAll(/<a href="#([\w-]+)" data-e17-group="(\w+)">/g)];
  const byGroup = links.reduce((groups, match) => {
    (groups[match[2]] ||= []).push(match[1]);
    return groups;
  }, {});

  // V4-4 añade «Importar extracto en 4 pasos» al frente del grupo Datos: es el primer paso del
  // flujo (importar antes de registrar a mano lo que quede).
  assert.deepEqual(byGroup.data, ["datos-importar", "registrar-mes", "data-entry", "conciliar"]);
  // El grupo relegado sigue el orden que tenían las pantallas en el propio menú: primero lo que
  // estaba en Decidir (V2-8 y V3-5, intercaladas según su posición original) y en Analizar (V2-8),
  // luego Datos (V4-6) y por último Cierre (V5-3).
  // V1-4 añade las cuatro últimas heredadas de Decidir: iban justo después de `#asesor-decision`
  // en el menú original, que es después de las tres de deuda (V3-5) y antes de `#simulator`
  // (primera de Analizar, V2-8) — la misma regla de posición original que las trece anteriores.
  assert.deepEqual(byGroup.legacy, [
    "new-life-simulation",
    "debt-roadmap",
    "debt-liquidation-plan",
    "debt-control",
    "executive-advisor",
    "virtual-advisor",
    "savings-agent",
    "alerts-center",
    "simulator",
    "visual-detail",
    "savings-plan",
    "cashflow",
    "update-data",
    // M-1 (14 de agosto) promueve "movements" a enlace principal bajo «Día a día»: sale de aquí.
    "data-audit",
    "reconciliation",
    "operations-manual",
    // T-1 releva la decimoctava y última heredada del inventario: hasta ahora quedaba fuera del
    // grupo únicamente porque era pestaña principal («Decidir»). Va al final, no a su posición
    // original, porque nunca tuvo una dentro de este menú.
    "new-life-definitive",
  ]);
  assert.deepEqual(byGroup.assistants, ["asesor-decision"]);
  // D-1 (15 de agosto) añade «Contratos de deuda» junto a Ruta y Comparar, como tercera pestaña
  // de Deuda.
  assert.equal(byGroup.analysis.length, 11, "Decidir y Analizar suman once enlaces tras Análisis (Fase 6)");
  assert.equal(links.length, 33, "treinta y tres enlaces en el menú avanzado tras Análisis (Fase 6)");
});
