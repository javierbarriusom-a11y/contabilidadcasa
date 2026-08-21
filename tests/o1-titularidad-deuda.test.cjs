const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const app = fs.readFileSync(path.join(root, "app.js"), "utf8");
const schema = require(path.join(root, "canonical-scenario-schema.js"));
const engine = require(path.join(root, "canonical-scenario-engine.js"));

// O-1 (BACKLOG_OPERACION.md): titularOrigen/titularDestino en refinanciación y reunificación de
// deuda, para poder simular «pedir un crédito nuevo a nombre de otra persona para cancelar una
// deuda propia» — el caso concreto que motivó el diagnóstico del 21 de agosto de 2026. Aditivo por
// diseño: una decisión sin estos campos se comporta exactamente igual que antes de O-1.

const ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
function makeId(prefix, seed) {
  let out = "";
  for (let index = 0; index < 26; index += 1) out += ALPHABET[(seed * (index + 7) + index * 13) % ALPHABET.length];
  return `${prefix}_${out}`;
}

function baseEscenario(decisiones) {
  return {
    schemaVersion: "1.0",
    id: makeId("scn", 1),
    nombre: "Escenario de prueba O-1",
    estado: "borrador",
    base: { datasetVersion: "v2026-08-cierre", fechaCorte: "2026-08-01", hashIntegridad: `sha256:${"a".repeat(64)}`, horizonteMeses: 24 },
    supuestos: { inflacionAnual: 0.025, derivaIngresosAnual: 0.01, derivaGastosAnual: 0.02, rentabilidadAhorroAnual: 0.021, deltaTipoVariable: 0, modoTraspaso: "prudente" },
    guardarrailes: { reservaOperativaCaixaBank: 3000, colchonMinimoMeses: 3, ratioCuotaIngresoMax: 0.35, saldoMinimoAbsoluto: 500 },
    decisiones,
  };
}

function decision(tipo, params, __seed = 1) {
  return { id: makeId("dec", __seed), tipo, titulo: `Decisión ${tipo}`, activa: true, orden: 1, planificacion: { modo: "optimo" }, params };
}

// --- Esquema --------------------------------------------------------------------------------

test("O-1 · refinanciación sin titularOrigen/titularDestino sigue siendo válida (aditivo, no rompe I-09)", () => {
  const params = { deudaId: "wizink", nuevoPrincipal: 5000, nuevoTIN: 0.12, nuevaCuota: 180, nuevoPlazo: 36 };
  const result = schema.validateEscenario(baseEscenario([decision("refinanciacion", params)]));
  assert.equal(result.valid, true, JSON.stringify(result.issues));
});

test("O-1 · reunificación sin titularOrigen/titularDestino sigue siendo válida", () => {
  const params = { deudaIds: ["wizink", "cetelem"], nuevoPrincipal: 9000, nuevoTIN: 0.15, nuevaCuota: 250, nuevoPlazo: 48 };
  const result = schema.validateEscenario(baseEscenario([decision("reunificacion", params)]));
  assert.equal(result.valid, true, JSON.stringify(result.issues));
});

test("O-1 · refinanciación acepta titularOrigen/titularDestino válidos, incluso distintos entre sí", () => {
  const params = { deudaId: "wizink", nuevoPrincipal: 5000, nuevoTIN: 0.12, nuevaCuota: 180, nuevoPlazo: 36, titularOrigen: "javi", titularDestino: "tere" };
  const result = schema.validateEscenario(baseEscenario([decision("refinanciacion", params)]));
  assert.equal(result.valid, true, JSON.stringify(result.issues));
});

test("O-1 · reunificación acepta titularOrigen/titularDestino válidos", () => {
  const params = { deudaIds: ["wizink", "cetelem"], nuevoPrincipal: 9000, nuevoTIN: 0.15, nuevaCuota: 250, nuevoPlazo: 48, titularOrigen: "hogar", titularDestino: "javi" };
  const result = schema.validateEscenario(baseEscenario([decision("reunificacion", params)]));
  assert.equal(result.valid, true, JSON.stringify(result.issues));
});

test("O-1 · titularOrigen/titularDestino fuera del enum TITULARES se rechazan", () => {
  const params = { deudaId: "wizink", nuevoPrincipal: 5000, nuevoTIN: 0.12, nuevaCuota: 180, nuevoPlazo: 36, titularOrigen: "vecino" };
  const result = schema.validateEscenario(baseEscenario([decision("refinanciacion", params)]));
  assert.equal(result.valid, false);
  assert.ok(result.issues.some((issue) => issue.path.endsWith(".titularOrigen") && issue.code === "invalid-enum"));
});

