const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const read = (name) => fs.readFileSync(path.join(root, name), "utf8");
const app = read("app.js") + "\n" + read("views/cierre.js");
const html = read("index.html");

// E-11b (bloque de decisiones de diseño, 20 de agosto): "Aplicar crea un plan paralelo, no
// sobrescribe." La investigación previa a programar encontró que Aplicar nunca había tocado el
// plan financiero compartido (scenarioSettings/debtLiquidations) — lo único que sobrescribía era
// la etiqueta de la entrada anterior en `escenario-motor-saved`. E-11b construye, por primera vez,
// el mecanismo de plan paralelo: Aplicar crea una copia marcada «propuesto» que convive con
// cuanto ya hubiera, y Cierre es donde se confirma (pasa a «vigente») o se descarta («guardado»).
// El límite de «diez planes vivos como máximo» (decisión de arquitectura, 14 de agosto) se
// construye aquí también, con su modal de bloqueo y su archivado manual que no borra nada.

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

function sandboxWith(names, extra = {}) {
  const context = { ...extra };
  vm.createContext(context);
  names.forEach((name) => vm.runInContext(extractFunction(name), context));
  return context;
}

// --- Límite de diez planes vivos ----------------------------------------------------------------

test("E-11b · escenarioMotorLimitReached se dispara exactamente a partir de diez planes vivos", () => {
  const context = sandboxWith(["escenarioMotorLimitReached", "escenarioMotorLiveSavedCount"], {
    loadEscenarioMotorSaved: () => Array.from({ length: 9 }, (_, i) => ({ id: `p${i}` })),
  });
  assert.equal(context.escenarioMotorLimitReached(), false);
});

test("E-11b · a partir de diez planes vivos, el límite se alcanza", () => {
  const context = sandboxWith(["escenarioMotorLimitReached", "escenarioMotorLiveSavedCount"], {
    loadEscenarioMotorSaved: () => Array.from({ length: 10 }, (_, i) => ({ id: `p${i}` })),
  });
  assert.equal(context.escenarioMotorLimitReached(), true);
});

// --- Archivar / restaurar: nunca borra --------------------------------------------------------

function sandboxArchive(existing) {
  let saved = null;
  let rendered = 0;
  const context = sandboxWith(["handleEscenarioGuardadosArchive", "handleEscenarioGuardadosRestore"], {
    loadEscenarioMotorSaved: () => existing,
    saveEscenarioMotorSavedList: (list) => {
      saved = list;
    },
    renderEscenarioGuardados: () => {
      rendered += 1;
    },
  });
  return { context, getSaved: () => saved, getRenderCount: () => rendered };
}

test("E-11b · archivar marca la entrada sin borrar ningún dato, y repinta", () => {
  const { context, getSaved, getRenderCount } = sandboxArchive([{ id: "a", estado: "guardado", nombre: "Coche" }]);
  context.handleEscenarioGuardadosArchive("a");
  const saved = getSaved();
  assert.equal(saved.length, 1);
  assert.equal(saved[0].archived, true);
  assert.ok(saved[0].archivedAt);
  assert.equal(saved[0].nombre, "Coche", "el resto de la entrada no se toca");
  assert.equal(getRenderCount(), 1);
});

test("E-11b · restaurar quita el archivado y no deja rastro de archivedAt", () => {
  const { context, getSaved } = sandboxArchive([{ id: "a", estado: "guardado", archived: true, archivedAt: "2026-08-19T10:00:00Z" }]);
  context.handleEscenarioGuardadosRestore("a");
  const saved = getSaved();
  assert.equal(saved[0].archived, undefined);
  assert.equal(saved[0].archivedAt, undefined);
});

// --- Tarjeta: badges de vigente/propuesto/guardado/aviso/caducado ------------------------------

function sandboxCard() {
  const context = {
    escapeHtml: (v) => String(v ?? ""),
    money: (v) => `${Number(v).toFixed(2)}€`,
    escenarioMotorBaseInput: () => ({ months: 12 }),
    runEscenarioMotor: () => ({}),
    escenarioMotorSummaryFor: () => ({ libreDeDeuda: "2029-07", minimoLiquidez: 100, liquidezFinal: 200 }),
    escenarioMotorMonthLabel: (v) => v,
    debtOfferExpiryStatus: (expiresAt) => (expiresAt === "expired" ? { expired: true } : { expired: false, dueSoon: false }),
  };
  vm.createContext(context);
  vm.runInContext(extractFunction("escenarioMotorSavedCardHtml"), context);
  return context;
}

