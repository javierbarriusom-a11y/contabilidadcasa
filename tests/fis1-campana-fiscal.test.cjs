const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const read = (name) => fs.readFileSync(path.join(root, name), "utf8");
const tax = require("../canonical-year-end-tax.js");
const pension = require("../canonical-pension-simulator.js");

// WP-23 (FIS-01 + DAC-02 + FIS-02; docs/WP23_DISENO.md): la campaña fiscal de fin de año. El motor puro (canonical-year-end-tax.js), la tarjeta
// (fiscal-campana-ui.js en un vm) y el cableado. Todas las cifras de estas pruebas son ficticias.

const TODAY = "2026-11-15";

function holder(overrides = {}) {
  return {
    id: "h1",
    label: "Declarante 1",
    annualGross: 40000,
    marginalRatePct: 30,
    estimatedResult: 800,
    currentWithholdingPct: 15,
    pension: { contributedYear: 0, hasEmployerPlan: false },
    housing: { applies: true, paidYear: 6000 },
    capital: { realizedNet: 3000, latentLosses: 2000, savingsRatePct: 19 },
    donations: { amountYear: 0 },
    ...overrides,
  };
}

const campaign = (holders, extra = {}) => tax.buildCampaign({ year: 2026, holders, ...extra }, { today: TODAY });
const action = (result, id) => result.actions.find((item) => item.id === id);
const only = (result, id) => action(result, id).rows[0].result;

// ---- Vivienda (DAC-02) ----
test("vivienda: por debajo del tope, el ahorro es el 15 % de lo que cabe todavía", () => {
  const result = only(campaign([holder({ housing: { applies: true, paidYear: 6000 } })]), "vivienda");
  assert.equal(result.status, "calculable");
  assert.equal(result.annualCap, 9040);
  assert.equal(result.room, 3040);
  assert.equal(result.savingEur, 456, "3.040 × 15 %");
  assert.equal(result.securedEur, 900, "6.000 × 15 % ya asegurado");
  assert.equal(result.full, false);
});

test("vivienda: justo en el tope no queda nada que ahorrar; por encima, lo de más no deduce", () => {
  const exact = only(campaign([holder({ housing: { applies: true, paidYear: 9040 } })]), "vivienda");
  assert.equal(exact.room, 0);
  assert.equal(exact.savingEur, 0);
  assert.equal(exact.full, true);
  assert.equal(exact.overCap, 0);
  const over = only(campaign([holder({ housing: { applies: true, paidYear: 12000 } })]), "vivienda");
  assert.equal(over.deductibleBase, 9040);
  assert.equal(over.securedEur, 1356, "9.040 × 15 %");
  assert.equal(over.overCap, 2960);
  assert.equal(over.savingEur, 0);
});

test("vivienda: cada declarante tiene su propio tope (dos declarantes) y la acción suma los dos", () => {
  const result = campaign([holder({ id: "a", housing: { applies: true, paidYear: 5040 } }), holder({ id: "b", housing: { applies: true, paidYear: 7040 } })]);
  assert.deepEqual(action(result, "vivienda").rows.map((row) => row.result.room), [4000, 2000]);
  assert.equal(action(result, "vivienda").savingEur, 900, "(4.000 + 2.000) × 15 %");
});

test("vivienda: si solo uno tiene derecho, el otro sale «no aplica» y no cuenta; sin saber si aplica es «sin dato»", () => {
  const result = campaign([holder({ id: "a" }), holder({ id: "b", housing: { applies: false, paidYear: 8000 } })]);
  assert.equal(action(result, "vivienda").rows[1].result.status, "no_aplica");
  assert.equal(action(result, "vivienda").savingEur, 456);
  assert.equal(action(result, "vivienda").partial, false);
  const unknown = only(campaign([holder({ housing: { applies: null } })]), "vivienda");
  assert.equal(unknown.status, "sin_dato");
  assert.match(unknown.missing[0], /si aplica la deducción por vivienda/);
  const noPaid = only(campaign([holder({ housing: { applies: true, paidYear: null } })]), "vivienda");
  assert.equal(noPaid.status, "sin_dato");
  assert.match(noPaid.missing[0], /lo pagado este año por la vivienda/);
});

