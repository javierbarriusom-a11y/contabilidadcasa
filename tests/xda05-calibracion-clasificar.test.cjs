const test = require("node:test");
const assert = require("node:assert/strict");
const medidor = require("../medidor-utilidad.js");

// XDA-05 · PR-1: la calibración de Clasificar en el medidor (XGO-02). Por grupo aceptado, su confianza, si se aceptó la
// propuesta tal cual, los segundos y si se deshizo; sin conceptos ni importes. De ahí la puerta del PR-2 (aceptar en
// bloque los de confianza alta): 20 grupos de alta o más con el 95 % o más tal cual. El cableado en la pantalla se prueba
// en redis-a5-clasificar.test.cjs y el recorrido en el navegador en qa1 («XDA-05 · Calibración de Clasificar»).

const HOY = "2026-10-26";
const anota = (store, lista) => lista.reduce((s, [confianza, talCual, segundos = 5, hoy = HOY]) => medidor.registrarClasificacion(s, { confianza, talCual, segundos, hoy }), store);
const altas = (n, bien) => Array.from({ length: n }, (_, k) => ["alta", k < bien]);

test("cada grupo aceptado guarda su confianza, si fue tal cual, los segundos y un número; nada del concepto ni del importe", () => {
  const store = anota(null, [["alta", true, 3.24], ["media", false, 12], ["sin", true, 700], ["rara", true, -1]]);
  assert.deepEqual(JSON.parse(JSON.stringify(store.calibracion)), [
    { i: 1, m: "2026-10", c: "alta", t: true, x: false, s: 3.2 },
    { i: 2, m: "2026-10", c: "media", t: false, x: false, s: 12 },
    { i: 3, m: "2026-10", c: "sin", t: false, x: false, s: 600 },
    { i: 4, m: "2026-10", c: "sin", t: false, x: false, s: null },
  ]);
  assert.deepEqual(Object.keys(store.calibracion[0]).sort(), ["c", "i", "m", "s", "t", "x"]);
});

test("lo guardado mal formado se descarta al leer; como mucho se guardan los 300 últimos", () => {
  const limpio = medidor.normalize({ calibracion: [{ i: 1, m: "2026-10", c: "alta", t: true }, { i: "2", m: "2026-10", c: "alta" }, { i: 3, m: "oct", c: "alta" }, { i: 4, m: "2026-10", c: "otra" }, null, { i: 5, m: "2026-10", c: "sin", t: true, s: "9" }] });
  assert.deepEqual(JSON.parse(JSON.stringify(limpio.calibracion)), [
    { i: 1, m: "2026-10", c: "alta", t: true, x: false, s: null },
    { i: 5, m: "2026-10", c: "sin", t: false, x: false, s: null },
  ]);
  const lleno = anota(null, altas(305, 305));
  assert.equal(lleno.calibracion.length, 300);
  assert.equal(lleno.calibracion[0].i, 6);
  assert.equal(medidor.registrarClasificacion(lleno, { confianza: "baja" }).calibracion.at(-1).i, 306, "el número sigue aunque se recorte");
});

test("tal cual: en total y por confianza, sin contar los grupos sin propuesta; deshacer cuenta como corregida", () => {
  let store = anota(null, [["alta", true], ["alta", true], ["media", true], ["media", false], ["baja", false], ["sin", false]]);
  let k = medidor.calibracion(store);
  assert.deepEqual([k.registros, k.grupos, k.talCual, k.pct, k.sinPropuesta, k.deshechos], [6, 5, 3, 60, 1, 0]);
  assert.deepEqual(JSON.parse(JSON.stringify(k.porConfianza)), { alta: { grupos: 2, talCual: 2, pct: 100 }, media: { grupos: 2, talCual: 1, pct: 50 }, baja: { grupos: 1, talCual: 0, pct: 0 } });
  store = medidor.corregirClasificacion(store, 1);
  k = medidor.calibracion(store);
  assert.deepEqual([k.talCual, k.pct, k.deshechos, k.porConfianza.alta.pct], [2, 40, 1, 50]);
});

