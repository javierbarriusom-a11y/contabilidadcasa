const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

// Rediseño · fase A2 (docs/rediseno/HANDOFF.md §2): un solo formato de cifras.
// Antes convivían «8310,00 €» (es-ES no agrupa números de 4 cifras y money(x, true) siempre
// pintaba ,00) y «12.000,00 €» en la misma pantalla. Ahora money() y money(x, true) agrupan
// siempre los miles y solo enseñan céntimos cuando los hay.

const root = path.resolve(__dirname, "..");
const app = fs.readFileSync(path.join(root, "app.js"), "utf8");

function formatter(name) {
  const m = app.match(new RegExp(`const ${name} = (new Intl\\.NumberFormat\\("es-ES", \\{[\\s\\S]*?\\}\\));`));
  assert.ok(m, `no encuentro el formateador ${name} en app.js`);
  return new Function(`return ${m[1]}`)();
}

const euro = formatter("euro");
const euroPrecise = formatter("euroPrecise");
const nbsp = (s) => s.replace(/ /g, " ");

test("money(): miles agrupados también con 4 cifras y sin céntimos", () => {
  assert.equal(nbsp(euro.format(8310)), "8.310 €");
  assert.equal(nbsp(euro.format(12000)), "12.000 €");
  assert.equal(nbsp(euro.format(1500)), "1.500 €");
  assert.equal(nbsp(euro.format(270)), "270 €");
});

test("money(x, true): céntimos solo cuando los hay", () => {
  assert.equal(nbsp(euroPrecise.format(8310)), "8.310 €");
  assert.equal(nbsp(euroPrecise.format(1218)), "1.218 €");
  assert.equal(nbsp(euroPrecise.format(3617.16)), "3.617,16 €");
  assert.equal(nbsp(euroPrecise.format(412.3)), "412,30 €");
  assert.equal(nbsp(euroPrecise.format(-3650.84)), "-3.650,84 €");
});

test("p2-ui usa el mismo formato que money(x, true)", () => {
  const p2 = fs.readFileSync(path.join(root, "p2-ui.js"), "utf8");
  assert.match(p2, /useGrouping: "always", trailingZeroDisplay: "stripIfInteger"/);
});
