const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

// Hoy, cambio 2 (semana del 1/11/2026): la entrada al Repaso semanal en Hoy (views/hoy-v2.js), solo mientras el repaso
// de esa semana está por hacer, con puerta de fecha como el cambio 1.

const root = path.resolve(__dirname, "..");
const read = (name) => fs.readFileSync(path.join(root, name), "utf8");
const hoy = read("views/hoy-v2.js");
const repaso = read("views/repaso-v2.js");

function extract(source, name) {
  const start = source.indexOf(`function ${name}(`);
  assert.ok(start >= 0, `No existe ${name}`);
  let depth = 0;
  for (let index = source.indexOf("{", source.indexOf(")", start)); index < source.length; index += 1) {
    if (source[index] === "{") depth += 1;
    else if (source[index] === "}") {
      depth -= 1;
      if (depth === 0) return source.slice(start, index + 1);
    }
  }
  throw new Error(`Sin cuerpo: ${name}`);
}

function sandbox(runs) {
  const isoLocalDate = (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
  const context = { isoLocalDate, escapeHtml: (text) => String(text), runs };
  context.globalThis = context;
  vm.createContext(context);
  vm.runInContext(
    [
      'const HOY_V2_REPASO_DESDE = "2026-11-01";',
      extract(repaso, "repasoV2Lunes"),
      "globalThis.repasoV2Open = () => {};",
      "globalThis.FinanceRepaso = { resumen: () => ({ ultimo: runs.at(-1) || null }), mismaSemana: (a, b) => repasoV2Lunes(a) === repasoV2Lunes(b) };",
      extract(hoy, "hoyV2Repaso"),
    ].join("\n"),
    context,
  );
  return context;
}

test("puerta de fecha: no sale antes del 1/11 (el cambio 1 tiene su semana)", () => {
  assert.match(hoy, /const HOY_V2_REPASO_DESDE = "2026-11-01";/);
  const { hoyV2Repaso } = sandbox([]);
  assert.equal(hoyV2Repaso("2026-10-31"), "");
  assert.match(hoyV2Repaso("2026-11-01"), /data-hoy-v2-repaso/);
});

test("sale mientras el repaso de esta semana (lunes a domingo) está por hacer; hecho, no ocupa pantalla", () => {
  // Lunes 2/11: el del domingo 1/11 es de la semana anterior.
  assert.match(sandbox([{ date: "2026-11-01", seconds: 240 }]).hoyV2Repaso("2026-11-02"), /data-hoy-v2-repaso/);
  // Hecho el lunes: no sale en toda la semana, tampoco el domingo.
  const hecho = sandbox([{ date: "2026-11-02", seconds: 240 }]);
  assert.equal(hecho.hoyV2Repaso("2026-11-04"), "");
  assert.equal(hecho.hoyV2Repaso("2026-11-08"), "");
  // El lunes siguiente vuelve.
  assert.match(hecho.hoyV2Repaso("2026-11-09"), /hace 7 días, en 4 min/);
});

test("dice lo que costó el último o, si no hay ninguno, qué tiene", () => {
  assert.match(sandbox([]).hoyV2Repaso("2026-11-03"), /Repaso de esta semana · unos 5 min[\s\S]*Saldos, extracto, lo que vino y la bandeja, en orden\./);
  assert.match(sandbox([{ date: "2026-11-01", seconds: 20 }]).hoyV2Repaso("2026-11-02"), /hace 1 día, en 1 min\./);
});

test("sin el script del repaso, no hay entrada", () => {
  const context = sandbox([]);
  vm.runInContext("globalThis.repasoV2Open = undefined;", context);
  assert.equal(context.hoyV2Repaso("2026-11-03"), "");
});

test("está en Hoy: debajo de las decisiones, abre el repaso desde la propia línea y al cerrar Hoy se repinta", () => {
  assert.match(hoy, /\$\{hoyV2Decisions\(model\.todayRead, model\.decisions\)\}\n\s+\$\{hoyV2Repaso\(\)\}\n\s+\$\{hoyV2Esperados\(\)\}/);
  assert.match(hoy, /closest\("\[data-hoy-v2-repaso\]"\);\n\s+if \(repaso\) \{\n\s+globalThis\.repasoV2Open\?\.\(repaso\);/);
  assert.match(repaso, /mismaSemana\(a, b\) \{\n\s+return repasoV2Lunes\(a\) === repasoV2Lunes\(b\);/);
  assert.match(repaso, /const desdeHoy = Boolean\(opener\?\.hasAttribute\?\.\("data-hoy-v2-repaso"\)\);/);
  assert.match(repaso, /if \(desdeHoy && typeof renderHomeDashboard === "function"\) renderHomeDashboard\(\);/);
});

test("estilo propio bajo el tema v2 (borde continuo y punto de aviso, como las preguntas de cobros y cargos)", () => {
  const css = read("tema-v2.css");
  assert.match(css, /:root\[data-tema="v2"\] \.hoy-v2-esperados,\n:root\[data-tema="v2"\] \.hoy-v2-repaso \{\n {2}border-style: solid;/);
  assert.match(css, /:root\[data-tema="v2"\] \.hoy-v2-repaso \.hoy-v2-dot \{\n {2}color: var\(--e19-warning\);/);
});

test("anunciado en Novedades", () => {
  assert.match(read("novedades.js"), /id: "2026-10-24-hoy-repaso",\n\s+fecha: "2026-10-24",\n\s+texto: "Desde el 1\/11, Hoy te recuerda el repaso semanal/);
});
