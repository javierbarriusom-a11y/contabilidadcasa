const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

// CAT-01 (decimocuarta auditoría, docs/PROPUESTA_DECIMOCUARTA_AUDITORIA_2026-11-26.md §3): el inventario de lo que el hogar puede
// HACER, en docs/gobierno/capacidades.json. Esta prueba es la guardia contra duplicados y olvidos:
// - cada línea de Novedades está en una capacidad o en «noSonCapacidad», con su porqué, y solo en uno de los dos sitios;
// - no hay capacidades que apunten a novedades que no existen;
// - cada capacidad dice qué se hace (verbo), con qué palabras la buscaría el hogar (sinónimos), dónde y de qué sigla viene.
// Si falla por una línea nueva de Novedades: añadid su id a la capacidad que amplía, cread una nueva o, si es un arreglo o una
// mudanza, ponedla en «noSonCapacidad» con el motivo.

const raiz = path.join(__dirname, "..");
const inventario = JSON.parse(fs.readFileSync(path.join(raiz, "docs", "gobierno", "capacidades.json"), "utf8"));
const novedades = require(path.join(raiz, "novedades.js"));
const idsNovedades = new Set(novedades.map((n) => n.id));

test("el inventario está bien formado: una entrada por capacidad, con verbo, sinónimos, dónde y origen", () => {
  assert.match(String(inventario._regla || ""), /noSonCapacidad/);
  assert.ok(Array.isArray(inventario.capacidades) && inventario.capacidades.length >= 90, "el inventario de partida tiene 97");
  const ids = new Set();
  const verbos = new Set();
  for (const c of inventario.capacidades) {
    const que = JSON.stringify(c.id);
    assert.match(String(c.id), /^[a-z0-9]+(-[a-z0-9]+)*$/, `id en minúsculas con guiones: ${que}`);
    assert.ok(!ids.has(c.id), `id repetido: ${que}`);
    ids.add(c.id);
    assert.ok(String(c.verbo || "").trim().length >= 10, `verbo: ${que}`);
    assert.match(c.verbo, /^[A-ZÁÉÍÓÚÑ¿]/, `el verbo empieza en mayúscula: ${que}`);
    const verbo = c.verbo.toLocaleLowerCase("es");
    assert.ok(!verbos.has(verbo), `dos capacidades con el mismo verbo: ${que}`);
    verbos.add(verbo);
    assert.ok(Array.isArray(c.sinonimos) && c.sinonimos.length >= 1, `al menos un sinónimo: ${que}`);
    c.sinonimos.forEach((s) => assert.ok(typeof s === "string" && s.trim().length >= 2, `sinónimo vacío en ${que}`));
    assert.match(String(c.donde || ""), /^(#[a-z0-9-]+|Menú|Cabecera|simuladores)/, `dónde se hace: ${que}`);
    assert.ok(Array.isArray(c.origen) && c.origen.length >= 1, `de qué sigla o petición viene: ${que}`);
    assert.ok(Array.isArray(c.novedades) && c.novedades.length >= 1, `al menos una línea de Novedades: ${que}`);
  }
  for (const n of inventario.noSonCapacidad) {
    assert.ok(String(n.porque || "").trim().length >= 10, `por qué no es una capacidad: ${JSON.stringify(n)}`);
  }
});

test("cada línea de Novedades está en el inventario una sola vez (capacidad o «noSonCapacidad»)", () => {
  const vistas = new Map();
  const anotar = (id, donde) => {
    assert.ok(!vistas.has(id), `«${id}» está dos veces: en ${vistas.get(id)} y en ${donde}`);
    vistas.set(id, donde);
  };
  inventario.capacidades.forEach((c) => c.novedades.forEach((id) => anotar(id, c.id)));
  inventario.noSonCapacidad.forEach((n) => anotar(n.novedad, "noSonCapacidad"));
  const sinSitio = [...idsNovedades].filter((id) => !vistas.has(id));
  assert.deepEqual(
    sinSitio,
    [],
    "Líneas de Novedades sin capacidad. Añadidlas a docs/gobierno/capacidades.json (CAT-01): a una capacidad o a «noSonCapacidad» con su porqué.",
  );
  const huerfanas = [...vistas.keys()].filter((id) => !idsNovedades.has(id));
  assert.deepEqual(huerfanas, [], "El inventario apunta a líneas de Novedades que ya no existen.");
});

test("lo que la decimocuarta auditoría no encontraba (§2.1) se encuentra por sus palabras", () => {
  const buscar = (palabra) => {
    const p = palabra.toLocaleLowerCase("es");
    return inventario.capacidades.filter((c) =>
      [c.verbo, ...c.sinonimos].some((t) => t.toLocaleLowerCase("es").includes(p)),
    ).map((c) => c.id);
  };
  assert.ok(buscar("dividir").includes("dividir-movimiento"));
  assert.ok(buscar("calendario").includes("recordatorios-calendario"));
  assert.ok(buscar("ocultar").includes("ocultar-cifras"));
  assert.ok(buscar("me lo puedo permitir").includes("me-lo-puedo-permitir"));
  assert.ok(buscar("copia").includes("copia-seguridad"));
});
