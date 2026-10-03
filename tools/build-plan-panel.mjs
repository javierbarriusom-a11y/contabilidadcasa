// Genera el panel de seguimiento del plan definitivo (artefacto privado de claude.ai) a partir de
// docs/plan/panel-seguimiento.html y docs/plan/plan-definitivo.json. El estado (qué paquete está
// hecho, lecturas de métricas, tareas del hogar) no va aquí: vive en la base del artefacto.
//
// Uso: node tools/build-plan-panel.mjs <ruta-de-salida.html>
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const out = process.argv[2];
if (!out) {
  console.error("Uso: node tools/build-plan-panel.mjs <ruta-de-salida.html>");
  process.exit(1);
}
const template = readFileSync(resolve(root, "docs/plan/panel-seguimiento.html"), "utf8");
const plan = JSON.parse(readFileSync(resolve(root, "docs/plan/plan-definitivo.json"), "utf8"));
const inline = JSON.stringify(plan).replace(/</g, "\\u003c");
if (!template.includes("__PLAN_JSON__")) throw new Error("La plantilla no tiene el marcador __PLAN_JSON__.");
writeFileSync(resolve(out), template.replace("__PLAN_JSON__", () => inline));
console.log(`Panel generado en ${out} (${plan.paquetes.length} paquetes, ${plan.propuestas.length} propuestas).`);
