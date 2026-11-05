// WP-21 · PR-2 (docs/WP21_DISENO.md §4): «Informe de inversión para la Renta», dentro de la tarjeta «Borrador de apoyo para la
// Renta» (GOB8) de Herramientas avanzadas › Fiscal. Es la parte de inversión que a ese borrador le faltaba: la base del ahorro de
// un declarante y un ejercicio, con lo que le falta para darla. El cálculo vive en canonical-tax-report.js (motor puro); aquí se
// juntan sus datos (posiciones, cobros, pérdidas arrastradas, recompras y la escala del hogar) y se pinta.
//
// Plegado («uno entra, uno sale», XGO-01: un <details> cerrado no suma titulares) y pintado al abrirlo. Script clásico cargado
// antes de app.js: comparte su ámbito (escapeHtml, money, iv1PositionsList, fc3PriorLossesList, latestIrpfScale…), y app.js lo
// llama al entrar en la vista con el motor como argumento (`renderInformeRenta(FinanceCanonicalTaxReport)`).

const INFORME_RENTA_DECLARANTES = [
  { value: "javi", label: "Javi" },
  { value: "tere", label: "Tere" },
];

const INFORME_RENTA_FALTA = {
  "position-without-holder": (m) => `«${m.label || "Una posición"}» tiene ventas este año y no se sabe de quién es. Dilo en Inversión › Cartera › Datos para la Renta.`,
  "sale-without-lots": (m) => `La venta del ${informeRentaFecha(m.date)} de «${m.label || "una posición"}» vende más unidades de las que constan compradas. Complétalo en el libro de operaciones.`,
  "sale-without-proceeds": (m) => `La venta del ${informeRentaFecha(m.date)} de «${m.label || "una posición"}» no tiene importe recibido. Complétalo en el libro de operaciones.`,
  "income-without-holder": (m) => `El cobro del ${informeRentaFecha(m.date)} no tiene titular. Dilo en Datos para la Renta (o el titular de su posición).`,
  "prior-loss-without-holder": (m) => `${m.count === 1 ? "Una pérdida arrastrada todavía aplicable no dice" : `${m.count} pérdidas arrastradas todavía aplicables no dicen`} de quién es. Vuelve a registrarla con su titular en Inversión › Fiscal.`,
  "missing-scale": () => "Para este ejercicio no hay escala del ahorro: regístrala en Ajustes › Fiscal (tipo «ahorro») con su fuente.",
  "income-without-spanish-withholding": (m) => `El cobro del ${informeRentaFecha(m.date)} no dice cuánto se retuvo en España: la cuota sale, pero lo ya pagado queda incompleto.`,
  "foreign-withholding-without-country": (m) => `El cobro del ${informeRentaFecha(m.date)} tiene retención en origen y no dice el país; la Renta lo pide para deducirla.`,
};

function informeRentaFecha(iso) {
  return String(iso || "").split("-").reverse().join("/");
}

function informeRentaEuros(value) {
  if (value === null || value === undefined) return "sin declarar";
  return typeof money === "function" ? money(value, true) : `${Number(value).toFixed(2).replace(".", ",")} €`;
}

