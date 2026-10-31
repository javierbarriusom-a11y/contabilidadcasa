// Rediseño · fase C1 (docs/rediseno/HANDOFF.md §5 «C1 · Plan › Mes», referencias/png/PlanMes.png y PlanMesDesktop.png).
//
// Plan › Mes v2: arriba lo que queda sin asignar con la barra de a dónde va el ingreso, el ritmo del mes y las partidas
// con su previsto editable, su real, lo que queda y una barra de ritmo; en el móvil, una lista que cabe en 390 px (la
// tabla de siempre medía 720 px y escondía las cifras a la derecha). Solo con el tema v2 (<html data-tema="v2">).
//
// No calcula nada nuevo: renderPlanMes() (app.js) le pasa las mismas filas y totales que ya pinta la tabla de siempre
// (planMesCollect, planMesTotals) y aquí solo se presentan. La edición es la de siempre: el mismo
// `data-plan-mes-planned`, el mismo manejador, el mismo borrador y el mismo pie «Impacto del cambio» antes de guardar
// (decisión 6 de docs/rediseno/ESTADO.md). Copiar el mes anterior, el candado de los meses cerrados y el plegado de
// bloques reutilizan sus `data-*` de siempre, que atiende el manejador de #planMesTables. Con los sobres encendidos, o
// con «Ver la tabla de siempre», se pinta la de siempre entera: no se retira nada.
// Script clásico con defer, cargado antes de app.js (mismo scope global que el resto de views/*.js).

let planV2Clasica = false; // «Ver la tabla de siempre», hasta recargar
let planV2Pintando = false; // al sustituir un campo con el foco, el navegador lanza su «change» a mitad del repintado

function planV2Active() {
  return document.documentElement.dataset.tema === "v2";
}

function planV2MonthName(monthKey) {
  const [year, month] = String(monthKey).split("-").map(Number);
  if (!year || !month) return String(monthKey || "");
  return `${new Intl.DateTimeFormat("es-ES", { month: "long" }).format(new Date(year, month - 1, 1))} ${year}`;
}

// Importe para el campo editable: con miles y sin «€» (el símbolo va fuera), como lo lee `parseAmountField`.
function planV2InputValue(value) {
  return money(Number(value || 0), true).replace(/\s*€\s*$/u, ""); // con céntimos si los hay: el campo no redondea
}

function planV2Nav(target) {
  if (!target || !document.getElementById(target)?.classList.contains("view-section")) return;
  history.pushState(null, "", `#${target}`);
  setActiveView(target);
}

// ---------- Cabecera: «Plan», las pestañas como control segmentado y el mes con flechas ----------

// Una sola vez: el titular de siempre pasa a «Plan» y las pestañas suben a la cabecera. El texto y el sitio de
// siempre vuelven con el tema clásico, que recarga la página.
function planV2PrepareHeader() {
  const plan = qs("plan");
  if (!plan || plan.classList.contains("plan-v2-on")) return;
  plan.classList.add("plan-v2-on");
  const title = plan.querySelector(".section-title .e19-heading");
  if (title) title.textContent = "Plan";
  const head = plan.querySelector(".section-title.with-action");
  const tabs = qs("planTabs");
  const controls = plan.querySelector(".plan-header-controls");
  if (head && tabs && controls) head.insertBefore(tabs, controls);
  if (controls && !qs("planV2MesNav")) {
    const nav = document.createElement("div");
    nav.className = "plan-v2-mes-nav";
    nav.id = "planV2MesNav";
    nav.setAttribute("role", "group");
    nav.setAttribute("aria-label", "Mes del plan");
    controls.prepend(nav);
    nav.addEventListener("click", (event) => {
      const button = event.target.closest("[data-plan-v2-mes-paso]");
      if (button && !button.disabled) planV2GoToMonth(button.dataset.planV2MesPaso);
    });
    nav.addEventListener("change", (event) => {
      if (event.target.matches("[data-plan-v2-mes]")) planV2GoToMonth(event.target.value);
    });
  }
}

function planV2GoToMonth(monthKey) {
  const select = qs("planMesMonth");
  if (!select || !monthKey) return;
  select.value = monthKey;
  planMesCopyPending = false;
  renderPlanMes();
  qs("planV2MesNav")?.querySelector("[data-plan-v2-mes]")?.focus();
}

