const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

// PROC-2 (BACKLOG_CONTABILIDADCASA_3_0.md §2.6): la revisión mensual de Nielsen (OPT-21) pasa a ser
// un paso explícito del flujo de sesión (.claude/skills/finanzas-casa-workflow/SKILL.md), en vez de
// depender de que alguien se acuerde. Este test protege ese paso — no comprueba si la revisión está
// vencida (eso dependería del calendario y pondría el CI en rojo solo por pasar el tiempo), sino que
// la skill siga pidiéndola en Inicio y en Cierre y que el registro siga siendo legible por fecha.

const root = path.join(__dirname, "..");
const skill = fs.readFileSync(path.join(root, ".claude/skills/finanzas-casa-workflow/SKILL.md"), "utf8");
const checklist = fs.readFileSync(path.join(root, "docs/OPT21_CHECKLIST_NIELSEN.md"), "utf8");

test("PROC-2 · el Modo Inicio y el Modo Cierre de la skill piden la revisión mensual de Nielsen", () => {
  const inicio = skill.slice(skill.indexOf("## Modo Inicio"), skill.indexOf("## Modo Cierre"));
  const cierre = skill.slice(skill.indexOf("## Modo Cierre"));
  assert.ok(inicio.length > 0 && cierre.length > 0, "Faltan las secciones de modo en la skill");
  [inicio, cierre].forEach((section) => {
    assert.match(section, /docs\/OPT21_CHECKLIST_NIELSEN\.md/);
    assert.match(section, /30 días/);
  });
});

test("PROC-2 · el registro de revisiones tiene entradas con fecha legible, la más reciente primero", () => {
  const months = { enero: 1, febrero: 2, marzo: 3, abril: 4, mayo: 5, junio: 6, julio: 7, agosto: 8, septiembre: 9, octubre: 10, noviembre: 11, diciembre: 12 };
  const registro = checklist.slice(checklist.indexOf("## Registro de revisiones"));
  const dates = [...registro.matchAll(/^### (\d{1,2}) de (\w+) de (\d{4})/gm)].map(([, day, month, year]) => {
    assert.ok(months[month], `Mes no reconocido en el registro: ${month}`);
    return new Date(Number(year), months[month] - 1, Number(day)).getTime();
  });
  assert.ok(dates.length >= 1, "El registro de revisiones no tiene ninguna entrada con fecha");
  const sorted = [...dates].sort((a, b) => b - a);
  assert.deepEqual(dates, sorted, "Las entradas del registro deben ir de la más reciente a la más antigua");
});
