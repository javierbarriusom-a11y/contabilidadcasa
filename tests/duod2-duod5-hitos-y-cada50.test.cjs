// DUO-D2 (hitos y cierre de cada deuda saldada) y DUO-D5 (el valor de cada 50 € más al mes), duodécima auditoría, 24/11/2026.
// Contratos inventados.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const H = require("../hitos-deuda.js");
const Path = require("../canonical-debt-payoff-path.js");
const Plan = require("../canonical-debt-optimal-plan.js");

const read = (file) => fs.readFileSync(path.join(__dirname, "..", file), "utf8");
const viva = { id: "p", entity: "Caja FICTICIA", type: "Préstamo", paymentStatus: "active", initialPrincipal: 6000, currentPrincipal: 5100, contractualPayment: 160, currentPayment: 160, apr: 9.5 };
const saldada = (id, extra = {}) => ({ id, entity: "Banco FICTICIO", type: "Tarjeta", paymentStatus: "settled", initialPrincipal: 3000, currentPrincipal: 0, contractualPayment: 90, currentPayment: 0, ...extra });

test("DUO-D2 · la primera vez, lo ya saldado es antiguo (no se celebra); lo que se salda después se anota con su día y su cuota", () => {
  const uno = H.registrar([viva, saldada("vieja")], null, "2026-12-01");
  assert.equal(uno.cambiado, true);
  assert.equal(uno.estado.iniciado, "2026-12-01");
  assert.deepEqual(uno.estado.saldadas.vieja, { fecha: "2026-12-01", label: "Banco FICTICIO · Tarjeta", cuota: 90, antiguo: true });
  assert.equal(H.hitoDeHoy(uno.estado, [viva, saldada("vieja")], "2026-12-01"), null, "lo antiguo no se celebra");
  const dos = H.registrar([viva, saldada("vieja"), saldada("t")], uno.estado, "2027-01-05");
  assert.equal(dos.cambiado, true);
  assert.deepEqual(dos.estado.saldadas.t, { fecha: "2027-01-05", label: "Banco FICTICIO · Tarjeta", cuota: 90, antiguo: false });
  assert.equal(H.registrar([viva, saldada("vieja"), saldada("t")], dos.estado, "2027-01-06").cambiado, false, "sin nada nuevo, no se reescribe");
  assert.equal(H.saldada({ paymentStatus: "reunified", currentPrincipal: 0, initialPrincipal: 10 }), false, "lo reunificado no es saldado");
});

test("DUO-D2 · el hito es de un solo día y dice a dónde va la cuota (a la siguiente deuda, o que ya no queda ninguna)", () => {
  const { estado } = H.registrar([viva, saldada("t")], { iniciado: "2026-12-01", saldadas: {} }, "2027-01-05");
  assert.deepEqual(H.hitoDeHoy(estado, [viva, saldada("t")], "2027-01-05"), { id: "t", label: "Banco FICTICIO · Tarjeta", cuota: 90, mas: 0, quedan: 1 });
  assert.equal(H.hitoDeHoy(estado, [viva, saldada("t")], "2027-01-06"), null, "al día siguiente, ya no");
  assert.equal(H.hitoDeHoy(estado, [saldada("t")], "2027-01-05").quedan, 0);
});

test("DUO-D2 · el cierre: tres pasos; la carta solo termina recibida; completo cuando están los tres; lo que vuelve a tener capital sale", () => {
  const { estado } = H.registrar([viva, saldada("t")], { iniciado: "2026-12-01", saldadas: {} }, "2027-01-05");
  let [c] = H.cierres(estado, {}, [viva, saldada("t")]);
  assert.deepEqual(c.pasos.map((p) => [p.id, p.terminado]), [["carta", false], ["ficheros", false], ["cirbe", false]]);
  [c] = H.cierres(estado, { t: { carta: { estado: "pedida", fecha: "2027-01-06" } } }, [viva, saldada("t")]);
  assert.equal(c.pasos[0].terminado, false, "pedida no es tenerla");
  const todo = { t: { carta: { estado: "recibida", fecha: "2027-01-20" }, ficheros: { estado: "no-hacia-falta", fecha: "2027-01-20" }, cirbe: { estado: "comprobado", fecha: "2027-03-01" } } };
  [c] = H.cierres(estado, todo, [viva, saldada("t")]);
  assert.equal(c.completo, true);
  assert.deepEqual(H.cierres(estado, todo, [viva, { ...saldada("t"), paymentStatus: "active", currentPrincipal: 100 }]), []);
});

