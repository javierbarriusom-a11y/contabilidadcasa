const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

// Rediseño · fase A5 (docs/rediseno/HANDOFF.md §5 «B4 · Clasificar por lotes», referencias/png/Clasificar.png):
// clasificar los movimientos sin partida por grupos del mismo concepto, de 5 en 5. Comprueba (1) que se abre desde la
// bandeja de Movimientos v2 y está en el sitio público y el service worker, (2) los grupos y sus cifras, (3) la
// propuesta con su confianza y su porqué (sin cifras inventadas) y las alternativas que el hogar ya usa, (4) que aceptar escribe en el
// mismo diccionario de reglas con la misma secuencia de refresco y (5) que deshacer devuelve la regla y los reales.

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const clas = read("views/clasificar-v2.js");
const css = read("tema-v2.css");

const PARTIDAS = {
  expense: [
    { id: "super", kind: "expense", sectionName: "Gastos variables", label: "Supermercado" },
    { id: "ocio", kind: "expense", sectionName: "Gastos variables", label: "Comer fuera" },
    { id: "hogar", kind: "expense", sectionName: "Gastos fijos", label: "Gastos del hogar" },
    { id: "coche", kind: "expense", sectionName: "Gastos variables", label: "Coche" },
  ],
  income: [{ id: "nomina", kind: "income", sectionName: "Ingresos", label: "Nómina" }],
};

function sandbox({ transactions = [], mappings = {}, expenseActuals = {}, closed = [] } = {}) {
  const calls = [];
  const toasts = [];
  const dialog = { open: false, innerHTML: "", dataset: {}, addEventListener() {}, querySelector: () => null, showModal() { this.open = true; }, close() { this.open = false; } };
  const context = {
    escapeHtml: (value) => String(value ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]),
    money: (value, precise) => `${precise ? Number(value).toFixed(2).replace(".", ",") : Math.round(Number(value))} €`,
    round2: (value) => Math.round(Number(value) * 100) / 100,
    movementKindFromAmount: (amount) => (Number(amount) >= 0 ? "income" : "expense"),
    movementMappingKey: (row) => `${Number(row.amount) >= 0 ? "income" : "expense"}|${String(row.movement).toLowerCase()}|`,
    movementDisplayName: (row) => row.movement,
    displayLabelForRow: (row) => row.label,
    seriesKeyForRow: (row) => `${row.kind}|${row.id}`,
    availableSeriesRows: (kind) => PARTIDAS[kind],
    planningRowBySeriesKey: (kind, key) => PARTIDAS[kind].find((row) => `${row.kind}|${row.id}` === key) || null,
    normalizedText: (value) => String(value ?? "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, ""),
    monthByKey: (key) => (key ? { key } : null),
    isClosedMonthKey: (key) => closed.includes(key),
    actualKeyForRow: (row, month) => `${row.id}|${month.key}`,
    saveMovementMappings: () => calls.push("saveMovementMappings"),
    applyMovementMappingsToActuals: () => {
      calls.push("applyMovementMappingsToActuals");
      // Igual que el de app.js: solo escribe las claves con movimientos clasificados, no borra ninguna.
      const totals = {};
      context.baseData.transactions.forEach((row) => {
        const mapping = context.mappingForMovement(row);
        if (!mapping || closed.includes(row.month)) return;
        const key = `${mapping.row.id}|${row.month}`;
        totals[key] = Math.round(((totals[key] || 0) + Math.abs(row.amount)) * 100) / 100;
      });
      Object.assign(context.expenseActuals, totals);
      return Object.keys(totals).length;
    },
    buildPendingMovementMappings: () => (calls.push("buildPendingMovementMappings"), []),
    datosImportarRefreshRowsForMappings: (keys) => calls.push(`refreshRows:${[...keys].join(",")}`),
    saveIncomeActuals: () => calls.push("saveIncomeActuals"),
    saveExpenseActuals: () => calls.push("saveExpenseActuals"),
    refreshAllSectionsAfterDataChange: () => calls.push("refreshAll"),
    showUndoToast: (message, onUndo) => toasts.push({ message, onUndo }),
    announceStatus: (message) => calls.push(`status:${message}`),
    baseData: { transactions, monthlyPlanning: { months: [] } },
    movementMappings: mappings,
    incomeActuals: {},
    expenseActuals,
    pendingMovementMappings: [],
    qs: (id) => (id === "clasificarV2" ? dialog : null),
    Intl,
    globalThis: {},
  };
  context.mappingForMovement = (row) => {
    const stored = context.movementMappings[context.movementMappingKey(row)];
    return stored ? { row: context.planningRowBySeriesKey(stored.kind, stored.rowKey) } : null;
  };
  vm.createContext(context);
  vm.runInContext(clas, context);
  return { context, dialog, calls, toasts };
}

