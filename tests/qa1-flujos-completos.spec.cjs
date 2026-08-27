const { test, expect } = require("@playwright/test");

// QA-1 (FASE 6): suite de aceptación E2E — navegador real, no el patrón `vm`/extracción de texto que
// usan los 1628 tests de `node --test` (esos verifican funciones aisladas; nunca arrancan la app de
// verdad ni ejercitan `init()`, el enrutado por hash o la carga diferida de PERF-1). Corre igual que
// e18-visual-regression.spec.cjs (mismo playwright.config.cjs, local — no forma parte de `npm run
// verify` ni de CI, la misma decisión ya tomada para la suite visual: un navegador headless en CI es
// una decisión de infraestructura aparte, no incluida en esta tarea).
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
    await input.dispatchEvent("change");
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
  ];

  test("navegar por Hoy, Presupuesto, Deuda, Análisis y Cierre sin errores ni pantallas en blanco", async ({ page }) => {
    const consoleErrors = [];
    page.on("pageerror", (error) => consoleErrors.push(String(error)));

    await page.goto("/index.html");
    await page.waitForLoadState("networkidle");
    await seedExpenseHistory(page, { category: "ocio", months: ["2026-05", "2026-06", "2026-07"] });

    for (const screen of screens) {
      await page.evaluate((hash) => { location.hash = hash; }, screen.hash);
      await page.waitForTimeout(400);
      const body = await page.evaluate(() => document.body.innerHTML);
      expect(body, `pantalla ${screen.hash}`).not.toContain("No se pudo cargar la app");
      const rootHtml = await page.locator(screen.root).innerHTML();
      expect(rootHtml.trim().length, `${screen.hash}: ${screen.root} quedó vacío`).toBeGreaterThan(20);
    }

    expect(consoleErrors, `errores de página: ${consoleErrors.join(" | ")}`).toEqual([]);
  });
});
