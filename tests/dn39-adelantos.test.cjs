// D-N39 (24/11/2026, decisión del hogar: «quiero que adelantes todo lo que esté bloqueado por fechas»): sustituye a D-N30 («un cambio de Hoy
// por semana»). Ninguna puerta de fecha queda por delante del 24/11; y DUO-D4 no se duplica: el plan lleva a la escalera de WP-42.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const read = (file) => fs.readFileSync(path.join(__dirname, "..", file), "utf8");

test("D-N39 · ninguna puerta de fecha de Hoy, del seguimiento ni de los hitos espera más allá del 24/11/2026", () => {
  const puertas = [];
  for (const f of ["views/hoy-v2.js", "seguimiento-plan-ui.js", "hitos-deuda-ui.js", "views/movimientos-v2.js"]) {
    for (const m of read(f).matchAll(/^const ([A-Z_0-9]+_DESDE) = "(\d{4}-\d{2}-\d{2})";$/gm)) puertas.push([f, m[1], m[2]]);
  }
  assert.ok(puertas.length >= 9, `se encuentran las puertas (${puertas.length})`);
  for (const [f, nombre, fecha] of puertas) assert.ok(fecha <= "2026-11-24", `${f}: ${nombre} = ${fecha}`);
  for (const nombre of ["HOY_V2_EXTRACTOS_DESDE", "HOY_V2_HECHO_DESDE", "HOY_V2_INDICADORES_DESDE", "HOY_V2_PERMITIR_DESDE", "SEG_HOY_DESDE", "HITO_HOY_DESDE"]) {
    assert.ok(puertas.some(([, n, fecha]) => n === nombre && fecha === "2026-11-24"), nombre);
  }
});

test("D-N39 · la revisión trimestral ya no espera a la semana del 14/12", () => {
  assert.doesNotMatch(read("index.html"), /Revisión trimestral \(semana del 14\/12\)/);
  assert.doesNotMatch(read("revision-trimestral-ui.js"), /semana del 14\/12\) · /);
});

test("DUO-D4 · la cascada del siguiente euro no se duplica: el plan óptimo lleva a la escalera de WP-42 (Deuda › Ofertas › Comparar)", () => {
  const ui = read("camino-deuda-ui.js");
  assert.match(ui, /data-plan-optimo-escalera>¿Todo lo que sobra a deuda\? <a href="#deuda-comparar">La escalera del próximo euro<\/a>/);
  assert.ok(read("index.html").includes('id="deuda-comparar"'));
});
