const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

// T10 (Horizonte 4 de BACKLOG_CONTABILIDADCASA_2_0.md): PWA instalable con vista «de un vistazo»
// (colchón, deuda cara, próximo vencimiento). Colchón y próximo evento ya vivían en #widget desde
// A17-1; esta tarea añade la pieza que faltaba (deuda cara, sobre escenarioMotorDebtOptions() ya
// usado por homeDebtOutlook) y corrige un hueco real de instalabilidad: no había ningún icono
// declarado (ni favicon ni manifest#icons), así que Chrome/Android no ofrecían el instalador nativo.

const root = path.resolve(__dirname, "..");
const app = fs.readFileSync(path.join(root, "app.js"), "utf8");
const indexHtml = fs.readFileSync(path.join(root, "index.html"), "utf8");
const manifest = JSON.parse(fs.readFileSync(path.join(root, "manifest.webmanifest"), "utf8"));
const serviceWorker = fs.readFileSync(path.join(root, "service-worker.js"), "utf8");
const buildScript = fs.readFileSync(path.join(root, "tools", "build-public-site.mjs"), "utf8");

function extractFunction(name) {
  const start = app.indexOf(`function ${name}(`);
  assert.ok(start >= 0, `No existe la función ${name} en app.js`);
  const parenStart = app.indexOf("(", start);
  let parenDepth = 0;
  let bodyStart = -1;
  for (let index = parenStart; index < app.length; index += 1) {
    if (app[index] === "(") parenDepth += 1;
    else if (app[index] === ")") {
      parenDepth -= 1;
      if (parenDepth === 0) { bodyStart = app.indexOf("{", index); break; }
    }
  }
  assert.ok(bodyStart >= 0, `No se encontró el cuerpo de ${name}`);
  let depth = 0;
  for (let index = bodyStart; index < app.length; index += 1) {
    if (app[index] === "{") depth += 1;
    else if (app[index] === "}") {
      depth -= 1;
      if (depth === 0) return app.slice(start, index + 1);
    }
  }
  throw new Error(`La función ${name} no cierra sus llaves`);
}

function sandboxWith(names, extra = {}) {
  const context = { ...extra };
  vm.createContext(context);
  names.forEach((name) => vm.runInContext(extractFunction(name), context));
  return context;
}

function contract(overrides = {}) {
  return { id: "c1", entity: "Banco", type: "Préstamo", apr: 10, currentPrincipal: 1000, ...overrides };
}

// --- widgetPriciestDebt --------------------------------------------------------------------

test("widgetPriciestDebt · elige el contrato con mayor TAE, no el primero de la lista (mismo criterio que DI3/DI5)", () => {
  const context = sandboxWith(["widgetPriciestDebt"], {
    escenarioMotorDebtOptions: () => [
      contract({ id: "a", entity: "Banco A", apr: 8 }),
      contract({ id: "b", entity: "Banco B", apr: 21.5, currentPrincipal: 2500 }),
      contract({ id: "c", entity: "Banco C", apr: 12 }),
    ],
    escenarioMotorDebtLabel: (c) => `${c.entity} ${c.type}`.trim(),
  });
  const result = context.widgetPriciestDebt();
  assert.equal(result.label, "Banco B Préstamo");
  assert.equal(result.apr, 21.5);
  assert.equal(result.principal, 2500);
});

test("widgetPriciestDebt · sin contratos activos, null en vez de fabricar una cifra", () => {
  const context = sandboxWith(["widgetPriciestDebt"], {
    escenarioMotorDebtOptions: () => [],
    escenarioMotorDebtLabel: () => "",
  });
  assert.equal(context.widgetPriciestDebt(), null);
});

test("widgetPriciestDebt · con contratos pero ninguno con TAE declarada, null en vez de mostrar 0%", () => {
  const context = sandboxWith(["widgetPriciestDebt"], {
    escenarioMotorDebtOptions: () => [contract({ apr: 0 }), contract({ apr: null })],
    escenarioMotorDebtLabel: (c) => c.entity,
  });
  assert.equal(context.widgetPriciestDebt(), null);
});

// --- renderWidgetView (tarjeta de deuda cara) -----------------------------------------------

