"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const profiles = require("../canonical-statement-profiles.js");
const dedupe = require("../canonical-capture-dedupe.js");
const guion = fs.readFileSync(path.join(root, "docs", "WP54_PRUEBA_USABILIDAD.md"), "utf8");

// WP-54 (GOV-06): el kit de la prueba con 5 personas ajenas. No hay resultados (no se ha hecho ninguna ronda): lo que se protege es que el guion no se pudra —que cada tarea
// siga teniendo su sitio en la app— y que el extracto ficticio de la tarea 3 se lea y empareje como el guion dice.

const loadExtract = () => import("../tools/build-usability-extract.mjs");

test("el extracto ficticio es determinista y relativo a «hoy»", async () => {
  const { buildExtract } = await loadExtract();
  const a = buildExtract({ today: "2026-12-03" });
  assert.equal(a.csv, buildExtract({ today: "2026-12-03" }).csv);
  assert.notEqual(a.csv, buildExtract({ today: "2026-12-04" }).csv);
  assert.equal(a.rows[0].date, "2026-12-03");
  assert.equal(a.rows.at(-1).date, "2026-11-23");
  assert.throws(() => buildExtract({ today: "2026-02-31" }), /no es una fecha/);
  assert.throws(() => buildExtract({}), /no es una fecha/);
});

test("el extracto ficticio se lee entero con el importador: 12 movimientos, sin avisos de error, saldo que cuadra", async () => {
  const { buildExtract, BANK_ROWS } = await loadExtract();
  const { csv } = buildExtract({ today: "2026-12-03" });
  const result = profiles.analyze(csv);
  assert.equal(result.ok, true);
  assert.equal(result.delimiter, ";");
  assert.equal(result.transactions.length, BANK_ROWS);
  assert.equal(BANK_ROWS, 12);
  assert.deepEqual(result.errors, []);
  assert.equal(result.balanceCheck.status, "cuadra", `saldo: ${JSON.stringify(result.balanceCheck)}`);
  assert.equal(result.transactions[0].date, "2026-12-03");
  assert.equal(result.transactions[0].amount, -23.4);
  assert.ok(result.transactions.some((row) => row.amount === 1850), "los miles con punto se leen");
});

test("la tarea 3 propone la pareja que el guion promete: Mercadona 23,40 sí, la farmacia del mismo importe no", async () => {
  const { buildExtract, TASK_EXPENSE } = await loadExtract();
  const { csv } = buildExtract({ today: "2026-12-03" });
  const rows = profiles.analyze(csv).transactions.map((row, index) => ({ id: `fila-${index}`, date: row.date, amount: row.amount, concept: `${row.movement} ${row.details || ""}` }));
  const capture = [{ id: "mov|t2", date: "2026-12-03", amount: -TASK_EXPENSE.amount, concept: TASK_EXPENSE.concept }];
  const result = dedupe.pairCaptures(capture, rows);
  assert.equal(result.pairs.length, 1);
  assert.match(rows.find((row) => row.id === result.pairs[0].rowId).concept, /MERCADONA/);
  assert.equal(result.pairs[0].confidence, "alta");
  // Si la persona teclea otro concepto, no hay nombre comparable: sigue habiendo pareja, pero «media» (decide la persona), y la fila del banco no cambia.
  const other = dedupe.pairCaptures([{ ...capture[0], concept: "Súper" }], rows);
  assert.equal(other.pairs.length, 1);
  assert.equal(other.pairs[0].confidence, "media");
  // Con un día de diferencia (el banco lo apunta al día siguiente), sigue emparejando.
  const late = dedupe.pairCaptures([{ ...capture[0], date: "2026-12-02" }], rows);
  assert.equal(late.pairs[0].days, 1);
});

test("el extracto ficticio no lleva nada que parezca real: sin IBAN, sin correos, sin teléfonos, todo «FICTICIO/A»", async () => {
  const { buildExtract } = await loadExtract();
  const { csv, rows } = buildExtract({ today: "2026-12-03" });
  assert.doesNotMatch(csv, /\b[A-Z]{2}\d{2}[ ]?\d{4}/); // IBAN
  assert.doesNotMatch(csv, /@/);
  assert.doesNotMatch(csv, /\b\d{9}\b/);
  assert.match(csv, /datos ficticios/);
  rows.filter((row) => !/MERCADONA/.test(row.concept)).forEach((row) => assert.match(row.concept, /FICTICI|RECIBIDA/, row.concept));
});

