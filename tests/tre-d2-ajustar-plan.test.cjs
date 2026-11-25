// TRE-D2 (decimotercera auditoría §2.3; auditoría de diseño §5.2, PR 2): «Ajustar el plan» en un panel (lateral en el escritorio, hoja
// en el móvil) con los controles del plan óptimo de siempre, agrupados, y una vista previa con la fecha y el ahorro de lo que se toca.
// Criterio de hecho: un solo control de «al mes» en la vista y DUO-01 sin excepciones nuevas. Contratos y planes FICTICIOS.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const V = require("../views/deuda-plan-v2.js");
const Efecto = require("./helpers/efecto-controles.cjs");

const raiz = path.join(__dirname, "..");
const leer = (f) => fs.readFileSync(path.join(raiz, f), "utf8");

const plan = (extra = {}) => ({
  ok: true,
  startMonthKey: "2026-11",
  baseline: { debtFreeMonthKey: "2029-11", totalInterest: 2100 },
  recommended: { strategy: "avalancha", summary: { debtFreeMonthKey: "2028-01", totalInterest: 900, interestSaved: 1200, ...extra.summary } },
  alternative: { summary: { debtFreeMonthKey: "2028-03", totalInterest: 980 } },
  warnings: extra.warnings || [],
});

test("TRE-D2 · la vista previa da la fecha y el ahorro con estos ajustes, y la del plan guardado si es otra", () => {
  const sin = V.ajustarModelo({ plan: plan(), outlook: { fuente: "plan-optimo", libreDeDeuda: "2028-01" } });
  assert.equal(sin.ok, true);
  assert.equal(V.ajustarVistaHtml(sin).replace(/<[^>]+>/g, "").replace(/ /g, " "), "Con estos ajustes, libres en enero de 2028 · os ahorráis 1200 €.");
  assert.equal(sin.guardar, "Este es nuestro plan", "sin plan guardado, se puede guardar desde el panel");
  // Con plan guardado (la fecha única es la guardada): la vista previa sigue a los controles y nombra la guardada.
  const con = V.ajustarModelo({ plan: plan(), outlook: { fuente: "plan-guardado", libreDeDeuda: "2028-06" } });
  assert.equal(con.difiere, true);
  assert.match(V.ajustarVistaHtml(con), /libres en <strong>enero de 2028<\/strong>.*Vuestro plan guardado: junio de 2028\./);
  assert.equal(con.guardar, "Guardar estos ajustes como nuestro plan");
  const igual = V.ajustarModelo({ plan: plan(), outlook: { fuente: "plan-guardado", libreDeDeuda: "2028-01" } });
  assert.equal(igual.guardar, null, "con la misma fecha no hay nada que sustituir");
  assert.doesNotMatch(V.ajustarVistaHtml(igual), /plan guardado/);
});

test("TRE-D2 · cada grupo dice lo suyo: el orden con los dos resultados (o que coinciden), y lo que cambia el coste", () => {
  const a = V.ajustarModelo({ plan: plan() });
  assert.match(a.orden, /^La más cara primero \(el que usa el plan\): libres en enero de 2028, 900 € de intereses\. La más pequeña primero: marzo de 2028, 980 € de intereses\.$/);
  const c = V.ajustarModelo({ plan: plan(), coinciden: true });
  assert.match(c.orden, /los dos órdenes coinciden/, "la misma frase que espera DUO-01 (COINCIDEN)");
  const coste = V.ajustarModelo({
    plan: plan({
      summary: { forgiven: 600, commissionCost: 45 },
      warnings: [
        { id: "comision-quita", label: "Banco FICTICIO Tarjeta" },
        { id: "promocion", label: "Caja FICTICIA Préstamo", hasta: "2027-03", saldada: false, saldoAlAcabar: 800 },
      ],
    }),
  });
  assert.match(coste.coste, /Con las quitas os perdonan 600 €\./);
  assert.match(coste.coste, /Las comisiones por amortizar antes suman 45 €/);
  assert.match(coste.coste, /La comisión de Banco FICTICIO Tarjeta no cuenta: el plan la cancela con la quita/, "lo que espera DUO-01 de la comisión");
  assert.match(coste.coste, /al acabar su promoción al 0 % \(marzo de 2027\) quedarán 800 €/);
  assert.match(V.ajustarModelo({ plan: plan(), modo: "fijo", fijo: 350 }).mes, /^350 € al mes además de las cuotas/);
  assert.match(V.ajustarModelo({ plan: plan() }).mes, /lo que deje la previsión sin bajar del suelo/);
});

test("TRE-D2 · sin plan calculable, el panel lo dice y no inventa una fecha", () => {
  const a = V.ajustarModelo({ plan: { ok: true, sinDatos: true } });
  assert.equal(a.ok, false);
  assert.match(V.ajustarVistaHtml(a), /no se puede calcular el plan/);
  assert.match(V.ajustarVistaHtml(V.ajustarModelo({ plan: { ok: false, error: "Escribe un importe válido." } })), /Escribe un importe válido\./);
});

