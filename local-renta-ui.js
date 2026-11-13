// WP-21 · PR-3 (FIS-03; docs/WP21_DISENO.md §11): «El local alquilado para la Renta», plegado dentro de la tarjeta «Borrador de
// apoyo para la Renta» (GOB8) de Herramientas avanzadas › Fiscal, junto al informe de inversión. Los datos del contrato y de la
// compra, y los de cada ejercicio, se teclean aquí y viven en `scenarioSettings.wp21Local` (misma copia y misma nube que los cobros
// del PR-0b; nada sale del dispositivo). El cálculo es de canonical-rental-tax.js (puro); aquí se lee, se guarda y se pinta.
//
// Vacío es «sin declarar», nunca 0. Script clásico cargado antes de app.js: comparte su ámbito (scenarioSettings,
// saveScenarioSettings, parseAmountField, money…) y los ayudantes de informe-renta-ui.js (informeRentaEsc, informeRentaEuros). app.js se lo pasa al entrar en Fiscal (renderLocalRenta, junto a renderInformeRenta): sin escuchas al cargarse.

const LOCAL_RENTA_DECLARANTES = [
  { value: "javi", label: "Javi" },
  { value: "tere", label: "Tere" },
];
const LOCAL_RENTA_TITULARES = [
  { value: "", label: "Sin declarar" },
  { value: "javi", label: "Javi" },
  { value: "tere", label: "Tere" },
  { value: "household", label: "De los dos (50 % cada uno)" },
];
const LOCAL_RENTA_GASTOS = [
  ["ibi", "IBI"], ["comunidad", "Comunidad"], ["seguro", "Seguro"], ["tasas", "Tasas (basuras…)"],
  ["suministros", "Suministros a vuestro cargo"], ["gestion", "Gestión y administración"], ["otros", "Otros gastos"],
];
const LOCAL_RENTA_FALTA = {
  "rent-missing": "La renta mensual sin IVA del contrato.",
  "months-missing": "Cuántos meses estuvo alquilado este año.",
  "holder-missing": "De quién es el local (Javi, Tere o los dos).",
  "amortization-base-missing": "El coste de compra con su parte de construcción o el valor catastral de la construcción (está en el recibo del IBI): sin ellos no se resta la amortización.",
  "accumulated-amortization-missing": "La amortización ya deducida en años anteriores: sin ella no se comprueba el tope.",
  "imputation-data-missing": (m) => `Los ${m.months} ${m.months === 1 ? "mes" : "meses"} sin alquilar imputan renta: falta el valor catastral total y si es el 2 % o el 1,1 % (revisado).`,
  "withholding-unknown": "Si el inquilino es empresa o profesional y os retiene el 19 % (lo dice el contrato o su certificado).",
  "carry-expired": (m) => `${m.count === 1 ? "Un importe pendiente es" : `${m.count} importes pendientes son`} de hace más de 4 años: ya no se deducen.`,
};

