const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { codigoApp } = require("./helpers/codigo-app.cjs");

const root = path.resolve(__dirname, "..");
const read = (name) => fs.readFileSync(path.join(root, name), "utf8");
const P = require("../canonical-investment-policy.js");

// WP-39 (CAR-01): la política de inversión del hogar. Motor puro: seis respuestas, reglas numeradas, firma con huella, revisión, cartera frente a la
// política y comprobación de una operación. Lo que el hogar debe poder fiar: que «sin datos» no se lea como «cumple», que una pregunta sin responder no
// se firme, que cambiar una respuesta invalide la firma y que «no vender por caídas» se vigile con la caída real o diga que no la sabe.

const complete = (extra = {}) => P.normalizePolicy({
  purpose: { text: "jubilación", horizonYears: 20 },
  allocation: { targets: { etf: 70, fondo: 20, accion: 10 }, bandPct: 5 },
  contribution: { mode: "fixed", monthly: 300 },
  exclusions: { noCrypto: true, noLeverage: true },
  drawdown: { at20: "keep-contributing", at35: "hold" },
  review: { everyMonths: 12 },
  ...extra,
});
const portfolio = { totalsByType: { etf: 7000, fondo: 2000, accion: 1000 }, totalValue: 10000 };

test("WP-39 · normalizePolicy acepta cualquier cosa del almacén y devuelve siempre una política acotada", () => {
  for (const raw of [null, undefined, "x", 5, [], {}, { purpose: "mal", allocation: 3, drawdown: [] }]) {
    const p = P.normalizePolicy(raw);
    assert.equal(p.signature, null);
    assert.equal(p.allocation.bandPct, P.DEFAULT_BAND_PCT);
    assert.equal(p.drawdown.at20, "review-together");
  }
  const wild = P.normalizePolicy({ purpose: { horizonYears: 999 }, allocation: { targets: { etf: 500, inventado: 10, fondo: -4 }, bandPct: 1 }, review: { everyMonths: 7 }, drawdown: { at20: "vender-todo" } });
  assert.equal(wild.purpose.horizonYears, 60);
  assert.deepEqual(wild.allocation.targets, { etf: 100 }, "un tipo inventado o un % negativo no entran");
  assert.equal(wild.allocation.bandPct, 2);
  assert.equal(wild.review.everyMonths, 12);
  assert.equal(wild.drawdown.at20, "review-together", "una acción desconocida cae en «hablarlo antes de tocar nada», la más prudente");
});

test("WP-39 · una pregunta sin responder no se rellena sola: la política queda incompleta y no se firma", () => {
  assert.equal(P.signatureState(P.defaultPolicy()), "none");
  const empty = P.problems(P.defaultPolicy()).map((item) => item.question);
  assert.deepEqual([...new Set(empty)], [1, 2, 3]);
  assert.match(P.problems(complete({ allocation: { targets: { etf: 60, fondo: 20 } } })).map((i) => i.text).join(" "), /suma 80 %, no 100 %/);
  assert.match(P.problems(complete({ contribution: { mode: "fixed", monthly: 0 } })).map((i) => i.text).join(" "), /cantidad fija mensual/);
  assert.deepEqual(P.problems(complete({ contribution: { mode: "surplus" } })), [], "con «lo que sobre» no hace falta cantidad");
  assert.equal(P.sign(P.defaultPolicy(), { signers: ["Ana", "Luis"], today: "2026-12-18" }).reason, "incompleta");
});

