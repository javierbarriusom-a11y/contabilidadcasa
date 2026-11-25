// TRE-D5a (decimotercera §2.5b; auditoría de diseño §5.2, PR 5): Deuda › Ofertas como bandeja con su veredicto frente al plan, de tres
// fuentes y sin migrar nada. Contratos FICTICIOS.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const O = require("../canonical-debt-offers.js");
const Plan = require("../canonical-debt-optimal-plan.js");
const Path = require("../canonical-debt-payoff-path.js");
const V = require("../views/deuda-ofertas-v2.js");

const leer = (f) => fs.readFileSync(path.join(__dirname, "..", f), "utf8");
const texto = (h) => h.replace(/<[^>]+>/g, " ").replace(/ /g, " ").replace(/\s+/g, " ").trim();

const contratos = [
  { id: "t", entity: "Banco FICTICIO", label: "Banco FICTICIO Tarjeta", type: "Tarjeta revolving", paymentStatus: "active", currentPrincipal: 2400, currentPayment: 90, apr: 21.9 },
  { id: "p", entity: "Caja FICTICIA", label: "Caja FICTICIA Préstamo", type: "Préstamo", paymentStatus: "active", currentPrincipal: 5100, currentPayment: 160, apr: 9.5 },
];
const opciones = { startMonthKey: "2026-12", monthly: 200 };

test("TRE-D5a · tres fuentes y una sola verdad: lo de aquí, las quitas del plan y la reunificación de siempre (sin migrar nada)", () => {
  const l = V.fuentes({
    guardadas: [{ id: "a", tipo: "traspaso", contratoId: "t", entidad: "Entidad FICTICIA", meses: 12, taeDespues: 18, comisionPct: 3, vence: "2026-12-15" }, { id: "b", tipo: "quita", contratoId: "p", importe: 4000, estado: "rechazada", decididaEl: "2026-11-03" }],
    quitasPlan: [{ id: "t", amount: 1900 }],
    reunificacion: { tin: 7.9, plazo: 48, comision: 150, expiresAt: "" },
    contratos,
    hoy: "2026-11-25",
  });
  assert.deepEqual(l.map((o) => `${o.id}:${o.tipo}:${o.estado}:${o.origen}`), ["a:traspaso:abierta:aqui", "b:quita:rechazada:aqui", "plan-quita-t:quita:en-plan:plan", "reunificacion-de-siempre:reunificacion:abierta:siempre"]);
  assert.equal(l[0].dias, 20);
  assert.equal(l[1].entidad, "Caja FICTICIA", "sin entidad escrita, la de la deuda");
  // Una quita escrita aquí para la misma deuda manda sobre la del plan (no se enseña dos veces).
  const dos = V.fuentes({ guardadas: [{ id: "q", tipo: "quita", contratoId: "t", importe: 1800 }], quitasPlan: [{ id: "t", amount: 1900 }], contratos, hoy: "2026-11-25" });
  assert.deepEqual(dos.map((o) => o.id), ["q"]);
});

