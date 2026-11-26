// DEC-23 (décima auditoría §4.4; el cambio de Hoy de la semana del 30/11/2026): con el repaso de esta semana hecho, Hoy dice
// «Repaso hecho el martes» en el hueco de su entrada hasta el domingo, con los grupos clasificados en ese repaso, el % del gasto
// con partida (la cifra de la bandeja, DEC-18) y la racha. Conclusión: tinte claro y sin botón. Puerta de fecha.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const read = (name) => fs.readFileSync(path.join(root, name), "utf8");
const hoy = read("views/hoy-v2.js");
const repaso = read("views/repaso-v2.js");

function extract(source, name) {
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

const constante = (source, name) => {
  const match = new RegExp(`^const ${name} = .*;$`, "m").exec(source);
  assert.ok(match, `No existe ${name}`);
  return match[0];
};

function sandbox({ runs, racha = 1, meta = { pct: 96 } }) {
  const isoLocalDate = (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
  const context = { isoLocalDate, escapeHtml: (text) => String(text).replace(/</g, "&lt;"), runs, racha, meta };
  context.globalThis = context;
  vm.createContext(context);
  vm.runInContext(
    [
      constante(hoy, "HOY_V2_REPASO_DESDE"),
      constante(hoy, "HOY_V2_HECHO_DESDE"),
      constante(hoy, "HOY_V2_DIAS_SEMANA"),
      extract(repaso, "repasoV2Lunes"),
      "globalThis.repasoV2Open = () => {};",
      "globalThis.clasV2Meta = () => { if (meta instanceof Error) throw meta; return meta; };",
      "globalThis.FinanceRepaso = { resumen: () => ({ ultimo: runs.at(-1) || null, racha }), mismaSemana: (a, b) => repasoV2Lunes(a) === repasoV2Lunes(b) };",
      extract(hoy, "hoyV2RepasoHecho"),
      extract(hoy, "hoyV2Repaso"),
    ].join("\n"),
    context,
  );
  return context;
}

test("puerta de fecha: es el cambio de Hoy de la semana del 30/11; antes, hecho el repaso, no ocupa pantalla como hasta ahora", () => {
  assert.match(hoy, /^const HOY_V2_HECHO_DESDE = "2026-11-24";$/m);
  const antes = sandbox({ runs: [{ date: "2026-11-24", seconds: 240, clasificados: 3 }] });
  assert.equal(antes.hoyV2Repaso("2026-11-23"), ""); // D-N39: la puerta pasa al 24/11
  const despues = sandbox({ runs: [{ date: "2026-12-01", seconds: 240, clasificados: 3 }] });
  assert.match(despues.hoyV2Repaso("2026-12-02"), /data-hoy-v2-hecho/);
});

test("hecho esta semana: «Repaso hecho el martes» con grupos, % con partida y racha; sin botón", () => {
  const { hoyV2Repaso } = sandbox({ runs: [{ date: "2026-12-01", seconds: 240, clasificados: 12 }], racha: 3 });
  const html = hoyV2Repaso("2026-12-03");
  assert.match(html, /<div class="hoy-v2-hecho" data-hoy-v2-hecho>/);
  assert.match(html, /<strong>Repaso hecho el martes<\/strong><br>12 grupos clasificados · 96 % del gasto con partida · 3 semanas seguidas/);
  assert.doesNotMatch(html, /<button|data-hoy-v2-repaso/);
  // Hasta el domingo de esa semana; el lunes siguiente vuelve la entrada al repaso.
  assert.match(hoyV2Repaso("2026-12-06"), /data-hoy-v2-hecho/);
  assert.match(hoyV2Repaso("2026-12-07"), /data-hoy-v2-repaso/);
});

test("lo que no se sabe no se dice: sin grupos, sin %, sin racha, solo «Repaso hecho hoy»", () => {
  const solo = sandbox({ runs: [{ date: "2026-12-02", seconds: 200 }], racha: 1, meta: null }).hoyV2Repaso("2026-12-02");
  assert.match(solo, /<strong>Repaso hecho hoy<\/strong>\s*<\/span>/);
  assert.doesNotMatch(solo, /<br>/);
  const uno = sandbox({ runs: [{ date: "2026-12-02", seconds: 200, clasificados: 1 }], meta: new Error("sin datos") }).hoyV2Repaso("2026-12-02");
  assert.match(uno, /<br>1 grupo clasificado</);
  assert.doesNotMatch(sandbox({ runs: [{ date: "2026-12-02", seconds: 200, clasificados: 0 }] }).hoyV2Repaso("2026-12-02"), /grupo/);
});

test("el repaso guarda cuántos grupos sin partida menos hay al terminar que al abrirlo (solo el número)", () => {
  assert.match(repaso, /gruposAntes: repasoV2ContarGrupos\(\) \};/);
  assert.match(repaso, /const clasificados = Number\.isInteger\(repasoV2\.gruposAntes\) \? Math\.max\(0, repasoV2\.gruposAntes - repasoV2ContarGrupos\(\)\) : null;/);
  assert.match(repaso, /\.\.\.\(clasificados === null \? \{\} : \{ clasificados \}\) \}\);/);
  const context = { clasV2PendingGroups: () => [{ rows: [] }, { rows: [] }] };
  vm.createContext(context);
  vm.runInContext([extract(repaso, "repasoV2GruposSinPartida"), extract(repaso, "repasoV2ContarGrupos")].join("\n"), context);
  assert.equal(context.repasoV2ContarGrupos(), 2);
  context.clasV2PendingGroups = () => { throw new Error("x"); };
  assert.equal(context.repasoV2ContarGrupos(), null);
});

test("estilos, versiones y Novedades", () => {
  const css = read("tema-v2.css");
  assert.match(css, /:root\[data-tema="v2"\] \.hoy-v2-hecho \{[^}]*background: var\(--e19-accent-soft\);/);
  assert.doesNotMatch(css.match(/:root\[data-tema="v2"\] \.hoy-v2-hecho \{[^}]*\}/)[0], /cursor/);
  const html = read("index.html");
  assert.match(html, /views\/repaso-v2\.js\?v=20261121foco/, "views/repaso-v2.js siguió a 20261121foco (el foco al cerrar en Safari)");
  assert.match(html, /views\/hoy-v2\.js\?v=(?:20261121areas|20261122und|20261123duo04|20261124duod1|20261124dn39)/, "views/hoy-v2.js siguió a 20261121areas con Hoy por áreas");
  // tema-v2.css pasó a 20261121dec30 con la frase de la semana que viene (DEC-30) y novedades.js, también a 20261121dec45 (DEC-45).
  assert.match(html, /tema-v2\.css\?v=2026112(?:1(?:dec30|dec38c|dec38d|areas|d658)|2und|5tred1|5tred2|5tre3c|5tred4|5tred4b|5tred5|6tred5b|6tred5c)/); // y a 20261121dec38c y dec38d con DEC-38 a 195 px
  assert.match(html, /novedades\.js\?v=2026112(?:1(?:dec30|dec45|areas|dn27|dn28)|2und|5dn40|5tred2|5tre3c|5tred4|5tred4b|5tred5|6tred5b|6tred5c)/);
  const novedad = require("../novedades.js").find((entry) => entry.id === "2026-11-30-repaso-hecho");
  assert.equal(novedad.fecha, "2026-11-30");
  assert.equal(novedad.href, "#home");
});