// ---- Pensiones ----
test("pensiones: el límite viene del año y coincide con el del simulador A15-4 (si divergen, hay que decidir cuál manda)", () => {
  assert.equal(tax.parametersFor(2026).pension.individualLimit, pension.limitForYear(2026));
  const result = only(campaign([holder({ pension: { contributedYear: 500, hasEmployerPlan: false } })]), "pensiones");
  assert.equal(result.limit, 1500);
  assert.equal(result.room, 1000);
  assert.equal(result.savingEur, 300, "1.000 × 30 %");
  assert.equal(result.netCostEur, 700, "ahorrar impuestos no es coste cero: queda inmovilizado");
});

test("pensiones: con el límite cubierto no queda nada; con plan de empresa no se calcula; el tope por liquidez recorta la aportación", () => {
  assert.equal(only(campaign([holder({ pension: { contributedYear: 1500, hasEmployerPlan: false } })]), "pensiones").full, true);
  assert.equal(only(campaign([holder({ pension: { contributedYear: 0, hasEmployerPlan: true } })]), "pensiones").status, "no_aplica");
  const capped = only(campaign([holder({ pension: { contributedYear: 0, hasEmployerPlan: false, availableToContribute: 400 } })]), "pensiones");
  assert.equal(capped.amount, 400);
  assert.equal(capped.savingEur, 120);
  assert.equal(capped.room, 1500, "el hueco legal sigue siendo el del límite");
});

test("pensiones: falta de dato = no calculable, y dice cuál (lo aportado, el tipo marginal, el plan de empresa)", () => {
  const result = only(campaign([holder({ marginalRatePct: null, pension: { contributedYear: null, hasEmployerPlan: null } })]), "pensiones");
  assert.equal(result.status, "sin_dato");
  assert.equal(result.missing.length, 3);
});

// ---- Compensación ----
test("compensación: con plusvalía y minusvalías latentes, compensa el menor de los dos al tipo del ahorro", () => {
  const result = only(campaign([holder()]), "compensacion");
  assert.equal(result.amount, 2000, "min(3.000; 2.000)");
  assert.equal(result.savingEur, 380, "2.000 × 19 %");
  assert.equal(result.repurchaseMonths, 2);
  assert.equal(only(campaign([holder({ capital: { realizedNet: 800, latentLosses: 2000, savingsRatePct: 19 } })]), "compensacion").amount, 800, "no compensa más de la plusvalía");
});

test("compensación: sin minusvalías latentes o sin plusvalía neta no hay nada que hacer; sin dato no se calcula", () => {
  assert.equal(only(campaign([holder({ capital: { realizedNet: 3000, latentLosses: 0, savingsRatePct: 19 } })]), "compensacion").status, "no_aplica");
  const noGain = only(campaign([holder({ capital: { realizedNet: -400, latentLosses: 2000, savingsRatePct: 19 } })]), "compensacion");
  assert.equal(noGain.status, "no_aplica");
  assert.match(noGain.reason, /4 años/);
  assert.equal(only(campaign([holder({ capital: { realizedNet: null, latentLosses: null, savingsRatePct: null } })]), "compensacion").missing.length, 3);
});

// ---- Donativos ----
test("donativos: los dos tramos (80 % de los primeros 250 € y 40 % del resto; 45 % si hay recurrencia)", () => {
  assert.equal(only(campaign([holder({ donations: { amountYear: 100 } })]), "donativos").savingEur, 80, "solo primer tramo");
  const both = only(campaign([holder({ donations: { amountYear: 300 } })]), "donativos");
  assert.equal(both.savingEur, 220, "250 × 80 % + 50 × 40 %");
  assert.equal(both.netCostEur, 80);
  assert.equal(only(campaign([holder({ donations: { amountYear: 300, recurring: true } })]), "donativos").savingEur, 222.5, "el resto al 45 %");
  assert.equal(only(campaign([holder({ donations: { amountYear: 0 } })]), "donativos").status, "no_aplica");
  assert.equal(only(campaign([holder({ donations: { amountYear: null } })]), "donativos").status, "sin_dato");
});

