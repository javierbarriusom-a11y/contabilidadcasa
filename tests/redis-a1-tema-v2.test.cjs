const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

// Rediseño · fase A1 (docs/rediseno/HANDOFF.md §0, §1): tema visual v2 detrás de bandera.
// Comprueba que (1) nada cambia sin la bandera, (2) está cableado en index.html, el service worker
// y el sitio público, y (3) los colores cumplen el contraste que ya exige el resto de la app.

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const css = read("tema-v2.css");
const html = read("index.html");
const js = html.slice(0, html.indexOf("</head>"));

function block(selector) {
  const start = css.indexOf(`${selector} {`);
  assert.ok(start >= 0, `falta el bloque ${selector}`);
  const body = css.slice(start, css.indexOf("}", start));
  const tokens = {};
  for (const m of body.matchAll(/(--[a-z0-9-]+):\s*([^;]+);/g)) tokens[m[1]] = m[2].trim();
  return tokens;
}

function luminance(hex) {
  const v = hex.replace("#", "");
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(v.slice(i, i + 2), 16) / 255).map((c) =>
    c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
function contrast(a, b) {
  const [x, y] = [luminance(a), luminance(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
}

const light = block(':root[data-tema="v2"]');
const dark = block(':root[data-tema="v2"][data-theme="dark"]');

test("sin la bandera no cambia nada: todas las reglas cuelgan de data-tema=\"v2\"", () => {
  const selectors = css.replace(/\/\*[\s\S]*?\*\//g, "").match(/[^{}@]+(?=\{)/g).map((s) => s.trim()).filter(Boolean);
  for (const s of selectors) {
    if (s.startsWith("media")) continue;
    assert.match(s, /data-tema="v2"/, `regla sin bandera: ${s}`);
  }
});

test("desde el 19/10 el v2 es el de por defecto; el clásico sale con ?tema=clasico y se recuerda", () => {
  assert.match(js, /pedido === "clasico"/);
  assert.match(js, /pedido !== "v2" && guardado === "clasico"/);
  assert.match(js, /if \(!clasico\) document\.documentElement\.dataset\.tema = "v2"/);
  const saver = read("tema-v2.js");
  assert.match(saver, /setItem\("tema-preferencia", "clasico"\)/);
  assert.match(saver, /removeItem\("tema-preferencia"\)/);
  assert.ok(read("index.html").includes('<script defer src="tema-v2.js'), "quien escribe va con defer");
  assert.ok(read("service-worker.js").includes('"./tema-v2.js"'));
  assert.ok(read("tools/build-public-site.mjs").includes('"tema-v2.js"'));
});

test("el script de <head> decide bien en los seis casos (URL, preferencia guardada, sin almacenamiento)", () => {
  const vm = require("node:vm");
  const src = [...js.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((m) => m[1]).find((code) => code.includes("tema-preferencia"));
  assert.ok(src, "falta el script en línea de la bandera");
  const run = (search, stored, { brokenStorage = false } = {}) => {
    const dataset = {};
    const localStorage = { getItem: (key) => { if (brokenStorage) throw new Error("bloqueado"); return key === "tema-preferencia" ? stored : null; } };
    vm.runInNewContext(src, { window: { location: { search }, localStorage }, document: { documentElement: { dataset } }, URLSearchParams });
    return dataset.tema || "clasico";
  };
  assert.equal(run("", null), "v2", "sin nada: v2 por defecto");
  assert.equal(run("?tema=clasico", null), "clasico");
  assert.equal(run("", "clasico"), "clasico", "la elección guardada se respeta");
  assert.equal(run("?tema=v2", "clasico"), "v2", "?tema=v2 manda sobre lo guardado");
  assert.equal(run("", "v2"), "v2", "quien ya tenía v2 guardado sigue en v2");
  assert.equal(run("", null, { brokenStorage: true }), "v2", "sin almacenamiento, v2");
});

test("cableado: index.html (en <head>, hoja la última), service worker y sitio público", () => {
  const head = js;
  assert.ok(head.includes('dataset.tema = "v2"'), "la bandera debe fijarse en <head>, antes de pintar");
  const links = [...head.matchAll(/<link rel="stylesheet" href="([^"?]+)/g)].map((m) => m[1]);
  assert.equal(links[links.length - 1], "tema-v2.css", "tema-v2.css debe ser la última hoja para redefinir tokens");
  assert.ok(read("service-worker.js").includes('"./tema-v2.css"'));
  assert.ok(read("tools/build-public-site.mjs").includes('"tema-v2.css"'));
});

test("redefine las dos familias de tokens existentes, sin inventar una tercera", () => {
  const families = [read("styles.css"), read("design-tokens.css")].join("\n");
  for (const name of Object.keys(light)) {
    assert.ok(families.includes(`${name}:`), `${name} no existe en styles.css ni en design-tokens.css`);
  }
  for (const name of ["--bg", "--ink", "--teal", "--e19-accent", "--e19-ink", "--e19-canvas"]) {
    assert.ok(name in light, `falta ${name} en claro`);
    assert.ok(name in dark, `falta ${name} en oscuro`);
  }
});

test("claro: texto principal y secundario ≥ 4,5:1 sobre fondo y superficie", () => {
  for (const fg of ["--ink", "--muted", "--e19-ink", "--e19-muted", "--e19-heading"]) {
    for (const bg of ["--bg", "--surface", "--e19-canvas", "--e19-surface"]) {
      const c = contrast(light[fg], light[bg]);
      assert.ok(c >= 4.5, `${fg} sobre ${bg}: ${c.toFixed(2)}:1`);
    }
  }
});

test("claro: los seis semánticos sirven como texto y como fondo con texto blanco (≥ 4,5:1)", () => {
  for (const t of ["--blue", "--teal", "--green", "--red", "--amber", "--violet", "--e19-accent", "--e19-danger", "--e19-success", "--e19-warning"]) {
    assert.ok(contrast(light[t], "#ffffff") >= 4.5, `${t} con blanco: ${contrast(light[t], "#ffffff").toFixed(2)}:1`);
    assert.ok(contrast(light[t], light["--bg"]) >= 4.5, `${t} sobre --bg: ${contrast(light[t], light["--bg"]).toFixed(2)}:1`);
  }
});

test("oscuro: texto ≥ 4,5:1 y semánticos como texto ≥ 4,5:1 (mismo compromiso que T7)", () => {
  for (const fg of ["--ink", "--muted", "--e19-ink", "--e19-muted"]) {
    assert.ok(contrast(dark[fg], dark["--bg"]) >= 4.5, `${fg}: ${contrast(dark[fg], dark["--bg"]).toFixed(2)}:1`);
    assert.ok(contrast(dark[fg], dark["--surface"]) >= 4.5, `${fg} sobre superficie`);
  }
  for (const t of ["--blue", "--teal", "--green", "--red", "--amber", "--violet"]) {
    assert.ok(contrast(dark[t], dark["--bg"]) >= 4.5, `${t} sobre --bg: ${contrast(dark[t], dark["--bg"]).toFixed(2)}:1`);
    assert.ok(contrast(dark[t], "#ffffff") >= 2.9, `${t} con blanco: ${contrast(dark[t], "#ffffff").toFixed(2)}:1`);
  }
  assert.ok(contrast(dark["--e19-accent-ink"], dark["--e19-accent"]) >= 4.5, "botón primario en oscuro");
});

test("oscuro forzado y oscuro del sistema dan los mismos valores", () => {
  const media = css.slice(css.indexOf("@media (prefers-color-scheme: dark)"));
  const sys = {};
  const body = media.slice(media.indexOf("{", media.indexOf(":root")), media.indexOf("}"));
  for (const m of body.matchAll(/(--[a-z0-9-]+):\s*([^;]+);/g)) sys[m[1]] = m[2].trim();
  assert.deepEqual(sys, dark);
});
