// WP-21 · PR-0a (docs/WP21_DISENO.md §3 y §4): los datos de cada posición que necesita el informe para la Renta y que la
// app no guardaba. Con tributación individual (decisión del hogar del 3/10/2026), cada declarante tiene su informe, así que
// hace falta saber de quién es cada posición; y para el aviso del modelo 720, si los valores están depositados fuera de
// España. Las posiciones ya existen: por eso no basta con el formulario de alta, y esto es una lista que se rellena una vez.
//
// Vive plegado en Inversión › Cartera («uno entra, uno sale», XGO-01: un <details> cerrado no suma titulares) y se pinta al
// abrirlo, con la lista de siempre (`iv1PositionsList`) y su guardado (`saveIv1PositionsList`): ni almacén nuevo ni líneas
// en app.js. Vacío es «sin declarar»: nunca se asume un titular ni «España».

const RENTA_DATOS_TITULARES = [
  { value: "", label: "Sin declarar" },
  { value: "javi", label: "Javi" },
  { value: "tere", label: "Tere" },
  { value: "household", label: "Conjunta (50 % cada uno)" },
];
const RENTA_DATOS_DEPOSITARIOS = [
  { value: "", label: "Sin declarar" },
  { value: "espana", label: "En España" },
  { value: "extranjero", label: "Fuera de España" },
];

