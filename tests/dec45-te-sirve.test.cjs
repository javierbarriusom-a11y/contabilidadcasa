// DEC-45 · «¿te sirve?» en Novedades (décima auditoría §4.9): las líneas de las dos últimas semanas llevan «Sí» y «No», que
// alimentan el medidor de utilidad (medidor-utilidad.js) y salen en Ajustes › Uso de la app. Sin conceptos ni importes: solo el
// identificador de la línea, la respuesta y su fecha, en este navegador.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const medidor = require("../medidor-utilidad.js");
const shell = require("../ux-shell.js");
const NOVEDADES = require("../novedades.js");
const read = (file) => fs.readFileSync(path.join(__dirname, "..", file), "utf8");

test("DEC-45 · opinarNovedad: «sí» es acción, «no» descarte y quitarla deshecho; repetir no cuenta otra vez", () => {
  const hoy = "2026-11-21";
  let store = medidor.opinarNovedad(null, "2026-11-21-a", "si", { hoy });
  assert.deepEqual(store.novedades, { "2026-11-21-a": { v: "si", f: hoy } });
  store = medidor.opinarNovedad(store, "2026-11-21-a", "si", { hoy });
  store = medidor.opinarNovedad(store, "2026-11-20-b", "no", { hoy });
  let r = medidor.resumen(store, "novedades", "2026-11");
  assert.equal(r.acciones, 1, "la misma respuesta dos veces cuenta una");
  assert.equal(r.descartes, 1);
  // Cambiar de idea cuenta lo nuevo; quitarla, como deshecho.
  store = medidor.opinarNovedad(store, "2026-11-21-a", "no", { hoy });
  store = medidor.opinarNovedad(store, "2026-11-20-b", "", { hoy });
  r = medidor.resumen(store, "novedades", "2026-11");
  assert.equal(r.descartes, 2);
  assert.equal(r.deshechos, 1);
  assert.deepEqual(store.novedades, { "2026-11-21-a": { v: "no", f: hoy } });
  assert.equal(medidor.opinionNovedad(store, "2026-11-21-a"), "no");
  assert.equal(medidor.opinionNovedad(store, "otra"), "");
  // Lo que no es una respuesta no se guarda ni cuenta.
  const antes = JSON.stringify(store);
  assert.equal(JSON.stringify(medidor.opinarNovedad(store, "2026-11-21-a", "quizá", { hoy })), antes);
  assert.equal(JSON.stringify(medidor.opinarNovedad(store, "<script>", "si", { hoy })), antes);
  assert.equal(JSON.stringify(medidor.opinarNovedad(store, "", "si", { hoy })), antes);
});

test("DEC-45 · lo guardado se limpia al leer: respuestas válidas, con fecha, como mucho 300 y las más recientes", () => {
  const raw = { novedades: { ok: { v: "si", f: "2026-11-21" }, mal: { v: "tal vez", f: "2026-11-21" }, sinFecha: { v: "no" }, "con espacio": { v: "si", f: "2026-11-21" } } };
  assert.deepEqual(medidor.normalize(raw).novedades, { ok: { v: "si", f: "2026-11-21" } });
  assert.deepEqual(medidor.normalize({ novedades: [] }).novedades, {});
  const muchas = Object.fromEntries(Array.from({ length: 320 }, (_, i) => [`n${i}`, { v: "si", f: `2026-${String(1 + Math.floor(i / 28)).padStart(2, "0")}-${String(1 + (i % 28)).padStart(2, "0")}` }]));
  const limpio = medidor.normalize({ novedades: muchas }).novedades;
  assert.equal(Object.keys(limpio).length, 300);
  assert.ok(!limpio.n0, "se van las más antiguas");
  assert.ok(limpio.n319);
});

test("DEC-45 · el informe: cuántas sirven y cuáles no, por su texto (tres como mucho)", () => {
  const entries = [
    { id: "a", texto: "Previsión: una frase con la semana que viene" },
    { id: "b", texto: "Hoy: una línea con el repaso hecho, los grupos clasificados y el porcentaje del gasto con partida de los últimos noventa días" },
    { id: "c", texto: "C" },
    { id: "d", texto: "D" },
    { id: "e", texto: "E" },
  ];
  assert.equal(medidor.fraseNovedades(null, entries), "", "sin respuestas, nada");
  let store = medidor.opinarNovedad(null, "a", "si", { hoy: "2026-11-21" });
  assert.equal(medidor.fraseNovedades(store, entries), "Respondidas 1: 1 os sirve y 0 no.");
  store = medidor.opinarNovedad(store, "b", "no", { hoy: "2026-11-21" });
  const frase = medidor.fraseNovedades(store, entries);
  assert.match(frase, /^Respondidas 2: 1 os sirve y 1 no\. No os sirven: «Hoy: una línea con el repaso hecho, los grupos clasificados…»\.$/, "cortado a 60 caracteres, sin espacio antes de los puntos");
  for (const id of ["c", "d", "e"]) store = medidor.opinarNovedad(store, id, "no", { hoy: "2026-11-21" });
  assert.match(medidor.fraseNovedades(store, entries), /No os sirven: «[^»]+»; «[^»]+»; «[^»]+» y 1 más\.$/);
  // En el informe mensual, con su nombre y en el orden de siempre.
  const f = medidor.FUNCIONES.find((item) => item.id === "novedades");
  assert.equal(f.nombre, "Novedades («¿te sirve?»)");
  assert.match(medidor.frase("novedades", medidor.resumen(store, "novedades", "2026-11")), /1 «sí, me sirve» · 4 «no me sirve» · 0 respuestas quitadas/);
  const src = read("medidor-utilidad.js");
  assert.match(src, /f\.id === "novedades" \? fraseNovedades\(store, globalThis\.FinanceNovedades \|\| \[\]\)/);
});

