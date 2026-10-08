/**
 * canonical-payroll.js
 *
 * WP-31 · PR-1 (docs/WP31_DISENO.md): las nóminas del hogar, las retenciones acumuladas del año para el estimador de Renta (NPV-11) y el aviso
 * de cambio del % de retención (CAP-05). Motor puro, sin DOM, red ni almacenamiento: la tarjeta vive en nominas-ui.js.
 *
 * Una nómina aquí es SOLO cifras: periodo, titular, pagador (etiqueta libre), bruto, líquido, retención (% e importe) y, si se quiere,
 * cotización del trabajador. Nunca guarda NIF, número de afiliación, IBAN ni el PDF o el texto del que se leyó; `extractFromText` devuelve
 * únicamente periodo e importes y la pantalla no conserva lo que se pegó.
 *
 * Dato ausente no es cero: una nómina sin retención no entra; un mes sin nómina se dice («faltan N meses»), no se cuenta como 0.
 * No ejecuta nada (A11-4): lee y suma lo que el hogar registra.
 */

(function attachPayroll(root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.FinanceCanonicalPayroll = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function payrollFactory() {
  "use strict";

  const SCHEMA_ID = "finanzas-casa-payroll/v1";
  const KINDS = Object.freeze(["ordinaria", "extra"]);
  const MAX_GROSS = 1000000;
  const MAX_PCT = 60;
  const CHANGE_THRESHOLD_POINTS = 0.5;
  const AMOUNT_TOLERANCE = 2; // euros de diferencia entre la retención escrita y la del % sobre el bruto antes de avisar
  const MONTHS = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
  const MONTH_LOOKUP = Object.freeze({ enero: 1, febrero: 2, marzo: 3, abril: 4, mayo: 5, junio: 6, julio: 7, agosto: 8, septiembre: 9, setiembre: 9, octubre: 10, noviembre: 11, diciembre: 12 });

  function round2(value) {
    return Math.round((value + Number.EPSILON) * 100) / 100;
  }

  // «1.644,93», «1644,93», «1644.93», «2.100» (miles), «15,32», «−12,5». Cualquier otra cosa → null.
  function parseAmount(input) {
    if (typeof input === "number") return Number.isFinite(input) ? input : null;
    if (typeof input !== "string") return null;
    const text = input.replace(/[€ ]/g, "").replace("−", "-").trim();
    if (!text) return null;
    let normalized = null;
    if (/^-?\d{1,3}(\.\d{3})+(,\d+)?$/.test(text)) normalized = text.replace(/\./g, "").replace(",", ".");
    else if (/^-?\d+(,\d+)?$/.test(text)) normalized = text.replace(",", ".");
    else if (/^-?\d+(\.\d+)?$/.test(text)) normalized = text;
    if (normalized === null) return null;
    const value = Number(normalized);
    return Number.isFinite(value) ? value : null;
  }

  function isPeriod(value) {
    return typeof value === "string" && /^\d{4}-(0[1-9]|1[0-2])$/.test(value) && Number(value.slice(0, 4)) >= 2000;
  }

  function blank(value) {
    return value === undefined || value === null || String(value).trim() === "";
  }

  function pctText(value) {
    return String(value).replace(".", ",");
  }

  function monthLabel(period) {
    return `${MONTHS[Number(period.slice(5, 7)) - 1]} de ${period.slice(0, 4)}`;
  }

  function entryId(entry) {
    return [entry.holder.toLowerCase(), entry.period, entry.payer.toLowerCase(), entry.kind].join("|");
  }

  /**
   * Valida y completa una nómina. `today` (AAAA-MM-DD) fija el límite de «no es futura»; sin él no se comprueba (al normalizar lo guardado).
   * @param {Record<string, any>} input
   * @param {string} [today]
   */
  function validateEntry(input, today) {
    const errors = [];
    const warnings = [];
    const raw = input && typeof input === "object" ? input : {};
    const holder = String(raw.holder ?? "").trim().slice(0, 40);
    const payer = String(raw.payer ?? "").trim().slice(0, 40);
    const kind = blank(raw.kind) ? "ordinaria" : String(raw.kind);
    const period = String(raw.period ?? "").trim();
    if (!holder) errors.push("Falta el titular de la nómina.");
    if (!KINDS.includes(kind)) errors.push("El tipo de nómina tiene que ser ordinaria o paga extra.");
    if (!isPeriod(period)) errors.push("El periodo tiene que ser un mes válido (AAAA-MM).");
    else if (today && period > today.slice(0, 7)) errors.push("El periodo no puede ser futuro: una nómina de un mes que aún no ha empezado no existe.");

    const gross = parseAmount(raw.gross);
    if (gross === null || !(gross > 0) || gross > MAX_GROSS) errors.push("Escribe el bruto (total devengado) de la nómina, por ejemplo 2.100,00.");
    const net = parseAmount(raw.net);
    if (net === null || !(net > 0)) errors.push("Escribe el líquido a percibir de la nómina, por ejemplo 1.644,93.");
    else if (gross !== null && gross > 0 && net > gross) errors.push("El líquido no puede ser mayor que el bruto: revisa los dos importes.");

    let pct = blank(raw.withholdingPct) ? null : parseAmount(raw.withholdingPct);
    let amount = blank(raw.withholdingAmount) ? null : parseAmount(raw.withholdingAmount);
    if (!blank(raw.withholdingPct) && pct === null) errors.push("La retención (%) no es un número válido, por ejemplo 15,32.");
    if (!blank(raw.withholdingAmount) && amount === null) errors.push("El importe de la retención no es un número válido, por ejemplo 321,72.");
    if (pct !== null && (pct < 0 || pct > MAX_PCT)) errors.push(`La retención (${pctText(pct)} %) queda fuera de lo razonable (de 0 a ${MAX_PCT} %). Revisa la coma.`);
    if (amount !== null && (amount < 0 || (gross !== null && gross > 0 && amount > gross))) errors.push("El importe de la retención no puede ser negativo ni mayor que el bruto.");
    if (!errors.length && pct === null && amount === null) errors.push("Falta la retención de IRPF (el % o el importe): sin ella la nómina no sirve para acumular retenciones.");

    let socialSecurity = null;
    if (!blank(raw.socialSecurity)) {
      socialSecurity = parseAmount(raw.socialSecurity);
      if (socialSecurity === null || socialSecurity < 0 || (gross !== null && socialSecurity > gross)) {
        errors.push("La cotización del trabajador no es un importe válido.");
        socialSecurity = null;
      }
    }

    if (errors.length) return { ok: false, entry: null, errors, warnings };

    let derived = false;
    if (pct === null) { pct = round2((amount / gross) * 100); derived = true; }
    if (amount === null) { amount = round2((gross * pct) / 100); derived = true; }
    if (!derived && Math.abs(amount - (gross * pct) / 100) > AMOUNT_TOLERANCE) {
      warnings.push(`La retención en euros (${amount.toFixed(2).replace(".", ",")} €) no coincide con el ${pctText(round2(pct))} % del bruto (${((gross * pct) / 100).toFixed(2).replace(".", ",")} €). Puede ser normal si hay conceptos exentos o en especie; si no, revisa los importes.`);
    }
    const entry = {
      id: "",
      holder,
      period,
      payer,
      kind,
      gross: round2(gross),
      net: round2(net),
      withholdingPct: round2(pct),
      withholdingAmount: round2(amount),
      socialSecurity: socialSecurity === null ? null : round2(socialSecurity),
      derived,
      enteredAt: isIsoDate(raw.enteredAt) ? raw.enteredAt : today || "",
      source: raw.source === "texto" ? "texto" : "manual",
    };
    entry.id = entryId(entry);
    return { ok: true, entry, errors, warnings };
  }

  function isIsoDate(value) {
    return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(new Date(`${value}T00:00:00Z`).getTime());
  }

  function sortEntries(entries) {
    return entries.slice().sort((a, b) => a.period.localeCompare(b.period) || a.holder.localeCompare(b.holder) || a.payer.localeCompare(b.payer) || a.kind.localeCompare(b.kind));
  }

  function normalizeStore(raw) {
    const list = Array.isArray(raw?.entries) ? raw.entries : [];
    const byId = new Map();
    for (const item of list) {
      if (!item || typeof item !== "object") continue;
      const result = validateEntry(item, "");
      if (!result.ok) continue;
      if (typeof item.derived === "boolean") result.entry.derived = item.derived;
      byId.set(result.entry.id, result.entry);
    }
    return { schemaId: SCHEMA_ID, entries: sortEntries(Array.from(byId.values())) };
  }

  function addEntry(store, input, today) {
    const current = normalizeStore(store);
    const result = validateEntry(input, today);
    if (!result.ok) return { ok: false, replaced: false, errors: result.errors, warnings: result.warnings, store: current };
    const replaced = current.entries.some((entry) => entry.id === result.entry.id);
    const entries = current.entries.filter((entry) => entry.id !== result.entry.id);
    entries.push(result.entry);
    return { ok: true, replaced, errors: [], warnings: result.warnings, store: { schemaId: SCHEMA_ID, entries: sortEntries(entries) } };
  }

  function removeEntry(store, id) {
    const current = normalizeStore(store);
    return { schemaId: SCHEMA_ID, entries: current.entries.filter((entry) => entry.id !== id) };
  }

  function yearsWithData(store) {
    return Array.from(new Set(normalizeStore(store).entries.map((entry) => Number(entry.period.slice(0, 4))))).sort((a, b) => b - a);
  }

  function monthsBetween(year, fromMonth, toMonth) {
    const months = [];
    for (let month = fromMonth; month <= toMonth; month += 1) months.push(`${year}-${String(month).padStart(2, "0")}`);
    return months;
  }

  /**
   * Resumen del año por titular: cifras acumuladas, % efectivo, última nómina ordinaria y los meses sin nómina.
   * @param {{entries?: Array<Record<string, any>>}} store
   * @param {{year?: number, today?: string}} [options]
   */
  function summarize(store, { year = 0, today = "" } = {}) {
    const entries = normalizeStore(store).entries.filter((entry) => Number(entry.period.slice(0, 4)) === year);
    const todayYear = Number(today.slice(0, 4));
    const holders = Array.from(new Set(entries.map((entry) => entry.holder))).sort((a, b) => a.localeCompare(b));
    return {
      year,
      holders: holders.map((holder) => {
        const own = entries.filter((entry) => entry.holder === holder);
        const ordinary = own.filter((entry) => entry.kind === "ordinaria");
        const covered = new Set(ordinary.map((entry) => entry.period));
        const lastPeriod = (ordinary.length ? ordinary : own).reduce((latest, entry) => (entry.period > latest ? entry.period : latest), "0000-00");
        const lastMonth = Number(lastPeriod.slice(5, 7));
        const endMonth = year < todayYear ? 12 : lastMonth;
        const missingMonths = monthsBetween(year, 1, endMonth).filter((period) => !covered.has(period));
        const gross = round2(own.reduce((sum, entry) => sum + entry.gross, 0));
        const withheld = round2(own.reduce((sum, entry) => sum + entry.withholdingAmount, 0));
        const latestOrdinary = ordinary.length ? ordinary.reduce((latest, entry) => (entry.period >= latest.period ? entry : latest)) : null;
        return {
          holder,
          year,
          entries: own.length,
          gross,
          net: round2(own.reduce((sum, entry) => sum + entry.net, 0)),
          withheld,
          effectivePct: gross > 0 ? round2((withheld / gross) * 100) : null,
          latestOrdinary: latestOrdinary ? { period: latestOrdinary.period, payer: latestOrdinary.payer, withholdingPct: latestOrdinary.withholdingPct } : null,
          missingMonths,
          complete: missingMonths.length === 0 && ordinary.length > 0,
          derivedCount: own.filter((entry) => entry.derived).length,
        };
      }),
    };
  }

  /**
   * Cambio del % de retención entre las dos últimas nóminas ordinarias de cada titular y pagador. Una paga extra tributa a otro tipo y otro
   * pagador es otra serie: ninguna de las dos se compara.
   */
  function changeAlerts(store) {
    const series = new Map();
    normalizeStore(store).entries.filter((entry) => entry.kind === "ordinaria").forEach((entry) => {
      const key = `${entry.holder.toLowerCase()}|${entry.payer.toLowerCase()}`;
      if (!series.has(key)) series.set(key, []);
      series.get(key).push(entry);
    });
    const alerts = [];
    series.forEach((list) => {
      if (list.length < 2) return;
      const previous = list[list.length - 2];
      const latest = list[list.length - 1];
      const delta = round2(latest.withholdingPct - previous.withholdingPct);
      if (Math.abs(delta) < CHANGE_THRESHOLD_POINTS) return;
      alerts.push({
        holder: latest.holder,
        payer: latest.payer,
        direction: delta < 0 ? "baja" : "sube",
        deltaPoints: delta,
        from: { period: previous.period, pct: previous.withholdingPct },
        to: { period: latest.period, pct: latest.withholdingPct },
      });
    });
    return alerts.sort((a, b) => a.holder.localeCompare(b.holder));
  }

  function alertText(alert) {
    const payer = alert.payer ? ` (${alert.payer})` : "";
    return `La retención ${alert.direction === "baja" ? "bajó" : "subió"} del ${pctText(alert.from.pct)} % al ${pctText(alert.to.pct)} % en la nómina de ${monthLabel(alert.to.period)}${payer}.`;
  }

  // ---- lectura del texto de una nómina ----

  const MONEY_SOURCE = "-?\\d{1,3}(?:\\.\\d{3})+(?:,\\d{1,2})?|-?\\d+,\\d{1,2}|-?\\d+\\.\\d{2}(?!\\d)";
  const GROSS_LABELS = [/total\s+devengado/i, /total\s+devengos/i, /total\s+percepciones/i, /salario\s+bruto/i, /total\s+bruto/i];
  const NET_LABELS = [/l[ií]quido\s+(?:total\s+)?a\s+(?:percibir|recibir)/i, /l[ií]quido\s+total/i, /neto\s+a\s+percibir/i];
  const SS_LABELS = [/total\s+aportaciones(?!\s+(?:de\s+la\s+)?empres)/i, /total\s+cotizaci[oó]n(?:es)?\s+(?:del\s+trabajador|a\s+la\s+seguridad\s+social)/i, /total\s+seguridad\s+social/i];
  const IRPF_LINE = /irpf|i\.r\.p\.f/i;
  const IRPF_EXCLUDED = /base|acumulad|anual|regulariz/i;

  function moneyIn(text) {
    const found = [];
    const pattern = new RegExp(MONEY_SOURCE, "g");
    let match = pattern.exec(text);
    while (match) {
      const after = text.slice(match.index + match[0].length).trimStart();
      if (!after.startsWith("%")) found.push(parseAmount(match[0]));
      match = pattern.exec(text);
    }
    return found.filter((value) => value !== null);
  }

  function percentIn(text) {
    const match = /(\d{1,2}(?:[.,]\d{1,3})?)\s*%/.exec(text);
    return match ? parseAmount(match[1]) : null;
  }

  function onlyNumbers(line) {
    return Boolean(line) && /\d/.test(line) && /^[\s€\d.,%-]+$/.test(line);
  }

  function amountForLabels(lines, labels) {
    for (const label of labels) {
      for (let index = 0; index < lines.length; index += 1) {
        const match = label.exec(lines[index]);
        if (!match) continue;
        const sameLine = moneyIn(lines[index].slice(match.index + match[0].length));
        if (sameLine.length) return sameLine[0];
        if (onlyNumbers(lines[index + 1])) {
          const nextLine = moneyIn(lines[index + 1]);
          if (nextLine.length) return nextLine[0];
        }
      }
    }
    return null;
  }

  function irpfFields(lines) {
    let pct = null;
    let amount = null;
    lines.forEach((line, index) => {
      if (!IRPF_LINE.test(line) || IRPF_EXCLUDED.test(line)) return;
      let scope = line;
      if (!/\d/.test(line) && onlyNumbers(lines[index + 1])) scope = `${line} ${lines[index + 1]}`;
      if (pct === null) pct = percentIn(scope);
      if (amount === null) {
        const money = moneyIn(scope);
        if (money.length) amount = money[money.length - 1];
      }
    });
    return { pct, amount };
  }

  function periodFrom(text) {
    const range = /per[ií]odo[^\n]*?(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})[^\n]*?(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})/i.exec(text);
    if (range) {
      const year = Number(range[6]) < 100 ? 2000 + Number(range[6]) : Number(range[6]);
      const candidate = `${year}-${String(range[5]).padStart(2, "0")}`;
      if (isPeriod(candidate)) return candidate;
    }
    const named = new RegExp(`\\b(${Object.keys(MONTH_LOOKUP).join("|")})\\s+(?:de\\s+)?(\\d{4})\\b`, "i").exec(text);
    if (named) {
      const candidate = `${named[2]}-${String(MONTH_LOOKUP[named[1].toLowerCase()]).padStart(2, "0")}`;
      if (isPeriod(candidate)) return candidate;
    }
    const monthLine = /\bmes\b[^\n\d]{0,20}(\d{1,2})\s*[/-]\s*(\d{4})/i.exec(text);
    if (monthLine) {
      const candidate = `${monthLine[2]}-${String(monthLine[1]).padStart(2, "0")}`;
      if (isPeriod(candidate)) return candidate;
    }
    const lone = /(?<![\d/])(0?[1-9]|1[0-2])\s*\/\s*(20\d{2})(?!\d)/.exec(text);
    if (lone) {
      const candidate = `${lone[2]}-${String(lone[1]).padStart(2, "0")}`;
      if (isPeriod(candidate)) return candidate;
    }
    return null;
  }

  /**
   * Lee periodo e importes del texto de una nómina. Solo devuelve cifras: lo que no encuentra (o no cuadra) queda en null y se lista en
   * `missing`; el hogar revisa y confirma antes de guardar nada. No conserva el texto.
   * @param {string} text
   */
  function extractFromText(text) {
    const source = typeof text === "string" ? text : "";
    const lines = source.replace(/ /g, " ").split(/\r?\n/).map((line) => line.replace(/\s+/g, " ").trim()).filter(Boolean);
    const warnings = [];
    const irpf = irpfFields(lines);
    const fields = {
      period: periodFrom(source),
      gross: amountForLabels(lines, GROSS_LABELS),
      net: amountForLabels(lines, NET_LABELS),
      withholdingPct: irpf.pct,
      withholdingAmount: irpf.amount,
      socialSecurity: amountForLabels(lines, SS_LABELS),
      kind: lines.filter((line) => !/prorrat/i.test(line)).some((line) => /paga\s+extra(?:ordinaria)?|pagas\s+extras?|extra\s+de\s+(?:verano|navidad|julio|diciembre)|gratificaci[oó]n\s+extraordinaria/i.test(line)) ? "extra" : "ordinaria",
    };
    if (fields.gross !== null && !(fields.gross > 0)) fields.gross = null;
    if (fields.net !== null && (!(fields.net > 0) || (fields.gross !== null && fields.net > fields.gross))) {
      warnings.push("El líquido leído es mayor que el bruto: se descarta, escríbelo a mano.");
      fields.net = null;
    }
    if (fields.withholdingPct !== null && (fields.withholdingPct < 0 || fields.withholdingPct > MAX_PCT)) {
      warnings.push("El % de retención leído no es razonable: se descarta, escríbelo a mano.");
      fields.withholdingPct = null;
    }
    if (fields.withholdingAmount !== null && fields.gross !== null && fields.withholdingAmount > fields.gross) {
      warnings.push("La retención leída es mayor que el bruto: se descarta, escríbela a mano.");
      fields.withholdingAmount = null;
    }
    const required = ["period", "gross", "net", "withholdingPct", "withholdingAmount", "socialSecurity"];
    return { fields, missing: required.filter((key) => fields[key] === null), warnings };
  }

  return {
    SCHEMA_ID, KINDS, CHANGE_THRESHOLD_POINTS,
    parseAmount, validateEntry, normalizeStore, addEntry, removeEntry, yearsWithData, summarize, changeAlerts, alertText, extractFromText, monthLabel,
  };
});
