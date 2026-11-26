// CAT-14 (decimocuarta auditoría, 26/11/2026): un oyente que atiende un campo que ya está en index.html antes de pintar la pantalla se
// engancha al CARGAR su script, no en el primer pintado. Si no, lo que se teclea al entrar en la pantalla (en un teléfono lento) se pierde:
// el campo lo enseña, el estado no lo recoge y el pintado lo reescribe. Pasó tres veces: el plan óptimo (DUO-D3, visto por Safari en el CI
// de #690), Préstamo para saldar y «Camino a deuda cero». Esta prueba recorre todos los `attach*(doc)` y lo comprueba.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
// Los campos que existen en index.html antes de pintar nada.
const camposEstaticos = new Set([...html.matchAll(/<(?:input|select|textarea)\b[^>]*\bid="([^"]+)"/g)].map((m) => m[1]));
const ficheros = [...fs.readdirSync(root).filter((f) => f.endsWith(".js")), ...fs.readdirSync(path.join(root, "views")).filter((f) => f.endsWith(".js")).map((f) => `views/${f}`)];

/** El cuerpo de una función de nivel superior (hasta la primera llave de cierre a principio de línea). */
function cuerpo(src, nombre) {
  const inicio = src.search(new RegExp(`^function ${nombre}\\(`, "m"));
  if (inicio < 0) return "";
  const fin = src.indexOf("\n}\n", inicio);
  return src.slice(inicio, fin < 0 ? undefined : fin);
}

const hallazgos = [];
const revisados = [];
for (const fichero of ficheros) {
  const src = fs.readFileSync(path.join(root, fichero), "utf8");
  for (const [, attach] of src.matchAll(/^function (attach[A-Z]\w*)\(doc/gm)) {
    const manejadores = [...cuerpo(src, attach).matchAll(/addEventListener\("(?:input|change)",\s*(\w+)\)/g)].map((m) => m[1]);
    const ids = new Set(manejadores.flatMap((h) => [...cuerpo(src, h).matchAll(/\.id\s*[!=]==\s*"([\w-]+)"/g)].map((m) => m[1])));
    const estaticos = [...ids].filter((id) => camposEstaticos.has(id));
    if (!estaticos.length) continue;
    revisados.push(`${fichero}:${attach}`);
    const alCargar = new RegExp(`^(?:if \\(typeof document[^\\n]*\\) )?${attach}\\(document\\);`, "m").test(src);
    if (!alCargar) hallazgos.push(`${fichero}: ${attach} atiende ${estaticos.join(", ")} (en index.html desde el principio) y no se engancha al cargar`);
  }
}

test("CAT-14 · los oyentes de campos que ya están en index.html se enganchan al cargar, no en el primer pintado", () => {
  assert.deepEqual(hallazgos, []);
});

test("CAT-14 · la prueba mira de verdad los tres casos que se vieron (si deja de encontrarlos, es la prueba la que falla)", () => {
  for (const caso of ["camino-deuda-ui.js:attachPlanOptimo", "camino-deuda-ui.js:attachCaminoDeuda", "prestamo-deuda-ui.js:attachPrestamoDeuda"]) {
    assert.ok(revisados.includes(caso), `${caso} en ${revisados.join(", ")}`);
  }
});
