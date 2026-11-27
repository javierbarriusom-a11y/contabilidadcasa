#!/usr/bin/env node
// CAT-17: guarda la huella (sha256) de app.js junto a la versión con la que index.html lo carga, en docs/gobierno/huella-app.json.
// Uso, cada vez que cambiéis app.js: 1) subid su ?v= en index.html (AAAAMMDD + sufijo); 2) `node tools/huella-app.mjs`.
// Se niega si app.js ha cambiado y la versión es una que ya se usó: es justo el olvido que la guardia quiere evitar.
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const raiz = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const ruta = path.join(raiz, "docs", "gobierno", "huella-app.json");
const html = fs.readFileSync(path.join(raiz, "index.html"), "utf8");
const m = html.match(/<script defer src="app\.js\?v=(\d{8}[a-z0-9]+)"><\/script>/);
if (!m) throw new Error("index.html no carga app.js con una versión AAAAMMDD + sufijo.");
const version = m[1];
const sha256 = createHash("sha256").update(fs.readFileSync(path.join(raiz, "app.js"))).digest("hex");
const manifiesto = JSON.parse(fs.readFileSync(ruta, "utf8"));
const misma = manifiesto.historial.find((e) => e.version === version);
if (misma && misma.sha256 === sha256) {
  console.log(`Nada que hacer: app.js ya tiene su huella con la versión ${version}.`);
  process.exit(0);
}
if (misma) {
  console.error(`app.js ha cambiado y su versión sigue siendo ${version}. Subid el ?v= de app.js en index.html y volved a ejecutar esto.`);
  process.exit(1);
}
manifiesto.historial.push({ version, sha256 });
fs.writeFileSync(ruta, `${JSON.stringify(manifiesto, null, 2)}\n`);
console.log(`Huella de app.js guardada con la versión ${version}.`);
