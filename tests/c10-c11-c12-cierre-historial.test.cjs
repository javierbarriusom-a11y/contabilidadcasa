const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const app = fs.readFileSync(path.join(root, "app.js"), "utf8");
const MonthClose = require(path.join(root, "canonical-month-close.js"));
const E5 = require(path.join(root, "canonical-e5-operations.js"));

// Fase 5 · Cierre (segunda fase de cierre de huecos, 17 de agosto): C-10 (historial de versiones),
// C-11 (reapertura notificada a Análisis) y C-12 (evidencia en PDF/CSV). C-9 ya daba IDs estables a
// cada cierre/reapertura de `monthClosures` — estas pruebas cubren las lecturas nuevas sobre esa
// misma lista, sin ningún cálculo financiero nuevo.

function extractFunction(name) {
  let start = app.indexOf(`function ${name}(`);
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

function sandboxWith(names, extra = {}) {
  const context = { ...extra };
  vm.createContext(context);
  names.forEach((name) => vm.runInContext(extractFunction(name), context));
  return context;
}

function baseHelpers(extra = {}) {
  return {
    escapeHtml: (v) => String(v),
    money: (v) => `${Number(v || 0).toFixed(2)} €`,
    formatIsoDate: (v) => v,
    ledgerMonthLabel: (key) => key,
    csvValue: (v) => `"${String(v ?? "").replaceAll('"', '""')}"`,
    ...extra,
  };
}

// --- canonical-month-close.js / canonical-e5-operations.js: el autor viaja con la operación ------

test("C-10 · closeMonth guarda el autor declarado en la operación", () => {
  const payload = MonthClose.closeMonth({}, "2026-07", { closedAt: "2026-08-01T00:00:00.000Z", reason: "Mes revisado", author: "javi@example.com" });
  assert.equal(payload.monthClosures[0].author, "javi@example.com");
});

test("C-10 · closeMonth sin autor declarado no rompe, queda como cadena vacía", () => {
  const payload = MonthClose.closeMonth({}, "2026-07", { closedAt: "2026-08-01T00:00:00.000Z", reason: "Mes revisado" });
  assert.equal(payload.monthClosures[0].author, "");
});

test("C-10 · reopenMonth guarda el autor declarado en la operación", () => {
  const closed = MonthClose.closeMonth({}, "2026-07", { closedAt: "2026-08-01T00:00:00.000Z", reason: "Cierre" });
  const reopened = E5.reopenMonth(closed, "2026-07", { reopenedAt: "2026-08-05T00:00:00.000Z", reason: "Corrección", author: "tere@example.com" });
  assert.equal(reopened.monthClosures[1].author, "tere@example.com");
});

// --- cierreVersionRows / cierreVersionsHtml (C-10) -------------------------------------------------

const closures = [
  { id: "close-1", monthKey: "2026-06", status: "closed", occurredAt: "2026-07-01T00:00:00.000Z", reason: "Cierre de junio", author: "javi@example.com", operation: "month-close" },
  { id: "close-2", monthKey: "2026-07", status: "closed", occurredAt: "2026-08-01T00:00:00.000Z", reason: "Cierre de julio", author: "javi@example.com", operation: "month-close" },
  { id: "reopen-1", monthKey: "2026-07", status: "reopened", occurredAt: "2026-08-05T00:00:00.000Z", reason: "Corrección de un gasto", author: "tere@example.com", operation: "month-reopen" },
];

test("C-10 · cada versión aparece como su propia fila, nunca se sobrescribe", () => {
  const context = sandboxWith(["cierreVersionRows"], baseHelpers());
  const rows = context.cierreVersionRows(closures);
  assert.equal(rows.length, 3);
});

test("C-10 · la fila vigente es la más reciente de cada mes, no la más reciente global", () => {
  const context = sandboxWith(["cierreVersionRows"], baseHelpers());
  const rows = context.cierreVersionRows(closures);
  const junio = rows.find((row) => row.monthKey === "2026-06");
  const julioCierre = rows.find((row) => row.id === "close-2");
  const julioReopen = rows.find((row) => row.id === "reopen-1");
  assert.equal(junio.vigente, true, "junio solo tiene una versión: es la vigente");
  assert.equal(julioCierre.vigente, false, "el cierre de julio quedó superado por su reapertura");
  assert.equal(julioReopen.vigente, true, "la reapertura es la versión vigente de julio");
});

test("C-10 · ordena de más reciente a más antigua", () => {
  const context = sandboxWith(["cierreVersionRows"], baseHelpers());
  const rows = context.cierreVersionRows(closures);
  assert.deepEqual(rows.map((row) => row.id), ["reopen-1", "close-2", "close-1"]);
});

test("C-10 · sin autor declarado en la operación, la fila dice «Sin identificar»", () => {
  const context = sandboxWith(["cierreVersionRows"], baseHelpers());
  const rows = context.cierreVersionRows([{ id: "x", monthKey: "2026-05", status: "closed", occurredAt: "2026-06-01T00:00:00.000Z", reason: "r", operation: "month-close" }]);
  assert.equal(rows[0].autor, "Sin identificar");
});

test("C-10 · el html marca la fila vigente y usa la insignia de estado correcta", () => {
  const context = sandboxWith(["cierreVersionRows", "cierreVersionsHtml"], baseHelpers());
  const html = context.cierreVersionsHtml(context.cierreVersionRows(closures));
  assert.match(html, /is-vigente/);
  assert.match(html, /Vigente/);
  assert.match(html, /e19-badge-warning/);
});

test("C-10 · sin ninguna versión, el html dice que todavía no hay ninguna", () => {
  const context = sandboxWith(["cierreVersionRows", "cierreVersionsHtml"], baseHelpers());
  const html = context.cierreVersionsHtml(context.cierreVersionRows([]));
  assert.match(html, /Todavía no hay ninguna versión/);
});

// --- cierreMonthsCurrentlyReopened (C-11) -----------------------------------------------------------

test("C-11 · un mes cuya última operación es una reapertura cuenta como actualmente reabierto", () => {
  const context = sandboxWith(["cierreMonthsCurrentlyReopened"], baseHelpers({ monthClosures: closures }));
  const reopened = context.cierreMonthsCurrentlyReopened();
  assert.ok(reopened.has("2026-07"));
  assert.ok(!reopened.has("2026-06"));
});

test("C-11 · un mes reabierto y vuelto a cerrar deja de contar como reabierto", () => {
  const recloseAfterReopen = [
    ...closures,
    { id: "close-3", monthKey: "2026-07", status: "closed", occurredAt: "2026-08-10T00:00:00.000Z", reason: "Vuelto a firmar", author: "javi@example.com", operation: "month-close" },
  ];
  const context = sandboxWith(["cierreMonthsCurrentlyReopened"], baseHelpers({ monthClosures: recloseAfterReopen }));
  assert.ok(!context.cierreMonthsCurrentlyReopened().has("2026-07"));
});

test("C-11 · sin ningún cierre todavía, no hay ningún mes reabierto", () => {
  const context = sandboxWith(["cierreMonthsCurrentlyReopened"], baseHelpers({ monthClosures: [] }));
  assert.equal(context.cierreMonthsCurrentlyReopened().size, 0);
});

// --- cierreEvidenceRows / cierreEvidenceCsvContent (C-12) -------------------------------------------

test("C-12 · la evidencia incluye la versión, las cuentas y el recuento de diferencias abiertas", () => {
  const context = sandboxWith(["cierreEvidenceRows"], baseHelpers());
  const accountRows = [{ label: "CaixaBank", declared: 100, calculated: 100, diff: 0, status: "cuadra" }];
  const closure = { id: "close-2", closedAt: "2026-08-01T00:00:00.000Z", author: "javi@example.com", reason: "Cierre de julio" };
  const evidence = context.cierreEvidenceRows(accountRows, [], closure, "2026-07");
  assert.equal(evidence.version.id, "close-2");
  assert.equal(evidence.accounts.length, 1);
  assert.equal(evidence.diferenciasAbiertas, 0);
});

test("C-12 · sin cierre todavía (mes abierto), la evidencia no lleva versión", () => {
  const context = sandboxWith(["cierreEvidenceRows"], baseHelpers());
  const evidence = context.cierreEvidenceRows([], [{ id: "t1" }], null, "2026-08");
  assert.equal(evidence.version, null);
  assert.equal(evidence.diferenciasAbiertas, 1);
});

test("C-12 · el CSV documenta que Sobres está desactivado, no lo omite en silencio", () => {
  const context = sandboxWith(["cierreEvidenceRows", "cierreEvidenceCsvContent"], baseHelpers());
  const evidence = context.cierreEvidenceRows([{ label: "CaixaBank", declared: 100, calculated: 100, diff: 0, status: "cuadra" }], [], null, "2026-08");
  const csv = context.cierreEvidenceCsvContent(evidence);
  assert.match(csv, /Fase 6 desactivada/);
  assert.match(csv, /CaixaBank/);
});
