const { test, expect } = require("@playwright/test");

// Ola 1 · P4: presupuesto de rendimiento POR PANTALLA. Lighthouse (OPT-5) solo mide index.html (Hoy),
// así que pantallas que bloqueaban la página ~1,5 s (Asesor virtual, Control de deuda, Comparar deuda)
// no tenían ninguna guarda: un cambio podía devolverlas a ese estado sin que nada fallara.
//
// Dos tipos de tope, a propósito:
//  - DETERMINISTA (llamadas a planningBreakdownForForecastMonth): no depende de la máquina. Es la guarda
//    real contra la regresión que P1 corrigió (Asesor virtual llegó a 40.176 llamadas para 248
//    combinaciones distintas). Valores medidos tras P1 (hasta el evento de vista renderizada): 124 / 124 / 1.612.
//  - TIEMPO (mediana de 3 aperturas, desde el cambio de hash hasta `finance:view-rendered`): red de
//    seguridad holgada (≥4× lo medido en un contenedor con CPU compartida) para no dar ruido en CI.
//
// Si un tope salta: no lo subas por defecto. Mira primero qué bucle vuelve a recalcular lo mismo.

const SCREENS = [
  { hash: "virtual-advisor", maxMs: 1200, maxBreakdownCalls: 1000 },
  { hash: "debt-control", maxMs: 1200, maxBreakdownCalls: 500 },
  { hash: "deuda-comparar", maxMs: 1200, maxBreakdownCalls: 3000 },
  { hash: "planificacion-partidas", maxMs: 3000, maxBreakdownCalls: null },
];

async function openScreen(page, hash) {
  await page.evaluate(() => { location.hash = "#home"; });
  await page.waitForTimeout(400);
  return page.evaluate(
    (viewId) => new Promise((resolve) => {
      let calls = 0;
      const original = window.planningBreakdownForForecastMonth;
      window.planningBreakdownForForecastMonth = function counted(...args) { calls += 1; return original.apply(this, args); };
      const started = performance.now();
      const finish = () => {
        window.planningBreakdownForForecastMonth = original;
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
    hash,
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
      for (let i = 0; i < 3; i += 1) runs.push(await openScreen(page, screen.hash));
      const median = runs.map((run) => run.ms).sort((a, b) => a - b)[1];
      const calls = Math.max(...runs.map((run) => run.calls));
      report.push({ hash: screen.hash, medianMs: median, maxCalls: calls, runs: runs.map((run) => run.ms) });
      expect(median, `${screen.hash}: mediana ${median} ms (aperturas ${runs.map((run) => run.ms).join("/")}) > tope ${screen.maxMs} ms`).toBeLessThanOrEqual(screen.maxMs);
      if (screen.maxBreakdownCalls !== null) {
        expect(calls, `${screen.hash}: ${calls} llamadas a planningBreakdownForForecastMonth > tope ${screen.maxBreakdownCalls} (¿un bucle vuelve a recalcular lo mismo?)`).toBeLessThanOrEqual(screen.maxBreakdownCalls);
      }
    }
    console.log("P4 medición por pantalla:", JSON.stringify(report));
    expect(pageErrors).toEqual([]);
  });
});
