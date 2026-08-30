const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

// OPT-20 · Bloque 5: el repositorio acumuló once documentos BACKLOG*.md en cuatro generaciones de
// reordenación, cada uno apuntando solo al inmediatamente anterior — para saber cuál era la fuente
// viva había que leer varios en cadena. BACKLOG_INDICE.md es esa cadena ya recorrida una vez: un
// mapa único que dice, para cada documento, su estado y a qué apunta. Esta prueba evita que el
// índice se quede desincronizado: cualquier BACKLOG*.md nuevo que aparezca sin añadirse al índice,
// o cualquiera que pierda su puntero de vuelta, la rompe.

const root = path.resolve(__dirname, "..");
const IGNORED_DIRS = new Set(["node_modules", ".git", "dist", ".claude"]);

function findBacklogFiles(dir, found = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (!IGNORED_DIRS.has(entry.name)) findBacklogFiles(path.join(dir, entry.name), found);
      continue;
    }
    if (/^BACKLOG.*\.md$/.test(entry.name)) found.push(path.relative(root, path.join(dir, entry.name)));
  }
  return found;
}

test("BACKLOG_INDICE.md existe y menciona todos los documentos BACKLOG*.md del repositorio", () => {
  const indice = fs.readFileSync(path.join(root, "BACKLOG_INDICE.md"), "utf8");
  const files = findBacklogFiles(root).filter((file) => file !== "BACKLOG_INDICE.md");
  assert.ok(files.length >= 10, "Debe haber al menos diez documentos BACKLOG*.md además del índice.");
  files.forEach((file) => {
    const name = path.basename(file);
    assert.ok(indice.includes(name), `BACKLOG_INDICE.md no menciona ${file} — añádelo a la tabla o elimínalo si ya no aplica.`);
  });
});

test("todo documento BACKLOG*.md (salvo el propio índice) apunta de vuelta a BACKLOG_INDICE.md", () => {
  const files = findBacklogFiles(root).filter((file) => file !== "BACKLOG_INDICE.md");
  files.forEach((file) => {
    const content = fs.readFileSync(path.join(root, file), "utf8");
    assert.match(
      content,
      /BACKLOG_INDICE\.md/,
      `${file} no apunta a BACKLOG_INDICE.md — un documento nuevo debe declarar su lugar en el mapa.`,
    );
  });
});

test("BACKLOG_INDICE.md nombra BACKLOG_ULTIMATE_SEPTIEMBRE.md como la cola vigente con trabajo abierto", () => {
  const indice = fs.readFileSync(path.join(root, "BACKLOG_INDICE.md"), "utf8");
  assert.match(indice, /BACKLOG_ULTIMATE_SEPTIEMBRE\.md.*Vigente/s);
});