test("DEC-45 · solo preguntan las líneas de las dos últimas semanas, y las ya respondidas (para cambiar la respuesta)", () => {
  assert.equal(shell.NOVEDADES_SIRVE_DIAS, 14);
  const hoy = "2026-11-21";
  assert.equal(shell.novedadPregunta({ fecha: "2026-11-21" }, hoy), true);
  assert.equal(shell.novedadPregunta({ fecha: "2026-11-08" }, hoy), true, "hace 13 días");
  assert.equal(shell.novedadPregunta({ fecha: "2026-11-07" }, hoy), false, "hace 14 días ya no");
  assert.equal(shell.novedadPregunta({ fecha: "2026-11-07" }, hoy, "no"), true, "respondida, sigue para poder cambiarla");
  assert.equal(shell.novedadPregunta({ fecha: "2026-11-30" }, hoy), false, "una de fecha futura no");
  assert.equal(shell.novedadPregunta({ fecha: "2026-11-21" }, ""), false);
  // Con la lista real de hoy, menos de la mitad de las líneas preguntan.
  const preguntan = shell.novedadesVigentes(NOVEDADES, hoy).filter((entry) => shell.novedadPregunta(entry, hoy)).length;
  assert.ok(preguntan > 0 && preguntan < NOVEDADES.length / 2, `${preguntan} de ${NOVEDADES.length}`);
});

test("DEC-45 · la lista: «¿Te sirve?» con dos botones que dicen si están pulsados, nombrados por su línea", () => {
  const elements = {};
  const el = (id) => (elements[id] ||= { id, innerHTML: "", hidden: false, textContent: "", listeners: {}, addEventListener(type, fn) { (this.listeners[type] ||= []).push(fn); } });
  ["novedadesList", "novedadesBadge", "versionStamp", "versionStampLabel"].forEach(el);
  const doc = { getElementById: (id) => elements[id] || null, addEventListener() {} };
  const opiniones = { "2026-11-20-x": "si" };
  const vistas = [];
  const win = {
    localStorage: { getItem: () => null, setItem() {} },
    navigator: {},
    FinanceMedidor: { opinion: (id) => opiniones[id] || "", opinar: (id, v) => v, anotar: (id, evento) => vistas.push(`${id}:${evento}`) },
  };
  const entries = [
    { id: "2026-11-21-y", fecha: "2026-11-21", texto: "Nueva <b>", href: "#home" },
    { id: "2026-11-20-x", fecha: "2026-11-20", texto: "Respondida" },
    { id: "2026-10-01-z", fecha: "2026-10-01", texto: "Antigua" },
  ];
  shell.mountReleaseInfo({ doc, win, entries, buildInfo: { version: "dev", builtAt: "" }, today: "2026-11-21" });
  const html = elements.novedadesList.innerHTML;
  assert.match(html, /<li data-novedad="2026-11-21-y">.*<a href="#home" id="novedad-2026-11-21-y-t">Nueva &lt;b&gt;<\/a> <span class="novedad-sirve" role="group" aria-labelledby="novedad-2026-11-21-y-q novedad-2026-11-21-y-t"><span id="novedad-2026-11-21-y-q">¿Te sirve\?<\/span> <button type="button" class="novedad-sirve-btn" data-novedad-sirve="si" aria-pressed="false">Sí<\/button> <button type="button" class="novedad-sirve-btn" data-novedad-sirve="no" aria-pressed="false">No<\/button><\/span><\/li>/);
  assert.match(html, /<span id="novedad-2026-11-20-x-t">Respondida<\/span>.*data-novedad-sirve="si" aria-pressed="true"/);
  assert.match(html, /<li><time datetime="2026-10-01">1\/10\/2026<\/time> Antigua<\/li>/, "la antigua, como siempre");
  assert.equal(elements.novedadesList.listeners.click.length, 1, "un solo manejador, delegado en la lista");
  // Abrir Novedades es la vista del medidor.
  elements.versionStamp.open = true;
  elements.versionStamp.listeners.toggle.forEach((fn) => fn());
  assert.deepEqual(vistas, ["novedades:vista"]);
  // Sin medidor (no cargó), la lista es la de siempre, sin botones.
  delete win.FinanceMedidor;
  shell.mountReleaseInfo({ doc, win, entries, buildInfo: { version: "dev", builtAt: "" }, today: "2026-11-21" });
  assert.doesNotMatch(elements.novedadesList.innerHTML, /novedad-sirve/);
});

test("DEC-45 · estilos, versiones y su línea de Novedades", () => {
  const css = read("styles.css");
  assert.match(css, /\.version-stamp-list \.novedad-sirve-btn \{[^}]*min-height: 24px;/, "24 px de objetivo táctil (WCAG 2.5.8)");
  assert.match(css, /\.version-stamp-list \.novedad-sirve-btn\[aria-pressed="true"\] \{/);
  const html = read("index.html");
  ["medidor-utilidad.js", "novedades.js", "ux-shell.js"].forEach((file) => assert.ok(html.includes(`${file}?v=20261121dec45`), file));
  assert.match(html, /styles\.css\?v=20261121dec(?:45|38c|38d)/, "styles.css siguió a 20261121dec38c y dec38d con DEC-38 a 195 px");
  assert.ok(html.indexOf('src="medidor-utilidad.js?v=') < html.indexOf('src="ux-shell.js?v='), "el medidor carga antes que la lista");
  const novedad = NOVEDADES.find((entry) => entry.id === "2026-11-21-te-sirve");
  assert.equal(novedad.href, "#ajustes");
  assert.match(novedad.texto, /¿Te sirve\?/);
});
