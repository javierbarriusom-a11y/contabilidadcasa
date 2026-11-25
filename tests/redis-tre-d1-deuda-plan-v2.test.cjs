// TRE-D1 (25/11/2026): Deuda › Plan con el diseño nuevo (views/deuda-plan-v2.js). Lo puro (modelo y pintado) con un plan FICTICIO con la
// forma del motor, y el cableado: contenedor, script, lista de publicación, service worker y estilos colgando de :root[data-tema="v2"].
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const raiz = path.join(__dirname, "..");
const V = require("../views/deuda-plan-v2.js");

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
const outlook = { libreDeDeuda: "2027-09", fuente: "plan-optimo", settled: false };
const finBase = new Map([["t", "2029-11"], ["p", "2029-11"]]);

test("TRE-D1 · la respuesta: la fecha única, lo que se ahorra y lo que queda", () => {
  const m = V.modelo({ outlook, plan, contratos, finBase, hoy: "2026-11-25" });
  assert.equal(m.vacio, false);
  assert.equal(m.hero.fecha, "septiembre de 2027");
  assert.equal(m.hero.etiqueta, "Con el plan, libres de deuda en");
  assert.match(m.hero.nota, /^26 meses antes que pagando solo las cuotas \(noviembre de 2029\)$/);
  assert.equal(m.hero.ahorro, 1398.06);
  assert.equal(m.hero.quedan, 7500);
  const guardado = V.modelo({ outlook: { ...outlook, libreDeDeuda: "2027-11", fuente: "plan-guardado" }, plan, contratos, finBase, hoy: "2026-11-25" });
  assert.equal(guardado.hero.etiqueta, "Con vuestro plan, libres de deuda en");
  assert.match(guardado.hero.nota, /con los saldos de hoy, septiembre de 2027/, "con plan guardado, la del plan de hoy es una comparación con nombre");
});

test("TRE-D1 · «Este mes»: cuotas más lo de más del primer tramo, a quién, y lo que viene después", () => {
  const m = V.modelo({ outlook, plan, contratos, finBase, hoy: "2026-11-25" });
  assert.equal(m.esteMes.cuotas, 250);
  assert.equal(m.esteMes.extra, 270);
  assert.equal(m.esteMes.total, 520);
  assert.equal(m.esteMes.destino.label, "Banco FICTICIO Tarjeta");
  assert.equal(m.esteMes.conPlan, false);
  assert.equal(m.esteMes.despues, "Desde enero de 2027, lo de más va a Caja FICTICIA Préstamo.");
  const html = V.html(m);
  assert.match(html, /data-dpv2="guardar"/, "sin plan guardado, «Este es nuestro plan»");
  assert.doesNotMatch(html, /data-dpv2="pagado"/);
});

test("TRE-D1 · con el plan guardado: «Ya lo he pagado», «Cómo vais» con la racha y el mes ya hecho", () => {
  const seguimiento = { ok: true, racha: 2, hecho: 640, previsto: 810, filas: [
    { mes: "2026-09", estado: "hecho" }, { mes: "2026-10", estado: "hecho" }, { mes: "2026-11", estado: "en-curso" }, { mes: "2026-12", estado: "futuro" },
  ] };
  const m = V.modelo({ outlook, plan, contratos, finBase, seguimiento, hoy: "2026-11-25" });
  assert.deepEqual(m.comoVais.meses.map((x) => x.estado), ["hecho", "hecho", "en-curso"]);
  const html = V.html(m);
  assert.match(html, /data-dpv2="pagado"/);
  assert.match(html, /data-dpv2="no-puedo"/);
  assert.match(html, /Racha de 2 meses\./);
  const hecho = V.html(V.modelo({ outlook, plan, contratos, finBase, seguimiento: { ...seguimiento, filas: [{ mes: "2026-11", estado: "hecho", real: 270 }] }, hoy: "2026-11-25" }));
  assert.match(hecho, /Hecho este mes: 270 €/);
  assert.doesNotMatch(hecho, /data-dpv2="pagado"/);
});

test("TRE-D1 · el orden: por fin con el plan, y lo adelantado frente a pagar solo las cuotas", () => {
  const m = V.modelo({ outlook, plan, contratos, finBase, hoy: "2026-11-25" });
  assert.deepEqual(m.orden.filas.map((f) => f.id), ["t", "p"]);
  assert.equal(m.orden.hasta, "2029-11");
  const html = V.html(m);
  assert.match(html, /Saldada en diciembre de 2026 \(35 meses antes que pagando solo las cuotas\)\./);
  assert.match(html, /class="dpv2-barra-adelanto"/);
  assert.match(html, /data-fecha-libre="unica"/);
  assert.match(html, /data-dpv2="detalle"/);
  for (const acceso of ["ajustar", "comparar", "cerrar"]) assert.match(html, new RegExp(`data-dpv2="${acceso}"`));
  assert.match(html, /<h2 class="dpv2-oculto"/, "un encabezado para lectores de pantalla");
  assert.doesNotMatch(html, /,\d\d €/, "a meses vista, sin céntimos");
});

test("TRE-D1 · sin deuda viva o con todo saldado, la vista no se pinta (lo que no tiene datos no ocupa pantalla)", () => {
  assert.equal(V.modelo({ outlook: { settled: true }, plan, contratos, finBase, hoy: "2026-11-25" }).vacio, true);
  assert.equal(V.modelo({ outlook, plan, contratos: [], finBase, hoy: "2026-11-25" }).vacio, true);
  assert.equal(V.html({ vacio: true }), "");
});

test("TRE-D1 · cableado: contenedor, script antes de app.js, publicación, service worker y estilos del tema v2", () => {
  const html = fs.readFileSync(path.join(raiz, "index.html"), "utf8");
  assert.match(html, /<div class="dpv2" id="deudaPlanV2" hidden><\/div>/);
  assert.ok(html.indexOf("views/deuda-plan-v2.js?v=") < html.indexOf('src="app.js?v='), "se carga antes que app.js");
  assert.match(fs.readFileSync(path.join(raiz, "tools", "build-public-site.mjs"), "utf8"), /\n {2}"views\/deuda-plan-v2\.js",\n/);
  assert.match(fs.readFileSync(path.join(raiz, "service-worker.js"), "utf8"), /"\.\/views\/deuda-plan-v2\.js",/);
  const css = fs.readFileSync(path.join(raiz, "tema-v2.css"), "utf8");
  assert.match(css, /#deuda-ruta:has\(> #deudaPlanV2:not\(\[hidden\]\):not\(\[data-modo="anterior"\]\)\) > :not\(#deudaPlanV2\):not\(#deudaRutaScreenTabs\)/);
  assert.match(css, /#deudaPlanV2:not\(\[hidden\]\):not\(\[data-modo="anterior"\]\)\) #topbarStatusStrip/, "D-N49: sin la tira de cinco cifras");
  assert.match(fs.readFileSync(path.join(raiz, "views", "deuda.js"), "utf8"), /globalThis\.renderDeudaPlanV2\?\.\(\);/);
  assert.equal(V.MODO_KEY, "deuda-plan-v2-modo");
});

test("TRE-D1 · al pasar a «todo el detalle» se olvida el pintado de la vista nueva, para que «Volver» la repinte sin recargar", () => {
  const js = require("node:fs").readFileSync(require("node:path").join(__dirname, "..", "views/deuda-plan-v2.js"), "utf8");
  const anterior = js.slice(js.indexOf('box.dataset.modo = "anterior";'), js.indexOf('data-dpv2="volver"'));
  assert.match(anterior, /box\.__html = "";/);
});