function cargarUi(extra = {}) {
  const almacen = new Map(Object.entries(extra.guardado || {}));
  const context = {
    escapeHtml: (v) => String(v), money: (v) => `${Number(v).toFixed(2)} €`, isoLocalDate: () => extra.hoy || "2027-01-05",
    storageKey: (k) => `fc:${k}`, storageGet: (k, f) => (almacen.has(k) ? almacen.get(k) : f), storageSet: (k, v) => almacen.set(k, v),
    canonicalDebtContractRows: () => extra.contratos || [viva, saldada("t")],
    globalThis: { FinanceHitosDeuda: H },
  };
  vm.createContext(context);
  vm.runInContext(read("hitos-deuda-ui.js"), context);
  return { ui: context, almacen };
}

test("DUO-D2 · Hoy: la tarjeta del hito, desde el 4/1/2027 (D-N30) y solo el día en que se ve la deuda saldada", () => {
  const guardado = { "fc:deuda-hitos": JSON.stringify({ iniciado: "2026-12-01", saldadas: {} }) };
  const antes = cargarUi({ guardado, hoy: "2027-01-03" });
  assert.equal(vm.runInContext('hitoDeudaHoyHtml("2027-01-03")', antes.ui), "", "antes del 4/1, nada (el 28/12 entra la pregunta del seguimiento)");
  const { ui } = cargarUi({ guardado, hoy: "2027-01-05" });
  const html = vm.runInContext('hitoDeudaHoyHtml("2027-01-05")', ui);
  assert.match(html, /<strong>Habéis saldado Banco FICTICIO · Tarjeta<\/strong><br>90\.00 € al mes que ya pueden ir a la siguiente deuda\./);
  assert.match(html, /href="#deuda-ruta">Lo que queda para cerrarla</);
  assert.doesNotMatch(html, /🎉|confeti/i);
  assert.equal(vm.runInContext('hitoDeudaHoyHtml("2027-01-06")', ui), "", "un solo día");
});

test("DUO-D2 · el cierre en Deuda › Plan: los pasos con sus botones, y completo en una línea", () => {
  const guardado = { "fc:deuda-hitos": JSON.stringify({ iniciado: "2026-12-01", saldadas: { t: { fecha: "2027-01-05", label: "Banco FICTICIO · Tarjeta", cuota: 90, antiguo: false } } }) };
  const { ui } = cargarUi({ guardado });
  const lista = H.cierres(JSON.parse(guardado["fc:deuda-hitos"]), {}, [viva, saldada("t")]);
  const html = vm.runInContext("hitosCierresHtml", ui)(lista);
  assert.match(html, /<strong>Cerrar las deudas saldadas<\/strong>/);
  assert.match(html, /data-hito-marcar="pedida" data-hito-paso="carta" data-hito-deuda="t">Pedida</);
  assert.match(html, /data-hito-marcar="no-hacia-falta" data-hito-paso="ficheros"/);
  assert.match(html, /data-hito-marcar="comprobado" data-hito-paso="cirbe"/);
  assert.doesNotMatch(html, /<h[1-6]/, "sin titular nuevo (XGO-01)");
  const completo = H.cierres(JSON.parse(guardado["fc:deuda-hitos"]), { t: { carta: { estado: "recibida", fecha: "2027-01-20" }, ficheros: { estado: "hecha", fecha: "2027-01-20" }, cirbe: { estado: "comprobado", fecha: "2027-03-01" } } }, [viva, saldada("t")]);
  assert.match(vm.runInContext("hitosCierresHtml", ui)(completo), /cierre completo \(carta, ficheros y CIRBE\)/);
  assert.equal(vm.runInContext("hitosCierresHtml", ui)([]), "", "sin deudas saldadas recientes, no ocupa pantalla");
});

