const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const app = fs.readFileSync(path.join(root, "app.js"), "utf8") + "\n" + fs.readFileSync(path.join(root, "views/cierre.js"), "utf8");
const MonthClose = require(path.join(root, "canonical-month-close.js"));

// Fase 6 · Sobres (Cierre.pdf, 14 de agosto): P-14 (columnas de arrastre y regla en Plan · Mes),
// P-15 (liquidación al cerrar), C-6 (liquidación como asientos) y C-7 (ninguna cobertura en
// silencio). Ningún cálculo financiero nuevo fuera de este bloque: el saldo del sobre reutiliza
// `planMesCollect` (P-2/P-4, aquí sustituida por un doble con datos fijos) y el arrastre solo lee
// `monthClosures`, que C-9/C-10 ya dejaban con IDs estables.

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
    round2: (v) => Math.round((Number(v || 0) + Number.EPSILON) * 100) / 100,
    escapeHtml: (v) => String(v),
    money: (v) => `${Number(v || 0).toFixed(2)} €`,
    formatIsoDate: (v) => v,
    ledgerMonthLabel: (key) => key,
    csvValue: (v) => `"${String(v ?? "").replaceAll('"', '""')}"`,
    seriesKeyForRow: (row) => row.key,
    ...extra,
  };
}

function months(keys) {
  return keys.map((key) => ({ key, label: key }));
}

// --- canonical-month-close.js: el asiento de sobres viaja con el cierre --------------------------

test("P-15/C-6 · closeMonth guarda los asientos de sobres declarados", () => {
  const settlements = [{ rowKey: "ocio", label: "Ocio", saldo: 20, destino: "arrastra", origen: null, carryOut: 20 }];
  const payload = MonthClose.closeMonth({}, "2026-07", {
    closedAt: "2026-08-01T00:00:00.000Z",
    reason: "Mes revisado",
    envelopeSettlements: settlements,
  });
  assert.deepEqual(payload.monthClosures[0].envelopeSettlements, settlements);
});

test("P-15/C-6 · closeMonth sin metadata de sobres deja un array vacío, nunca inventado", () => {
  const payload = MonthClose.closeMonth({}, "2026-07", { closedAt: "2026-08-01T00:00:00.000Z", reason: "Mes revisado" });
  assert.deepEqual(payload.monthClosures[0].envelopeSettlements, []);
});

// --- sobresEnabled / sobresRuleForRow (P-14: bandera y regla) ------------------------------------

test("P-14 · sobresEnabled es false sin configurar y true si la bandera está activa", () => {
  const off = sandboxWith(["sobresEnabled"], baseHelpers({ state: {} }));
  assert.equal(off.sobresEnabled(), false);
  const on = sandboxWith(["sobresEnabled"], baseHelpers({ state: { envelopes: { enabled: true } } }));
  assert.equal(on.sobresEnabled(), true);
});

test("P-14 · sobresRuleForRow por defecto arrastra, salvo que se declare tope-cero", () => {
  const context = sandboxWith(["sobresRuleForRow"], baseHelpers({ state: { envelopes: { rules: { ocio: "tope-cero" } } } }));
  assert.equal(context.sobresRuleForRow("ocio"), "tope-cero");
  assert.equal(context.sobresRuleForRow("comida"), "arrastra");
});

// --- sobresVariableRows / sobresMonthBalances (P-14: saldo del sobre) ----------------------------

test("P-14 · sobresVariableRows solo incluye partidas de Gastos variables", () => {
  const context = sandboxWith(
    ["sobresVariableRows"],
    baseHelpers({
      planMesCollect: () => ({
        expense: [
          { row: { key: "ocio" }, sectionName: "Gastos variables", label: "Ocio", planned: 200, usado: 150 },
          { row: { key: "cuota" }, sectionName: "Financiaciones", label: "Cuota", planned: 300, usado: 300 },
          { row: { key: "luz" }, sectionName: "Gastos fijos", label: "Luz", planned: 60, usado: 55 },
        ],
      }),
    }),
  );
  const rows = context.sobresVariableRows({ key: "2026-07" });
  assert.equal(rows.length, 1);
  assert.equal(rows[0].label, "Ocio");
});