// ---- Retención (FIS-02) ----
test("retención: el tipo adicional se redondea hacia arriba y se presenta como caja, nunca como ahorro", () => {
  const result = only(campaign([holder({ estimatedResult: 900, annualGross: 42000, currentWithholdingPct: 17 })]), "retencion");
  assert.equal(result.extraPct, 2.15, "900 / 42.000 = 2,1428 % → 2,15");
  assert.equal(result.suggestedPct, 19.15);
  assert.equal(result.savingEur, 0);
  assert.equal(result.cashEur, 900);
  const retention = action(campaign([holder({ estimatedResult: 900, annualGross: 42000 })]), "retencion");
  assert.equal(retention.hasSaving, false);
  assert.equal(retention.deadline, null, "no tiene fecha límite del 31/12");
  assert.equal(retention.cashEur, 900);
});

test("retención: con devolución esperada no se puede pedir menos; sin bruto o sin resultado no se calcula", () => {
  assert.equal(only(campaign([holder({ estimatedResult: -300 })]), "retencion").status, "no_aplica");
  assert.equal(only(campaign([holder({ annualGross: null })]), "retencion").status, "sin_dato");
  assert.equal(only(campaign([holder({ estimatedResult: null })]), "retencion").status, "sin_dato");
  assert.equal(only(campaign([holder({ currentWithholdingPct: null })]), "retencion").suggestedPct, null, "sin el tipo actual no inventa el sugerido");
});

// ---- «Sin dato = no calculable» y agregado ----
test("sin ningún dato fiscal, ninguna acción se calcula y el total es 0 (nunca una cifra inventada)", () => {
  const result = campaign([{ id: "h1", label: "Declarante" }]);
  assert.equal(result.calculable, true);
  assert.equal(result.totalSavingEur, 0);
  assert.equal(result.calculableCount, 0);
  assert.ok(result.actions.every((item) => item.status === "sin_dato" && item.savingEur === null));
  assert.equal(result.missingCount, result.actions.length);
});

test("una acción calculada para un declarante y sin dato para el otro sale «parcial» y solo suma el calculado", () => {
  const result = campaign([holder({ id: "a" }), holder({ id: "b", housing: { applies: null } })]);
  assert.equal(action(result, "vivienda").status, "calculable");
  assert.equal(action(result, "vivienda").partial, true);
  assert.equal(action(result, "vivienda").savingEur, 456);
  assert.match(action(result, "vivienda").missing[0], /si aplica/);
});

test("la lista va por euros: primero lo calculable de más a menos, luego lo que falta, al final lo que no aplica", () => {
  const result = campaign([holder({ pension: { contributedYear: 0, hasEmployerPlan: false }, donations: { amountYear: null }, housing: { applies: false } })]);
  const statuses = result.actions.map((item) => item.status);
  const firstSinDato = statuses.indexOf("sin_dato");
  const firstNoAplica = statuses.indexOf("no_aplica");
  assert.ok(firstSinDato > statuses.lastIndexOf("calculable"));
  assert.ok(firstNoAplica > statuses.lastIndexOf("sin_dato"));
  const savings = result.actions.filter((item) => item.status === "calculable").map((item) => item.savingEur);
  assert.deepEqual(savings, [...savings].sort((a, b) => b - a));
  assert.equal(result.totalSavingEur, Math.round(savings.reduce((a, b) => a + b, 0) * 100) / 100);
});

test("cada acción trae su fecha límite del 31/12 (salvo la retención) y su fuente; los parámetros viajan sin verificar", () => {
  const result = campaign([holder()]);
  ["vivienda", "pensiones", "compensacion", "donativos"].forEach((id) => assert.equal(action(result, id).deadline, "2026-12-31"));
  assert.ok(result.actions.every((item) => item.reference.length > 20));
  assert.ok(result.actions.every((item) => item.verified === false), "ningún parámetro legal está contrastado todavía con la fuente oficial");
  assert.match(result.warning, /asesor fiscal/);
  assert.equal(result.rentaYear, 2027);
});

