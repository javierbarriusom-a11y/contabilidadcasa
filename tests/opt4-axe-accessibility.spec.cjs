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


// WP-13: la tarjeta de índices de Deuda › Contratos, medida en claro y en oscuro con sus tres estados (vigente, caducado, sin dato).
for (const scheme of ["light", "dark"]) {
  test.describe(`WP-13 · contraste de la tarjeta de índices en modo ${scheme}`, () => {
    test.use({ colorScheme: scheme });
    test("#deuda-contratos: sin fallos de contraste ni de accesibilidad dentro de la tarjeta", async ({ page }) => {
      await page.goto("/index.html#deuda-contratos");
      await page.reload();
      const card = page.locator("#indicesCard");
      await expect(card.locator("[data-indices-index]")).toHaveCount(3, { timeout: 15000 });
      const daysAgo = (days) => page.evaluate((n) => isoLocalDate(new Date(Date.now() - n * 86400000)), days);
      await card.locator('[data-indices-index="euribor12m"] [data-indices-valor]').fill("2,35");
      await card.locator('[data-indices-index="euribor12m"] [data-indices-fecha]').fill(await daysAgo(2));
      await card.locator('[data-indices-index="euribor12m"] [data-indices-guardar]').click();
      await card.locator('[data-indices-index="estr"] [data-indices-valor]').fill("1,9");
      await card.locator('[data-indices-index="estr"] [data-indices-fecha]').fill(await daysAgo(20));
      await card.locator('[data-indices-index="estr"] [data-indices-guardar]').click();
      await card.locator('[data-indices-index="estr"] summary').click();
      await expect(card).toContainText("Vigente");
      await expect(card).toContainText("Caducado");
      await expect(card).toContainText("Sin dato");
      const results = await new AxeBuilder({ page }).include("#indicesCard").analyze();
      const nodes = results.violations.flatMap((violation) => violation.nodes.map((node) => `${violation.id}: ${node.target.join(" ")} ${node.any[0]?.data?.contrastRatio ?? ""}`));
      expect(nodes, nodes.slice(0, 5).join("\n")).toEqual([]);
    });
  });
}

// WP-20: la tarjeta de revisión del tipo variable, en claro y en oscuro: sin hipoteca (ejemplo desplegado) y con resultado, avisos, bonificación y Euribor caducado.
for (const scheme of ["light", "dark"]) {
  test.describe(`WP-20 · contraste de la tarjeta de revisión del tipo en modo ${scheme}`, () => {
    test.use({ colorScheme: scheme });
    test("#deuda-contratos: sin fallos de contraste ni de accesibilidad dentro de la tarjeta", async ({ page }) => {
      await page.goto("/index.html#deuda-contratos");
      await page.reload();
      const card = page.locator("#revisionTipoCard");
      await expect(card).toBeVisible({ timeout: 15000 });
      await card.locator("#revisionTipoEjemplo summary").click();
      await expect(card.locator("#revisionTipoEjemplo")).toContainText("EJEMPLO");
      const sinHipoteca = await new AxeBuilder({ page }).include("#revisionTipoCard").analyze();
      const fmt = (results) => results.violations.flatMap((violation) => violation.nodes.map((node) => `${violation.id}: ${node.target.join(" ")} ${node.any[0]?.data?.contrastRatio ?? ""}`));
      expect(fmt(sinHipoteca), fmt(sinHipoteca).slice(0, 5).join("\n")).toEqual([]);

      await page.fill("#deudaContratosAddEntity", "Banco Ejemplo");
      await page.selectOption("#deudaContratosAddType", "Hipoteca");
      await page.fill("#deudaContratosAddPrincipal", "120000");
      await page.fill("#deudaContratosAddPayment", "680");
      await page.fill("#deudaContratosAddInstallments", "240");
      await page.locator('#deudaContratosAddForm button[type="submit"]').click();
      await expect(card.locator("#revisionTipoForm")).toBeVisible({ timeout: 15000 });
      const daysFromNow = (days) => page.evaluate((n) => isoLocalDate(new Date(Date.now() + n * 86400000)), days);
      const daysAgo = (days) => page.evaluate((n) => isoLocalDate(new Date(Date.now() - n * 86400000)), days);
      // Euribor caducado (hace 50 días: vale 35) para que salga el aviso, y una revisión ya pasada que se desplaza.
      await page.fill('[data-indices-index="euribor12m"] [data-indices-valor]', "2,35");
      await page.fill('[data-indices-index="euribor12m"] [data-indices-fecha]', await daysAgo(50));
      await page.locator('[data-indices-index="euribor12m"] [data-indices-guardar]').click();
      await page.fill("#revisionTipoSpread", "0,99");
      await page.fill("#revisionTipoBonus", "0,30");
      await page.fill("#revisionTipoDate", await daysFromNow(-20));
      await card.locator("#revisionTipoGuardar").click();
      const result = card.locator("#revisionTipoResultado");
      await expect(result).toContainText("caducado");
      await expect(result).toContainText("ya pasó");
      await expect(result).toContainText("Si pierdes la bonificación");
      const conResultado = await new AxeBuilder({ page }).include("#revisionTipoCard").analyze();
      expect(fmt(conResultado), fmt(conResultado).slice(0, 5).join("\n")).toEqual([]);
      await page.fill("#revisionTipoDate", await daysFromNow(20));
      await card.locator("#revisionTipoGuardar").click();
      await expect(result).toContainText("aviso activo");
      const conAviso = await new AxeBuilder({ page }).include("#revisionTipoCard").analyze();
      expect(fmt(conAviso), fmt(conAviso).slice(0, 5).join("\n")).toEqual([]);
    });
  });
}

