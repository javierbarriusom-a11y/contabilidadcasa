const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { codigoApp } = require("./helpers/codigo-app.cjs");
const L = require("../canonical-portfolio-ledger.js");

// XIN-02 · Vigía de la recompra (art. 33.5 f y g de la Ley del IRPF; Manual práctico de Renta 2025 de la AEAT). Una venta con
// pérdida no la integra si se compran valores homogéneos en los dos meses anteriores o posteriores (cotizados en mercados
// regulados de la UE) o en el año anterior o posterior (no cotizados, como los fondos, y lo que cotiza fuera de la UE). Las
// compras anteriores solo cuentan si siguen en cartera tras la venta (FIFO); sin limitación si en la ventana anterior hubo
// una sola compra y al empezarla no se tenía nada. La app avisa con la parte estimada y la fecha; la compensación no la
// descuenta. Cifras calculadas a mano.

const root = path.resolve(__dirname, "..");
const read = (name) => fs.readFileSync(path.join(root, name), "utf8");
const P = require("../canonical-portfolio.js");
const analiza = (raw) => L.repurchaseAnalysis(raw, L.snapshot(raw));

// 100 u compradas el 10/01/2025 por 2.000 € (20 €/u).
const pos = (type, contributions, disposals) => ({ id: "X", type, label: "X", provenance: "manual", asOf: "2026-10-26", acquisitionDate: "2025-01-10", quantity: 100, costBasis: 2000, currentValue: 0, contributions, disposals });
const venta = (date, quantitySold, saleProceeds, id = "s1") => ({ id, date, quantitySold, saleProceeds });
const compra = (date, quantity, amount, id) => ({ id, date, quantity, amount });

test("ventana por tipo: dos meses en acciones y ETF, un año en fondos; cripto, planes y «otro» no se evalúan", () => {
  assert.equal(L.repurchaseWindow("accion").months, 2);
  assert.equal(L.repurchaseWindow("etf").months, 2);
  assert.equal(L.repurchaseWindow("fondo").months, 12);
  for (const type of ["cripto", "plan-pension", "otro", "", undefined]) assert.equal(L.repurchaseWindow(type), null, String(type));
  assert.match(L.repurchaseWindow("accion").caveat, /un año si cotiza fuera de los mercados regulados de la UE/);
});

test("desde cuándo se puede recomprar: el día siguiente al fin de la ventana (fin de mes incluido)", () => {
  assert.equal(L.repurchaseFreeFrom("accion", "2026-10-26"), "2026-12-27");
  assert.equal(L.repurchaseFreeFrom("etf", "2026-12-31"), "2027-03-01", "31/12 + 2 meses = 28/02; se puede desde el 1/3");
  assert.equal(L.repurchaseFreeFrom("fondo", "2026-10-26"), "2027-10-27");
  assert.equal(L.repurchaseFreeFrom("cripto", "2026-10-26"), null);
  assert.equal(L.repurchaseFreeFrom("accion", "2026-02-30"), null);
});

