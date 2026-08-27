const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const read = (name) => fs.readFileSync(path.join(root, name), "utf8");
const app = read("app.js") + "\n" + read("views/deuda.js");
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

test("D-1/D-15 · las cuatro pestañas son Ruta, Comparar, Contratos y Simulador visual, en ese orden", () => {
  const source = extractConst("DEUDA_SCREEN_TABS");
  const ids = [...source.matchAll(/id: "([\w-]+)"/g)].map((match) => match[1]);
  assert.deepEqual(ids, ["deuda-ruta", "deuda-comparar", "deuda-contratos", "deuda-simulador"]);
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

// --- D-15: simulador visual promovido a cuarta pestaña de Deuda ------------------------------
// Antes vivía como un `<details>` de compatibilidad dentro de `#debt-roadmap` (menú avanzado,
// grupo legacy). A petición del usuario deja de estar oculto/relegado y pasa a ser una pestaña
// más de Deuda, con entrada propia en el menú avanzado y en el lanzador (grupo analysis, como el
// resto de Ruta/Comparar/Contratos). `#debt-roadmap` no se toca: conserva su formulario nativo de
// ofertas (E14b) y su propio enlace, sin relación con este cambio.

test("D-15 · #deuda-simulador tiene entrada en el menú avanzado y en el lanzador", () => {
  assert.match(html, /<a href="#deuda-simulador" data-e17-group="analysis">Simulador visual de deuda \(nuevo\)<\/a>/);
  assert.match(experience, /target: "deuda-simulador", label: "Simulador visual de deuda \(nuevo\)", group: "analysis"/);
});

test("D-15 · renderActiveSection sabe pintar deuda-simulador", () => {
  assert.match(app, /case "deuda-simulador":\s*\n\s*renderDeudaSimulador\(\);/);
});

test("D-15 · deuda-simulador lleva su propio contenedor de pestañas y el iframe promovido", () => {
  assert.match(html, /id="deudaSimuladorScreenTabs"/);
  assert.match(html, /id="deuda-simulador"[^>]*view-section|view-section[^>]*id="deuda-simulador"/);
  assert.match(html, /id="debtRoadmapFrame"/);
  assert.doesNotMatch(html, /e14b-legacy/, "el <details> de compatibilidad ya no existe: el iframe se movió a #deuda-simulador");
});

test("D-15 · renderDeudaSimulador pinta sus pestañas y reenvía el estado canónico al iframe", () => {
  const source = extractFunction("renderDeudaSimulador");
  assert.match(source, /renderDeudaScreenTabs\("deuda-simulador"\)/);
  assert.match(source, /sendDebtRoadmapState\(\)/);
});

// --- D-2: contratos como dato canónico editable -----------------------------------------------

test("D-2 · los únicos campos editables son capital, TAE y cuota", () => {
  const source = extractConst("DEBT_CONTRACT_EDITABLE_FIELDS");
  const match = source.match(/\[[^\]]*\]/s);
  const fields = JSON.parse(match[0]);
  assert.deepEqual(fields, ["currentPrincipal", "apr", "currentPayment"]);
});

function sandboxOverrides(overrides, customEntries = []) {
  const context = {
    DEBT_PORTFOLIO: [
      { id: "debt-1", entity: "Entidad A", currentPrincipal: 6000, currentPayment: 180, apr: 12 },
      { id: "debt-2", entity: "Entidad B", currentPrincipal: 3500, currentPayment: 140, apr: null },
    ],
    debtContractOverrides: overrides,
    debtContractCustomEntries: customEntries,
  };
  vm.createContext(context);
  vm.runInContext(extractFunction("debtPortfolioWithOverrides"), context);
  return context;
}

test("D-2 · sin overrides ni altas, la cartera con overrides es exactamente DEBT_PORTFOLIO", () => {
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

// --- D-2c: dar de alta un contrato nuevo -----------------------------------------------------

test("D-2c · un contrato dado de alta se añade detrás de DEBT_PORTFOLIO, sin tocarlo", () => {
  const custom = { id: "debt-custom-1", entity: "Entidad D", currentPrincipal: 1000, currentPayment: 50, apr: null };
  const context = sandboxOverrides({}, [custom]);
  const rows = context.debtPortfolioWithOverrides();
  assert.equal(rows.length, 3);
  assert.deepEqual(rows[2], custom);
});

test("D-2c · un override también se aplica a un contrato dado de alta, por su id", () => {
  const custom = { id: "debt-custom-1", entity: "Entidad D", currentPrincipal: 1000, currentPayment: 50, apr: null };
  const context = sandboxOverrides({ "debt-custom-1": { currentPrincipal: 800 } }, [custom]);
  const rows = context.debtPortfolioWithOverrides();
  assert.equal(rows[2].currentPrincipal, 800);
});

function sandboxCustomId(customEntries) {
  const context = {
    DEBT_PORTFOLIO: [{ id: "debt-1" }, { id: "debt-2" }, { id: "debt-3" }],
    debtContractCustomEntries: customEntries,
  };
  vm.createContext(context);
  vm.runInContext(extractFunction("nextDebtContractCustomId"), context);
  return context;
}

test("D-2c · nextDebtContractCustomId nunca choca con los ids de ejemplo ni con los ya dados de alta", () => {
  assert.equal(sandboxCustomId([]).nextDebtContractCustomId(), "debt-custom-1");
  assert.equal(
    sandboxCustomId([{ id: "debt-custom-1" }]).nextDebtContractCustomId(),
    "debt-custom-2"
  );
});

function sandboxAddParse() {
  const context = { round2: (value) => Math.round(Number(value) * 100) / 100 };
  vm.createContext(context);
  vm.runInContext(
    [extractConst("DEBT_CONTRACT_ADD_STATUSES"), extractFunction("deudaContratosAddFormParse")].join("\n"),
    context
  );
  return context;
}

test("D-2c · el alta exige entidad", () => {
  const { deudaContratosAddFormParse } = sandboxAddParse();
  const result = deudaContratosAddFormParse({ entity: "  ", principal: "100" });
  assert.ok(result.error);
});

test("D-2c · el alta exige un capital pendiente numérico y no negativo", () => {
  const { deudaContratosAddFormParse } = sandboxAddParse();
  assert.ok(deudaContratosAddFormParse({ entity: "Banco X", principal: "" }).error);
  assert.ok(deudaContratosAddFormParse({ entity: "Banco X", principal: "-5" }).error);
  assert.ok(deudaContratosAddFormParse({ entity: "Banco X", principal: "abc" }).error);
});

test("D-2c · TAE fuera de 0-60 no se acepta, pero en blanco se guarda como sin dato", () => {
  const { deudaContratosAddFormParse } = sandboxAddParse();
  assert.ok(deudaContratosAddFormParse({ entity: "Banco X", principal: "100", apr: "61" }).error);
  const { entry } = deudaContratosAddFormParse({ entity: "Banco X", principal: "100", apr: "" });
  assert.equal(entry.apr, null);
});

test("D-2c · «Liquidada» fuerza el capital pendiente a 0 aunque se escriba otro importe", () => {
  const { deudaContratosAddFormParse } = sandboxAddParse();
  const { entry } = deudaContratosAddFormParse({ entity: "Banco X", principal: "900", status: "settled" });
  assert.equal(entry.currentPrincipal, 0);
  assert.equal(entry.initialPrincipal, 900, "el capital original declarado no se pierde");
  assert.equal(entry.paymentStatus, "settled");
});

test("D-2c · «Reunificada» marca reunified sin tocar el capital", () => {
  const { deudaContratosAddFormParse } = sandboxAddParse();
  const { entry } = deudaContratosAddFormParse({ entity: "Banco X", principal: "900", status: "reunified" });
  assert.equal(entry.reunified, true);
  assert.equal(entry.currentPrincipal, 900);
});

test("D-2c · el alta válida marca custom:true, para poder borrarla luego", () => {
  const { deudaContratosAddFormParse } = sandboxAddParse();
  const { entry } = deudaContratosAddFormParse({ entity: "Banco X", principal: "100" });
  assert.equal(entry.custom, true);
});

function sandboxAddSubmit(customEntries) {
  let saved = null;
  let rendered = 0;
  const values = {
    entity: "Banco X",
    type: "Crédito",
    number: "",
    principal: "100",
    apr: "",
    payment: "0",
    status: "active",
    installments: "",
  };
  const context = {
    round2: (value) => Math.round(Number(value) * 100) / 100,
    debtContractCustomEntries: customEntries,
    nextDebtContractCustomId: () => "debt-custom-9",
    deudaContratosAddFormValues: () => values,
    saveDebtContractCustomEntries: () => {
      saved = context.debtContractCustomEntries;
    },
    renderDeudaContratos: () => {
      rendered += 1;
    },
    qs: () => ({ reset() {}, set textContent(_value) {}, set hidden(_value) {} }),
  };
  vm.createContext(context);
  vm.runInContext(
    [extractConst("DEBT_CONTRACT_ADD_STATUSES"), extractFunction("deudaContratosAddFormParse"), extractFunction("handleDeudaContratosAddSubmit")].join("\n"),
    context
  );
  return { context, getSaved: () => saved, getRenderCount: () => rendered };
}

test("D-2c · un alta válida se añade a debtContractCustomEntries, se guarda y repinta", () => {
  const { context, getSaved, getRenderCount } = sandboxAddSubmit([]);
  context.handleDeudaContratosAddSubmit({ preventDefault: () => {} });
  assert.equal(context.debtContractCustomEntries.length, 1);
  assert.equal(context.debtContractCustomEntries[0].id, "debt-custom-9");
  assert.deepEqual(getSaved(), context.debtContractCustomEntries);
  assert.equal(getRenderCount(), 1);
});

function sandboxRemoveCustom(customEntries, overrides) {
  let savedEntries = null;
  let savedOverrides = null;
  let rendered = 0;
  const context = {
    debtContractCustomEntries: customEntries,
    debtContractOverrides: overrides,
    saveDebtContractCustomEntries: () => {
      savedEntries = context.debtContractCustomEntries;
    },
    saveDebtContractOverrides: () => {
      savedOverrides = context.debtContractOverrides;
    },
    renderDeudaContratos: () => {
      rendered += 1;
    },
  };
  vm.createContext(context);
  vm.runInContext(extractFunction("handleDeudaContratosRemoveCustom"), context);
  return { context, getSavedEntries: () => savedEntries, getSavedOverrides: () => savedOverrides, getRenderCount: () => rendered };
}

test("D-2c · eliminar un contrato dado de alta lo quita de la lista y de sus overrides", () => {
  const custom = [{ id: "debt-custom-1", entity: "Entidad D" }];
  const overrides = { "debt-custom-1": { currentPrincipal: 500 } };
  const { context, getSavedEntries, getSavedOverrides, getRenderCount } = sandboxRemoveCustom(custom, overrides);
  context.handleDeudaContratosRemoveCustom("debt-custom-1");
  assert.deepEqual(plain(context.debtContractCustomEntries), []);
  assert.deepEqual(plain(context.debtContractOverrides), {});
  assert.deepEqual(plain(getSavedEntries()), []);
  assert.deepEqual(plain(getSavedOverrides()), {});
  assert.equal(getRenderCount(), 1);
});

test("D-2c · eliminar un id que no existe no hace nada", () => {
  const { context, getRenderCount } = sandboxRemoveCustom([{ id: "debt-custom-1" }], {});
  context.handleDeudaContratosRemoveCustom("debt-custom-does-not-exist");
  assert.equal(context.debtContractCustomEntries.length, 1);
  assert.equal(getRenderCount(), 0);
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
    // D-2b: renderDeudaContratos pinta también el pie de cuadre — stub aquí, cubierto de verdad en
    // tests/d-2b-cuadre-capital-deuda.test.cjs.
    debtCapitalCuadre: () => ({ status: "sin-cierre", current: 0, atClose: null, diff: null, monthKey: null }),
    deudaContratosCuadreHtml: () => "",
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

test("D-2c · debtContractCustomEntries se carga y se guarda con el mismo patrón que debtContractOverrides", () => {
  assert.match(app, /let debtContractCustomEntries = \[\];/);
  assert.match(
    app,
    /debtContractCustomEntries = Array\.isArray\(payload\.debtContractCustomEntries\) \? payload\.debtContractCustomEntries : \[\];/
  );
  assert.match(app, /storageSet\(storageKey\("debtContractCustomEntries"\), JSON\.stringify\(debtContractCustomEntries\)\);/);
  assert.match(app, /debtContractCustomEntries: JSON\.parse\(storageGet\(storageKey\("debtContractCustomEntries"\), "\[\]"\)\)/);
  assert.match(app, /debtContractOverrides = \{\};\s*\n\s*debtRoadmapState = \{\};\s*\n\s*debtContractCustomEntries = \[\];/);
});

test("D-2c · saveDebtContractCustomEntries persiste y encola la sincronización remota, como saveDebtContractOverrides", () => {
  const fn = extractFunction("saveDebtContractCustomEntries");
  assert.match(fn, /storageSet\(storageKey\("debtContractCustomEntries"\)/);
  assert.match(fn, /queueRemoteSave\(\);/);
});

test("D-2c · el payload de sincronización remota incluye debtContractCustomEntries junto a debtContractOverrides", () => {
  assert.match(app, /debtContractOverrides,\s*\n\s*debtContractCustomEntries,/);
});

test("D-2c · la tabla delega el borrado y el alta en sus propios manejadores", () => {
  assert.match(
    app,
    /qs\("deudaContratosTable"\)\?\.addEventListener\("click", \(event\) => \{\s*\n\s*const removeButton = event\.target\.closest\("\[data-deuda-contrato-remove\]"\);\s*\n\s*if \(removeButton\) handleDeudaContratosRemoveCustom\(removeButton\.dataset\.deudaContratoRemove\);/
  );
  assert.match(app, /qs\("deudaContratosAddForm"\)\?\.addEventListener\("submit", \(event\) => handleDeudaContratosAddSubmit\(event\)\);/);
});

test("D-2c · el formulario de alta y su error viven en el HTML de Deuda › Contratos", () => {
  assert.match(html, /id="deudaContratosAddForm"/);
  assert.match(html, /id="deudaContratosAddEntity"/);
  assert.match(html, /id="deudaContratosAddPrincipal"/);
  assert.match(html, /id="deudaContratosAddError"/);
});

test("D-1/D-2 · viaja en el shell offline versionado (sin bump: solo se tocaron ficheros ya cacheados)", () => {
  assert.match(worker, /20260821-d1a1/);
  assert.match(html, /app\.js\?v=20260827d1a2/);
  assert.match(html, /design-tokens\.css\?v=20260814f1a1/);
});

test("D-2 · el CSS reutiliza .e19-table en vez de declarar una tabla nueva desde cero", () => {
  assert.match(html, /<table class="e19-table deuda-contratos-table" id="deudaContratosTable">/);
  assert.match(css, /\.deuda-contratos-table td input\[type="number"\] \{/);
});
