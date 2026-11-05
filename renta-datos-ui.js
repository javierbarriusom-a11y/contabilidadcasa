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
  const nota = `<p class="e19-kpi-note">Para el informe de la Renta (cada declarante tiene el suyo) y el aviso de bienes en el extranjero. Se guarda al elegir; nada sale de este dispositivo.</p>`;
  if (!list.length) return `${nota}<p class="e19-kpi-note" data-renta-datos-resumen>${rentaDatosEscape(rentaDatosResumenTexto(list))}</p>`;
  return `${nota}<p class="e19-kpi-note" data-renta-datos-resumen>${rentaDatosEscape(rentaDatosResumenTexto(list))}</p>
    <ul class="renta-datos-lista">${list.map(rentaDatosFilaHtml).join("")}</ul>
    <p class="e19-kpi-note renta-datos-estado" role="status" data-renta-datos-estado></p>`;
}

function rentaDatosPosiciones() {
  return typeof iv1PositionsList === "function" ? iv1PositionsList() : [];
}

function renderRentaDatos() {
  const cuerpo = typeof document !== "undefined" ? document.getElementById("rentaDatosCuerpo") : null;
  if (cuerpo) cuerpo.innerHTML = rentaDatosHtml(rentaDatosPosiciones());
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
}

if (typeof module === "object" && module.exports) {
  module.exports = { rentaDatosHtml, rentaDatosResumen, rentaDatosResumenTexto, rentaDatosAplicar, RENTA_DATOS_TITULARES, RENTA_DATOS_DEPOSITARIOS };
} else if (typeof document !== "undefined") {
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", rentaDatosInit);
  else rentaDatosInit();
}