test("WP-39 · la firma pide dos personas distintas y fecha; cambiar cualquier respuesta la invalida", () => {
  const policy = complete();
  assert.equal(P.signatureState(policy), "unsigned");
  assert.equal(P.sign(policy, { signers: ["Ana"], today: "2026-12-18" }).reason, "dos-firmas");
  assert.equal(P.sign(policy, { signers: ["Ana", " ana "], today: "2026-12-18" }).reason, "dos-firmas");
  assert.equal(P.sign(policy, { signers: ["Ana", "Luis"], today: "mañana" }).reason, "sin-fecha");
  const signed = P.sign(policy, { signers: ["Ana", "Luis"], today: "2026-12-18" });
  assert.equal(signed.ok, true);
  const viaStore = P.normalizePolicy(JSON.parse(JSON.stringify(signed.policy)));
  assert.equal(P.signatureState(viaStore), "signed", "la firma sobrevive al almacén");
  for (const change of [
    { purpose: { ...viaStore.purpose, horizonYears: 25 } },
    { allocation: { ...viaStore.allocation, bandPct: 8 } },
    { exclusions: { ...viaStore.exclusions, noCrypto: false } },
    { drawdown: { ...viaStore.drawdown, at35: "review-together" } },
    { review: { everyMonths: 6 } },
  ]) assert.equal(P.signatureState(P.normalizePolicy({ ...viaStore, ...change })), "changed", JSON.stringify(change));
});

test("WP-39 · la revisión vence a los N meses de la firma y avisa 30 días antes; sin firma vigente no hay fecha inventada", () => {
  const signed = P.sign(complete(), { signers: ["Ana", "Luis"], today: "2026-12-18" }).policy;
  assert.deepEqual(P.reviewStatus(signed, { today: "2027-01-10" }), { status: "ok", dueDate: "2027-12-18", daysLeft: 342 });
  assert.equal(P.reviewStatus(signed, { today: "2027-11-20" }).status, "due-soon");
  assert.equal(P.reviewStatus(signed, { today: "2027-12-18" }).status, "due-soon", "el propio día todavía no está vencida");
  assert.equal(P.reviewStatus(signed, { today: "2027-12-19" }).status, "overdue");
  assert.equal(P.reviewStatus(complete(), { today: "2027-01-01" }).status, "none", "sin firma no hay revisión");
  const changed = P.normalizePolicy({ ...signed, review: { everyMonths: 6 } });
  assert.equal(P.reviewStatus(changed, { today: "2027-01-01" }).status, "none", "con la firma invalidada tampoco");
  const endOfMonth = P.sign(complete({ review: { everyMonths: 6 } }), { signers: ["Ana", "Luis"], today: "2026-08-31" }).policy;
  assert.equal(P.reviewStatus(endOfMonth, { today: "2026-09-01" }).dueDate, "2027-02-28", "31 de agosto + 6 meses no se pasa a marzo");
});

test("WP-39 · las reglas salen numeradas en lenguaje llano y solo de lo respondido", () => {
  const rules = P.rules(complete());
  assert.deepEqual(rules.map((r) => r.id), ["purpose", "allocation", "contribution", "no-leverage", "no-crypto", "drawdown-20", "drawdown-35", "review"]);
  assert.deepEqual(rules.map((r) => r.n), [1, 2, 3, 4, 5, 6, 7, 8]);
  assert.match(rules[1].text, /ETF 70 %.*más de 5 puntos.*sin vender/);
  assert.match(rules[6].text, /35 %.*no vender/);
  const bare = P.rules(P.defaultPolicy()).map((r) => r.id);
  assert.deepEqual(bare, ["drawdown-20", "drawdown-35", "review"], "sin respuestas no se inventan reglas de reparto ni de aportación");
});

test("WP-39 · cartera frente a la política: fuera de banda, cripto y préstamo se señalan con su regla; sin cartera es «sin datos», no «cumple»", () => {
  const ok = P.assessPortfolio({ policy: complete(), ...portfolio });
  assert.equal(ok.status, "ok");
  const sinCartera = P.assessPortfolio({ policy: complete(), totalsByType: {}, totalValue: 0 });
  assert.equal(sinCartera.status, "no-data");
  assert.match(sinCartera.reason, /no significa que cumpla/);
  const mala = P.assessPortfolio({ policy: complete(), totalsByType: { etf: 5000, fondo: 3000, cripto: 2000 }, totalValue: 10000, loanAmount: 1500 });
  assert.equal(mala.status, "out");
  const byRule = (id) => mala.items.filter((item) => item.ruleId === id);
  assert.ok(byRule("allocation").length >= 3);
  assert.equal(byRule("no-crypto")[0].n, 5);
  assert.equal(byRule("no-leverage")[0].n, 4);
  assert.ok(!byRule("allocation").some((i) => i.type === "fondo" && Math.abs(i.deviation) <= 5), "dentro de la banda no se señala");
  const sinExclusiones = P.assessPortfolio({ policy: complete({ exclusions: { noCrypto: false, noLeverage: false } }), totalsByType: { etf: 7000, fondo: 2000, accion: 1000 }, totalValue: 10000, loanAmount: 5000 });
  assert.equal(sinExclusiones.status, "ok", "un préstamo no contradice una política que no lo prohíbe");
});

