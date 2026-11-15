const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

// Deuda › Contratos · «Detectadas en vuestros recibos» (15/11/2026, «hazlo tú por mí directamente»). Recibos INVENTADOS: dos
// financieras con su referencia, un pago aplazado, una liquidación de tarjeta que se paga entera, un recibo que terminó y un gasto.

const root = path.resolve(__dirname, "..");
const R = require("../canonical-debt-receipts.js");
const MESES = ["2026-06", "2026-07", "2026-08", "2026-09", "2026-10", "2026-11"];

function recibos() {
  const mv = [];
  MESES.forEach((m, i) => {
    mv.push({ date: `${m}-08`, amount: -150, label: "ECITC0000000000", details: "A00000000000", category: "Creditos antiguos" });
    mv.push({ date: `${m}-09`, amount: -95, label: "ECITC0000000000", details: "B00000000000", category: "Creditos antiguos" });
    mv.push({ date: `${m}-05`, amount: -(i < 3 ? 600 : 330), label: "SERV.FINANCIER", details: "RECIBO ENTIDAD DE FINANCIACION", category: "Creditos antiguos" });
    mv.push({ date: `${m}-28`, amount: -900, label: "Financie-octubre", category: "Creditos antiguos" });
    mv.push({ date: `${m}-12`, amount: -60, label: "COMPRA SUPER", category: "Alimentacion" });
  });
  mv.push({ date: "2026-04-02", amount: -80, label: "BANKINTER CONS", category: "Creditos antiguos" });
  return mv;
}

test("agrupa por entidad y contrato, con nombre legible, cuota de ahora y último recibo; la tarjeta que se paga entera no es un crédito", () => {
  const r = R.detect(recibos(), { today: "2026-11-15" });
  const nombres = r.debts.map((d) => `${d.entity}|${d.reference}`);
  assert.deepEqual(nombres.sort(), ["Bankinter Consumer Finance|", "Financiera El Corte Inglés|a00000000000", "Financiera El Corte Inglés|b00000000000", "Servicios financieros (pago aplazado)|"].sort());
  const aplazado = r.debts.find((d) => d.type === "Pago aplazado");
  assert.equal(aplazado.payment, 330, "la cuota de ahora es la de los últimos meses, no la media de todo");
  assert.equal(aplazado.lastDate, "2026-11-05");
  assert.equal(aplazado.months, 6);
  assert.ok(!r.debts.some((d) => /^financie-/i.test(d.sourceLabel)), "«Financie-<mes>» es la tarjeta, no un crédito");
  assert.ok(!r.debts.some((d) => /super/i.test(d.sourceLabel)));
});

test("viva = recibo este mes o el anterior; las vivas primero y por cuota", () => {
  const r = R.detect(recibos(), { today: "2026-11-15" });
  const bankinter = r.debts.find((d) => d.entity.startsWith("Bankinter"));
  assert.equal(bankinter.active, false);
  assert.equal(r.debts.at(-1), bankinter);
  assert.equal(r.debts[0].type, "Pago aplazado");
  assert.equal(r.activeMonthly, 575);
  assert.equal(r.pending, 3);
});

test("ya dada de alta: por la referencia del contrato (una entidad puede tener varios) o por la marca del alta desde recibos", () => {
  const sinRef = R.detect(recibos(), { today: "2026-11-15" }).debts.find((d) => d.type === "Pago aplazado");
  const r = R.detect(recibos(), { today: "2026-11-15", contracts: [{ entity: "Financiera El Corte Inglés", number: "A00000000000" }, { entity: "Otra", receiptKey: sinRef.key }] });
  assert.equal(r.debts.find((d) => d.reference === "a00000000000").registered, true);
  assert.equal(r.debts.find((d) => d.reference === "b00000000000").registered, false, "la otra financiación de la misma entidad sigue pendiente");
  assert.equal(r.debts.find((d) => d.type === "Pago aplazado").registered, true);
  assert.equal(r.pending, 1);
  assert.equal(r.pendingMonthly, 95);
});

test("con partida manda la partida: en Financiaciones cuenta aunque la categoría diga otra cosa; en otra partida, no", () => {
  const mv = [
    { date: "2026-11-03", amount: -200, label: "PRESTAMO COCHE EJEMPLO", category: "Otros gastos", block: "financiacion" },
    { date: "2026-11-04", amount: -70, label: "CAIXABANK PAYMENTS", category: "Creditos antiguos", block: "otro" },
  ];
  const r = R.detect(mv, { today: "2026-11-15" });
  assert.deepEqual(r.debts.map((d) => d.entity), ["PRESTAMO COCHE EJEMPLO"]);
  assert.equal(r.debts[0].recognised, false);
});

test("sin movimientos, nada (y no revienta)", () => {
  assert.deepEqual(R.detect([], { today: "2026-11-15" }).debts, []);
  assert.deepEqual(R.detect(undefined).debts, []);
});

test("cableado: el motor carga en la app y Deuda › Contratos lo usa; el alta pide el capital y guarda de dónde sale", () => {
  const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
  const deuda = fs.readFileSync(path.join(root, "views/deuda.js"), "utf8");
  assert.match(html, /<script defer src="canonical-debt-receipts\.js\?v=/);
  assert.match(html, /id="deudaContratosDetectados"/);
  assert.match(deuda, /FinanceCanonicalDebtReceipts/);
  assert.match(deuda, /Falta el capital pendiente/);
  assert.match(deuda, /provenance: "receipts"/);
});
