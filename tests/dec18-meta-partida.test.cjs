// DEC-18 (18/11/2026): «vais al N % con partida» en la bandeja de Movimientos. La misma cifra que Funciones en prueba y el
// medidor (gasto importado de los últimos 90 días, sin traspasos entre cuentas propias), cuánto falta para el 95 % y cuántos
// de los conceptos sin partida que más suman bastan. Movimientos inventados.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const read = (file) => fs.readFileSync(path.join(__dirname, "..", file), "utf8");
const clas = read("views/clasificar-v2.js");

function contexto(transactions, { conPartida = [], traspasos = [] } = {}) {
  const context = {
    baseData: { transactions },
    mappingForMovement: (row) => (conPartida.includes(row.movement) ? { row: { id: "x" } } : null),
    movementMappingKey: (row) => `expense|${String(row.movement).toLowerCase()}|`,
    movementMappingGroupKey: (row) => `expense|${String(row.movement).toLowerCase().replace(/octubre|noviembre/, "mes")}|`,
    movementIsInternalTransfer: (row) => traspasos.includes(row.movement),
    globalThis: {},
    Intl,
  };
  vm.createContext(context);
  vm.runInContext(clas, context);
  return context;
}

const tx = (date, movement, amount, source = "Extracto") => ({ date, movement, amount, source });
const HOY = new Date(2026, 10, 18, 12);

test("DEC-18 · el %, lo que falta para el 95 % y los conceptos que bastan, de más a menos", () => {
  const c = contexto(
    [
      tx("2026-11-10", "SUPER FICTICIO", -600),
      tx("2026-11-01", "FINANCIE-NOVIEMBRE", -150),
      tx("2026-10-01", "FINANCIE-OCTUBRE", -150), // mismo concepto sin el mes: un grupo de 300 €
      tx("2026-11-05", "BAR FICTICIO", -80),
      tx("2026-11-06", "KIOSCO FICTICIO", -20),
      tx("2026-11-07", "NOMINA FICTICIA", 2000), // un ingreso no cuenta
      tx("2026-11-08", "TRASPASO FICTICIO", -500), // un traspaso no es gasto
      tx("2026-11-09", "CAPTURA", -40, "manual-quick-capture"), // lo apuntado a mano no es importado
      tx("2026-07-01", "VIEJO FICTICIO", -900), // fuera de los 90 días
    ],
    { conPartida: ["SUPER FICTICIO"], traspasos: ["TRASPASO FICTICIO"] },
  );
  // 600 con partida de 1.000: 60 %. Para el 95 % faltan 350 €: el grupo de 300 (FINANCIE, dos meses) y el de 80.
  assert.deepEqual(JSON.parse(JSON.stringify(c.clasV2Meta(HOY))), { pct: 60, objetivo: 95, falta: 350, grupos: 2 });
  assert.equal(c.clasV2Coverage(HOY), 60, "la cifra de siempre sale de la misma cuenta");
});

test("DEC-18 · cumplido: falta 0 y ningún concepto; sin gasto importado, nada", () => {
  const c = contexto([tx("2026-11-10", "SUPER FICTICIO", -960), tx("2026-11-11", "KIOSCO FICTICIO", -40)], { conPartida: ["SUPER FICTICIO"] });
  assert.deepEqual(JSON.parse(JSON.stringify(c.clasV2Meta(HOY))), { pct: 96, objetivo: 95, falta: 0, grupos: 0 });
  assert.equal(contexto([tx("2026-11-07", "NOMINA FICTICIA", 2000)]).clasV2Meta(HOY), null);
});

test("DEC-18 · la bandeja lo pinta con la barra y sin rojo; el medidor y Funciones en prueba siguen con la misma frase", () => {
  const mov = read("views/movimientos-v2.js");
  assert.match(mov, /function movV2MetaHtml\(\)/);
  assert.match(mov, /\$\{head\}\$\{body\}\$\{movV2MetaHtml\(\)\}/, "justo debajo de la fila de Clasificar");
  assert.match(mov, /role="progressbar" aria-label="Gasto con partida, últimos 90 días" aria-valuemin="0" aria-valuemax="100" aria-valuenow="\$\{meta\.pct\}"/);
  assert.match(mov, /objetivo del \$\{meta\.objetivo\} % cumplido/);
  assert.doesNotMatch(mov.slice(mov.indexOf("function movV2MetaHtml"), mov.indexOf("// Bandeja: lo que pide algo.")), /<h[1-6]/, "XGO-01: sin titulares");
  const css = read("tema-v2.css");
  const reglas = css.slice(css.indexOf(".mov-v2-meta-partida {") - 40, css.indexOf(':root[data-tema="v2"] .mov-v2-pending {'));
  assert.doesNotMatch(reglas, /danger|warning/, "sin rojo ni ámbar");
  assert.match(clas, /function clasificarV2CoberturaFrase\(\) \{\s*const pct = typeof baseData === "undefined" \? null : clasV2Coverage\(\);/);
});