test("TRE-D2 · el panel presta los controles de siempre (mismos ids) y un solo control de «al mes»", () => {
  const chrome = V.ajustarChromeHtml();
  for (const hueco of ["nota", "mes", "orden", "colchon", "coste"]) assert.match(chrome, new RegExp(`data-dpv2-hueco="${hueco}"`));
  assert.deepEqual(Object.values(V.AJ_SITIOS).flat().sort(), ["@planOptimoMensual", "planOptimoColchonGrupo", "planOptimoComisiones", "planOptimoModo", "planOptimoNota", "planOptimoOrden", "planOptimoMargen", "planOptimoQuitas"].sort());
  // No crea campos propios: ni un input en el marco del panel; los pasos de 50 € son botones que escriben en el campo de siempre.
  assert.doesNotMatch(chrome, /<input|<select|<textarea/);
  assert.match(chrome, /data-dpv2-aj="menos"[^>]*>− 50 €/);
  assert.match(chrome, /data-dpv2-aj="mas"[^>]*>\+ 50 €/);
  assert.match(chrome, /Restablecer lo recomendado/);
  const html = leer("index.html");
  // Fuera de #deuda-ruta (lo de siempre se oculta con la vista nueva) y fuera de #deudaPlanV2 (que se repinta con innerHTML).
  const dialogo = html.indexOf('id="deudaPlanV2Ajustar"');
  assert.ok(dialogo > html.indexOf('id="deudaPrestamoScreenTabs"'), "el diálogo está con los demás diálogos, fuera de las secciones");
  assert.match(html, /<dialog class="dpv2-ajustar" id="deudaPlanV2Ajustar" aria-labelledby="dpv2AjustarTitulo"><\/dialog>/);
  const js = leer("views/deuda-plan-v2.js");
  assert.match(js, /else if \(accion === "ajustar"\) abrirAjustar\(\);/);
  assert.match(js, /hueco\.replaceWith\(nodo\)/, "al cerrar, cada control vuelve a su sitio");
  assert.match(js, /dialog\.addEventListener\("close", alCerrarAjustar\)/);
  // Desde el repintado (lo de siempre, otro tema, sin deudas) se devuelven ya, sin esperar al «close».
  assert.equal((js.match(/cerrarPanelesSiAbiertos\(\);/g) || []).length, 3);
  // «Este es nuestro plan» va junto a la vista previa (lo que guarda), y el pie cabe en una fila: restablecer y «Listo».
  assert.ok(chrome.indexOf('data-dpv2-aj="guardar"') < chrome.indexOf('data-dpv2-hueco="nota"'));
  assert.match(chrome, /<div class="dpv2-aj-pie">\s*<button[^>]*data-dpv2-aj="restablecer"[^>]*>[^<]*<\/button>\s*<button[^>]*data-dpv2-aj="cerrar"[^>]*>Listo<\/button>\s*<\/div>/);
  // El resumen del acceso lee el importe que usa el plan (el campo), no la variable, que es null hasta que se escribe uno (salía «0 € al mes»).
  assert.match(js, /const fijo = Number\(String\(qs\("planOptimoMensual"\)\?\.value \|\| ""\)/);
});

test("TRE-D2 · estilos del tema v2, el patrón de Clasificar y lo medido", () => {
  const css = leer("tema-v2.css");
  const bloque = css.slice(css.indexOf("TRE-D2 · «Ajustar el plan»"));
  assert.ok(bloque.length > 100);
  bloque.split("\n").filter((l) => /^\s*[.#:a-z][^{]*\{\s*$/.test(l) && !/^\s*@media/.test(l)).forEach((l) => assert.match(l, /:root\[data-tema="v2"\]/, l));
  assert.match(bloque, /dialog\.dpv2-ajustar \{\n  position: fixed;\n  inset: auto 0 0 0;/, "hoja inferior en el móvil");
  assert.match(bloque, /@media \(min-width: 1024px\) \{\n  :root\[data-tema="v2"\] dialog\.dpv2-ajustar \{\n    inset: 0 0 0 auto;\n    width: 440px;/, "panel derecho en el escritorio");
  assert.match(bloque, /\[data-modo="prevision"\] label:has\(#planOptimoMensual\)/, "el importe solo con «Un importe fijo»");
  assert.match(leer("medidor-utilidad.js"), /id: "deuda-ajustar", nombre: "Ajustar el plan"/);
  assert.match(leer("funciones-en-prueba.js"), /id: "deuda-ajustar", nombre: "Ajustar el plan"/);
  assert.match(leer("index.html"), /views\/deuda-plan-v2\.js\?v=20261125tre(?:d2|3c)/);
});

test("TRE-D2 · DUO-01: el panel es una pantalla del censo, con sus efectos y sin excepciones nuevas", () => {
  const p = Efecto.PANTALLAS.find((x) => x.nombre === "Deuda › Ajustar el plan");
  assert.ok(p, "pantalla del censo");
  assert.equal(p.raiz, "#deudaPlanV2Ajustar");
  assert.equal(Efecto.EXCEPCIONES.filter((x) => x.pantalla === p.nombre).length, 0);
  const efectos = Efecto.EFECTOS.filter((x) => x.pantalla === p.nombre);
  for (const clave of ["#planOptimoMensual", "radio:planOptimoModo=prevision", "radio:planOptimoModo=fijo", "#planOptimoPago", "input[data-plan-optimo-quita]",
    "input[data-plan-optimo-comision]", "#planOptimoColchonUmbral", "#planOptimoColchon", "radio:planOptimoOrden=bola-nieve", "radio:planOptimoOrden=avalancha",
    "#planOptimoMargenPct", "#planOptimoMargenAbs"]) {
    assert.ok(efectos.some((e) => Efecto.coincide(clave, e.clave)), `${clave} sin efecto en el panel`);
  }
  // Lo que se observa es lo que ve el hogar en el panel, nunca el resultado de siempre (oculto con la vista nueva).
  efectos.forEach((e) => assert.doesNotMatch(e.observa, /planOptimoResultado/, e.nombre));
});
