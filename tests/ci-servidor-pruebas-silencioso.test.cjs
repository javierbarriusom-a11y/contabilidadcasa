const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawn } = require("node:child_process");

// El servidor de las pruebas de Playwright (tools/serve-dist.py) solo registra las peticiones que fallan. Con
// `python3 -m http.server`, cada fichero servido dejaba una línea en el log del CI (~120.000 por ejecución) y el
// error de la prueba que fallaba quedaba fuera de lo que se puede leer (sesión 326, 20/10/2026).

const root = path.resolve(__dirname, "..");

test("playwright.config.cjs arranca el servidor silencioso, no `python3 -m http.server`", () => {
  const config = fs.readFileSync(path.join(root, "playwright.config.cjs"), "utf8");
  assert.match(config, /python3 tools\/serve-dist\.py 4182 dist/);
  assert.doesNotMatch(config, /-m http\.server/);
});

test("tools/serve-dist.py sirve los ficheros, calla las peticiones correctas y registra las que fallan", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "serve-dist-"));
  fs.writeFileSync(path.join(dir, "index.html"), "<!doctype html><title>ok</title>");
  const port = 40000 + Math.floor(Math.random() * 20000);
  const server = spawn("python3", [path.join(root, "tools", "serve-dist.py"), String(port), dir], { stdio: ["ignore", "pipe", "pipe"] });
  let stdout = "";
  let stderr = "";
  server.stdout.on("data", (chunk) => { stdout += chunk; });
  server.stderr.on("data", (chunk) => { stderr += chunk; });
  try {
    const base = `http://127.0.0.1:${port}`;
    let ok = null;
    for (let attempt = 0; attempt < 50 && !ok; attempt += 1) {
      ok = await fetch(`${base}/index.html`).catch(() => null);
      if (!ok) await new Promise((resolve) => setTimeout(resolve, 100));
    }
    assert.ok(ok, `el servidor no arrancó: ${stderr}`);
    assert.equal(ok.status, 200);
    assert.match(await ok.text(), /<title>ok<\/title>/);
    const missing = await fetch(`${base}/no-existe.js`);
    assert.equal(missing.status, 404);
    await new Promise((resolve) => setTimeout(resolve, 200));
    assert.doesNotMatch(stderr, /GET \/index\.html/, "una petición correcta no deja línea");
    assert.match(stderr, /GET \/no-existe\.js HTTP\/1\.1" 404/, "una petición que falla sí");
    assert.match(stdout, /solo se registran las peticiones que fallan/);
  } finally {
    server.kill();
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
