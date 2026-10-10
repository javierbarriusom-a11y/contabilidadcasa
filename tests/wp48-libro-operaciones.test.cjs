const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const read = (name) => fs.readFileSync(path.join(root, name), "utf8");
const L = require("../canonical-portfolio-ledger.js");
const Portfolio = require("../canonical-portfolio.js");

// WP-48 (NIN-06): libro de operaciones editable con recálculo FIFO y «antes / después». Pruebas de oro con cifras calculadas a mano (en la línea de FIN-2): lo que importa es que editar o quitar
// una operación mueva EXACTAMENTE lo que tiene que mover —la plusvalía de las ventas afectadas, las unidades y el coste que quedan, y los ejercicios fiscales tocados— y que una venta que se
// queda sin lotes se marque, no se calcule a medias.

const deepFreeze = (value) => { if (value && typeof value === "object" && !Object.isFrozen(value)) { Object.freeze(value); Object.values(value).forEach(deepFreeze); } return value; };

// Fondo A: lote 1 (2020-01-10) 100 u a 10.000 € (100 €/u) y lote 2 (2021-06-01) 50 u a 6.000 € (120 €/u). Venta 2026-03-01 de 120 u por 15.000 €.
// FIFO: 100 u × 100 + 20 u × 120 = 12.400 € de coste → plusvalía 2.600 €. Queda 1 lote de 30 u a 3.600 €.
const A = () => ({
  id: "A", type: "fondo", label: "Fondo A", provenance: "manual", asOf: "2026-09-01", acquisitionDate: "2020-01-10", quantity: 100, costBasis: 10000, currentValue: 5200,
  contributions: [{ id: "c1", date: "2021-06-01", amount: 6000, quantity: 50 }],
  disposals: [{ id: "s1", date: "2026-03-01", quantitySold: 120, saleProceeds: 15000 }],
});
const buy = (id, date, amount, quantity) => ({ id, source: "contribution", kind: "buy", date, amount, quantity });
const sell = (id, date, quantity, amount) => ({ id, source: "disposal", kind: "sell", date, quantity, amount });
const change = (raw, action, operation) => { const r = L.applyChange(raw, { action, operation }); assert.equal(r.ok, true, r.reason); return r.position; };
const sale = (snap, id) => snap.disposals.find((item) => item.id === id);

test("WP-48 · las operaciones salen en orden cronológico, la compra antes que la venta del mismo día, y la inicial no se puede quitar", () => {
  const raw = A();
  raw.disposals.push({ id: "s0", date: "2021-06-01", quantitySold: 10, saleProceeds: 1200 });
  const ops = L.operations(raw);
  assert.deepEqual(ops.map((op) => op.id), ["initial", "c1", "s0", "s1"], "a igual fecha (2021-06-01) la compra va antes que la venta");
  assert.deepEqual(ops.map((op) => op.kind), ["buy", "buy", "sell", "sell"]);
  assert.equal(ops[0].removable, false);
  assert.equal(ops[1].removable, true);
  assert.deepEqual(L.operations({}), []);
  assert.deepEqual(L.operations(null), []);
});

test("WP-48 · oro: el punto de partida cuadra a mano (FIFO: 100 u a 100 € + 20 u a 120 € = 12.400 €; plusvalía 2.600 €; quedan 30 u a 3.600 €)", () => {
  const s = L.snapshot(A());
  assert.equal(sale(s, "s1").consumedCost, 12400);
  assert.equal(sale(s, "s1").realizedGain, 2600);
  assert.equal(s.quantity, 30);
  assert.equal(s.costBasis, 3600);
});

test("WP-48 · oro: cambiar el importe de la venta mueve solo la plusvalía de esa venta y el neto de su ejercicio", () => {
  const before = A();
  const after = change(before, "edit", sell("s1", "2026-03-01", 120, 14000));
  const d = L.diff(before, after);
  assert.equal(d.sales.length, 1);
  assert.equal(d.sales[0].change, "changed");
  assert.equal(d.sales[0].before.realizedGain, 2600);
  assert.equal(d.sales[0].after.realizedGain, 1600);
  assert.deepEqual(d.position.quantity, { before: 30, after: 30 });
  assert.deepEqual(d.position.costBasis, { before: 3600, after: 3600 });
  assert.deepEqual(d.position.realizedGain, { before: 2600, after: 1600 });
  assert.equal(d.years.length, 1);
  assert.equal(d.years[0].year, "2026");
  assert.equal(d.years[0].before.netResult, 2600);
  assert.equal(d.years[0].after.netResult, 1600);
  assert.deepEqual(d.newShortfalls, []);
});

