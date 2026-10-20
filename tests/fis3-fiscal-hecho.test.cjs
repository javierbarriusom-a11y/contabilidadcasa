const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { codigoApp } = require("./helpers/codigo-app.cjs");

const root = path.resolve(__dirname, "..");
const read = (name) => fs.readFileSync(path.join(root, name), "utf8");
const tax = require("../canonical-year-end-tax.js");
const reminders = require("../canonical-reminders.js");
const shell = require("../ux-shell.js");

// WP-23 PR-3: «Hecho» por tarea y declarante, y los avisos del 1/12 y el 20/12 que lo tienen en cuenta. Lo que el hogar debe poder fiar: que «sin tareas» no se pinte como «todo
// hecho», que una marca de otro año o de una tarea que ya no existe no cuente, que el calendario no avise de lo que ya está hecho pero tampoco calle si no sabe nada, y que el ejemplo
// no se pueda marcar. TODAS las cifras son ficticias: el repositorio es público.

const holder = (id, label, values, choices = { hasEmployerPlan: false, housingApplies: true }) => tax.holderFromInput({ id, label, values, choices }).holder;
const ana = holder("persona-1", "Ana", { marginalRatePct: 30, pensionContributed: 0, housingPaid: 6000, donationsAmount: 300 });
const luis = holder("persona-2", "Luis", { marginalRatePct: 24, pensionContributed: 1500, housingPaid: 9040, donationsAmount: 0 }); // límite y tope ya llenos, sin donativos: nada que hacer
const mark = (store, actionId, holderId, at = "2026-11-12") => {
  const r = tax.markDone(store, { year: 2026, actionId, holderId, at });
  assert.equal(r.error, null, `${actionId}/${holderId}`);
  return r.store;
};
const campaign = (done, holders = [ana, luis], year = 2026) => tax.buildCampaign({ year, holders }, { today: `${year}-11-20`, done });

// ---- Motor: el almacén ----

test("PR-3 · normalizeDone: lo dañado, sin año o ajeno da un almacén vacío válido y nunca revienta", () => {
  [null, undefined, "x", 3, [], {}, { year: "no" }, { year: 1900, marks: {} }, { marks: { "pensiones|persona-1": { at: "2026-11-12" } } }].forEach((raw) => {
    const store = tax.normalizeDone(raw);
    assert.equal(store.schemaId, tax.DONE_SCHEMA_ID);
    assert.deepEqual(store.marks, {}, JSON.stringify(raw));
  });
});

test("PR-3 · normalizeDone: solo pasan las marcas de acciones que existen, con declarante, con fecha válida y DENTRO del año", () => {
  const store = tax.normalizeDone({
    year: 2026,
    marks: {
      "pensiones|persona-1": { at: "2026-11-12" },
      "inventada|persona-1": { at: "2026-11-12" },
      "pensiones|": { at: "2026-11-12" },
      "pensiones|persona-1|extra": { at: "2026-11-12" },
      "vivienda|persona-1": { at: "12/11/2026" },
      "donativos|persona-1": { at: "2025-12-31" },
      "compensacion|persona-1": { at: "2026-02-30" },
      "retencion|persona-2": { at: "2026-12-01" },
      "vivienda|persona-2": "texto",
    },
  });
  assert.deepEqual(Object.keys(store.marks).sort(), ["pensiones|persona-1", "retencion|persona-2"]);
  assert.equal(store.year, 2026);
});

test("PR-3 · normalizeDone es idempotente y tiene tope de marcas", () => {
  const once = tax.normalizeDone({ year: 2026, marks: { "pensiones|persona-1": { at: "2026-11-12" } } });
  assert.deepEqual(tax.normalizeDone(JSON.parse(JSON.stringify(once))), once);
  const many = Object.fromEntries(Array.from({ length: 200 }, (_, index) => [`pensiones|p${index}`, { at: "2026-11-12" }]));
  assert.ok(Object.keys(tax.normalizeDone({ year: 2026, marks: many }).marks).length <= 40);
});

