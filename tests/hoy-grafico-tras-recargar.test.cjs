// 21/11/2026 · «La pantalla Hoy ha perdido su gráfico». Desde el 10/11 (#605) la previsión diaria se guarda compactada, sin sus filas
// día a día (compactCanonicalDailyRun), y al volver a abrir la app refreshCanonicalDailyAudit devolvía esa copia tal cual si el plan
// no había cambiado: sin filas, el gráfico de Hoy (y lo demás que lee canonicalDailyEngineRuns.*.rows) se quedaba vacío. En la demo no
// se veía porque arranca sin nada guardado. Ahora la copia solo sirve si trae sus filas; si no, se recalcula.
const test = require("node:test");
const assert = require("node:assert/strict");
const vm = require("node:vm");
const { codigoApp } = require("./helpers/codigo-app.cjs");

function extraer(codigo, nombre) {
  const inicio = codigo.indexOf(`function ${nombre}(`);
  assert.ok(inicio >= 0, nombre);
  let nivel = 0;
  for (let i = codigo.indexOf("{", inicio); i < codigo.length; i += 1) {
    if (codigo[i] === "{") nivel += 1;
    if (codigo[i] === "}" && --nivel === 0) return codigo.slice(inicio, i + 1);
  }
  throw new Error(`sin cierre: ${nombre}`);
}

function contexto(previo) {
  const llamadas = [];
  const ctx = {
    window: {
      FinanceCanonicalDailyEngine: { SCHEMA_ID: "daily-v1", buildSnapshot: (input, prev) => { llamadas.push(prev); return { rows: [{ date: "2026-11-21", total: 100 }], invariants: { valid: true } }; } },
      FinanceCanonicalDailyInput: { datesSignature: () => "firma", build: () => ({}) },
    },
    canonicalEngineRuns: { active: { fingerprint: "huella" } },
    canonicalDailyEngineRuns: { active: previo },
    state: { operatingReserve: 0 },
  };
  vm.createContext(ctx);
  const codigo = codigoApp();
  vm.runInContext(["requiredCanonicalDailyEngine", "assertCanonicalDailySnapshot", "refreshCanonicalDailyAudit"].map((n) => extraer(codigo, n)).join("\n"), ctx);
  return { ctx, llamadas };
}

test("una copia guardada sin filas no sirve: se recalcula y vuelven las filas del gráfico de Hoy", () => {
  const guardada = { monthlyFingerprint: "huella", datesSignature: "firma", invariants: { valid: true }, rowCount: 3714 }; // como la deja compactCanonicalDailyRun
  const { ctx, llamadas } = contexto(guardada);
  const run = vm.runInContext('refreshCanonicalDailyAudit({}, [], "active")', ctx);
  assert.equal(llamadas.length, 1, "recalcula");
  assert.equal(run.rows.length, 1);
  assert.equal(vm.runInContext("canonicalDailyEngineRuns.active.rows.length", ctx), 1);
});

test("con sus filas y el mismo plan, se reutiliza como siempre (sin recalcular)", () => {
  const enMemoria = { monthlyFingerprint: "huella", datesSignature: "firma", invariants: { valid: true }, rows: [{ date: "2026-11-21", total: 50 }] };
  const { ctx, llamadas } = contexto(enMemoria);
  const run = vm.runInContext('refreshCanonicalDailyAudit({}, [], "active")', ctx);
  assert.equal(llamadas.length, 0);
  assert.equal(run, vm.runInContext("canonicalDailyEngineRuns.active", ctx));
});
