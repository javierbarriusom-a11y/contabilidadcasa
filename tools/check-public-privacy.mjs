import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const publicFiles = ["index.html", "app.js", "data.js", "debt-roadmap.html", "supabase-config.js"];
// Lo que nunca puede salir publicado: nombres del hogar y de terceros, y un número de tarjeta o de cuenta.
// Las frases NO se escriben aquí (este fichero también es público: la lista en claro las publicaba). Se guarda la huella
// SHA-256 de cada una, normalizada: minúsculas, sin acentos y una sola separación entre palabras. Para añadir una frase,
// su huella: node -e 'const c=require("node:crypto");const t=process.argv[1].normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().split(/[^a-z0-9]+/).filter(Boolean).join(" ");console.log(c.createHash("sha256").update(t).digest("hex"))' "La Frase"
// y su primera palabra, igual, en FIRST_WORD_HASHES (solo sirve para no calcular huellas de cada trío de palabras del sitio).
// Una huella sin sal no protege frente a quien ya sospecha el nombre y lo prueba; sí frente a leerlo o encontrarlo buscando.
const FORBIDDEN_PHRASE_HASHES = new Set(["af4ac016f090aa486c919923499288c14dff428785b0a9f8ccc1f1e499eb0991", "b108f083ebd184f7e0e7bef79a76114053d2584f96e7960094c8aefecce5252b", "f8b2b8477a3e2450596d5322790168ec3ad4626c0b01228d12641f11b7d26c5d", "adfd5f0deb3a30363ba39f5eab6a2937258ece57d098c3dfd273b377372b5a0c", "c0e7912d8657e0bfba66f7dc018c5fc18371240481704f80adf457fab0172257", "e67d2e9ef8bbbcc5466a23ca4be693f482e680e755ba47659bae919e691e52d7"]);
const FIRST_WORD_HASHES = new Set(["384dac3368de6f658d7bc66e8fd4c8206b91c17a9084498948c7dd6e44d4a055", "38cd88c523e691aa53962a84b6df308b95046102b7e9d67f660be4b86b891d11", "4520cbf05ab0627e955517e62537f9844fcf15f4bdce6b8d7aa6588b726e9ee8", "7512584f0d1f623614d1f29263ea52c6838134cab994011754cc0b49e1d988c2", "a54e71f0e17f5aaf7946e66ab42cf3b1fd4e61d60581736c9f0eb1c3f794eb7c", "d2caa82cdb5a0a33f42b812083c4a4c5195805f5be2058cd9e8aec9ab6589bba"]);
const MAX_PHRASE_WORDS = 3;
const forbiddenPatterns = [/\b(?:\d[ -]?){13,19}\b/];

const sha256 = (text) => crypto.createHash("sha256").update(text).digest("hex");

// La primera frase prohibida del texto, o null. Devuelve la huella, nunca la frase (el registro del CI también es público).
function forbiddenPhraseHash(contents) {
  const words = contents.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
  const firstCache = new Map();
  for (let i = 0; i < words.length; i += 1) {
    let first = firstCache.get(words[i]);
    if (first === undefined) firstCache.set(words[i], (first = FIRST_WORD_HASHES.has(sha256(words[i]))));
    if (!first) continue;
    for (let n = 1; n <= MAX_PHRASE_WORDS && i + n <= words.length; n += 1) {
      const hash = sha256(words.slice(i, i + n).join(" "));
      if (FORBIDDEN_PHRASE_HASHES.has(hash)) return hash;
    }
  }
  return null;
}

function check(label, contents) {
  for (const pattern of forbiddenPatterns) assert.doesNotMatch(contents, pattern, `${label} contiene el patrón sensible ${pattern}`);
  const hash = forbiddenPhraseHash(contents);
  assert.equal(hash, null, `${label} contiene una frase prohibida (huella ${hash?.slice(0, 12)}…): búscala con la huella en tools/check-public-privacy.mjs`);
}

for (const relative of publicFiles) {
  check(relative, fs.readFileSync(path.join(root, relative), "utf8"));
}

const data = fs.readFileSync(path.join(root, "data.js"), "utf8");
assert.match(data, /"publicDemo":true/);
assert.match(data, /"transactions":\[\]/);

const dist = path.join(root, "dist");
assert.ok(fs.existsSync(dist), "debe construirse dist antes de revisar el artefacto");
for (const entry of fs.readdirSync(dist, { recursive: true })) {
  const target = path.join(dist, entry);
  if (!fs.statSync(target).isFile() || /^vendor[\\/](xlsx\.full\.min|supabase-js-[\d.]+\.umd)\.js$/.test(entry)) continue;
  check(`dist/${entry}`, fs.readFileSync(target, "utf8"));
}
