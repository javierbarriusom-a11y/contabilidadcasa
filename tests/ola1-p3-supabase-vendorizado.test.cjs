const test = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

// Ola 1 · P3: supabase-js dejó de cargarse desde jsDelivr (`@2`, sin versión fija ni SRI, y un
// <script defer> lento retrasa DOMContentLoaded) y se sirve desde el propio origen, fijado, con su
// hash y precacheado para uso sin conexión.

const root = path.resolve(__dirname, "..");
const read = (name) => fs.readFileSync(path.join(root, name), "utf8");
const VENDOR = "vendor/supabase-js-2.117.2.umd.js";
// SHA-256 del UMD publicado en npm (@supabase/supabase-js@2.117.2, dist/umd/supabase.js).
const VENDOR_SHA256 = "59d39487c3589843b410322d8a3d562ce022aba1e5ccb16898ef3fb2a0da2ecd";

test("ninguna página carga supabase-js desde una CDN externa; ambas usan la copia fijada", () => {
  for (const page of ["index.html", "share.html"]) {
    const html = read(page);
    assert.doesNotMatch(html, /cdn\.jsdelivr\.net|unpkg\.com|cdnjs\.cloudflare\.com/, `${page} no debe cargar scripts de terceros`);
    assert.ok(html.includes(`<script defer src="${VENDOR}"></script>`), `${page} debe cargar ${VENDOR}`);
  }
});

test("la copia vendorizada es exactamente la publicada en npm (hash) y expone el global supabase", () => {
  const source = fs.readFileSync(path.join(root, VENDOR));
  assert.equal(crypto.createHash("sha256").update(source).digest("hex"), VENDOR_SHA256);
  assert.match(source.toString("utf8", 0, 40), /^var supabase=/);
});

test("el Service Worker la precachea y el build la copia sin reminificarla; la guarda de privacidad solo exime a vendor/", () => {
  assert.ok(read("service-worker.js").includes(`"./${VENDOR}"`));
  const build = read("tools/build-public-site.mjs");
  assert.ok(build.includes(`"${VENDOR}",\n`));
  assert.match(build, /const minifySkip = new Set\(\[[^\]]*supabase-js-2\.117\.2\.umd\.js/);
  assert.match(read("tools/check-public-privacy.mjs"), /\^vendor\[\\\\\/\]\(xlsx\\\.full\\\.min\|supabase-js-/);
});

test("app.js sigue detectando la librería por window.supabase (mismo global que exponía la CDN)", () => {
  assert.match(read("app.js"), /window\.supabase &&/);
  assert.match(read("app.js"), /window\.supabase\.createClient\(/);
});
