(function attachCanonicalChargeDays(root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.FinanceCanonicalChargeDays = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function createCanonicalChargeDays() {
  "use strict";

  // WP-08 (ND-03, docs/PLAN_IMPLEMENTACION_2026-10-03.md): día de cargo por partida. La previsión ponía casi
  // todo el gasto el día 8 («estimación alisada 1-15») porque no sabía cuándo se cobra cada partida; aquí el
  // hogar lo indica una vez y vale para todos los meses. El motor de fechas (canonical-timing.js) lo aplica:
  // un movimiento real casado en ese mes sigue mandando (es lo que pasó); si no lo hay, el día indicado gana a
  // la regla de fin de mes y a la estimación. Sin día indicado, todo es exactamente como antes.
  //
  // Se guarda en un almacén local (`charge-days`) que viaja con la copia y la nube (BACKUP_LOCAL_STORES), en
  // vez de en el contrato de estado: el mismo recorrido de WP-09, sin migrar el contrato.
  //
  // Para que sea «confirmar» y no «declarar»: la lista va de mayor a menor gasto y propone el día que ya se
  // ve en los extractos (el de WP-04 si la partida es «fiable», o el último visto). Sin importes: % del gasto.

  const STORE_NAME = "charge-days";
  const END_OF_MONTH = "eom";
  const SOURCES = Object.freeze(["declarado", "sugerido"]);

  // 1..31 o «fin de mes»; cualquier otra cosa es «sin indicar».
  function normalizeDay(value) {
    if (value === END_OF_MONTH) return END_OF_MONTH;
    const day = Number(value);
    return Number.isInteger(day) && day >= 1 && day <= 31 ? day : null;
  }

  function normalizeStore(raw) {
    const series = raw && typeof raw === "object" && !Array.isArray(raw) && raw.series && typeof raw.series === "object" && !Array.isArray(raw.series) ? raw.series : {};
    const clean = {};
    Object.entries(series).forEach(([key, entry]) => {
      const day = normalizeDay(entry?.day);
      if (!key || day === null) return;
      clean[key] = { day, source: SOURCES.includes(entry.source) ? entry.source : "declarado", updatedAt: String(entry.updatedAt || "") };
    });
    return { series: clean };
  }

  // Sin valor («sin indicar»), la partida vuelve a la fecha automática.
  function setDay(store, key, value, { source = "declarado", now = "" } = {}) {
    const series = { ...normalizeStore(store).series };
    const day = normalizeDay(value);
    if (day === null) delete series[key];
    else series[key] = { day, source: SOURCES.includes(source) ? source : "declarado", updatedAt: String(now) };
    return { series };
  }

  // El día real en un mes de `lastDay` días: «fin de mes» es el último; un 31 en febrero, el 28 (o el 29).
  function resolveDay(value, lastDay) {
    const day = normalizeDay(value);
    if (day === null) return null;
    return day === END_OF_MONTH ? lastDay : Math.min(day, lastDay);
  }

  function dayText(value) {
    return value === END_OF_MONTH ? "fin de mes" : `día ${value}`;
  }

  // La propuesta de cada partida, sacada de los extractos: el día de WP-04 si la partida es «fiable» (mismo
  // día ± 1 en el 80 % de 3 meses o más); si no, el último día en que se vio el cargo. Nunca se aplica sola.
  /**
   * @param {Array<{ key: string, month: string, day?: number|null }>} observations
   * @param {Array<{ key: string, status: string, day: number|null, pct: number|null, months: number }>} viability
   */
  function suggestions(observations = [], viability = []) {
    const result = {};
    viability.forEach((partida) => {
      if (partida?.status === "fiable" && normalizeDay(partida.day) !== null) {
        result[partida.key] = { day: partida.day, kind: "fiable", note: `fiable: el mismo día en el ${partida.pct} % de ${partida.months} meses` };
      }
    });
    const latest = {};
    observations.forEach((item) => {
      if (!item?.key || !Number.isInteger(item.day) || normalizeDay(item.day) === null) return;
      if (!latest[item.key] || String(item.month) > latest[item.key].month) latest[item.key] = { month: String(item.month), day: item.day };
    });
    Object.entries(latest).forEach(([key, seen]) => {
      if (!result[key]) result[key] = { day: seen.day, kind: "visto", note: `visto el día ${seen.day} en el extracto de ${seen.month.split("-").reverse().join("/")}` };
    });
    return result;
  }

  /**
   * Una fila por partida de gasto del horizonte, de mayor a menor gasto, con su estado y su propuesta.
   * `spread`: gasto que se reparte por todo el mes (súper, gasolina…): no tiene un día de cargo.
   * @param {{ rows: Array<{ key: string, label: string, section?: string, amount: number, rule?: boolean, spread?: boolean }>, store?: any, suggestions?: Record<string, any> }} input
   */
  function buildModel({ rows = [], store = null, suggestions: proposed = {} }) {
    const series = normalizeStore(store).series;
    const total = rows.reduce((sum, row) => sum + Math.abs(Number(row.amount) || 0), 0);
    const items = rows
      .filter((row) => row?.key && Math.abs(Number(row.amount) || 0) > 0)
      .map((row) => {
        const declared = series[row.key] || null;
        const status = declared ? "indicado" : row.rule ? "regla" : "estimado";
        // A un gasto repartido no se le propone el día de un ticket suelto.
        const suggestion = !declared && !row.spread && proposed[row.key] ? proposed[row.key] : null;
        return { key: row.key, label: String(row.label || row.key), section: String(row.section || ""), amount: Math.abs(Number(row.amount)), status, declared, suggestion, spread: Boolean(row.spread) };
      })
      .sort((a, b) => b.amount - a.amount || a.label.localeCompare(b.label, "es"))
      .map(({ amount, ...item }) => ({ ...item, spendPct: total ? Math.round((amount / total) * 1000) / 10 : 0, weight: amount }));
    const estimated = items.filter((item) => item.status === "estimado");
    const estimatedWeight = estimated.reduce((sum, item) => sum + item.weight, 0);
    return {
      items: items.map(({ weight, ...item }) => item),
      summary: {
        partidas: items.length,
        indicated: items.filter((item) => item.status === "indicado").length,
        rule: items.filter((item) => item.status === "regla").length,
        estimated: estimated.length,
        estimatedSpendPct: total ? Math.round((estimatedWeight / total) * 100) : null,
        reliableSuggestions: items.filter((item) => item.suggestion?.kind === "fiable").length,
      },
    };
  }

  function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
  }

  function summaryText(model) {
    const { summary } = model;
    if (!summary.partidas) return "Días de cargo: no hay gasto previsto en los próximos 12 meses";
    if (!summary.estimated) return "Días de cargo: todas las partidas tienen fecha";
    return `Días de cargo: quedan ${summary.estimated} partida${summary.estimated === 1 ? "" : "s"} con fecha estimada (${summary.estimatedSpendPct} % del gasto)`;
  }

  const STATUS_TEXT = {
    indicado: (item) => `Indicado: ${dayText(item.declared.day)}${item.declared.source === "sugerido" ? " (propuesta aceptada)" : ""}.`,
    regla: () => "Ahora: fin de mes, por regla de la casa.",
    estimado: () => "Ahora: estimado el día 8.",
  };

  function optionsHtml(current) {
    const days = Array.from({ length: 31 }, (_, index) => index + 1);
    return [["", "Sin indicar (automático)"], [END_OF_MONTH, "Fin de mes"], ...days.map((day) => [String(day), `Día ${day}`])]
      .map(([value, text]) => `<option value="${value}"${String(current ?? "") === value ? " selected" : ""}>${text}</option>`)
      .join("");
  }

  function renderHtml(model) {
    const { items, summary } = model;
    if (!items.length) return `<p class="e19-kpi-note">No hay gasto previsto en los próximos 12 meses.</p>`;
    const intro = `<p class="e19-kpi-note">Indica una vez qué día del mes se cobra cada partida y la previsión día a día la pondrá ahí todos los meses. Van de mayor a menor gasto: empieza por arriba. Si un mes llega el cargo real, manda la fecha real.</p>`;
    const bulk = summary.reliableSuggestions
      ? `<p><button type="button" class="secondary-button" data-cargo-dia-fiables>Aplicar las ${summary.reliableSuggestions} propuesta${summary.reliableSuggestions === 1 ? "" : "s"} fiable${summary.reliableSuggestions === 1 ? "" : "s"}</button></p>`
      : "";
    const list = items.map((item, index) => {
      const id = `cargoDiaSelect${index}`;
      const suggestion = item.suggestion
        ? `<button type="button" class="ghost-button cargo-dia-propuesta" data-cargo-dia-usar="${escapeHtml(item.key)}" data-cargo-dia-valor="${item.suggestion.day}"${item.suggestion.kind === "fiable" ? " data-cargo-dia-fiable" : ""}>Usar el día ${item.suggestion.day}</button> <span class="e19-kpi-note">${escapeHtml(item.suggestion.note)}</span>`
        : "";
      return `<li class="cargo-dia-item"><div class="panel-uso-cabecera"><strong>${escapeHtml(item.label)}</strong><span class="cargo-dia-peso">${String(item.spendPct).replace(".", ",")} % del gasto</span></div>`
        + `<p class="e19-kpi-note">${item.section ? `${escapeHtml(item.section)} · ` : ""}${escapeHtml(STATUS_TEXT[item.status](item))}</p>`
        + (item.spread ? `<p class="e19-kpi-note">Se gasta a lo largo del mes, no en un día: la previsión lo pone entero en un solo día. El día 1 es lo prudente (todo al principio); un día tardío dibuja más caja de la que habrá.</p>` : "")
        + `<div class="cargo-dia-control"><label for="${id}">Día de cargo</label><select id="${id}" data-cargo-dia="${escapeHtml(item.key)}">${optionsHtml(item.declared?.day)}</select></div>`
        + (suggestion ? `<p class="cargo-dia-sugerencia">${suggestion}</p>` : "")
        + `</li>`;
    }).join("");
    return `${intro}${bulk}<ul class="panel-uso-lista cargo-dia-lista">${list}</ul><p class="e19-kpi-note" id="cargoDiaEstado" role="status" aria-live="polite"></p>`;
  }

  return { STORE_NAME, END_OF_MONTH, normalizeDay, normalizeStore, setDay, resolveDay, dayText, suggestions, buildModel, summaryText, renderHtml };
});