test("el guion tiene cinco tareas, cada una con su enunciado, su punto de partida y su «hecho cuando»", () => {
  const tasks = [...guion.matchAll(/^### (T\d) · (.+)$/gm)].map((match) => match[1]);
  assert.deepEqual(tasks, ["T1", "T2", "T3", "T4", "T5"]);
  const sections = guion.split(/^### T\d · /m).slice(1);
  assert.equal(sections.length, 5);
  sections.forEach((section, index) => {
    assert.match(section, /\*\*Enunciado:\*\* «/, `T${index + 1} sin enunciado`);
    assert.match(section, /\*\*Empieza en:\*\* `#home`/, `T${index + 1} sin punto de partida`);
    assert.match(section, /\*\*Hecho cuando:\*\*/, `T${index + 1} sin criterio de fin`);
    assert.match(section, /\*\*Respuesta esperada/, `T${index + 1} sin respuesta esperada`);
    assert.match(section, /\*\*Qué se observa:\*\*/, `T${index + 1} sin lo que se observa`);
  });
});

test("el guion no nombra pantallas ni botones en los enunciados que lee la persona (no se guía)", () => {
  const enunciados = [...guion.matchAll(/\*\*Enunciado:\*\* «([^»]+)»/g)].map((match) => match[1]);
  assert.equal(enunciados.length, 5);
  enunciados.forEach((text) => assert.doesNotMatch(text, /Registrar|Importar|Plan|Previsión|Hoy|Cierre|Cartera|«/, text));
});

test("el reparto de tiempo suma 30 minutos y las reglas de privacidad y ayuda están escritas", () => {
  assert.match(guion, /\| 0 – 4 \|/);
  assert.match(guion, /\| 4 – 24 \|/);
  assert.match(guion, /\| 24 – 30 \|/);
  assert.match(guion, /Solo la demostración sintética pública/);
  assert.match(guion, /Nunca los datos reales del hogar/);
  assert.match(guion, /Ventana privada/i);
  assert.match(guion, /Consentimiento explícito/);
  assert.match(guion, /no se graba audio ni vídeo ni pantalla \*\*salvo que lo acepte expresamente\*\*/);
  assert.match(guion, /Notas sin datos personales/);
  assert.match(guion, /Quien dirige no ayuda ni defiende el diseño/);
});

test("el paquete no cuenta hasta tener una ronda completa: el documento no inventa resultados", () => {
  assert.match(guion, /La prueba no se ha hecho ni una vez/);
  assert.match(guion, /WP-54 no cuenta en el avance del plan/);
  assert.doesNotMatch(guion, /\bP[1-5]\b[^.\n]*(dijo|tardó|abandonó) /); // ninguna persona ha dicho nada todavía
});

test("las tareas apuntan a sitios que existen en la app y a funciones ya construidas", () => {
  const index = fs.readFileSync(path.join(root, "index.html"), "utf8");
  ["homeKpis", "homeQuickExpenseOpen", "homeQuickExpenseDialog"].forEach((id) => assert.match(index, new RegExp(`id="${id}"`), id));
  ["#registrar", "#prevision", "#deuda-ruta"].forEach((hash) => assert.match(index, new RegExp(`href="${hash}"`), hash));
  const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
  assert.match(read("app.js"), /registrarImportFileInput/); // T3: el campo del fichero se pinta desde app.js
  assert.match(read("app.js"), /Capacidad libre real/); // T1
  assert.match(read("app.js"), /El punto delicado/); // T5
  assert.match(read("camino-deuda-ui.js"), /Camino a deuda cero/); // T4
});

test("el estado del plan dice que WP-54 es un protocolo y enlaza el kit", () => {
  const estado = fs.readFileSync(path.join(root, "docs", "ESTADO_TAREAS_Y_FASES.md"), "utf8");
  const row = estado.split("\n").find((line) => line.startsWith("| **WP-54**"));
  assert.ok(row, "fila de WP-54");
  assert.match(row, /Continuo/);
  assert.match(row, /WP54_PRUEBA_USABILIDAD\.md/);
  assert.match(row, /ninguna ronda/i);
  const backlog = fs.readFileSync(path.join(root, "BACKLOG_DEFINITIVO.md"), "utf8");
  assert.match(backlog, /^## 13\. Hallazgos de las pruebas con personas ajenas/m);
});
