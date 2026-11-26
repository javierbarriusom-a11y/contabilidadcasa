// TRE-D4 + TRE-23 (decimotercera §2.5; auditoría de diseño §5.2, PR 4): Deuda › Contratos en tarjetas con su ficha, y los componentes
// comunes del tema v2. Criterios de hecho: 0 desbordamiento a 320 px (e2e) y ≤ 10 campos a la vista. Contratos FICTICIOS.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const K = require("../views/componentes-v2.js");
const V = require("../views/deuda-contratos-v2.js");

const leer = (f) => fs.readFileSync(path.join(__dirname, "..", f), "utf8");
const texto = (h) => h.replace(/<[^>]+>/g, " ").replace(/ /g, " ").replace(/\s+/g, " ").trim();

const tarjeta = { id: "t", entity: "Banco FICTICIO", type: "Tarjeta revolving", currentPrincipal: 2400, initialPrincipal: 3000, apr: 21.9, currentPayment: 90, paymentStatus: "active" };
const prestamo = { id: "p", entity: "Caja FICTICIA", type: "Préstamo personal", currentPrincipal: 5100, initialPrincipal: 0, apr: null, currentPayment: 160, paymentStatus: "active" };
const saldada = { id: "s", entity: "Financiera FICTICIA", type: "Préstamo", currentPrincipal: 0, apr: 7, currentPayment: 0, paymentStatus: "settled" };

test("TRE-23 · componentes: tarjeta, banda, plegado y panel escapan lo que pintan y llevan su marca", () => {
  const t = K.tarjeta({ titulo: "<b>X</b>", insignias: [{ texto: "Sin TAE", tono: "aviso" }, { texto: "raro", tono: "inventado" }], datos: [1, 2, 3, 4, 5].map((i) => ({ rotulo: `d${i}`, valor: String(i) })), barra: { pct: 140, etiqueta: "x" } });
  assert.match(t, /&lt;b&gt;X&lt;\/b&gt;/);
  assert.equal((t.match(/<dt>/g) || []).length, 4, "hasta cuatro datos");
  assert.match(t, /data-tono="aviso"/);
  assert.match(t, /data-tono="neutro">raro/, "un tono desconocido cae en neutro");
  assert.match(t, /width:100%/, "la barra no pasa del 100 %");
  assert.match(K.banda({ titulo: "Faltan 2 datos", accion: "<button>a</button>" }), /class="cv2-banda" data-tono="aviso"/);
  const p = K.plegado({ titulo: "Herramientas", entradas: [{ titulo: "A", linea: "a", datos: { x: "#a" } }, { titulo: "B", linea: "b" }] });
  assert.match(p, /<summary>Herramientas <span class="cv2-cuenta">\(2\)<\/span><\/summary>/);
  assert.match(p, /data-x="#a"/);
  assert.match(K.panel({ idTitulo: "t1", titulo: "Ficha", cerrar: { cerrar: "1" } }), /aria-label="Cerrar «Ficha»"/);
});

test("TRE-D4 · «Faltan N datos»: solo lo que mueve cifras y se puede escribir aquí, con su porqué y lo que saca del plan primero", () => {
  const f = V.faltan([tarjeta, prestamo, saldada, { ...tarjeta, id: "sin", currentPayment: 0, initialPrincipal: 0 }]);
  assert.deepEqual(f.map((x) => `${x.id}:${x.campo}`), ["p:apr", "sin:currentPayment", "p:initialPrincipal", "sin:initialPrincipal"]);
  assert.match(f[0].porque, /no entra en el plan/);
  assert.equal(V.faltan([saldada]).length, 0, "lo saldado no pide nada");
  const frase = V.faltanFrase(f);
  assert.equal(frase.titulo, "Faltan 4 datos que mueven las cifras:");
  assert.equal(frase.texto, "la TAE de Caja FICTICIA (sin ella, la deuda no entra en el plan); la cuota de Banco FICTICIO (sin cuota, la deuda no entra en el plan); el capital inicial de 2 contratos (para ver el % pagado).");
  // Los campos de calidad que la pantalla no deja escribir (titular, procedencia…) no cuentan.
  assert.equal(V.faltan([{ ...tarjeta, dataQuality: { missing: ["owner", "provenance", "maturity"] } }]).length, 0);
});

