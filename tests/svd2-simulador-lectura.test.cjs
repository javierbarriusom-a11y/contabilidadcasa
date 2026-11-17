// SVD-2 (17/11/2026, docs/SVD_DISENO.md): el modelo de lectura v2 del simulador visual de deuda. Contratos INVENTADOS.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const E14 = require("../canonical-e14-debt-adapter.js");

const html = fs.readFileSync(path.join(__dirname, "..", "debt-roadmap.html"), "utf8");
const puente = fs.readFileSync(path.join(__dirname, "..", "deuda-simulador-puente.js"), "utf8");

function forecast(meses) {
  return {
    schemaId: "finance-canonical-forecast/v1", fingerprint: "svd2", valid: true,
    series: Array.from({ length: meses }, (_, i) => ({ monthKey: `2027-${String((i % 12) + 1).padStart(2, "0")}`, totals: { income: 3000, outflowsBeforeSaving: 2000 + i * 10, closingLiquidity: 8000 } })),
  };
}

test("cada contrato llega con lo que dice Contratos; lo que no se sabe, null y no 0", () => {
  const modelo = E14.buildReadModel({
    contracts: [
      { id: "t", entity: "Banco FICTICIO", type: "Tarjeta", currentPrincipal: 2400, apr: 21.9, currentPayment: 90, remainingInstallments: 30, paymentStatus: "active", revolving: true },
      { id: "p", entity: "Caja FICTICIA", type: "Préstamo", currentPrincipal: 5100, apr: null, currentPayment: 0, paymentStatus: "suspended", paymentsSuspended: true, arrearsEstimated: 640, arrearsMonths: 4 },
    ],
    forecast: forecast(3), floor: 1500, generatedAt: "2026-11-17T00:00:00.000Z",
  });
  const [tarjeta, prestamo] = modelo.extraDebts;
  assert.equal(tarjeta.apr, 21.9);
  assert.equal(tarjeta.currentPayment, 90);
  assert.equal(tarjeta.remainingInstallments, 30);
  assert.equal(tarjeta.revolving, true);
  assert.equal(prestamo.apr, null, "una TAE por confirmar no es una TAE del 0 %");
  assert.equal(prestamo.paymentsSuspended, true);
  assert.equal(prestamo.arrearsEstimated, 640);
  assert.equal(prestamo.arrearsMonths, 4);
  assert.equal(modelo.floor, 1500);
  assert.equal(modelo.schemaId, "finance-e14-debt-roadmap-read-model/v2");
  assert.equal(modelo.version, 2);
});

test("la huella cambia si cambia algo que importa para simular, y solo entonces", () => {
  const base = { currentPrincipal: 2400, apr: 21.9, currentPayment: 90, remainingInstallments: 30, paymentStatus: "active", arrearsEstimated: null };
  const huella = E14.contractFingerprint(base);
  assert.equal(huella, "2400|21.9|90|30|active|-");
  assert.notEqual(E14.contractFingerprint({ ...base, apr: 19.5 }), huella);
  assert.notEqual(E14.contractFingerprint({ ...base, paymentStatus: "suspended" }), huella);
  assert.equal(E14.contractFingerprint({ ...base, entity: "Otro nombre" }), huella, "el nombre no cambia lo que se simula");
});

test("la capacidad llega mes a mes (los 12 primeros), además de la media de siempre", () => {
  const modelo = E14.buildReadModel({ contracts: [], forecast: forecast(18) });
  assert.equal(modelo.forecast.capacitySeries.length, 12);
  assert.deepEqual(modelo.forecast.capacitySeries[0], { monthKey: "2027-01", capacity: 1000 });
  assert.deepEqual(modelo.forecast.capacitySeries[11], { monthKey: "2027-12", capacity: 890 });
  assert.equal(typeof modelo.canonicalValues.monthly, "number", "la media sigue: los cálculos de antes no cambian");
});

test("el puente manda el suelo del hogar, y el simulador lo usa para avisar", () => {
  assert.match(puente, /floor: typeof agentCaixaFloor === "function" \? agentCaixaFloor\(\) : null,/);
  assert.match(html, /La reserva a preservar está por debajo del suelo del hogar\./);
  assert.match(html, /<p class="small" id="svdCapacidad" role="status" hidden><\/p>/);
});

test("en el simulador: datos del contrato de solo lectura, aviso de deriva con «Entendido» y etiquetas unidas a sus campos", () => {
  assert.match(html, /<p class="small" id="\$\{key\}_contrato"><\/p><div id="\$\{key\}_deriva"><\/div>/);
  assert.match(html, /Ha cambiado en Contratos desde que lo visteis aquí/);
  assert.match(html, /function svdEntendido\(key\)/);
  assert.match(html, /function svdEtiquetas\(root\)/);
  // Sin contratos de ejemplo, los textos de la negociación de septiembre («Entidad C») no se dicen.
  assert.match(html, /\$\{svdModoEjemplo\(\)\?' Entidad C se considera ya cancelada y queda fuera del flujo de pagos\.':''\}/);
});