test("TRE-D5a · cada tarjeta: sus condiciones, el veredicto con sus tres líneas y la letra pequeña; acciones según lo que el plan puede representar", () => {
  const o = { id: "a", tipo: "traspaso", contratoId: "t", entidad: "Entidad FICTICIA", meses: 12, taeDespues: 18, comisionPct: 3, vence: "2026-12-15", estado: "abierta", origen: "aqui", dias: 20 };
  const v = O.veredicto(o, { Plan, Path, contratos, opciones });
  const h = V.tarjetaHtml({ o, v, c: V.condiciones(o, contratos) });
  assert.match(texto(h), /^Traspaso al 0 % Vence en 20 días Entidad FICTICIA · traspaso Para la deuda de Banco FICTICIO \(2400 €\) 0 % durante 12 meses; después, 18 % TAE Comisión del traspaso: 3 % \(72 €\), una vez Os compensa: \d+ € menos Libres en .* Intereses y comisiones \d+ € frente a \d+ €/);
  assert.match(h, /data-tono="aviso">Vence en 20 días/, "a menos de 30 días, en ámbar");
  assert.match(h, /La letra pequeña<\/summary><p>Al acabar los meses al 0 %/);
  assert.match(h, /data-dov2-accion="contrato"/, "un traspaso se apunta en el contrato cuando se acepta");
  assert.match(h, /data-dov2-accion="rechazar"/);
  assert.match(h, /data-kit-entidad="t">Contraoferta/);
  // Una quita: «Meterla en el plan» y la frase de juntarla o pagarla de golpe; la titular, la de la mejor forma.
  const q = { id: "q", tipo: "quita", contratoId: "t", importe: 1900, estado: "abierta", origen: "aqui" };
  const vq = O.veredicto(q, { Plan, Path, contratos, opciones, disponible: 2850 });
  const hq = V.tarjetaHtml({ o: q, v: vq, c: V.condiciones(q, contratos) });
  assert.match(hq, /data-dov2-accion="plan"/);
  assert.match(texto(hq), /Os compensa: \d+ € menos pagándola de golpe/);
  assert.match(texto(hq), /Juntándola con lo de cada mes no compensa/);
  assert.match(texto(hq), /Os perdonan \d+ €/, "lo perdonado, aparte: nunca un coste negativo");
  assert.doesNotMatch(texto(hq), /−|-\d+ €/);
  // Una reunificación se guarda como escenario (el de siempre); una quita ya en el plan se puede sacar.
  const r = { id: "reunificacion-de-siempre", tipo: "reunificacion", tin: 7.9, plazo: 48, comision: 150, estado: "abierta", origen: "siempre" };
  assert.match(V.tarjetaHtml({ o: r, v: O.veredicto(r, { Plan, Path, contratos, opciones }), c: V.condiciones(r, contratos) }), /data-dov2-accion="escenario"/);
  const enPlan = { id: "plan-quita-t", tipo: "quita", contratoId: "t", importe: 1900, estado: "en-plan", origen: "plan" };
  const hp = V.tarjetaHtml({ o: enPlan, v: O.veredicto(enPlan, { Plan, Path, contratos, opciones }), c: V.condiciones(enPlan, contratos) });
  assert.match(hp, /En vuestro plan/);
  assert.match(hp, /data-dov2-accion="sacar"/);
  assert.doesNotMatch(hp, /data-dov2-accion="plan"/);
});

test("TRE-D5a · la línea de arriba, qué podéis pedir y la vista entera", () => {
  const o = { id: "a", tipo: "traspaso", contratoId: "t", entidad: "Entidad FICTICIA", meses: 12, taeDespues: 18, comisionPct: 3, vence: "2026-12-15", estado: "abierta", origen: "aqui", dias: 20 };
  const abiertas = [{ o, v: O.veredicto(o, { Plan, Path, contratos, opciones }), c: V.condiciones(o, contratos) }];
  assert.match(texto(V.resumen(abiertas)), /^1 abierta\. La que más os ahorra: traspaso al 0 % de Entidad FICTICIA, \d+ € menos que vuestro plan ?\. Vence el 15 de diciembre \(en 20 días\)\.$/);
  const p = V.pedir(contratos, { comisiones: { p: { pct: 1 } }, esRevolving: (t) => /revolving/i.test(t) });
  assert.deepEqual(p.map((x) => x.titulo), ["Banco FICTICIO · tarjeta al 21,9 %", "Caja FICTICIA · comisión del 1 %", "Si un mes no llegáis"]);
  assert.match(p[0].texto, /indicio de usura/);
  const h = V.html({ abiertas, resumen: V.resumen(abiertas), pedir: p, historial: [{ tipo: "quita", entidad: "Banco FICTICIO", estado: "rechazada", decididaEl: "2026-11-03" }] });
  assert.match(texto(h), /^Ofertas Lo que os ofrecen las entidades o podéis pedirles, medido contra vuestro plan\. Nada se acepta solo\. \+ Añadir una oferta 1 abierta\./);
  assert.match(h, /Qué podéis pedir/);
  assert.match(h, /data-dov2-ir="deuda-simulador"/);
  assert.match(h, /data-dov2-ir="deuda-prestamo"/);
  assert.match(texto(h), /Historial 1 rechazada o vencida: quita de Banco FICTICIO, 3 de noviembre/);
  assert.match(h, /data-dov2="detalle"/);
  assert.match(texto(V.html({ abiertas: [], resumen: "", pedir: p, historial: [] })), /Ahora no tenéis ofertas abiertas/);
});

