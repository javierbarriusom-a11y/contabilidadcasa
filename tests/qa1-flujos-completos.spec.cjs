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

// WP-11 (NXP-05): el campo de importe de Registrar en un navegador real, a tamaño de iPhone y de escritorio.
// Escribir o pegar como en España («1.234», «1.234,56 €»), vacío ≠ 0, un texto que no es importe no se
// guarda y avisa con texto, y el signo «±» (el teclado decimal del iPhone no tiene la tecla del menos).
test.describe("QA-1 · campo de importe de Registrar (WP-11)", () => {
  for (const viewport of [{ width: 390, height: 844 }, { width: 1280, height: 720 }]) {
    test(`saldos y reales a ${viewport.width} px: «1.234», pegar «1.234,56 €», vacío ≠ 0, error con texto y signo`, async ({ page }) => {
      const consoleErrors = [];
      page.on("pageerror", (error) => consoleErrors.push(String(error)));
      await page.setViewportSize(viewport);
      await page.goto("/index.html#registrar");
      await expect(page.locator("#registrarCaixaBalance")).not.toHaveValue("");
      await expect(page.locator("#registrarCaixaBalance")).toHaveAttribute("inputmode", "decimal");

      await page.selectOption("#registrarBalanceMode", "manual");
      await page.fill("#registrarCaixaBalance", "1.234");
      await page.press("#registrarCaixaBalance", "Tab");
      await expect.poll(() => page.evaluate(() => state.caixaBalance)).toBe(1234);
      await expect(page.locator("#registrarCaixaBalance")).toHaveValue("1.234,00");

      await page.$eval('[data-amount-sign="registrarCaixaBalance"]', (button) => button.click());
      await expect.poll(() => page.evaluate(() => state.caixaBalance)).toBe(-1234);

      await page.fill("#registrarCaixaBalance", "doce");
      await page.press("#registrarCaixaBalance", "Tab");
      await expect(page.locator("#registrarCaixaBalance")).toHaveAttribute("aria-invalid", "true");
      await expect(page.locator("#registrarCaixaBalance-error")).toContainText("No es un importe");
      expect(await page.evaluate(() => state.caixaBalance), "un texto que no es importe no cambia el saldo").toBe(-1234);

      await page.click('[data-registrar-tab="actuals"]');
      const input = page.locator("[data-registrar-actuals-actual]").first();
      const key = await input.getAttribute("data-registrar-actuals-actual");
      const kind = await input.getAttribute("data-registrar-actuals-kind");
      const actual = () => page.evaluate(([k, kd]) => (Object.prototype.hasOwnProperty.call(actualsForKind(kd), k) ? actualsForKind(kd)[k] : "sin real"), [key, kind]);
      const field = page.locator(`[data-registrar-actuals-actual="${key}"]`);
      await field.fill("1.234,56 €");
      await field.press("Tab");
      await expect.poll(actual).toBe(1234.56);
      await expect(field).toHaveValue("1.234,56");
      await field.fill("0");
      await field.press("Tab");
      await expect.poll(actual, { message: "«0» es un real de cero" }).toBe(0);
      await field.fill("");
      await field.press("Tab");
      await expect.poll(actual, { message: "vacío vuelve a «sin real» (usa el previsto), no es un cero" }).toBe("sin real");
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), "sin desbordar en horizontal").toBe(true);
      expect(consoleErrors, `errores de página: ${consoleErrors.join(" | ")}`).toEqual([]);
    });
  }
});

// WP-25 (CAP-02): un enlace de registro prellenado en un navegador real. Abre «Registrar gasto» relleno al
// cargar la app y al cambiar el «#» con la app abierta, se borra de la barra de direcciones, nunca guarda sin el
// toque en «Registrar», dice lo que no ha usado y un importe ilegible no cierra la ventana como si registrara.
test.describe("QA-1 · enlace de registro prellenado (WP-25)", () => {
  for (const viewport of [{ width: 390, height: 844 }, { width: 1280, height: 720 }]) {
    test(`enlace a ${viewport.width} px: rellena, no guarda solo, avisa de lo no usado y registra con un toque`, async ({ page }) => {
      const consoleErrors = [];
      page.on("pageerror", (error) => consoleErrors.push(String(error)));
      await page.setViewportSize(viewport);
      await page.goto("/index.html#registrar?importe=1.234,56&concepto=Prueba%20enlace&fecha=hoy&cuenta=Caixa&origen=applepay");
      const dialog = page.locator("#homeQuickExpenseDialog");
      await expect(dialog).toBeVisible();
      await expect(page.locator("#homeQuickExpenseLabel")).toHaveValue("Prueba enlace");
      await expect(page.locator("#homeQuickExpenseAmount")).toHaveValue("1.234,56");
      await expect(page.locator("#homeQuickExpenseLinkNote")).toContainText("Apple Pay · cuenta Caixa");
      await expect(page.locator("#homeQuickExpenseSubmit")).toBeFocused();
      expect(await page.evaluate(() => location.hash), "el enlace sale de la barra de direcciones").toBe("#registrar");
      const rows = () => page.evaluate(() => customPlanningRows.length);
      const before = await rows();

      await page.click("#homeQuickExpenseDialog button[value=cancel]");
      await expect(dialog).toBeHidden();
      expect(await rows(), "cancelar no guarda nada").toBe(before);

      await page.evaluate(() => { location.hash = "#registrar?importe=12,3,4&concepto=%3Cb%3Ex%3C/b%3E"; });
      await expect(dialog).toBeVisible();
      await expect(page.locator("#homeQuickExpenseLinkNote")).toContainText("importe no reconocido: «12,3,4»");
      await expect(page.locator("#homeQuickExpenseLinkNote")).toContainText("concepto con caracteres no permitidos");
      await expect(page.locator("#homeQuickExpenseLabel")).toHaveValue("");
      await page.fill("#homeQuickExpenseLabel", "Prueba enlace");
      await page.fill("#homeQuickExpenseAmount", "abc");
      await page.click("#homeQuickExpenseSubmit");
      await expect(dialog, "un importe ilegible no cierra la ventana").toBeVisible();
      expect(await rows()).toBe(before);
      await page.fill("#homeQuickExpenseAmount", "23,40");
      await page.click("#homeQuickExpenseSubmit");
      await expect(dialog).toBeHidden();
      expect(await rows(), "un toque en «Registrar» crea la partida").toBe(before + 1);
      expect(await page.evaluate(() => customPlanningRows.at(-1).plannedValue)).toBe(23.4);
      expect(consoleErrors, `errores de página: ${consoleErrors.join(" | ")}`).toEqual([]);
    });
  }
});

// WP-24 (HOG-02): asignación personal en un navegador real. Dar de alta a dos personas en Plan › Partidas crea su
// partida en Gastos variables desde el mes elegido, el gasto total previsto NO cambia (sale del gasto variable),
// sobrevive a recargar y un importe que no lo es se dice y no se guarda.
test.describe("QA-1 · asignación personal (WP-24)", () => {
  for (const viewport of [{ width: 390, height: 844 }, { width: 1280, height: 720 }]) {
    test(`asignación a ${viewport.width} px: alta, gasto total igual, error con texto y recarga`, async ({ page }) => {
      const consoleErrors = [];
      page.on("pageerror", (error) => consoleErrors.push(String(error)));
      await page.setViewportSize(viewport);
      await page.goto("/index.html#planificacion-partidas");
      await expect(page.locator('#asignacionPersonal form[data-asignacion="nueva"]')).toHaveCount(1);
      const totals = () => page.evaluate(() => [0, 1, 2].map((index) => {
        const month = planningMonthForDate(addMonths(modelStartDate(), index), index);
        return Math.round(planningSectionsForMonth("expense", month).flatMap((section) => section.rows).reduce((sum, row) => sum + plannedValueForRow(row, month), 0) * 100) / 100;
      }));
      const before = await totals();
      await page.click("#asignacionResumen");

      await page.fill("#asignacion-0-nombre", "Prueba");
      await page.fill("#asignacion-0-importe", "abc");
      await page.$eval('form[data-asignacion="nueva"]', (form) => form.requestSubmit());
      await expect(page.locator("#asignacion-0-error")).toContainText("Escribe el importe al mes");
      expect(await page.evaluate(() => loadPersonalAllowances().people.length), "un importe que no lo es no se guarda").toBe(0);

      await page.fill("#asignacion-0-importe", "300");
      await page.$eval('form[data-asignacion="nueva"]', (form) => form.requestSubmit());
      await expect(page.locator("#asignacionEstado")).toContainText("Guardado: Asignación personal · Prueba");
      await page.fill("#asignacion-1-nombre", "Otra");
      await page.fill("#asignacion-1-importe", "250,50");
      await page.$eval('form[data-asignacion="nueva"]', (form) => form.requestSubmit());
      await expect(page.locator("#asignacionResumen")).toHaveText("Asignación personal: Prueba y Otra");

      const rows = await page.evaluate(() => {
        const month = planningMonthForDate(addMonths(modelStartDate(), 1), 1);
        return planningSectionsForMonth("expense", month).flatMap((section) => section.rows).filter((row) => row.personalAllowance).map((row) => `${displayLabelForRow(row)}=${plannedValueForRow(row, month)}`);
      });
      expect(rows).toEqual(["Asignación personal · Prueba=300", "Asignación personal · Otra=250.5"]);
      expect(await totals(), "sale del gasto variable: el gasto total previsto no cambia").toEqual(before);

      await page.reload();
      await expect.poll(() => page.evaluate(() => loadPersonalAllowances().people.map((person) => person.name))).toEqual(["Prueba", "Otra"]);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), "sin desbordar en horizontal").toBe(true);
      expect(consoleErrors, `errores de página: ${consoleErrors.join(" | ")}`).toEqual([]);
    });
  }
});

