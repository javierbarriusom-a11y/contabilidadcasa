// TRE-D5b (D-N44, «ok, adelante» del hogar el 26/11/2026): lo que no eran ofertas sale de Deuda › Ofertas a su sitio, sin perder nada.
// La escalera del próximo euro (con «Dinero parado») a Deuda › Plan, «Repartir la nómina» a Plan › Mes y la capacidad a Contratos.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const read = (f) => fs.readFileSync(path.join(__dirname, "..", f), "utf8");
const Contratos = require("../views/deuda-contratos-v2.js");
const Plan = require("../views/deuda-plan-v2.js");

const html = read("index.html");
const tramo = (desde, hasta) => html.slice(html.indexOf(desde), html.indexOf(hasta));

test("TRE-D5b · cada pieza en su sitio y ninguna en Ofertas", () => {
  const ofertas = tramo('id="deuda-comparar"', 'id="deuda-ruta"');
  const plan = tramo('id="deuda-ruta"', 'id="deuda-prestamo"');
  const mes = tramo('data-plan-panel="mes"', 'data-plan-panel="prevision"');
  const contratos = tramo('id="deuda-contratos"', 'id="deudaContratosTable"');
  for (const id of ["proxEuroCard", "proxEuroParado", "nominaCard", "deudaCompararCapacity", "deudaContratosCapacity"]) assert.ok(!ofertas.includes(`id="${id}"`), `${id} ya no está en Ofertas`);
  assert.ok(plan.includes('id="proxEuroCard"') && plan.includes('id="proxEuroParado"'), "la escalera y el dinero parado, en Deuda › Plan");
  assert.ok(plan.indexOf('id="planOptimoCard"') < plan.indexOf('id="proxEuroCard"'), "debajo del plan óptimo, que lleva a ella");
  assert.ok(mes.includes('id="nominaCard"'), "la nómina, en Plan › Mes");
  assert.ok(contratos.includes('id="deudaContratosCapacity"'), "la capacidad, en la cabecera de Contratos");
  assert.match(html, /<dialog class="dpv2-ajustar dpv2-comparar dpv2-euro" id="deudaPlanV2Euro" aria-labelledby="dpv2EuroTitulo"><\/dialog>/);
});

test("TRE-D5b · las rutas pintan cada pieza donde está ahora", () => {
  const app = read("app.js");
  assert.match(app, /case "deuda-ruta":\s*renderDeudaRuta\(\);\s*globalThis\.renderProximoEuro\?\./);
  assert.match(app, /case "plan":\s*renderPlan\(\);\s*globalThis\.renderNominaReparto\?\./);
  assert.match(app, /case "deuda-comparar":\s*renderDeudaComparar\(\);\s*break;/);
});

