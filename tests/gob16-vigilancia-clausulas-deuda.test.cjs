const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const DebtContracts = require("../canonical-debt-contracts.js");
const PortfolioEngine = require("../canonical-portfolio.js");

// GOB16 (Oleada 4, Bloque 7, O-7): vigilancia de cláusulas de deuda más allá de TAE y capital.
// Acotado a lo que DEB4 (radar de refinanciación) y DEB8 (ventana de comisión decreciente, ambas
// Oleada 3) no cubren: vinculación de productos exigida, comisión de apertura ya declarada (dato de
// referencia) y fecha de revisión del diferencial pactado — reutiliza tal cual
// `rebalanceCalendarReviewStatus()` (INV17/GOB13, canonical-portfolio.js real) para "cuántos meses
// hace que se revisó", sin motor propio. Las cláusulas se declaran por contrato
// (`scenarioSettings.gob16DebtClauses`) — nunca inferidas.

const source = fs.readFileSync(path.join(__dirname, "..", "views", "deuda.js"), "utf8");
const appSource = fs.readFileSync(path.join(__dirname, "..", "app.js"), "utf8");
const indexSource = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");

function extractFunction(name) {
  const start = source.indexOf(`function ${name}(`);
  assert.ok(start >= 0, `No existe la función ${name} en views/deuda.js`);
  const parenStart = source.indexOf("(", start);
  let parenDepth = 0;
  let bodyStart = -1;
  for (let index = parenStart; index < source.length; index += 1) {
    if (source[index] === "(") parenDepth += 1;
    else if (source[index] === ")") {
      parenDepth -= 1;
      if (parenDepth === 0) { bodyStart = source.indexOf("{", index); break; }
    }
  }
  assert.ok(bodyStart >= 0, `No se encontró el cuerpo de ${name}`);
  let depth = 0;
  for (let index = bodyStart; index < source.length; index += 1) {
    if (source[index] === "{") depth += 1;
    else if (source[index] === "}") {
      depth -= 1;
      if (depth === 0) return source.slice(start, index + 1);
    }
  }
  throw new Error(`La función ${name} no cierra sus llaves`);
}

function plain(value) {
  return JSON.parse(JSON.stringify(value));
}

const FUNCTION_NAMES = [
  "gob16DebtClauses",
  "gob16ContractClause",
  "gob16SaveContractClause",
  "gob16RateReviewStatus",
  "gob16ClauseRowHtml",
  "renderGob16ClauseWatch",
  "handleGob16ClauseFieldChange",
];

function makeBox() {
  return {
    _html: "",
    get innerHTML() { return this._html; },
    set innerHTML(value) { this._html = value; },
    // Réplica mínima de `querySelectorAll("details[open]")` sobre el propio HTML ya pintado —
    // suficiente para probar que renderGob16ClauseWatch preserva qué <details> estaba abierto antes
    // de repintar, sin necesitar un DOM real.
    querySelectorAll(selector) {
      if (selector !== "details[open]") return [];
      const ids = [];
      const regex = /<details[^>]*data-gob16-clause-card="([^"]*)"[^>]*>/g;
      let match;
      while ((match = regex.exec(this._html))) {
        const [tag] = match;
        if (/\bopen\b/.test(tag)) ids.push(match[1]);
      }
      return ids.map((id) => ({ dataset: { gob16ClauseCard: id } }));
    },
  };
}

function sandbox({ scenarioSettings = {}, state = {}, box = makeBox(), contracts = CONTRACTS } = {}) {
  const saved = [];
  const context = {
    window: { FinanceCanonicalPortfolio: PortfolioEngine },
    scenarioSettings,
    state,
    saveScenarioSettings: () => saved.push(plain(scenarioSettings)),
    debtContractSourceRows: () => contracts,
    qs: (id) => (id === "gob16ClauseWatch" ? box : null),
    escapeHtml: (value) => String(value ?? ""),
    money: (value) => `${value} €`,
    round2: (value) => Math.round((value + Number.EPSILON) * 100) / 100,
    box,
    saved,
  };
  vm.createContext(context);
  FUNCTION_NAMES.forEach((name) => vm.runInContext(extractFunction(name), context));
  return context;
}

const CONTRACTS = DebtContracts.normalizeContracts([
  { id: "hipoteca", entity: "Hipoteca Mediolanum", type: "Hipoteca", currentPrincipal: 150000, apr: 2.5, currentPayment: 700, remainingInstallments: 240 },
  { id: "coche", entity: "Préstamo coche", type: "Préstamo", currentPrincipal: 8000, apr: 7, currentPayment: 300, remainingInstallments: 30 },
]).contracts;

// --- gob16ContractClause ------------------------------------------------------------------------

