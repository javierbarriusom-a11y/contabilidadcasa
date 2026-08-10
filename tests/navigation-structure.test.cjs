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
  const movements = html.indexOf('href="#movements"');
  const dataAudit = html.indexOf('href="#data-audit"');

  assert.ok(home < update && update < primaryPlan, "Actualizar debe aparecer inmediatamente después de Hoy");
  // V3-5 relegó `#debt-roadmap`: ya no basta con que aparezca tras los escenarios nuevos, tiene que
  // estar dentro de «Versiones anteriores». Lo primero lo cumpliría también si se hubiera quedado en
  // Decidir, así que la comprobación se aprieta en vez de dejarla pasando por el sitio equivocado.
  assert.ok(scenarios < debtRoadmap, "Plan de deuda debe aparecer tras los escenarios nuevos");
  assert.ok(dataLabel > 0 && legacyLabel > dataLabel, "«Versiones anteriores» cierra el menú avanzado");
  assert.ok(debtRoadmap > legacyLabel, "Plan de deuda ya no está en Decidir: se relegó en V3-5");
  assert.ok(dataLabel < dataEntry && dataEntry < dataAudit, "Carga de datos y auditoría siguen en Datos");
  assert.ok(movements > legacyLabel, "Movimientos ya no está en Datos: se relegó en V4-6");
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

  assert.deepEqual(byGroup.data, ["registrar-mes", "data-entry", "conciliar"]);
  // El grupo relegado sigue el orden que tenían las pantallas en el propio menú: primero lo que
  // estaba en Decidir (V2-8 y V3-5, intercaladas según su posición original) y en Analizar (V2-8),
  // luego Datos (V4-6) y por último Cierre (V5-3).
  assert.deepEqual(byGroup.legacy, [
    "new-life-simulation",
    "debt-roadmap",
    "debt-liquidation-plan",
    "debt-control",
    "simulator",
    "visual-detail",
    "savings-plan",
    "cashflow",
    "update-data",
    "movements",
    "data-audit",
    "reconciliation",
    "operations-manual",
  ]);
  assert.deepEqual(byGroup.assistants, ["asesor-decision", "executive-advisor", "virtual-advisor"]);
  assert.equal(byGroup.analysis.length, 11, "Decidir y Analizar suman once enlaces");
  assert.equal(links.length, 30, "treinta enlaces en el menú avanzado");
});
