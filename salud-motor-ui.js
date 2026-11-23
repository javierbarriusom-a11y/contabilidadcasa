// DUO-04 (duodécima auditoría; recoge UND-03 y UND-22): «Salud del cálculo» en Ajustes › Uso de la app. Plegada y sin titular nuevo (como la
// huella del extracto): el resumen va en la propia línea plegada («● Todo calculado (4 de 4)») y se abre sola si algo falla. Dentro, una fila
// por motor con su forma (● ◐ ○: el estado no depende solo del color), cuándo se calculó y sus filas; el último error del recálculo si lo hay;
// la fecha del último extracto de cada cuenta; y «Recalcular todo», que rehace los motores como el «Recalcular» de Hoy (UND-02).
//
// Script de pantalla: comparte el ámbito global de app.js (qs, escapeHtml, isoLocalDate, render, canonicalEngineRuns…). Sin DOM al cargarse:
// renderAjustes() llama a `renderSaludMotor`, que engancha su escucha la primera vez.

let saludMotorEnganchado = false;
let saludMotorRecalculadoEn = null;

function saludMotorHoy() {
  // El día del hogar (hora local), nunca el de toISOString (UTC).
  return isoLocalDate(new Date());
}

function saludMotorCuando(iso) {
  if (!iso) return "";
  const fecha = new Date(iso);
  if (Number.isNaN(fecha.getTime())) return "";
  const minutos = Math.round((Date.now() - fecha.getTime()) / 60000);
  if (minutos < 1) return "calculado ahora";
  if (minutos < 60) return `calculado hace ${minutos} min`;
  const dia = fecha.toLocaleDateString("es-ES", { day: "numeric", month: "short" });
  const hora = fecha.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" });
  return `calculado el ${dia}, a las ${hora}`;
}

// Lo que el motor de deuda dice de los contratos de hoy: cuántos entran, cuántos no y cuántos de esos tienen los pagos suspendidos.
function saludMotorDeuda() {
  try {
    const Path = globalThis.FinanceCanonicalDebtPayoffPath;
    const contratos = typeof escenarioMotorDebtOptions === "function" ? escenarioMotorDebtOptions() : [];
    if (!Path) return { ok: false };
    const r = Path.project(contratos, { startMonthKey: saludMotorHoy().slice(0, 7) });
    if (!r.ok) return { ok: false };
    return { ok: true, included: (r.included || []).length, excluded: (r.excluded || []).length, suspended: (r.excluded || []).filter((row) => row.suspended).length };
  } catch {
    return { ok: false };
  }
}

function saludMotorEntrada() {
  const Salud = globalThis.FinanceSaludMotor;
  const hoy = saludMotorHoy();
  /* global canonicalEngineRuns, canonicalDailyEngineRuns, canonicalScenarioResults, modelRecomputeError, baseData */
  return {
    monthly: typeof canonicalEngineRuns === "object" ? canonicalEngineRuns?.active : null,
    daily: typeof canonicalDailyEngineRuns === "object" ? canonicalDailyEngineRuns?.active : null,
    forecast: typeof canonicalScenarioResults === "object" ? canonicalScenarioResults?.active?.forecast : null,
    deuda: saludMotorDeuda(),
    recalculoError: typeof modelRecomputeError === "undefined" ? null : modelRecomputeError,
    extractos: Salud.extractos(typeof baseData === "object" ? baseData?.transactions : [], globalThis.FinanceCanonicalBalancePulse?.ACCOUNTS || [], hoy),
  };
}

function saludMotorExtractoTexto(item) {
  if (item.sinExtracto) return "sin movimientos importados";
  const dias = item.dias <= 0 ? "hoy" : item.dias === 1 ? "ayer" : `hace ${item.dias} días`;
  return `último movimiento ${dias}${item.atrasado ? " · atrasado" : ""}`;
}

function saludMotorHtml(d) {
  const filas = d.filas.map((fila) => `<li class="salud-motor-fila" data-salud-estado="${fila.estado}">
      <span class="salud-motor-forma" aria-hidden="true">${fila.forma}</span>
      <span><strong>${escapeHtml(fila.nombre)}</strong> <span class="sr-only">(${fila.estado === "ok" ? "bien" : fila.estado === "aviso" ? "aviso" : "falla"})</span><br>
      <span class="salud-motor-detalle">${escapeHtml([fila.detalle, saludMotorCuando(fila.calculado)].filter(Boolean).join(" "))}</span></span>
    </li>`).join("");
  const recalculo = d.recalculo
    ? `<p class="salud-motor-error" role="alert"><strong>El último recálculo falló</strong>: las cifras que veis son las de antes. ${escapeHtml(d.recalculo.mensaje)}</p>`
    : "";
  const extractos = d.extractos.length
    ? `<p class="e19-kpi-note"><strong>Extractos</strong> (atrasado: más de ${globalThis.FinanceSaludMotor.EXTRACTO_DIAS} días sin movimientos):</p>
      <ul class="salud-motor-extractos">${d.extractos.map((item) => `<li data-salud-extracto="${escapeHtml(item.id)}"${item.atrasado ? ' class="is-atrasado"' : ""}>${escapeHtml(item.label)}: ${escapeHtml(saludMotorExtractoTexto(item))}</li>`).join("")}</ul>`
    : "";
  const hecho = saludMotorRecalculadoEn ? `Recalculado a las ${new Date(saludMotorRecalculadoEn).toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" })}.` : "";
  return `${recalculo}<ul class="salud-motor-lista" aria-label="Estado de cada cálculo">${filas}</ul>${extractos}
    <p class="salud-motor-acciones"><button type="button" class="e19-btn e19-btn-secondary" data-salud-recalcular>Recalcular todo</button> <span role="status" data-salud-estado-recalculo>${escapeHtml(hecho)}</span></p>`;
}

function renderSaludMotor() {
  const card = typeof qs === "function" ? qs("saludMotorCard") : null;
  const Salud = globalThis.FinanceSaludMotor;
  if (!card || !Salud) return;
  try {
    const d = Salud.diagnostico(saludMotorEntrada());
    card.dataset.saludEstado = d.estado;
    const resumen = card.querySelector("[data-salud-resumen]");
    if (resumen) resumen.textContent = `${d.forma} Salud del cálculo · ${d.resumen}`;
    const cuerpo = card.querySelector("[data-salud-cuerpo]");
    if (cuerpo) cuerpo.innerHTML = saludMotorHtml(d);
    if (d.estado === "falla") card.open = true;
  } catch (error) {
    console.error(`renderSaludMotor: ${error.message}`);
  }
  if (!saludMotorEnganchado) {
    saludMotorEnganchado = true;
    card.addEventListener("click", (event) => {
      if (!event.target.closest("[data-salud-recalcular]")) return;
      globalThis.FinanceMedidor?.anotar("salud-motor", "accion");
      // Como «Recalcular» de Hoy (UND-02): se descartan las copias en memoria y se rehace todo.
      /* global canonicalDailyEngineRuns:writable, simulationSignature:writable */
      canonicalDailyEngineRuns = { base: null, active: null, planned: null };
      simulationSignature = "";
      saludMotorRecalculadoEn = Date.now();
      if (typeof render === "function") render();
      renderSaludMotor();
    });
  }
}

globalThis.renderSaludMotor = renderSaludMotor;
