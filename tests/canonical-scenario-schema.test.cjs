const test = require("node:test");
const assert = require("node:assert/strict");

const schema = require("../canonical-scenario-schema.js");
const migrations = require("../migrations/scenario-schema-migrations.js");

const ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ"; // Crockford base32, sin I/L/O/U

function makeId(prefix, seed) {
  let out = "";
  for (let index = 0; index < 26; index += 1) {
    out += ALPHABET[(seed * (index + 7) + index * 13) % ALPHABET.length];
  }
  return `${prefix}_${out}`;
}

function baseEscenario(overrides = {}) {
  return {
    schemaVersion: "1.0",
    id: makeId("scn", 1),
    nombre: "Escenario de prueba",
    estado: "borrador",
    base: {
      datasetVersion: "v2026-08-cierre",
      fechaCorte: "2026-08-01",
      hashIntegridad: `sha256:${"a".repeat(64)}`,
      horizonteMeses: 24,
    },
    supuestos: {
      inflacionAnual: 0.025,
      derivaIngresosAnual: 0.01,
      derivaGastosAnual: 0.02,
      rentabilidadAhorroAnual: 0.021,
      deltaTipoVariable: 0,
      modoTraspaso: "prudente",
    },
    guardarrailes: {
      reservaOperativaCaixaBank: 3000,
      colchonMinimoMeses: 3,
      ratioCuotaIngresoMax: 0.35,
      saldoMinimoAbsoluto: 500,
    },
    decisiones: [],
    ...overrides,
  };
}

function decision(tipo, params, overrides = {}) {
  const { __seed, ...rest } = overrides;
  return {
    id: makeId("dec", __seed || 1),
    tipo,
    titulo: `Decisión ${tipo}`,
    activa: true,
    orden: 1,
    planificacion: { modo: "optimo" },
    params,
    ...rest,
  };
}

const VALID_PARAMS_BY_TYPE = {
  amortizacion: { deudaId: "cofidis", importe: 2400 },
  amortizacion_fraccionada: { deudaId: "cetelem", importeMensual: 150, meses: 6 },
  refinanciacion: { deudaId: "wizink", nuevoPrincipal: 5000, nuevoTIN: 0.12, nuevaCuota: 180, nuevoPlazo: 36 },
  reunificacion: { deudaIds: ["wizink", "cetelem"], nuevoPrincipal: 9000, nuevoTIN: 0.15, nuevaCuota: 250, nuevoPlazo: 48 },
  retomar_pagos: { deudaId: "wizink", cuota: 185, mesInicio: "2027-03" },
  acuerdo_quita: { deudaId: "cetelem", importePactado: 4100, modalidad: "pago único", vigenciaHasta: "2026-09-30" },
  compra: { nombre: "Coche", importe: 14000, financiacion: null },
  proyecto: { nombre: "Coche", importeObjetivo: 14000, modalidad: "hucha", mesObjetivo: "2027-03" },
  imprevisto: { importe: 600, mes: "2026-11", recurrenciaMeses: null },
  cambio_ingreso: { titular: "tere", deltaMensual: 10, mesInicio: "2026-08" },
  cambio_gasto: { bloque: "alimentacion", deltaMensual: 40, mesInicio: "2026-08" },
  traspaso: { origen: "caixabank", destino: "mediolanum", importe: 900, mes: "2026-08" },
  cambio_presupuesto: { bloque: "ocio", nuevoTecho: 200, desde: "2027-01" },
  deuda_nueva: { principal: 8000, cuota: 180, plazo: 48, mes: "2026-10" },
  prestamo_familiar: { direccion: "nos_prestan", importe: 3000, mes: "2026-10", devolucionMensual: 100, meses: 30 },
  propio: { definicionId: "propio-abc123", nombre: "Herencia esperada", mes: "2027-01", importe: 5000 },
};

test("un escenario mínimo válido (sin decisiones) pasa la validación", () => {
  const result = schema.validateEscenario(baseEscenario());
  assert.equal(result.valid, true, JSON.stringify(result.issues));
  assert.deepEqual(result.issues, []);
});

test("faltan campos obligatorios de primer nivel", () => {
  const invalid = baseEscenario();
  delete invalid.guardarrailes;
  delete invalid.estado;
  const result = schema.validateEscenario(invalid);
  assert.equal(result.valid, false);
  const codes = result.issues.map((issue) => issue.path);
  assert.ok(codes.includes("$.guardarrailes"));
  assert.ok(codes.includes("$.estado"));
});