// WP-19: la tarjeta «Camino a deuda cero» de Deuda › Ruta, en claro y en oscuro, sin extra y con extra (hitos, frase y avisos visibles).
for (const scheme of ["light", "dark"]) {
  test.describe(`WP-19 · contraste de la tarjeta de camino a deuda cero en modo ${scheme}`, () => {
    test.use({ colorScheme: scheme });
    test("#deuda-ruta: sin fallos de contraste ni de accesibilidad dentro de la tarjeta", async ({ page }) => {
      await page.goto("/index.html#deuda-ruta");
      await page.reload();
      const card = page.locator("#caminoDeudaCard");
      await expect(card.locator(".cam-hero")).toHaveCount(3, { timeout: 15000 });
      const fmt = (results) => results.violations.flatMap((violation) => violation.nodes.map((node) => `${violation.id}: ${node.target.join(" ")} ${node.any[0]?.data?.contrastRatio ?? ""}`));
      const sinExtra = await new AxeBuilder({ page }).include("#caminoDeudaCard").analyze();
      expect(fmt(sinExtra), fmt(sinExtra).slice(0, 5).join("\n")).toEqual([]);
      await page.fill("#caminoDeudaExtra", "120");
      await expect(card).toContainText("más al mes");
      const conExtra = await new AxeBuilder({ page }).include("#caminoDeudaCard").analyze();
      expect(fmt(conExtra), fmt(conExtra).slice(0, 5).join("\n")).toEqual([]);
    });
  });
}

// WP-31: la tarjeta «Nóminas y retenciones» de Herramientas › Fiscal, en claro y en oscuro: vacía, y con nóminas, aviso de cambio y meses que faltan.
for (const scheme of ["light", "dark"]) {
  test.describe(`WP-31 · contraste de la tarjeta de nóminas en modo ${scheme}`, () => {
    test.use({ colorScheme: scheme });
    test("#herramientas-fiscal: sin fallos de contraste ni de accesibilidad dentro de la tarjeta", async ({ page }) => {
      await page.goto("/index.html#herramientas-fiscal");
      await page.reload();
      const card = page.locator("#nominasCard");
      await expect(card).toBeVisible({ timeout: 15000 });
      const fmt = (results) => results.violations.flatMap((violation) => violation.nodes.map((node) => `${violation.id}: ${node.target.join(" ")} ${node.any[0]?.data?.contrastRatio ?? ""}`));
      await card.locator(".nom-texto summary").click();
      const vacia = await new AxeBuilder({ page }).include("#nominasCard").analyze();
      expect(fmt(vacia), fmt(vacia).slice(0, 5).join("\n")).toEqual([]);
      const year = (await page.evaluate(() => new Date().getFullYear())) - 1;
      for (const [month, pct] of [[1, "15,32"], [2, "15,32"], [4, "13,1"]]) {
        await page.fill("#nominasTitular", "Persona A");
        await page.fill("#nominasMes", `${year}-${String(month).padStart(2, "0")}`);
        await page.fill("#nominasBruto", "2.100,00");
        await page.fill("#nominasLiquido", "1.644,93");
        await page.fill("#nominasPct", pct);
        await page.locator('#nominasForm button[type="submit"]').click();
      }
      await expect(card.locator(".nom-aviso")).toBeVisible();
      await expect(card.locator(".nom-faltan")).toBeVisible();
      await card.locator(".nom-lista summary").click();
      const llena = await new AxeBuilder({ page }).include("#nominasCard").analyze();
      expect(fmt(llena), fmt(llena).slice(0, 5).join("\n")).toEqual([]);
    });
  });
}

// WP-36: la tarjeta «Cosas raras en tus movimientos», en claro y en oscuro: sin extracto reciente y con avisos y sus respuestas.
for (const scheme of ["light", "dark"]) {
  test.describe(`WP-36 · contraste de la tarjeta de anomalías en modo ${scheme}`, () => {
    test.use({ colorScheme: scheme });
    test("#movements: sin fallos de contraste ni de accesibilidad dentro de la tarjeta", async ({ page }) => {
      await page.goto("/index.html#movements");
      await page.reload();
      const card = page.locator("#anomaliasCard");
      await expect(card).toBeVisible({ timeout: 15000 });
      const fmt = (results) => results.violations.flatMap((violation) => violation.nodes.map((node) => `${violation.id}: ${node.target.join(" ")} ${node.any[0]?.data?.contrastRatio ?? ""}`));
      await expect(card.locator("#anomaliasCuerpo")).toContainText("No puedo mirar lo reciente");
      const sinExtracto = await new AxeBuilder({ page }).include("#anomaliasCard").analyze();
      expect(fmt(sinExtracto), fmt(sinExtracto).slice(0, 5).join("\n")).toEqual([]);
      await page.evaluate(() => {
        const iso = (date) => isoLocalDate(date);
        const today = new Date();
        const back = (days) => iso(new Date(today.getFullYear(), today.getMonth(), today.getDate() - days));
        const rows = [];
        let balance = 3000;
        const add = (date, amount, movement) => rows.push({ date, month: date.slice(0, 7), movement, details: "", amount, balance: (balance += 1), accountId: "caixabank" });
        for (let k = 1; k <= 6; k += 1) {
          const month = new Date(today.getFullYear(), today.getMonth() - k, 1);
          add(iso(new Date(month.getFullYear(), month.getMonth(), 5)), -12.99, "SUSCRIPCION FICTICIA");
        }
        add(back(9), -62.3, "RECIBO SEGURO FICTICIO");
        add(back(6), 62.3, "DEVOLUCION RECIBO SEGURO FICTICIO");
        add(back(4), -45, "COMPRA TARJ GASOLINERA FICTICIA");
        add(back(4), -45, "COMPRA TARJ GASOLINERA FICTICIA");
        add(back(2), -4.5, "COMISION MANTENIMIENTO CUENTA");
        baseData.transactions = mergeTransactions(baseData.transactions || [], rows);
        refreshMovementRollups();
        renderAnomalias(FinanceCanonicalStatementAnomalies);
      });
      await expect(card.locator(".ano-aviso")).toHaveCount(4); // los tres de siempre y la suscripción mensual sin partida
      await card.locator('[data-anomalia-respuesta="normal"]').first().click();
      await expect(card.locator("#anomaliasNota")).toContainText("Deshacer");
      const conAvisos = await new AxeBuilder({ page }).include("#anomaliasCard").analyze();
      expect(fmt(conAvisos), fmt(conAvisos).slice(0, 5).join("\n")).toEqual([]);
    });
  });
}

