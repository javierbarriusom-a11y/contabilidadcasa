const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const contractSource = fs.readFileSync(path.join(root, "state-contract.js"), "utf8");
const doc = fs.readFileSync(path.join(root, "MDX2_FORMATO_EXPORTACION.md"), "utf8");
const FinanceStateContract = require(path.join(root, "state-contract.js"));

// MDX2 (Oleada 2 Bloque 2): exportación en formato abierto y documentado, sobre A0-9 (ya real). El
// formato ya era JSON abierto de hecho; lo que faltaba era publicarlo como contrato explícito. Este
// test es la parte de "gobierno de datos" de la tarea: si state-contract.js cambia sus listas de
// campos y nadie actualiza MDX2_FORMATO_EXPORTACION.md a la vez, este test falla — el documento
// nunca puede quedarse desincronizado del motor real en silencio.

function extractArrayLiteral(name) {
  const match = contractSource.match(new RegExp(`const ${name} = (\\[[^\\]]*\\]);`));
  assert.ok(match, `No se encontró la constante ${name} en state-contract.js`);
  const withoutTrailingComma = match[1].replace(/,(\s*])/g, "$1");
  return JSON.parse(withoutTrailingComma);
}

test("MDX2_FORMATO_EXPORTACION.md existe y documenta el formato del sobre (format/formatVersion/checksum)", () => {
  assert.match(doc, /`"finanzas-casa-backup"`/);
  assert.match(doc, /`formatVersion`/);
  assert.match(doc, /`checksum\.algorithm`/);
  assert.match(doc, /fnv1a32/);
});

["ARRAY_FIELDS", "OPTIONAL_ARRAY_FIELDS", "OBJECT_FIELDS", "OPTIONAL_OBJECT_FIELDS"].forEach((constantName) => {
  test(`MDX2: cada campo de ${constantName} (state-contract.js) aparece documentado en MDX2_FORMATO_EXPORTACION.md`, () => {
    const fields = extractArrayLiteral(constantName);
    assert.ok(fields.length > 0, `${constantName} no debería estar vacío en el motor real`);
    fields.forEach((field) => {
      assert.match(doc, new RegExp(`\`${field}\``), `El campo "${field}" de ${constantName} no está documentado`);
    });
  });
});

test("MDX2: BACKUP_FORMAT y BACKUP_VERSION reales coinciden con lo que dice el documento", () => {
  assert.equal(FinanceStateContract.BACKUP_FORMAT, "finanzas-casa-backup");
  assert.equal(FinanceStateContract.BACKUP_VERSION, 1);
  assert.match(doc, /Hoy `1`\. Un cambio incompatible en la forma del sobre/);
});

test("MDX2: el documento explicita que los campos desconocidos se conservan, nunca se descartan (compatibilidad hacia delante)", () => {
  assert.match(doc, /se conserva tal cual/);
  assert.match(doc, /nunca descartarlos en silencio/);
});

test("MDX2: el documento explicita que nunca se inventa un dato que falte (mismo criterio que el resto de la app)", () => {
  assert.match(doc, /Nunca se inventa un dato que falte/);
});