const tx = (date, movement, amount, extra = {}) => ({ date, month: date.slice(0, 7), movement, details: "", amount, ...extra });

test("se abre desde la bandeja de Movimientos v2, es un <dialog> propio y está en el sitio público y el service worker", () => {
  const html = read("index.html");
  const at = html.indexOf('<script defer src="views/clasificar-v2.js');
  assert.ok(at > 0 && at < html.indexOf('<script defer src="app.js'), "defer y antes de app.js");
  assert.match(html, /<dialog class="clas-v2" id="clasificarV2" aria-labelledby="clasificarV2Titulo"><\/dialog>/);
  assert.ok(read("service-worker.js").includes('"./views/clasificar-v2.js"'));
  assert.ok(read("tools/build-public-site.mjs").includes('"views/clasificar-v2.js"'));
  const mov = read("views/movimientos-v2.js");
  assert.match(mov, /class="mov-v2-card mov-v2-fila-bandeja" data-mov-v2-clasificar>/);
  assert.match(mov, /if \(clasificar\) return globalThis\.clasificarV2Open\?\.\(clasificar\);/);
  assert.match(mov, /\["sin-partida", "Sin partida"\]/, "el filtro «Sin partida» sigue en la lista");
});

test("hoja inferior en móvil y panel derecho de 400 px en escritorio, todo bajo el tema v2", () => {
  assert.match(css, /:root\[data-tema="v2"\] dialog\.clas-v2 \{[^}]*inset: auto 0 0 0;[^}]*border-radius: 24px 24px 0 0;/);
  assert.match(css, /@media \(min-width: 1024px\) \{\s*:root\[data-tema="v2"\] dialog\.clas-v2 \{[^}]*inset: 0 0 0 auto;[^}]*width: 400px;/);
  assert.match(css, /:root\[data-tema="v2"\] \.clas-v2-botones > \.e19-btn-primary \{\s*flex: 2;/);
});

test("agrupa por concepto los movimientos sin partida, del que más suma al que menos, y como mucho 5 por tanda", () => {
  const transactions = [
    tx("2026-10-02", "MERCADONA SUPERMERCADO", -86.4),
    tx("2026-10-09", "MERCADONA SUPERMERCADO", -42),
    tx("2026-09-20", "MERCADONA SUPERMERCADO", -61),
    tx("2026-10-03", "IBERDROLA", -94.12),
    tx("2026-10-01", "NOMINA", 3000),
    tx("2026-10-04", "YA CLASIFICADO", -10),
    tx("2026-10-04", "CERO", 0),
    ...Array.from({ length: 5 }, (_, i) => tx("2026-10-05", `COMERCIO ${i}`, -1 - i)),
  ];
  const mappings = { "expense|ya clasificado|": { kind: "expense", rowKey: "expense|hogar" } };
  const { context, dialog } = sandbox({ transactions, mappings });
  const groups = context.clasV2PendingGroups();
  assert.deepEqual(Array.from(groups.slice(0, 3), (g) => g.name), ["NOMINA", "MERCADONA SUPERMERCADO", "IBERDROLA"]);
  assert.equal(groups.length, 8, "ni el ya clasificado ni el de importe 0");
  assert.equal(groups[1].rows.length, 3);
  context.clasificarV2Open();
  assert.equal(dialog.open, true);
  assert.equal(vm.runInContext("clasV2Groups.length", context), 5);
  assert.match(dialog.innerHTML, /1 de 5 · 3 más en otra tanda/);
  assert.equal((dialog.innerHTML.match(/<span( class="is-hecho")?><\/span>/g) || []).length, 5, "una marca de progreso por grupo");
});