// WP-37: el catálogo de estados completos (design-system.html#estados), en claro y en oscuro. Es la referencia de la que copian las pantallas.
for (const scheme of ["light", "dark"]) {
  test.describe(`WP-37 · contraste del catálogo de estados en modo ${scheme}`, () => {
    test.use({ colorScheme: scheme });
    test("design-system.html#estados: sin fallos de contraste ni de accesibilidad", async ({ page }) => {
      // design-system.html es una página de referencia que no se publica en el sitio: se abre desde el disco, con sus hojas al lado.
      await page.goto(require("node:url").pathToFileURL(require("node:path").join(__dirname, "..", "design-system.html")).href + "#estados");
      const section = page.locator("#estados");
      await expect(section).toBeVisible();
      await expect(section.locator("[data-estado]")).toHaveCount(6);
      const results = await new AxeBuilder({ page }).include("#estados").analyze();
      const nodes = results.violations.flatMap((violation) => violation.nodes.map((node) => `${violation.id}: ${node.target.join(" ")} ${node.any[0]?.data?.contrastRatio ?? ""}`));
      expect(nodes, nodes.slice(0, 5).join("\n")).toEqual([]);
    });
  });
}

// WP-38: la tarjeta «Plan B del hogar» de Plan › Previsión, en claro y en oscuro: vacía, el asistente (disparador, acciones, firma) y el plan firmado.
for (const scheme of ["light", "dark"]) {
  test.describe(`WP-38 · contraste de la tarjeta del plan B en modo ${scheme}`, () => {
    test.use({ colorScheme: scheme });
    test("Plan › Previsión: sin fallos de contraste ni de accesibilidad en ninguno de sus estados", async ({ page }) => {
      await page.goto("/index.html#plan");
      await page.reload();
      await page.evaluate(() => { try { localStorage.clear(); } catch { /* sin almacenamiento */ } });
      await page.reload();
      await page.locator('[data-plan-tab="prevision"]').click();
      const card = page.locator("#planBCard");
      await expect(card).toBeVisible({ timeout: 15000 });
      const body = card.locator("#planBCuerpo");
      const fmt = (results) => results.violations.flatMap((violation) => violation.nodes.map((node) => `${violation.id}: ${node.target.join(" ")} ${node.any[0]?.data?.contrastRatio ?? ""}`));
      const revisar = async (etiqueta) => {
        await page.mouse.move(0, 0); // sin el puntero encima: el estado «hover» de un botón no es lo que se mide aquí
        const results = await new AxeBuilder({ page }).include("#planBCard").analyze();
        expect(fmt(results), `${etiqueta}: ${fmt(results).slice(0, 5).join("\n")}`).toEqual([]);
      };
      await card.locator(".pb-palanca summary").click();
      await revisar("vacío con la palanca abierta");
      await body.locator('[data-estado-accion="planb-empezar"]').click();
      await body.locator('input[name="planbModo"][value="amount"]').check();
      await body.locator('input[data-planb-campo="amount"]').fill("12000");
      await body.locator('input[data-planb-campo="amount"]').dispatchEvent("change");
      await revisar("paso 1");
      await body.locator('[data-planb-paso="2"]').click();
      await revisar("paso 2 vacío");
      await body.locator("[data-planb-anadir]").click();
      await body.locator("[data-planb-anadir]").click();
      await body.locator('select[data-planb-accion="1"]').selectOption("credit-line");
      await body.locator('input[data-planb-accion="1"][data-planb-campo="amount"]').fill("3000");
      await body.locator('input[data-planb-accion="1"][data-planb-campo="amount"]').dispatchEvent("change");
      await revisar("paso 2 con acciones");
      await body.locator('[data-planb-paso="3"]').click();
      await revisar("paso 3");
      await body.locator('[data-planb-firma="0"]').fill("Ana");
      await body.locator('[data-planb-firma="1"]').fill("Luis");
      await body.locator("[data-planb-firmar]").click();
      await expect(body.locator("[data-planb-status]")).toBeVisible();
      await revisar("plan firmado");
    });
  });
}