test("compra posterior dentro de plazo: difiere la parte recomprada (100 u vendidas con 500 € de pérdida, 30 recompradas → 150 €)", () => {
  const raw = pos("accion", [compra("2026-11-20", 30, 400, "c1")], [venta("2026-10-01", 100, 1500)]);
  const [item] = analiza(raw);
  assert.deepEqual([item.loss, item.priorUnits, item.laterUnits, item.repurchasedUnits, item.deferredLoss, item.freeFrom], [-500, 0, 30, 30, -150, "2026-12-02"]);
  const texto = L.warnings(raw, L.snapshot(raw)).find((w) => w.code === "repurchase-risk").text;
  assert.match(texto, /^La venta del 01\/10\/2026 tiene pérdida, pero en los dos meses anteriores o posteriores \(un año si cotiza fuera/);
  assert.match(texto, /30 unidades después\. Unos 150 € de esa pérdida no se integran ese año/);
  assert.match(texto, /Se integrará cuando vendas lo recomprado\. Para no diferirla, había que esperar a recomprar hasta el 02\/12\/2026\./);
  assert.equal(analiza(pos("accion", [compra("2026-12-02", 30, 400, "c1")], [venta("2026-10-01", 100, 1500)])).length, 0, "el 02/12 ya está fuera");
});

test("compra anterior: solo cuenta si sigue en cartera tras la venta (FIFO vende primero lo más antiguo)", () => {
  // Compra de 30 u el 01/09/2026; venta de 100 u el 01/10: el FIFO vende las 100 del lote de 2025 y las 30 siguen → difieren 30/100.
  const sigue = analiza(pos("accion", [compra("2026-09-01", 30, 450, "c1")], [venta("2026-10-01", 100, 1500)]));
  assert.deepEqual([sigue[0].priorUnits, sigue[0].deferredLoss, sigue[0].heldAtEnd], [30, -150, 30]);
  // Venta de 130 u: se van también las 30 recientes → nada sigue en cartera, nada se difiere.
  const vendida = analiza(pos("accion", [compra("2026-09-01", 30, 450, "c1")], [venta("2026-10-01", 130, 1500)]));
  assert.equal(vendida.length, 0);
  // Fuera de la ventana (01/07, más de dos meses antes): no cuenta.
  assert.equal(analiza(pos("accion", [compra("2026-07-01", 30, 450, "c1")], [venta("2026-10-01", 100, 1500)])).length, 0);
  // En un fondo la ventana es de un año: la del 01/07 sí cuenta.
  assert.equal(analiza(pos("fondo", [compra("2026-07-01", 30, 450, "c1")], [venta("2026-10-01", 100, 1500)]))[0].priorUnits, 30);
});

test("excepción: una sola compra en la ventana anterior y nada en cartera al empezarla → sin limitación", () => {
  // Nada hasta el 01/09/2026 (compra inicial ese día), venta parcial con pérdida el 01/10: lo vendido es lo comprado.
  const raw = { ...pos("accion", [], [venta("2026-10-01", 50, 500)]), acquisitionDate: "2026-09-01" };
  assert.equal(L.snapshot(raw).disposals[0].realizedGain, -500);
  assert.equal(analiza(raw).length, 0);
  // Con dos compras en la ventana, la excepción ya no vale.
  const dos = { ...pos("accion", [compra("2026-09-15", 20, 400, "c1")], [venta("2026-10-01", 50, 500)]), acquisitionDate: "2026-09-01" };
  assert.equal(analiza(dos).length, 1);
});

test("sin pérdida, sin lotes o tipo sin norma: no hay aviso; vendido todo, la pérdida se integra el año de la última venta", () => {
  assert.equal(analiza(pos("accion", [compra("2026-11-20", 30, 400, "c1")], [venta("2026-10-01", 100, 2500)])).length, 0, "con plusvalía");
  assert.equal(analiza(pos("cripto", [compra("2026-11-20", 30, 400, "c1")], [venta("2026-10-01", 100, 1500)])).length, 0, "cripto");
  const todo = pos("accion", [compra("2026-11-20", 30, 400, "c1")], [venta("2026-10-01", 100, 1500), venta("2027-02-01", 30, 450, "s2")]);
  const [item] = analiza(todo);
  assert.equal(item.heldAtEnd, 0);
  assert.match(L.repurchaseText(item), /Como ya no te queda ninguna, se integra en el año de la última venta \(01\/02\/2027\)\./);
});

test("en pantalla: la fila de la venta lo marca, el libro lo explica, y las candidatas y la campaña dan la fecha", () => {
  const ops = read("operaciones-ui.js");
  assert.match(ops, /diferidos por recompra<\/span>/);
  assert.match(ops, /<ul class="ops-avisos" aria-label="Norma de recompra">/);
  assert.match(ops, /function inv6RepurchaseNote\(item\) \{\n  const from = globalThis\.FinanceCanonicalPortfolioLedger\?\.repurchaseFreeFrom\?\.\(item\.type, isoLocalDate\(new Date\(\)\)\);/);
  assert.match(codigoApp(), /\$\{escapeHtml\(item\.label\)\}\$\{globalThis\.inv6RepurchaseNote\?\.\(item\) \|\| ""\}<\/span>/);
  const campana = read("fiscal-campana-ui.js");
  assert.match(campana, /realizar \$\{amount\(result\.amount\)\} ahorra \$\{amount\(result\.savingEur\)\} \(a \$\{result\.ratePct\} %\)\.\$\{fiscalCampaignRepurchase\(\)\}/);
  assert.match(campana, /Si vendes hoy, no recompres lo mismo antes del/);
  assert.ok(P.normalizePositions, "el motor de cartera sigue siendo el del FIFO");
});
