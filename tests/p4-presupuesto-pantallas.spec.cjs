const { test, expect } = require("@playwright/test");

// Ola 1 · P4: presupuesto de rendimiento POR PANTALLA. Lighthouse (OPT-5) solo mide index.html (Hoy),
// así que pantallas que bloqueaban la página ~1,5 s (Asesor virtual, Control de deuda, Comparar deuda)
// no tenían ninguna guarda: un cambio podía devolverlas a ese estado sin que nada fallara.
//
// Dos tipos de tope, a propósito:
//  - DETERMINISTA (llamadas a la función que el bucle repetía): no depende de la máquina. Es la guarda
//    real contra la regresión que P1 corrigió (Asesor virtual llegó a 40.176 llamadas para 248
//    combinaciones distintas). Valores medidos tras P1 (hasta el evento de vista renderizada): 124 / 124 / 1.612.
//  - TIEMPO (mediana de 3 aperturas, desde el cambio de hash hasta `finance:view-rendered`): red de
//    seguridad holgada (≥4× lo medido en un contenedor con CPU compartida) para no dar ruido en CI.
//
// Si un tope salta: no lo subas por defecto. Mira primero qué bucle vuelve a recalcular lo mismo.

const BREAKDOWN = "planningBreakdownForForecastMonth";
const SCREENS = [
  { hash: "virtual-advisor", maxMs: 1200, counted: BREAKDOWN, maxCalls: 1000 },
  { hash: "debt-control", maxMs: 1200, counted: BREAKDOWN, maxCalls: 500 },
  { hash: "deuda-comparar", maxMs: 1200, counted: BREAKDOWN, maxCalls: 3000 },
  // Ola 2: partidasTotalsByKind recalculaba las filas dentro del bucle por mes (337.063 llamadas a
  // actualAwareInfo); medido tras izarlo: 5.313.
  { hash: "planificacion-partidas", maxMs: 1500, counted: "actualAwareInfo", maxCalls: 20000 },
];

async function openScreen(page, hash, counted) {
  await page.evaluate(() => { location.hash = "#home"; });
  await page.waitForTimeout(400);
  return page.evaluate(
    ({ viewId, counted }) => new Promise((resolve) => {
      let calls = 0;
      const original = window[counted];
      window[counted] = function countedCall(...args) { calls += 1; return original.apply(this, args); };
      const started = performance.now();
      const finish = () => {
        window[counted] = original;
        resolve({ ms: Math.round(performance.now() - started), calls });
      };
      const onRendered = (event) => {
        if (event.detail?.viewId !== viewId) return;
        window.removeEventListener("finance:view-rendered", onRendered);
        setTimeout(finish, 50);
      };
      window.addEventListener("finance:view-rendered", onRendered);
      location.hash = `#${viewId}`;
      setTimeout(() => { window.removeEventListener("finance:view-rendered", onRendered); finish(); }, 10000);
    }),
    { viewId: hash, counted },
  );
}

test.describe("P4 · presupuesto de rendimiento por pantalla", () => {
  test("las pantallas que más bloqueaban respetan su tope de llamadas y de tiempo", async ({ page }) => {
    const pageErrors = [];
    page.on("pageerror", (error) => pageErrors.push(String(error)));
    await page.goto("/index.html");
    await page.waitForLoadState("networkidle");

    const report = [];
    for (const screen of SCREENS) {
      const runs = [];
      for (let i = 0; i < 3; i += 1) runs.push(await openScreen(page, screen.hash, screen.counted));
      const median = runs.map((run) => run.ms).sort((a, b) => a - b)[1];
      const calls = Math.max(...runs.map((run) => run.calls));
      report.push({ hash: screen.hash, medianMs: median, maxCalls: calls, runs: runs.map((run) => run.ms) });
      expect(median, `${screen.hash}: mediana ${median} ms (aperturas ${runs.map((run) => run.ms).join("/")}) > tope ${screen.maxMs} ms`).toBeLessThanOrEqual(screen.maxMs);
      expect(calls, `${screen.hash}: ${calls} llamadas a ${screen.counted} > tope ${screen.maxCalls} (¿un bucle vuelve a recalcular lo mismo?)`).toBeLessThanOrEqual(screen.maxCalls);
    }
    console.log("P4 medición por pantalla:", JSON.stringify(report));
    expect(pageErrors).toEqual([]);
  });
});