// WP-26 (ND-01): «Pulso de saldos» en un navegador real. Con las dos cuentas respondidas («Coincide» o «Corregir»),
// los saldos quedan con fecha de hoy y se puede deshacer; con una sola, dice cuál falta y no da los saldos por mirados.
test.describe("QA-1 · pulso de saldos (WP-26)", () => {
  for (const viewport of [{ width: 390, height: 844 }, { width: 1280, height: 720 }]) {
    test(`pulso a ${viewport.width} px: «Coincide», «Corregir», fecha de hoy y deshacer`, async ({ page }) => {
      const consoleErrors = [];
      page.on("pageerror", (error) => consoleErrors.push(String(error)));
      await page.setViewportSize(viewport);
      await page.goto("/index.html#registrar");
      const pulse = page.locator("#pulsoSaldos");
      await expect(pulse).toContainText("Pulso de saldos");
      if (await page.locator("[data-pulso-manual]").count()) await page.click("[data-pulso-manual]");
      await page.evaluate(() => {
        state.balanceDate = "2026-09-28";
        ["balanceDate", "registrarBalanceDate"].forEach((id) => { qs(id).value = "2026-09-28"; });
        saveBalanceSettings();
        render();
      });
      const today = await page.evaluate(() => isoLocalDate(new Date()));
      const before = await page.evaluate(() => accountBalancesFromState());

      await page.click('[data-pulso-coincide="mediolanum"]');
      await expect(pulse).toContainText("Falta confirmar CaixaBank");
      await expect(page.locator("#pulsoSaldosEstado")).toHaveText("");
      await page.click('[data-pulso-coincide="caixa"]');
      await expect(page.locator("#pulsoSaldosEstado")).toContainText("Saldos al día · hoy");
      expect(await page.evaluate(() => state.balanceDate)).toBe(today);
      expect(await page.evaluate(() => accountBalancesFromState())).toEqual(before);

      await page.$eval("#undoToast button", (button) => button.click());
      await expect.poll(() => page.evaluate(() => state.balanceDate), { message: "deshacer devuelve la fecha anterior" }).toBe("2026-09-28");

      await page.click('[data-pulso-corregir="caixa"]');
      await expect(page.locator("#registrarCaixaBalance")).toBeFocused();
      await page.fill("#registrarCaixaBalance", "4.321,50");
      await page.press("#registrarCaixaBalance", "Tab");
      await expect(pulse).toContainText("Corregido ✓");
      await page.click('[data-pulso-coincide="mediolanum"]');
      await expect(page.locator("#pulsoSaldosEstado")).toContainText("Saldos al día");
      expect(await page.evaluate(() => accountBalancesFromState().caixa)).toBe(4321.5);
      expect(await page.evaluate(() => FinanceBalancePulseUi.summary().count), "el tiempo queda medido para el panel de uso").toBe(2);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), "sin desbordar en horizontal").toBe(true);
      expect(consoleErrors, `errores de página: ${consoleErrors.join(" | ")}`).toEqual([]);
    });
  }
});

// WP-26 (ND-02): importar un extracto con saldo en un navegador real. El paso 4 ofrece (marcado) usar su saldo final
// como saldo de la cuenta elegida y dice si faltan movimientos; al incorporar, la cuenta toma ese saldo con su fecha, el
// cuadre de Cierre lo ve como de esa cuenta y «Deshacer último lote» lo devuelve todo.
test.describe("QA-1 · el extracto actualiza el saldo (WP-26)", () => {
  for (const viewport of [{ width: 390, height: 844 }, { width: 1280, height: 720 }]) {
    test(`extracto a ${viewport.width} px: oferta marcada, saldo con su fecha, cuadre y deshacer`, async ({ page }) => {
      const consoleErrors = [];
      page.on("pageerror", (error) => consoleErrors.push(String(error)));
      await page.setViewportSize(viewport);
      await page.goto("/index.html#registrar");
      await expect(page.locator("#pulsoSaldos")).toContainText("Pulso de saldos");
      if (await page.locator("[data-pulso-manual]").count()) await page.click("[data-pulso-manual]");
      await page.evaluate(() => {
        state.balanceDate = "2026-09-28";
        ["balanceDate", "registrarBalanceDate"].forEach((id) => { qs(id).value = "2026-09-28"; });
        saveBalanceSettings();
        render();
      });
      const before = await page.evaluate(() => ({ balances: accountBalancesFromState(), date: state.balanceDate }));
      await page.click('[data-registrar-tab="import"]');
      const csv = "Fecha;Concepto;Importe;Saldo\n02/10/2026;COMPRA B;-20,00;970,00\n02/10/2026;COMPRA A;-10,00;990,00\n01/10/2026;RECIBO LUZ;-5,00;1000,00\n";
      await page.setInputFiles("#registrarImportFileInput", { name: "extracto.csv", mimeType: "text/csv", buffer: Buffer.from(csv) });
      await page.selectOption("#registrarImportAccount", "CaixaBank");
      await page.$eval("#registrarImportNext", (button) => button.click());
      for (let index = 0; index < 5; index += 1) {
        const pending = await page.evaluate(() => { const button = document.querySelector('[data-datos-importar-classify="ignorar"]:not(.is-active)'); button?.click(); return Boolean(button); });
        if (!pending) break;
      }
      await page.$eval("#registrarImportNext", (button) => button.click());
      await page.$eval("#registrarImportNext", (button) => button.click());
      const offer = page.locator(".datos-importar-saldo");
      await expect(offer).toContainText("Usar el saldo final del extracto, 970,00 € el 02/10, como saldo declarado de CaixaBank.");
      await expect(offer).toContainText("Sin huecos en el extracto");
      await expect(page.locator("#datosImportarSaldoOferta")).toBeChecked();

      await page.$eval("#registrarImportConfirm", (button) => button.click());
      await page.$eval("#operationConfirmSubmit", (button) => button.click());
      await expect(page.locator("#registrarImportPanel")).toContainText("Saldo de CaixaBank: 970,00 € a 02/10/2026.");
      expect(await page.evaluate(() => ({ caixa: accountBalancesFromState().caixa, date: state.balanceDate, mode: state.balanceMode }))).toEqual({ caixa: 970, date: "2026-10-02", mode: "manual" });
      expect(await page.evaluate(() => accountBalancesFromState().mediolanum), "la otra cuenta no cambia").toBe(before.balances.mediolanum);

      await page.evaluate(() => { undoLastImportBatch(); }); // pide confirmación: no se espera aquí
      await page.waitForSelector("#operationConfirmDialog[open]");
      await page.$eval("#operationConfirmSubmit", (button) => button.click());
      await expect.poll(() => page.evaluate(() => ({ balances: accountBalancesFromState(), date: state.balanceDate })), { message: "«Deshacer último lote» devuelve el saldo y su fecha" }).toEqual(before);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), "sin desbordar en horizontal").toBe(true);
      expect(consoleErrors, `errores de página: ${consoleErrors.join(" | ")}`).toEqual([]);
    });
  }
});

// WP-12 (NPV-02): backtest de liquidez en un navegador real, con el reloj en día de foto. Se congela al abrir (tras la
// nube), la foto es de solo añadir, y Plan › Previsión cuenta lo que espera su cierre. La demo parte en «Auto por
// fecha»: ahí la foto se guarda pero NO cuenta (los saldos de partida no son del banco, GOV-05); con saldos manuales sí.
test.describe("QA-1 · backtest de liquidez (WP-12)", () => {
  const photo = (page) => page.evaluate(() => JSON.parse(localStorage.getItem(storageKey("liquidity-backtest")) || "null"));

  test("el día 15 se congela al abrir y es lo que prevé el motor a fin de mes; al volver a abrir no se reescribe", async ({ page }) => {
    const pageErrors = [];
    page.on("pageerror", (error) => pageErrors.push(String(error)));
    await page.clock.install({ time: new Date(2026, 9, 15, 9, 0, 0) });
    await page.goto("/index.html#prevision");
    await expect.poll(async () => Object.keys((await photo(page))?.freezes || {}), { message: "la foto del día 15 se guarda sola al abrir" }).toEqual(["2026-10:d15"]);
    const frozen = (await photo(page)).freezes["2026-10:d15"];
    const live = await page.evaluate(() => canonicalDailyEngineRuns.active.rows.find((row) => row.date === "2026-10-31").total);
    expect(frozen.date).toBe("2026-10-15");
    expect(frozen.closing, "lo congelado es lo que el motor diario prevé para el 31/10").toBe(live);
    expect(frozen.balanceMode, "la demo parte en saldos «Auto por fecha»").toBe("auto");

    await page.click("#previsionBacktestCard > summary");
    await expect(page.locator("#previsionBacktestResumen")).toContainText("datos insuficientes (0 de 3 cierres)");
    await expect(page.locator("#previsionBacktest")).toContainText("Esperan su cierre: foto del 15/10/2026");
    await expect(page.locator("#previsionBacktest")).not.toContainText("Error medio");

    await page.clock.setSystemTime(new Date(2026, 9, 16, 9, 0, 0));
    await page.reload();
    await expect(page.locator("#previsionBacktestResumen")).toContainText("Acierto de la caja a fin de mes");
    const again = (await photo(page)).freezes["2026-10:d15"];
    expect(again.frozenAt, "el día 16 la ventana sigue abierta pero ya tiene su foto: no se reescribe").toBe(frozen.frozenAt);
    expect(again.totals).toEqual(frozen.totals);
    expect(pageErrors, `errores de página: ${pageErrors.join(" | ")}`).toEqual([]);
  });

  test("fuera de los días 1-3 y 15-17 no se congela nada", async ({ page }) => {
    await page.clock.install({ time: new Date(2026, 9, 20, 9, 0, 0) });
    await page.goto("/index.html#prevision");
    await expect(page.locator("#previsionBacktestResumen")).toContainText("Acierto de la caja a fin de mes");
    expect(await photo(page)).toBeNull();
  });

  test("con saldos manuales la foto sí cuenta: al firmar el cierre se compara en la fecha de sus saldos, y con 1 cierre sigue sin haber error", async ({ page }) => {
    const pageErrors = [];
    page.on("pageerror", (error) => pageErrors.push(String(error)));
    await page.clock.install({ time: new Date(2026, 9, 15, 9, 0, 0) });
    await page.goto("/index.html#prevision");
    await expect.poll(async () => Object.keys((await photo(page))?.freezes || {})).toEqual(["2026-10:d15"]);
    // Saldos del banco, como los deja el Pulso de saldos; se rehace la foto del día 15 con ellos (la anterior era de saldos calculados).
    await page.evaluate(() => {
      localStorage.removeItem(storageKey("liquidity-backtest"));
      qs("registrarBalanceMode").value = "manual"; // como el botón «Real manual» del Pulso de saldos
      qs("registrarBalanceMode").dispatchEvent(new Event("change", { bubbles: true }));
      state.balanceDate = "2026-10-14";
      ["balanceDate", "registrarBalanceDate"].forEach((id) => { qs(id).value = "2026-10-14"; });
      saveBalanceSettings();
      render();
    });
    const frozen = await page.evaluate(() => freezeLiquidityForecast());
    expect(frozen.balanceMode).toBe("manual");
    expect(frozen.balanceDate).toBe("2026-10-14");
    // Cierre real de octubre con saldos del 31/10 (mismo formato que escribe WP-09).
    await page.evaluate(() => {
      state.balanceDate = "2026-10-31";
      recordMonthCloseBalances("2026-10", "2026-11-01T09:00:00.000Z");
    });
    const expected = await page.evaluate(() => {
      const close = loadMonthCloseBalances().months["2026-10"];
      return { actual: Math.round((close.accounts.caixabank + close.accounts.mediolanum) * 100) / 100, date: close.date };
    });
    expect(expected.date).toBe("2026-10-31");
    await page.click("#previsionBacktestCard > summary");
    await page.evaluate(() => render());
    await expect(page.locator("#previsionBacktestResumen")).toContainText("datos insuficientes (1 de 3 cierres)");
    await expect(page.locator("#previsionBacktest")).not.toContainText("Esperan su cierre");
    await expect(page.locator("#previsionBacktest")).not.toContainText("No cuentan");
    const row = await page.evaluate(() => FinanceCanonicalLiquidityBacktest.evaluate({ store: readLiquidityBacktestStore(), closes: loadMonthCloseBalances(), today: "2026-11-02" }).rows[0]);
    expect(row.status).toBe("comparable");
    expect(row.closeDate).toBe("2026-10-31");
    expect(row.actual).toBe(expected.actual);
    expect(row.predicted).toBe(frozen.closing);
    expect(row.error).toBe(Math.round((frozen.closing - expected.actual) * 100) / 100);
    expect(pageErrors, `errores de página: ${pageErrors.join(" | ")}`).toEqual([]);
  });

  for (const viewport of [{ width: 390, height: 844 }, { width: 1280, height: 720 }]) {
    test(`la tarjeta se ve y no desborda a ${viewport.width} px`, async ({ page }) => {
      await page.setViewportSize(viewport);
      await page.clock.install({ time: new Date(2026, 9, 15, 9, 0, 0) });
      await page.goto("/index.html#prevision");
      await expect.poll(async () => Object.keys((await photo(page))?.freezes || {})).toEqual(["2026-10:d15"]);
      await page.click("#previsionBacktestCard > summary");
      await expect(page.locator("#previsionBacktest")).toContainText("Foto del día 1 (días 1-3)");
      await expect(page.locator("#previsionBacktest")).toContainText("Foto del día 15 (días 15-17)");
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), "sin desbordar en horizontal").toBe(true);
    });
  }
});