test("WP-48 · oro: mover la aportación a después de la venta deja 20 u sin lote: la plusvalía NO se calcula y el ejercicio deja de ser calculable", () => {
  const before = A();
  const after = change(before, "edit", buy("c1", "2026-06-01", 6000, 50));
  const d = L.diff(before, after);
  assert.deepEqual(d.newShortfalls, ["s1"]);
  assert.equal(d.sales[0].after.shortfall, 20);
  assert.equal(d.sales[0].after.realizedGain, null);
  assert.equal(d.sales[0].after.consumedCost, 10000, "solo se consume el lote que existía a la fecha de la venta");
  assert.equal(d.position.realizedGain.after, null);
  assert.deepEqual(d.position.quantity, { before: 30, after: 50 }, "el lote posterior a la venta queda entero");
  assert.deepEqual(d.position.costBasis, { before: 3600, after: 6000 });
  assert.equal(d.years[0].after.calculable, false);
  assert.equal(d.years[0].after.reason, "incomplete-disposal");
  assert.ok(d.newWarnings.some((w) => w.code === "shortfall" && w.id === "s1"));
});

test("WP-48 · oro: quitar la aportación deja la venta sin 20 u y no queda nada de la posición", () => {
  const before = A();
  const after = change(before, "remove", { id: "c1", source: "contribution", kind: "buy" });
  const d = L.diff(before, after);
  assert.deepEqual(d.newShortfalls, ["s1"]);
  assert.deepEqual(d.position.quantity, { before: 30, after: 0 });
  assert.deepEqual(d.position.costBasis, { before: 3600, after: 0 });
  assert.equal(L.operations(after).some((op) => op.id === "c1"), false);
});

test("WP-48 · oro: añadir una segunda venta consume el lote que queda (30 u × 120 € = 3.600 €; plusvalía 400 €) y la posición queda a cero", () => {
  const before = A();
  const after = change(before, "add", sell("s2", "2026-04-01", 30, 4000));
  const d = L.diff(before, after);
  assert.equal(d.sales.length, 1);
  assert.equal(d.sales[0].change, "added");
  assert.equal(d.sales[0].before, null);
  assert.equal(d.sales[0].after.consumedCost, 3600);
  assert.equal(d.sales[0].after.realizedGain, 400);
  assert.deepEqual(d.position.realizedGain, { before: 2600, after: 3000 });
  assert.deepEqual(d.position.quantity, { before: 30, after: 0 });
  assert.equal(d.years[0].before.netResult, 2600);
  assert.equal(d.years[0].after.netResult, 3000);
});

test("WP-48 · oro: cambiar la fecha de una venta de un ejercicio a otro cambia el orden FIFO y toca los dos ejercicios", () => {
  // Lote 1: 50 u a 100 € (2020). Lote 2: 50 u a 200 € (2021). Venta 1 (2025-05-10): 50 u por 6.000 € → lote 1, plusvalía 1.000 €. Venta 2 (2026-02-10): 50 u por 7.000 € → lote 2, −3.000 €.
  const raw = {
    id: "B", type: "accion", label: "B", provenance: "manual", asOf: "2026-09-01", acquisitionDate: "2020-03-01", quantity: 50, costBasis: 5000, currentValue: 0,
    contributions: [{ id: "c1", date: "2021-03-01", amount: 10000, quantity: 50 }],
    disposals: [{ id: "s1", date: "2025-05-10", quantitySold: 50, saleProceeds: 6000 }, { id: "s2", date: "2026-02-10", quantitySold: 50, saleProceeds: 7000 }],
  };
  const start = L.snapshot(raw);
  assert.equal(sale(start, "s1").realizedGain, 1000);
  assert.equal(sale(start, "s2").realizedGain, -3000);
  // Se mueve la venta 1 a después de la 2: ahora la venta 2 consume el lote 1 (7.000 − 5.000 = +2.000) y la venta 1 el lote 2 (6.000 − 10.000 = −4.000).
  const after = change(raw, "edit", sell("s1", "2026-03-01", 50, 6000));
  const d = L.diff(raw, after);
  assert.equal(d.sales.length, 2, "cambian las dos ventas aunque solo se editó una");
  const byId = Object.fromEntries(d.sales.map((row) => [row.id, row]));
  assert.equal(byId.s2.after.realizedGain, 2000);
  assert.equal(byId.s1.after.realizedGain, -4000);
  assert.deepEqual(d.years.map((y) => y.year), ["2025", "2026"]);
  assert.equal(d.years[0].before.netResult, 1000);
  assert.equal(d.years[0].after.netResult, 0, "2025 se queda sin ventas");
  assert.equal(d.years[1].before.netResult, -3000);
  assert.equal(d.years[1].after.netResult, -2000, "2.000 − 4.000");
  assert.equal(d.position.realizedGain.before, -2000);
  assert.equal(d.position.realizedGain.after, -2000, "el total realizado no cambia: solo se reparte distinto entre ejercicios");
});