// Ola 2 · prioridad 1: el coste crecía con el nº de movimientos (mappingForMovement reconstruía y
// reordenaba la lista de partidas por CADA movimiento: 21.004 reconstrucciones en el arranque con
// 3.000 movimientos, ~1,9 s de bloqueo en cada edición). El demo público no trae movimientos, así que
// este test los siembra (mismo camino que la importación real: mergeTransactions +
// refreshMovementRollups). Tope determinista: llamadas a isPlanningRowSeriesDeleted durante un render
// (cada reconstrucción de la lista la llama una vez por partida). Medido: 89.745 llamadas y ~340 ms con la
// memoria; 452.850 y ~1.150 ms sin ella. Tope de tiempo: red de seguridad holgada.
test.describe("P4 · coste de un render con muchos movimientos", () => {
  test("con 3.000 movimientos, un render no reconstruye la lista de partidas por movimiento", async ({ page }) => {
    const pageErrors = [];
    page.on("pageerror", (error) => pageErrors.push(String(error)));
    await page.goto("/index.html");
    await page.waitForLoadState("networkidle");
    await page.evaluate(() => {
      const categories = ["alimentacion", "transporte", "ocio", "salud", "hogar", "suministros", "restauracion", "ropa"];
      const imported = Array.from({ length: 3000 }, (_, i) => {
        const monthIndex = i % 36;
        const month = `${2024 + Math.floor(monthIndex / 12)}-${String((monthIndex % 12) + 1).padStart(2, "0")}`;
        const amount = i % 9 === 0 ? 2100 : -(8 + ((i * 37) % 190));
        return { date: `${month}-${String((i % 27) + 1).padStart(2, "0")}`, movement: `COMPRA ${categories[i % 8].toUpperCase()} COMERCIO ${i % 57} REF ${i}`, amount, month, category: categories[i % 8], balance: null };
      });
      baseData.transactions = mergeTransactions(baseData.transactions || [], imported);
      refreshMovementRollups();
    });
    const runs = [];
    for (let i = 0; i < 3; i += 1) {
      runs.push(await page.evaluate(() => {
        let calls = 0;
        const original = window.isPlanningRowSeriesDeleted;
        window.isPlanningRowSeriesDeleted = function counted(...args) { calls += 1; return original.apply(this, args); };
        const started = performance.now();
        render();
        const ms = Math.round(performance.now() - started);
        window.isPlanningRowSeriesDeleted = original;
        return { ms, calls };
      }));
    }
    const median = runs.map((run) => run.ms).sort((a, b) => a - b)[1];
    const calls = Math.max(...runs.map((run) => run.calls));
    console.log("P4 render con 3.000 movimientos:", JSON.stringify({ medianMs: median, maxCalls: calls, runs: runs.map((run) => run.ms) }));
    expect(calls, `${calls} llamadas a isPlanningRowSeriesDeleted por render > tope 150000 (¿se vuelve a reconstruir la lista de partidas por movimiento?)`).toBeLessThanOrEqual(150000);
    expect(median, `render con 3.000 movimientos: mediana ${median} ms > tope 1500 ms`).toBeLessThanOrEqual(1500);
    expect(pageErrors).toEqual([]);
  });
});