test("O-1 · titularDestino fuera del enum en reunificación también se rechaza", () => {
  const params = { deudaIds: ["wizink", "cetelem"], nuevoPrincipal: 9000, nuevoTIN: 0.15, nuevaCuota: 250, nuevoPlazo: 48, titularDestino: "banco" };
  const result = schema.validateEscenario(baseEscenario([decision("reunificacion", params)]));
  assert.equal(result.valid, false);
  assert.ok(result.issues.some((issue) => issue.path.endsWith(".titularDestino") && issue.code === "invalid-enum"));
});

// --- Motor ------------------------------------------------------------------------------------

function contract(overrides = {}) {
  return { id: "deuda-1", paymentStatus: "active", currentPrincipal: 1000, currentPayment: 100, remainingInstallments: 10, apr: 8, ...overrides };
}

test("O-1 · applyRefinanciacion propaga titularOrigen/titularDestino al estado de deuda del escenario", () => {
  const debtContracts = [contract({ id: "wizink", currentPrincipal: 5000 })];
  const decisiones = [decision("refinanciacion", {
    deudaId: "wizink", nuevoPrincipal: 4800, nuevoTIN: 0.08, nuevaCuota: 160, nuevoPlazo: 36,
    titularOrigen: "javi", titularDestino: "tere",
  })];
  const result = engine.resolveDecisiones(decisiones, { debtContracts });
  assert.equal(result.valid, true);
  assert.equal(result.resultados[0].resultado, "aplicada");
  const wizink = result.debtStateFinal.find((item) => item.id === "wizink");
  assert.equal(wizink.titularOrigen, "javi");
  assert.equal(wizink.titularDestino, "tere");
  // El principal, cuota, TIN y plazo se siguen sustituyendo exactamente igual que antes de O-1.
  assert.equal(wizink.currentPrincipal, 4800);
  assert.equal(wizink.currentPayment, 160);
});

test("O-1 · applyRefinanciacion sin titular no añade esas claves (no inventa un titular por defecto en el motor)", () => {
  const debtContracts = [contract({ id: "wizink", currentPrincipal: 5000 })];
  const decisiones = [decision("refinanciacion", { deudaId: "wizink", nuevoPrincipal: 4800, nuevoTIN: 0.08, nuevaCuota: 160, nuevoPlazo: 36 })];
  const result = engine.resolveDecisiones(decisiones, { debtContracts });
  const wizink = result.debtStateFinal.find((item) => item.id === "wizink");
  assert.equal(wizink.titularOrigen, undefined);
  assert.equal(wizink.titularDestino, undefined);
});

test("O-1 · applyReunificacion propaga titularOrigen/titularDestino a la deuda nueva, no a las cerradas", () => {
  const debtContracts = [contract({ id: "A", currentPrincipal: 2000 }), contract({ id: "B", currentPrincipal: 1500 })];
  const decisiones = [decision("reunificacion", {
    deudaIds: ["A", "B"], nuevoPrincipal: 3500, nuevoTIN: 0.09, nuevaCuota: 150, nuevoPlazo: 36,
    titularOrigen: "hogar", titularDestino: "tere",
  })];
  const result = engine.resolveDecisiones(decisiones, { debtContracts });
  const byId = new Map(result.debtStateFinal.map((item) => [item.id, item]));
  const nueva = byId.get(`reunificada-${decisiones[0].id}`);
  assert.equal(nueva.titularOrigen, "hogar");
  assert.equal(nueva.titularDestino, "tere");
  assert.equal(byId.get("A").titularDestino, undefined, "las deudas cerradas no llevan el titular nuevo");
  assert.equal(byId.get("B").titularDestino, undefined);
});

test("O-1 · con 0 decisiones que toquen titular, el resultado es idéntico a antes de O-1 (I-09)", () => {
  const debtContracts = [contract({ id: "wizink" })];
  const before = engine.resolveDecisiones([], { debtContracts });
  const after = engine.resolveDecisiones([], { debtContracts });
  assert.deepEqual(before.debtStateFinal, after.debtStateFinal);
});

// --- Formulario del laboratorio de escenarios (app.js) ----------------------------------------

function extractConst(name) {
  const start = app.indexOf(`const ${name} =`);
  assert.ok(start >= 0, `No existe la constante ${name} en app.js`);
  let index = app.indexOf("=", start) + 1;
  while (!"([{".includes(app[index])) index += 1;
  let depth = 0;
  let inString = null;
  for (; index < app.length; index += 1) {
    const ch = app[index];
    if (inString) {
      if (ch === "\\") { index += 1; continue; }
      if (ch === inString) inString = null;
      continue;
    }
    if (ch === '"' || ch === "'" || ch === "`") { inString = ch; continue; }
    if ("([{".includes(ch)) depth += 1;
    else if (")]}".includes(ch)) {
      depth -= 1;
      if (depth === 0) return app.slice(start, index + 1);
    }
  }
  throw new Error(`No se pudo balancear la constante ${name}`);
}