test("WP-48 · oro: la compensación del ejercicio cuenta las demás posiciones y las pérdidas arrastradas", () => {
  const other = {
    id: "O", type: "etf", label: "Otra", provenance: "manual", asOf: "2026-09-01", acquisitionDate: "2020-01-01", quantity: 10, costBasis: 1000, currentValue: 0,
    contributions: [], disposals: [{ id: "o1", date: "2026-05-05", quantitySold: 10, saleProceeds: 2000 }],
  };
  const before = A();
  const after = change(before, "edit", sell("s1", "2026-03-01", 120, 14000));
  const d = L.diff(before, after, { otherPositions: [other], priorLosses: [{ year: 2024, amount: 500 }] });
  assert.equal(d.years[0].before.netResult, 3600, "2.600 de A + 1.000 de la otra posición");
  assert.equal(d.years[0].before.taxableNet, 3100, "menos 500 de pérdidas de 2024");
  assert.equal(d.years[0].after.netResult, 2600);
  assert.equal(d.years[0].after.taxableNet, 2100);
});

test("WP-48 · una compra inicial sin fecha no entra en el FIFO: las ventas se quedan sin lotes, se avisa, y ponerle fecha lo arregla", () => {
  const raw = A();
  delete raw.acquisitionDate;
  const broken = L.snapshot(raw);
  assert.equal(sale(broken, "s1").shortfall, 70, "120 vendidas, solo 50 en lotes con fecha");
  assert.ok(L.warnings(raw, broken).some((w) => w.code === "initial-without-date"));
  const fixed = change(raw, "edit", { id: "initial", date: "2020-01-10", quantity: 100, amount: 10000 });
  const d = L.diff(raw, fixed);
  assert.deepEqual(d.resolvedShortfalls, ["s1"]);
  assert.equal(d.sales[0].after.realizedGain, 2600);
  assert.equal(d.years[0].before.calculable, false);
  assert.equal(d.years[0].after.calculable, true);
});

test("WP-48 · una aportación sin unidades y una venta sin importe se avisan", () => {
  const raw = A();
  raw.contributions.push({ id: "c2", date: "2022-01-01", amount: 1000, quantity: 0 });
  raw.disposals.push({ id: "s3", date: "2026-05-01", quantitySold: 1, saleProceeds: 0 });
  const codes = L.warnings(raw, L.snapshot(raw)).map((w) => w.code);
  assert.ok(codes.includes("buy-without-units"));
  assert.ok(codes.includes("sale-without-proceeds"));
});

test("WP-48 · una venta con pérdida y una recompra en los dos meses siguientes se avisa (no se aplica la norma, solo se advierte); ni con plusvalía ni fuera de plazo", () => {
  const raw = {
    id: "R", type: "accion", label: "R", provenance: "manual", asOf: "2026-09-01", acquisitionDate: "2020-01-01", quantity: 100, costBasis: 10000, currentValue: 0,
    contributions: [], disposals: [{ id: "s1", date: "2026-03-31", quantitySold: 50, saleProceeds: 3000 }],
  };
  assert.equal(L.snapshot(raw).disposals[0].realizedGain, -2000);
  const codes = (position) => L.warnings(position, L.snapshot(position)).map((w) => w.code);
  assert.ok(!codes(raw).includes("repurchase-risk"), "sin recompra no hay aviso");
  const dentro = change(raw, "add", buy("c1", "2026-05-31", 1000, 10));
  assert.ok(codes(dentro).includes("repurchase-risk"), "el 31/05 está dentro de los dos meses posteriores al 31/03");
  const fuera = change(raw, "add", buy("c1", "2026-06-01", 1000, 10));
  assert.ok(!codes(fuera).includes("repurchase-risk"), "el 01/06 ya queda fuera");
  const antes = change(raw, "add", buy("c1", "2026-03-01", 1000, 10));
  assert.ok(!codes(antes).includes("repurchase-risk"), "las compras anteriores no se evalúan (se dice en el diseño)");
  const ganancia = change(dentro, "edit", sell("s1", "2026-03-31", 50, 9000));
  assert.ok(!codes(ganancia).includes("repurchase-risk"), "con plusvalía no hay nada que diferir");
  const d = L.diff(raw, dentro);
  assert.ok(d.newWarnings.some((w) => w.code === "repurchase-risk"), "el «antes / después» lo enseña como aviso nuevo");
  assert.match(d.newWarnings.find((w) => w.code === "repurchase-risk").text, /La app no lo aplica/);
});

