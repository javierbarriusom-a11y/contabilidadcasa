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

// Desde el 19/10/2026 el tema v2 es el de por defecto: su Hoy enseña «+ Apuntar gasto», que abre lo mismo que
// «+ Registrar gasto» de la Hoy de siempre (oculta mientras no se pida el detalle). Se pulsa el que esté a la vista,
// así el flujo se prueba tal como lo usa el hogar en cualquiera de los dos temas.
// Rediseño A4 (PR-2): con el tema v2, Registrar › Importar extracto enseña Importar v2 y el asistente de cuatro pasos
// queda tras «Ver el asistente de siempre». Las pruebas que recorren ese asistente lo abren antes, como haría el hogar.
async function abrirAsistenteDeSiempre(page) {
  const boton = page.locator("#importarV2 [data-imp-v2-clasico]");
  await boton.or(page.locator("#registrarImportSteps")).first().waitFor({ timeout: 15000 });
  if ((await boton.isVisible()) && (await boton.getAttribute("aria-expanded")) !== "true") await boton.click();
}

async function abrirApuntarGasto(page) {
  const v2 = page.locator("#hoyV2 [data-hoy-v2-expense]");
  if (await v2.isVisible()) {
    await expect(v2).toBeEnabled();
    await v2.click();
  } else {
    await page.click("#homeQuickExpenseOpen");
  }
}

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
    await expect(row.locator("td").nth(5)).toContainText("150 €"); // A2: sin céntimos cuando no los hay

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
    // Al arrancar, la propia app escribe almacenes sincronizables (p. ej. liquidity-backtest) y su sincronización sale 900 ms después.
    // Si esa salida caía ya con el contador puesto, se contaban 2 envíos en vez de 1 (fallo intermitente en el CI del 17/10/2026).
    // Se espera a que la app lleve más que ese retardo sin escribir nada antes de empezar a contar.
    await page.addInitScript(() => {
      window.__qa1LastStoreWrite = performance.now();
      const setItem = Storage.prototype.setItem;
      Storage.prototype.setItem = function (...args) { window.__qa1LastStoreWrite = performance.now(); return setItem.apply(this, args); };
    });
    await page.goto("/index.html#home");
    await page.waitForLoadState("networkidle");
    await page.waitForFunction(() => performance.now() - window.__qa1LastStoreWrite > 1200, null, { timeout: 15000 });
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
      await abrirAsistenteDeSiempre(page);
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
      await expect(page.locator("#registrarImportPanel")).toContainText("Saldo de CaixaBank: 970 € a 02/10/2026.");
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

  // Si una de estas pruebas falla, el registro del CI solo decía su nombre. Ahora deja también el estado de la página en ese instante
  // (foto, cierres, modo de saldos, visibilidad), que es lo que hace falta para saber por qué.
  test.afterEach(async ({ page }, testInfo) => {
    if (testInfo.status === testInfo.expectedStatus) return;
    const snapshot = await page.evaluate(() => ({
      photo: JSON.parse(localStorage.getItem(storageKey("liquidity-backtest")) || "null"),
      closes: JSON.parse(localStorage.getItem(storageKey("month-close-balances")) || "null"),
      balanceMode: state?.balanceMode, balanceDate: state?.balanceDate, hidden: document.hidden, now: new Date().toISOString(),
    })).catch((error) => ({ sinEstado: String(error) }));
    const text = JSON.stringify(snapshot, null, 2);
    await testInfo.attach("estado-al-fallar", { body: text, contentType: "application/json" });
    console.log(`WP-12 · estado de la página al fallar «${testInfo.title}»:\n${text}`);
  });

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
    // La espera es larga a propósito: en un runner lento la app tarda en abrir, y si va bien no cuesta nada.
    await expect.poll(async () => Object.keys((await photo(page))?.freezes || {}), { timeout: 20000, message: "la foto del día 15 se guarda sola al abrir" }).toEqual(["2026-10:d15"]);
    // Saldos del banco, como los deja el Pulso de saldos; se rehace la foto del día 15 con ellos (la anterior era de saldos calculados).
    // TODO en una sola tarea de la página: si se hiciera en pasos sueltos, entre ellos podría colarse la foto automática que la app
    // repite al volver a ser visible (liquidity-backtest-ui.js), con los saldos viejos, y `freezeLiquidityForecast()` devolvería null.
    // La foto se lee del almacén, que es lo que de verdad compara el motor, no del valor devuelto.
    const frozen = await page.evaluate(() => {
      localStorage.removeItem(storageKey("liquidity-backtest"));
      qs("registrarBalanceMode").value = "manual"; // como el botón «Real manual» del Pulso de saldos
      qs("registrarBalanceMode").dispatchEvent(new Event("change", { bubbles: true }));
      state.balanceDate = "2026-10-14";
      ["balanceDate", "registrarBalanceDate"].forEach((id) => { qs(id).value = "2026-10-14"; });
      saveBalanceSettings();
      render();
      freezeLiquidityForecast();
      return JSON.parse(localStorage.getItem(storageKey("liquidity-backtest")) || "null")?.freezes?.["2026-10:d15"] ?? null;
    });
    expect(frozen, "tras pasar a saldos manuales la foto del día 15 debe quedar guardada").not.toBeNull();
    expect(frozen.balanceMode).toBe("manual");
    expect(frozen.balanceDate).toBe("2026-10-14");
    // Cierre real de octubre con saldos del 31/10 (mismo formato que escribe WP-09), y lo que quedó guardado, en la misma tarea.
    const expected = await page.evaluate(() => {
      state.balanceDate = "2026-10-31";
      recordMonthCloseBalances("2026-10", "2026-11-01T09:00:00.000Z");
      const close = loadMonthCloseBalances().months["2026-10"];
      return close ? { actual: Math.round((close.accounts.caixabank + close.accounts.mediolanum) * 100) / 100, date: close.date } : null;
    });
    expect(expected, "el cierre de octubre con sus saldos debe quedar guardado").not.toBeNull();
    expect(expected.date).toBe("2026-10-31");
    await page.click("#previsionBacktestCard > summary");
    await page.evaluate(() => render());
    await expect(page.locator("#previsionBacktestResumen")).toContainText("datos insuficientes (1 de 3 cierres)", { timeout: 15000 });
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
    await abrirApuntarGasto(page);
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
    await abrirApuntarGasto(page);
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
    await abrirApuntarGasto(page);
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
      await abrirApuntarGasto(page);
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

// WP-23 PR-2: «Tus datos fiscales». Cifras FICTICIAS (el repositorio es público): lo tecleado sustituye al ejemplo, un campo vacío no es un 0, una cifra mala no se guarda,
// quitar los datos se puede deshacer y el almacén viaja en la copia.
test.describe("WP-23 PR-2 · tus datos fiscales", () => {
  test("lo tecleado sustituye al ejemplo; vacío no es 0; una cifra mala no se guarda; persiste, viaja en la copia y quitar se deshace", async ({ page }) => {
    const pageErrors = [];
    page.on("pageerror", (error) => pageErrors.push(String(error)));
    await page.clock.install({ time: new Date(2026, 9, 20, 12, 0, 0) });
    await page.goto("/index.html#herramientas-fiscal");
    const card = page.locator("#campanaFiscalCard");
    const accion = (titulo) => card.locator(".fc-accion", { hasText: titulo });
    await expect(card).toHaveAttribute("data-ejemplo", "true");
    const form = page.locator("#fiscalDatosForm");
    await expect(page.locator("#fiscalDatosDetails")).toHaveJSProperty("open", true);
    await expect(form).toContainText("Todavía no has guardado ningún dato");

    // 1 · Sin ningún dato no se guarda nada y se dice.
    await form.getByRole("button", { name: "Guardar mis datos" }).click();
    await expect(page.locator("#fiscalDatosError")).toContainText("No has escrito ninguna cifra");
    expect(await page.evaluate(() => storageGet(storageKey("fiscal-data"), "")), "no se guardó nada").toBe("");
    await expect(card).toHaveAttribute("data-ejemplo", "true");

    // 2 · Datos de un declarante: solo algunos campos. Los demás, vacíos.
    await page.fill("#fiscalDatos-0-label", "Ana");
    await page.fill("#fiscalDatos-0-annualGross", "40.000");
    await page.fill("#fiscalDatos-0-marginalRatePct", "30");
    await page.fill("#fiscalDatos-0-pensionContributed", "0");
    await page.selectOption("#fiscalDatos-0-hasEmployerPlan", "no");
    await page.selectOption("#fiscalDatos-0-housingApplies", "si");
    await page.fill("#fiscalDatos-0-housingPaid", "6.000");
    await form.getByRole("button", { name: "Guardar mis datos" }).click();
    await expect(card).toHaveAttribute("data-ejemplo", "false");
    await expect(card.locator(".fc-aviso-real")).toContainText("Con tus datos. Declarante: Ana");
    await expect(card.locator(".fc-etiqueta-ejemplo")).toBeHidden();
    await expect(card.locator(".fc-cifra-ejemplo")).toHaveCount(0);
    await expect(card).not.toContainText("Cifras de ejemplo");
    // (1.500 − 0) × 30 % = 450 y (9.040 − 6.000) × 15 % = 456; el total es la suma de lo calculado.
    await expect(accion("Aportar al plan de pensiones")).toContainText("450");
    await expect(accion("Llenar el tope de la deducción por vivienda")).toContainText("456");
    await expect(card.locator(".fc-total")).toContainText("906");
    // Lo que no se rellenó NO es un 0: sale sin calcular y dice qué falta (no «no aplica»).
    for (const titulo of ["Compensar plusvalías con minusvalías", "Donativos deducibles", "Ajustar la retención"]) {
      await expect(accion(titulo)).toContainText("Sin calcular");
      await expect(accion(titulo)).not.toContainText("No aplica");
    }
    await expect(accion("Donativos deducibles")).toContainText("los donativos de este año");
    await expect(page.locator("#fiscalDatosEstado")).toContainText("Datos guardados el 20/10/2026");

    // 3 · Persiste al recargar: plegado, con las cifras formateadas.
    await page.reload();
    await expect(card).toHaveAttribute("data-ejemplo", "false");
    await expect(page.locator("#fiscalDatosDetails")).toHaveJSProperty("open", false);
    await page.locator("#fiscalDatosDetails summary").click();
    await expect(page.locator("#fiscalDatos-0-annualGross")).toHaveValue("40.000,00");
    await expect(page.locator("#fiscalDatos-0-marginalRatePct")).toHaveValue("30");
    await expect(page.locator("#fiscalDatos-0-hasEmployerPlan")).toHaveValue("no");
    await expect(page.locator("#fiscalDatos-1-annualGross")).toHaveValue("");

    // 4 · Una cifra mala no se guarda ni se corrige en silencio.
    await page.fill("#fiscalDatos-0-marginalRatePct", "300");
    await page.fill("#fiscalDatos-0-donationsAmount", "abc");
    await form.getByRole("button", { name: "Guardar mis datos" }).click();
    const errores = page.locator("#fiscalDatosError");
    await expect(errores).toBeVisible();
    await expect(errores).toContainText("No se ha guardado nada");
    await expect(errores).toContainText("El tipo marginal de IRPF tiene que estar entre 0 % y 60 %");
    await expect(errores).toContainText("No entiendo los donativos del año");
    await expect(page.locator("#fiscalDatos-0-marginalRatePct")).toHaveAttribute("aria-invalid", "true");
    await expect(page.locator("#fiscalDatos-0-marginalRatePct-fallo")).toContainText("entre 0 % y 60 %");
    await expect(page.locator("#fiscalDatos-0-donationsAmount-error"), "el texto que no es un número lo explica el lector de importes, una sola vez").toHaveCount(1);
    await expect(page.locator("#fiscalDatos-0-marginalRatePct")).toBeFocused();
    expect(await page.evaluate(() => JSON.parse(storageGet(storageKey("fiscal-data"), "{}")).holders[0].marginalRatePct), "lo guardado sigue siendo 30").toBe(30);
    // Corregido, se guarda y los errores desaparecen; un 0 escrito en donativos SÍ es un dato (no aplica).
    await page.fill("#fiscalDatos-0-marginalRatePct", "30");
    await page.fill("#fiscalDatos-0-donationsAmount", "0");
    await form.getByRole("button", { name: "Guardar mis datos" }).click();
    await expect(page.locator("#fiscalDatosError")).toBeHidden();
    await expect(accion("Donativos deducibles")).toContainText("No aplica");

    // 5 · El almacén es el de la copia y no lleva nada del ejemplo.
    const stored = await page.evaluate(() => ({ raw: storageGet(storageKey("fiscal-data"), ""), copia: appStatePayload().localStores["fiscal-data"] }));
    expect(stored.copia, "viaja en la copia").toBe(stored.raw);
    expect(stored.raw).not.toContain("Persona A");
    expect(JSON.parse(stored.raw).holders).toHaveLength(1);
    expect(JSON.parse(stored.raw).year).toBe(2026);

    // 6 · Quitar se puede deshacer, sin diálogos del navegador.
    page.on("dialog", (dialog) => { throw new Error(`diálogo inesperado: ${dialog.message()}`); });
    await form.getByRole("button", { name: "Quitar mis datos y volver al ejemplo" }).click();
    await expect(card).toHaveAttribute("data-ejemplo", "true");
    await expect(page.locator("#fiscalDatos-0-annualGross")).toHaveValue("");
    await expect(page.locator("#undoToastMessage")).toContainText("Datos fiscales quitados");
    await page.locator("#undoToastButton").click();
    await expect(card).toHaveAttribute("data-ejemplo", "false");
    await expect(accion("Aportar al plan de pensiones")).toContainText("450");
    expect(pageErrors, `errores de página: ${pageErrors.join(" | ")}`).toEqual([]);
  });

  test("«Rellenar mis datos» abre el formulario y lleva al primer campo vacío; no desborda en móvil con datos y con errores", async ({ page }) => {
    const pageErrors = [];
    page.on("pageerror", (error) => pageErrors.push(String(error)));
    await page.clock.install({ time: new Date(2026, 9, 20, 12, 0, 0) });
    for (const viewport of [{ width: 1280, height: 800 }, { width: 390, height: 844 }]) {
      await page.setViewportSize(viewport);
      await page.goto("/index.html#herramientas-fiscal");
      await page.evaluate(() => { storageSet(storageKey("fiscal-data"), JSON.stringify({ schemaId: "finance-wp23-fiscal-data/v1", year: 2026, updatedAt: "2026-10-19", holders: [{ id: "persona-1", label: "Ana", marginalRatePct: 30, pension: { hasEmployerPlan: false } }] })); });
      await page.reload();
      const card = page.locator("#campanaFiscalCard");
      await expect(card.locator(".fc-aviso-real")).toBeVisible();
      await expect(page.locator("#fiscalDatosDetails")).toHaveJSProperty("open", false);
      await card.locator(".fc-accion", { hasText: "Aportar al plan de pensiones" }).locator("[data-fiscal-abrir]").click();
      await expect(page.locator("#fiscalDatosDetails")).toHaveJSProperty("open", true);
      await expect(page.locator("#fiscalDatos-0-annualGross"), "el primer campo vacío").toBeFocused();
      await page.fill("#fiscalDatos-0-marginalRatePct", "999");
      await page.getByRole("button", { name: "Guardar mis datos" }).click();
      await expect(page.locator("#fiscalDatosError")).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), `sin desbordar en ${viewport.width} px`).toBe(true);
    }
    expect(pageErrors, `errores de página: ${pageErrors.join(" | ")}`).toEqual([]);
  });
});

