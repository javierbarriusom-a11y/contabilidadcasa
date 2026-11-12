const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const cov = require("../canonical-ledger-coverage.js");

// XDA-04 · PR-2 (12/11/2026): la tira de cobertura de 90 días por cuenta (canonical-ledger-coverage.js `strip`,
// `afterImport` y `unseen`; cobertura-ui.js), en Movimientos, en el paso «Extracto» del repaso, «Cobertura tras
// importar» en Importar, y lo que WP-36 y WP-41 no han podido mirar.

const root = path.resolve(__dirname, "..");
const read = (name) => fs.readFileSync(path.join(root, name), "utf8");
const R = (account, from, to, source = "declarado") => ({ account, from, to, source });
const HOY = "2026-11-12"; // la ventana de 90 días va del 15 ago al 12 nov
const kinds = (s) => s.segments.map((x) => [x.kind, x.from, x.to, x.days, Boolean(x.estimado)]);

test("la tira: cubierto, hueco (entre dos extractos) y sin dato (antes del primero y desde el último), 90 días justos", () => {
  const rangos = [R("CaixaBank", "2026-08-01", "2026-10-03", "estimado"), R("CaixaBank", "2026-10-10", "2026-11-02")];
  const t = cov.strip(rangos, "CaixaBank", HOY);
  assert.equal(t.from, "2026-08-15");
  assert.deepEqual(kinds(t), [
    ["cubierto", "2026-08-15", "2026-10-03", 50, true],
    ["hueco", "2026-10-04", "2026-10-09", 6, false],
    ["cubierto", "2026-10-10", "2026-11-02", 24, false],
    ["sin-dato", "2026-11-03", "2026-11-12", 10, false],
  ]);
  assert.equal(t.segments.reduce((n, s) => n + s.days, 0), 90);
  assert.equal(t.diasHueco, 6);
  assert.equal(t.ultimo, "2026-11-02");
  assert.deepEqual(t.pendiente, { from: "2026-11-03", to: HOY, days: 10 });
  assert.deepEqual(t.sugerencia, { from: "2026-10-04", to: HOY }, "un solo extracto del primer hueco a hoy");
  // Un hueco que empieza antes de la ventana sigue siendo hueco; lo de antes del primer extracto, no.
  const viejo = cov.strip([R("CaixaBank", "2026-07-01", "2026-08-10"), R("CaixaBank", "2026-09-01", HOY)], "CaixaBank", HOY);
  assert.deepEqual(kinds(viejo)[0], ["hueco", "2026-08-15", "2026-08-31", 17, false]);
  assert.equal(viejo.pendiente, null);
  assert.deepEqual(viejo.sugerencia, { from: "2026-08-15", to: "2026-08-31" });
  const nuevo = cov.strip([R("CaixaBank", "2026-10-01", HOY)], "CaixaBank", HOY);
  assert.deepEqual(kinds(nuevo)[0], ["sin-dato", "2026-08-15", "2026-09-30", 47, false]);
  assert.equal(nuevo.sugerencia, null, "al día: nada que importar");
});

test("la tira: una cuenta sin extractos es toda «sin dato»; lo estimado no se pinta como visto aunque toque lo declarado", () => {
  const vacia = cov.strip([R("CaixaBank", "2026-10-01", HOY)], "Mediolanum", HOY);
  assert.equal(vacia.sinExtractos, true);
  assert.deepEqual(kinds(vacia), [["sin-dato", "2026-08-15", HOY, 90, false]]);
  // `merged` junta un estimado y un declarado que se tocan y pierde la marca; la tira no.
  const juntos = [R("CaixaBank", "2026-09-01", "2026-10-20", "estimado"), R("CaixaBank", "2026-10-01", "2026-10-31")];
  assert.equal(cov.merged(juntos, "CaixaBank")[0].estimado, false);
  assert.deepEqual(kinds(cov.strip(juntos, "CaixaBank", HOY)).slice(1, 3), [
    ["cubierto", "2026-09-01", "2026-09-30", 30, true],
    ["cubierto", "2026-10-01", "2026-10-31", 31, false],
  ]);
  assert.equal(cov.strip([], "CaixaBank", "no-es-fecha"), null);
});

