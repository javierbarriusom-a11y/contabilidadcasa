// DEC-14 · Clasificar por importe típico y día del mes (décima auditoría §4.3; 20/11/2026, el hogar: «sigue con todo lo que
// puedas que no depende de nosotros»). El recibo que llega cada mes con el mismo importe y hacia el mismo día se propone con
// confianza media aunque su concepto cambie entero; nunca se guarda como regla. Datos inventados.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const P = require("../canonical-pattern-rules.js");

const read = (file) => fs.readFileSync(path.join(__dirname, "..", file), "utf8");
const cl = (date, amount, rowKey) => ({ row: { date, amount, movement: "RECIBO FICTICIO", details: "" }, rowKey });

test("DEC-14 · la partida a la que fue en dos meses distintos, con importe ± 10 % y a ± 3 días", () => {
  const clasificados = [cl("2026-08-05", -42, "expense|luz"), cl("2026-09-07", -43.9, "expense|luz")];
  const hit = P.recurring({ date: "2026-10-04", amount: -41 }, clasificados);
  assert.deepEqual(hit, { rowKey: "expense|luz", months: 2, day: 6, amount: 42.95, tie: false, confidence: "media" });
  // Un solo mes no basta (puede ser casualidad).
  assert.equal(P.recurring({ date: "2026-10-04", amount: -41 }, clasificados.slice(0, 1)), null);
  // Dos movimientos del mismo mes cuentan como un mes.
  assert.equal(P.recurring({ date: "2026-10-04", amount: -41 }, [cl("2026-09-05", -42, "expense|luz"), cl("2026-09-06", -42, "expense|luz")]), null);
  // Los del mismo mes que el movimiento no cuentan.
  assert.equal(P.recurring({ date: "2026-10-04", amount: -41 }, [cl("2026-10-01", -42, "expense|luz"), cl("2026-09-05", -42, "expense|luz")]), null);
});

test("DEC-14 · fuera del importe, del día o del signo no encaja; da la vuelta al cambio de mes", () => {
  const dos = (date, amount) => [cl("2026-08-05", -100, "expense|seguro"), cl(date, amount, "expense|seguro")];
  const nuevo = { date: "2026-10-05", amount: -100 };
  assert.ok(P.recurring(nuevo, dos("2026-09-08", -110)), "± 10 % y 3 días, en el borde");
  assert.equal(P.recurring(nuevo, dos("2026-09-09", -100)), null, "a 4 días");
  assert.equal(P.recurring(nuevo, dos("2026-09-05", -111)), null, "más del 10 %");
  assert.equal(P.recurring(nuevo, dos("2026-09-05", 100)), null, "otro signo");
  // El 30 y el 1 están a un par de días.
  const finDeMes = [cl("2026-08-30", -60, "expense|alquiler"), cl("2026-09-01", -60, "expense|alquiler")];
  assert.equal(P.recurring({ date: "2026-10-31", amount: -60 }, finDeMes)?.rowKey, "expense|alquiler");
  // Importes pequeños: el margen es de 1 € como mínimo.
  assert.ok(P.recurring({ date: "2026-10-03", amount: -4.5 }, [cl("2026-08-03", -5.4, "expense|app"), cl("2026-09-03", -3.6, "expense|app")]));
  // Un ingreso.
  const cobro = P.recurring({ date: "2026-10-25", amount: 300 }, [cl("2026-08-25", 300, "income|renta"), cl("2026-09-24", 300, "income|renta")]);
  assert.equal(cobro?.rowKey, "income|renta");
  assert.equal(P.recurring({ date: "", amount: -1 }, finDeMes), null);
  assert.equal(P.recurring({ date: "2026-10-05", amount: 0 }, finDeMes), null);
  assert.equal(P.recurring(nuevo, []), null);
});

test("DEC-14 · si encajan dos partidas, empate con confianza baja (la pantalla no propone)", () => {
  const empate = P.recurring({ date: "2026-10-05", amount: -50 }, [
    cl("2026-08-05", -50, "expense|gimnasio"), cl("2026-09-05", -50, "expense|gimnasio"),
    cl("2026-08-06", -49, "expense|seguro"), cl("2026-09-04", -51, "expense|seguro"),
  ]);
  assert.equal(empate.tie, true);
  assert.equal(empate.confidence, "baja");
});

test("DEC-14 · en Clasificar: después de CLA-03 y solo si este no da confianza media; con el día y el importe en el porqué", () => {
  const clas = read("views/clasificar-v2.js");
  assert.match(clas, /const parecido = clasV2Parecido\(group\);\n {4}if \(parecido\?\.confidence === "media"\) return parecido;\n {4}return clasV2Recurrente\(group\) \|\| parecido;/);
  assert.match(clas, /if \(!hit \|\| hit\.tie\) return null;/);
  assert.match(clas, /return \{ row, confidence: "media", reason: `\$\{verbo\} cada mes hacia el día \$\{hit\.day\} por unos \$\{money\(hit\.amount, true\)\}; en \$\{hit\.months\} meses distintos lo llevasteis a esta partida\.` \};/);
  // Solo propone: el motor de reglas no mira el día (las reglas guardadas siguen igual).
  assert.doesNotMatch(read("canonical-pattern-rules.js").slice(0, read("canonical-pattern-rules.js").indexOf("function recurring(")), /\.day\b/);
  assert.ok(read("index.html").includes('src="canonical-pattern-rules.js?v=20261120dec14"'));
  assert.ok(read("index.html").includes('src="views/clasificar-v2.js?v=20261120dec14"'));
});