// WP-30 · PR-1: tarjetas de crédito en un navegador real. Configurar una tarjeta SIN compras no cambia la previsión; una compra
// acumulada sin cargo hace que su fila valga lo mayor entre lo previsto y lo anotado; al llegar el cargo, manda el cargo.
// Los ciclos de estas pruebas son inventados (los reales los introduce el hogar y no van al repositorio).
test.describe("QA-1 · tarjetas de crédito (WP-30)", () => {
  const openCards = async (page) => {
    await page.goto("/index.html#planificacion-partidas");
    await page.waitForFunction(() => typeof cardCycleRows === "function" && document.querySelector("#tarjetasCiclo form"));
    await page.click("#tarjetasCard > summary");
  };

  for (const viewport of [{ width: 390, height: 844 }, { width: 1280, height: 720 }]) {
    test(`la ficha de tarjetas se configura y se ve bien a ${viewport.width} px`, async ({ page }) => {
      const pageErrors = [];
      page.on("pageerror", (error) => pageErrors.push(String(error)));
      await page.setViewportSize(viewport);
      await openCards(page);
      const rowKey = await page.evaluate(() => cardCycleRows()[0]?.key || "");
      expect(rowKey, "la demo tiene al menos una fila de Financiaciones donde liquidar una tarjeta").not.toBe("");
      const form = page.locator('#tarjetasCiclo form[data-tarjeta="nueva"]');
      await form.locator('[name="label"]').fill("Tarjeta de prueba");
      await form.locator('[name="rowKey"]').selectOption(rowKey);
      await form.locator('[name="cutDay"]').selectOption("10");
      await form.locator('[name="chargeMonthOffset"]').selectOption("1");
      await form.locator('[name="chargeDay"]').selectOption("5");
      await form.locator('button[type="submit"]').click();
      await expect(page.locator("#tarjetasCiclo")).toContainText("Guardada la tarjeta Tarjeta de prueba");
      await expect(page.locator("#tarjetasResumen")).toHaveText("Tarjetas de crédito: Tarjeta de prueba");
      await expect(page.locator("#tarjetasCiclo")).toContainText("Ejemplo: una compra del 15/");
      const stored = await page.evaluate(() => JSON.parse(localStorage.getItem(storageKey("card-cycles"))));
      expect(stored.cards).toHaveLength(1);
      expect(stored.cards[0]).toMatchObject({ label: "Tarjeta de prueba", rowKey, cutDay: 10, chargeMonthOffset: 1, chargeDay: 5 });
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), "sin desbordar en horizontal").toBe(true);

      // Un nombre vacío no guarda y dice por qué.
      const extra = page.locator('#tarjetasCiclo form[data-tarjeta="nueva"]');
      await extra.locator('button[type="submit"]').click();
      await expect(extra.locator(".asignacion-error")).toContainText("Pon un nombre a la tarjeta.");
      expect((await page.evaluate(() => JSON.parse(localStorage.getItem(storageKey("card-cycles"))))).cards).toHaveLength(1);

      // Quitar se puede deshacer.
      await page.locator("[data-tarjeta-quitar]").click();
      expect((await page.evaluate(() => JSON.parse(localStorage.getItem(storageKey("card-cycles"))))).cards).toHaveLength(0);
      await page.$eval("#undoToast button", (button) => button.click());
      await expect.poll(async () => (await page.evaluate(() => JSON.parse(localStorage.getItem(storageKey("card-cycles"))))).cards.length).toBe(1);
      expect(pageErrors, `errores de página: ${pageErrors.join(" | ")}`).toEqual([]);
    });
  }

  test("sin compras la previsión es idéntica; con una compra sin cargo la fila vale lo mayor; con el cargo, manda el cargo", async ({ page }) => {
    const pageErrors = [];
    page.on("pageerror", (error) => pageErrors.push(String(error)));
    await openCards(page);
    const snapshot = () => page.evaluate(() => JSON.stringify(canonicalDailyEngineRuns.active.rows));
    const before = await snapshot();
    const setup = await page.evaluate(() => {
      const rowKey = cardCycleRows()[0].key;
      const store = { cards: [{ id: "t1", label: "Prueba", rowKey, cutDay: 10, chargeMonthOffset: 1, chargeDay: 5, trackedFrom: "" }] };
      storageSet(storageKey("card-cycles"), JSON.stringify(store));
      render();
      return { rowKey };
    });
    expect(await snapshot(), "configurar una tarjeta sin compras no cambia ni un día de la previsión").toBe(before);

    // Una compra grande de hoy: su cargo cae en el mes de cargo de la tarjeta.
    const probe = () => page.evaluate(({ rowKey }) => {
      const today = isoLocalDate(new Date());
      const cycle = FinanceCanonicalCardCycles.cycleFor(today, loadCardCycles().cards[0]);
      const start = monthKey(modelStartDate());
      const index = (Number(cycle.chargeMonth.slice(0, 4)) * 12 + Number(cycle.chargeMonth.slice(5, 7))) - (Number(start.slice(0, 4)) * 12 + Number(start.slice(5, 7)));
      const month = planningMonthForDate(addMonths(modelStartDate(), index), index);
      const row = planningSectionsForMonth("expense", month).flatMap((section) => section.rows).find((item) => seriesKeyForRow(item) === rowKey);
      const info = actualAwareInfo(row, month);
      return { chargeMonth: cycle.chargeMonth, planned: info.planned, accrued: info.accrued, value: info.value, hasActual: info.hasActual, source: info.source, expenseTotal: planningBreakdownForForecastMonth(index, addMonths(modelStartDate(), index)).expenseTotal };
    }, setup);
    const none = await probe();
    expect(none.accrued).toBe(0);
    expect(none.value).toBe(none.planned);

    await page.evaluate(() => {
      const today = isoLocalDate(new Date());
      // PR-2: las compras viven en su propio almacén (card-purchases), no entre los movimientos del banco.
      storageSet(storageKey("card-purchases"), JSON.stringify({ purchases: [{ id: "e2e-compra-1", date: today, concept: "Compra de prueba", card: "t1", amount: 50000, capturedAt: new Date().toISOString() }] }));
      render();
    });
    const accrued = await probe();
    expect(accrued.accrued).toBe(50000);
    expect(accrued.value, "lo mayor entre lo previsto y lo anotado").toBe(Math.max(none.planned, 50000));
    expect(accrued.hasActual, "sin cargo todavía no hay real").toBe(false);
    expect(accrued.source).toBe("Acumulado con tarjeta");
    expect(accrued.expenseTotal, "el total previsto del mes de cargo sube lo que la compra pasa de lo previsto").toBeCloseTo(none.expenseTotal + (50000 - none.planned), 2);
    await expect(page.locator("#tarjetasCiclo")).toContainText("1 compra");

    // Llega el cargo del extracto (o se teclea el real): manda el cargo y las compras provisionales dejan de sumar.
    await page.evaluate(({ rowKey, chargeMonth }) => {
      expenseActuals[`${rowKey.slice(rowKey.indexOf("|") + 1)}|${chargeMonth}`] = 321.5;
      render();
    }, { rowKey: setup.rowKey, chargeMonth: accrued.chargeMonth });
    const charged = await probe();
    expect(charged.hasActual).toBe(true);
    expect(charged.value).toBe(321.5);
    expect(charged.accrued).toBe(0);
    expect(pageErrors, `errores de página: ${pageErrors.join(" | ")}`).toEqual([]);
  });
});

// Real parcial del mes en curso (decisión del hogar del 5/10/2026): una importación de extracto a mitad de mes asigna a «Gasto
// variable estimado» solo lo gastado hasta ahora. Ese real parcial no debe rebajar el gasto previsto del mes; en «Real manual»
// el mes de arranque vale lo que falta por gastar, no 0 ni el previsto entero. Se mide con el gasto total del mes de la previsión.
test.describe("QA-1 · real parcial del mes en curso", () => {
  test("un real parcial de Gasto variable no rebaja el mes; en Real manual resta solo lo ya gastado", async ({ page }) => {
    const pageErrors = [];
    page.on("pageerror", (error) => pageErrors.push(String(error)));
    await page.goto("/index.html#planificacion-partidas");
    await page.waitForFunction(() => typeof actualAwareInfo === "function" && typeof baseData !== "undefined" && baseData && document.querySelector("#tarjetasCiclo form"));
    const result = await page.evaluate(() => {
      const startKey = monthKey(modelStartDate());
      const month = planningMonthForDate(modelStartDate(), 0);
      const row = planningSectionsForMonth("expense", month).flatMap((s) => s.rows).find((r) => isVariableOperationalRow(r));
      if (!row) return { found: false };
      const total = () => Math.round(planningBreakdownForForecastMonth(0, modelStartDate()).expenseTotal * 100) / 100;
      const out = { found: true, currentMonth: startKey === monthKey(new Date()), base: total(), planned: actualAwareInfo(row, month).planned };
      const spent = Math.min(200, out.planned / 2);
      const tx = { date: `${startKey}-10`, valueDate: `${startKey}-10`, month: startKey, movement: "SUPERMERCADO PRUEBA", details: "", amount: -spent, balance: null, source: "extracto", account: "CaixaBank" };
      baseData.transactions.push(tx);
      movementMappings[transactionIdentity(tx)] = { kind: "expense", rowKey: seriesKeyForRow(row) };
      applyMovementMappingsToActuals();
      out.spent = spent;
      out.auto = total();
      out.info = { hasActual: actualAwareInfo(row, month).hasActual, inProgress: actualAwareInfo(row, month).inProgress };
      state.balanceMode = "manual";
      out.manual = total();
      return out;
    });
    expect(result.found, "la demo tiene la fila de Gasto variable estimado").toBe(true);
    expect(result.currentMonth, "el mes de arranque es el mes en curso").toBe(true);
    expect(result.info).toEqual({ hasActual: true, inProgress: true });
    expect(result.auto, "con el real parcial, el gasto del mes sigue siendo el previsto").toBe(result.base);
    expect(result.manual, "en Real manual: previsto menos lo ya gastado").toBeCloseTo(result.base - result.spent, 2);
    expect(pageErrors, `errores de página: ${pageErrors.join(" | ")}`).toEqual([]);
  });
});

