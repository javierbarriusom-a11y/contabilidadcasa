// UND-13 (undécima auditoría; DEC-26, 22/11/2026): kit para hablar con cada entidad, desde la fila del contrato. Qué pedir según el
// estado, un guion y una carta con los datos del contrato y huecos para lo personal; nada se envía. Contratos inventados.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const read = (file) => fs.readFileSync(path.join(__dirname, "..", file), "utf8");
const js = read("kit-entidad-ui.js");

// El script entero, en un ámbito con los dobles de lo que comparte con app.js.
function cargar(contratos = [], guardado = {}) {
  const almacen = new Map([["kit-entidad", JSON.stringify(guardado)]]);
  const anotado = [];
  const cuerpo = `
    const storageKey = (k) => k;
    const storageGet = (k, d) => (almacen.has(k) ? almacen.get(k) : d);
    const storageSet = (k, v) => almacen.set(k, v);
    const isoLocalDate = () => "2026-11-22";
    const money = (v) => String(v).replace(".", ",") + " €";
    const escapeHtml = (t) => String(t).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
    const debtContractSourceRows = () => contratos;
    const globalThis = { FinanceMedidor: { anotar: (id, ev) => anotado.push([id, ev]) } };
    ${js}
    return { kitQuePedir, kitGuion, kitCarta, kitHtml, kitMarcar, kitSeguimiento, kitContrato, KIT_ENTIDAD_KEY };`;
  return { ...new Function("contratos", "almacen", "anotado", cuerpo)(contratos, almacen, anotado), almacen, anotado };
}

const alDia = { id: "c1", entity: "Banco FICTICIO", type: "préstamo", number: "FIC-0001", currentPrincipal: 5100, currentPayment: 160, apr: 9.5, remainingInstallments: 40, paymentStatus: "active" };
const impago = { id: "c2", entity: "Financiera FICTICIA", type: "tarjeta", number: "", currentPrincipal: 3000, currentPayment: 0, apr: 24, remainingInstallments: 0, paymentStatus: "suspended" };

test("UND-13 · qué pedir: siempre el certificado con el desglose; con impago, quita y plan de pagos; con tarjeta, intereses por periodo", () => {
  const k = cargar();
  const alDiaTexto = k.kitQuePedir(alDia).join(" ");
  assert.match(alDiaTexto, /Certificado de deuda a fecha de hoy.*capital pendiente, intereses ordinarios, intereses de demora, comisiones y gastos/);
  assert.match(alDiaTexto, /amortizar antes/);
  assert.doesNotMatch(alDiaTexto, /quita|plan de pagos/);
  assert.match(alDiaTexto, /carta de deuda saldada \(saldo cero\).*ficheros de morosidad/);
  const impagoTexto = k.kitQuePedir(impago).join(" ");
  assert.match(impagoTexto, /cancelarla de una vez\*?\*?|cancelarla de una vez/);
  assert.match(impagoTexto, /plan de pagos/);
  assert.match(impagoTexto, /TAE de cada periodo/, "es una tarjeta");
  assert.doesNotMatch(impagoTexto, /amortizar antes/);
});

test("UND-13 · la carta lleva los datos del contrato y huecos para lo personal (ni nombres ni DNI del hogar)", () => {
  const k = cargar();
  const carta = k.kitCarta(alDia).join("\n");
  assert.match(carta, /A la atención de Banco FICTICIO/);
  assert.match(carta, /certificado de deuda del contrato FIC-0001/);
  assert.match(carta, /\[Nombre y apellidos\], con DNI \[número\]/);
  assert.match(carta, /En \[ciudad\], a 22\/11\/2026\./);
  assert.doesNotMatch(carta, /\n\n\n/, "sin líneas en blanco dobles");
  const sinNumero = k.kitCarta(impago).join("\n");
  assert.match(sinNumero, /contrato \[número de contrato\]/);
  assert.match(sinNumero, /importe por el que aceptarían la cancelación total/);
  assert.match(k.kitGuion(impago).join(" "), /No aceptéis nada por teléfono/);
});

