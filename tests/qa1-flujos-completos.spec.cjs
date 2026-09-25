const { test, expect } = require("@playwright/test");

// QA-1 (FASE 6): suite de aceptación E2E — navegador real, no el patrón `vm`/extracción de texto que
// usan los 1628 tests de `node --test` (esos verifican funciones aisladas; nunca arrancan la app de
// verdad ni ejercitan `init()`, el enrutado por hash o la carga diferida de PERF-1).
//
// En el CI desde el 24 de septiembre de 2026 (`npm run test:e2e` en .github/workflows/pages.yml, detrás
// de la instalación de Chromium). Hasta entonces se ejecutaba solo a mano y llevaba semanas en rojo sin
// que nadie lo viera: editar un importe de Presupuesto del mes congelaba la pantalla ~14 s
// (monthLabel sin memorizar, ver app.js) y el flujo agotaba su tiempo. Por eso el flujo mide ahora
// también cuánto tarda en responder la edición, no solo que acabe respondiendo.
//
// El sitio público arranca sin transacciones (dataset de demo vacío por privacidad, E9/A0-8), así que
// cada flujo siembra datos sintéticos con las mismas funciones que usa el propio flujo de importación
// real (`mergeTransactions` + `refreshMovementRollups`, ver applyStagedMovementImport en app.js) en
// vez de tocar el estado a mano de una forma que la app nunca produciría.

async function seedExpenseHistory(page, { category = "alimentacion", months = ["2026-04", "2026-05", "2026-06", "2026-07"] } = {}) {
  await page.evaluate(
    ({ category, months }) => {
      const imported = months.map((month, index) => ({
        date: `${month}-05`,
        movement: `Compra de prueba ${index}`,
        amount: -(180 + index * 5),
        month,
        category,
        balance: null,
      }));
      baseData.transactions = mergeTransactions(baseData.transactions || [], imported);
      refreshMovementRollups();
    },
    { category, months },
  );
}

test.describe("QA-1 · flujo completo de Presupuesto del mes", () => {
  test("sembrar histórico, sugerir, editar y exportar CSV/JSON con los datos reales resultantes", async ({ page }) => {
    const consoleErrors = [];
    page.on("pageerror", (error) => consoleErrors.push(String(error)));

    await page.goto("/index.html");
    await page.waitForLoadState("networkidle");
    await seedExpenseHistory(page);

    await page.evaluate(() => { location.hash = "#presupuesto-mes"; });
    const table = page.locator(".plan-mes-budget-table");
    await expect(table).toBeVisible();

    // Sin presupuestos todavía: la tabla dice explícitamente que no hay nada, no la deja en blanco.
    await expect(table.locator("tbody tr")).toHaveText(/Todavía no hay presupuestos/);

    await page.click("[data-presupuesto-mes-suggest]");
    const row = table.locator("tbody tr").first();
    await expect(row).not.toHaveText(/Todavía no hay presupuestos/);
    await expect(row.locator("td").first()).toContainText("alimentacion");
    await expect(row.locator("td").first().locator("small.note")).toHaveText("sugerido");

    const input = row.locator('[data-presupuesto-mes-category="alimentacion"]');
    const suggested = Number(await input.inputValue());
    expect(suggested).toBeGreaterThan(0);

    // Editar el importe sugerido: el estado se recalcula con el nuevo presupuesto, no con el viejo.
    await input.fill("150");
    const changeMs = await input.evaluate((element) => {
      const started = performance.now();
      element.dispatchEvent(new Event("change", { bubbles: true, cancelable: true }));
      return performance.now() - started;
    });
    // Con la corrección tarda ~90 ms en local; el techo deja margen de sobra a un runner lento y aun
    // así caza el bloqueo de ~14 s que esta prueba destapó.
    expect(changeMs, `editar un presupuesto tardó ${Math.round(changeMs)} ms`).toBeLessThan(2000);
    await expect(row.locator('[data-presupuesto-mes-category="alimentacion"]')).toHaveValue("150");
    await expect(row.locator("td").nth(5)).toContainText("150,00");

    const [csvDownload] = await Promise.all([
      page.waitForEvent("download"),
      page.click("[data-presupuesto-mes-export-csv]"),
    ]);
    expect(csvDownload.suggestedFilename()).toBe("presupuestos.csv");
    const csvPath = await csvDownload.path();
    const fs = require("node:fs");
    const csvText = fs.readFileSync(csvPath, "utf8");
    expect(csvText).toContain("alimentacion");
    expect(csvText).toContain("150");

    const [jsonDownload] = await Promise.all([
      page.waitForEvent("download"),
      page.click("[data-presupuesto-mes-export-json]"),
    ]);
    expect(jsonDownload.suggestedFilename()).toBe("presupuestos.json");
    const jsonPath = await jsonDownload.path();
    const rows = JSON.parse(fs.readFileSync(jsonPath, "utf8"));
    const exported = rows.find((r) => r.categoria === "alimentacion");
    expect(exported?.presupuesto).toBe(150);

    expect(consoleErrors, `errores de página: ${consoleErrors.join(" | ")}`).toEqual([]);
  });
});

