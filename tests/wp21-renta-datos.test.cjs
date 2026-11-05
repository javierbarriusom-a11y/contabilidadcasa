// WP-21 · PR-0a (docs/WP21_DISENO.md §3): titular y depositario de cada posición, para el informe de la Renta.
// Cartera INVENTADA.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const portfolio = require("../canonical-portfolio.js");
const ui = require("../renta-datos-ui.js");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const pos = (extra) => ({ id: "p1", type: "fondo", label: "Fondo A", quantity: 10, costBasis: 1000, currentValue: 1100, ...extra });

test("el motor guarda titular y depositario declarados, y vacío si no lo están (nunca un titular ni «España» por defecto)", () => {
  const [a, b, c] = portfolio.normalizePositions([
    pos({ titular: "tere", depositario: "extranjero", depositarioPais: "  Irlanda " }),
    pos({ id: "p2" }),
    pos({ id: "p3", titular: "otra", depositario: "luna", depositarioPais: "Irlanda" }),
  ]).positions;
  assert.deepEqual([a.titular, a.depositario, a.depositarioPais], ["tere", "extranjero", "Irlanda"]);
  assert.deepEqual([b.titular, b.depositario, b.depositarioPais], ["", "", ""]);
  assert.deepEqual([c.titular, c.depositario, c.depositarioPais], ["", "", ""], "valores desconocidos no pasan; país solo si está fuera de España");
  assert.deepEqual([...portfolio.PORTFOLIO_HOLDERS], ["javi", "tere", "household"]);
});

test("cambiar un campo toca solo esa posición; volver a España borra el país", () => {
  const list = [pos({ depositario: "extranjero", depositarioPais: "Irlanda" }), pos({ id: "p2", label: "ETF B" })];
  const next = ui.rentaDatosAplicar(list, "p1", "depositario", "espana");
  assert.deepEqual([next[0].depositario, next[0].depositarioPais], ["espana", ""]);
  assert.equal(next[1], list[1], "la otra posición, intacta");
  assert.equal(ui.rentaDatosAplicar(list, "p1", "currentValue", 0), null, "solo los campos de la Renta");
  assert.equal(ui.rentaDatosAplicar(list, "nadie", "titular", "javi"), null);
  assert.equal(ui.rentaDatosAplicar(list, "p2", "titular", "household")[1].titular, "household");
});

test("la lista: una fila por posición con titular, depositario y país (este solo fuera de España), y lo que falta, dicho", () => {
  const html = ui.rentaDatosHtml([pos({ titular: "javi", depositario: "espana" }), pos({ id: "p2", label: "ETF <B>", depositario: "extranjero", depositarioPais: "Irlanda" })]);
  assert.equal((html.match(/class="renta-datos-fila"/g) || []).length, 2);
  assert.match(html, /<option value="javi" selected>Javi<\/option>/);
  assert.match(html, /<option value="household">Conjunta \(50 % cada uno\)<\/option>/);
  assert.match(html, /aria-label="Titular de ETF &lt;B&gt;"/, "el nombre va escapado");
  assert.match(html, /<label><span>País<\/span><input type="text" maxlength="60" data-renta-datos-campo="depositarioPais" aria-label="País donde está depositada ETF &lt;B&gt;" value="Irlanda"/);
  assert.match(html, /<label hidden><span>País<\/span>/, "en España, el país va oculto");
  assert.match(html, /1 de 2 posiciones tienen titular\./);
  assert.match(ui.rentaDatosHtml([]), /Aún no hay posiciones en la cartera\./);
  assert.equal(ui.rentaDatosResumenTexto([pos({ titular: "tere", depositario: "espana" }), pos({ titular: "javi", depositario: "espana" })]), "Las 2 posiciones tienen titular.");
});

test("vive plegado en Inversión › Cartera, se carga antes de app.js y está en el sitio público y el service worker", () => {
  const html = read("index.html");
  assert.match(html, /<details class="e19-card renta-datos" id="rentaDatos">\s*<summary>Datos para la Renta: de quién es cada posición y dónde está depositada<\/summary>/);
  assert.ok(html.indexOf('id="rentaDatos"') < html.indexOf('id="valoracionCard"'));
  const at = html.indexOf('<script defer src="renta-datos-ui.js');
  assert.ok(at > 0 && at < html.indexOf('<script defer src="app.js'));
  assert.ok(read("service-worker.js").includes('"./renta-datos-ui.js"'));
  assert.ok(read("tools/build-public-site.mjs").includes('"renta-datos-ui.js"'));
  assert.doesNotMatch(read("renta-datos-ui.js"), /localStorage/, "guarda con la lista de posiciones de siempre");
});
