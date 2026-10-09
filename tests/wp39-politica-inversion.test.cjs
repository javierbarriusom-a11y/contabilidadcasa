const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

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
  assert.match(read("app.js"), /const BACKUP_LOCAL_STORES = \[[\s\S]*?"investment-policy"/);
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
