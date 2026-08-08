const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const schema = require("../canonical-scenario-schema.js");

const CASOS_DIR = path.join(__dirname, "golden", "casos");
const ESPERADOS_DIR = path.join(__dirname, "golden", "esperados");
const CASE_IDS = ["C040", "C041", "C042", "C043", "C044", "C045"];

function loadCaso(id) {
  return JSON.parse(fs.readFileSync(path.join(CASOS_DIR, `${id}.json`), "utf8"));
}

function loadEsperado(id) {
  return JSON.parse(fs.readFileSync(path.join(ESPERADOS_DIR, `${id}.expected.json`), "utf8"));
}

test("T-META-02 · los 6 casos combinados C040-C045 existen y declaran un estado válido", () => {
  CASE_IDS.forEach((id) => {
    const caso = loadCaso(id);
    assert.equal(caso.id, id);
    assert.ok(["computable", "gap_funcional"].includes(caso.estado));
    const esperadoFile = path.join(ESPERADOS_DIR, `${id}.expected.json`);
    if (caso.estado === "computable") {
      assert.ok(fs.existsSync(esperadoFile), `${id} es computable y debería tener esperado`);
    } else {
      assert.ok(!fs.existsSync(esperadoFile), `${id} es un hueco funcional y no debería tener esperado`);
      assert.ok(caso.motivo && caso.motivo.length > 0, `${id}: un hueco funcional debe documentar su motivo`);
      assert.ok(caso.motoresConsultados.length >= 1, `${id}: debe declarar qué motores se consultaron`);
    }
  });
});

test("C040 y C041 quedan documentados como hueco funcional (efecto cascada, sin motor que comparta estado entre decisiones)", () => {
  ["C040", "C041"].forEach((id) => {
    const caso = loadCaso(id);
    assert.equal(caso.estado, "gap_funcional");
  });
});

test("C042 y C043 quedan documentados como hueco funcional (conflicto bloqueante, coherente con el hueco de C005)", () => {
  ["C042", "C043"].forEach((id) => {
    const caso = loadCaso(id);
    assert.equal(caso.estado, "gap_funcional");
    assert.match(caso.motivo, /C005|conflicto/i);
  });
});

test("C044 · reproduce exactamente su resolución dorada: el orden topológico gana sobre el orden declarado", () => {
  const caso = loadCaso("C044");
  const esperado = loadEsperado("C044");
  const result = schema.resolveExecutionOrder(caso.entrada.decisiones);
  assert.deepEqual(result.declaredOrder, esperado.resolucion.declaredOrder);
  assert.deepEqual(result.resolvedOrder, esperado.resolucion.resolvedOrder);
  assert.equal(result.declaredOrderMatches, false, "el caso está diseñado para que orden y dependeDe se contradigan");
  assert.notDeepEqual(result.resolvedOrder, result.declaredOrder);
});

test("C045 · reproduce exactamente su resolución dorada: ciclo detectado, sin bucle infinito", () => {
  const caso = loadCaso("C045");
  const esperado = loadEsperado("C045");
  const start = Date.now();
  const result = schema.resolveExecutionOrder(caso.entrada.decisiones);
  const elapsedMs = Date.now() - start;
  assert.ok(elapsedMs < 1000, "detectar un ciclo no debe colgarse en un bucle infinito");
  assert.equal(result.hasCycle, esperado.resolucion.hasCycle);
  assert.equal(result.resolvedOrder, esperado.resolucion.resolvedOrder);
  assert.deepEqual(new Set(result.unresolved), new Set(esperado.resolucion.unresolved));
});

test("las decisiones de C044 y C045 también validan contra el esquema del día 1 (coherencia entre entregas)", () => {
  ["C044", "C045"].forEach((id) => {
    const caso = loadCaso(id);
    caso.entrada.decisiones.forEach((decision, index) => {
      const issues = [];
      schema.validateDecision(decision, `$.decisiones[${index}]`, issues);
      const blocking = issues.filter((issue) => issue.severity === "error");
      assert.deepEqual(blocking, [], `${id}.decisiones[${index}]: ${JSON.stringify(blocking)}`);
    });
  });
});
