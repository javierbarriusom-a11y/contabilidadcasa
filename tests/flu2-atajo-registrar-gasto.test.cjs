const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const app = fs.readFileSync(path.join(root, "app.js"), "utf8");

// FLU-2 (BACKLOG_CONTABILIDADCASA_3_0.md §2.4): atajo de un clic desde Home para registrar un
// gasto nuevo — crea a la vez la partida (previsto) y su real, en el mes que Registrar › Reales
// del mes ya resolvería por defecto, reutilizando el mismo modelo de datos que handlePartidasAddRow
// (customPlanningRows) y handleRegistrarActualsChange (expenseActuals) sin motor nuevo.

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
  const context = {
    round2: (value) => Math.round((Number(value || 0) + Number.EPSILON) * 100) / 100,
    parseAmount: (value) => {
      if (value === "" || value === null || value === undefined) return null;
      const parsed = Number(String(value).replace(",", "."));
      return Number.isFinite(parsed) ? parsed : null;
    },
    escapeHtml: (value) => String(value ?? ""),
    actualKeyForRow: (row, month) => `${row.id}|${month.key}`,
    ...extra,
  };
  vm.createContext(context);
  names.forEach((name) => vm.runInContext(extractFunction(name), context));
  return context;
}

function homeSectionHtml() {
  const openTag = /<section[^>]*id="home"[^>]*>/.exec(html);
  assert.ok(openTag, "No existe la sección #home");
  const start = openTag.index + openTag[0].length;
  const end = html.indexOf('<section class="view-section widget-view"', start);
  return html.slice(start, end);
}

test("FLU-2 · el botón vive en la cabecera de Home, fuera de .home-primary-section", () => {
  const home = homeSectionHtml();
  const primaryStart = home.indexOf('<div class="home-primary-section">');
  const buttonIndex = home.indexOf('id="homeQuickExpenseOpen"');
  assert.ok(buttonIndex >= 0, "Falta el botón homeQuickExpenseOpen en #home");
  assert.ok(primaryStart >= 0, "No existe .home-primary-section");
  assert.ok(buttonIndex < primaryStart, "El botón debe vivir antes de .home-primary-section, no dentro (regla de 4 bloques, OPT-8)");
});

test("FLU-2 · el diálogo trae los tres campos (concepto, bloque, importe) y confirmar/cancelar", () => {
  const dialogStart = html.indexOf('id="homeQuickExpenseDialog"');
  assert.ok(dialogStart >= 0, "Falta el diálogo homeQuickExpenseDialog");
  const dialog = html.slice(dialogStart, html.indexOf("</dialog>", dialogStart));
  assert.match(dialog, /id="homeQuickExpenseLabel"[^>]*required/);
  assert.match(dialog, /id="homeQuickExpenseSection"[^>]*required/);
  assert.match(dialog, /id="homeQuickExpenseAmount"[^>]*required/);
  assert.match(dialog, /value="cancel"[^>]*formnovalidate/);
  assert.match(dialog, /value="confirm"[^>]*id="homeQuickExpenseSubmit"/);
});

test("FLU-2 · el botón está enganchado a openHomeQuickExpenseDialog y el listener se registra", () => {
  assert.match(app, /qs\("homeQuickExpenseOpen"\)\?\.addEventListener\("click", openHomeQuickExpenseDialog\)/);
});

test("FLU-2 · homeQuickExpenseSections() solo devuelve bloques de gasto", () => {
  const { homeQuickExpenseSections } = sandboxWith(["homeQuickExpenseSections"], {
    baseData: {
      monthlyPlanning: {
        sections: [
          { name: "Vivienda", kind: "expense" },
          { name: "Nómina", kind: "income" },
          { name: "Ocio", kind: "expense" },
        ],
      },
    },
  });
  const sections = homeQuickExpenseSections();
  assert.deepEqual(sections.map((section) => section.name), ["Vivienda", "Ocio"]);
});

test("FLU-2 · homeQuickExpenseTargetMonth() usa el mismo mes por defecto que Registrar › Reales del mes", () => {
  const { homeQuickExpenseTargetMonth } = sandboxWith(["homeQuickExpenseTargetMonth"], {
    registrarActualsDefaultMonthKey: () => "2026-09",
    baseData: { monthlyPlanning: { months: [{ key: "2026-08", label: "Agosto" }, { key: "2026-09", label: "Septiembre" }] } },
  });
  const month = homeQuickExpenseTargetMonth();
  assert.equal(month.key, "2026-09");
});

test("FLU-2 · sin mes coincidente, homeQuickExpenseTargetMonth() no fabrica uno", () => {
  const { homeQuickExpenseTargetMonth } = sandboxWith(["homeQuickExpenseTargetMonth"], {
    registrarActualsDefaultMonthKey: () => "",
    baseData: { monthlyPlanning: { months: [{ key: "2026-08", label: "Agosto" }] } },
  });
  assert.equal(homeQuickExpenseTargetMonth(), null);
});