test("un campo no declarado en el escenario se rechaza (additionalProperties: false)", () => {
  const invalid = baseEscenario({ campoInventado: true });
  const result = schema.validateEscenario(invalid);
  assert.equal(result.valid, false);
  assert.ok(result.issues.some((issue) => issue.code === "unexpected-property" && issue.path === "$.campoInventado"));
});

test("un campo no declarado dentro de supuestos también se rechaza", () => {
  const invalid = baseEscenario();
  invalid.supuestos.campoInventado = 1;
  const result = schema.validateEscenario(invalid);
  assert.equal(result.valid, false);
  assert.ok(result.issues.some((issue) => issue.path === "$.supuestos.campoInventado"));
});

test("schemaVersion debe ser exactamente 1.0", () => {
  const invalid = baseEscenario({ schemaVersion: "2.0" });
  const result = schema.validateEscenario(invalid);
  assert.equal(result.valid, false);
  assert.ok(result.issues.some((issue) => issue.path === "$.schemaVersion"));
});

test("el id del escenario debe cumplir el patrón scn_ + 26 caracteres Crockford base32", () => {
  const invalid = baseEscenario({ id: "scn_demasiado-corto" });
  const result = schema.validateEscenario(invalid);
  assert.equal(result.valid, false);
  assert.ok(result.issues.some((issue) => issue.path === "$.id" && issue.code === "invalid-id"));
});

test("estado fuera del enum se rechaza", () => {
  const invalid = baseEscenario({ estado: "en_curso" });
  const result = schema.validateEscenario(invalid);
  assert.equal(result.valid, false);
  assert.ok(result.issues.some((issue) => issue.path === "$.estado" && issue.code === "invalid-enum"));
});

test("los rangos de supuestos son finitos: una inflación del 300% se rechaza", () => {
  const invalid = baseEscenario();
  invalid.supuestos.inflacionAnual = 3.0;
  const result = schema.validateEscenario(invalid);
  assert.equal(result.valid, false);
  assert.ok(result.issues.some((issue) => issue.path === "$.supuestos.inflacionAnual"));
});

test("un escenario en estado aplicado exige el bloque aplicacion", () => {
  const invalid = baseEscenario({ estado: "aplicado" });
  const result = schema.validateEscenario(invalid);
  assert.equal(result.valid, false);
  assert.ok(result.issues.some((issue) => issue.path === "$.aplicacion" && issue.code === "missing-required-field"));
});

test("un escenario aplicado con motivo y snapshot previo es válido", () => {
  const valid = baseEscenario({
    estado: "aplicado",
    aplicacion: {
      aplicadoEl: "2026-08-09T09:00:00.000Z",
      motivo: "Oferta aceptada de Cetelem, documentación completa",
      snapshotPrevioId: "snap_01J8Y0000000000000000000",
      revertidoEl: null,
    },
  });
  const result = schema.validateEscenario(valid);
  assert.equal(result.valid, true, JSON.stringify(result.issues));
});

test("más de 30 decisiones se rechaza", () => {
  const decisiones = Array.from({ length: 31 }, (_, index) =>
    decision("amortizacion", VALID_PARAMS_BY_TYPE.amortizacion, { __seed: index + 2, orden: index })
  );
  const invalid = baseEscenario({ decisiones });
  const result = schema.validateEscenario(invalid);
  assert.equal(result.valid, false);
  assert.ok(result.issues.some((issue) => issue.code === "invalid-value" && issue.path === "$.decisiones"));
});

test("T-META-01 · todo tipo del catálogo tiene su validador de params (if/then)", () => {
  schema.DECISION_TYPES.forEach((tipo) => {
    assert.ok(typeof schema.PARAMS_VALIDATORS[tipo] === "function", `Falta el validador if/then para el tipo «${tipo}»`);
  });
  assert.equal(Object.keys(schema.PARAMS_VALIDATORS).length, schema.DECISION_TYPES.length);
});

test("cada tipo de decisión valida un ejemplo correcto de params", () => {
  schema.DECISION_TYPES.forEach((tipo, index) => {
    const escenario = baseEscenario({
      decisiones: [decision(tipo, VALID_PARAMS_BY_TYPE[tipo], { __seed: index + 2, orden: 0 })],
    });
    const result = schema.validateEscenario(escenario);
    assert.equal(result.valid, true, `${tipo}: ${JSON.stringify(result.issues)}`);
  });
});