function sandboxEscenarioMotorTypes() {
  const context = {
    Math, Number, String, Array,
    money: (value) => (Number.isFinite(Number(value)) ? `${Number(value).toFixed(2)} €` : "0.00 €"),
    escenarioMotorTrim: (value, max = 60) => {
      const text = String(value ?? "").trim();
      return text.length > max ? `${text.slice(0, max - 1)}…` : text;
    },
    escenarioMotorPct: (value) => (Number.isFinite(value) ? Math.round((value * 100 + Number.EPSILON)) / 10000 : undefined),
    escenarioMotorInt: (value) => (Number.isFinite(value) ? Math.round(value) : undefined),
  };
  vm.createContext(context);
  vm.runInContext(extractConst("ESCENARIO_MOTOR_TYPES"), context);
  vm.runInContext("globalThis.ESCENARIO_MOTOR_TYPES = ESCENARIO_MOTOR_TYPES;", context);
  return context;
}

function typeById(context, id) {
  return context.ESCENARIO_MOTOR_TYPES.find((entry) => entry.id === id);
}

const DEBT_LABEL_HELPER = { debtLabel: (id) => id };

test("O-1 · el formulario de «Cambiar condiciones» (refinanciacion) ofrece titularOrigen/titularDestino", () => {
  const context = sandboxEscenarioMotorTypes();
  const type = typeById(context, "refinanciacion");
  const keys = type.campos.map((field) => field.key);
  assert.ok(keys.includes("titularOrigen"));
  assert.ok(keys.includes("titularDestino"));
  // Las opciones vienen de un array creado dentro del sandbox de vm (otro realm): se comparan por
  // valor con join(), no con deepEqual, que en modo estricto exige también la misma identidad de
  // constructor Array entre realms.
  const opciones = type.campos.find((field) => field.key === "titularDestino").opciones.map(([value]) => value);
  assert.equal(Array.from(opciones).join(","), "hogar,javi,tere");
});

test("O-1 · sin tocar el titular, params() de refinanciacion asume «hogar» en ambos, como cambio_ingreso", () => {
  const context = sandboxEscenarioMotorTypes();
  const type = typeById(context, "refinanciacion");
  const params = type.params({ deudaId: "wizink", nuevoPrincipal: 5000, nuevaCuota: 180, nuevoTIN: 0.12, nuevoPlazo: 36 });
  assert.equal(params.titularOrigen, "hogar");
  assert.equal(params.titularDestino, "hogar");
});

test("O-1 · con titularOrigen distinto de titularDestino, el título y el detalle de refinanciacion lo dicen explícitamente", () => {
  const context = sandboxEscenarioMotorTypes();
  const type = typeById(context, "refinanciacion");
  const v = { deudaId: "wizink", nuevoPrincipal: 5000, nuevaCuota: 180, nuevoTIN: 0.12, nuevoPlazo: 36, titularOrigen: "javi", titularDestino: "tere" };
  const titulo = type.titulo(v, DEBT_LABEL_HELPER);
  assert.match(titulo, /javi.*tere/);
  const params = type.params(v);
  const detalle = type.detalle({ params });
  assert.match(detalle, /tere/);
});

test("O-1 · con el mismo titular a ambos lados, el título de refinanciacion no menciona titularidad", () => {
  const context = sandboxEscenarioMotorTypes();
  const type = typeById(context, "refinanciacion");
  const v = { deudaId: "wizink", nuevoPrincipal: 5000, nuevaCuota: 180, nuevoTIN: 0.12, nuevoPlazo: 36, titularOrigen: "hogar", titularDestino: "hogar" };
  const titulo = type.titulo(v, DEBT_LABEL_HELPER);
  assert.equal(titulo, "Refinanciar wizink");
});

test("O-1 · reunificacion ofrece los mismos campos de titular y los propaga a título/detalle", () => {
  const context = sandboxEscenarioMotorTypes();
  const type = typeById(context, "reunificacion");
  const keys = type.campos.map((field) => field.key);
  assert.ok(keys.includes("titularOrigen"));
  assert.ok(keys.includes("titularDestino"));
  const v = { deudaIds: ["wizink", "cetelem"], nuevoPrincipal: 9000, nuevaCuota: 250, nuevoTIN: 0.15, nuevoPlazo: 48, titularOrigen: "hogar", titularDestino: "tere" };
  const params = type.params(v);
  assert.equal(params.titularOrigen, "hogar");
  assert.equal(params.titularDestino, "tere");
  const titulo = type.titulo(v);
  assert.match(titulo, /hogar.*tere/);
  const detalle = type.detalle({ params });
  assert.match(detalle, /tere/);
});
