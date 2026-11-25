// TRE-D3c (decimotercera §2.4; auditoría de diseño §5.2, PR 3): «Comparar con otras formas» en Deuda › Plan nuevo. Cada forma de
// saldar con el mismo formato (cuándo acabáis, cuánto cuesta y qué mide esa cifra, cómo deja la caja) y su «Ver…» a lo de siempre.
// Criterio de hecho: todas las piezas del inventario (§2.6) a dos toques como mucho. Contratos y planes FICTICIOS.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const V = require("../views/deuda-plan-v2.js");

const leer = (f) => fs.readFileSync(path.join(__dirname, "..", f), "utf8");
const texto = (html) => html.replace(/<[^>]+>/g, " ").replace(/ /g, " ").replace(/\s+/g, " ").trim();

const plan = {
  ok: true,
  startMonthKey: "2026-11",
  baseline: { debtFreeMonthKey: "2029-11", totalInterest: 2100 },
  recommended: { strategy: "avalancha", summary: { debtFreeMonthKey: "2027-09", totalInterest: 700 } },
  alternative: { summary: { debtFreeMonthKey: "2027-10", totalInterest: 760 } },
};
const estrategias = {
  avalancha: { libreDeDeuda: "2027-02", costeTotal: 7500, cajaMinima: 3100, viable: true, total: 2, aplicadas: 2, consolidacion: null },
  "bola-nieve": { libreDeDeuda: "2027-04", costeTotal: 7500, cajaMinima: 2900, viable: false, total: 2, aplicadas: 1, consolidacion: null },
  consolidar: { libreDeDeuda: null, costeTotal: 0, cajaMinima: null, viable: false, total: 0, aplicadas: 0, consolidacion: { available: false, motivo: "sin-oferta" } },
};

test("TRE-D3c · las formas, en este orden: el plan, el otro orden, pagar con la caja, un préstamo y solo las cuotas", () => {
  const m = V.compararModelo({ plan, outlook: { segunPlazos: "2029-11" }, estrategias });
  assert.deepEqual(m.filas.map((f) => f.id), ["plan", "otro-orden", "caja-avalancha", "caja-bola-nieve", "consolidar", "solo-cuotas"]);
  const [p, otro, caja, cajaBola, prestamo, cuotas] = m.filas;
  assert.equal(p.destacado, true);
  assert.equal(p.libres, "septiembre de 2027");
  assert.equal(p.intereses, 700);
  assert.equal(otro.nombre, "La más pequeña primero");
  assert.deepEqual(otro.acciones, [{ accion: "orden", valor: "bola-nieve", texto: "Usar este orden" }]);
  assert.equal(cuotas.libres, "noviembre de 2029");
  assert.equal(cuotas.intereses, 2100);
  assert.doesNotMatch(cuotas.detalle, /plazos firmados/, "con la misma fecha, «no tocar nada» y los plazos son una sola fila sin nota");
  // Pagar con la caja: lo que se paga de golpe, nunca como intereses; y cómo deja la caja.
  assert.equal(caja.intereses, null);
  assert.match(caja.cifraNota, /^7500 € de golpe$/);
  assert.match(caja.caja, /La caja baja hasta 3100 € en el peor mes\./);
  assert.match(cajaBola.detalle, /1 de 2 pagos no caben sin dejar la caja en negativo/);
  assert.equal(cajaBola.aviso, true);
  // Qué reserva comprueba la ruta (la operativa, o ninguna) y el aviso si la caja baja de la protegida, la que respeta el plan.
  assert.match(caja.detalle, /sin quedar en negativo \(no hay reserva operativa configurada\)/);
  const conReservas = V.compararModelo({ plan, estrategias, reservaOperativa: 2000, reservaProtegida: 7230 });
  const cajaR = conReservas.filas.find((f) => f.id === "caja-avalancha");
  assert.match(cajaR.detalle, /sin bajar de la reserva operativa \(2000 €\)/);
  assert.match(cajaR.caja, /^La caja baja hasta 3100 € en el peor mes: por debajo de la reserva protegida \(7230 €\), que el plan sí respeta\.$/);
  assert.equal(cajaR.aviso, true);
  assert.equal(V.compararModelo({ plan, estrategias, reservaProtegida: 3000 }).filas.find((f) => f.id === "caja-avalancha").aviso, false);
  // «sin deuda pendiente» del motor es el estado al final de la ruta, no una fecha: se dice el mes del último pago (el fallo de TRE-D0).
  const todo = V.compararModelo({ plan, estrategias: { avalancha: { ...estrategias.avalancha, libreDeDeuda: "sin deuda pendiente", ultimoPago: "2027-02" } } });
  assert.equal(todo.filas.find((f) => f.id === "caja-avalancha").libres, "febrero de 2027");
  const sinMes = V.compararModelo({ plan, estrategias: { avalancha: { ...estrategias.avalancha, libreDeDeuda: "sin deuda pendiente", ultimoPago: null } } });
  assert.equal(sinMes.filas.find((f) => f.id === "caja-avalancha").libres, "dentro del horizonte");
  assert.doesNotMatch(V.compararHtml(todo) + V.compararHtml(sinMes), /sin deuda pendiente/);
  // Sin oferta de préstamo: sin cifras inventadas, y a probar una.
  assert.equal(prestamo.libres, "—");
  assert.deepEqual(prestamo.acciones.map((a) => a.accion), ["prestamo"]);
});