test("cada tipo de decisión rechaza params con un campo obligatorio ausente", () => {
  schema.DECISION_TYPES.forEach((tipo, index) => {
    const validParams = VALID_PARAMS_BY_TYPE[tipo];
    const requiredField = Object.keys(validParams)[0];
    const brokenParams = { ...validParams };
    delete brokenParams[requiredField];
    const escenario = baseEscenario({
      decisiones: [decision(tipo, brokenParams, { __seed: index + 2, orden: 0 })],
    });
    const result = schema.validateEscenario(escenario);
    assert.equal(result.valid, false, `${tipo} debería fallar sin «${requiredField}»`);
  });
});

test("un tipo de decisión desconocido se rechaza", () => {
  const invalid = baseEscenario({
    decisiones: [decision("tipo_inventado", {}, { __seed: 2, orden: 0 })],
  });
  const result = schema.validateEscenario(invalid);
  assert.equal(result.valid, false);
  assert.ok(result.issues.some((issue) => issue.path === "$.decisiones[0].tipo" && issue.code === "invalid-enum"));
});

test("un campo extra dentro de params se rechaza (additionalProperties: false por tipo)", () => {
  const invalid = baseEscenario({
    decisiones: [
      decision("amortizacion", { ...VALID_PARAMS_BY_TYPE.amortizacion, campoRaro: 1 }, { __seed: 2, orden: 0 }),
    ],
  });
  const result = schema.validateEscenario(invalid);
  assert.equal(result.valid, false);
  assert.ok(result.issues.some((issue) => issue.path === "$.decisiones[0].params.campoRaro"));
});

test("planificacion modo manual exige mesManual", () => {
  const invalid = baseEscenario({
    decisiones: [
      decision("amortizacion", VALID_PARAMS_BY_TYPE.amortizacion, {
        __seed: 2, orden: 0, planificacion: { modo: "manual" },
      }),
    ],
  });
  const result = schema.validateEscenario(invalid);
  assert.equal(result.valid, false);
  assert.ok(result.issues.some((issue) => issue.path === "$.decisiones[0].planificacion.mesManual"));
});

test("planificacion modo manual con mesManual es válida", () => {
  const valid = baseEscenario({
    decisiones: [
      decision("amortizacion", VALID_PARAMS_BY_TYPE.amortizacion, {
        __seed: 2, orden: 0, planificacion: { modo: "manual", mesManual: "2027-03" },
      }),
    ],
  });
  const result = schema.validateEscenario(valid);
  assert.equal(result.valid, true, JSON.stringify(result.issues));
});

test("dos decisiones con el mismo id se rechazan como duplicadas", () => {
  const sharedId = makeId("dec", 9);
  const invalid = baseEscenario({
    decisiones: [
      decision("amortizacion", VALID_PARAMS_BY_TYPE.amortizacion, { id: sharedId, orden: 0 }),
      decision("traspaso", VALID_PARAMS_BY_TYPE.traspaso, { id: sharedId, orden: 1 }),
    ],
  });
  const result = schema.validateEscenario(invalid);
  assert.equal(result.valid, false);
  assert.ok(result.issues.some((issue) => issue.code === "duplicate-id"));
});

test("dependeDe hacia un identificador inexistente se rechaza", () => {
  const invalid = baseEscenario({
    decisiones: [
      decision("amortizacion", VALID_PARAMS_BY_TYPE.amortizacion, {
        __seed: 2, orden: 0, dependeDe: ["dec_no_existe"],
      }),
    ],
  });
  const result = schema.validateEscenario(invalid);
  assert.equal(result.valid, false);
  assert.ok(result.issues.some((issue) => issue.code === "unknown-dependency"));
});

test("un ciclo en dependeDe se rechaza como error de validación, no como bucle infinito (caso C045)", () => {
  const idA = makeId("dec", 11);
  const idB = makeId("dec", 12);
  const invalid = baseEscenario({
    decisiones: [
      decision("amortizacion", VALID_PARAMS_BY_TYPE.amortizacion, { id: idA, orden: 0, dependeDe: [idB] }),
      decision("traspaso", VALID_PARAMS_BY_TYPE.traspaso, { id: idB, orden: 1, dependeDe: [idA] }),
    ],
  });
  const result = schema.validateEscenario(invalid);
  assert.equal(result.valid, false);
  assert.ok(result.issues.some((issue) => issue.code === "dependency-cycle"));
});

test("una dependencia declarada sin ciclo (orden topológico válido) no genera error de ciclo", () => {
  const idA = makeId("dec", 13);
  const idB = makeId("dec", 14);
  const valid = baseEscenario({
    decisiones: [
      decision("amortizacion", VALID_PARAMS_BY_TYPE.amortizacion, { id: idA, orden: 0 }),
      decision("traspaso", VALID_PARAMS_BY_TYPE.traspaso, { id: idB, orden: 1, dependeDe: [idA] }),
    ],
  });
  const result = schema.validateEscenario(valid);
  assert.equal(result.valid, true, JSON.stringify(result.issues));
});

