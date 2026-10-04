(function attachCanonicalBalancePulse(root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.FinanceCanonicalBalancePulse = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function createCanonicalBalancePulse() {
  "use strict";

  // WP-26 · ND-01 (docs/PROPUESTA_QUINTA_AUDITORIA_2026-10-02.md): «Pulso de saldos». En vez de teclear cada saldo
  // desde cero, Registrar enseña lo último que se sabe de cada cuenta y basta con «Coincide» (el banco dice lo mismo)
  // o «Corregir» (se escribe el nuevo). Cuando las dos cuentas tienen respuesta, los saldos quedan con fecha de hoy.
  //
  // «Lo último que se sabe» es un dato REAL, nunca una estimación: el saldo declarado (con su fecha) o el saldo final
  // del extracto importado de esa cuenta, el más reciente de los dos. La previsión solo aparece como aviso: si desde
  // esa fecha esperaba movimientos, se dice, porque entonces es raro que el saldo siga igual (el riesgo de ND-01 es
  // pulsar «Coincide» sin mirar el banco). El modo «Auto por fecha» no tiene saldos reales que confirmar.
  //
  // Sin DOM ni estado de la app: la app le pasa los saldos, los movimientos y las filas del motor diario.

  const ACCOUNTS = Object.freeze([
    Object.freeze({ id: "caixa", label: "CaixaBank", importLabel: "CaixaBank", engineField: "checking", inputId: "registrarCaixaBalance", unlabelledStatements: true }),
    Object.freeze({ id: "mediolanum", label: "Mediolanum", importLabel: "Mediolanum", engineField: "savings", inputId: "registrarMediolanumBalance", unlabelledStatements: false }),
  ]);
  const CENT = 0.005;
  const HINT_MIN = 1;
  const KEEP_TIMINGS = 20;
  const ISO = /^\d{4}-\d{2}-\d{2}$/;

  function round2(value) {
    return Math.round((Number(value) + Number.EPSILON) * 100) / 100;
  }

  function isoDay(value) {
    const text = String(value || "").slice(0, 10);
    return ISO.test(text) ? text : "";
  }

  function daysBetween(fromIso, toIso) {
    if (!fromIso || !toIso) return null;
    const [a, b] = [fromIso, toIso].map((iso) => Date.UTC(Number(iso.slice(0, 4)), Number(iso.slice(5, 7)) - 1, Number(iso.slice(8, 10))));
    return Math.round((b - a) / 86400000);
  }

  /**
   * El saldo final del extracto importado de una cuenta: el último día con saldo y, dentro de ese día, el movimiento
   * con el que se cierra la cadena (su saldo no es el «saldo anterior» de ningún otro). Así vale tanto si el banco
   * lista los movimientos del más antiguo al más nuevo como al revés. Los extractos sin cuenta indicada (importados
   * antes de poder elegirla) cuentan como CaixaBank, igual que en el resto de la app.
   * @param {Array<any>} transactions
   * @param {{ importLabel: string, unlabelledStatements: boolean }} account
   */
  function statementFinalBalance(transactions, account) {
    const rows = (transactions || []).filter((row) => {
      if (!row || row.balance === null || row.balance === undefined || row.balance === "" || !Number.isFinite(Number(row.balance)) || !isoDay(row.date)) return false;
      return row.account ? row.account === account.importLabel : account.unlabelledStatements;
    });
    if (!rows.length) return null;
    const date = rows.map((row) => isoDay(row.date)).sort().at(-1);
    const sameDay = rows.filter((row) => isoDay(row.date) === date);
    const ends = sameDay.filter((row) => !sameDay.some((other) => other !== row && Math.abs(round2(Number(other.balance) - Number(other.amount || 0)) - Number(row.balance)) < CENT));
    const pick = ends.length === 1 ? ends[0] : sameDay.slice().sort((a, b) => Number(a.statementOrder || 0) - Number(b.statementOrder || 0)).at(-1);
    return { value: round2(pick.balance), date, ambiguous: ends.length !== 1 && sameDay.length > 1 };
  }

  /** Lo último que se sabe: el declarado o el extracto, el más reciente (a igual fecha, el declarado). */
  function knownBalance({ declared, statement }) {
    const declaredDate = isoDay(declared?.date);
    const hasDeclared = Number.isFinite(Number(declared?.value));
    if (statement && (!declaredDate || statement.date > declaredDate)) return { value: statement.value, date: statement.date, source: "extracto" };
    if (hasDeclared) return { value: round2(declared.value), date: declaredDate, source: "declarado" };
    return statement ? { value: statement.value, date: statement.date, source: "extracto" } : { value: null, date: "", source: "ninguno" };
  }

  /** Cuánto esperaba mover la previsión la cuenta desde el cierre de `fromDate` hasta hoy (null si no se sabe). */
  function planDelta(rows, fromDate, toDate, field) {
    if (!fromDate || !toDate || fromDate >= toDate) return null;
    const at = (iso) => (rows || []).find((row) => row?.date === iso);
    const from = at(fromDate);
    const to = at(toDate);
    if (!from || !to || !Number.isFinite(Number(from[field])) || !Number.isFinite(Number(to[field]))) return null;
    return round2(Number(to[field]) - Number(from[field]));
  }

  /**
   * @param {{ accounts: Array<{ id: string, label: string, known: { value: number|null, date: string, source: string }, planDelta?: number|null }>, answers?: Record<string, string>, mode?: string, today: string }} input
   */
  function buildModel({ accounts, answers = {}, mode = "manual", today }) {
    const items = accounts.map((account) => {
      const answer = answers[account.id] === "coincide" || answers[account.id] === "corregido" ? answers[account.id] : "";
      const ageDays = account.known.date ? daysBetween(account.known.date, today) : null;
      const hint = account.planDelta !== null && account.planDelta !== undefined && Math.abs(account.planDelta) >= HINT_MIN ? account.planDelta : null;
      return { ...account, answer, ageDays, hint, canConfirm: account.known.value !== null };
    });
    const answered = items.filter((item) => item.answer).length;
    return { mode, today, items, answered, pending: items.length - answered, complete: items.length > 0 && answered === items.length };
  }

  /**
   * Los saldos con los que se queda cada cuenta al completar el pulso: «Coincide» toma lo último que se sabe (puede ser
   * el saldo del extracto, más reciente que el declarado); «Corregir» deja lo que se escribió.
   * @param {{ items: Array<any> }} model
   * @param {Record<string, number>} current saldos declarados ahora mismo, por id de cuenta
   */
  function resultingBalances(model, current) {
    const result = { ...current };
    model.items.forEach((item) => {
      if (item.answer === "coincide" && item.known.value !== null) result[item.id] = item.known.value;
    });
    return result;
  }

  function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
  }

  function shortDate(iso) {
    return iso ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}` : "";
  }

  function ageText(days) {
    if (days === null) return "";
    if (days <= 0) return "hoy";
    if (days === 1) return "ayer";
    return `hace ${days} días`;
  }

  /**
   * @param {ReturnType<typeof buildModel>} model
   * @param {{ money?: (value: number) => string, status?: string }} [options]
   */
  function renderHtml(model, { money = (value) => String(value), status = "" } = {}) {
    const head = `<p class="pulso-saldos-titulo"><strong>Pulso de saldos</strong> <span class="e19-kpi-note">Mira tu banco: si marca la misma cifra, «Coincide»; si no, «Corregir» y escribe la nueva.</span></p>`;
    const statusLine = `<p class="e19-kpi-note pulso-saldos-estado" id="pulsoSaldosEstado" role="status" aria-live="polite">${escapeHtml(status)}</p>`;
    if (model.mode !== "manual") {
      return `${head}<p class="e19-kpi-note">Estás en «Auto por fecha»: los saldos son una estimación del plan y no hay nada que confirmar. Para declarar los del banco, pasa a «Real manual».</p><p><button type="button" class="e19-btn e19-btn-secondary" data-pulso-manual>Pasar a real manual</button></p>${statusLine}`;
    }
    const rows = model.items.map((item) => {
      const known = item.known.value === null
        ? `<span class="e19-kpi-note">Aún no hay ningún saldo de esta cuenta: escríbelo.</span>`
        : `<span class="pulso-saldos-cifra">${escapeHtml(money(item.known.value))}</span> <span class="e19-kpi-note">${item.known.source === "extracto" ? "saldo final del extracto" : "declarado"} del ${escapeHtml(shortDate(item.known.date))}${item.ageDays === null ? "" : ` (${escapeHtml(ageText(item.ageDays))})`}</span>`;
      const hint = item.hint === null ? "" : `<p class="e19-kpi-note is-warn">Desde entonces la previsión esperaba que se moviera ${escapeHtml(`${item.hint > 0 ? "+" : ""}${money(item.hint)}`)}: es raro que siga igual. Compruébalo antes de confirmar.</p>`;
      const answer = item.answer === "coincide" ? "Coincide ✓" : item.answer === "corregido" ? "Corregido ✓" : "";
      const actions = item.answer
        ? `<p class="pulso-saldos-respuesta"><strong>${answer}</strong></p>`
        : `<div class="pulso-saldos-acciones">${item.canConfirm ? `<button type="button" class="e19-btn e19-btn-primary" data-pulso-coincide="${escapeHtml(item.id)}" aria-label="Coincide: ${escapeHtml(item.label)} sigue en ${escapeHtml(money(item.known.value))}">Coincide</button>` : ""}<button type="button" class="e19-btn e19-btn-secondary" data-pulso-corregir="${escapeHtml(item.id)}" aria-label="Corregir el saldo de ${escapeHtml(item.label)}">Corregir</button></div>`;
      return `<li class="pulso-saldos-cuenta" data-pulso-cuenta="${escapeHtml(item.id)}"><div class="panel-uso-cabecera"><strong>${escapeHtml(item.label)}</strong>${known}</div>${hint}${actions}</li>`;
    }).join("");
    const missing = model.items.filter((item) => !item.answer).map((item) => item.label);
    const progress = model.answered && !model.complete ? `<p class="e19-kpi-note is-warn">Falta confirmar ${escapeHtml(missing.join(" y "))}: sin eso, la fecha de hoy no es la de todas las cuentas.</p>` : "";
    return `${head}<ul class="pulso-saldos-lista">${rows}</ul>${progress}${statusLine}`;
  }

  // Tiempos del pulso (WP-26, «Hecho cuando: actualizar las cuentas ≤ 20 s»): solo segundos y recuentos, ni importes.
  function normalizeTimings(raw) {
    const list = raw && Array.isArray(raw.times) ? raw.times : [];
    return {
      times: list
        .filter((item) => item && isoDay(item.date) && Number.isFinite(Number(item.seconds)) && Number(item.seconds) >= 0)
        .map((item) => ({ date: isoDay(item.date), seconds: Math.round(Number(item.seconds) * 10) / 10, coincided: Math.max(0, Number(item.coincided) | 0), corrected: Math.max(0, Number(item.corrected) | 0) }))
        .slice(-KEEP_TIMINGS),
    };
  }

  function recordTiming(store, entry) {
    return normalizeTimings({ times: [...normalizeTimings(store).times, entry] });
  }

  function summarizeTimings(store) {
    const { times } = normalizeTimings(store);
    if (!times.length) return { count: 0, medianSeconds: null, coincideShare: null };
    const sorted = times.map((item) => item.seconds).sort((a, b) => a - b);
    const middle = Math.floor(sorted.length / 2);
    const median = sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
    const coincided = times.reduce((sum, item) => sum + item.coincided, 0);
    const answers = times.reduce((sum, item) => sum + item.coincided + item.corrected, 0);
    return { count: times.length, medianSeconds: Math.round(median * 10) / 10, coincideShare: answers ? Math.round((coincided / answers) * 100) : null };
  }

  return { ACCOUNTS, statementFinalBalance, knownBalance, planDelta, buildModel, resultingBalances, renderHtml, normalizeTimings, recordTiming, summarizeTimings };
});
