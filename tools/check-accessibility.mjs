import fs from "node:fs";
const html = fs.readFileSync(new URL("../index.html", import.meta.url), "utf8");
const ids = [...html.matchAll(/\sid="([^"]+)"/g)].map((match) => match[1]);
const duplicates = ids.filter((id, index) => ids.indexOf(id) !== index);
if (duplicates.length) throw new Error(`IDs duplicados: ${[...new Set(duplicates)].join(", ")}`);
for (const pattern of [/<main[^>]*id="mainContent"[^>]*tabindex="-1"/, /id="appLiveStatus"[^>]*role="status"/, /id="operationConfirmDialog"/, /id="e8QualityCenter"/]) {
  if (!pattern.test(html)) throw new Error(`Falta garantía accesible: ${pattern}`);
}
const emptyButtons = [...html.matchAll(/<button\b([^>]*)>\s*<\/button>/g)].filter((match) => !/aria-label=/.test(match[1]));
if (emptyButtons.length) throw new Error(`${emptyButtons.length} botón(es) sin nombre accesible`);
console.log(`Accesibilidad estructural verificada: ${ids.length} IDs únicos, foco principal, estado vivo y diálogos.`);
