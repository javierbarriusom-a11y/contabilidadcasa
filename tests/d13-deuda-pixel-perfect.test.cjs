const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const app = fs.readFileSync(path.join(root, "app.js"), "utf8");
const E14DebtOperations = require(path.join(root, "canonical-e14-operations.js"));

// Repaso pixel-perfect del 21 de agosto de 2026 (sesión «pantalla por pantalla», continuación de
// Hoy, Registrar, Movimientos y Plan), contra `Deuda.pdf`. Con las 17 tareas de deuda-ruta ya en
// Hecho, este repaso encontró y corrigió cinco cosas, dos de ellas consultadas con el usuario:
//
// 1. `viewTitles` no tenía entrada para once vistas (incluidas las tres de Deuda) — la cabecera
//    compartida caía en `viewTitles.home` («Hoy · Qué necesita tu atención») al entrar en ellas
//    directamente.
// 2. `deudaRutaAttackTable` (el TIN de un contrato): `contract.apr` es `null`, no 0, cuando no se
//    conoce el TIN — Number(null) da 0, así que sin descartarlo antes de convertir un TIN
//    desconocido se veía como un crédito al 0 %.
// 3. «Orden de ataque» fusiona el selector de estrategia + «Ruta propuesta» + «Cartera» en una
//    tabla por contrato (decisión del usuario: reconstruir fiel al mockup).
// 4. La tarjeta «Oferta en curso» pasa a fondo oscuro cuando hay una oferta real.
// 5. El enlace a la heredada #debt-roadmap para «editar oferta» se sustituye por un formulario in
//    situ (decisión del usuario: construirlo aquí en vez de dejarlo enlazado).

