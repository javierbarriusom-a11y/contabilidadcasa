const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const pkg = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));

// ARQ-2 (BACKLOG_CONTABILIDADCASA_3_0.md §2.2): ESLint mínimo como gate de CI — solo tres reglas
// deliberadas (variables no usadas, igualdad estricta, complejidad ciclomática), enganchado a
// `npm run verify` para que ninguna sesión futura pueda saltárselo sin querer.

test("ARQ-2: eslint.config.js existe y solo declara las tres reglas deliberadas", () => {
  const configPath = path.join(root, "eslint.config.js");
  assert.ok(fs.existsSync(configPath), "falta eslint.config.js en la raíz del repositorio");
  const source = fs.readFileSync(configPath, "utf8");
  assert.match(source, /"no-unused-vars":/);
  assert.match(source, /eqeqeq:/);
  assert.match(source, /complexity:/);
});

test("ARQ-2: el script npm \"lint\" existe y corre eslint sobre todo el repositorio", () => {
  assert.equal(pkg.scripts.lint, "eslint .");
});

test("ARQ-2: \"npm run verify\" incluye el lint como gate, no solo como script suelto", () => {
  assert.match(pkg.scripts.verify, /npm run lint/);
});

test("ARQ-2: eslint.config.js ignora node_modules/dist/vendor — nunca lintea terceros ni build output", () => {
  const source = fs.readFileSync(path.join(root, "eslint.config.js"), "utf8");
  ["node_modules/**", "dist/**", "vendor/**"].forEach((entry) => {
    assert.ok(source.includes(`"${entry}"`), `falta ignorar ${entry}`);
  });
});
