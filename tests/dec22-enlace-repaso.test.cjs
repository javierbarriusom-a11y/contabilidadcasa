// DEC-22 (décima auditoría, 20/11/2026): el aviso del domingo del calendario (el repaso semanal, 13/11) lleva un enlace que abre la app
// directamente en el repaso. El recordatorio llegaba; la puerta no. Sin importes ni datos en el enlace: es la dirección de la app y una marca.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const R = require("../canonical-reminders.js");

const ROOT = path.join(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(ROOT, file), "utf8");
const soloRepaso = (extra = {}) => ({ kinds: Object.fromEntries(R.KINDS.map((kind) => [kind, kind === "weeklyReview"])), ...extra });
const SITE = "https://ejemplo.github.io/contabilidadcasa/";

test("la dirección de la app: solo http(s), sin «?» ni «#»", () => {
  assert.equal(R.appBaseUrl(SITE), SITE);
  assert.equal(R.appBaseUrl(`${SITE}index.html?tema=clasico#ajustes`), `${SITE}index.html`);
  assert.equal(R.appBaseUrl("http://127.0.0.1:4173/index.html#home"), "http://127.0.0.1:4173/index.html");
  ["", "   ", null, undefined, 42, "file:///home/x/index.html", "javascript:alert(1)", "no es una dirección"].forEach((value) => assert.equal(R.appBaseUrl(value), "", String(value)));
});