test("cifras del grupo: movimientos, lo del mes del último y el importe típico; la propuesta con su confianza y su porqué", () => {
  const transactions = [tx("2026-10-02", "MERCADONA SUPERMERCADO", -86.4), tx("2026-10-09", "MERCADONA SUPERMERCADO", -42), tx("2026-09-20", "MERCADONA SUPERMERCADO", -61)];
  const { context, dialog } = sandbox({ transactions });
  context.clasificarV2Open();
  const html = dialog.innerHTML;
  assert.match(html, /<b class="clas-v2-nombre">MERCADONA SUPERMERCADO<\/b>/);
  assert.match(html, /Movimientos<\/span><span class="clas-v2-num">3</);
  assert.match(html, /En octubre<\/span><span class="clas-v2-num">128,40 €</);
  assert.match(html, /Importe típico<\/span><span class="clas-v2-num">42 € – 86 €</);
  assert.match(html, /Propuesta · Gastos variables<\/span><b>Supermercado<\/b><\/span>\s*<span class="clas-v2-lab">confianza media<\/span><span class="clas-v2-meta clas-v2-porque">El nombre de la partida está en el concepto\.<\/span>/);
  assert.match(html, /data-confianza="media"/);
  assert.match(html, /<span class="clas-v2-lab">confianza media<\/span>/);
  assert.match(html, /la regla «MERCADONA SUPERMERCADO → Supermercado» para siempre/);
  assert.match(html, /data-clas-v2-aceptar aria-keyshortcuts="Enter"/, "con propuesta, Aceptar activo");
});

test("alternativas: las partidas con más reglas del mismo tipo, sin la propuesta; sin propuesta ni reglas, el selector de todas", () => {
  const mappings = {
    a: { kind: "expense", rowKey: "expense|ocio" },
    b: { kind: "expense", rowKey: "expense|ocio" },
    c: { kind: "expense", rowKey: "expense|hogar" },
    d: { kind: "expense", rowKey: "expense|super" },
    e: { kind: "income", rowKey: "income|nomina" },
  };
  const first = sandbox({ transactions: [tx("2026-10-02", "MERCADONA SUPERMERCADO", -86.4)], mappings });
  first.context.clasificarV2Open();
  const chips = [...first.dialog.innerHTML.matchAll(/data-clas-v2-alt="([^"]+)"/g)].map((m) => m[1]);
  assert.deepEqual(chips, ["expense|ocio", "expense|hogar"], "la propuesta (super) no se repite como alternativa");
  assert.match(first.dialog.innerHTML, /data-clas-v2-otra>Otra…/);

  const second = sandbox({ transactions: [tx("2026-10-02", "BIZUM 6123", -25)] });
  second.context.clasificarV2Open();
  const html = second.dialog.innerHTML;
  assert.match(html, /Sin propuesta para este concepto: elige su partida/);
  assert.match(html, /<select id="clasificarV2Otra"/);
  assert.match(html, /Gastos fijos · Gastos del hogar/);
  assert.match(html, /data-clas-v2-aceptar disabled/);
  vm.runInContext('clasV2Choice = "expense|coche"; clasV2Render();', second.context);
  assert.match(second.dialog.innerHTML, /Elegida · Gastos variables<\/span><b>Coche<\/b>/);
  assert.ok(!/confianza/.test(second.dialog.innerHTML), "lo elegido a mano no lleva confianza");
});

test("aceptar escribe la regla del concepto en el diccionario de siempre, con la misma secuencia de refresco y su aviso para deshacer", () => {
  const transactions = [tx("2026-10-02", "MERCADONA SUPERMERCADO", -86.4), tx("2026-10-09", "MERCADONA SUPERMERCADO", -42), tx("2026-10-03", "IBERDROLA", -94.12)];
  const { context, dialog, calls, toasts } = sandbox({ transactions });
  context.clasificarV2Open();
  context.clasV2Accept();
  const rule = context.movementMappings["expense|mercadona supermercado|"];
  assert.equal(rule.kind, "expense");
  assert.equal(rule.rowKey, "expense|super");
  assert.equal(rule.label, "Gastos variables · Supermercado");
  assert.deepEqual(
    calls.filter((c) => !c.startsWith("status:")),
    ["saveMovementMappings", "applyMovementMappingsToActuals", "buildPendingMovementMappings", "refreshRows:expense|mercadona supermercado|", "saveIncomeActuals", "saveExpenseActuals", "refreshAll"],
  );
  assert.equal(context.expenseActuals["super|2026-10"], 128.4);
  assert.equal(toasts.length, 1);
  assert.equal(toasts[0].message, "Regla «MERCADONA SUPERMERCADO → Supermercado» creada.");
  assert.match(dialog.innerHTML, /<b class="clas-v2-nombre">IBERDROLA<\/b>/, "pasa al siguiente grupo");
  assert.match(clas, /movementMappings\[group\.key\] = \{ kind: group\.kind, rowKey: seriesKeyForRow\(target\), label: `\$\{target\.sectionName\} · \$\{partida\}`, updatedAt: new Date\(\)\.toISOString\(\) \};/);
});

