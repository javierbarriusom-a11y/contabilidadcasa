const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const read = (name) => fs.readFileSync(path.join(root, name), "utf8");
const app = read("app.js");
const html = read("index.html");
const css = read("design-tokens.css");
const experience = read("e17-experience.js");
const worker = read("service-worker.js");

// D-1 · pestañas Ruta / Comparar / Contratos. Ruta y Comparar ya eran pantallas completas del
// epic V3 (reconciliado el 15 de agosto con el backlog de nueve pantallas, que las daba por
// "Pendiente" sin conocerlas); se enlazan visualmente como pestañas sin fusionar su DOM. Contratos
// (D-2) es la única construida desde cero: la primera puerta de escritura real de DEBT_PORTFOLIO.

function extractFunction(name) {
  const start = app.indexOf(`function ${name}(`);
  assert.ok(start >= 0, `No existe la función ${name} en app.js`);
  let parenDepth = 0;
  let bodyStart = -1;
  for (let index = app.indexOf("(", start); index < app.length; index += 1) {
    if (app[index] === "(") parenDepth += 1;
    else if (app[index] === ")") {
      parenDepth -= 1;
      if (parenDepth === 0) {
        bodyStart = app.indexOf("{", index);
        break;
      }
    }
  }
  assert.ok(bodyStart >= 0, `No se encontró el cuerpo de ${name}`);
  let depth = 0;
  for (let index = bodyStart; index < app.length; index += 1) {
    if (app[index] === "{") depth += 1;
    else if (app[index] === "}") {
      depth -= 1;
      if (depth === 0) return app.slice(start, index + 1);
    }
  }
  throw new Error(`La función ${name} no cierra sus llaves`);
}

function extractConst(name) {
  const start = app.indexOf(`const ${name} =`);
  assert.ok(start >= 0, `No existe la constante ${name} en app.js`);
  const end = app.indexOf(";\n", start);
  assert.ok(end >= 0, `No se encontró el final de ${name}`);
  return app.slice(start, end + 1);
}

function sandboxWith(names, extra = {}) {
  const context = { ...extra };
  vm.createContext(context);
  vm.runInContext(names.map((name) => extractFunction(name)).join("\n"), context);
  return context;
}

// --- D-1: barra de pestañas de pantalla ------------------------------------------------------

function sandboxTabs() {
  const context = { escapeHtml: (value) => String(value ?? "") };
  vm.createContext(context);
  vm.runInContext(
    [extractConst("DEUDA_SCREEN_TABS"), extractConst("DEUDA_SCREEN_TAB_NAV_IDS"), extractFunction("deudaScreenTabsHtml")].join("\n"),
    context
  );
  return context;
}

test("D-1 · las tres pestañas son Ruta, Comparar y Contratos, en ese orden", () => {
  const source = extractConst("DEUDA_SCREEN_TABS");
  const ids = [...source.matchAll(/id: "([\w-]+)"/g)].map((match) => match[1]);
  assert.deepEqual(ids, ["deuda-ruta", "deuda-comparar", "deuda-contratos"]);
});

test("D-1 · deudaScreenTabsHtml marca is-active solo en la pestaña activa, con aria-selected", () => {
  const { deudaScreenTabsHtml } = sandboxTabs();
  const result = deudaScreenTabsHtml("deuda-comparar");
  assert.match(result, /class="e19-registrar-tab is-active" href="#deuda-comparar" aria-selected="true"/);
  assert.match(result, /class="e19-registrar-tab" href="#deuda-ruta" aria-selected="false"/);
  assert.match(result, /class="e19-registrar-tab" href="#deuda-contratos" aria-selected="false"/);
});

test("D-1 · cada pestalla enlaza con hash real, no con un manejador de clic exclusivo", () => {
  const html2 = extractFunction("deudaScreenTabsHtml");
  assert.match(html2, /href="#\$\{tab\.id\}"/);
});

test("D-1 · renderDeudaScreenTabs escribe en el nav correcto según la pantalla activa", () => {
  const written = {};
  const context = sandboxWith(["deudaScreenTabsHtml", "renderDeudaScreenTabs"], {
    escapeHtml: (value) => String(value ?? ""),
    DEUDA_SCREEN_TABS: [
      { id: "deuda-ruta", label: "Ruta" },
      { id: "deuda-comparar", label: "Comparar" },
      { id: "deuda-contratos", label: "Contratos" },
    ],
    DEUDA_SCREEN_TAB_NAV_IDS: {
      "deuda-ruta": "deudaRutaScreenTabs",
      "deuda-comparar": "deudaCompararScreenTabs",
      "deuda-contratos": "deudaContratosScreenTabs",
    },
    qs: (id) => ({
      set innerHTML(value) {
        written[id] = value;
      },
    }),
  });
  context.renderDeudaScreenTabs("deuda-contratos");
  assert.ok(written.deudaContratosScreenTabs.includes("is-active"));
  assert.ok(!written.deudaRutaScreenTabs);
});