// WP-23 PR-3: «Hecho» por tarea y declarante, y el calendario del móvil. Cifras FICTICIAS: marcar guarda en el almacén de la copia, persiste, se quita con «Deshacer», el
// ejemplo no se puede marcar y el aviso del 20/12 se calla solo cuando TODAS las tareas con ahorro están marcadas (no cuando no hay tareas).
test.describe("WP-23 PR-3 · hecho y calendario", () => {
  const datos = { schemaId: "finance-wp23-fiscal-data/v1", year: 2026, updatedAt: "2026-11-19", holders: [
    { id: "persona-1", label: "Ana", marginalRatePct: 30, pension: { contributedYear: 0, hasEmployerPlan: false }, housing: { applies: true, paidYear: 6000 }, donations: { amountYear: 300 } },
    { id: "persona-2", label: "Luis", marginalRatePct: 24, pension: { contributedYear: 1500, hasEmployerPlan: false }, housing: { applies: true, paidYear: 9040 }, donations: { amountYear: 0 } },
  ] };

  test("el ejemplo no tiene botones; con datos se marca, persiste, viaja en la copia, se quita con Deshacer y el calendario lo sabe", async ({ page }) => {
    const pageErrors = [];
    page.on("pageerror", (error) => pageErrors.push(String(error)));
    await page.clock.install({ time: new Date(2026, 10, 20, 12, 0, 0) });
    await page.goto("/index.html#herramientas-fiscal");
    const card = page.locator("#campanaFiscalCard");
    await expect(card).toHaveAttribute("data-ejemplo", "true");
    await expect(card.locator("[data-fiscal-hecho]"), "el ejemplo no se marca").toHaveCount(0);
    await expect(card.locator(".fc-progreso")).toHaveCount(0);

    await page.evaluate((value) => { storageSet(storageKey("fiscal-data"), JSON.stringify(value)); }, datos);
    await page.reload();
    await expect(card).toHaveAttribute("data-ejemplo", "false");
    await expect(card.locator("[data-fiscal-hecho]"), "pensiones, vivienda y donativos de Ana; Luis no tiene nada que hacer").toHaveCount(3);
    await expect(card.locator(".fc-progreso")).toContainText("Hecho: 0 de 3 tareas.");
    await expect(card.locator(".fc-progreso")).toContainText("la app no comprueba que se hiciera");

    // El calendario, con tareas pendientes: lo dice, y el título no lleva cifras.
    const antes = await page.evaluate(() => recordatoriosPlan().result.events.filter((event) => event.kind === "fiscal").map((event) => ({ date: event.date, title: event.title, description: event.description })));
    expect(antes.map((event) => event.date)).toEqual(["2026-12-01", "2026-12-20"]);
    expect(antes[1].description).toContain("quedaban 3 tareas sin marcar como hechas");
    antes.forEach((event) => expect(event.title).not.toMatch(/\d/));

    // Marcar una.
    await card.getByRole("button", { name: "Marcar como hecho: Ana, Aportar al plan de pensiones" }).click();
    await expect(card.locator(".fc-progreso")).toContainText("Hecho: 1 de 3 tareas.");
    await expect(card.locator(".fc-accion", { hasText: "Aportar al plan de pensiones" })).toContainText("hecho (marcado el 20/11/2026)");
    await expect(card.locator(".fc-accion", { hasText: "Aportar al plan de pensiones" }).locator(".e19-pill", { hasText: "Hecha" })).toBeVisible();
    const guardado = await page.evaluate(() => ({ raw: storageGet(storageKey("fiscal-done"), ""), copia: appStatePayload().localStores["fiscal-done"] }));
    expect(JSON.parse(guardado.raw).marks).toEqual({ "pensiones|persona-1": { at: "2026-11-20" } });
    expect(guardado.copia, "viaja en la copia").toBe(guardado.raw);

    // Persiste al recargar.
    await page.reload();
    await expect(card.locator(".fc-progreso")).toContainText("Hecho: 1 de 3 tareas.");

    // Quitar la marca se puede deshacer, sin diálogos del navegador.
    page.on("dialog", (dialog) => { throw new Error(`diálogo inesperado: ${dialog.message()}`); });
    await card.getByRole("button", { name: "Quitar la marca de hecho: Ana, Aportar al plan de pensiones" }).click();
    await expect(card.locator(".fc-progreso")).toContainText("Hecho: 0 de 3 tareas.");
    await expect(page.locator("#undoToastMessage")).toContainText("Marca de hecho quitada");
    await page.locator("#undoToastButton").click();
    await expect(card.locator(".fc-progreso")).toContainText("Hecho: 1 de 3 tareas.");

    // Con todas marcadas, el aviso del 20/12 se calla (el del 1/12 sigue) y la tarjeta lo dice.
    await card.getByRole("button", { name: "Marcar como hecho: Ana, Llenar el tope de la deducción por vivienda" }).click();
    await card.getByRole("button", { name: "Marcar como hecho: Ana, Donativos deducibles" }).click();
    await expect(card.locator(".fc-progreso")).toContainText("Hecho: 3 tareas de 3. Todas marcadas como hechas");
    const despues = await page.evaluate(() => { const result = recordatoriosPlan().result; return { fiscal: result.events.filter((event) => event.kind === "fiscal").map((event) => event.date), skipped: result.skipped.fiscalDone }; });
    expect(despues.fiscal).toEqual(["2026-12-01"]);
    expect(despues.skipped).toBe(1);
    expect(pageErrors, `errores de página: ${pageErrors.join(" | ")}`).toEqual([]);
  });

  test("sin tareas con ahorro NO se calla el aviso del 20/12; no desborda en móvil con el estado «hecho»", async ({ page }) => {
    const pageErrors = [];
    page.on("pageerror", (error) => pageErrors.push(String(error)));
    await page.clock.install({ time: new Date(2026, 10, 20, 12, 0, 0) });
    for (const viewport of [{ width: 1280, height: 800 }, { width: 390, height: 844 }]) {
      await page.setViewportSize(viewport);
      await page.goto("/index.html#herramientas-fiscal");
      await page.evaluate((value) => { storageSet(storageKey("fiscal-data"), JSON.stringify({ ...value, holders: [value.holders[1]] })); storageSet(storageKey("fiscal-done"), ""); }, datos);
      await page.reload();
      await expect(page.locator("#campanaFiscalCard")).toHaveAttribute("data-ejemplo", "false");
      await expect(page.locator("#campanaFiscalCard .fc-progreso"), "sin tareas no hay progreso ni «todo hecho»").toHaveCount(0);
      const fiscal = await page.evaluate(() => recordatoriosPlan().result.events.filter((event) => event.kind === "fiscal").map((event) => event.date));
      expect(fiscal, "no se sabe nada de tareas: salen los dos avisos de siempre").toEqual(["2026-12-01", "2026-12-20"]);
      // Con tareas y una marcada, a 390 px.
      await page.evaluate((value) => { storageSet(storageKey("fiscal-data"), JSON.stringify(value)); storageSet(storageKey("fiscal-done"), JSON.stringify({ year: 2026, marks: { "pensiones|persona-1": { at: "2026-11-19" } } })); }, datos);
      await page.reload();
      await expect(page.locator("#campanaFiscalCard .fc-progreso")).toContainText("Hecho: 1 de 3 tareas.");
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
      await expect(card.locator("[data-recordatorios-kind]")).toHaveCount(6);
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

  // WP-40 PR-2: el aviso anual de la CIRBE. Sin informe tecleado no hay aviso; con uno de hace casi un año, entra en el fichero y su título no lleva datos.
  test("el aviso de la CIRBE solo existe si hay un informe tecleado, sale en el .ics sin datos en el título y se puede apagar", async ({ page }) => {
    // Cuatro cargas completas de la app (dos para partir de cero, una con el informe y la del principio) y una descarga: en una máquina
    // lenta pasa de los 30 s por defecto con todo en orden. Reproducido el 20/10/2026 con la CPU saturada: 3 de 10 sin tiempo en el
    // último paso, con todas las comprobaciones anteriores en verde (sesión 330).
    test.setTimeout(90000);
    const pageErrors = [];
    page.on("pageerror", (error) => pageErrors.push(String(error)));
    await page.goto("/index.html#ajustes");
    await page.reload();
    await page.evaluate(() => { try { localStorage.clear(); } catch { /* sin almacenamiento */ } });
    await page.reload();
    const card = page.locator("#recordatoriosCard");
    await expect(card.locator("#recordatoriosResumen")).toContainText(/recordatorio\(s\) hasta el/, { timeout: 15000 });
    await expect(card.locator("#recordatoriosResumen"), "sin informe tecleado no se inventa un aviso").not.toContainText("aviso de la CIRBE");
    await page.evaluate(() => {
      const d = new Date(); d.setDate(d.getDate() - 340);
      storageSet(storageKey("cirbe-report"), JSON.stringify({ reportDate: isoLocalDate(d), rows: [{ id: "x", entity: "Cetelem", kind: "prestamo", amount: 6000 }] }));
    });
    await page.reload();
    await expect(card.locator("#recordatoriosResumen")).toContainText("1 aviso de la CIRBE", { timeout: 15000 });
    const [download] = await Promise.all([page.waitForEvent("download"), card.locator("#recordatoriosDescargar").click()]);
    const text = await new Promise((resolve, reject) => { const chunks = []; download.createReadStream().then((stream) => { stream.on("data", (chunk) => chunks.push(chunk)); stream.on("end", () => resolve(Buffer.concat(chunks).toString("utf8"))); stream.on("error", reject); }, reject); });
    const titles = [...text.matchAll(/^SUMMARY:(.*)$/gm)].map((match) => match[1]);
    expect(titles, "el título del aviso no lleva fechas ni importes").toContain("Toca pedir el informe de la CIRBE");
    await card.locator('[data-recordatorios-kind="cirbe"]').uncheck();
    await expect(card.locator("#recordatoriosResumen")).not.toContainText("aviso de la CIRBE");
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
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

// WP-19: «Camino a deuda cero» (Deuda › Ruta). Un solo control (extra al mes), tres cifras, "por cada 100 €" y el aviso de lo que no entra en la cuenta.
// Los contratos son los de ejemplo del repositorio (anonimizados) más uno inventado con TAE; los reales los declara el hogar.
test.describe("WP-19 · camino a deuda cero", () => {
  test("lee los contratos declarados, mueve fecha e intereses con el extra, rechaza un importe inválido y no se desborda en móvil", async ({ page }) => {
    test.setTimeout(90000);
    const pageErrors = [];
    page.on("pageerror", (error) => pageErrors.push(String(error)));
    for (const viewport of [{ width: 1280, height: 900 }, { width: 390, height: 844 }]) {
      await page.setViewportSize(viewport);
      await page.goto("/index.html#deuda-contratos");
      await page.reload();
      await page.evaluate(() => { try { localStorage.clear(); } catch { /* sin almacenamiento */ } });
      await page.reload();
      // Un préstamo con TAE declarada (inventado), dado de alta donde se declaran los contratos.
      const pendienteAntes = await page.evaluate(() => homeDebtOutlook().pendingPrincipal); // llena la caché de Hoy antes del alta
      await page.fill("#deudaContratosAddEntity", "Banco Prueba");
      await page.selectOption("#deudaContratosAddType", "Préstamo");
      await page.fill("#deudaContratosAddPrincipal", "5000");
      await page.fill("#deudaContratosAddApr", "9");
      await page.fill("#deudaContratosAddPayment", "150");
      await page.fill("#deudaContratosAddInstallments", "40");
      await page.locator('#deudaContratosAddForm button[type="submit"]').click();
      // Regresión: Hoy contaba la deuda anterior hasta recargar (la caché no miraba los contratos) y contradecía a esta pantalla.
      expect(await page.evaluate(() => homeDebtOutlook().pendingPrincipal)).toBe(pendienteAntes + 5000);
      await page.evaluate(() => { location.hash = "#deuda-ruta"; });
      const card = page.locator("#caminoDeudaCard");
      await expect(card).toBeVisible({ timeout: 15000 });
      const result = card.locator("#caminoDeudaResultado");

      // Sin extra: tres cifras, el calendario actual y lo que NO entra en la cuenta (dato ausente no es cero).
      await expect(result.locator(".cam-hero")).toHaveCount(3, { timeout: 15000 });
      await expect(result).toContainText("Libre de las deudas con cuota"); // hay deudas sin cuota: no se anuncia «libre de deuda» a secas
      await expect(result).toContainText("Cuota total al mes");
      await expect(result).toContainText("Intereses pendientes");
      await expect(result).toContainText("Sin extra, el calendario actual acaba en");
      await expect(result).toContainText("No entran en la cuenta");
      await expect(result).toContainText("sin cuota activa");
      await expect(result).toContainText("Sin TAE declarada");
      await expect(result).toContainText("Cada 100 € más al mes");
      await expect(result).toContainText("no ejecuta nada");
      const sinExtra = await result.locator(".cam-hero-value").allTextContents();

      // Con extra: acaba antes y paga menos; el deslizador y la caja numérica van juntos.
      await page.fill("#caminoDeudaExtra", "200");
      await expect(result).toContainText("más al mes");
      await expect(result).toContainText("antes (");
      await expect(result).toContainText("menos de intereses");
      await expect(result).toContainText("(sin extra:");
      const conExtra = await result.locator(".cam-hero-value").allTextContents();
      expect(conExtra[0]).not.toEqual(sinExtra[0]);
      await expect(page.locator("#caminoDeudaRango")).toHaveValue("200");
      await page.locator("#caminoDeudaRango").fill("300");
      await expect(page.locator("#caminoDeudaExtra")).toHaveValue("300");
      await expect(page.locator("#caminoDeudaRango")).toHaveAttribute("aria-valuetext", /300\s€.*libres de deuda en/);

      // Un importe inválido se rechaza sin mover el resultado.
      const antes = await result.innerHTML();
      await page.fill("#caminoDeudaExtra", "-5");
      await expect(page.locator("#caminoDeudaNota")).toContainText("0 € o más");
      await expect(page.locator("#caminoDeudaExtra")).toHaveAttribute("aria-invalid", "true");
      expect(await result.innerHTML()).toEqual(antes);
      await page.fill("#caminoDeudaExtra", "0");
      await expect(page.locator("#caminoDeudaExtra")).not.toHaveAttribute("aria-invalid", "true");

      // Paridad con el calendario de Deuda › Ruta: con extra 0 los intereses del préstamo son los de debtAmortizationSchedule (mismo cálculo).
      const parity = await page.evaluate(() => {
        const contracts = escenarioMotorDebtOptions();
        const run = FinanceCanonicalDebtPayoffPath.project(contracts, { startMonthKey: isoLocalDate(new Date()).slice(0, 7), extraMonthly: 0 });
        const row = run.included.find((item) => /Banco Prueba/.test(item.label));
        const contract = contracts.find((item) => item.entity === "Banco Prueba");
        const schedule = debtAmortizationSchedule(contract, 600);
        const interest = schedule.rows.reduce((sum, item) => sum + item.interest, 0);
        const started = performance.now();
        for (let i = 0; i < 20; i += 1) FinanceCanonicalDebtPayoffPath.project(contracts, { startMonthKey: "2026-10", extraMonthly: 250 });
        return { engine: row.interest, calendar: interest, months: row.payoffIndex + 1, calendarMonths: schedule.rows.length, perRun: (performance.now() - started) / 20 };
      });
      expect(Math.abs(parity.engine - parity.calendar)).toBeLessThan(0.02);
      expect(parity.months).toBe(parity.calendarMonths);
      expect(parity.perRun, "recalcular en vivo no necesita estado «recalculando»").toBeLessThan(50);

      // Nada se desborda a lo ancho.
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
    }
    expect(pageErrors).toEqual([]);
  });
});

// WP-31 (PR-1): nóminas y retenciones acumuladas en Herramientas avanzadas › Fiscal. Nóminas INVENTADAS; las reales las apunta el hogar y no van al repositorio.
test.describe("WP-31 · nóminas y retenciones", () => {
  test("apunta nóminas, avisa de los meses que faltan y del cambio de %, lee un texto sin guardarlo y pasa la suma al estimador", async ({ page }) => {
    test.setTimeout(120000);
    const pageErrors = [];
    page.on("pageerror", (error) => pageErrors.push(String(error)));
    for (const viewport of [{ width: 1280, height: 900 }, { width: 390, height: 844 }]) {
      await page.setViewportSize(viewport);
      await page.goto("/index.html#herramientas-fiscal");
      await page.reload();
      await page.evaluate(() => { try { localStorage.clear(); } catch { /* sin almacenamiento */ } });
      await page.reload();
      const card = page.locator("#nominasCard");
      await expect(card).toBeVisible({ timeout: 15000 });
      await expect(card.locator("#nominasResumen")).toContainText("Aún no hay nóminas");
      const year = (await page.evaluate(() => new Date().getFullYear())) - 1; // el año pasado: siempre es pasado, sea cual sea el día de hoy
      const save = async (month, extra = {}) => {
        await page.fill("#nominasTitular", "Persona A");
        await page.fill("#nominasMes", `${year}-${String(month).padStart(2, "0")}`);
        await page.fill("#nominasBruto", extra.gross ?? "2.100,00");
        await page.fill("#nominasLiquido", extra.net ?? "1.644,93");
        await page.fill("#nominasPct", extra.pct ?? "15,32");
        await page.fill("#nominasRetencion", extra.amount ?? "");
        await page.locator('#nominasForm button[type="submit"]').click();
      };

      // Sin retención no hay nómina (dato ausente no es cero).
      await page.fill("#nominasTitular", "Persona A");
      await page.fill("#nominasMes", `${year}-01`);
      await page.fill("#nominasBruto", "2.100,00");
      await page.fill("#nominasLiquido", "1.644,93");
      await page.locator('#nominasForm button[type="submit"]').click();
      await expect(card.locator("#nominasNota")).toContainText("Falta la retención");
      await expect(card.locator("#nominasResumen")).toContainText("Aún no hay nóminas");

      // Enero, febrero y abril: marzo falta y se dice. La retención se calcula del % y se marca.
      await save(1);
      await expect(card.locator("#nominasNota")).toContainText("guardada");
      await save(2);
      await save(4);
      await expect(card.locator(".nom-faltan")).toContainText(`marzo, mayo a diciembre de ${year}`);
      await expect(card.locator(".nom-cifra")).toContainText("965,16");
      await expect(card.locator("#nominasResumen")).toContainText("retenciones están calculadas desde el %");
      await save(3);
      await expect(card.locator(".nom-faltan")).not.toContainText("marzo"); // un año ya cerrado se espera entero: siguen faltando mayo a diciembre
      await expect(card.locator(".nom-faltan")).toContainText(`mayo a diciembre de ${year}`);
      await expect(card.locator(".nom-cifra")).toContainText("1.286,88"); // A2: miles agrupados también con 4 cifras

      // Cambio del %: aviso con su explicación.
      await save(5, { pct: "13,1" });
      await expect(card.locator(".nom-aviso")).toContainText("La retención bajó del 15,32 % al 13,1 %");
      await expect(card.locator(".nom-aviso")).toContainText("regularización");

      // Lector de texto: rellena el formulario, borra lo pegado y no guarda hasta pulsar «Guardar».
      await card.locator(".nom-texto summary").click();
      await page.fill("#nominasTextoPegado", `NÓMINA\nPeriodo: 01/06/${year} a 30/06/${year}\nTOTAL DEVENGADO 2.100,00\nIRPF 15,32 % 321,72\nLÍQUIDO A PERCIBIR 1.644,93\nNIF 12345678Z`);
      await card.locator("[data-nominas-leer]").click();
      await expect(card.locator("#nominasNota")).toContainText("He leído");
      await expect(card.locator("#nominasNota")).toContainText("Revisa todo");
      await expect(page.locator("#nominasTextoPegado")).toHaveValue("");
      await expect(page.locator("#nominasMes")).toHaveValue(`${year}-06`);
      await expect(page.locator("#nominasBruto")).toHaveValue("2100");
      await expect(page.locator("#nominasLiquido")).toHaveValue("1644,93");
      await expect(card.locator(".nom-lista summary")).toContainText("(5)", { timeout: 5000 });
      await page.fill("#nominasTitular", "Persona A");
      await page.locator('#nominasForm button[type="submit"]').click();
      await expect(card.locator(".nom-lista summary")).toContainText("(6)");

      // Solo cifras en el almacenamiento: nada del texto pegado, ni el NIF.
      const stored = await page.evaluate(() => Object.entries(localStorage).filter(([key]) => key.includes("payslips")).map(([, value]) => value).join("|"));
      expect(stored).toContain("withholdingAmount");
      expect(stored).not.toMatch(/12345678Z|DEVENGADO|NÓMINA|Periodo/);

      // «Usar» pasa la suma al estimador de Renta y avisa de lo que falta (julio a diciembre del año pasado).
      await card.locator('[data-nominas-usar="Persona A"]').click();
      const expected = await page.evaluate((y) => String(FinanceCanonicalPayroll.summarize(nominasLoad(), { year: y, today: isoLocalDate(new Date()) }).holders[0].withheld), year);
      await expect(page.locator("#irpfWithholdingsPaid")).toHaveValue(expected);
      await expect(card.locator("#nominasNota")).toContainText("faltan nóminas");

      // Quitar una nómina.
      await card.locator(".nom-lista summary").click();
      await card.locator("[data-nominas-quitar]").first().click();
      await expect(card.locator(".nom-lista summary")).toContainText("(5)");

      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
    }
    expect(pageErrors).toEqual([]);
  });
});

// Rediseño A4: con el tema v2 y sin movimientos, Movimientos enseña un solo bloque que lleva a Importar y la tarjeta
// de anomalías queda tras «Ver todo el detalle»; se abre para comprobar la tarjeta tal como la vería el hogar.
async function verDetalleMovimientosSinDatos(page) {
  const detalle = page.locator("#movimientosV2Lista [data-mov-v2-detail]");
  await detalle.or(page.locator("#anomaliasCard")).first().waitFor({ timeout: 15000 });
  if (await detalle.isVisible()) await detalle.click();
}

// WP-36: anomalías del extracto (Movimientos). Movimientos INVENTADOS, sembrados con la misma ruta que usa el importador real (mergeTransactions).
// Fechas relativas a hoy: el detector solo mira los últimos 45 días.
async function seedAnomalies(page) {
  await page.evaluate(() => {
    const iso = (date) => isoLocalDate(date);
    const today = new Date();
    const back = (days) => iso(new Date(today.getFullYear(), today.getMonth(), today.getDate() - days));
    const rows = [];
    let balance = 3000;
    const add = (date, amount, movement) => rows.push({ date, month: date.slice(0, 7), movement, details: "", amount, balance: (balance += 1), accountId: "caixabank" });
    // Los cobros mensuales caen el mismo día del mes que hoy (como mucho el 28): el del mes pasado queda siempre a 28-34 días, dentro de la
    // ventana de 45. Con día fijo (el 1 y el 5) la prueba fallaba en la segunda mitad de cada mes: el alquiler del día 1 ya se salía.
    const ancla = Math.min(today.getDate(), 28);
    for (let k = 1; k <= 6; k += 1) {
      const month = new Date(today.getFullYear(), today.getMonth() - k, 1);
      const day = (d) => iso(new Date(month.getFullYear(), month.getMonth(), d));
      add(day(ancla), -900, "RECIBO ALQUILER FICTICIO");
      add(day(ancla), -12.99, "SUSCRIPCION FICTICIA");
      add(day(10), -52, "COMPRA TARJ SUPER FICTICIO");
      add(day(20), -48, "COMPRA TARJ SUPER FICTICIO");
    }
    add(back(9), -62.3, "RECIBO SEGURO FICTICIO");
    add(back(6), 62.3, "DEVOLUCION RECIBO SEGURO FICTICIO");
    add(back(4), -45, "COMPRA TARJ GASOLINERA FICTICIA");
    add(back(4), -45, "COMPRA TARJ GASOLINERA FICTICIA");
    add(back(2), -4.5, "COMISION MANTENIMIENTO CUENTA");
    baseData.transactions = mergeTransactions(baseData.transactions || [], rows);
    refreshMovementRollups();
    renderAnomalias(FinanceCanonicalStatementAnomalies);
    globalThis.movimientosV2Render?.(); // la vista se repinta con los movimientos nuevos, como tras importar
  });
}

test.describe("WP-36 · anomalías del extracto", () => {
  test("señala con evidencia, deja responder y deshacer, recuerda lo respondido y no toca ningún movimiento", async ({ page }) => {
    test.setTimeout(90000);
    const pageErrors = [];
    page.on("pageerror", (error) => pageErrors.push(String(error)));
    for (const viewport of [{ width: 1280, height: 900 }, { width: 390, height: 844 }]) {
      await page.setViewportSize(viewport);
      await page.goto("/index.html#movements");
      await page.reload();
      await page.evaluate(() => { try { localStorage.clear(); } catch { /* sin almacenamiento */ } });
      await page.reload();
      await verDetalleMovimientosSinDatos(page);
      const card = page.locator("#anomaliasCard");
      await expect(card).toBeVisible({ timeout: 15000 });
      // Sin extracto reciente no se vigila lo reciente.
      await expect(card.locator("#anomaliasCuerpo")).toContainText("No puedo mirar lo reciente");

      await seedAnomalies(page);
      const total = await page.evaluate(() => baseData.transactions.length);
      const avisos = card.locator(".ano-aviso");
      await expect(avisos).toHaveCount(5); // los tres de abajo y los dos cobros mensuales (alquiler y suscripción) que en esta app de prueba no tienen partida
      await expect(avisos.nth(0)).toContainText("Recibo devuelto");
      await expect(avisos.nth(0)).toContainText("Devuelve el cargo de 62,30 €");
      await expect(avisos.nth(1)).toContainText("Posible duplicado");
      await expect(avisos.nth(1)).toContainText("2 cargos de 45,00 €");
      await expect(avisos.nth(2)).toContainText("Comisión");
      await expect(avisos.nth(2)).toContainText("primera vez");
      await expect(avisos.nth(3)).toContainText("Sin partida en el plan");
      await expect(card.locator(".ano-medida")).toContainText("hacen falta 10 respuestas y llevas 0");

      // «Es normal» + deshacer.
      await avisos.nth(1).locator('[data-anomalia-respuesta="normal"]').click();
      await expect(avisos).toHaveCount(4);
      await expect(card.locator("#anomaliasNota")).toContainText("era normal");
      await card.locator("[data-anomalia-deshacer]").click();
      await expect(avisos).toHaveCount(5);

      // «Es normal siempre» calla el patrón y se recuerda tras recargar.
      await card.locator(".ano-aviso", { hasText: "Comisión" }).locator('[data-anomalia-respuesta="normalAlways"]').click();
      await expect(avisos).toHaveCount(4);
      await page.reload();
      await seedAnomalies(page);
      await expect(page.locator("#anomaliasCard .ano-aviso")).toHaveCount(4);
      await expect(page.locator("#anomaliasCard .ano-aviso", { hasText: "Comisión" })).toHaveCount(0);
      const stored = await page.evaluate(() => Object.entries(localStorage).filter(([key]) => key.includes("statement-anomaly-answers")).map(([, value]) => value).join("|"));
      expect(stored).toContain("normalAlways");

      // Lo silenciado se ve, con su nombre, y se devuelve a vigilar (con «Deshacer»); la lista abierta no se cierra al repintar y no se sale de la tarjeta.
      const silenciados = page.locator("#anomaliasCard .ano-silenciados");
      await expect(silenciados.locator("summary")).toContainText("Patrones que has silenciado (1)");
      await silenciados.locator("summary").click();
      await expect(silenciados).toContainText("Comisión: COMISION MANTENIMIENTO CUENTA");
      const cardBox = await page.locator("#anomaliasCard").boundingBox();
      for (const box of await silenciados.locator("li, button").evaluateAll((nodes) => nodes.map((node) => { const r = node.getBoundingClientRect(); return { left: r.left, right: r.right }; }))) {
        expect(box.left).toBeGreaterThanOrEqual(cardBox.x - 1);
        expect(box.right).toBeLessThanOrEqual(cardBox.x + cardBox.width + 1);
      }
      await silenciados.locator('[data-anomalia-vigilar]').click();
      await expect(page.locator("#anomaliasCard .ano-aviso", { hasText: "Comisión" })).toHaveCount(1);
      await expect(page.locator("#anomaliasCard .ano-silenciados")).toHaveCount(0);
      await expect(page.locator("#anomaliasNota")).toContainText("Vuelvo a vigilar");
      await page.locator("#anomaliasCard [data-anomalia-deshacer]").click();
      await expect(page.locator("#anomaliasCard .ano-aviso", { hasText: "Comisión" })).toHaveCount(0);
      await expect(page.locator("#anomaliasCard .ano-silenciados summary")).toContainText("(1)");

      // Nunca toca el extracto.
      expect(await page.evaluate(() => baseData.transactions.length)).toBe(total);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
    }
    expect(pageErrors).toEqual([]);
  });
});

// WP-37 (NXP-04): estados completos. Una vista que se descarga bajo demanda enseña el esqueleto, y si falla, la causa y una salida; lo reversible se
// deshace en vez de confirmarse. Sin service worker: así la descarga de la vista pasa por la red (y por lo que aquí se bloquea o se retrasa).
test.describe("WP-37 · estados completos", () => {
  test.use({ serviceWorkers: "block" });

  test("una vista que tarda enseña un esqueleto; si falla, la causa y «Reintentar»; sin conexión lo dice distinto; al volver, se carga", async ({ page, context }) => {
    test.setTimeout(90000);
    const pageErrors = [];
    page.on("pageerror", (error) => pageErrors.push(String(error)));

    // 1) Tarda: esqueleto en el sitio, y desaparece al llegar.
    await page.route("**/views/deuda.js*", async (route) => { await new Promise((resolve) => setTimeout(resolve, 1500)); await route.continue(); });
    await page.goto("/index.html#deuda-ruta");
    await expect(page.locator('#deuda-ruta [data-estado="cargando"]')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('#deuda-ruta [data-estado="cargando"] .est-esqueleto')).toBeVisible();
    await expect(page.locator("#caminoDeudaCard")).toBeVisible({ timeout: 15000 });
    await expect(page.locator("#deuda-ruta [data-estado-vista]")).toHaveCount(0);
    await page.unroute("**/views/deuda.js*");

    // 2) Falla: causa, qué sigue funcionando y una salida.
    await page.route("**/views/deuda.js*", (route) => route.abort());
    await page.goto("/index.html#home");
    await page.reload();
    await expect(page.locator("#home")).toBeVisible({ timeout: 15000 });
    await page.evaluate(() => { location.hash = "#deuda-ruta"; });
    const error = page.locator('#deuda-ruta [data-estado="error"]');
    await expect(error).toBeVisible({ timeout: 15000 });
    await expect(error).toContainText("No se ha podido descargar esta pantalla");
    await expect(error).toContainText("El resto de la app sigue funcionando");
    await expect(error).toContainText("Causa:");
    await expect(error.locator('[data-estado-accion="reintentar"]')).toBeVisible();
    await expect(error).toHaveAttribute("role", "alert");

    // 3) Sin conexión: no es lo mismo que un error de la app.
    await context.setOffline(true);
    await page.evaluate(() => { location.hash = "#home"; });
    await page.evaluate(() => { location.hash = "#deuda-ruta"; });
    const offline = page.locator('#deuda-ruta [data-estado="sin-conexion"]');
    await expect(offline).toBeVisible({ timeout: 15000 });
    await expect(offline).toContainText("Conéctate un momento");
    await context.setOffline(false);

    // 4) Vuelve la red: «Reintentar» carga la pantalla y el estado desaparece.
    await page.unroute("**/views/deuda.js*");
    await page.locator('#deuda-ruta [data-estado-accion="reintentar"]').click();
    await expect(page.locator("#caminoDeudaCard")).toBeVisible({ timeout: 15000 });
    await expect(page.locator("#deuda-ruta [data-estado-vista]")).toHaveCount(0);
    expect(pageErrors).toEqual([]);
  });

  test("quitar un contrato no pide confirmación: avisa con «Deshacer» y lo devuelve en su sitio", async ({ page }) => {
    test.setTimeout(60000);
    const dialogs = [];
    page.on("dialog", async (dialog) => { dialogs.push(dialog.message()); await dialog.dismiss(); });
    await page.goto("/index.html#deuda-contratos");
    await page.reload();
    await page.evaluate(() => { try { localStorage.clear(); } catch { /* sin almacenamiento */ } });
    await page.reload();
    await page.fill("#deudaContratosAddEntity", "Banco Prueba");
    await page.selectOption("#deudaContratosAddType", "Préstamo");
    await page.fill("#deudaContratosAddPrincipal", "5000");
    await page.fill("#deudaContratosAddPayment", "150");
    await page.locator('#deudaContratosAddForm button[type="submit"]').click();
    const remove = page.locator('button[aria-label="Eliminar el contrato de Banco Prueba"]').first();
    await expect(remove).toBeVisible({ timeout: 15000 });
    const before = await page.locator("#deuda-contratos").innerText();
    expect(before).toContain("Banco Prueba");
    await remove.click();
    await expect(page.locator("#undoToast")).toBeVisible();
    await expect(page.locator("#undoToastMessage")).toContainText("Contrato de «Banco Prueba» eliminado");
    await expect(page.locator('button[aria-label="Eliminar el contrato de Banco Prueba"]')).toHaveCount(0);
    await page.locator("#undoToastButton").click();
    await expect(page.locator('button[aria-label="Eliminar el contrato de Banco Prueba"]')).toHaveCount(1);
    expect(dialogs).toEqual([]);
  });

  test("quitar una hucha y una aportación avisa con «Deshacer» y devuelve solo esa hucha, en su sitio", async ({ page }) => {
    test.setTimeout(60000);
    const dialogs = [];
    page.on("dialog", async (dialog) => { dialogs.push(dialog.message()); await dialog.dismiss(); });
    await page.goto("/index.html#savings-agent");
    await page.reload();
    await page.evaluate(() => { try { localStorage.clear(); } catch { /* sin almacenamiento */ } });
    await page.reload();
    const form = page.locator("[data-goal-form]");
    await expect(form).toBeVisible({ timeout: 20000 });
    for (const name of ["Coche", "Reforma"]) {
      await form.locator('input[name="name"]').fill(name);
      await form.locator('input[name="target"]').fill("1000");
      await form.locator('button[type="submit"]').click();
      await expect(page.locator("[data-goal-list]")).toContainText(name);
    }
    const goals = page.locator("[data-goal-list] [data-goal-delete]");
    await expect(goals).toHaveCount(2);
    await goals.first().click();
    await expect(page.locator("#undoToastMessage")).toContainText("eliminada con sus aportaciones");
    await expect(page.locator("[data-goal-list] [data-goal-delete]")).toHaveCount(1);
    await page.locator("#undoToastButton").click();
    await expect(page.locator("[data-goal-list] [data-goal-delete]")).toHaveCount(2);
    const order = await page.locator("[data-goal-list]").innerText();
    expect(order.indexOf("Coche")).toBeGreaterThanOrEqual(0);
    expect(order.indexOf("Coche")).toBeLessThan(order.indexOf("Reforma")); // vuelve en su sitio, no al final
    expect(dialogs).toEqual([]);
  });

  test("el vacío de nóminas lleva su acción principal, que lleva al formulario", async ({ page }) => {
    await page.goto("/index.html#herramientas-fiscal");
    await page.reload();
    await page.evaluate(() => { try { localStorage.clear(); } catch { /* sin almacenamiento */ } });
    await page.reload();
    const empty = page.locator('#nominasResumen [data-estado="vacio"]');
    await expect(empty).toBeVisible({ timeout: 15000 });
    await expect(empty).toContainText("Aún no hay nóminas apuntadas");
    await empty.locator('[data-estado-accion="nominas-primera"]').click();
    await expect(page.locator("#nominasTitular")).toBeFocused();
  });
});

// WP-38 (PRV-05 + NPV-09): el plan B acordado en frío, en Plan › Previsión. Asistente de tres pasos, firma de dos personas, vigilancia del disparador y «Deshacer».
test.describe("WP-38 · plan B del hogar", () => {
  const openPrevision = async (page) => {
    await page.goto("/index.html#plan");
    await page.reload();
    await page.evaluate(() => { try { localStorage.clear(); } catch { /* sin almacenamiento */ } });
    await page.reload();
    await page.locator('[data-plan-tab="prevision"]').click();
    const card = page.locator("#planBCard");
    await expect(card).toBeVisible({ timeout: 15000 });
    return card;
  };

  test("vacío accionable, asistente de tres pasos, firma, disparo, firma invalidada al cambiar y deshacer, sin confirm() ni desbordar", async ({ page }) => {
    test.setTimeout(120000);
    const pageErrors = [];
    const dialogs = [];
    page.on("pageerror", (error) => pageErrors.push(String(error)));
    page.on("dialog", async (dialog) => { dialogs.push(dialog.message()); await dialog.dismiss(); });
    for (const viewport of [{ width: 1280, height: 900 }, { width: 390, height: 844 }]) {
      await page.setViewportSize(viewport);
      const card = await openPrevision(page);
      const body = card.locator("#planBCuerpo");
      await expect(body.locator('[data-estado="vacio"]')).toContainText("Todavía no habéis acordado un plan B");
      await expect(card.locator(".pb-palanca summary")).toContainText("¿Cuánto aguanta el colchón?");
      await card.locator(".pb-palanca summary").click();
      await expect(card.locator(".pb-tabla thead th")).toHaveCount(4);

      // Paso 1: disparador con una cifra tan alta que, con la previsión de hoy, ya saltaría.
      await body.locator('[data-estado-accion="planb-empezar"]').click();
      await expect(body.locator(".pb-pasos-nav [aria-current='step']")).toContainText("1. Disparador");
      await body.locator('input[name="planbModo"][value="amount"]').check();
      await body.locator('input[data-planb-campo="amount"]').fill("99999999");
      await body.locator('input[data-planb-campo="amount"]').dispatchEvent("change");
      await expect(body.locator("[data-planb-previa]")).toContainText("YA saltaría");

      // Paso 2: dos acciones, la segunda subida al primer puesto.
      await body.locator('[data-planb-paso="2"]').click();
      await expect(body.locator('[data-estado="vacio"]')).toContainText("Todavía no hay ninguna acción");
      await body.locator('[data-estado-accion="planb-anadir"]').click();
      await body.locator("[data-planb-anadir]").click();
      await expect(body.locator(".pb-accion")).toHaveCount(2);
      await body.locator('select[data-planb-accion="1"]').selectOption("credit-line");
      await body.locator('input[data-planb-accion="1"][data-planb-campo="amount"]').fill("1500");
      await body.locator('input[data-planb-accion="1"][data-planb-campo="amount"]').dispatchEvent("change");
      await body.locator('[data-planb-subir="1"]').click();
      await expect(body.locator('select[data-planb-accion="0"]')).toHaveValue("credit-line");
      await body.locator('[data-planb-quitar="0"]').click();
      await expect(body.locator(".pb-accion")).toHaveCount(1);
      await page.locator("#undoToastButton").click();
      await expect(body.locator(".pb-accion")).toHaveCount(2);

      // Paso 3: no se firma con una sola persona; con dos, sí.
      await body.locator('[data-planb-paso="3"]').click();
      await body.locator('[data-planb-firma="0"]').fill("Ana");
      await body.locator("[data-planb-firmar]").click();
      await expect(body.locator("[data-planb-aviso-firma]")).toContainText("dos personas distintas");
      await body.locator('[data-planb-firma="1"]').fill("Luis");
      await body.locator("[data-planb-firmar]").click();
      await expect(body.locator("[data-planb-status]")).toHaveAttribute("data-planb-status", "triggered");
      await expect(body).toContainText("Se cumple vuestro plan B");
      await expect(body).toContainText("Ana y Luis");
      await expect(body.locator(".pb-pasos .pb-paso")).toHaveCount(2);
      await expect(body.locator(".pb-pasos")).toContainText("No es dinero propio");
      await expect(body).toContainText("crédito antes de agotar lo propio");

      // Persiste al recargar.
      await page.reload();
      await page.locator('[data-plan-tab="prevision"]').click();
      await expect(page.locator("#planBCuerpo [data-planb-status]")).toHaveAttribute("data-planb-status", "triggered");
      await expect(page.locator("#planBCuerpo")).toContainText("Firmado el");

      // Cambiar el plan y guardarlo sin firmar deja un borrador (la firma antigua ya no vale).
      await page.locator("[data-planb-editar]").click();
      await page.locator('[data-planb-paso="2"]').click();
      await page.locator('[data-planb-bajar="0"]').click();
      await page.locator('[data-planb-paso="3"]').click();
      await page.locator("[data-planb-guardar]").click();
      await expect(page.locator("#planBCuerpo")).toContainText("Sin firmar: es un borrador");
      await page.locator("#undoToastButton").click();
      await expect(page.locator("#planBCuerpo")).toContainText("Firmado el");

      // Borrar con deshacer.
      await page.locator("[data-planb-borrar]").click();
      await expect(page.locator('#planBCuerpo [data-estado="vacio"]')).toBeVisible();
      await page.locator("#undoToastButton").click();
      await expect(page.locator("#planBCuerpo [data-planb-status]")).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), `sin desbordar en ${viewport.width} px`).toBe(true);
    }
    expect(dialogs, "ningún confirm(): lo reversible se deshace").toEqual([]);
    expect(pageErrors, `errores de página: ${pageErrors.join(" | ")}`).toEqual([]);
  });

  test("con una cifra baja el plan no salta y lo dice; nada de esto toca Hoy", async ({ page }) => {
    const card = await openPrevision(page);
    const body = card.locator("#planBCuerpo");
    await body.locator('[data-estado-accion="planb-empezar"]').click();
    await body.locator('input[name="planbModo"][value="amount"]').check();
    await body.locator('input[data-planb-campo="amount"]').fill("1");
    await body.locator('input[data-planb-campo="amount"]').dispatchEvent("change");
    await expect(body.locator("[data-planb-previa]")).toContainText("no saltaría");
    await body.locator('[data-planb-paso="2"]').click();
    await body.locator("[data-planb-anadir]").click();
    await body.locator('[data-planb-paso="3"]').click();
    await body.locator("[data-planb-guardar]").click();
    await expect(body.locator("[data-planb-status]")).toHaveAttribute("data-planb-status", "ok");
    await expect(body).toContainText("Sin firmar: es un borrador");
    await page.goto("/index.html#home");
    await expect(page.locator("body")).not.toContainText("Se cumple vuestro plan B");
  });
});

// WP-39 (CAR-01): la política de inversión del hogar, en Inversión › Rebalanceo. Seis preguntas con lo ya declarado, firma de dos personas, la cartera frente a la
// política y la consulta «¿esta operación la cumple?».
test.describe("WP-39 · política de inversión del hogar", () => {
  const seed = async (page) => {
    await page.evaluate(() => {
      scenarioSettings.portfolioTargets = { etf: 70, fondo: 30 };
      scenarioSettings.portfolioPositions = [
        { id: "p-etf", type: "etf", label: "ETF mundial", quantity: 10, costBasis: 6000, currentValue: 7000, asOf: "2026-10-01" },
        { id: "p-fondo", type: "fondo", label: "Fondo mixto", quantity: 10, costBasis: 2500, currentValue: 3000, asOf: "2026-10-01" },
      ];
      saveScenarioSettings();
      renderPoliticaInversion(FinanceCanonicalInvestmentPolicy, true);
    });
  };
  const open = async (page) => {
    await page.goto("/index.html#inversion-rebalanceo");
    await page.reload();
    await page.evaluate(() => { try { localStorage.clear(); } catch { /* sin almacenamiento */ } });
    await page.reload();
    const card = page.locator("#politicaCard");
    await expect(card).toBeVisible({ timeout: 15000 });
    await seed(page);
    return card;
  };

  test("vacío accionable, seis preguntas prerrellenas, firma, cartera frente a la política, consulta de operación, borrador, borrar y deshacer", async ({ page }) => {
    test.setTimeout(120000);
    const pageErrors = [];
    const dialogs = [];
    page.on("pageerror", (error) => pageErrors.push(String(error)));
    page.on("dialog", async (dialog) => { dialogs.push(dialog.message()); await dialog.dismiss(); });
    for (const viewport of [{ width: 1280, height: 900 }, { width: 390, height: 844 }]) {
      await page.setViewportSize(viewport);
      const card = await open(page);
      const body = card.locator("#politicaCuerpo");
      await expect(body.locator('[data-estado="vacio"]')).toContainText("Todavía no habéis escrito vuestra política");
      await expect(body.locator('[data-estado="vacio"]')).toContainText("tu reparto objetivo");
      await body.locator('[data-estado-accion="politica-empezar"]').click();

      // Prerrellena con lo ya declarado y avisa de lo que falta.
      await expect(body.locator('input[data-pol-path="allocation.targets.etf"]')).toHaveValue("70");
      await expect(body.locator('input[data-pol-path="allocation.targets.fondo"]')).toHaveValue("30");
      await expect(body.locator("[data-pol-suma]")).toContainText("Suma ahora: 100 %");
      await body.locator('input[data-pol-path="allocation.targets.fondo"]').fill("20");
      await expect(body.locator("[data-pol-suma]")).toContainText("tiene que ser 100 %");
      await body.locator('input[data-pol-path="allocation.targets.fondo"]').fill("30");
      await body.locator("[data-politica-firmar]").click();
      await expect(body.locator("[data-pol-aviso]")).toContainText("Falta responder: pregunta 1, pregunta 3");

      await body.locator('input[data-pol-path="purpose.text"]').fill("jubilación");
      await body.locator('input[data-pol-path="purpose.horizonYears"]').fill("20");
      await body.locator('select[data-pol-path="contribution.mode"]').selectOption("fixed");
      await body.locator('input[data-pol-path="contribution.monthly"]').fill("300");
      await body.locator('input[data-pol-path="exclusions.noCrypto"]').check();
      await body.locator('select[data-pol-path="drawdown.at35"]').selectOption("hold");
      await body.locator("[data-politica-firmar]").click();
      await expect(body.locator("[data-pol-aviso]")).toContainText("dos personas distintas");
      await body.locator('[data-pol-firma="0"]').fill("Ana");
      await body.locator('[data-pol-firma="1"]').fill("Ana");
      await body.locator("[data-politica-firmar]").click();
      await expect(body.locator("[data-pol-aviso]")).toContainText("dos personas distintas");
      await body.locator('[data-pol-firma="1"]').fill("Luis");
      await body.locator("[data-politica-firmar]").click();

      await expect(body.locator("[data-politica-estado]")).toHaveAttribute("data-politica-estado", "signed");
      await expect(body).toContainText("Firmada el");
      await expect(body).toContainText("Ana y Luis");
      await expect(body.locator(".pol-reglas li")).toHaveCount(7);
      await expect(body.locator(".pol-reglas")).toContainText("No compramos cripto");
      await expect(body.locator(".pol-ok")).toContainText("dentro de la política");

      // Consulta de operación: vender con una caída del 40 % contradice la regla de no vender.
      await body.locator(".pol-consulta summary").click();
      await body.locator("#politicaOpTipo").selectOption("sell");
      await body.locator("#politicaOpImporte").fill("500");
      await body.locator("#politicaOpCaida").fill("40");
      await body.locator("[data-politica-probar]").click();
      await expect(body.locator("[data-politica-veredicto]")).toHaveAttribute("data-politica-veredicto", "contradicts");
      await expect(body.locator("#politicaOpResultado")).toContainText("Regla 6");
      await body.locator("#politicaOpCaida").fill("");
      await body.locator("[data-politica-probar]").click();
      await expect(body.locator("[data-politica-veredicto]")).toHaveAttribute("data-politica-veredicto", "warns");
      await expect(body.locator("#politicaOpResultado")).toContainText("No sé cuánto ha caído");
      await body.locator("#politicaOpTipo").selectOption("buy");
      await body.locator("#politicaOpActivo").selectOption("cripto");
      await body.locator("[data-politica-probar]").click();
      await expect(body.locator("[data-politica-veredicto]")).toHaveAttribute("data-politica-veredicto", "contradicts");

      // Persiste al recargar (la cartera se vuelve a sembrar porque el almacén de pruebas es limpio por contexto).
      await page.reload();
      await expect(page.locator("#politicaCuerpo [data-politica-estado]")).toHaveAttribute("data-politica-estado", "signed");

      // Cambiar y guardar sin firmar deja un borrador; deshacer devuelve la firmada.
      await page.locator("[data-politica-editar]").click();
      await page.locator('input[data-pol-path="purpose.horizonYears"]').fill("25");
      await page.locator("[data-politica-guardar]").click();
      await expect(page.locator("#politicaCuerpo")).toContainText("Borrador sin firmar");
      await page.locator("#undoToastButton").click();
      await expect(page.locator("#politicaCuerpo")).toContainText("Firmada el");

      // Borrar con deshacer.
      await page.locator("[data-politica-borrar]").click();
      await expect(page.locator('#politicaCuerpo [data-estado="vacio"]')).toBeVisible();
      await page.locator("#undoToastButton").click();
      await expect(page.locator("#politicaCuerpo [data-politica-estado]")).toHaveAttribute("data-politica-estado", "signed");
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), `sin desbordar en ${viewport.width} px`).toBe(true);
    }
    expect(dialogs, "ningún confirm(): lo reversible se deshace").toEqual([]);
    expect(pageErrors, `errores de página: ${pageErrors.join(" | ")}`).toEqual([]);
  });

  test("una cartera fuera de la política se señala con su regla, y la revisión vencida se avisa; no se opera nada", async ({ page }) => {
    const card = await open(page);
    const body = card.locator("#politicaCuerpo");
    // Política firmada hace 13 meses y con «sin cripto»; la cartera tiene cripto.
    await page.evaluate(() => {
      const engine = FinanceCanonicalInvestmentPolicy;
      const policy = engine.normalizePolicy({ purpose: { text: "casa", horizonYears: 8 }, allocation: { targets: { etf: 70, fondo: 30 }, bandPct: 5 }, contribution: { mode: "surplus" }, exclusions: { noCrypto: true }, review: { everyMonths: 12 } });
      const signed = engine.sign(policy, { signers: ["Ana", "Luis"], today: "2025-09-01" }).policy;
      storageSet(storageKey("investment-policy"), JSON.stringify(signed));
      scenarioSettings.portfolioPositions = [
        { id: "p-etf", type: "etf", label: "ETF", quantity: 1, costBasis: 5000, currentValue: 5000, asOf: "2026-10-01" },
        { id: "p-cripto", type: "cripto", label: "Cripto", quantity: 1, costBasis: 2000, currentValue: 2000, asOf: "2026-10-01" },
        { id: "p-fondo", type: "fondo", label: "Fondo", quantity: 1, costBasis: 3000, currentValue: 3000, asOf: "2026-10-01" },
      ];
      saveScenarioSettings();
      renderPoliticaInversion(engine, true);
    });
    await expect(body.locator(".pol-revision")).toContainText("La revisión de la política está vencida");
    await expect(body.locator(".pol-fuera")).toContainText("se salen de la política");
    await expect(body.locator(".pol-fuera")).toBeVisible();
    await expect(body.locator(".pol-lista")).toContainText("Regla 4. Hay cripto");
    await expect(body.locator(".pol-lista")).toContainText("Hay cripto en la cartera");
    // No toca la cartera ni el reparto objetivo.
    const antes = await page.evaluate(() => JSON.stringify([scenarioSettings.portfolioPositions, scenarioSettings.portfolioTargets]));
    await body.locator(".pol-consulta summary").click();
    await body.locator("[data-politica-probar]").click();
    const despues = await page.evaluate(() => JSON.stringify([scenarioSettings.portfolioPositions, scenarioSettings.portfolioTargets]));
    expect(despues).toBe(antes);
  });
});

// WP-40 (DAC-01): conciliación del informe de la CIRBE con los contratos de Deuda › Contratos. Se teclea fila a fila; la app no se conecta a nada ni cambia
// ningún contrato: «Añadir a Contratos» solo rellena el formulario de alta que ya existe.
test.describe("WP-40 · conciliación con la CIRBE", () => {
  const open = async (page) => {
    await page.goto("/index.html#deuda-contratos");
    await page.reload();
    await page.evaluate(() => { try { localStorage.clear(); } catch { /* sin almacenamiento */ } });
    await page.reload();
    const card = page.locator("#cirbeCard");
    await expect(card).toBeVisible({ timeout: 15000 });
    return card;
  };
  const addRow = async (page, { persona = "Ana", entidad, tipo, titularidad = "titular", importe, vencido = "" }) => {
    await page.locator("#cirbePersona").fill(persona);
    await page.locator("#cirbeEntidad").fill(entidad);
    await page.locator("#cirbeTipo").selectOption(tipo);
    await page.locator("#cirbeTitularidad").selectOption(titularidad);
    await page.locator("#cirbeImporte").fill(String(importe));
    await page.locator("#cirbeVencido").fill(String(vencido));
    await page.locator('#cirbeForm button[type="submit"]').click();
  };

  test("vacío accionable, filas con validación, cuadra / difiere / falta, aval, vencido, añadir a Contratos sin crearlo, quitar y borrar con deshacer, sin confirm() ni desbordar", async ({ page }) => {
    test.setTimeout(120000);
    const pageErrors = [];
    const dialogs = [];
    page.on("pageerror", (error) => pageErrors.push(String(error)));
    page.on("dialog", async (dialog) => { dialogs.push(dialog.message()); await dialog.dismiss(); });
    for (const viewport of [{ width: 1280, height: 900 }, { width: 390, height: 844 }]) {
      await page.setViewportSize(viewport);
      const card = await open(page);
      const body = card.locator("#cirbeCuerpo");
      await expect(body.locator('[data-estado="vacio"]')).toContainText("Todavía no habéis traído el informe de la CIRBE");
      const contratosAntes = await page.evaluate(() => JSON.stringify(canonicalDebtContractRows().map((c) => [c.id, c.entity, c.currentPrincipal])));

      await body.locator('[data-estado-accion="cirbe-empezar"]').click();
      await expect(page.locator("#cirbeFecha")).toBeFocused();
      const hace60 = await page.evaluate(() => { const d = new Date(); d.setDate(d.getDate() - 60); return isoLocalDate(d); });
      await page.locator("#cirbeFecha").fill(hace60);
      await page.locator("#cirbeFecha").dispatchEvent("change");

      // Validación: una fila sin entidad o sin importe no entra.
      await page.locator("#cirbeTipo").selectOption("prestamo");
      await page.locator('#cirbeForm button[type="submit"]').click();
      await expect(page.locator("#cirbeError")).toContainText("Falta la entidad");
      await page.locator("#cirbeEntidad").fill("Cetelem");
      await page.locator('#cirbeForm button[type="submit"]').click();
      await expect(page.locator("#cirbeError")).toContainText("Falta el importe");

      await addRow(page, { entidad: "Cetelem", tipo: "prestamo", importe: 6100 });
      await addRow(page, { entidad: "Entidad B", tipo: "tarjeta", importe: 3000, vencido: 250 });
      await addRow(page, { entidad: "Wizink", tipo: "tarjeta", importe: 1800 });
      await addRow(page, { entidad: "Banco Fiador", tipo: "aval", importe: 20000 });

      const filas = body.locator(".cir-fila");
      await expect(body.locator('[data-cirbe-resumen="open"]')).toContainText("De 4 operaciones del informe: 1 cuadra, 1 difiere, 2 faltan en la app");
      await expect(body.locator('[data-cirbe-estado="fits"]')).toContainText("Cetelem");
      await expect(body.locator('[data-cirbe-estado="differs"]')).toContainText("La app tiene 500 € más que el informe");
      await expect(body.locator('[data-cirbe-estado="differs"]')).toContainText("El informe dice vencido: 250 €");
      await expect(body.locator('[data-cirbe-estado="missing-in-app"]').filter({ hasText: "Wizink" })).toContainText("Falta en la app");
      await expect(body.locator('[data-cirbe-estado="missing-in-app"]').filter({ hasText: "Banco Fiador" })).toContainText("No hay ningún aval declarado");
      await expect(body.locator('[data-cirbe-estado="missing-in-report"]')).toContainText("Entidad C");
      await expect(filas).toHaveCount(5);
      await expect(page.locator("#cirbeCard .cir-aviso")).toHaveCount(0); // 60 días: al día
      await expect(body).toContainText("Tiene 60 días");

      // «Añadir a Contratos» rellena el formulario de alta, no crea nada.
      await body.locator('[data-cirbe-anadir]').first().click();
      await expect(page.locator("#deudaContratosAddEntity")).toHaveValue("Wizink");
      await expect(page.locator("#deudaContratosAddPrincipal")).toHaveValue("1800");
      expect(await page.evaluate(() => JSON.stringify(canonicalDebtContractRows().map((c) => [c.id, c.entity, c.currentPrincipal])))).toBe(contratosAntes);

      // Persiste al recargar.
      await page.reload();
      await expect(page.locator('#cirbeCuerpo [data-cirbe-resumen="open"]')).toBeVisible();

      // Quitar una fila con deshacer.
      await page.locator("#cirbeCuerpo .cir-filas summary").click();
      await page.locator('[data-cirbe-quitar]').first().click();
      await expect(page.locator('#cirbeCuerpo [data-cirbe-resumen="open"]')).toContainText("De 3 operaciones");
      await page.locator("#undoToastButton").click();
      await expect(page.locator('#cirbeCuerpo [data-cirbe-resumen="open"]')).toContainText("De 4 operaciones");

      // Borrar el informe con deshacer.
      await page.locator("#cirbeCuerpo .cir-filas summary").click();
      await page.locator("[data-cirbe-borrar]").click();
      await expect(page.locator('#cirbeCuerpo [data-estado="vacio"]')).toBeVisible();
      await page.locator("#undoToastButton").click();
      await expect(page.locator('#cirbeCuerpo [data-cirbe-resumen="open"]')).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), `sin desbordar en ${viewport.width} px`).toBe(true);
    }
    expect(dialogs, "ningún confirm(): lo reversible se deshace").toEqual([]);
    expect(pageErrors, `errores de página: ${pageErrors.join(" | ")}`).toEqual([]);
  });

  test("un informe de hace más de un año se dice viejo, y a 30 días del año avisa de renovarlo; sin fecha, no concilia", async ({ page }) => {
    const card = await open(page);
    const body = card.locator("#cirbeCuerpo");
    const poner = async (dias) => {
      await page.evaluate((days) => {
        const d = new Date(); d.setDate(d.getDate() - days);
        storageSet(storageKey("cirbe-report"), JSON.stringify({ reportDate: isoLocalDate(d), rows: [{ id: "x", entity: "Cetelem", kind: "prestamo", amount: 6000 }] }));
        renderCirbe(FinanceCanonicalCirbe, true);
      }, dias);
    };
    await poner(400);
    await expect(body.locator(".cir-aviso")).toContainText("El informe tiene más de un año");
    await poner(345);
    await expect(body.locator(".cir-aviso")).toContainText("Toca pedir el informe otra vez");
    await page.evaluate(() => {
      storageSet(storageKey("cirbe-report"), JSON.stringify({ reportDate: "", rows: [{ id: "x", entity: "Cetelem", kind: "prestamo", amount: 6000 }] }));
      renderCirbe(FinanceCanonicalCirbe, true);
    });
    await expect(body.locator(".cir-aviso")).toContainText("Falta la fecha del informe");
    await expect(body.locator(".cir-fila")).toHaveCount(0);
  });
});

// WP-41 (DAC-04 + DNU-03): deuda en la sombra y TAE real, en Deuda › Contratos. Busca en el extracto lo que se comporta como deuda, propone el alta (sin darla) y
// calcula la TAE de una oferta «sin intereses».
async function seedSombra(page) {
  await page.evaluate(() => {
    const iso = (date) => isoLocalDate(date);
    const today = new Date();
    const back = (days) => iso(new Date(today.getFullYear(), today.getMonth(), today.getDate() - days));
    const rows = [];
    let balance = 3000;
    const add = (date, amount, movement) => rows.push({ date, month: date.slice(0, 7), movement, details: "", amount, balance: (balance += 1), accountId: "caixabank" });
    add(back(70), -30, "MOVISTAR CUOTA TERMINAL 1 DE 24");
    add(back(40), -30, "MOVISTAR CUOTA TERMINAL 2 DE 24");
    add(back(10), -30, "MOVISTAR CUOTA TERMINAL 3 DE 24");
    add(back(38), -49.9, "KLARNA PAGO 1 DE 3");
    add(back(8), -49.9, "KLARNA PAGO 2 DE 3");
    add(back(72), -25, "COMPRA FINANCIADA TIENDA FICTICIA");
    add(back(42), -25, "COMPRA FINANCIADA TIENDA FICTICIA");
    add(back(12), -25, "COMPRA FINANCIADA TIENDA FICTICIA");
    add(back(63), -12.99, "NETFLIX FICTICIO");
    add(back(33), -12.99, "NETFLIX FICTICIO");
    add(back(3), -12.99, "NETFLIX FICTICIO");
    add(back(32), -80, "CUOTA COMUNIDAD 2/12");
    add(back(2), -80, "CUOTA COMUNIDAD 3/12");
    baseData.transactions = mergeTransactions(baseData.transactions || [], rows);
    refreshMovementRollups();
    renderDeudaSombra(FinanceCanonicalShadowDebt);
  });
}

test.describe("WP-41 · deuda en la sombra y TAE real", () => {
  test("sin extracto se dice, con extracto señala lo que parece deuda (y no las suscripciones), propone el alta sin darla, responde con deshacer y calcula la TAE", async ({ page }) => {
    test.setTimeout(120000);
    const pageErrors = [];
    const dialogs = [];
    page.on("pageerror", (error) => pageErrors.push(String(error)));
    page.on("dialog", async (dialog) => { dialogs.push(dialog.message()); await dialog.dismiss(); });
    for (const viewport of [{ width: 1280, height: 900 }, { width: 390, height: 844 }]) {
      await page.setViewportSize(viewport);
      await page.goto("/index.html#deuda-contratos");
      await page.reload();
      await page.evaluate(() => { try { localStorage.clear(); } catch { /* sin almacenamiento */ } });
      await page.reload();
      const card = page.locator("#sombraCard");
      await expect(card).toBeVisible({ timeout: 15000 });
      await expect(card.locator("#sombraLista")).toContainText("No puedo mirar lo reciente");
      const contratosAntes = await page.evaluate(() => JSON.stringify(canonicalDebtContractRows().map((c) => [c.id, c.entity, c.currentPrincipal])));

      await seedSombra(page);
      const avisos = card.locator(".som-aviso");
      await expect(avisos).toHaveCount(3); // Netflix y la cuota de comunidad no se marcan
      await expect(avisos.nth(0)).toContainText("KLARNA PAGO 2 DE 3");
      await expect(avisos.nth(0)).toContainText("quedan 1 cuota");
      await expect(avisos.nth(1)).toContainText("MOVISTAR CUOTA TERMINAL 3 DE 24");
      await expect(avisos.nth(1)).toContainText("quedan 21 cuotas, 630 €");
      await expect(avisos.nth(2)).toContainText("COMPRA FINANCIADA");
      await expect(avisos.nth(2)).toContainText("no se sabe cuándo");
      await expect(card.locator(".som-resumen")).toContainText("3 compromisos que se comportan como deuda");
      await expect(card.locator(".som-resumen")).toContainText("Ninguno cuenta hoy en vuestra fecha libre de deuda");
      await expect(card.locator(".som-medida")).toContainText("hacen falta 10 respuestas y llevas 0");

      // PR-4: el cargo mensual sin pista (Netflix) no es un aviso, pero se enseña aparte, plegado y sin botones; la cuota de comunidad (dos cargos) no entra.
      const recurrentes = card.locator("#sombraRecurrentes");
      await expect(recurrentes).toHaveCount(1);
      await expect(recurrentes.locator("summary")).toContainText("1 cargo que se repite cada mes y que no he marcado");
      expect(await recurrentes.evaluate((el) => el.open), "llega plegada").toBe(false);
      await recurrentes.locator("summary").click();
      await expect(recurrentes.locator("li")).toHaveCount(1);
      await expect(recurrentes.locator("li")).toContainText("NETFLIX FICTICIO");
      await expect(recurrentes.locator("li")).toContainText("12,99");
      await expect(recurrentes.locator("button")).toHaveCount(0);
      await expect(recurrentes).not.toContainText("COMUNIDAD");

      // «Añadir a Contratos» rellena el formulario de alta, no crea nada.
      await avisos.nth(1).locator("[data-sombra-anadir]").click();
      await expect(page.locator("#deudaContratosAddEntity")).toHaveValue(/MOVISTAR/);
      await expect(page.locator("#deudaContratosAddPrincipal")).toHaveValue("630");
      await expect(page.locator("#deudaContratosAddPayment")).toHaveValue("30");
      await expect(page.locator("#deudaContratosAddInstallments")).toHaveValue("21");
      expect(await page.evaluate(() => JSON.stringify(canonicalDebtContractRows().map((c) => [c.id, c.entity, c.currentPrincipal])))).toBe(contratosAntes);

      // «No es deuda» + deshacer; la respuesta se recuerda al recargar.
      await avisos.nth(2).locator('[data-sombra-respuesta="not-debt"]').click();
      await expect(avisos).toHaveCount(2);
      expect(await recurrentes.evaluate((el) => el.open), "la lista abierta no se pliega al responder un aviso").toBe(true);
      await expect(card.locator("#sombraNota")).toContainText("no volveré a avisar");
      await card.locator("[data-sombra-deshacer]").click();
      await expect(avisos).toHaveCount(3);
      await card.locator(".som-aviso", { hasText: "COMPRA FINANCIADA" }).locator('[data-sombra-respuesta="not-debt"]').click();
      await page.reload();
      await seedSombra(page);
      await expect(page.locator("#sombraCard .som-aviso")).toHaveCount(2);

      // Calculadora preparada desde un aviso: falta el precio al contado.
      await page.locator("#sombraCard .som-aviso", { hasText: "MOVISTAR" }).locator("[data-sombra-tae]").click();
      await expect(page.locator("#sombraCuota")).toHaveValue("30");
      await expect(page.locator("#sombraPlazos")).toHaveValue("24");
      await page.locator('#sombraForm button[type="submit"]').click();
      await expect(page.locator("#sombraError")).toContainText("precio al contado");
      await page.locator("#sombraPrecio").fill("600");
      await page.locator('#sombraForm button[type="submit"]').click();
      await expect(page.locator("#sombraResultado .som-tae")).toContainText("120 € más que al contado");
      await expect(page.locator("#sombraResultado .som-tae strong").first()).toContainText("TAE efectiva");
      const taeConsulta = Number(await page.locator("#sombraResultado .som-tae").getAttribute("data-sombra-tae-resultado"));
      expect(taeConsulta).toBeGreaterThan(5);

      // Oferta «al 0 %»: sin comisión es 0 %; con una comisión y un seguro, no.
      await page.locator("#sombraPrecio").fill("1000");
      await page.locator("#sombraPlazos").fill("10");
      await page.locator("#sombraCuota").fill("100");
      await page.locator('#sombraForm button[type="submit"]').click();
      await expect(page.locator("#sombraResultado .som-tae")).toHaveAttribute("data-sombra-tae-resultado", "0");
      await page.locator("#sombraComision").fill("30");
      await page.locator("#sombraSeguro").fill("3");
      await page.locator('#sombraForm button[type="submit"]').click();
      expect(Number(await page.locator("#sombraResultado .som-tae").getAttribute("data-sombra-tae-resultado"))).toBeGreaterThan(10);
      await expect(page.locator("#sombraResultado")).toContainText("más que al contado");
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), `sin desbordar en ${viewport.width} px`).toBe(true);
    }
    expect(dialogs, "ningún confirm()").toEqual([]);
    expect(pageErrors, `errores de página: ${pageErrors.join(" | ")}`).toEqual([]);
  });
});

