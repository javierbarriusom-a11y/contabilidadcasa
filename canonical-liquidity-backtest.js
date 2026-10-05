(function attachCanonicalLiquidityBacktest(root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.FinanceCanonicalLiquidityBacktest = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function createCanonicalLiquidityBacktest() {
  "use strict";

  // WP-12 (NPV-02, docs/PLAN_DESARROLLO_DEFINITIVO.md): backtest de liquidez a fin de mes. Hoy hay error por
  // categoría (PVC13) y ninguno de CAJA: nadie sabe cuánto se equivoca la previsión en lo que importa, cuánto
  // dinero habrá a final de mes. Esto lo mide en tres pasos:
  //
  // 1. Los días 1-3 y 15-17 de cada mes se CONGELA la liquidez que la previsión diaria espera tener, día a día,
  //    hasta fin de mes (y unos días más, por si el cierre se firma con saldos de después).
  // 2. Al firmar el cierre (WP-09, `month-close-balances`) se compara con los saldos reales, EN LA FECHA en que
  //    se declararon, no en una fecha supuesta.
  // 3. Con menos de 3 cierres comparables NO se da ningún error: sería precisión inventada. «Datos insuficientes».
  //
  // La foto es de SOLO AÑADIR: la primera de cada ventana gana y nunca se reescribe. Si se pudiera rehacer con el
  // mes ya cerrado, el backtest compararía la realidad con una previsión escrita sabiendo el resultado.
  //
  // Error = previsto − real. Positivo: la previsión era OPTIMISTA (esperaba más dinero del que hubo).
  // Solo cuentan las fotos y los cierres con saldos del banco (modo manual): un saldo calculado por calendario no es
  // una medición (GOV-05). La liquidez es CaixaBank + Mediolanum, lo mismo que suma el motor diario; el efectivo
  // queda fuera de las dos partes.
  //
  // La banda P10-P90 (cuánto ensanchar o estrechar) es de WP-16: aquí solo se mide, no se corrige nada.

  const STORE_NAME = "liquidity-backtest";
  const SLOTS = Object.freeze([
    Object.freeze({ id: "d01", firstDay: 1, lastDay: 3, label: "día 1" }),
    Object.freeze({ id: "d15", firstDay: 15, lastDay: 17, label: "día 15" }),
  ]);
  // Días de serie guardados tras el fin de mes, si el motor los tiene: el cierre puede firmarse con saldos de después.
  const TAIL_DAYS = 10;
  const MIN_CLOSES = 3;
  const TREND_CLOSES = 6;
  const MAX_FREEZES = 96;
  const BANK_ACCOUNTS = Object.freeze(["caixabank", "mediolanum"]);
  const MONTHS = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];

  const REASONS = Object.freeze({
    calculado: "el cierre se firmó con saldos calculados por la app, no del banco",
    "partida-calculada": "al congelarla, los saldos de partida eran calculados por la app, no del banco",
    "sin-cuentas": "el cierre no guardó el saldo de las dos cuentas",
    "fuera-de-serie": "la fecha de los saldos del cierre queda fuera de lo que se congeló",
  });

  function text(value) {
    return String(value ?? "").trim();
  }

  function round2(value) {
    return Math.round((Number(value) + Number.EPSILON) * 100) / 100;
  }

  function validMonthKey(value) {
    return /^\d{4}-(0[1-9]|1[0-2])$/.test(text(value));
  }

  function validIsoDate(value) {
    const match = text(value).match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!match) return false;
    const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
    return date.getUTCMonth() === Number(match[2]) - 1 && date.getUTCDate() === Number(match[3]);
  }

  function utcDay(iso) {
    const [year, month, day] = iso.split("-").map(Number);
    return Date.UTC(year, month - 1, day);
  }

  function daysBetween(fromIso, toIso) {
    return Math.round((utcDay(toIso) - utcDay(fromIso)) / 86400000);
  }

  function addDaysIso(iso, count) {
    return new Date(utcDay(iso) + count * 86400000).toISOString().slice(0, 10);
  }

  function lastDayOfMonth(monthKey) {
    const [year, month] = monthKey.split("-").map(Number);
    return `${monthKey}-${String(new Date(Date.UTC(year, month, 0)).getUTCDate()).padStart(2, "0")}`;
  }

  function formatDate(iso) {
    return iso.split("-").reverse().join("/");
  }

  function monthName(monthKey) {
    return MONTHS[Number(monthKey.slice(5, 7)) - 1] || monthKey;
  }

  function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char]));
  }

  function freezeKey(monthKey, slotId) {
    return `${monthKey}:${slotId}`;
  }

  /** La ventana de foto que está abierta en esa fecha (días 1-3 y 15-17), o null. */
  function slotOn(today) {
    if (!validIsoDate(today)) return null;
    const day = Number(today.slice(8, 10));
    return SLOTS.find((slot) => day >= slot.firstDay && day <= slot.lastDay) || null;
  }

  /**
   * La foto de hoy: la liquidez (CaixaBank + Mediolanum) al cierre de cada día, desde hoy hasta fin de mes y
   * unos días más. Null si hoy no es día de foto o si la previsión no cubre hoy y el fin de mes: no se guarda
   * media foto. `rows`: las filas del motor diario (`date`, `total`).
   * @param {{ today: string, rows: Array<any>, balanceMode?: string, balanceDate?: string, frozenAt?: string }} input
   */
  function buildFreeze({ today, rows, balanceMode, balanceDate, frozenAt }) {
    const slot = slotOn(today);
    if (!slot) return null;
    const monthKey = today.slice(0, 7);
    const monthEnd = lastDayOfMonth(monthKey);
    const byDate = new Map();
    (Array.isArray(rows) ? rows : []).forEach((row) => {
      const total = Number(row?.total);
      if (validIsoDate(row?.date) && Number.isFinite(total)) byDate.set(row.date, round2(total));
    });
    if (!byDate.has(today) || !byDate.has(monthEnd)) return null;
    const limit = addDaysIso(monthEnd, TAIL_DAYS);
    const totals = [];
    for (let date = today; date <= limit && byDate.has(date); date = addDaysIso(date, 1)) totals.push(byDate.get(date));
    const monthEndIndex = daysBetween(today, monthEnd);
    if (totals.length <= monthEndIndex) return null;
    return {
      key: freezeKey(monthKey, slot.id),
      monthKey,
      slot: slot.id,
      date: today,
      totals,
      closing: totals[monthEndIndex],
      balanceMode: balanceMode === "manual" ? "manual" : "auto",
      balanceDate: validIsoDate(balanceDate) ? text(balanceDate) : "",
      frozenAt: text(frozenAt),
    };
  }

  /** Lo previsto, en la fecha dada, por una foto; null si esa fecha no está en lo que se congeló. */
  function predictedAt(freeze, date) {
    if (!freeze || !validIsoDate(date) || !validIsoDate(freeze.date)) return null;
    const index = daysBetween(freeze.date, date);
    if (index < 0 || index >= freeze.totals.length) return null;
    return freeze.totals[index];
  }

  /** Una copia o una versión de la nube corrupta no puede colar una foto que no sea una serie de números. */
  function normalizeStore(raw) {
    const freezes = raw && typeof raw === "object" && !Array.isArray(raw) && raw.freezes && typeof raw.freezes === "object" ? raw.freezes : {};
    const clean = {};
    Object.values(freezes).forEach((entry) => {
      if (!entry || typeof entry !== "object") return;
      const slot = SLOTS.find((candidate) => candidate.id === entry.slot);
      const totals = Array.isArray(entry.totals) ? entry.totals : [];
      const valid = slot && validMonthKey(entry.monthKey) && validIsoDate(entry.date) && entry.date.slice(0, 7) === entry.monthKey
        && totals.length > 0 && totals.every((value) => typeof value === "number" && Number.isFinite(value)) && Number.isFinite(entry.closing);
      if (!valid) return;
      clean[freezeKey(entry.monthKey, entry.slot)] = { ...entry, key: freezeKey(entry.monthKey, entry.slot) };
    });
    return { freezes: clean };
  }

  /** Añade la foto si esa ventana aún no tiene la suya. Nunca sustituye una existente. */
  function recordFreeze(store, freeze) {
    const current = normalizeStore(store);
    if (!freeze || current.freezes[freeze.key]) return { store: current, added: false };
    const all = { ...current.freezes, [freeze.key]: freeze };
    const kept = Object.keys(all).sort().slice(-MAX_FREEZES);
    return { store: { freezes: Object.fromEntries(kept.map((key) => [key, all[key]])) }, added: true };
  }

  /**
   * El paso que da la app al abrirse: si hoy es día de foto y esa ventana aún no la tiene, la hace. Devuelve
   * el almacén resultante y la foto solo si es nueva (así quien llama sabe si tiene que guardar).
   * @param {{ store: any, today: string, rows: Array<any>, balanceMode?: string, balanceDate?: string, now?: string }} input
   */
  function freezeIfDue({ store, today, rows, balanceMode, balanceDate, now }) {
    const current = normalizeStore(store);
    const slot = slotOn(today);
    if (!slot || current.freezes[freezeKey(today.slice(0, 7), slot.id)]) return { store: current, freeze: null };
    const freeze = buildFreeze({ today, rows, balanceMode, balanceDate, frozenAt: now });
    if (!freeze) return { store: current, freeze: null };
    const result = recordFreeze(current, freeze);
    return { store: result.store, freeze: result.added ? freeze : null };
  }

  /** La próxima ventana de foto sin hacer, mirando hasta 45 días: `{ date, slot, isToday }`. */
  function nextFreeze(store, today) {
    if (!validIsoDate(today)) return null;
    const current = normalizeStore(store);
    for (let offset = 0; offset < 45; offset += 1) {
      const date = addDaysIso(today, offset);
      const slot = slotOn(date);
      if (slot && !current.freezes[freezeKey(date.slice(0, 7), slot.id)]) return { date, slot: slot.id, isToday: offset === 0 };
    }
    return null;
  }

  function bankTotal(close) {
    const values = BANK_ACCOUNTS.map((id) => close?.accounts?.[id]);
    return values.every((value) => typeof value === "number" && Number.isFinite(value)) ? round2(values.reduce((sum, value) => sum + value, 0)) : null;
  }

  /**
   * Cada foto con su cierre: previsto y real en la fecha de los saldos del cierre. `status` dice por qué
   * una fila no cuenta; solo «comparable» entra en las medias. `staleDays`: cuántos días antes de la foto eran
   * los saldos de partida (para leer el error con ese contexto, no para descartarlo).
   * @param {{ store: any, closes?: any }} input
   */
  function compare({ store, closes }) {
    const freezes = Object.values(normalizeStore(store).freezes).sort((left, right) => left.key.localeCompare(right.key));
    const months = closes && typeof closes === "object" && closes.months && typeof closes.months === "object" ? closes.months : {};
    const rows = [];
    const pending = [];
    freezes.forEach((freeze) => {
      const close = months[freeze.monthKey];
      if (!close || !validIsoDate(close.date)) {
        pending.push({ key: freeze.key, monthKey: freeze.monthKey, slot: freeze.slot, frozenOn: freeze.date, closing: freeze.closing });
        return;
      }
      const row = {
        key: freeze.key,
        monthKey: freeze.monthKey,
        slot: freeze.slot,
        frozenOn: freeze.date,
        closeDate: close.date,
        staleDays: freeze.balanceDate ? Math.max(0, daysBetween(freeze.balanceDate, freeze.date)) : null,
        status: "comparable",
        predicted: null,
        actual: null,
        error: null,
      };
      const actual = bankTotal(close);
      const predicted = predictedAt(freeze, close.date);
      if (close.mode === "auto") row.status = "calculado";
      else if (freeze.balanceMode !== "manual") row.status = "partida-calculada";
      else if (actual === null) row.status = "sin-cuentas";
      else if (predicted === null) row.status = "fuera-de-serie";
      else {
        row.predicted = predicted;
        row.actual = actual;
        row.error = round2(predicted - actual);
      }
      rows.push(row);
    });
    return { rows, pending };
  }

  function mean(values) {
    return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
  }

  /**
   * Las cifras de una ventana (o de todas). Con menos de MIN_CLOSES cierres comparables solo se cuenta cuántos
   * hay: ni media, ni sesgo, ni porcentaje. La tendencia exige TREND_CLOSES.
   * @param {Array<any>} comparable filas «comparable», de meses distintos
   */
  function statistics(comparable) {
    const list = comparable.slice().sort((left, right) => left.monthKey.localeCompare(right.monthKey));
    const n = list.length;
    const result = { n, enough: n >= MIN_CLOSES, missing: Math.max(0, MIN_CLOSES - n), mae: null, bias: null, pct: null, biasLabel: "", trend: "" };
    if (!result.enough) return result;
    const absErrors = list.map((row) => Math.abs(row.error));
    result.mae = round2(mean(absErrors));
    result.bias = round2(mean(list.map((row) => row.error)));
    const meanActual = mean(list.map((row) => Math.abs(row.actual)));
    result.pct = meanActual > 0 ? Math.round((mean(absErrors) / meanActual) * 1000) / 10 : null;
    result.biasLabel = Math.abs(result.bias) < 0.3 * result.mae ? "sin-sesgo" : result.bias > 0 ? "optimista" : "pesimista";
    if (n >= TREND_CLOSES) {
      const half = Math.floor(n / 2);
      const early = mean(absErrors.slice(0, half));
      const late = mean(absErrors.slice(n - half));
      result.trend = late < early * 0.9 ? "baja" : late > early * 1.1 ? "sube" : "estable";
    }
    return result;
  }

  /**
   * Todo lo que enseña la pantalla: las filas, las fotos que esperan su cierre, las cifras de cada ventana, y
   * cuándo toca la próxima foto.
   * @param {{ store: any, closes?: any, today?: string }} input
   */
  function evaluate({ store, closes, today }) {
    const { rows, pending } = compare({ store, closes });
    const slots = SLOTS.map((slot) => ({
      slot: slot.id,
      label: slot.label,
      window: `${slot.firstDay}-${slot.lastDay}`,
      ...statistics(rows.filter((row) => row.slot === slot.id && row.status === "comparable")),
    }));
    return {
      rows,
      pending,
      slots,
      excluded: rows.filter((row) => row.status !== "comparable"),
      next: today ? nextFreeze(store, today) : null,
      minCloses: MIN_CLOSES,
    };
  }

  // La ventana con la que se titula: la del día 15 (más cerca del fin de mes, la que más dice) si ya tiene datos
  // suficientes; si no, la del día 1; si ninguna, la que más cierres lleve.
  function headline(result) {
    const enough = ["d15", "d01"].map((id) => result.slots.find((slot) => slot.slot === id)).find((slot) => slot?.enough);
    return enough || result.slots.slice().sort((left, right) => right.n - left.n)[0];
  }

  function defaultMoney(value) {
    return `${Math.round(value).toLocaleString("es-ES")} €`;
  }

  function biasText(slot, money) {
    if (slot.biasLabel === "sin-sesgo") return "sin sesgo claro: se equivoca a veces por arriba y a veces por abajo";
    const direction = slot.biasLabel === "optimista" ? "esperaba más dinero del que hubo" : "esperaba menos dinero del que hubo";
    return `${direction} (${money(Math.abs(slot.bias))} de media)`;
  }

  /** Una línea para el resumen plegado. */
  function summaryText(result, options = {}) {
    const money = options.money || defaultMoney;
    const top = headline(result);
    if (!top || !top.enough) return `Acierto de la caja a fin de mes: datos insuficientes (${top ? top.n : 0} de ${result.minCloses} cierres)`;
    return `Acierto de la caja a fin de mes: error medio ${money(top.mae)}${top.pct === null ? "" : ` (${String(top.pct).replace(".", ",")} %)`} con la foto del ${top.label}`;
  }

  function slotCard(slot, money) {
    const title = `Foto del ${slot.label} (días ${slot.window})`;
    if (!slot.enough) {
      const detail = slot.n
        ? `${slot.n} de ${MIN_CLOSES} cierres comparables. Con menos de ${MIN_CLOSES} no se da ningún error: sería precisión inventada.`
        : `Aún sin ningún cierre comparable. Hacen falta ${MIN_CLOSES}; con menos no se da ningún error, sería precisión inventada.`;
      return `<li><div class="panel-uso-cabecera"><strong>${escapeHtml(title)}</strong><span class="panel-uso-valor">—</span></div><p><span class="status-pill neutral">Datos insuficientes</span> ${escapeHtml(detail)}</p></li>`;
    }
    const pct = slot.pct === null ? "" : ` (${String(slot.pct).replace(".", ",")} % de la liquidez)`;
    const trend = slot.trend ? ` Tendencia del error: ${{ baja: "baja", sube: "sube", estable: "estable" }[slot.trend]}.` : "";
    const tone = slot.trend === "sube" ? "warn" : "neutral";
    return `<li><div class="panel-uso-cabecera"><strong>${escapeHtml(title)}</strong><span class="panel-uso-valor">${escapeHtml(money(slot.mae))}</span></div><p><span class="status-pill ${tone}">Error medio</span> En ${slot.n} cierres${escapeHtml(pct)}: ${escapeHtml(biasText(slot, money))}.${escapeHtml(trend)}</p></li>`;
  }

  /**
   * La pantalla (Plan › Previsión, plegada). Solo cifras de caja del hogar, sin nombres de partidas.
   * @param {ReturnType<typeof evaluate>} result
   * @param {{ money?: (value: number) => string }} [options]
   */
  function renderHtml(result, options = {}) {
    const money = options.money || defaultMoney;
    const intro = `<p class="e19-kpi-note">Los días 1 y 15 de cada mes la app congela cuánto dinero espera tener en CaixaBank y Mediolanum a fin de mes. Al firmar el cierre con saldos del banco lo compara con la realidad. Aquí se mide, no se corrige nada.</p>`;
    const cards = `<ul class="panel-uso-lista prevision-calidad">${result.slots.map((slot) => slotCard(slot, money)).join("")}</ul>`;
    const waiting = result.pending.length
      ? `<p class="e19-kpi-note">Esperan su cierre: ${result.pending.map((item) => `foto del ${formatDate(item.frozenOn)}, ${money(item.closing)} previstos para fin de ${monthName(item.monthKey)}`).map(escapeHtml).join("; ")}. Se comparan al firmar el cierre de ese mes en Registrar.</p>`
      : "";
    const skipped = result.excluded.length
      ? `<p class="e19-kpi-note">No cuentan: ${result.excluded.map((row) => `${monthName(row.monthKey)} (foto del ${formatDate(row.frozenOn)}): ${REASONS[row.status] || row.status}`).map(escapeHtml).join("; ")}.</p>`
      : "";
    const next = result.next
      ? `<p class="e19-kpi-note">${result.next.isToday ? "Hoy toca foto: se hace al abrir la app." : `Próxima foto: ${escapeHtml(formatDate(result.next.date))}.`}</p>`
      : "";
    return `${intro}${cards}${waiting}${skipped}${next}`;
  }

  return { STORE_NAME, SLOTS, MIN_CLOSES, TREND_CLOSES, TAIL_DAYS, slotOn, buildFreeze, predictedAt, normalizeStore, recordFreeze, freezeIfDue, nextFreeze, compare, statistics, evaluate, summaryText, renderHtml };
});