test("deshacer devuelve la regla y los reales de antes, una sola vez, desde el aviso o desde el resumen de la tanda", () => {
  const transactions = [tx("2026-10-02", "MERCADONA SUPERMERCADO", -86.4), tx("2026-08-02", "MERCADONA SUPERMERCADO", -30)];
  const { context, dialog, toasts } = sandbox({ transactions, expenseActuals: { "super|2026-10": 12 }, closed: ["2026-08"] });
  context.clasificarV2Open();
  context.clasV2Accept();
  assert.equal(context.expenseActuals["super|2026-10"], 86.4);
  assert.match(dialog.innerHTML, /Tanda terminada · 1 regla nueva/);
  assert.match(dialog.innerHTML, /data-clas-v2-deshacer="0">Deshacer/);
  toasts[0].onUndo();
  assert.equal(context.movementMappings["expense|mercadona supermercado|"], undefined);
  assert.equal(context.expenseActuals["super|2026-10"], 12, "vuelve el real que había antes");
  assert.ok(!("super|2026-08" in context.expenseActuals), "el mes cerrado no se tocó al aceptar ni al deshacer");
  assert.match(dialog.innerHTML, /No se ha creado ninguna regla en esta tanda/);
  context.movementMappings["expense|mercadona supermercado|"] = { kind: "expense", rowKey: "expense|hogar" };
  toasts[0].onUndo();
  assert.equal(context.movementMappings["expense|mercadona supermercado|"].rowKey, "expense|hogar", "una regla deshecha no se vuelve a deshacer");
});

test("saltar deja el grupo en la bandeja; el resumen lo dice y ofrece otra tanda sin repetir los saltados", () => {
  const transactions = Array.from({ length: 7 }, (_, i) => tx("2026-10-05", `COMERCIO ${i}`, -10 - i));
  const { context, dialog } = sandbox({ transactions });
  context.clasificarV2Open();
  for (let i = 0; i < 5; i += 1) context.clasV2Skip();
  assert.match(dialog.innerHTML, /5 grupos saltados siguen en la bandeja\. Quedan 2 grupos para otra tanda\./);
  assert.match(dialog.innerHTML, /data-clas-v2-otra-tanda>Otros 2</);
  vm.runInContext("clasV2Created = []; clasV2StartBatch(); clasV2Render();", context);
  assert.equal(vm.runInContext("clasV2Groups.length", context), 2);
  assert.ok(!Object.keys(context.movementMappings).length, "saltar no escribe nada");
});

test("atajos de teclado del handoff y el foco en lo que hará ↵", () => {
  assert.match(clas, /event\.metaKey \|\| event\.ctrlKey\) && event\.key\.toLowerCase\(\) === "z"/);
  assert.match(clas, /if \(event\.key\.toLowerCase\(\) === "s"\) return clasV2Skip\(\);/);
  assert.match(clas, /\["\[data-clas-v2-aceptar\]:not\(\[disabled\]\)", "#clasificarV2Otra", "\[data-clas-v2-saltar\]"\]/);
  assert.match(css, /:root\[data-tema="v2"\] \.clas-v2-in > p\.clas-v2-atajos \{\s*display: block;/, "los atajos solo se enseñan en escritorio");
});