test.describe("QA-1 · recorrido por las pantallas principales con datos reales", () => {
  const screens = [
    { hash: "#home", root: "#home" },
    { hash: "#presupuesto-mes", root: "#presupuestoMesRoot" },
    { hash: "#deuda-comparar", root: "#deuda-comparar" },
    { hash: "#analisis", root: "#analisis" },
    { hash: "#cierre", root: "#cierre" },
    { hash: "#conciliar", root: "#conciliar" },
    // Las seis pantallas de las capturas de E18 (e18-visual-regression.spec.cjs): esas capturas se
    // hicieron en macOS con Chrome real y no se pueden comparar en el CI (Linux), así que aquí se
    // comprueba su comportamiento — que abran y pinten sin errores—; el recorte lo vigila
    // tools/check-mobile-overflow.mjs.
    { hash: "#update-hub", root: "#update-hub" },
    { hash: "#data-entry", root: "#data-entry" },
    { hash: "#forecast", root: "#forecast" },
    { hash: "#new-life-simulation", root: "#new-life-simulation" },
    { hash: "#debt-control", root: "#debt-control" },
    { hash: "#reconciliation", root: "#reconciliation" },
  ];

  test("navegar por las pantallas principales y las de E18 sin errores, pantallas en blanco ni bloqueos largos", async ({ page }) => {
    const consoleErrors = [];
    page.on("pageerror", (error) => consoleErrors.push(String(error)));

    await page.goto("/index.html");
    await page.waitForLoadState("networkidle");
    await seedExpenseHistory(page, { category: "ocio", months: ["2026-05", "2026-06", "2026-07"] });

    // Doce pantallas y alguna simula el plan entero varias veces: margen para un runner lento.
    test.setTimeout(90_000);
    // Tareas largas del hilo principal (bloqueos de la página), con la pantalla en la que ocurrieron.
    // Se miden con PerformanceObserver y no con un cronómetro tras navegar porque cada pantalla carga su
    // código en diferido y su pintada puede llegar después de cualquier espera fija.
    await page.evaluate(() => {
      window.__qa1LongTasks = [];
      new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) window.__qa1LongTasks.push({ hash: location.hash, ms: Math.round(entry.duration) });
      }).observe({ type: "longtask" });
    });
    for (const screen of screens) {
      await page.evaluate((hash) => { location.hash = hash; }, screen.hash);
      await page.waitForTimeout(400);
      const body = await page.evaluate(() => document.body.innerHTML);
      expect(body, `pantalla ${screen.hash}`).not.toContain("No se pudo cargar la app");
      const rootHtml = await page.locator(screen.root).innerHTML();
      expect(rootHtml.trim().length, `${screen.hash}: ${screen.root} quedó vacío`).toBeGreaterThan(20);
    }

    // Control de deuda llegó a bloquear la página ~12 s al abrirse (shortDate sin memorizar, ver
    // app.js); tras la corrección, el bloqueo más largo del recorrido ronda 1,5 s en local.
    await page.waitForTimeout(1000);
    const longTasks = await page.evaluate(() => window.__qa1LongTasks);
    const worst = longTasks.reduce((max, task) => (task.ms > max.ms ? task : max), { hash: "", ms: 0 });
    expect(worst.ms, `${worst.hash} bloqueó la página ${worst.ms} ms`).toBeLessThan(8000);

    expect(consoleErrors, `errores de página: ${consoleErrors.join(" | ")}`).toEqual([]);
  });
});