test("PR-3 · markDone valida acción, declarante y que la fecha sea del año; un año nuevo empieza sin marcas", () => {
  const ok = tax.markDone(null, { year: 2026, actionId: "pensiones", holderId: "persona-1", at: "2026-11-12" });
  assert.equal(ok.error, null);
  assert.deepEqual(ok.store.marks, { "pensiones|persona-1": { at: "2026-11-12" } });
  assert.equal(tax.markDone(null, { year: 2026, actionId: "nada", holderId: "persona-1", at: "2026-11-12" }).error, "invalid-mark");
  assert.equal(tax.markDone(null, { year: 2026, actionId: "pensiones", holderId: "", at: "2026-11-12" }).error, "invalid-mark");
  assert.equal(tax.markDone(null, { year: 2026, actionId: "pensiones", holderId: "persona-1", at: "2027-01-02" }).error, "date-outside-year");
  assert.equal(tax.markDone(null, { year: 2026, actionId: "pensiones", holderId: "persona-1", at: "mañana" }).error, "date-outside-year");
  const next = tax.markDone(ok.store, { year: 2027, actionId: "vivienda", holderId: "persona-1", at: "2027-03-01" });
  assert.deepEqual(Object.keys(next.store.marks), ["vivienda|persona-1"], "lo hecho en 2026 no cuenta para 2027");
  assert.equal(next.store.year, 2027);
});

test("PR-3 · unmarkDone quita solo esa marca y quitar una que no está no rompe nada", () => {
  let store = mark(null, "pensiones", "persona-1");
  store = mark(store, "donativos", "persona-1");
  const after = tax.unmarkDone(store, { actionId: "pensiones", holderId: "persona-1" });
  assert.deepEqual(Object.keys(after.marks), ["donativos|persona-1"]);
  assert.deepEqual(tax.unmarkDone(after, { actionId: "pensiones", holderId: "persona-1" }), after);
  assert.deepEqual(tax.unmarkDone(null, { actionId: "x", holderId: "y" }).marks, {});
});

// ---- Motor: el progreso ----

test("PR-3 · sin marcas, el progreso cuenta las tareas con ahorro y fecha límite, y los topes ya llenos no son tareas", () => {
  const c = campaign(null);
  // Ana: pensiones 450, vivienda 456, donativos 220; Luis: pensiones y vivienda llenos (0 €) y sin donativos → ninguna tarea.
  assert.equal(c.progress.total, 3);
  assert.equal(c.progress.done, 0);
  assert.equal(c.progress.pending, 3);
  assert.equal(c.progress.pct, 0);
  assert.equal(c.progress.allDone, false);
  assert.equal(c.progress.pendingSavingEur, 1126);
  const byId = Object.fromEntries(c.actions.map((action) => [action.id, action]));
  assert.equal(byId.pensiones.rows.find((row) => row.holderId === "persona-2").actionable, false, "límite ya cubierto: nada que hacer");
  assert.equal(byId.pensiones.pendingCount, 1);
});

test("PR-3 · marcar una tarea la cuenta, suma lo estimado como hecho y no toca lo calculado", () => {
  const before = campaign(null);
  const c = campaign(mark(null, "pensiones", "persona-1"));
  assert.equal(c.progress.done, 1);
  assert.equal(c.progress.pending, 2);
  assert.equal(c.progress.pct, 33);
  assert.equal(c.progress.doneSavingEur, 450);
  assert.equal(c.progress.pendingSavingEur, 676);
  assert.deepEqual(c.progress.doneSavingEur + c.progress.pendingSavingEur, before.progress.pendingSavingEur, "lo hecho + lo pendiente = lo de antes");
  assert.equal(c.totalSavingEur, before.totalSavingEur, "marcar no cambia el ahorro estimado: lo cambian los datos");
  const pensiones = c.actions.find((action) => action.id === "pensiones");
  assert.deepEqual(pensiones.rows.find((row) => row.holderId === "persona-1").done, { at: "2026-11-12" });
  assert.equal(pensiones.pendingCount, 0);
  assert.equal(pensiones.doneCount, 1);
});