test("WP-39 · «no vender por caídas» se vigila con la caída real, y sin ella se dice que no se sabe", () => {
  const sell = (drawdownPct, policy = complete()) => P.checkOperation({ policy, operation: { kind: "sell", type: "etf", amount: 100 }, ...portfolio, drawdownPct });
  assert.equal(sell(5).verdict, "complies");
  assert.equal(sell(20).verdict, "contradicts", "a partir del 20 % la regla 6 dice seguir aportando sin vender");
  assert.equal(sell(20).findings[0].n, 6);
  assert.equal(sell(40).findings[0].n, 7, "con un 40 % manda la regla del 35 %");
  const hablar = sell(25, complete({ drawdown: { at20: "review-together", at35: "review-together" } }));
  assert.equal(hablar.verdict, "warns", "«hablarlo antes» no prohíbe, pide parar");
  const sinDato = sell(null);
  assert.equal(sinDato.verdict, "warns");
  assert.match(sinDato.findings[0].text, /No sé cuánto ha caído/);
});

test("WP-39 · comprar lo prohibido contradice; una compra o venta que aleja del objetivo fuera de banda avisa; una que acerca, no", () => {
  const op = (kind, type, amount, policy = complete()) => P.checkOperation({ policy, operation: { kind, type, amount }, ...portfolio, drawdownPct: 0 });
  const cripto = op("buy", "cripto", 100);
  assert.equal(cripto.verdict, "contradicts");
  assert.equal(cripto.findings[0].n, 5);
  assert.equal(op("buy", "cripto", 100, complete({ exclusions: { noCrypto: false } })).verdict, "complies");
  assert.equal(op("buy", "etf", 100).verdict, "complies");
  const aleja = op("buy", "fondo", 3000);
  assert.equal(aleja.verdict, "warns");
  assert.match(aleja.findings[0].text, /fuera de la banda/);
  const lejos = P.checkOperation({ policy: complete(), operation: { kind: "sell", type: "accion", amount: 900 }, totalsByType: { etf: 7000, fondo: 2000, accion: 1000 }, totalValue: 10000, drawdownPct: 0 });
  assert.equal(lejos.verdict, "warns", "vender casi toda la acción deja el tipo a 1 %, lejos del 10 %");
  const acerca = P.checkOperation({ policy: complete(), operation: { kind: "buy", type: "accion", amount: 1000 }, totalsByType: { etf: 7500, fondo: 2000, accion: 500 }, totalValue: 10000, drawdownPct: 0 });
  assert.equal(acerca.verdict, "complies", "comprar lo que falta no es un aviso");
  assert.equal(P.checkOperation({ policy: complete(), operation: { kind: "x", type: "etf" }, ...portfolio }).verdict, "no-data");
  assert.equal(P.checkOperation({ policy: complete(), operation: { kind: "buy", type: "etf", amount: 100 }, totalsByType: {}, totalValue: 0, drawdownPct: 0 }).verdict, "no-data", "sin cartera no se declara «cumple»");
});