// ARQ-6 (paso 3, 24 de septiembre de 2026): la copia de emergencia (A0-9) perdía quince almacenes que la
// app guarda cada uno en su propia clave del navegador — historia de cada cierre firmado y datos que el
// hogar escribe a mano — sin que nada lo notase. Este flujo hace lo que haría el hogar: descargar la
// copia, perder el navegador y restaurarla desde Ajustes, y exige que vuelva todo.
// tests/arq6-copia-completa.test.cjs obliga a que cualquier almacén nuevo entre en esa lista.
test.describe("QA-1 · copia de seguridad completa", () => {
  test("descargar la copia, borrar el navegador y restaurarla devuelve el estado y todos los almacenes propios", async ({ page }, testInfo) => {
    const consoleErrors = [];
    page.on("pageerror", (error) => consoleErrors.push(String(error)));
    const snapshot = () => page.evaluate(() => {
      const payload = JSON.parse(JSON.stringify(appStatePayload({ includeCanonical: false })));
      // Marcas de tiempo que cambian solas: la fecha de generación de los supuestos (misma huella) y
      // la de la última copia, que se anota después de construirla.
      delete payload.updatedAt;
      delete payload.scenarioSettings?.lastEmergencyBackupAt;
      if (payload.scenarioSettings?.forecastAssumptions) delete payload.scenarioSettings.forecastAssumptions.generatedAt;
      return window.FinanceStateContract.stableStringify(payload);
    });

    await page.goto("/index.html#ajustes");
    await page.waitForLoadState("networkidle");
    await seedExpenseHistory(page, { category: "ocio", months: ["2026-05", "2026-06", "2026-07"] });
    const stores = await page.evaluate(() => {
      budgets = [{ categoryId: "ocio", monthYear: "2026-09", amountCap: 321, source: "manual" }];
      saveLocalSnapshot();
      // Forma realista: los historiales de cierre esperan entradas con monthKey/closedAt.
      BACKUP_LOCAL_STORES.forEach((name) => storageSet(storageKey(name), JSON.stringify([{ monthKey: "2026-08", closedAt: "2026-09-01T10:00:00.000Z", marca: `qa1-${name}` }])));
      refreshFromPersistedState();
      return BACKUP_LOCAL_STORES;
    });
    expect(stores.length).toBeGreaterThan(10);
    await page.waitForTimeout(800);

    // El botón tiene que verse: vivía en #data-entry, que desde el 15 de agosto nunca se muestra.
    await expect(page.locator("#exportStateBackup")).toBeVisible();
    const [download] = await Promise.all([page.waitForEvent("download"), page.click("#exportStateBackup")]);
    const backupPath = testInfo.outputPath("copia.json");
    await download.saveAs(backupPath);
    const before = await snapshot();

    await page.evaluate(() => localStorage.clear());
    await page.reload();
    await page.waitForLoadState("networkidle");
    await page.evaluate(() => { location.hash = "#ajustes"; });
    expect(await snapshot(), "tras borrar el navegador el estado debería ser otro").not.toBe(before);

    await page.setInputFiles("#stateBackupFile", backupPath);
    await expect(page.locator("#confirmStateRestore")).toBeVisible();
    await page.click("#confirmStateRestore");
    await expect(page.locator("#stateBackupStatus")).toContainText("Restauración completada");
    await page.waitForTimeout(800);

    expect(await snapshot(), "el estado principal debería volver idéntico").toBe(before);
    const lost = await page.evaluate((names) => names.filter((name) => !storageGet(storageKey(name), "").includes(`qa1-${name}`)), stores);
    expect(lost, `almacenes que la copia no devolvió: ${lost.join(", ")}`).toEqual([]);
    expect(consoleErrors, `errores de página: ${consoleErrors.join(" | ")}`).toEqual([]);
  });
});

