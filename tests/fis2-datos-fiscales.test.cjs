const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const read = (name) => fs.readFileSync(path.join(root, name), "utf8");
const tax = require("../canonical-year-end-tax.js");
const shell = require("../ux-shell.js");

// WP-23 PR-2: «Tus datos fiscales». Lo que el hogar debe poder fiar: que un campo vacío NUNCA se convierta en un 0 (vacío = «sin calcular»), que un 0 escrito sí cuente,
// que una cifra mala no se guarde ni se corrija en silencio, que los datos de otro año no se usen y que los datos viajen en la copia. TODAS las cifras de estas pruebas son
// ficticias y redondas: el repositorio es público y los datos reales solo viven en el almacén privado de la app.

const full = (extra = {}) => ({
  id: "persona-1",
  label: "Ana",
  values: { annualGross: 40000, marginalRatePct: 30, estimatedResult: 800, currentWithholdingPct: 15, pensionContributed: 500, pensionAvailable: null, housingPaid: 6000, realizedNet: 2000, latentLosses: 1000, savingsRatePct: 19, donationsAmount: 300 },
  choices: { hasEmployerPlan: false, housingApplies: true },
  recurring: false,
  ...extra,
});

// ---- Motor: vacío no es cero ----

test("PR-2 · vacío es «sin dato» y un 0 escrito es un cero de verdad: no se confunden en ningún campo", () => {
  const vacio = tax.holderFromInput({ id: "persona-1", values: {}, choices: {} });
  assert.deepEqual(vacio.errors, {});
  tax.FIELD_SPECS.forEach((spec) => {
    let node = vacio.holder;
    spec.path.forEach((key) => { node = node?.[key]; });
    assert.equal(node, null, `${spec.id} vacío debe quedar en null, no en 0`);
  });
  assert.equal(vacio.holder.pension.hasEmployerPlan, null);
  assert.equal(vacio.holder.housing.applies, null);
  ["", null, undefined].forEach((blank) => assert.equal(tax.holderFromInput({ id: "a", values: { pensionContributed: blank } }).holder.pension.contributedYear, null));
  const cero = tax.holderFromInput({ id: "a", values: { pensionContributed: 0, donationsAmount: 0, realizedNet: 0 } }).holder;
  assert.equal(cero.pension.contributedYear, 0);
  assert.equal(cero.donations.amountYear, 0);
  assert.equal(cero.capital.realizedNet, 0);
});

test("PR-2 · la diferencia llega al cálculo: aportado «vacío» = sin calcular; aportado «0» = caben los 1.500 € del límite", () => {
  const base = { id: "persona-1", values: { marginalRatePct: 30 }, choices: { hasEmployerPlan: false } };
  const blank = tax.holderFromInput({ ...base, values: { ...base.values, pensionContributed: null } }).holder;
  const zero = tax.holderFromInput({ ...base, values: { ...base.values, pensionContributed: 0 } }).holder;
  const pension = (holder) => tax.buildCampaign({ year: 2026, holders: [holder] }).actions.find((action) => action.id === "pensiones");
  assert.equal(pension(blank).status, "sin_dato");
  assert.match(pension(blank).missing.join(" "), /aportado este año/);
  assert.equal(pension(blank).savingEur, null, "sin dato no hay cifra");
  assert.equal(pension(zero).status, "calculable");
  assert.equal(pension(zero).savingEur, 450, "1.500 € de hueco × 30 %");
});

test("PR-2 · una acción con solo parte de los datos sale «sin calcular» y dice cuáles faltan; el total solo suma lo calculado", () => {
  const holder = tax.holderFromInput({ id: "persona-1", label: "Ana", values: { marginalRatePct: 30, pensionContributed: 0 }, choices: { hasEmployerPlan: false } }).holder;
  const campaign = tax.buildCampaign({ year: 2026, holders: [holder] });
  const byId = Object.fromEntries(campaign.actions.map((action) => [action.id, action]));
  assert.equal(byId.pensiones.status, "calculable");
  ["vivienda", "compensacion", "donativos", "retencion"].forEach((id) => assert.equal(byId[id].status, "sin_dato", id));
  assert.equal(campaign.totalSavingEur, 450, "solo pensiones suma");
  assert.equal(campaign.missingCount, 4);
  assert.equal(campaign.example, false);
});