// WP-39: la tarjeta «Política de inversión del hogar» de Inversión › Rebalanceo, en claro y en oscuro: vacía, el formulario de seis preguntas, la política
// firmada con la cartera fuera de ella y la consulta de una operación.
for (const scheme of ["light", "dark"]) {
  test.describe(`WP-39 · contraste de la tarjeta de política de inversión en modo ${scheme}`, () => {
    test.use({ colorScheme: scheme });
    test("Inversión › Rebalanceo: sin fallos de contraste ni de accesibilidad en ninguno de sus estados", async ({ page }) => {
      await page.goto("/index.html#inversion-rebalanceo");
      await page.reload();
      await page.evaluate(() => { try { localStorage.clear(); } catch { /* sin almacenamiento */ } });
      await page.reload();
      const card = page.locator("#politicaCard");
      await expect(card).toBeVisible({ timeout: 15000 });
      const body = card.locator("#politicaCuerpo");
      const fmt = (results) => results.violations.flatMap((violation) => violation.nodes.map((node) => `${violation.id}: ${node.target.join(" ")} ${node.any[0]?.data?.contrastRatio ?? ""}`));
      const revisar = async (etiqueta) => {
        await page.mouse.move(0, 0); // sin el puntero encima: el estado «hover» de un botón no es lo que se mide aquí
        const results = await new AxeBuilder({ page }).include("#politicaCard").analyze();
        expect(fmt(results), `${etiqueta}: ${fmt(results).slice(0, 5).join("\n")}`).toEqual([]);
      };
      await page.evaluate(() => {
        scenarioSettings.portfolioTargets = { etf: 70, fondo: 30 };
        scenarioSettings.portfolioPositions = [
          { id: "p-etf", type: "etf", label: "ETF", quantity: 10, costBasis: 5000, currentValue: 5000, asOf: "2026-10-01" },
          { id: "p-cripto", type: "cripto", label: "Cripto", quantity: 1, costBasis: 2000, currentValue: 2000, asOf: "2026-10-01" },
          { id: "p-fondo", type: "fondo", label: "Fondo", quantity: 1, costBasis: 3000, currentValue: 3000, asOf: "2026-10-01" },
        ];
        saveScenarioSettings();
        renderPoliticaInversion(FinanceCanonicalInvestmentPolicy, true);
      });
      await revisar("vacío");
      await body.locator('[data-estado-accion="politica-empezar"]').click();
      await revisar("formulario");
      await body.locator('input[data-pol-path="purpose.text"]').fill("jubilación");
      await body.locator('input[data-pol-path="purpose.horizonYears"]').fill("20");
      await body.locator('select[data-pol-path="contribution.mode"]').selectOption("surplus");
      await body.locator('input[data-pol-path="exclusions.noCrypto"]').check();
      await body.locator('[data-pol-firma="0"]').fill("Ana");
      await body.locator('[data-pol-firma="1"]').fill("Luis");
      await body.locator("[data-politica-firmar]").click();
      await expect(body.locator("[data-politica-estado]")).toBeVisible();
      await revisar("firmada con la cartera fuera de la política");
      await body.locator(".pol-consulta summary").click();
      await body.locator("#politicaOpActivo").selectOption("cripto");
      await body.locator("[data-politica-probar]").click();
      await expect(body.locator("[data-politica-veredicto]")).toBeVisible();
      await revisar("consulta con veredicto");
    });
  });
}

// Hover del botón primario, en claro y en oscuro: con el puntero encima el texto tiene que seguir cumpliendo 4,5:1. En oscuro daba 3,91:1
// (--e19-accent-hover, más claro que el reposo, con texto blanco) y el resto de pruebas lo esquivaban moviendo el puntero fuera.
for (const scheme of ["light", "dark"]) {
  test.describe(`Hover del botón primario en modo ${scheme}`, () => {
    test.use({ colorScheme: scheme });
    test("el botón principal de un estado vacío cumple el contraste con el puntero encima", async ({ page }) => {
      await page.goto("/index.html#plan");
      await page.reload();
      await page.evaluate(() => { try { localStorage.clear(); } catch { /* sin almacenamiento */ } });
      await page.reload();
      await page.locator('[data-plan-tab="prevision"]').click();
      const boton = page.locator('#planBCuerpo [data-estado-accion="planb-empezar"]');
      await expect(boton).toBeVisible({ timeout: 15000 });
      await boton.hover();
      await page.waitForTimeout(400); // la transición del fondo dura 0,15 s: se mide ya asentado
      const colores = await boton.evaluate((el) => { const s = getComputedStyle(el); return { fondo: s.backgroundColor, texto: s.color }; });
      const resultado = await new AxeBuilder({ page }).include('#planBCuerpo [data-estado-accion="planb-empezar"]').analyze();
      const fallos = resultado.violations.flatMap((violation) => violation.nodes.map((node) => `${violation.id}: ${node.target.join(" ")} ${node.any[0]?.data?.contrastRatio ?? ""}`));
      expect(fallos, `hover (${colores.fondo} con ${colores.texto}): ${fallos.join("\n")}`).toEqual([]);
    });
  });
}

