const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const read = (name) => fs.readFileSync(path.join(root, name), "utf8");
const app = read("app.js") + "\n" + read("views/deuda.js") + "\n" + read("views/cierre.js");
const html = read("index.html");

// D-2b (bloque de decisiones de diseño, 20 de agosto): la "deuda viva del libro" contra la que se
// cuadra el capital editado en Contratos es la foto tomada en el último cierre firmado (C-1),
// decisión explícita del usuario — no un segundo cálculo en vivo sobre los mismos contratos, que
// nunca podría descuadrar consigo mismo (ver PROJECT_STATE.md).

function extractFunction(name) {
  const start = app.indexOf(`function ${name}(`);
  assert.ok(start >= 0, `No existe la función ${name} en app.js`);
  let parenDepth = 0;
  let bodyStart = -1;
  for (let index = app.indexOf("(", start); index < app.length; index += 1) {
    if (app[index] === "(") parenDepth += 1;
    else if (app[index] === ")") {
      parenDepth -= 1;
      if (parenDepth === 0) {
        bodyStart = app.indexOf("{", index);
        break;
      }
    }
  }
  assert.ok(bodyStart >= 0, `No se encontró el cuerpo de ${name}`);
  let depth = 0;
  for (let index = bodyStart; index < app.length; index += 1) {
    if (app[index] === "{") depth += 1;
    else if (app[index] === "}") {
      depth -= 1;
      if (depth === 0) return app.slice(start, index + 1);
    }
  }
  throw new Error(`La función ${name} no cierra sus llaves`);
}

function sandboxCuadre(extra = {}) {
  const context = {
    round2: (value) => Math.round(Number(value) * 100) / 100,
    homeDebtOutlook: () => ({ pendingPrincipal: 12000 }),
    storageKey: (key) => key,
    storageGet: () => "null",
    ...extra,
  };
  vm.createContext(context);
  vm.runInContext(
    [extractFunction("loadDebtCapitalSnapshotAtClose"), extractFunction("saveDebtCapitalSnapshotAtClose"), extractFunction("debtCapitalCuadre")].join("\n"),
    context
  );
  return context;
}

test("D-2b · sin ningún cierre firmado, el estado es «sin-cierre», nunca «cuadra» a ciegas", () => {
  const context = sandboxCuadre({ storageGet: () => "null" });
  const result = context.debtCapitalCuadre();
  assert.equal(result.status, "sin-cierre");
  assert.equal(result.atClose, null);
  assert.equal(result.diff, null);
  assert.equal(result.current, 12000);
});

test("D-2b · si el capital actual coincide con la foto del último cierre (tolerancia 0,02€), cuadra", () => {
  const context = sandboxCuadre({
    homeDebtOutlook: () => ({ pendingPrincipal: 12000.01 }),
    storageGet: () => JSON.stringify({ total: 12000, monthKey: "2026-08", closedAt: "2026-08-16T10:00:00Z" }),
  });
  const result = context.debtCapitalCuadre();
  assert.equal(result.status, "cuadra");
  assert.equal(result.atClose, 12000);
  assert.equal(result.monthKey, "2026-08");
});

test("D-2b · si el capital editado se aleja de la foto del cierre más de 0,02€, descuadra con la diferencia exacta", () => {
  const context = sandboxCuadre({
    homeDebtOutlook: () => ({ pendingPrincipal: 12500 }),
    storageGet: () => JSON.stringify({ total: 12000, monthKey: "2026-08", closedAt: "2026-08-16T10:00:00Z" }),
  });
  const result = context.debtCapitalCuadre();
  assert.equal(result.status, "descuadra");
  assert.equal(result.diff, 500);
  assert.equal(result.current, 12500);
});

test("D-2b · un descuadre también se detecta cuando el capital editado baja por debajo de la foto", () => {
  const context = sandboxCuadre({
    homeDebtOutlook: () => ({ pendingPrincipal: 11000 }),
    storageGet: () => JSON.stringify({ total: 12000, monthKey: "2026-08" }),
  });
  const result = context.debtCapitalCuadre();
  assert.equal(result.status, "descuadra");
  assert.equal(result.diff, -1000);
});

test("D-2b · saveDebtCapitalSnapshotAtClose persiste bajo su propia clave, en local", () => {
  const fn = extractFunction("saveDebtCapitalSnapshotAtClose");
  assert.match(fn, /storageSet\(storageKey\("debt-capital-snapshot-at-close"\), JSON\.stringify\(snapshot\)\);/);
});