test("D-1 · las tres secciones llevan su propio contenedor de pestañas en el HTML", () => {
  assert.match(html, /id="deudaRutaScreenTabs"/);
  assert.match(html, /id="deudaCompararScreenTabs"/);
  assert.match(html, /id="deudaContratosScreenTabs"/);
});

test("D-1 · Ruta y Comparar renderizan sus pestañas al pintarse, sin tocar su DOM previo", () => {
  const ruta = extractFunction("renderDeudaRuta");
  assert.match(ruta, /renderDeudaScreenTabs\("deuda-ruta"\)/);
  const comparar = extractFunction("renderDeudaComparar");
  assert.match(comparar, /renderDeudaScreenTabs\("deuda-comparar"\)/);
});

test("D-1 · el enlace principal «Deuda» sigue apuntando a #deuda-ruta, sin regresión", () => {
  assert.match(html, /<a href="#deuda-ruta" class="nav-primary-link">/);
});

test("D-1 · #deuda-contratos tiene entrada en el menú avanzado y en el lanzador", () => {
  assert.match(html, /<a href="#deuda-contratos" data-e17-group="analysis">Contratos de deuda \(nuevo\)<\/a>/);
  assert.match(experience, /target: "deuda-contratos", label: "Contratos de deuda \(nuevo\)", group: "analysis"/);
});

test("D-1 · renderActiveSection sabe pintar deuda-contratos", () => {
  assert.match(app, /case "deuda-contratos":\s*\n\s*renderDeudaContratos\(\);/);
});

// --- D-2: contratos como dato canónico editable -----------------------------------------------

test("D-2 · los únicos campos editables son capital, TAE y cuota", () => {
  const source = extractConst("DEBT_CONTRACT_EDITABLE_FIELDS");
  const match = source.match(/\[[^\]]*\]/s);
  const fields = JSON.parse(match[0]);
  assert.deepEqual(fields, ["currentPrincipal", "apr", "currentPayment"]);
});

function sandboxOverrides(overrides) {
  const context = {
    DEBT_PORTFOLIO: [
      { id: "debt-1", entity: "Entidad A", currentPrincipal: 6000, currentPayment: 180, apr: 12 },
      { id: "debt-2", entity: "Entidad B", currentPrincipal: 3500, currentPayment: 140, apr: null },
    ],
    debtContractOverrides: overrides,
  };
  vm.createContext(context);
  vm.runInContext(extractFunction("debtPortfolioWithOverrides"), context);
  return context;
}

test("D-2 · sin overrides, la cartera con overrides es exactamente DEBT_PORTFOLIO", () => {
  const context = sandboxOverrides({});
  assert.deepEqual(JSON.parse(JSON.stringify(context.debtPortfolioWithOverrides())), context.DEBT_PORTFOLIO);
});

test("D-2 · un override solo cambia los campos corregidos de ese contrato, no el resto", () => {
  const context = sandboxOverrides({ "debt-1": { currentPrincipal: 5000 } });
  const [first, second] = context.debtPortfolioWithOverrides();
  assert.equal(first.currentPrincipal, 5000);
  assert.equal(first.currentPayment, 180, "la cuota no editada se queda como estaba declarada");
  assert.equal(second.currentPrincipal, 3500, "el otro contrato no se toca");
});