// WP-42 (CAR-03 + NIN-05 + NIN-08): ¿dónde va el próximo euro?, en Deuda › Comparar. Orden colchón → deuda cara → pensión → amortizar o invertir; cada peldaño con su porqué y su
// liquidez; los tres beneficios (cierto, fiscal de una vez, esperado) por separado; nada se mueve. Las cifras de la app se fijan para que el reparto sea determinista.
test.describe("WP-42 · escalera del próximo euro", () => {
  const stub = async (page, { liquidity = 1000, floor = 3000, withholding = 37 } = {}) => {
    await page.evaluate(({ liquidity, floor, withholding }) => {
      globalThis.accountBalancesFromState = () => (liquidity === null ? { total: null } : { total: liquidity });
      globalThis.cuadroMandosReserve = () => floor;
      globalThis.canonicalDebtContractRows = () => [{ id: "t1", entity: "Tarjeta Ficticia", type: "Tarjeta", paymentStatus: "active", currentPrincipal: 1000, apr: 21, fiscalDeductionPct: 0 }];
      state.fiscalWithholdingRate = withholding;
      state.dividendSpanishSavingsRatePct = 19;
      renderProximoEuro(FinanceCanonicalNextEuro);
    }, { liquidity, floor, withholding });
  };
  const open = async (page) => {
    await page.goto("/index.html#deuda-comparar");
    await page.reload();
    await page.evaluate(() => { try { localStorage.clear(); } catch { /* sin almacenamiento */ } });
    await page.reload();
    const card = page.locator("#proxEuroCard");
    await expect(card).toBeVisible({ timeout: 15000 });
    return card;
  };

  test("vacío accionable, validación, orden de peldaños con su porqué, tres beneficios por separado, sin veredicto sin rentabilidad, parcial sin datos, persistencia, sin confirm() ni desbordar", async ({ page }) => {
    test.setTimeout(120000);
    const pageErrors = [];
    const dialogs = [];
    page.on("pageerror", (error) => pageErrors.push(String(error)));
    page.on("dialog", async (dialog) => { dialogs.push(dialog.message()); await dialog.dismiss(); });
    for (const viewport of [{ width: 1280, height: 900 }, { width: 390, height: 844 }]) {
      await page.setViewportSize(viewport);
      const card = await open(page);
      const out = card.locator("#proxEuroResultado");
      await stub(page);
      await expect(out.locator('[data-estado="vacio"]')).toContainText("¿Cuánto hay que colocar?");

      // Validación: sin importe no hay escalera.
      await card.locator('#proxEuroForm button[type="submit"]').click();
      await expect(card.locator("#proxEuroError")).toContainText("mayor que cero");
      await expect(out.locator(".peu-escalera")).toHaveCount(0);

      // 6.000 € de dinero nuevo con 1.000 € de liquidez y suelo de 3.000 €: colchón 2.000, la tarjeta del 21 % entera, pensión hasta el límite, el resto a invertir.
      await card.locator("#proxEuroImporte").fill("6000");
      await card.locator("#proxEuroRentabilidad").fill("7");
      await card.locator('#proxEuroForm button[type="submit"]').click();
      await expect(out.locator("[data-peu-rung]")).toHaveCount(4);
      expect(await out.locator("[data-peu-rung]").evaluateAll((nodes) => nodes.map((n) => n.dataset.peuRung))).toEqual(["cushion", "debt", "pension", "invest"]);
      await expect(out.locator('[data-peu-rung="cushion"]')).toContainText("Faltan 2000 € para el suelo del colchón");
      await expect(out.locator('[data-peu-rung="debt"]')).toContainText("Tarjeta Ficticia");
      await expect(out.locator('[data-peu-rung="debt"]')).toContainText("la liquida");
      await expect(out.locator('[data-peu-rung="debt"]')).toContainText("Pierdes liquidez");
      await expect(out.locator('[data-peu-rung="pension"]')).toContainText("Tipo marginal 37 %");
      await expect(out.locator('[data-peu-rung="pension"]')).toContainText("Inmovilizado hasta la jubilación");
      await expect(out.locator('[data-peu-rung="pension"]')).toContainText("difiere el impuesto");
      await expect(out.locator('[data-peu-rung="invest"]')).toContainText("no garantizada");
      await expect(out.locator(".peu-resumen")).toContainText("De 6.000 €");
      // Tres beneficios distintos, nunca sumados: 1.000 × 21 % = 210 de intereses; 1.500 × 37 % = 555 de ahorro fiscal; y la rentabilidad esperada de lo invertido.
      const beneficios = out.locator(".peu-beneficios li");
      await expect(beneficios).toHaveCount(3);
      await expect(beneficios.nth(0)).toContainText("Intereses que dejas de pagar (cierto)");
      await expect(beneficios.nth(0)).toContainText("210");
      await expect(beneficios.nth(1)).toContainText("555");
      await expect(beneficios.nth(2)).toContainText("no garantizada");
      await expect(out).toContainText("no se suman");

      // Persistencia: el importe y la rentabilidad vuelven al recargar, y la escalera se recalcula con las cifras de la app.
      await page.reload();
      await stub(page);
      await expect(page.locator("#proxEuroImporte")).toHaveValue("6000");
      await expect(page.locator("#proxEuroRentabilidad")).toHaveValue("7");
      await expect(page.locator("#proxEuroResultado [data-peu-rung]")).toHaveCount(4);

      // Sin rentabilidad esperada no hay veredicto: lo que sobra queda sin reparto, nunca un 50/50.
      await page.locator("#proxEuroRentabilidad").fill("");
      await page.locator('#proxEuroForm button[type="submit"]').click();
      await expect(page.locator('#proxEuroResultado [data-peu-rung="invest"]')).toContainText("Sin veredicto");
      await expect(page.locator('#proxEuroResultado [data-peu-rung="invest"]')).toContainText("no voy a inventar un 50/50");
      await expect(page.locator("#proxEuroResultado .peu-resumen")).toContainText("sin reparto");

      // Sin la liquidez de las cuentas, el colchón dice «no sé» y el reparto es parcial.
      await stub(page, { liquidity: null });
      await expect(page.locator('#proxEuroResultado [data-peu-rung="cushion"]')).toContainText("Sin datos");
      await expect(page.locator("#proxEuroResultado .peu-aviso")).toContainText("Reparto parcial");

      // No toca nada de la app: ni contratos ni saldos (solo el almacén propio de la tarjeta).
      expect(await page.evaluate(() => Object.keys(localStorage).filter((key) => /next-euro/.test(key)).length)).toBeGreaterThan(0);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(overflow, `sin desbordar en ${viewport.width} px`).toBeLessThanOrEqual(1);
    }
    expect(dialogs, "ningún confirm()").toEqual([]);
    expect(pageErrors).toEqual([]);
  });
});

// WP-43 (PRV-01): puente de previsión, en Plan › Previsión. En cada cierre se congela la previsión a 31/12; con dos cierres de un mismo año, la diferencia se reparte en una cascada que
// siempre cuadra. No modifica la previsión.
test.describe("WP-43 · puente de previsión", () => {
  const openPrevision = async (page) => {
    await page.goto("/index.html#plan");
    await page.reload();
    await page.evaluate(() => { try { localStorage.clear(); } catch { /* sin almacenamiento */ } });
    await page.reload();
    await page.locator('[data-plan-tab="prevision"]').click();
    const card = page.locator("#puenteCard");
    await expect(card).toBeVisible({ timeout: 15000 });
    return card;
  };

  test("vacío, congela la previsión real a 31/12, falta un segundo cierre, cascada que cuadra, comparar con otro cierre, tabla, sin tocar la previsión, sin confirm() ni desbordar", async ({ page }) => {
    test.setTimeout(120000);
    const pageErrors = [];
    const dialogs = [];
    page.on("pageerror", (error) => pageErrors.push(String(error)));
    page.on("dialog", async (dialog) => { dialogs.push(dialog.message()); await dialog.dismiss(); });
    for (const viewport of [{ width: 1280, height: 900 }, { width: 390, height: 844 }]) {
      await page.setViewportSize(viewport);
      const card = await openPrevision(page);
      const body = card.locator("#puenteCuerpo");
      await expect(body.locator('[data-estado="vacio"]')).toContainText("Todavía no hay ninguna previsión congelada");
      const fingerprintAntes = await page.evaluate(() => canonicalScenarioResults.base.forecast.fingerprint);

      // Congelar de verdad con la previsión de la app: la foto coincide con la liquidez de diciembre de la serie.
      const frozen = await page.evaluate(() => {
        const series = canonicalScenarioResults.base.forecast.series;
        const year = Number(series[0].monthKey.slice(0, 4));
        const closed = `${year}-09`;
        const ok = recordPuenteSnapshot(closed, `${year}-10-02T10:00:00Z`);
        renderPuentePrevision(FinanceCanonicalForecastBridge);
        const store = JSON.parse(localStorage.getItem(Object.keys(localStorage).find((key) => /forecast-bridge-snapshots/.test(key))) || "[]");
        return { ok, year, store, decemberLiquidity: series.find((row) => row.monthKey === `${year}-12`).totals.closingLiquidity };
      });
      expect(frozen.ok).toBe(true);
      expect(frozen.store).toHaveLength(1);
      expect(frozen.store[0].yearEndLiquidity).toBe(frozen.decemberLiquidity);
      expect(frozen.store[0].months.map((m) => m.monthKey)).toEqual([`${frozen.year}-10`, `${frozen.year}-11`, `${frozen.year}-12`]);
      await expect(body).toContainText("preveíais acabar");
      await expect(body.locator('[data-estado="vacio"]')).toContainText("Falta un segundo cierre");

      // Un segundo cierre del mismo año (previsión algo peor: un extraordinario nuevo en diciembre y menos ingresos en noviembre) → la cascada.
      await page.evaluate(() => {
        const engine = FinanceCanonicalForecastBridge;
        const series = JSON.parse(JSON.stringify(canonicalScenarioResults.base.forecast.series));
        const year = Number(series[0].monthKey.slice(0, 4));
        let shift = 0;
        series.forEach((row) => {
          if (row.monthKey === `${year}-11`) { row.totals.income -= 300; row.components.income.recurrence -= 300; shift -= 300; }
          if (row.monthKey === `${year}-12`) { row.totals.outflowsBeforeSaving += 1000; row.components.outflow.project = 1000; shift -= 1000; }
          if (row.monthKey >= `${year}-11`) row.totals.closingLiquidity += shift;
        });
        const result = engine.freezeYearEnd({ monthKey: `${year}-10`, closedAt: `${year}-11-02T10:00:00Z`, series, actuals: { income: 5000, recurring: 4250, debt: 480 } });
        puenteSave(engine.upsert(puenteLoad(), result.snapshot));
        renderPuentePrevision(engine);
      });
      await expect(body.locator(".pte-frase")).toContainText("empeora");
      await expect(body.locator(".pte-frase")).toContainText("por extraordinarios");
      await expect(body.locator(".pte-aviso")).toContainText("Cambio relevante");
      await expect(body.locator(".analisis-cascada-row")).toHaveCount(7); // cinco causas + el total (A-4 lo pinta dentro de un contenedor que también es una fila)
      await expect(body.locator(".pte-cascada")).toContainText("Extraordinarios");
      await expect(body.locator(".pte-cascada")).toContainText("Otros y supuestos");
      await expect(body.locator(".pte-notas")).toContainText("cartera");
      // La tabla equivalente suma lo mismo que el total.
      await body.locator(".pte-tabla summary").click();
      const filas = await body.locator(".pte-tabla tbody tr").allInnerTexts();
      expect(filas).toHaveLength(6);
      expect(filas.at(-1)).toContain("Total");
      expect(filas.at(-1)).toContain("1.300\u00a0€");
      expect(filas.at(-1)).toContain("−");

      // Un tercer cierre (anterior) permite elegir con cuál comparar.
      await page.evaluate(() => {
        const engine = FinanceCanonicalForecastBridge;
        const series = canonicalScenarioResults.base.forecast.series;
        const year = Number(series[0].monthKey.slice(0, 4));
        const result = engine.freezeYearEnd({ monthKey: `${year}-08`, closedAt: `${year}-09-02T10:00:00Z`, series: [{ ...series[0], monthKey: `${year}-09` }, ...series] });
        puenteSave(engine.upsert(puenteLoad(), result.snapshot));
        renderPuentePrevision(engine);
      });
      await expect(body.locator("#puenteComparar")).toBeVisible();
      await expect(body.locator("#puenteComparar option")).toHaveCount(2);
      await body.locator("#puenteComparar").selectOption({ index: 1 });
      await expect(body.locator(".pte-frase")).toContainText("Desde agosto");
      await expect(body.locator(".pte-notas")).toContainText("hay cierres sin foto");

      // Explicar no cambia la previsión.
      expect(await page.evaluate(() => canonicalScenarioResults.base.forecast.fingerprint)).toBe(fingerprintAntes);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(overflow, `sin desbordar en ${viewport.width} px`).toBeLessThanOrEqual(1);
    }
    expect(dialogs, "ningún confirm()").toEqual([]);
    expect(pageErrors).toEqual([]);
  });
});

// WP-44 (CAR-02 + CAR-05 + CAR-06): calma en caídas, cobertura del gasto y depósitos por entidad, en Inversión › Cartera. Solo enseña cifras: no toca la cartera ni recomienda nada.
test.describe("WP-44 · calma, cobertura y exposición", () => {
  const open = async (page) => {
    await page.goto("/index.html#inversion-cartera");
    await page.reload();
    await page.evaluate(() => { try { localStorage.clear(); } catch { /* sin almacenamiento */ } });
    await page.reload();
    const card = page.locator("#calmaCard");
    await expect(card).toBeVisible({ timeout: 15000 });
    return card;
  };

  test("sin serie lo dice, mide la caída en mercado (no una aportación), cobertura con lo declarado, depósitos con titulares, valida la tasa, persiste, sin tocar la cartera, sin confirm() ni desbordar", async ({ page }) => {
    test.setTimeout(120000);
    const pageErrors = [];
    const dialogs = [];
    page.on("pageerror", (error) => pageErrors.push(String(error)));
    page.on("dialog", async (dialog) => { dialogs.push(dialog.message()); await dialog.dismiss(); });
    for (const viewport of [{ width: 1280, height: 900 }, { width: 390, height: 844 }]) {
      await page.setViewportSize(viewport);
      const card = await open(page);
      await expect(card.locator("#calmaCaida [data-estado=\"vacio\"]")).toContainText("Todavía no hay serie para medir una caída");
      await expect(card.locator("#calmaCaida")).toContainText("llevas 0");
      await expect(card.locator("#calmaCobertura")).toContainText("Todavía no puedo calcular");
      await expect(card.locator("#calmaCobertura")).toContainText("tasa de retirada");

      // Validación de la tasa y persistencia de lo tecleado.
      await card.locator("#calmaTasa").fill("20");
      await card.locator('#calmaForm button[type="submit"]').click();
      await expect(card.locator("#calmaError")).toContainText("entre 0 y 15");
      await card.locator("#calmaTasa").fill("4");
      await card.locator("#calmaTitulares-caixa").fill("2");
      await card.locator('#calmaForm button[type="submit"]').click();
      await expect(card.locator("#calmaError")).toBeHidden();
      await page.reload();
      await expect(page.locator("#calmaTasa")).toHaveValue("4");
      await expect(page.locator("#calmaTitulares-caixa")).toHaveValue("2");

      // Una cartera con tres valoraciones: 1.000 → 1.200 tras aportar 300 (el mercado hizo −100) → 700. Desde el máximo, el mercado resta 600 (60 %), no 500 (41,7 %) desde 1.200.
      const antes = await page.evaluate(() => {
        const iso = (days) => { const d = new Date(); d.setDate(d.getDate() + days); return isoLocalDate(d); };
        scenarioSettings.portfolioPositions = [{ id: "cal-a", type: "fondo", label: "Fondo de prueba", quantity: 0, costBasis: 1000, currentValue: 700, asOf: iso(-10), acquisitionDate: iso(-400), provenance: "declared", contributions: [{ id: "c1", date: iso(-55), amount: 300, quantity: 0 }] }];
        scenarioSettings.assets = [{ id: "cal-local", type: "inmueble", label: "Local de prueba", value: 100000, monthlyRentIncome: 300, provenance: "declared" }];
        saveScenarioSettings();
        savePortfolioValuations({ valuations: [
          { date: iso(-100), savedAt: new Date().toISOString(), points: [{ id: "cal-a", value: 1000, cost: 1000 }] },
          { date: iso(-40), savedAt: new Date().toISOString(), points: [{ id: "cal-a", value: 1200, cost: 1300 }] },
          { date: iso(-10), savedAt: new Date().toISOString(), points: [{ id: "cal-a", value: 700, cost: 1300 }] },
        ], timings: [] });
        globalThis.accountBalancesFromState = () => ({ caixa: 150000, mediolanum: 90000, total: 240000 });
        renderCalmaCobertura(FinanceCanonicalCalmCoverage);
        return JSON.stringify(scenarioSettings.portfolioPositions);
      });
      await expect(card.locator("#calmaCaida .cal-cifra")).toContainText("ha restado 600 €");
      await expect(card.locator("#calmaCaida .cal-cifra")).toContainText("60 %");
      await expect(card.locator("#calmaCaida")).toContainText("12 meses de aportación");
      await expect(card.locator("#calmaCaida")).toContainText("la media de lo aportado en los últimos 6 meses");
      await expect(card.locator("#calmaCaida")).toContainText("hablarlo las dos personas");
      await expect(card.locator("#calmaCaida")).toContainText("Habéis aportado 1.300 €");
      await expect(card.locator("#calmaCaida")).toContainText("no tengo una fuente histórica verificada");

      // Cobertura: alquiler declarado + 4 % de la cartera líquida (700 €); los dividendos no se suman.
      await expect(card.locator("#calmaCobertura .cal-cifra")).toContainText("pagan ya el");
      await expect(card.locator("#calmaCobertura .cal-lista")).toContainText("Alquiler neto");
      await expect(card.locator("#calmaCobertura .cal-lista")).toContainText("Retirada sostenible");
      await expect(card.locator("#calmaCobertura")).toContainText("Los dividendos no se suman aparte");

      // Depósitos: 150.000 € en CaixaBank con 2 titulares queda dentro de lo cubierto; 90.000 € en la otra, por debajo del límite individual.
      await expect(card.locator("#calmaDepositos")).toContainText("dentro de lo cubierto para 2 titulares");
      await expect(card.locator("#calmaDepositos")).toContainText("por debajo del límite individual");
      await card.locator("#calmaTitulares-caixa").fill("1");
      await card.locator('#calmaForm button[type="submit"]').click();
      await expect(card.locator("#calmaDepositos")).toContainText("50.000 € por encima de lo cubierto");
      await card.locator("#calmaTitulares-caixa").fill("");
      await card.locator('#calmaForm button[type="submit"]').click();
      await expect(card.locator("#calmaDepositos")).toContainText("no sé cuántos titulares");

      // Solo enseña cifras: la cartera no cambia, y no hay botones de vender ni comprar en la tarjeta.
      expect(await page.evaluate(() => JSON.stringify(scenarioSettings.portfolioPositions))).toBe(antes);
      await expect(card.getByRole("button", { name: /vender|comprar/i })).toHaveCount(0);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(overflow, `sin desbordar en ${viewport.width} px`).toBeLessThanOrEqual(1);
    }
    expect(dialogs, "ningún confirm()").toEqual([]);
    expect(pageErrors).toEqual([]);
  });
});

