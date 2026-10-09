const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const read = (name) => fs.readFileSync(path.join(root, name), "utf8");

// WP-37 (NXP-04): estados completos. El marcado de cada estado, que el catálogo vivo (design-system.html) y la hoja (estados.css) no se desincronicen de
// él, y la regla «lo reversible se deshace, no se confirma»: el único confirm() que queda es el documentado.

function load() {
  const context = {
    escapeHtml: (value) => String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]),
  };
  vm.createContext(context);
  vm.runInContext(`${read("estados-ui.js")}\nthis.api = { estadoHtml, ESTADO_KINDS };`, context);
  return context.api;
}
const { estadoHtml, ESTADO_KINDS } = load();

test("WP-37 · seis estados, cada uno con su role: los que avisan de un fallo son alert; el resto, status", () => {
  assert.deepEqual(Object.keys(ESTADO_KINDS).sort(), ["cargando", "error", "exito", "obsoleto", "sin-conexion", "vacio"]);
  for (const [kind, role] of [["vacio", "status"], ["cargando", "status"], ["error", "alert"], ["sin-conexion", "alert"], ["obsoleto", "status"], ["exito", "status"]]) {
    const html = estadoHtml({ kind, titulo: "T", texto: "x" });
    assert.match(html, new RegExp(`role="${role}"`), kind);
    assert.match(html, new RegExp(`class="est est-${kind}"`), kind);
    assert.match(html, new RegExp(`data-estado="${kind}"`), kind);
  }
});