test("WP-48 · validación: fecha que no existe, importes negativos, venta sin unidades, aportación sin importe; y nunca se modifica la posición de entrada", () => {
  const raw = deepFreeze(A());
  assert.equal(L.isIsoDate("2026-02-30"), false);
  assert.equal(L.isIsoDate("2026-02-28"), true);
  assert.equal(L.isIsoDate("28/02/2026"), false);
  const bad = (action, operation) => L.applyChange(raw, { action, operation });
  assert.equal(bad("edit", sell("s1", "2026-02-30", 10, 100)).ok, false);
  assert.match(bad("edit", sell("s1", "2026-02-30", 10, 100)).reason, /fecha/);
  assert.match(bad("edit", sell("s1", "2026-03-01", 0, 100)).reason, /unidades vendidas/);
  assert.match(bad("edit", sell("s1", "2026-03-01", 10, -1)).reason, /importe/);
  assert.match(bad("edit", buy("c1", "2021-06-01", 0, 5)).reason, /importe mayor que cero/);
  assert.match(bad("edit", buy("c1", "2021-06-01", 100, -5)).reason, /unidades no pueden ser negativas/);
  assert.match(bad("edit", buy("c1", "2021-06-01", NaN, 5)).reason, /importe no es un número/);
  assert.match(bad("edit", sell("s1", "2026-03-01", NaN, 5)).reason, /unidades no son un número|unidades vendidas/);
  assert.match(bad("remove", { id: "initial" }).reason, /compra inicial/);
  assert.match(bad("add", buy("c1", "2022-01-01", 100, 1)).reason, /Ya hay/);
  assert.match(bad("edit", sell("nope", "2026-03-01", 1, 1)).reason, /No encuentro/);
  assert.match(bad("remove", buy("nope", "2026-03-01", 1, 1)).reason, /No encuentro/);
  assert.match(bad("fusionar", buy("c1", "2022-01-01", 100, 1)).reason, /Acción desconocida/);
  assert.match(bad("edit", {}).reason, /identificador/);
  assert.equal(raw.disposals[0].saleProceeds, 15000, "la entrada (congelada) sigue intacta");
});

test("WP-48 · una aportación sin unidades se puede dejar sin unidades; una venta sin importe se admite (avisa) y conserva los campos que no toca", () => {
  const raw = A();
  raw.contributions[0].note = "regalo";
  const sinUnidades = change(raw, "edit", buy("c1", "2021-06-01", 6000, 0));
  assert.equal(sinUnidades.contributions[0].quantity, 0);
  assert.equal(sinUnidades.contributions[0].note, "regalo", "no pierde campos que el libro no edita");
  const sinImporte = change(raw, "edit", sell("s1", "2026-03-01", 120, ""));
  assert.equal(sinImporte.disposals[0].saleProceeds, 0);
});

test("WP-48 · propiedad: editar y devolver el valor original deja la posición idéntica, y el coste se conserva (Σ consumido + lo que queda = Σ coste de los lotes)", () => {
  let seed = 48;
  const random = () => { seed = (seed * 1664525 + 1013904223) % 4294967296; return seed / 4294967296; };
  const day = (index) => `${2020 + Math.floor(index / 12)}-${String((index % 12) + 1).padStart(2, "0")}-15`;
  for (let run = 0; run < 150; run += 1) {
    const lots = 1 + Math.floor(random() * 3);
    const raw = { id: "P", type: "fondo", label: "P", provenance: "manual", asOf: "2026-09-01", acquisitionDate: day(0), quantity: 40 + Math.floor(random() * 60), costBasis: 4000 + Math.floor(random() * 4000), currentValue: 1, contributions: [], disposals: [] };
    for (let index = 0; index < lots; index += 1) raw.contributions.push({ id: `c${index}`, date: day(6 + index * 7), amount: 1000 + Math.floor(random() * 3000), quantity: 10 + Math.floor(random() * 40) });
    const totalUnits = raw.quantity + raw.contributions.reduce((s, c) => s + c.quantity, 0);
    const sales = 1 + Math.floor(random() * 3);
    let left = totalUnits;
    for (let index = 0; index < sales; index += 1) {
      const units = Math.max(1, Math.floor(left * random() * 0.6));
      left -= units;
      raw.disposals.push({ id: `s${index}`, date: day(40 + index * 5), quantitySold: units, saleProceeds: Math.floor(random() * 9000) });
    }
    const snap = L.snapshot(raw);
    if (snap.disposals.every((d) => d.shortfall === 0)) {
      const tracked = raw.costBasis + raw.contributions.reduce((s, c) => s + c.amount, 0);
      const consumed = snap.disposals.reduce((s, d) => s + d.consumedCost, 0);
      assert.ok(Math.abs(consumed + snap.costBasis - tracked) < 0.05 * (sales + lots + 2), `conservación del coste (run ${run}): ${consumed} + ${snap.costBasis} ≠ ${tracked}`);
    }
    // Editar una operación al azar y devolverla a su valor original deja la posición como estaba.
    const ops = L.operations(raw).filter((op) => op.id !== "initial");
    const target = ops[Math.floor(random() * ops.length)];
    const edited = change(raw, "edit", { ...target, date: day(Math.floor(random() * 80)), amount: target.amount + 1, quantity: target.quantity + 1 });
    const restored = change(edited, "edit", target);
    assert.deepEqual(restored, raw, `ida y vuelta (run ${run})`);
    const d = L.diff(raw, restored);
    assert.equal(d.identical, true);
    assert.deepEqual(d.sales, []);
    assert.deepEqual(d.years, []);
  }
});