// WP-45 (ND-09 + CAP-07): frescura por fuente y cola de tareas de datos ordenada por «euros de incertidumbre por minuto», en Registrar › Saldos. No hace ninguna tarea ni guarda nada.
test.describe("WP-45 · frescura y cola de tareas de datos", () => {
  const open = async (page) => {
    // Los días 1-3 y 15-17 de cada mes la foto de liquidez (WP-12) y los motores escriben solos en el almacenamiento al abrir la app. Esta prueba
    // comprueba que la ficha NO guarda nada, así que se fija un día fuera de esas ventanas; sin esto fallaba (y el CI se ponía en rojo) seis días al mes.
    await page.clock.install({ time: new Date(2026, 9, 12, 12, 0, 0) });
    await page.goto("/index.html#registrar");
    await page.reload();
    await page.evaluate(() => { try { localStorage.clear(); } catch { /* sin almacenamiento */ } });
    await page.reload();
    const card = page.locator("#datosCard");
    await expect(card).toBeVisible({ timeout: 15000 });
    return card;
  };
  const stub = (page, { balanceAge, mode = "manual", statementAge, pending = 0, pulse = [], positions = false }) => page.evaluate(({ balanceAge, mode, statementAge, pending, pulse, positions }) => {
    const iso = (days) => { const d = new Date(); d.setDate(d.getDate() + days); return isoLocalDate(d); };
    state.balanceMode = mode;
    state.balanceDate = iso(-balanceAge);
    globalThis.canonicalLedgerTransactions = () => (statementAge === null ? [] : [{ date: iso(-statementAge) }]);
    globalThis.expectedMovementsResult = () => ({ status: "ok", items: Array.from({ length: pending }, (_, i) => ({ id: `p${i}`, plannedAmount: 100 })), overflow: 0 });
    globalThis.readBalancePulseTimes = () => ({ times: pulse.map((seconds) => ({ seconds })) });
    scenarioSettings.portfolioPositions = positions ? [{ id: "dat-a", type: "fondo", label: "Fondo de prueba", quantity: 0, costBasis: 1000, currentValue: 1000, asOf: iso(-50), acquisitionDate: iso(-400), provenance: "declared" }] : [];
    renderDatosCola(FinanceCanonicalDataQueue);
    const series = canonicalScenarioResults.base.forecast.series.slice(0, 12).map((row) => row.totals.outflowsBeforeSaving);
    return series.reduce((sum, value) => sum + value, 0) / series.length / 30;
  }, { balanceAge, mode, statementAge, pending, pulse, positions });

  test("seis fichas con edad, cola por euros por minuto con su tiempo medido o supuesto, lo no estimable aparte, plazo de cierre, sin hacer nada ni guardar, sin confirm() ni desbordar", async ({ page }) => {
    test.setTimeout(120000);
    const pageErrors = [];
    const dialogs = [];
    page.on("pageerror", (error) => pageErrors.push(String(error)));
    page.on("dialog", async (dialog) => { dialogs.push(dialog.message()); await dialog.dismiss(); });
    for (const viewport of [{ width: 1280, height: 900 }, { width: 390, height: 844 }]) {
      await page.setViewportSize(viewport);
      const card = await open(page);
      const storageAntes = await page.evaluate(() => JSON.stringify(Object.entries(localStorage).sort()));
      // Saldos de hace 10 días, extracto de hace 6, 3 cobros o cargos sin responder, sin tiempos medidos.
      const daily = await stub(page, { balanceAge: 10, statementAge: 6, pending: 3, positions: true });
      await expect(card.locator("[data-dat-ficha]")).toHaveCount(6);
      await expect(card.locator('[data-dat-ficha="balances"]')).toContainText("hace 10 días");
      await expect(card.locator('[data-dat-ficha="balances"]')).toContainText("Antiguo");
      await expect(card.locator('[data-dat-ficha="balances"] .dat-icono')).toHaveText("⚠");
      await expect(card.locator('[data-dat-ficha="statement"]')).toContainText("hace 6 días");
      await expect(card.locator('[data-dat-ficha="pending"]')).toContainText("3 por responder");
      await expect(card.locator('[data-dat-ficha="valuation"]')).toContainText("hace 50 días");
      // Orden por incertidumbre por minuto: saldos (≈ 1.577 € en 20 s) > cobros esperados (300 € en 30 s) > extracto (≈ 946 € en 2 min).
      expect(await card.locator("ol.dat-lista > li").evaluateAll((nodes) => nodes.map((n) => n.dataset.datTarea))).toEqual(["balances", "pending", "statement"]);
      const euros = Math.round(daily * 10); // 10 días × el gasto diario medio de la previsión
      await expect(card.locator('[data-dat-tarea="balances"]')).toContainText(new RegExp(`hasta\\s*${String(euros)[0]}\\.?${String(euros)[1]}\\d\\d(,\\d\\d)?\\s€`));
      await expect(card.locator('[data-dat-tarea="balances"]')).toContainText("20 s (sin medir: supuesto)");
      await expect(card.locator('[data-dat-tarea="balances"]')).toContainText("Puede moverse hasta");
      await expect(card.locator(".dat-plan")).toContainText("Con 3 minutos hoy");
      await expect(card.locator(".dat-plan")).toContainText("actualizar saldos");
      await expect(card.locator(".dat-plan")).toContainText("supuesto, no una medida");
      // Lo que no se sabe estimar va aparte, con su motivo, y no entra en el orden.
      await expect(card.locator("h4", { hasText: "Sin estimar" })).toBeVisible();
      await expect(card.locator('[data-dat-tarea="valuation"]')).toContainText("No sé cuánto se ha movido");
      expect(await card.locator("ol.dat-lista > li").evaluateAll((nodes) => nodes.map((n) => n.dataset.datTarea))).not.toContain("valuation");

      // Con tres usos medidos, el tiempo pasa a ser el medido (la mediana).
      await stub(page, { balanceAge: 10, statementAge: 6, pending: 3, pulse: [12, 18, 30], positions: true });
      await expect(card.locator('[data-dat-tarea="balances"]')).toContainText("18 s (medido, 3 usos)");

      // Saldos calculados por calendario: sin foto del banco no hay estimación, y se dice.
      await stub(page, { balanceAge: 10, mode: "auto", statementAge: 6, pending: 0, positions: true });
      await expect(card.locator('[data-dat-tarea="balances"]')).toContainText("se calculan por calendario");
      expect(await card.locator("ol.dat-lista > li").evaluateAll((nodes) => nodes.map((n) => n.dataset.datTarea))).toEqual(["statement"]);

      // El plazo de cierre solo existe los días 1 a 3 y mientras el mes que acaba no esté cerrado.
      const plazos = await page.evaluate(() => [datosCloseDeadline("2026-11-02", "2026-09"), datosCloseDeadline("2026-11-10", "2026-09"), datosCloseDeadline("2026-11-02", "2026-10"), datosCloseDeadline("2026-11-03", null)]);
      expect(plazos[0]?.key).toBe("2026-10");
      expect(plazos[1]).toBeNull();
      expect(plazos[2]).toBeNull();
      expect(plazos[3]?.key).toBe("2026-10");

      // Solo enseña y enlaza: ningún botón de guardar, y no cambia lo guardado.
      await expect(card.locator(".dat-ir").first()).toBeVisible();
      expect(await card.locator(".dat-ir").evaluateAll((nodes) => nodes.every((n) => n.tagName === "A" && n.getAttribute("href").startsWith("#")))).toBe(true);
      await expect(card.getByRole("button")).toHaveCount(0);
      expect(await page.evaluate(() => JSON.stringify(Object.entries(localStorage).sort()))).toBe(storageAntes);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(overflow, `sin desbordar en ${viewport.width} px`).toBeLessThanOrEqual(1);
    }
    expect(dialogs, "ningún confirm()").toEqual([]);
    expect(pageErrors).toEqual([]);
  });
});

// WP-46 (NPV-10): patrimonio neto, serie por cierres y proyección en tres escenarios, en Inversión › Cartera. No cambia ningún dato; no supone ningún rendimiento de mercado.
test.describe("WP-46 · patrimonio neto: serie y proyección", () => {
  const open = async (page) => {
    await page.goto("/index.html#inversion-cartera");
    await page.reload();
    await page.evaluate(() => { try { localStorage.clear(); } catch { /* sin almacenamiento */ } });
    await page.reload();
    const card = page.locator("#patrimonioCard");
    await expect(card).toBeVisible({ timeout: 15000 });
    return card;
  };
  const seed = (page) => page.evaluate(() => {
    scenarioSettings.assets = [
      { id: "pat-casa", type: "inmueble", label: "Vivienda de prueba", value: 150000, provenance: "declared" },
      { id: "pat-cuenta", type: "cuenta", label: "Cuenta vieja", value: 3000, provenance: "declared" },
    ];
    scenarioSettings.portfolioPositions = [{ id: "pat-a", type: "fondo", label: "Fondo de prueba", quantity: 0, costBasis: 18000, currentValue: 20000, asOf: "2026-10-01", acquisitionDate: "2025-01-01", provenance: "declared" }];
    saveScenarioSettings();
    globalThis.accountBalancesFromState = () => ({ caixa: 6000, mediolanum: 4000, total: 10000 });
    globalThis.totalDebtOutstanding = () => 12000;
    renderPatrimonio(FinanceCanonicalNetWorth);
    return JSON.stringify(scenarioSettings.portfolioPositions);
  });

  test("hoy con lo que suma y lo que no, sin serie con menos de 3 cierres, serie con su cambio, proyección que no supone rendimientos, tres escenarios con hitos, valida y persiste, sin tocar datos, sin confirm() ni desbordar", async ({ page }) => {
    test.setTimeout(120000);
    const pageErrors = [];
    const dialogs = [];
    page.on("pageerror", (error) => pageErrors.push(String(error)));
    page.on("dialog", async (dialog) => { dialogs.push(dialog.message()); await dialog.dismiss(); });
    for (const viewport of [{ width: 1280, height: 900 }, { width: 390, height: 844 }]) {
      await page.setViewportSize(viewport);
      const card = await open(page);
      const antes = await seed(page);
      // Hoy: 10.000 + 20.000 + 150.000 − 12.000; la «Cuenta vieja» (tipo cuenta) no suma porque el efectivo ya entra por los saldos.
      await expect(card.locator("#patrimonioHoy .pat-cifra")).toContainText("168.000 €");
      await expect(card.locator("#patrimonioHoy")).toContainText("Deuda pendiente");
      await expect(card.locator("#patrimonioHoy")).toContainText("No sumo");
      await expect(card.locator("#patrimonioHoy")).toContainText("Cuenta vieja");

      // Serie: sin fotos, con 2 (no es serie) y con 3 (sí).
      await expect(card.locator("#patrimonioSerie [data-estado=\"vacio\"]")).toContainText("Todavía no hay ninguna foto del patrimonio");
      const snap = (month, cash) => page.evaluate(({ month, cash }) => recordPatrimonioSnapshot(month, `${month}-28T10:00:00Z`, { total: cash }), { month, cash });
      expect(await snap("2026-08", 9000)).toBe(true);
      expect(await snap("2026-09", 9500)).toBe(true);
      await page.evaluate(() => renderPatrimonio(FinanceCanonicalNetWorth));
      await expect(card.locator("#patrimonioSerie")).toContainText("Hacen falta 3 cierres completos y llevas 2");
      await expect(card.locator("#patrimonioSerie .ck-figure")).toHaveCount(0);
      expect(await snap("2026-10", 10500)).toBe(true);
      await page.evaluate(() => renderPatrimonio(FinanceCanonicalNetWorth));
      await expect(card.locator("#patrimonioSerie .ck-frase")).toContainText("Patrimonio neto");
      await expect(card.locator("#patrimonioSerie .ck-figure")).toHaveCount(1);
      await expect(card.locator("#patrimonioSerie")).toContainText("Último cambio");
      await expect(card.locator("#patrimonioSerie")).toContainText("Efectivo en cuentas +");
      // La foto congela el efectivo REAL del cierre (los saldos guardados), no el de hoy.
      const store = await page.evaluate(() => patrimonioLoad().snapshots.map((s) => [s.monthKey, s.cash, s.net]));
      expect(store).toEqual([["2026-10", 10500, 168500], ["2026-09", 9500, 168500 - 1000], ["2026-08", 9000, 168500 - 1500]]);

      // Proyección sin supuestos: nada de rendimientos inventados, y se dice.
      await expect(card.locator("#patrimonioProyeccion .pat-aviso")).toContainText("Faltan supuestos");
      await expect(card.locator("#patrimonioProyeccion .ck-frase")).toContainText("los tres escenarios coinciden");
      await expect(card.locator("#patrimonioProyeccion")).toContainText("Deuda cero");

      // Validación, supuestos de tres escenarios y objetivo.
      await card.locator("#patrimonioRend-low").fill("80");
      await card.locator('#patrimonioForm button[type="submit"]').click();
      await expect(card.locator("#patrimonioError")).toContainText("no es creíble");
      const set = async (id, value) => { await card.locator(`#${id}`).fill(String(value)); };
      await set("patrimonioRend-low", 1); await set("patrimonioReval-low", 0);
      await set("patrimonioRend-base", 4); await set("patrimonioReval-base", 2);
      await set("patrimonioRend-high", 7); await set("patrimonioReval-high", 4);
      await set("patrimonioObjetivo", 200000);
      await card.locator('#patrimonioForm button[type="submit"]').click();
      await expect(card.locator("#patrimonioError")).toBeHidden();
      await expect(card.locator("#patrimonioProyeccion .pat-aviso")).toHaveCount(0);
      await expect(card.locator("#patrimonioProyeccion .ck-frase")).toContainText("estaría entre");
      await expect(card.locator("#patrimonioProyeccion")).toContainText("Prudente: llega a 200.000 €");
      await expect(card.locator("#patrimonioProyeccion")).toContainText("Optimista: llega a 200.000 €");
      await expect(card.locator("#patrimonioProyeccion .ck-figure")).toHaveCount(1);
      await expect(card.locator("#patrimonioProyeccion")).toContainText("El abanico es de supuestos tecleados");
      // Tabla alternativa: un año por fila, 10 años.
      await card.locator("#patrimonioProyeccion .ck-tabla summary").click();
      await expect(card.locator("#patrimonioProyeccion .ck-tabla tbody tr")).toHaveCount(10);

      // Persisten tras recargar (y la serie, que está en la misma copia).
      await page.reload();
      await expect(page.locator("#patrimonioRend-base")).toHaveValue("4");
      await expect(page.locator("#patrimonioObjetivo")).toHaveValue("200000");
      expect(await page.evaluate(() => patrimonioLoad().snapshots.length)).toBe(3);

      // Solo explica: no cambia la cartera ni los activos.
      expect(await page.evaluate(() => JSON.stringify(scenarioSettings.portfolioPositions))).toBe(antes);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(overflow, `sin desbordar en ${viewport.width} px`).toBeLessThanOrEqual(1);
    }
    expect(dialogs, "ningún confirm()").toEqual([]);
    expect(pageErrors).toEqual([]);
  });
});

// WP-47 (NPV-05): repartir la nómina en un paso, en Deuda › Comparar. Parte de la escalera (WP-42) y de la holgura sobre el suelo (banda de WP-16); los «steppers» mueven dinero con
// «sin repartir» sin cambiar el total; «Aplicar» solo guarda un borrador con una lista de transferencias (nada se mueve ni se anota). El real de la nómina se registra sobre una fila REAL
// de la demo; las cifras de la escalera y de la holgura se fijan para que el reparto sea determinista.
test.describe("WP-47 · reparto de la nómina", () => {
  const prepare = async (page, { headroom = 1200 } = {}) => {
    await page.evaluate(({ headroom }) => {
      globalThis.accountBalancesFromState = () => ({ total: 4000 });
      globalThis.cuadroMandosReserve = () => 3000;
      globalThis.canonicalDebtContractRows = () => [
        { id: "t1", entity: "Tarjeta Ficticia", type: "Tarjeta", paymentStatus: "active", currentPrincipal: 400, apr: 21, fiscalDeductionPct: 0 },
        { id: "p1", entity: "Préstamo Ficticio", type: "Préstamo", paymentStatus: "active", currentPrincipal: 5000, apr: 3, fiscalDeductionPct: 0 },
      ];
      state.fiscalWithholdingRate = 37;
      state.dividendSpanishSavingsRatePct = 19;
      // La demo no tiene una partida llamada «nómina»: el reconocimiento por nombre se prueba aparte (unitaria); aquí se reconoce la primera fila de ingresos.
      const original = window.__nominaConfirmedOriginal || nominaConfirmed;
      window.__nominaConfirmedOriginal = original;
      globalThis.nominaConfirmed = (today) => original(today, (label) => /Ingreso Persona A/.test(label));
      globalThis.nominaHeadroom = () => (headroom === null ? { headroom: null, reason: "no hay movimientos fechados en el plan" } : { headroom, floor: 1500, lowest: 1500 + headroom, staleDays: 0, declared: true, quality: "ok" });
      const month = monthByKey(isoLocalDate(new Date()).slice(0, 7));
      const row = planningSectionsForMonth("income", month)[0].rows[0];
      actualsForKind("income")[actualKeyForRow(row, month)] = 3000;
      renderNominaReparto(FinanceCanonicalPayrollSplit);
    }, { headroom });
  };
  const open = async (page) => {
    await page.goto("/index.html#deuda-comparar");
    await page.reload();
    await page.evaluate(() => { try { localStorage.clear(); } catch { /* sin almacenamiento */ } });
    await page.reload();
    const card = page.locator("#nominaCard");
    await expect(card).toBeVisible({ timeout: 15000 });
    return card;
  };
  const row = (card, id) => card.locator(`[data-nom-row="${id}"]`);

  test("vacío accionable, disponible limitado por el suelo, steppers que conservan el total, topes, restablecer, aplicar guarda solo una lista, hecha, descartar y deshacer, sin confirm() ni desbordar", async ({ page }) => {
    test.setTimeout(150000);
    const pageErrors = [];
    const dialogs = [];
    page.on("pageerror", (error) => pageErrors.push(String(error)));
    page.on("dialog", async (dialog) => { dialogs.push(dialog.message()); await dialog.dismiss(); });
    for (const viewport of [{ width: 1280, height: 900 }, { width: 390, height: 844 }]) {
      await page.setViewportSize(viewport);
      const card = await open(page);
      const body = card.locator("#nominaCuerpo");
      // Sin nómina confirmada no hay nada que repartir, y se dice cómo se reconoce una.
      await expect(body.locator('[data-estado="vacio"]')).toContainText("Ninguna nómina por repartir");
      await expect(body).toContainText("«nómina», «salario» o «sueldo»");

      await prepare(page, { headroom: 1200 });
      await expect(body.locator(".nom-fuentes li")).toHaveCount(1);
      await expect(body.locator(".nom-fuentes li")).toContainText("3.000 €");
      // Disponible = lo menor entre la nómina y la holgura sobre el suelo; la banda solo recoge fechas.
      await expect(body.locator(".nom-disponible")).toContainText("Disponible para repartir: 1.200 €");
      await expect(body.locator(".nom-disponible")).toContainText("limitado por el suelo");
      await expect(body).toContainText("solo caben 1200 € por encima del suelo");
      await expect(body).toContainText("solo recoge la incertidumbre de las fechas");
      // Filas de la escalera: la tarjeta cara entera (400) y la pensión con el resto (800); el colchón ya está completo.
      await expect(row(card, "cushion").locator("input")).toHaveValue("0");
      await expect(row(card, "debt:t1").locator("input")).toHaveValue("400");
      await expect(row(card, "pension").locator("input")).toHaveValue("800");
      await expect(row(card, "debt:p1").locator("input")).toHaveValue("0");
      await expect(row(card, "debt:p1")).toContainText("la escalera no propone nada aquí");
      await expect(body.locator(".nom-estado")).toContainText("Repartido todo: 1.200 €");

      // Con todo repartido, añadir más no cabe: el aviso lo dice y nada cambia.
      await row(card, "pension").locator('[data-nom-step="50"]').click();
      await expect(body.locator(".nom-nota")).toContainText("no queda más por repartir");
      await expect(row(card, "pension").locator("input")).toHaveValue("800");

      // Quitar 50 de la pensión: 50 quedan sin repartir y el total sigue siendo 1.200.
      await row(card, "pension").locator('[data-nom-step="-50"]').click();
      await expect(row(card, "pension").locator("input")).toHaveValue("750");
      await expect(row(card, "free")).toContainText("50 €");
      await expect(body.locator(".nom-estado")).toContainText("Quedan 50 €");
      await expect(row(card, "pension")).toContainText("distinto de lo sugerido (800 €");
      // El foco no se pierde al repintar.
      await expect(row(card, "pension").locator('[data-nom-step="-50"]')).toBeFocused();
      // Un importe escrito con coma española, que no cabe en lo que queda, se recorta.
      await row(card, "debt:p1").locator("input").fill("1.000,50");
      await row(card, "debt:p1").locator("input").press("Enter");
      await expect(row(card, "debt:p1").locator("input")).toHaveValue("50");
      // «1.000» sin decimales son mil (no uno): se recorta igual que «1.000,50».
      await row(card, "debt:p1").locator("input").fill("1.000");
      await row(card, "debt:p1").locator("input").press("Enter");
      await expect(row(card, "debt:p1").locator("input")).toHaveValue("50");
      await expect(body.locator(".nom-nota")).toContainText("no queda más por repartir");
      await expect(body.locator(".nom-estado")).toContainText("Repartido todo");
      // Un negativo se deja en 0.
      await row(card, "debt:p1").locator("input").fill("-20");
      await row(card, "debt:p1").locator("input").press("Enter");
      await expect(row(card, "debt:p1").locator("input")).toHaveValue("0");
      await expect(row(card, "free")).toContainText("50 €");

      // Restablecer vuelve a lo que sugiere la escalera.
      await card.locator('[data-nom-action="restablecer"]').click();
      await expect(row(card, "pension").locator("input")).toHaveValue("800");
      await expect(card.locator('[data-nom-action="restablecer"]')).toBeDisabled();

      // Aplicar: guarda el borrador y la lista; no se mueve dinero ni se anota nada en las cuentas.
      const before = await page.evaluate(() => ({ transactions: (baseData?.transactions || []).length, actual: actualAwareInfo(planningSectionsForMonth("income", monthByKey(isoLocalDate(new Date()).slice(0, 7)))[0].rows[0], monthByKey(isoLocalDate(new Date()).slice(0, 7))).actual }));
      await card.locator('[data-nom-action="aplicar"]').click();
      const draft = body.locator("[data-nom-draft]");
      await expect(draft).toHaveCount(1);
      await expect(draft.locator(".nom-transferencias li")).toHaveCount(2);
      await expect(draft.locator(".nom-transferencias li").first()).toContainText("Amortizar Tarjeta Ficticia");
      await expect(draft.locator(".nom-transferencias li").first()).toContainText("comisión por amortización anticipada");
      await expect(draft.locator(".nom-transferencias li").nth(1)).toContainText("Aportar al plan de pensiones");
      await expect(draft).toContainText("0 de 2 hechas");
      await expect(draft).toContainText("la app no sabe si la transferencia se hizo");
      await expect(body.locator('[data-estado="vacio"]')).toContainText("Ninguna nómina por repartir");
      const after = await page.evaluate(() => ({ transactions: (baseData?.transactions || []).length, actual: actualAwareInfo(planningSectionsForMonth("income", monthByKey(isoLocalDate(new Date()).slice(0, 7)))[0].rows[0], monthByKey(isoLocalDate(new Date()).slice(0, 7))).actual }));
      expect(after, "Aplicar no anota ningún movimiento ni toca el real de la nómina").toEqual(before);

      // «Hecha» es una casilla del hogar y se recuerda al recargar.
      await draft.locator("input[data-nom-done]").first().check();
      await expect(draft).toContainText("1 de 2 hechas");
      await page.reload();
      await prepare(page, { headroom: 1200 });
      await expect(page.locator("[data-nom-draft]")).toContainText("1 de 2 hechas");
      await expect(page.locator("[data-nom-draft] input[data-nom-done]").first()).toBeChecked();

      // Una segunda nómina (la de otra persona) no vuelve a ofrecer lo ya apuntado: 400 € de la tarjeta se hicieron hoy (los saldos son de hoy: reflejados) y quedan 800 € apuntados.
      await page.evaluate(() => {
        const original = window.__nominaConfirmedOriginal;
        globalThis.nominaConfirmed = (today) => original(today, (label) => /Ingreso Persona/.test(label));
        const month = monthByKey(isoLocalDate(new Date()).slice(0, 7));
        actualsForKind("income")[actualKeyForRow(planningSectionsForMonth("income", month)[0].rows[1], month)] = 2000;
        renderNominaReparto(FinanceCanonicalPayrollSplit);
      });
      await expect(page.locator("#nominaCuerpo .nom-fuentes li")).toHaveCount(1);
      await expect(page.locator("#nominaCuerpo .nom-fuentes li")).toContainText("Ingreso Persona B");
      await expect(page.locator("#nominaCuerpo .nom-disponible")).toContainText("Disponible para repartir: 400 €");
      await expect(page.locator("#nominaCuerpo")).toContainText("800 € apuntados en borradores abiertos");
      await prepare(page, { headroom: 1200 });

      // Deshacer el aviso de «Aplicar» no hace falta ya (expiró o se cambió de pantalla): descartar devuelve la nómina y se puede deshacer.
      await page.locator('[data-nom-action="descartar"]').click();
      await expect(page.locator("[data-nom-draft]")).toHaveCount(0);
      await expect(page.locator("#nominaCuerpo .nom-fuentes li")).toHaveCount(1);
      await page.getByRole("button", { name: "Deshacer" }).click();
      await expect(page.locator("[data-nom-draft]")).toHaveCount(1);
      await page.locator('[data-nom-action="descartar"]').click();

      // Apartar una nómina del reparto, con deshacer.
      await page.locator('[data-nom-action="ocultar"]').click();
      await expect(page.locator("#nominaCuerpo .nom-fuentes")).toHaveCount(0);
      await page.getByRole("button", { name: "Deshacer" }).click();
      await expect(page.locator("#nominaCuerpo .nom-fuentes li")).toHaveCount(1);

      // Sin nada por encima del suelo no hay nada que repartir hoy.
      await prepare(page, { headroom: -300 });
      await expect(page.locator("#nominaCuerpo")).toContainText("Hoy no hay nada que repartir");
      await expect(page.locator("#nominaCuerpo [data-nom-row]")).toHaveCount(0);
      // Si no se puede calcular la holgura, se reparte la nómina entera pero marcada «sin comprobar».
      await prepare(page, { headroom: null });
      await expect(page.locator("#nominaCuerpo .nom-disponible")).toContainText("Disponible para repartir: 3.000 €");
      await expect(page.locator("#nominaCuerpo")).toContainText("Sin comprobar");

      expect(await page.evaluate(() => Object.keys(localStorage).filter((key) => /payroll-split-drafts/.test(key)).length)).toBeGreaterThan(0);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(overflow, `sin desbordar en ${viewport.width} px`).toBeLessThanOrEqual(1);
    }
    expect(dialogs, "ningún confirm()").toEqual([]);
    expect(pageErrors).toEqual([]);
  });
});