// WP-40: la tarjeta «Conciliación con la CIRBE» de Deuda › Contratos, en claro y en oscuro: vacía, con la conciliación (cuadra, difiere, falta, aval, vencido,
// contratos que no salen en el informe) y con el informe viejo.
for (const scheme of ["light", "dark"]) {
  test.describe(`WP-40 · contraste de la tarjeta de la CIRBE en modo ${scheme}`, () => {
    test.use({ colorScheme: scheme });
    test("Deuda › Contratos: sin fallos de contraste ni de accesibilidad en ninguno de sus estados", async ({ page }) => {
      await page.goto("/index.html#deuda-contratos");
      await page.reload();
      await page.evaluate(() => { try { localStorage.clear(); } catch { /* sin almacenamiento */ } });
      await page.reload();
      const card = page.locator("#cirbeCard");
      await expect(card).toBeVisible({ timeout: 15000 });
      const fmt = (results) => results.violations.flatMap((violation) => violation.nodes.map((node) => `${violation.id}: ${node.target.join(" ")} ${node.any[0]?.data?.contrastRatio ?? ""}`));
      const revisar = async (etiqueta) => {
        await page.mouse.move(0, 0);
        const results = await new AxeBuilder({ page }).include("#cirbeCard").analyze();
        expect(fmt(results), `${etiqueta}: ${fmt(results).slice(0, 5).join("\n")}`).toEqual([]);
      };
      await revisar("vacío");
      await page.evaluate(() => {
        const d = new Date(); d.setDate(d.getDate() - 60);
        storageSet(storageKey("cirbe-report"), JSON.stringify({ reportDate: isoLocalDate(d), rows: [
          { id: "a", entity: "Cetelem", kind: "prestamo", amount: 6100, titularidad: "titular", reportOf: "Ana" },
          { id: "b", entity: "Entidad B", kind: "tarjeta", amount: 3000, overdue: 250, titularidad: "cotitular", reportOf: "Ana" },
          { id: "c", entity: "Wizink", kind: "tarjeta", amount: 1800 },
          { id: "d", entity: "Banco Fiador", kind: "aval", amount: 20000 },
        ] }));
        renderCirbe(FinanceCanonicalCirbe, true);
      });
      await expect(card.locator(".cir-fila")).toHaveCount(5);
      await revisar("conciliación");
      await card.locator(".cir-form summary").click();
      await card.locator(".cir-filas summary").click();
      await revisar("formulario y filas abiertos");
      await page.evaluate(() => {
        const d = new Date(); d.setDate(d.getDate() - 400);
        storageSet(storageKey("cirbe-report"), JSON.stringify({ reportDate: isoLocalDate(d), rows: [{ id: "a", entity: "Cetelem", kind: "prestamo", amount: 6000 }] }));
        renderCirbe(FinanceCanonicalCirbe, true);
      });
      await expect(card.locator(".cir-aviso")).toContainText("más de un año");
      await revisar("informe viejo");
    });
  });
}

// WP-41: la tarjeta «Deuda en la sombra y TAE real» de Deuda › Contratos, en claro y en oscuro: sin extracto reciente, con avisos (y su respuesta) y con el resultado de la calculadora.
for (const scheme of ["light", "dark"]) {
  test.describe(`WP-41 · contraste de la tarjeta de deuda en la sombra en modo ${scheme}`, () => {
    test.use({ colorScheme: scheme });
    test("Deuda › Contratos: sin fallos de contraste ni de accesibilidad en ninguno de sus estados", async ({ page }) => {
      await page.goto("/index.html#deuda-contratos");
      await page.reload();
      await page.evaluate(() => { try { localStorage.clear(); } catch { /* sin almacenamiento */ } });
      await page.reload();
      const card = page.locator("#sombraCard");
      await expect(card).toBeVisible({ timeout: 15000 });
      const fmt = (results) => results.violations.flatMap((violation) => violation.nodes.map((node) => `${violation.id}: ${node.target.join(" ")} ${node.any[0]?.data?.contrastRatio ?? ""}`));
      const revisar = async (etiqueta) => {
        await page.mouse.move(0, 0);
        const results = await new AxeBuilder({ page }).include("#sombraCard").analyze();
        expect(fmt(results), `${etiqueta}: ${fmt(results).slice(0, 5).join("\n")}`).toEqual([]);
      };
      await expect(card.locator("#sombraLista")).toContainText("No puedo mirar lo reciente");
      await revisar("sin extracto reciente");
      await page.evaluate(() => {
        const iso = (date) => isoLocalDate(date);
        const today = new Date();
        const back = (days) => iso(new Date(today.getFullYear(), today.getMonth(), today.getDate() - days));
        const rows = [];
        let balance = 3000;
        const add = (date, amount, movement) => rows.push({ date, month: date.slice(0, 7), movement, details: "", amount, balance: (balance += 1), accountId: "caixabank" });
        add(back(40), -30, "MOVISTAR CUOTA TERMINAL 2 DE 24");
        add(back(10), -30, "MOVISTAR CUOTA TERMINAL 3 DE 24");
        add(back(72), -25, "COMPRA FINANCIADA TIENDA FICTICIA");
        add(back(42), -25, "COMPRA FINANCIADA TIENDA FICTICIA");
        add(back(12), -25, "COMPRA FINANCIADA TIENDA FICTICIA");
        baseData.transactions = mergeTransactions(baseData.transactions || [], rows);
        refreshMovementRollups();
        renderDeudaSombra(FinanceCanonicalShadowDebt);
      });
      await expect(card.locator(".som-aviso")).toHaveCount(2);
      await revisar("con avisos");
      await card.locator('[data-sombra-respuesta="not-debt"]').first().click();
      await expect(card.locator("#sombraNota")).toContainText("Deshacer");
      await revisar("tras responder");
      await card.locator(".som-calc summary").click();
      await card.locator("#sombraPrecio").fill("1000");
      await card.locator("#sombraPlazos").fill("10");
      await card.locator("#sombraCuota").fill("100");
      await card.locator("#sombraComision").fill("30");
      await card.locator('#sombraForm button[type="submit"]').click();
      await expect(card.locator(".som-tae")).toBeVisible();
      await revisar("calculadora con resultado");
      await card.locator("#sombraPrecio").fill("");
      await card.locator('#sombraForm button[type="submit"]').click();
      await expect(card.locator("#sombraError")).toBeVisible();
      await revisar("calculadora con error");
    });
  });
}

