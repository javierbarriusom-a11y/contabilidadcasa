const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const read = (name) => fs.readFileSync(path.join(root, name), "utf8");
const app = read("app.js");
const html = read("index.html");
const worker = read("service-worker.js");
const p2Export = read("p2-export.js");

// V6-4 · exportación única: el CSV completo (ya existía, `downloadCsv`, ahora también accesible
// desde Ajustes) y un PDF del mes abierto en Registrar el mes, construido con el mismo escritor de
// PDF sin dependencias que ya usaba el informe para el asesor (P2Export, sin librería externa).

function extractFunction(name) {
  const start = app.indexOf(`function ${name}(`);
  assert.ok(start >= 0, `No existe la función ${name} en app.js`);
  let parenDepth = 0;
  let bodyStart = -1;
  for (let index = app.indexOf("(", start); index < app.length; index += 1) {
    if (app[index] === "(") parenDepth += 1;
    else if (app[index] === ")") {
      parenDepth -= 1;
      if (parenDepth === 0) {
        bodyStart = app.indexOf("{", index);
        break;
      }
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

function field() {
  return { textContent: "" };
}

function sandbox({ month = null, fields = {} } = {}) {
  const elements = new Map(Object.entries(fields));
  const announcements = [];
  const downloadCalls = [];
  const entries = {
    income: [{ label: "Nómina", planned: 2000, actual: 2050, hasActual: true, variance: 50 }],
    expense: [{ label: "Alquiler", planned: 900, actual: null, hasActual: false, variance: null }],
  };
  const totals = { incomeUsed: 2050, expenseUsed: 900, incomePlanned: 2000, expensePlanned: 900, captured: 1, lines: 2 };
  const context = {
    qs: (id) => elements.get(id) || null,
    money: (value) => `${Number(value).toFixed(2)} €`,
    registrarMesSignedMoney: (value) => `${Number(value) > 0 ? "+" : ""}${Number(value).toFixed(2)} €`,
    registrarMesLongMonth: (key) => `mes de prueba (${key})`,
    registrarMesSelectedMonth: () => month,
    registrarMesCollect: () => entries,
    registrarMesTotals: () => totals,
    announceStatus: (text) => announcements.push(text),
    window: { P2Export: { downloadPlainPdf: (...args) => downloadCalls.push(args) } },
  };
  vm.createContext(context);
  vm.runInContext(
    ["ajustesExportMonthLines", "handleAjustesExportPdf", "renderAjustesExportNote"].map(extractFunction).join("\n"),
    context,
    { filename: "app.js#v6-4-exportacion-unica" },
  );
  return { context, announcements, downloadCalls, entries, totals };
}

test("V6-4 · el PDF del mes lista cada partida con previsto, real y desviación", () => {
  const { context, entries, totals } = sandbox();
  const lines = context.ajustesExportMonthLines({ key: "2026-09" }, entries, totals);
  assert.match(lines[0], /RESUMEN DEL MES/);
  assert.ok(lines.some((line) => line.includes("Nómina") && line.includes("+50.00 €")));
  assert.ok(lines.some((line) => line.includes("Alquiler") && line.includes("sin registrar")));
  assert.ok(lines.some((line) => line.includes("Ingresos usados")));
});

test("V6-4 · sin partidas de un tipo, el PDF lo dice en vez de dejar la sección vacía", () => {
  const { context } = sandbox();
  const lines = context.ajustesExportMonthLines(
    { key: "2026-09" },
    { income: [], expense: [] },
    { incomeUsed: 0, expenseUsed: 0, incomePlanned: 0, expensePlanned: 0, captured: 0, lines: 0 },
  );
  assert.ok(lines.includes("Sin partidas de ingreso."));
  assert.ok(lines.includes("Sin partidas de gasto."));
});

test("V6-4 · exportar sin mes abierto avisa y no llama a P2Export", () => {
  const { context, announcements, downloadCalls } = sandbox({ month: null });
  context.handleAjustesExportPdf();
  assert.equal(downloadCalls.length, 0);
  assert.match(announcements[0], /Abre un mes en Registrar el mes/);
});

test("V6-4 · exportar con un mes abierto descarga el PDF con el nombre del mes", () => {
  const { context, announcements, downloadCalls } = sandbox({ month: { key: "2026-09" } });
  context.handleAjustesExportPdf();
  assert.equal(downloadCalls.length, 1);
  assert.equal(downloadCalls[0][1], "resumen-mes-2026-09.pdf");
  assert.match(announcements[0], /PDF de mes de prueba \(2026-09\) descargado/);
});

test("V6-4 · la nota de Ajustes dice qué mes se exportará, o que no hay ninguno abierto", () => {
  const sinMes = sandbox({ month: null, fields: { ajustesExportNote: field() } });
  sinMes.context.renderAjustesExportNote();
  assert.match(sinMes.context.qs("ajustesExportNote").textContent, /Abre un mes en Registrar el mes/);

  const conMes = sandbox({ month: { key: "2026-09" }, fields: { ajustesExportNote: field() } });
  conMes.context.renderAjustesExportNote();
  assert.match(conMes.context.qs("ajustesExportNote").textContent, /mes de prueba \(2026-09\)/);
});

test("V6-4 · el escritor de PDF sin librería externa gana un método genérico, sin tocar el existente", () => {
  assert.match(p2Export, /downloadPlainPdf\(lines, fileName\) \{\s*download\(pdfBlob\(lines\), fileName\);\s*\}/);
  assert.match(p2Export, /downloadPdf\(model, fileName\) \{/, "el informe para el asesor sigue existiendo, sin tocarse");
});

test("V6-4 · el CSV completo y el PDF del mes se piden desde Ajustes, con ayuda", () => {
  assert.match(html, /id="ajustesExportCsv"/);
  assert.match(html, /id="ajustesExportPdf"/);
  assert.match(html, /id="ajustesExportNote"/);
  assert.match(app, /qs\("ajustesExportCsv"\)\?\.addEventListener\("click", downloadCsv\)/);
  assert.match(app, /qs\("ajustesExportPdf"\)\?\.addEventListener\("click", handleAjustesExportPdf\)/);
  assert.match(app, /qs\("ajustesExportCsv"\)\?\.setAttribute\("data-help"/);
  assert.match(app, /qs\("ajustesExportPdf"\)\?\.setAttribute\("data-help"/);
});

test("V6-4 · Ajustes ya no enruta la exportación a Flujo de caja: el CSV se pide aquí mismo", () => {
  assert.ok(!html.includes('data-home-nav="cashflow"'), "la tarjeta de Exportar ya no es un enlace de ruta");
});

test("V6-4 · viaja en el shell offline versionado", () => {
  assert.match(worker, /20260814-f1a1/);
  assert.match(html, /app\.js\?v=20260814f1a1/);
  assert.match(html, /p2-export\.js\?v=20260811v64a1/);
});
