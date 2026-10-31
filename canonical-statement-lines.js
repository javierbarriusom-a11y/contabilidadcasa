// XDA-03 (26/10/2026): extractos que solo existen como PDF. Convierte LÍNEAS de un extracto (el texto pegado de un PDF,
// nivel 1, o las filas que pdf.js rehace por posición, nivel 2) en movimientos { date, valueDate, movement, details,
// amount, balance }, los mismos que da el lector de CSV (canonical-statement-profiles.js). Motor puro: no lee el
// navegador ni guarda nada; el texto solo vive en memoria.
//
// No hay un formato por banco (no se inventa: WP-51). Se reconoce la forma de una línea de movimiento: una fecha al
// principio (y quizá la fecha valor), importes con formato español al final (el último, el saldo, si hay dos) y el
// concepto en medio. Lo que hace fiable una lectura genérica es el CUADRE: si el extracto trae saldos, cada fila tiene
// que cumplir saldo anterior + importe = saldo; con eso se fijan además los signos de los importes que el PDF no marca.
// Una lectura equivocada no cuadra, y la revisión de Importar la bloquea (P11).
(function exposeStatementLines(root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.FinanceCanonicalStatementLines = api;
})(typeof globalThis !== "undefined" ? globalThis : this, () => {
  const SCHEMA_ID = "finance-xda03-statement-lines/v1";
  const OPENING = /saldo\s+(anterior|inicial|de\s+apertura)/i;
  const CLOSING = /saldo\s+(final|actual|de\s+cierre)/i;
  const round2 = (n) => Math.round(n * 100) / 100;
  const close = (a, b) => Math.abs(a - b) < 0.015;

  // ---------- fechas e importes ----------

  const DATE_FULL = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2}|\d{4})$/;
  const DATE_SHORT = /^(\d{1,2})[/.-](\d{1,2})$/;

  function iso(y, m, d) {
    const date = new Date(Date.UTC(y, m - 1, d));
    if (date.getUTCFullYear() !== y || date.getUTCMonth() !== m - 1 || date.getUTCDate() !== d) return null;
    return `${String(y).padStart(4, "0")}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  }

  // Una fecha en un token (día/mes/año, día/mes con el año del contexto). Devuelve ISO o null.
  function parseDate(token, year) {
    const t = String(token || "").trim();
    let m = DATE_FULL.exec(t);
    if (m) {
      const y = m[3].length === 2 ? 2000 + Number(m[3]) : Number(m[3]);
      return iso(y, Number(m[2]), Number(m[1]));
    }
    m = DATE_SHORT.exec(t);
    if (m && year) return iso(year, Number(m[2]), Number(m[1]));
    return null;
  }

  // Un importe español: «1.234,56», «-86,40», «86,40-», «(86,40)», con o sin «€»/«EUR». Devuelve { value, signed } o null.
  function parseAmount(token) {
    let t = String(token || "").replace(/€|eur$/gi, "").trim();
    if (!t) return null;
    let negative = false;
    let signed = false;
    if (/^\(.*\)$/.test(t)) { negative = true; signed = true; t = t.slice(1, -1); }
    if (/^[+-]/.test(t)) { signed = true; negative = t[0] === "-"; t = t.slice(1); }
    if (/-$/.test(t)) { signed = true; negative = true; t = t.slice(0, -1); }
    if (!/^(\d{1,3}(\.\d{3})+|\d+),\d{2}$/.test(t)) return null;
    const value = Number(t.replace(/\./g, "").replace(",", "."));
    return Number.isFinite(value) ? { value: negative ? -value : value, signed } : null;
  }

  // Fecha con el mes en letra, como la escriben las webs de los bancos: «31 oct 2026», «31 oct. 2026», «31 de octubre de
  // 2026» o «31 oct» (con el año del contexto). Lee desde el principio de `tokens`; devuelve { date, used } o null.
  const MESES = { ene: 1, feb: 2, mar: 3, abr: 4, may: 5, jun: 6, jul: 7, ago: 8, sep: 9, set: 9, oct: 10, nov: 11, dic: 12 };
  function parseWordDate(tokens, year) {
    const day = /^(\d{1,2})$/.exec(tokens[0] || "");
    if (!day) return null;
    let i = 1;
    if (/^de$/i.test(tokens[i] || "")) i += 1;
    const month = MESES[String(tokens[i] || "").toLowerCase().replace(/\.$/, "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").slice(0, 3)];
    if (!month || !/^[a-záéíóú]{3,10}\.?$/i.test(tokens[i])) return null;
    i += 1;
    let y = year;
    let j = i;
    if (/^de$/i.test(tokens[j] || "")) j += 1;
    if (/^\d{4}$/.test(tokens[j] || "")) { y = Number(tokens[j]); i = j + 1; }
    if (!y) return null;
    const date = iso(y, month, Number(day[1]));
    return date ? { date, used: i } : null;
  }

  // El año de las fechas cortas («12/10»): el de la primera fecha completa del texto, o el que se pase.
  function contextYear(lines, fallback) {
    for (const line of lines) {
      const tokens = String(line.text || "").split(/\s+/);
      for (const token of tokens) {
        const date = parseDate(token);
        if (date) return Number(date.slice(0, 4));
      }
      const word = parseWordDate(tokens, null);
      if (word) return Number(word.date.slice(0, 4));
    }
    return fallback || null;
  }

  // ---------- de texto o de piezas con posición a líneas ----------

  function linesFromText(text) {
    return String(text || "").replace(/\r\n?/g, "\n").split("\n").map((t, i) => ({ line: i + 1, text: t.replace(/\t/g, " ").replace(/ /g, " ").trim() })).filter((l) => l.text);
  }

  // pdf.js da trozos de texto con su posición: { str, x, y, page }. Se agrupan en líneas por página y altura (con
  // tolerancia) y, dentro de cada línea, de izquierda a derecha.
  function linesFromItems(items, tolerance = 2.5) {
    const sorted = (Array.isArray(items) ? items : [])
      .filter((it) => it && String(it.str || "").trim() && Number.isFinite(it.x) && Number.isFinite(it.y))
      .sort((a, b) => (a.page || 1) - (b.page || 1) || b.y - a.y || a.x - b.x);
    const lines = [];
    sorted.forEach((it) => {
      const last = lines[lines.length - 1];
      if (last && last.page === (it.page || 1) && Math.abs(last.y - it.y) <= tolerance) last.items.push(it);
      else lines.push({ page: it.page || 1, y: it.y, items: [it] });
    });
    return lines.map((l, i) => ({ line: i + 1, page: l.page, text: l.items.sort((a, b) => a.x - b.x).map((it) => String(it.str).trim()).join(" ") }));
  }

  // ---------- de líneas a movimientos ----------

  // Una línea partida en: fechas del principio, importes del final y concepto en medio.
  // El «€» o «EUR» suelto (la web lo separa del importe con un espacio) no es parte del concepto ni corta los importes.
  function split(text, year) {
    const tokens = String(text).split(/\s+/).filter((t) => t && !/^(€|eur)$/i.test(t));
    const dates = [];
    while (tokens.length && dates.length < 2) {
      const d = parseDate(tokens[0], year);
      if (d) { dates.push(d); tokens.shift(); continue; }
      const word = parseWordDate(tokens, year);
      if (!word) break;
      dates.push(word.date);
      tokens.splice(0, word.used);
    }
    const amounts = [];
    while (tokens.length && amounts.length < 3) {
      const a = parseAmount(tokens[tokens.length - 1]);
      if (!a) break;
      amounts.unshift(a);
      tokens.pop();
    }
    return { dates, amounts, concept: tokens.join(" ").trim() };
  }

  function parse(lines, options = {}) {
    const list = Array.isArray(lines) ? lines : [];
    const year = contextYear(list, options.year || (options.today ? Number(String(options.today).slice(0, 4)) : null));
    const rows = [];
    const errors = [];
    let opening = null;
    let closing = null;
    let pending = null; // una fila con fecha y concepto cuyos importes llegaron en la línea siguiente (texto pegado)

    const finish = (row, amounts, line) => {
      if (!amounts.length) { errors.push({ line, reason: "movimiento sin importe" }); return; }
      const amount = amounts.length >= 2 ? amounts[amounts.length - 2] : amounts[0];
      const balance = amounts.length >= 2 ? amounts[amounts.length - 1] : null;
      rows.push({ line: row.line, lastLine: line, date: row.date, valueDate: row.valueDate || row.date, movement: row.concept || "(sin concepto)", details: "", amount: amount.value, signed: amount.signed, balance: balance ? balance.value : null });
    };

    list.forEach(({ line, text }) => {
      if (OPENING.test(text)) {
        const a = split(text, year).amounts.at(-1);
        if (a) opening = a.value;
        return;
      }
      if (CLOSING.test(text)) {
        const a = split(text, year).amounts.at(-1);
        if (a) closing = a.value;
        return;
      }
      const parts = split(text, year);
      if (parts.dates.length) {
        if (pending) { errors.push({ line: pending.line, reason: "movimiento sin importe" }); pending = null; }
        const row = { line, date: parts.dates[0], valueDate: parts.dates[1] || "", concept: parts.concept };
        if (parts.amounts.length) finish(row, parts.amounts, line);
        else pending = row;
        return;
      }
      if (pending && parts.amounts.length && !parts.concept) { finish(pending, parts.amounts, line); pending = null; return; }
      if (pending && !parts.amounts.length) { pending.concept = `${pending.concept} ${text}`.trim().slice(0, 140); return; }
      const prev = rows[rows.length - 1];
      // Copiado de una web, cada dato en su línea: el importe y, en la línea de debajo, el saldo.
      if (prev && parts.amounts.length === 1 && !parts.concept && prev.balance === null && prev.lastLine === line - 1) {
        prev.balance = parts.amounts[0].value;
        prev.lastLine = line;
        return;
      }
      // Una línea sin fecha ni importes justo después de un movimiento: el concepto sigue (en el PDF ocupa dos líneas).
      if (prev && !parts.amounts.length && prev.line >= line - 1 && text.length <= 80 && !/^(fecha|concepto|saldo|importe|movimientos|p[aá]gina)\b/i.test(text)) {
        prev.details = `${prev.details} ${text}`.trim().slice(0, 140);
        prev.line = line; // para encadenar una tercera línea
      }
    });
    if (pending) errors.push({ line: pending.line, reason: "movimiento sin importe" });

    if (!contextYear(list, null) && options.today) {
      rows.forEach((r) => {
        [r.date, r.valueDate].forEach((d, k) => {
          if (d && d > options.today) {
            const back = `${Number(d.slice(0, 4)) - 1}${d.slice(4)}`;
            if (k === 0) r.date = back; else r.valueDate = back;
          }
        });
      });
    }
    const signs = fixSigns(rows, opening);
    const read = rows.filter((r) => r.amount !== null);
    const check = checkBalances(read, opening);
    const transactions = read.map((r) => ({ date: r.date, valueDate: r.valueDate, movement: r.movement, details: r.details, amount: round2(r.amount), balance: r.balance === null ? null : round2(r.balance) }));
    const unsure = rows.filter((r) => r.amount === null).map((r) => ({ line: r.line, reason: "no se sabe si es cargo o abono (sin saldo con que comprobarlo)" }));
    const warnings = [];
    if (signs.inferred) warnings.push({ code: "signos-por-saldo", text: `${signs.inferred === 1 ? "1 importe sin signo" : `${signs.inferred} importes sin signo`} en el PDF: su signo sale del saldo de su fila.` });
    if (check.status === "no-cuadra") warnings.push({ code: "saldo-no-cuadra", text: `Los saldos no encajan con los importes desde la línea ${check.breakAt}: puede que falte una fila o que una línea se haya leído mal.` });
    if (closing !== null && transactions.length && transactions.some((t) => t.balance !== null)) {
      const last = check.direction === "descendente" ? transactions[0] : transactions[transactions.length - 1];
      if (last.balance !== null && !close(last.balance, closing)) warnings.push({ code: "saldo-final", text: "El saldo final del PDF no coincide con el de la última fila leída." });
    }
    return {
      schema: SCHEMA_ID, ok: transactions.length > 0, year, opening, closing, transactions,
      errors: [...errors, ...unsure], warnings, balanceCheck: check,
      structure: { lines: list.length, movements: rows.length, withBalance: transactions.filter((t) => t.balance !== null).length, inferredSigns: signs.inferred },
    };
  }

  // Los importes sin signo se fijan con el saldo: si saldo − saldo anterior = ±importe, ese es su signo. En orden
  // descendente (lo más nuevo arriba) se compara con la fila de abajo. Lo que no se puede fijar queda como dudoso.
  function fixSigns(rows, opening) {
    const anySigned = rows.some((r) => r.signed && r.amount < 0);
    const withBalance = rows.filter((r) => r.balance !== null);
    // El PDF ya marca los cargos (con «-»): los demás son abonos tal cual.
    if (anySigned) return { inferred: 0 };
    // Ni signos ni saldos: no hay forma de saber qué es cargo y qué abono; no se adivina.
    if (!withBalance.length) {
      rows.forEach((r) => { r.amount = null; });
      return { inferred: 0 };
    }
    const asc = rows.length < 2 || rows[0].date <= rows[rows.length - 1].date;
    let inferred = 0;
    rows.forEach((r, i) => {
      const prevBalance = asc ? (i === 0 ? opening : rows[i - 1].balance) : (i === rows.length - 1 ? opening : rows[i + 1].balance);
      if (r.balance === null || prevBalance === null || prevBalance === undefined) { if (!r.signed) r.amount = null; return; }
      const delta = round2(r.balance - prevBalance);
      if (close(Math.abs(delta), Math.abs(r.amount))) { r.amount = delta; inferred += 1; }
      else if (!r.signed) r.amount = null; // ni cuadra ni lo marca el PDF: no se adivina
    });
    return { inferred };
  }

  function checkBalances(transactions, opening) {
    const rows = transactions.filter((t) => t.balance !== null);
    if (!rows.length) return { status: "sin-saldos", pairs: 0 };
    const asc = transactions.length < 2 || transactions[0].date <= transactions[transactions.length - 1].date;
    const ordered = asc ? transactions : transactions.slice().reverse();
    let prev = opening;
    let pairs = 0;
    for (let i = 0; i < ordered.length; i += 1) {
      const t = ordered[i];
      if (t.balance === null) { prev = null; continue; }
      if (prev !== null && prev !== undefined) {
        pairs += 1;
        if (!close(t.balance, prev + t.amount)) return { status: "no-cuadra", pairs, breakAt: t.line || i + 1, direction: asc ? "ascendente" : "descendente" };
      }
      prev = t.balance;
    }
    return { status: pairs ? "cuadra" : "sin-saldos", pairs, direction: asc ? "ascendente" : "descendente" };
  }

  // Para enseñar (y copiar) sin datos: cuántas líneas, cuántos movimientos, qué no se leyó y por qué.
  function diagnostic(result) {
    return {
      schema: SCHEMA_ID,
      lines: result.structure.lines,
      movements: result.structure.movements,
      withBalance: result.structure.withBalance,
      inferredSigns: result.structure.inferredSigns,
      check: result.balanceCheck.status,
      errors: result.errors.map((e) => `línea ${e.line}: ${e.reason}`),
    };
  }

  return { SCHEMA_ID, parseDate, parseAmount, linesFromText, linesFromItems, parse, checkBalances, diagnostic };
});
