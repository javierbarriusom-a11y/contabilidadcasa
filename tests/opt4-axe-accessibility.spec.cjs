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

// Auditoría del 7/10/2026: dos reglas globales de styles.css rompían cosas sin que ninguna prueba lo viera. Se mide el RESULTADO en el navegador
// (las causas están fijadas en tests/audit-svg-tablas-oscuro.test.cjs).
//   · Modo oscuro: ninguna fila de tabla con texto y fondo a menos de 3:1 (antes ≈ 1,1:1 en 24 vistas).
//   · Ningún SVG se sale por debajo de su contenedor (antes, las barras de «Valor por posición» medían 350 px en pistas de 14 px).
const DARK_TABLE_VIEWS = ["home", "registrar", "plan", "new-life-simulation", "deuda-ruta", "registrar-mes", "ajustes", "visual-detail", "debt-liquidation-plan", "cashflow"];

test.describe("auditoría 7/10 · tablas en modo oscuro", () => {
  test.use({ colorScheme: "dark" });
  for (const view of DARK_TABLE_VIEWS) {
    test(`#${view}: ninguna fila de tabla ilegible`, async ({ page }) => {
      await page.goto(`/index.html#${view}`);
      await page.reload();
      await page.waitForTimeout(1500);
      await page.evaluate((id) => document.querySelectorAll(`#${id} details`).forEach((d) => { d.open = true; }), view);
      const bad = await page.evaluate((id) => {
        const lum = (c) => { const m = c.match(/[\d.]+/g); if (!m) return 0; const [r, g, b] = m.slice(0, 3).map((n) => { n = Number(n) / 255; return n <= 0.03928 ? n / 12.92 : Math.pow((n + 0.055) / 1.055, 2.4); }); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
        const found = [];
        document.querySelectorAll(`#${id} tbody tr, #${id} thead tr`).forEach((tr) => {
          if (tr.getBoundingClientRect().height === 0) return;
          const cell = tr.querySelector("td, th");
          if (!cell) return;
          const bg = getComputedStyle(tr).backgroundColor;
          if ((bg.match(/[\d.]+/g) || [])[3] === "0") return;
          const bl = lum(bg);
          const fl = lum(getComputedStyle(cell).color);
          const ratio = (Math.max(bl, fl) + 0.05) / (Math.min(bl, fl) + 0.05);
          if (ratio < 3) found.push(`${(tr.closest("table")?.id || tr.closest("table")?.className || "table").toString().slice(0, 40)}: ${ratio.toFixed(2)}`);
        });
        return [...new Set(found)];
      }, view);
      expect(bad, `filas ilegibles en ${view}: ${bad.join(", ")}`).toEqual([]);
    });
  }
});

test("auditoría 7/10 · ningún SVG de Inversión › Cartera se sale de su contenedor", async ({ page }) => {
  await page.goto("/index.html#inversion-cartera");
  await page.reload();
  await expect(page.locator("#iv1ChartScroll .iv1-chart-row-track svg").first()).toBeAttached({ timeout: 15000 });
  const overflowing = await page.evaluate(() => [...document.querySelectorAll("#iv1ChartScroll svg")].map((svg) => Math.round(svg.getBoundingClientRect().bottom - svg.parentElement.getBoundingClientRect().bottom)).filter((px) => px > 4));
  expect(overflowing, "barras de «Valor por posición» que se salen de su pista").toEqual([]);
});

// WP-32: la tarjeta de recordatorios de Ajustes, medida en claro y en oscuro (casillas, lista, avisos).
for (const scheme of ["light", "dark"]) {
  test.describe(`WP-32 · contraste de la tarjeta de recordatorios en modo ${scheme}`, () => {
    test.use({ colorScheme: scheme });
    test("#ajustes: sin fallos de contraste ni de accesibilidad dentro de la tarjeta", async ({ page }) => {
      await page.goto("/index.html#ajustes");
      await page.reload();
      await expect(page.locator("#recordatoriosResumen .rec-lista")).toBeVisible({ timeout: 15000 });
      const results = await new AxeBuilder({ page }).include("#recordatoriosCard").analyze();
      const nodes = results.violations.flatMap((violation) => violation.nodes.map((node) => `${violation.id}: ${node.target.join(" ")} ${node.any[0]?.data?.contrastRatio ?? ""}`));
      expect(nodes, nodes.slice(0, 5).join("\n")).toEqual([]);
    });
  });
}

// WP-14 + WP-27: las preguntas de «¿ha llegado…?» en la bandeja de Hoy, en claro y en oscuro (con dos esperados inyectados sobre filas reales).
for (const scheme of ["light", "dark"]) {
  test.describe(`WP-14/27 · contraste de las preguntas de la bandeja en modo ${scheme}`, () => {
    test.use({ colorScheme: scheme });
    test("#home: sin fallos de contraste ni de accesibilidad dentro de la bandeja", async ({ page }) => {
      await page.goto("/index.html#home");
      await page.reload();
      await page.waitForFunction(() => typeof monthByKey === "function" && monthByKey(isoLocalDate(new Date()).slice(0, 7)));
      await page.evaluate(() => {
        const today = isoLocalDate(new Date());
        const key = today.slice(0, 7);
        const month = monthByKey(key);
        const incomeRow = planningSectionsForMonth("income", month)[0].rows[0];
        const expRow = planningSectionsForMonth("expense", month).find((section) => section.name !== VARIABLE_OPERATIONAL_SECTION).rows[0];
        const back = (days) => { const date = new Date(); date.setDate(date.getDate() - days); return isoLocalDate(date); };
        expectedMovementExpectations = () => [
          { id: "i", kind: "income", seriesKey: seriesKeyForRow(incomeRow), label: displayLabelForRow(incomeRow), month: key, expectedDate: back(5), certain: true, plannedAmount: 3000, history: [] },
          { id: "e", kind: "expense", seriesKey: seriesKeyForRow(expRow), label: displayLabelForRow(expRow), month: key, expectedDate: back(9), certain: true, plannedAmount: 80, history: [{ date: back(40), amount: 80 }] },
        ];
        expectedLedgerCoveredUntil = () => today;
        renderDecisionInboxCard();
      });
      await expect(page.locator("#homeDecisionInboxList [data-expected-response]").first()).toBeVisible({ timeout: 15000 });
      const results = await new AxeBuilder({ page }).include("#homeDecisionInboxCard").analyze();
      const nodes = results.violations.flatMap((violation) => violation.nodes.map((node) => `${violation.id}: ${node.target.join(" ")} ${node.any[0]?.data?.contrastRatio ?? ""}`));
      expect(nodes, nodes.slice(0, 6).join("\n")).toEqual([]);
    });
  });
}

// El selector de la prueba cronometrada de Hoy (Ajustes) era un fieldset blanco en oscuro: 1,14:1. Es el control que el hogar usa el 9/10 (WP-02).
for (const scheme of ["light", "dark"]) {
  test.describe(`auditoría 7/10 · selector de la prueba de Hoy en modo ${scheme}`, () => {
    test.use({ colorScheme: scheme });
    test("#ajustes › .prueba-hoy-modo: texto legible", async ({ page }) => {
      await page.goto("/index.html#ajustes");
      await page.reload();
      await expect(page.locator(".prueba-hoy-modo")).toBeAttached({ timeout: 15000 });
      await page.locator(".prueba-hoy-modo").scrollIntoViewIfNeeded();
      const results = await new AxeBuilder({ page }).include(".prueba-hoy-modo").withRules(["color-contrast"]).analyze();
      const nodes = results.violations.flatMap((violation) => violation.nodes.map((node) => `${node.target.join(" ")} ${node.any[0]?.data?.contrastRatio ?? ""}`));
      expect(nodes, nodes.join("\n")).toEqual([]);
    });
  });
}