// WP-30 · PR-2: la hoja de captura de compras con tarjeta en un navegador real. Sin tarjetas, «+ Registrar gasto» sigue abriendo la
// ventana de siempre (y mide su tiempo); con tarjetas abre la hoja, que guarda con «Hecho» del teclado, acumula en la fila de la tarjeta,
// deja deshacer y mide los segundos. Los ciclos son inventados (los reales los introduce el hogar y no van al repositorio).
test.describe("QA-1 · hoja de captura de compras con tarjeta (WP-30)", () => {
  const configureCard = (page, label = "Tarjeta de prueba") => page.evaluate((cardLabel) => {
    const rowKey = cardCycleRows()[0].key;
    storageSet(storageKey("card-cycles"), JSON.stringify({ cards: [{ id: "t1", label: cardLabel, rowKey, cutDay: 10, chargeMonthOffset: 1, chargeDay: 5, trackedFrom: "" }] }));
    render();
    return rowKey;
  }, label);
  const purchasesStored = (page) => page.evaluate(() => JSON.parse(localStorage.getItem(storageKey("card-purchases")) || '{"purchases":[],"timings":[]}'));
  const ready = async (page, hash = "#home") => {
    await page.goto(`/index.html${hash}`);
    await page.waitForFunction(() => typeof cardCycleRows === "function" && typeof openCapturaHoja === "function" && document.querySelector("#capturaHojaDialog"));
  };

  test("sin tarjetas, «+ Registrar gasto» abre la ventana de siempre y mide su tiempo; con tarjetas, la hoja", async ({ page }) => {
    const pageErrors = [];
    page.on("pageerror", (error) => pageErrors.push(String(error)));
    await ready(page);
    await page.waitForFunction(() => !document.getElementById("homeQuickExpenseOpen")?.disabled);
    await page.click("#homeQuickExpenseOpen");
    await expect(page.locator("#homeQuickExpenseDialog")).toBeVisible();
    await expect(page.locator("#capturaHojaDialog")).not.toBeVisible();
    await page.fill("#homeQuickExpenseLabel", "Gasto de prueba");
    await page.fill("#homeQuickExpenseAmount", "12,5");
    await page.click("#homeQuickExpenseSubmit");
    await expect(page.locator("#homeQuickExpenseDialog")).not.toBeVisible();
    const afterLegacy = await purchasesStored(page);
    expect(afterLegacy.timings.map((item) => item.kind), "el tiempo de la ventana anterior queda medido").toEqual(["dialogo"]);
    expect(afterLegacy.purchases).toEqual([]);

    await configureCard(page);
    await page.click("#homeQuickExpenseOpen");
    await expect(page.locator("#capturaHojaDialog")).toBeVisible();
    await expect(page.locator("#homeQuickExpenseDialog")).not.toBeVisible();
    await expect(page.locator("#capturaHojaAmount")).toBeFocused();
    expect(pageErrors, `errores de página: ${pageErrors.join(" | ")}`).toEqual([]);
  });

  test("anotar con el teclado, ver la compra acumulada en la fila y deshacerla", async ({ page }) => {
    const pageErrors = [];
    page.on("pageerror", (error) => pageErrors.push(String(error)));
    await ready(page);
    const rowKey = await configureCard(page);
    await page.waitForFunction(() => !document.getElementById("homeQuickExpenseOpen")?.disabled);
    await page.click("#homeQuickExpenseOpen");
    await page.keyboard.type("23,40");
    await page.keyboard.press("Tab");
    await page.keyboard.type("Mercadona");
    // Una sola tarjeta: ya está elegida. «Hecho» del teclado guarda.
    await expect(page.locator('#capturaHojaCards [aria-pressed="true"]')).toHaveText("Tarjeta de prueba");
    await expect(page.locator("#capturaHojaPreview")).toContainText("Se carga el ");
    await page.keyboard.press("Enter");
    await expect(page.locator("#capturaHojaDialog")).not.toBeVisible();
    const saved = await purchasesStored(page);
    expect(saved.purchases).toHaveLength(1);
    expect(saved.purchases[0]).toMatchObject({ amount: 23.4, concept: "Mercadona", card: "t1" });
    expect(saved.lastCard).toBe("t1");
    expect(saved.timings.map((item) => item.kind)).toEqual(["hoja"]);
    await expect(page.locator("#undoToast")).toBeVisible();
    await expect(page.locator("#undoToastMessage")).toContainText("Anotada: 23,40");
    await expect(page.locator("#undoToastMessage")).toContainText("Mercadona");

    // La compra se acumula en la fila de la tarjeta, en el mes de cargo, sin crear real ni tocar los movimientos del banco.
    const row = await page.evaluate((key) => {
      const purchase = JSON.parse(localStorage.getItem(storageKey("card-purchases"))).purchases[0];
      const cycle = FinanceCanonicalCardCycles.cycleFor(purchase.date, loadCardCycles().cards[0]);
      const start = monthKey(modelStartDate());
      const index = (Number(cycle.chargeMonth.slice(0, 4)) * 12 + Number(cycle.chargeMonth.slice(5, 7))) - (Number(start.slice(0, 4)) * 12 + Number(start.slice(5, 7)));
      const month = planningMonthForDate(addMonths(modelStartDate(), index), index);
      const found = planningSectionsForMonth("expense", month).flatMap((section) => section.rows).find((item) => seriesKeyForRow(item) === key);
      const info = actualAwareInfo(found, month);
      return { accrued: info.accrued, hasActual: info.hasActual, transactions: (baseData.transactions || []).filter((item) => item.source === "captura-hoja").length };
    }, rowKey);
    expect(row.accrued).toBe(23.4);
    expect(row.hasActual).toBe(false);
    expect(row.transactions, "no entra entre los movimientos del banco").toBe(0);

    await page.click("#undoToastButton");
    expect((await purchasesStored(page)).purchases).toHaveLength(0);
    expect(pageErrors, `errores de página: ${pageErrors.join(" | ")}`).toEqual([]);
  });

  test("el enlace de registro abre la hoja rellena y no guarda solo", async ({ page }) => {
    const pageErrors = [];
    page.on("pageerror", (error) => pageErrors.push(String(error)));
    await ready(page, "#home");
    await configureCard(page, "Tarjeta de prueba");
    await page.evaluate(() => { location.hash = "#registrar?importe=23,40&concepto=Mercadona&tarjeta=prueba&origen=applepay"; });
    await expect(page.locator("#capturaHojaDialog")).toBeVisible();
    await expect(page.locator("#capturaHojaAmount")).toHaveValue("23,40");
    await expect(page.locator("#capturaHojaConcept")).toHaveValue("Mercadona");
    await expect(page.locator('#capturaHojaCards [aria-pressed="true"]')).toHaveText("Tarjeta de prueba");
    await expect(page.locator("#capturaHojaNote")).toContainText("no se guarda nada hasta que pulses «Guardar»");
    expect((await purchasesStored(page)).purchases, "abrir el enlace no guarda nada").toHaveLength(0);
    await page.click("#capturaHojaSubmit");
    expect((await purchasesStored(page)).purchases).toHaveLength(1);
    expect(pageErrors, `errores de página: ${pageErrors.join(" | ")}`).toEqual([]);
  });

  for (const viewport of [{ width: 390, height: 844 }, { width: 1280, height: 720 }]) {
    test(`la hoja y el informe de compras se ven bien a ${viewport.width} px`, async ({ page }) => {
      const pageErrors = [];
      page.on("pageerror", (error) => pageErrors.push(String(error)));
      await page.setViewportSize(viewport);
      await ready(page);
      await configureCard(page);
      await page.waitForFunction(() => !document.getElementById("homeQuickExpenseOpen")?.disabled);
      await page.click("#homeQuickExpenseOpen");
      const box = await page.locator("#capturaHojaDialog").boundingBox();
      expect(box.x).toBeGreaterThanOrEqual(0);
      expect(box.x + box.width, "la hoja cabe en la pantalla").toBeLessThanOrEqual(viewport.width + 1);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), "sin desbordar en horizontal").toBe(true);
      await page.keyboard.type("5");
      await page.fill("#capturaHojaConcept", "Café");
      await page.click("#capturaHojaSubmit");
      await expect(page.locator("#capturaHojaDialog")).not.toBeVisible();
      await page.evaluate(() => { location.hash = "#planificacion-partidas"; });
      await page.waitForFunction(() => document.querySelector("#tarjetasCiclo form"));
      await page.click("#tarjetasCard > summary");
      await expect(page.locator("#tarjetasCompras")).toContainText("Compras anotadas");
      await expect(page.locator("#tarjetasCompras")).toContainText("Café");
      await expect(page.locator("#tarjetasCompras")).toContainText("mediana");
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), "el informe no desborda").toBe(true);
      await page.click("[data-compra-quitar]");
      await expect(page.locator("#tarjetasCompras")).toContainText("Todavía no hay compras anotadas");
      expect(pageErrors, `errores de página: ${pageErrors.join(" | ")}`).toEqual([]);
    });
  }
});