test("P-14 · saldo del sobre es previsto − usado cuando no hay arrastre anterior", () => {
  const context = sandboxWith(
    ["sobresVariableRows", "sobresMonthBalances", "sobresCarryoverBefore", "sobresPreviousMonthKey", "sobresRuleForRow"],
    baseHelpers({
      state: {},
      monthClosures: [],
      cuadroMandosAllMonths: () => months(["2026-06", "2026-07"]),
      planMesCollect: () => ({
        expense: [{ row: { key: "ocio" }, sectionName: "Gastos variables", label: "Ocio", planned: 200, usado: 150 }],
      }),
    }),
  );
  const rows = context.sobresMonthBalances({ key: "2026-07", label: "Julio" });
  assert.equal(rows.length, 1);
  assert.equal(rows[0].rowKey, "ocio");
  assert.equal(rows[0].saldoMes, 50);
  assert.equal(rows[0].arrastreEntrante, 0);
  assert.equal(rows[0].saldo, 50);
});

test("P-14 · el arrastre viene del cierre real del mes inmediatamente anterior, nunca inventado", () => {
  const context = sandboxWith(
    ["sobresPreviousMonthKey", "sobresCarryoverBefore"],
    baseHelpers({
      cuadroMandosAllMonths: () => months(["2026-06", "2026-07"]),
      monthClosures: [
        { status: "closed", monthKey: "2026-06", closedAt: "2026-07-01T00:00:00.000Z", envelopeSettlements: [{ rowKey: "ocio", carryOut: 30 }] },
      ],
    }),
  );
  assert.equal(context.sobresPreviousMonthKey("2026-07"), "2026-06");
  assert.equal(context.sobresCarryoverBefore("ocio", "2026-07"), 30);
  assert.equal(context.sobresCarryoverBefore("otro-sobre", "2026-07"), 0);
});

test("P-14 · sin cierre del mes anterior el arrastre es 0", () => {
  const context = sandboxWith(
    ["sobresPreviousMonthKey", "sobresCarryoverBefore"],
    baseHelpers({ cuadroMandosAllMonths: () => months(["2026-07"]), monthClosures: [] }),
  );
  assert.equal(context.sobresPreviousMonthKey("2026-07"), null);
  assert.equal(context.sobresCarryoverBefore("ocio", "2026-07"), 0);
});

// --- cierreSobresResolved / cierreSobresAllResolved (C-6/C-7) ------------------------------------

test("C-6 · un sobre positivo arrastra por defecto, sin elección del usuario", () => {
  const context = sandboxWith(["cierreSobresResolved", "cierreSobresAllResolved"], baseHelpers({ cierreSobresChoices: {} }));
  const rows = [{ rowKey: "ocio", label: "Ocio", saldo: 50, rule: "arrastra" }];
  const resolved = context.cierreSobresResolved(rows);
  assert.equal(resolved[0].destino, "arrastra");
  assert.equal(resolved[0].resolved, true);
  assert.equal(context.cierreSobresAllResolved(rows), true);
});

test("C-6 · un sobre negativo sin origen declarado no está resuelto", () => {
  const context = sandboxWith(["cierreSobresResolved", "cierreSobresAllResolved"], baseHelpers({ cierreSobresChoices: {} }));
  const rows = [{ rowKey: "ocio", label: "Ocio", saldo: -30, rule: "arrastra" }];
  const resolved = context.cierreSobresResolved(rows);
  assert.equal(resolved[0].resolved, false);
  assert.equal(context.cierreSobresAllResolved(rows), false);
});

test("C-6 · un sobre negativo se resuelve declarando origen «liquidez general»", () => {
  const context = sandboxWith(
    ["cierreSobresResolved", "cierreSobresAllResolved"],
    baseHelpers({ cierreSobresChoices: { ocio: "general" } }),
  );
  const rows = [{ rowKey: "ocio", label: "Ocio", saldo: -30, rule: "arrastra" }];
  const resolved = context.cierreSobresResolved(rows);
  assert.equal(resolved[0].origen, "general");
  assert.equal(resolved[0].resolved, true);
});

test("C-6 · «arrastra» como origen solo es válido si la regla del sobre lo permite", () => {
  const arrastraOk = sandboxWith(
    ["cierreSobresResolved"],
    baseHelpers({ cierreSobresChoices: { ocio: "arrastra" } }),
  );
  const rowsOk = [{ rowKey: "ocio", label: "Ocio", saldo: -30, rule: "arrastra" }];
  assert.equal(arrastraOk.cierreSobresResolved(rowsOk)[0].resolved, true);

  const topeCero = sandboxWith(
    ["cierreSobresResolved"],
    baseHelpers({ cierreSobresChoices: { ocio: "arrastra" } }),
  );
  const rowsTope = [{ rowKey: "ocio", label: "Ocio", saldo: -30, rule: "tope-cero" }];
  assert.equal(topeCero.cierreSobresResolved(rowsTope)[0].resolved, false);
});

