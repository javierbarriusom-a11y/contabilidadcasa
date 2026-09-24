const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

// Corrección de la skill de sesión (.claude/skills/finanzas-casa-workflow/SKILL.md), pedida por el
// hogar el 24 de septiembre de 2026 (sesión 235). Tenía dos instrucciones desfasadas que una sesión
// nueva habría seguido al pie de la letra: mandaba al backlog de agosto (`BACKLOG_ULTIMATE_SEPTIEMBRE.md`)
// en vez del vigente, y su Modo Cierre exigía un «sí» explícito antes de publicar, cuando CLAUDE.md lo
// anuló el 10 de agosto de 2026. Estos tests atan la skill a sus dos fuentes de verdad para que no
// vuelva a desfasarse en silencio: el índice de backlogs (OPT-20) y CLAUDE.md.

const root = path.join(__dirname, "..");
const read = (name) => fs.readFileSync(path.join(root, name), "utf8");
const skill = read(".claude/skills/finanzas-casa-workflow/SKILL.md");
const indice = read("BACKLOG_INDICE.md");
const claudeMd = read("CLAUDE.md");
const inicio = skill.slice(skill.indexOf("## Modo Inicio"), skill.indexOf("## Modo Cierre"));
const cierre = skill.slice(skill.indexOf("## Modo Cierre"));

test("Skill · el Modo Inicio manda al backlog que BACKLOG_INDICE.md marca como vigente", () => {
  const vigentes = indice
    .split("\n")
    .filter((line) => line.startsWith("|") && line.includes("🟢 Vigente"))
    .map((line) => line.match(/`(BACKLOG[^`]+\.md)`/)?.[1])
    .filter(Boolean);
  assert.equal(vigentes.length, 1, `BACKLOG_INDICE.md debería marcar un único backlog como «🟢 Vigente»: ${vigentes.join(", ")}`);
  assert.ok(
    inicio.includes(vigentes[0]),
    `El índice marca ${vigentes[0]} como vigente, pero el Modo Inicio de la skill no lo nombra — actualiza su paso 2.`,
  );
  assert.ok(!inicio.includes("BACKLOG_ULTIMATE_SEPTIEMBRE.md"), "El Modo Inicio sigue mandando al backlog de agosto");
});

test("Skill · el Modo Cierre publica sin pedir permiso, como autoriza CLAUDE.md, y conserva los frenos", () => {
  assert.match(claudeMd, /## Publicar sin pedir permiso cada vez/);
  assert.match(cierre, /CLAUDE\.md/);
  assert.doesNotMatch(cierre, /Solo tras un "sí"/, "El Modo Cierre sigue exigiendo un «sí» explícito antes del push");
  assert.doesNotMatch(cierre, /sin ejecutarlo/, "El Modo Cierre sigue preparando el commit sin ejecutarlo");
  assert.match(cierre, /Con el CI en verde, márcalo como listo y fusiónalo/);
  // Los frenos de CLAUDE.md siguen explícitos en la skill.
  assert.match(cierre, /nunca se fusiona en rojo/);
  assert.match(cierre, /Nunca push directo a `main`/);
  assert.match(cierre, /finanzas-casa-def/);
  assert.match(cierre, /retire una pantalla en uso se consulta/);
});

test("Skill · la descripción de la cabecera ya no promete pedir autorización antes de publicar", () => {
  const description = skill.match(/^description: (.+)$/m)?.[1] || "";
  assert.ok(description.length > 0, "Falta la descripción de la skill");
  assert.doesNotMatch(description, /autorización explícita|sin ejecutar/);
});
