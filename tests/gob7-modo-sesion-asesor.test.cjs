const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");

const appSource = fs.readFileSync(require.resolve("../app.js"), "utf8");
const indexSource = fs.readFileSync(require.resolve("../index.html"), "utf8");

test("GOB7: la tarjeta de Ajustes tiene la casilla del modo sesión con asesor/pareja antes de las anclas de sección", () => {
  assert.match(indexSource, /id="gob7AdvisorModeToggle"/);
  const ajustesIdx = indexSource.indexOf('id="ajustes"');
  const toggleIdx = indexSource.indexOf('id="gob7AdvisorModeToggle"');
  const anchorsIdx = indexSource.indexOf('id="ajustesAnchors"');
  assert.ok(ajustesIdx > 0 && toggleIdx > ajustesIdx && toggleIdx < anchorsIdx, "la casilla debe estar dentro de #ajustes, antes de las anclas");
});

test("GOB7: advisorSessionModeEnabled lee el dato del hogar, nunca inventa un valor por defecto activo", () => {
  const block = appSource.slice(appSource.indexOf("function advisorSessionModeEnabled("), appSource.indexOf("function advisorSessionModeEnabled(") + 200);
  assert.match(block, /return !!state\?\.advisorSessionMode;/);
});

test("GOB7: applyAdvisorSessionMode solo actúa dentro de #ajustes, nunca fuera (p.ej. la pareja Configuración/Herramientas de Deuda)", () => {
  const block = appSource.slice(appSource.indexOf("function applyAdvisorSessionMode("), appSource.indexOf("function applyAdvisorSessionMode(") + 900);
  assert.match(block, /document\.getElementById\("ajustes"\)/);
  assert.match(block, /querySelectorAll\("\.e19-ajustes-group"\)/);
});

test("GOB7: applyAdvisorSessionMode oculta todo lo que sigue al encabezado 'Herramientas' hasta el siguiente encabezado de grupo", () => {
  const block = appSource.slice(appSource.indexOf("function applyAdvisorSessionMode("), appSource.indexOf("function applyAdvisorSessionMode(") + 900);
  assert.match(block, /label === "Herramientas" && enabled/);
  assert.match(block, /child\.hidden = hideRest;/);
});

// Simulación de la misma lógica de clasificación (encabezado "Configuración"/"Herramientas"
// alterna qué se oculta) sobre una estructura mínima, para confirmar la regla documentada sin
// depender de un DOM real (este repo no ejecuta app.js en pruebas, solo lo valida por texto —
// mismo criterio que el resto de tests de app.js de esta sesión).
function simulateAdvisorGroupVisibility(headerSequence, enabled) {
  let hideRest = false;
  return headerSequence.map((item) => {
    if (item.isHeader) {
      hideRest = item.label === "Herramientas" && enabled;
      return { ...item, hidden: hideRest };
    }
    return { ...item, hidden: hideRest };
  });
}

test("GOB7: con el modo activado, las tarjetas de Configuración quedan visibles y las de Herramientas ocultas", () => {
  const sequence = [
    { isHeader: true, label: "Hogar" },
    { isHeader: true, label: "Configuración" },
    { isHeader: false, id: "card-config-1" },
    { isHeader: false, id: "card-config-2" },
    { isHeader: true, label: "Herramientas" },
    { isHeader: false, id: "card-tool-1" },
    { isHeader: false, id: "card-tool-2" },
  ];
  const result = simulateAdvisorGroupVisibility(sequence, true);
  assert.equal(result.find((item) => item.id === "card-config-1").hidden, false);
  assert.equal(result.find((item) => item.id === "card-config-2").hidden, false);
  assert.equal(result.find((item) => item.id === "card-tool-1").hidden, true);
  assert.equal(result.find((item) => item.id === "card-tool-2").hidden, true);
});

test("GOB7: con el modo desactivado, nada queda oculto (reversible con un clic)", () => {
  const sequence = [
    { isHeader: true, label: "Hogar" },
    { isHeader: true, label: "Configuración" },
    { isHeader: false, id: "card-config-1" },
    { isHeader: true, label: "Herramientas" },
    { isHeader: false, id: "card-tool-1" },
  ];
  const result = simulateAdvisorGroupVisibility(sequence, false);
  assert.ok(result.every((item) => item.hidden === false));
});

test("GOB7: el modo se persiste como un dato más del hogar (mismo criterio que DEB7/LEV1)", () => {
  const block = appSource.slice(appSource.indexOf("deb7Preference: state.deb7Preference"), appSource.indexOf("deb7Preference: state.deb7Preference") + 500);
  assert.match(block, /advisorSessionMode: !!state\.advisorSessionMode,/);
});

test("GOB7: syncGob7AdvisorModeControl refleja el dato guardado sin pisar mientras el usuario interactúa con la casilla", () => {
  const block = appSource.slice(appSource.indexOf("function syncGob7AdvisorModeControl("), appSource.indexOf("function syncGob7AdvisorModeControl(") + 300);
  assert.match(block, /document\.activeElement !== toggle/);
  assert.match(block, /toggle\.checked = advisorSessionModeEnabled\(\);/);
});

test("GOB7: handleGob7AdvisorModeToggle persiste, reaplica la vista y avisa del cambio", () => {
  const block = appSource.slice(appSource.indexOf("function handleGob7AdvisorModeToggle("), appSource.indexOf("function handleGob7AdvisorModeToggle(") + 500);
  assert.match(block, /state\.advisorSessionMode = !!event\.target\.checked;/);
  assert.match(block, /saveScenarioSettings\(\);/);
  assert.match(block, /applyAdvisorSessionMode\(state\.advisorSessionMode\);/);
  assert.match(block, /announceStatus\(/);
});

test("GOB7: la casilla está cableada a handleGob7AdvisorModeToggle", () => {
  assert.match(appSource, /qs\("gob7AdvisorModeToggle"\)\?\.addEventListener\("change", handleGob7AdvisorModeToggle\);/);
});

test("GOB7: renderAjustes sincroniza la casilla y reaplica el modo en cada render de la pantalla", () => {
  const block = appSource.slice(appSource.indexOf("function renderAjustes("), appSource.indexOf("function renderAjustes(") + 700);
  assert.match(block, /syncGob7AdvisorModeControl\(\);/);
  assert.match(block, /applyAdvisorSessionMode\(advisorSessionModeEnabled\(\)\);/);
});