test("gob16ContractClause · sin declarar, valores por defecto (cumple vinculación, sin penalización, comisión ni revisión)", () => {
  const ctx = sandbox();
  const clause = ctx.gob16ContractClause("hipoteca");
  assert.deepEqual({ ...clause }, {
    linkedProducts: "",
    linkedProductsCompliant: true,
    bonusRatePenaltyPct: 0,
    openingFeePct: 0,
    rateReviewIntervalMonths: 0,
    lastRateReviewAt: "",
  });
});

test("gob16ContractClause · normaliza lo ya declarado (comisión no negativa, intervalo entero)", () => {
  const ctx = sandbox({
    scenarioSettings: { gob16DebtClauses: { hipoteca: { linkedProducts: "seguro de vida", linkedProductsCompliant: false, bonusRatePenaltyPct: "0.5", openingFeePct: "1.5", rateReviewIntervalMonths: "12.7", lastRateReviewAt: "2025-09" } } },
  });
  const clause = ctx.gob16ContractClause("hipoteca");
  assert.equal(clause.linkedProducts, "seguro de vida");
  assert.equal(clause.linkedProductsCompliant, false);
  assert.equal(clause.bonusRatePenaltyPct, 0.5);
  assert.equal(clause.openingFeePct, 1.5);
  assert.equal(clause.rateReviewIntervalMonths, 12);
  assert.equal(clause.lastRateReviewAt, "2025-09");
});

// --- D7 (Contabilidadcasa 2.0): penalización de TAE declarada y su coste anual en euros --------

test("gob16SaveContractClause · guarda la penalización de TAE, acepta coma decimal y la acota a 0-100", () => {
  const ctx = sandbox();
  ctx.gob16SaveContractClause("hipoteca", "bonusRatePenaltyPct", "0,5");
  assert.equal(ctx.scenarioSettings.gob16DebtClauses.hipoteca.bonusRatePenaltyPct, 0.5);
  ctx.gob16SaveContractClause("hipoteca", "bonusRatePenaltyPct", "500");
  assert.equal(ctx.scenarioSettings.gob16DebtClauses.hipoteca.bonusRatePenaltyPct, 100);
});

test("gob16ClauseRowHtml · sin penalización declarada, la nota se queda cualitativa (comportamiento igual que antes de D7)", () => {
  const ctx = sandbox({ scenarioSettings: { gob16DebtClauses: { hipoteca: { linkedProductsCompliant: false } } } });
  const html = ctx.gob16ClauseRowHtml(CONTRACTS[0]);
  assert.match(html, /Vinculación NO cumplida: el banco podría dejar de aplicar la bonificación pactada\./);
  assert.doesNotMatch(html, /coste extra estimado/);
});

test("gob16ClauseRowHtml · con penalización declarada y vinculación incumplida, calcula el coste anual sobre el capital vivo", () => {
  const ctx = sandbox({ scenarioSettings: { gob16DebtClauses: { hipoteca: { linkedProductsCompliant: false, bonusRatePenaltyPct: 1 } } } });
  const html = ctx.gob16ClauseRowHtml(CONTRACTS[0]);
  // Hipoteca Mediolanum: currentPrincipal 150000 · penalización 1% → 1500 €/año.
  assert.match(html, /Vinculación NO cumplida: coste extra estimado de 1500 €\/año mientras no se cumpla \(TAE \+1 pto\. sobre el capital actual\)\./);
});

test("gob16ClauseRowHtml · con penalización declarada pero vinculación cumplida, avisa del coste si se incumpliera", () => {
  const ctx = sandbox({ scenarioSettings: { gob16DebtClauses: { hipoteca: { bonusRatePenaltyPct: 1 } } } });
  const html = ctx.gob16ClauseRowHtml(CONTRACTS[0]);
  assert.match(html, /Sin riesgo de vinculación declarado\. Si se incumpliera, el coste extra estimado sería de 1500 €\/año\./);
});

test("gob16ClauseRowHtml · el campo de penalización de TAE se declara junto al resto de campos de la cláusula", () => {
  const ctx = sandbox();
  const html = ctx.gob16ClauseRowHtml(CONTRACTS[0]);
  assert.match(html, /data-gob16-field="bonusRatePenaltyPct"/);
});

// --- gob16SaveContractClause ---------------------------------------------------------------------

test("gob16SaveContractClause · guarda la vinculación declarada como texto y persiste", () => {
  const ctx = sandbox();
  ctx.gob16SaveContractClause("hipoteca", "linkedProducts", "seguro de hogar, nómina");
  assert.equal(ctx.scenarioSettings.gob16DebtClauses.hipoteca.linkedProducts, "seguro de hogar, nómina");
  assert.equal(ctx.saved.length, 1);
});