test("WP-48 · el diff de dos posiciones iguales no enseña nada y el motor es puro", () => {
  const d = L.diff(A(), A());
  assert.equal(d.identical, true);
  assert.deepEqual([d.sales, d.newShortfalls, d.resolvedShortfalls, d.newWarnings, d.years], [[], [], [], [], []]);
  const source = read("canonical-portfolio-ledger.js");
  ["document", "window", "fetch(", "localStorage", "sessionStorage", "XMLHttpRequest", "Date.now", "new Date(", "Math.random"].forEach((banned) => {
    if (banned === "new Date(") assert.ok(!/new Date\((?!Date\.UTC)/.test(source.replace(/new Date\(Date\.UTC/g, "")), "no usa el reloj");
    else assert.ok(!source.includes(banned), `no debe usar ${banned}`);
  });
  assert.equal(L.SCHEMA_ID, "finance-portfolio-ledger/v1");
  assert.ok(Portfolio.fifoLedger, "el reparto FIFO sigue siendo el de canonical-portfolio.js (no se reimplementa)");
  assert.ok(!/function fifo/i.test(source), "no hay un segundo fifoLedger");
});

test("WP-48 · la tarjeta no guarda sin pulsar «Guardar», usa el lector es-ES y se puede deshacer; sin red ni confirm()", () => {
  const source = read("operaciones-ui.js");
  ["fetch(", "confirm(", "XMLHttpRequest"].forEach((banned) => assert.ok(!source.includes(banned), `no debe usar ${banned}`));
  assert.ok(source.includes("parseAmountField(raw)") && !/parseAmount\(/.test(source), "los importes escritos se leen con el lector es-ES («14.000» son catorce mil)");
  assert.equal((source.match(/saveIv1PositionsList\(/g) || []).length, 2, "solo guarda en «Guardar» (opsSave) y en su deshacer");
  assert.match(source, /showUndoToast\(/);
  assert.ok(/function opsSave\(\) \{\n  if \(!opsPreview\) return;/.test(source), "sin un «antes / después» delante no se guarda");
});

test("WP-48 · cableado: tarjeta junto al formulario de ventas, scripts tras canonical-portfolio.js, gancho en renderIv1PositionList y listas de ficheros", () => {
  const html = read("index.html");
  assert.ok(html.indexOf('id="iv1DisposalAdd"') < html.indexOf('id="opsCard"') && html.indexOf('id="opsCard"') < html.indexOf("IV3: aportación futura"));
  assert.match(html, /id="opsCuerpo" aria-live="polite"/);
  const at = (name) => html.indexOf(`<script defer src="${name}?v=`);
  assert.ok(at("canonical-portfolio.js") > 0 && at("canonical-portfolio.js") < at("canonical-portfolio-ledger.js") && at("canonical-portfolio-ledger.js") < at("operaciones-ui.js"));
  assert.match(html, /href="operaciones\.css\?v=/);
  const app = read("app.js");
  assert.match(app, /globalThis\.renderLibroOperaciones\?\.\(globalThis\.FinanceCanonicalPortfolioLedger\); \/\/ WP-48/);
  ["service-worker.js", "tools/build-public-site.mjs"].forEach((file) => {
    const list = read(file);
    ["operaciones.css", "canonical-portfolio-ledger.js", "operaciones-ui.js"].forEach((name) => assert.ok(list.includes(`"${file === "service-worker.js" ? "./" : ""}${name}"`), `${file} lista ${name}`));
  });
});
