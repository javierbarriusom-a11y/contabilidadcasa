// DUO-05 · D-N37 (duodécima auditoría; adelantada por D-N39): la barra inferior del móvil. Hoy, Movimientos, Plan, Deuda y «Más».
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const B = require("../barra-inferior.js");

const read = (file) => fs.readFileSync(path.join(__dirname, "..", file), "utf8");

test("DUO-05 · cuatro destinos y «Más», con texto siempre; las pestañas cuentan como su destino", () => {
  assert.deepEqual(B.DESTINOS.map((d) => [d.texto, d.href]), [["Hoy", "#home"], ["Movimientos", "#movements"], ["Plan", "#plan"], ["Deuda", "#deuda-ruta"]]);
  assert.equal(B.destinoDe("home"), "hoy");
  assert.equal(B.destinoDe("movements"), "movimientos");
  assert.equal(B.destinoDe("plan"), "plan");
  assert.equal(B.destinoDe("cierre"), "plan", "Cierre es del ritmo mensual, como Plan");
  assert.equal(B.destinoDe("deuda-contratos"), "deuda");
  assert.equal(B.destinoDe("deuda-simulador"), "deuda");
  assert.equal(B.destinoDe("ajustes"), null, "lo demás, «Más»");
  const html = B.html();
  assert.equal((html.match(/class="barra-inf-item"/g) || []).length, 5);
  for (const texto of ["Hoy", "Movimientos", "Plan", "Deuda", "Más"]) assert.match(html, new RegExp(`<span class="barra-inf-texto"[^>]*>${texto}</span>`));
  assert.match(html, /data-barra-mas aria-controls="primarySidebar" aria-expanded="false"/);
  assert.match(html, /data-corto="Movim\."/);
  assert.equal((html.match(/aria-hidden="true"/g) || []).length, 5, "los iconos no se leen: el texto sí");
});

test("DUO-05 · solo entre 300 y 860 px, 56 px más la zona segura, el activo con forma, oculta con el teclado y sin tapar el contenido", () => {
  const css = read("barra-inferior.css");
  assert.match(css, /@media \(min-width: 300px\) and \(max-width: 860px\)/);
  assert.match(css, /min-height: calc\(56px \+ env\(safe-area-inset-bottom, 0px\)\)/);
  assert.match(css, /\.barra-inf-item\[aria-current="page"\]::before \{[^}]*height: 3px;/);
  assert.match(css, /body\.con-barra-inferior\.barra-inf-teclado \.barra-inferior \{\s*display: none;/);
  assert.match(css, /padding-bottom: calc\(60px \+ env\(safe-area-inset-bottom, 0px\)\)/);
  assert.match(css, /scroll-padding-bottom/);
  assert.match(css, /body\.con-barra-inferior \.undo-toast,\s*body\.con-barra-inferior \.update-toast \{\s*bottom: calc\(68px/);
});

test("DUO-05 · cableado: la barra en el shell, su hoja y su script, el service worker, el build y el medidor", () => {
  const html = read("index.html");
  assert.match(html, /<nav class="barra-inferior" id="barraInferior" aria-label="Destinos principales"><\/nav>/);
  assert.ok(html.indexOf('id="barraInferior"') > html.indexOf("</main>"), "fuera de <main>");
  assert.match(html, /barra-inferior\.css\?v=20261124duo05/);
  assert.match(html, /<script defer src="barra-inferior\.js\?v=20261124duo05"><\/script>/);
  ["./barra-inferior.js", "./barra-inferior.css"].forEach((f) => assert.ok(read("service-worker.js").includes(`"${f}"`), f));
  ["barra-inferior.js", "barra-inferior.css"].forEach((f) => assert.ok(read("tools/build-public-site.mjs").includes(`"${f}"`), f));
  assert.ok(require("../medidor-utilidad.js").FUNCIONES.some((f) => f.id === "barra-inferior"));
});