function planV2MesNavHtml(months, month) {
  const index = months.findIndex((item) => item.key === month.key);
  const previous = index > 0 ? months[index - 1] : null;
  const next = index >= 0 && index < months.length - 1 ? months[index + 1] : null;
  const options = months
    .map((item) => `<option value="${escapeHtml(item.key)}"${item.key === month.key ? " selected" : ""}>${escapeHtml(planV2MonthName(item.key))}${isClosedMonthKey(item.key) ? " · cerrado" : ""}</option>`)
    .join("");
  return `<button type="button" class="plan-v2-mes-flecha" data-plan-v2-mes-paso="${escapeHtml(previous?.key || "")}" aria-label="${previous ? `Mes anterior: ${escapeHtml(planV2MonthName(previous.key))}` : "No hay mes anterior"}"${previous ? "" : " disabled"}>‹</button>
    <label class="plan-v2-mes-pildora"><span class="sr-only">Mes</span><select data-plan-v2-mes>${options}</select></label>
    <button type="button" class="plan-v2-mes-flecha" data-plan-v2-mes-paso="${escapeHtml(next?.key || "")}" aria-label="${next ? `Mes siguiente: ${escapeHtml(planV2MonthName(next.key))}` : "No hay mes siguiente"}"${next ? "" : " disabled"}>›</button>`;
}

// ---------- Columna derecha: sin asignar, ritmo y ahorro ----------

const PLAN_V2_DESTINOS = [
  { section: "Gastos fijos", label: "Fijos", tone: "fijos" },
  { section: "Gastos variables", label: "Variables", tone: "variables" },
  { section: "Financiaciones", label: "Financiaciones", tone: "financiaciones" },
];

function planV2Destinos(entries, incomePlanned, sinAsignar) {
  const bySection = new Map();
  entries.expense.forEach((entry) => bySection.set(entry.sectionName, round2((bySection.get(entry.sectionName) || 0) + Number(entry.planned || 0))));
  const known = PLAN_V2_DESTINOS.map((item) => ({ ...item, amount: bySection.get(item.section) || 0 }));
  const otros = round2([...bySection.entries()].filter(([section]) => !PLAN_V2_DESTINOS.some((item) => item.section === section)).reduce((sum, [, amount]) => sum + amount, 0));
  const parts = [...known, { label: "Otros", tone: "otros", amount: otros }, { label: "Sin asignar", tone: "libre", amount: Math.max(0, sinAsignar) }].filter((item) => item.amount > 0);
  const base = Math.max(incomePlanned, parts.reduce((sum, item) => sum + item.amount, 0)) || 1;
  return parts.map((item) => ({ ...item, pct: round2((item.amount / base) * 100) }));
}

function planV2SinAsignarHtml({ month, entries, totals, asignado, sinAsignar, today }) {
  const over = sinAsignar < 0;
  const destinos = planV2Destinos(entries, totals.incomePlanned, sinAsignar);
  const sentence = totals.incomePlanned <= 0
    ? "Este mes no tiene ingreso previsto: lo asignado sale de lo que ya tenéis."
    : over
      ? `Lo asignado (${money(asignado)}) supera en ${money(-sinAsignar)} el ingreso previsto de ${money(totals.incomePlanned)}.`
      : `De ${money(totals.incomePlanned)} de ingreso previsto ya tienen destino ${money(asignado)}.`;
  const bar = destinos.length
    ? `<div class="plan-v2-destino" role="img" aria-label="${escapeHtml(destinos.map((item) => `${item.label} ${money(item.amount)}`).join(", "))}">${destinos.map((item) => `<span class="is-${item.tone}" style="width:${item.pct}%"></span>`).join("")}</div>
      <ul class="plan-v2-leyenda">${destinos.map((item) => `<li><span class="plan-v2-muestra is-${item.tone}" aria-hidden="true"></span>${escapeHtml(item.label)} ${escapeHtml(money(item.amount))}</li>`).join("")}</ul>`
    : "";
  // No hay un «Asignar» que reparta solo: lo que sobra se decide en la escalera del próximo euro, que ya existe.
  const pasado = month.key < String(today).slice(0, 7);
  const action = !over && sinAsignar > 0 && !pasado
    ? `<button type="button" class="e19-btn e19-btn-secondary plan-v2-accion" data-plan-v2-nav="deuda-comparar">Ver adónde va el próximo euro</button>`
    : "";
  return `<article class="hoy-v2-card plan-v2-sin-asignar${over ? " is-negative" : ""}">
    <p class="hoy-v2-kicker">Sin asignar</p>
    <p class="plan-v2-cifra">${escapeHtml(money(sinAsignar))}</p>
    <p class="plan-v2-frase">${escapeHtml(sentence)}</p>
    ${bar}
    ${action}
  </article>`;
}