// ---- Calendario de la campaña ----
test("fases de la campaña: preparación antes del 1/11, abierta del 1/11 al 31/12, cerrada después", () => {
  const at = (today) => tax.buildCampaign({ year: 2026, holders: [holder()] }, { today });
  assert.deepEqual([at("2026-10-06").phase, at("2026-10-06").daysToOpen, at("2026-10-06").daysLeft], ["preparacion", 26, 86]);
  assert.deepEqual([at("2026-11-01").phase, at("2026-11-01").daysToOpen], ["abierta", 0]);
  assert.equal(at("2026-12-31").daysLeft, 0);
  assert.equal(at("2026-12-31").phase, "abierta");
  assert.equal(at("2027-01-01").phase, "cerrada");
  assert.equal(tax.buildCampaign({ year: 2026, holders: [holder()] }).phase, "abierta", "sin fecha de hoy no inventa la cuenta atrás");
});

test("parámetros: un año sin tabla propia hereda la del último conocido y lo dice; se pueden sustituir por los del hogar", () => {
  assert.equal(tax.parametersFor(2025), null, "antes de la primera tabla no hay parámetros");
  const next = tax.parametersFor(2027);
  assert.equal(next.inheritedFromYear, 2026);
  assert.equal(next.housing.annualCap, 9040);
  const custom = campaign([holder({ housing: { applies: true, paidYear: 6000 } })], { parameters: { housing: { annualCap: 10000, verified: true } } });
  assert.equal(only(custom, "vivienda").room, 4000);
  assert.equal(action(custom, "vivienda").verified, true);
});

test("buildCampaign no se cae con entradas malas: sin año, sin parámetros o sin declarantes no calcula y dice por qué", () => {
  assert.equal(tax.buildCampaign({ holders: [holder()] }).reason, "missing-year");
  assert.equal(tax.buildCampaign({ year: 1999, holders: [holder()] }).reason, "missing-year");
  assert.equal(tax.buildCampaign({ year: 2020, holders: [holder()] }).reason, "no-parameters");
  assert.equal(tax.buildCampaign({ year: 2026, holders: [] }).reason, "no-holders");
  assert.equal(tax.buildCampaign({ year: 2026, holders: [null, {}] }).reason, "no-holders");
  assert.equal(tax.buildCampaign().calculable, false);
});

test("el hogar de ejemplo está marcado como ejemplo, es inmutable y sale una lista completa y cuadrada", () => {
  assert.equal(tax.EXAMPLE_HOUSEHOLD.example, true);
  assert.ok(Object.isFrozen(tax.EXAMPLE_HOUSEHOLD) && Object.isFrozen(tax.EXAMPLE_HOUSEHOLD.holders[0]));
  const result = tax.buildCampaign(tax.EXAMPLE_HOUSEHOLD, { today: "2026-10-06" });
  assert.equal(result.example, true);
  assert.equal(result.totalSavingEur, 1746, "690 pensiones + 456 vivienda + 380 compensación + 220 donativos");
  assert.deepEqual(result.actions.map((item) => item.id), ["pensiones", "vivienda", "compensacion", "donativos", "retencion"]);
  assert.equal(result.calculableCount, 4);
  assert.equal(result.missingCount, 0);
  assert.equal(tax.buildCampaign({ ...tax.EXAMPLE_HOUSEHOLD, example: false }, { today: TODAY }).example, false);
});

// ---- Tarjeta (fiscal-campana-ui.js en un vm) ----
function fakeElement() {
  return { innerHTML: "", hidden: true, dataset: {} };
}

function uiSandbox({ today = "2026-10-06" } = {}) {
  const elements = { campanaFiscalCard: fakeElement(), campanaFiscalCuerpo: fakeElement() };
  const sandbox = {
    qs: (id) => elements[id] || null,
    isoLocalDate: () => today,
    escapeHtml: (value) => String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char])),
    money: (value) => `${String(Math.round(value)).replace(/\B(?=(\d{3})+(?!\d))/g, ".")} €`,
    Date,
  };
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(`${read("fiscal-campana-ui.js")}\nthis.api = { renderFiscalCampaign, fiscalCampaignAmount, fiscalCampaignCountdown, fiscalCampaignDate };`, sandbox);
  return { api: sandbox.api, elements };
}

