const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");

const appSource = fs.readFileSync(require.resolve("../app.js"), "utf8");
const indexSource = fs.readFileSync(require.resolve("../index.html"), "utf8");

// A19-2 (BACKLOG_PATRIMONIO_Y_FINANZAS.md, depende de A14-2/A14-3): "capacidad de pago, patrimonio
// neto (si existe E21), calendario de deuda y colchón, con fecha y advertencia de que es un resumen
// propio, no una certificación bancaria". Reutiliza el escritor de PDF sin librería externa ya
// construido (P2Export.downloadPlainPdf, OPT-3/V6-4) y las mismas fuentes de datos que ya usa el
// resto de la app — ningún motor nuevo.

test("A19-2: la tarjeta del informe certificado vive en Ajustes con su botón", () => {
  assert.match(indexSource, /id="a19CertifiedReportDownload"/);
  const cardStart = indexSource.indexOf("Informe PDF certificado");
  assert.ok(cardStart >= 0, "Falta el título exacto de la tarjeta A19-2");
  const card = indexSource.slice(cardStart, cardStart + 700);
  assert.match(card, /no es una certificación bancaria ni un documento oficial/);
});

test("A19-2: a19CertifiedReportLines incluye las cuatro piezas exigidas por el backlog, con fecha", () => {
  const block = appSource.slice(appSource.indexOf("function a19CertifiedReportLines("), appSource.indexOf("function downloadA19CertifiedReport("));
  assert.match(block, /generatedAt\.slice\(0, 10\)/);
  assert.match(block, /CAPACIDAD DE PAGO/);
  assert.match(block, /monthlyFreeCapacity\(lastSimulation\)/);
  assert.match(block, /PATRIMONIO NETO/);
  assert.match(block, /CALENDARIO DE DEUDA/);
  assert.match(block, /COLCHÓN DE EMERGENCIA/);
});

test("A19-2: el patrimonio neto reutiliza FinanceCanonicalAssets (A14-1) y totalDebtOutstanding, sin motor propio", () => {
  const block = appSource.slice(appSource.indexOf("function a19CertifiedReportLines("), appSource.indexOf("function downloadA19CertifiedReport("));
  assert.match(block, /window\.FinanceCanonicalAssets/);
  assert.match(block, /assetsEngine\.normalizeAssets\(declaredAssets\)\.summary\.netWorth/);
  assert.match(block, /totalDebtOutstanding\(\)/);
});

test("A19-2: sin activos declarados, dice explícitamente que el patrimonio neto no es calculable — nunca inventa una cifra", () => {
  const block = appSource.slice(appSource.indexOf("function a19CertifiedReportLines("), appSource.indexOf("function downloadA19CertifiedReport("));
  assert.match(block, /Sin activos declarados.*patrimonio neto no calculable/);
});

test("A19-2: el calendario de deuda reutiliza p2DebtRows, solo la deuda con principal pendiente", () => {
  const block = appSource.slice(appSource.indexOf("function a19CertifiedReportLines("), appSource.indexOf("function downloadA19CertifiedReport("));
  assert.match(block, /p2DebtRows\(\)\.filter\(\(debt\) => debt\.currentPrincipal > 0\)/);
});

test("A19-2: el colchón reutiliza accountBalancesFromState/cushionFloor, mismas fuentes que AP3/AP6", () => {
  const block = appSource.slice(appSource.indexOf("function a19CertifiedReportLines("), appSource.indexOf("function downloadA19CertifiedReport("));
  assert.match(block, /accountBalancesFromState\(\)/);
  assert.match(block, /cushionEngine\.cushionFloor\(lastSimulation, cuadroMandosReserve\(\)\)/);
});

test("A19-2: el documento avisa explícitamente de que no es una certificación bancaria, dos veces: cabecera y pie", () => {
  const block = appSource.slice(appSource.indexOf("function a19CertifiedReportLines("), appSource.indexOf("function downloadA19CertifiedReport("));
  assert.match(block, /NO ES UNA CERTIFICACIÓN BANCARIA/);
  assert.match(block, /No constituye una certificación bancaria ni un documento oficial/);
});

test("A19-2: downloadA19CertifiedReport reutiliza P2Export.downloadPlainPdf, el escritor de PDF sin librería externa", () => {
  const block = appSource.slice(appSource.indexOf("function downloadA19CertifiedReport("), appSource.indexOf("function downloadA19CertifiedReport(") + 400);
  assert.match(block, /window\.P2Export\.downloadPlainPdf\(a19CertifiedReportLines\(\), `informe-certificado-\$\{today\}\.pdf`\)/);
});

test("A19-2: el botón está cableado", () => {
  assert.match(appSource, /qs\("a19CertifiedReportDownload"\)\?\.addEventListener\("click", downloadA19CertifiedReport\);/);
});

test("p2-export.js (escritor de PDF de OPT-3/V6-4) sigue cargado antes que app.js y en la whitelist del sitio público", () => {
  const exportScript = indexSource.indexOf("p2-export.js");
  const appScript = indexSource.indexOf("app.js?v=");
  assert.ok(exportScript >= 0 && exportScript < appScript);
  const buildScript = fs.readFileSync(require.resolve("../tools/build-public-site.mjs"), "utf8");
  assert.match(buildScript, /"p2-export\.js"/);
});