test("TRE-D5b · Deuda › Plan nuevo: un acceso a la escalera que la trae a su panel y la devuelve", () => {
  // Los contratos y el plan FICTICIOS de la prueba de TRE-D1.
  const contratos = [
    { id: "t", currentPrincipal: 2400, currentPayment: 90, apr: 21.9, paymentStatus: "active" },
    { id: "p", currentPrincipal: 5100, currentPayment: 160, apr: 9.5, paymentStatus: "active" },
  ];
  const plan = {
    ok: true,
    startMonthKey: "2026-11",
    baseline: { debtFreeMonthKey: "2029-11", totalInterest: 1719.23 },
    recommended: {
      strategy: "avalancha",
      summary: { debtFreeMonthKey: "2027-09", monthsSaved: 26, interestSaved: 1398.06, totalInterest: 321.17, commissionCost: 0 },
      periods: [
        { fromIndex: 0, toIndex: 1, targetId: "t", targetLabel: "Banco FICTICIO Tarjeta", extra: 270, pools: [270, 300] },
        { fromIndex: 2, toIndex: 10, targetId: "p", targetLabel: "Caja FICTICIA Préstamo", extra: 360 },
      ],
      result: { ok: true, included: [
        { id: "p", label: "Caja FICTICIA Préstamo", aprPct: 9.5, payoffMonthKey: "2027-09" },
        { id: "t", label: "Banco FICTICIO Tarjeta", aprPct: 21.9, payoffMonthKey: "2026-12" },
      ] },
    },
  };
  const vista = Plan.html(Plan.modelo({ outlook: { libreDeDeuda: "2027-09", fuente: "plan-optimo", settled: false }, plan, contratos, finBase: new Map([["t", "2029-11"], ["p", "2029-11"]]), hoy: "2026-11-25" }));
  // Entre «Comparar con otras formas» y «Cerrar las deudas saldadas».
  assert.ok(vista.indexOf('data-dpv2="comparar"') < vista.indexOf('data-dpv2="euro"') && vista.indexOf('data-dpv2="euro"') < vista.indexOf('data-dpv2="cerrar"'));
  assert.match(vista, /data-dpv2="euro"><span><strong>¿Dónde va el próximo euro\?<\/strong>/);
  const chrome = Plan.euroChromeHtml();
  assert.match(chrome, /<h2 id="dpv2EuroTitulo">¿Dónde va el próximo euro\?<\/h2>/);
  assert.match(chrome, /data-dpv2-euro-hueco/);
  assert.match(chrome, /no mueve dinero/);
  const fuente = read("views/deuda-plan-v2.js");
  assert.match(fuente, /tarjeta\.before\(marca\);\s*hueco\.append\(tarjeta\)/, "la misma tarjeta, no una copia");
  assert.match(fuente, /euroPrestado\.hueco\.replaceWith\(euroPrestado\.nodo\)/, "y vuelve a su sitio al cerrar");
});

test("TRE-D5b · la capacidad en una línea: el mismo cálculo, su umbral, su margen y los avales", () => {
  const base = { ratio: 0.234, income: 3000, debtPayment: 700, dangerAt: 0.32, marginEuros: 260, guaranteeImpact: null };
  const aviso = Contratos.capacidadFrase({ ...base, status: "warn" });
  assert.equal(aviso.tono, "warn");
  assert.equal(aviso.texto, "Capacidad: las cuotas son el 23,4 % del ingreso previsto (umbral 32 %) · margen de 260 € al mes.");
  assert.match(Contratos.capacidadFrase({ ...base, ratio: 0.4, status: "danger", marginEuros: 0 }).texto, /sin margen para más cuota\.$/);
  assert.match(Contratos.capacidadFrase({ ...base, status: "good", guaranteeImpact: { guaranteedMonthlyTotal: 200, remainingMargin: 60, exceedsCapacity: false } }).texto, /margen de 60 € al mes, ya descontados los avales\.$/);
  assert.match(Contratos.capacidadFrase({ ...base, status: "warn", guaranteeImpact: { guaranteedMonthlyTotal: 400, remainingMargin: -140, exceedsCapacity: true } }).texto, /los avales consumen todo el margen\.$/);
  assert.equal(Contratos.capacidadFrase({ ...base, income: 0 }), null, "sin ingreso previsto, nada que decir");
  assert.equal(Contratos.capacidadFrase(null), null);
});

test("TRE-D5b · los caminos de siempre llegan a la escalera: el plan óptimo, Plan › Mes y la nómina", () => {
  assert.match(read("camino-deuda-ui.js"), /data-plan-optimo-ir-escalera/);
  assert.match(read("views/plan-v2.js"), /data-plan-v2-nav="deuda-ruta" data-plan-v2-euro>Ver adónde va el próximo euro/);
  assert.match(read("views/plan-v2.js"), /hasAttribute\("data-plan-v2-euro"\)\) globalThis\.pedirDeudaProxEuro\?\.\(\)/);
  const nomina = read("nomina-ui.js");
  assert.match(nomina, /data-nom-action="escalera">«¿Dónde va el próximo euro\?», en Deuda › Plan<\/button>/);
  assert.match(nomina, /action === "escalera"\) \{ globalThis\.pedirDeudaProxEuro\?\.\(\); window\.location\.hash = "deuda-ruta"/);
  assert.ok(!/arriba\.<\/p>/.test(nomina), "la nómina ya no dice que la escalera está «arriba»");
});