test("PR-3 · todas marcadas = 100 %; «sin tareas» NO es 100 %", () => {
  let done = null;
  ["pensiones", "vivienda", "donativos"].forEach((id) => { done = mark(done, id, "persona-1"); });
  const all = campaign(done);
  assert.equal(all.progress.pct, 100);
  assert.equal(all.progress.allDone, true);
  assert.equal(all.progress.pendingSavingEur, 0);
  // Un hogar sin ninguna tarea con ahorro (todo lleno y sin donativos).
  const nothing = campaign(null, [luis]);
  assert.equal(nothing.progress.total, 0);
  assert.equal(nothing.progress.pct, null, "sin tareas no hay porcentaje");
  assert.equal(nothing.progress.allDone, false, "no hay nada que hacer, que no es «todo hecho»");
});

test("PR-3 · una marca de otro año, de una tarea sin nada que hacer o de un declarante que ya no está no cuenta (y no se borra)", () => {
  const store2026 = mark(null, "pensiones", "persona-1");
  assert.equal(campaign(store2026, [ana, luis], 2027).progress.done, 0, "marcas de 2026 en la campaña de 2027");
  const huérfana = mark(null, "pensiones", "persona-2"); // Luis ya tiene el límite cubierto
  assert.equal(campaign(huérfana).progress.done, 0);
  assert.equal(campaign(huérfana).actions.find((action) => action.id === "pensiones").rows.find((row) => row.holderId === "persona-2").done, null);
  assert.equal(campaign(mark(null, "pensiones", "persona-9")).progress.done, 0, "declarante inexistente");
  assert.deepEqual(Object.keys(huérfana.marks), ["pensiones|persona-2"], "no se borra: si los datos vuelven a pedirlo, sigue marcada");
});

test("PR-3 · la retención se puede marcar pero no cuenta en lo que hay que hacer antes del 31/12 (no tiene fecha límite)", () => {
  const withResult = holder("persona-1", "Ana", { marginalRatePct: 30, pensionContributed: 1500, annualGross: 40000, estimatedResult: 900 });
  const base = campaign(null, [withResult]);
  const retencion = base.actions.find((action) => action.id === "retencion");
  assert.equal(retencion.rows[0].actionable, true);
  assert.equal(base.progress.total, 0, "no hay tareas con fecha límite");
  const marked = campaign(mark(null, "retencion", "persona-1"), [withResult]);
  assert.equal(marked.actions.find((action) => action.id === "retencion").doneCount, 1);
  assert.equal(marked.progress.total, 0);
});

// ---- Calendario ----

const reminder = (fiscal, today = "2026-11-20") => reminders.build({ today, options: { kinds: { income: false, bigCharge: false, monthClose: false, fiscal: true, rateReview: false, cirbe: false }, horizonMonths: 12 }, fiscal });
const dec = (result, day) => result.events.find((event) => event.date === `2026-12-${day}`);

test("PR-3 · calendario sin datos fiscales: los avisos del 1/12 y el 20/12 de siempre", () => {
  const r = reminder(null);
  assert.equal(r.events.length, 2);
  assert.doesNotMatch(dec(r, "01").description, /Según la app/);
  assert.doesNotMatch(dec(r, "20").description, /Según la app/);
  assert.equal(r.skipped.fiscalDone, 0);
});