test("WP-37 · cargando lleva esqueleto oculto a los lectores y aria-busy; ningún otro estado", () => {
  const loading = estadoHtml({ kind: "cargando" });
  assert.match(loading, /aria-busy="true"/);
  assert.match(loading, /est-esqueleto" aria-hidden="true"><span><\/span><span><\/span><span><\/span>/);
  assert.doesNotMatch(estadoHtml({ kind: "error" }), /aria-busy|est-esqueleto/);
});

test("WP-37 · un vacío accionable lleva su acción principal; sin acción no se pinta el bloque de acciones", () => {
  const withAction = estadoHtml({ kind: "vacio", titulo: "Aún no hay nada", accion: { label: "Añadir la primera", id: "primera" } });
  assert.match(withAction, /<button type="button" class="e19-btn e19-btn-primary" data-estado-accion="primera">Añadir la primera<\/button>/);
  assert.doesNotMatch(estadoHtml({ kind: "vacio", titulo: "Aún no hay nada" }), /est-acciones/);
  const link = estadoHtml({ kind: "obsoleto", accion: { label: "Importar", href: "#registrar" }, secundaria: { label: "Más tarde", id: "luego" } });
  assert.match(link, /<a class="e19-btn e19-btn-primary" href="#registrar">Importar<\/a>/);
  assert.match(link, /e19-btn-secondary" data-estado-accion="luego"/);
});

test("WP-37 · lo que llega como texto se escapa (título, texto, causa y etiquetas de las acciones)", () => {
  const html = estadoHtml({ kind: "error", titulo: "<b>x</b>", texto: '"a" & <i>b</i>', detalle: "<script>1</script>", accion: { label: "<u>Ya</u>", id: '"><x>' } });
  assert.doesNotMatch(html, /<b>|<i>|<script>|<u>|<x>/);
  assert.match(html, /&lt;b&gt;x&lt;\/b&gt;/);
});

test("WP-37 · un tipo desconocido no rompe: cae en vacío", () => {
  assert.match(estadoHtml({ kind: "inventado", titulo: "Algo" }), /est-vacio/);
  assert.match(estadoHtml(), /est-vacio/);
});

test("WP-37 · el catálogo (design-system.html) muestra los seis estados y usa la misma hoja que la app", () => {
  const catalog = read("design-system.html");
  assert.match(catalog, /<link rel="stylesheet" href="estados\.css">/);
  for (const kind of Object.keys(ESTADO_KINDS)) {
    assert.match(catalog, new RegExp(`class="est est-${kind}"[^>]*data-estado="${kind}"|data-estado="${kind}"`), `el catálogo no enseña «${kind}»`);
  }
  assert.match(catalog, /Ningún estado se distingue solo por el color/);
  assert.match(catalog, /¿Deshacer o confirmar\?/);
});

test("WP-37 · la hoja define cada estado, un borde de estilo propio (no solo color) y respeta prefers-reduced-motion", () => {
  const css = read("estados.css");
  for (const kind of Object.keys(ESTADO_KINDS)) assert.match(css, new RegExp(`\\.est-${kind}\\s*\\{`), kind);
  assert.match(css, /\.est-vacio \{ border-left-style: dashed/);
  assert.match(css, /\.est-sin-conexion \{ border-left-style: double/);
  assert.match(css, /@media \(prefers-reduced-motion: no-preference\)[\s\S]*animation/);
  assert.doesNotMatch(css.replace(/@media \(prefers-reduced-motion: no-preference\)[\s\S]*?\n\}\n\n@keyframes/, ""), /animation:/, "ninguna animación fuera de la media query");
});

test("WP-37 · las vistas que se descargan bajo demanda enseñan el esqueleto, la causa y la salida (hooks en app.js)", () => {
  const app = read("app.js");
  assert.match(app, /renderEstadoVista\?\.\(qs\(chunk\.rootId\), "cargando"\)/);
  assert.match(app, /renderEstadoVista\?\.\(qs\(chunk\.rootId\), null\)/);
  assert.match(app, /renderEstadoVista\?\.\(qs\(chunk\.rootId\), "error", \{ error, retry: \(\) => renderActiveSection\(viewId\) \}\)/);
  assert.doesNotMatch(app, /No se pudo cargar esta pantalla \(\$\{escapeHtml\(error\.message\)\}\)\. Comprueba la conexión y recarga la página/, "el mensaje sin salida ya no existe");
  const ui = read("estados-ui.js");
  assert.match(ui, /navigator\.onLine === false/, "distingue sin conexión de error");
  assert.match(ui, /:scope > \[data-estado-vista\]/, "se antepone, no sustituye el contenido de la vista");
});

test("WP-37 · lo reversible se deshace, no se confirma: el único confirm() que queda es el de consolidar con la reserva bajo el mínimo", () => {
  const files = fs.readdirSync(root).filter((name) => name.endsWith(".js") && !name.startsWith("canonical-") && !name.endsWith(".min.js"));
  const views = fs.readdirSync(path.join(root, "views")).map((name) => path.join("views", name));
  const found = [];
  for (const file of [...files, ...views]) {
    const source = read(file);
    source.split("\n").forEach((line, index) => {
      if (/^\s*\/\//.test(line)) return;
      if (/(?<![A-Za-z_.])confirm\(|window\.confirm\(/.test(line)) found.push(`${file}:${index + 1}:${line.trim().slice(0, 90)}`);
    });
  }
  assert.equal(found.length, 1, found.join("\n"));
  assert.match(found[0], /^app\.js:\d+:.*La reserva queda por debajo del mínimo/);
});

test("WP-37 · quitar un contrato, una hucha, una aportación, una nómina o un dato de índice avisa con «Deshacer»", () => {
  assert.match(read("views/deuda.js"), /showUndoToast\(`Contrato de «\$\{label\}» eliminado\.`/);
  const p2 = read("p2-ui.js");
  assert.match(p2, /showUndoToast\(`Hucha «/);
  assert.match(p2, /showUndoToast\("Aportación quitada\."/);
  assert.match(read("nominas-ui.js"), /showUndoToast\("Nómina quitada\."/);
  assert.match(read("indices-ui.js"), /showUndoToast\(`Dato del \$\{date\} quitado\.`/);
});