test("tras importar: qué hueco cierra, qué deja sin ver y hasta cuándo queda cubierta la cuenta", () => {
  const rangos = [R("CaixaBank", "2026-08-01", "2026-10-03"), R("CaixaBank", "2026-10-10", "2026-11-02")];
  const cierra = cov.afterImport(rangos, R("CaixaBank", "2026-10-01", HOY), HOY);
  assert.deepEqual(cierra.cierra, [{ from: "2026-10-04", to: "2026-10-09", days: 6 }]);
  assert.deepEqual(cierra.abre, []);
  assert.equal(cierra.hasta, HOY);
  assert.equal(cierra.quedan, 0);
  // Un extracto que empieza tres días después del último visto deja un hueco nuevo (antes era «sin dato»).
  const abre = cov.afterImport(rangos, R("CaixaBank", "2026-11-06", HOY), HOY);
  assert.deepEqual(abre.abre.map((h) => [h.from, h.to]), [["2026-11-03", "2026-11-05"]]);
  assert.deepEqual(abre.cierra, []);
  assert.equal(abre.quedan, 2, "el del 4 al 9 oct sigue");
  // Lo que queda de un hueco que el extracto cierra solo en parte no es un hueco nuevo.
  const parte = cov.afterImport(rangos, R("CaixaBank", "2026-10-06", "2026-10-12"), HOY);
  assert.deepEqual(parte.cierra, [{ from: "2026-10-06", to: "2026-10-09", days: 4 }]);
  assert.deepEqual(parte.abre, []);
  assert.equal(cov.afterImport([], R("Mediolanum", "2026-10-01", "2026-10-31"), HOY).primero, true);
});

test("lo no mirado: huecos y lo que falta al final, por cuenta; una cuenta sin extractos no sale (eso lo dice la tira)", () => {
  const rangos = [R("CaixaBank", "2026-08-01", "2026-10-03"), R("CaixaBank", "2026-10-10", "2026-11-02"), R("Mediolanum", "2026-10-20", "2026-10-31")];
  assert.deepEqual(cov.unseen(rangos, ["CaixaBank", "Mediolanum", "Efectivo"], "2026-09-20", "2026-11-05"), [
    { account: "CaixaBank", gaps: [{ from: "2026-10-04", to: "2026-10-09", days: 6 }, { from: "2026-11-03", to: "2026-11-05", days: 3 }] },
    { account: "Mediolanum", gaps: [{ from: "2026-11-01", to: "2026-11-05", days: 5 }] },
  ]);
  assert.deepEqual(cov.unseen(rangos, ["CaixaBank"], "2026-10-10", "2026-11-02"), []);
});

