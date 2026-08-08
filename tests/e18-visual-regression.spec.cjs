const { test, expect } = require("@playwright/test");

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