// Ola 2 · P6-lite: con ~6.300 movimientos el libro canónico completo (1,96 M de caracteres con 3.000) llevaba
// localStorage a su techo (~5,2 M) y, con más, caía en silencio a memoryStorage mientras la interfaz decía
// «guardado en este equipo». Se persiste solo lo que el motor no puede reconstruir (huella e historial).
// Medido con 9.000 movimientos sembrados en este test: clave del libro ~8.100 caracteres (~36.000 con reales de
// 24 meses), localStorage ~1,49 M, 0 claves en memoria; sin la compactación el libro (~5,5 M) no cabe y cae a
// memoria (comprobado ejecutando este test contra el app.js anterior).
test.describe("P6-lite · cuota de localStorage con muchos movimientos", () => {
  test("con 9.000 movimientos el libro persistido es compacto, no cae a memoria y se regenera al recargar", async ({ page }) => {
    test.setTimeout(120000);
    const pageErrors = [];
    page.on("pageerror", (error) => pageErrors.push(String(error)));
    await page.goto("/index.html");
    await page.waitForLoadState("networkidle");
    const seeded = await page.evaluate(() => {
      const categories = ["alimentacion", "transporte", "ocio", "salud", "hogar", "suministros", "restauracion", "ropa"];
      const imported = Array.from({ length: 9000 }, (_, i) => {
        const monthIndex = i % 36;
        const month = `${2024 + Math.floor(monthIndex / 12)}-${String((monthIndex % 12) + 1).padStart(2, "0")}`;
        const amount = i % 9 === 0 ? 2100 : -(8 + ((i * 37) % 190));
        return { date: `${month}-${String((i % 27) + 1).padStart(2, "0")}`, movement: `COMPRA ${categories[i % 8].toUpperCase()} COMERCIO ${i % 57} REF ${i}`, amount, month, category: categories[i % 8], balance: null };
      });
      baseData.transactions = mergeTransactions(baseData.transactions || [], imported);
      refreshMovementRollups();
      saveWorkbookOverride();
      refreshCanonicalLedger("p6-lite-test");
      saveLocalSnapshot();
      return { memoryKeys: Object.keys(memoryStorage), entries: canonicalLedgerSnapshot.entries.length, fingerprint: canonicalLedgerSnapshot.fingerprint };
    });
    expect(seeded.entries).toBe(9000);
    expect(seeded.memoryKeys, `claves que cayeron a memoria por falta de cuota: ${seeded.memoryKeys.join(", ")}`).toEqual([]);

    await page.reload();
    await page.waitForFunction(() => canonicalLedgerSnapshot?.entries?.length === 9000, null, { timeout: 60000 });
    const after = await page.evaluate(() => {
      const ledgerKey = Object.keys(localStorage).find((key) => key.startsWith("canonicalLedgerV1"));
      return {
        ledgerChars: localStorage.getItem(ledgerKey)?.length || 0,
        totalChars: Object.entries(localStorage).reduce((sum, [key, value]) => sum + key.length + value.length, 0),
        memoryKeys: Object.keys(memoryStorage),
        fingerprint: canonicalLedgerSnapshot.fingerprint,
        auditTrail: canonicalLedgerSnapshot.auditTrail.length,
        entries: canonicalLedgerSnapshot.entries.length,
      };
    });
    console.log("P6-lite con 9.000 movimientos:", JSON.stringify(after));
    expect(after.ledgerChars, `clave del libro: ${after.ledgerChars} caracteres > tope 100000 (¿se vuelve a persistir lo derivado?)`).toBeLessThanOrEqual(100000);
    expect(after.totalChars, `localStorage: ${after.totalChars} caracteres > tope 2500000`).toBeLessThanOrEqual(2500000);
    expect(after.memoryKeys).toEqual([]);
    expect(after.fingerprint, "la huella no cambia al regenerar el libro desde lo compactado").toBe(seeded.fingerprint);
    expect(after.auditTrail, "el historial se conserva y no crece sin cambios de datos").toBeGreaterThanOrEqual(1);
    expect(after.auditTrail).toBeLessThanOrEqual(2);
    expect(pageErrors).toEqual([]);
  });
});