test("C-6/C-7 · un sobre negativo se cubre con otro sobre en positivo, y este declara la cobertura como destino", () => {
  const context = sandboxWith(
    ["cierreSobresResolved", "cierreSobresAllResolved"],
    baseHelpers({ cierreSobresChoices: { ocio: "sobre:ropa" } }),
  );
  const rows = [
    { rowKey: "ocio", label: "Ocio", saldo: -30, rule: "arrastra" },
    { rowKey: "ropa", label: "Ropa", saldo: 50, rule: "arrastra" },
  ];
  const resolved = context.cierreSobresResolved(rows);
  const ocio = resolved.find((row) => row.rowKey === "ocio");
  const ropa = resolved.find((row) => row.rowKey === "ropa");
  assert.equal(ocio.origen, "sobre:ropa");
  assert.equal(ocio.resolved, true);
  assert.equal(ropa.destino, "sobre:ocio");
  assert.equal(context.cierreSobresAllResolved(rows), true);
});

test("C-6 · el sobre elegido como origen debe tener superávit suficiente", () => {
  const context = sandboxWith(["cierreSobresResolved"], baseHelpers({ cierreSobresChoices: { ocio: "sobre:ropa" } }));
  const rows = [
    { rowKey: "ocio", label: "Ocio", saldo: -80, rule: "arrastra" },
    { rowKey: "ropa", label: "Ropa", saldo: 50, rule: "arrastra" },
  ];
  const resolved = context.cierreSobresResolved(rows);
  assert.equal(resolved.find((row) => row.rowKey === "ocio").resolved, false);
});

test("C-7 · dos sobres negativos no pueden reclamar el mismo origen en silencio", () => {
  const context = sandboxWith(
    ["cierreSobresResolved", "cierreSobresAllResolved"],
    baseHelpers({ cierreSobresChoices: { ocio: "sobre:ropa", comida: "sobre:ropa" } }),
  );
  const rows = [
    { rowKey: "ocio", label: "Ocio", saldo: -20, rule: "arrastra" },
    { rowKey: "comida", label: "Comida", saldo: -20, rule: "arrastra" },
    { rowKey: "ropa", label: "Ropa", saldo: 50, rule: "arrastra" },
  ];
  const resolved = context.cierreSobresResolved(rows);
  assert.equal(resolved.find((row) => row.rowKey === "ocio").resolved, false);
  assert.equal(resolved.find((row) => row.rowKey === "comida").resolved, false);
  assert.equal(context.cierreSobresAllResolved(rows), false);
});

// --- sobresSettlementsForSign (P-15: qué arrastra cada sobre al firmar) --------------------------

test("P-15 · un sobre que cubre a otro no arrastra el importe cedido, sí el resto", () => {
  const context = sandboxWith(
    ["sobresSettlementsForSign", "sobresMonthBalances", "sobresVariableRows", "sobresCarryoverBefore", "sobresPreviousMonthKey", "sobresRuleForRow", "cierreSobresResolved", "sobresEnabled"],
    baseHelpers({
      state: { envelopes: { enabled: true } },
      monthClosures: [],
      cuadroMandosAllMonths: () => months(["2026-07"]),
      cierreSobresChoices: { ocio: "sobre:ropa" },
      planMesCollect: () => ({
        expense: [
          { row: { key: "ocio" }, sectionName: "Gastos variables", label: "Ocio", planned: 100, usado: 130 },
          { row: { key: "ropa" }, sectionName: "Gastos variables", label: "Ropa", planned: 100, usado: 50 },
        ],
      }),
    }),
  );
  const settlements = context.sobresSettlementsForSign({ key: "2026-07", label: "Julio" });
  const ocio = settlements.find((row) => row.rowKey === "ocio");
  const ropa = settlements.find((row) => row.rowKey === "ropa");
  assert.equal(ocio.saldo, -30);
  assert.equal(ocio.carryOut, 0);
  assert.equal(ropa.saldo, 50);
  assert.equal(ropa.carryOut, 20);
});