// WP-15: la hoja de valoración de la cartera en un navegador real. Hasta ahora una posición no se podía actualizar. Las posiciones son
// ficticias; la hoja actualiza valor y fecha, añade un punto a la serie con fecha, descuenta aportaciones en la variación, pide confirmar
// un 0 o un salto, no mueve el presente con una fecha pasada, mide el tiempo y se deshace durante 8 segundos.
test.describe("QA-1 · valoración de la cartera (WP-15)", () => {
  const seed = (page) => page.evaluate(() => {
    const iso = (offset) => { const date = new Date(); date.setDate(date.getDate() + offset); return isoLocalDate(date); };
    saveIv1PositionsList([
      { id: "e2e-vieja", type: "fondo", label: "Fondo de prueba antiguo", quantity: 10, costBasis: 1000, currentValue: 1200, asOf: iso(-60), acquisitionDate: iso(-400), provenance: "declared", contributions: [{ id: "c1", date: iso(-30), amount: 500, quantity: 0 }], disposals: [], scheduledContributions: [] },
      { id: "e2e-nueva", type: "cripto", label: "Cripto de prueba", quantity: 0, costBasis: 200, currentValue: 300, asOf: iso(-3), acquisitionDate: iso(-200), provenance: "declared", contributions: [], disposals: [], scheduledContributions: [] },
    ]);
    renderIv1PositionList();
    return { oldAsOf: iso(-60), today: iso(0), past: iso(-90) };
  });
  const position = (page, id) => page.evaluate((positionId) => iv1PositionsList().find((item) => item.id === positionId), id);
  const stored = (page) => page.evaluate(() => JSON.parse(localStorage.getItem(storageKey("portfolio-valuations")) || '{"valuations":[],"timings":[]}'));
  const ready = async (page, hash = "#inversion-cartera") => {
    await page.goto(`/index.html${hash}`);
    await page.waitForFunction(() => typeof openValoracionHoja === "function" && typeof saveIv1PositionsList === "function" && document.querySelector("#valoracionAbrir"));
  };

  test("valorar la cartera: valor y fecha de la posición, punto en la serie, variación descontando la aportación, tiempo medido y deshacer", async ({ page }) => {
    const pageErrors = [];
    page.on("pageerror", (error) => pageErrors.push(String(error)));
    await ready(page);
    const dates = await seed(page);
    await expect(page.locator("#valoracionResumen")).toContainText("1 de 2");
    await expect(page.locator("#iv1PositionList")).toContainText("valorada hace 60 días");
    await page.click("#valoracionAbrir");
    await expect(page.locator("#valoracionDialog")).toBeVisible();
    const order = await page.locator("[data-valoracion-fila] legend").allTextContents();
    expect(order[0], "las más antiguas, primero").toContain("Fondo de prueba antiguo");
    await expect(page.locator('[data-valoracion-valor="e2e-vieja"]')).toBeFocused();
    await page.keyboard.type("1.750,00");
    await expect(page.locator('[data-valoracion-chip="e2e-vieja"]')).toContainText("Variación de mercado: +50");
    await expect(page.locator('[data-valoracion-chip="e2e-vieja"]')).toContainText("descontadas aportaciones netas de 500");
    await page.keyboard.press("Enter");
    await expect(page.locator("#valoracionDialog")).not.toBeVisible();
    const after = await position(page, "e2e-vieja");
    expect(after).toMatchObject({ currentValue: 1750, asOf: dates.today, provenance: "declared" });
    expect((await position(page, "e2e-nueva")).currentValue, "la fila que no se tocó no cambia").toBe(300);
    const store = await stored(page);
    expect(store.valuations).toHaveLength(1);
    expect(store.valuations[0]).toMatchObject({ date: dates.today, points: [{ id: "e2e-vieja", value: 1750, cost: 1500 }] });
    expect(store.timings, "el tiempo hasta guardar queda medido").toHaveLength(1);
    await expect(page.locator("#undoToast")).toBeVisible();
    await expect(page.locator("#iv1PositionList")).toContainText("valorada hoy");
    await expect(page.locator("#valoracionResumen")).toContainText("2 de 2");
    await page.click("#undoToastButton");
    expect(await position(page, "e2e-vieja")).toMatchObject({ currentValue: 1200, asOf: dates.oldAsOf });
    expect((await stored(page)).valuations, "deshacer quita el punto").toHaveLength(0);
    expect(pageErrors, `errores de página: ${pageErrors.join(" | ")}`).toEqual([]);
  });

  test("vacío no cambia, «Sin cambios» renueva la fecha, un 0 y un salto piden confirmar, una fecha pasada no mueve el presente", async ({ page }) => {
    const pageErrors = [];
    page.on("pageerror", (error) => pageErrors.push(String(error)));
    await ready(page);
    const dates = await seed(page);

    // Sin nada que guardar: no guarda y lo dice.
    await page.click("#valoracionAbrir");
    await page.click("#valoracionGuardar");
    await expect(page.locator("#valoracionError")).toContainText("No hay ningún valor que guardar");
    expect((await stored(page)).valuations).toHaveLength(0);

    // «Sin cambios» renueva la fecha y conserva el valor.
    await page.click('[data-valoracion-igual="e2e-vieja"]');
    await page.click("#valoracionGuardar");
    await expect(page.locator("#valoracionDialog")).not.toBeVisible();
    expect(await position(page, "e2e-vieja")).toMatchObject({ currentValue: 1200, asOf: dates.today });
    await page.click("#undoToastButton");

    // Un 0 explícito pide confirmar; confirmado, vale cero.
    await page.click("#valoracionAbrir");
    await page.fill('[data-valoracion-valor="e2e-nueva"]', "0");
    await page.click("#valoracionGuardar");
    await expect(page.locator("#valoracionError")).toContainText("Confirma las filas marcadas");
    await expect(page.locator('[data-valoracion-confirmar="e2e-nueva"]')).toBeVisible();
    expect((await position(page, "e2e-nueva")).currentValue, "sin confirmar no se guarda").toBe(300);
    await page.check('[data-valoracion-confirmado="e2e-nueva"]');
    await page.click("#valoracionGuardar");
    expect((await position(page, "e2e-nueva")).currentValue).toBe(0);
    await page.click("#undoToastButton");

    // Una coma de más pide confirmar.
    await page.click("#valoracionAbrir");
    await page.fill('[data-valoracion-valor="e2e-nueva"]', "30000");
    await expect(page.locator('[data-valoracion-chip="e2e-nueva"]')).toContainText("falta o sobra una coma");
    await page.click("#valoracionCancelar");
    await expect(page.locator("#valoracionDialog")).not.toBeVisible();
    expect((await position(page, "e2e-nueva")).currentValue, "cancelar no guarda").toBe(300);

    // Una fecha pasada añade un punto y no mueve el valor actual ni su fecha.
    await page.click("#valoracionAbrir");
    await page.click('[data-valoracion-fecha="otra"]');
    await page.fill("#valoracionFecha", dates.past);
    await page.fill('[data-valoracion-valor="e2e-vieja"]', "1100");
    await expect(page.locator('[data-valoracion-chip="e2e-vieja"]')).toContainText("solo añade un punto histórico");
    await page.click("#valoracionGuardar");
    await expect(page.locator("#valoracionDialog")).not.toBeVisible();
    expect(await position(page, "e2e-vieja")).toMatchObject({ currentValue: 1200, asOf: dates.oldAsOf });
    const store = await stored(page);
    expect(store.valuations.map((item) => item.date)).toEqual([dates.past]);
    expect(pageErrors, `errores de página: ${pageErrors.join(" | ")}`).toEqual([]);
  });

  test("el cierre avisa, sin bloquear, de la cartera sin valorar", async ({ page }) => {
    const pageErrors = [];
    page.on("pageerror", (error) => pageErrors.push(String(error)));
    await ready(page);
    await seed(page);
    await page.evaluate(() => { location.hash = "#cierre"; });
    await page.waitForFunction(() => document.querySelector("#cierreValoracionAviso") && !document.querySelector("#cierreValoracionAviso").hidden);
    await expect(page.locator("#cierreValoracionAviso")).toContainText("1 de 2 posiciones sin valorar hace más de 35 días (Fondo de prueba antiguo)");
    await expect(page.locator("#cierreValoracionAviso")).toContainText("no impide cerrar el mes");
    expect(pageErrors, `errores de página: ${pageErrors.join(" | ")}`).toEqual([]);
  });

  for (const viewport of [{ width: 390, height: 844 }, { width: 1280, height: 720 }]) {
    test(`la hoja de valoración se ve bien a ${viewport.width} px`, async ({ page }) => {
      const pageErrors = [];
      page.on("pageerror", (error) => pageErrors.push(String(error)));
      await page.setViewportSize(viewport);
      await ready(page);
      await seed(page);
      await page.click("#valoracionAbrir");
      const box = await page.locator("#valoracionDialog").boundingBox();
      expect(box.x).toBeGreaterThanOrEqual(0);
      expect(box.x + box.width, "la hoja cabe en la pantalla").toBeLessThanOrEqual(viewport.width + 1);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), "sin desbordar en horizontal").toBe(true);
      await page.locator("#valoracionGuardar").scrollIntoViewIfNeeded();
      await expect(page.locator("#valoracionGuardar")).toBeVisible();
      await page.click("#valoracionCancelar");
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), "la tarjeta de la cartera no desborda").toBe(true);
      expect(pageErrors, `errores de página: ${pageErrors.join(" | ")}`).toEqual([]);
    });
  }
});

// WP-23: la campaña fiscal de fin de año, con cifras de ejemplo marcadas como tal, en Herramientas avanzadas › Fiscal.
test.describe("WP-23 · campaña fiscal con cifras de ejemplo", () => {
  test("la tarjeta aparece marcada como ejemplo, con todas sus cifras marcadas, sin errores y sin desbordar en móvil", async ({ page }) => {
    const pageErrors = [];
    page.on("pageerror", (error) => pageErrors.push(String(error)));
    for (const viewport of [{ width: 1280, height: 720 }, { width: 390, height: 844 }]) {
      await page.setViewportSize(viewport);
      await page.goto("/index.html#herramientas-fiscal");
      const card = page.locator("#campanaFiscalCard");
      await expect(card).toBeVisible();
      await expect(card).toHaveAttribute("data-ejemplo", "true");
      await expect(card.locator(".fc-etiqueta-ejemplo")).toHaveText("Ejemplo");
      await expect(card.locator(".fc-aviso")).toContainText("Cifras de ejemplo.");
      await expect(card.locator(".fc-accion")).toHaveCount(5);
      const cifras = await card.locator(".fc-cifra").count();
      expect(cifras, "hay cifras").toBeGreaterThan(5);
      await expect(card.locator(".fc-cifra-ejemplo"), "ninguna cifra del ejemplo sin marcar").toHaveCount(cifras);
      await expect(card.locator(".fc-cifra-ejemplo .sr-only").first()).toHaveText("(cifra de ejemplo)");
      await expect(card).toContainText("de ahorro estimado en la Renta de");
      await card.locator(".fc-accion details summary").first().click();
      await expect(card.locator(".fc-accion details").first()).toHaveJSProperty("open", true);
      await expect(card.locator(".fc-accion details").first()).toContainText("Persona A");
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), `sin desbordar en ${viewport.width} px`).toBe(true);
    }
    expect(pageErrors, `errores de página: ${pageErrors.join(" | ")}`).toEqual([]);
  });
});