test("tarjeta con el ejemplo: muestra la tarjeta, la marca y el aviso, y todas las cifras llevan la marca de ejemplo", () => {
  const { api, elements } = uiSandbox();
  api.renderFiscalCampaign(tax);
  const { campanaFiscalCard: card, campanaFiscalCuerpo: body } = elements;
  assert.equal(card.hidden, false);
  assert.equal(card.dataset.ejemplo, "true");
  assert.match(body.innerHTML, /role="note"><strong>Cifras de ejemplo\.<\/strong>/);
  assert.match(body.innerHTML, /<span class="fc-cifra fc-cifra-ejemplo">1\.746 €<span class="sr-only"> \(cifra de ejemplo\)<\/span><\/span>/);
  const cifras = body.innerHTML.match(/class="fc-cifra[ "]/g).length;
  const marcadas = body.innerHTML.match(/fc-cifra fc-cifra-ejemplo/g).length;
  assert.equal(marcadas, cifras, "ninguna cifra del ejemplo sin marcar");
  assert.match(body.innerHTML, /La campaña se abre el 1 de noviembre de 2026 \(en 26 días\)\. Quedan 86 días hasta el 31 de diciembre de 2026\./);
  assert.match(body.innerHTML, /de ahorro estimado en la Renta de 2027 si se hacen las 4 acciones con ahorro/);
  assert.equal((body.innerHTML.match(/<li class="fc-accion /g) || []).length, 5);
  assert.match(body.innerHTML, /Antes del 31 de diciembre/);
  assert.match(body.innerHTML, /Pendiente de contrastar con la fuente oficial/);
  assert.match(body.innerHTML, /La app nunca ejecuta nada por sí sola/);
});

test("tarjeta con datos reales (example: false): ni aviso ni marcas de ejemplo", () => {
  const { api, elements } = uiSandbox({ today: "2026-11-20" });
  api.renderFiscalCampaign({ ...tax, EXAMPLE_HOUSEHOLD: { ...tax.EXAMPLE_HOUSEHOLD, example: false } });
  const body = elements.campanaFiscalCuerpo.innerHTML;
  assert.equal(elements.campanaFiscalCard.dataset.ejemplo, "false");
  assert.doesNotMatch(body, /Cifras de ejemplo|fc-cifra-ejemplo|cifra de ejemplo/);
  assert.match(body, /Quedan 41 días hasta el 31 de diciembre de 2026\./);
  assert.doesNotMatch(body, /se abre el/, "abierta: no habla de apertura");
});

test("tarjeta: una acción sin dato dice qué falta; una que no aplica lo dice; nada se escapa sin escapar", () => {
  const { api, elements } = uiSandbox();
  const evil = { ...tax, EXAMPLE_HOUSEHOLD: { year: 2026, example: true, holders: [{ id: "x", label: "<img src=x onerror=alert(1)>" }] } };
  api.renderFiscalCampaign(evil);
  const body = elements.campanaFiscalCuerpo.innerHTML;
  assert.doesNotMatch(body, /<img/);
  assert.match(body, /&lt;img src=x onerror=alert\(1\)&gt;/);
  assert.match(body, /Sin calcular/);
  assert.match(body, /Para calcularla necesito: lo aportado este año al plan de pensiones; el tipo marginal de IRPF/);
  assert.match(body, /Falta: /);
});

test("tarjeta: si el motor no puede calcular (sin declarantes), la tarjeta se oculta; sin motor no hace nada", () => {
  const { api, elements } = uiSandbox();
  elements.campanaFiscalCard.hidden = false;
  api.renderFiscalCampaign({ ...tax, EXAMPLE_HOUSEHOLD: { year: 2026, holders: [] } });
  assert.equal(elements.campanaFiscalCard.hidden, true);
  const untouched = uiSandbox();
  untouched.api.renderFiscalCampaign(null);
  assert.equal(untouched.elements.campanaFiscalCard.hidden, true);
});

test("cuenta atrás: singular, plural y campaña cerrada", () => {
  const { api } = uiSandbox();
  const at = (today) => api.fiscalCampaignCountdown(tax.buildCampaign({ year: 2026, holders: [holder()] }, { today }));
  assert.match(at("2026-12-30"), /^Quedan 1 día hasta/);
  assert.match(at("2026-12-31"), /^Quedan 0 días hasta/);
  assert.match(at("2026-10-31"), /\(en 1 día\)/);
  assert.match(at("2027-02-01"), /terminó el 31 de diciembre de 2026/);
});

// ---- Cableado y diseño ----
test("cableado: index.html tiene la tarjeta (oculta y marcada como ejemplo por defecto), la hoja de estilos y los scripts antes de app.js", () => {
  const index = read("index.html");
  ["campanaFiscalCard", "campanaFiscalTitulo", "campanaFiscalCuerpo"].forEach((id) => assert.equal((index.match(new RegExp(`id="${id}"`, "g")) || []).length, 1, `#${id}`));
  assert.match(index, /<article class="e19-card fc-campana" id="campanaFiscalCard" data-ejemplo="true" aria-labelledby="campanaFiscalTitulo" hidden>/);
  assert.match(index, /<span class="fc-etiqueta-ejemplo"[^>]*>Ejemplo<\/span>/);
  const fiscal = index.slice(index.indexOf('id="herramientas-fiscal"'));
  assert.ok(fiscal.indexOf('id="campanaFiscalCard"') > 0 && fiscal.indexOf('id="campanaFiscalCard"') < fiscal.indexOf("Estimador de resultado de IRPF"), "la campaña es la primera tarjeta de Fiscal");
  const at = (name) => index.indexOf(`src="${name}`);
  assert.ok(at("canonical-year-end-tax.js") > 0 && at("canonical-year-end-tax.js") < at("fiscal-campana-ui.js"));
  assert.ok(at("fiscal-campana-ui.js") < at("app.js"));
  assert.match(index, /<link rel="stylesheet" href="fiscal-campana\.css\?v=\d+wp23a1" \/>/);
  ["canonical-year-end-tax.js", "fiscal-campana-ui.js", "fiscal-campana.css"].forEach((name) => {
    assert.match(read("service-worker.js"), new RegExp(`"\\./${name.replace(".", "\\.")}",`), `${name} en el service worker`);
    assert.match(read("tools/build-public-site.mjs"), new RegExp(`"${name.replace(".", "\\.")}",`), `${name} en el build del sitio`);
  });
});

test("cableado: app.js pinta la tarjeta al llegar a Fiscal, pasando el motor, y sigue bajo el techo de líneas", () => {
  const app = read("app.js");
  assert.match(app, /case "herramientas-fiscal":\n\s+renderAjustes\(\);\n\s+globalThis\.renderFiscalCampaign\?\.\(globalThis\.FinanceCanonicalYearEndTax\);/);
  const lines = app.split("\n").length;
  assert.ok(lines <= 37495, `app.js tiene ${lines} líneas (techo 37.495)`);
});

test("fiscal-campana-ui.js no toca el DOM al cargarse (se ejecuta antes que app.js): solo declara funciones", () => {
  const source = read("fiscal-campana-ui.js");
  const topLevel = source.split("\n").filter((line) => /^(qs\(|document\.|window\.)/.test(line));
  assert.deepEqual(topLevel, []);
});

test("diseño: la marca de ejemplo no depende solo del color y todos los colores salen de tokens (claro, oscuro y alto contraste)", () => {
  const css = read("fiscal-campana.css");
  assert.doesNotMatch(css.replace(/\/\*[\s\S]*?\*\//g, ""), /#[0-9a-fA-F]{3,8}\b|rgba?\(/, "ni un color suelto: todo con var(--e19-…)");
  assert.match(css, /\.fc-campana\[data-ejemplo="true"\] \{\n\s+border-style: dashed;/, "borde discontinuo");
  assert.match(css, /repeating-linear-gradient\(135deg/, "sombreado diagonal");
  assert.match(css, /\.fc-cifra-ejemplo \{\n\s+text-decoration: underline dotted;/, "cifra con subrayado punteado");
  assert.match(css, /@media \(prefers-contrast: more\) \{\n\s+\.fc-campana\[data-ejemplo="true"\] \{\n\s+background-image: none;/);
  assert.match(css, /\.fc-campana\[data-ejemplo="false"\] \.fc-etiqueta-ejemplo \{\n\s+display: none;/);
});

test("documentación: el diseño cerrado existe y recoge la desviación de FIS-02", () => {
  const design = read("docs/WP23_DISENO.md");
  assert.match(design, /FIS-02/);
  assert.match(design, /2027/);
  assert.match(design, /ejemplo/i);
});