// ARQ-6 (24 de septiembre de 2026): el editor «Modificar una serie completa» vivía en #data-entry, que
// nunca se muestra desde el 15 de agosto. Recuperado en Planificación de partidas a petición del hogar.
test.describe("QA-1 · editor de series en Planificación de partidas", () => {
  test("cambia el previsto de una serie en un rango de meses desde una pantalla visible", async ({ page }) => {
    const consoleErrors = [];
    page.on("pageerror", (error) => consoleErrors.push(String(error)));
    await page.goto("/index.html#planificacion-partidas");
    await page.waitForLoadState("networkidle");
    await expect(page.locator("#applySeriesChange")).toBeVisible();

    await page.selectOption("#seriesKind", "expense");
    const options = await page.locator("#seriesRow option").evaluateAll((items) => items.map((item) => item.value));
    expect(options.length, "el editor debería ofrecer series de gasto").toBeGreaterThan(0);
    await page.selectOption("#seriesRow", options[0]);
    const months = await page.locator("#seriesStartMonth option").evaluateAll((items) => items.map((item) => item.value));
    await page.selectOption("#seriesStartMonth", months[0]);
    await page.selectOption("#seriesEndMonth", months[2]);
    await page.fill("#seriesPlannedAmount", "123.45");
    await page.selectOption("#seriesAction", "update");
    await page.click("#applySeriesChange");

    await expect(page.locator("#seriesEditorLog")).toContainText("Serie actualizada");
    await expect(page.locator("#seriesEditorLog")).toContainText("3 mes(es) modificados");
    const planned = await page.evaluate(() => Object.values(seriesOverrides).filter((value) => value.planned === 123.45).length);
    expect(planned).toBe(3);
    expect(consoleErrors, `errores de página: ${consoleErrors.join(" | ")}`).toEqual([]);
  });
});

// ARQ-6 (sesión 244): «Gobierno del dato» (asignación de titular + exportación con procedencia para el
// asesor) y «E9 · Servicios opcionales» se montaban en #data-entry, que nunca se muestra desde el 15 de
// agosto — invisibles desde entonces, y sin que arq6-controles-inalcanzables los detectara, porque
// p2-ui.js los inserta en tiempo de ejecución (no viven en el HTML estático que analiza ese guardián).
// Movidos a Ajustes › Datos y exportación (#ajustes-datos). Este flujo es justo el punto ciego: solo un
// navegador real, no un análisis de HTML estático, puede confirmar que de verdad se ven.
test.describe("QA-1 · paneles de p2-ui.js visibles en Ajustes", () => {
  test("«Familia y paquete para asesor» y «E9 · Servicios opcionales» se muestran en Ajustes, no en #data-entry", async ({ page }) => {
    const consoleErrors = [];
    page.on("pageerror", (error) => consoleErrors.push(String(error)));

    await page.goto("/index.html#data-entry");
    await page.waitForLoadState("networkidle");
    await expect(page.locator("#p2-family-export")).toBeHidden();
    await expect(page.locator("#e9-activation-status")).toBeHidden();

    await page.goto("/index.html#ajustes");
    await page.waitForLoadState("networkidle");
    await expect(page.locator("#p2-family-export")).toBeVisible();
    await expect(page.locator("#e9-activation-status")).toBeVisible();
    await expect(page.locator("#p2-family-export")).toContainText("Familia y paquete para asesor");
    await expect(page.locator("#e9-activation-status")).toContainText("Anthropic");
    expect(consoleErrors, `errores de página: ${consoleErrors.join(" | ")}`).toEqual([]);
  });
});