// WP-48 (NIN-06): libro de operaciones editable, en Inversión › Cartera. Editar, añadir o quitar una compra o una venta enseña un «antes / después» (unidades, coste, plusvalía de cada venta y
// compensación del ejercicio) ANTES de guardar; una venta que se queda sin lotes se marca y no se bloquea; todo se deshace. Cifras calculadas a mano: lote 1 de 100 u a 10.000 € (2020),
// lote 2 de 50 u a 6.000 € (2021) y una venta de 120 u por 15.000 € en 2026 → coste FIFO 12.400 €, plusvalía 2.600 €, quedan 30 u a 3.600 €.
test.describe("WP-48 · libro de operaciones", () => {
  const POSITIONS = [
    { id: "A", type: "fondo", label: "Fondo A", provenance: "manual", asOf: "2026-09-01", acquisitionDate: "2020-01-10", quantity: 100, costBasis: 10000, currentValue: 5200, contributions: [{ id: "c1", date: "2021-06-01", amount: 6000, quantity: 50 }], disposals: [{ id: "s1", date: "2026-03-01", quantitySold: 120, saleProceeds: 15000 }] },
    { id: "B", type: "accion", label: "Acción B", provenance: "manual", asOf: "2026-09-01", acquisitionDate: "2020-01-01", quantity: 10, costBasis: 1000, currentValue: 0, contributions: [], disposals: [{ id: "b1", date: "2026-05-05", quantitySold: 10, saleProceeds: 2000 }] },
  ];
  const open = async (page) => {
    await page.goto("/index.html#inversion-cartera");
    await page.reload();
    await page.evaluate(() => { try { localStorage.clear(); } catch { /* sin almacenamiento */ } });
    await page.reload();
    const card = page.locator("#opsCard");
    await expect(card).toBeAttached({ timeout: 15000 });
    return card;
  };
  const seed = (page) => page.evaluate((positions) => { saveIv1PositionsList(positions); renderIv1PositionList(); }, POSITIONS);
  const stored = (page) => page.evaluate(() => JSON.parse(JSON.stringify(iv1PositionsList().find((position) => position.id === "A"))));
  const row = (card, id) => card.locator(`[data-ops-row="${id}"]`);
  const edit = async (card, id) => card.locator(`[data-ops-row="${id}"] [data-ops-action="edit"]`).click();
  const submit = async (card) => card.locator('#opsForm button[type="submit"]').click();

  test("vacío accionable, libro en orden con la plusvalía FIFO, edición con «antes / después» sin guardar, venta sin lotes marcada y no bloqueada, validación, quitar, añadir, deshacer, persistencia, sin confirm() ni desbordar", async ({ page }) => {
    test.setTimeout(150000);
    const pageErrors = [];
    const dialogs = [];
    page.on("pageerror", (error) => pageErrors.push(String(error)));
    page.on("dialog", async (dialog) => { dialogs.push(dialog.message()); await dialog.dismiss(); });
    for (const viewport of [{ width: 1280, height: 900 }, { width: 390, height: 844 }]) {
      await page.setViewportSize(viewport);
      const card = await open(page);
      const body = card.locator("#opsCuerpo");
      await expect(body.locator('[data-estado="vacio"]')).toContainText("Aún no hay posiciones");

      await seed(page);
      await expect(body.locator("[data-ops-row]")).toHaveCount(3);
      expect(await body.locator("[data-ops-row]").evaluateAll((nodes) => nodes.map((n) => n.dataset.opsRow))).toEqual(["initial", "c1", "s1"]);
      await expect(row(card, "s1")).toContainText("plusvalía FIFO 2.600 €");
      await expect(row(card, "initial").locator('[data-ops-action="remove"]')).toHaveCount(0);
      const original = await stored(page);

      // Editar el importe de la venta: el «antes / después» sale SIN guardar.
      await edit(card, "s1");
      await expect(card.locator("#opsFecha")).toHaveValue("2026-03-01");
      await card.locator("#opsImporte").fill("14.000");
      await submit(card);
      const cambios = body.locator(".ops-cambios");
      await expect(cambios).toContainText("Plusvalía realizada (FIFO)");
      await expect(cambios.locator(".ops-cambio").filter({ hasText: "Plusvalía realizada" })).toContainText("Antes: 2.600 €");
      await expect(cambios.locator(".ops-cambio").filter({ hasText: "Plusvalía realizada" })).toContainText("Después: 1.600 €");
      await expect(cambios.locator(".ops-cambio").filter({ hasText: "Ejercicio 2026" })).toContainText("Antes: neto 3.600 €");
      await expect(cambios.locator(".ops-cambio").filter({ hasText: "Ejercicio 2026" })).toContainText("Después: neto 2.600 €");
      await expect(body).toContainText("No se ha guardado nada todavía");
      expect(await stored(page), "ver los cambios no guarda").toEqual(original);
      await expect(card.locator('[data-ops-action="save"]')).toHaveText("Guardar los cambios");
      await card.locator('[data-ops-action="save"]').click();
      await expect(row(card, "s1")).toContainText("plusvalía FIFO 1.600 €");
      expect((await stored(page)).disposals[0].saleProceeds).toBe(14000);
      // El resto de la app sigue al libro: la lista de posiciones ya enseña la plusvalía nueva.
      await expect(page.locator("#iv1PositionList")).toContainText("plusvalía realizada 1.600 €");
      // Deshacer lo devuelve a como estaba.
      await page.getByRole("button", { name: "Deshacer" }).click();
      await expect(row(card, "s1")).toContainText("plusvalía FIFO 2.600 €");
      expect(await stored(page)).toEqual(original);

      // Mover la aportación a después de la venta deja la venta sin lotes: se avisa, no se bloquea, y «Volver a editar» conserva lo escrito.
      await edit(card, "c1");
      await card.locator("#opsFecha").fill("2026-06-01");
      await submit(card);
      await expect(body.locator(".ops-cambio").filter({ hasText: "Plusvalía realizada" })).toContainText("Después: no calculable");
      await expect(body.locator(".ops-cambio").filter({ hasText: "Venta del 01/03/2026" })).toContainText("sin lotes (faltan 20 u)");
      await expect(body.locator(".ops-cambio").filter({ hasText: "Ejercicio 2026" })).toContainText("no calculable");
      await expect(body.locator(".ops-aviso-fuerte")).toContainText("una venta se queda sin lotes");
      await expect(card.locator('[data-ops-action="save"]')).toHaveText("Guardar aunque deje ventas sin lotes");
      await card.locator('[data-ops-action="back"]').click();
      await expect(card.locator("#opsFecha")).toHaveValue("2026-06-01");
      await card.locator('[data-ops-action="cancel"]').click();
      await expect(card.locator("#opsForm")).toHaveCount(0);
      expect(await stored(page), "cancelar no guarda").toEqual(original);

      // Validación: fecha vacía y venta sin unidades.
      await edit(card, "c1");
      await card.locator("#opsFecha").fill("");
      await submit(card);
      await expect(card.locator("#opsError")).toContainText("fecha");
      await card.locator('[data-ops-action="cancel"]').click();
      await edit(card, "s1");
      await card.locator("#opsUnidades").fill("0");
      await submit(card);
      await expect(card.locator("#opsError")).toContainText("unidades vendidas");
      await card.locator('[data-ops-action="cancel"]').click();

      // Quitar la aportación: el cambio sale directo, sin editor, y se guarda al confirmar.
      await row(card, "c1").locator('[data-ops-action="remove"]').click();
      await expect(body.locator(".ops-cambio").filter({ hasText: "Unidades que quedan" })).toContainText("Después: 0");
      await expect(card.locator('[data-ops-action="back"]')).toHaveCount(0);
      await expect(card.locator('[data-ops-action="save"]')).toHaveText("Guardar aunque deje ventas sin lotes");
      await card.locator('[data-ops-action="save"]').click();
      await expect(body.locator("[data-ops-row]")).toHaveCount(2);
      await expect(row(card, "s1")).toContainText("sin lotes suficientes (faltan 20 u)");
      await page.getByRole("button", { name: "Deshacer" }).click();
      await expect(body.locator("[data-ops-row]")).toHaveCount(3);
      expect(await stored(page)).toEqual(original);

      // Añadir una segunda venta de las 30 u que quedan: 30 × 120 € = 3.600 € de coste → plusvalía 400 €; la posición queda a cero.
      await card.locator('[data-ops-action="add-sell"]').click();
      await card.locator("#opsFecha").fill("2026-04-01");
      await card.locator("#opsUnidades").fill("30");
      await card.locator("#opsImporte").fill("4000");
      await submit(card);
      await expect(body.locator(".ops-cambio").filter({ hasText: "· nueva" })).toContainText("Después: 400 €");
      await expect(body.locator(".ops-cambio").filter({ hasText: "Unidades que quedan" })).toContainText("Después: 0");
      await card.locator('[data-ops-action="save"]').click();
      await expect(body.locator('[data-ops-kind="disposal"]')).toHaveCount(2);
      // Persiste al recargar.
      await page.reload();
      await expect(page.locator('#opsCuerpo [data-ops-kind="disposal"]')).toHaveCount(2);
      await page.evaluate((positions) => { saveIv1PositionsList(positions); refreshAllSectionsAfterDataChange(); renderIv1PositionList(); }, POSITIONS);

      // La compra inicial se edita (no se quita): sin fecha no entra en el FIFO y se avisa; ponerle fecha lo arregla.
      await page.evaluate(() => { const rows = iv1PositionsList(); saveIv1PositionsList(rows.map((position) => (position.id === "A" ? { ...position, acquisitionDate: "" } : position))); renderIv1PositionList(); });
      await expect(card.locator("#opsCuerpo")).toContainText("La compra inicial no tiene fecha");
      await expect(row(card, "s1")).toContainText("sin lotes suficientes");
      await edit(card, "initial");
      await card.locator("#opsFecha").fill("2020-01-10");
      await submit(card);
      await expect(body).toContainText("Esto arregla 1 venta");
      await card.locator('[data-ops-action="save"]').click();
      await expect(row(card, "s1")).toContainText("plusvalía FIFO 2.600 €");

      // Cambiar de posición reinicia el editor; la otra posición cuenta en la compensación del ejercicio.
      await card.locator("#opsPosicion").selectOption("B");
      await expect(body.locator("[data-ops-row]")).toHaveCount(2);
      await card.locator("#opsPosicion").selectOption("A");
      await edit(card, "s1");
      await card.locator("#opsImporte").fill("14000");
      await submit(card);
      await expect(body.locator(".ops-cambio").filter({ hasText: "Ejercicio 2026" })).toContainText("Antes: neto 3.600 €");
      await card.locator('[data-ops-action="cancel"]').click();

      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(overflow, `sin desbordar en ${viewport.width} px`).toBeLessThanOrEqual(1);
    }
    expect(dialogs, "ningún confirm()").toEqual([]);
    expect(pageErrors).toEqual([]);
  });
});

// WP-49 (NPV-04): mapa anual de pagos grandes, en Plan › Previsión. Junta partidas del plan que pesan de golpe, seguros con fecha, objetivos con fecha y la Renta, y dice cuánto hay reservado de
// cada uno (solo los objetivos tienen dinero declarado). Solo enseña: no reserva ni guarda nada.
test.describe("WP-49 · mapa anual de pagos grandes", () => {
  const openPrevision = async (page) => {
    await page.goto("/index.html#plan");
    await page.reload();
    await page.evaluate(() => { try { localStorage.clear(); } catch { /* sin almacenamiento */ } });
    await page.reload();
    await page.locator('[data-plan-tab="prevision"]').click();
    const card = page.locator("#mapaPagosCard");
    await expect(card).toBeVisible({ timeout: 15000 });
    return card;
  };
  // Datos relativos a hoy (la prueba no caduca): un seguro declarado dentro de 3 meses (410 €) que además está en el plan; una partida suelta de 900 € dentro de 5 meses; un objetivo de 3.000 € con
  // 1.200 € ahorrados dentro de 8 meses; un fondo de emergencia (no es un pago); un seguro pequeño (90 €) y otro sin fecha.
  const seed = (page) => page.evaluate(() => {
    const at = (offset, day = 5) => { const date = addMonths(new Date(), offset); return { key: monthKey(date), iso: `${monthKey(date)}-${String(day).padStart(2, "0")}` }; };
    const hogar = at(3);
    insurancePolicies().push(
      { id: "e2e-hogar", name: "Seguro del hogar", renewalDate: hogar.iso, premium: 410 },
      { id: "e2e-movil", name: "Seguro del móvil", renewalDate: at(1).iso, premium: 90 },
      { id: "e2e-roto", name: "Seguro sin fecha", renewalDate: "", premium: 200 },
    );
    saveScenarioSettings();
    customPlanningRows.push(
      { id: "e2e-ibi", custom: true, kind: "expense", sectionName: "Gastos fijos", label: "IBI", monthKey: at(5).key, plannedValue: 900 },
      { id: "e2e-hogar-plan", custom: true, kind: "expense", sectionName: "Gastos fijos", label: "Seguro del hogar", monthKey: hogar.key, plannedValue: 410 },
    );
    const goal = (id, name, type, target, targetDate, saved) => ({ id, name, type, target, targetDate, status: "active", contributions: saved ? [{ id: `${id}-c`, amount: saved, date: "2026-01-01", label: "Ahorro" }] : [] });
    saveP2State({ ...p2State(), goals: [goal("e2e-vacaciones", "Vacaciones", "project", 3000, `${at(8, 15).iso}`, 1200), goal("e2e-fondo", "Fondo de emergencia", "emergency", 10000, at(2).iso, 2000)] });
    renderMapaPagos(FinanceCanonicalLargePayments);
    return { hogar: hogar.key };
  });

  test("solo la Renta sin importe, datos reales, un pago en plan y seguro contado una vez, objetivo con reserva, el fondo de emergencia fuera, mínimo, tabla, sin tocar nada, sin confirm() ni desbordar", async ({ page }) => {
    test.setTimeout(120000);
    const pageErrors = [];
    const dialogs = [];
    page.on("pageerror", (error) => pageErrors.push(String(error)));
    page.on("dialog", async (dialog) => { dialogs.push(dialog.message()); await dialog.dismiss(); });
    for (const viewport of [{ width: 1280, height: 900 }, { width: 390, height: 844 }]) {
      await page.setViewportSize(viewport);
      const card = await openPrevision(page);
      const body = card.locator("#mapaPagosCuerpo");
      // Sin datos del hogar solo hay un pago conocido: la campaña de la Renta, y sin importe (no es cero).
      await expect(body).toContainText("ninguno con importe conocido");
      await expect(body.locator(".mpg-item")).toHaveCount(1);
      await expect(body.locator(".mpg-item")).toContainText("Campaña de la Renta");
      await expect(body.locator(".mpg-item")).toContainText("Importe sin determinar");
      await expect(body.locator(".mpg-mes")).toHaveCount(12);

      const fingerprintAntes = await page.evaluate(() => canonicalScenarioResults.base.forecast.fingerprint);
      const claves = Object.keys(await page.evaluate(() => ({ ...localStorage }))).sort();
      await seed(page);
      await expect(body).toContainText("3 pagos grandes que suman 4.310 €");
      await expect(body).toContainText("1 más sin importe, fuera de la suma");
      await expect(body).toContainText("1.200 €");
      // Seguro del hogar: una sola vez aunque esté también en el plan; el fondo de emergencia no es un pago; el seguro del móvil (90 €) no es grande; el seguro sin fecha se dice.
      await expect(body.locator(".mpg-item").filter({ hasText: "Seguro del hogar" })).toHaveCount(1);
      await expect(body.locator(".mpg-item").filter({ hasText: "Fondo de emergencia" })).toHaveCount(0);
      await expect(body.locator(".mpg-item").filter({ hasText: "Seguro del móvil" })).toHaveCount(0);
      await expect(body.locator(".mpg-notas")).toContainText("Seguro sin fecha");
      await expect(body.locator(".mpg-notas")).toContainText("se cuenta una sola vez");
      await expect(body.locator(".mpg-notas")).toContainText("no se muestra");
      // Los estados van en texto: reservado 40 % (objetivo), sin reserva asignada (plan y seguro).
      await expect(body.locator(".mpg-item").filter({ hasText: "Vacaciones" })).toContainText("Reservado 40 %");
      await expect(body.locator(".mpg-item").filter({ hasText: "IBI" })).toContainText("Sin reserva asignada");
      await expect(body.locator(".mpg-datos")).toContainText("Apartar al mes");

      // Tocar un pago abre el detalle con lo que falta y cuánto apartar al mes.
      const vacaciones = body.locator(".mpg-item").filter({ hasText: "Vacaciones" });
      await vacaciones.locator("summary").click();
      await expect(vacaciones.locator(".mpg-detalle")).toContainText("Reservado: 1.200 €");
      await expect(vacaciones.locator(".mpg-detalle")).toContainText("225 €");
      await expect(vacaciones.locator(".mpg-detalle")).toContainText("faltan 1.800 €");
      // El detalle abierto sobrevive a una repintada (p. ej. al cambiar el mínimo).

      // El mínimo se aplica: con 1.000 € solo quedan las vacaciones (y la Renta sin importe).
      await body.locator("#mapaPagosMinimo").selectOption("1000");
      await expect(body).toContainText("1 pago grande que suma 3.000 €");
      await expect(body.locator(".mpg-item")).toHaveCount(2);
      await expect(vacaciones.locator(".mpg-detalle")).toBeVisible();
      await expect(body.locator("#mapaPagosMinimo")).toBeFocused();
      await body.locator("#mapaPagosMinimo").selectOption("300");
      await expect(body.locator(".mpg-item")).toHaveCount(4);

      // La tabla equivalente trae las mismas filas.
      await body.locator(".mpg-tabla summary").click();
      const filas = await body.locator(".mpg-tabla tbody tr").allInnerTexts();
      expect(filas).toHaveLength(4);
      expect(filas.join("\n")).toContain("sin determinar");

      // Solo enseña: ni la previsión ni lo guardado cambian por pintar el mapa.
      expect(await page.evaluate(() => canonicalScenarioResults.base.forecast.fingerprint)).toBe(fingerprintAntes);
      const clavesDespues = Object.keys(await page.evaluate(() => ({ ...localStorage }))).sort();
      expect(clavesDespues.filter((key) => /large-payments|mapa-pagos/.test(key))).toEqual([]);
      expect(clavesDespues.length).toBeGreaterThanOrEqual(claves.length);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(overflow, `sin desbordar en ${viewport.width} px`).toBeLessThanOrEqual(1);
    }
    expect(dialogs, "ningún confirm()").toEqual([]);
    expect(pageErrors).toEqual([]);
  });
});

// WP-50 (CAR-04): vivienda y local revalorizados por un índice que teclea el hogar, en Inversión › Cartera. No se conecta a nada; no toca lo declarado; la estimación solo entra en el patrimonio si se activa
// inmueble a inmueble; sin el índice del trimestre de la declaración no se inventa nada.
test.describe("WP-50 · vivienda y local por índice", () => {
  const open = async (page) => {
    await page.goto("/index.html#inversion-cartera");
    await page.reload();
    await page.evaluate(() => { try { localStorage.clear(); } catch { /* sin almacenamiento */ } });
    await page.reload();
    const card = page.locator("#indiceViviendaCard");
    await expect(card).toBeVisible({ timeout: 15000 });
    return card;
  };
  const seed = (page) => page.evaluate(() => {
    scenarioSettings.assets = [
      { id: "ivi-casa", type: "inmueble", label: "Vivienda de prueba", value: 300000, asOf: "2025-05-10", provenance: "declared" },
      { id: "ivi-local", type: "inmueble", label: "Local de prueba", value: 200000, asOf: "2024-02-01", provenance: "declared" },
      { id: "ivi-coche", type: "vehiculo", label: "Coche de prueba", value: 15000, asOf: "2025-05-10", provenance: "declared" },
    ];
    scenarioSettings.portfolioPositions = [];
    saveScenarioSettings();
    globalThis.accountBalancesFromState = () => ({ caixa: 6000, mediolanum: 4000, total: 10000 });
    globalThis.totalDebtOutstanding = () => 12000;
    globalThis.canonicalDebtContractRows = () => [{ type: "Hipoteca", entity: "Banco de prueba", currentPrincipal: 150000 }, { type: "Tarjeta", entity: "Otra", currentPrincipal: 900 }];
    renderIndiceVivienda(FinanceCanonicalIndexValuation);
    renderPatrimonio(FinanceCanonicalNetWorth);
  });
  const point = async (serie, quarter, year, value) => {
    await serie.locator('select[name="t"]').selectOption(quarter);
    await serie.locator('input[name="y"]').fill(String(year));
    await serie.locator('input[name="v"]').fill(String(value));
    await serie.locator('button[type="submit"]').click();
  };

  test("vacío, validación, series y puntos, estimación con su chip, sin índice del trimestre no se inventa nada, LTV con los dos valores, el interruptor mueve el patrimonio sin tocar lo declarado, deshacer, persiste, sin confirm() ni desbordar", async ({ page }) => {
    test.setTimeout(150000);
    const pageErrors = [];
    const dialogs = [];
    page.on("pageerror", (error) => pageErrors.push(String(error)));
    page.on("dialog", async (dialog) => { dialogs.push(dialog.message()); await dialog.dismiss(); });
    for (const viewport of [{ width: 1280, height: 900 }, { width: 390, height: 844 }]) {
      await page.setViewportSize(viewport);
      const card = await open(page);
      const body = card.locator("#indiceViviendaCuerpo");
      await expect(body.locator('[data-estado="vacio"]')).toContainText("No hay ninguna vivienda ni local registrado");
      await seed(page);
      await expect(body.locator(".ivi-inmueble")).toHaveCount(2);
      await expect(body).not.toContainText("Coche de prueba");
      await expect(body.locator(".ivi-inmueble").first()).toContainText("Declarado: 300.000 €");
      await expect(body).toContainText("la app no se conecta a ninguna fuente");

      // Validación de la serie y de los puntos.
      await body.locator("[data-ivi-add-series] button").click();
      await expect(body.locator("[data-ivi-add-series] [data-ivi-error]")).toContainText("Ponle un nombre");
      await body.locator('[data-ivi-add-series] input[name="label"]').fill("IPV vivienda · prueba");
      await body.locator("[data-ivi-add-series] button").click();
      const serie = body.locator("[data-ivi-series]").first();
      await expect(serie).toContainText("IPV vivienda · prueba");
      await expect(serie).toContainText("Sin ningún índice tecleado todavía");
      await point(serie, "T2", 2025, "abc");
      await expect(serie.locator("[data-ivi-error]")).toContainText("mayor que cero");
      await expect(serie.locator("[data-ivi-error]")).toContainText("187,4");
      await point(serie, "T2", 1800, "165");
      await expect(serie.locator("[data-ivi-error]")).toContainText("año no es válido");
      await point(serie, "T2", 2025, "165");
      await point(serie, "T2", 2026, "180");
      await point(serie, "T1", 2024, "150");
      await expect(serie.locator(".ivi-puntos li")).toHaveCount(3);
      await expect(serie.locator(".ivi-puntos li").first()).toContainText("T2 2026: 180");

      // Elegir el índice: 300.000 × 180 ÷ 165; y el local, 200.000 × 180 ÷ 150.
      const casa = body.locator('[data-ivi-asset="ivi-casa"]');
      const local = body.locator('[data-ivi-asset="ivi-local"]');
      await casa.locator("select[data-ivi-link]").selectOption({ index: 1 });
      await local.locator("select[data-ivi-link]").selectOption({ index: 1 });
      await expect(casa.locator(".ivi-chip")).toContainText("estimado por índice · T2 2026");
      await expect(casa.locator(".ivi-estimado")).toContainText("327.272,73 €");
      await expect(casa.locator(".ivi-estimado")).toContainText("+27.272,73 €");
      await expect(casa.locator(".ivi-frase")).toContainText("sube un 9,09 %");
      await expect(local.locator(".ivi-estimado")).toContainText("240.000 €");
      // LTV: 150.000 ÷ 500.000 = 30 %; con lo estimado, 150.000 ÷ 567.272,73 = 26,44 %. Solo cuenta la hipoteca, no la tarjeta.
      await expect(body.locator(".ivi-ltv")).toContainText("30 % con el valor declarado");
      await expect(body.locator(".ivi-ltv")).toContainText("26,44 % con el estimado por índice");

      // Sin el índice del trimestre de la declaración no se inventa nada.
      await page.evaluate(() => { scenarioSettings.assets = scenarioSettings.assets.map((asset) => (asset.id === "ivi-casa" ? { ...asset, asOf: "2025-11-20" } : asset)); saveScenarioSettings(); renderIndiceVivienda(FinanceCanonicalIndexValuation); });
      await expect(casa.locator(".ivi-chip")).toHaveCount(0);
      await expect(casa.locator(".ivi-frase")).toContainText("Falta el índice de T4 2025");
      await expect(casa.locator("input[data-ivi-use]")).toBeEnabled();
      await page.evaluate(() => { scenarioSettings.assets = scenarioSettings.assets.map((asset) => (asset.id === "ivi-casa" ? { ...asset, asOf: "2025-05-10" } : asset)); saveScenarioSettings(); renderIndiceVivienda(FinanceCanonicalIndexValuation); });
      await expect(casa.locator(".ivi-chip")).toBeVisible();

      // El patrimonio: apagado por defecto (10.000 + 515.000 − 12.000); activar la vivienda lo sube lo estimado; lo declarado no cambia; el local sigue declarado.
      await expect(page.locator("#patrimonioHoy .pat-cifra")).toContainText("513.000 €");
      await expect(casa.locator("input[data-ivi-use]")).not.toBeChecked();
      await casa.locator("input[data-ivi-use]").check();
      await expect(page.locator("#patrimonioHoy .pat-cifra")).toContainText("540.272,73 €");
      await expect(page.locator("#patrimonioHoy")).toContainText("Incluye 1 inmueble con valor estimado por índice");
      const declared = await page.evaluate(() => scenarioSettings.assets.map((asset) => [asset.id, asset.value, asset.provenance]));
      expect(declared).toEqual([["ivi-casa", 300000, "declared"], ["ivi-local", 200000, "declared"], ["ivi-coche", 15000, "declared"]]);
      await expect(body.locator('[data-ivi-asset="ivi-casa"]')).toContainText("(activada)");
      await body.locator('[data-ivi-asset="ivi-casa"] input[data-ivi-use]').uncheck();
      await expect(page.locator("#patrimonioHoy .pat-cifra")).toContainText("513.000 €");
      await expect(page.locator("#patrimonioHoy")).not.toContainText("Incluye 1 inmueble");

      // Quitar un índice se deshace: sin el de T2 2025 la vivienda no se puede revalorizar.
      await serie.locator('[data-ivi-quarter="2025-T2"]').click();
      await expect(casa.locator(".ivi-chip")).toHaveCount(0);
      await expect(casa.locator(".ivi-frase")).toContainText("Falta el índice de T2 2025");
      await page.getByRole("button", { name: "Deshacer" }).first().click();
      await expect(casa.locator(".ivi-chip")).toContainText("estimado por índice");

      // Persiste tras recargar, en la misma copia que las demás series.
      await casa.locator("input[data-ivi-use]").check();
      await page.reload();
      await expect(page.locator('[data-ivi-asset="ivi-casa"] .ivi-chip')).toContainText("estimado por índice · T2 2026", { timeout: 15000 });
      await expect(page.locator('[data-ivi-asset="ivi-casa"] input[data-ivi-use]')).toBeChecked();
      const claves = await page.evaluate(() => Object.keys(localStorage).filter((key) => /housing-index-data/.test(key)));
      expect(claves).toHaveLength(1);

      // Quitar la serie desvincula los inmuebles (vuelven al valor declarado) y se deshace.
      await page.locator("[data-ivi-remove-series]").first().click();
      await expect(page.locator(".ivi-chip")).toHaveCount(0);
      await expect(page.locator('[data-ivi-asset="ivi-casa"] input[data-ivi-use]')).toBeDisabled();
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(overflow, `sin desbordar en ${viewport.width} px`).toBeLessThanOrEqual(1);
    }
    expect(dialogs, "ningún confirm()").toEqual([]);
    expect(pageErrors).toEqual([]);
  });
});

// WP-51 (ND-04): perfiles de extracto con autodetección, en Registrar › Importar extracto. Un CSV con filas de título y fechas ambiguas se lee sin exigir el formato de siempre; el panel dice lo que se dedujo y
// avisa de lo que no se sabe; corregirlo rehace la lectura; un perfil guardado se aplica solo la vez siguiente; un fichero sin cabecera falla con motivo y se rescata indicando las columnas; las filas
// que no se pueden leer salen con su número y no se importan; el diagnóstico copiable no lleva el contenido.
test.describe("WP-51 · perfiles de extracto", () => {
  const abrir = async (page) => {
    await page.goto("/index.html#registrar");
    await page.reload();
    await page.evaluate(() => { try { localStorage.clear(); } catch { /* sin almacenamiento */ } });
    await page.reload();
    await page.click('[data-registrar-tab="import"]');
    await abrirAsistenteDeSiempre(page);
    await expect(page.locator("#registrarImportFileInput")).toBeAttached({ timeout: 15000 });
  };
  const subir = (page, name, text) => page.setInputFiles("#registrarImportFileInput", { name, mimeType: "text/csv", buffer: Buffer.from(text) });
  const TITULADO = "Movimientos de la cuenta\nConsulta;11/10/2026\n\nFecha;Concepto;Importe;Saldo\n03/04/2026;SUPER SECRETO-A;-10,00;90,00\n05/06/2026;RECIBO B;-5,00;85,00\n07/06/2026;NOMINA C;1.000,00;1.085,00\n";

  test("fichero con título y fechas ambiguas: se lee, avisa, se corrige, se guarda como perfil y se reconoce al volver", async ({ page }) => {
    test.setTimeout(150000);
    const pageErrors = [];
    page.on("pageerror", (error) => pageErrors.push(String(error)));
    for (const viewport of [{ width: 1280, height: 900 }, { width: 390, height: 844 }]) {
      await page.setViewportSize(viewport);
      await abrir(page);
      await subir(page, "extracto-titulado.csv", TITULADO);
      const panel = page.locator("#registrarImportPanel .epf");
      await expect(panel).toBeVisible({ timeout: 15000 });
      await expect(page.locator("#registrarImportPanel")).toContainText("3 movimiento(s)");
      await expect(panel).toContainText("3 movimiento(s) leídos");
      await expect(panel).toContainText("Ninguna fecha decide entre día/mes y mes/día");
      await expect(panel.locator(".epf-previa tbody tr")).toHaveCount(3);
      await expect(page.locator("#registrarImportPanel")).toContainText("del 03/04/2026 al 07/06/2026");
      // Corregir: mes/día/año → las fechas cambian y el aviso desaparece.
      await panel.locator('[data-epf-ajuste="dateOrder"]').selectOption("MDY");
      await expect(page.locator("#registrarImportPanel")).toContainText("del 04/03/2026 al 06/07/2026");
      await expect(page.locator("#registrarImportPanel .epf")).not.toContainText("Ninguna fecha decide");
      // Guardar el perfil.
      await page.locator("#registrarImportPanel .epf [data-epf-guardar] input[name=nombre]").fill("Mi banco");
      await page.locator("#registrarImportPanel .epf [data-epf-guardar] button").click();
      await expect(page.locator("#registrarImportPanel .epf-perfiles")).toContainText("Mi banco");
      expect(await page.evaluate(() => JSON.parse(localStorage.getItem(storageKey("statement-profiles-data"))).profiles[0].dateOrder)).toBe("MDY");
      // El contenido del extracto no se guarda en ningún almacén.
      expect(await page.evaluate(() => Object.keys(localStorage).some((k) => (localStorage.getItem(k) || "").includes("SUPER SECRETO-A") && /statement-profiles/.test(k)))).toBe(false);
      // Otro fichero con la misma cabecera: el perfil se aplica solo y no hay aviso de ambigüedad.
      await page.click("#registrarImportReplaceFile");
      await subir(page, "otro-mes.csv", TITULADO.replace("SUPER SECRETO-A", "OTRO"));
      await expect(page.locator("#registrarImportPanel .epf")).toContainText("Perfil aplicado: Mi banco");
      await expect(page.locator("#registrarImportPanel")).toContainText("del 04/03/2026 al 06/07/2026");
      // Con el perfil aplicado y nada que avisar, el panel va cerrado (no estorba); se abre para copiar el diagnóstico: sin contenido.
      await expect(page.locator("#registrarImportPanel .epf")).not.toHaveAttribute("open", "");
      await page.locator("#registrarImportPanel .epf > summary").click();
      await page.evaluate(() => { navigator.clipboard.writeText = () => Promise.reject(new Error("sin portapapeles")); });
      await page.locator("#registrarImportPanel .epf [data-epf-copiar]").click();
      const diag = await page.locator("#registrarImportPanel .epf-diagnostico").inputValue();
      expect(diag).toContain("Diagnóstico de lectura de extracto");
      expect(diag).not.toContain("OTRO");
      expect(diag).not.toContain("NOMINA");
      // Quitar el perfil se deshace.
      await page.locator("#registrarImportPanel .epf [data-epf-borrar]").click();
      await expect(page.locator("#registrarImportPanel .epf-perfiles")).toHaveCount(0);
      await page.click("#undoToastButton");
      await expect(page.locator("#registrarImportPanel .epf-perfiles")).toContainText("Mi banco");
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(overflow, `sin desbordar en ${viewport.width} px`).toBeLessThanOrEqual(1);
    }
    expect(pageErrors).toEqual([]);
  });

  test("sin cabecera: falla con motivo, enseña las filas, se rescata indicando las columnas; las filas rotas salen con su número", async ({ page }) => {
    test.setTimeout(120000);
    const pageErrors = [];
    page.on("pageerror", (error) => pageErrors.push(String(error)));
    await page.setViewportSize({ width: 390, height: 844 });
    await abrir(page);
    await subir(page, "sin-cabecera.csv", "25/09/2026;SUPER;-12,50;100,00\n26/09/2026;LUZ;-60,00;40,00\n27/09/2026;ROTO;12abc;40,00\n28/09/2026;NOMINA;1.800,00;1.840,00\n");
    const panel = page.locator("#registrarImportPanel .epf");
    await expect(panel).toBeVisible({ timeout: 15000 });
    await expect(panel).toContainText("No he podido leer el fichero");
    await expect(panel.locator('[role="alert"]').first()).toBeVisible();
    await expect(panel.locator(".epf-previa tbody tr")).toHaveCount(4);
    for (const [index, role] of [[0, "date"], [1, "movement"], [2, "amount"], [3, "balance"]]) {
      await panel.locator(`[data-epf-ajuste="col-${index}"]`).selectOption(role);
      if (index < 3) await expect(page.locator(`#registrarImportPanel [data-epf-ajuste="col-${index + 1}"]`)).toBeVisible();
    }
    await expect(page.locator("#registrarImportPanel")).toContainText("3 movimiento(s)");
    await expect(page.locator("#registrarImportPanel .epf")).toContainText("Fila 3: importe no reconocido");
    await expect(page.locator("#registrarImportPanel .epf")).toContainText("1 fila(s) sin leer");
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow, "sin desbordar a 390 px").toBeLessThanOrEqual(1);
    expect(pageErrors).toEqual([]);
  });
});