// ---- Motor: validación ----

test("PR-2 · una cifra que no es un número no se guarda como 0: sale un error que dice cuál es", () => {
  const { holder, errors } = tax.holderFromInput({ id: "a", values: { annualGross: Number.NaN, donationsAmount: 100 } });
  assert.match(errors.annualGross, /No entiendo el bruto anual/);
  assert.equal(holder.annualGross, null, "ni 0 ni el texto");
  assert.equal(holder.donations.amountYear, 100, "lo demás sigue en su sitio");
});

test("PR-2 · fuera de rango no se corrige en silencio: error con el rango; los extremos valen", () => {
  tax.FIELD_SPECS.forEach((spec) => {
    const dentroMin = tax.holderFromInput({ id: "a", values: { [spec.id]: spec.min } });
    const dentroMax = tax.holderFromInput({ id: "a", values: { [spec.id]: spec.max } });
    assert.deepEqual(dentroMin.errors, {}, `${spec.id} en su mínimo`);
    assert.deepEqual(dentroMax.errors, {}, `${spec.id} en su máximo`);
    const bajo = tax.holderFromInput({ id: "a", values: { [spec.id]: spec.min - 1 } });
    const alto = tax.holderFromInput({ id: "a", values: { [spec.id]: spec.max + 1 } });
    assert.ok(bajo.errors[spec.id] && alto.errors[spec.id], `${spec.id} fuera de rango da error`);
    assert.match(alto.errors[spec.id], new RegExp(spec.kind === "pct" ? "%" : "€"));
  });
  assert.match(tax.holderFromInput({ id: "a", values: { marginalRatePct: 300 } }).errors.marginalRatePct, /entre 0 % y 60 %/);
  assert.match(tax.holderFromInput({ id: "a", values: { pensionContributed: -5 } }).errors.pensionContributed, /entre 0 € y 100\.000 €/);
  assert.deepEqual(tax.holderFromInput({ id: "a", values: { estimatedResult: -900, realizedNet: -2500 } }).errors, {}, "a devolver y las minusvalías son negativos");
});

test("PR-2 · sí / no / «no lo sé»: solo true y false cuentan; cualquier otra cosa es «no lo sé», nunca un «no»", () => {
  const choice = (value) => tax.holderFromInput({ id: "a", choices: { hasEmployerPlan: value, housingApplies: value } }).holder;
  assert.equal(choice(true).pension.hasEmployerPlan, true);
  assert.equal(choice(false).pension.hasEmployerPlan, false);
  [null, undefined, "", "no", "si", 0, 1].forEach((value) => {
    assert.equal(choice(value).pension.hasEmployerPlan, null, `${JSON.stringify(value)}`);
    assert.equal(choice(value).housing.applies, null);
  });
});

test("PR-2 · el nombre se limpia (control, espacios, 40 caracteres) y 'recurrente' solo vale true si es true", () => {
  const { holder } = tax.holderFromInput({ id: " persona-1 ", label: "  Ana\u0000\u0007  \n  María  de las Nieves Fernández de la Peña González Ruiz  ", recurring: "true" });
  assert.equal(holder.id, "persona-1");
  assert.ok(holder.label.length <= 40);
  assert.doesNotMatch(holder.label, /[\u0000-\u001f]/);
  assert.equal(holder.donations.recurring, false, "'true' como texto no es true");
  assert.equal(tax.holderFromInput({ id: "a", recurring: true }).holder.donations.recurring, true);
});

test("PR-2 · «tiene datos»: un 0 escrito sí; el nombre solo, la casilla recurrente sola o nada, no", () => {
  assert.equal(tax.holderHasData(tax.holderFromInput({ id: "a", label: "Ana" }).holder), false);
  assert.equal(tax.holderHasData(tax.holderFromInput({ id: "a", recurring: true }).holder), false);
  assert.equal(tax.holderHasData(tax.holderFromInput({ id: "a", values: { donationsAmount: 0 } }).holder), true, "un 0 escrito es un dato");
  assert.equal(tax.holderHasData(tax.holderFromInput({ id: "a", choices: { housingApplies: false } }).holder), true, "un «no» es un dato");
  assert.equal(tax.holderHasData(tax.holderFromInput({ id: "a", choices: { housingApplies: null } }).holder), false, "un «no lo sé» no lo es");
  assert.equal(tax.holderHasData(null), false);
});