// WP-42: la tarjeta «¿Dónde va el próximo euro?» de Deuda › Comparar, en claro y en oscuro: vacía, con error de validación, con la escalera completa (los cuatro peldaños), sin veredicto y parcial.
for (const scheme of ["light", "dark"]) {
  test.describe(`WP-42 · contraste de la escalera del próximo euro en modo ${scheme}`, () => {
    test.use({ colorScheme: scheme });
    test("Deuda › Comparar: sin fallos de contraste ni de accesibilidad en ninguno de sus estados", async ({ page }) => {
      await page.goto("/index.html#deuda-comparar");
      await page.reload();
      await page.evaluate(() => { try { localStorage.clear(); } catch { /* sin almacenamiento */ } });
      await page.reload();
      const card = page.locator("#proxEuroCard");
      await expect(card).toBeVisible({ timeout: 15000 });
      const fmt = (results) => results.violations.flatMap((violation) => violation.nodes.map((node) => `${violation.id}: ${node.target.join(" ")} ${node.any[0]?.data?.contrastRatio ?? ""}`));
      const revisar = async (etiqueta) => {
        await page.mouse.move(0, 0);
        const results = await new AxeBuilder({ page }).include("#proxEuroCard").analyze();
        expect(fmt(results), `${etiqueta}: ${fmt(results).slice(0, 5).join("\n")}`).toEqual([]);
      };
      const stub = (liquidity) => page.evaluate((liq) => {
        globalThis.accountBalancesFromState = () => ({ total: liq });
        globalThis.cuadroMandosReserve = () => 3000;
        globalThis.canonicalDebtContractRows = () => [{ id: "t1", entity: "Tarjeta Ficticia", type: "Tarjeta", paymentStatus: "active", currentPrincipal: 1000, apr: 21, fiscalDeductionPct: 0 }];
        state.fiscalWithholdingRate = 37;
        state.dividendSpanishSavingsRatePct = 19;
        renderProximoEuro(FinanceCanonicalNextEuro);
      }, liquidity);
      await stub(1000);
      await expect(card.locator("#proxEuroResultado")).toContainText("¿Cuánto hay que colocar?");
      await revisar("vacía");
      await card.locator('#proxEuroForm button[type="submit"]').click();
      await expect(card.locator("#proxEuroError")).toBeVisible();
      await revisar("con error de validación");
      await card.locator("#proxEuroImporte").fill("6000");
      await card.locator("#proxEuroRentabilidad").fill("7");
      await card.locator('#proxEuroForm button[type="submit"]').click();
      await expect(card.locator("[data-peu-rung]")).toHaveCount(4);
      await revisar("escalera completa");
      await card.locator("#proxEuroRentabilidad").fill("");
      await card.locator('#proxEuroForm button[type="submit"]').click();
      await expect(card.locator('[data-peu-rung="invest"]')).toContainText("Sin veredicto");
      await revisar("sin veredicto");
      await stub(null);
      await expect(card.locator(".peu-aviso")).toBeVisible();
      await revisar("parcial");
    });
  });
}

// WP-43: la tarjeta «Puente de previsión» de Plan › Previsión, en claro y en oscuro: vacía, con un solo cierre, con la cascada (relevante y pequeña) y con la tabla abierta.
for (const scheme of ["light", "dark"]) {
  test.describe(`WP-43 · contraste del puente de previsión en modo ${scheme}`, () => {
    test.use({ colorScheme: scheme });
    test("Plan › Previsión: sin fallos de contraste ni de accesibilidad en ninguno de sus estados", async ({ page }) => {
      await page.goto("/index.html#plan");
      await page.reload();
      await page.evaluate(() => { try { localStorage.clear(); } catch { /* sin almacenamiento */ } });
      await page.reload();
      await page.locator('[data-plan-tab="prevision"]').click();
      const card = page.locator("#puenteCard");
      await expect(card).toBeVisible({ timeout: 15000 });
      const fmt = (results) => results.violations.flatMap((violation) => violation.nodes.map((node) => `${violation.id}: ${node.target.join(" ")} ${node.any[0]?.data?.contrastRatio ?? ""}`));
      const revisar = async (etiqueta) => {
        await page.mouse.move(0, 0);
        const results = await new AxeBuilder({ page }).include("#puenteCard").analyze();
        expect(fmt(results), `${etiqueta}: ${fmt(results).slice(0, 5).join("\n")}`).toEqual([]);
      };
      await expect(card.locator("#puenteCuerpo")).toContainText("Todavía no hay ninguna previsión congelada");
      await revisar("vacía");
      const freezeWith = (month, tweak) => page.evaluate(({ month, tweak }) => {
        const engine = FinanceCanonicalForecastBridge;
        const series = JSON.parse(JSON.stringify(canonicalScenarioResults.base.forecast.series));
        const year = Number(series[0].monthKey.slice(0, 4));
        let shift = 0;
        if (tweak) series.forEach((row) => {
          if (row.monthKey === `${year}-12`) { row.totals.outflowsBeforeSaving += tweak; row.components.outflow.project = tweak; shift -= tweak; }
          if (row.monthKey >= `${year}-12`) row.totals.closingLiquidity += shift;
        });
        const result = engine.freezeYearEnd({ monthKey: `${year}-${month}`, closedAt: `${year}-${month}-28T10:00:00Z`, series, actuals: { income: 5000, recurring: 4250, debt: 480 } });
        puenteSave(engine.upsert(puenteLoad(), result.snapshot));
        renderPuentePrevision(engine);
      }, { month, tweak });
      await freezeWith("08", 0);
      await expect(card.locator('[data-estado="vacio"]')).toContainText("Falta un segundo cierre");
      await revisar("un solo cierre");
      await freezeWith("09", 1000);
      await expect(card.locator(".pte-frase")).toBeVisible();
      await revisar("cascada relevante");
      await card.locator(".pte-tabla summary").click();
      await revisar("tabla abierta");
      await freezeWith("10", 1000);
      await expect(card.locator(".pte-frase")).toContainText("no cambia");
      await revisar("sin cambio");
    });
  });
}