function planV2RitmoHtml({ month, entries, asignado, today }) {
  const monthKey = month.key;
  const todayKey = String(today).slice(0, 7);
  const [year, monthNumber] = monthKey.split("-").map(Number);
  const daysInMonth = new Date(year, monthNumber, 0).getDate() || 30;
  const future = monthKey > todayKey;
  const day = monthKey === todayKey ? Number(String(today).slice(8, 10)) || 1 : future ? 0 : daysInMonth;
  const realEntries = entries.expense.filter((entry) => entry.hasActual);
  const real = round2(realEntries.reduce((sum, entry) => sum + Number(entry.usado || 0), 0));
  const spentPct = asignado > 0 ? Math.min(100, Math.round((real / asignado) * 100)) : 0;
  const expectedPct = Math.round((day / daysInMonth) * 100);
  const over = asignado > 0 && real > asignado;
  const head = future
    ? `<span>empieza el 1</span>`
    : `<span>${monthKey === todayKey ? `día ${day} de ${daysInMonth}` : "mes terminado"}</span>`;
  const marker = future ? "" : `<span class="hoy-v2-pace-today plan-v2-esperado" style="left:${expectedPct}%"></span>`;
  const label = future
    ? `Aún no ha empezado; asignados ${money(asignado)}.`
    : `Gastado ${money(real)} de ${money(asignado)} (${spentPct} %); a estas alturas se esperaba el ${expectedPct} %.`;
  const note = future
    ? `<p class="plan-v2-nota">La barra se llenará con el extracto de ${escapeHtml(planV2MonthName(monthKey))}.</p>`
    : realEntries.length
      ? `<p class="hoy-v2-month-real${over ? " is-over" : ""}">Gastado <strong>${escapeHtml(money(real))}</strong> de ${escapeHtml(money(asignado))} en ${realEntries.length} ${realEntries.length === 1 ? "partida" : "partidas"} con real. La marca azul es lo que esperabais haber gastado ${monthKey === todayKey ? "hoy" : "al acabar el mes"}.</p>`
      : `<p class="plan-v2-nota">Sin gasto real: la barra se llena con el extracto. La marca azul es lo que esperabais haber gastado ${monthKey === todayKey ? "hoy" : "al acabar el mes"}.</p>
        <button type="button" class="e19-btn e19-btn-secondary plan-v2-accion" data-plan-v2-nav="datos-importar">Importar extracto</button>`;
  return `<article class="hoy-v2-card plan-v2-ritmo-mes">
    <div class="hoy-v2-card-head"><p class="plan-v2-titulo">Ritmo del mes</p>${head}</div>
    <div class="hoy-v2-pace" role="img" aria-label="${escapeHtml(label)}">
      ${realEntries.length ? `<span class="hoy-v2-pace-fill${over ? " is-over" : ""}" style="width:${spentPct}%"></span>` : ""}
      ${marker}
    </div>
    ${note}
  </article>`;
}

function planV2AhorroHtml({ month, today }) {
  if (month.key !== String(today).slice(0, 7) || typeof savingsPlanCalculations !== "function") return "";
  let target = null;
  try {
    target = Number(savingsPlanCalculations()?.currentSavingTarget);
  } catch {
    return "";
  }
  if (!Number.isFinite(target)) return "";
  return `<article class="hoy-v2-card plan-v2-ahorro"><span>Irá a ahorro este mes</span><strong>${escapeHtml(money(target))}</strong></article>`;
}

function planV2MasHtml() {
  const sobres = sobresEnabled();
  return `<p class="plan-v2-mas">También: <button type="button" class="link-button" data-plan-v2-sobres aria-pressed="${sobres ? "true" : "false"}">Sobres ${sobres ? "activados" : "desactivados"}</button> · <button type="button" class="link-button" data-e17-open="guide">Guía de Plan</button></p>`;
}

// ---------- Partidas ----------

