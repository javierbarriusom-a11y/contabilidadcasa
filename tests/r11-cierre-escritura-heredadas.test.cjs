const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const app = fs.readFileSync(path.join(root, "app.js"), "utf8");

// R-11 · Cierre de escritura de las heredadas, consultado y acotado con el usuario el 15 de
// agosto de 2026: las cuatro heredadas que R-10 ya redirigía (#update-hub, #update-data,
// #datos-importar, #data-entry) cierran también el hueco real que R-10 dejaba — setActiveView
// solo normalizaba el hash cuando se llegaba por `viewFromHash()`, pero los clics del menú
// lateral y los botones `data-home-nav` llamaban con el id heredado directamente, sin pasar por
// ahí, y aterrizaban en la pantalla vieja igual de escribible que siempre.
//
// `#registrar-mes` sigue accesible desde «Herramientas avanzadas» (la promesa de la sesión de
// R-5 no se rompe) pero deja de ser una puerta de escritura: sus reales, altas, bajas, copia y
// confirmación de «¿es anual?» quedan deshabilitados y remiten a Registrar › Reales del mes.

function extractFunction(name) {
  let start = app.indexOf(`function ${name}(`);
  assert.ok(start >= 0, `No existe la función ${name} en app.js`);
  if (start >= 6 && app.slice(start - 6, start) === "async ") start -= 6;
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

// --- Las cuatro heredadas ya redirigidas por R-10: setActiveView cierra el hueco -----------------

test("R-11 · el mapa de redirección se consulta con el id explícito antes de nada más, no solo con el hash", () => {
  const source = extractFunction("setActiveView");
  const normalizeIndex = source.indexOf("REGISTRAR_LEGACY_HASH_TABS[viewId]");
  const legacyGuardIndex = source.indexOf('if (viewId === "registrar")');
  assert.ok(normalizeIndex >= 0, "setActiveView debe consultar REGISTRAR_LEGACY_HASH_TABS con el viewId recibido");
  assert.ok(normalizeIndex < legacyGuardIndex, "la normalización debe ocurrir antes de decidir la pestaña");
});

test("R-11 · un clic de menú (data-home-nav=\"update-data\") también redirige, no solo escribir el hash a mano", () => {
  // setupViewNavigation y los botones data-home-nav llaman a setActiveView con el viewId crudo
  // del enlace/botón, sin pasar por viewFromHash() — antes de R-11 eso abría la heredada.
  assert.match(app, /setActiveView\(navButton\.dataset\.homeNav\)/);
  const source = extractFunction("setActiveView");
  assert.match(source, /const explicitLegacyTab = REGISTRAR_LEGACY_HASH_TABS\[viewId\];\s*\n\s*if \(explicitLegacyTab\) viewId = "registrar";/);
});

test("R-11 · ninguna de las cuatro heredadas perdió su código: siguen en index.html, solo dejan de ser destino", () => {
  ["update-hub", "datos-importar", "update-data", "data-entry"].forEach((id) => {
    assert.match(html, new RegExp(`id="${id}"`), `#${id} debe seguir existiendo`);
  });
});

// --- `#registrar-mes`: accesible, de solo lectura -------------------------------------------------

test("R-11 · REGISTRAR_MES_LEGACY_READONLY está declarada y en true", () => {
  assert.match(app, /const REGISTRAR_MES_LEGACY_READONLY = true;/);
});

test("R-11 · #registrar-mes sigue existiendo y accesible (la promesa de R-5 no se rompe)", () => {
  assert.match(html, /id="registrar-mes"/);
});

function sandboxRowHtml(entryOverrides = {}, monthClosed = false) {
  const context = {
    REGISTRAR_MES_LEGACY_READONLY: true,
    escapeHtml: (v) => String(v),
    money: (v) => `€${v}`,
    varianceClassForKind: () => "",
    registrarMesSignedMoney: (v) => String(v),
    registrarMesIsBad: () => false,
    registrarMesAnnualMatch: () => {
      throw new Error("no debería evaluarse: la fila está bloqueada por solo lectura");
    },
    registrarMesAnnualBannerHtml: () => {
      throw new Error("no debería pintarse: el banner de «¿es anual?» escribe un ack");
    },
    state: { registrarMesAnnualAck: {} },
    baseData: { transactions: [] },
  };
  vm.createContext(context);
  vm.runInContext(extractFunction("registrarMesRowHtml"), context);
  const entry = {
    key: "gasto|2026-08",
    kind: "expense",
    sectionName: "Gastos fijos",
    label: "Seguro coche",
    planned: 100,
    hasActual: true,
    actual: 100,
    used: 100,
    variance: 0,
    deleteKey: "custom-1",
    row: { custom: true },
    ...entryOverrides,
  };
  return context.registrarMesRowHtml(entry, monthClosed, "2026-08");
}

test("R-11 · la fila de #registrar-mes deshabilita el real aunque el mes esté abierto", () => {
  const rowHtml = sandboxRowHtml();
  assert.match(rowHtml, /data-registrar-mes-actual="gasto\|2026-08"[^>]*\sdisabled/);
});

test("R-11 · la fila de #registrar-mes no ofrece quitar una partida personalizada", () => {
  const rowHtml = sandboxRowHtml();
  assert.doesNotMatch(rowHtml, /registrar-mes-row-remove/);
});

test("R-11 · el aviso «¿es anual?» ni se evalúa ni se pinta en solo lectura, aunque haya coincidencia", () => {
  assert.doesNotThrow(() => sandboxRowHtml());
});

test("R-11 · el pie de cada tarjeta remite a Registrar en vez de ofrecer altas y copia", () => {
  const source = extractFunction("registrarMesCardHtml");
  assert.match(source, /const footer = REGISTRAR_MES_LEGACY_READONLY/);
  assert.match(source, /data-home-nav="registrar">Registrar › Reales del mes<\/button>/);
});

test("R-11 · el subtítulo deja de invitar a escribir y remite a Registrar", () => {
  const source = extractFunction("renderRegistrarMes");
  assert.match(source, /REGISTRAR_MES_LEGACY_READONLY[\s\S]{0,200}Registrar › Reales del mes/);
});

function sandboxHandler(name, extra = {}) {
  const context = { REGISTRAR_MES_LEGACY_READONLY: true, ...extra };
  vm.createContext(context);
  vm.runInContext(extractFunction(name), context);
  return context;
}

test("R-11 · handleRegistrarMesActualChange no escribe nada en solo lectura", () => {
  const context = sandboxHandler("handleRegistrarMesActualChange", {
    registrarMesSelectedMonth: () => {
      throw new Error("no debería llamarse");
    },
  });
  assert.doesNotThrow(() => context.handleRegistrarMesActualChange({ dataset: {} }));
});

test("R-11 · handleRegistrarMesDelete no borra nada en solo lectura", () => {
  const context = sandboxHandler("handleRegistrarMesDelete", {
    registrarMesSelectedMonth: () => {
      throw new Error("no debería llamarse");
    },
  });
  assert.doesNotThrow(() => context.handleRegistrarMesDelete("custom-1"));
});

test("R-11 · handleRegistrarMesAddSubmit no da de alta nada en solo lectura", () => {
  const context = sandboxHandler("handleRegistrarMesAddSubmit", {
    registrarMesSelectedMonth: () => {
      throw new Error("no debería llamarse");
    },
  });
  assert.doesNotThrow(() => context.handleRegistrarMesAddSubmit({ dataset: {} }));
});

test("R-11 · handleRegistrarMesAddToggle no abre el formulario de alta en solo lectura", () => {
  const context = sandboxHandler("handleRegistrarMesAddToggle", {
    renderRegistrarMes: () => {
      throw new Error("no debería llamarse");
    },
  });
  assert.doesNotThrow(() => context.handleRegistrarMesAddToggle("expense", true));
});

test("R-11 · handleRegistrarMesCopy no ofrece copiar reales en solo lectura", () => {
  const context = sandboxHandler("handleRegistrarMesCopy", {
    registrarMesSelectedMonth: () => {
      throw new Error("no debería llamarse");
    },
  });
  assert.doesNotThrow(() => context.handleRegistrarMesCopy("expense"));
});

test("R-11 · handleRegistrarMesCopyConfirm no copia nada en solo lectura", () => {
  const context = sandboxHandler("handleRegistrarMesCopyConfirm", {
    registrarMesSelectedMonth: () => {
      throw new Error("no debería llamarse");
    },
  });
  assert.doesNotThrow(() => context.handleRegistrarMesCopyConfirm("expense"));
});