// ARQ-6 (sesión 244, decisión del hogar): «Nuevo dato manual» (uno a uno, incluye proyecto/deuda) se
// movió de #data-entry a Registrar › Lote y Excel, con los mismos IDs — era la única alta suelta fuera
// de lote. Su única llamada a populateDataEntryControls() estaba igual de inalcanzable que el resto
// (`case "data-entry"` nunca llega): los selects de mes y bloque llevaban vacíos desde el 15 de agosto.
test.describe("QA-1 · Nuevo dato manual en Registrar", () => {
  test("el mes y el bloque llegan poblados y un alta manual queda en el justificante visible", async ({ page }) => {
    const consoleErrors = [];
    page.on("pageerror", (error) => consoleErrors.push(String(error)));
    await page.goto("/index.html#registrar");
    await page.waitForLoadState("networkidle");
    await page.click('[data-registrar-tab="batch"]');
    await expect(page.locator("#addManualData")).toBeVisible();

    const monthOptions = await page.locator("#manualDataMonth option").count();
    expect(monthOptions, "el selector de mes debería llegar poblado, no vacío").toBeGreaterThan(0);

    await page.selectOption("#manualDataKind", "expense");
    await page.fill("#manualDataLabel", "Gasto de prueba QA-1");
    await page.fill("#manualDataActual", "42");
    await page.click("#addManualData");
    await expect(page.locator("#dataImportLog")).toContainText("importado");
    expect(consoleErrors, `errores de página: ${consoleErrors.join(" | ")}`).toEqual([]);
  });
});

// ARQ-6 (24 de septiembre de 2026, decisión del hogar): los almacenes propios también se sincronizan
// con la nube. Cada pantalla escribe el suyo por su cuenta, así que storageSet() tiene que disparar la
// sincronización — y aplicar lo que llega de la nube no puede volver a enviarlo.
test.describe("QA-1 · almacenes propios en la sincronización con la nube", () => {
  test("escribir un almacén propio programa una sincronización y viaja en el estado que se envía", async ({ page }) => {
    await page.goto("/index.html#home");
    await page.waitForLoadState("networkidle");
    await page.evaluate(() => {
      window.__qa1RemoteSaves = 0;
      window.queueRemoteSave = () => { window.__qa1RemoteSaves += 1; };
    });
    await page.evaluate(() => storageSet(storageKey("pv5-diary"), JSON.stringify([{ monthKey: "2026-08", marca: "qa1-nube" }])));
    await page.waitForTimeout(1500);
    expect(await page.evaluate(() => window.__qa1RemoteSaves)).toBe(1);
    expect(await page.evaluate(() => appStatePayload().localStores["pv5-diary"])).toContain("qa1-nube");

    // Lo que llega de la nube se aplica sin reenviarse.
    await page.evaluate(() => restoreBackupLocalStores({ "pv5-diary": JSON.stringify([{ monthKey: "2026-08", marca: "desde-la-nube" }]) }));
    await page.waitForTimeout(1500);
    expect(await page.evaluate(() => window.__qa1RemoteSaves)).toBe(1);
    expect(await page.evaluate(() => storageGet(storageKey("pv5-diary"), ""))).toContain("desde-la-nube");
    expect(await page.evaluate(() => storageGet(`${storageKey("pv5-diary")}:antes-de-sincronizar`, ""))).toContain("qa1-nube");
  });
});

