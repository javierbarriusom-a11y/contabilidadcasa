(function attachCanonicalPortfolioLedger(root, factory) {
  const api = factory(typeof module === "object" && module.exports ? require("./canonical-portfolio.js") : root && root.FinanceCanonicalPortfolio);
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.FinanceCanonicalPortfolioLedger = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function canonicalPortfolioLedgerFactory(defaultPortfolio) {
  "use strict";

  // WP-48 (NIN-06, docs/WP48_DISENO.md): el libro de operaciones de una posición, editable, con el recálculo FIFO ANTES de guardar y un «antes / después» de lo que cambia.
  //   · operations: la compra inicial, las aportaciones y las ventas de una posición, en orden cronológico.
  //   · applyChange: añadir, editar o quitar una operación → la posición nueva (sin tocar la de entrada).
  //   · diff: qué cambia en las unidades, el coste, la plusvalía realizada y la de cada venta, qué ventas se quedan sin lotes, y qué ejercicios fiscales se mueven (con la compensación del año
  //     que ya calcula FC3).
  // El reparto FIFO NO se reimplementa: se pregunta a `canonical-portfolio.js` (normalizePositions → fifoLedger), que es el que usan Hoy, Renta y la compensación. Motor puro: ni DOM, ni red,
  // ni almacenamiento, ni reloj. NUNCA guarda nada (el que llama decide).
  //
  // Reglas de honestidad:
  //   · una venta sin lotes suficientes a su fecha NO se bloquea (puede que se esté corrigiendo la compra en el paso siguiente): se marca y su plusvalía queda «no calculable», nunca a medias.
  //   · una compra sin fecha o sin unidades no entra en el reparto FIFO; se dice, porque deja sin lotes a las ventas.
  //   · un ejercicio con una venta sin lotes no tiene compensación calculable (el motor de FC3 lo rechaza): el «después» lo dice en lugar de enseñar una cifra a medias.

  // El motor de cartera se resuelve al usarlo, no al cargar: en el navegador este fichero puede cargarse antes que canonical-portfolio.js.
  const resolvePortfolio = (given) => given || defaultPortfolio || (typeof globalThis !== "undefined" ? globalThis.FinanceCanonicalPortfolio : null);

  const SCHEMA_ID = "finance-portfolio-ledger/v1";
  const INITIAL_ID = "initial";

  const number = (value, fallback = 0) => (Number.isFinite(Number(value)) && value !== "" && value !== null && value !== undefined ? Number(value) : fallback);
  const known = (value) => value !== "" && value !== null && value !== undefined && Number.isFinite(Number(value));
  const text = (value) => String(value ?? "").trim();
  const dmy = (iso) => text(iso).split("-").reverse().join("/");
  const addMonthsIso = (iso, months) => { const [y, m, d] = text(iso).split("-").map(Number); const moved = new Date(Date.UTC(y, m - 1 + months, 1)); const last = new Date(Date.UTC(moved.getUTCFullYear(), moved.getUTCMonth() + 1, 0)).getUTCDate(); return new Date(Date.UTC(moved.getUTCFullYear(), moved.getUTCMonth(), Math.min(d, last))).toISOString().slice(0, 10); };
  // Compras de la misma posición en los dos meses POSTERIORES a la venta (las anteriores que siguen en cartera también cuentan para la norma, pero no se sabe cuáles siguen: no se evalúan).
  const repurchasedAfter = (saleDate, dates) => isIsoDate(saleDate) && dates.some((date) => date >= saleDate && date <= addMonthsIso(saleDate, 2));

  function isIsoDate(value) {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text(value));
    if (!match) return false;
    const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
    return date.getUTCFullYear() === Number(match[1]) && date.getUTCMonth() === Number(match[2]) - 1 && date.getUTCDate() === Number(match[3]);
  }

  /**
   * Las operaciones de una posición cruda, en orden cronológico (a igual fecha, la compra antes que la venta: es el orden en que el motor las reparte).
   * @param {any} raw
   */
  function operations(raw) {
    const position = raw && typeof raw === "object" ? raw : {};
    const list = [];
    const quantity = known(position.quantity) ? number(position.quantity) : 0;
    const cost = known(position.costBasis) ? number(position.costBasis) : 0;
    const date = isIsoDate(position.acquisitionDate) ? text(position.acquisitionDate) : "";
    if (date || quantity > 0 || cost > 0) list.push({ id: INITIAL_ID, source: "initial", kind: "buy", date, quantity, amount: cost, removable: false });
    (Array.isArray(position.contributions) ? position.contributions : []).forEach((item, index) => {
      list.push({ id: text(item && item.id) || `contribution-${index + 1}`, source: "contribution", kind: "buy", date: isIsoDate(item && item.date) ? text(item.date) : "", quantity: known(item && item.quantity) ? number(item.quantity) : 0, amount: known(item && item.amount) ? number(item.amount) : 0, removable: true });
    });
    (Array.isArray(position.disposals) ? position.disposals : []).forEach((item, index) => {
      list.push({ id: text(item && item.id) || `disposal-${index + 1}`, source: "disposal", kind: "sell", date: isIsoDate(item && item.date) ? text(item.date) : "", quantity: known(item && item.quantitySold) ? number(item.quantitySold) : 0, amount: known(item && item.saleProceeds) ? number(item.saleProceeds) : 0, removable: true });
    });
    return list
      .map((item, index) => ({ item, index }))
      .sort((a, b) => (a.item.date || "").localeCompare(b.item.date || "") || (a.item.kind === b.item.kind ? 0 : a.item.kind === "buy" ? -1 : 1) || a.index - b.index)
      .map((entry) => entry.item);
  }

  /**
   * Lo que no se puede guardar: una fecha que no existe, un importe negativo, una venta sin unidades, una compra sin importe. Devuelve la lista de problemas en español (vacía si vale).
   * @param {{id?: string, kind?: string, source?: string, date?: string, quantity?: number|string, amount?: number|string}} operation
   */
  function validate(operation) {
    const problems = [];
    const op = operation || {};
    const isSale = op.kind === "sell";
    if (!isIsoDate(op.date)) problems.push("La fecha no es válida (usa aaaa-mm-dd).");
    if (!known(op.quantity) && text(op.quantity) !== "") problems.push("Las unidades no son un número válido.");
    else if (known(op.quantity) && number(op.quantity) < 0) problems.push("Las unidades no pueden ser negativas.");
    if (!known(op.amount) && text(op.amount) !== "") problems.push("El importe no es un número válido.");
    else if (known(op.amount) && number(op.amount) < 0) problems.push("El importe no puede ser negativo.");
    if (isSale && !(known(op.quantity) && number(op.quantity) > 0)) problems.push("Una venta necesita unidades vendidas, mayor que cero.");
    if (!isSale && op.source !== "initial" && !(known(op.amount) && number(op.amount) > 0)) problems.push("Una aportación necesita un importe mayor que cero.");
    return problems;
  }

  const clone = (raw) => JSON.parse(JSON.stringify(raw || {}));

  /**
   * Aplica un cambio y devuelve la posición nueva. `change`: {action: "add"|"edit"|"remove", operation: {id, kind, source, date, quantity, amount}}. No toca la posición de entrada.
   * La compra inicial (id «initial») se edita, no se quita; sus tres datos viven en la propia posición.
   * @param {any} raw
   * @param {{action?: string, operation?: any}} change
   */
  function applyChange(raw, change) {
    const action = change && change.action;
    const op = change && change.operation ? change.operation : {};
    const id = text(op.id);
    if (!id) return { ok: false, reason: "Falta el identificador de la operación." };
    const next = clone(raw);
    if (id === INITIAL_ID) {
      if (action !== "edit") return { ok: false, reason: "La compra inicial no se añade ni se quita: se edita." };
      const problems = validate({ ...op, kind: "buy", source: "initial" });
      if (problems.length) return { ok: false, reason: problems[0], problems };
      next.acquisitionDate = text(op.date);
      next.quantity = known(op.quantity) ? number(op.quantity) : 0;
      next.costBasis = known(op.amount) ? number(op.amount) : 0;
      return { ok: true, position: next };
    }
    const isSale = op.kind === "sell" || op.source === "disposal";
    const key = isSale ? "disposals" : "contributions";
    const rows = Array.isArray(next[key]) ? next[key] : [];
    const at = rows.findIndex((item) => text(item && item.id) === id);
    if (action === "remove") {
      if (at < 0) return { ok: false, reason: "No encuentro esa operación." };
      next[key] = rows.filter((_, index) => index !== at);
      return { ok: true, position: next };
    }
    if (action !== "add" && action !== "edit") return { ok: false, reason: "Acción desconocida." };
    if (action === "edit" && at < 0) return { ok: false, reason: "No encuentro esa operación." };
    if (action === "add" && at >= 0) return { ok: false, reason: "Ya hay una operación con ese identificador." };
    const problems = validate({ ...op, kind: isSale ? "sell" : "buy", source: isSale ? "disposal" : "contribution" });
    if (problems.length) return { ok: false, reason: problems[0], problems };
    const row = isSale
      ? { ...(at >= 0 ? rows[at] : {}), id, date: text(op.date), quantitySold: number(op.quantity), saleProceeds: known(op.amount) ? number(op.amount) : 0 }
      : { ...(at >= 0 ? rows[at] : {}), id, date: text(op.date), amount: number(op.amount), quantity: known(op.quantity) && number(op.quantity) > 0 ? number(op.quantity) : 0 };
    next[key] = at >= 0 ? rows.map((item, index) => (index === at ? row : item)) : [...rows, row];
    return { ok: true, position: next };
  }

  /** La posición cruda, normalizada por el motor de cartera (con su reparto FIFO). */
  function snapshot(raw, portfolio = null) {
    return resolvePortfolio(portfolio).normalizePositions([raw]).positions[0];
  }

  /** Avisos de una posición normalizada: lo que deja sin lotes a una venta o fuera del FIFO una compra. */
  function warnings(raw, normalized) {
    const found = [];
    const position = raw || {};
    const sales = normalized && Array.isArray(normalized.disposals) ? normalized.disposals : [];
    if (known(position.quantity) && number(position.quantity) > 0 && !isIsoDate(position.acquisitionDate)) {
      found.push({ code: "initial-without-date", text: "La compra inicial no tiene fecha: no entra en el reparto FIFO, y cualquier venta se queda sin lotes." });
    }
    (Array.isArray(position.contributions) ? position.contributions : []).forEach((item) => {
      if (!(known(item && item.quantity) && number(item.quantity) > 0)) found.push({ code: "buy-without-units", id: text(item && item.id), text: "Una aportación sin unidades suma al coste pero no entra en el reparto FIFO de las ventas." });
    });
    // Norma de no recompra (en valores cotizados, dos meses antes o después): NO se aplica —el motor de compensación no la modela—, solo se avisa de que una pérdida podría diferirse.
    const buyDates = operations(position).filter((item) => item.kind === "buy" && item.date).map((item) => item.date);
    sales.forEach((sale) => {
      if (sale.realizedGain !== null && sale.realizedGain < 0 && repurchasedAfter(sale.date, buyDates)) {
        found.push({ code: "repurchase-risk", id: sale.id, text: `La venta del ${dmy(sale.date)} tiene pérdida y hay una compra de la misma posición en los dos meses siguientes: en valores cotizados la minusvalía podría diferirse (norma de no recompra). La app no lo aplica: compruébalo.` });
      }
    });
    sales.forEach((sale) => {
      if (sale.shortfall > 0) found.push({ code: "shortfall", id: sale.id, text: `La venta del ${dmy(sale.date)} no tiene lotes suficientes a su fecha (faltan ${sale.shortfall} unidades): su plusvalía no se calcula.` });
      else if (!(sale.saleProceeds > 0)) found.push({ code: "sale-without-proceeds", id: sale.id, text: `La venta del ${dmy(sale.date)} no tiene importe recibido: no se puede calcular la rentabilidad.` });
    });
    return found;
  }

  const saleView = (sale) => (sale ? { id: sale.id, date: sale.date, quantitySold: sale.quantitySold, saleProceeds: sale.saleProceeds, consumedCost: sale.consumedCost, realizedGain: sale.realizedGain, shortfall: sale.shortfall } : null);
  const sameSale = (a, b) => a && b && a.date === b.date && a.quantitySold === b.quantitySold && a.saleProceeds === b.saleProceeds && a.consumedCost === b.consumedCost && a.realizedGain === b.realizedGain && a.shortfall === b.shortfall;

  /**
   * Lo que cambia entre dos versiones de una posición. `otherPositions` (crudas) y `priorLosses` sirven para decir cómo se mueve la compensación de cada ejercicio tocado.
   * @param {any} before
   * @param {any} after
   * @param {{portfolio?: any, otherPositions?: any[], priorLosses?: Array<{year?: string|number, amount?: number}>}} [options]
   */
  function diff(before, after, { portfolio: given = null, otherPositions = [], priorLosses = [] } = {}) {
    const portfolio = resolvePortfolio(given);
    const a = snapshot(before, portfolio);
    const b = snapshot(after, portfolio);
    const salesBefore = new Map(a.disposals.map((sale) => [sale.id, sale]));
    const salesAfter = new Map(b.disposals.map((sale) => [sale.id, sale]));
    const ids = [...new Set([...salesBefore.keys(), ...salesAfter.keys()])];
    const sales = ids.map((id) => {
      const x = salesBefore.get(id);
      const y = salesAfter.get(id);
      const change = !x ? "added" : !y ? "removed" : sameSale(x, y) ? "same" : "changed";
      return { id, change, before: saleView(x), after: saleView(y) };
    }).filter((row) => row.change !== "same").sort((p, q) => String((p.after || p.before).date).localeCompare(String((q.after || q.before).date)));
    const newShortfalls = sales.filter((row) => row.after && row.after.shortfall > 0 && !(row.before && row.before.shortfall > 0)).map((row) => row.id);
    const resolvedShortfalls = sales.filter((row) => row.before && row.before.shortfall > 0 && !(row.after && row.after.shortfall > 0)).map((row) => row.id);

    const warnBefore = warnings(before, a);
    const warnAfter = warnings(after, b);
    const keyOf = (item) => `${item.code}|${item.id || ""}`;
    const beforeKeys = new Set(warnBefore.map(keyOf));
    const newWarnings = warnAfter.filter((item) => !beforeKeys.has(keyOf(item)));

    // Ejercicios tocados: el de cada venta que cambia (y, si cambió de fecha, el de antes y el de después).
    const years = [...new Set(sales.flatMap((row) => [row.before, row.after].filter(Boolean).map((sale) => String(sale.date).slice(0, 4))).filter((year) => /^\d{4}$/.test(year)))].sort();
    const others = (Array.isArray(otherPositions) ? otherPositions : []).length ? portfolio.normalizePositions(otherPositions).positions : [];
    const compensation = (position, year) => {
      const result = portfolio.yearEndCompensation({ positions: [...others, position], year, priorLosses });
      return result.calculable
        ? { calculable: true, netResult: result.netResult, taxableNet: result.taxableNet, yearGains: result.yearGains, yearLosses: result.yearLosses }
        : { calculable: false, reason: result.reason };
    };
    const yearImpact = years.map((year) => ({ year, before: compensation(a, year), after: compensation(b, year) }));

    const identical = JSON.stringify(before) === JSON.stringify(after);
    return {
      schemaId: SCHEMA_ID, identical,
      position: {
        quantity: { before: a.quantity, after: b.quantity }, costBasis: { before: a.costBasis, after: b.costBasis },
        realizedGain: { before: a.realizedGain, after: b.realizedGain },
      },
      sales, newShortfalls, resolvedShortfalls, newWarnings, warningsAfter: warnAfter, years: yearImpact,
    };
  }

  return { SCHEMA_ID, INITIAL_ID, isIsoDate, operations, validate, applyChange, snapshot, warnings, diff };
});