// WP-28: el cono de previsión migrado al kit de gráficos (chart-kit.js): se lee con el ratón, el teclado y el dedo, con lectura fija y tabla.
test.describe("WP-28 · kit de gráficos en el cono de previsión", () => {
  test("se recorre con teclado y ratón, la lectura es fija, la tabla da los mismos datos y no desborda en móvil", async ({ page }) => {
    const pageErrors = [];
    page.on("pageerror", (error) => pageErrors.push(String(error)));
    for (const viewport of [{ width: 1280, height: 800 }, { width: 390, height: 844 }]) {
      await page.setViewportSize(viewport);
      await page.goto("/index.html#new-life-simulation");
      await page.reload(); // la misma URL con almohadilla no recarga: sin esto el segundo ancho heredaría la lectura del primero
      const figure = page.locator("#e13AdvancedAnalysis .ck-figure");
      await expect(figure).toBeVisible({ timeout: 15000 });
      const slider = figure.locator(".ck-scrub");
      const readout = figure.locator("[data-ck-readout]");
      const last = Number(await slider.getAttribute("aria-valuemax"));
      expect(last, "el cono tiene varios meses").toBeGreaterThan(2);
      await expect(figure.locator("svg[role='img']")).toHaveAttribute("aria-label", /Cono de incertidumbre[\s\S]*La liquidez prevista/);
      await expect(readout).toContainText("Toca o desliza");
      // Teclado: las flechas leen mes a mes, Fin y Inicio saltan a los extremos, el tabulador no queda atrapado.
      await slider.focus();
      await page.keyboard.press("ArrowRight");
      await expect(slider).toHaveAttribute("aria-valuenow", "1");
      await expect(readout).toContainText(/P10 .*P50 .*P90/);
      const secondReading = await readout.textContent();
      await page.keyboard.press("End");
      await expect(slider).toHaveAttribute("aria-valuenow", String(last));
      expect(await readout.textContent(), "la lectura cambia con el punto").not.toBe(secondReading);
      await page.keyboard.press("Home");
      await expect(slider).toHaveAttribute("aria-valuenow", "0");
      // Ratón: leer con solo pasar por encima, sin pulsar; el último punto está en el borde derecho.
      // `hover` con posición relativa al control: mide la geometría en el momento y comprueba que el control recibe el evento (si algo lo tapara o la
      // página se moviera, falla con un motivo claro). Con `mouse.move` a coordenadas medidas antes, un reajuste de la maquetación en un CI lento dejaba
      // el ratón fuera del gráfico y la prueba fallaba solo allí.
      const box = await slider.boundingBox();
      await slider.hover({ position: { x: box.width - 1, y: box.height / 2 } });
      await expect(slider).toHaveAttribute("aria-valuenow", String(last));
      await slider.hover({ position: { x: 1, y: box.height / 2 } });
      await expect(slider).toHaveAttribute("aria-valuenow", "0");
      await expect(figure.locator(".ck-cursor")).toBeVisible();
      // La lectura es fija: leer un punto no mueve nada por debajo de ella.
      // Se mide en coordenadas de DOCUMENTO (posición + desplazamiento): al enfocar o pulsar teclas la página puede desplazarse, y eso mueve la
      // posición en la ventana sin que el diseño cambie. Lo que no debe pasar es que leer un punto empuje lo de debajo.
      const readoutTop = () => figure.locator("[data-ck-readout]").evaluate((node) => Math.round(node.getBoundingClientRect().top + window.scrollY));
      await slider.focus();
      await page.keyboard.press("Home");
      const before = await readoutTop();
      await page.keyboard.press("End");
      await page.keyboard.press("ArrowLeft");
      expect(await readoutTop(), "leer otro punto no mueve la lectura ni lo que hay debajo").toBe(before);
      // Ver como tabla: una fila por mes, los mismos números.
      await figure.locator(".ck-tabla summary").click();
      await expect(figure.locator(".ck-tabla table tbody tr")).toHaveCount(last + 1);
      await expect(figure.locator(".ck-tabla thead th")).toHaveText(["Mes", "P10", "P50", "P90", "Margen"]);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), `sin desbordar en ${viewport.width} px`).toBe(true);
    }
    expect(pageErrors, `errores de página: ${pageErrors.join(" | ")}`).toEqual([]);
  });

  test("con el dedo: apoyar lee, soltar deja la lectura, y el gesto vertical sigue siendo desplazar", async ({ browser }) => {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
    const page = await context.newPage();
    await page.goto("/index.html#new-life-simulation");
    const slider = page.locator("#e13AdvancedAnalysis .ck-scrub");
    await expect(slider).toBeVisible({ timeout: 15000 });
    expect(await slider.evaluate((node) => getComputedStyle(node).touchAction), "el gesto vertical sigue desplazando la página").toBe("pan-y");
    const last = Number(await slider.getAttribute("aria-valuemax"));
    await slider.scrollIntoViewIfNeeded();
    const box = await slider.boundingBox();
    await slider.tap({ position: { x: box.width - 2, y: box.height / 2 } });
    await expect(slider).toHaveAttribute("aria-valuenow", String(last));
    await expect(page.locator("#e13AdvancedAnalysis [data-ck-readout]")).toContainText(/P10/);
    await context.close();
  });
});

// WP-16: la banda de caja a 30 días (Plan › Previsión), con el kit de gráficos de WP-28 y el suelo de liquidez.
test.describe("WP-16 · banda de caja a 30 días", () => {
  test("se abre, se recorre con teclado, dice su frase y su tabla, no se repinta sola y no desborda en móvil", async ({ page }) => {
    const pageErrors = [];
    page.on("pageerror", (error) => pageErrors.push(String(error)));
    for (const viewport of [{ width: 1280, height: 900 }, { width: 390, height: 844 }]) {
      await page.setViewportSize(viewport);
      await page.goto("/index.html#prevision");
      await page.reload();
      const card = page.locator("#previsionBandaCard");
      await expect(page.locator("#previsionBandaResumen")).toContainText(/^Banda de caja a 30 días/, { timeout: 15000 });
      await page.locator("#previsionBandaResumen").click();
      const figure = card.locator(".ck-figure");
      await expect(figure).toBeVisible();
      await expect(card.locator(".ck-frase")).toContainText(/trayectorias/);
      await expect(figure.locator("svg[role='img']")).toHaveAttribute("aria-label", /Banda de caja de los próximos 30 días[\s\S]*La liquidez central \(P50\)/);
      await expect(figure.locator(".ck-umbral")).toHaveCount(1); // el suelo se ve
      await expect(card.locator(".ck-leyenda")).toContainText("Suelo");
      const slider = figure.locator(".ck-scrub");
      const last = Number(await slider.getAttribute("aria-valuemax"));
      expect(last, "30 días de horizonte desde hoy").toBe(30);
      await slider.focus();
      await page.keyboard.press("End");
      await expect(slider).toHaveAttribute("aria-valuenow", String(last));
      await expect(figure.locator("[data-ck-readout]")).toContainText(/P10 .*P50 .*P90 .*según el plan/);
      // Se repinta cuando cambian los datos, no por pintar: tras esperar, la lectura sigue donde estaba.
      await page.waitForTimeout(1500);
      await expect(slider).toHaveAttribute("aria-valuenow", String(last));
      await figure.locator(".ck-tabla summary").click();
      await expect(figure.locator(".ck-tabla tbody tr")).toHaveCount(last + 1);
      await expect(figure.locator(".ck-tabla thead th")).toHaveText(["Día", "P10", "P50", "P90", "Según el plan"]);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), `sin desbordar en ${viewport.width} px`).toBe(true);
    }
    expect(pageErrors, `errores de página: ${pageErrors.join(" | ")}`).toEqual([]);
  });
});

// WP-32: recordatorios en el calendario del móvil (Ajustes): opciones que se recuerdan, descarga de un .ics válido y sin datos privados en los títulos.
test.describe("WP-32 · recordatorios en el calendario", () => {
  test("opciones, descarga de un .ics válido sin importes en los títulos y sin desbordar en móvil", async ({ page }) => {
    const pageErrors = [];
    page.on("pageerror", (error) => pageErrors.push(String(error)));
    for (const viewport of [{ width: 1280, height: 900 }, { width: 390, height: 844 }]) {
      await page.setViewportSize(viewport);
      await page.goto("/index.html#ajustes");
      await page.reload();
      await page.evaluate(() => { try { localStorage.clear(); } catch { /* sin almacenamiento */ } });
      await page.reload();
      const card = page.locator("#recordatoriosCard");
      await expect(card.locator("#recordatoriosResumen")).toContainText(/recordatorio\(s\) hasta el/, { timeout: 15000 });
      await expect(card.locator("[data-recordatorios-kind]")).toHaveCount(5);
      await expect(card).toContainText("no es un calendario que se actualice solo");
      await expect(card.locator("#recordatoriosResumen")).toContainText("cierres de mes");
      // Una opción se apaga, se recuerda tras recargar y se vuelve a encender.
      await card.locator('[data-recordatorios-kind="monthClose"]').uncheck();
      await expect(card.locator("#recordatoriosResumen")).not.toContainText("cierres de mes");
      await page.reload();
      await expect(card.locator('[data-recordatorios-kind="monthClose"]')).not.toBeChecked();
      await card.locator('[data-recordatorios-kind="monthClose"]').check();
      await expect(card.locator("#recordatoriosResumen")).toContainText("cierres de mes");
      // La descarga: un .ics con alarma en cada evento y sin importes ni nombres en los títulos.
      const [download] = await Promise.all([page.waitForEvent("download"), card.locator("#recordatoriosDescargar").click()]);
      expect(download.suggestedFilename()).toBe("recordatorios-finanzas-casa.ics");
      const text = await new Promise((resolve, reject) => { const chunks = []; download.createReadStream().then((stream) => { stream.on("data", (chunk) => chunks.push(chunk)); stream.on("end", () => resolve(Buffer.concat(chunks).toString("utf8"))); stream.on("error", reject); }, reject); });
      expect(text.startsWith("BEGIN:VCALENDAR\r\n")).toBe(true);
      const events = (text.match(/BEGIN:VEVENT/g) || []).length;
      expect(events).toBeGreaterThan(0);
      expect((text.match(/BEGIN:VALARM/g) || []).length, "cada evento lleva su alarma").toBe(events);
      const titles = [...text.matchAll(/^SUMMARY:(.*)$/gm)].map((match) => match[1]);
      titles.forEach((title) => expect(title, `el título «${title}» enseña un importe`).not.toMatch(/€|\d{3}/));
      await expect(card.locator("#recordatoriosNota")).toContainText("Recordatorios descargados");
      await expect(card.locator("#recordatoriosResumen")).toContainText("Generado hoy.");
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), `sin desbordar en ${viewport.width} px`).toBe(true);
    }
    expect(pageErrors, `errores de página: ${pageErrors.join(" | ")}`).toEqual([]);
  });
});

// WP-14 + WP-27: «¿ha llegado…?» en la bandeja de Hoy. La demo no tiene fechas de regla (el detector calla, que es lo correcto), así que se inyectan
// dos esperados vencidos sobre filas REALES de la demo y se comprueban de verdad los efectos en la previsión.
async function injectExpected(page) {
  return page.evaluate(() => {
    const today = isoLocalDate(new Date());
    const key = today.slice(0, 7);
    const month = monthByKey(key);
    const incomeRow = planningSectionsForMonth("income", month)[0].rows[0];
    const expRow = planningSectionsForMonth("expense", month).find((section) => section.name !== VARIABLE_OPERATIONAL_SECTION).rows[0];
    const back = (days) => { const date = new Date(); date.setDate(date.getDate() - days); return isoLocalDate(date); };
    window.__esperados = { incomeKey: seriesKeyForRow(incomeRow), expKey: seriesKeyForRow(expRow), key, incomeLabel: displayLabelForRow(incomeRow), expLabel: displayLabelForRow(expRow) };
    expectedMovementExpectations = () => [
      { id: `${seriesKeyForRow(incomeRow)}|${key}`, kind: "income", seriesKey: seriesKeyForRow(incomeRow), label: displayLabelForRow(incomeRow), month: key, expectedDate: back(5), certain: true, plannedAmount: actualAwareInfo(incomeRow, month).planned, arrived: Boolean(actualAwareInfo(incomeRow, month).hasActual), cancelled: false, history: [] },
      { id: `${seriesKeyForRow(expRow)}|${key}`, kind: "expense", seriesKey: seriesKeyForRow(expRow), label: displayLabelForRow(expRow), month: key, expectedDate: back(9), certain: true, plannedAmount: actualAwareInfo(expRow, month).planned, arrived: Boolean(actualAwareInfo(expRow, month).hasActual), cancelled: actualAwareInfo(expRow, month).status === "cancelled", history: [{ date: back(40), amount: 1 }] },
    ];
    expectedLedgerCoveredUntil = () => today;
    renderDecisionInboxCard();
  });
}