function rentaDatosEscape(value) {
  return typeof escapeHtml === "function" ? escapeHtml(value) : String(value ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
}

function rentaDatosOptions(options, selected) {
  return options.map((o) => `<option value="${o.value}"${o.value === (selected || "") ? " selected" : ""}>${rentaDatosEscape(o.label)}</option>`).join("");
}

// Cuántas posiciones tienen ya lo que el informe necesita: titular siempre y, si están fuera de España, el país.
function rentaDatosResumen(positions) {
  const list = Array.isArray(positions) ? positions : [];
  const conTitular = list.filter((p) => ["javi", "tere", "household"].includes(p?.titular)).length;
  const sinDepositario = list.filter((p) => !["espana", "extranjero"].includes(p?.depositario)).length;
  return { total: list.length, conTitular, sinDepositario };
}

function rentaDatosResumenTexto(positions) {
  const r = rentaDatosResumen(positions);
  if (!r.total) return "Aún no hay posiciones en la cartera.";
  const titular = r.conTitular === r.total
    ? (r.total === 1 ? "La posición tiene titular." : `Las ${r.total} posiciones tienen titular.`)
    : `${r.conTitular} de ${r.total} ${r.total === 1 ? "posición tiene" : "posiciones tienen"} titular.`;
  const deposito = !r.sinDepositario ? "" : r.sinDepositario === 1 ? " Falta saber dónde está depositada una." : ` Falta saber dónde están depositadas ${r.sinDepositario}.`;
  return `${titular}${deposito}`;
}

function rentaDatosFilaHtml(position, index) {
  const id = String(position?.id || `pos-${index}`);
  const nombre = String(position?.label || "Posición sin nombre");
  const fuera = position?.depositario === "extranjero";
  return `<li class="renta-datos-fila" data-renta-datos-id="${rentaDatosEscape(id)}">
      <strong>${rentaDatosEscape(nombre)}</strong>
      <label><span>Titular</span><select data-renta-datos-campo="titular" aria-label="Titular de ${rentaDatosEscape(nombre)}">${rentaDatosOptions(RENTA_DATOS_TITULARES, position?.titular)}</select></label>
      <label><span>Depositada</span><select data-renta-datos-campo="depositario" aria-label="Dónde está depositada ${rentaDatosEscape(nombre)}">${rentaDatosOptions(RENTA_DATOS_DEPOSITARIOS, position?.depositario)}</select></label>
      <label${fuera ? "" : " hidden"}><span>País</span><input type="text" maxlength="60" data-renta-datos-campo="depositarioPais" aria-label="País donde está depositada ${rentaDatosEscape(nombre)}" value="${rentaDatosEscape(position?.depositarioPais || "")}" placeholder="Ej. Irlanda" /></label>
    </li>`;
}

function rentaDatosHtml(positions) {
  const list = Array.isArray(positions) ? positions : [];
  const nota = `<p class="e19-kpi-note">Para el informe de la Renta (cada declarante tiene el suyo) y el aviso de bienes en el extranjero. Se guarda al elegir, con el resto de la cartera (en la copia y, si la usas, en la nube).</p>`;
  if (!list.length) return `${nota}<p class="e19-kpi-note" data-renta-datos-resumen>${rentaDatosEscape(rentaDatosResumenTexto(list))}</p>`;
  return `${nota}<p class="e19-kpi-note" data-renta-datos-resumen>${rentaDatosEscape(rentaDatosResumenTexto(list))}</p>
    <ul class="renta-datos-lista">${list.map(rentaDatosFilaHtml).join("")}</ul>
    <p class="e19-kpi-note renta-datos-estado" role="status" data-renta-datos-estado></p>`;
}

// ---- WP-21 · PR-0b: dividendos e intereses cobrados, y el bloque de cada pérdida arrastrada ----
// El otro bloque de la base del ahorro. Cada cobro: fecha, tipo, de qué posición (o de qué cuenta, si es un interés), el
// íntegro y las dos retenciones. Una retención en blanco es «sin declarar» (null), nunca 0: el informe la pedirá, no la
// inventará. Viven en `scenarioSettings.wp21Rendimientos`, junto a las pérdidas arrastradas (`fc3PriorLosses`): misma
// copia, misma nube, sin almacén nuevo. El titular de un cobro de una posición es el de la posición; sin posición, el suyo.
const RENTA_REND_TIPOS = [
  { value: "dividendo", label: "Dividendo" },
  { value: "interes", label: "Interés" },
];
const RENTA_PERDIDA_TITULARES = { javi: "Javi", tere: "Tere" };

function rentaDatosEuros(value) {
  if (value === null || value === undefined) return "sin declarar";
  if (typeof money === "function") return money(value, true);
  return `${Number(value).toFixed(2).replace(".", ",")} €`;
}

function rentaDatosFecha(iso) {
  return String(iso || "").split("-").reverse().join("/");
}

function rentaDatosImporte(value) {
  if (value === null || value === undefined || String(value).trim() === "") return null;
  const parsed = typeof parseAmount === "function" ? parseAmount(value) : Number(String(value).replace(",", "."));
  return typeof parsed === "number" && Number.isFinite(parsed) ? Math.round(parsed * 100) / 100 : NaN;
}

// Lo que el hogar teclea → el cobro guardado, o el motivo por el que no se puede guardar.
function rentaRendimientoNormalizar(raw = {}, positions = []) {
  const fecha = String(raw.fecha || "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha) || Number.isNaN(Date.parse(`${fecha}T00:00:00Z`))) return { error: "Indica la fecha del cobro." };
  const tipo = RENTA_REND_TIPOS.some((t) => t.value === raw.tipo) ? raw.tipo : "";
  if (!tipo) return { error: "Elige si es un dividendo o un interés." };
  const posicionId = String(raw.posicionId || "");
  const posicion = posicionId ? (Array.isArray(positions) ? positions : []).find((p) => String(p?.id) === posicionId) : null;
  if (posicionId && !posicion) return { error: "Esa posición ya no está en la cartera." };
  const concepto = String(raw.concepto || "").trim().slice(0, 80);
  if (!posicion && !concepto) return { error: "Elige la posición o di de dónde viene (por ejemplo, la cuenta remunerada)." };
  const integro = rentaDatosImporte(raw.integro);
  if (!(integro > 0)) return { error: "Indica el importe íntegro, antes de retenciones, mayor que cero." };
  const retencionEspana = rentaDatosImporte(raw.retencionEspana);
  const retencionOrigen = rentaDatosImporte(raw.retencionOrigen);
  for (const [valor, nombre] of [[retencionEspana, "en España"], [retencionOrigen, "en origen"]]) {
    if (Number.isNaN(valor) || (valor !== null && (valor < 0 || valor > integro))) return { error: `La retención ${nombre} va de 0 al íntegro; déjala en blanco si no la sabes.` };
  }
  const titular = posicion ? "" : (["javi", "tere", "household"].includes(raw.titular) ? raw.titular : "");
  return {
    record: {
      id: String(raw.id || `rend-${Date.now()}`),
      fecha,
      tipo,
      posicionId: posicion ? posicionId : "",
      concepto: posicion ? "" : concepto,
      titular,
      integro,
      retencionEspana,
      retencionOrigen,
      paisOrigen: String(raw.paisOrigen || "").trim().slice(0, 60),
    },
  };
}

// De quién es un cobro: el titular de su posición (aunque cambie después) o el que se declaró al registrarlo.
function rentaRendimientoTitular(record, positions = []) {
  if (record?.posicionId) {
    const posicion = (Array.isArray(positions) ? positions : []).find((p) => String(p?.id) === String(record.posicionId));
    return posicion?.titular || "";
  }
  return record?.titular || "";
}

function rentaRendimientoNombre(record, positions = []) {
  if (record?.posicionId) {
    const posicion = (Array.isArray(positions) ? positions : []).find((p) => String(p?.id) === String(record.posicionId));
    return posicion ? String(posicion.label || "Posición sin nombre") : "Posición que ya no está en la cartera";
  }
  return String(record?.concepto || "Sin concepto");
}

// Por año: lo cobrado, lo retenido (solo lo declarado) y lo que le falta al informe.
function rentaRendimientosPorAno(list, positions = []) {
  const years = new Map();
  (Array.isArray(list) ? list : []).forEach((r) => {
    const year = String(r?.fecha || "").slice(0, 4);
    if (!/^\d{4}$/.test(year)) return;
    if (!years.has(year)) years.set(year, { year, cobros: [], integro: 0, retencionEspana: 0, retencionOrigen: 0, sinRetencionEspana: 0, sinTitular: 0, origenSinPais: 0 });
    const y = years.get(year);
    y.cobros.push(r);
    y.integro += Number(r.integro) || 0;
    if (r.retencionEspana === null || r.retencionEspana === undefined) y.sinRetencionEspana += 1;
    else y.retencionEspana += Number(r.retencionEspana) || 0;
    y.retencionOrigen += Number(r.retencionOrigen) || 0;
    if (!rentaRendimientoTitular(r, positions)) y.sinTitular += 1;
    if (Number(r.retencionOrigen) > 0 && !r.paisOrigen) y.origenSinPais += 1;
  });
  const r2 = (v) => Math.round(v * 100) / 100;
  return [...years.values()]
    .map((y) => ({ ...y, integro: r2(y.integro), retencionEspana: r2(y.retencionEspana), retencionOrigen: r2(y.retencionOrigen), cobros: y.cobros.slice().sort((a, b) => String(b.fecha).localeCompare(String(a.fecha))) }))
    .sort((a, b) => b.year.localeCompare(a.year));
}

function rentaRendimientosFaltaTexto(y) {
  const partes = [];
  if (y.sinRetencionEspana) partes.push(`${y.sinRetencionEspana} sin la retención española declarada`);
  if (y.sinTitular) partes.push(`${y.sinTitular} sin titular`);
  if (y.origenSinPais) partes.push(`${y.origenSinPais} con retención en origen y sin país`);
  return partes.length ? `Falta: ${partes.join("; ")}.` : "";
}

function rentaRendimientoFilaHtml(r, positions) {
  const tipo = r.tipo === "interes" ? "Interés" : "Dividendo";
  const nombre = rentaRendimientoNombre(r, positions);
  const origen = r.retencionOrigen === null || r.retencionOrigen === undefined ? "en origen sin declarar" : `en origen ${rentaDatosEuros(r.retencionOrigen)}${r.paisOrigen ? ` (${r.paisOrigen})` : ""}`;
  return `<li class="renta-rend-fila" data-renta-rend-id="${rentaDatosEscape(r.id)}">
      <span><strong>${rentaDatosEscape(rentaDatosFecha(r.fecha))} · ${tipo}</strong> · ${rentaDatosEscape(nombre)}</span>
      <span>Íntegro ${rentaDatosEscape(rentaDatosEuros(r.integro))} · retención en España ${rentaDatosEscape(rentaDatosEuros(r.retencionEspana))} · ${rentaDatosEscape(origen)}</span>
      <button type="button" class="e19-btn e19-btn-secondary" data-renta-rend-quitar="${rentaDatosEscape(r.id)}" aria-label="Quitar ${tipo.toLowerCase()} del ${rentaDatosEscape(rentaDatosFecha(r.fecha))} de ${rentaDatosEscape(nombre)}">Quitar</button>
    </li>`;
}

function rentaRendimientosHtml(list, positions = []) {
  const opciones = (Array.isArray(positions) ? positions : []).map((p, i) => `<option value="${rentaDatosEscape(String(p?.id || `pos-${i}`))}">${rentaDatosEscape(String(p?.label || "Posición sin nombre"))}</option>`).join("");
  const anos = rentaRendimientosPorAno(list, positions);
  const listado = anos.length
    ? anos.map((y) => {
        const falta = rentaRendimientosFaltaTexto(y);
        return `<section class="renta-rend-ano" aria-label="Cobros de ${y.year}">
        <p class="renta-rend-total"><strong>${y.year}</strong> · ${y.cobros.length} ${y.cobros.length === 1 ? "cobro" : "cobros"} · íntegro ${rentaDatosEscape(rentaDatosEuros(y.integro))} · retenido en España ${rentaDatosEscape(rentaDatosEuros(y.retencionEspana))} · en origen ${rentaDatosEscape(rentaDatosEuros(y.retencionOrigen))}</p>
        ${falta ? `<p class="e19-kpi-note renta-rend-falta">${rentaDatosEscape(falta)}</p>` : ""}
        <ul class="renta-rend-lista">${y.cobros.map((r) => rentaRendimientoFilaHtml(r, positions)).join("")}</ul>
      </section>`;
      }).join("")
    : `<p class="e19-kpi-note">Aún no hay cobros registrados.</p>`;
  return `<h3 class="renta-datos-titulo">Dividendos e intereses cobrados</h3>
    <p class="e19-kpi-note">Copia cada cobro del extracto del banco o del bróker: el íntegro y lo retenido. Una retención en blanco queda «sin declarar», no como cero.</p>
    <form class="renta-rend-form" data-renta-rend-form novalidate>
      <label><span>Fecha</span><input type="date" name="fecha" required /></label>
      <label><span>Tipo</span><select name="tipo">${RENTA_REND_TIPOS.map((t) => `<option value="${t.value}">${t.label}</option>`).join("")}</select></label>
      <label><span>De qué posición</span><select name="posicionId">${opciones}<option value="">Ninguna: una cuenta o un depósito</option></select></label>
      <label data-renta-rend-sin-posicion${opciones ? " hidden" : ""}><span>De dónde viene</span><input type="text" name="concepto" maxlength="80" placeholder="Ej. cuenta remunerada" /></label>
      <label data-renta-rend-sin-posicion${opciones ? " hidden" : ""}><span>De quién es</span><select name="titular">${rentaDatosOptions(RENTA_DATOS_TITULARES, "")}</select></label>
      <label><span>Íntegro (€)</span><input type="text" name="integro" inputmode="decimal" placeholder="0,00" /></label>
      <label><span>Retención en España (€)</span><input type="text" name="retencionEspana" inputmode="decimal" placeholder="Sin declarar" /></label>
      <label><span>Retención en origen (€)</span><input type="text" name="retencionOrigen" inputmode="decimal" placeholder="Sin declarar" /></label>
      <label><span>País de origen</span><input type="text" name="paisOrigen" maxlength="60" placeholder="Solo si es extranjero" /></label>
      <p class="renta-rend-acciones"><button type="submit" class="e19-btn e19-btn-secondary">Registrar cobro</button></p>
    </form>
    <p class="e19-kpi-note renta-datos-estado" role="status" data-renta-rend-estado></p>
    <div data-renta-rend-listado>${listado}</div>`;
}

// La etiqueta del bloque y del titular de una pérdida arrastrada, para la lista de Inversión › Fiscal.
function rentaPerdidaEtiqueta(entry) {
  const bloque = entry?.bloque === "rendimientos" ? "rendimientos" : "transmisiones";
  const titular = RENTA_PERDIDA_TITULARES[entry?.titular];
  return ` · ${bloque}${titular ? ` · ${titular}` : " · sin titular"}`;
}

function rentaRendimientosLista() {
  return typeof scenarioSettings === "object" && scenarioSettings && Array.isArray(scenarioSettings.wp21Rendimientos) ? scenarioSettings.wp21Rendimientos : [];
}

function rentaRendimientosGuardar(next) {
  if (typeof scenarioSettings !== "object" || !scenarioSettings || typeof saveScenarioSettings !== "function") return false;
  scenarioSettings.wp21Rendimientos = next;
  saveScenarioSettings();
  return true;
}

function rentaRendimientosRepintar(mensaje) {
  const listado = document.querySelector("[data-renta-rend-listado]");
  const caja = document.getElementById("rentaDatosCuerpo");
  if (listado && caja) {
    const tmp = document.createElement("div");
    tmp.innerHTML = rentaRendimientosHtml(rentaRendimientosLista(), rentaDatosPosiciones());
    listado.replaceWith(tmp.querySelector("[data-renta-rend-listado]"));
  }
  const estado = document.querySelector("[data-renta-rend-estado]");
  if (estado && mensaje) estado.textContent = mensaje;
}

function rentaRendimientosAlEnviar(event) {
  const form = event.target?.closest?.("[data-renta-rend-form]");
  if (!form) return;
  event.preventDefault();
  const datos = Object.fromEntries(new FormData(form).entries());
  const resultado = rentaRendimientoNormalizar(datos, rentaDatosPosiciones());
  const estado = document.querySelector("[data-renta-rend-estado]");
  if (resultado.error) {
    if (estado) estado.textContent = resultado.error;
    return;
  }
  if (!rentaRendimientosGuardar([...rentaRendimientosLista(), resultado.record])) return;
  ["integro", "retencionEspana", "retencionOrigen"].forEach((name) => { if (form.elements[name]) form.elements[name].value = ""; });
  const r = resultado.record;
  rentaRendimientosRepintar(`Registrado: ${r.tipo === "interes" ? "interés" : "dividendo"} de ${rentaDatosEuros(r.integro)} del ${rentaDatosFecha(r.fecha)}.`);
}

function rentaRendimientosAlPulsar(event) {
  const boton = event.target?.closest?.("[data-renta-rend-quitar]");
  if (!boton) return;
  const id = boton.dataset.rentaRendQuitar;
  const antes = rentaRendimientosLista();
  const quitado = antes.find((r) => String(r.id) === String(id));
  if (!quitado || !rentaRendimientosGuardar(antes.filter((r) => String(r.id) !== String(id)))) return;
  rentaRendimientosRepintar("Cobro quitado.");
  if (typeof showUndoToast === "function") {
    showUndoToast("Cobro quitado.", () => {
      rentaRendimientosGuardar([...rentaRendimientosLista(), quitado]);
      rentaRendimientosRepintar("Cobro recuperado.");
    });
  }
}

function rentaRendimientosAlCambiarPosicion(event) {
  if (event.target?.name !== "posicionId" || !event.target.closest("[data-renta-rend-form]")) return;
  event.target.closest("[data-renta-rend-form]").querySelectorAll("[data-renta-rend-sin-posicion]").forEach((label) => { label.hidden = Boolean(event.target.value); });
}

function rentaDatosPosiciones() {
  return typeof iv1PositionsList === "function" ? iv1PositionsList() : [];
}

function renderRentaDatos() {
  const cuerpo = typeof document !== "undefined" ? document.getElementById("rentaDatosCuerpo") : null;
  if (cuerpo) cuerpo.innerHTML = `${rentaDatosHtml(rentaDatosPosiciones())}${rentaRendimientosHtml(rentaRendimientosLista(), rentaDatosPosiciones())}`;
}

// Cambia un campo de una posición, sin tocar el resto. Devuelve la lista nueva (o null si no encuentra la posición).
function rentaDatosAplicar(positions, id, campo, valor) {
  const list = Array.isArray(positions) ? positions : [];
  const index = list.findIndex((p, i) => String(p?.id || `pos-${i}`) === String(id));
  if (index < 0 || !["titular", "depositario", "depositarioPais"].includes(campo)) return null;
  const limpio = campo === "depositarioPais" ? String(valor || "").trim().slice(0, 60) : String(valor || "");
  const next = list.slice();
  next[index] = { ...list[index], [campo]: limpio };
  if (campo === "depositario" && limpio !== "extranjero") next[index].depositarioPais = "";
  return next;
}

function rentaDatosAlCambiar(event) {
  const campo = event.target?.dataset?.rentaDatosCampo;
  const fila = event.target?.closest?.("[data-renta-datos-id]");
  if (!campo || !fila || typeof saveIv1PositionsList !== "function") return;
  const next = rentaDatosAplicar(rentaDatosPosiciones(), fila.dataset.rentaDatosId, campo, event.target.value);
  if (!next) return;
  saveIv1PositionsList(next);
  const nombre = fila.querySelector("strong")?.textContent || "la posición";
  const pais = fila.querySelector('[data-renta-datos-campo="depositarioPais"]')?.closest("label");
  if (campo === "depositario" && pais) pais.hidden = event.target.value !== "extranjero";
  const resumen = document.querySelector("[data-renta-datos-resumen]");
  if (resumen) resumen.textContent = rentaDatosResumenTexto(next);
  const estado = document.querySelector("[data-renta-datos-estado]");
  if (estado) estado.textContent = `Guardado: ${nombre}.`;
}

function rentaDatosInit() {
  const caja = document.getElementById("rentaDatos");
  if (!caja || caja.__rentaDatos) return;
  caja.__rentaDatos = true;
  caja.addEventListener("toggle", () => {
    if (caja.open) renderRentaDatos();
  });
  caja.addEventListener("change", rentaDatosAlCambiar);
  caja.addEventListener("change", rentaRendimientosAlCambiarPosicion);
  caja.addEventListener("submit", rentaRendimientosAlEnviar);
  caja.addEventListener("click", rentaRendimientosAlPulsar);
}

if (typeof module === "object" && module.exports) {
  module.exports = {
    rentaDatosHtml, rentaDatosResumen, rentaDatosResumenTexto, rentaDatosAplicar, RENTA_DATOS_TITULARES, RENTA_DATOS_DEPOSITARIOS,
    rentaRendimientoNormalizar, rentaRendimientoTitular, rentaRendimientosPorAno, rentaRendimientosFaltaTexto, rentaRendimientosHtml, rentaPerdidaEtiqueta,
  };
} else if (typeof document !== "undefined") {
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", rentaDatosInit);
  else rentaDatosInit();
}