// ---- Motor: el almacén ----

test("PR-2 · normalizeStore: lo dañado o ajeno da un almacén vacío válido, nunca revienta ni inventa datos", () => {
  [null, undefined, "texto", 42, [], {}, { holders: "no" }, { holders: [null, 3, "x"] }].forEach((raw) => {
    const store = tax.normalizeStore(raw);
    assert.equal(store.schemaId, tax.STORE_SCHEMA_ID);
    assert.deepEqual(store.holders, [], JSON.stringify(raw));
    assert.equal(store.year, null);
  });
});

test("PR-2 · normalizeStore: tope de declarantes, ids únicos, fichas sin datos fuera y valores dañados vuelven a «sin dato»", () => {
  const a = tax.holderFromInput(full()).holder;
  const b = tax.holderFromInput(full({ id: "persona-1", label: "Luis" })).holder; // id repetido a propósito
  const c = tax.holderFromInput(full({ id: "persona-3", label: "Tercero" })).holder;
  const store = tax.normalizeStore({ year: 2026, updatedAt: "2026-10-20", holders: [a, b, c, { id: "vacio" }] });
  assert.equal(store.holders.length, tax.MAX_HOLDERS, "tope");
  assert.equal(new Set(store.holders.map((holder) => holder.id)).size, store.holders.length, "ids únicos");
  const dañado = tax.normalizeStore({ year: 2026, holders: [{ id: "p", annualGross: 40000, marginalRatePct: 999, pension: { contributedYear: "abc", hasEmployerPlan: "quizá" }, housing: { applies: 1 } }] }).holders[0];
  assert.equal(dañado.annualGross, 40000);
  assert.equal(dañado.marginalRatePct, null, "fuera de rango → sin dato, no 60");
  assert.equal(dañado.pension.contributedYear, null, "texto → sin dato, no 0");
  assert.equal(dañado.pension.hasEmployerPlan, null);
  assert.equal(dañado.housing.applies, null);
  assert.equal(tax.normalizeStore({ year: 1900, holders: [a] }).year, null);
  assert.equal(tax.normalizeStore({ year: 2026, updatedAt: "ayer", holders: [a] }).updatedAt, null);
});

test("PR-2 · el almacén es idempotente: normalizar lo ya normalizado no cambia nada", () => {
  const once = tax.normalizeStore({ year: 2026, updatedAt: "2026-10-20", holders: [tax.holderFromInput(full()).holder, tax.holderFromInput(full({ id: "persona-2", label: "Luis" })).holder] });
  assert.deepEqual(tax.normalizeStore(JSON.parse(JSON.stringify(once))), once);
});

test("PR-2 · resolveHousehold: datos de este año → reales; sin datos → vacío; de otro año → no se usan", () => {
  const holder = tax.holderFromInput(full()).holder;
  const real = tax.resolveHousehold({ year: 2026, updatedAt: "2026-10-20", holders: [holder] }, 2026);
  assert.equal(real.status, "real");
  assert.equal(real.household.example, false);
  assert.equal(real.household.year, 2026);
  assert.equal(real.updatedAt, "2026-10-20");
  assert.equal(tax.resolveHousehold(null, 2026).status, "empty");
  assert.equal(tax.resolveHousehold({ year: 2026, holders: [] }, 2026).status, "empty");
  const stale = tax.resolveHousehold({ year: 2026, holders: [holder] }, 2027);
  assert.equal(stale.status, "stale-year");
  assert.equal(stale.household, null, "no se calcula 2027 con datos de 2026");
  assert.equal(stale.storedYear, 2026);
  assert.equal(tax.resolveHousehold({ holders: [holder] }, 2026).status, "stale-year", "sin año guardado tampoco se asume");
});

