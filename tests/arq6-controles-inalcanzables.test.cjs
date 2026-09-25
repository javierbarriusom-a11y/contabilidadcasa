const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

// ARQ-6 (25 de septiembre de 2026), paso 3: comprobación automática de controles que nunca se muestran.
// Tres veces en dos días se encontró una función marcada como hecha cuyo botón vivía en una pantalla a
// la que ya no lleva ninguna ruta: la copia de emergencia (sesión 241), el editor de series (242) y la
// bandeja común con «Deshacer último lote» (243) — todos en #data-entry, que desde el 15 de agosto
// redirige a Registrar (R-10/R-11). Nada avisaba: el HTML seguía ahí, los manejadores seguían
// cableados y las pruebas de `vm` los ejercitaban sin arrancar el enrutado.
//
// Esta prueba pregunta al propio enrutador (`viewFromHash`, ejecutado de verdad en un `vm`) qué
// pantallas no puede mostrar nunca, y falla si en ellas hay un control que el código usa. Las que
// quedan hoy están abajo, cada una con su motivo; la lista funciona como trinquete en los dos
// sentidos: un control nuevo sin clasificar falla, y una excepción que ya no existe también.

const root = path.resolve(__dirname, "..");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const app = fs.readFileSync(path.join(root, "app.js"), "utf8");
const views = fs.readdirSync(path.join(root, "views")).filter((file) => file.endsWith(".js"))
  .map((file) => fs.readFileSync(path.join(root, "views", file), "utf8")).join("\n");
const code = `${app}\n${views}`;

// Controles que viven en pantallas inalcanzables, ya conocidos. Clave: id de la pantalla.
const KNOWN_UNREACHABLE_CONTROLS = {
  "data-entry": {
    motivo: "Restos de la entrada de datos anterior a Registrar (R-10/R-11): dato manual uno a uno, "
      + "tabla pegada y Excel. Registrar › Lote y Excel cubre tabla, CSV y Excel con el mismo motor; el "
      + "formulario uno a uno (proyecto/deuda incluidos) solo por lote. Retirarla o no: decisión del hogar pendiente.",
    ids: ["addManualData", "batchDataInput", "clearBatchData", "excelDataFile", "importBatchData", "manualDataActual",
      "manualDataKind", "manualDataLabel", "manualDataMonth", "manualDataPlanned", "manualDataSection",
      "manualProjectDuration", "manualProjectMode"],
  },
  "update-data": {
    motivo: "Vista mensual anterior a Registrar › Reales del mes. «Añadir» concepto con previsto y real "
      + "de un solo paso; lo cubren «+ Registrar gasto» de Hoy (FLU-2) y Planificación de partidas. "
      + "Retirarla o no: decisión del hogar pendiente.",
    ids: ["addExpenseConcept", "addIncomeConcept", "detailMonth"],
  },
  "datos-importar": {
    motivo: "Asistente de extracto en 4 pasos; el mismo asistente se pinta en Registrar › Importar "
      + "extracto (R-8, `datosImportarTarget()`), que es lo que se ve. Solo quedan sus botones gemelos.",
    ids: ["datosImportarBack", "datosImportarNext"],
  },
  "update-hub": {
    motivo: "Antigua portada de «Actualizar»; sus tarjetas de ruta llevan a Registrar. Sin controles propios.",
    ids: [],
  },
};

function sectionHtml(id) {
  const at = html.indexOf(`id="${id}"`);
  const open = html.lastIndexOf("<section", at);
  const tags = /<\/?section\b/g;
  tags.lastIndex = open;
  let depth = 0;
  for (let match = tags.exec(html); match; match = tags.exec(html)) {
    depth += match[0] === "<section" ? 1 : -1;
    if (depth === 0) return html.slice(open, match.index);
  }
  throw new Error(`Sección sin cerrar: ${id}`);
}

function extract(name, pattern) {
  const start = app.indexOf(pattern);
  assert.ok(start >= 0, `No existe ${name} en app.js`);
  const bodyStart = app.indexOf("{", start);
  let depth = 0;
  for (let index = bodyStart; index < app.length; index += 1) {
    if (app[index] === "{") depth += 1;
    else if (app[index] === "}") {
      depth -= 1;
      if (depth === 0) return app.slice(start, index + 1);
    }
  }
  throw new Error(`Cuerpo sin cerrar: ${name}`);
}

const viewSectionIds = [...html.matchAll(/<section\b[^>]*>/g)]
  .map((match) => match[0])
  .filter((tag) => /class="[^"]*\bview-section\b/.test(tag))
  .map((tag) => tag.match(/\bid="([^"]+)"/)?.[1])
  .filter(Boolean);

function unreachableSections() {
  const sandbox = {
    window: { location: { hash: "" } },
    document: { getElementById: (id) => (viewSectionIds.includes(id) ? { classList: { contains: (name) => name === "view-section" } } : null) },
  };
  vm.createContext(sandbox);
  vm.runInContext(`${extract("REGISTRAR_LEGACY_HASH_TABS", "const REGISTRAR_LEGACY_HASH_TABS = ")};
    ${extract("viewFromHash", "function viewFromHash(")}
    this.route = (hash) => { window.location.hash = hash; return viewFromHash(); };`, sandbox);
  return viewSectionIds.filter((id) => sandbox.route(`#${id}`) !== id);
}

function usedControls(sectionId) {
  const ids = [...sectionHtml(sectionId).matchAll(/<(?:button|input|select|textarea)\b[^>]*\bid="([^"]+)"/g)].map((match) => match[1]);
  return ids.filter((id) => code.includes(`qs("${id}")`) || code.includes(`getElementById("${id}")`)).sort();
}

test("ARQ-6 · el enrutador sigue sin poder mostrar exactamente las pantallas conocidas", () => {
  assert.ok(viewSectionIds.length > 40, "el recuento de pantallas parece roto");
  assert.deepEqual(unreachableSections().sort(), Object.keys(KNOWN_UNREACHABLE_CONTROLS).sort(),
    "una pantalla nueva se ha quedado sin ruta (o una conocida ha vuelto a tenerla): clasifícala aquí");
});

test("ARQ-6 · ningún control nuevo en una pantalla que no se muestra, y ninguna excepción que sobre", () => {
  unreachableSections().forEach((sectionId) => {
    assert.deepEqual(usedControls(sectionId), [...(KNOWN_UNREACHABLE_CONTROLS[sectionId]?.ids || [])].sort(),
      `#${sectionId} nunca se muestra: un control que el código usa ahí no lo puede pulsar nadie`);
  });
});

test("ARQ-6 · la bandeja, la copia de emergencia y el editor de series no vuelven a una pantalla oculta", () => {
  const hidden = unreachableSections().map(sectionHtml).join("\n");
  ["undoLastImport", "dataInboxSummary", "exportStateBackup", "stateBackupFile", "applySeriesChange"].forEach((id) => {
    assert.doesNotMatch(hidden, new RegExp(`id="${id}"`), `#${id} volvería a quedar sin botón visible`);
  });
});
