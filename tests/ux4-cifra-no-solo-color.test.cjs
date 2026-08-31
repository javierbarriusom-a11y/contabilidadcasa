const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");

const appSource = fs.readFileSync(require.resolve("../app.js"), "utf8");

// UX4 · ninguna cifra financiera solo por color. Auditoría real de todos los usos de `.status-pill`
// y `.e19-badge` en app.js: la mayoría ya empareja el tono con una palabra ("Viable"/"Vigilar",
// "Activo"/"Desactivado", "Fuera de umbral", nombre de la confianza...) o con un signo ya visible en
// la cifra (money() antepone "-" a los negativos vía Intl.NumberFormat, así que el color nunca es la
// única pista del signo). Dos píldoras mostraban solo un número/porcentaje con el tono como única
// diferencia entre sus estados — las únicas dos violaciones reales encontradas — y se corrigen aquí
// añadiendo la palabra que le falta. El resto de la superficie (todas las combinaciones .negative/
// .positive/.warn/.danger de cifras firmadas, y el resto de píldoras que ya llevan texto) queda fuera
// de este núcleo por ya ser conforme, no por no haberse revisado.

test("UX4: la píldora de completitud de un contrato de deuda añade la palabra, no solo el color", () => {
  const start = appSource.indexOf("function renderE6DebtQuality");
  const block = appSource.slice(start, start + 1200);
  assert.match(block, /completenessWord/);
  assert.match(block, /"completo" : quality\.completeness >= 75 \? "parcial" : "incompleto"/);
  assert.match(block, /\$\{quality\.completeness\}% \$\{completenessWord\}/);
});

test("UX4: la píldora de percentil de un escenario calibrado añade la palabra, no solo el color", () => {
  const start = appSource.indexOf("function renderE6KpiQuality");
  const block = appSource.slice(start, start + 1500);
  assert.match(block, /P\$\{Math\.round\(scenario\.percentile \* 100\)\} · \$\{scenario\.calibrated \? "calibrado" : "sin calibrar"\}/);
});