test("PR-2 · de punta a punta: lo tecleado entra en la campaña con las cifras que dice la aritmética, sin marcas de ejemplo", () => {
  const ana = tax.holderFromInput(full()).holder;
  const luis = tax.holderFromInput(full({ id: "persona-2", label: "Luis", values: { ...full().values, pensionContributed: 1500, housingPaid: 9040 } })).holder;
  const { household } = tax.resolveHousehold({ year: 2026, holders: [ana, luis] }, 2026);
  const campaign = tax.buildCampaign(household, { today: "2026-11-20" });
  assert.equal(campaign.example, false);
  const byId = Object.fromEntries(campaign.actions.map((action) => [action.id, action]));
  // Ana: pensiones (1.500 − 500) × 30 % = 300; Luis ya cubrió el límite → 0. Total pensiones = 300.
  assert.equal(byId.pensiones.savingEur, 300);
  // Vivienda: Ana (9.040 − 6.000) × 15 % = 456; Luis tope lleno → 0.
  assert.equal(byId.vivienda.savingEur, 456);
  assert.equal(byId.compensacion.status, "calculable");
  assert.equal(campaign.holders.map((holder) => holder.label).join(","), "Ana,Luis");
});

// ---- Pantalla (fiscal-datos-ui.js y fiscal-campana-ui.js en un vm) ----

function fakeElement() {
  return { innerHTML: "", hidden: true, dataset: {}, childElementCount: 0, contains: () => false };
}

function uiSandbox({ today = "2026-10-20", stored = {} } = {}) {
  const elements = { campanaFiscalCard: fakeElement(), campanaFiscalCuerpo: fakeElement(), campanaFiscalDatos: fakeElement() };
  const writes = [];
  const sandbox = {
    qs: (id) => elements[id] || null,
    isoLocalDate: () => today,
    escapeHtml: (value) => String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char])),
    money: (value) => `${String(Math.round(value)).replace(/\B(?=(\d{3})+(?!\d))/g, ".")} €`,
    storageKey: (name) => `casa:${name}`,
    storageGet: (key, fallback) => (Object.prototype.hasOwnProperty.call(stored, key) ? stored[key] : fallback),
    storageSet: (key, value) => { stored[key] = value; writes.push([key, value]); },
    queueRemoteSave: () => writes.push(["queueRemoteSave"]),
    announceStatus: () => {},
    showUndoToast: () => {},
    FinanceUxShell: shell,
    FinanceCanonicalYearEndTax: tax,
    document: { activeElement: null, addEventListener: () => {} },
    Date,
  };
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(`${read("fiscal-datos-ui.js")}\n${read("fiscal-campana-ui.js")}\nthis.api = { renderFiscalCampaign, renderFiscalDatos, fiscalDatosResolve, fiscalDatosLoad, fiscalDatosHolderHtml, fiscalDatosStatusText };`, sandbox);
  return { api: sandbox.api, elements, stored, writes, sandbox };
}

const storedStore = (year, extra = {}) => JSON.stringify({ schemaId: tax.STORE_SCHEMA_ID, year, updatedAt: "2026-10-20", holders: [tax.holderFromInput(full(extra)).holder] });

test("PR-2 · pantalla sin datos: sigue el ejemplo, marcado como tal, y el formulario sale abierto y vacío", () => {
  const { api, elements } = uiSandbox();
  api.renderFiscalCampaign(tax);
  assert.equal(elements.campanaFiscalCard.dataset.ejemplo, "true");
  assert.match(elements.campanaFiscalCuerpo.innerHTML, /Cifras de ejemplo/);
  assert.match(elements.campanaFiscalCuerpo.innerHTML, /abajo, en «Tus datos fiscales»/);
  const form = elements.campanaFiscalDatos.innerHTML;
  assert.match(form, /<details class="fc-datos" id="fiscalDatosDetails" open>/, "sin datos: abierto, es la llamada a la acción");
  assert.match(form, /Todavía no has guardado ningún dato/);
  assert.match(form, /Lo que no sepas, déjalo vacío/);
  assert.match(form, /no los mandes por el chat/);
  assert.match(form, /data-fiscal-quitar disabled/, "sin datos no hay nada que quitar");
  assert.equal((form.match(/<fieldset class="fc-datos-persona"/g) || []).length, 2, "dos declarantes");
  assert.doesNotMatch(form, /value="[^"]*\d[^"]*"/, "ningún campo viene relleno con cifras del ejemplo");
});