// WP-53 (CAP-10): sin duplicados entre lo anotado a mano y el extracto. Una captura rápida (movimiento) y una partida de «Registrar gasto» se emparejan con su fila del banco por importe exacto,
// ±2 días y comercio; el paso 3 lo explica y pregunta; al confirmar, manda el extracto; «Deshacer último lote» lo devuelve todo.
test.describe("WP-53 · sin duplicados entre captura y extracto", () => {
  const fechaCsv = (iso) => iso.split("-").reverse().join("/");
  const sumarDias = (iso, dias) => new Date(Date.UTC(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10) + dias)).toISOString().slice(0, 10);
  const importar = async (page, csv, decision) => {
    await page.click('[data-registrar-tab="import"]');
    await abrirAsistenteDeSiempre(page);
    await expect(page.locator("#registrarImportFileInput")).toBeAttached({ timeout: 15000 });
    await page.setInputFiles("#registrarImportFileInput", { name: "extracto.csv", mimeType: "text/csv", buffer: Buffer.from(csv) });
    await page.selectOption("#registrarImportAccount", "CaixaBank");
    await page.$eval("#registrarImportNext", (button) => button.click());
    for (let index = 0; index < 5; index += 1) {
      const pending = await page.evaluate(() => { const button = document.querySelector('[data-datos-importar-classify="ignorar"]:not(.is-active)'); button?.click(); return Boolean(button); });
      if (!pending) break;
    }
    await page.$eval("#registrarImportNext", (button) => button.click());
    await decision?.();
    await page.$eval("#registrarImportNext", (button) => button.click());
    await page.$eval("#registrarImportConfirm", (button) => button.click());
    await page.$eval("#operationConfirmSubmit", (button) => button.click());
    await expect(page.locator("#registrarImportPanel")).toContainText("Importación confirmada", { timeout: 15000 });
  };
  const deshacer = async (page) => {
    await page.evaluate(() => { undoLastImportBatch(); });
    await page.waitForSelector("#operationConfirmDialog[open]");
    await page.$eval("#operationConfirmSubmit", (button) => button.click());
  };

  test("captura rápida: el paso 3 propone la pareja, «misma» deja la fila del banco y deshacer devuelve la captura", async ({ page }) => {
    test.setTimeout(150000);
    const pageErrors = [];
    page.on("pageerror", (error) => pageErrors.push(String(error)));
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/index.html#registrar");
    await page.waitForFunction(() => typeof capturaDuplicadosAnotar === "function" && typeof handleE17QuickCapture === "function");
    const today = await page.evaluate(() => isoLocalDate(new Date()));
    await page.evaluate((date) => handleE17QuickCapture({ e17CreateAmount: "23.4", e17CreateConcept: "Mercadona", e17CreateKind: "expense", e17CreateDate: date }), today);
    const captured = () => page.evaluate(() => (baseData.transactions || []).filter((item) => item.source === "manual-quick-capture").length);
    expect(await captured()).toBe(1);
    const csv = `Fecha;Concepto;Importe;Saldo\n${fechaCsv(sumarDias(today, 1))};COMPRA TARJ. 4412 MERCADONA SA;-23,40;976,60\n${fechaCsv(sumarDias(today, 1))};OTRO CARGO;-5,00;971,60\n`;
    await importar(page, csv, async () => {
      const fila = page.locator("#registrarImportPanel [data-captura-duplicado]");
      await expect(fila).toHaveCount(1);
      await expect(fila).toHaveAttribute("data-captura-duplicado", "alta");
      await expect(fila).toContainText("Anotado a mano");
      await expect(fila).toContainText("Misma compra probable");
      await expect(fila).toContainText("se queda la fila del banco");
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(overflow, "sin desbordar a 390 px").toBeLessThanOrEqual(1);
      await fila.locator('[data-datos-importar-duplicate="misma"]').click();
      await expect(page.locator("#registrarImportPanel")).toContainText("No hay candidatos a duplicado sin resolver"); // decidida, sale de la lista
    });
    await expect(page.locator("#registrarImportPanel")).toContainText("1 captura(s) a mano sustituida(s) por su fila del banco");
    expect(await captured(), "la captura se fue").toBe(0);
    const rows = await page.evaluate(() => (baseData.transactions || []).map((item) => `${item.date}|${item.amount}|${item.movement}`));
    expect(rows.filter((row) => row.includes("MERCADONA"))).toHaveLength(1); // sólo la del banco
    await deshacer(page);
    await expect.poll(captured, { message: "«Deshacer último lote» devuelve la captura" }).toBe(1);
    expect(pageErrors).toEqual([]);
  });

  test("«Registrar gasto» sin tarjetas: queda en el registro, y al confirmar «misma» la partida pasa a valer el extracto sin sumarse aparte", async ({ page }) => {
    test.setTimeout(150000);
    const pageErrors = [];
    page.on("pageerror", (error) => pageErrors.push(String(error)));
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto("/index.html#home");
    await page.waitForFunction(() => typeof capturaDuplicadosAnotar === "function" && !document.getElementById("homeQuickExpenseOpen")?.disabled);
    await abrirApuntarGasto(page);
    await page.fill("#homeQuickExpenseLabel", "Supermercado prueba");
    await page.fill("#homeQuickExpenseAmount", "37,45");
    await page.click("#homeQuickExpenseSubmit");
    await expect(page.locator("#homeQuickExpenseDialog")).not.toBeVisible();
    const entry = await page.evaluate(() => JSON.parse(localStorage.getItem(storageKey("capture-log"))).entries[0]);
    expect(entry).toMatchObject({ concept: "Supermercado prueba", amount: -37.45, channel: "ventana", monthKey: entry.date.slice(0, 7) });
    const rowKey = `expense|${entry.rowId}`;
    const real = () => page.evaluate(({ id, month }) => expenseActuals[`${id}|${month}`], { id: entry.rowId, month: entry.monthKey });
    expect(await real()).toBe(37.45);
    await page.evaluate(() => { location.hash = "#registrar"; });
    await expect(page.locator('[data-registrar-tab="import"]')).toBeVisible();
    const csv = `Fecha;Concepto;Importe;Saldo\n${fechaCsv(entry.date)};COMPRA SUPERMERCADO PRUEBA SA;-37,45;962,55\n`;
    await importar(page, csv, async () => {
      const fila = page.locator("#registrarImportPanel [data-captura-duplicado]");
      await expect(fila).toHaveCount(1);
      await expect(fila).toContainText("Anotado con «Registrar gasto»");
      await expect(fila).toContainText("pasa a valer lo que dice el banco");
      await fila.locator('[data-datos-importar-duplicate="misma"]').click();
    });
    const after = await page.evaluate(({ id, month }) => ({ mapped: Object.values(movementMappings).filter((item) => item.rowKey === `expense|${id}`).length, real: expenseActuals[`${id}|${month}`], rows: customPlanningRows.filter((row) => row.id === id).length }), { id: entry.rowId, month: entry.monthKey });
    expect(after).toEqual({ mapped: 1, real: 37.45, rows: 1 });
    await deshacer(page);
    await expect.poll(() => page.evaluate((key) => Object.values(movementMappings).filter((item) => item.rowKey === key).length, rowKey), { message: "deshacer quita la asignación" }).toBe(0);
    expect(await real(), "y la partida anotada sigue valiendo lo anotado").toBe(37.45);
    expect(pageErrors).toEqual([]);
  });

  test("una fila sin captura que cuadre no cambia el paso 3, y «Son distintas» conserva las dos", async ({ page }) => {
    test.setTimeout(150000);
    const pageErrors = [];
    page.on("pageerror", (error) => pageErrors.push(String(error)));
    await page.goto("/index.html#registrar");
    await page.waitForFunction(() => typeof handleE17QuickCapture === "function");
    const today = await page.evaluate(() => isoLocalDate(new Date()));
    await page.evaluate((date) => handleE17QuickCapture({ e17CreateAmount: "12.5", e17CreateConcept: "Mercadona", e17CreateKind: "expense", e17CreateDate: date }), today);
    const csv = `Fecha;Concepto;Importe;Saldo\n${fechaCsv(today)};FARMACIA LOPEZ;-12,50;987,50\n`;
    await importar(page, csv, async () => {
      const fila = page.locator("#registrarImportPanel [data-captura-duplicado]");
      await expect(fila).toHaveAttribute("data-captura-duplicado", "media");
      await expect(fila).toContainText("comercio distinto");
      await fila.locator('[data-datos-importar-duplicate="distinto"]').click();
    });
    expect(await page.evaluate(() => (baseData.transactions || []).filter((item) => item.source === "manual-quick-capture").length), "«Son distintas» no toca la captura").toBe(1);
    expect(await page.evaluate(() => (baseData.transactions || []).some((item) => /FARMACIA/.test(item.movement)))).toBe(true);
    expect(pageErrors).toEqual([]);
  });
});

// Decisión del hogar (17/10/2026): del 1 al 3 el mes que se cierra sigue abierto (WP-09), pero «Registrar gasto» apunta al mes de la
// fecha, como el extracto; un enlace lo lleva al mes anterior y otro lo devuelve. Fuera de esos días el enlace no sale.
test.describe("Registrar gasto · del 1 al 3, al mes de la fecha con un enlace al que se cierra", () => {
  const abrir = async (page, time) => {
    await page.clock.install({ time });
    await page.goto("/index.html#home");
    await page.waitForFunction(() => !document.getElementById("homeQuickExpenseOpen")?.disabled);
    await abrirApuntarGasto(page);
    await expect(page.locator("#homeQuickExpenseDialog")).toBeVisible();
  };

  test("el día 2 va a noviembre, el enlace lo lleva a octubre y vuelve; se guarda en el mes elegido", async ({ page }) => {
    const pageErrors = [];
    page.on("pageerror", (error) => pageErrors.push(String(error)));
    await abrir(page, new Date(2026, 10, 2, 10, 0, 0));
    const note = page.locator("#homeQuickExpenseMonth");
    const enlace = page.locator("#homeQuickExpenseMonthSwitch");
    await expect(note).toContainText("nov");
    await expect(enlace).toBeVisible();
    await expect(enlace).toContainText("¿Era de oct");
    await enlace.click();
    await expect(note).toContainText("oct");
    await expect(enlace).toContainText("Volver a nov");
    await enlace.click();
    await expect(note).toContainText("nov");
    await enlace.click();
    await page.fill("#homeQuickExpenseLabel", "Compra atrasada");
    await page.fill("#homeQuickExpenseAmount", "12,30");
    await page.click("#homeQuickExpenseSubmit");
    await expect(page.locator("#homeQuickExpenseDialog")).not.toBeVisible();
    const entry = await page.evaluate(() => JSON.parse(localStorage.getItem(storageKey("capture-log"))).entries[0]);
    expect(entry).toMatchObject({ concept: "Compra atrasada", amount: -12.3, monthKey: "2026-10", date: "2026-11-02" });
    expect(pageErrors).toEqual([]);
  });

  test("el día 10 va al mes de la fecha y no hay enlace", async ({ page }) => {
    await abrir(page, new Date(2026, 10, 10, 10, 0, 0));
    await expect(page.locator("#homeQuickExpenseMonth")).toContainText("nov");
    await expect(page.locator("#homeQuickExpenseMonthSwitch")).toBeHidden();
  });
});

// WP-54 (GOV-06): el guion de la prueba con 5 personas ajenas (docs/WP54_PRUEBA_USABILIDAD.md) se puede hacer en la demostración. No mide usabilidad —no hay personas—: protege que cada tarea siga
// teniendo su sitio, su dato y su respuesta, para que el guion no se pudra entre una ronda y la siguiente. Fechas relativas a hoy, como el extracto ficticio.
test.describe("WP-54 · el guion de la prueba con personas se puede hacer en la demo", () => {
  test("las cinco tareas tienen sitio y respuesta; la tarea 3 propone la pareja de la tarea 2 y no la de la farmacia", async ({ page }) => {
    test.setTimeout(150000);
    const pageErrors = [];
    page.on("pageerror", (error) => pageErrors.push(String(error)));
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/index.html#home");
    await page.waitForFunction(() => typeof capturaDuplicadosAnotar === "function" && !document.getElementById("homeQuickExpenseOpen")?.disabled && document.querySelector("#homeKpis")?.textContent.trim().length > 20);
    // T1: la pantalla de inicio dice una cifra de capacidad libre y la deuda.
    await expect(page.locator("#homeKpis")).toContainText("Capacidad libre real");
    await expect(page.locator("#homeKpis")).toContainText("Deuda pendiente");
    // T2: anotar el gasto con la ventana de siempre (la demo no tiene tarjetas).
    expect(await page.evaluate(() => loadCardCycles().cards.length), "la demo no tiene tarjetas: la tarea 2 prueba la ventana anterior").toBe(0);
    await abrirApuntarGasto(page);
    await page.fill("#homeQuickExpenseLabel", "Mercadona");
    await page.fill("#homeQuickExpenseAmount", "23,40");
    await page.click("#homeQuickExpenseSubmit");
    await expect(page.locator("#homeQuickExpenseDialog")).not.toBeVisible();
    // T3: el extracto ficticio de hoy se lee entero y el paso 3 propone SOLO la compra de la tarea 2.
    const today = await page.evaluate(() => isoLocalDate(new Date()));
    const { buildExtract } = await import("../tools/build-usability-extract.mjs");
    const { csv } = buildExtract({ today });
    await page.evaluate(() => { location.hash = "#registrar"; });
    await page.click('[data-registrar-tab="import"]');
    await abrirAsistenteDeSiempre(page);
    await expect(page.locator("#registrarImportFileInput")).toBeAttached({ timeout: 15000 });
    await page.setInputFiles("#registrarImportFileInput", { name: "extracto-demo.csv", mimeType: "text/csv", buffer: Buffer.from(csv) });
    await expect(page.locator("#registrarImportPanel .epf")).toContainText("12 movimiento(s) leídos", { timeout: 15000 });
    await page.selectOption("#registrarImportAccount", "CaixaBank");
    await page.$eval("#registrarImportNext", (button) => button.click());
    for (let index = 0; index < 20; index += 1) {
      const pending = await page.evaluate(() => { const button = document.querySelector('[data-datos-importar-classify="ignorar"]:not(.is-active)'); button?.click(); return Boolean(button); });
      if (!pending) break;
    }
    await page.$eval("#registrarImportNext", (button) => button.click());
    const pareja = page.locator("#registrarImportPanel [data-captura-duplicado]");
    await expect(pareja).toHaveCount(1);
    await expect(pareja).toContainText("MERCADONA");
    await expect(pareja).not.toContainText("FARMACIA");
    // T4: la ruta de deuda enseña el camino a deuda cero con el control de extra al mes.
    await page.goto("/index.html#deuda-ruta");
    await expect(page.locator("main")).toContainText("Camino a deuda cero", { timeout: 15000 });
    await expect(page.locator("main")).toContainText("Extra al mes");
    // T5: Previsión dice cuál es el punto delicado.
    await page.goto("/index.html#prevision");
    await expect(page.locator("main")).toContainText("El punto delicado", { timeout: 15000 });
    expect(pageErrors).toEqual([]);
  });
});

// WP-29 (NHG-05): la carta del mes en Cierre. Con la demo y el reloj el 2 de noviembre, Cierre enseña octubre: abierto, un borrador con las cifras del mes (previsto 5.000 € de ingresos y 4.730 € de
// gastos = 270 € de margen; con 180 € de más en la primera partida de gasto, 90 € y 180 € peor de lo previsto); firmado, la carta guardada con los datos de ese momento, que no se reescribe si los datos cambian
// después. La firma real pasa por Supabase (RPC), que la demo no tiene: se simula con el mismo motor de cierre y la misma función que llama app.js al firmar.
test.describe("WP-29 · la carta del mes en Cierre", () => {
  const openCierre = async (page, viewport = { width: 1280, height: 720 }) => {
    await page.setViewportSize(viewport);
    await page.clock.install({ time: new Date(2026, 10, 2, 9, 0, 0) });
    await page.goto("/index.html#cierre");
    // renderCierre vive en views/cierre.js, que se carga aparte: esperarla también (sin esto, la llamada
    // directa de abajo fallaba de vez en cuando con «renderCierre is not defined»).
    await page.waitForFunction(() => typeof recordCartaMes === "function" && typeof renderCierre === "function" && document.querySelector("#cierreTitle")?.textContent.trim().length > 3, null, { timeout: 20000 });
  };
  // Anota los reales de octubre: todo igual a lo previsto salvo la primera partida de gasto, 180 € más.
  const annotateOctober = (page) => page.evaluate(() => {
    const month = cuadroMandosAllMonths().find((item) => item.key === "2026-10");
    const rows = planMesCollect(month);
    const set = (entry, value) => { (entry.kind === "income" ? incomeActuals : expenseActuals)[actualKeyForRow(entry.row, month)] = value; };
    rows.income.forEach((entry) => { if (entry.planned) set(entry, entry.planned); });
    rows.expense.filter((entry) => entry.planned).forEach((entry, index) => set(entry, index === 0 ? entry.planned + 180 : entry.planned));
    renderCierre();
  });
  const sign = (page) => page.evaluate(() => {
    const payload = FinanceCanonicalMonthClose.closeMonth(appStatePayload(), "2026-10", { id: "wp29-cierre", closedAt: "2026-11-02T09:00:00.000Z", reason: "prueba e2e" });
    monthClosures = payload.monthClosures;
    const saved = recordCartaMes("2026-10", "2026-11-02T09:00:00.000Z", null);
    renderCierre();
    return saved;
  });

  test("abierto es un borrador honesto: sin ningún real no hay «resultado», y con reales cuenta el mes", async ({ page }) => {
    const pageErrors = [];
    page.on("pageerror", (error) => pageErrors.push(String(error)));
    await openCierre(page);
    const card = page.locator("#cartaMes");
    await expect(card).toBeVisible();
    await expect(card).toContainText("Carta de octubre de 2026 · borrador");
    await expect(card.locator("[data-carta-mes-texto]")).toContainText(/Octubre no tiene ningún real anotado: el margen que sale, 270\s€, es solo el previsto\./);
    await expect(card).not.toContainText("tal como se preveía");
    await expect(card).toContainText(/Se basa en 0 de 8 partidas con real/);
    await annotateOctober(page);
    const text = card.locator("[data-carta-mes-texto]");
    await expect(text).toContainText(/Octubre cierra con 90\s€ de margen, 180\s€ peor de lo previsto\./);
    await expect(text).toContainText(/La mayor desviación está en .*: gasto de .* frente a .* previstos, toda la diferencia\./);
    await expect(text).toContainText(/Se basa en las 8 partidas, todas con real\./);
    expect(await page.evaluate(() => FinanceCanonicalMonthLetter.countWords(document.querySelector("[data-carta-mes-texto]").textContent))).toBeLessThanOrEqual(120);
    expect(pageErrors, `errores de página: ${pageErrors.join(" | ")}`).toEqual([]);
  });

  test("al firmar se guarda; la carta firmada no se reescribe cuando los datos cambian después, y viaja en la copia de seguridad", async ({ page }) => {
    const pageErrors = [];
    page.on("pageerror", (error) => pageErrors.push(String(error)));
    await openCierre(page);
    await annotateOctober(page);
    expect(await sign(page)).toBe(true);
    const card = page.locator("#cartaMes");
    await expect(card).not.toContainText("borrador");
    await expect(card).toContainText("Escrita al firmar el cierre, el 02/11/2026, con los datos de entonces.");
    const written = await card.locator("[data-carta-mes-texto]").innerText();
    expect(written).toMatch(/Octubre cierra con 90\s€ de margen, 180\s€ peor de lo previsto\./);
    const stored = await page.evaluate(() => JSON.parse(storageGet(storageKey("month-letters"), "[]")));
    expect(stored).toHaveLength(1);
    expect(stored[0]).toMatchObject({ monthKey: "2026-10", closedAt: "2026-11-02T09:00:00.000Z", reconstructed: false, realNet: 90, plannedNet: 270, diffNet: -180 });
    expect(stored[0].text).toBe(written);
    // Un real que cambia después (reabriendo, o por un error) no reescribe lo firmado: la carta sigue siendo la de aquel momento.
    await page.evaluate(() => {
      const month = cuadroMandosAllMonths().find((item) => item.key === "2026-10");
      const first = planMesCollect(month).expense.find((entry) => entry.planned);
      expenseActuals[actualKeyForRow(first.row, month)] = first.planned + 900;
      renderCierre();
    });
    await expect(card.locator("[data-carta-mes-texto]")).toHaveText(written);
    expect(await page.evaluate(() => BACKUP_LOCAL_STORES.includes("month-letters"))).toBe(true);
    // Reabrir y firmar de nuevo el mismo mes la reescribe (una sola carta por mes) con los datos de entonces: app.js llama a la misma función tras el RPC.
    expect(await page.evaluate(() => recordCartaMes("2026-10", "2026-11-04T09:00:00.000Z", null))).toBe(true);
    await page.evaluate(() => renderCierre());
    expect(await page.evaluate(() => JSON.parse(storageGet(storageKey("month-letters"), "[]")).length)).toBe(1);
    await expect(card.locator("[data-carta-mes-texto]")).toContainText(/Octubre cierra con 0\s€ de margen|Octubre cierra sin margen ni déficit|de déficit/);
    expect(pageErrors, `errores de página: ${pageErrors.join(" | ")}`).toEqual([]);
  });

  test("un cierre anterior a la carta enseña una reconstruida y lo dice; «Copiar la carta» copia el texto", async ({ page }) => {
    await openCierre(page);
    await annotateOctober(page);
    await page.evaluate(() => {
      const payload = FinanceCanonicalMonthClose.closeMonth(appStatePayload(), "2026-10", { id: "wp29-antiguo", closedAt: "2026-11-02T09:00:00.000Z", reason: "firmado antes de la carta" });
      monthClosures = payload.monthClosures;
      renderCierre();
    });
    const card = page.locator("#cartaMes");
    await expect(card).toContainText("Reconstruida hoy con los datos actuales: este cierre se firmó antes de que existiera la carta");
    expect(await page.evaluate(() => storageGet(storageKey("month-letters"), "[]")), "pintar una reconstruida no escribe nada").toBe("[]");
    await page.evaluate(() => { window.__copied = []; Object.defineProperty(navigator, "clipboard", { value: { writeText: async (value) => { window.__copied.push(value); } }, configurable: true }); });
    await card.getByRole("button", { name: "Copiar la carta" }).click();
    await expect(page.locator("#appLiveStatus")).toHaveText("Carta copiada.");
    expect(await page.evaluate(() => window.__copied)).toEqual([await card.locator("[data-carta-mes-texto]").innerText()]);
  });

  for (const viewport of [{ width: 390, height: 844 }, { width: 1280, height: 720 }]) {
    test(`la tarjeta se ve y no desborda a ${viewport.width} px`, async ({ page }) => {
      await openCierre(page, viewport);
      await annotateOctober(page);
      await expect(page.locator("#cartaMes")).toBeVisible();
      await page.locator("#cartaMes").scrollIntoViewIfNeeded();
      await expect(page.getByRole("button", { name: "Copiar la carta" })).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), "sin desbordar en horizontal").toBe(true);
      const box = await page.locator("#cartaMes").boundingBox();
      expect(box.x).toBeGreaterThanOrEqual(0);
      expect(box.x + box.width).toBeLessThanOrEqual(viewport.width + 1);
    });
  }
});

// WP-34 (PRV-08): la revisión base cero en Plan › Partidas, con el reloj el 12 de enero de 2027. La demo parte de julio de 2026: hay 6 meses ya pasados. «Mantener» solo anota la marca (y sobrevive a recargar);
// «Ajustar» y «Quitar» PREPARAN el cambio en el borrador de Partidas y es el «Guardar» de siempre el que lo aplica: los meses pasados no se tocan y «Descartar» lo deja todo como estaba.
test.describe("WP-34 · revisión base cero del plan", () => {
  const openBaseCero = async (page, viewport = { width: 1280, height: 720 }) => {
    await page.setViewportSize(viewport);
    await page.clock.install({ time: new Date(2027, 0, 12, 9, 0, 0) });
    await page.goto("/index.html#planificacion-partidas");
    await page.waitForFunction(() => typeof renderBaseCero === "function" && document.querySelector("#baseCeroResumen")?.textContent.includes("partidas"), null, { timeout: 20000 });
    await page.locator("#baseCeroCard > summary").click();
    await expect(page.locator("#baseCero .bc-card")).toBeVisible();
  };
  // Reales de la «Vivienda» (previsto 750): mediana 867,5 → 868 € (un 15,7 % más).
  const seedHousing = (page) => page.evaluate(() => {
    [860, 880, 850, 870, 865, 875].forEach((value, index) => { expenseActuals[`expense-home|2026-${String(7 + index).padStart(2, "0")}`] = value; });
    applicationRenderRevision += 1;
    renderBaseCero(FinanceCanonicalZeroBase);
  });
  const selectItem = (page, key) => page.evaluate((rowKey) => { baseCeroState.key = rowKey; baseCeroState.cache.revision = -1; renderBaseCero(FinanceCanonicalZeroBase); }, key);

  test("sin reales no hay propuestas ni «¿sigue existiendo?», y «Mantener» guarda la marca y sobrevive a recargar", async ({ page }) => {
    const pageErrors = [];
    page.on("pageerror", (error) => pageErrors.push(String(error)));
    await openBaseCero(page);
    const body = page.locator("#baseCero");
    await expect(body).toContainText("Solo hay reales anotados en 0 de los últimos 6 meses");
    await expect(body).toContainText("no entran en la revisión");
    await expect(body.locator('[data-bc="ajustar"]')).toHaveCount(0);
    await expect(body.locator("table.bc-tabla tbody tr")).toHaveCount(6);
    const first = await body.locator("#bcTitulo").innerText();
    const total = await page.evaluate(() => baseCeroModel().progress.total);
    expect(total).toBeGreaterThan(5);
    await body.locator('[data-bc="mantener"]').click();
    await expect(page.locator("#baseCeroResumen")).toHaveText(`Revisión base cero del plan: 1 de ${total} partidas revisadas`);
    await expect(body.locator("#bcTitulo")).not.toHaveText(first);
    await expect(body).toContainText("Ya revisadas (1)");
    expect(await page.evaluate(() => Object.values(JSON.parse(storageGet(storageKey("zero-base-data"), "{}")).reviews).map((review) => [review.decision, review.reviewedAt]))).toEqual([["mantener", "2027-01-12"]]);
    expect(await page.evaluate(() => visualPendingCounts())).toMatchObject({ cells: 0, deletes: 0 });
    await page.reload();
    await page.waitForFunction(() => document.querySelector("#baseCeroResumen")?.textContent.includes("partidas"));
    await expect(page.locator("#baseCeroResumen")).toHaveText(`Revisión base cero del plan: 1 de ${total} partidas revisadas`);
    expect(pageErrors, `errores de página: ${pageErrors.join(" | ")}`).toEqual([]);
  });

  test("«Ajustar a lo real» prepara el importe de los meses por venir y solo «Guardar» lo aplica; los meses pasados no se tocan", async ({ page }) => {
    const pageErrors = [];
    page.on("pageerror", (error) => pageErrors.push(String(error)));
    await openBaseCero(page);
    await seedHousing(page);
    await selectItem(page, "expense|expense-home");
    const body = page.locator("#baseCero");
    await expect(body.locator("#bcTitulo")).toHaveText("Vivienda");
    await expect(body).toContainText("6 de los últimos 6 meses con real: mediana de 868 € al mes, entre 850 € y 880 €");
    const adjust = body.locator('[data-bc="ajustar"]');
    await expect(adjust).toContainText(/Ajustar a 868\s€ al mes/);
    const planned = (month) => page.evaluate((key) => plannedValueForRow(rowForSeriesKey("expense|expense-home"), { key }), month);
    expect(await planned("2027-02")).toBe(750);
    await adjust.click();
    await expect(body).toContainText(/36 cambio\(s\) preparado\(s\) en el plan/);
    await expect(body).toContainText("ajuste preparado, sin guardar");
    expect(await planned("2027-02"), "preparar no cambia el plan guardado").toBe(750);
    await body.locator('[data-bc="guardar"]').click();
    await expect(body).not.toContainText("cambio(s) preparado(s)");
    expect(await planned("2027-02")).toBe(868);
    expect(await planned("2029-12")).toBe(868);
    expect(await planned("2026-12"), "un mes ya pasado no se toca").toBe(750);
    await expect(body).toContainText(/Vivienda · ajustada a 868\s€ al mes/);
    expect(pageErrors, `errores de página: ${pageErrors.join(" | ")}`).toEqual([]);
  });

  test("«Quitar» solo prepara el borrado: «Descartar» deja la partida en el plan y «Guardar» la quita", async ({ page }) => {
    const pageErrors = [];
    page.on("pageerror", (error) => pageErrors.push(String(error)));
    await openBaseCero(page);
    await selectItem(page, "expense|expense-services");
    const body = page.locator("#baseCero");
    await expect(body.locator("#bcTitulo")).toHaveText("Servicios");
    const exists = () => page.evaluate(() => planningSectionsForMonth("expense", cuadroMandosAllMonths().find((month) => month.key === "2027-02")).some((section) => section.rows.some((row) => displayLabelForRow(row) === "Servicios")));
    await body.locator('[data-bc="quitar"]').click();
    await expect(body).toContainText(/1 cambio\(s\) preparado\(s\) en el plan/);
    await expect(body).toContainText("borrado preparado, sin guardar");
    expect(await exists(), "preparar no borra").toBe(true);
    await body.locator('[data-bc="descartar"]').click();
    await expect(body).toContainText("decidida quitar, sigue en el plan");
    expect(await exists()).toBe(true);
    await body.locator(".bc-hechas summary").click();
    await body.locator('[data-bc="reabrir"]').click();
    await body.locator('[data-bc="quitar"]').click();
    await body.locator('[data-bc="guardar"]').click();
    expect(await exists(), "guardado: ya no está en el plan").toBe(false);
    expect(await page.evaluate(() => baseCeroModel().items.some((item) => item.label === "Servicios"))).toBe(false);
    expect(pageErrors, `errores de página: ${pageErrors.join(" | ")}`).toEqual([]);
  });

  test("las partidas que manda otra cosa solo se pueden mantener, y se dice quién las manda", async ({ page }) => {
    await openBaseCero(page);
    await selectItem(page, "expense|variable-operational-spend");
    const body = page.locator("#baseCero");
    await expect(body.locator("#bcTitulo")).toHaveText("Gasto variable estimado");
    await expect(body).toContainText("Su importe lo manda otra cosa: se calcula con la fórmula del gasto variable");
    await expect(body.locator('[data-bc="quitar"], [data-bc="ajustar"]')).toHaveCount(0);
    await expect(body.locator('[data-bc="mantener"]')).toBeVisible();
  });

  for (const viewport of [{ width: 390, height: 844 }, { width: 1280, height: 720 }]) {
    test(`la tarjeta se ve y no desborda a ${viewport.width} px`, async ({ page }) => {
      await openBaseCero(page, viewport);
      await seedHousing(page);
      await selectItem(page, "expense|expense-home");
      await page.locator('#baseCero [data-bc="ajustar"]').click();
      await page.locator("#baseCeroCard").scrollIntoViewIfNeeded();
      await expect(page.locator('#baseCero [data-bc="guardar"]')).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), "sin desbordar en horizontal").toBe(true);
      const box = await page.locator("#baseCeroCard").boundingBox();
      expect(box.x + box.width).toBeLessThanOrEqual(viewport.width + 1);
      // El desborde no siempre llega a la página (un contenedor lo recorta): ningún elemento de dentro puede salirse de la tarjeta.
      const outside = await page.evaluate(() => {
        const limit = document.querySelector("#baseCeroCard").getBoundingClientRect().right + 1;
        return [...document.querySelectorAll("#baseCero *")].filter((element) => element.getBoundingClientRect().right > limit).map((element) => `${element.tagName.toLowerCase()}.${element.className}`);
      });
      expect(outside, `elementos fuera de la tarjeta: ${outside.join(", ")}`).toEqual([]);
    });
  }
});