test("PR-3 · calendario con tareas pendientes: dice cuántas, a qué día se contó, y los títulos no llevan cifras", () => {
  const r = reminder({ year: 2026, total: 3, pending: 2 });
  assert.match(dec(r, "01").description, /Según la app el viernes 20 de noviembre: 3 tareas con ahorro y 2 sin marcar como hechas\./);
  assert.match(dec(r, "20").description, /quedaban 2 tareas sin marcar como hechas: si ya las habéis hecho, marcadlas en la app/);
  r.events.forEach((event) => assert.doesNotMatch(event.title, /\d/, "el título sale en la pantalla de bloqueo"));
  assert.equal(reminder({ year: 2026, total: 1, pending: 1 }).events.find((event) => event.date === "2026-12-20").description.includes("1 tarea sin marcar como hecha:"), true, "singular");
});

test("PR-3 · calendario con TODO hecho: no hay aviso del 20/12 (sí el del 1/12), y se cuenta aparte", () => {
  const r = reminder({ year: 2026, total: 3, pending: 0 });
  assert.equal(dec(r, "20"), undefined);
  assert.ok(dec(r, "01"));
  assert.equal(r.skipped.fiscalDone, 1);
  assert.match(dec(r, "01").description, /3 tareas con ahorro y 0 sin marcar como hechas/);
});

test("PR-3 · calendario: «sin tareas» (total 0) o datos incoherentes NO se toman por «todo hecho»: salen los avisos de siempre", () => {
  [{ year: 2026, total: 0, pending: 0 }, { year: 2026, total: 3, pending: 5 }, { year: 2026, total: -1, pending: 0 }, { year: 2026, total: "a", pending: 0 }, { year: 2026 }, "texto", 7].forEach((fiscal) => {
    const r = reminder(fiscal);
    assert.ok(dec(r, "20"), `${JSON.stringify(fiscal)}: sigue el aviso del 20/12`);
    assert.doesNotMatch(dec(r, "20").description, /Según la app/);
    assert.equal(r.skipped.fiscalDone, 0);
  });
});

test("PR-3 · calendario: el afinado solo vale para el año de la campaña; el siguiente sale genérico", () => {
  const r = reminder({ year: 2026, total: 3, pending: 0 }, "2026-11-20");
  const later = r.events.filter((event) => event.date.startsWith("2027"));
  later.forEach((event) => assert.doesNotMatch(event.description, /Según la app/));
  const other = reminder({ year: 2025, total: 3, pending: 0 });
  assert.ok(dec(other, "20"), "datos de 2025 no apagan el aviso de 2026");
});

test("PR-3 · calendario: apagar los avisos fiscales no deja ninguno aunque haya datos", () => {
  const r = reminders.build({ today: "2026-11-20", fiscal: { year: 2026, total: 3, pending: 2 }, options: { kinds: { fiscal: false }, horizonMonths: 12 } });
  assert.equal(r.counts.fiscal, 0);
});

// ---- Pantalla (fiscal-datos-ui.js y fiscal-campana-ui.js en un vm) ----

function fakeElement() {
  return { innerHTML: "", hidden: true, dataset: {}, childElementCount: 0, contains: () => false };
}

function uiSandbox({ today = "2026-11-20", stored = {} } = {}) {
  const elements = { campanaFiscalCard: fakeElement(), campanaFiscalCuerpo: fakeElement(), campanaFiscalDatos: fakeElement() };
  const writes = [];
  const toasts = [];
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
    showUndoToast: (message, onUndo) => toasts.push({ message, onUndo }),
    FinanceUxShell: shell,
    FinanceCanonicalYearEndTax: tax,
    document: { activeElement: null, addEventListener: () => {} },
    Date,
  };
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(`${read("fiscal-datos-ui.js")}\n${read("fiscal-campana-ui.js")}\nthis.api = { renderFiscalCampaign, fiscalHechoMark, fiscalHechoUnmark, fiscalHechoLoad, fiscalCampaignReminder };`, sandbox);
  return { api: sandbox.api, elements, stored, writes, toasts };
}