function cargarCamino() {
  const context = { escapeHtml: (v) => String(v), money: (v) => `${Number(v).toFixed(2)} €`, globalThis: {} };
  vm.createContext(context);
  vm.runInContext(read("camino-deuda-ui.js"), context);
  return context;
}

test("DUO-D5 · cada 50 € más: meses antes e intereses de menos frente al plan de ahora, con el mismo orden; dónde rinde poco", () => {
  const ui = cargarCamino();
  const contratos = [
    { id: "t", entity: "Banco FICTICIO", paymentStatus: "active", currentPrincipal: 2400, currentPayment: 90, apr: 21.9 },
    { id: "p", entity: "Caja FICTICIA", paymentStatus: "active", currentPrincipal: 5100, currentPayment: 160, apr: 9.5 },
  ];
  const comunes = { startMonthKey: "2026-12" };
  const r = Plan.plan(Path, contratos, { ...comunes, monthly: 200 });
  const filas = ui.planOptimoCada50(Plan, Path, contratos, comunes, r, { monthly: 200, byMonth: null });
  assert.equal(JSON.stringify(filas.map((f) => f.paso)), JSON.stringify([50, 100, 150, 200]));
  for (const f of filas) {
    const directo = Plan.plan(Path, contratos, { ...comunes, monthly: 200 + f.paso, strategy: r.recommended.strategy });
    assert.equal(f.meses, r.recommended.summary.monthsToDebtFree - directo.recommended.summary.monthsToDebtFree, `+${f.paso}: los meses salen del mismo motor`);
    assert.equal(f.fecha, directo.recommended.summary.debtFreeMonthKey);
  }
  assert.ok(filas.every((f, i) => i === 0 || (f.meses >= filas[i - 1].meses && f.intereses >= filas[i - 1].intereses)), "más al mes nunca acaba más tarde ni paga más");
  const html = ui.planOptimoCada50Html(filas);
  assert.match(html, /<caption>Si ponéis más al mes \(frente al plan de ahora, mismo orden\)<\/caption>/);
  assert.match(html, /<th scope="row">\+50 €<\/th><td>2 meses<\/td>/);
  assert.match(html, /Desde \+150 €, cada 50 € más adelanta solo un mes: el salto grande está en los primeros\./);
  assert.doesNotMatch(html, /<h[1-6]/);
  // Con la previsión, se suma a lo de cada mes.
  const porMes = ui.planOptimoCada50(Plan, Path, contratos, comunes, Plan.plan(Path, contratos, { ...comunes, monthly: 200, monthlyByMonth: new Array(40).fill(200) }), { monthly: 200, byMonth: new Array(40).fill(200) });
  assert.equal(JSON.stringify(porMes.map((f) => f.meses)), JSON.stringify(filas.map((f) => f.meses)));
  assert.equal(ui.planOptimoCada50Html([]), "");
});

test("DUO-D2 · cableado: contenedor, scripts, service worker, build, copia, Deuda › Plan y Hoy", () => {
  const html = read("index.html");
  assert.ok(html.indexOf('id="planCierres"') > html.indexOf('id="planSeguimiento"'));
  assert.match(html, /<script defer src="hitos-deuda\.js\?v=20261124duod2"><\/script>\s*<script defer src="hitos-deuda-ui\.js\?v=20261124duod2"><\/script>/);
  ["./hitos-deuda.js", "./hitos-deuda-ui.js"].forEach((f) => assert.ok(read("service-worker.js").includes(`"${f}"`), f));
  ["hitos-deuda.js", "hitos-deuda-ui.js"].forEach((f) => assert.ok(read("tools/build-public-site.mjs").includes(`"${f}"`), f));
  assert.match(read("app.js"), /"deuda-hitos", \/\/ DUO-D2/);
  assert.match(read("app.js"), /"deuda-cierres", \/\/ DUO-D2/);
  assert.match(read("camino-deuda-ui.js"), /globalThis\.renderHitosDeuda\?\.\(\); \/\/ DUO-D2/);
  assert.match(read("views/hoy-v2.js"), /\$\{hoyV2Esperados\(\)\}\n\s+\$\{typeof hitoDeudaHoyHtml === "function" \? hitoDeudaHoyHtml\(hoy\) : ""\}/);
});
