const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const app = fs.readFileSync(path.join(root, "app.js"), "utf8");
const p2ui = fs.readFileSync(path.join(root, "p2-ui.js"), "utf8");

// Repaso pixel-perfect del 20 de agosto de 2026 (sesión «pantalla por pantalla», continuación de
// Hoy y Registrar). Comparado el build local contra `Movimientos.pdf`, tres hallazgos consultados
// con el usuario antes de tocar nada:
//
// 1. Cabecera genérica duplicada — mismo patrón que Hoy/Registrar, mismo arreglo.
// 2. «Cargar movimientos desde Excel»: usaba loadTransactionsFromWorkbook, la misma función que ya
//    llama Registrar › Importar extracto (R-8) sobre el mismo baseData.transactions, pero sin su
//    clasificación sugerida, revisión de duplicados ni impacto antes de confirmar — una segunda
//    puerta de escritura real. El usuario pidió retirarla, solo lectura, mismo patrón que R-11 dio
//    a #registrar-mes y #visual-detail.
// 3. El título antiguo «Base del modelo» y la tarjeta P2 «Comportamiento conciliado / Tendencias y
//    anomalías reales» (montada por p2-ui.js, no por index.html/app.js) no están en el mockup — el
//    usuario pidió quitar ambos.
// 4. «Saldo declarado y su cuadre» (M-8c) era una tabla con CaixaBank y Mediolanum; el mockup pinta
//    una única insignia en línea, junto a los chips, solo de CaixaBank (la misma cuenta de la que
//    ya es la columna Saldo de la tabla). El usuario pidió convertirla en insignia.

// La condición gana vistas con el tiempo — se comprueba por subcadena, no por línea exacta, para
// no romperse cada vez que se añade una más (ver también tests/r1-r4-registrar.test.cjs).
test("Cabecera genérica: #viewEyebrow/#viewTitle/#e17ViewGuide se ocultan también en Movimientos, igual que en Hoy y Registrar", () => {
  const hasOwnHeaderLine = app.match(/const hasOwnHeader = ([^;]+);/)?.[1] || "";
  assert.match(hasOwnHeaderLine, /viewId === "movements"/);
  const guideCondition = app.match(/function renderE17ViewGuide[\s\S]{0,1200}?if \(([^)]+)\) \{\s*target\.hidden = true;/)?.[1] || "";
  assert.match(guideCondition, /viewId === "movements"/);
});

test("viewTitles.movements ya no repite el texto heredado «Base del modelo»", () => {
  assert.doesNotMatch(app, /eyebrow: "Base del modelo"/);
  const match = app.match(/movements: \{\s*eyebrow: "([^"]+)",\s*title: "([^"]+)",/);
  assert.ok(match, "viewTitles.movements existe");
  assert.equal(match[1], "Movimientos");
  assert.notEqual(match[2], "Movimientos", "el título global no repite literalmente el título propio de la sección");
});

test("#movements trae su propio título «Movimientos» y subtítulo, con el botón Guía de este flujo", () => {
  const start = html.indexOf('id="movements"');
  const end = html.indexOf("movement-import-card", start);
  const header = html.slice(start, end);
  assert.doesNotMatch(header, /Base del modelo/);
  assert.doesNotMatch(header, /Movimientos recientes clasificados/);
  assert.match(header, /<h2 class="e19-heading">Movimientos<\/h2>/);
  assert.match(header, /El extracto clasificado, consultable por sí mismo/);
  assert.match(header, /data-e17-open="guide">Guía de este flujo<\/button>/);
});

test("La tarjeta «Cargar movimientos desde Excel» queda de solo lectura, con enlace a Registrar › Importar extracto", () => {
  const start = html.indexOf('id="movementImportLegacyCard"');
  assert.ok(start >= 0, "la tarjeta sigue en el DOM, no se borra");
  const card = html.slice(start, html.indexOf("merchant-list", start));
  assert.match(card, /Solo lectura: importa extractos desde/);
  assert.match(card, /data-home-nav="datos-importar">Registrar › Importar extracto<\/button>/);
  assert.match(card, /<input id="movementExcelFile" type="file" accept="\.xlsx,\.xls" disabled \/>/);
});

test("handleMovementExcelImport queda inerte tras MOVEMENTS_EXCEL_IMPORT_LEGACY_READONLY, mismo patrón que R-11", () => {
  assert.match(app, /const MOVEMENTS_EXCEL_IMPORT_LEGACY_READONLY = true;/);
  assert.match(app, /async function handleMovementExcelImport\(event\) \{\s*if \(MOVEMENTS_EXCEL_IMPORT_LEGACY_READONLY\) return;/);
});

test("El panel «Diccionario activo» (parte de la tarjeta retirada) no se pinta con la tarjeta inerte", () => {
  assert.match(
    app,
    /function renderMovementImportReview\(\) \{\s*const panel = qs\("movementMappingReview"\);\s*if \(!panel\) return;\s*[\s\S]{0,500}?if \(MOVEMENTS_EXCEL_IMPORT_LEGACY_READONLY\) \{\s*panel\.hidden = true;\s*panel\.innerHTML = "";\s*return;\s*\}/,
  );
});

test("El enlace «Registrar › Importar extracto» funciona: #movements tiene su propio manejador de data-home-nav", () => {
  assert.match(
    app,
    /qs\("movements"\)\?\.addEventListener\("click", \(event\) => \{\s*const button = event\.target\.closest\("\[data-home-nav\]"\);\s*const target = button\?\.dataset\.homeNav;\s*if \(!homeNavTargetIsValid\(target\)\) return;/,
  );
});

test("El título antiguo «Base del modelo» desaparece del todo de index.html", () => {
  assert.doesNotMatch(html, /Base del modelo/);
  assert.doesNotMatch(html, /Movimientos recientes clasificados/);
  assert.doesNotMatch(html, /Top gastos no crediticios usados para estimar la base mensual/);
});

test("p2-ui.js ya no monta «Comportamiento conciliado» en Movimientos (renderBehavior sigue definida, solo deja de llamarse ahí)", () => {
  assert.doesNotMatch(p2ui, /if \(viewId === "movements"\) renderBehavior\(\);/);
  assert.match(p2ui, /function renderBehavior\(\)/, "la función no se borra, solo deja de montarse en Movimientos");
});

test("M-8c: la insignia de cuadre es solo de CaixaBank, no una tabla con Mediolanum", () => {
  const source = app.slice(app.indexOf("function renderMovementsReconciliation"), app.indexOf("function renderDetailedMovements"));
  assert.match(source, /find\(\(row\) => row\.id === "caixabank"\)/);
  assert.doesNotMatch(source, /<table/);
  assert.doesNotMatch(source, /Mediolanum/);
});

test("La insignia de cuadre, el aviso de sin clasificar y «Exportar la vista» comparten la misma fila, junto a los chips", () => {
  const start = html.indexOf('id="movementChips"');
  const end = html.indexOf('id="movementCount"', start);
  const row = html.slice(start, end);
  assert.match(row, /class="movements-signal-row"/);
  assert.match(row, /id="movementsReconciliation"/);
  assert.match(row, /id="movementsUnclassifiedBanner"/);
  assert.match(row, /id="movementsExportButton">Exportar la vista<\/button>/);
});
