const { test, expect } = require("@playwright/test");
const { AxeBuilder } = require("@axe-core/playwright");

// OPT-4 (Bloque 1): `tools/check-accessibility.mjs` solo comprueba cuatro patrones de marcado
// (IDs duplicados, foco principal, estado vivo, diálogos) — cero medida real de WCAG. Este spec
// corre axe-core contra las pantallas que QA-1 (tests/qa1-flujos-completos.spec.cjs) ya visita, en
// vez de escribir un recorrido nuevo. Mismo patrón que QA-1: navegador real, fuera de `npm run
// verify`/CI (decisión de infraestructura ya tomada para toda la suite Playwright de este repo,
// ver la cabecera de qa1-flujos-completos.spec.cjs) — se ejecuta a mano con `npm run test:a11y-axe`.
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