// WP-44: la tarjeta «Calma, cobertura y exposición» de Inversión › Cartera, en claro y en oscuro: sin serie, con la caída (nivel alto, sin política firmada), con cobertura y con un depósito por encima del límite.
for (const scheme of ["light", "dark"]) {
  test.describe(`WP-44 · contraste de calma, cobertura y exposición en modo ${scheme}`, () => {
    test.use({ colorScheme: scheme });
    test("Inversión › Cartera: sin fallos de contraste ni de accesibilidad en ninguno de sus estados", async ({ page }) => {
      await page.goto("/index.html#inversion-cartera");
      await page.reload();
      await page.evaluate(() => { try { localStorage.clear(); } catch { /* sin almacenamiento */ } });
      await page.reload();
      const card = page.locator("#calmaCard");
      await expect(card).toBeVisible({ timeout: 15000 });
      const fmt = (results) => results.violations.flatMap((violation) => violation.nodes.map((node) => `${violation.id}: ${node.target.join(" ")} ${node.any[0]?.data?.contrastRatio ?? ""}`));
      const revisar = async (etiqueta) => {
        await page.mouse.move(0, 0);
        const results = await new AxeBuilder({ page }).include("#calmaCard").analyze();
        expect(fmt(results), `${etiqueta}: ${fmt(results).slice(0, 5).join("\n")}`).toEqual([]);
      };
      await expect(card.locator("#calmaCaida")).toContainText("Todavía no hay serie");
      await revisar("sin serie");
      await card.locator("#calmaTasa").fill("20");
      await card.locator('#calmaForm button[type="submit"]').click();
      await expect(card.locator("#calmaError")).toBeVisible();
      await revisar("con error de validación");
      await page.evaluate(() => {
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
      });
      await card.locator("#calmaTasa").fill("4");
      await card.locator("#calmaTitulares-caixa").fill("1");
      await card.locator('#calmaForm button[type="submit"]').click();
      await expect(card.locator("#calmaCaida .cal-cifra")).toBeVisible();
      await expect(card.locator("#calmaDepositos .cal-aviso")).toBeVisible();
      await revisar("caída, cobertura y depósito por encima del límite");
      await page.evaluate(() => {
        const iso = (days) => { const d = new Date(); d.setDate(d.getDate() + days); return isoLocalDate(d); };
        savePortfolioValuations({ valuations: [
          { date: iso(-200), savedAt: new Date().toISOString(), points: [{ id: "cal-a", value: 1000, cost: 1000 }] },
          { date: iso(-150), savedAt: new Date().toISOString(), points: [{ id: "cal-a", value: 1200, cost: 1300 }] },
          { date: iso(-100), savedAt: new Date().toISOString(), points: [{ id: "cal-a", value: 700, cost: 1300 }] },
        ], timings: [] });
        renderCalmaCobertura(FinanceCanonicalCalmCoverage);
      });
      await expect(card.locator("#calmaCaida .cal-aviso").first()).toContainText("La última valoración es del");
      await revisar("valoración antigua");
    });
  });
}

// WP-45: la tarjeta «Frescura de tus datos y qué hacer primero» de Registrar › Saldos, en claro y en oscuro: con datos antiguos y cola, con tiempos medidos y con lo no estimable.
for (const scheme of ["light", "dark"]) {
  test.describe(`WP-45 · contraste de la frescura y la cola de datos en modo ${scheme}`, () => {
    test.use({ colorScheme: scheme });
    test("Registrar › Saldos: sin fallos de contraste ni de accesibilidad en ninguno de sus estados", async ({ page }) => {
      await page.goto("/index.html#registrar");
      await page.reload();
      await page.evaluate(() => { try { localStorage.clear(); } catch { /* sin almacenamiento */ } });
      await page.reload();
      const card = page.locator("#datosCard");
      await expect(card).toBeVisible({ timeout: 15000 });
      const fmt = (results) => results.violations.flatMap((violation) => violation.nodes.map((node) => `${violation.id}: ${node.target.join(" ")} ${node.any[0]?.data?.contrastRatio ?? ""}`));
      const revisar = async (etiqueta) => {
        await page.mouse.move(0, 0);
        const results = await new AxeBuilder({ page }).include("#datosCard").analyze();
        expect(fmt(results), `${etiqueta}: ${fmt(results).slice(0, 5).join("\n")}`).toEqual([]);
      };
      const stub = (opts) => page.evaluate(({ balanceAge, mode, statementAge, pending, pulse, positions }) => {
        const iso = (days) => { const d = new Date(); d.setDate(d.getDate() + days); return isoLocalDate(d); };
        state.balanceMode = mode;
        state.balanceDate = iso(-balanceAge);
        globalThis.canonicalLedgerTransactions = () => (statementAge === null ? [] : [{ date: iso(-statementAge) }]);
        globalThis.expectedMovementsResult = () => ({ status: "ok", items: Array.from({ length: pending }, (_, i) => ({ id: `p${i}`, plannedAmount: 100 })), overflow: 0 });
        globalThis.readBalancePulseTimes = () => ({ times: pulse.map((seconds) => ({ seconds })) });
        scenarioSettings.portfolioPositions = positions ? [{ id: "dat-a", type: "fondo", label: "Fondo de prueba", quantity: 0, costBasis: 1000, currentValue: 1000, asOf: iso(-50), acquisitionDate: iso(-400), provenance: "declared" }] : [];
        renderDatosCola(FinanceCanonicalDataQueue);
      }, opts);
      await stub({ balanceAge: 0, mode: "manual", statementAge: 0, pending: 0, pulse: [], positions: false });
      await expect(card.locator("[data-dat-ficha]")).toHaveCount(6);
      await revisar("todo al día");
      await stub({ balanceAge: 10, mode: "manual", statementAge: 6, pending: 3, pulse: [], positions: true });
      await expect(card.locator(".dat-plan")).toContainText("Con 3 minutos hoy");
      await revisar("datos antiguos y cola");
      await stub({ balanceAge: 10, mode: "manual", statementAge: 6, pending: 3, pulse: [12, 18, 30], positions: true });
      await expect(card.locator('[data-dat-tarea="balances"]')).toContainText("medido");
      await revisar("con tiempos medidos");
      await stub({ balanceAge: 10, mode: "auto", statementAge: null, pending: 0, pulse: [], positions: true });
      await expect(card.locator("h4", { hasText: "Sin estimar" })).toBeVisible();
      await revisar("solo lo no estimable");
    });
  });
}