function localRentaEsc(value) {
  return typeof informeRentaEsc === "function" ? informeRentaEsc(value) : String(value ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
}

/** Con el signo menos de verdad («−2.000 €»), como el resto de cifras de la app; «sin declarar» si no hay dato. */
function localRentaEuros(value) {
  if (value === null || value === undefined) return "sin declarar";
  const n = Number(value);
  const abs = typeof informeRentaEuros === "function" ? informeRentaEuros(Math.abs(n)) : `${Math.abs(n).toFixed(2).replace(".", ",")} €`;
  return n < 0 ? `−${abs}` : abs;
}

/** Lo tecleado → número, null si está en blanco («sin declarar») o NaN si no se entiende. */
function localRentaNumero(text) {
  const raw = String(text ?? "").trim();
  if (!raw) return null;
  // El campo de importe unificado (WP-11, es-ES): «1.500» son mil quinientos, no uno y medio (parseAmount lo leería así).
  const value = typeof parseAmountField === "function" ? parseAmountField(raw) : Number(raw.replace(/\./g, "").replace(",", "."));
  return typeof value === "number" && Number.isFinite(value) ? Math.round(value * 100) / 100 : NaN;
}

function localRentaDatos() {
  const saved = typeof scenarioSettings === "object" && scenarioSettings ? scenarioSettings.wp21Local : null;
  return { inmueble: saved?.inmueble && typeof saved.inmueble === "object" ? saved.inmueble : {}, ejercicios: saved?.ejercicios && typeof saved.ejercicios === "object" ? saved.ejercicios : {} };
}

function localRentaGuardar(next) {
  if (typeof scenarioSettings !== "object" || !scenarioSettings || typeof saveScenarioSettings !== "function") return false;
  scenarioSettings.wp21Local = next;
  saveScenarioSettings();
  return true;
}

/** Lo pendiente del año: lo tecleado o, si no hay, lo que arrastró el año anterior guardado. */
function localRentaPendientes(engine, datos, year) {
  const propio = datos.ejercicios[year]?.pendientes;
  if (Array.isArray(propio)) return propio;
  const anterior = datos.ejercicios[String(Number(year) - 1)];
  if (!anterior) return [];
  return engine.propertyYear({ year: Number(year) - 1, property: datos.inmueble, yearData: anterior }).arrastre;
}

function localRentaInforme(engine, datos, year, holder) {
  const yearData = { ...(datos.ejercicios[year] || {}), pendientes: localRentaPendientes(engine, datos, year) };
  return engine.rentalReport({ year: Number(year), holder, property: datos.inmueble, yearData });
}

function localRentaCampo(id, label, value, extra = "") {
  // aria-label: dentro de su <label>, el nombre accesible llevaría también lo tecleado (o la opción elegida, en un <select>).
  return `<label><span>${localRentaEsc(label)}</span><input type="text" inputmode="decimal" autocomplete="off" aria-label="${localRentaEsc(label)}" data-local-renta="${id}" value="${value === null || value === undefined ? "" : localRentaEsc(String(value).replace(".", ","))}"${extra} /></label>`;
}

function localRentaSelect(id, label, options, value) {
  return `<label><span>${localRentaEsc(label)}</span><select aria-label="${localRentaEsc(label)}" data-local-renta="${id}">${options.map(([v, t]) => `<option value="${localRentaEsc(v)}"${String(v) === String(value ?? "") ? " selected" : ""}>${localRentaEsc(t)}</option>`).join("")}</select></label>`;
}

function localRentaFormHtml(engine, datos, year) {
  const p = datos.inmueble;
  const e = datos.ejercicios[year] || {};
  const act = p.actualizacion || {};
  const pendientes = localRentaPendientes(engine, datos, year);
  const previos = [1, 2, 3, 4].map((n) => Number(year) - n);
  const meses = [["", "Sin declarar"], ...Array.from({ length: 12 }, (_, i) => [String(i + 1), new Date(2026, i, 1).toLocaleDateString("es-ES", { month: "long" })])];
  return `<fieldset class="local-renta-grupo"><legend>El contrato y la compra (una vez)</legend>
      ${localRentaSelect("titular", "De quién es", LOCAL_RENTA_TITULARES.map((t) => [t.value, t.label]), p.titular)}
      ${localRentaCampo("rentaMensual", "Renta al mes, sin IVA (€)", p.rentaMensual)}
      ${localRentaSelect("inquilinoRetiene", "¿El inquilino os retiene el 19 %?", [["", "Sin declarar"], ["si", "Sí (empresa o profesional)"], ["no", "No"]], p.inquilinoRetiene === true ? "si" : p.inquilinoRetiene === false ? "no" : "")}
      ${localRentaSelect("actTipo", "La renta se actualiza", [["", "Sin declarar"], ["ipc", "Con el IPC"], ["fijo", "Un porcentaje fijo"], ["ninguna", "No se actualiza"]], act.tipo)}
      ${localRentaSelect("actMes", "Mes de la actualización", meses, act.mes)}
      ${localRentaCampo("actPorcentaje", "Porcentaje fijo (%)", act.porcentaje)}
      ${localRentaCampo("costeAdquisicion", "Coste de compra, con gastos e impuestos (€)", p.costeAdquisicion)}
      ${localRentaCampo("pctConstruccion", "Parte de construcción del coste (%)", p.pctConstruccion)}
      ${localRentaCampo("valorCatastralConstruccion", "Valor catastral de la construcción (€)", p.valorCatastralConstruccion)}
      ${localRentaCampo("valorCatastralTotal", "Valor catastral total (€)", p.valorCatastralTotal)}
      ${localRentaSelect("pctImputacion", "Imputación de los meses vacíos", [["", "Sin declarar"], ["2", "2 % del valor catastral"], ["1.1", "1,1 % (valor catastral revisado)"]], p.pctImputacion)}
      ${localRentaCampo("amortizacionAcumulada", `Amortización ya deducida hasta ${Number(year) - 1} (€)`, p.amortizacionAcumulada)}
    </fieldset>
    <fieldset class="local-renta-grupo"><legend>El ejercicio ${localRentaEsc(year)}</legend>
      ${localRentaCampo("mesesAlquilado", "Meses alquilado (0 a 12)", e.mesesAlquilado)}
      ${localRentaCampo("otrosIngresos", "Lo que el inquilino paga por vosotros (€)", e.otrosIngresos)}
      ${LOCAL_RENTA_GASTOS.map(([id, label]) => localRentaCampo(id, `${label} (€)`, e[id])).join("")}
      ${localRentaCampo("intereses", "Intereses de la financiación (€)", e.intereses)}
      ${localRentaCampo("reparacion", "Reparación y conservación (€)", e.reparacion)}
      ${localRentaCampo("retencion", "Retención del certificado del inquilino (€)", e.retencion)}
      ${previos.map((y) => localRentaCampo(`pendiente-${y}`, `Intereses y reparación pendientes de ${y} (€)`, pendientes.find((item) => Number(item.year) === y)?.amount ?? null)).join("")}
    </fieldset>
    <p class="local-renta-acciones"><button type="button" class="e19-btn e19-btn-secondary" data-local-renta-guardar>Guardar el local</button> <span class="e19-kpi-note" role="status" data-local-renta-estado></span></p>`;
}

/** Lee el formulario: el inmueble y el ejercicio, o el primer campo que no se entiende. */
function localRentaLeer(caja, year) {
  const valor = (id) => caja.querySelector(`[data-local-renta="${id}"]`)?.value ?? "";
  const numeros = {};
  const ids = ["rentaMensual", "actPorcentaje", "costeAdquisicion", "pctConstruccion", "valorCatastralConstruccion", "valorCatastralTotal", "amortizacionAcumulada", "mesesAlquilado", "otrosIngresos", "intereses", "reparacion", "retencion", ...LOCAL_RENTA_GASTOS.map(([id]) => id)];
  for (const id of ids) {
    numeros[id] = localRentaNumero(valor(id));
    if (Number.isNaN(numeros[id]) || (numeros[id] !== null && numeros[id] < 0 && id !== "actPorcentaje")) return { error: id };
  }
  if (numeros.mesesAlquilado !== null && !(Number.isInteger(numeros.mesesAlquilado) && numeros.mesesAlquilado <= 12)) return { error: "mesesAlquilado" };
  if (numeros.pctConstruccion !== null && numeros.pctConstruccion > 100) return { error: "pctConstruccion" };
  const pendientes = [1, 2, 3, 4].map((n) => Number(year) - n).map((y) => ({ year: y, amount: localRentaNumero(valor(`pendiente-${y}`)) }));
  const malo = pendientes.find((item) => Number.isNaN(item.amount) || (item.amount !== null && item.amount < 0));
  if (malo) return { error: `pendiente-${malo.year}` };
  const retiene = valor("inquilinoRetiene");
  return {
    inmueble: {
      titular: ["javi", "tere", "household"].includes(valor("titular")) ? valor("titular") : "",
      rentaMensual: numeros.rentaMensual,
      inquilinoRetiene: retiene === "si" ? true : retiene === "no" ? false : null,
      actualizacion: { tipo: valor("actTipo"), mes: valor("actMes") ? Number(valor("actMes")) : null, porcentaje: numeros.actPorcentaje },
      costeAdquisicion: numeros.costeAdquisicion,
      pctConstruccion: numeros.pctConstruccion,
      valorCatastralConstruccion: numeros.valorCatastralConstruccion,
      valorCatastralTotal: numeros.valorCatastralTotal,
      pctImputacion: valor("pctImputacion") ? Number(valor("pctImputacion")) : null,
      amortizacionAcumulada: numeros.amortizacionAcumulada,
    },
    ejercicio: {
      mesesAlquilado: numeros.mesesAlquilado,
      otrosIngresos: numeros.otrosIngresos,
      ...Object.fromEntries(LOCAL_RENTA_GASTOS.map(([id]) => [id, numeros[id]])),
      intereses: numeros.intereses,
      reparacion: numeros.reparacion,
      retencion: numeros.retencion,
      pendientes: pendientes.filter((item) => item.amount !== null && item.amount > 0),
    },
  };
}

function localRentaCuentaHtml(report, quien) {
  // «No es suyo» solo con el titular declarado: sin él, falta un dato (se dice abajo), no es que el local sea del otro.
  if (!report.share && !report.blocking) return `<p class="e19-kpi-note" data-local-renta-declarante="${localRentaEsc(report.holder)}">${localRentaEsc(quien)}: el local no es suyo, no declara nada de él.</p>`;
  const parte = report.share < 1 ? " (su 50 %)" : "";
  const filas = [
    ["Ingresos íntegros", localRentaEuros(report.ingresos)],
    ["Intereses y reparación (hasta los ingresos)", localRentaEuros(-report.gastos.limitados)],
    ["Otros gastos (IBI, comunidad, seguro…)", localRentaEuros(-report.gastos.otros)],
    [`Amortización (3 %)${report.gastos.topeAlcanzado ? ", hasta el tope" : ""}`, localRentaEuros(-report.gastos.amortizacion)],
    ["Rendimiento neto (sin reducción: no es vivienda)", localRentaEuros(report.neto)],
    ...(report.imputacion ? [["Imputación de los meses sin alquilar", localRentaEuros(report.imputacion)]] : []),
    ["A la base general", localRentaEuros(report.baseGeneral)],
    [`Retención ya practicada${report.retencionCalculada ? " (19 % de la renta)" : ""}`, localRentaEuros(report.retencion)],
  ];
  const caption = `${quien}, ${report.year}${parte}`;
  const tabla = `<div class="informe-renta-tabla" role="region" tabindex="0" aria-label="${localRentaEsc(caption)}"><table class="local-renta-tabla">
      <caption>${localRentaEsc(caption)}</caption>
      <thead><tr><th scope="col">Concepto</th><th scope="col" class="num">Importe</th></tr></thead>
      <tbody>${filas.map(([c, v]) => `<tr><th scope="row">${localRentaEsc(c)}</th><td class="num">${localRentaEsc(v)}</td></tr>`).join("")}</tbody>
    </table></div>`;
  const frase = report.blocking
    ? `${quien}, ${report.year}: todavía no se puede dar la cifra. Lo que falta está debajo.`
    : `${quien}, ${report.year}: a la base general ${localRentaEuros(report.baseGeneral)}${parte}; ya retenido ${localRentaEuros(report.retencion)}.`;
  return `<div class="local-renta-cuenta" data-local-renta-declarante="${localRentaEsc(report.holder)}"><p class="informe-renta-estado"><strong>${localRentaEsc(frase)}</strong></p>${report.blocking ? "" : tabla}</div>`;
}

function localRentaFechaLarga(iso) {
  const [y, m, d] = String(iso).split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("es-ES", { day: "numeric", month: "long", year: "numeric" });
}

function localRentaActualizacionHtml(engine, inmueble, today) {
  const u = engine.nextRentUpdate(inmueble, today);
  if (u.status === "sin-clausula" || u.status === "sin-mes") return `<p class="e19-kpi-note" data-local-renta-actualizacion="falta">Actualización de la renta: di cómo y en qué mes la actualiza el contrato y aquí saldrá el aviso.</p>`;
  if (u.status === "ninguna") return "";
  const cuando = `${localRentaFechaLarga(u.date)}, en ${u.days} ${u.days === 1 ? "día" : "días"}`;
  const que = u.tipo === "fijo"
    ? `sube un ${String(u.porcentaje ?? "").replace(".", ",")} %${u.nueva !== null ? `: de ${localRentaEuros(inmueble.rentaMensual)} a ${localRentaEuros(u.nueva)} al mes` : ""}`
    : "con el IPC: cuando se publique el dato de su mes, tecléalo en Deuda › Contratos › Índices y aplícalo a la renta";
  return `<p class="e19-kpi-note${u.soon ? " negative" : ""}" data-local-renta-actualizacion="${u.soon ? "pronto" : "ok"}"><strong>La renta se actualiza el ${localRentaEsc(cuando)}</strong> y ${localRentaEsc(que)}. Avisad al inquilino por escrito si el contrato lo pide.</p>`;
}

let localRentaEngine = null;

/** El ejercicio elegido en el selector del local (el actual, provisional, y los dos anteriores). */
function localRentaAno() {
  return document.getElementById("rentaLocalAno")?.value || String(new Date().getFullYear());
}

function localRentaPintar(mensaje = "") {
  const caja = document.getElementById("rentaLocal");
  const cuerpo = document.getElementById("rentaLocalCuerpo");
  const engine = localRentaEngine || globalThis.FinanceCanonicalRentalTax;
  if (!caja || !cuerpo || !caja.open || !engine) return;
  const year = localRentaAno();
  const datos = localRentaDatos();
  const today = typeof isoLocalDate === "function" ? isoLocalDate(new Date()) : "";
  const informes = LOCAL_RENTA_DECLARANTES.map((d) => ({ d, r: localRentaInforme(engine, datos, year, d.value) }));
  const falta = informes[0].r.falta;
  const faltaHtml = falta.length ? `<div class="informe-renta-falta"><p><strong>${falta.some((m) => m.blocking) ? "Lo que falta para dar la cifra" : "Lo que conviene completar"}</strong></p><ul>${falta.map((m) => { const t = LOCAL_RENTA_FALTA[m.code]; return `<li>${localRentaEsc(typeof t === "function" ? t(m) : t || m.code)}</li>`; }).join("")}</ul></div>` : "";
  const r = informes[0].r;
  const arrastre = [
    ...r.arrastre.map((x) => `Intereses y reparación que no caben este año: ${localRentaEuros(x.amount)} de ${x.year}, a los 4 años siguientes.`),
    ...r.pierde.map((x) => `Caduca sin deducirse: ${localRentaEuros(x.amount)} de ${x.year}.`),
  ];
  cuerpo.innerHTML = `${localRentaActualizacionHtml(engine, datos.inmueble, today)}
    ${informes.map(({ d, r: rep }) => localRentaCuentaHtml(rep, d.label)).join("")}
    ${arrastre.length ? `<ul class="informe-renta-lineas">${arrastre.map((t) => `<li>${localRentaEsc(t)}</li>`).join("")}</ul>` : ""}
    ${faltaHtml}
    <details class="local-renta-datos"${datos.inmueble.rentaMensual === undefined || datos.inmueble.rentaMensual === null ? " open" : ""}><summary>Los datos del local (${localRentaEsc(year)})</summary>${localRentaFormHtml(engine, datos, year)}</details>
    <p class="e19-kpi-note">Es un apoyo, no la declaración: ni mobiliario, ni mejoras, ni el IVA del alquiler. Las reglas, en docs/WP21_DISENO.md §11.</p>`;
  if (mensaje) {
    const estado = cuerpo.querySelector("[data-local-renta-estado]");
    if (estado) estado.textContent = mensaje;
  }
}

const LOCAL_RENTA_ETIQUETA = { mesesAlquilado: "los meses alquilado (un número entero de 0 a 12)", pctConstruccion: "la parte de construcción (de 0 a 100)" };

function localRentaGuardarClick() {
  const caja = document.getElementById("rentaLocal");
  if (!caja) return;
  const year = localRentaAno();
  const leido = localRentaLeer(caja, year);
  if (leido.error) {
    const campo = caja.querySelector(`[data-local-renta="${leido.error}"]`);
    campo?.setAttribute("aria-invalid", "true");
    campo?.focus();
    const estado = caja.querySelector("[data-local-renta-estado]");
    if (estado) estado.textContent = `No se entiende ${LOCAL_RENTA_ETIQUETA[leido.error] || "ese importe"}: escríbelo como 1.234,56 o déjalo en blanco.`;
    return;
  }
  const datos = localRentaDatos();
  const ok = localRentaGuardar({ inmueble: leido.inmueble, ejercicios: { ...datos.ejercicios, [year]: leido.ejercicio } });
  localRentaPintar(ok ? `Guardado el local (${year}).` : "No se ha podido guardar.");
  if (ok && typeof announceStatus === "function") announceStatus(`Guardados los datos del local para ${year}.`);
}

/** Una línea por declarante para el borrador GOB8 (app.js): a la base general y lo retenido, o lo que falta. */
function localRentaResumenTexto() {
  const engine = localRentaEngine || globalThis.FinanceCanonicalRentalTax;
  if (!engine) return "Sin datos: el cálculo del local no está disponible.";
  const datos = localRentaDatos();
  if (datos.inmueble.rentaMensual === undefined || datos.inmueble.rentaMensual === null) return "Sin datos del local todavía (El local alquilado para la Renta, más abajo).";
  const year = localRentaAno();
  return LOCAL_RENTA_DECLARANTES.map((d) => {
    const r = localRentaInforme(engine, datos, year, d.value);
    if (r.blocking) return `${d.label}, ${year}: todavía sin cifra del local; ${r.falta.filter((m) => m.blocking).length} datos por completar.`;
    if (!r.share) return `${d.label}: el local no es suyo.`;
    return `${d.label}, ${year}: local, a la base general ${localRentaEuros(r.baseGeneral)}; retenido ${localRentaEuros(r.retencion)}.`;
  }).join("\n");
}

// Lo llama app.js al entrar en Herramientas avanzadas › Fiscal, con el motor.
function renderLocalRenta(engine) {
  const caja = document.getElementById("rentaLocal");
  if (!caja || !engine) return;
  localRentaEngine = engine;
  if (!caja.__localRenta) {
    caja.__localRenta = true;
    caja.addEventListener("toggle", () => localRentaPintar());
    caja.addEventListener("click", (event) => { if (event.target?.closest?.("[data-local-renta-guardar]")) localRentaGuardarClick(); });
    document.getElementById("rentaLocalAno")?.addEventListener("change", () => localRentaPintar());
  }
  const anos = document.getElementById("rentaLocalAno");
  if (anos && !anos.options.length) {
    const actual = new Date().getFullYear();
    anos.innerHTML = [actual, actual - 1, actual - 2].map((y) => `<option value="${y}">${y}${y === actual ? " (provisional)" : ""}</option>`).join("");
  }
  localRentaPintar();
}

if (typeof module === "object" && module.exports) {
  module.exports = { localRentaLeer, localRentaCuentaHtml, localRentaActualizacionHtml, localRentaPendientes };
}