test("los porcentajes, por lo bajo: 18 de 19 (94,7 %) se enseña como 94, no como 95", () => {
  const k = medidor.calibracion(anota(null, altas(19, 18)));
  assert.equal(k.pct, 94);
});

test("segundos por grupo: mediana de los medidos (los grupos sin tiempo no cuentan)", () => {
  const k = medidor.calibracion(anota(null, [["alta", true, 2], ["alta", true, 30], ["media", true, 4], ["sin", false, null]]));
  assert.deepEqual([k.medianaSegundos, k.veces], [4, 3]);
});

test("puerta del PR-2: 20 grupos de alta o más y el 95 % o más tal cual (contados sin redondeo); siempre con todo lo guardado", () => {
  assert.deepEqual(JSON.parse(JSON.stringify(medidor.calibracion(anota(null, altas(19, 19))).puerta)), { grupos: 19, pct: 100, faltan: 1, cumple: false });
  assert.equal(medidor.calibracion(anota(null, altas(20, 19))).puerta.cumple, true, "19 de 20 es el 95 %");
  assert.equal(medidor.calibracion(anota(null, altas(20, 18))).puerta.cumple, false);
  assert.equal(medidor.calibracion(anota(null, altas(40, 37))).puerta.cumple, false, "92,5 % no llega");
  let store = anota(null, altas(20, 20));
  store = medidor.corregirClasificacion(medidor.corregirClasificacion(store, 1), 2);
  assert.equal(medidor.calibracion(store).puerta.cumple, false, "dos deshechas dejan 18 de 20");
  const dosMeses = anota(anota(null, altas(12, 12).map((e) => [...e, 5, "2026-10-26"])), altas(8, 8).map((e) => [...e, 5, "2026-11-03"]));
  const nov = medidor.calibracion(dosMeses, "2026-11");
  assert.equal(nov.grupos, 8, "el resto, del mes elegido");
  assert.equal(nov.puerta.grupos, 20, "la puerta, de todo");
  assert.equal(nov.puerta.cumple, true);
  assert.deepEqual([medidor.PUERTA_GRUPOS, medidor.PUERTA_PCT], [20, 95]);
});

test("la frase de Clasificar suma la calibración al final de lo de siempre", () => {
  let store = medidor.registrar(null, "clasificar-v2", "vista", { hoy: HOY });
  store = medidor.registrar(store, "clasificar-v2", "accion", { hoy: HOY });
  assert.equal(medidor.frase("clasificar-v2", medidor.resumen(store, "clasificar-v2")), "vista 1 día · 1 regla aceptada (actuasteis el 100 % de los días) · 0 grupos saltados · 0 reglas deshechas", "sin calibración, como antes");
  store = anota(store, [["alta", true, 3], ["media", false, 7], ["sin", false, 20]]);
  assert.equal(
    medidor.frase("clasificar-v2", medidor.resumen(store, "clasificar-v2")),
    "vista 1 día · 1 regla aceptada (actuasteis el 100 % de los días) · 0 grupos saltados · 0 reglas deshechas · 50 % de las propuestas aceptadas tal cual (1 de 2; alta 100 % de 1, media 0 % de 1) · 1 grupo sin propuesta · 7 s por grupo (mediana de 3; objetivo 4 s)",
  );
  const lista = medidor.registrar(anota(null, altas(20, 20)), "clasificar-v2", "vista", { hoy: HOY });
  assert.match(medidor.frase("clasificar-v2", medidor.resumen(lista, "clasificar-v2")), /100 % de las propuestas aceptadas tal cual \(20 de 20\) · 5 s por grupo \(mediana de 20; objetivo 4 s\)$/); // la puerta ya no se enseña (el hogar retiró aceptar en bloque, 13/11)
  const corta = medidor.registrar(anota(null, altas(20, 18)), "clasificar-v2", "vista", { hoy: HOY });
  assert.doesNotMatch(medidor.frase("clasificar-v2", medidor.resumen(corta, "clasificar-v2")), /aceptar en bloque/, "la puerta se calcula, pero ya no se enseña");
  assert.equal(medidor.calibracion(anota(null, altas(20, 18))).puerta.cumple, false, "y se sigue calculando, por si se retoma");
  assert.equal(medidor.resumen(store, "hoy-v2").calibracion, undefined, "solo Clasificar la lleva");
});