// WP-46: la tarjeta «Patrimonio neto: serie y proyección» de Inversión › Cartera, en claro y en oscuro: sin cierres, con 2, con la serie, con la proyección sin supuestos y con los tres escenarios y la tabla abierta.
for (const scheme of ["light", "dark"]) {
  test.describe(`WP-46 · contraste del patrimonio neto en modo ${scheme}`, () => {
    test.use({ colorScheme: scheme });
    test("Inversión › Cartera: sin fallos de contraste ni de accesibilidad en ninguno de sus estados", async ({ page }) => {
      await page.goto("/index.html#inversion-cartera");
      await page.reload();
      await page.evaluate(() => { try { localStorage.clear(); } catch { /* sin almacenamiento */ } });
      await page.reload();
      const card = page.locator("#patrimonioCard");
      await expect(card).toBeVisible({ timeout: 15000 });
      const fmt = (results) => results.violations.flatMap((violation) => violation.nodes.map((node) => `${violation.id}: ${node.target.join(" ")} ${node.any[0]?.data?.contrastRatio ?? ""}`));
      const revisar = async (etiqueta) => {
        await page.mouse.move(0, 0);
        const results = await new AxeBuilder({ page }).include("#patrimonioCard").analyze();
        expect(fmt(results), `${etiqueta}: ${fmt(results).slice(0, 5).join("\n")}`).toEqual([]);
      };
      await page.evaluate(() => {
        scenarioSettings.assets = [{ id: "pat-casa", type: "inmueble", label: "Vivienda de prueba", value: 150000, provenance: "declared" }, { id: "pat-cuenta", type: "cuenta", label: "Cuenta vieja", value: 3000, provenance: "declared" }];
        scenarioSettings.portfolioPositions = [{ id: "pat-a", type: "fondo", label: "Fondo de prueba", quantity: 0, costBasis: 18000, currentValue: 20000, asOf: "2026-10-01", acquisitionDate: "2025-01-01", provenance: "declared" }];
        saveScenarioSettings();
        globalThis.accountBalancesFromState = () => ({ caixa: 6000, mediolanum: 4000, total: 10000 });
        globalThis.totalDebtOutstanding = () => 12000;
        renderPatrimonio(FinanceCanonicalNetWorth);
      });
      await expect(card.locator("#patrimonioSerie")).toContainText("Todavía no hay ninguna foto");
      await revisar("sin cierres");
      const snap = (month, cash) => page.evaluate(({ month, cash }) => { recordPatrimonioSnapshot(month, `${month}-28T10:00:00Z`, { total: cash }); renderPatrimonio(FinanceCanonicalNetWorth); }, { month, cash });
      await snap("2026-08", 9000);
      await snap("2026-09", 9500);
      await expect(card.locator("#patrimonioSerie")).toContainText("llevas 2");
      await revisar("con 2 cierres");
      await snap("2026-10", 10500);
      await expect(card.locator("#patrimonioSerie .ck-figure")).toHaveCount(1);
      await expect(card.locator("#patrimonioProyeccion .pat-aviso")).toBeVisible();
      await revisar("serie y proyección sin supuestos");
      const set = (id, value) => card.locator(`#${id}`).fill(String(value));
      await set("patrimonioRend-low", 1); await set("patrimonioReval-low", 0);
      await set("patrimonioRend-base", 4); await set("patrimonioReval-base", 2);
      await set("patrimonioRend-high", 7); await set("patrimonioReval-high", 4);
      await set("patrimonioObjetivo", 200000);
      await card.locator('#patrimonioForm button[type="submit"]').click();
      await expect(card.locator("#patrimonioProyeccion .ck-frase")).toContainText("estaría entre");
      await card.locator("#patrimonioProyeccion .ck-tabla summary").click();
      await revisar("tres escenarios y tabla abierta");
      await card.locator("#patrimonioRend-low").fill("80");
      await card.locator('#patrimonioForm button[type="submit"]').click();
      await expect(card.locator("#patrimonioError")).toBeVisible();
      await revisar("con error de validación");
    });
  });
}