// WP-35 (PRV-02 + PRV-04): la previsión de un mes en tres capas y los ingresos con certeza, en Plan › Previsión, con el reloj el 12 de octubre de 2026. La demo en octubre: ingresos 5.000 €, gastos 4.730 €
// (comprometido 2.980 € = fijos 2.500 € + financiaciones 480 €; probable 1.750 € = el gasto variable), margen 270 €. La tarjeta SOLO LEE: declarar la certeza de un ingreso o la capa de una partida no cambia ninguna cifra
// de la previsión, y se guarda en la copia.
test.describe("WP-35 · previsión en capas e ingresos con certeza", () => {
  const openCapas = async (page, viewport = { width: 1280, height: 720 }) => {
    await page.setViewportSize(viewport);
    await page.clock.install({ time: new Date(2026, 9, 12, 9, 0, 0) });
    await page.goto("/index.html#prevision");
    await page.waitForFunction(() => typeof renderCapasPrevision === "function" && document.querySelector("#capasResumen"), null, { timeout: 20000 });
    await page.locator("#capasCard > summary").click();
    await expect(page.locator("#capas .cp-barra")).toBeVisible({ timeout: 15000 });
  };
  const forecastIncome = (page) => page.evaluate(() => JSON.stringify(canonicalScenarioResults.base.forecast.series.slice(0, 6).map((row) => [row.monthKey, row.totals.income, row.totals.outflowsBeforeSaving])));

  test("la demo en octubre: comprometido, probable y margen cuadran con el plan, y todo es lo previsto (sin reales)", async ({ page }) => {
    const pageErrors = [];
    page.on("pageerror", (error) => pageErrors.push(String(error)));
    await openCapas(page);
    const body = page.locator("#capas");
    await expect(body).toContainText(/En octubre: comprometido 2\.980\s€; probable 1\.750\s€; discrecional 0\s€\./);
    await expect(body).toContainText(/Con los ingresos confirmados \(5\.000\s€\) queda un margen de 270\s€\./);
    await expect(body).toContainText(/Ninguna de las \d+ partidas de este mes tiene real anotado: todo lo que ves es lo previsto\./);
    await expect(body).toContainText("Sin banda para lo probable");
    await expect(body.locator(".cp-barra .cp-seg")).toHaveCount(2);
    await expect(body.locator(".cp-barra")).toHaveAttribute("role", "img");
    expect(pageErrors, `errores de página: ${pageErrors.join(" | ")}`).toEqual([]);
  });

  test("declarar un ingreso como incierto cambia lo que se LEE aquí, no la previsión, y sobrevive a recargar", async ({ page }) => {
    const pageErrors = [];
    page.on("pageerror", (error) => pageErrors.push(String(error)));
    await openCapas(page);
    const before = await forecastIncome(page);
    const kpis = await page.evaluate(() => document.querySelector("#previsionHeadline")?.textContent);
    await page.locator("#capas summary", { hasText: "Ingresos: certeza de cada uno" }).click();
    const row = page.locator("#capas .cp-ingreso", { hasText: "Ingreso Persona B" });
    await expect(row.locator(".cp-chip")).toHaveText("Confirmado");
    await row.locator("[data-capa-nivel]").selectOption("incierto");
    await expect(page.locator("#capas .cp-ingreso", { hasText: "Ingreso Persona B" }).locator(".cp-chip")).toHaveText("Incierto 50 %");
    await expect(page.locator("#capas .cp-frase").nth(1)).toContainText(/Con los ingresos confirmados \(3\.000\s€\) faltan 1\.730\s€\./);
    await expect(page.locator("#capas .cp-frase").nth(2)).toContainText(/Hay 2\.000\s€ de ingresos que no son seguros: contando su probabilidad faltan 730\s€, y si llegara todo, queda un margen de 270\s€\./);
    await page.locator("#capas [data-capa-prob]").fill("80");
    await page.locator("#capas [data-capa-prob]").press("Tab");
    await expect(page.locator("#capas .cp-frase").nth(2)).toContainText(/contando su probabilidad faltan 130\s€/);
    expect(await forecastIncome(page), "la previsión no cambia").toBe(before);
    expect(await page.evaluate(() => document.querySelector("#previsionHeadline")?.textContent), "ni el titular de Previsión").toBe(kpis);
    expect(await page.evaluate(() => JSON.parse(storageGet(storageKey("forecast-layers-data"), "{}")).incomes)).toEqual({ "income:income|income-b": { level: "incierto", probability: 80 } });
    await page.reload();
    await page.waitForFunction(() => document.querySelector("#capasResumen"));
    await page.locator("#capasCard > summary").click();
    await page.locator("#capas summary", { hasText: "Ingresos: certeza de cada uno" }).click();
    await expect(page.locator("#capas .cp-ingreso", { hasText: "Ingreso Persona B" }).locator(".cp-chip")).toHaveText("Incierto 80 %");
    // «Confirmado» quita la declaración: vuelve a lo de siempre.
    await page.locator("#capas .cp-ingreso", { hasText: "Ingreso Persona B" }).locator("[data-capa-nivel]").selectOption("confirmado");
    await expect(page.locator("#capas .cp-frase")).toHaveCount(2);
    expect(await page.evaluate(() => JSON.parse(storageGet(storageKey("forecast-layers-data"), "{}")).incomes)).toEqual({});
    expect(pageErrors, `errores de página: ${pageErrors.join(" | ")}`).toEqual([]);
  });

  test("cambiar la capa de una partida mueve el tramo, y la capa sugerida se puede recuperar", async ({ page }) => {
    await openCapas(page);
    await page.locator("#capas summary", { hasText: "Gastos: en qué capa está cada partida" }).click();
    const select = page.locator('#capas [data-capa-layer="expense:expense|variable-operational-spend"]');
    await expect(select).toHaveValue("probable");
    await select.selectOption("discrecional");
    await expect(page.locator("#capas .cp-frase").first()).toContainText(/comprometido 2\.980\s€; probable 0\s€; discrecional 1\.750\s€\./);
    await expect(page.locator('#capas [data-capa-layer="expense:expense|variable-operational-spend"]')).toBeFocused();
    await expect(page.locator(".cp-barra .cp-seg.cp-discrecional")).toHaveCount(1);
    await page.locator('#capas [data-capa-layer="expense:expense|variable-operational-spend"]').selectOption("probable");
    await expect(page.locator("#capas .cp-frase").first()).toContainText(/probable 1\.750\s€; discrecional 0\s€\./);
  });

  test("con reales anotados en meses cerrados, la banda de lo probable sale de lo que se desvió", async ({ page }) => {
    await openCapas(page);
    await page.evaluate(() => {
      // Tres meses cerrados con real en el gasto variable: +100, −60, +200 sobre lo previsto.
      const planned = (key) => plannedValueForRow(rowForSeriesKey("expense|variable-operational-spend"), { key });
      [["2026-07", 100], ["2026-08", -60], ["2026-09", 200]].forEach(([key, gap]) => { expenseActuals[`variable-operational-spend|${key}`] = planned(key) + gap; });
      applicationRenderRevision += 1;
      capasState.monthKey = "";
      renderCapasPrevision(FinanceCanonicalForecastLayers);
      document.querySelector("#capas").__cpHtml = "";
      renderCapasPrevision(FinanceCanonicalForecastLayers);
    });
    await expect(page.locator("#capas .cp-frase").first()).toContainText(/probable 1\.750\s€ \(± \d+\s€ según los meses cerrados\)/);
    await expect(page.locator("#capas")).not.toContainText("Sin banda para lo probable");
    await expect(page.locator("#capas .cp-leyenda")).toContainText("(3 meses cerrados)");
  });

  for (const viewport of [{ width: 390, height: 844 }, { width: 1280, height: 720 }]) {
    test(`la tarjeta se ve y nada se sale de ella a ${viewport.width} px`, async ({ page }) => {
      await openCapas(page, viewport);
      await page.locator("#capas summary", { hasText: "Ingresos: certeza de cada uno" }).click();
      await page.locator("#capas .cp-ingreso", { hasText: "Ingreso Persona B" }).locator("[data-capa-nivel]").selectOption("probable");
      await page.locator("#capas summary", { hasText: "Gastos: en qué capa está cada partida" }).click();
      await page.locator("#capasCard").scrollIntoViewIfNeeded();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), "sin desbordar en horizontal").toBe(true);
      const outside = await page.evaluate(() => {
        const limit = document.querySelector("#capasCard").getBoundingClientRect().right + 1;
        return [...document.querySelectorAll("#capas *")].filter((element) => element.getBoundingClientRect().right > limit).map((element) => `${element.tagName.toLowerCase()}.${element.className}`);
      });
      expect(outside, `elementos fuera de la tarjeta: ${outside.join(", ")}`).toEqual([]);
    });
  }
});

// WP-37 (NXP-04), segunda entrega: seis registros de Ajustes (cuentas remuneradas, cuentas con comisión, pólizas, tablas fiscales, escalas de IRPF y
// objetivos de compra grande) se quitaban al instante y sin vuelta atrás. Ahora avisan con «Deshacer» y lo devuelven a su sitio. Datos INVENTADOS.
test.describe("WP-37 · quitar un registro de Ajustes se puede deshacer", () => {
  test("cuentas remuneradas y pólizas: se quita con el botón real, avisa, y «Deshacer» lo devuelve en su sitio sin diálogos del navegador", async ({ page }) => {
    test.setTimeout(60000);
    const pageErrors = [];
    const dialogs = [];
    page.on("pageerror", (error) => pageErrors.push(String(error)));
    page.on("dialog", (dialog) => { dialogs.push(dialog.message()); dialog.dismiss(); });
    await page.goto("/index.html#ajustes");
    await page.evaluate(() => { try { localStorage.clear(); } catch { /* sin almacenamiento */ } });
    await page.reload();
    await expect(page.locator("#ajustesRemuneratedAccounts")).toBeAttached({ timeout: 15000 });
    await page.evaluate(() => {
      ["Cuenta A ficticia", "Cuenta B ficticia", "Cuenta C ficticia"].forEach((name, index) => addRemuneratedAccount({ name, balance: 1000 * (index + 1), rate: 2 + index, notes: "" }));
      ["Póliza A ficticia", "Póliza B ficticia"].forEach((name) => addInsurancePolicy({ name, renewalDate: "2027-03-01", premium: 100, notes: "", isLife: false, beneficiary: "" }));
      renderRemuneratedAccounts();
      renderInsurancePolicies();
      document.querySelectorAll("#ajustesRemuneratedAccounts, #ajustesInsurancePolicies").forEach((node) => { for (let el = node.parentElement; el; el = el.parentElement) if (el.tagName === "DETAILS") el.open = true; });
    });
    const order = () => page.evaluate(() => remuneratedAccounts().map((account) => account.name));
    const before = await order();
    expect(before).toHaveLength(3);
    const botones = page.locator("#ajustesRemuneratedAccounts [data-remunerated-remove]");
    await expect(botones).toHaveCount(3);
    await botones.nth(1).scrollIntoViewIfNeeded();
    await botones.nth(1).click();
    await expect(botones).toHaveCount(2);
    await expect(page.locator("#undoToast")).toBeVisible();
    await expect(page.locator("#undoToastMessage")).toContainText("Cuenta «");
    await expect(page.locator("#undoToastMessage")).toContainText("quitada");
    await page.click("#undoToastButton");
    await expect(botones).toHaveCount(3);
    expect(await order(), "vuelve en el mismo sitio, no al final").toEqual(before);

    const polizas = page.locator("#ajustesInsurancePolicies [data-policy-remove]");
    await expect(polizas).toHaveCount(2);
    await polizas.first().scrollIntoViewIfNeeded();
    await polizas.first().click();
    await expect(polizas).toHaveCount(1);
    await expect(page.locator("#undoToastMessage")).toContainText("Póliza «");
    await page.click("#undoToastButton");
    await expect(polizas).toHaveCount(2);
    const stored = await page.evaluate(() => insurancePolicies().map((policy) => policy.name));
    expect(stored).toEqual(["Póliza A ficticia", "Póliza B ficticia"]);

    // Sobrevive a recargar: lo deshecho quedó guardado, y lo quitado sin deshacer también se queda quitado.
    await botones.nth(2).click();
    await expect(botones).toHaveCount(2);
    await page.waitForTimeout(300);
    await page.reload();
    await expect(page.locator("#ajustesRemuneratedAccounts")).toBeAttached();
    expect(await page.evaluate(() => remuneratedAccounts().length)).toBe(2);
    expect(dialogs, "ningún diálogo nativo del navegador").toEqual([]);
    expect(pageErrors).toEqual([]);
  });
});

// WP-38 PR-2 (docs/WP38_DISENO.md §4): el aviso del plan B también en Cierre, que se abre cada mes. Sin plan no sale nada; con plan, dice si salta, está en vigilancia,
// no salta o no puede vigilarse; un plan sin firmar se marca como borrador. Planes INVENTADOS, sembrados en el almacén con el motor real.
test.describe("WP-38 · aviso del plan B en Cierre", () => {
  const seed = (page, { trigger, actions, signed }) => page.evaluate(({ trigger: t, actions: a, signed: s }) => {
    const engine = FinanceCanonicalContingencyPlan;
    let plan = engine.normalizePlan({ trigger: t, actions: a });
    if (s) plan = engine.sign(plan, { signers: ["Ana", "Luis"], today: "2026-10-13" }).plan;
    storageSet(storageKey("contingency-plan"), JSON.stringify(plan));
  }, { trigger, actions, signed });
  const openCierre = async (page) => {
    await page.goto("/index.html#cierre");
    await expect(page.locator("#cierreVersions")).toBeAttached({ timeout: 15000 });
  };
  const aviso = (page) => page.locator("#planBAviso");

  test("sin plan no sale nada; con plan: salta, borrador, sin disparar, incompleto; el botón lleva al plan, sin diálogos ni desbordes", async ({ page }) => {
    test.setTimeout(120000);
    const pageErrors = [];
    const dialogs = [];
    page.on("pageerror", (error) => pageErrors.push(String(error)));
    page.on("dialog", async (dialog) => { dialogs.push(dialog.message()); await dialog.dismiss(); });
    for (const viewport of [{ width: 1280, height: 900 }, { width: 390, height: 844 }]) {
      await page.setViewportSize(viewport);
      await page.goto("/index.html#cierre");
      await page.evaluate(() => { try { localStorage.clear(); } catch { /* sin almacenamiento */ } });
      await page.reload();
      await openCierre(page);
      await expect(aviso(page)).toBeHidden();

      const actions = [{ kind: "cut-discretionary", pct: 20, months: 3 }, { kind: "credit-line", amount: 1500 }];
      // Firmado y con un umbral tan alto que, con la previsión de hoy, salta.
      await seed(page, { trigger: { mode: "amount", amount: 99999999, consecutive: 2, horizon: 6 }, actions, signed: true });
      await page.reload();
      await openCierre(page);
      await expect(aviso(page)).toBeVisible({ timeout: 15000 });
      await expect(aviso(page).locator("[data-planb-aviso-status]")).toHaveAttribute("data-planb-aviso-status", "triggered");
      await expect(aviso(page)).toContainText("Se cumple vuestro plan B");
      await expect(aviso(page)).toContainText("Lo acordado, en orden:");
      await expect(aviso(page).locator(".pb-pasos li")).toHaveCount(2);
      await expect(aviso(page)).not.toContainText("borrador");
      await expect(aviso(page)).toContainText("La app solo lo enseña, no hace nada por vosotros");
      // Nada se sale de la tarjeta.
      const box = await aviso(page).boundingBox();
      const outside = await aviso(page).evaluate((node) => [...node.querySelectorAll("*")].filter((el) => { const r = el.getBoundingClientRect(); const c = node.getBoundingClientRect(); return r.width > 0 && (r.right > c.right + 1 || r.left < c.left - 1); }).map((el) => el.tagName));
      expect(outside, `elementos fuera de la tarjeta: ${outside.join(", ")}`).toEqual([]);
      expect(box.width).toBeLessThanOrEqual(viewport.width);

      // Sin firmar: sigue avisando, pero como borrador.
      await seed(page, { trigger: { mode: "amount", amount: 99999999, consecutive: 2, horizon: 6 }, actions, signed: false });
      await page.reload();
      await openCierre(page);
      await expect(aviso(page)).toContainText("Se cumple vuestro plan B");
      await expect(aviso(page)).toContainText("borrador sin firmar");

      // Sin disparar: un umbral de 1 € no salta nunca.
      await seed(page, { trigger: { mode: "amount", amount: 1, consecutive: 2, horizon: 6 }, actions, signed: true });
      await page.reload();
      await openCierre(page);
      await expect(aviso(page).locator("[data-planb-aviso-status]")).toHaveAttribute("data-planb-aviso-status", "ok");
      await expect(aviso(page)).toContainText("sin disparar");
      await expect(aviso(page).locator(".pb-pasos")).toHaveCount(0);

      // Incompleto: lo dice, no lo da por bueno.
      await seed(page, { trigger: { mode: "amount", amount: 5000, consecutive: 2, horizon: 6 }, actions: [], signed: false });
      await page.reload();
      await openCierre(page);
      await expect(aviso(page).locator("[data-planb-aviso-status]")).toHaveAttribute("data-planb-aviso-status", "incomplete");
      await expect(aviso(page)).toContainText("incompleto");
      await expect(aviso(page)).toContainText("Falta al menos una acción");

      // El botón lleva al plan completo (Plan › Previsión).
      await aviso(page).getByRole("button", { name: "Ver el plan completo" }).click();
      await expect(page.locator("#planBCard")).toBeVisible({ timeout: 15000 });
    }
    expect(dialogs, "ningún diálogo nativo").toEqual([]);
    expect(pageErrors).toEqual([]);
  });
});

// WP-39 PR-2 (docs/WP39_DISENO.md §3): la política de inversión al REGISTRAR una compra o venta, en el libro de operaciones (Inversión › Cartera). No bloquea: con una política
// FIRMADA que la operación contradice, pide un motivo y lo deja anotado aparte; sin motivo no se registra esa operación (y se dice por qué), pero nada más se bloquea. Datos INVENTADOS.
test.describe("WP-39 · la política al registrar una compra o venta", () => {
  const POSITIONS = [
    // Reparto de la política: fondo 80 % / acción 20 % (banda 5). Con estos valores la cartera está dentro de banda, así que comprar fondo NO choca.
    { id: "A", type: "fondo", label: "Fondo A ficticio", provenance: "manual", asOf: "2026-10-01", acquisitionDate: "2020-01-10", quantity: 100, costBasis: 7000, currentValue: 8000, contributions: [], disposals: [] },
    { id: "D", type: "accion", label: "Acción D ficticia", provenance: "manual", asOf: "2026-10-01", acquisitionDate: "2021-01-10", quantity: 10, costBasis: 1500, currentValue: 2000, contributions: [], disposals: [] },
    { id: "C", type: "cripto", label: "Cripto C ficticia", provenance: "manual", asOf: "2026-10-01", acquisitionDate: "2024-01-10", quantity: 1, costBasis: 100, currentValue: 100, contributions: [], disposals: [] },
  ];
  const open = async (page) => {
    await page.goto("/index.html#inversion-cartera");
    await page.reload();
    await page.evaluate(() => { try { localStorage.clear(); } catch { /* sin almacenamiento */ } });
    await page.reload();
    await expect(page.locator("#opsCard")).toBeAttached({ timeout: 15000 });
    await page.evaluate((positions) => { saveIv1PositionsList(positions); renderIv1PositionList(); }, POSITIONS);
    return page.locator("#opsCuerpo");
  };
  const signPolicy = (page) => page.evaluate(() => {
    const engine = FinanceCanonicalInvestmentPolicy;
    const draft = engine.normalizePolicy({ purpose: { text: "jubilación", horizonYears: 20 }, allocation: { targets: { fondo: 80, accion: 20 }, bandPct: 5 }, contribution: { mode: "fixed", monthly: 300 }, exclusions: { noCrypto: true }, drawdown: { at20: "keep-contributing", at35: "hold" }, review: { everyMonths: 12 } });
    politicaSave(engine.sign(draft, { signers: ["Ana", "Luis"], today: "2026-10-13" }).policy);
  });
  const reasons = (page) => page.evaluate(() => JSON.parse(JSON.stringify(politicaReasonsLoad())));
  const contributions = (page, id) => page.evaluate((positionId) => iv1PositionsList().find((p) => p.id === positionId).contributions.length, id);
  const startBuy = async (page, body, positionId, amount) => {
    await body.locator("#opsPosicion").selectOption(positionId);
    await body.locator('[data-ops-action="add-buy"]').click();
    await body.locator("#opsFecha").fill("2026-10-10");
    await body.locator("#opsImporte").fill(String(amount));
    await body.locator('#opsForm button[type="submit"]').click();
  };

  test("contradice una política firmada: pide motivo, sin él no se registra y lo dice; con él se registra, queda anotado, se deshace y se cuenta en la tarjeta de la política; sin política o sin choque no pide nada", async ({ page }) => {
    test.setTimeout(150000);
    const pageErrors = [];
    const dialogs = [];
    page.on("pageerror", (error) => pageErrors.push(String(error)));
    page.on("dialog", async (dialog) => { dialogs.push(dialog.message()); await dialog.dismiss(); });
    for (const viewport of [{ width: 1280, height: 900 }, { width: 390, height: 844 }]) {
      await page.setViewportSize(viewport);
      let body = await open(page);

      // Sin política: ni bloque ni motivo.
      await startBuy(page, body, "C", 500);
      await expect(body).toContainText("Qué cambia si guardas");
      await expect(body.locator("[data-ops-politica]")).toHaveCount(0);
      await expect(body.locator("#opsMotivo")).toHaveCount(0);

      // Con la política firmada: comprar cripto la contradice.
      body = await open(page);
      await signPolicy(page);
      await startBuy(page, body, "C", 500);
      const bloque = body.locator('[data-ops-politica="contradicts"]');
      await expect(bloque).toBeVisible();
      await expect(bloque).toContainText("Esta operación contradice la política");
      await expect(bloque).toContainText("Comprar cripto");
      await expect(bloque).toContainText(/Regla \d+\./);
      await expect(bloque).toContainText("No se bloquea nada");
      await expect(body.locator("#opsMotivo")).toBeVisible();
      await expect(bloque.locator("label.ops-motivo")).toContainText("hace falta para registrarla");

      // Sin motivo no se registra ESA operación, y se dice por qué (sin diálogos).
      const before = await contributions(page, "C");
      await body.locator('[data-ops-action="save"]').click();
      await expect(body.locator("#opsMotivoError")).toBeVisible();
      await expect(body.locator("#opsMotivoError")).toContainText("escribe el motivo");
      expect(await contributions(page, "C"), "sin motivo no se guarda").toBe(before);
      expect(Object.keys((await reasons(page)).byOperation)).toHaveLength(0);

      // Con motivo: se registra, queda anotado y se deshace.
      await body.locator("#opsMotivo").fill("Prueba pequeña que decidimos las dos personas");
      await body.locator('[data-ops-action="save"]').click();
      await expect(page.locator("#undoToastMessage")).toContainText("Operación añadida");
      expect(await contributions(page, "C")).toBe(before + 1);
      const stored = Object.values((await reasons(page)).byOperation);
      expect(stored).toHaveLength(1);
      expect(stored[0].note).toBe("Prueba pequeña que decidimos las dos personas");
      expect(stored[0].verdict).toBe("contradicts");
      await page.click("#undoToastButton");
      expect(await contributions(page, "C"), "deshacer devuelve la cartera").toBe(before);
      expect(Object.keys((await reasons(page)).byOperation), "y quita el motivo").toHaveLength(0);

      // Otra vez, y se cuenta en la tarjeta de la política (Inversión › Rebalanceo).
      await startBuy(page, body, "C", 700);
      await body.locator("#opsMotivo").fill("Segunda prueba");
      await body.locator('[data-ops-action="save"]').click();
      expect(await contributions(page, "C")).toBe(before + 1);
      await page.goto("/index.html#inversion-rebalanceo");
      const card = page.locator("#politicaCard");
      await expect(card).toBeVisible({ timeout: 15000 });
      await expect(card.locator("[data-politica-constancia]")).toHaveAttribute("data-politica-constancia", "1-0");
      await expect(card).toContainText("contradecían la política");
      await card.locator(".pol-constancia-lista summary").click();
      await expect(card.locator(".pol-constancia-lista")).toContainText("Segunda prueba");

      // Sin choque: comprar un fondo (80 % del objetivo) no pide nada y no deja constancia.
      await page.goto("/index.html#inversion-cartera");
      body = page.locator("#opsCuerpo");
      await expect(body).toBeVisible({ timeout: 15000 });
      await startBuy(page, body, "A", 300);
      await expect(body.locator("[data-ops-politica]")).toHaveCount(1);
      await expect(body.locator('[data-ops-politica="contradicts"]')).toHaveCount(0);
      await expect(body.locator("#opsMotivo")).toHaveCount(0);
      await body.locator('[data-ops-action="save"]').click();
      await expect(page.locator("#undoToastMessage")).toContainText("Operación añadida");
      expect(Object.keys((await reasons(page)).byOperation), "no choca: sin constancia").toHaveLength(1);

      // Una venta sin saber la caída: «ojo», motivo opcional, y no bloquea.
      await body.locator('[data-ops-action="add-sell"]').click();
      await expect(body.locator("#opsCaida")).toBeVisible();
      await body.locator("#opsFecha").fill("2026-10-11");
      await body.locator("#opsUnidades").fill("1");
      await body.locator("#opsImporte").fill("120");
      await body.locator('#opsForm button[type="submit"]').click();
      const ojo = body.locator('[data-ops-politica="warns"]');
      await expect(ojo).toContainText("Ojo");
      await expect(ojo.locator("label.ops-motivo")).toContainText("opcional");
      // Nada se sale de la tarjeta.
      const outside = await body.locator(".ops-politica").evaluate((node) => [...node.querySelectorAll("*")].filter((el) => { const r = el.getBoundingClientRect(); const c = node.getBoundingClientRect(); return r.width > 0 && (r.right > c.right + 1 || r.left < c.left - 1); }).map((el) => el.tagName));
      expect(outside, `elementos fuera del bloque: ${outside.join(", ")}`).toEqual([]);
      await body.locator('[data-ops-action="save"]').click();
      await expect(page.locator("#undoToastMessage")).toContainText("Operación añadida");
      expect(Object.keys((await reasons(page)).byOperation)).toHaveLength(2);
    }
    expect(dialogs, "ningún diálogo nativo").toEqual([]);
    expect(pageErrors).toEqual([]);
  });
});

// WP-41 PR-2 (docs/WP41_DISENO.md §6): el aviso de deuda en la sombra también en Cierre, que se abre cada mes. Sin nada que decir no sale; con compromisos en el extracto
// los cuenta (sin dar nada de alta); con un extracto viejo avisa de que no puede mirar; su botón lleva a Deuda › Contratos. Extracto INVENTADO, sembrado en memoria.
test.describe("WP-41 · aviso de deuda en la sombra en Cierre", () => {
  const sembrar = (page, { recientes }) => page.evaluate(({ recientes: reciente }) => {
    const today = new Date();
    const back = (days) => isoLocalDate(new Date(today.getFullYear(), today.getMonth(), today.getDate() - days));
    const rows = [];
    let balance = 3000;
    const add = (date, amount, movement) => rows.push({ date, month: date.slice(0, 7), movement, details: "", amount, balance: (balance += 1), accountId: "caixabank" });
    const offset = reciente ? 0 : 120;
    add(back(offset + 40), -30, "MOVISTAR CUOTA TERMINAL 2 DE 24");
    add(back(offset + 10), -30, "MOVISTAR CUOTA TERMINAL 3 DE 24");
    add(back(offset + 8), -49.9, "KLARNA PAGO 2 DE 3");
    baseData.transactions = mergeTransactions([], rows);
    refreshMovementRollups();
    renderCierre(); // el repintado real de Cierre: así se prueba también el enganche de views/cierre.js, no solo la función del aviso
  }, { recientes });
  const aviso = (page) => page.locator("#sombraAviso");
  const abrirCierre = async (page) => {
    await page.goto("/index.html#cierre");
    await expect(page.locator("#cierreVersions")).toBeAttached({ timeout: 15000 });
  };

  test("sin extracto no sale nada; con compromisos los cuenta sin darlos de alta; con extracto viejo avisa de que no puede mirar; el botón lleva a Contratos", async ({ page }) => {
    test.setTimeout(120000);
    const pageErrors = [];
    const dialogs = [];
    page.on("pageerror", (error) => pageErrors.push(String(error)));
    page.on("dialog", async (dialog) => { dialogs.push(dialog.message()); await dialog.dismiss(); });
    for (const viewport of [{ width: 1280, height: 900 }, { width: 390, height: 844 }]) {
      await page.setViewportSize(viewport);
      await page.goto("/index.html#cierre");
      await page.evaluate(() => { try { localStorage.clear(); } catch { /* sin almacenamiento */ } });
      await page.reload();
      await abrirCierre(page);
      await page.evaluate(() => { baseData.transactions = []; refreshMovementRollups(); renderCierre(); });
      await expect(aviso(page), "sin ningún extracto importado no sale nada").toBeHidden();
      const contratosAntes = await page.evaluate(() => JSON.stringify(canonicalDebtContractRows().map((c) => [c.id, c.entity, c.currentPrincipal])));

      await sembrar(page, { recientes: true });
      await expect(aviso(page)).toBeVisible();
      await expect(aviso(page)).toContainText("2 compromisos parecen deuda sin figurar como deuda");
      await expect(aviso(page)).toContainText("al mes entre estos 2");
      await expect(aviso(page)).toContainText("MOVISTAR CUOTA TERMINAL 3 DE 24");
      await expect(aviso(page)).toContainText("Ninguno cuenta hoy en la fecha libre de deuda");
      await expect(aviso(page)).toContainText("la app no da de alta nada");
      await expect(aviso(page)).not.toContainText(/todo bien|no hay deuda/i);
      const outside = await aviso(page).evaluate((node) => [...node.querySelectorAll("*")].filter((el) => { const r = el.getBoundingClientRect(); const c = node.getBoundingClientRect(); return r.width > 0 && (r.right > c.right + 1 || r.left < c.left - 1); }).map((el) => el.tagName));
      expect(outside, `elementos fuera de la tarjeta: ${outside.join(", ")}`).toEqual([]);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), `sin desbordar en ${viewport.width} px`).toBe(true);
      expect(await page.evaluate(() => JSON.stringify(canonicalDebtContractRows().map((c) => [c.id, c.entity, c.currentPrincipal]))), "el aviso no da de alta nada").toBe(contratosAntes);
      expect(await page.evaluate(() => storageGet(storageKey("shadow-debt-answers"), "null")), "ni responde por vosotros").not.toContain("not-debt");

      await sembrar(page, { recientes: false });
      await expect(aviso(page)).toBeVisible();
      await expect(aviso(page)).toContainText("el extracto no es reciente");
      await expect(aviso(page)).toContainText("que no salga nada no significa que no haya");

      await sembrar(page, { recientes: true });
      await aviso(page).locator("[data-sombra-aviso-ver]").click();
      await expect(page.locator("#sombraCard")).toBeVisible({ timeout: 15000 });
      expect(new URL(page.url()).hash).toBe("#deuda-contratos");
    }
    expect(dialogs, "ningún diálogo nativo").toEqual([]);
    expect(pageErrors, `errores de página: ${pageErrors.join(" | ")}`).toEqual([]);
  });
});

// WP-42 PR-2 (docs/WP42_DISENO.md §6): el reparto de la escalera frente a la política firmada (WP-39) y al plan B (WP-38). Solo avisa: no reordena ni bloquea. Datos INVENTADOS:
// cartera 100 % fondos, objetivos 50/50 fondo-cripto (el reparto manda dinero a cripto), política firmada que no compra cripto, plan B firmado con un umbral que salta.
test.describe("WP-42 · la escalera frente a la política y el plan B", () => {
  const prepare = async (page) => {
    await page.goto("/index.html#deuda-comparar");
    await page.reload();
    await page.evaluate(() => { try { localStorage.clear(); } catch { /* sin almacenamiento */ } });
    await page.reload();
    await expect(page.locator("#proxEuroCard")).toBeVisible({ timeout: 15000 });
    await page.evaluate(() => {
      globalThis.accountBalancesFromState = () => ({ total: 10000 });
      globalThis.cuadroMandosReserve = () => 3000;
      globalThis.canonicalDebtContractRows = () => [];
      globalThis.iv6PortfolioTargets = () => ({ fondo: 50, cripto: 50 });
      state.fiscalWithholdingRate = 37;
      state.dividendSpanishSavingsRatePct = 19;
      saveIv1PositionsList([{ id: "A", type: "fondo", label: "Fondo A ficticio", provenance: "manual", asOf: "2026-10-01", acquisitionDate: "2020-01-10", quantity: 100, costBasis: 8000, currentValue: 10000, contributions: [], disposals: [] }]);
    });
    return page.locator("#proxEuroCard");
  };
  const calculate = async (card) => {
    await card.locator("#proxEuroImporte").fill("4000");
    await card.locator("#proxEuroRentabilidad").fill("7");
    await card.locator('#proxEuroForm button[type="submit"]').click();
    await expect(card.locator("[data-peu-rung]")).toHaveCount(4);
  };
  const signPolicy = (page) => page.evaluate(() => {
    const engine = FinanceCanonicalInvestmentPolicy;
    const draft = engine.normalizePolicy({ purpose: { text: "jubilación", horizonYears: 20 }, allocation: { targets: { fondo: 50, cripto: 50 }, bandPct: 5 }, contribution: { mode: "fixed", monthly: 300 }, exclusions: { noCrypto: true }, drawdown: { at20: "keep-contributing", at35: "hold" }, review: { everyMonths: 12 } });
    politicaSave(engine.sign(draft, { signers: ["Ana", "Luis"], today: "2026-10-13" }).policy);
    renderProximoEuro(FinanceCanonicalNextEuro);
  });
  const savePlanB = (page, signed) => page.evaluate((isSigned) => {
    const engine = FinanceCanonicalContingencyPlan;
    let plan = engine.normalizePlan({ trigger: { mode: "amount", amount: 99999999, consecutive: 2, horizon: 6 }, actions: [{ kind: "cut-discretionary", pct: 20, months: 3 }, { kind: "credit-line", amount: 1500 }] });
    if (isSigned) plan = engine.sign(plan, { signers: ["Ana", "Luis"], today: "2026-10-13" }).plan;
    planBSave(plan);
    renderProximoEuro(FinanceCanonicalNextEuro);
  }, signed);

  test("sin política ni plan B no sale nada; con política firmada avisa de la cripto; con plan B que salta avisa del dinero que se inmoviliza; el reparto no cambia; sin diálogos ni desbordes", async ({ page }) => {
    test.setTimeout(150000);
    const pageErrors = [];
    const dialogs = [];
    page.on("pageerror", (error) => pageErrors.push(String(error)));
    page.on("dialog", async (dialog) => { dialogs.push(dialog.message()); await dialog.dismiss(); });
    for (const viewport of [{ width: 1280, height: 900 }, { width: 390, height: 844 }]) {
      await page.setViewportSize(viewport);
      const card = await prepare(page);
      await calculate(card);
      const out = card.locator("#proxEuroResultado");
      const cruce = out.locator(".peu-cruce");
      await expect(cruce, "sin política ni plan B guardados no sale nada").toHaveCount(0);
      const repartoAntes = await out.locator("[data-peu-rung]").evaluateAll((nodes) => nodes.map((n) => `${n.dataset.peuRung}:${n.querySelector(".peu-importe").textContent}`));
      expect(repartoAntes.join("|")).toContain("invest:");

      // Política firmada que no compra cripto, con un reparto que manda dinero a cripto.
      await signPolicy(page);
      await expect(cruce).toBeVisible();
      const politica = cruce.locator('[data-peu-cruce="politica"]');
      await expect(politica).toHaveAttribute("data-peu-cruce-nivel", "contradicts");
      await expect(politica).toContainText("contradice vuestra política");
      await expect(politica).toContainText("cripto");
      await expect(politica).toContainText("la política dice que no se compra");
      await expect(cruce.locator('[data-peu-cruce="plan-b"]'), "sin plan B guardado, ni una palabra").toHaveCount(0);

      // Plan B firmado que salta: avisa del dinero que se inmoviliza o puede bajar.
      await savePlanB(page, true);
      const planB = cruce.locator('[data-peu-cruce="plan-b"]');
      await expect(planB).toHaveAttribute("data-peu-cruce-nivel", "alert");
      await expect(planB).toContainText("Vuestro plan B se cumple hoy");
      await expect(planB).toContainText("pensión e inversión");
      await expect(planB).toContainText("La escalera no se reordena");
      await expect(planB).not.toContainText("borrador");

      // Sin firmar: sigue avisando, pero como borrador.
      await savePlanB(page, false);
      await expect(cruce.locator('[data-peu-cruce="plan-b"]')).toContainText("El plan B está sin firmar: es un borrador");

      // Solo avisa: el reparto es el mismo que sin política ni plan B, y nada se desborda.
      const repartoDespues = await out.locator("[data-peu-rung]").evaluateAll((nodes) => nodes.map((n) => `${n.dataset.peuRung}:${n.querySelector(".peu-importe").textContent}`));
      expect(repartoDespues).toEqual(repartoAntes);
      const outside = await cruce.evaluate((node) => [...node.querySelectorAll("*")].filter((el) => { const r = el.getBoundingClientRect(); const c = node.getBoundingClientRect(); return r.width > 0 && (r.right > c.right + 1 || r.left < c.left - 1); }).map((el) => el.tagName));
      expect(outside, `elementos fuera de la tarjeta: ${outside.join(", ")}`).toEqual([]);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), `sin desbordar en ${viewport.width} px`).toBe(true);
    }
    expect(dialogs, "ningún diálogo nativo").toEqual([]);
    expect(pageErrors, `errores de página: ${pageErrors.join(" | ")}`).toEqual([]);
  });
});