test("renderWidgetView · pinta la deuda más cara con su TAE, entidad e importe pendiente", () => {
  const elements = {
    widgetBalance: { textContent: "" },
    widgetBalanceNote: { textContent: "" },
    widgetPriciestDebt: { textContent: "" },
    widgetPriciestDebtNote: { textContent: "" },
    widgetNextEvent: { textContent: "" },
    widgetNextEventNote: { textContent: "" },
    widgetCushion: { textContent: "" },
    widgetCushionNote: { textContent: "" },
  };
  const context = sandboxWith(["renderWidgetView", "widgetSnapshot", "widgetPriciestDebt"], {
    qs: (id) => elements[id] || null,
    money: (v) => `${Number(v || 0).toFixed(2)} €`,
    unifiedActionCenterModel: () => ({ asOf: "2026-09-19", context: { balances: { total: 1000 } } }),
    accountBalancesFromState: () => ({ total: 1000 }),
    rangeKpiMetric: () => ({ adjustedMin: 500, adjustedMinMonth: "sep 26", adjustedMinDate: "2026-09-30" }),
    homeRowsForHorizon: () => [],
    ajustesFinancialCalendarInput: () => null,
    escenarioMotorDebtOptions: () => [contract({ entity: "Banco X", type: "Tarjeta", apr: 19.9, currentPrincipal: 800 })],
    escenarioMotorDebtLabel: (c) => `${c.entity} ${c.type}`.trim(),
  });
  context.renderWidgetView();
  assert.equal(elements.widgetPriciestDebt.textContent, "19.9% TAE");
  assert.equal(elements.widgetPriciestDebtNote.textContent, "Banco X Tarjeta · 800.00 € pendientes.");
});

test("renderWidgetView · sin deuda cara declarada, lo dice en vez de dejar la tarjeta en blanco", () => {
  const elements = {
    widgetBalance: { textContent: "" },
    widgetBalanceNote: { textContent: "" },
    widgetPriciestDebt: { textContent: "" },
    widgetPriciestDebtNote: { textContent: "" },
    widgetNextEvent: { textContent: "" },
    widgetNextEventNote: { textContent: "" },
    widgetCushion: { textContent: "" },
    widgetCushionNote: { textContent: "" },
  };
  const context = sandboxWith(["renderWidgetView", "widgetSnapshot", "widgetPriciestDebt"], {
    qs: (id) => elements[id] || null,
    money: (v) => `${Number(v || 0).toFixed(2)} €`,
    unifiedActionCenterModel: () => ({ asOf: "2026-09-19", context: { balances: { total: 1000 } } }),
    accountBalancesFromState: () => ({ total: 1000 }),
    rangeKpiMetric: () => null,
    homeRowsForHorizon: () => [],
    ajustesFinancialCalendarInput: () => null,
    escenarioMotorDebtOptions: () => [],
    escenarioMotorDebtLabel: () => "",
  });
  context.renderWidgetView();
  assert.equal(elements.widgetPriciestDebt.textContent, "Sin deuda cara");
  assert.match(elements.widgetPriciestDebtNote.textContent, /Ningún contrato activo tiene TAE declarada/);
});

// --- Instalabilidad: icono ------------------------------------------------------------------

test("manifest.webmanifest declara al menos un icono — sin él, Chrome/Android no ofrecen instalar la PWA", () => {
  assert.ok(Array.isArray(manifest.icons) && manifest.icons.length > 0, "manifest.icons debe existir y no estar vacío");
  const icon = manifest.icons[0];
  assert.match(icon.src, /icon\.svg$/);
  assert.equal(icon.type, "image/svg+xml");
});

test("index.html declara un favicon — hasta T10 la pestaña se quedaba sin icono", () => {
  assert.match(indexHtml, /<link rel="icon" href="icon\.svg\?v=[^"]+" type="image\/svg\+xml" \/>/);
});

test("el icono existe como fichero real en el repositorio y es un SVG válido", () => {
  const svg = fs.readFileSync(path.join(root, "icon.svg"), "utf8");
  assert.match(svg, /<svg[^>]*viewBox="0 0 512 512"/);
});

test("service-worker.js precachea manifest.webmanifest e icon.svg junto al resto del shell offline", () => {
  assert.match(serviceWorker, /"\.\/manifest\.webmanifest"/);
  assert.match(serviceWorker, /"\.\/icon\.svg"/);
});

test("tools/build-public-site.mjs copia icon.svg al sitio publicado", () => {
  assert.match(buildScript, /"icon\.svg"/);
});

// --- wiring del widget -----------------------------------------------------------------------

test("wiring: index.html declara la cuarta tarjeta de deuda cara dentro de #widget", () => {
  const sectionStart = indexHtml.indexOf('id="widget"');
  const sectionEnd = indexHtml.indexOf("</section>", sectionStart);
  const cardIdx = indexHtml.indexOf('id="widgetPriciestDebt"');
  assert.ok(sectionStart > 0 && cardIdx > sectionStart && cardIdx < sectionEnd, "La tarjeta de deuda cara debe vivir dentro de #widget");
  assert.ok(indexHtml.indexOf('id="widgetPriciestDebtNote"') < sectionEnd);
});

test("wiring: el atajo del manifest describe también la deuda cara", () => {
  const shortcut = manifest.shortcuts.find((entry) => entry.url === "./#widget");
  assert.ok(shortcut);
  assert.match(shortcut.description, /deuda cara/);
});