test("TRE-D4 · las tarjetas: en el orden del plan, % pagado, fin con el plan e insignias; lo liquidado, al final", () => {
  const plan = new Map([["p", { fin: "2027-09", posicion: 2 }], ["t", { fin: "2026-12", posicion: 1 }]]);
  const ts = V.tarjetas([saldada, prestamo, tarjeta], { plan, comisiones: { p: { pct: 1, promoHasta: "2027-03" } }, esRevolving: (t) => /revolving/i.test(t) });
  assert.deepEqual(ts.map((t) => t.id), ["t", "p", "s"]);
  assert.equal(ts[0].pagado, 20);
  assert.equal(ts[1].pagado, null, "sin capital inicial no se inventa un % pagado");
  assert.deepEqual(ts[0].insignias.map((i) => i.texto), ["Revolving: revisad la TAE"]);
  assert.deepEqual(ts[1].insignias.map((i) => i.texto), ["Sin TAE", "Comisión 1 %", "Al 0 % hasta marzo de 2027"]);
  assert.deepEqual(ts[2].insignias.map((i) => i.texto), ["Liquidada"]);
  const r = V.resumen([tarjeta, prestamo, saldada]);
  assert.deepEqual(r, { vivos: 2, debe: 7500, cuota: 250 });
});

test("TRE-D4 · la vista: lo vivo, la banda, las tarjetas con «fuera en …» del plan, las herramientas (todas a dos toques) y el detalle", () => {
  const plan = new Map([["t", { fin: "2026-12", posicion: 1 }]]);
  const m = { resumen: V.resumen([tarjeta, prestamo]), faltan: V.faltan([tarjeta, prestamo]), tarjetas: V.tarjetas([tarjeta, prestamo], { plan }) };
  const h = V.html(m);
  assert.match(texto(h), /^Contratos 2 vivos · 7500 € · cuota 250 € al mes \+ Añadir un contrato Pegar varios Faltan 2 datos que mueven las cifras:/);
  assert.match(h, /Completar ahora · 1 de 2/);
  assert.match(texto(h), /Banco FICTICIO Tarjeta revolving · 1\.º en el plan Debe 2400 € TAE 21,9 % Cuota 90 € 20 % pagado · con el plan, fuera en diciembre de 2026/);
  assert.match(texto(h), /Caja FICTICIA .* % pagado: falta el capital inicial · fuera del plan: le falta la cuota o la TAE/);
  assert.match(h, /data-dcv2-editar="t"/);
  assert.match(h, /data-kit-entidad="t"/, "el kit de UND-13, el de siempre");
  assert.match(h, /Herramientas de contratos <span class="cv2-cuenta">\(11\)<\/span>/);
  for (const sel of ["#cirbeCard", "#sombraCard", "#deb5FiscalPriorityNote", "#deb16PayoffOrderNote", "#deb6SimulateRun"]) assert.ok(h.includes(`data-dcv2-herramienta="${sel}"`), sel);
  assert.match(h, /data-dcv2="detalle"/);
  assert.doesNotMatch(h, /<input|<select/, "la lista no tiene campos: se edita en la ficha");
});