test("PR-2 · pantalla con datos de este año: la lista usa tus datos, sin marcas de ejemplo, con quién y desde cuándo", () => {
  const key = "casa:fiscal-data";
  const { api, elements } = uiSandbox({ stored: { [key]: storedStore(2026) } });
  api.renderFiscalCampaign(tax);
  const body = elements.campanaFiscalCuerpo.innerHTML;
  assert.equal(elements.campanaFiscalCard.dataset.ejemplo, "false");
  assert.doesNotMatch(body, /Cifras de ejemplo|fc-cifra-ejemplo|cifra de ejemplo/);
  assert.match(body, /<strong>Con tus datos\.<\/strong> Declarante: Ana, datos del 20\/10\/2026/);
  assert.match(body, /lo que no has rellenado sale «sin calcular», no como 0 €/);
  const form = elements.campanaFiscalDatos.innerHTML;
  assert.doesNotMatch(form, /<details class="fc-datos" id="fiscalDatosDetails" open>/, "con datos guardados, plegado");
  assert.match(form, /Datos guardados el 20\/10\/2026\. La lista de arriba ya usa tus datos\./);
  assert.match(form, /value="Ana"/);
  assert.match(form, /value="40\.000,00"/, "un importe vuelve formateado");
  assert.match(form, /id="fiscalDatos-0-marginalRatePct"[^>]*value="30"/, "un % no se formatea como importe");
});

test("PR-2 · datos de otro año: no se usan, la pantalla lo dice y vuelve al ejemplo", () => {
  const { api, elements } = uiSandbox({ today: "2027-11-20", stored: { "casa:fiscal-data": storedStore(2026) } });
  api.renderFiscalCampaign(tax);
  const body = elements.campanaFiscalCuerpo.innerHTML;
  assert.equal(elements.campanaFiscalCard.dataset.ejemplo, "true");
  assert.match(body, /Tus datos son de 2026\./);
  assert.match(body, /Esta campaña es la de 2027 y no se usan/);
  assert.match(elements.campanaFiscalDatos.innerHTML, /Los datos guardados son de 2026 y esta campaña es la de 2027: no se usan/);
  assert.match(elements.campanaFiscalDatos.innerHTML, /<details class="fc-datos" id="fiscalDatosDetails" open>/);
  assert.match(elements.campanaFiscalDatos.innerHTML, /value="Ana"/, "se ofrece lo anterior para revisarlo, editable");
});

test("PR-2 · el formulario: importes con formato y ±, porcentajes sin formato, respuestas con «No lo sé», todo etiquetado y con su ayuda", () => {
  const { api, elements } = uiSandbox();
  api.renderFiscalCampaign(tax);
  const form = elements.campanaFiscalDatos.innerHTML;
  const input = (slot, id) => form.match(new RegExp(`<input[^>]*id="fiscalDatos-${slot}-${id}"[^>]*>`))[0];
  ["annualGross", "estimatedResult", "pensionContributed", "housingPaid", "realizedNet", "latentLosses", "donationsAmount", "pensionAvailable"].forEach((id) => assert.match(input(0, id), /data-amount-input/, id));
  ["marginalRatePct", "currentWithholdingPct", "savingsRatePct"].forEach((id) => assert.doesNotMatch(input(1, id), /data-amount-input/, id));
  ["estimatedResult", "realizedNet"].forEach((id) => assert.match(form, new RegExp(`data-amount-sign="fiscalDatos-0-${id}"`), `${id} puede ser negativo`));
  assert.doesNotMatch(form, /data-amount-sign="fiscalDatos-0-annualGross"/);
  ["hasEmployerPlan", "housingApplies"].forEach((id) => {
    const select = form.match(new RegExp(`<select id="fiscalDatos-0-${id}"[\\s\\S]*?</select>`))[0];
    assert.match(select, /<option value="" selected>No lo sé<\/option>/, "por defecto «No lo sé», no «No»");
    assert.match(select, /<option value="si">Sí<\/option>/);
    assert.match(select, /<option value="no">No<\/option>/);
  });
  assert.match(form, /type="checkbox" id="fiscalDatos-0-recurring"/);
  // Cada campo tiene su ayuda enlazada.
  const ids = [...form.matchAll(/id="(fiscalDatos-\d-(?!label)[a-zA-Z]+)"/g)].map((match) => match[1]).filter((id) => !id.endsWith("-ayuda"));
  assert.ok(ids.length >= 26, `campos: ${ids.length}`);
  ids.forEach((id) => assert.match(form, new RegExp(`aria-describedby="${id}-ayuda"`), `${id} sin ayuda enlazada`));
});

