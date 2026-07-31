const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const app = fs.readFileSync(path.join(root, "app.js"), "utf8");

test("la matriz permite consultar plan, meses abiertos e histórico", () => {
  assert.match(html, /id="visualPeriodMode"/);
  assert.match(html, /value="all">Plan e histórico/);
  assert.match(html, /value="closed">Solo histórico/);
  assert.match(app, /function allVisualMonths\(\)/);
  assert.match(app, /periodMode === "closed"/);
});

test("los importes históricos permanecen visibles pero no editables", () => {
  assert.match(app, /historical = isClosedMonthKey\(month\.key\)/);
  assert.match(app, /pendingDelete \|\| historical \? "disabled"/);
  assert.match(app, /Histórico · solo lectura/);
});
