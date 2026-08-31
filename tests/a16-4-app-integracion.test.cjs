const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");

const analisisSource = fs.readFileSync(require.resolve("../views/analisis.js"), "utf8");
const indexSource = fs.readFileSync(require.resolve("../index.html"), "utf8");
const forecastSource = fs.readFileSync(require.resolve("../canonical-forecast.js"), "utf8");

test("A16-4: detectRecurringSubscriptions expone monthsSeen para poder estimar la cadencia", () => {
  const start = forecastSource.indexOf("function detectRecurringSubscriptions");
  const block = forecastSource.slice(start, start + 1400);
  assert.match(block, /monthsSeen: \[\.\.\.group\.months\]\.sort\(\)/);
});

test("A16-4: analisisSubscriptionsHtml llama al aviso de renovación por cada suscripción detectada", () => {
  const start = analisisSource.indexOf("function analisisSubscriptionsHtml");
  const block = analisisSource.slice(start, start + 1200);
  assert.match(block, /analisisRenewalAdvisory\(item\)/);
});

test("A16-4: analisisRenewalAdvisory llama al motor canónico con el mes abierto como referencia", () => {
  const start = analisisSource.indexOf("function analisisRenewalAdvisory");
  const block = analisisSource.slice(start, start + 400);
  assert.match(block, /FinanceCanonicalRenewalAdvisor\?\.renewalAdvisory/);
  assert.match(block, /openMonthCutoffKey\(\)/);
});

test("A16-4: el módulo canónico está registrado en index.html y en la whitelist del sitio público", () => {
  assert.match(indexSource, /canonical-renewal-advisor\.js\?v=/);
  const buildScript = fs.readFileSync(require.resolve("../tools/build-public-site.mjs"), "utf8");
  assert.match(buildScript, /"canonical-renewal-advisor\.js"/);
});