const grupo = (movement, amount = -50) => ({ key: `${amount >= 0 ? "income" : "expense"}|${movement.toLowerCase()}|`, kind: amount >= 0 ? "income" : "expense", name: movement, rows: [tx("2026-10-02", movement, amount)], total: Math.abs(amount) });
const regla = (rowId) => ({ kind: "expense", rowKey: `expense|${rowId}` });

test("confianza: el comercio es la primera palabra que no dice cómo se pagó", () => {
  const { context } = sandbox();
  assert.equal(context.clasV2Merchant({ movement: "COMPRA TARJ. MERCADONA 1234 VALENCIA" }), "mercadona");
  assert.equal(context.clasV2Merchant({ movement: "RECIBO IBERDROLA CLIENTES" }), "iberdrola");
  assert.equal(context.clasV2Merchant({ movement: "BIZUM ENVIADO A PEPE" }), "pepe");
  assert.equal(context.clasV2Merchant({ movement: "TPV 4455 12" }), "", "sin palabra con letras no hay comercio");
});

test("confianza alta: dos reglas del mismo comercio a la misma partida, o una y además el nombre de la partida en el concepto", () => {
  const dos = sandbox({ mappings: { "expense|compra mercadona 1111|": regla("super"), "expense|mercadona 2222|": regla("super") } });
  const a = dos.context.clasV2Proposal(grupo("COMPRA MERCADONA 3333"));
  assert.equal(a.row.id, "super");
  assert.equal(a.confidence, "alta");
  assert.equal(a.reason, "Ya tienes 2 reglas de «MERCADONA» a esta partida.");
  const una = sandbox({ mappings: { "expense|coche repsol 1|": regla("coche") } });
  const b = una.context.clasV2Proposal(grupo("COCHE REPSOL 2"));
  assert.equal(b.confidence, "alta", "una regla y el nombre «Coche» en el concepto");
  assert.match(b.reason, /y su nombre está en el concepto/);
});

test("confianza media: una sola regla del comercio, o una sola partida por nombre (o la más concreta que contiene a las demás)", () => {
  const { context } = sandbox({ mappings: { "expense|mercadona 1111|": regla("super") } });
  const a = context.clasV2Proposal(grupo("MERCADONA 2222"));
  assert.deepEqual([a.row.id, a.confidence, a.reason], ["super", "media", "Ya tienes una regla de «MERCADONA» a esta partida."]);
  const b = context.clasV2Proposal(grupo("GASTOS DEL HOGAR COMUNIDAD"));
  assert.deepEqual([b.row.id, b.confidence], ["hogar", "media"]);
  const c = context.clasV2Proposal(grupo("TALLER COCHE"));
  assert.deepEqual([c.row.id, c.confidence], ["coche", "media"]);
});

test("confianza baja: el comercio tiene reglas a varias partidas, o encajan por nombre partidas distintas", () => {
  const { context } = sandbox({ mappings: { "expense|amazon 1|": regla("hogar"), "expense|amazon 2|": regla("hogar"), "expense|amazon 3|": regla("ocio") } });
  const a = context.clasV2Proposal(grupo("AMAZON 4"));
  assert.deepEqual([a.row.id, a.confidence], ["hogar", "baja"]);
  assert.equal(a.reason, "«AMAZON» ya tiene reglas a 2 partidas distintas; esta es la que más.");
  const b = context.clasV2Proposal(grupo("SUPERMERCADO Y COCHE"));
  assert.deepEqual([b.row.id, b.confidence], ["super", "baja"], "la más concreta (nombre más largo) entre dos que no se contienen");
  assert.equal(b.reason, "2 partidas encajan por el nombre; esta es la más concreta.");
});

test("confianza: una regla del comercio que contradice el nombre baja a media, y las reglas de un solo movimiento no cuentan", () => {
  const { context } = sandbox({ mappings: { "expense|repsol 1|": regla("hogar"), "expense|repsol 2|": regla("hogar"), "2026-10-01||repsol 9|||": regla("ocio") } });
  const a = context.clasV2Proposal(grupo("REPSOL COCHE"));
  assert.deepEqual([a.row.id, a.confidence], ["hogar", "media"]);
  assert.match(a.reason, /aunque el concepto nombra «Coche»/);
  assert.equal(context.clasV2Proposal(grupo("BIZUM 6123")), null, "sin reglas ni nombre, sin propuesta");
});

