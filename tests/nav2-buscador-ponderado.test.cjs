const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const app = fs.readFileSync(path.join(root, "app.js"), "utf8");
const E17Experience = require(path.join(root, "e17-experience.js"));

// NAV-2 (BACKLOG_CONTABILIDADCASA_3_0.md §2.3): el buscador universal (T2/E17Experience) ya
// existía, pero solo ordenaba por coincidencia de texto — el orden de salida era el de
// declaración de TASKS. Esto pesa esos mismos resultados por uso real (ARQ-0/viewVisitSummary,
// tests/arq0-uso-app-informe.test.cjs), sin motor nuevo: E17Experience.findTasks acepta un
// tercer parámetro opcional getUsageWeight (mismo patrón de inyección que ya usa `normalize`) y
// app.js lo alimenta con e17SearchUsageWeight, que resuelve las cuatro claves heredadas de
// REGISTRAR_LEGACY_HASH_TABS al contador de "registrar", la pantalla donde de verdad aterrizan.

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

function extractConst(name) {
  const marker = `const ${name} = `;
  const start = app.indexOf(marker);
  assert.ok(start >= 0, `No existe la constante ${name} en app.js`);
  const valueStart = start + marker.length;
  const openChar = app[valueStart];
  assert.ok(openChar === "[" || openChar === "{", `${name} no empieza con [ ni {`);
  const closeChar = openChar === "[" ? "]" : "}";
  let depth = 0;
  for (let index = valueStart; index < app.length; index += 1) {
    if (app[index] === openChar) depth += 1;
    else if (app[index] === closeChar) {
      depth -= 1;
      if (depth === 0) return app.slice(start, index + 1);
    }
  }
  throw new Error(`${name} no cierra`);
}

function sandboxWith(names, consts, extra = {}) {
  const context = { ...extra };
  vm.createContext(context);
  consts.forEach((name) => vm.runInContext(`${extractConst(name)}\nthis.${name} = ${name};`, context));
  names.forEach((name) => vm.runInContext(extractFunction(name), context));
  return context;
}

const normalize = (value) => String(value || "").toLowerCase();

// --- E17Experience.findTasks: peso opcional, compatible con el comportamiento previo -------------

test("NAV-2 · sin getUsageWeight, findTasks conserva el orden previo (declaración de TASKS)", () => {
  const previousOrder = E17Experience.TASKS.filter((item) => normalize(`${item.label} ${item.keywords}`).includes("deuda")).map(
    (item) => item.target,
  );
  const matches = E17Experience.findTasks("deuda", normalize);
  assert.deepEqual(matches.map((item) => item.target), previousOrder);
});

test("NAV-2 · con getUsageWeight, la pantalla más usada sube primero aunque vaya después en TASKS", () => {
  const matches = E17Experience.findTasks("deuda", normalize, (target) => (target === "deuda-simulador" ? 50 : 0));
  assert.equal(matches[0].target, "deuda-simulador");
});

test("NAV-2 · a igualdad de peso (incluido 0-0), se conserva el orden original de TASKS", () => {
  const previousOrder = E17Experience.findTasks("deuda", normalize).map((item) => item.target);
  const matches = E17Experience.findTasks("deuda", normalize, () => 3);
  assert.deepEqual(matches.map((item) => item.target), previousOrder);
});

test("NAV-2 · el peso nunca cambia qué entra por coincidencia de texto, solo el orden", () => {
  const withoutWeight = new Set(E17Experience.findTasks("inversion", normalize).map((item) => item.target));
  const withWeight = new Set(E17Experience.findTasks("inversion", normalize, () => Math.random() * 100).map((item) => item.target));
  assert.deepEqual(withWeight, withoutWeight);
});

test("NAV-2 · con query vacía, findTasks ordena el catálogo completo por peso", () => {
  const matches = E17Experience.findTasks("", normalize, (target) => (target === "home" ? 1 : 0));
  assert.equal(matches.length, E17Experience.TASKS.length);
  assert.equal(matches[0].target, "home");
});

test("NAV-2 · un peso no numérico o negativo se trata como 0, sin lanzar", () => {
  assert.doesNotThrow(() => E17Experience.findTasks("deuda", normalize, () => "no-numero"));
  assert.doesNotThrow(() => E17Experience.findTasks("deuda", normalize, () => -5));
});

// --- Cableado en app.js: renderE17Launcher pasa e17SearchUsageWeight ------------------------------

test("NAV-2 · renderE17Launcher pasa e17SearchUsageWeight como tercer argumento a findTasks", () => {
  assert.match(extractFunction("renderE17Launcher"), /E17Experience\?\.findTasks\(query, normalizedText, e17SearchUsageWeight\)/);
});

// --- e17SearchUsageWeight: resuelve las heredadas de REGISTRAR_LEGACY_HASH_TABS a "registrar" ----

test("NAV-2 · e17SearchUsageWeight lee el contador real de una pantalla normal", () => {
  const context = sandboxWith(["e17SearchUsageWeight"], ["REGISTRAR_LEGACY_HASH_TABS"], {
    viewVisitSummary: (id) => (id === "home" ? { count: 7, last: "2026-09-21" } : { count: 0, last: "" }),
  });
  assert.equal(context.e17SearchUsageWeight("home"), 7);
});

test("NAV-2 · para las cuatro claves heredadas de REGISTRAR_LEGACY_HASH_TABS, el peso es el de «registrar»", () => {
  const context = sandboxWith(["e17SearchUsageWeight"], ["REGISTRAR_LEGACY_HASH_TABS"], {
    viewVisitSummary: (id) => (id === "registrar" ? { count: 12, last: "2026-09-22" } : { count: 999, last: "no debería leerse" }),
  });
  ["update-hub", "update-data", "datos-importar", "data-entry"].forEach((target) => {
    assert.equal(context.e17SearchUsageWeight(target), 12, `${target} debería pesar como "registrar"`);
  });
});

test("NAV-2 · una pantalla nunca abierta pesa 0, sin lanzar", () => {
  const context = sandboxWith(["e17SearchUsageWeight"], ["REGISTRAR_LEGACY_HASH_TABS"], {
    viewVisitSummary: () => ({ count: 0, last: "" }),
  });
  assert.equal(context.e17SearchUsageWeight("mapa-calor"), 0);
});
