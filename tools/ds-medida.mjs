#!/usr/bin/env node
// DS-1: mide la desviación de la escala del sistema de diseño, fichero a fichero (tests/helpers/ds-medida.cjs), y la compara con la
// base guardada en docs/gobierno/ds-base.json. Es un trinquete: ningún fichero puede subir; cuando baja, se guarda la base nueva.
// Uso: `node tools/ds-medida.mjs` (solo compara) · `node tools/ds-medida.mjs --escribir` (guarda la base de hoy; solo si nada sube).
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const raiz = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const { medirRepositorio, totales } = createRequire(import.meta.url)(path.join(raiz, "tests", "helpers", "ds-medida.cjs"));
const ruta = path.join(raiz, "docs", "gobierno", "ds-base.json");
const hoy = medirRepositorio(raiz);
const base = fs.existsSync(ruta) ? JSON.parse(fs.readFileSync(ruta, "utf8")).ficheros : {};

const suben = [];
const bajan = [];
for (const f of new Set([...Object.keys(base), ...Object.keys(hoy)])) {
  for (const k of new Set([...Object.keys(base[f] || {}), ...Object.keys(hoy[f] || {})])) {
    const antes = (base[f] || {})[k] || 0;
    const ahora = (hoy[f] || {})[k] || 0;
    if (ahora > antes) suben.push(`${f} · ${k}: ${antes} → ${ahora}`);
    if (ahora < antes) bajan.push(`${f} · ${k}: ${antes} → ${ahora}`);
  }
}
console.log("Total de hoy:", JSON.stringify(totales(hoy)));
if (suben.length) console.log(`Suben (${suben.length}):\n  ${suben.join("\n  ")}`);
if (bajan.length) console.log(`Bajan (${bajan.length}):\n  ${bajan.join("\n  ")}`);
if (process.argv.includes("--escribir")) {
  // La primera vez no hay base con la que comparar: se guarda la de hoy.
  if (suben.length && Object.keys(base).length) {
    console.error("No se guarda: hay ficheros que se apartan más de la escala. Usad los tokens --fs-*, --sp-* y --r-* (design-tokens.css).");
    process.exit(1);
  }
  fs.writeFileSync(ruta, `${JSON.stringify({ nota: "DS-1: trinquete de la escala de diseño. Generado por tools/ds-medida.mjs; no se edita a mano.", totales: totales(hoy), ficheros: hoy }, null, 2)}\n`);
  console.log("Base guardada en docs/gobierno/ds-base.json.");
} else if (suben.length) {
  process.exit(1);
}