test("WP-39 · el motor es puro: sin DOM, red ni almacenamiento", () => {
  const source = read("canonical-investment-policy.js").replace(/\/\/.*$/gm, "");
  for (const forbidden of [/\bdocument\b/, /\bwindow\b/, /localStorage/, /sessionStorage/, /\bfetch\(/, /XMLHttpRequest/, /\bqs\(/]) assert.doesNotMatch(source, forbidden);
});

test("WP-39 · cableado: el almacén va en la copia, la tarjeta está en Rebalanceo, la pinta views/inversion.js, y no opera ni toca Hoy", () => {
  assert.match(codigoApp(), /const BACKUP_LOCAL_STORES = \[[\s\S]*?"investment-policy"/);
  assert.match(read("views/inversion.js"), /globalThis\.renderPoliticaInversion\?\.\(globalThis\.FinanceCanonicalInvestmentPolicy\)/);
  const html = read("index.html");
  const rebalanceo = html.slice(html.indexOf('id="inversion-rebalanceo"'), html.indexOf('id="inversion-fiscal"'));
  assert.match(rebalanceo, /id="politicaCard"/);
  for (const asset of ["canonical-investment-policy.js", "politica-ui.js", "politica.css"]) {
    assert.match(html, new RegExp(`${asset.replace(".", "\\.")}\\?v=\\w+`), `index.html debe cargar ${asset}`);
    for (const file of ["service-worker.js", "tools/build-public-site.mjs"]) assert.ok(read(file).includes(asset), `${file} debe listar ${asset}`);
  }
  const ui = read("politica-ui.js");
  assert.doesNotMatch(ui, /decisionInboxItems/, "Hoy sigue congelado hasta leer H-02");
  assert.doesNotMatch(ui, /\bconfirm\(/, "lo reversible se deshace (WP-37), no se confirma");
  assert.doesNotMatch(ui, /saveIv1PositionsList|saveIv6Targets|scenarioSettings\.portfolio/, "la política no escribe en la cartera ni en el reparto objetivo: solo lee");
  assert.match(ui, /showUndoToast\("Política borrada\."/);
});

// ---- PR-2 (13/10): la política al registrar una compra o venta, con nota de motivo ----

const signedPolicy = (extra = {}) => P.sign(complete(extra), { signers: ["Ana", "Luis"], today: "2026-10-13" }).policy;
const notice = (operation, policy = signedPolicy(), drawdownPct = 0, base = portfolio) => P.registrationNotice({ policy, operation, ...base, drawdownPct });

test("WP-39 PR-2 · sin política guardada no hay nada que enseñar al registrar", () => {
  assert.deepEqual(P.registrationNotice({ policy: null, operation: { kind: "buy", type: "cripto", amount: 100 } }), { show: false, requiresReason: false });
  assert.deepEqual(P.registrationNotice({}), { show: false, requiresReason: false });
});

test("WP-39 PR-2 · contradice una política FIRMADA: lo dice con su regla numerada y pide motivo; nunca bloquea (devuelve un aviso, no un veto)", () => {
  const result = notice({ kind: "buy", type: "cripto", amount: 500 });
  assert.equal(result.show, true);
  assert.equal(result.level, "contradicts");
  assert.equal(result.verdict, "contradicts");
  assert.equal(result.requiresReason, true);
  assert.match(result.title, /contradice la política/);
  assert.match(result.lines[0], /^Regla \d+\. Comprar cripto/);
  assert.equal(result.rules.length, 1);
  assert.equal(result.draft, "");
  const sale = notice({ kind: "sell", type: "etf", amount: 1000 }, signedPolicy(), 40);
  assert.equal(sale.level, "contradicts", "vender con la cartera 40 % por debajo de su máximo, con «mantener» a partir del 35 %");
  assert.equal(sale.requiresReason, true);
  assert.equal(P.canRegister(result, "").ok, false);
  assert.match(P.canRegister(result, "   ").message, /escribe el motivo/);
  assert.match(P.canRegister(result, "").message, /no se bloquea nada/);
  assert.deepEqual(P.canRegister(result, "Es para la entrada de la casa"), { ok: true, message: "" });
});

test("WP-39 PR-2 · una política sin firmar, o cambiada tras firmar, avisa como borrador y NO exige motivo", () => {
  const draft = notice({ kind: "buy", type: "cripto", amount: 500 }, complete());
  assert.equal(draft.level, "contradicts");
  assert.equal(draft.requiresReason, false);
  assert.match(draft.draft, /borrador sin firmar/);
  assert.equal(P.canRegister(draft, "").ok, true);
  const signed = signedPolicy();
  const changed = notice({ kind: "buy", type: "cripto", amount: 500 }, { ...signed, contribution: { mode: "fixed", monthly: 999 } });
  assert.equal(changed.requiresReason, false);
  assert.match(changed.draft, /cambió después de firmar/);
});

test("WP-39 PR-2 · avisos que no contradicen: «ojo» pide cuidado sin exigir motivo, «no choca» se dice, y lo que no se puede comprobar NO es «cumple»", () => {
  const sinCaida = notice({ kind: "sell", type: "etf", amount: 100 }, signedPolicy(), null);
  assert.equal(sinCaida.level, "warns");
  assert.equal(sinCaida.requiresReason, false);
  assert.match(sinCaida.lines.join(" "), /No sé cuánto ha caído la cartera/);
  const ok = notice({ kind: "buy", type: "etf", amount: 100 });
  assert.equal(ok.level, "ok");
  assert.match(ok.title, /No choca con ninguna regla/);
  const unknown = P.registrationNotice({ policy: signedPolicy(), operation: { kind: "buy", type: "etf", amount: 100 }, totalsByType: {}, totalValue: 0, drawdownPct: 0 });
  assert.equal(unknown.level, "unknown");
  assert.notEqual(unknown.level, "ok");
  assert.match(unknown.reason, /Sin cartera registrada/);
  const incomplete = P.registrationNotice({ policy: signedPolicy(), operation: { kind: "", type: "" } });
  assert.equal(incomplete.level, "unknown");
});

test("WP-39 PR-2 · la constancia: solo se anotan las operaciones con aviso que importan, y el almacén está acotado y limpio", () => {
  const contradicts = notice({ kind: "buy", type: "cripto", amount: 500 });
  const warns = notice({ kind: "sell", type: "etf", amount: 100 }, signedPolicy(), null);
  const ok = notice({ kind: "buy", type: "etf", amount: 100 });
  let store = P.normalizeReasons(null);
  assert.deepEqual(store, { byOperation: {} });
  store = P.addReason(store, { operationId: "op-1", positionId: "p1", label: "Fondo A", kind: "buy", type: "cripto", amount: 500, notice: contradicts, note: "  Es una prueba pequeña  ", today: "2026-10-13" });
  store = P.addReason(store, { operationId: "op-2", positionId: "p1", label: "Fondo A", kind: "sell", type: "etf", amount: 100, notice: warns, note: "", today: "2026-10-14" });
  const before = JSON.stringify(store);
  store = P.addReason(store, { operationId: "op-3", kind: "buy", type: "etf", amount: 100, notice: ok, note: "algo", today: "2026-10-15" });
  store = P.addReason(store, { operationId: "op-4", kind: "buy", type: "etf", amount: 100, notice: null, today: "2026-10-15" });
  store = P.addReason(store, { operationId: "", kind: "buy", type: "etf", amount: 100, notice: contradicts, today: "2026-10-15" });
  store = P.addReason(store, { operationId: "op-5", kind: "buy", type: "etf", amount: 100, notice: contradicts, today: "ayer" });
  assert.equal(JSON.stringify(store), before, "«no choca», sin aviso, sin id o con una fecha inválida no dejan constancia");
  assert.equal(store.byOperation["op-1"].note, "Es una prueba pequeña", "el motivo se recorta de espacios");
  assert.deepEqual(Object.keys(store.byOperation), ["op-2", "op-1"], "las más recientes primero");
  const wild = P.normalizeReasons({ byOperation: { a: { at: "2026-01-01", kind: "buy", type: "inventado", amount: -5, verdict: "raro", rules: ["x", 3], note: "z".repeat(900) }, b: null, c: { at: "mal", kind: "buy" }, d: { at: "2026-01-02", kind: "otro" } } });
  assert.deepEqual(Object.keys(wild.byOperation), ["a"]);
  assert.equal(wild.byOperation.a.type, "otro");
  assert.equal(wild.byOperation.a.amount, 0);
  assert.equal(wild.byOperation.a.verdict, "unknown");
  assert.deepEqual(wild.byOperation.a.rules, [3]);
  assert.equal(wild.byOperation.a.note.length, P.REASON_MAX_LENGTH);
  const many = {};
  for (let i = 0; i < P.MAX_REASONS + 40; i += 1) many[`o${i}`] = { at: `2026-01-${String((i % 28) + 1).padStart(2, "0")}`, kind: "buy", type: "etf", amount: 1, verdict: "warns", rules: [], note: "" };
  assert.equal(Object.keys(P.normalizeReasons({ byOperation: many }).byOperation).length, P.MAX_REASONS, "el almacén no crece sin límite");
});

test("WP-39 PR-2 · el resumen mide el criterio del plan: cuántas contradecían la política y cuántas de ésas llevan motivo", () => {
  const contradicts = notice({ kind: "buy", type: "cripto", amount: 500 });
  const warns = notice({ kind: "sell", type: "etf", amount: 100 }, signedPolicy(), null);
  assert.deepEqual(P.reasonsSummary(null), { total: 0, contradicts: 0, contradictsWithoutNote: 0, latest: [] });
  let store = P.addReason(null, { operationId: "a", kind: "buy", type: "cripto", amount: 500, notice: contradicts, note: "porque sí", today: "2026-10-01" });
  store = P.addReason(store, { operationId: "b", kind: "buy", type: "cripto", amount: 500, notice: contradicts, note: "", today: "2026-10-02" });
  store = P.addReason(store, { operationId: "c", kind: "sell", type: "etf", amount: 100, notice: warns, note: "", today: "2026-10-03" });
  const summary = P.reasonsSummary(store);
  assert.equal(summary.total, 3);
  assert.equal(summary.contradicts, 2);
  assert.equal(summary.contradictsWithoutNote, 1, "una contradicción sin motivo se cuenta como tal");
  assert.equal(summary.latest[0].operationId, "c");
  assert.ok(summary.latest.length <= 5);
});

test("WP-39 PR-2 · cableado: solo al AÑADIR, el motivo se pide solo si contradice una política firmada, queda en la copia, se deshace y no escribe en la política", () => {
  const ops = read("operaciones-ui.js");
  assert.match(ops, /action !== "add" \|\| \(operation\.kind !== "buy" && operation\.kind !== "sell"\)\) return null/, "solo al registrar una compra o venta nueva");
  assert.match(ops, /canRegister\(notice, note\)/);
  assert.match(ops, /if \(reasonsBefore\) politicaReasonsSave\(reasonsBefore\)/, "deshacer devuelve el motivo a como estaba");
  assert.doesNotMatch(ops, /savePolitica|politicaSave\(/, "la política no se escribe desde el libro de operaciones");
  assert.match(ops, /No se bloquea nada: es dinero vuestro/);
  assert.match(codigoApp(), /const BACKUP_LOCAL_STORES = \[[\s\S]*?"policy-reasons"/);
  const ui = read("politica-ui.js");
  assert.match(ui, /const POLITICA_REASONS_STORE = "policy-reasons"/);
  assert.match(ui, /politicaReasonsHtml\(\)/);
  assert.doesNotMatch(read("canonical-investment-policy.js").replace(/\/\/.*$/gm, ""), /\bdocument\b|\bwindow\b|localStorage|\bfetch\(/, "el motor sigue siendo puro");
  const html = read("index.html");
  for (const asset of ["operaciones-ui.js", "operaciones.css", "politica-ui.js", "politica.css", "canonical-investment-policy.js"]) assert.match(html, new RegExp(`${asset.replace(".", "\\.")}\\?v=20261013wp39a2`), asset);
});