test("gob16SaveContractClause · guarda el cumplimiento de vinculación (checkbox) sin tocar el resto de campos ya declarados", () => {
  const ctx = sandbox({ scenarioSettings: { gob16DebtClauses: { hipoteca: { linkedProducts: "seguro de vida" } } } });
  ctx.gob16SaveContractClause("hipoteca", "linkedProductsCompliant", false);
  assert.equal(ctx.scenarioSettings.gob16DebtClauses.hipoteca.linkedProductsCompliant, false);
  assert.equal(ctx.scenarioSettings.gob16DebtClauses.hipoteca.linkedProducts, "seguro de vida");
});

test("gob16SaveContractClause · la comisión de apertura acepta coma decimal y queda acotada a 0-100", () => {
  const ctx = sandbox();
  ctx.gob16SaveContractClause("hipoteca", "openingFeePct", "1,5");
  assert.equal(ctx.scenarioSettings.gob16DebtClauses.hipoteca.openingFeePct, 1.5);
  ctx.gob16SaveContractClause("hipoteca", "openingFeePct", "500");
  assert.equal(ctx.scenarioSettings.gob16DebtClauses.hipoteca.openingFeePct, 100);
});

test("gob16SaveContractClause · guarda el intervalo de revisión y la fecha de última revisión, por contrato independiente", () => {
  const ctx = sandbox();
  ctx.gob16SaveContractClause("hipoteca", "rateReviewIntervalMonths", "12");
  ctx.gob16SaveContractClause("hipoteca", "lastRateReviewAt", "2026-01");
  ctx.gob16SaveContractClause("coche", "rateReviewIntervalMonths", "6");
  assert.equal(ctx.scenarioSettings.gob16DebtClauses.hipoteca.rateReviewIntervalMonths, 12);
  assert.equal(ctx.scenarioSettings.gob16DebtClauses.hipoteca.lastRateReviewAt, "2026-01");
  assert.equal(ctx.scenarioSettings.gob16DebtClauses.coche.rateReviewIntervalMonths, 6);
  assert.equal(ctx.scenarioSettings.gob16DebtClauses.coche.lastRateReviewAt, "");
});

// --- gob16RateReviewStatus (reutiliza rebalanceCalendarReviewStatus real, INV17/GOB13) -----------

test("gob16RateReviewStatus · sin intervalo declarado, no calculable (null)", () => {
  const ctx = sandbox();
  assert.equal(ctx.gob16RateReviewStatus("hipoteca"), null);
});

test("gob16RateReviewStatus · con intervalo declarado y sin revisión previa, vencida desde el principio", () => {
  const ctx = sandbox({ scenarioSettings: { gob16DebtClauses: { hipoteca: { rateReviewIntervalMonths: 12 } } } });
  const status = ctx.gob16RateReviewStatus("hipoteca");
  assert.equal(status.reviewed, false);
  assert.equal(status.due, true);
});

test("gob16RateReviewStatus · revisión reciente dentro del intervalo declarado, no vencida", () => {
  const ctx = sandbox({ scenarioSettings: { gob16DebtClauses: { hipoteca: { rateReviewIntervalMonths: 12, lastRateReviewAt: "2026-08" } } } });
  const status = ctx.gob16RateReviewStatus("hipoteca");
  assert.equal(status.reviewed, true);
  assert.equal(status.due, false);
});

// --- gob16ClauseRowHtml ---------------------------------------------------------------------------

test("gob16ClauseRowHtml · sin ninguna alerta, el resumen solo lleva el nombre de la entidad", () => {
  const ctx = sandbox();
  const html = ctx.gob16ClauseRowHtml(CONTRACTS[0]);
  assert.match(html, /<summary>Hipoteca Mediolanum<\/summary>/);
  assert.doesNotMatch(html, /is-danger/);
});

test("gob16ClauseRowHtml · vinculación no cumplida, el resumen y la nota avisan", () => {
  const ctx = sandbox({ scenarioSettings: { gob16DebtClauses: { hipoteca: { linkedProductsCompliant: false } } } });
  const html = ctx.gob16ClauseRowHtml(CONTRACTS[0]);
  assert.match(html, /<summary>Hipoteca Mediolanum — revisar<\/summary>/);
  assert.match(html, /Vinculación NO cumplida/);
});

test("gob16ClauseRowHtml · revisión de diferencial vencida, el resumen y la nota avisan", () => {
  const ctx = sandbox({ scenarioSettings: { gob16DebtClauses: { hipoteca: { rateReviewIntervalMonths: 12 } } } });
  const html = ctx.gob16ClauseRowHtml(CONTRACTS[0]);
  assert.match(html, /— revisar<\/summary>/);
  assert.match(html, /Nunca declarada — toca revisarlo\./);
});

// --- renderGob16ClauseWatch ------------------------------------------------------------------------

