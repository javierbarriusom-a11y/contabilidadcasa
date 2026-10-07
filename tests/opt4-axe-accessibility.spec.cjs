const { test, expect } = require("@playwright/test");
const { AxeBuilder } = require("@axe-core/playwright");

// OPT-4 (Bloque 1): `tools/check-accessibility.mjs` solo comprueba cuatro patrones de marcado
// (IDs duplicados, foco principal, estado vivo, diálogos) — cero medida real de WCAG. Este spec
// corre axe-core contra las pantallas que QA-1 (tests/qa1-flujos-completos.spec.cjs) ya visita, en
// vez de escribir un recorrido nuevo. Mismo patrón que QA-1: navegador real, fuera de `npm run
// verify` pero en el CI desde el 24 de septiembre de 2026 (`npm run test:a11y-axe` en
// .github/workflows/pages.yml). Hasta entonces se ejecutaba solo a mano, y Hoy llevaba tiempo en rojo
// sin que nadie lo viera (heading-order: el aviso de primeros pasos de DEX5 usaba un h3 delante del
// h2 de la pantalla).
//
// Triage de la primera pasada (29 de agosto de 2026): axe encontró critical (aria-allowed-attr en
// pestañas de Deuda que usaban aria-selected en un <a> sin role="tab"), serious
// (scrollable-region-focusable en los .table-wrap que desbordan, sin tabindex) y moderate/minor
// (región sin landmark, <th> vacío sin etiqueta) — los cuatro corregidos y comprobados aquí en
// firme (cero violaciones admitidas de esos tipos). color-contrast (serious) reveló un problema
// mucho más amplio de lo esperado: cada corrección destapaba más elementos con el mismo defecto
// (colores por debajo de 4,5:1 repartidos por decenas de componentes — insignias, enlaces sin
// estilo, texto sobre fondos de color). Se corrigieron seis casos concretos (el chip de guardado,
// el token --e19-eyebrow huérfano de T-2, la especificidad que le robaba su color a .e19-subtitle,
// la insignia de peligro, la insignia de aviso y el encabezado de la guía de pantalla) sin tocar
// los tokens compartidos --teal/--red/--e19-warning (84/42/17 usos cada uno) para no cambiar el
// aspecto de toda la app sin revisión. El resto de color-contrast queda fuera de esta tarea:
// necesita una auditoría propia del sistema de diseño, no encaja en "barato" — motivo explícito
// para no bloquear con esto `npm run verify` todavía (BACKLOG_OPTIMIZACION.md, tareas de OPT-4).

const screens = [
  { hash: "#home", root: "#home" },
  { hash: "#presupuesto-mes", root: "#presupuestoMesRoot" },
  { hash: "#deuda-comparar", root: "#deuda-comparar" },
  { hash: "#analisis", root: "#analisis" },
  { hash: "#cierre", root: "#cierre" },
  { hash: "#conciliar", root: "#conciliar" },
];

async function seedExpenseHistory(page) {
  await page.evaluate(() => {
    const imported = ["2026-04", "2026-05", "2026-06", "2026-07"].map((month, index) => ({
      date: `${month}-05`,
      movement: `Compra de prueba ${index}`,
      amount: -(180 + index * 5),
      month,
      category: "alimentacion",
      balance: null,
    }));
    baseData.transactions = mergeTransactions(baseData.transactions || [], imported);
    refreshMovementRollups();
  });
}

test.describe("OPT-4 · axe-core contra las pantallas de QA-1", () => {
  for (const screen of screens) {
    test(`${screen.hash}: sin violaciones críticas de accesibilidad, salvo el contraste ya conocido`, async ({ page }) => {
      await page.goto("/index.html");
      await page.waitForLoadState("networkidle");
      await seedExpenseHistory(page);
      await page.evaluate((hash) => { location.hash = hash; }, screen.hash);
      await page.waitForTimeout(400);

      const results = await new AxeBuilder({ page }).analyze();
      const nonContrast = results.violations.filter((violation) => violation.id !== "color-contrast");
      expect(
        nonContrast,
        nonContrast.map((v) => `${v.id} (${v.impact}): ${v.nodes.length} nodo(s)`).join("\n"),
      ).toEqual([]);
    });
  }
});

// WP-28 / WP-16: las tablas «Ver como tabla» del kit de gráficos. En modo oscuro, una regla global de styles.css (`tbody tr:nth-child(even)
// { background: #fafbfc }`) dejaba texto claro sobre casi blanco (1,12:1) y nadie lo vio porque el contraste queda fuera de la suite de arriba.
// Aquí SÍ se mide, solo en lo que es del kit, en claro y en oscuro, con el cono de Escenarios y la banda de caja de Previsión.
for (const scheme of ["light", "dark"]) {
  test.describe(`WP-28/WP-16 · contraste de los gráficos del kit en modo ${scheme}`, () => {
    test.use({ colorScheme: scheme });
    for (const view of [
      { hash: "#new-life-simulation", host: "#e13AdvancedAnalysis", open: null },
      { hash: "#prevision", host: "#previsionBandaCard", open: "#previsionBandaResumen" },
    ]) {
      test(`${view.hash}: sin fallos de contraste dentro de .ck-figure`, async ({ page }) => {
        await page.goto(`/index.html${view.hash}`);
        await page.reload();
        if (view.open) await page.locator(view.open).click();
        await expect(page.locator(`${view.host} .ck-figure`)).toBeVisible({ timeout: 15000 });
        await page.locator(`${view.host} .ck-tabla summary`).click();
        const results = await new AxeBuilder({ page }).include(`${view.host} .ck-figure`).withRules(["color-contrast"]).analyze();
        const nodes = results.violations.flatMap((violation) => violation.nodes.map((node) => `${node.target.join(" ")}: ${node.any[0]?.data?.contrastRatio}`));
        expect(nodes, nodes.slice(0, 5).join("\n")).toEqual([]);
      });
    }
  });
}