test("con la dirección, cada aviso del domingo lleva el enlace en el detalle y en su campo URL", () => {
  const r = R.build({ today: "2026-11-20", options: soloRepaso({ appUrl: `${SITE}?tema=clasico#ajustes` }) });
  assert.equal(r.events.length, 26);
  const link = `${SITE}#home?abrir=repaso`;
  r.events.forEach((event) => {
    assert.equal(event.url, link);
    assert.ok(event.description.endsWith(`Empezar el repaso ahora: ${link}`), event.description);
  });
  // El título no cambia (es lo que se ve en la pantalla de bloqueo) y el identificador tampoco: importar el fichero nuevo actualiza los avisos ya puestos.
  assert.equal(r.events[0].title, "Repaso semanal de las cuentas · unos 5 min");
  assert.equal(r.events[0].uid, "rec-repaso-2026-11-22");
  const ics = R.toIcs(r.events.slice(0, 1), { now: "2026-11-20T10:00:00Z" });
  assert.match(ics, /\r\nURL:https:\/\/ejemplo\.github\.io\/contabilidadcasa\/#home\?abrir=repaso\r\n/);
  // El detalle se pliega a 75 octetos; desplegado (RFC 5545 §3.1) lleva el enlace entero.
  assert.match(ics.replace(/\r\n /g, ""), /DESCRIPTION:[^\r\n]*Empezar el repaso ahora: https:\/\/ejemplo\.github\.io\/contabilidadcasa\/#home\?abrir=repaso\r\n/);
  ics.split("\r\n").forEach((line) => assert.ok(Buffer.byteLength(line, "utf8") <= 75, line));
});

test("sin dirección válida, el aviso sale como antes: sin enlace ni campo URL", () => {
  [undefined, "", "file:///x/index.html"].forEach((appUrl) => {
    const [event] = R.build({ today: "2026-11-20", options: soloRepaso({ appUrl }) }).events;
    assert.equal(event.url, undefined);
    assert.doesNotMatch(event.description, /Empezar el repaso|https?:/);
    assert.doesNotMatch(R.toIcs([event], { now: "2026-11-20T10:00:00Z" }), /\r\nURL:/);
  });
  // Un campo URL que no es http(s) de una sola línea no entra en el fichero.
  assert.doesNotMatch(R.toIcs([{ uid: "x", date: "2026-11-22", title: "t", url: "javascript:alert(1)" }], { now: "2026-11-20T10:00:00Z" }), /URL:/);
  assert.doesNotMatch(R.toIcs([{ uid: "x", date: "2026-11-22", title: "t", url: "https://a.b/\r\nX-INYECTADO:1" }], { now: "2026-11-20T10:00:00Z" }), /URL:|X-INYECTADO/);
});

test("solo el aviso del repaso lleva enlace", () => {
  const r = R.build({
    today: "2026-11-20",
    incomes: [{ date: "2026-11-27", label: "Nómina", amount: 1000, confidence: "rule" }],
    options: { appUrl: SITE },
  });
  r.events.filter((event) => event.kind !== "weeklyReview").forEach((event) => assert.equal(event.url, undefined, event.kind));
  assert.ok(r.events.some((event) => event.kind === "weeklyReview" && event.url));
});

test("qué dirección pide abrir el repaso", () => {
  assert.equal(R.REVIEW_LINK_HASH, "#home?abrir=repaso");
  ["#home?abrir=repaso", "home?abrir=repaso", "#home?x=1&abrir=repaso", "#home?abrir=repaso&y=2"].forEach((hash) => assert.equal(R.reviewLinkRequested(hash), true, hash));
  ["", "#home", "#home?abrir=repasos", "#home?abrir=", "#registrar?abrir=repaso", "#movements?abrir=repaso", "#home?noabrir=repaso", null, undefined].forEach((hash) => assert.equal(R.reviewLinkRequested(hash), false, String(hash)));
});

test("la app: la descarga pasa la dirección; al cargar y al cambiar el «#», el repaso se abre desde el enlace", () => {
  assert.match(read("recordatorios-ui.js"), /appUrl: globalThis\.location\?\.href \|\| ""/);
  const repaso = read("views/repaso-v2.js");
  assert.match(repaso, /function repasoV2DesdeEnlace\(\) \{\n  if \(!globalThis\.FinanceCanonicalReminders\?\.reviewLinkRequested\(location\.hash\)\) return false;/);
  assert.match(repaso, /history\.replaceState\(null, "", `\$\{location\.pathname\}\$\{location\.search\}#home`\);/);
  assert.match(repaso, /FinanceMedidor\?\.anotar\("repaso-enlace", "accion"\)/);
  assert.match(repaso, /repasoV2Open\(qs\("hoyV2"\)\?\.querySelector\("\[data-hoy-v2-repaso\]"\) \|\| null, \{ desdeHoy: true \}\);/); // 21/11: marcado encima de Hoy
  assert.match(repaso, /globalThis\.repasoV2DesdeEnlace = repasoV2DesdeEnlace;/);
  const app = read("app.js");
  assert.match(app, /openCaptureLinkFromHash\(\);\n    globalThis\.repasoV2DesdeEnlace\?\.\(\);/);
  assert.match(app, /if \(document\.readyState === "complete"\) globalThis\.repasoV2DesdeEnlace\?\.\(\); else window\.addEventListener\("load", \(\) => globalThis\.repasoV2DesdeEnlace\?\.\(\), \{ once: true \}\);/);
  const medidor = require("../medidor-utilidad.js");
  assert.deepEqual(medidor.FUNCIONES.find((f) => f.id === "repaso-enlace").accion, ["repaso empezado desde el aviso", "repasos empezados desde el aviso"]);
});

test("versiones y Novedades: el fichero hay que descargarlo otra vez para tener el enlace", () => {
  const html = read("index.html");
  // views/repaso-v2.js siguió a 20261120dec23 con DEC-23 (los grupos clasificados de cada repaso).
  assert.match(html, /<script defer src="views\/repaso-v2\.js\?v=(?:20261120dec2[23]|20261121foco2?)"><\/script>/);
  assert.match(html, /<script defer src="novedades\.js\?v=(?:20261120dec2[23]|20261121dec30|20261121dec45|20261121areas|20261121dn27|20261121dn28|20261122und|20261122und11|20261122und17|20261122und13|20261122und08|20261122und04|20261122undn33)"><\/script>/); // 21/11: DEC-30, la semana que viene; DEC-45, «¿te sirve?»
  // medidor-utilidad.js pasó a 20261121dec45 con «¿te sirve?» en Novedades (DEC-45).
  assert.match(html, /<script defer src="medidor-utilidad\.js\?v=(?:20261121dec45|20261122und|20261122und17|20261122und13|20261122und08|20261122und04|20261122undn33)"><\/script>/);
  ["canonical-reminders.js", "recordatorios-ui.js"].forEach((file) => {
    assert.match(html, new RegExp(`<script defer src="${file.replace(/[./]/g, (c) => `\\${c}`)}\\?v=20261120dec22"></script>`), file);
  });
  // app.js pasó a 20261121dn23 con D-N23 (el acuerdo sustituye a la cuota de hoy desde su mes).
  assert.match(html, /<script defer src="app\.js\?v=(?:20261120dec22|20261121dn23|20261122resize|20261122und11|20261123duo04|20261124duod1)"><\/script>/);
  const novedad = require("../novedades.js").find((entry) => entry.id === "2026-11-20-repaso-desde-calendario");
  assert.ok(novedad, "línea en Novedades");
  assert.match(novedad.texto, /Descargad otra vez los recordatorios/);
  assert.doesNotMatch(novedad.texto, /\d/);
});

// 21/11/2026: el despliegue 1507 falló en Safari porque, al cerrar el repaso abierto desde el enlace, WebKit devolvía el foco al <body>
// (el elemento de antes de abrir el diálogo) después del evento «close». Se repite en la vuelta siguiente si se ha quedado en el <body>.
test("al cerrar el repaso, el foco se repite en la vuelta siguiente si WebKit lo deja en el <body>", () => {
  const repaso = fs.readFileSync(path.join(__dirname, "..", "views/repaso-v2.js"), "utf8");
  assert.match(repaso, /setTimeout\(\(\) => \{\n {6}if \(!dialog\.open && \(!document\.activeElement \|\| document\.activeElement === document\.body\)\) enfocar\(\);\n {4}\}, 0\);/);
});

// 21/11/2026, complementa la anterior: si el enlace abre el repaso antes de que Hoy pinte su entrada, no hay opener y la vuelta
// siguiente tampoco tenía a dónde llevar el foco. El repaso abierto desde el enlace va marcado como «encima de Hoy».
test("DEC-22 · al cerrar el repaso abierto desde el enlace, el foco vuelve a Hoy aunque su entrada no estuviera pintada al abrirlo", () => {
  const repaso = read("views/repaso-v2.js");
  assert.match(repaso, /function repasoV2Open\(opener = null, \{ desdeHoy = false \} = \{\}\)/);
  assert.match(repaso, /const sobreHoy = Boolean\(repasoV2\?\.desdeHoy\);/);
  assert.match(repaso, /const desdeHoy = sobreHoy \|\| Boolean\(opener\?\.hasAttribute\?\.\("data-hoy-v2-repaso"\)\);/);
});