test("renderGob16ClauseWatch · sin deudas activas, lo dice en vez de una lista vacía", () => {
  const ctx = sandbox({ contracts: [] });
  ctx.renderGob16ClauseWatch([]);
  assert.match(ctx.box.innerHTML, /Sin deudas activas que vigilar todavía\./);
});

test("renderGob16ClauseWatch · un <details> por cada deuda activa", () => {
  const ctx = sandbox();
  ctx.renderGob16ClauseWatch(CONTRACTS);
  assert.match(ctx.box.innerHTML, /Hipoteca Mediolanum/);
  assert.match(ctx.box.innerHTML, /Préstamo coche/);
  assert.equal((ctx.box.innerHTML.match(/<details/g) || []).length, 2);
});

test("renderGob16ClauseWatch · repintar preserva qué <details> estaba abierto, en vez de cerrarlo en cada cambio", () => {
  const ctx = sandbox();
  ctx.renderGob16ClauseWatch(CONTRACTS);
  // Simula que el hogar abrió el <details> de la hipoteca antes de editar un campo.
  ctx.box.innerHTML = ctx.box.innerHTML.replace('data-gob16-clause-card="hipoteca"', 'data-gob16-clause-card="hipoteca" open');
  ctx.renderGob16ClauseWatch(CONTRACTS);
  assert.match(ctx.box.innerHTML, /<details class="deuda-ruta-calendar-item" data-gob16-clause-card="hipoteca" open>/);
  assert.doesNotMatch(ctx.box.innerHTML, /data-gob16-clause-card="coche" open/);
});

// --- handleGob16ClauseFieldChange -------------------------------------------------------------------

test("handleGob16ClauseFieldChange · guarda el campo tocado y repinta la vigilancia", () => {
  const ctx = sandbox();
  ctx.handleGob16ClauseFieldChange({ dataset: { gob16ContractId: "hipoteca", gob16Field: "linkedProducts" }, type: "text", value: "seguro de hogar" });
  assert.equal(ctx.scenarioSettings.gob16DebtClauses.hipoteca.linkedProducts, "seguro de hogar");
  assert.match(ctx.box.innerHTML, /Hipoteca Mediolanum/);
});

test("handleGob16ClauseFieldChange · sin id o campo declarado, no hace nada", () => {
  const ctx = sandbox();
  ctx.handleGob16ClauseFieldChange({ dataset: {}, type: "text", value: "x" });
  assert.equal(ctx.saved.length, 0);
});

// --- wiring ------------------------------------------------------------------------------------

test("wiring: renderDeudaContratos llama a renderGob16ClauseWatch junto a DEB5/DEB16/DEB13", () => {
  const start = source.indexOf("function renderDeudaContratos(");
  const block = source.slice(start, source.indexOf("\n}\n", start) + 3);
  assert.match(block, /renderDeb13DormantExpensiveDebtAlert\(contracts\)/);
  assert.match(block, /renderGob16ClauseWatch\(contracts\)/);
});

test("wiring: index.html declara #gob16ClauseWatch dentro de #deuda-contratos, después de la tarjeta de DEB13", () => {
  assert.match(indexSource, /id="gob16ClauseWatch"/);
  const sectionStart = indexSource.indexOf('id="deuda-contratos"');
  const sectionEnd = indexSource.indexOf("</section>", sectionStart);
  const deb13Idx = indexSource.indexOf('id="deb13DormantDebtAlert"');
  const gob16Idx = indexSource.indexOf('id="gob16ClauseWatch"');
  assert.ok(sectionStart > 0 && deb13Idx > sectionStart && gob16Idx > deb13Idx && gob16Idx < sectionEnd, "GOB16 debe vivir dentro de #deuda-contratos, después de DEB13");
});

test("wiring: app.js conecta el cambio de cualquier campo de #gob16ClauseWatch con handleGob16ClauseFieldChange, envuelto en una función anónima (views/deuda.js se carga de forma perezosa)", () => {
  assert.match(appSource, /qs\("gob16ClauseWatch"\)\?\.addEventListener\("change", \(event\) => \{\s*const input = event\.target\.closest\("\[data-gob16-contract-id\]"\);\s*if \(input\) handleGob16ClauseFieldChange\(input\);\s*\}\);/);
});

test("wiring: saveScenarioSettings() incluye gob16DebtClauses en su lista explícita de campos persistidos", () => {
  const start = appSource.indexOf("function saveScenarioSettings(");
  const end = appSource.indexOf("\n}", start);
  const block = appSource.slice(start, end);
  assert.match(block, /gob16DebtClauses: scenarioSettings\.gob16DebtClauses && typeof scenarioSettings\.gob16DebtClauses === "object" \? scenarioSettings\.gob16DebtClauses : \{\},/);
});
