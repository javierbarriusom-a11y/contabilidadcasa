const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

// WP-05 (NTC-06, docs/NTC06_AMENAZAS.md): ninguna conexión externa nueva sin pasar por el modelo de amenazas.
// Revisa el código propio que se publica (la lista `files` de tools/build-public-site.mjs, sin `vendor/`, que se
// sirve desde el mismo origen): cada servidor que nombra debe estar en la tabla §2 del documento, todo script
// de otro origen lleva huella SRI y no se publica ningún secreto.

const root = path.resolve(__dirname, "..");
const read = (name) => fs.readFileSync(path.join(root, name), "utf8");

const build = read("tools/build-public-site.mjs");
const published = [...build.match(/const files = \[([\s\S]*?)\];/)[1].matchAll(/"([^"]+)"/g)].map((match) => match[1]);
const firstParty = published.filter((name) => !name.startsWith("vendor/") && /\.(js|html|css|webmanifest)$/.test(name));

const doc = read("docs/NTC06_AMENAZAS.md");
const section2 = doc.slice(doc.indexOf("## 2."), doc.indexOf("## 3."));
const declared = new Map([...section2.matchAll(/^\| `([a-z0-9.-]+)` \| (conexión|enlace) \|/gm)].map((match) => [match[1], match[2]]));

function hostsIn(source) {
  return new Set([...source.matchAll(/https?:\/\/([a-zA-Z0-9-]+(?:\.[a-zA-Z0-9-]+)+)/g)].map((match) => match[1].toLowerCase()));
}

test("la lista de ficheros publicados se lee y el documento declara servidores", () => {
  assert.ok(firstParty.length > 50, `solo ${firstParty.length} ficheros propios: ¿cambió el formato de build-public-site.mjs?`);
  assert.ok(firstParty.includes("app.js") && firstParty.includes("index.html"));
  assert.ok(declared.size >= 2, "la tabla §2 de docs/NTC06_AMENAZAS.md no se pudo leer");
});

test("RQ-10: cada servidor que nombra el código publicado está en la tabla §2 de NTC06_AMENAZAS.md", () => {
  const found = new Map();
  for (const name of firstParty) {
    for (const host of hostsIn(read(name))) {
      if (host === "www.w3.org") continue; // espacios de nombres de SVG/XML, no son peticiones
      (found.get(host) || found.set(host, []).get(host)).push(name);
    }
  }
  const undeclared = [...found].filter(([host]) => !declared.has(host)).map(([host, files]) => `${host} (${files.join(", ")})`);
  assert.deepEqual(undeclared, [], "servidor nuevo sin revisar: añádelo a §2 de docs/NTC06_AMENAZAS.md cumpliendo §4");
  const stale = [...declared.keys()].filter((host) => !found.has(host));
  assert.deepEqual(stale, [], "la tabla §2 nombra servidores que el código ya no usa: quítalos");
});

test("RQ-13: el único script de otro origen (motor de tickets) lleva huella SRI y crossOrigin", () => {
  const app = read("app.js");
  assert.match(app, /const RECEIPT_OCR_CDN_URL = "https:\/\/cdn\.jsdelivr\.net\/npm\/tesseract\.js@5\.1\.1\/dist\/tesseract\.min\.js";/, "versión fijada: si cambia, recalcula la huella");
  assert.match(app, /const RECEIPT_OCR_CDN_INTEGRITY = "sha384-[A-Za-z0-9+/]{64}";/);
  assert.match(app, /script\.src = RECEIPT_OCR_CDN_URL;\n\s+script\.integrity = RECEIPT_OCR_CDN_INTEGRITY;\n\s+script\.crossOrigin = "anonymous";/);
  // Los otros cargadores dinámicos de scripts sirven ficheros del mismo origen.
  for (const name of firstParty.filter((file) => file.endsWith(".js"))) {
    const source = read(name);
    const count = (source.match(/createElement\("script"\)/g) || []).length;
    if (!count) continue;
    assert.ok(name === "app.js" ? count === 2 : name === "xlsx-loader.js" && count === 1, `${name}: carga dinámica de scripts nueva; si es de otro origen, necesita SRI (RQ-13)`);
  }
  assert.match(read("xlsx-loader.js"), /const XLSX_SRC = "vendor\//, "la librería Excel se sirve desde el mismo origen");
  assert.match(app, /"presupuesto-mes": \{ src: "views\//, "las vistas diferidas se sirven desde el mismo origen");
});

test("RQ-01: ningún secreto en el código publicado", () => {
  for (const name of firstParty) {
    const source = read(name);
    assert.doesNotMatch(source, /service_role/, `${name}: la clave service_role nunca va al navegador`);
    assert.doesNotMatch(source, /-----BEGIN [A-Z ]*PRIVATE KEY-----/, `${name}: clave privada`);
    assert.doesNotMatch(source, /sk-ant-[A-Za-z0-9]/, `${name}: clave de Anthropic`);
    assert.doesNotMatch(source, /sb_secret_[A-Za-z0-9]/, `${name}: clave secreta de Supabase`);
    assert.doesNotMatch(source, /\beval\(|new Function\(/, `${name}: ejecución de código dinámico`);
  }
  assert.match(read("supabase-config.js"), /anonKey: "sb_publishable_/, "solo la clave publicable, protegida por RLS");
});

test("documentos de WP-05: decisión con fecha y requisitos enlazados", () => {
  const spike = read("docs/ND13_SPIKE_CONEXION.md");
  assert.match(spike, /16\/10/);
  assert.match(spike, /docs\/NTC06_AMENAZAS\.md/);
  for (const req of ["RQ-01", "RQ-02", "RQ-05", "RQ-06", "RQ-09", "RQ-11", "RQ-12", "RQ-13"]) assert.match(doc, new RegExp(`\\*\\*${req}\\*\\*`));
  assert.match(doc, /## 5\. Móvil perdido o robado/);
});
