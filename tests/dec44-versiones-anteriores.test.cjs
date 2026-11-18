// DEC-44 (18/11/2026): solo medir. En Ajustes › Uso de la app, cuántas pantallas de «Versiones anteriores» se han abierto en
// los últimos 30 días y cuáles no, con el contador de siempre; las que redirigen a otra pantalla no se cuentan aparte.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const read = (file) => fs.readFileSync(path.join(__dirname, "..", file), "utf8");
const lab = read("laboratorio-ui.js");

function extract(source, name) {
  const start = source.indexOf(`function ${name}(`);
  let depth = 0;
  for (let i = source.indexOf(") {", start) + 2; i < source.length; i += 1) { // el cuerpo, no el «{}» de un valor por defecto
    if (source[i] === "{") depth += 1;
    else if (source[i] === "}" && --depth === 0) return source.slice(start, i + 1);
  }
  throw new Error(name);
}

const context = {
  isoLocalDate: (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`,
  REGISTRAR_LEGACY_HASH_TABS: { "update-data": "actuals" },
};
vm.createContext(context);
vm.runInContext(["usoAppVersionesAnterioresResumen", "usoAppVersionesAnterioresTexto"].map((name) => extract(lab, name)).join("\n"), context);

const HOY = new Date(2026, 10, 18, 12);
const rows = [
  { id: "debt-roadmap", title: "Plan de deuda", count: 4, last: "2026-11-10" },
  { id: "debt-control", title: "Control de deuda", count: 2, last: "2026-10-19" }, // justo 30 días: cuenta
  { id: "alerts-center", title: "Centro de alertas", count: 1, last: "2026-10-18" }, // 31 días: no
  { id: "visual-detail", title: "Cuadro de mandos", count: 0, last: "" },
  { id: "update-data", title: "Registrar reales del mes", count: 0, last: "" },
];
const ids = ["debt-roadmap", "debt-control", "alerts-center", "visual-detail", "update-data", "no-existe"];

test("DEC-44 · abiertas en 30 días, sin abrir, y las que redirigen o no están en el catálogo, aparte", () => {
  const resumen = JSON.parse(JSON.stringify(context.usoAppVersionesAnterioresResumen(rows, ids, HOY)));
  assert.deepEqual(resumen, {
    total: 4,
    abiertas: 2,
    sinAbrir: ["Centro de alertas", "Cuadro de mandos"],
    noMedibles: ["Registrar reales del mes", "no-existe"],
  });
});

test("DEC-44 · con el nombre del menú cuando lo hay", () => {
  const resumen = context.usoAppVersionesAnterioresResumen(rows, ids, HOY, { "visual-detail": "Cuadro de mandos (menú)" });
  assert.deepEqual([...resumen.sinAbrir], ["Centro de alertas", "Cuadro de mandos (menú)"]);
});

test("DEC-44 · la frase: cuántas, cuáles no, las que no se cuentan y que no retira nada", () => {
  const texto = context.usoAppVersionesAnterioresTexto(context.usoAppVersionesAnterioresResumen(rows, ids, HOY));
  assert.equal(
    texto,
    "Versiones anteriores: 2 de 4 abiertas en los últimos 30 días en este navegador. Sin abrir en 30 días: Centro de alertas, Cuadro de mandos. No se cuentan aparte (llevan a otra pantalla): Registrar reales del mes, no-existe. Sirve para decidir qué retirar (D-N15); aquí no se retira nada.",
  );
  assert.equal(context.usoAppVersionesAnterioresTexto({ total: 0, abiertas: 0, sinAbrir: [], noMedibles: [] }), "");
});

test("DEC-44 · en la tarjeta de Uso de la app, con las pantallas del grupo del menú y sin titulares", () => {
  const html = read("index.html");
  assert.ok(html.indexOf('id="usoAppLegacy"') > html.indexOf('id="usoAppSummary"') && html.indexOf('id="usoAppLegacy"') < html.indexOf('id="usoAppTableBody"'));
  assert.match(lab, /querySelectorAll\('a\[data-e17-group="legacy"\]'\)/);
  assert.match(lab, /legacyEl\.textContent = usoAppVersionesAnterioresTexto/);
  assert.doesNotMatch(lab, /^(let|const|var) /m, "laboratorio-ui.js sigue siendo solo funciones");
});
