const test = require("node:test");
const assert = require("node:assert/strict");

const Portfolio = require("../canonical-portfolio.js");
const E15 = require("../canonical-e15-goals.js");

// IV3 (BACKLOG_ULTIMATE_SEPTIEMBRE.md bloque 8): aportaciones futuras ya decididas pero todavía
// no ejecutadas — solo fecha, importe y una nota opcional. A diferencia de las aportaciones de IV2,
// nunca suman al coste ni entran en la XIRR o el FIFO de FC1: son un plan, no un movimiento real.
// Su único destino es el calendario financiero (A10-2), igual que ya hacen los vencimientos de
// pólizas (SP1) o la Campaña de la Renta (A15-3).

test("normalizePosition · una aportación programada no toca costBasis, quantity, cashFlows ni XIRR", () => {
  const withoutScheduled = Portfolio.normalizePosition({
    id: "p1", label: "Fondo A", type: "fondo", quantity: 10, costBasis: 1000, currentValue: 1100, acquisitionDate: "2026-01-01",
  });
  const withScheduled = Portfolio.normalizePosition({
    id: "p1", label: "Fondo A", type: "fondo", quantity: 10, costBasis: 1000, currentValue: 1100, acquisitionDate: "2026-01-01",
    scheduledContributions: [{ date: "2026-12-01", amount: 500, note: "paga extra" }],
  });
  assert.equal(withScheduled.costBasis, withoutScheduled.costBasis);
  assert.equal(withScheduled.quantity, withoutScheduled.quantity);
  assert.deepEqual(withScheduled.cashFlows, withoutScheduled.cashFlows);
  assert.equal(withScheduled.xirr.ratePct, withoutScheduled.xirr.ratePct);
});

test("normalizePosition · sin scheduledContributions, la lista queda vacía (retrocompatible con IV1/IV2/FC1)", () => {
  const position = Portfolio.normalizePosition({ id: "p1", label: "Fondo A", type: "fondo", quantity: 10, costBasis: 1000, currentValue: 1100 });
  assert.deepEqual(position.scheduledContributions, []);
});

test("normalizeScheduledContributions · descarta filas sin fecha o sin importe positivo, y ordena por fecha", () => {
  const position = Portfolio.normalizePosition({
    id: "p1", label: "Fondo A", type: "fondo", quantity: 10, costBasis: 1000, currentValue: 1100,
    scheduledContributions: [
      { date: "2027-03-01", amount: 200, note: "b" },
      { date: "", amount: 300, note: "sin fecha, se descarta" },
      { date: "2026-06-01", amount: 0, note: "sin importe, se descarta" },
      { date: "2026-06-01", amount: 100, note: "a" },
    ],
  });
  assert.equal(position.scheduledContributions.length, 2);
  assert.equal(position.scheduledContributions[0].note, "a");
  assert.equal(position.scheduledContributions[1].note, "b");
});

test("applyFundTransfer · conserva las aportaciones programadas de la posición traspasada", () => {
  const source = Portfolio.normalizePosition({
    id: "p1", label: "Fondo A", type: "fondo", quantity: 10, costBasis: 1000, currentValue: 1100,
    scheduledContributions: [{ date: "2026-12-01", amount: 500, note: "paga extra" }],
  });
  const transferred = Portfolio.applyFundTransfer(source, { type: "fondo", label: "Fondo B", quantity: 10, currentValue: 1100 });
  assert.equal(transferred.scheduledContributions.length, 1);
  assert.equal(transferred.scheduledContributions[0].note, "paga extra");
});

test("financialCalendar (E15/A10-2) · una aportación programada aparece como evento en su mes, con importe declarado", () => {
  const calendar = E15.financialCalendar({
    forecast: { series: [{ monthKey: "2026-12", label: "Diciembre 2026", totals: { closingLiquidity: 5000 } }] },
    investmentContributions: [{ date: "2026-12-15", amount: 500, label: "Fondo A · paga extra" }],
  });
  const row = calendar.rows.find((item) => item.monthKey === "2026-12");
  const event = row.events.find((item) => item.type === "investment-contribution");
  assert.ok(event, "debe existir un evento de tipo investment-contribution");
  assert.equal(event.amount, 500);
  assert.match(event.label, /Fondo A · paga extra/);
  assert.equal(event.source, "cartera de inversión (IV3)");
  assert.notEqual(event.uncertain, true, "el importe está declarado, no es incierto");
});

test("financialCalendar · sin investmentContributions, ningún mes lleva ese evento (retrocompatible)", () => {
  const calendar = E15.financialCalendar({
    forecast: { series: [{ monthKey: "2026-12", label: "Diciembre 2026", totals: { closingLiquidity: 5000 } }] },
  });
  const row = calendar.rows.find((item) => item.monthKey === "2026-12");
  assert.equal(row.events.some((item) => item.type === "investment-contribution"), false);
});

test("financialCalendar · una aportación programada fuera del rango de meses del forecast no aparece en ningún evento", () => {
  const calendar = E15.financialCalendar({
    forecast: { series: [{ monthKey: "2026-12", label: "Diciembre 2026", totals: { closingLiquidity: 5000 } }] },
    investmentContributions: [{ date: "2027-01-15", amount: 500, label: "Fondo A" }],
  });
  const all = calendar.rows.flatMap((row) => row.events);
  assert.equal(all.some((item) => item.type === "investment-contribution"), false);
});