function planV2RowHtml(entry, monthKey, editLocked, collapsed, note = "") {
  const rowKey = seriesKeyForRow(entry.row);
  const planned = Number(entry.planned || 0);
  const real = entry.hasActual ? Number(entry.usado || 0) : null;
  const queda = round2(planned - (real ?? 0));
  const expense = entry.kind === "expense";
  const quedaClass = expense && queda < 0 ? " is-over" : "";
  const pct = planned > 0 && real !== null ? Math.min(100, Math.round((real / planned) * 100)) : 0;
  const ritmoLabel = real === null ? "Sin real todavía" : `Real ${money(real)} de ${money(planned)} previstos`;
  return `<tr class="plan-v2-fila${entry.plannedDraft ? " plan-mes-row-draft" : ""}${real !== null ? " tiene-real" : ""}" data-plan-mes-key="${escapeHtml(entry.key)}" data-plan-mes-block="${escapeHtml(entry.sectionName)}"${collapsed ? " hidden" : ""}>
    <td class="plan-v2-nombre">${escapeHtml(entry.label)}${note ? `<small>${escapeHtml(note)}</small>` : ""}</td>
    <td class="plan-v2-previsto"><span class="plan-v2-importe"><input type="text" inputmode="decimal" autocomplete="off" data-plan-mes-planned="${escapeHtml(rowKey)}" data-plan-mes-month="${escapeHtml(monthKey)}" aria-label="Previsto de ${escapeHtml(entry.label)}" value="${escapeHtml(planV2InputValue(planned))}"${editLocked ? " disabled" : ""} /><span aria-hidden="true">€</span></span></td>
    <td class="plan-v2-num" data-plan-v2-etiqueta="real" title="${escapeHtml(planMesUsadoTitle(entry, monthKey))}">${real === null ? "—" : escapeHtml(money(real))}</td>
    <td class="plan-v2-num${quedaClass}" data-plan-v2-etiqueta="queda">${escapeHtml(money(queda))}</td>
    <td class="plan-v2-ritmo-celda"><span class="plan-v2-ritmo${real === null ? " is-vacio" : ""}${expense && queda < 0 ? " is-over" : ""}" role="img" aria-label="${escapeHtml(ritmoLabel)}">${real === null ? "" : `<span style="width:${pct}%"></span>`}</span></td>
  </tr>`;
}

function planV2FinanciacionesHtml(block) {
  const count = block.entries.length;
  const zero = block.entries.filter((entry) => Math.abs(Number(entry.planned || 0)) < 0.005).length;
  const withReal = block.entries.filter((entry) => entry.hasActual);
  const real = withReal.length ? round2(withReal.reduce((sum, entry) => sum + Number(entry.usado || 0), 0)) : null;
  const detail = `${count} ${count === 1 ? "contrato" : "contratos"}${zero ? ` · ${zero} a 0 €` : ""} · se editan en Deuda`;
  return `<tr class="plan-v2-bloque plan-v2-financiaciones">
    <td><span class="plan-v2-bloque-nombre">${escapeHtml(block.sectionName)}</span><small>${escapeHtml(detail)}</small></td>
    <td class="plan-v2-num">${escapeHtml(money(block.subtotal))}</td>
    <td class="plan-v2-num" data-plan-v2-etiqueta="real">${real === null ? "—" : escapeHtml(money(real))}</td>
    <td></td>
    <td class="plan-v2-ritmo-celda"><button type="button" class="plan-v2-ir" data-home-nav="deuda-contratos" aria-label="Editar las cuotas en Deuda › Contratos">›</button></td>
  </tr>`;
}

function planV2PartidasHtml({ entries, month, editLocked, footHtml }) {
  const list = [...entries.income, ...entries.expense];
  const blocks = planMesGroupBySection(list);
  const body = blocks.length
    ? blocks
        .map((block) => {
          if (block.sectionName === "Financiaciones") return planV2FinanciacionesHtml(block);
          const collapsed = planMesCollapsedBlocks.has(block.sectionName);
          const single = block.sectionName === "Gastos variables" && block.entries.length === 1;
          const rows = block.entries
            .map((entry) => planV2RowHtml(entry, month.key, editLocked, collapsed, single ? "Una sola partida para todo lo variable: divídela para que la previsión aprenda." : ""))
            .join("");
          return `<tr class="plan-v2-bloque">
            <td><button type="button" class="plan-v2-bloque-nombre" data-plan-mes-block-toggle="${escapeHtml(block.sectionName)}" aria-expanded="${collapsed ? "false" : "true"}"><span class="plan-mes-block-caret" aria-hidden="true"></span>${escapeHtml(block.sectionName)}</button></td>
            <td class="plan-v2-num">${escapeHtml(money(block.subtotal))}</td>
            <td colspan="3"></td>
          </tr>${rows}`;
        })
        .join("")
    : `<tr><td colspan="5" class="registrar-mes-empty">Este mes no tiene partidas.</td></tr>`;
  const pending = list.filter((entry) => entry.plannedDraft).length;
  const status = pending
    ? `<span class="e19-badge e19-badge-warning">${pending} sin guardar</span>`
    : `<span class="plan-v2-leyenda-cols">previsto · real</span>`;
  return `<article class="hoy-v2-card plan-v2-partidas">
    <div class="hoy-v2-card-head"><h3>Partidas de ${escapeHtml(planV2MonthName(month.key))}</h3>${status}</div>
    <table class="plan-v2-tabla">
      <thead><tr><th scope="col">Partida</th><th scope="col">Previsto</th><th scope="col">Real</th><th scope="col">Queda</th><th scope="col">Ritmo</th></tr></thead>
      <tbody>${body}</tbody>
    </table>
    <div class="plan-v2-pie">
      <div class="plan-v2-pie-mes">${footHtml || ""}</div>
      <button type="button" class="registrar-actuals-plan-link plan-v2-partida" data-home-nav="registrar">+ Partida</button>
    </div>
    <p class="plan-v2-clasica"><button type="button" class="link-button" data-plan-v2-clasica>Ver la tabla de siempre</button></p>
  </article>`;
}