test("P-15 · sobresSettlementsForSign devuelve vacío con la bandera apagada", () => {
  const context = sandboxWith(["sobresSettlementsForSign", "sobresEnabled"], baseHelpers({ state: {} }));
  assert.equal(context.sobresSettlementsForSign({ key: "2026-07" }).length, 0);
});

// --- cierreStepsStatus / cierreFirmChecks (C-1/C-5: cuatro pasos con Sobres activo) --------------

test("C-1 · con Sobres apagado, Cierre sigue teniendo tres pasos", () => {
  const context = sandboxWith(["cierreStepsStatus", "cierreAccountsSettled", "sobresEnabled", "cierreSobresAllResolved", "cierreSobresResolved"], baseHelpers({ state: {}, cierreSobresChoices: {} }));
  const steps = context.cierreStepsStatus([{ status: "cuadra" }], []);
  assert.equal(steps.length, 3);
  assert.equal(steps[2].label, "Firmar y archivar");
});

test("C-1 · con Sobres activo, Cierre inserta «Liquidar sobres» como paso 3 y Firmar pasa a 4", () => {
  const context = sandboxWith(
    ["cierreStepsStatus", "cierreAccountsSettled", "sobresEnabled", "cierreSobresAllResolved", "cierreSobresResolved"],
    baseHelpers({ state: { envelopes: { enabled: true } }, cierreSobresChoices: {} }),
  );
  const steps = context.cierreStepsStatus([{ status: "cuadra" }], [], [{ rowKey: "ocio", saldo: 20, rule: "arrastra" }]);
  assert.equal(steps.length, 4);
  assert.equal(steps[2].label, "Liquidar sobres");
  assert.equal(steps[2].done, true);
  assert.equal(steps[3].label, "Firmar y archivar");
  assert.equal(steps[3].step, 4);
});

test("C-5 · «Ningún sobre sin destino» solo aparece con Sobres activo, y bloquea si falta origen", () => {
  const off = sandboxWith(["cierreFirmChecks", "cierreAccountsSettled", "sobresEnabled", "cierreSobresAllResolved", "cierreSobresResolved"], baseHelpers({ state: {}, cierreSobresChoices: {} }));
  const checksOff = off.cierreFirmChecks([{ status: "cuadra" }], [], 5, []);
  assert.equal(checksOff.some((check) => check.id === "sobres"), false);

  const on = sandboxWith(
    ["cierreFirmChecks", "cierreAccountsSettled", "sobresEnabled", "cierreSobresAllResolved", "cierreSobresResolved"],
    baseHelpers({ state: { envelopes: { enabled: true } }, cierreSobresChoices: {} }),
  );
  const checksOn = on.cierreFirmChecks([{ status: "cuadra" }], [], 5, [{ rowKey: "ocio", saldo: -20, rule: "arrastra" }]);
  const sobresCheck = checksOn.find((check) => check.id === "sobres");
  assert.ok(sobresCheck);
  assert.equal(sobresCheck.met, false);
});

// --- cierreEvidenceRows / cierreEvidenceCsvContent (C-12: los asientos viajan en la evidencia) ---

test("C-12 · la evidencia incluye los asientos de sobres del cierre firmado", () => {
  const context = sandboxWith(["cierreEvidenceRows", "cierreEvidenceCsvContent"], baseHelpers({ state: { envelopes: { enabled: true } } }));
  const closure = {
    id: "close-1",
    closedAt: "2026-08-01T00:00:00.000Z",
    author: "javi@example.com",
    reason: "Mes revisado",
    envelopeSettlements: [{ rowKey: "ocio", label: "Ocio", saldo: -20, destino: null, origen: "general", carryOut: 0 }],
  };
  const evidence = context.cierreEvidenceRows([], [], closure, "2026-07");
  assert.equal(evidence.envelopeSettlements.length, 1);
  const csv = context.cierreEvidenceCsvContent(evidence);
  assert.ok(csv.includes("Ocio"));
  assert.ok(csv.includes("general"));
});

test("C-12 · sin cierre firmado, la evidencia declara que no hay asientos que exportar", () => {
  const context = sandboxWith(["cierreEvidenceRows", "cierreEvidenceCsvContent", "sobresEnabled"], baseHelpers({ state: {} }));
  const evidence = context.cierreEvidenceRows([], [], null, "2026-07");
  assert.equal(evidence.envelopeSettlements.length, 0);
  const csv = context.cierreEvidenceCsvContent(evidence);
  assert.ok(csv.includes("Fase 6 desactivada"));
});
