// XDA-01 · PR-1 (docs/XDA01_DISENO.md): la tarjeta «Lo que la app te pide» de Ajustes › Uso de la app. El cálculo vive en
// canonical-data-contracts.js (puro); la frescura de cada fuente y los minutos de cada tarea, en datos-ui.js (WP-45), que se reutiliza tal cual.
// Nace apagada en Funciones en prueba (XGO-03): sin encenderla, la tarjeta no se ve. No hace ninguna tarea ni cambia un dato: cada dato que
// falta lleva a la pantalla donde se da. Pausar una función y plegar las que tienen hambre quedan para el PR-2.
//
// Script de pantalla: se carga antes de app.js y comparte su ámbito global (qs, escapeHtml, isoLocalDate, datosSources, datosCards,
// datosTasks…). Sin llamadas al DOM al cargarse: renderAjustes, en app.js, llama a `renderLoQuePide`.

function loQuePideOn() {
  return globalThis.FinanceFuncionesEnPrueba?.encendida?.("lo-que-pide") === true;
}

// Lo que ya sabe WP-45, en la forma que pide el motor: la frescura de cada fuente, sus minutos (medidos o supuestos) y qué aplica.
function loQuePideInput(today) {
  const queue = globalThis.FinanceCanonicalDataQueue;
  const source = datosSources(today);
  const freshness = Object.fromEntries(datosCards(queue, source, today).map((card) => [card.id, card]));
  const minutes = Object.fromEntries(datosTasks(queue, source, today).filter((task) => task.minutes).map((task) => [task.id, task.minutes]));
  // La tarea de cobros pendientes cuesta según cuántos haya; sin ninguno, lo que cuesta mirar la bandeja.
  if (!source.pendingCount) delete minutes.pending;
  return { freshness, minutes, aplica: { cartera: source.positionsCount > 0, indices: Boolean(source.indices) } };
}

function loQuePideFunctionHtml(engine, fn) {
  const needs = fn.needs.map((need) => {
    const falta = need.hungry ? ` <span class="lqp-falta">· ${escapeHtml(need.status)}${need.ageText && need.ageText !== "sin dato" ? ` (${escapeHtml(need.ageText)})` : ""}</span>` : "";
    const ir = need.hungry && need.action ? ` <a href="${escapeHtml(need.action.href)}">${escapeHtml(need.action.label)}</a>` : "";
    return `<p class="lqp-dato e19-kpi-note">${escapeHtml(need.label)}, ${escapeHtml(engine.everyText(need.everyDays))}: ${escapeHtml(engine.minutesText(need.weeklyMinutes))} a la semana${need.measured ? "" : " (supuesto)"}${falta}${ir}</p>`;
  }).join("");
  return `<li class="lqp-funcion${fn.hungry ? " is-hambre" : ""}" data-lqp-funcion="${escapeHtml(fn.id)}">
      <p class="panel-uso-cabecera"><strong><a href="${escapeHtml(fn.href)}">${escapeHtml(fn.label)}</a></strong><span>${escapeHtml(engine.minutesText(fn.weeklyMinutes))}/semana</span></p>
      ${fn.hungry ? `<p class="lqp-estado">Tiene hambre. Sin dato al día: ${escapeHtml(fn.missing.map((need) => need.label.toLowerCase()).join(" y "))}.</p>` : ""}
      ${needs}
    </li>`;
}

function loQuePideHtml(engine, result) {
  const pct = Math.min(100, Math.round((result.totalMinutes / result.budgetMinutes) * 100));
  const repaso = globalThis.FinanceRepaso?.resumen?.();
  const medido = repaso && repaso.veces
    ? `<p class="e19-kpi-note">Medido por el Repaso semanal: ${escapeHtml(engine.minutesText(repaso.minutosSemana))} esta semana.</p>`
    : `<p class="e19-kpi-note">Aún no hay ningún Repaso semanal terminado: cuando lo haya, aquí irán también los minutos medidos.</p>`;
  return `<p class="lqp-frase">${escapeHtml(engine.sentence(result))}</p>
    <p class="lqp-barra-fila"><meter class="lqp-barra" min="0" max="${result.budgetMinutes}" low="${result.budgetMinutes * 0.8}" high="${result.budgetMinutes}" optimum="0" value="${Math.min(result.totalMinutes, result.budgetMinutes)}" aria-label="Minutos a la semana frente al presupuesto">${pct} %</meter>
      <span>${escapeHtml(engine.minutesText(result.totalMinutes))} de ${result.budgetMinutes} min</span></p>
    ${medido}
    <ul class="panel-uso-lista lqp-lista" aria-label="Lo que pide cada función">${result.functions.map((fn) => loQuePideFunctionHtml(engine, fn)).join("")}</ul>
    <p class="e19-kpi-note">Primero las que tienen hambre y después por lo que cuestan. Cada minuto es el medido cuando hay al menos 3 veces (WP-45) y si no, un supuesto, y se dice. Un dato que piden dos funciones se da una vez: el total lo cuenta una sola vez.</p>`;
}

function renderLoQuePide(engine) {
  const card = qs("loQuePideCard");
  if (!card) return;
  const on = loQuePideOn();
  card.hidden = !on;
  if (!on || !engine || !globalThis.FinanceCanonicalDataQueue) return;
  // Ir a dar un dato desde aquí es la acción que mide la ficha (funciones con hambre que se alimentan). Una sola escucha, en la tarjeta.
  if (!card.dataset.lqpBound) {
    card.dataset.lqpBound = "1";
    card.addEventListener("click", (event) => { if (event.target.closest?.(".lqp-dato a")) globalThis.FinanceMedidor?.anotar("lo-que-pide", "accion"); });
  }
  try {
    const today = isoLocalDate(new Date());
    const result = engine.evaluate(loQuePideInput(today));
    qs("loQuePideCuerpo").innerHTML = loQuePideHtml(engine, result);
    globalThis.FinanceMedidor?.anotar("lo-que-pide", "vista"); // XGO-02: un día visto cuenta una vez
  } catch (error) {
    console.error(`renderLoQuePide: ${error.message}`);
  }
}
