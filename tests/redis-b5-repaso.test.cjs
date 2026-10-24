const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

// Rediseño B5 · Repaso semanal (views/repaso-v2.js, XUX-03): cinco pasos con cronómetro, el registro de duración que
// alimenta M-COSTE y su sitio en la app (diálogo, script, publicación, Funciones en prueba y medidor).

const root = path.resolve(__dirname, "..");
const read = (name) => fs.readFileSync(path.join(root, name), "utf8");
const source = read("views/repaso-v2.js");

function extract(name) {
  const start = source.indexOf(`function ${name}(`);
  assert.ok(start >= 0, `No existe ${name}`);
  let depth = 0;
  for (let index = source.indexOf("{", source.indexOf(")", start)); index < source.length; index += 1) {
    if (source[index] === "{") depth += 1;
    else if (source[index] === "}") {
      depth -= 1;
      if (depth === 0) return source.slice(start, index + 1);
    }
  }
  throw new Error(`Sin cuerpo: ${name}`);
}

function sandbox() {
  const isoLocalDate = (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
  const context = { isoLocalDate };
  vm.createContext(context);
  vm.runInContext(["repasoV2Duracion", "repasoV2Lunes", "repasoV2Racha", "repasoV2MinutosSemana"].map(extract).join("\n"), context);
  return context;
}

test("el cronómetro se lee en minutos y segundos", () => {
  const { repasoV2Duracion } = sandbox();
  assert.equal(repasoV2Duracion(0), "0 s");
  assert.equal(repasoV2Duracion(45), "45 s");
  assert.equal(repasoV2Duracion(60), "1 min");
  assert.equal(repasoV2Duracion(70), "1 min 10 s");
  assert.equal(repasoV2Duracion(250.4), "4 min 10 s");
});

test("la semana es la ISO (de lunes a domingo)", () => {
  const { repasoV2Lunes } = sandbox();
  assert.equal(repasoV2Lunes("2026-10-26"), "2026-10-26"); // lunes
  assert.equal(repasoV2Lunes("2026-11-01"), "2026-10-26"); // domingo
  assert.equal(repasoV2Lunes("2026-10-24"), "2026-10-19"); // sábado
});

test("racha: semanas seguidas con repaso; la de esta semana no rompe hasta que acaba", () => {
  const { repasoV2Racha } = sandbox();
  const runs = (dates) => dates.map((date) => ({ date, seconds: 200 }));
  assert.equal(repasoV2Racha([], "2026-10-28"), 0);
  assert.equal(repasoV2Racha(runs(["2026-10-27"]), "2026-10-28"), 1);
  assert.equal(repasoV2Racha(runs(["2026-10-13", "2026-10-20", "2026-10-27"]), "2026-10-28"), 3);
  // Esta semana aún sin repaso: cuentan las anteriores.
  assert.equal(repasoV2Racha(runs(["2026-10-13", "2026-10-20"]), "2026-10-28"), 2);
  // Una semana sin repaso corta la racha.
  assert.equal(repasoV2Racha(runs(["2026-10-06", "2026-10-20", "2026-10-27"]), "2026-10-28"), 2);
});

test("M-COSTE: minutos de mantenimiento de la semana, sumando solo sus repasos", () => {
  const { repasoV2MinutosSemana } = sandbox();
  const runs = [{ date: "2026-10-20", seconds: 600 }, { date: "2026-10-26", seconds: 250 }, { date: "2026-10-29", seconds: 110 }];
  assert.equal(repasoV2MinutosSemana(runs, "2026-10-30"), 6);
  assert.equal(repasoV2MinutosSemana(runs, "2026-10-21"), 10);
  assert.equal(repasoV2MinutosSemana([], "2026-10-21"), 0);
});

test("cinco pasos en el orden del handoff: saldos, extracto, lo que vino, bandeja y listo", () => {
  const pasos = [...source.matchAll(/\{ id: "([a-z]+)", nombre: "([^"]+)" \}/g)].map((m) => m[1]);
  assert.deepEqual(pasos, ["saldos", "extracto", "vino", "bandeja", "listo"]);
});

test("reutiliza lo que ya existe: el pulso de saldos, las preguntas de esperados y Clasificar; no guarda importes", () => {
  assert.match(source, /FinanceCanonicalBalancePulse\?\.buildModel\(/);
  assert.match(source, /setBalancePulseState\(siguiente, repasoV2Hoy\(\)\)/);
  assert.match(source, /showUndoToast\("Saldos al día\."/);
  assert.match(source, /expectedMovementInboxItems\(\)/);
  assert.match(source, /clasificarV2Open\(opener\)/);
  // El registro solo guarda fecha, segundos y qué se hizo.
  assert.match(source, /store\.runs\.push\(\{ date: repasoV2Hoy\(\), seconds: Math\.round\(repasoV2\.final\), saldos: Boolean\(repasoV2\.hecho\.saldos\), importado: Boolean\(repasoV2\.hecho\.importado\) \}\)/);
  // Los selectores de modo pasan a manual antes de guardar (si no, el repintado devolvería los saldos calculados).
  assert.match(source, /repasoV2Modo\("manual"\);\n\s+setBalancePulseState/);
});

test("medidor: abrir es vista, terminar es acción (con su duración) y cerrar a medias es descarte", () => {
  assert.match(source, /anotar\("repaso-v2", "vista"\)/);
  assert.match(source, /anotar\("repaso-v2", "accion", \{ segundos: repasoV2\.final \}\)/);
  assert.match(source, /anotar\("repaso-v2", "descarte"\)/);
  const medidor = read("medidor-utilidad.js");
  assert.match(medidor, /\{ id: "repaso-v2", nombre: "Repaso semanal", accion: \["repaso terminado", "repasos terminados"\], descarte: \["repaso a medias", "repasos a medias"\]/);
  assert.match(medidor, /id === "repaso-v2" && r\.medianaSegundos !== null/);
});

test("está en la app: diálogo, script con defer, lista de publicación, service worker, Funciones en prueba y Movimientos", () => {
  const html = read("index.html");
  assert.match(html, /<dialog class="rep-v2" id="repasoV2" aria-labelledby="repasoV2Titulo"><\/dialog>/);
  assert.match(html, /<script defer src="views\/repaso-v2\.js\?v=\d+redisB5"><\/script>/);
  assert.ok(html.indexOf("views/repaso-v2.js") < html.indexOf('src="app.js'), "antes de app.js, como el resto de views/*-v2.js");
  assert.match(read("tools/build-public-site.mjs"), /^ {2}"views\/repaso-v2\.js",$/m);
  assert.match(read("service-worker.js"), /"\.\/views\/repaso-v2\.js",/);
  assert.match(read("funciones-en-prueba.js"), /\{ id: "repaso-v2", nombre: "Repaso semanal", [^}]*desde: "2026-10-24", [^}]*parteDe: "tema-v2" \}/);
  const mov = read("views/movimientos-v2.js");
  assert.match(mov, /data-mov-v2-repaso/);
  assert.match(mov, /globalThis\.repasoV2Open\?\.\(repaso\)/);
});

test("estilos: todo cuelga del tema v2; pantalla completa en móvil y diálogo de 880 × 600 en escritorio", () => {
  const css = read("tema-v2.css");
  const block = css.slice(css.indexOf("/* ---------- B5 · Repaso semanal"));
  assert.ok(block.length > 100);
  const selectors = block.replace(/\/\*[\s\S]*?\*\//g, "").match(/^[^@{}\n][^{}]*\{/gm) || [];
  selectors.forEach((selector) => assert.match(selector.trim(), /^:root\[data-tema="v2"\]/, `selector fuera del tema: ${selector}`));
  assert.match(block, /dialog\.rep-v2 \{\n {2}position: fixed;\n {2}inset: 0;/);
  assert.match(block, /@media \(min-width: 1024px\) \{\n {2}:root\[data-tema="v2"\] dialog\.rep-v2 \{\n {4}inset: 0;\n {4}width: 880px;\n {4}height: 600px;/);
});