function sandbox(rangos, transactions = []) {
  const store = { "k:ledger-coverage": JSON.stringify({ version: 1, ranges: rangos }) };
  const ctx = {
    console,
    Date,
    FinanceCanonicalLedgerCoverage: cov,
    FinanceCanonicalBalancePulse: { ACCOUNTS: [{ importLabel: "CaixaBank", unlabelledStatements: true }, { importLabel: "Mediolanum", unlabelledStatements: false }] },
    storageKey: (k) => `k:${k}`,
    storageGet: (k, d) => (k in store ? store[k] : d),
    storageSet: (k, v) => { store[k] = v; },
    escapeHtml: (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;"),
    isoLocalDate: () => HOY,
    displayShortDate: (s) => s,
    baseData: { transactions },
  };
  ctx.globalThis = ctx;
  vm.createContext(ctx);
  vm.runInContext(read("cobertura-ui.js"), ctx);
  return ctx.FinanceCobertura;
}

test("pintado: una fila por cuenta, el hueco desplegable con el extracto que importar, la leyenda y nada sin extractos", () => {
  const ui = sandbox([R("CaixaBank", "2026-08-01", "2026-10-03"), R("CaixaBank", "2026-10-10", "2026-11-02")]);
  const html = ui.tiraHtml({ titulo: true, hoy: HOY });
  assert.match(html, /<h3 id="cobTiraTitulo">Cobertura<\/h3><span>últimos 90 días<\/span>/);
  assert.match(html, /<span class="cob-tira-nombre">CaixaBank<\/span><span class="cob-tira-estado">hueco del 4 al 9 oct<\/span>/);
  assert.match(html, /Importa un extracto de CaixaBank que cubra del 4 oct al 12 nov: cierra el hueco y trae lo que va desde el último\./);
  assert.match(html, /<button type="button" class="e19-btn e19-btn-secondary" data-mov-v2-nav="datos-importar">Importar extracto<\/button>/);
  assert.match(html, /<span class="cob-tira-nombre">Mediolanum<\/span><span class="cob-tira-estado">sin extractos<\/span>/);
  assert.match(html, /style="flex:50"/);
  assert.match(html, /aria-hidden="true"/, "la barra es decorativa: la fila dice lo mismo con palabras");
  assert.doesNotMatch(html, /estimado/, "sin nada estimado, ni leyenda ni nota");
  // En el repaso, sin cabecera y sin botón propio: el del pie del paso ya importa (una acción, un botón).
  const suelta = ui.tiraHtml({ importarAttr: "", hoy: HOY });
  assert.doesNotMatch(suelta, /<h3/);
  assert.match(suelta, /Importa un extracto de CaixaBank que cubra del 4 oct al 12 nov/);
  assert.doesNotMatch(suelta, /<button/);
  // Ningún extracto en ninguna cuenta: no ocupa pantalla.
  assert.equal(sandbox([]).tiraHtml({ titulo: true, hoy: HOY }), "");
  // Al día: sin desplegable.
  const aldia = sandbox([R("CaixaBank", "2026-08-01", HOY), R("Mediolanum", "2026-08-01", HOY)]).tiraHtml({ hoy: HOY });
  assert.doesNotMatch(aldia, /<details/);
  assert.equal((aldia.match(/>al día</g) || []).length, 2);
});

test("pintado: lo importado antes del registro sale «estimado», y «Cobertura tras importar» y lo no mirado lo dicen con fechas", () => {
  // Sin rangos guardados, lo de antes cuenta como estimado (del primer al último movimiento).
  const ui = sandbox([], [{ date: "2026-09-01" }, { date: "2026-10-31" }]);
  const html = ui.tiraHtml({ hoy: HOY });
  assert.match(html, /cob-seg is-cubierto is-estimado/);
  assert.match(html, /<span class="cob-seg is-cubierto is-estimado"><\/span>estimado/);
  assert.match(html, /«Estimado»: importado antes del 26\/10/);
  assert.match(html, /cubierto hasta el 31 oct/);
  const session = { rows: [{ transaction: { date: "2026-11-01" } }, { transaction: { date: "2026-11-10" } }], fileMeta: { bankAccount: "CaixaBank" } };
  assert.match(ui.trasImportarHtml(session, HOY), /CaixaBank queda cubierto hasta el 10 nov\./);
  const conHueco = { rows: [{ transaction: { date: "2026-11-05" } }], fileMeta: { bankAccount: "CaixaBank", cobertura: { from: "2026-11-04", to: HOY } } };
  assert.match(ui.trasImportarHtml(conHueco, HOY), /Deja sin ver del 1 al 3 nov: importa también esos días si puedes\. CaixaBank queda cubierto hasta el 12 nov, con un hueco en los últimos 90 días\./);
  const primero = { rows: [{ transaction: { date: "2026-11-05" } }], fileMeta: { bankAccount: "Mediolanum" } };
  assert.match(ui.trasImportarHtml(primero, HOY), /Es el primer extracto de Mediolanum que se registra\./);
  const ui2 = sandbox([R("CaixaBank", "2026-08-01", "2026-10-03"), R("CaixaBank", "2026-10-10", "2026-11-02")]);
  assert.equal(ui2.noMiradoReciente("2026-11-02", 45, HOY), "No he podido mirar del 4 al 9 oct en CaixaBank: no hay extracto de esos días.");
  assert.equal(ui2.noMiradoReciente("2026-10-03", 45, HOY), "", "lo de después del último movimiento ya lo dice «Mirado hasta el …»");
});

test("cableado: Movimientos, el repaso, Importar, WP-36 y WP-41; estilos en el tema v2 y sellos al día", () => {
  const mov = read("views/movimientos-v2.js");
  assert.match(mov, /bottom\.innerHTML = `\$\{globalThis\.FinanceCobertura\?\.tiraHtml\?\.\(\{ titulo: true \}\) \|\| ""\}\$\{movV2Pending\(\)\}/);
  assert.doesNotMatch(mov, /la cobertura de 90 días por cuenta\./, "la línea de «Aún no llegan solos» ya no la promete");
  assert.match(read("views/repaso-v2.js"), /FinanceCobertura\?\.tiraHtml\?\.\(\{ importarAttr: "" \}\)/);
  const imp = read("views/importar-v2.js");
  assert.ok(imp.indexOf("impV2CuadreHtml(cuadre)") < imp.indexOf("FinanceCobertura?.trasImportarHtml?.(session)"), "bajo el cuadre, como ImportarDesktop.png");
  assert.match(read("anomalias-ui.js"), /FinanceCobertura\?\.noMiradoReciente\?\.\(result\.coveredUntil, globalThis\.FinanceCanonicalStatementAnomalies\?\.LOOKBACK_DAYS \|\| 45\)/);
  assert.match(read("sombra-ui.js"), /FinanceCobertura\?\.noMiradoReciente\?\.\(result\.coveredUntil, globalThis\.FinanceCanonicalShadowDebt\?\.RECENT_DAYS \|\| 45\)/);
  const css = read("tema-v2.css");
  const reglas = css.slice(css.indexOf("/* XDA-04 · PR-2")).match(/^[^\s/@}][^{]*\{/gm) || [];
  assert.ok(reglas.length > 10);
  reglas.forEach((r) => assert.match(r, /^:root\[data-tema="v2"\] /, r));
  const html = read("index.html");
  // tema-v2.css lo comparten todas las pantallas: su sello cambia con la siguiente entrega (FX-10 PR-3), así que aquí solo se exige uno del 16/11.
  assert.match(html, /tema-v2\.css\?v=20261116[a-z0-9]+/);
  ["canonical-ledger-coverage.js", "cobertura-ui.js", "views/movimientos-v2.js", "views/importar-v2.js", "views/repaso-v2.js", "anomalias-ui.js", "sombra-ui.js"].forEach((f) => {
    assert.match(html, new RegExp(`${f.replace(/[./]/g, "\\$&")}\\?v=20261116xda04b`), f);
  });
});