test("compra sin financiación es válida (financiacion: null)", () => {
  const valid = baseEscenario({
    decisiones: [decision("compra", { nombre: "Coche", importe: 14000 }, { __seed: 2, orden: 0 })],
  });
  const result = schema.validateEscenario(valid);
  assert.equal(result.valid, true, JSON.stringify(result.issues));
});

test("compra con financiación incompleta se rechaza", () => {
  const invalid = baseEscenario({
    decisiones: [
      decision("compra", { nombre: "Coche", importe: 14000, financiacion: { principal: 10000 } }, { __seed: 2, orden: 0 }),
    ],
  });
  const result = schema.validateEscenario(invalid);
  assert.equal(result.valid, false);
  assert.ok(result.issues.some((issue) => issue.path.startsWith("$.decisiones[0].params.financiacion")));
});

test("cambio_gasto exige deltaMensual o deltaPct", () => {
  const invalid = baseEscenario({
    decisiones: [
      decision("cambio_gasto", { bloque: "ocio", mesInicio: "2026-08" }, { __seed: 2, orden: 0 }),
    ],
  });
  const result = schema.validateEscenario(invalid);
  assert.equal(result.valid, false);
  assert.ok(result.issues.some((issue) => issue.code === "missing-required-field" && issue.path === "$.decisiones[0].params"));
});

test("registro de migraciones: sin migraciones registradas, aplicar migraciones es una operación identidad", () => {
  const escenario = baseEscenario();
  const { escenario: migrated, applied } = migrations.applyMigrations(escenario);
  assert.deepEqual(applied, []);
  assert.equal(migrated, escenario);
  assert.deepEqual(migrations.registeredVersions(), []);
});

test("registerMigration exige al menos un ejemplo real (T-META-03)", () => {
  assert.throws(() => {
    migrations.registerMigration("1.0", "1.1", (value) => value, []);
  }, /ejemplo real/);
});

test("C044 · resolveExecutionOrder: cuando orden y dependeDe se contradicen, gana el orden topológico", () => {
  const idA = makeId("dec", 21);
  const idB = makeId("dec", 22);
  const idC = makeId("dec", 23);
  const decisiones = [
    decision("amortizacion", VALID_PARAMS_BY_TYPE.amortizacion, { id: idA, orden: 1 }),
    decision("traspaso", VALID_PARAMS_BY_TYPE.traspaso, { id: idB, orden: 2, dependeDe: [idC] }),
    decision("compra", VALID_PARAMS_BY_TYPE.compra, { id: idC, orden: 3 }),
  ];
  const result = schema.resolveExecutionOrder(decisiones);
  assert.equal(result.hasCycle, false);
  assert.deepEqual(result.declaredOrder, [idA, idB, idC], "el orden declarado ingenuo ignora la dependencia");
  assert.deepEqual(result.resolvedOrder, [idA, idC, idB], "el orden real debe colocar C antes que B porque B depende de C");
  assert.equal(result.declaredOrderMatches, false, "orden y dependeDe se contradicen: no deberían coincidir");
});

test("resolveExecutionOrder: sin conflictos entre orden y dependeDe, ambos coinciden", () => {
  const idA = makeId("dec", 24);
  const idB = makeId("dec", 25);
  const decisiones = [
    decision("amortizacion", VALID_PARAMS_BY_TYPE.amortizacion, { id: idA, orden: 0 }),
    decision("traspaso", VALID_PARAMS_BY_TYPE.traspaso, { id: idB, orden: 1, dependeDe: [idA] }),
  ];
  const result = schema.resolveExecutionOrder(decisiones);
  assert.equal(result.declaredOrderMatches, true);
  assert.deepEqual(result.resolvedOrder, [idA, idB]);
});

test("C045 (revisitado) · resolveExecutionOrder detecta el ciclo y no entra en bucle infinito", () => {
  const idA = makeId("dec", 26);
  const idB = makeId("dec", 27);
  const decisiones = [
    decision("amortizacion", VALID_PARAMS_BY_TYPE.amortizacion, { id: idA, orden: 0, dependeDe: [idB] }),
    decision("traspaso", VALID_PARAMS_BY_TYPE.traspaso, { id: idB, orden: 1, dependeDe: [idA] }),
  ];
  const result = schema.resolveExecutionOrder(decisiones);
  assert.equal(result.hasCycle, true);
  assert.equal(result.resolvedOrder, null);
  assert.deepEqual(new Set(result.unresolved), new Set([idA, idB]));
});
