const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const root = path.resolve(__dirname, "..");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const app = fs.readFileSync(path.join(root, "app.js"), "utf8");
const css = fs.readFileSync(path.join(root, "styles.css"), "utf8");
const serviceWorker = fs.readFileSync(path.join(root, "service-worker.js"), "utf8");

test("escritorio usa el scroll único de página y móvil conserva menú desplazable", () => {
  const desktopSidebar = css.slice(css.indexOf(".sidebar {"), css.indexOf(".sidebar::-webkit-scrollbar"));
  assert.doesNotMatch(desktopSidebar, /overflow-y:\s*auto/);
  assert.doesNotMatch(desktopSidebar, /overscroll-behavior:\s*contain/);
  assert.match(css, /@media \(max-width: 860px\)[\s\S]*?\.sidebar \{[\s\S]*?overflow-y:\s*auto/);
});

test("la página carga E7 antes de la aplicación y el comparador muestra frontera y fuentes", () => {
  assert.ok(html.indexOf("canonical-e7-analysis.js") < html.indexOf("app.js"));
  assert.match(app, /paretoFrontier/);
  assert.match(app, /Efectos legales y fiscales/);
  assert.match(app, /professionalReviewRequired|PROFESSIONAL_WARNING/);
});

test("los lotes tabulares se previsualizan y solo se aplican tras confirmar", () => {
  assert.match(app, /function stageE7Import/);
  assert.match(app, /Vista previa · todavía no se ha importado nada/);
  assert.match(app, /confirmE7Import/);
  assert.match(app, /stageE7Import\(records, "lote pegado"\)/);
  assert.match(app, /stageE7Import\(records, file\.name\)/);
  assert.match(app, /function stageE7Workbook/);
  assert.match(app, /stageE7Workbook\(buildFinanceDataFromWorkbook/);
  assert.match(app, /Vista previa del libro · todavía no se ha sustituido el modelo/);
});

test("Datos y auditoría muestra escenarios calibrados solo con libro conciliado", () => {
  assert.match(app, /calibrateScenarios\(ledgerEntries/);
  assert.match(app, /Escenarios probabilísticos/);
  assert.match(app, /histórico conciliado|histórico conciliado/i);
});

test("Actualizar tolera cabeceras agregadas sin una lista mensual explícita", () => {
  assert.match(app, /Array\.isArray\(column\.months\) \? column\.months : \[\]/);
  assert.match(app, /columnMonths\.length > 0/);
});

test("el shell offline versiona e incluye el contrato E7", () => {
  assert.match(serviceWorker, /finanzas-casa-shell-20260814-f1a1/);
  assert.match(serviceWorker, /canonical-e7-analysis\.js/);
  assert.match(serviceWorker, /canonical-e8-operations\.js/);
});

test("el guardado general no intenta actualizar lotes que solo cambian mediante RPC", () => {
  assert.match(app, /from\("finance_import_batches"\)[\s\S]{0,180}ignoreDuplicates: true/);
});
