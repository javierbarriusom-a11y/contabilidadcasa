const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const read = (name) => fs.readFileSync(path.join(root, name), "utf8");

// ARQ-5 (BACKLOG_CONTABILIDADCASA_3_0.md §2.2): la lista SHELL_URLS de service-worker.js se
// mantenía a mano y nada la comparaba con lo que la app carga de verdad. El 24 de septiembre de 2026
// se descubrió que 30 de los 65 canonical-*.js que index.html carga al arrancar, más
// views/estado-semana.js, nunca habían entrado en ella: sin red la app abría igual, sin un solo
// error de JavaScript, pero 21 de 59 pantallas pintaban menos de lo que debían (Hoy sin salud
// financiera, Estado de la semana casi vacía, Previsión sin resumen por periodo...). A0-4 seguía
// marcada como «Verificado». Mismo patrón que la guarda de tools/build-public-site.mjs para dist,
// que nunca se extendió al Service Worker.

// Recursos locales que se quedan fuera de la caché offline a propósito, con su motivo.
const EXCLUDED = new Map([
  // A0-4: «no se almacenan credenciales ni respuestas privadas en caché compartida». Sin red no hay
  // sincronización remota posible, así que tampoco hace falta: la app sigue en modo local.
  ["supabase-config.js", "A0-4: configuración de acceso remoto, no se precachea"],
]);

function shellUrls() {
  const source = read("service-worker.js");
  const block = source.match(/const SHELL_URLS = \[([\s\S]*?)\n\];/);
  assert.ok(block, "service-worker.js debería declarar SHELL_URLS");
  return new Set([...block[1].matchAll(/"\.\/([^"]*)"/g)].map((match) => match[1]));
}

function localResourcesOfIndex() {
  // Mismo criterio que la guarda de tools/build-public-site.mjs: todo src/href local que exista.
  return [...new Set([...read("index.html").matchAll(/(?:src|href)="([^"]+)"/g)]
    .map((match) => match[1])
    .filter((url) => !/^(?:https?:|#|mailto:|data:)/.test(url))
    .map((url) => url.split("?")[0].replace(/^\.\//, ""))
    .filter((relative) => fs.existsSync(path.join(root, relative))))];
}

function viewChunkFiles() {
  const block = read("app.js").match(/const VIEW_CHUNKS = \{([\s\S]*?)\n\};/);
  assert.ok(block, "app.js debería declarar VIEW_CHUNKS");
  return [...new Set([...block[1].matchAll(/src: "([^"?]+)/g)].map((match) => match[1]))];
}

function builtFiles() {
  const block = read("tools/build-public-site.mjs").match(/const files = \[([\s\S]*?)\n\];/);
  assert.ok(block, "tools/build-public-site.mjs debería declarar su lista de ficheros");
  return new Set([...block[1].matchAll(/^\s*"([^"]+)",/gm)].map((match) => match[1]));
}

test("todo recurso local que carga index.html está en la caché offline (salvo exclusiones con motivo)", () => {
  const cached = shellUrls();
  const resources = localResourcesOfIndex();
  assert.ok(resources.length > 60, `index.html debería cargar decenas de recursos locales (encontrados ${resources.length})`);
  const missing = resources.filter((relative) => !cached.has(relative) && !EXCLUDED.has(relative));
  assert.deepEqual(missing, [], `Faltan en SHELL_URLS de service-worker.js — sin red no cargarían: ${missing.join(", ")}`);
});

test("toda pantalla de carga diferida (VIEW_CHUNKS) está en la caché offline", () => {
  const cached = shellUrls();
  const chunks = viewChunkFiles();
  assert.ok(chunks.length >= 15, `VIEW_CHUNKS debería tener sus ficheros de vista (encontrados ${chunks.length})`);
  const missing = chunks.filter((relative) => !cached.has(relative));
  assert.deepEqual(missing, [], `Pantallas sin caché offline: ${missing.join(", ")}`);
});

test("toda entrada de la caché offline existe y se publica: si una falta, la instalación entera falla", () => {
  // precacheFreshShell() usa Promise.all: un solo 404 hace fallar la instalación del Service Worker
  // y la app se queda sin ninguna caché offline, no solo sin ese fichero.
  const published = builtFiles();
  const broken = [...shellUrls()].filter((relative) => relative !== "" && (!published.has(relative) || !fs.existsSync(path.join(root, relative))));
  assert.deepEqual(broken, [], `Entradas de SHELL_URLS que no llegan al sitio publicado: ${broken.join(", ")}`);
});

test("las exclusiones siguen teniendo sentido: ni se precachean ni sobran", () => {
  const cached = shellUrls();
  const resources = new Set(localResourcesOfIndex());
  for (const [relative, reason] of EXCLUDED) {
    assert.ok(resources.has(relative), `La exclusión ${relative} ya no la carga index.html: quítala de EXCLUDED`);
    assert.ok(!cached.has(relative), `${relative} está excluido (${reason}) pero aparece en SHELL_URLS`);
  }
});