test("TRE-D3c · lo que se dice cuando cambia algo: órdenes que coinciden, plazos firmados que no cuadran, préstamo con oferta", () => {
  const m = V.compararModelo({
    plan,
    coinciden: true,
    outlook: { segunPlazos: "2030-03" },
    estrategias: { ...estrategias, consolidar: { libreDeDeuda: "2031-05", cajaMinima: 2500, total: 1, aplicadas: 1, viable: true, consolidacion: { available: true, intereses: 1900, cuota: 210 } } },
  });
  assert.equal(m.filas.some((f) => f.id === "otro-orden"), false, "si coinciden, no hay «otro orden» que enseñar");
  assert.match(m.filas[0].detalle, /los dos órdenes coinciden/);
  const cuotas = m.filas.find((f) => f.id === "solo-cuotas");
  assert.match(cuotas.detalle, /Según los plazos firmados de cada contrato, marzo de 2030: no cuadran con capital, cuota y TAE/);
  const prestamo = m.filas.find((f) => f.id === "consolidar");
  assert.equal(prestamo.libres, "mayo de 2031");
  assert.equal(prestamo.intereses, 1900);
  assert.equal(prestamo.cifraNota, "del préstamo nuevo");
  assert.match(prestamo.detalle, /una cuota de 210 € al mes/);
  // Con una fecha con sufijo, el mes se traduce y el sufijo se queda.
  const sufijo = V.compararModelo({ plan: { ...plan, recommended: { ...plan.recommended, summary: { debtFreeMonthKey: "2027-09" } } }, estrategias: { avalancha: { ...estrategias.avalancha, libreDeDeuda: "2027-02 · queda deuda fuera" } } });
  assert.equal(sufijo.filas.find((f) => f.id === "caja-avalancha").libres, "febrero de 2027 · queda deuda fuera");
});

test("TRE-D3c · el pintado: cada fila con «Libres en» y su cifra con lo que mide; sin plan calculable lo dice", () => {
  const html = V.compararHtml(V.compararModelo({ plan, estrategias }));
  assert.match(texto(html), /El plan, con lo elegido .* Libres en septiembre de 2027 700 € de intereses Ajustar el plan/);
  assert.match(texto(html), /Pagar de golpe con la caja, la más cara primero .* 7500 € de golpe sin intereses comparables Ver la ruta Guardar como escenario/);
  assert.match(html, /class="dpv2-cmp-fila is-plan"/);
  // El préstamo sin oferta: sin «Libres en —» ni «— sin cifra».
  const sinOferta = html.slice(html.indexOf('data-dpv2-cmp-fila="consolidar"'));
  assert.doesNotMatch(sinOferta.slice(0, sinOferta.indexOf("</li>")), /Libres en|sin cifra/);
  assert.match(html, /data-dpv2-cmp="ruta" data-dpv2-cmp-valor="avalancha"/);
  assert.doesNotMatch(html, /<input|<select/, "comparar no tiene controles: no cambia nada");
  assert.match(V.compararHtml(V.compararModelo({ plan: { ok: true, sinDatos: true } })), /no hay formas que comparar/);
});

test("TRE-D3c · cableado: el acceso abre su panel, cada «Ver…» lleva a lo de siempre y se mide", () => {
  const js = leer("views/deuda-plan-v2.js");
  assert.match(js, /else if \(accion === "comparar"\) abrirComparar\(\);/);
  assert.match(js, /accion === "ruta"[\s\S]{0,200}irAlDetalle\("\.deuda-ruta-layout"\)/);
  assert.match(js, /accion === "camino"\) irAlDetalle\("#caminoDeudaCard"\)/);
  assert.match(js, /accion === "prestamo"\) root\.location\.hash = "deuda-prestamo"/);
  assert.match(js, /handleDeudaCompararGuardarComoEscenario\(valor\)/, "guardar como escenario es el de siempre (no aplica nada)");
  assert.equal((js.match(/cerrarPanelesSiAbiertos\(\);/g) || []).length, 3);
  assert.match(leer("index.html"), /<dialog class="dpv2-ajustar dpv2-comparar" id="deudaPlanV2Comparar" aria-labelledby="dpv2CompararTitulo"><\/dialog>/);
  assert.match(leer("medidor-utilidad.js"), /id: "deuda-comparar", nombre: "Comparar con otras formas"/);
  assert.match(leer("funciones-en-prueba.js"), /id: "deuda-comparar", nombre: "Comparar con otras formas"/);
  const css = leer("tema-v2.css");
  const bloque = css.slice(css.indexOf("TRE-D3c · «Comparar con otras formas»"));
  bloque.split("\n").filter((l) => /^\s*[.#:a-z][^{]*\{\s*$/.test(l)).forEach((l) => assert.match(l, /:root\[data-tema="v2"\]/, l));
});
