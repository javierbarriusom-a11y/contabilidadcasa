const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

// ARQ-6 (25 de septiembre de 2026), paso 3: las listas de navegación mantenidas a mano, cruzadas entre
// sí. Ya había guardianes parciales — menú ↔ buscador (T2, e17-interface), títulos ↔ informe de uso
// (ARQ-0), vistas diferidas ↔ caché offline (ARQ-5) — pero nada comprobaba lo que de verdad importa
// al hogar: que cada pantalla tenga título, que cada pantalla visible tenga al menos una puerta, y
// que ningún destino del buscador, de Laboratorio o de las vistas diferidas apunte a una pantalla
// inexistente o a una de las que el enrutador ya no muestra (ver arq6-controles-inalcanzables).
// El 25 de septiembre las listas cuadraban; esta prueba es para que sigan así.

const root = path.resolve(__dirname, "..");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const app = fs.readFileSync(path.join(root, "app.js"), "utf8");
const e17 = fs.readFileSync(path.join(root, "e17-experience.js"), "utf8");
const views = fs.readdirSync(path.join(root, "views")).filter((file) => file.endsWith(".js"))
  .map((file) => fs.readFileSync(path.join(root, "views", file), "utf8")).join("\n");

function block(start, open = "{", close = "}") {
  const at = app.indexOf(start);
  assert.ok(at >= 0, `No existe ${start} en app.js`);
  const from = app.indexOf(open, at);
  let depth = 0;
  for (let index = from; index < app.length; index += 1) {
    if (app[index] === open) depth += 1;
    else if (app[index] === close) {
      depth -= 1;
      if (depth === 0) return app.slice(from, index + 1);
    }
  }
  throw new Error(`Bloque sin cerrar: ${start}`);
}

const topLevelKeys = (source) => [...source.matchAll(/^ {2}(?:"([^"]+)"|([A-Za-z_$][\w$]*)):/gm)].map((match) => match[1] || match[2]);
const unique = (items) => [...new Set(items)].sort();

const sections = [...html.matchAll(/<section\b[^>]*>/g)]
  .map((match) => match[0])
  .filter((tag) => /class="[^"]*\bview-section\b/.test(tag))
  .map((tag) => tag.match(/\bid="([^"]+)"/)?.[1])
  .filter(Boolean);
const redirected = topLevelKeys(block("const REGISTRAR_LEGACY_HASH_TABS = "));
const reachable = sections.filter((id) => !redirected.includes(id));
const titles = topLevelKeys(block("const viewTitles = "));
const chunks = topLevelKeys(block("const VIEW_CHUNKS = "));
const catalogSource = block("const LABORATORIO_CATALOG = ", "[", "]");
const catalog = [...catalogSource.matchAll(/\bhash: "([^"]+)", label: "[^"]*", veredicto: "([^"]+)"/g)]
  .map((match) => ({ hash: match[1], veredicto: match[2] }));
const laboratorio = catalog.map((entry) => entry.hash);
const laboratorioDestinos = [...catalogSource.matchAll(/\bdestino: \{ hash: "([^"]+)"/g)].map((match) => match[1]);
const searchTargets = [...e17.matchAll(/\btarget: "([^"]+)"/g)].map((match) => match[1]);

// Todas las puertas que la app ofrece hacia una pantalla.
const everything = `${html}\n${app}\n${views}`;
const doors = new Set([
  ...[...everything.matchAll(/href="#([\w-]+)"/g)].map((match) => match[1]),
  ...[...everything.matchAll(/data-home-nav="([\w-]+)"/g)].map((match) => match[1]),
  ...[...everything.matchAll(/(?:setActiveView|escenarioMotorNavigate)\(\s*"([\w-]+)"/g)].map((match) => match[1]),
  ...laboratorio,
  ...searchTargets,
]);

test("ARQ-6 · cada pantalla tiene título y no hay títulos de pantallas que ya no existen", () => {
  assert.ok(sections.length > 40, "el recuento de pantallas parece roto");
  assert.deepEqual(sections.filter((id) => !titles.includes(id)), [], "pantallas sin entrada en viewTitles");
  assert.deepEqual(titles.filter((id) => !sections.includes(id)), [], "viewTitles con pantallas que ya no existen");
});

test("ARQ-6 · cada pantalla que el enrutador muestra tiene al menos una puerta", () => {
  assert.deepEqual(reachable.filter((id) => !doors.has(id)), [],
    "pantalla sin enlace de menú, tarjeta, llamada de navegación, Laboratorio ni buscador");
});

test("ARQ-6 · buscador, Laboratorio y vistas diferidas apuntan a pantallas que se pueden mostrar", () => {
  // Las claves antiguas de REGISTRAR_LEGACY_HASH_TABS sí valen en el buscador: aterrizan en su
  // pestaña de Registrar (NAV-2 las pondera con el contador de «registrar»).
  assert.deepEqual(unique(searchTargets.filter((id) => !reachable.includes(id) && !redirected.includes(id))), [], "resultados del buscador a ninguna parte");
  // Una heredada «sustituida» sí puede abrir una clave redirigida: su nota ya dice que lleva a la
  // pestaña de Registrar que la sustituye (hoy, `update-data` → Reales del mes).
  assert.equal(catalog.length, (catalogSource.match(/\bveredicto: "/g) || []).length, "no se pudo leer el veredicto de todas las entradas de Laboratorio");
  assert.deepEqual(unique(catalog
    .filter((entry) => !reachable.includes(entry.hash) && !(entry.veredicto === "sustituida" && redirected.includes(entry.hash)))
    .map((entry) => entry.hash)), [], "Laboratorio abre una pantalla que no se muestra");
  assert.deepEqual(unique(laboratorioDestinos.filter((id) => !reachable.includes(id))), [], "Laboratorio manda a una sustituta que no se muestra");
  assert.deepEqual(unique(chunks.filter((id) => !reachable.includes(id))), [], "vista diferida de una pantalla que no se muestra");
});

test("ARQ-6 · cada pantalla redirigida aterriza en una pestaña que Registrar tiene de verdad", () => {
  const tabs = [...block("const REGISTRAR_TABS = ", "[", "]").matchAll(/\bid: "([^"]+)"/g)].map((match) => match[1]);
  const redirects = block("const REGISTRAR_LEGACY_HASH_TABS = ");
  const targets = [...redirects.matchAll(/:\s*"([^"]+)"/g)].map((match) => match[1]);
  assert.equal(targets.length, redirected.length);
  assert.deepEqual(targets.filter((tab) => !tabs.includes(tab)), [], "redirección a una pestaña de Registrar que no existe");
  assert.ok(reachable.includes("registrar"));
});
