const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { codigoApp } = require("./helpers/codigo-app.cjs");

// Rediseño · fase A3 (docs/rediseno/HANDOFF.md §5 «B1/B2 · Hoy»): Hoy v2 detrás del tema v2.
// Comprueba que (1) solo se descarga y se pinta con la bandera, (2) la Hoy de siempre sigue en el DOM y
// solo se oculta cuando la v2 ya está pintada, y (3) la pantalla respeta sus reglas: como mucho tres
// decisiones, sin puntuación de salud ni tarjetas «Sin datos» sueltas.

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const hoy = read("views/hoy-v2.js");
const css = read("tema-v2.css");

function sandbox() {
  const context = {
    escapeHtml: (value) => String(value ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]),
    money: (value) => `${value} €`,
    unifiedActionImpact: () => "Abrirá la sección sin modificar datos.",
    document: { documentElement: { dataset: {} } },
    qs: () => null,
    Intl,
  };
  vm.createContext(context);
  vm.runInContext(hoy, context);
  return context;
}

test("se carga con defer antes de app.js y está en el sitio público y el service worker", () => {
  const html = read("index.html");
  const hoyAt = html.indexOf('<script defer src="views/hoy-v2.js');
  assert.ok(hoyAt > 0 && hoyAt < html.indexOf('<script defer src="app.js'), "views/hoy-v2.js con defer y antes de app.js");
  assert.ok(read("service-worker.js").includes('"./views/hoy-v2.js"'));
});

test("app.js solo añade la llamada, con los valores que ya calcula renderHomeDashboard", () => {
  const app = codigoApp();
  const body = app.slice(app.indexOf("function renderHomeDashboard()"), app.indexOf("function carSavingsTargetAmount()"));
  assert.match(body, /if \(typeof hoyV2Render === "function"\) hoyV2Render\(\{/);
  assert.ok(read("index.html").includes('<div class="hoy-v2" id="hoyV2" hidden></div>'));
});

test("v2 por defecto: la Hoy nueva no esconde funciones (bandeja de decisiones y apuntar gasto)", () => {
  // La bandeja (cobros esperados, cargos que no llegaron…) sigue saliendo sola cuando hay preguntas.
  assert.match(css, /:not\(#dex5OnboardingBanner\):not\(\.home-secondary-section\),/);
  assert.match(css, /> \.home-secondary-section > :not\(#homeDecisionInboxCard\) \{/);
  const html = read("index.html");
  const secondary = html.indexOf('<div class="home-secondary-section">');
  const inbox = html.indexOf('id="homeDecisionInboxCard"');
  assert.ok(secondary > 0 && inbox > secondary, "la bandeja vive dentro de .home-secondary-section");
  // «+ Apuntar gasto» abre lo mismo que «+ Registrar gasto» y hereda si se puede usar.
  assert.match(hoy, /qs\("homeQuickExpenseOpen"\)\?\.click\(\)/);
  assert.match(hoy, /const disabled = Boolean\(classic\?\.disabled\)/);
});

test("la Hoy de siempre solo se oculta cuando la v2 está pintada, y el detalle la devuelve", () => {
  assert.match(css, /#home:has\(> #hoyV2:not\(\[hidden\]\)\):not\(\.hoy-v2-detalle\)/);
  assert.match(hoy, /HOY_V2_DETAIL_CLASS = "hoy-v2-detalle"/);
  assert.match(hoy, /if \(!hoyV2Active\(\)\) \{\s*root\.hidden = true;/);
});

test("decide como mucho tres cosas: la lectura urgente primero y luego las decisiones abiertas", () => {
  const ctx = sandbox();
  const decisions = [1, 2, 3, 4].map((n) => ({ title: `D${n}`, text: "x", status: "warn", target: "prevision", cta: "Abrir" }));
  const html = ctx.hoyV2Decisions({ title: "Colchón", text: "y", status: "danger", target: "savings-plan", cta: "Plan" }, decisions);
  assert.equal((html.match(/class="hoy-v2-decision"/g) || []).length, 3);
  assert.ok(html.indexOf("Colchón") < html.indexOf("D1"), "la lectura urgente va la primera");
  assert.ok(!html.includes("D3"));
  assert.match(html, /3 de 3/);
  const calm = ctx.hoyV2Decisions({ title: "Estable", status: "good" }, []);
  assert.ok(!calm.includes("Estable"), "una lectura «todo bien» no ocupa hueco de decisión");
  assert.match(calm, /Nada que decidir/);
});

test("las acciones del centro unificado conservan su paso de revisión antes de ejecutar", () => {
  const ctx = sandbox();
  const html = ctx.hoyV2Decisions(null, [{ isUnifiedAction: true, id: "a1", title: "Ruta", text: "t", tone: "warn" }]);
  assert.match(html, /<details class="hoy-v2-review">/);
  assert.match(html, /data-unified-confirm-id="a1"/);
});

test("sin puntuación de salud ni tarjetas «Sin datos» ni líneas «Fuente: canonical-…»", () => {
  assert.ok(!/Salud financiera|healthScore|HealthScore/.test(hoy));
  assert.ok(!/"Sin datos"/.test(hoy));
  assert.ok(!/Fuente: canonical/.test(hoy));
});

test("todas las reglas nuevas siguen colgando de la bandera", () => {
  const rules = css.slice(css.indexOf("A3 · Hoy v2")).replace(/\/\*[\s\S]*?\*\//g, "");
  for (const selector of rules.match(/[^{}@]+(?=\{)/g).map((s) => s.trim()).filter((s) => s && !s.startsWith("media"))) {
    assert.match(selector, /data-tema="v2"/, `regla sin bandera: ${selector}`);
  }
});

test("un cobro ya pasado no se pinta como «Cobráis en 0 días»", () => {
  assert.match(hoy, /nextIncome && nextIncome > asOf && nextIncome >= hoy && Number\(coverage\.days\) > 0/);
});

// 1/11/2026 (captura del hogar): con saldos del 26/10, Hoy decía «Lunes, 26 de octubre» encima de «Hoy» y «Cobráis en 4 días,
// el 30 de octubre» el 1 de noviembre. La cuenta parte de los saldos, pero la cabecera, el mes y los días al cobro son de hoy.
test("la cabecera y el mes son los de hoy; la cuenta dice de qué saldos parte y si un cobro ya pasó", () => {
  assert.match(hoy, /\$\{hoyV2Header\(hoy, model\.dataAge\)\}/);
  assert.match(hoy, /\$\{hoyV2Month\(hoy, model\.plannedSaving\)\}/);
  assert.match(hoy, /<p class="hoy-v2-date">\$\{escapeHtml\(hoyV2LongDate\(hoy\)\)\}<\/p>/);
  const ctx = sandbox();
  assert.equal(ctx.hoyV2DaysBetween("2026-11-01", "2026-11-30"), 29);
  assert.equal(ctx.hoyV2DaysBetween("2026-10-26", "2026-10-30"), 4);
  assert.match(hoy, /const cobroPasado = nextIncome && nextIncome > asOf && nextIncome < hoy \? nextIncome : "";/);
  assert.match(hoy, /ya ha pasado desde esos saldos y esta cifra no lo cuenta\./);
  assert.match(hoy, /saldosViejos && !cobroPasado \? `Con los saldos del /);
  assert.match(hoy, /days: hoyV2DaysBetween\(hoy, nextIncome\)/);
});