function informeRentaEsc(value) {
  return typeof escapeHtml === "function" ? escapeHtml(value) : String(value ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
}

function informeRentaTabla(caption, head, rows) {
  if (!rows.length) return "";
  return `<div class="informe-renta-tabla" role="region" tabindex="0" aria-label="${informeRentaEsc(caption)}"><table>
      <caption>${informeRentaEsc(caption)}</caption>
      <thead><tr>${head.map((h, i) => `<th scope="col"${i >= 2 ? ' class="num"' : ""}>${informeRentaEsc(h)}</th>`).join("")}</tr></thead>
      <tbody>${rows.map((cells) => `<tr>${cells.map((c, i) => `<td${i >= 2 ? ' class="num"' : ""}>${informeRentaEsc(c)}</td>`).join("")}</tr>`).join("")}</tbody>
    </table></div>`;
}

const INFORME_RENTA_PASO = {
  "year-cross": (s) => `Pérdidas del año de ${s.from === "ganancias" ? "transmisiones" : "rendimientos"} compensadas con ${s.against === "ganancias" ? "las ganancias de transmisiones" : "los rendimientos"} (tope del 25 %): ${informeRentaEuros(s.amount)}.`,
  "prior-own": (s) => `Pérdida pendiente de ${s.year} (${s.bloque === "ganancias" ? "transmisiones" : "rendimientos"}) aplicada en su bloque: ${informeRentaEuros(s.amount)}.`,
  "prior-cross": (s) => `Pérdida pendiente de ${s.year} (${s.bloque === "ganancias" ? "transmisiones" : "rendimientos"}) aplicada en el otro bloque, dentro del tope del 25 %: ${informeRentaEuros(s.amount)}.`,
};

// El informe, ya calculado por el motor, en HTML. Puro: no lee nada de la página.
function informeRentaHtml(report, { declarante = "" } = {}) {
  if (!report || report.reason) return `<p class="e19-kpi-note">No se puede preparar el informe: falta el ejercicio o el declarante.</p>`;
  const quien = declarante || report.holder;
  const bloqueantes = report.missing.filter((m) => m.blocking);
  const avisos = report.missing.filter((m) => !m.blocking);
  const falta = report.missing.length
    ? `<div class="informe-renta-falta"><p><strong>${bloqueantes.length ? "Lo que falta para dar la cuota" : "Lo que conviene completar"}</strong></p><ul>${[...bloqueantes, ...avisos].map((m) => `<li>${informeRentaEsc((INFORME_RENTA_FALTA[m.code] || (() => m.code))(m))}</li>`).join("")}</ul></div>`
    : "";
  const t = report.totals;
  const estado = report.calculable
    ? `<p class="informe-renta-estado" data-informe-renta-estado><strong>${informeRentaEsc(quien)}, ${report.year}:</strong> base liquidable del ahorro estimada de ${informeRentaEsc(informeRentaEuros(report.compensation.base))} y cuota estimada de ${informeRentaEsc(informeRentaEuros(report.quota.net))}.</p>`
    : `<p class="informe-renta-estado" data-informe-renta-estado><strong>${informeRentaEsc(quien)}, ${report.year}:</strong> todavía no se puede dar la cuota. Lo que falta está justo debajo.</p>`;

  const transmisiones = informeRentaTabla(
    `Transmisiones de ${report.year}`,
    ["Fecha", "Posición", "Transmisión", "Adquisición", "Resultado"],
    report.transmissions.map((x) => [informeRentaFecha(x.date), `${x.label}${x.share < 1 ? " (50 %)" : ""}${x.deferredLoss ? ` · ${informeRentaEuros(-x.deferredLoss)} diferidos por recompra` : ""}`, informeRentaEuros(x.transmissionValue), informeRentaEuros(x.acquisitionValue), informeRentaEuros(x.integrable)]),
  );
  const rendimientos = informeRentaTabla(
    `Dividendos e intereses de ${report.year}`,
    ["Fecha", "Origen", "Íntegro", "Retención España", "Retención origen"],
    report.income.map((x) => [informeRentaFecha(x.date), `${x.kind === "interes" ? "Interés" : "Dividendo"} · ${x.label}${x.share < 1 ? " (50 %)" : ""}${x.country ? ` · ${x.country}` : ""}`, informeRentaEuros(x.gross), informeRentaEuros(x.spanishWithholding), informeRentaEuros(x.foreignWithholding)]),
  );
  const c = report.compensation;
  const pasos = c.steps.map((s) => `<li>${informeRentaEsc(INFORME_RENTA_PASO[s.kind](s))}</li>`).join("");
  const arrastre = [
    ...c.carryForward.map((x) => `Se arrastra a los 4 años siguientes: ${informeRentaEuros(x.amount)} de ${x.bloque === "ganancias" ? "transmisiones" : "rendimientos"} de ${x.year}.`),
    ...c.remainingPriorLosses.map((x) => `Sigue pendiente: ${informeRentaEuros(x.amount)} de ${x.bloque === "ganancias" ? "transmisiones" : "rendimientos"} de ${x.year}.`),
    ...c.expiredPriorLosses.map((x) => `Caduca este año sin aplicarse: ${informeRentaEuros(x.amount)} de ${x.bloque === "ganancias" ? "transmisiones" : "rendimientos"} de ${x.year}.`),
  ].map((text) => `<li>${informeRentaEsc(text)}</li>`).join("");
  const integracion = `<h4>Integración y compensación</h4>
    <ul class="informe-renta-lineas">
      <li>Saldo de ganancias y pérdidas por transmisiones: ${informeRentaEsc(informeRentaEuros(t.gpBalance))}${t.deferredLosses ? ` (sin ${informeRentaEsc(informeRentaEuros(-t.deferredLosses))} de pérdidas diferidas por recompra, que se integrarán cuando se vendan los valores recomprados)` : ""}.</li>
      <li>Saldo de rendimientos del capital mobiliario: ${informeRentaEsc(informeRentaEuros(t.rcmBalance))}.</li>
      ${pasos}
      <li><strong>Base liquidable del ahorro: ${informeRentaEsc(informeRentaEuros(c.base))}.</strong></li>
      ${arrastre}
    </ul>`;
  const cuota = report.quota
    ? `<h4>Cuota estimada</h4>
    <ul class="informe-renta-lineas">
      <li>Cuota íntegra del ahorro: ${informeRentaEsc(informeRentaEuros(report.quota.gross))} (tipo medio ${informeRentaEsc(String(report.quota.averageRatePct).replace(".", ","))} %), con ${report.quota.scaleOrigin === "hogar" ? "la escala del ahorro que registraste" : "la escala de la ley"}: ${informeRentaEsc(typeof report.quota.scaleSource === "string" ? report.quota.scaleSource : "fuente registrada en Ajustes › Fiscal")}.</li>
      ${report.doubleTaxDeduction.foreignPaid ? `<li>Deducción por doble imposición internacional: ${informeRentaEsc(informeRentaEuros(report.doubleTaxDeduction.deductible))} de ${informeRentaEsc(informeRentaEuros(report.doubleTaxDeduction.foreignPaid))} retenidos fuera${report.doubleTaxDeduction.notRecoverable ? `; ${informeRentaEsc(informeRentaEuros(report.doubleTaxDeduction.notRecoverable))} no se recuperan aquí (como mucho, lo que esa renta paga en España)` : ""}. Si el país retuvo más de lo que permite su convenio, lo deducible es como mucho el tipo del convenio: el informe no lo comprueba.</li>` : ""}
      <li><strong>Cuota estimada de la base del ahorro: ${informeRentaEsc(informeRentaEuros(report.quota.net))}.</strong> Retenido en España por dividendos e intereses: ${informeRentaEsc(informeRentaEuros(t.spanishWithholding))}${t.withholdingComplete ? "" : " (incompleto)"}. Las ventas de fondos también llevan retención; la app no la guarda: súmala del certificado de tu gestora.</li>
    </ul>`
    : "";
  const m = report.model720;
  const aviso720 = m.state === "above"
    ? `Valores depositados fuera de España por ${informeRentaEuros(m.valueAbroad)}: pasan de ${informeRentaEuros(m.threshold)}, así que toca el modelo 720 (bienes en el extranjero) si no lo presentaste ya con valores parecidos. Valor más reciente de la cartera, no el del 31/12.`
    : m.state === "unknown"
      ? `Modelo 720: sin saber. ${m.positionsUnknown === 1 ? "Una posición no dice" : `${m.positionsUnknown} posiciones no dicen`} dónde ${m.positionsUnknown === 1 ? "está depositada" : "están depositadas"}.`
      : `Modelo 720: los valores depositados fuera de España no pasan de ${informeRentaEuros(m.threshold)}.`;

  return `${estado}${falta}${transmisiones}${rendimientos}${integracion}${cuota}
    <p class="e19-kpi-note">${informeRentaEsc(aviso720)} Las posiciones conjuntas cuentan enteras para este umbral.</p>
    <p class="e19-kpi-note">Estimación de apoyo, no el modelo 100 ni asesoría: confirma cada cifra con los certificados fiscales del banco y la gestora. Si pagas custodia por valores, es deducible de los dividendos y aquí no se resta.</p>`;
}

// El mismo informe en CSV (punto y coma y coma decimal, como lo abre una hoja de cálculo en español).
function informeRentaCsv(report) {
  const num = (v) => (v === null || v === undefined ? "" : String(Math.round(Number(v) * 100) / 100).replace(".", ","));
  const cell = (v) => {
    const text = String(v ?? "");
    return /[";\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  };
  const rows = [["Bloque", "Fecha", "Concepto", "Importe", "Adquisición", "Retención España", "Retención origen", "País"]];
  report.transmissions.forEach((x) => rows.push(["Transmisión", x.date, `${x.label}${x.share < 1 ? " (50 %)" : ""}`, num(x.integrable), num(x.acquisitionValue), "", "", ""]));
  report.income.forEach((x) => rows.push([x.kind === "interes" ? "Interés" : "Dividendo", x.date, `${x.label}${x.share < 1 ? " (50 %)" : ""}`, num(x.gross), "", num(x.spanishWithholding), num(x.foreignWithholding), x.country]));
  rows.push(["Saldo transmisiones", "", "", num(report.totals.gpBalance), "", "", "", ""]);
  rows.push(["Saldo rendimientos", "", "", num(report.totals.rcmBalance), "", "", "", ""]);
  rows.push(["Base liquidable del ahorro", "", "", num(report.compensation.base), "", "", "", ""]);
  if (report.quota) rows.push(["Cuota estimada", "", report.quota.scaleOrigin === "hogar" ? "escala del hogar" : "escala de la ley", num(report.quota.net), "", "", "", ""]);
  return `${rows.map((r) => r.map(cell).join(";")).join("\n")}\n`;
}

// ---- Navegador: juntar los datos y pintar ----

function informeRentaDatos(engine, year, holder) {
  const portfolio = globalThis.FinanceCanonicalPortfolio;
  const ledger = globalThis.FinanceCanonicalPortfolioLedger;
  const raw = typeof iv1PositionsList === "function" ? iv1PositionsList() : [];
  const positions = portfolio ? portfolio.normalizePositions(raw).positions : [];
  const deferredBySale = {};
  if (ledger?.repurchaseAnalysis) raw.forEach((row, i) => ledger.repurchaseAnalysis(row, positions[i]).forEach((item) => { deferredBySale[item.id] = item.deferredLoss; }));
  const scale = typeof latestIrpfScale === "function" ? latestIrpfScale("savings") : null;
  const scaleOk = scale && globalThis.FinanceCanonicalIrpfEstimator?.validateBracketScale?.(scale)?.valid && (!scale.year || String(scale.year) === String(year));
  return engine.taxReport({
    year,
    holder,
    positions,
    deferredBySale,
    rendimientos: typeof scenarioSettings === "object" && Array.isArray(scenarioSettings?.wp21Rendimientos) ? scenarioSettings.wp21Rendimientos : [],
    priorLosses: typeof fc3PriorLossesList === "function" ? fc3PriorLossesList() : [],
    savingsScale: scaleOk ? scale : null,
  });
}

// Una línea por declarante para el texto del «Borrador de apoyo para la Renta» (GOB8, app.js). Pura: recibe los informes ya hechos.
function informeRentaResumenLineas(reports) {
  return (Array.isArray(reports) ? reports : []).map((r) => {
    const quien = INFORME_RENTA_DECLARANTES.find((d) => d.value === r?.holder)?.label || r?.holder || "";
    if (!r || r.reason) return `${quien}: sin informe (falta el ejercicio o el declarante).`;
    if (!r.calculable) {
      const n = r.missing.filter((m) => m.blocking).length;
      return `${quien}, ${r.year}: todavía sin cuota; ${n === 1 ? "falta 1 dato" : `faltan ${n} datos`} (detalle en el informe de inversión, más abajo).`;
    }
    return `${quien}, ${r.year}: base liquidable del ahorro estimada ${informeRentaEuros(r.compensation.base)}; cuota estimada ${informeRentaEuros(r.quota.net)} (${r.quota.scaleOrigin === "hogar" ? "escala del hogar" : "escala de la ley"}).`;
  });
}

// Lo que pide app.js al componer el borrador: los dos declarantes del ejercicio elegido en el informe (o el año en curso).
function informeRentaResumenTexto() {
  const engine = informeRentaEngine || globalThis.FinanceCanonicalTaxReport;
  if (!engine) return "Sin datos: el informe de inversión no está disponible.";
  const year = document.getElementById("informeRentaAno")?.value || String(new Date().getFullYear());
  return informeRentaResumenLineas(INFORME_RENTA_DECLARANTES.map((d) => informeRentaDatos(engine, year, d.value))).join("\n");
}

// Imprimir solo el informe: la hoja de impresión (styles.css, `body.imprimiendo-informe-renta`) oculta todo lo demás.
function informeRentaImprimir() {
  const caja = document.getElementById("informeRenta");
  if (!caja) return;
  caja.open = true;
  informeRentaPintar();
  // Los antepasados se marcan aquí, y no con `:has()` en la hoja de impresión, que en WebKit cuesta un recorrido del árbol
  // por elemento (styles.css lo explica).
  const antepasados = [];
  for (let nodo = caja.parentElement; nodo && nodo !== document.body; nodo = nodo.parentElement) antepasados.push(nodo);
  antepasados.forEach((nodo) => nodo.setAttribute("data-informe-renta-ancestro", ""));
  document.documentElement.classList.add("imprimiendo-informe-renta");
  document.body.classList.add("imprimiendo-informe-renta");
  const quitar = () => {
    document.documentElement.classList.remove("imprimiendo-informe-renta");
    document.body.classList.remove("imprimiendo-informe-renta");
    antepasados.forEach((nodo) => nodo.removeAttribute("data-informe-renta-ancestro"));
    window.removeEventListener("afterprint", quitar);
  };
  window.addEventListener("afterprint", quitar);
  window.print();
}

let informeRentaEngine = null;
let informeRentaUltimo = null;

function informeRentaPintar() {
  const caja = document.getElementById("informeRenta");
  const cuerpo = document.getElementById("informeRentaCuerpo");
  if (!caja || !cuerpo || !caja.open || !informeRentaEngine) return;
  const year = document.getElementById("informeRentaAno")?.value || String(new Date().getFullYear());
  const holder = document.getElementById("informeRentaDeclarante")?.value || "javi";
  informeRentaUltimo = informeRentaDatos(informeRentaEngine, year, holder);
  const label = INFORME_RENTA_DECLARANTES.find((d) => d.value === holder)?.label || holder;
  cuerpo.innerHTML = informeRentaHtml(informeRentaUltimo, { declarante: label });
}

function informeRentaDescargar() {
  if (!informeRentaUltimo || informeRentaUltimo.reason) return;
  const blob = new Blob([`﻿${informeRentaCsv(informeRentaUltimo)}`], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `informe-renta-${informeRentaUltimo.year}-${informeRentaUltimo.holder}.csv`;
  link.style.display = "none";
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

// Lo llama app.js al entrar en Herramientas avanzadas › Fiscal, con el motor.
function renderInformeRenta(engine) {
  const caja = document.getElementById("informeRenta");
  if (!caja || !engine) return;
  informeRentaEngine = engine;
  const anos = document.getElementById("informeRentaAno");
  if (anos && !anos.options.length) {
    const actual = new Date().getFullYear();
    anos.innerHTML = [actual, actual - 1, actual - 2].map((y) => `<option value="${y}">${y}${y === actual ? " (provisional)" : ""}</option>`).join("");
  }
  if (!caja.__informeRenta) {
    caja.__informeRenta = true;
    caja.addEventListener("toggle", informeRentaPintar);
    caja.addEventListener("change", (event) => { if (event.target?.closest?.("[data-informe-renta-control]")) informeRentaPintar(); });
    document.getElementById("informeRentaCsv")?.addEventListener("click", informeRentaDescargar);
    document.getElementById("informeRentaImprimir")?.addEventListener("click", informeRentaImprimir);
  }
  informeRentaPintar();
}

if (typeof module === "object" && module.exports) {
  module.exports = { informeRentaHtml, informeRentaCsv, informeRentaResumenLineas };
}
