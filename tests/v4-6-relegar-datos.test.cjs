const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const read = (name) => fs.readFileSync(path.join(root, name), "utf8");
const html = read("index.html");
const app = read("app.js");
const experience = read("e17-experience.js");
const worker = read("service-worker.js");

// Enlaces del menú avanzado, en orden, con el grupo al que pertenecen.
const navLinks = [...html.matchAll(/<a href="#([\w-]+)" data-e17-group="(\w+)">/g)].map((match) => ({
  view: match[1],
  group: match[2],
}));

const groupOf = (view) => navLinks.find((link) => link.view === view)?.group;

test("V4-6 · «Registrar reales del mes» queda en Versiones anteriores", () => {
  assert.equal(groupOf("update-data"), "legacy");
  // «Movimientos» quedó en Versiones anteriores por V4-6 (12 de agosto), pero M-1 (14 de agosto)
  // la promueve a enlace principal bajo «Día a día» — ya no tiene data-e17-group en absoluto.
  assert.equal(groupOf("movements"), undefined);
});

// La composición completa de los grupos se vigila en `tests/navigation-structure.test.cjs`, que es
// donde vive la estructura del menú; aquí solo lo que movió V4-6.
test("V4-6 · la vista Datos conserva sus pantallas nuevas y suelta las dos relegadas", () => {
  const datos = navLinks.filter((link) => link.group === "data").map((link) => link.view);
  assert.ok(datos.includes("registrar-mes") && datos.includes("data-entry"));
  assert.ok(!datos.includes("update-data") && !datos.includes("movements"));
});

test("V4-6 · relegar no desconecta: el hub sigue llevando a las dos pantallas", () => {
  // Es la diferencia entre relegar y retirar. `#registrar-mes` sigue en 🟡 y la importación por
  // decisión (V4-4) no existe todavía, así que las rutas del hub siguen siendo las que hacen el
  // trabajo. Salen del menú; no salen de la aplicación.
  assert.match(html, /data-home-nav="update-data"/);
  assert.match(html, /data-home-nav="movements"/);
  assert.match(app, /target = "movements"/, "el siguiente paso sugerido todavía puede apuntar ahí");
  assert.match(html, /id="update-data"[^>]*view-section|view-section[^>]*id="update-data"/);
  assert.match(html, /id="movements"[^>]*view-section|view-section[^>]*id="movements"/);
});

test("V4-6 · el lanzador sigue encontrando Movimientos, esté el grupo encendido o apagado", () => {
  assert.match(experience, /target: "movements"[^}]*group: "legacy"/);
  assert.match(experience, /target: "movements"[^}]*keywords: "movimientos banco categorias buscar"/);
  const finder = experience.slice(experience.indexOf("function findTasks"));
  assert.ok(!finder.slice(0, finder.indexOf("\n  }")).includes("group"), "findTasks no filtra por grupo");
});

test("V4-6 · el grupo relegado viaja en el shell offline versionado", () => {
  assert.match(worker, /20260814-f1a1/);
  assert.match(html, /app\.js\?v=20260814f1a1/);
});
