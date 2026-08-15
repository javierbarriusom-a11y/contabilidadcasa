const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const app = fs.readFileSync(path.join(root, "app.js"), "utf8");

// R-12 · La regla previsto/real/usado depende de que «vacío» y «0» nunca se confundan en el
// motor compartido (actualAwareInfo, usado por registrarMesCollect y por tanto por Reales del
// mes de Registrar y por la heredada #registrar-mes): vacío es «sin real» y el usado toma el
// previsto; 0 explícito es «ocurrió por cero» y el usado es 0. Esta distinción ya se guardaba
// bien en el almacén (ver r5-registrar-reales.test.cjs), pero no había una prueba directa de
// que el campo derivado «usado» la respete.

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

function sandboxWith(names, extra = {}) {
  const context = { ...extra };
  vm.createContext(context);
  names.forEach((name) => vm.runInContext(extractFunction(name), context));
  return context;
}

test("R-12 · sin real guardado (clave ausente): «sin real», usado = previsto", () => {
  const { actualAwareInfo } = sandboxWith(["actualAwareInfo"], {
    actualsForKind: () => ({}),
    actualKeyForRow: () => "gasto-luz|2026-08",
    seriesOverrideForRow: () => undefined,
    plannedValueForRow: () => 80,
  });
  const info = actualAwareInfo({ kind: "expense" }, { key: "2026-08" });
  assert.equal(info.hasActual, false);
  assert.equal(info.actual, null);
  assert.equal(info.value, 80, "sin real, el usado debe tomar el previsto");
  assert.equal(info.source, "Pendiente");
});

test("R-12 · real explícito de 0 («ocurrió por cero»): hasActual true, usado = 0, no el previsto", () => {
  const { actualAwareInfo } = sandboxWith(["actualAwareInfo"], {
    actualsForKind: () => ({ "gasto-luz|2026-08": 0 }),
    actualKeyForRow: () => "gasto-luz|2026-08",
    seriesOverrideForRow: () => undefined,
    plannedValueForRow: () => 80,
  });
  const info = actualAwareInfo({ kind: "expense" }, { key: "2026-08" });
  assert.equal(info.hasActual, true, "un 0 explícito cuenta como real registrado");
  assert.equal(info.actual, 0);
  assert.equal(info.value, 0, "con un 0 explícito el usado es 0, no el previsto");
  assert.equal(info.source, "Realizado");
});

test("R-12 · un real normal (no cero) se usa tal cual, no el previsto", () => {
  const { actualAwareInfo } = sandboxWith(["actualAwareInfo"], {
    actualsForKind: () => ({ "gasto-luz|2026-08": 65.5 }),
    actualKeyForRow: () => "gasto-luz|2026-08",
    seriesOverrideForRow: () => undefined,
    plannedValueForRow: () => 80,
  });
  const info = actualAwareInfo({ kind: "expense" }, { key: "2026-08" });
  assert.equal(info.hasActual, true);
  assert.equal(info.value, 65.5);
});

test("R-12 · registrarMesCollect propaga la misma distinción en el campo `used` de cada fila de Reales del mes", () => {
  const { registrarMesCollect } = sandboxWith(
    ["registrarMesCollect", "actualAwareInfo"],
    {
      planningSectionsForMonth: (kind) => [
        {
          name: "Gastos fijos",
          rows: [
            { kind, id: "sin-real" },
            { kind, id: "cero-explicito" },
          ],
        },
      ],
      actualsForKind: () => ({ "cero-explicito|2026-08": 0 }),
      actualKeyForRow: (row) => `${row.id}|2026-08`,
      seriesOverrideForRow: () => undefined,
      plannedValueForRow: () => 40,
      displayLabelForRow: (row) => row.id,
      deleteKeyForRow: (row) => `${row.id}|2026-08`,
    },
  );
  const entries = registrarMesCollect({ key: "2026-08" });
  const sinReal = entries.expense.find((entry) => entry.key === "sin-real|2026-08");
  const ceroExplicito = entries.expense.find((entry) => entry.key === "cero-explicito|2026-08");
  assert.equal(sinReal.hasActual, false);
  assert.equal(sinReal.used, 40, "fila sin real: usado toma el previsto");
  assert.equal(sinReal.variance, null, "fila sin real: sin desviación fabricada");
  assert.equal(ceroExplicito.hasActual, true);
  assert.equal(ceroExplicito.used, 0, "fila con 0 explícito: usado es 0");
  assert.equal(ceroExplicito.variance, -40, "0 explícito frente a 40 previsto: desviación real, no oculta");
});