function extractFunction(name) {
  let start = app.indexOf(`function ${name}(`);
  assert.ok(start >= 0, `No existe la función ${name} en app.js`);
  if (start >= 6 && app.slice(start - 6, start) === "async ") start -= 6;
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

function sandboxWith(names, extra = {}) {
  const context = { ...extra };
  vm.createContext(context);
  names.forEach((name) => vm.runInContext(extractFunction(name), context));
  return context;
}

// --- viewTitles cubre las once vistas que faltaban -----------------------------------------------

test("viewTitles trae una entrada para cada view-section del menú, sin caer en viewTitles.home", () => {
  const start = app.indexOf("const viewTitles = {");
  const open = app.indexOf("{", start);
  let depth = 0;
  let end = open;
  for (let index = open; index < app.length; index += 1) {
    if (app[index] === "{") depth += 1;
    else if (app[index] === "}") {
      depth -= 1;
      if (depth === 0) { end = index; break; }
    }
  }
  const source = app.slice(open, end + 1);
  const keys = [...source.matchAll(/\n\s*"?([A-Za-z0-9_-]+)"?:\s*\{/g)].map((m) => m[1]);
  const ids = [...html.matchAll(/class="[^"]*view-section[^"]*"\s+id="([^"]+)"/g)].map((m) => m[1]);
  const missing = ids.filter((id) => !keys.includes(id));
  assert.deepEqual(missing, [], "toda view-section navegable tiene su propia entrada en viewTitles");
  ["deuda-ruta", "deuda-comparar", "deuda-contratos"].forEach((id) => assert.ok(keys.includes(id), `viewTitles."${id}" existe`));
});

// --- Orden de ataque: TIN desconocido no es un 0 % ------------------------------------------------

test("deudaRutaAttackRowHtml distingue TIN desconocido (null) de un TIN real del 0 %", () => {
  const context = sandboxWith(["deudaRutaAttackRowHtml"], {
    escapeHtml: (v) => String(v ?? ""),
    money: (v) => `${v} €`,
    escenarioMotorDebtLabel: (c) => c.entity,
    escenarioMotorMonthLabel: (v) => v,
  });
  const sinTin = context.deudaRutaAttackRowHtml(0, { id: "a", entity: "Entidad A", currentPrincipal: 1000, currentPayment: 50, apr: null }, new Map(), new Map(), 1000);
  assert.match(sinTin, /<td>—<\/td>/, "sin TIN declarado se ve como guion, no como 0.0%");
  assert.doesNotMatch(sinTin, /0\.0%/);

  const conTinCero = context.deudaRutaAttackRowHtml(0, { id: "b", entity: "Entidad B", currentPrincipal: 1000, currentPayment: 50, apr: 0 }, new Map(), new Map(), 1000);
  assert.match(conTinCero, /0\.0%/, "un TIN real del 0 % (crédito familiar) sí se distingue y se muestra");

  const conTin = context.deudaRutaAttackRowHtml(0, { id: "c", entity: "Entidad C", currentPrincipal: 1000, currentPayment: 50, apr: 18.9 }, new Map(), new Map(), 1000);
  assert.match(conTin, /18\.9%/);
});

test("renderDeudaRutaAttackTable promedia el TIN solo entre los contratos con TIN conocido", () => {
  const foot = { innerHTML: "" };
  const body = { innerHTML: "" };
  const context = sandboxWith(["renderDeudaRutaAttackTable", "deudaRutaAttackRowHtml"], {
    qs: (id) => ({ deudaRutaAttackBody: body, deudaRutaAttackFoot: foot, deudaRutaAttackNote: { textContent: "" } })[id] || null,
    escapeHtml: (v) => String(v ?? ""),
    money: (v) => `${v} €`,
    round2: (v) => Math.round((v + Number.EPSILON) * 100) / 100,
    escenarioMotorDebtLabel: (c) => c.entity,
    escenarioMotorMonthLabel: () => "—",
    deudaRutaEmptyTimelineText: () => "",
  });
  const contracts = [
    { id: "a", entity: "A", currentPrincipal: 1000, currentPayment: 50, apr: null },
    { id: "b", entity: "B", currentPrincipal: 1000, currentPayment: 50, apr: 10 },
  ];
  context.renderDeudaRutaAttackTable(contracts, { decisions: [], libreDeDeuda: "" }, new Map(), { label: "Avalancha" });
  assert.match(foot.innerHTML, /media 10\.0%/, "la media ignora el contrato sin TIN, no lo cuenta como 0%");
});

// --- updateE14bOffer: edita in situ, misma validación que el alta ---------------------------------

function sandboxUpdateOffer(offers, extra = {}) {
  const workspace = { offers, selectedOfferId: "" };
  const calls = { queueRemoteSave: 0 };
  const context = sandboxWith(["updateE14bOffer"], {
    E14DebtOperations,
    e14bWorkspace: () => workspace,
    debtTargetById: extra.debtTargetById || (() => ({ id: "c1", currentPrincipal: 5000 })),
    queueRemoteSave: () => { calls.queueRemoteSave += 1; },
  });
  return { context, workspace, calls };
}

test("updateE14bOffer sustituye la oferta existente por su versión normalizada, sin tocar el id ni el contrato", () => {
  const original = { id: "offer-1", contractId: "c1", counterpart: "Cetelem", amount: 4000, expiresAt: "2026-09", documents: [], status: "received" };
  const { context, workspace, calls } = sandboxUpdateOffer([original]);
  const result = context.updateE14bOffer("offer-1", { counterpart: "Cofidis", amount: 4500 });
  assert.equal(result.valid, true);
  assert.equal(result.counterpart, "Cofidis");
  assert.equal(result.amount, 4500);
  assert.equal(result.id, "offer-1");
  assert.equal(result.contractId, "c1");
  assert.equal(workspace.offers[0].counterpart, "Cofidis");
  assert.equal(calls.queueRemoteSave, 1);
});

test("updateE14bOffer devuelve null si el id no existe, sin tocar el workspace", () => {
  const { context, workspace, calls } = sandboxUpdateOffer([{ id: "offer-1", contractId: "c1", counterpart: "X", amount: 1, expiresAt: "2026-09", documents: [] }]);
  const result = context.updateE14bOffer("offer-inexistente", { counterpart: "Y" });
  assert.equal(result, null);
  assert.equal(workspace.offers[0].counterpart, "X");
  assert.equal(calls.queueRemoteSave, 0);
});

test("updateE14bOffer no guarda un cambio inválido (p. ej. vaciar la contraparte) y explica el motivo", () => {
  const original = { id: "offer-1", contractId: "c1", counterpart: "Cetelem", amount: 4000, expiresAt: "2026-09", documents: [] };
  const { context, workspace } = sandboxUpdateOffer([original]);
  const result = context.updateE14bOffer("offer-1", { counterpart: "" });
  assert.equal(result.valid, false);
  assert.ok(result.issues.includes("missing-counterpart"));
  assert.equal(workspace.offers[0].counterpart, "Cetelem", "la oferta original no se sobrescribe con un cambio inválido");
});

// --- handleDeudaRutaOfferEditSubmit: lee el formulario y llama a updateE14bOffer -------------------

test("handleDeudaRutaOfferEditSubmit lee los campos del formulario y guarda con updateE14bOffer", () => {
  const fields = {
    deudaRutaOfferEditCounterpart: { value: "Cofidis" },
    deudaRutaOfferEditExpiresAt: { value: "2026-10" },
    deudaRutaOfferEditAmount: { value: "5200" },
    deudaRutaOfferEditPaymentType: { value: "refinancing" },
    deudaRutaOfferEditInstallment: { value: "220" },
    deudaRutaOfferEditTermMonths: { value: "36" },
    deudaRutaOfferEditDocOffer: { checked: true },
    deudaRutaOfferEditDocAuthority: { checked: false },
    deudaRutaOfferEditDocTerms: { checked: true },
    deudaRutaOfferEditAccepted: { checked: true },
  };
  const calls = [];
  const context = sandboxWith(["handleDeudaRutaOfferEditSubmit"], {
    qs: (id) => fields[id] || null,
    parseAmount: (v) => Number(v),
    updateE14bOffer: (offerId, patch) => { calls.push([offerId, patch]); return { valid: true }; },
    renderDeudaRutaOffer: () => calls.push("renderDeudaRutaOffer"),
    deudaRutaOfferStatusMessage: "",
    deudaRutaOfferEditOpen: true,
  });
  context.handleDeudaRutaOfferEditSubmit("offer-1");
  const [offerId, patch] = calls[0];
  assert.equal(offerId, "offer-1");
  assert.equal(patch.counterpart, "Cofidis");
  assert.equal(patch.amount, 5200);
  assert.equal(patch.paymentType, "refinancing");
  assert.equal(patch.installment, 220);
  assert.equal(patch.termMonths, 36);
  // JSON.stringify en vez de deepEqual: el array se crea dentro del sandbox vm, en un realm
  // distinto del de este test — deepEqual falla comparando por referencia entre realms aunque la
  // estructura sea idéntica (mismo tropiezo ya documentado en las pruebas de Sobres/Plan).
  assert.equal(JSON.stringify(patch.documents), JSON.stringify(["offer", "payment-terms"]));
  assert.equal(patch.status, "accepted");
  assert.equal(context.deudaRutaOfferEditOpen, false, "el formulario se cierra tras un guardado válido");
  assert.equal(context.deudaRutaOfferStatusMessage, "Oferta actualizada.");
  assert.ok(calls.includes("renderDeudaRutaOffer"));
});

test("handleDeudaRutaOfferEditSubmit deja el formulario abierto y explica el motivo si la validación falla", () => {
  const fields = {
    deudaRutaOfferEditCounterpart: { value: "" },
    deudaRutaOfferEditExpiresAt: { value: "" },
    deudaRutaOfferEditAmount: { value: "0" },
    deudaRutaOfferEditPaymentType: { value: "single-payment" },
    deudaRutaOfferEditInstallment: { value: "0" },
    deudaRutaOfferEditTermMonths: { value: "0" },
  };
  const context = sandboxWith(["handleDeudaRutaOfferEditSubmit"], {
    qs: (id) => fields[id] || null,
    parseAmount: (v) => Number(v),
    updateE14bOffer: () => ({ valid: false, issues: ["missing-counterpart", "missing-validity", "missing-amount"] }),
    renderDeudaRutaOffer: () => {},
    deudaRutaOfferStatusMessage: "",
    deudaRutaOfferEditOpen: true,
  });
  context.handleDeudaRutaOfferEditSubmit("offer-1");
  assert.equal(context.deudaRutaOfferEditOpen, true, "un guardado inválido no cierra el formulario");
  assert.match(context.deudaRutaOfferStatusMessage, /No se guardaron los cambios/);
});

// --- deudaRutaOfferEditFormHtml: precarga los valores de la oferta -------------------------------

test("deudaRutaOfferEditFormHtml precarga contraparte, importe y los documentos ya marcados", () => {
  const context = sandboxWith(["deudaRutaOfferEditFormHtml"], { escapeHtml: (v) => String(v ?? "") });
  const html2 = context.deudaRutaOfferEditFormHtml({
    counterpart: "Cetelem", expiresAt: "2026-09", amount: 8500, paymentType: "refinancing",
    installment: 210, termMonths: 48, documents: ["offer", "payment-terms"], status: "accepted",
  });
  assert.match(html2, /value="Cetelem"/);
  assert.match(html2, /value="2026-09"/);
  assert.match(html2, /value="8500"/);
  assert.match(html2, /id="deudaRutaOfferEditDocOffer" checked/);
  assert.doesNotMatch(html2, /id="deudaRutaOfferEditDocAuthority" checked/);
  assert.match(html2, /id="deudaRutaOfferEditDocTerms" checked/);
  assert.match(html2, /id="deudaRutaOfferEditAccepted" checked/);
});

// --- Cabecera compartida de Deuda: sin el enlace legacy a #debt-roadmap para editar ----------------

test("renderDeudaRutaOffer ya no enlaza a la heredada #debt-roadmap para editar la oferta", () => {
  const fn = extractFunction("renderDeudaRutaOffer");
  assert.doesNotMatch(fn, /href="#debt-roadmap"/, "editar la oferta ya no depende de la pantalla heredada");
  assert.match(fn, /deudaRutaOfferEditFormHtml\(offer\)/);
});
