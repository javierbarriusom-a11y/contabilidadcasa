const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

// Seguimiento del plan definitivo (3/10/2026): docs/plan/plan-definitivo.json es la versión
// estructurada de BACKLOG_DEFINITIVO.md §5 y del mapa de olas de docs/PLAN_DESARROLLO_DEFINITIVO.md,
// y alimenta el panel de seguimiento (artefacto privado). Si alguien mueve una propuesta de nivel o
// de paquete en el backlog y no en el JSON (o al revés), el panel mentiría sobre el avance: esta
// prueba lo impide.

const root = path.resolve(__dirname, "..");
const plan = JSON.parse(fs.readFileSync(path.join(root, "docs/plan/plan-definitivo.json"), "utf8"));
const backlog = fs.readFileSync(path.join(root, "BACKLOG_DEFINITIVO.md"), "utf8");

function sectionRows(heading) {
  const start = backlog.indexOf(heading);
  assert.notEqual(start, -1, `BACKLOG_DEFINITIVO.md debe tener la sección «${heading}».`);
  const rest = backlog.slice(start + heading.length);
  const end = rest.search(/\n##+ /);
  const body = end === -1 ? rest : rest.slice(0, end);
  return body
    .split("\n")
    .filter((line) => line.startsWith("|") && !line.startsWith("|---") && !/^\| (#|ID) \|/.test(line))
    .map((line) => line.trim().replace(/^\||\|$/g, "").split("|").map((cell) => cell.trim()));
}

const clean = (cell) => cell.replace(/\*\*|`/g, "").trim();
const idOf = (cell) => clean(cell).match(/^[A-Z]+-\d+/)[0];

const LEVELS = [
  ["### 5.1", "P0"],
  ["### 5.2", "P1"],
  ["### 5.3", "P2"],
  ["### 5.4", "P3"],
  ["### 5.5", "P4"],
  ["### 5.6", "Archivo"],
];

const fromBacklog = new Map();
for (const [heading, level] of LEVELS) {
  for (const cells of sectionRows(heading)) {
    const planned = ["P0", "P1", "P2"].includes(level);
    const id = idOf(planned ? cells[1] : cells[0]);
    assert.ok(!fromBacklog.has(id), `${id} aparece dos veces en el backlog.`);
    fromBacklog.set(id, { level, wp: planned ? cells[8] : null });
  }
}

test("el backlog definitivo y el JSON del plan contienen las mismas 104 propuestas, en el mismo nivel", () => {
  assert.equal(fromBacklog.size, 104);
  assert.equal(plan.propuestas.length, 104);
  for (const p of plan.propuestas) {
    const b = fromBacklog.get(p.id);
    assert.ok(b, `${p.id} está en el JSON pero no en el backlog.`);
    assert.equal(p.nivel, b.level, `${p.id}: nivel distinto en el JSON y en el backlog.`);
    if (b.wp) assert.equal(p.wp, b.wp, `${p.id}: paquete distinto en el JSON y en el backlog.`);
  }
});

test("cada propuesta de P0-P2 está en un solo paquete y es el que dice el backlog", () => {
  const owner = new Map();
  for (const wp of plan.paquetes) {
    for (const id of wp.propuestas) {
      assert.ok(!owner.has(id), `${id} está en dos paquetes (${owner.get(id)} y ${wp.id}).`);
      owner.set(id, wp.id);
    }
  }
  const planned = [...fromBacklog].filter(([, b]) => b.wp);
  assert.equal(owner.size, planned.length, "Todas las propuestas de P0-P2, y solo ellas, van en paquetes.");
  for (const [id, b] of planned) assert.equal(owner.get(id), b.wp, `${id} debería estar en ${b.wp}.`);
});

test("los paquetes, sus dependencias y las olas son coherentes", () => {
  const ids = new Set(plan.paquetes.map((wp) => wp.id));
  assert.equal(ids.size, plan.paquetes.length, "Ningún paquete repetido.");
  for (const wp of plan.paquetes) {
    assert.ok(wp.sesiones > 0, `${wp.id} necesita una estimación de sesiones.`);
    for (const dep of wp.depende) assert.ok(ids.has(dep), `${wp.id} depende de ${dep}, que no existe.`);
  }
  for (const ola of plan.olas) {
    const sum = plan.paquetes.filter((wp) => wp.ola === ola.id).reduce((s, wp) => s + wp.sesiones, 0);
    assert.equal(ola.sesiones, sum, `Ola ${ola.id}: la suma de sesiones no cuadra.`);
    assert.ok(ola.inicio < ola.fin, `Ola ${ola.id}: fechas invertidas.`);
  }
  const metricIds = new Set(plan.metricas.map((m) => m.id));
  for (const wp of plan.paquetes) if (wp.metrica) assert.ok(metricIds.has(wp.metrica), `${wp.id}: métrica ${wp.metrica} sin definir.`);
});

test("el JSON del plan no lleva importes en euros (repositorio público)", () => {
  const raw = fs.readFileSync(path.join(root, "docs/plan/plan-definitivo.json"), "utf8");
  assert.doesNotMatch(raw, /\d[\d.,]*\s?€/, "Sin cifras en euros en el plan público.");
});