test("D-2b · closeCurrentMonthTransaction congela una foto nueva de deuda viva al firmar", () => {
  const fn = extractFunction("closeCurrentMonthTransaction");
  const snapshotCall = "saveDebtCapitalSnapshotAtClose({ total: homeDebtOutlook().pendingPrincipal, monthKey: month, closedAt });";
  assert.ok(fn.includes(snapshotCall), "falta la llamada exacta que congela la foto de deuda viva");
  // Se guarda antes que el snapshot local general, como el resto de datos derivados de este cierre.
  assert.ok(fn.indexOf(snapshotCall) < fn.indexOf("saveLocalSnapshot();"), "debe congelarse antes de guardar el snapshot local");
});

// --- deudaContratosCuadreHtml: el pie de cuadre, con sus dos salidas cuando descuadra ----------

function sandboxHtml() {
  const context = {
    escapeHtml: (value) => String(value ?? ""),
    money: (value) => `${Number(value).toFixed(2)}€`,
    ledgerMonthLabel: (key) => `mes ${key}`,
  };
  vm.createContext(context);
  vm.runInContext(extractFunction("deudaContratosCuadreHtml"), context);
  return context;
}

test("D-2b · sin cierre, el pie lo dice sin ofrecer ninguna acción", () => {
  const { deudaContratosCuadreHtml } = sandboxHtml();
  const out = deudaContratosCuadreHtml({ status: "sin-cierre", current: 0, atClose: null, diff: null, monthKey: null });
  assert.match(out, /Sin ningún cierre firmado todavía/);
  assert.doesNotMatch(out, /Ajustar aquí/);
});

test("D-2b · si cuadra, el pie confirma la cifra del último cierre", () => {
  const { deudaContratosCuadreHtml } = sandboxHtml();
  const out = deudaContratosCuadreHtml({ status: "cuadra", current: 12000, atClose: 12000, diff: 0, monthKey: "2026-08" });
  assert.match(out, /Cuadra con la deuda viva del cierre de mes 2026-08/);
});

test("D-2b · si descuadra, el pie da la diferencia exacta y ofrece las dos salidas del criterio", () => {
  const { deudaContratosCuadreHtml } = sandboxHtml();
  const out = deudaContratosCuadreHtml({ status: "descuadra", current: 12500, atClose: 12000, diff: 500, monthKey: "2026-08" });
  assert.match(out, /No cuadra con la deuda viva del cierre de mes 2026-08/);
  assert.match(out, /diferencia de 500\.00€/);
  assert.match(out, /Nunca se guarda un descuadre en silencio/);
  assert.match(out, /id="deudaContratosCuadreAdjust">Ajustar aquí</);
  assert.match(out, /data-home-nav="cierre">Ir a Cierre</);
});

// --- renderDeudaContratos pinta el pie en cada render -------------------------------------------

test("D-2b · renderDeudaContratos escribe el pie de cuadre en #deudaContratosCuadre", () => {
  const fn = extractFunction("renderDeudaContratos");
  assert.match(fn, /qs\("deudaContratosCuadre"\)/);
  assert.match(fn, /deudaContratosCuadreHtml\(debtCapitalCuadre\(\)\)/);
});

// --- Cierre: el descuadre se registra como una tarea de cierre más, nunca en silencio ----------

test("D-2b · «Capital de deuda» es una causa más de tareas de cierre", () => {
  assert.match(app, /"debt-capital-mismatch": "Capital de deuda",/);
});

test("D-2b · «Revisar contrato» es la acción de la tarea de descuadre de capital", () => {
  const fn = extractFunction("cierreTaskActionLabel");
  assert.match(fn, /if \(task\.action === "review-debt-capital"\) return "Revisar contrato";/);
});

test("D-2b · renderCierre construye la tarea de descuadre solo cuando de verdad descuadra, derivada en vivo", () => {
  const fn = extractFunction("renderCierre");
  assert.match(fn, /const debtCuadre = debtCapitalCuadre\(\);/);
  assert.match(fn, /debtCuadre\.status === "descuadra"/);
  assert.match(fn, /debtCapitalMismatches/);
  assert.match(fn, /E11bInbox\.reconciliationTasks\(\{ unclassified, differences, balanceGaps, debtCapitalMismatches \}\)/);
});

// --- El pie vive en el DOM, dentro de Deuda · Contratos -----------------------------------------

test("D-2b · index.html tiene el contenedor del pie de cuadre dentro de #deuda-contratos", () => {
  const section = html.slice(html.indexOf('id="deuda-contratos"'), html.indexOf('id="analisis"'));
  assert.match(section, /<div id="deudaContratosCuadre"><\/div>/);
});

test("D-2b · el listener de «Ajustar aquí» enfoca el capital, y el de «Ir a Cierre» navega", () => {
  assert.match(
    app,
    /qs\("deudaContratosCuadre"\)\?\.addEventListener\("click", \(event\) => \{\s*\n\s*if \(event\.target\.closest\("#deudaContratosCuadreAdjust"\)\) \{/
  );
});