test("PR-2 · un nombre con HTML no se cuela en el formulario ni en la tarjeta", () => {
  const evil = JSON.stringify({ schemaId: tax.STORE_SCHEMA_ID, year: 2026, updatedAt: "2026-10-20", holders: [tax.holderFromInput(full({ label: "<img src=x onerror=alert(1)>" })).holder] });
  const { api, elements } = uiSandbox({ stored: { "casa:fiscal-data": evil } });
  api.renderFiscalCampaign(tax);
  assert.doesNotMatch(elements.campanaFiscalDatos.innerHTML, /<img/);
  assert.doesNotMatch(elements.campanaFiscalCuerpo.innerHTML, /<img/);
  assert.match(elements.campanaFiscalDatos.innerHTML, /&lt;img src=x onerror=alert\(1\)&gt;/);
});

test("PR-2 · un almacén roto no tumba la pantalla: se ve el ejemplo", () => {
  ["{no es json", "null", '"texto"', "[]", '{"holders":[{"id":1}]}'].forEach((raw) => {
    const { api, elements } = uiSandbox({ stored: { "casa:fiscal-data": raw } });
    api.renderFiscalCampaign(tax);
    assert.equal(elements.campanaFiscalCard.dataset.ejemplo, "true", raw);
    assert.equal(elements.campanaFiscalCard.hidden, false);
  });
});

test("PR-2 · pintar la pantalla solo LEE: no escribe ni sincroniza nada", () => {
  const { api, writes } = uiSandbox({ stored: { "casa:fiscal-data": storedStore(2026) } });
  api.renderFiscalCampaign(tax);
  assert.deepEqual(writes, []);
});

test("PR-2 · el formulario no se repinta mientras se escribe, salvo que se fuerce", () => {
  const { api, elements, sandbox } = uiSandbox();
  api.renderFiscalCampaign(tax);
  elements.campanaFiscalDatos.childElementCount = 1;
  const first = elements.campanaFiscalDatos.innerHTML;
  elements.campanaFiscalDatos.innerHTML = "ESCRIBIENDO";
  elements.campanaFiscalDatos.contains = () => true; // el foco está dentro
  sandbox.document.activeElement = {};
  api.renderFiscalDatos(tax, { year: 2026 });
  assert.equal(elements.campanaFiscalDatos.innerHTML, "ESCRIBIENDO", "con el foco dentro no se pisa");
  api.renderFiscalDatos(tax, { year: 2026, force: true });
  assert.equal(elements.campanaFiscalDatos.innerHTML, first, "forzado, sí");
});

// ---- Cableado ----

test("PR-2 · cableado: el almacén viaja en la copia y la nube, y el script no toca el DOM al cargarse", () => {
  const app = read("app.js");
  assert.match(app, /const BACKUP_LOCAL_STORES = \[\n  "fiscal-data", \/\/ WP-23 PR-2/);
  assert.equal(tax.STORE_NAME, "fiscal-data");
  assert.match(read("fiscal-datos-ui.js"), /const FISCAL_DATOS_STORE = "fiscal-data";/);
  // Sin llamadas al DOM ni escuchas al cargarse: lo único que hay a nivel de módulo son constantes y funciones.
  const top = read("fiscal-datos-ui.js").split("\n").filter((line) => /^[a-zA-Z]/.test(line) && !/^(const|let|function)\s/.test(line));
  assert.deepEqual(top, [], `líneas sueltas a nivel de módulo: ${top.join(" | ")}`);
  assert.doesNotMatch(read("fiscal-datos-ui.js"), /fetch\(|XMLHttpRequest|navigator\.sendBeacon|WebSocket/, "sin red");
});

test("PR-2 · cableado: ni una cifra real en el repositorio — el ejemplo sigue siendo el de cifras redondas y marcado", () => {
  assert.equal(tax.EXAMPLE_HOUSEHOLD.example, true);
  assert.ok(Object.isFrozen(tax.EXAMPLE_HOUSEHOLD));
  assert.doesNotMatch(read("fiscal-datos-ui.js"), /\d{2,3}\.\d{3},\d{2}\s*€?\s*[a-z]/i, "sin importes tecleados en el código");
});