const storeKey = "casa:fiscal-data";
const doneKey = "casa:fiscal-done";
const plain = (value) => JSON.parse(JSON.stringify(value)); // lo que sale de un vm lleva otros prototipos: se compara por contenido
const dataStore = (year = 2026) => JSON.stringify({ schemaId: tax.STORE_SCHEMA_ID, year, updatedAt: "2026-10-20", holders: [ana, luis] });

test("PR-3 · el ejemplo NO se puede marcar: ni botones, ni progreso, ni marcas aplicadas", () => {
  const { api, elements } = uiSandbox({ stored: { [doneKey]: JSON.stringify({ year: 2026, marks: { "pensiones|persona-1": { at: "2026-11-12" } } }) } });
  api.renderFiscalCampaign(tax);
  const body = elements.campanaFiscalCuerpo.innerHTML;
  assert.doesNotMatch(body, /data-fiscal-hecho|data-fiscal-deshacer|fc-progreso|Hecha/);
  assert.equal(api.fiscalCampaignReminder(), null, "sin datos del hogar no hay nada que decir al calendario");
});

test("PR-3 · con datos reales: un botón por declarante con algo que hacer, y ninguno para el que ya lo tiene todo", () => {
  const { api, elements } = uiSandbox({ stored: { [storeKey]: dataStore() } });
  api.renderFiscalCampaign(tax);
  const body = elements.campanaFiscalCuerpo.innerHTML;
  assert.equal((body.match(/data-fiscal-hecho/g) || []).length, 3, "pensiones, vivienda y donativos de Ana");
  assert.doesNotMatch(body, /data-declarante="persona-2"[^>]*data-fiscal-hecho|data-fiscal-hecho[^>]*data-declarante="persona-2"/, "Luis no tiene nada que hacer");
  assert.match(body, /aria-label="Marcar como hecho: Ana, Aportar al plan de pensiones"/);
  assert.match(body, /<strong>Hecho: 0 de 3 tareas\.<\/strong> Quedan 3 antes del 31 de diciembre, con <span class="fc-cifra">1\.126 €<\/span> de ahorro estimado por hacer\./);
  assert.match(body, /la app no comprueba que se hiciera/);
  assert.match(body, /actualizadlas en «Tus datos fiscales»/);
  assert.doesNotMatch(body, /class="e19-pill">Hecha</);
});

test("PR-3 · marcar guarda en el almacén de la copia, repinta y deja la fecha del día; la pantalla solo lee al pintar", () => {
  const { api, elements, writes, stored } = uiSandbox({ stored: { [storeKey]: dataStore() } });
  api.renderFiscalCampaign(tax);
  assert.deepEqual(writes, [], "pintar no escribe");
  api.fiscalHechoMark("pensiones", "persona-1");
  assert.deepEqual(JSON.parse(stored[doneKey]).marks, { "pensiones|persona-1": { at: "2026-11-20" } });
  assert.deepEqual(writes.map((write) => write[0]), ["casa:fiscal-done", "queueRemoteSave"]);
  const body = elements.campanaFiscalCuerpo.innerHTML;
  assert.match(body, /✓ <\/span><strong>Ana<\/strong>: hecho \(marcado el 20\/11\/2026\)/);
  assert.match(body, /<strong>Hecho: 1 de 3 tareas\.<\/strong> Quedan 2/);
  assert.match(body, /class="e19-pill">Hecha</);
  assert.match(body, /aria-label="Quitar la marca de hecho: Ana, Aportar al plan de pensiones"/);
});

