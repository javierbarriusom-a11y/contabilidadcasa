const test = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const { versionApp } = require("./helpers/version-app.cjs");

// CAT-17 (decimocuarta auditoría): la versión de app.js cambia cuando cambia el fichero. Entre el 25 y el 27/11/2026 app.js cambió
// en cinco PR (TRE-D4, TRE-D5a, TRE-D5b, R1 y CIE-01) con el mismo ?v=20261125dn40, porque ~30 pruebas lo fijaban. Ahora esas pruebas
// miran el formato (tests/helpers/version-app.cjs) y esta guarda la huella:
// - docs/gobierno/huella-app.json lleva, por cada versión usada, la sha256 de app.js con la que se publicó;
// - la versión de index.html tiene que estar en el historial con la huella de app.js de hoy.
// Si falla: subid el ?v= de app.js en index.html y ejecutad `node tools/huella-app.mjs`.

const raiz = path.join(__dirname, "..");
const manifiesto = JSON.parse(fs.readFileSync(path.join(raiz, "docs", "gobierno", "huella-app.json"), "utf8"));
const version = versionApp(fs.readFileSync(path.join(raiz, "index.html"), "utf8"));
const huella = crypto.createHash("sha256").update(fs.readFileSync(path.join(raiz, "app.js"))).digest("hex");

test("el historial de huellas está bien formado: versiones únicas con su sha256", () => {
  assert.ok(Array.isArray(manifiesto.historial) && manifiesto.historial.length >= 1);
  const vistas = new Set();
  for (const e of manifiesto.historial) {
    assert.match(String(e.version), /^\d{8}[a-z0-9]+$/, JSON.stringify(e));
    assert.match(String(e.sha256), /^[0-9a-f]{64}$/, JSON.stringify(e));
    assert.ok(!vistas.has(e.version), `versión repetida en el historial: ${e.version}`);
    vistas.add(e.version);
  }
});

test("app.js no cambia sin cambiar su versión", () => {
  const entrada = manifiesto.historial.find((e) => e.version === version);
  assert.ok(entrada, `La versión ${version} de app.js no está en docs/gobierno/huella-app.json: ejecutad \`node tools/huella-app.mjs\`.`);
  assert.equal(
    entrada.sha256,
    huella,
    `app.js ha cambiado y su versión sigue siendo ${version}. Subid el ?v= de app.js en index.html y ejecutad \`node tools/huella-app.mjs\`.`,
  );
});