test("E-11b · un plan «propuesto» lleva su propio badge, distinto de vigente y de guardado", () => {
  const { escenarioMotorSavedCardHtml } = sandboxCard();
  const out = escenarioMotorSavedCardHtml({ id: "p1", estado: "propuesto", nombre: "Reunificar", decisiones: [] });
  assert.match(out, /e19-badge-accent">Propuesto</);
  assert.match(out, /is-propuesto/);
  assert.match(out, /se confirma o se descarta al cerrar el mes/);
});

test("E-11b · «vigente» y el alias legado «aplicado» pintan el mismo badge Vigente", () => {
  const { escenarioMotorSavedCardHtml } = sandboxCard();
  const vigente = escenarioMotorSavedCardHtml({ id: "v1", estado: "vigente", nombre: "Base", decisiones: [] });
  const legado = escenarioMotorSavedCardHtml({ id: "v2", estado: "aplicado", nombre: "Base vieja", decisiones: [] });
  for (const out of [vigente, legado]) {
    assert.match(out, /e19-badge-success">Vigente</);
    assert.match(out, /is-aplicado/);
  }
});

test("E-11b · un «guardado» normal no lleva ninguna nota de propuesto", () => {
  const { escenarioMotorSavedCardHtml } = sandboxCard();
  const out = escenarioMotorSavedCardHtml({ id: "g1", estado: "guardado", nombre: "Coche", decisiones: [] });
  assert.match(out, /e19-badge-neutral">Guardado</);
  assert.doesNotMatch(out, /se confirma o se descarta/);
});

test("E-11b · la caducidad de oferta (E-13) también aplica a un «propuesto», no solo a un «guardado»", () => {
  const { escenarioMotorSavedCardHtml } = sandboxCard();
  const out = escenarioMotorSavedCardHtml({ id: "p1", estado: "propuesto", nombre: "Reunificar", decisiones: [], ofertaExpiresAt: "expired" });
  assert.match(out, /e19-badge-danger">Caducado</);
});

test("E-11b · una tarjeta activa ofrece «Archivar»; una archivada ofrece «Restaurar»", () => {
  const { escenarioMotorSavedCardHtml } = sandboxCard();
  const activa = escenarioMotorSavedCardHtml({ id: "a1", estado: "guardado", nombre: "Coche", decisiones: [] });
  assert.match(activa, /data-escenario-guardado-archive="a1">Archivar</);
  assert.doesNotMatch(activa, /data-escenario-guardado-restore/);
  const archivada = escenarioMotorSavedCardHtml({ id: "a2", estado: "guardado", nombre: "Coche", decisiones: [], archived: true });
  assert.match(archivada, /data-escenario-guardado-restore="a2">Restaurar</);
  assert.doesNotMatch(archivada, /data-escenario-guardado-archive/);
});

// --- renderEscenarioGuardados: activos primero, archivados dentro de un <details> --------------

test("E-11b · renderEscenarioGuardados separa activos de archivados en un <details> con su contador", () => {
  const written = {};
  const context = sandboxWith(["renderEscenarioGuardados", "escenarioMotorSavedCardHtml"], {
    escapeHtml: (v) => String(v ?? ""),
    money: (v) => `${Number(v).toFixed(2)}€`,
    escenarioMotorBaseInput: () => ({ months: 12 }),
    runEscenarioMotor: () => ({}),
    escenarioMotorSummaryFor: () => ({ libreDeDeuda: "2029-07", minimoLiquidez: 0, liquidezFinal: 0 }),
    escenarioMotorMonthLabel: (v) => v,
    debtOfferExpiryStatus: () => ({ expired: false, dueSoon: false }),
    renderScenarioDependencyNotice: () => {},
    loadEscenarioMotorSaved: () => [
      { id: "a1", estado: "guardado", nombre: "Activo uno", decisiones: [] },
      { id: "b1", estado: "guardado", nombre: "Archivado uno", decisiones: [], archived: true },
      { id: "b2", estado: "propuesto", nombre: "Archivado dos", decisiones: [], archived: true },
    ],
    qs: (id) => ({
      hidden: false,
      set innerHTML(value) {
        written[id] = value;
      },
    }),
  });
  context.renderEscenarioGuardados();
  assert.ok(written.escenarioGuardadosList.includes("Activo uno"));
  assert.match(written.escenarioGuardadosList, /<details class="escenario-motor-saved-archived">/);
  assert.match(written.escenarioGuardadosList, /<summary>Archivados · 2<\/summary>/);
  assert.ok(written.escenarioGuardadosList.includes("Archivado uno"));
  assert.ok(written.escenarioGuardadosList.includes("Archivado dos"));
  // El activo aparece antes del bloque de archivados, no mezclado con ellos.
  assert.ok(written.escenarioGuardadosList.indexOf("Activo uno") < written.escenarioGuardadosList.indexOf("<details"));
});

test("E-11b · sin ningún archivado, no se pinta el <details>", () => {
  const written = {};
  const context = sandboxWith(["renderEscenarioGuardados", "escenarioMotorSavedCardHtml"], {
    escapeHtml: (v) => String(v ?? ""),
    money: (v) => `${Number(v).toFixed(2)}€`,
    escenarioMotorBaseInput: () => ({ months: 12 }),
    runEscenarioMotor: () => ({}),
    escenarioMotorSummaryFor: () => ({}),
    escenarioMotorMonthLabel: (v) => v,
    debtOfferExpiryStatus: () => ({ expired: false, dueSoon: false }),
    renderScenarioDependencyNotice: () => {},
    loadEscenarioMotorSaved: () => [{ id: "a1", estado: "guardado", nombre: "Activo uno", decisiones: [] }],
    qs: (id) => ({
      hidden: false,
      set innerHTML(value) {
        written[id] = value;
      },
    }),
  });
  context.renderEscenarioGuardados();
  assert.doesNotMatch(written.escenarioGuardadosList, /<details/);
});

// --- Insignia en la tira de estado ---------------------------------------------------------------

function sandboxTopbar(entries) {
  const written = {};
  const context = sandboxWith(["renderTopbarStatusStrip"], {
    escapeHtml: (v) => String(v ?? ""),
    // Se estuba la función pesada real (requiere todo el estado financiero) — aquí solo importa
    // que la insignia se añada o no junto a las cifras, no de dónde salen esas cifras.
    topbarStatusFigures: () => [{ label: "Liquidez hoy", value: "1.000€", sub: "" }],
    loadEscenarioMotorSaved: () => entries,
    qs: (id) => (id === "topbarStatusStrip" ? { set innerHTML(value) { written.strip = value; }, hidden: false } : null),
  });
  context.renderTopbarStatusStrip("plan");
  return written;
}

test("E-11b · con un plan propuesto vivo, la tira de estado muestra la insignia", () => {
  const written = sandboxTopbar([{ estado: "propuesto" }]);
  assert.match(written.strip, /topbar-status-badge">Plan propuesto sin confirmar/);
});

test("E-11b · sin ningún propuesto vivo, la tira no muestra ninguna insignia", () => {
  const written = sandboxTopbar([{ estado: "vigente" }, { estado: "propuesto", archived: true }]);
  assert.doesNotMatch(written.strip, /topbar-status-badge/);
});

// --- cierreStepsStatus: paso condicional «Revisar plan propuesto» -------------------------------

function sandboxSteps() {
  const context = sandboxWith(["cierreStepsStatus", "cierreAccountsSettled", "cierreSobresAllResolved"], {
    sobresEnabled: () => false,
  });
  return context;
}

test("E-11b · sin propuesto pendiente, el cierre conserva sus tres pasos de siempre", () => {
  const context = sandboxSteps();
  const settled = [{ status: "cuadra" }];
  const steps = context.cierreStepsStatus(settled, [], [], false);
  assert.deepEqual(Array.from(steps, (s) => s.label), ["Conciliar cuentas", "Resolver diferencias", "Firmar y archivar"]);
});

test("E-11b · con un propuesto pendiente, se inserta «Revisar plan propuesto» antes de firmar", () => {
  const context = sandboxSteps();
  const settled = [{ status: "cuadra" }];
  const steps = context.cierreStepsStatus(settled, [], [], true);
  assert.deepEqual(Array.from(steps, (s) => s.label), ["Conciliar cuentas", "Resolver diferencias", "Revisar plan propuesto", "Firmar y archivar"]);
  const propuestoStep = steps.find((s) => s.label === "Revisar plan propuesto");
  assert.equal(propuestoStep.done, false, "nunca se marca hecho solo con datos: hace falta confirmar o descartar");
  const firmStep = steps.at(-1);
  assert.equal(firmStep.unlocked, false, "firmar sigue bloqueado mientras el propuesto no se resuelva");
});

test("E-11b · con Sobres activo y un propuesto pendiente, los cinco pasos van en orden", () => {
  const context = sandboxWith(["cierreStepsStatus", "cierreAccountsSettled", "cierreSobresAllResolved"], {
    sobresEnabled: () => true,
  });
  const settled = [{ status: "cuadra" }];
  const steps = context.cierreStepsStatus(settled, [], [], true);
  assert.deepEqual(Array.from(steps, (s) => s.label), [
    "Conciliar cuentas",
    "Resolver diferencias",
    "Liquidar sobres",
    "Revisar plan propuesto",
    "Firmar y archivar",
  ]);
  assert.deepEqual(Array.from(steps, (s) => s.step), [1, 2, 3, 4, 5]);
});

// --- cierreStepPropuestoHtml y sus dos acciones, ninguna destructiva ----------------------------

test("E-11b · cierreStepPropuestoHtml ofrece Confirmar y Descartar por cada plan propuesto", () => {
  const context = sandboxWith(["cierreStepPropuestoHtml"], { escapeHtml: (v) => String(v ?? "") });
  const out = context.cierreStepPropuestoHtml([{ id: "p1", nombre: "Reunificar", motivo: "Oferta 4,1%" }]);
  assert.match(out, /data-cierre-propuesto-confirm="p1">Confirmar</);
  assert.match(out, /data-cierre-propuesto-discard="p1">Descartar</);
  assert.match(out, /Reunificar/);
  assert.match(out, /Ninguna de las dos acciones borra nada/);
});

// --- Confirmar / descartar desde Cierre ---------------------------------------------------------

function sandboxCierreAction(existing) {
  let saved = null;
  let rendered = 0;
  const context = sandboxWith(["handleCierrePropuestoConfirm", "handleCierrePropuestoDiscard"], {
    loadEscenarioMotorSaved: () => existing,
    saveEscenarioMotorSavedList: (list) => {
      saved = list;
    },
    renderCierre: () => {
      rendered += 1;
    },
    retractDebtLiquidationsFromEscenario: () => false,
    syncDebtLiquidationsFromEscenario: () => false,
    saveDebtLiquidations: () => {},
    retractProjectsFromEscenario: () => false,
    syncProjectsFromEscenario: () => false,
    saveProjects: () => {},
    retractPlanningRowsFromEscenario: () => false,
    syncPlanningRowsFromEscenario: () => false,
    saveCustomPlanningRows: () => {},
  });
  return { context, getSaved: () => saved, getRenderCount: () => rendered };
}

test("E-11b · confirmar un propuesto lo convierte en vigente y degrada el vigente anterior a guardado", () => {
  const existing = [
    { id: "old-vigente", estado: "vigente" },
    { id: "new-propuesto", estado: "propuesto" },
  ];
  const { context, getSaved, getRenderCount } = sandboxCierreAction(existing);
  context.handleCierrePropuestoConfirm("new-propuesto");
  const saved = getSaved();
  assert.equal(saved.find((e) => e.id === "new-propuesto").estado, "vigente");
  assert.equal(saved.find((e) => e.id === "old-vigente").estado, "guardado");
  assert.equal(getRenderCount(), 1);
});

test("E-11b · confirmar sin ningún vigente anterior no toca ninguna otra entrada", () => {
  const existing = [
    { id: "otro-propuesto", estado: "propuesto" },
    { id: "new-propuesto", estado: "propuesto" },
  ];
  const { context, getSaved } = sandboxCierreAction(existing);
  context.handleCierrePropuestoConfirm("new-propuesto");
  const saved = getSaved();
  assert.equal(saved.find((e) => e.id === "new-propuesto").estado, "vigente");
  assert.equal(saved.find((e) => e.id === "otro-propuesto").estado, "propuesto", "otro propuesto que no se confirmó se queda igual");
});

test("E-11b · descartar deja el propuesto como guardado, sin tocar el vigente actual", () => {
  const existing = [
    { id: "old-vigente", estado: "vigente" },
    { id: "new-propuesto", estado: "propuesto" },
  ];
  const { context, getSaved } = sandboxCierreAction(existing);
  context.handleCierrePropuestoDiscard("new-propuesto");
  const saved = getSaved();
  assert.equal(saved.find((e) => e.id === "new-propuesto").estado, "guardado");
  assert.equal(saved.find((e) => e.id === "old-vigente").estado, "vigente", "descartar no toca el vigente");
});

// --- renderCierre: fuente de propuestos, cableado del paso nuevo --------------------------------

test("E-11b · renderCierre calcula los propuestos vivos y los pasa a cierreStepsStatus", () => {
  const fn = extractFunction("renderCierre");
  assert.match(fn, /const propuestos = loadEscenarioMotorSaved\(\)\.filter\(\(entry\) => !entry\.archived && entry\.estado === "propuesto"\);/);
  assert.match(fn, /cierreStepsStatus\(accountRows, tasks, sobresRows, propuestos\.length > 0\)/);
});

test("E-11b · renderCierre pinta cierreStepPropuestoHtml cuando el paso activo es el de revisar propuesto", () => {
  const fn = extractFunction("renderCierre");
  assert.match(fn, /propuestoStepEntry && cierreActiveStep === propuestoStepEntry\.step/);
  assert.match(fn, /cierreStepPropuestoHtml\(propuestos\)/);
});

// --- Cableado de eventos --------------------------------------------------------------------------

test("E-11b · el clic en Confirmar/Descartar dentro de Cierre delega en los handlers", () => {
  assert.match(app, /const propuestoConfirm = event\.target\.closest\("\[data-cierre-propuesto-confirm\]"\);/);
  assert.match(app, /handleCierrePropuestoConfirm\(propuestoConfirm\.dataset\.cierrePropuestoConfirm\);/);
  assert.match(app, /const propuestoDiscard = event\.target\.closest\("\[data-cierre-propuesto-discard\]"\);/);
  assert.match(app, /handleCierrePropuestoDiscard\(propuestoDiscard\.dataset\.cierrePropuestoDiscard\);/);
});

test("E-11b · el clic en Archivar/Restaurar en Escenarios guardados delega en los handlers", () => {
  assert.match(app, /handleEscenarioGuardadosArchive\(archiveButton\.dataset\.escenarioGuardadoArchive\);/);
  assert.match(app, /handleEscenarioGuardadosRestore\(restoreButton\.dataset\.escenarioGuardadoRestore\);/);
});

test("E-11b · cerrar el modal de límite con «Ir a archivar» navega a Escenarios guardados", () => {
  assert.match(
    app,
    /qs\("escenarioMotorLimitDialog"\)\?\.addEventListener\("close", \(\) => \{\s*\n\s*if \(qs\("escenarioMotorLimitDialog"\)\?\.returnValue === "archive"\) escenarioMotorNavigate\("escenario-guardados"\);/
  );
});

// --- HTML: el diálogo del límite y la copia actualizada -----------------------------------------

test("E-11b · index.html tiene el diálogo de límite de diez planes, con sus dos botones", () => {
  assert.match(html, /<dialog class="action-review-dialog" id="escenarioMotorLimitDialog"/);
  assert.match(html, /Ya hay diez planes guardados/);
  assert.match(html, /value="archive" type="submit">Ir a archivar</);
});

test("E-11b · el botón de aplicar y su nota reflejan que ahora propone, no sobrescribe", () => {
  assert.match(html, /id="escenarioAplicarConfirm">Confirmar y proponer</);
  assert.match(html, /Queda guardado como plan propuesto, sin tocar el vigente/);
});

test("E-11b · Escenarios guardados ya no dice que solo uno puede estar aplicado a la vez", () => {
  const section = html.slice(html.indexOf('id="escenario-guardados"'), html.indexOf('id="escenario-comparar"'));
  assert.doesNotMatch(section, /Solo uno puede estar aplicado a la vez/);
  assert.match(section, /Aplicar crea un plan propuesto que convive con el vigente/);
});
