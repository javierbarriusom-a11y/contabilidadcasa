// UND-08 (undécima auditoría; DEC-31, 22/11/2026): «¿Me lo puedo permitir?» desde Hoy. Con la previsión diaria y el suelo de Hoy, un
// importe y una fecha dan «sí», «sí, pero justo» o «no sin mover algo» con dos opciones. Previsiones inventadas.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const P = require("../me-lo-puedo-permitir.js");

const read = (file) => fs.readFileSync(path.join(__dirname, "..", file), "utf8");

// 60 días desde el 1/12: 3.000 € y bajando 40 € al día hasta el cobro del 28/12 (+2.000 €).
function prevision() {
  const puntos = [];
  let saldo = 3000;
  for (let i = 0; i < 60; i += 1) {
    const date = P.sumarDias("2026-12-01", i);
    if (date === "2026-12-28") saldo += 2000;
    puntos.push({ date, value: saldo });
    saldo -= 40;
  }
  return puntos;
}
const base = { puntos: prevision(), suelo: 1500, cobro: "2026-12-28" };

test("UND-08 · sí con margen, sí pero justo y no; el día más justo es el último antes del cobro", () => {
  const si = P.responder({ ...base, importe: 100, fecha: "2026-12-05" });
  assert.equal(si.estado, "si");
  assert.equal(si.diaMasJusto, "2026-12-27");
  assert.equal(si.margen, 3000 - 40 * 26 - 100 - 1500);
  const justo = P.responder({ ...base, importe: 400, fecha: "2026-12-05" });
  assert.equal(justo.estado, "justo");
  assert.ok(justo.margen >= 0 && justo.margen < P.MARGEN_JUSTO);
  const no = P.responder({ ...base, importe: 600, fecha: "2026-12-05" });
  assert.equal(no.estado, "no");
  assert.equal(no.falta, 600 - (3000 - 40 * 26 - 1500));
});

test("UND-08 · el «no» trae dos opciones calculadas: esperar al cobro (si entonces cabe) y lo que cabe en esa fecha", () => {
  const no = P.responder({ ...base, importe: 600, fecha: "2026-12-05" });
  const esperar = no.opciones.find((o) => o.id === "esperar-cobro");
  assert.equal(esperar.fecha, "2026-12-28");
  assert.ok(esperar.margen >= 0);
  const menos = no.opciones.find((o) => o.id === "menos");
  assert.equal(menos.importe, Math.floor((600 - no.falta) / 10) * 10);
  assert.equal(P.responder({ ...base, importe: 600, fecha: "2026-12-05", cobro: null }).opciones.some((o) => o.id === "esperar-cobro"), false, "sin cobro conocido, no se propone esperar");
});

test("UND-08 · si sin el gasto ya se baja del suelo, lo dice; sin datos, sin importe o fuera de la previsión, también", () => {
  const ya = P.responder({ ...base, suelo: 2000, importe: 50, fecha: "2026-12-05" });
  assert.equal(ya.estado, "ya-bajo");
  assert.ok(ya.faltaSinGasto > 0);
  assert.equal(P.responder({ ...base, importe: 0 }).estado, "sin-importe");
  assert.equal(P.responder({ puntos: [], suelo: 0, importe: 50 }).estado, "sin-datos");
  assert.equal(P.responder({ ...base, importe: 50, fecha: "2027-06-01" }).estado, "fuera");
  assert.equal(P.responder({ ...base, importe: 50, fecha: "2026-11-01" }).fecha, "2026-12-01", "una fecha pasada es hoy");
});

test("UND-08 · en Hoy desde el 14/12 (un cambio de Hoy por semana), con su hoja, su medidor y sin guardar nada", () => {
  const hoy = read("views/hoy-v2.js");
  assert.match(hoy, /const HOY_V2_PERMITIR_DESDE = "2026-12-14";/);
  assert.match(hoy, /\$\{hoyV2Hero\(\{ \.\.\.model, asOf, hoy, coverage \}\)\}\n {8}\$\{hoyV2PermitirHtml\(hoy\)\}/);
  const html = read("index.html");
  assert.match(html, /<dialog class="action-review-dialog permitir-dialog" id="permitirDialog" aria-labelledby="permitirTitulo">/);
  assert.match(html, /<p class="permitir-respuesta" id="permitirRespuesta" role="status" aria-live="polite"><\/p>/);
  assert.match(html, /<script defer src="me-lo-puedo-permitir\.js\?v=20261122und08"><\/script>/);
  assert.match(read("tools/build-public-site.mjs"), /^ {2}"me-lo-puedo-permitir\.js",$/m);
  assert.match(read("service-worker.js"), /^ {2}"\.\/me-lo-puedo-permitir\.js",$/m);
  assert.match(read("medidor-utilidad.js"), /\{ id: "me-lo-permito", nombre: "¿Me lo puedo permitir\?"/);
  const js = read("me-lo-puedo-permitir.js");
  assert.doesNotMatch(js, /storageSet|localStorage|sessionStorage/, "no guarda nada");
});
