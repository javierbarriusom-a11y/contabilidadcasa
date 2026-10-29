const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

// Guía del cierre de mes (29/10/2026): los pasos, por mes, guardados en este navegador. Sin importes.

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

function sandbox() {
  const store = new Map();
  const context = {
    escapeHtml: (value) => String(value ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])),
    storageKey: (name) => `hogar:${name}`,
    storageGet: (key, fallback) => (store.has(key) ? store.get(key) : fallback),
    storageSet: (key, value) => store.set(key, value),
    globalThis: {},
  };
  vm.createContext(context);
  vm.runInContext(read("cierre-guia-ui.js"), context);
  return { context, store };
}

test("nueve pasos, en el orden del cierre, con lo que bloquea la firma y lo que solo avisa", () => {
  const { context } = sandbox();
  const pasos = JSON.parse(JSON.stringify(vm.runInContext("CIERRE_GUIA_PASOS", context))); // del contexto del vm a este, para comparar
  assert.deepEqual(pasos.map((paso) => paso.id), ["sesion", "extracto", "clasificar", "saldos", "reales", "valorar", "conciliar", "diferencias", "firmar"]);
  assert.deepEqual(pasos.filter((paso) => paso.nivel === "bloquea").map((paso) => paso.id), ["sesion", "extracto", "clasificar", "saldos", "conciliar", "diferencias"]);
  assert.ok(pasos.every((paso) => !/\d+[.,]?\d*\s?€/.test(`${paso.que} ${paso.como}`)), "sin importes");
});

test("el mes va por su nombre y cada mes tiene sus propias casillas", () => {
  const { context, store } = sandbox();
  const html = vm.runInContext('cierreGuiaHtml("2026-10", { meses: {} })', context);
  assert.match(html, /Importad el extracto hasta el último día de octubre/);
  assert.equal(vm.runInContext('cierreGuiaNombreMes("2026-11")', context), "noviembre");
  vm.runInContext('cierreGuiaSave({ meses: { "2026-10": { sesion: true, extracto: true } } })', context);
  assert.equal(vm.runInContext('cierreGuiaHechos(cierreGuiaLoad(), "2026-10")', context), 2);
  assert.equal(vm.runInContext('cierreGuiaHechos(cierreGuiaLoad(), "2026-11")', context), 0, "noviembre empieza en blanco");
  assert.equal(vm.runInContext("cierreGuiaResumen(2)", context), "2 de 9 pasos hechos");
  assert.equal(vm.runInContext("cierreGuiaResumen(9)", context), "Todos los pasos hechos");
  assert.ok(store.has("hogar:cierre-guia"));
});

test("guarda como mucho seis meses y un almacén roto no rompe nada", () => {
  const { context, store } = sandbox();
  const meses = Object.fromEntries(["2026-03", "2026-04", "2026-05", "2026-06", "2026-07", "2026-08", "2026-09", "2026-10"].map((key) => [key, { sesion: true }]));
  context.meses = meses;
  vm.runInContext("cierreGuiaSave({ meses })", context);
  assert.deepEqual(Object.keys(JSON.parse(store.get("hogar:cierre-guia")).meses), ["2026-05", "2026-06", "2026-07", "2026-08", "2026-09", "2026-10"]);
  store.set("hogar:cierre-guia", "{roto");
  assert.deepEqual(JSON.parse(JSON.stringify(vm.runInContext("cierreGuiaLoad()", context))), { meses: {} });
});

test("vive en Cierre, plegada y sin titulares dentro (no pesa en la superficie), en el sitio y en el catálogo", () => {
  const html = read("index.html");
  assert.match(html, /<details class="e19-card cierre-guia" id="cierreGuia" hidden>/);
  const bloque = html.slice(html.indexOf('id="cierreGuia"'), html.indexOf("</details>", html.indexOf('id="cierreGuia"')));
  assert.doesNotMatch(bloque, /<h[23]/);
  assert.doesNotMatch(read("cierre-guia-ui.js"), /<h[23]/, "la guía no pinta titulares");
  assert.match(read("views/cierre.js"), /renderCierreGuia\?\.\(currentMonthKey/);
  assert.match(html, /<script defer src="cierre-guia-ui\.js\?v=/);
  assert.match(read("tools/build-public-site.mjs"), /"cierre-guia-ui\.js",/);
  assert.match(read("service-worker.js"), /"\.\/cierre-guia-ui\.js",/);
  assert.match(read("funciones-en-prueba.js"), /id: "cierre-guia"/);
  assert.match(read("medidor-utilidad.js"), /id: "cierre-guia"/);
});
