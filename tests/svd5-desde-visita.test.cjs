// SVD-5 (18/11/2026, «Desde vuestra última visita», decisión del hogar: «haz la 3»): lo que ha cambiado fuera del simulador desde
// la última vez que el hogar lo vio. Se recuerda en el estado del simulador, sin clave nueva. Contratos inventados.
const test = require("node:test");
const assert = require("node:assert/strict");
const Adapter = require("../canonical-e14-debt-adapter.js");

const base = [
  { id: "debt-custom-1", entity: "Banco FICTICIO", type: "Tarjeta", paymentStatus: "active", currentPrincipal: 2400, currentPayment: 90, apr: 21.9 },
  { id: "debt-custom-2", entity: "Caja FICTICIA", type: "Préstamo", paymentStatus: "active", currentPrincipal: 5100, currentPayment: 160, apr: 9.5 },
];

function model(contracts, roadmapState = {}, extra = {}) {
  return Adapter.buildReadModel({ contracts, roadmapState, today: "2026-11-18", ...extra });
}

test("SVD-5 · la primera vez no hay nada que decir: solo la foto de hoy", () => {
  const m = model(base);
  assert.deepEqual(m.desdeVisita, { since: "", items: [] });
  assert.equal(m.visitaActual.at, "2026-11-18");
  assert.deepEqual(Object.keys(m.visitaActual.contratos), ["debt-custom-1", "debt-custom-2"]);
});

test("SVD-5 · sin cambios, nada; con cambios, uno por línea y en palabras", () => {
  const foto = model(base).visitaActual;
  assert.deepEqual(model(base, { svdUltimaVisita: foto }).desdeVisita.items, []);
  const ahora = [
    { ...base[0], currentPrincipal: 2310.5, currentPayment: 95 },
    { id: "debt-custom-3", entity: "Otra FICTICIA", paymentStatus: "active", currentPrincipal: 800, currentPayment: 40 },
  ];
  const d = model(ahora, { svdUltimaVisita: { ...foto, at: "2026-11-10" } }).desdeVisita;
  assert.equal(d.since, "2026-11-10");
  assert.deepEqual(d.items.map((item) => [item.id, item.kind]), [
    ["debt-custom-1", "capital"], ["debt-custom-1", "cuota"], ["debt-custom-3", "nuevo"], ["debt-custom-2", "fuera"],
  ]);
  assert.match(d.items[0].text, /^Banco FICTICIO: el capital pendiente pasó de 2\.400 € a 2\.310,50 €/);
  assert.match(d.items[3].text, /Caja FICTICIA: ya no está entre las deudas por simular/);
});

test("SVD-5 · los acuerdos: aplicado, su pago fuera del plan y cumplido", () => {
  const foto = model(base).visitaActual;
  const conAcuerdo = [{ ...base[0], agreement: { status: "accepted", type: "settlement", settlementAmount: 1500, startMonth: "2026-12" } }, base[1]];
  const aplicado = model(conAcuerdo, { svdUltimaVisita: foto }, { agreementFollowUp: [{ id: "debt-custom-1", plan: "en-plan", estado: "pendiente" }] }).desdeVisita.items;
  assert.match(aplicado[0].text, /acuerdo aceptado y aplicado/);
  const fotoAplicado = model(conAcuerdo, {}, { agreementFollowUp: [{ id: "debt-custom-1", plan: "en-plan", estado: "pendiente" }] }).visitaActual;
  const sinPlan = model(conAcuerdo, { svdUltimaVisita: fotoAplicado }, { agreementFollowUp: [{ id: "debt-custom-1", plan: "sin-decision", estado: "pendiente" }] }).desdeVisita.items;
  assert.match(sinPlan[0].text, /el pago del acuerdo ya no está en el plan/);
  const cumplido = model(conAcuerdo, { svdUltimaVisita: fotoAplicado }, { agreementFollowUp: [{ id: "debt-custom-1", plan: "en-plan", estado: "cumplido" }] }).desdeVisita.items;
  assert.match(cumplido[0].text, /el pago del acuerdo ya sale en el extracto/);
});

test("SVD-5 · la foto se guarda en el estado operativo del simulador (sin clave nueva)", () => {
  assert.equal(Adapter.classifyField("svdUltimaVisita"), "operational");
  const fs = require("node:fs");
  const path = require("node:path");
  const html = fs.readFileSync(path.join(__dirname, "..", "debt-roadmap.html"), "utf8");
  assert.match(html, /svdUltimaVisita:state\.svdUltimaVisita\|\|null/);
  assert.match(html, /function svdDesdeVisitaEntendido\(\)/);
});

test("SVD-5 · al volver a la pestaña del simulador, sus datos se reenvían siempre (cambiar un contrato no sube la revisión de la vista)", () => {
  const fs = require("node:fs");
  const path = require("node:path");
  const puente = fs.readFileSync(path.join(__dirname, "..", "deuda-simulador-puente.js"), "utf8");
  assert.match(puente, /window\.addEventListener\("hashchange", \(\) => \{\n\s+if \(!String\(location\.hash \|\| ""\)\.startsWith\("#deuda-simulador"\)\) return;\n\s+sendDebtRoadmapState\(\);/);
});