// ARQ-6 (25 de septiembre de 2026, decisión del hogar): la bandeja «Revisar antes de incorporar» y
// «Deshacer último lote» vivían en #data-entry, que desde el 15 de agosto redirige a Registrar y nunca
// se muestra. Registrar › Lote y Excel prometía «una sola entrada revertible por lote» y el importador
// de extractos «un lote que se puede deshacer después», pero ningún botón visible lo hacía; y el
// justificante de un lote confirmado desde Registrar se escribía en el registro de la sección oculta,
// así que la vista previa se quedaba en pantalla con su botón «Confirmar» como si nada hubiese pasado.
test.describe("QA-1 · deshacer un lote importado desde Registrar", () => {
  test("importar un lote en Registrar, ver el justificante y la bandeja, y deshacerlo desde la misma pantalla", async ({ page }) => {
    const consoleErrors = [];
    page.on("pageerror", (error) => consoleErrors.push(String(error)));
    // #data-entry es la ruta de la tarjeta «Cargar CSV, Excel o un lote» de Hoy: aterriza en Registrar.
    await page.goto("/index.html#data-entry");
    await page.waitForLoadState("networkidle");
    await expect(page.locator('[data-registrar-panel="batch"]')).toBeVisible();
    await expect(page.locator("#dataInboxTitle"), "la bandeja tiene que verse junto a la importación").toBeVisible();
    await expect(page.locator("#undoLastImport")).toBeVisible();

    const target = await page.evaluate(() => ({
      month: selectableMonths()[0].key,
      section: baseData.monthlyPlanning.sections.find((section) => section.kind === "expense")?.name,
    }));
    const planningBefore = await page.evaluate(() => JSON.stringify(customPlanningRows));

    // Un lote del que no entra ninguna línea no puede anunciarse como incorporado (antes decía
    // «1 registro(s) incorporados» contando las filas de la vista previa).
    await page.fill("#registrarBatchInput", `tipo;mes;bloque;concepto;previsto;real\ngasto;1999-01;${target.section};QA1 fuera de rango;77;0`);
    await page.click("#registrarBatchImportBtn");
    await page.click("#confirmRegistrarBatchImport");
    await expect(page.locator("#registrarBatchLog")).toContainText("0 registro(s) importado(s)");
    await expect(page.locator("#registrarBatchLog")).toContainText("Mes no reconocido: 1999-01");
    await expect(page.locator("#dataInboxSummary")).toContainText("Descartada");
    expect(await page.evaluate(() => importBatches.length)).toBe(0);
    await page.fill("#registrarBatchInput", `tipo;mes;bloque;concepto;previsto;real\ngasto;${target.month};${target.section};QA1 lote deshacer;77;0`);
    await page.click("#registrarBatchImportBtn");
    await expect(page.locator("#registrarBatchLog")).toContainText("Vista previa");
    await page.click("#confirmRegistrarBatchImport");

    // El justificante sustituye a la vista previa en la misma pantalla.
    await expect(page.locator("#registrarBatchLog")).toContainText("Actualización confirmada");
    await expect(page.locator("#confirmRegistrarBatchImport")).toHaveCount(0);
    await expect(page.locator("#dataInboxSummary")).toContainText("Aplicada");
    expect(await page.evaluate(() => customPlanningRows.some((row) => row.label === "QA1 lote deshacer"))).toBe(true);

    await page.click("#undoLastImport");
    await expect(page.locator("#operationConfirmDialog")).toBeVisible();
    await page.click("#operationConfirmSubmit");
    await expect(page.locator("#dataImportLog")).toContainText("Importación deshecha");
    await expect(page.locator("#dataInboxSummary")).toContainText("Deshecha");
    expect(await page.evaluate(() => JSON.stringify(customPlanningRows)), "deshacer tiene que devolver las partidas de antes").toBe(planningBefore);

    // La misma bandeja y el mismo deshacer acompañan a Importar extracto, que también crea lotes.
    await page.click('[data-registrar-tab="import"]');
    await expect(page.locator("#undoLastImport")).toBeVisible();
    await page.click('[data-registrar-tab="balances"]');
    await expect(page.locator("#undoLastImport")).toBeHidden();
    expect(consoleErrors, `errores de página: ${consoleErrors.join(" | ")}`).toEqual([]);
  });
});