test.describe("WP-14 + WP-27 · cobros esperados y cargos que no llegaron", () => {
  test("responder registra el real, se puede deshacer, «aún no» calla y se recuerda, y la baja anula la serie y se deshace", async ({ page }) => {
    const pageErrors = [];
    page.on("pageerror", (error) => pageErrors.push(String(error)));
    await page.setViewportSize({ width: 390, height: 900 });
    await page.goto("/index.html#home");
    await page.reload();
    await page.evaluate(() => { try { localStorage.removeItem(`expected-answers:${baseData?.metadata?.sourceWorkbook || "finance"}`); } catch { /* sin almacenamiento */ } });
    await expect(page.locator("#homeDecisionInboxCard")).toBeAttached({ timeout: 15000 });
    await page.waitForFunction(() => typeof expectedMovementExpectations === "function" && typeof monthByKey === "function" && monthByKey(isoLocalDate(new Date()).slice(0, 7)));
    await injectExpected(page);
    const card = page.locator("#homeDecisionInboxCard");
    await expect(card).toBeVisible();
    await expect(card.locator("li")).toHaveCount(2);
    await expect(card.locator("li").first()).toContainText("¿Ha llegado");
    await expect(card.locator("li").first()).toContainText("5 días de retraso");
    await expect(card.locator("li").nth(1)).toContainText("no ha llegado");
    await expect(card.locator("li").nth(1)).toContainText("Últimos cargos");
    // La demo no importa extractos: sin ellos, un cargo NO se pregunta (no aparece ≠ no lo he importado).
    const silent = await page.evaluate(() => { const real = globalThis.FinanceCanonicalExpectedMovements; return real.detect({ today: isoLocalDate(new Date()), ledgerCoveredUntil: null, expectations: [{ id: "x", kind: "expense", expectedDate: "2020-01-01", certain: true }] }).items.length; });
    expect(silent).toBe(0);

    const realized = () => page.evaluate(() => { const month = monthByKey(window.__esperados.key); const info = actualAwareInfo(rowForSeriesKey(window.__esperados.incomeKey), month); return { has: info.hasActual, actual: info.actual }; });
    // «Sí, por el importe previsto»: registra el real; el aviso de deshacer lo revierte.
    expect((await realized()).has).toBe(false);
    await card.locator('[data-expected-response="yes"]').click();
    await expect.poll(async () => (await realized()).has).toBe(true);
    expect((await realized()).actual).toBe(3000);
    await expect(card.locator("li")).toHaveCount(1);
    await page.getByRole("button", { name: "Deshacer" }).click();
    await expect.poll(async () => (await realized()).has).toBe(false);
    await injectExpected(page);
    await expect(card.locator("li")).toHaveCount(2);

    // «Sí, otro importe»: pide el importe (con coma española) y lo registra.
    await card.locator('[data-expected-response="yesOther"]').click();
    const input = card.locator("[data-expected-amount]");
    await expect(input).toBeFocused();
    await input.fill("2.950,50");
    await input.press("Enter");
    await expect.poll(async () => (await realized()).actual).toBe(2950.5);
    await page.getByRole("button", { name: "Deshacer" }).click();
    await expect.poll(async () => (await realized()).has).toBe(false);
    await injectExpected(page);

    // «Aún no»: la pregunta desaparece, y tras recargar sigue callada (el almacén persiste).
    await card.locator('[data-expected-response="notYet"]').click();
    await expect(card.locator("li")).toHaveCount(1);
    await page.reload();
    await page.waitForFunction(() => typeof monthByKey === "function" && monthByKey(isoLocalDate(new Date()).slice(0, 7)));
    await injectExpected(page);
    await expect(card.locator("li")).toHaveCount(1);
    await expect(card.locator("li").first()).toContainText("no ha llegado");

    // «Se ha dado de baja»: el mes y los siguientes dejan de contar; deshacer los devuelve.
    const eliminated = () => page.evaluate(() => { const months = selectableMonths().slice(0, 3); const row = rowForSeriesKey(window.__esperados.expKey); return months.map((month) => actualAwareInfo(row, month).source === "Eliminado"); });
    expect((await eliminated()).some(Boolean)).toBe(false);
    await card.locator('[data-expected-response="cancelled"]').click();
    await expect.poll(async () => (await eliminated()).every(Boolean)).toBe(true);
    await page.getByRole("button", { name: "Deshacer" }).click();
    await expect.poll(async () => (await eliminated()).some(Boolean)).toBe(false);
    expect(pageErrors, `errores de página: ${pageErrors.join(" | ")}`).toEqual([]);
  });

  // PR-2: lo aplazado cuenta en la previsión en el día en que se vuelve a preguntar. Sobre una fila REAL de la demo con día de cargo declarado
  // (fecha cierta) y la ejecución diaria REAL: la fecha del evento se mueve, vuelve al deshacer y sobrevive a recargar. Es también la prueba de que
  // la ejecución diaria guardada se recalcula cuando solo cambia la fecha de un gasto (antes la huella mensual no lo veía).
  test("«Llegará tarde» mueve el cargo en la previsión diaria hasta el día en que se vuelve a preguntar; deshacer lo devuelve y recargar lo conserva", async ({ page }) => {
    const pageErrors = [];
    page.on("pageerror", (error) => pageErrors.push(String(error)));
    await page.clock.install({ time: new Date(2026, 9, 20, 9, 0, 0) });
    await page.setViewportSize({ width: 390, height: 900 });
    await page.goto("/index.html#home");
    await page.reload();
    await expect(page.locator("#homeDecisionInboxCard")).toBeAttached({ timeout: 15000 });
    await page.waitForFunction(() => typeof monthByKey === "function" && monthByKey("2026-10"));
    const prepare = () => page.evaluate(() => {
      const month = monthByKey("2026-10");
      const row = planningSectionsForMonth("expense", month).filter((section) => section.name !== VARIABLE_OPERATIONAL_SECTION).flatMap((section) => section.rows).find((candidate) => !isEndOfMonthExpenseRow(candidate));
      localStorage.removeItem(storageKey("expected-answers"));
      saveChargeDays([[seriesKeyForRow(row), "3", "declarado"]], "e2e"); // el día 3: cierto y vencido el 20/10 (ventana 1 + margen 3)
      expectedLedgerCoveredUntil = () => "2026-10-20"; // la demo no importa extractos
      renderDecisionInboxCard();
      return displayLabelForRow(row);
    });
    const label = await prepare();
    const dateOf = () => page.evaluate((text) => {
      const events = (canonicalDailyEngineRuns.active?.rows || []).flatMap((row) => row.events || []);
      return events.filter((event) => event.kind === "outflow" && event.label === text && event.date.startsWith("2026-10")).map((event) => event.date);
    }, label);
    const card = page.locator("#homeDecisionInboxCard");
    const question = card.locator("li", { hasText: `«${label}» no ha llegado` });
    await expect(question).toBeVisible();
    await expect.poll(dateOf).toEqual(["2026-10-03"]);

    await question.locator('[data-expected-response="late"]').click();
    await expect(question).toBeHidden(); // sin más preguntas la tarjeta se oculta
    await expect.poll(dateOf, { message: "el cargo aplazado cuenta el 23/10 (20/10 + 3 días)" }).toEqual(["2026-10-23"]);
    await page.getByRole("button", { name: "Deshacer" }).click();
    await expect.poll(dateOf, { message: "deshacer devuelve el cargo a su día" }).toEqual(["2026-10-03"]);
    await expect(question).toBeVisible();

    await question.locator('[data-expected-response="late"]').click();
    await expect.poll(dateOf).toEqual(["2026-10-23"]);
    await page.reload();
    await page.waitForFunction(() => typeof monthByKey === "function" && monthByKey("2026-10"));
    await expect.poll(dateOf, { message: "el aplazamiento sobrevive a recargar" }).toEqual(["2026-10-23"]);
    expect(pageErrors, `errores de página: ${pageErrors.join(" | ")}`).toEqual([]);
  });
});


// WP-13 · PR-1: índices de referencia tecleados con fecha (Deuda › Contratos): guardar, rechazar una coma de más, caducar, recordar tras recargar y quitar.
test.describe("WP-13 · índices de referencia con fecha y caducidad", () => {
  test("guardar, rechazar 23,5, caducar un dato viejo, recordarlo tras recargar y quitarlo, sin desbordar en móvil", async ({ page }) => {
    const pageErrors = [];
    page.on("pageerror", (error) => pageErrors.push(String(error)));
    for (const viewport of [{ width: 1280, height: 900 }, { width: 390, height: 844 }]) {
      await page.setViewportSize(viewport);
      await page.goto("/index.html#deuda-contratos");
      await page.reload();
      await page.evaluate(() => { try { localStorage.clear(); } catch { /* sin almacenamiento */ } });
      await page.reload();
      const card = page.locator("#indicesCard");
      await expect(card.locator("[data-indices-index]")).toHaveCount(3, { timeout: 15000 });
      await expect(card).toContainText("No consulta ninguna fuente externa");
      const row = (id) => card.locator(`[data-indices-index="${id}"]`);
      for (const id of ["euribor12m", "estr", "ipc"]) await expect(row(id)).toContainText("Sin dato");
      const daysAgo = (days) => page.evaluate((n) => isoLocalDate(new Date(Date.now() - n * 86400000)), days);

      // Un valor con la coma de más se rechaza y no se guarda nada.
      await row("euribor12m").locator("[data-indices-valor]").fill("23,5");
      await row("euribor12m").locator("[data-indices-guardar]").click();
      await expect(card.locator("#indicesNota")).toContainText("fuera de lo razonable");
      await expect(row("euribor12m").locator("[data-indices-valor]")).toHaveAttribute("aria-invalid", "true");
      await expect(row("euribor12m")).toContainText("Sin dato");

      // Lo que se está escribiendo en otra fila sobrevive a los repintados que provoca guardar las demás.
      await row("ipc").locator("[data-indices-valor]").fill("3,1");

      // Uno de hace 3 días está vigente; uno de €STR de hace 15 días, caducado.
      await row("euribor12m").locator("[data-indices-valor]").fill("2,35");
      await row("euribor12m").locator("[data-indices-fecha]").fill(await daysAgo(3));
      await row("euribor12m").locator("[data-indices-guardar]").click();
      await expect(row("euribor12m")).toContainText("Vigente");
      await expect(row("euribor12m")).toContainText("2,35 %");
      await row("estr").locator("[data-indices-valor]").fill("1.9");
      await row("estr").locator("[data-indices-fecha]").fill(await daysAgo(15));
      await row("estr").locator("[data-indices-guardar]").click();
      await expect(row("estr")).toContainText("Caducado");
      await expect(row("estr")).toContainText("hace 15 días");
      await expect(row("ipc")).toContainText("Sin dato");
      await expect(row("ipc").locator("[data-indices-valor]"), "el texto a medio escribir en IPC no se pierde").toHaveValue("3,1");

      // Se recuerdan tras recargar; «Quitar» devuelve el índice a «Sin dato».
      await page.reload();
      await expect(row("euribor12m")).toContainText("Vigente", { timeout: 15000 });
      await expect(row("estr")).toContainText("Caducado");
      await row("estr").locator("summary").click();
      await row("estr").locator("[data-indices-quitar]").first().click();
      await expect(row("estr")).toContainText("Sin dato");
      await expect(card.locator("#indicesNota")).toContainText("Quitado el dato");
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), `sin desbordar en ${viewport.width} px`).toBe(true);
    }
    expect(pageErrors, `errores de página: ${pageErrors.join(" | ")}`).toEqual([]);
  });
});