test("D-2 · debtContractBundle pasa por debtPortfolioWithOverrides antes de normalizar", () => {
  const bundle = extractFunction("debtContractBundle");
  assert.match(bundle, /DebtContracts\.normalizeContracts\(debtPortfolioWithOverrides\(\)/);
});

// --- D-2: validación de la celda editada --------------------------------------------------

function sandboxParse() {
  const context = {};
  vm.createContext(context);
  vm.runInContext([extractFunction("round2"), extractFunction("deudaContratosParseFieldValue")].join("\n"), context);
  return context;
}

const plain = (value) => JSON.parse(JSON.stringify(value));

test("D-2 · vaciar la celda no escribe un cero: pide borrar el override", () => {
  const { deudaContratosParseFieldValue } = sandboxParse();
  assert.deepEqual(plain(deudaContratosParseFieldValue("currentPrincipal", "")), { clear: true });
  assert.deepEqual(plain(deudaContratosParseFieldValue("currentPrincipal", "   ")), { clear: true });
});

test("D-2 · un capital o cuota negativos no se aceptan", () => {
  const { deudaContratosParseFieldValue } = sandboxParse();
  assert.deepEqual(plain(deudaContratosParseFieldValue("currentPrincipal", "-10")), { invalid: true });
  assert.deepEqual(plain(deudaContratosParseFieldValue("currentPayment", "-1")), { invalid: true });
});

test("D-2 · un TAE por encima de 60% no se acepta, pero 0% sí", () => {
  const { deudaContratosParseFieldValue } = sandboxParse();
  assert.deepEqual(plain(deudaContratosParseFieldValue("apr", "61")), { invalid: true });
  assert.deepEqual(plain(deudaContratosParseFieldValue("apr", "0")), { value: 0 });
});

test("D-2 · un texto no numérico no se acepta, y la coma decimal sí", () => {
  const { deudaContratosParseFieldValue } = sandboxParse();
  assert.deepEqual(plain(deudaContratosParseFieldValue("currentPrincipal", "abc")), { invalid: true });
  assert.deepEqual(plain(deudaContratosParseFieldValue("currentPrincipal", "1234,5")), { value: 1234.5 });
});

// --- D-2: escritura desde la celda ----------------------------------------------------------

function sandboxHandler(initialOverrides) {
  let saved = null;
  let rendered = 0;
  const context = {
    debtContractOverrides: initialOverrides,
    DEBT_CONTRACT_EDITABLE_FIELDS: ["currentPrincipal", "apr", "currentPayment"],
    saveDebtContractOverrides: () => {
      saved = context.debtContractOverrides;
    },
    renderDeudaContratos: () => {
      rendered += 1;
    },
  };
  vm.createContext(context);
  vm.runInContext([extractFunction("round2"), extractFunction("deudaContratosParseFieldValue"), extractFunction("handleDeudaContratosFieldChange")].join("\n"), context);
  return { context, getSaved: () => saved, getRenderCount: () => rendered };
}

test("D-2 · escribir un valor válido guarda el override y repinta", () => {
  const { context, getSaved, getRenderCount } = sandboxHandler({});
  context.handleDeudaContratosFieldChange({ dataset: { deudaContratoId: "debt-1", deudaContratoField: "currentPrincipal" }, value: "4500" });
  assert.equal(context.debtContractOverrides["debt-1"].currentPrincipal, 4500);
  assert.deepEqual(getSaved(), context.debtContractOverrides);
  assert.equal(getRenderCount(), 1);
});

test("D-2 · un valor inválido no toca el override, pero repinta para restaurar el último válido", () => {
  const { context, getSaved, getRenderCount } = sandboxHandler({ "debt-1": { currentPrincipal: 4500 } });
  context.handleDeudaContratosFieldChange({ dataset: { deudaContratoId: "debt-1", deudaContratoField: "currentPrincipal" }, value: "-5" });
  assert.deepEqual(context.debtContractOverrides, { "debt-1": { currentPrincipal: 4500 } });
  assert.equal(getSaved(), null, "no se llama a guardar con un valor inválido");
  assert.equal(getRenderCount(), 1);
});

test("D-2 · vaciar el único campo corregido de un contrato borra la entrada entera, no la deja vacía", () => {
  const { context } = sandboxHandler({ "debt-1": { currentPrincipal: 4500 } });
  context.handleDeudaContratosFieldChange({ dataset: { deudaContratoId: "debt-1", deudaContratoField: "currentPrincipal" }, value: "" });
  assert.deepEqual(plain(context.debtContractOverrides), {});
});

test("D-2 · vaciar un campo cuando el contrato tiene otro corregido conserva el otro", () => {
  const { context } = sandboxHandler({ "debt-1": { currentPrincipal: 4500, apr: 9 } });
  context.handleDeudaContratosFieldChange({ dataset: { deudaContratoId: "debt-1", deudaContratoField: "currentPrincipal" }, value: "" });
  assert.deepEqual(plain(context.debtContractOverrides), { "debt-1": { apr: 9 } });
});

test("D-2 · un campo que no está en la lista editable se ignora", () => {
  const { context, getRenderCount } = sandboxHandler({});
  context.handleDeudaContratosFieldChange({ dataset: { deudaContratoId: "debt-1", deudaContratoField: "entity" }, value: "Otra" });
  assert.deepEqual(context.debtContractOverrides, {});
  assert.equal(getRenderCount(), 0);
});

// --- D-2: pintado de la fila y de la tabla --------------------------------------------------

test("D-2 · la fila lleva los tres inputs con el id y el campo del contrato", () => {
  const row = extractFunction("deudaContratosRowHtml");
  assert.match(row, /data-deuda-contrato-field="currentPrincipal"/);
  assert.match(row, /data-deuda-contrato-field="apr"/);
  assert.match(row, /data-deuda-contrato-field="currentPayment"/);
});

test("D-2 · la insignia «Editado» solo aparece cuando el contrato tiene override", () => {
  const context = {
    escapeHtml: (value) => String(value ?? ""),
    round2: (value) => Math.round(Number(value) * 100) / 100,
  };
  vm.createContext(context);
  vm.runInContext(
    [extractFunction("deudaContratosStatusBadge"), extractFunction("deudaContratosQualityBadge"), extractFunction("deudaContratosRowHtml")].join("\n"),
    context
  );
  context.debtContractOverrides = { "debt-1": { currentPrincipal: 5000 } };
  const contract = { id: "debt-1", entity: "Entidad A", type: "Crédito", number: "", currentPrincipal: 5000, currentPayment: 180, apr: 12, paymentStatus: "active", dataQuality: { missing: [], confidence: "high" } };
  assert.match(context.deudaContratosRowHtml(contract), /Editado/);
  context.debtContractOverrides = {};
  assert.doesNotMatch(context.deudaContratosRowHtml(contract), /Editado/);
});

test("D-2 · renderDeudaContratos pinta pestañas, cabecera y filas, y usa el desglose real", () => {
  const written = {};
  let notedText = "";
  const context = sandboxWith(["deudaContratosStatusBadge", "deudaContratosQualityBadge", "deudaContratosRowHtml", "renderDeudaContratos"], {
    escapeHtml: (value) => String(value ?? ""),
    round2: (value) => Math.round(Number(value) * 100) / 100,
    debtContractOverrides: { "debt-1": { currentPrincipal: 5000 } },
    debtContractSourceRows: () => [
      { id: "debt-1", entity: "Entidad A", type: "Crédito", number: "", currentPrincipal: 5000, currentPayment: 180, apr: 12, paymentStatus: "active", dataQuality: { missing: [], confidence: "high" } },
      { id: "debt-2", entity: "Entidad B", type: "Tarjeta", number: "", currentPrincipal: 3500, currentPayment: 140, apr: null, paymentStatus: "active", dataQuality: { missing: ["apr"], confidence: "medium" } },
    ],
    renderDeudaScreenTabs: () => {},
    qs: (id) => ({
      set innerHTML(value) {
        written[id] = value;
      },
      set textContent(value) {
        notedText = value;
      },
    }),
  });
  context.renderDeudaContratos();
  assert.ok(written.deudaContratosTable.includes("Entidad A"));
  assert.ok(written.deudaContratosTable.includes("Entidad B"));
  assert.match(notedText, /1 de 2 contrato/);
});

// --- D-2: puerta única, persistida como el resto del estado del hogar -------------------------

test("D-2 · debtContractOverrides se carga y se guarda con el mismo patrón que movementMappings", () => {
  assert.match(app, /let debtContractOverrides = \{\};/);
  assert.match(
    app,
    /debtContractOverrides =\s*\n\s*payload\.debtContractOverrides && typeof payload\.debtContractOverrides === "object" \? payload\.debtContractOverrides : \{\};/
  );
  assert.match(app, /storageSet\(storageKey\("debtContractOverrides"\), JSON\.stringify\(debtContractOverrides\)\);/);
  assert.match(app, /debtContractOverrides: JSON\.parse\(storageGet\(storageKey\("debtContractOverrides"\), "\{\}"\)\)/);
  assert.match(app, /debtContractOverrides = \{\};\s*\n\s*debtRoadmapState = \{\};/);
});

test("D-2 · saveDebtContractOverrides persiste y encola la sincronización remota, como saveMovementMappings", () => {
  const fn = extractFunction("saveDebtContractOverrides");
  assert.match(fn, /storageSet\(storageKey\("debtContractOverrides"\)/);
  assert.match(fn, /queueRemoteSave\(\);/);
});

test("D-2 · el payload de sincronización remota incluye debtContractOverrides, con su etiqueta canónica", () => {
  assert.match(app, /rowLabelOverrides,\s*\n\s*movementMappings,\s*\n\s*debtContractOverrides,/);
  assert.match(app, /debtContractOverrides: "Contrato de deuda",/);
});

test("D-2 · el listener de la tabla delega en handleDeudaContratosFieldChange igual que Plan · Mes con handlePlanMesPlannedChange", () => {
  assert.match(
    app,
    /qs\("deudaContratosTable"\)\?\.addEventListener\("change", \(event\) => \{\s*\n\s*const input = event\.target\.closest\("\[data-deuda-contrato-id\]"\);\s*\n\s*if \(input\) handleDeudaContratosFieldChange\(input\);/
  );
});

test("D-1/D-2 · viaja en el shell offline versionado (sin bump: solo se tocaron ficheros ya cacheados)", () => {
  assert.match(worker, /20260814-f1a1/);
  assert.match(html, /app\.js\?v=20260814f1a1/);
  assert.match(html, /design-tokens\.css\?v=20260814f1a1/);
});

test("D-2 · el CSS reutiliza .e19-table en vez de declarar una tabla nueva desde cero", () => {
  assert.match(html, /<table class="e19-table deuda-contratos-table" id="deudaContratosTable">/);
  assert.match(css, /\.deuda-contratos-table td input\[type="number"\] \{/);
});
