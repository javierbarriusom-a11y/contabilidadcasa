const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { codigoApp } = require("./helpers/codigo-app.cjs");

// Cobro caducado (docs/rediseno/ESTADO.md §6 y §8; respuestas P3 y P4 del hogar, 19/10/2026).
// Datos inventados: ninguna fecha ni cifra del hogar.

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const app = codigoApp();

function sandbox() {
  const listeners = [];
  const context = {
    document: { addEventListener: (type, fn) => listeners.push({ type, fn }), getElementById: () => null },
    escapeHtml: (value) => String(value).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]),
    parseAmount: (value) => {
      const raw = String(value ?? "").trim();
      if (!raw) return null;
      const n = Number(raw.replace(",", "."));
      return Number.isFinite(n) ? n : null;
    },
  };
  vm.createContext(context);
  vm.runInContext(read("views/cobertura-ajuste.js"), context);
  return { ...context, listeners };
}

test("P3: una fecha de cobro manual anterior a la fecha de saldos deja de aplicarse y avisa", () => {
  const { coberturaAjusteLeer, coberturaAjusteAvisos } = sandbox();
  const caducado = coberturaAjusteLeer({ nextIncomeDate: "2026-03-31", dailyOutflow: 40 }, "2026-05-10");
  assert.equal(caducado.nextIncomeDate, "", "la fecha pasada ya no se pasa al motor");
  assert.equal(caducado.expiredDate, "2026-03-31");
  assert.equal(caducado.dailyOutflow, 40, "el gasto diario bueno se sigue usando");
  assert.deepEqual([...coberturaAjusteAvisos(caducado)], ["Tu fecha de cobro manual caducó el 31/03: ponla al día."]);
  const vigente = coberturaAjusteLeer({ nextIncomeDate: "2026-05-10" }, "2026-05-10");
  assert.equal(vigente.nextIncomeDate, "2026-05-10", "el mismo día de saldos todavía vale (0 días de verdad)");
  assert.equal(vigente.expiredDate, "");
});

test("P4: un gasto diario manual de 0 € no se usa y avisa; vacío o null nunca es 0 €", () => {
  const { coberturaAjusteLeer, coberturaAjusteAvisos } = sandbox();
  const cero = coberturaAjusteLeer({ dailyOutflow: 0 }, "2026-05-10");
  assert.equal(cero.dailyOutflow, null);
  assert.equal(cero.zeroOutflow, true);
  assert.match(coberturaAjusteAvisos(cero)[0], /0 €: no se usa/);
  for (const vacio of [null, undefined, ""]) {
    const leido = coberturaAjusteLeer({ dailyOutflow: vacio }, "2026-05-10");
    assert.equal(leido.dailyOutflow, null, `${vacio} no es un gasto`);
    assert.equal(leido.zeroOutflow, false, `${vacio} no es un 0 € guardado`);
  }
  assert.deepEqual([...coberturaAjusteAvisos(coberturaAjusteLeer({}, "2026-05-10"))], [], "sin ajuste, sin aviso");
});

test("abrir el editor y pulsar Guardar no congela lo aprendido como manual", () => {
  const { coberturaAjusteAGuardar, coberturaAjusteSinCambios } = sandbox();
  const prefill = { prefillDate: "2026-05-28", prefillOutflow: "35.00" };
  const sinTocar = { fecha: "2026-05-28", gasto: "35.00" };
  assert.equal(coberturaAjusteSinCambios(sinTocar, prefill), true, "sin cambios, Guardar apagado");
  assert.deepEqual({ ...coberturaAjusteAGuardar(sinTocar, prefill, {}) }, { nextIncomeDate: "", dailyOutflow: null });
  const soloGasto = coberturaAjusteAGuardar({ fecha: "2026-05-28", gasto: "42" }, prefill, {});
  assert.deepEqual({ ...soloGasto }, { nextIncomeDate: "", dailyOutflow: 42 }, "solo se guarda lo que se tocó");
  const yaManual = coberturaAjusteAGuardar(sinTocar, prefill, { nextIncomeDate: "2026-05-28", dailyOutflow: null });
  assert.equal(yaManual.nextIncomeDate, "2026-05-28", "lo que ya era manual se conserva");
  assert.equal(coberturaAjusteSinCambios({ fecha: "2026-05-30", gasto: "35.00" }, prefill), false);
  assert.equal(coberturaAjusteAGuardar({ fecha: "", gasto: "" }, { prefillDate: "", prefillOutflow: "1" }, {}).dailyOutflow, null, "vaciar el campo no guarda 0 €");
});

test("el aviso escapa el texto y lleva al editor", () => {
  const { coberturaAjusteAvisoHtml, listeners } = sandbox();
  assert.equal(coberturaAjusteAvisoHtml({ expiredDate: "", zeroOutflow: false }), "");
  const html = coberturaAjusteAvisoHtml({ expiredDate: "2026-03-31", zeroOutflow: true }, "hoy-v2-warning");
  assert.match(html, /^<p class="hoy-v2-warning" role="status">/);
  assert.match(html, /data-cobertura-ajuste-ir/);
  assert.ok(listeners.some((l) => l.type === "click"), "el botón tiene a dónde ir");
});

test("cableado: app.js, Hoy v2, index.html, service worker y sitio público", () => {
  assert.match(app, /function e6CoverageSettings\(\) \{\s*return coberturaAjusteLeer\(scenarioSettings\?\.e6Coverage, state\?\.balanceDate \|\| defaultBalanceDate\(\)\);/);
  assert.match(app, /\$\{coberturaAjusteAvisoHtml\(e6CoverageSettings\(\)\)\}/, "la tarjeta de la Hoy de siempre avisa");
  assert.match(app, /if \(settings\.expiredDate \|\| settings\.zeroOutflow\) return \{ tone: "warn"/, "el editor dice «Caducado»");
  assert.match(app, /button\.disabled = coberturaAjusteSinCambios\(/);
  assert.match(app, /\.\.\.coberturaAjusteAGuardar\(/);
  assert.match(app, /editor\.dataset\.prefillDate = /);
  assert.match(read("views/hoy-v2.js"), /coberturaAjusteAvisoHtml\(e6CoverageSettings\(\), "hoy-v2-warning"\)/, "la Hoy v2 también avisa");
  const html = read("index.html");
  const at = html.indexOf('<script defer src="views/cobertura-ajuste.js');
  assert.ok(at > 0 && at < html.indexOf('<script defer src="views/hoy-v2.js') && at < html.indexOf('<script defer src="app.js'), "antes de hoy-v2.js y de app.js");
  assert.ok(read("service-worker.js").includes('"./views/cobertura-ajuste.js"'));
  assert.ok(read("tools/build-public-site.mjs").includes('  "views/cobertura-ajuste.js",\n'));
  assert.doesNotMatch(read("views/cobertura-ajuste.js"), /FinanceCanonicalDailyEngine|canonical-daily-engine\.js"\)/, "no toca el motor");
});
