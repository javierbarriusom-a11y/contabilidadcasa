const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const app = fs.readFileSync(path.join(root, "app.js"), "utf8");

// PV3/PV5 (BACKLOG_ULTIMATE_SEPTIEMBRE.md bloque 3, ampliación "previsión viva" — sin documento de
// detalle propio, resumidas en su columna Nota):
//   PV3 · "recalibración en cascada al cerrar el mes — dispara learnFromHistory() al confirmar el
//   cierre mensual (A1-2)".
//   PV5 · "diario de por qué cambió cada cifra — prerrequisito de confianza para PV1".

function functionBody(name, source = app) {
  const start = source.indexOf(`function ${name}(`);
  assert.ok(start >= 0, `No existe ${name} en app.js`);
  const end = source.indexOf("\nfunction ", start + 1);
  assert.ok(end > start);
  return source.slice(start, end);
}

test("closeCurrentMonthTransaction dispara la recalibración al cerrar el mes (PV3)", () => {
  const body = functionBody("closeCurrentMonthTransaction");
  assert.match(body, /recalibrateForecastLearning\(month, closedAt\)/);
});

test("recalibrateForecastLearning llama a learnFromHistory con el histórico conciliado, sin motor paralelo", () => {
  const body = functionBody("recalibrateForecastLearning");
  assert.match(body, /window\.FinanceCanonicalForecast\?\.learnFromHistory\(reconciledMonthlyNetHistory\(\)/);
});

test("el Laboratorio de escenarios (E13) reutiliza reconciledMonthlyNetHistory en vez de duplicar el histórico", () => {
  const body = functionBody("renderE13ScenarioLab");
  assert.match(body, /reconciledMonthlyNetHistory\(\)/);
  assert.doesNotMatch(body, /matchedMonths/, "la construcción manual del histórico debía desaparecer de aquí");
});

test("nunca se aplica un ajuste solo: el aprendizaje sigue marcado confirmRequired/no aplicado", () => {
  // La regla vive en canonical-forecast.js (learnFromHistory ya la fija); aquí solo se comprueba
  // que recalibrateForecastLearning no la contradice escribiendo `applied: true` en ningún sitio.
  const body = functionBody("recalibrateForecastLearning");
  assert.doesNotMatch(body, /applied:\s*true/);
});

test("PV5: cada cambio queda registrado con la cifra anterior, la nueva y el motivo, y persiste en un diario acotado", () => {
  const recalibrate = functionBody("recalibrateForecastLearning");
  assert.match(recalibrate, /previousDelta/);
  assert.match(recalibrate, /newDelta/);
  assert.match(recalibrate, /pv5DiaryReason\(entry\)/);
  const save = functionBody("savePv5Diary");
  assert.match(save, /PV5_DIARY_MAX_ENTRIES/, "el diario debe acotarse, no crecer sin límite");
});

test("PV5 se lee en Ajustes, no se inventa una pantalla nueva", () => {
  assert.match(app, /renderCierreReportArchive\(\);\s*\n\s*renderPv5Diary\(\);/);
  assert.match(html, /id="pv5DiaryList"/);
  assert.match(html, /id="pv5DiaryEmpty"/);
});