test("PR-3 · quitar la marca se puede deshacer, y marcar algo inválido no escribe", () => {
  const { api, toasts, stored, writes } = uiSandbox({ stored: { [storeKey]: dataStore(), [doneKey]: JSON.stringify({ year: 2026, marks: { "pensiones|persona-1": { at: "2026-11-12" } } }) } });
  api.fiscalHechoUnmark("pensiones", "persona-1");
  assert.deepEqual(JSON.parse(stored[doneKey]).marks, {});
  assert.equal(toasts.length, 1);
  toasts[0].onUndo();
  assert.deepEqual(JSON.parse(stored[doneKey]).marks, { "pensiones|persona-1": { at: "2026-11-12" } }, "deshacer devuelve la marca con su fecha de antes");
  writes.length = 0;
  api.fiscalHechoMark("tarea-inventada", "persona-1");
  api.fiscalHechoMark("pensiones", "");
  assert.deepEqual(writes, [], "una marca inválida no se guarda");
});

test("PR-3 · todo marcado se dice; datos de otro año no usan las marcas; un almacén de «hecho» roto no tumba la pantalla", () => {
  const all = JSON.stringify({ year: 2026, marks: { "pensiones|persona-1": { at: "2026-11-12" }, "vivienda|persona-1": { at: "2026-11-12" }, "donativos|persona-1": { at: "2026-11-13" } } });
  const done = uiSandbox({ stored: { [storeKey]: dataStore(), [doneKey]: all } });
  done.api.renderFiscalCampaign(tax);
  assert.match(done.elements.campanaFiscalCuerpo.innerHTML, /<strong>Hecho: 3 tareas de 3\.<\/strong> Todas marcadas como hechas/);
  assert.deepEqual(plain(done.api.fiscalCampaignReminder()), { year: 2026, total: 3, pending: 0 });
  ["{no es json", "null", '"x"', "[]"].forEach((raw) => {
    const broken = uiSandbox({ stored: { [storeKey]: dataStore(), [doneKey]: raw } });
    broken.api.renderFiscalCampaign(tax);
    assert.equal(broken.elements.campanaFiscalCard.dataset.ejemplo, "false", raw);
    assert.match(broken.elements.campanaFiscalCuerpo.innerHTML, /Hecho: 0 de 3 tareas/, raw);
  });
});

test("PR-3 · fiscalCampaignReminder: pendientes y total para el calendario; null si no hay datos de este año o no hay tareas", () => {
  assert.deepEqual(plain(uiSandbox({ stored: { [storeKey]: dataStore() } }).api.fiscalCampaignReminder()), { year: 2026, total: 3, pending: 3 });
  assert.equal(uiSandbox({ stored: {} }).api.fiscalCampaignReminder(), null);
  assert.equal(uiSandbox({ today: "2027-11-20", stored: { [storeKey]: dataStore(2026) } }).api.fiscalCampaignReminder(), null, "datos de otro año");
  const onlyLuis = JSON.stringify({ schemaId: tax.STORE_SCHEMA_ID, year: 2026, holders: [luis] });
  assert.equal(uiSandbox({ stored: { [storeKey]: onlyLuis } }).api.fiscalCampaignReminder(), null, "sin tareas no es «todo hecho»");
});

// ---- Cableado ----

test("PR-3 · cableado: el almacén de «hecho» viaja en la copia y la nube; el calendario recibe la campaña; sin red", () => {
  assert.match(codigoApp(), /"fiscal-done", \/\/ WP-23 PR-3/);
  assert.equal(tax.DONE_STORE_NAME, "fiscal-done");
  assert.match(read("fiscal-datos-ui.js"), /const FISCAL_HECHO_STORE = "fiscal-done";/);
  assert.match(read("recordatorios-ui.js"), /fiscal: globalThis\.fiscalCampaignReminder\?\.\(\) \|\| null,/);
  assert.doesNotMatch(read("fiscal-datos-ui.js"), /fetch\(|XMLHttpRequest|navigator\.sendBeacon|WebSocket/);
  const top = read("fiscal-datos-ui.js").split("\n").filter((line) => /^[a-zA-Z]/.test(line) && !/^(const|let|function)\s/.test(line));
  assert.deepEqual(top, [], `líneas sueltas a nivel de módulo: ${top.join(" | ")}`);
});