test("TRE-D4 · la ficha: diez campos en cuatro grupos, la vista previa en vivo y lo que cambia (el estado, al final)", () => {
  const h = V.fichaHtml(tarjeta);
  assert.equal((h.match(/data-dcv2-campo=/g) || []).length, 10, "≤ 10 campos a la vista");
  assert.deepEqual([...h.matchAll(/<legend>([^<]+)<\/legend>/g)].map((x) => x[1]), ["Lo básico", "Plazo y progreso", "Costes", "Estado"]);
  assert.match(h, /data-dcv2-ficha="guardar"/);
  assert.doesNotMatch(h, /data-deuda-contrato-field/, "la ficha no guarda al teclear: guarda con «Guardar»");
  // Lo que falta no se precarga: un capital inicial igual a lo pendiente (sin corregir tras el alta) sale vacío.
  assert.equal(V.valoresDe({ ...tarjeta, initialPrincipal: 2400 }).initialPrincipal, "");
  assert.match(h, /<div class="dcv2-campos">/, "los campos, en una rejilla interior (la leyenda flotante desbordaba)");
  const plazo = ({ currentPrincipal, currentPayment }) => Math.ceil(currentPrincipal / currentPayment);
  const p = V.previa(V.valoresDe(tarjeta), { hoy: "2026-11", plazo });
  assert.equal(p.nombre, "Banco FICTICIO · Tarjeta revolving");
  assert.match(p.texto, /^20 % pagado de 3000 € · solo con su cuota, acabada en 27 meses \(febrero de 2029\)\.$/);
  assert.match(V.previa({ ...V.valoresDe(tarjeta), fiscalDeductionPct: "15" }, { plazo }).texto, /TAE tras la deducción: 18,62 %/);
  assert.match(V.previa({ ...V.valoresDe(tarjeta), paymentStatus: "suspended" }, { plazo }).texto, /^pagos suspendidos: fuera del plan/);
  assert.match(V.previa({ ...V.valoresDe(tarjeta), apr: "" }, { plazo }).texto, /sin TAE: no entra en el plan/);
  assert.match(V.previa({ ...V.valoresDe(tarjeta), remainingInstallments: "12" }, { hoy: "2026-11", plazo }).texto, /acabada en 27 meses \(febrero de 2029\) · según el contrato, quedan 12 plazos \(hasta noviembre de 2027\)/);
  const parse = (campo, v) => (campo === "apr" && Number(v) > 60 ? { invalid: true } : {});
  const c = V.cambios(V.valoresDe(tarjeta), { ...V.valoresDe(tarjeta), paymentStatus: "settled", currentPayment: "100", apr: "70" }, parse);
  assert.deepEqual(c.cambios.map((x) => x.campo), ["currentPayment", "paymentStatus"]);
  assert.deepEqual(c.errores, { apr: "La TAE va de 0 a 60 %." });
});

test("TRE-D4 · cableado: la vista, la ficha, el modo, los ficheros y lo medido", () => {
  const html = leer("index.html");
  assert.match(html, /<nav class="deuda-flow-nav" id="deudaContratosFlowNav"[^>]*><\/nav>\s*<!--[\s\S]*?-->\s*<div class="dcv2" id="deudaContratosV2" hidden><\/div>/);
  assert.match(html, /<dialog class="dpv2-ajustar dcv2-ficha" id="deudaContratoFicha" aria-labelledby="dcv2FichaTitulo"><\/dialog>/);
  assert.match(html, /<script defer src="views\/componentes-v2\.js\?v=20261125tred4"><\/script>\s*<script defer src="views\/deuda-contratos-v2\.js\?v=2026112(?:5tred4|6tred5c)"><\/script>/);
  for (const f of ["tools/build-public-site.mjs", "service-worker.js"]) {
    assert.match(leer(f), /views\/componentes-v2\.js/, f);
    assert.match(leer(f), /views\/deuda-contratos-v2\.js/, f);
  }
  assert.match(leer("views/deuda.js"), /globalThis\.renderDeudaContratosV2\?\.\(\); \/\/ TRE-D4/);
  const js = leer("views/deuda-contratos-v2.js");
  assert.match(js, /handleDeudaContratosFieldChange\(\{ dataset: \{ deudaContratoId: fichaId, deudaContratoField: campo \}, value: valor \}\)/, "una sola puerta de escritura");
  assert.match(js, /showUndoToast\(`Contrato de «\$\{nombre\}» guardado\.`/);
  assert.equal(V.MODO_KEY, "deuda-contratos-v2-modo");
  assert.match(leer("medidor-utilidad.js"), /id: "deuda-contratos-v2", nombre: "Contratos nuevos"/);
  assert.match(leer("funciones-en-prueba.js"), /id: "deuda-contratos-v2", nombre: "Contratos nuevos"/);
  const css = leer("tema-v2.css");
  const bloque = css.slice(css.indexOf("TRE-23 · componentes comunes"));
  bloque.split("\n").filter((l) => /^\s*[.#:a-z][^{]*\{\s*$/.test(l)).forEach((l) => assert.match(l, /:root\[data-tema="v2"\]/, l));
  assert.match(css, /#deuda-contratos:has\(> #deudaContratosV2:not\(\[hidden\]\):not\(\[data-modo="anterior"\]\)\)/);
});