test("FLU-2 · updateHomeQuickExpenseAvailability() deshabilita el botón sin mes abierto o sin bloques de gasto", () => {
  const button = { disabled: false, title: "" };
  const { updateHomeQuickExpenseAvailability } = sandboxWith(["updateHomeQuickExpenseAvailability"], {
    qs: (id) => (id === "homeQuickExpenseOpen" ? button : null),
    homeQuickExpenseTargetMonth: () => null,
    homeQuickExpenseSections: () => [],
    isClosedMonthKey: () => false,
  });
  updateHomeQuickExpenseAvailability();
  assert.equal(button.disabled, true);
  assert.ok(button.title.length > 0, "Debe explicar por qué está deshabilitado");
});

test("FLU-2 · updateHomeQuickExpenseAvailability() deshabilita el botón si el mes resuelto está cerrado", () => {
  const button = { disabled: false, title: "" };
  const { updateHomeQuickExpenseAvailability } = sandboxWith(["updateHomeQuickExpenseAvailability"], {
    qs: (id) => (id === "homeQuickExpenseOpen" ? button : null),
    homeQuickExpenseTargetMonth: () => ({ key: "2026-07" }),
    homeQuickExpenseSections: () => [{ name: "Ocio", kind: "expense" }],
    isClosedMonthKey: () => true,
  });
  updateHomeQuickExpenseAvailability();
  assert.equal(button.disabled, true);
});

test("FLU-2 · updateHomeQuickExpenseAvailability() habilita el botón con mes abierto y bloques de gasto", () => {
  const button = { disabled: true, title: "algo" };
  const { updateHomeQuickExpenseAvailability } = sandboxWith(["updateHomeQuickExpenseAvailability"], {
    qs: (id) => (id === "homeQuickExpenseOpen" ? button : null),
    homeQuickExpenseTargetMonth: () => ({ key: "2026-09" }),
    homeQuickExpenseSections: () => [{ name: "Ocio", kind: "expense" }],
    isClosedMonthKey: () => false,
  });
  updateHomeQuickExpenseAvailability();
  assert.equal(button.disabled, false);
  assert.equal(button.title, "");
});

test("FLU-2 · submitHomeQuickExpense() crea la partida y su real a la vez, con el mismo esquema de clave que Reales del mes", () => {
  const customPlanningRows = [];
  const expenseActuals = {};
  const calls = [];
  const { submitHomeQuickExpense } = sandboxWith(["submitHomeQuickExpense"], {
    customPlanningRows,
    expenseActuals,
    saveCustomPlanningRows: () => calls.push("saved-rows"),
    saveExpenseActuals: () => calls.push("saved-actuals"),
    render: () => calls.push("rendered"),
  });
  submitHomeQuickExpense({ key: "2026-09", label: "Septiembre" }, "Ocio", "Cena fuera", "38,50");
  assert.equal(customPlanningRows.length, 1);
  const row = customPlanningRows[0];
  assert.equal(row.custom, true);
  assert.equal(row.kind, "expense");
  assert.equal(row.sectionName, "Ocio");
  assert.equal(row.label, "Cena fuera");
  assert.equal(row.monthKey, "2026-09");
  assert.equal(row.plannedValue, 38.5);
  const key = `${row.id}|2026-09`;
  assert.equal(expenseActuals[key], 38.5);
  assert.deepEqual(calls, ["saved-rows", "saved-actuals", "rendered"]);
});

test("FLU-2 · submitHomeQuickExpense() no escribe nada sin concepto, sin bloque, sin mes o con importe no positivo", () => {
  const scenarios = [
    [{ key: "2026-09" }, "Ocio", "", "10"],
    [{ key: "2026-09" }, "", "Cena", "10"],
    [null, "Ocio", "Cena", "10"],
    [{ key: "2026-09" }, "Ocio", "Cena", "0"],
    [{ key: "2026-09" }, "Ocio", "Cena", "-5"],
    [{ key: "2026-09" }, "Ocio", "Cena", ""],
  ];
  scenarios.forEach(([month, sectionName, label, rawAmount]) => {
    const customPlanningRows = [];
    const expenseActuals = {};
    const calls = [];
    const { submitHomeQuickExpense } = sandboxWith(["submitHomeQuickExpense"], {
      customPlanningRows,
      expenseActuals,
      saveCustomPlanningRows: () => calls.push("saved-rows"),
      saveExpenseActuals: () => calls.push("saved-actuals"),
      render: () => calls.push("rendered"),
    });
    submitHomeQuickExpense(month, sectionName, label, rawAmount);
    assert.equal(customPlanningRows.length, 0, `no debe crear fila con ${JSON.stringify({ month, sectionName, label, rawAmount })}`);
    assert.equal(calls.length, 0, "no debe guardar ni renderizar sin datos válidos");
  });
});
