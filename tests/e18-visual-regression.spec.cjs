const { test, expect } = require("@playwright/test");

// E18 (A13-5): capturas de referencia hechas en macOS con Chrome real (`*-darwin.png`, canal "chrome"
// en playwright.config.cjs). No corre en el CI a propósito: en Linux no hay referencia con la que
// comparar y el render de fuentes cambia de máquina a máquina, así que una comparación píxel a píxel
// fallaría sin que nada estuviera roto. Lo que sí se vigila en el CI de estas seis pantallas desde el
// 24 de septiembre de 2026: que abran y pinten sin errores (recorrido de qa1-flujos-completos.spec.cjs)
// y que nada quede cortado fuera de la pantalla (tools/check-mobile-overflow.mjs). Esta suite queda
// para comparar a mano en un Mac con `npm run test:visual`.

const criticalFlows = [
  { id: "update", hash: "#update-hub", selector: "#update-hub" },
  { id: "import", hash: "#data-entry", selector: "#data-entry" },
  { id: "forecast", hash: "#forecast", selector: "#forecast" },
  { id: "simulate", hash: "#new-life-simulation", selector: "#new-life-simulation" },
  { id: "debt", hash: "#debt-control", selector: "#debt-control", captureSelector: "#debt-control .section-title" },
  { id: "recovery", hash: "#reconciliation", selector: "#reconciliation" },
];

test.describe("E18 · capturas comparables de flujos críticos", () => {
  for (const flow of criticalFlows) {
    test(`${flow.id} conserva su vista crítica`, async ({ page }) => {
      await page.goto(`/index.html${flow.hash}`);
      const section = page.locator(flow.selector);
      await expect(section).toBeVisible();
      await expect(page.locator("html")).toHaveJSProperty("scrollWidth", await page.evaluate(() => window.innerWidth));
      await expect(page.locator(flow.captureSelector || flow.selector)).toHaveScreenshot(`${flow.id}.png`, {
        animations: "disabled",
        caret: "hide",
        maxDiffPixelRatio: 0.01,
      });
    });
  }
});