// WP-43 PR-2 (docs/WP43_DISENO.md §6): el aviso del puente de previsión en Cierre. Sin puente o con un cambio pequeño no sale nada; con un cambio relevante dice la dirección y la frase
// del puente, y su botón lleva a Plan › Previsión. Dos cierres INVENTADOS a partir de la previsión real de la app, sembrados en el almacén con el motor real.
test.describe("WP-43 · aviso del puente en Cierre", () => {
  const seed = (page, { shiftPct }) => page.evaluate(({ shiftPct: pct }) => {
    const engine = FinanceCanonicalForecastBridge;
    const series = JSON.parse(JSON.stringify(canonicalScenarioResults.base.forecast.series));
    const year = Number(series[0].monthKey.slice(0, 4));
    const first = engine.freezeYearEnd({ monthKey: `${year}-09`, closedAt: `${year}-10-02T10:00:00Z`, series, actuals: null });
    const amount = Math.max(1, Math.round(Math.abs(first.snapshot.yearEndLiquidity) * pct / 100));
    const worse = JSON.parse(JSON.stringify(series));
    let shift = 0;
    worse.forEach((row) => {
      if (row.monthKey === `${year}-12`) { row.totals.outflowsBeforeSaving += amount; row.components.outflow.project = (row.components.outflow.project || 0) + amount; shift -= amount; }
      if (row.monthKey >= `${year}-12`) row.totals.closingLiquidity += shift;
    });
    const second = engine.freezeYearEnd({ monthKey: `${year}-10`, closedAt: `${year}-11-02T10:00:00Z`, series: worse, actuals: null });
    puenteSave(engine.upsert(engine.upsert([], first.snapshot), second.snapshot));
    renderCierre();
    return { year, amount, calculable: first.calculable && second.calculable };
  }, { shiftPct });
  const aviso = (page) => page.locator("#puenteAviso");
  const openCierre = async (page) => {
    await page.goto("/index.html#cierre");
    await page.evaluate(() => { try { localStorage.clear(); } catch { /* sin almacenamiento */ } });
    await page.reload();
    await expect(page.locator("#cierreVersions")).toBeAttached({ timeout: 15000 });
  };

  test("sin puente no sale nada; un cambio pequeño tampoco; un cambio relevante dice la dirección y la frase; el botón lleva a Previsión; sin diálogos ni desbordes", async ({ page }) => {
    test.setTimeout(120000);
    const pageErrors = [];
    const dialogs = [];
    page.on("pageerror", (error) => pageErrors.push(String(error)));
    page.on("dialog", async (dialog) => { dialogs.push(dialog.message()); await dialog.dismiss(); });
    for (const viewport of [{ width: 1280, height: 900 }, { width: 390, height: 844 }]) {
      await page.setViewportSize(viewport);
      await openCierre(page);
      await expect(aviso(page), "sin ninguna previsión congelada no sale nada").toBeHidden();

      const small = await seed(page, { shiftPct: 1 });
      expect(small.calculable).toBe(true);
      await expect(aviso(page), "un cambio de un 1 % no es relevante: no sale en Cierre").toBeHidden();

      const big = await seed(page, { shiftPct: 30 });
      expect(big.calculable).toBe(true);
      await expect(aviso(page)).toBeVisible();
      await expect(aviso(page).locator("[data-puente-aviso-nivel]")).toHaveAttribute("data-puente-aviso-nivel", "worsens");
      await expect(aviso(page)).toContainText(`El fin de ${big.year} empeora desde el cierre anterior`);
      await expect(aviso(page)).toContainText("Desde septiembre");
      await expect(aviso(page)).toContainText("Es una explicación de la previsión, no la cambia");
      await expect(aviso(page)).not.toContainText(/todo bien|sin cambios importantes/i);
      const outside = await aviso(page).evaluate((node) => [...node.querySelectorAll("*")].filter((el) => { const r = el.getBoundingClientRect(); const c = node.getBoundingClientRect(); return r.width > 0 && (r.right > c.right + 1 || r.left < c.left - 1); }).map((el) => el.tagName));
      expect(outside, `elementos fuera de la tarjeta: ${outside.join(", ")}`).toEqual([]);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), `sin desbordar en ${viewport.width} px`).toBe(true);

      // El aviso solo lee: el almacén sigue con las dos fotos.
      expect(await page.evaluate(() => JSON.parse(storageGet(storageKey("forecast-bridge-snapshots"), "[]")).length)).toBe(2);

      await aviso(page).locator("[data-puente-aviso-ver]").click();
      await expect(page.locator("#puenteCard")).toBeVisible({ timeout: 15000 });
    }
    expect(dialogs, "ningún diálogo nativo").toEqual([]);
    expect(pageErrors, `errores de página: ${pageErrors.join(" | ")}`).toEqual([]);
  });
});

// WP-44 PR-2 (docs/WP44_DISENO.md §6): el aviso de calma en caídas en Cierre. Sin serie o con una caída por debajo del primer nivel no sale nada; con una caída de nivel 2 dice la cifra, lo que falta
// de política firmada, y su botón lleva a Inversión › Cartera. Una cartera de un fondo con tres valoraciones INVENTADAS (1.000 → 1.200 → último valor), sin aportaciones, sembradas con el motor real.
test.describe("WP-44 · aviso de calma en Cierre", () => {
  const seed = (page, { last }) => page.evaluate(({ last: lastValue }) => {
    const iso = (days) => { const d = new Date(); d.setDate(d.getDate() + days); return isoLocalDate(d); };
    scenarioSettings.portfolioPositions = [{ id: "cal-a", type: "fondo", label: "Fondo de prueba", quantity: 0, costBasis: 1000, currentValue: lastValue, asOf: iso(-10), acquisitionDate: iso(-400), provenance: "declared", contributions: [] }];
    saveScenarioSettings();
    savePortfolioValuations({ valuations: [
      { date: iso(-100), savedAt: new Date().toISOString(), points: [{ id: "cal-a", value: 1000, cost: 1000 }] },
      { date: iso(-40), savedAt: new Date().toISOString(), points: [{ id: "cal-a", value: 1200, cost: 1000 }] },
      { date: iso(-10), savedAt: new Date().toISOString(), points: [{ id: "cal-a", value: lastValue, cost: 1000 }] },
    ], timings: [] });
    renderCierre();
    return loadPortfolioValuations().valuations.length;
  }, { last });
  const aviso = (page) => page.locator("#calmaAviso");
  const openCierre = async (page) => {
    await page.goto("/index.html#cierre");
    await page.evaluate(() => { try { localStorage.clear(); } catch { /* sin almacenamiento */ } });
    await page.reload();
    await expect(page.locator("#cierreVersions")).toBeAttached({ timeout: 15000 });
  };

  test("sin serie no sale nada; una caída por debajo del primer nivel tampoco; una de nivel 2 dice la cifra y la falta de política; el botón lleva a la tarjeta; sin diálogos ni desbordes", async ({ page }) => {
    test.setTimeout(120000);
    const pageErrors = [];
    const dialogs = [];
    page.on("pageerror", (error) => pageErrors.push(String(error)));
    page.on("dialog", async (dialog) => { dialogs.push(dialog.message()); await dialog.dismiss(); });
    for (const viewport of [{ width: 1280, height: 900 }, { width: 390, height: 844 }]) {
      await page.setViewportSize(viewport);
      await openCierre(page);
      await expect(aviso(page), "sin valoraciones no hay serie ni aviso").toBeHidden();

      expect(await seed(page, { last: 1100 })).toBe(3);
      await expect(aviso(page), "una caída del 8,3 % no llega al primer nivel (20 %): no sale en Cierre").toBeHidden();

      await seed(page, { last: 700 });
      await expect(aviso(page)).toBeVisible();
      await expect(aviso(page).locator("[data-calma-aviso-nivel]")).toHaveAttribute("data-calma-aviso-nivel", "alert");
      await expect(aviso(page)).toContainText("La cartera está un 41,7 % por debajo de su máximo");
      await expect(aviso(page)).toContainText("ha restado 500 €");
      await expect(aviso(page)).toContainText("sin contar lo que habéis aportado o vendido");
      await expect(aviso(page)).toContainText("No hay una política de inversión firmada");
      await expect(aviso(page)).not.toContainText(/todo bien|sin problema/i);
      await expect(aviso(page).locator("button")).toHaveCount(1);
      const outside = await aviso(page).evaluate((node) => [...node.querySelectorAll("*")].filter((el) => { const r = el.getBoundingClientRect(); const c = node.getBoundingClientRect(); return r.width > 0 && (r.right > c.right + 1 || r.left < c.left - 1); }).map((el) => el.tagName));
      expect(outside, `elementos fuera de la tarjeta: ${outside.join(", ")}`).toEqual([]);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), `sin desbordar en ${viewport.width} px`).toBe(true);

      // El aviso solo lee: las valoraciones guardadas siguen siendo las tres.
      expect(await page.evaluate(() => loadPortfolioValuations().valuations.length)).toBe(3);

      await aviso(page).locator("[data-calma-aviso-ver]").click();
      await expect(page.locator("#calmaCard")).toBeVisible({ timeout: 15000 });
      expect(new URL(page.url()).hash).toBe("#inversion-cartera");
    }
    expect(dialogs, "ningún diálogo nativo").toEqual([]);
    expect(pageErrors, `errores de página: ${pageErrors.join(" | ")}`).toEqual([]);
  });
});

// WP-46 PR-2 (docs/WP46_DISENO.md §6): la antigüedad del dato de cada componente del patrimonio. Hoy y en la foto del cierre. Datos INVENTADOS; las fechas se calculan respecto a hoy.
test.describe("WP-46 · antigüedad por componente del patrimonio", () => {
  const open = async (page) => {
    await page.goto("/index.html#inversion-cartera");
    await page.reload();
    await page.evaluate(() => { try { localStorage.clear(); } catch { /* sin almacenamiento */ } });
    await page.reload();
    const card = page.locator("#patrimonioCard");
    await expect(card).toBeVisible({ timeout: 15000 });
    return card;
  };
  const seed = (page, { portfolioDays }) => page.evaluate(({ portfolioDays: portfolioAge }) => {
    const iso = (days) => { const d = new Date(); d.setDate(d.getDate() + days); return isoLocalDate(d); };
    scenarioSettings.assets = [{ id: "pat-casa", type: "inmueble", label: "Vivienda de prueba", value: 150000, asOf: iso(-10), provenance: "declared" }];
    scenarioSettings.portfolioPositions = [{ id: "pat-a", type: "fondo", label: "Fondo de prueba", quantity: 0, costBasis: 18000, currentValue: 20000, asOf: iso(-portfolioAge), acquisitionDate: "2025-01-01", provenance: "declared" }];
    saveScenarioSettings();
    state.balanceDate = iso(-1);
    globalThis.accountBalancesFromState = () => ({ caixa: 6000, mediolanum: 4000, total: 10000 });
    globalThis.totalDebtOutstanding = () => 12000;
    renderPatrimonio(FinanceCanonicalNetWorth);
    return iso(-portfolioAge);
  }, { portfolioDays });

  test("hoy avisa de la cartera vieja y de la deuda sin fecha, calla si todo está al día, la foto del cierre guarda las fechas y avisa, y todo solo lee, sin diálogos ni desbordes", async ({ page }) => {
    test.setTimeout(120000);
    const pageErrors = [];
    const dialogs = [];
    page.on("pageerror", (error) => pageErrors.push(String(error)));
    page.on("dialog", async (dialog) => { dialogs.push(dialog.message()); await dialog.dismiss(); });
    for (const viewport of [{ width: 1280, height: 900 }, { width: 390, height: 844 }]) {
      await page.setViewportSize(viewport);
      const card = await open(page);
      const portfolioDate = await seed(page, { portfolioDays: 60 });
      const note = card.locator("#patrimonioHoy [data-patrimonio-antiguedad]");
      await expect(note).toBeVisible();
      await expect(note).toContainText("Cartera de inversión: el dato más antiguo es del");
      await expect(note).toContainText("hace 60 días");
      await expect(note).not.toContainText("Efectivo en cuentas");
      await expect(note).not.toContainText("Vivienda");
      await expect(note).toContainText("La deuda no guarda la fecha de su último dato");
      const outside = await note.evaluate((node) => [...node.querySelectorAll("*")].filter((el) => { const r = el.getBoundingClientRect(); const c = node.getBoundingClientRect(); return r.width > 0 && (r.right > c.right + 1 || r.left < c.left - 1); }).map((el) => el.tagName));
      expect(outside, `elementos fuera del aviso: ${outside.join(", ")}`).toEqual([]);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), `sin desbordar en ${viewport.width} px`).toBe(true);

      // Con todo al día no sale nada (la deuda sola, que no guarda fecha, no dispara el aviso).
      await seed(page, { portfolioDays: 5 });
      await expect(card.locator("#patrimonioHoy [data-patrimonio-antiguedad]")).toHaveCount(0);

      // La foto de un cierre guarda las fechas de sus componentes y avisa de lo viejo que heredó.
      await seed(page, { portfolioDays: 60 });
      expect(await page.evaluate(() => recordPatrimonioSnapshot("2026-10", "2026-11-02T10:00:00Z", { total: 10000 }))).toBe(true);
      const saved = await page.evaluate(() => patrimonioLoad().snapshots[0].asOf);
      expect(saved.cash).toBe("2026-11-02");
      expect(saved.portfolio).toBe(portfolioDate);
      await page.evaluate(() => renderPatrimonio(FinanceCanonicalNetWorth));
      await expect(card.locator("#patrimonioSerie [data-patrimonio-antiguedad]")).toContainText("usa datos antiguos");

      // El aviso solo lee: el patrimonio de hoy y la cartera siguen igual.
      expect(await page.evaluate(() => scenarioSettings.portfolioPositions.length)).toBe(1);
      expect(await page.evaluate(() => patrimonioLoad().snapshots.length)).toBe(1);
    }
    expect(dialogs, "ningún diálogo nativo").toEqual([]);
    expect(pageErrors, `errores de página: ${pageErrors.join(" | ")}`).toEqual([]);
  });
});

// WP-47 PR-2 (docs/WP47_DISENO.md §6): el reparto de la nómina frente a la política firmada y al plan B. Se cruzan los importes EDITADOS con los botones; solo avisa y «Aplicar» sigue disponible.
// Datos INVENTADOS: una nómina de 3.000 €, holgura de 2.000 €, objetivos 50/50 fondo-cripto, política firmada que no compra cripto, plan B firmado que salta.
test.describe("WP-47 · el reparto de la nómina frente a la política y el plan B", () => {
  const prepare = async (page) => {
    await page.goto("/index.html#deuda-comparar");
    await page.reload();
    await page.evaluate(() => { try { localStorage.clear(); } catch { /* sin almacenamiento */ } });
    await page.reload();
    await expect(page.locator("#nominaCard")).toBeVisible({ timeout: 15000 });
    await page.evaluate(() => {
      globalThis.accountBalancesFromState = () => ({ total: 4000 });
      globalThis.cuadroMandosReserve = () => 3000;
      globalThis.canonicalDebtContractRows = () => [];
      globalThis.iv6PortfolioTargets = () => ({ fondo: 50, cripto: 50 });
      state.fiscalWithholdingRate = 37;
      state.dividendSpanishSavingsRatePct = 19;
      saveIv1PositionsList([{ id: "A", type: "fondo", label: "Fondo A ficticio", provenance: "manual", asOf: "2026-10-01", acquisitionDate: "2020-01-10", quantity: 100, costBasis: 8000, currentValue: 10000, contributions: [], disposals: [] }]);
      const original = window.__nominaConfirmedOriginal || nominaConfirmed;
      window.__nominaConfirmedOriginal = original;
      globalThis.nominaConfirmed = (today) => original(today, (label) => /Ingreso Persona A/.test(label));
      globalThis.nominaHeadroom = () => ({ headroom: 2000, floor: 1500, lowest: 3500, staleDays: 0, declared: true, quality: "ok" });
      const month = monthByKey(isoLocalDate(new Date()).slice(0, 7));
      const row = planningSectionsForMonth("income", month)[0].rows[0];
      actualsForKind("income")[actualKeyForRow(row, month)] = 3000;
    });
    // La rentabilidad esperada de invertir se escribe en la escalera, y la nómina la lee.
    await page.locator("#proxEuroImporte").fill("1000");
    await page.locator("#proxEuroRentabilidad").fill("7");
    await page.locator('#proxEuroForm button[type="submit"]').click();
    await expect(page.locator("[data-peu-rung]")).toHaveCount(4);
    await page.evaluate(() => renderNominaReparto(FinanceCanonicalPayrollSplit));
    return page.locator("#nominaCard");
  };
  const signPolicy = (page) => page.evaluate(() => {
    const engine = FinanceCanonicalInvestmentPolicy;
    const draft = engine.normalizePolicy({ purpose: { text: "jubilación", horizonYears: 20 }, allocation: { targets: { fondo: 50, cripto: 50 }, bandPct: 5 }, contribution: { mode: "fixed", monthly: 300 }, exclusions: { noCrypto: true }, drawdown: { at20: "keep-contributing", at35: "hold" }, review: { everyMonths: 12 } });
    politicaSave(engine.sign(draft, { signers: ["Ana", "Luis"], today: "2026-10-13" }).policy);
    renderNominaReparto(FinanceCanonicalPayrollSplit);
  });
  const savePlanB = (page) => page.evaluate(() => {
    const engine = FinanceCanonicalContingencyPlan;
    const plan = engine.sign(engine.normalizePlan({ trigger: { mode: "amount", amount: 99999999, consecutive: 2, horizon: 6 }, actions: [{ kind: "cut-discretionary", pct: 20, months: 3 }, { kind: "credit-line", amount: 1500 }] }), { signers: ["Ana", "Luis"], today: "2026-10-13" }).plan;
    planBSave(plan);
    renderNominaReparto(FinanceCanonicalPayrollSplit);
  });

  test("sin política ni plan B no sale nada; con política firmada avisa de la cripto y cambia al mover los importes; con plan B que salta avisa del dinero que se inmoviliza; «Aplicar» sigue disponible; sin diálogos ni desbordes", async ({ page }) => {
    test.setTimeout(180000);
    const pageErrors = [];
    const dialogs = [];
    page.on("pageerror", (error) => pageErrors.push(String(error)));
    page.on("dialog", async (dialog) => { dialogs.push(dialog.message()); await dialog.dismiss(); });
    for (const viewport of [{ width: 1280, height: 900 }, { width: 390, height: 844 }]) {
      await page.setViewportSize(viewport);
      const card = await prepare(page);
      const body = card.locator("#nominaCuerpo");
      await expect(body.locator("[data-nom-row]").first()).toBeVisible();
      await expect(body.locator("[data-nom-cruce]"), "sin política ni plan B no sale nada").toHaveCount(0);

      // El reparto de la escalera ya manda parte a cripto (objetivo 50/50): la política firmada, que no la admite, lo contradice.
      await signPolicy(page);
      const cruce = body.locator("[data-nom-cruce]");
      await expect(cruce).toBeVisible();
      await expect(cruce.locator('[data-peu-cruce="politica"]')).toHaveAttribute("data-peu-cruce-nivel", "contradicts");
      await expect(cruce).toContainText(/\d[\d.]*(,\d{2})?\s€\sa cripto/);
      await expect(cruce).toContainText("Solo avisa");

      // Se deja la cripto a cero con el importe editado: el aviso de contradicción desaparece.
      await page.evaluate(() => { nominaSetRows(FinanceCanonicalPayrollSplit.setRowAmount(nominaWorking.rows, "invest:cripto", 0), "Cripto"); nominaRepaint(); });
      await expect(body.locator('[data-peu-cruce="politica"][data-peu-cruce-nivel="contradicts"]')).toHaveCount(0);

      // Plan B firmado que salta hoy: avisa de cuánto se manda a pensión e inversión.
      await savePlanB(page);
      await body.locator('[data-nom-id="invest:cripto"][data-nom-step="50"]').click();
      await expect(body.locator('[data-peu-cruce="plan-b"]')).toHaveAttribute("data-peu-cruce-nivel", "alert");
      await expect(body.locator('[data-peu-cruce="plan-b"]')).toContainText("Vuestro plan B se cumple hoy");

      // Solo avisa: «Aplicar» sigue disponible y el aviso no desborda.
      await expect(body.locator('[data-nom-action="aplicar"]')).toBeEnabled();
      const outside = await cruce.evaluate((node) => [...node.querySelectorAll("*")].filter((el) => { const r = el.getBoundingClientRect(); const c = node.getBoundingClientRect(); return r.width > 0 && (r.right > c.right + 1 || r.left < c.left - 1); }).map((el) => el.tagName));
      expect(outside, `elementos fuera del aviso: ${outside.join(", ")}`).toEqual([]);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), `sin desbordar en ${viewport.width} px`).toBe(true);
    }
    expect(dialogs, "ningún diálogo nativo").toEqual([]);
    expect(pageErrors, `errores de página: ${pageErrors.join(" | ")}`).toEqual([]);
  });
});

// Hallazgo vecino de WP-15 (anotado el 7/10, corregido el 15/10): una venta sin importe cobrado se guardaba con 0 y su plusvalía salía «menos el coste entero» (y entraba en la compensación fiscal).
// Ahora la plusvalía de esa venta es «no calculable» y se dice por qué, en el libro de operaciones y en la lista de posiciones; la venta con importe sigue calculándose.
test.describe("Venta sin importe cobrado · plusvalía no calculable", () => {
  const POSITION = { id: "A", type: "fondo", label: "Fondo A", provenance: "manual", asOf: "2026-09-01", acquisitionDate: "2020-01-10", quantity: 100, costBasis: 10000, currentValue: 7000, contributions: [], disposals: [{ id: "s1", date: "2026-03-01", quantitySold: 10, saleProceeds: 1500 }, { id: "s2", date: "2026-04-01", quantitySold: 10, saleProceeds: 0 }] };
  test("la venta con importe da su plusvalía, la que no lo tiene lo dice y no inventa una pérdida; sin desbordes ni errores", async ({ page }) => {
    test.setTimeout(90000);
    const pageErrors = [];
    page.on("pageerror", (error) => pageErrors.push(String(error)));
    for (const viewport of [{ width: 1280, height: 900 }, { width: 390, height: 844 }]) {
      await page.setViewportSize(viewport);
      await page.goto("/index.html#inversion-cartera");
      await page.reload();
      await page.evaluate(() => { try { localStorage.clear(); } catch { /* sin almacenamiento */ } });
      await page.reload();
      const card = page.locator("#opsCard");
      await expect(card).toBeAttached({ timeout: 15000 });
      await page.evaluate((position) => { saveIv1PositionsList([position]); renderIv1PositionList(); }, POSITION);
      const body = card.locator("#opsCuerpo");
      await expect(body.locator('[data-ops-row="s1"]')).toContainText("plusvalía FIFO 500 €");
      await expect(body.locator('[data-ops-row="s2"]')).toContainText("sin importe recibido: plusvalía no calculable");
      await expect(body.locator('[data-ops-row="s2"]')).not.toContainText("-1000");
      await expect(page.locator("#iv1PositionList")).toContainText("sin importe cobrado");
      await expect(page.locator("#iv1PositionList")).not.toContainText("plusvalía realizada -");
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(overflow, `sin desbordar en ${viewport.width} px`).toBeLessThanOrEqual(1);
    }
    expect(pageErrors).toEqual([]);
  });
});

// Cobro caducado (docs/rediseno/ESTADO.md §6; respuestas P3 y P4 del hogar, 19/10/2026): una fecha de cobro
// guardada a mano que ya pasó no se usa en silencio. Fecha inventada, relativa a la de saldos de la demo.
test.describe("Cobro caducado · fecha manual pasada", () => {
  test("Hoy avisa y lleva al editor, que dice «Caducado» con Guardar apagado; el cálculo ya no usa esa fecha", async ({ page }) => {
    await page.goto("/index.html#home");
    await page.waitForFunction(() => typeof coberturaAjusteLeer === "function" && typeof renderHomeDashboard === "function" && typeof state !== "undefined" && state);
    const caducada = await page.evaluate(() => {
      const base = new Date(`${state?.balanceDate || defaultBalanceDate()}T12:00:00`);
      base.setDate(base.getDate() - 20);
      const iso = isoLocalDate(base);
      scenarioSettings.e6Coverage = { nextIncomeDate: iso, dailyOutflow: null };
      saveScenarioSettings();
      renderHomeDashboard();
      return iso;
    });
    const [, mes, dia] = caducada.split("-");
    const hoy = page.locator("#hoyV2:visible, #e6CoveragePanel:visible").first();
    await expect(hoy).toContainText(`Tu fecha de cobro manual caducó el ${dia}/${mes}: ponla al día.`);
    expect(await page.evaluate(() => executiveCoverageSnapshot().nextIncomeDate), "la fecha pasada ya no entra en el cálculo").not.toBe(caducada);
    await hoy.locator("[data-cobertura-ajuste-ir]").first().click();
    await expect(page.locator("#ajustes")).toBeVisible();
    await expect(page.locator("#e6CoverageEditorStatus")).toHaveText("Caducado");
    await expect(page.locator("#e6CoverageSave"), "abrir el editor no deja Guardar encendido").toBeDisabled();
  });
});

// Rediseño A4 (PR-1): Movimientos v2. Movimientos INVENTADOS, sembrados con la misma ruta que el importador real.
test.describe("Rediseño A4 · Movimientos v2", () => {
  for (const viewport of [{ width: 390, height: 844 }, { width: 1440, height: 900 }]) {
    test(`vacío lleva a Importar; con movimientos, lista por día, filtros, detalle y vista de siempre a ${viewport.width} px`, async ({ page }) => {
      test.setTimeout(60000);
      const pageErrors = [];
      page.on("pageerror", (error) => pageErrors.push(String(error)));
      await page.setViewportSize(viewport);
      await page.goto("/index.html#movements");
      const top = page.locator("#movimientosV2");
      await expect(top).toBeVisible({ timeout: 15000 });
      // Sin movimientos: un solo bloque, que lleva a Importar; anomalías tras el detalle.
      await expect(top).toContainText("Todavía no hay movimientos");
      await expect(page.locator("#anomaliasCard")).toBeHidden();
      await expect(page.locator(".movement-detail-title")).toBeHidden();

      await page.evaluate(() => {
        const today = new Date();
        const back = (days) => isoLocalDate(new Date(today.getFullYear(), today.getMonth(), today.getDate() - days));
        const rows = [
          [0, -86.4, "MERCADONA FICTICIA", "CaixaBank"],
          [0, -25, "BIZUM FICTICIO", "CaixaBank"],
          [1, 3000, "NOMINA FICTICIA", "CaixaBank"],
          [3, -58, "GASOLINERA FICTICIA", "Mediolanum"],
        ].map(([days, amount, movement, account]) => ({ date: back(days), month: back(days).slice(0, 7), movement, details: "", amount, balance: null, account, source: "Extracto" }));
        baseData.transactions = mergeTransactions(baseData.transactions || [], rows);
        refreshMovementRollups();
        render();
      });
      const lista = page.locator("#movimientosV2Lista");
      await expect(lista.locator(".mov-v2-fila")).toHaveCount(4);
      await expect(lista.locator(".mov-v2-fila").first()).toContainText("¿partida?");
      await expect(lista.locator(".mov-v2-importe.is-pos")).toContainText("+3.000 €");
      await expect(page.locator("#anomaliasCard")).toBeVisible();
      await expect(top).toContainText("conceptos sin partida");

      // Filtro por cuenta y «Sin partida» desde la bandeja.
      await lista.locator('[data-mov-v2-filtro="Mediolanum"]').click();
      await expect(lista.locator(".mov-v2-fila")).toHaveCount(1);
      await expect(lista.locator(".mov-v2-fila")).toContainText("GASOLINERA FICTICIA");
      await top.locator('[data-mov-v2-filtro="sin-partida"]').click();
      await expect(lista.locator('[data-mov-v2-filtro="sin-partida"]')).toHaveAttribute("aria-pressed", "true");

      // Tocar un movimiento abre el mismo panel de detalle de siempre, con ese movimiento.
      await lista.locator('[data-mov-v2-filtro="todas"]').click();
      await lista.locator(".mov-v2-fila", { hasText: "MERCADONA FICTICIA" }).click();
      const dialog = page.locator("#movementDetailDialog");
      await expect(dialog).toBeVisible();
      await expect(dialog).toContainText("MERCADONA FICTICIA");
      await page.keyboard.press("Escape");

      // «Ver todo el detalle» devuelve la vista de siempre entera.
      await lista.locator("[data-mov-v2-detail]").click();
      await expect(page.locator(".movement-detail-title")).toBeVisible();
      await expect(page.locator("#movementRows tr")).toHaveCount(4);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), "sin desbordar en horizontal").toBe(true);
      expect(pageErrors).toEqual([]);
    });
  }
});

// Rediseño A4 (PR-2): Importar v2 en Registrar › Importar extracto. Extracto y movimientos INVENTADOS.
test.describe("Rediseño A4 · Importar v2", () => {
  for (const viewport of [{ width: 390, height: 844 }, { width: 1440, height: 900 }]) {
    test(`elegir, revisar con cuadre y duplicados, importar y deshacer a ${viewport.width} px`, async ({ page }) => {
      test.setTimeout(90000);
      const pageErrors = [];
      page.on("pageerror", (error) => pageErrors.push(String(error)));
      await page.setViewportSize(viewport);
      await page.goto("/index.html#registrar");
      await page.click('[data-registrar-tab="import"]');
      const v2 = page.locator("#importarV2");
      await expect(v2.locator(".imp-v2-fuente")).toBeVisible({ timeout: 15000 });
      await expect(page.locator("#registrarImportSteps")).toBeHidden();
      // Ya registrado: uno idéntico a una línea del extracto (seguro) y otro parecido (otro día, otro texto).
      await page.evaluate(() => {
        baseData.transactions = mergeTransactions(baseData.transactions || [], [
          { date: "2026-10-02", month: "2026-10", movement: "MERCADONA FICTICIA", details: "", amount: -86.4, balance: null, source: "Manual" },
          { date: "2026-09-30", month: "2026-09", movement: "PLATAFORMA FICTICIA", details: "", amount: -13.99, balance: null, source: "Manual" },
        ]);
        refreshMovementRollups();
      });
      const before = await page.evaluate(() => baseData.transactions.length);
      const csv = ["Fecha;Concepto;Importe;Saldo", "01/10/2026;NOMINA FICTICIA;3000,00;4000,00", "02/10/2026;MERCADONA FICTICIA;-86,40;3913,60", "03/10/2026;PLATAFORMA.COM;-13,99;3899,61", "04/10/2026;LUZ FICTICIA;-94,12;3805,49"].join("\n");
      await page.setInputFiles("#registrarImportFileInput", { name: "extracto.csv", mimeType: "text/csv", buffer: Buffer.from(csv) });
      await expect(v2.locator(".imp-v2-lineas")).toContainText("4 líneas reconocidas", { timeout: 15000 });
      await expect(v2.locator(".imp-v2-cuadre")).toContainText("cuadra al céntimo");
      await expect(v2.locator(".imp-v2-linea.is-dup")).toContainText("MERCADONA FICTICIA");
      const importar = v2.locator("[data-imp-v2-importar]");
      await expect(importar).toBeDisabled();
      await expect(v2).toContainText("1 posible duplicado por decidir");
      await v2.locator(".imp-v2-linea.is-duda [data-imp-v2-dup='distinto']").click();
      await expect(importar).toBeEnabled();
      await expect(importar).toHaveText("Importar 3 movimientos");
      await v2.locator("#importarV2Cuenta").selectOption("CaixaBank");
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), "sin desbordar en horizontal").toBe(true);

      await importar.click();
      await page.click("#operationConfirmSubmit");
      await expect(v2).toContainText("3 movimientos importados", { timeout: 15000 });
      expect(await page.evaluate(() => baseData.transactions.length)).toBe(before + 3);
      expect(await page.evaluate(() => baseData.transactions.filter((t) => t.account === "CaixaBank").length)).toBe(3);

      // Deshacer es el «Deshacer último lote» de siempre.
      await v2.locator("[data-imp-v2-deshacer]").click();
      await page.click("#operationConfirmSubmit");
      await expect(v2.locator(".imp-v2-fuente")).toBeVisible({ timeout: 15000 });
      expect(await page.evaluate(() => baseData.transactions.length)).toBe(before);

      // El asistente de siempre sigue entero detrás de su botón.
      await v2.locator("[data-imp-v2-clasico]").click();
      await expect(page.locator("#registrarImportSteps")).toBeVisible();
      expect(pageErrors).toEqual([]);
    });
  }
});
