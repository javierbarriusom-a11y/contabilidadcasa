import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const publicFiles = ["index.html", "app.js", "data.js", "debt-roadmap.html", "supabase-config.js"];
const forbidden = [
  /\/Users\//i,
  /Contabilidad Casa/i,
  /SAVI MARKETING/i,
  /Francisco Javier Barriuso/i,
  /Natividad Miguel/i,
  /Jesus Santos Molinero/i,
  /Javier Barriuso/i,
  /JESUS SANTOS/i,
  /\b(?:\d[ -]?){13,19}\b/,
];

for (const relative of publicFiles) {
  const contents = fs.readFileSync(path.join(root, relative), "utf8");
  for (const pattern of forbidden) {
    assert.doesNotMatch(contents, pattern, `${relative} contiene el patrón sensible ${pattern}`);
  }
}

const data = fs.readFileSync(path.join(root, "data.js"), "utf8");
assert.match(data, /"publicDemo":true/);
assert.match(data, /"transactions":\[\]/);

const dist = path.join(root, "dist");
assert.ok(fs.existsSync(dist), "debe construirse dist antes de revisar el artefacto");
for (const entry of fs.readdirSync(dist, { recursive: true })) {
  const target = path.join(dist, entry);
  if (!fs.statSync(target).isFile() || /xlsx\.full\.min\.js$/.test(entry)) continue;
  const contents = fs.readFileSync(target, "utf8");
  for (const pattern of forbidden) {
    assert.doesNotMatch(contents, pattern, `dist/${entry} contiene el patrón sensible ${pattern}`);
  }
}