test("TRE-D5a · «Añadir una oferta»: el tipo en fichas y solo sus campos; lo escrito se convierte en oferta", () => {
  const h = V.anadirHtml("reunificacion", contratos);
  assert.equal((h.match(/name="dov2Tipo"/g) || []).length, 3);
  assert.match(h, /value="reunificacion" checked/);
  assert.deepEqual([...h.matchAll(/data-dov2-campo="([^"]+)"/g)].map((x) => x[1]), ["entidad", "tin", "plazo", "comision", "vence"]);
  assert.match(h, /id="dov2AnadirVista"/);
  assert.deepEqual(V.ofertaDeCampos("traspaso", { contratoId: "t", entidad: " X ", meses: "12", taeDespues: "18,5", comisionPct: "", vence: "2026-12-15" }), { tipo: "traspaso", contratoId: "t", entidad: "X", meses: 12, taeDespues: 18.5, comisionPct: null, vence: "2026-12-15" });
});

test("TRE-D5a · cableado: la bandeja, el diálogo, el almacén en la copia, el modo y lo medido", () => {
  const html = leer("index.html");
  assert.match(html, /<div class="dov2" id="deudaOfertasV2" hidden><\/div>/);
  assert.match(html, /<dialog class="dpv2-ajustar dov2-anadir" id="deudaOfertaAnadir" aria-labelledby="dov2AnadirTitulo"><\/dialog>/);
  assert.match(html, /<script defer src="canonical-debt-offers\.js\?v=20261125tred5"><\/script>\s*<script defer src="views\/deuda-ofertas-v2\.js\?v=20261125tred5"><\/script>/);
  for (const f of ["tools/build-public-site.mjs", "service-worker.js"]) {
    assert.match(leer(f), /canonical-debt-offers\.js/, f);
    assert.match(leer(f), /views\/deuda-ofertas-v2\.js/, f);
  }
  assert.match(leer("views/deuda.js"), /globalThis\.renderDeudaOfertasV2\?\.\(\); \/\/ TRE-D5a/);
  assert.match(require("./helpers/codigo-app.cjs").codigoApp(), /"deuda-ofertas", \/\/ TRE-D5a/, "viaja en la copia");
  assert.equal(V.MODO_KEY, "deuda-ofertas-v2-modo");
  assert.match(leer("camino-deuda-ui.js"), /return \{ r, liquidez, modo, ofertas, comunes, fijoMensual, colchon, opciones \};/, "el veredicto usa las mismas opciones que el plan");
  assert.match(leer("medidor-utilidad.js"), /id: "deuda-ofertas-v2", nombre: "Ofertas nuevas"/);
  assert.match(leer("funciones-en-prueba.js"), /id: "deuda-ofertas-v2", nombre: "Ofertas nuevas"/);
  const css = leer("tema-v2.css");
  const bloque = css.slice(css.indexOf("TRE-D5a · Deuda › Ofertas como bandeja"));
  bloque.split("\n").filter((l) => /^\s*[.#:a-z][^{]*\{\s*$/.test(l)).forEach((l) => assert.match(l, /:root\[data-tema="v2"\]/, l));
});