// WP-20: revisión del tipo variable de la hipoteca (Deuda › Contratos). Lee la hipoteca ya declarada y el Euribor de la tarjeta de índices; los
// datos de la revisión son inventados (los reales los introduce el hogar y no van al repositorio).
test.describe("WP-20 · revisión del tipo variable de la hipoteca", () => {
  const addMortgage = async (page) => {
    await page.fill("#deudaContratosAddEntity", "Banco Ejemplo");
    await page.selectOption("#deudaContratosAddType", "Hipoteca");
    await page.fill("#deudaContratosAddPrincipal", "120000");
    await page.fill("#deudaContratosAddPayment", "680");
    await page.fill("#deudaContratosAddInstallments", "240");
    await page.locator('#deudaContratosAddForm button[type="submit"]').click();
  };
  const inDays = (page, days) => page.evaluate((n) => isoLocalDate(new Date(Date.now() + n * 86400000)), days);

  test("sin hipoteca avisa y enseña el ejemplo marcado; con ella calcula, valida, recuerda, y avisa en Hoy solo dentro de los 60 días", async ({ page }) => {
    test.setTimeout(90000); // dos tamaños de pantalla y varios guardados, como la prueba de la cartera
    const pageErrors = [];
    page.on("pageerror", (error) => pageErrors.push(String(error)));
    for (const viewport of [{ width: 1280, height: 900 }, { width: 390, height: 844 }]) {
      await page.setViewportSize(viewport);
      await page.goto("/index.html#deuda-contratos");
      await page.reload();
      await page.evaluate(() => { try { localStorage.clear(); } catch { /* sin almacenamiento */ } });
      await page.reload();
      const card = page.locator("#revisionTipoCard");
      await expect(card).toBeVisible({ timeout: 15000 });

      // Sin hipoteca: lo dice, no enseña formulario, y el ejemplo está marcado como tal.
      await expect(card.locator("#revisionTipoContratoInfo")).toContainText("No hay ninguna hipoteca activa");
      await expect(card.locator("#revisionTipoForm")).toBeHidden();
      await card.locator("#revisionTipoEjemplo summary").click();
      await expect(card.locator("#revisionTipoEjemplo")).toContainText("EJEMPLO · cifras inventadas, no son las tuyas");
      await expect(card.locator("#revisionTipoEjemplo")).toContainText("Cuota estimada: de");

      // Alta de la hipoteca (se lee de aquí: no se escribe dos veces).
      await addMortgage(page);
      await expect(card.locator("#revisionTipoContratoInfo")).toContainText("Banco Ejemplo", { timeout: 15000 });
      await expect(card.locator("#revisionTipoContratoInfo")).toContainText("240 plazos restantes");
      await expect(card.locator("#revisionTipoForm")).toBeVisible();
      await expect(card.locator("#revisionTipoResultado")).toContainText("Rellena los datos");

      // Sin Euribor tecleado no se calcula y dice qué falta.
      await page.fill("#revisionTipoSpread", "0,99");
      await page.fill("#revisionTipoDate", await inDays(page, 150));
      await card.locator("#revisionTipoGuardar").click();
      await expect(card.locator("#revisionTipoResultado")).toContainText("el valor del Euribor (tarjeta de índices)");

      // Datos mal tecleados: se rechazan, se dice cuál y no se guardan.
      await page.fill("#revisionTipoSpread", "abc");
      await card.locator("#revisionTipoGuardar").click();
      await expect(card.locator("#revisionTipoNota")).toContainText("El diferencial va en %");
      await expect(page.locator("#revisionTipoSpread")).toHaveAttribute("aria-invalid", "true");
      await page.fill("#revisionTipoSpread", "0,99");
      await page.fill("#revisionTipoLag", "9");
      await card.locator("#revisionTipoGuardar").click();
      await expect(card.locator("#revisionTipoNota")).toContainText("Los meses antes van de 1 a 3");
      await page.fill("#revisionTipoLag", "1");

      // Con Euribor tecleado, calcula; la cuota mostrada es la del motor.
      await page.fill('[data-indices-index="euribor12m"] [data-indices-valor]', "2,35");
      await page.locator('[data-indices-index="euribor12m"] [data-indices-guardar]').click();
      await page.fill("#revisionTipoBonus", "0,30");
      await page.fill("#revisionTipoRate", "3,10");
      await card.locator("#revisionTipoGuardar").click();
      const result = card.locator("#revisionTipoResultado");
      await expect(result).toContainText("Próxima revisión:");
      await expect(result).toContainText("la media mensual del Euribor de");
      await expect(result).toContainText("Si pierdes la bonificación");
      await expect(result).toContainText("estimación, no un pronóstico");
      const expected = await page.evaluate(() => {
        const mortgage = revisionMortgages(isoLocalDate(new Date()))[0];
        const settings = revisionLoad().byContract[mortgage.id];
        const r = revisionEvaluate(FinanceCanonicalRateReview, mortgage, settings, isoLocalDate(new Date()));
        return { text: `de ${money(r.payment.low, true)} a ${money(r.payment.high, true)}`, central: r.centralRate };
      });
      await expect(result).toContainText(expected.text);
      expect(expected.central).toBe(3.34);

      // Se recuerda tras recargar, sin pisar lo escrito en otros campos.
      await page.reload();
      await expect(page.locator("#revisionTipoSpread")).toHaveValue("0,99", { timeout: 15000 });
      await expect(page.locator("#revisionTipoRate")).toHaveValue("3,1");
      await expect(card.locator("#revisionTipoResultado")).toContainText("Próxima revisión:");

      // Fuera de los 60 días, Hoy no cambia; dentro, aparece la pregunta con su cuota.
      await page.evaluate(() => { location.hash = "#home"; });
      await expect(page.locator("#home")).toBeVisible();
      await expect(page.locator("#homeDecisionInboxList")).not.toContainText("Revisión del tipo", { timeout: 5000 });
      await page.evaluate(() => { location.hash = "#deuda-contratos"; });
      await page.fill("#revisionTipoDate", await inDays(page, 45));
      await card.locator("#revisionTipoGuardar").click();
      await expect(result).toContainText("aviso activo");
      await page.evaluate(() => { location.hash = "#home"; });
      await expect(page.locator("#homeDecisionInboxList")).toContainText("Hipoteca variable: Revisión del tipo en 45 días", { timeout: 15000 });
      await expect(page.locator("#homeDecisionInboxList")).toContainText("Cuota estimada de");
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), `sin desbordar en ${viewport.width} px`).toBe(true);
    }
    expect(pageErrors, `errores de página: ${pageErrors.join(" | ")}`).toEqual([]);
  });
});

// WP-20 (PR-2): los avisos de la revisión del tipo llegan al .ics de recordatorios, con la cuota solo en el detalle.
test.describe("WP-20 · avisos de la revisión en el calendario del móvil", () => {
  test("una revisión a 45 días genera su aviso de 30 días en el .ics, sin importes en el título y con la cuota en el detalle", async ({ page }) => {
    test.setTimeout(90000);
    const pageErrors = [];
    page.on("pageerror", (error) => pageErrors.push(String(error)));
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/index.html#deuda-contratos");
    await page.reload();
    await page.evaluate(() => { try { localStorage.clear(); } catch { /* sin almacenamiento */ } });
    await page.reload();
    await expect(page.locator("#revisionTipoCard")).toBeVisible({ timeout: 15000 });
    await page.fill("#deudaContratosAddEntity", "Banco Ejemplo");
    await page.selectOption("#deudaContratosAddType", "Hipoteca");
    await page.fill("#deudaContratosAddPrincipal", "120000");
    await page.fill("#deudaContratosAddPayment", "680");
    await page.fill("#deudaContratosAddInstallments", "240");
    await page.locator('#deudaContratosAddForm button[type="submit"]').click();
    await expect(page.locator("#revisionTipoForm")).toBeVisible({ timeout: 15000 });
    await page.fill('[data-indices-index="euribor12m"] [data-indices-valor]', "2,35");
    await page.locator('[data-indices-index="euribor12m"] [data-indices-guardar]').click();
    await page.fill("#revisionTipoSpread", "0,99");
    await page.fill("#revisionTipoRate", "3,10");
    await page.fill("#revisionTipoDate", await page.evaluate(() => isoLocalDate(new Date(Date.now() + 45 * 86400000))));
    await page.locator("#revisionTipoGuardar").click();
    await expect(page.locator("#revisionTipoResultado")).toContainText("Próxima revisión:");
    const expected = await page.evaluate(() => {
      const mortgage = revisionMortgages(isoLocalDate(new Date()))[0];
      const r = revisionEvaluate(FinanceCanonicalRateReview, mortgage, revisionLoad().byContract[mortgage.id], isoLocalDate(new Date()));
      return `${money(r.payment.low, true).replace(/ /g, " ")}`;
    });

    await page.evaluate(() => { location.hash = "#ajustes"; });
    const card = page.locator("#recordatoriosCard");
    await expect(card.locator("#recordatoriosResumen")).toContainText("avisos de la hipoteca", { timeout: 15000 });
    await expect(card.locator('[data-recordatorios-kind="rateReview"]')).toBeChecked();
    const [download] = await Promise.all([page.waitForEvent("download"), card.locator("#recordatoriosDescargar").click()]);
    const text = await new Promise((resolve, reject) => { const chunks = []; download.createReadStream().then((stream) => { stream.on("data", (chunk) => chunks.push(chunk)); stream.on("end", () => resolve(Buffer.concat(chunks).toString("utf8"))); stream.on("error", reject); }, reject); });
    const unfolded = text.replace(/\r\n /g, "");
    const titles = [...unfolded.matchAll(/^SUMMARY:(.*)$/gm)].map((match) => match[1]);
    expect(titles).toContain("Revisión del tipo de la hipoteca en 30 días");
    titles.forEach((title) => expect(title, `el título «${title}» enseña un importe`).not.toMatch(/€|\d{3}/));
    const detail = unfolded.split("BEGIN:VEVENT").find((chunk) => chunk.includes("Revisión del tipo de la hipoteca en 30 días")) || "";
    expect(detail).toContain("Cuota estimada de");
    expect(detail.replace(/\\,/g, ",")).toContain(expected.replace(/ /g, " ").replace(/\s/g, " "));
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    expect(pageErrors, `errores de página: ${pageErrors.join(" | ")}`).toEqual([]);
  });
});