// XDA-05 (14/11/2026): el tipo de cada grupo sin propuesta, para saber qué señal le falta a la propuesta. En noviembre,
// 5 de 7 grupos se aceptaron sin propuesta y no había forma de saber si eran Bizum, transferencias o comercios nuevos.
test("tipo de los grupos sin propuesta: solo en los «sin», solo de la lista, y nada más que el tipo", () => {
  const conTipo = (s, confianza, tipo) => medidor.registrarClasificacion(s, { confianza, talCual: false, segundos: 5, tipo, hoy: "2026-11-14" });
  let store = conTipo(null, "sin", "bizum");
  store = conTipo(store, "media", "bizum"); // con propuesta, el tipo no se guarda
  store = conTipo(store, "sin", "MERCADONA"); // fuera de la lista, tampoco: nunca un concepto
  store = conTipo(store, "sin", "comercio");
  const guardado = JSON.parse(JSON.stringify(store.calibracion));
  assert.deepEqual(guardado.map((e) => e.o), ["bizum", undefined, undefined, "comercio"]);
  assert.deepEqual(Object.keys(guardado[0]).sort(), ["c", "i", "m", "o", "s", "t", "x"]);
  assert.deepEqual(Object.keys(guardado[1]).sort(), ["c", "i", "m", "s", "t", "x"], "los demás registros no cambian de forma");
  assert.deepEqual(Object.keys(medidor.TIPOS_SIN), ["bizum", "transferencia", "recibo", "comercio", "sin-nombre"]);
  const leido = medidor.normalize({ calibracion: [{ i: 1, m: "2026-11", c: "sin", o: "recibo" }, { i: 2, m: "2026-11", c: "sin", o: "otro" }, { i: 3, m: "2026-11", c: "alta", t: true, o: "bizum" }] });
  assert.deepEqual(leido.calibracion.map((e) => e.o), ["recibo", undefined, undefined], "al leer, igual: solo en los «sin» y de la lista");
});

test("la frase de Clasificar dice de qué tipo eran los grupos sin propuesta, de más a menos; los de antes, aparte", () => {
  const conTipo = (s, tipo, hoy = "2026-11-14") => medidor.registrarClasificacion(s, { confianza: "sin", segundos: 5, tipo, hoy });
  let store = ["bizum", "transferencia", "bizum", "comercio", "bizum"].reduce((s, tipo) => conTipo(s, tipo), null);
  let k = medidor.calibracion(store, "2026-11");
  assert.deepEqual([k.sinPropuesta, JSON.parse(JSON.stringify(k.sinPorTipo))], [5, { bizum: 3, transferencia: 1, comercio: 1 }]);
  store = medidor.registrar(store, "clasificar-v2", "vista", { hoy: "2026-11-14" });
  const frase = () => medidor.frase("clasificar-v2", medidor.resumen(store, "clasificar-v2", "2026-11"));
  assert.match(frase(), / · 5 grupos sin propuesta \(3 Bizum, 1 transferencia, 1 comercio sin reglas\) · 5 s por grupo/);
  store = conTipo(conTipo(store, "sin-nombre"), "sin-nombre");
  store = medidor.registrarClasificacion(store, { confianza: "sin", segundos: 5, hoy: "2026-11-14" }); // como antes del 14/11: sin tipo
  assert.match(frase(), / · 8 grupos sin propuesta \(3 Bizum, 2 sin nombre reconocible, 1 transferencia, 1 comercio sin reglas, 1 sin tipo anotado\)/, "a igualdad, en el orden de la lista");
  const antiguo = medidor.registrar(medidor.registrarClasificacion(null, { confianza: "sin", segundos: 5, hoy: "2026-11-02" }), "clasificar-v2", "vista", { hoy: "2026-11-02" });
  assert.match(medidor.frase("clasificar-v2", medidor.resumen(antiguo, "clasificar-v2", "2026-11")), / · 1 grupo sin propuesta · 5 s/, "si ninguno lleva tipo, la frase de siempre");
  assert.ok(!/MERCADONA|€/.test(JSON.stringify(store)), "ni conceptos ni importes");
});