test("UND-13 · la hoja: título, cuatro apartados, botones de imprimir, copiar y cerrar, y lo que no se imprime marcado", () => {
  const k = cargar([alDia]);
  const html = k.kitHtml(alDia);
  assert.match(html, /<h2 id="kitEntidadTitulo">Para hablar con Banco FICTICIO<\/h2>/);
  for (const t of ["Datos del contrato", "Qué pedir", "Guion para la llamada", "Carta para pedir el certificado", "Seguimiento"]) assert.ok(html.includes(`>${t}</h3>`), t);
  assert.match(html, /data-kit-imprimir>Imprimir<\/button>/);
  assert.match(html, /data-kit-copiar>Copiar la carta<\/button>/);
  assert.match(html, /<section aria-labelledby="kitSegT" class="kit-entidad-no-imprimir">/);
  assert.match(html, /no asesoramiento legal/);
  assert.match(html, /<dd>5100 €<\/dd>/);
  assert.match(html, /<dd>9,5 %<\/dd>/);
  assert.match(html, /data-kit-marcar="pedido">Lo hemos pedido</);
});

test("UND-13 · «Lo hemos pedido» y «Lo hemos recibido» se apuntan con su fecha y los cuenta el medidor", () => {
  const k = cargar([alDia]);
  k.kitMarcar("c1", "pedido");
  assert.deepEqual(k.kitSeguimiento("c1"), { pedido: "2026-11-22" });
  assert.match(k.kitHtml(alDia), /✓ Certificado pedido el 22\/11\/2026/);
  assert.match(k.kitHtml(alDia), /data-kit-marcar="recibido">Lo hemos recibido</);
  k.kitMarcar("c1", "recibido");
  assert.deepEqual(JSON.parse(k.almacen.get("kit-entidad")), { c1: { pedido: "2026-11-22", recibido: "2026-11-22" } });
  assert.deepEqual(k.anotado, [["kit-entidad", "accion"], ["kit-entidad", "accion"]]);
  assert.equal(cargar([], "no es un objeto").kitSeguimiento("c1").pedido, undefined, "lo guardado roto no rompe nada");
});

test("UND-13 · enchufado: botón en cada fila de Contratos, diálogo, script, impresión y medidor", () => {
  assert.match(read("views/deuda.js"), /<button type="button" class="secondary-button deuda-kit-boton" data-kit-entidad="\$\{id\}" aria-label="Kit para hablar con \$\{entityLabel\}">Kit para la entidad<\/button>/);
  assert.match(read("views/deuda.js"), /globalThis\.attachKitEntidad\?\.\(document\);/);
  const html = read("index.html");
  assert.match(html, /<dialog class="action-review-dialog kit-entidad" id="kitEntidad" aria-labelledby="kitEntidadTitulo">/);
  assert.match(html, /<script defer src="kit-entidad-ui\.js\?v=(?:20261122und13|20261124duod6)"><\/script>/);
  assert.ok(html.indexOf('src="kit-entidad-ui.js?v=') < html.indexOf('src="app.js?v='));
  assert.match(read("tools/build-public-site.mjs"), /^ {2}"kit-entidad-ui\.js",$/m);
  assert.match(read("service-worker.js"), /^ {2}"\.\/kit-entidad-ui\.js",$/m);
  assert.match(read("app.js"), /"deuda-contratos": \{ src: "views\/deuda\.js\?v=2026112(?:5(?:dn40|tred4|tred5)|6tred5c)"/);
  const css = read("styles.css");
  assert.match(css, /body\.imprimiendo-kit-entidad > :not\(\[data-kit-entidad-ancestro\]\):not\(#kitEntidad\)/);
  assert.match(css, /body\.imprimiendo-kit-entidad \.kit-entidad-no-imprimir \{\s*display: none;/);
  assert.doesNotMatch(css.slice(css.indexOf("/* UND-13 (DEC-26")), /:has\([^)]/, "sin :has() en la hoja de impresión (WebKit)");
  assert.match(read("medidor-utilidad.js"), /\{ id: "kit-entidad", nombre: "Kit para hablar con la entidad"/);
  assert.match(js, /window\.print\(\);/);
  assert.doesNotMatch(js, /fetch\(|XMLHttpRequest|sendBeacon/, "nada se envía");
});