// ---------- Entrada: renderPlanMes() la llama con lo que ya ha calculado ----------

// Devuelve true si ha pintado la versión v2 (y renderPlanMes no debe pintar la de siempre).
function planV2Render(model) {
  const plan = qs("plan");
  const lado = qs("planV2Lado");
  const tables = qs("planMesTables");
  if (!planV2Active() || !plan || !lado || !tables) return false;
  planV2PrepareHeader();
  const nav = qs("planV2MesNav");
  if (nav) nav.innerHTML = planV2MesNavHtml(model.months, model.month);
  if (planV2Clasica || sobresEnabled()) {
    plan.classList.remove("plan-v2-mes-on");
    lado.hidden = true;
    lado.innerHTML = "";
    return false;
  }
  if (planV2Pintando) return true;
  const today = isoLocalDate(new Date());
  const ctx = { ...model, today };
  // El foco vuelve al mismo campo tras repintar: con el tabulador se editan varias partidas seguidas.
  const foco = tables.contains(document.activeElement) ? document.activeElement.dataset?.planMesPlanned : null;
  planV2Pintando = true;
  try {
    plan.classList.add("plan-v2-mes-on");
    lado.hidden = false;
    lado.innerHTML = `${planV2SinAsignarHtml(ctx)}${planV2RitmoHtml(ctx)}${planV2AhorroHtml(ctx)}${planV2MasHtml()}`;
    tables.innerHTML = planV2PartidasHtml(ctx);
  } finally {
    planV2Pintando = false;
  }
  if (foco) [...tables.querySelectorAll("[data-plan-mes-planned]")].find((input) => input.dataset.planMesPlanned === foco)?.focus();
  if (!plan.hidden) globalThis.FinanceMedidor?.anotar("plan-v2", "vista"); // XGO-02
  return true;
}

function planV2Init() {
  qs("planV2Lado")?.addEventListener("click", (event) => {
    const nav = event.target.closest("[data-plan-v2-nav]");
    if (nav) {
      globalThis.FinanceMedidor?.anotar("plan-v2", "accion");
      planV2Nav(nav.dataset.planV2Nav);
      return;
    }
    if (event.target.closest("[data-plan-v2-sobres]")) qs("planSobresToggle")?.click();
  });
  qs("planMesTables")?.addEventListener("click", (event) => {
    if (!event.target.closest("[data-plan-v2-clasica]")) return;
    planV2Clasica = true;
    globalThis.FinanceMedidor?.anotar("plan-v2", "descarte");
    renderPlanMes();
    qs("planMesTables")?.querySelector("table")?.focus?.();
  });
  // Guardar los previstos editados es la acción de esta pantalla (el pie de impacto es el de siempre).
  qs("planMesImpactBar")?.addEventListener("click", (event) => {
    if (event.target.closest("[data-plan-mes-impact-save]") && qs("plan")?.classList.contains("plan-v2-mes-on")) globalThis.FinanceMedidor?.anotar("plan-v2", "accion");
  });
}

// Los scripts con defer se ejecutan antes de DOMContentLoaded: así ya están `qs` y el resto de app.js.
if (typeof document !== "undefined") {
  if (document.readyState === "complete") planV2Init();
  else document.addEventListener("DOMContentLoaded", planV2Init);
}
