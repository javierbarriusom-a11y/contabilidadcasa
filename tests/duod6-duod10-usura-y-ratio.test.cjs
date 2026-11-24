// DUO-D6 (indicio de usura en una tarjeta revolving, en el kit para hablar con la entidad) y DUO-D10 (con las cuotas por encima del 40 % de
// los ingresos previstos, la línea de ayuda en Hoy), D-N36 (duodécima auditoría; adelantadas por D-N39). Datos inventados.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const read = (file) => fs.readFileSync(path.join(__dirname, "..", file), "utf8");

function cargarKit(guardado = {}) {
  const almacen = new Map(Object.entries(guardado));
  const context = {
    escapeHtml: (v) => String(v), isoLocalDate: () => "2026-11-24",
    storageKey: (k) => `fc:${k}`, storageGet: (k, f) => (almacen.has(k) ? almacen.get(k) : f), storageSet: (k, v) => almacen.set(k, v),
    debtContractSourceRows: () => [], globalThis: {}, qs: () => null,
  };
  vm.createContext(context);
  vm.runInContext(read("kit-entidad-ui.js"), context);
  return context;
}

const tarjeta = { id: "t", entity: "Banco FICTICIO", type: "Tarjeta revolving", apr: 26.82, currentPrincipal: 2400, paymentStatus: "active" };

test("DUO-D6 · indicio: más de 6 puntos sobre la media de las revolving del mes de la contratación (criterio del Supremo, 2023)", () => {
  const k = cargarKit();
  assert.equal(JSON.stringify(k.kitUsura(26.82, 19.5)), JSON.stringify({ calculable: true, tae: 26.82, medio: 19.5, diferencia: 7.32, indicio: true }));
  assert.equal(k.kitUsura(24, 19).indicio, false, "5 puntos no es indicio");
  assert.equal(k.kitUsura(25, 19).indicio, false, "6 justos tampoco: el criterio son más de 6");
  assert.equal(k.kitUsura(null, 19).calculable, false);
  assert.equal(k.kitUsura(26, null).calculable, false, "sin la media no se supone");
});

test("DUO-D6 · en el kit, solo para tarjetas; dice «indicio» (nunca «es usura»), a quién consultar y cómo reclamar", () => {
  const k = cargarKit({ "fc:kit-entidad": JSON.stringify({ t: { tipoMedio: 19.5 } }) });
  const html = k.kitUsuraHtml(tarjeta);
  assert.match(html, /<h3 id="kitUsuraT">¿Es abusiva la TAE de la tarjeta\?<\/h3>/);
  assert.match(html, /data-kit-tipo-medio value="19.5"/);
  assert.match(html, /<strong>Indicio:<\/strong> la TAE de la tarjeta \(26,82 %\) supera en 7,32 puntos la media de las revolving de su mes \(19,5 %\)/);
  assert.match(html, /asociación de consumidores o un abogado/);
  assert.match(html, /servicio de atención al cliente de la entidad; sin respuesta en un mes, al Banco de España/);
  assert.doesNotMatch(html, /es usura[^r]/i);
  assert.match(k.kitUsuraResultadoHtml(tarjeta, 22), /<strong>Sin indicio<\/strong> por este criterio/);
  assert.match(k.kitUsuraResultadoHtml(tarjeta, null), /Escribid la TAE media de las tarjetas revolving/);
  assert.match(k.kitUsuraResultadoHtml({ ...tarjeta, apr: null }, 19), /Falta la TAE de la tarjeta en Contratos/);
  assert.equal(k.kitUsuraHtml({ ...tarjeta, type: "Préstamo personal" }), "", "un préstamo no es revolving");
  assert.match(read("kit-entidad-ui.js"), /\$\{kitUsuraHtml\(contract\)\}\n\s+<section aria-labelledby="kitSegT"/);
});

test("DUO-D10 · con las cuotas en el 40 % o más de los ingresos previstos, una línea de ayuda en Hoy (el ratio y su aviso H-9 ya existían)", () => {
  const app = read("app.js");
  assert.match(app, /const DUO_D10_RATIO_ALTO = 0\.4;/);
  assert.match(app, /function homeDecisionCandidates\(\{ actionCenter, offer, debtPriorities, loadedDecisions, debtRatioStatus, debtRatio = null \}\)/);
  assert.match(app, /if \(Number\.isFinite\(debtRatio\) && debtRatio >= DUO_D10_RATIO_ALTO\)/);
  assert.match(app, /title: `Las cuotas se llevan el \$\{Math\.round\(debtRatio \* 100\)\} % de los ingresos previstos`/);
  assert.match(app, /existe la Ley de Segunda Oportunidad/);
  assert.match(app, /debtRatio: Number\(savings\.debtToIncomeRatio\),/);
});
