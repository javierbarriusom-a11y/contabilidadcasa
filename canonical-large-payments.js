(function attachCanonicalLargePayments(root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.FinanceCanonicalLargePayments = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function canonicalLargePaymentsFactory() {
  "use strict";

  // WP-49 (NPV-04, docs/WP49_DISENO.md): el mapa anual de pagos grandes. Junta lo que la app ya sabe que va a costar «de golpe» en los próximos 12 meses y dice, de cada pago, cuánto hay reservado:
  //   · lumpyItems: las partidas del plan de gastos que, en un mes, pesan mucho más que en el resto (IBI, colegio, vacaciones, una derrama…). Las cuotas fijas de cada mes NO son un pago grande.
  //   · policyItems: los seguros del inventario, cada aniversario (si la renovación declarada ya pasó, se proyecta al año siguiente y se marca «estimado»).
  //   · goalItems: los objetivos con fecha (huchas); aquí SÍ hay financiación real: lo ahorrado frente a lo que cuesta.
  //   · taxItems: la campaña de la Renta del calendario financiero (E15): sin importe mientras nadie lo estime.
  //   · dedupe, funding, build, describe: unir sin contar dos veces, medir la financiación, agrupar por mes y escribir la frase.
  // Motor puro: ni DOM, ni red, ni almacenamiento, ni reloj (el «hoy» entra por parámetro). NUNCA mueve dinero ni reserva nada (A11-4): solo enseña.
  //
  // Reglas de honestidad:
  //   · un importe que no se conoce NO es cero: el pago se muestra, no suma y se cuenta aparte.
  //   · «financiado» solo si hay dinero reservado DECLARADO (un objetivo con lo ahorrado). Lo demás es «sin reserva asignada», no «0 % financiado»: la app no tiene fondos por pago, y no se inventan.
  //   · un pago que está a la vez en el plan y en el inventario de seguros o en un objetivo se cuenta UNA vez (el que trae más información).
  //   · lo proyectado desde un año anterior va marcado «estimado»; lo declarado para esta fecha, no.

  const SCHEMA_ID = "finance-large-payments/v1";
  const DEFAULT_MIN_AMOUNT = 300;
  const DEFAULT_LUMP_FACTOR = 2.5;
  const DEFAULT_MONTHS = 12;
  const MERGE_TOLERANCE = 0.02;
  const KIND_LABEL = Object.freeze({ plan: "Plan de gastos", policy: "Seguro", goal: "Objetivo", tax: "Hacienda" });
  const KIND_RANK = Object.freeze({ goal: 0, policy: 1, tax: 2, plan: 3 });

  const number = (value, fallback = 0) => (Number.isFinite(Number(value)) && value !== "" && value !== null && value !== undefined ? Number(value) : fallback);
  const known = (value) => value !== "" && value !== null && value !== undefined && Number.isFinite(Number(value));
  const round2 = (value) => Math.round((number(value) + Number.EPSILON) * 100) / 100;
  const text = (value) => String(value ?? "").trim();
  const plain = (value) => text(value).normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  const monthOf = (value) => (text(value).match(/^\d{4}-(0[1-9]|1[0-2])/) || [""])[0];
  const monthIndex = (key) => Number(key.slice(0, 4)) * 12 + Number(key.slice(5, 7)) - 1;

  function addMonthsKey(key, count) {
    const index = monthIndex(key) + count;
    return `${String(Math.floor(index / 12)).padStart(4, "0")}-${String((index % 12) + 1).padStart(2, "0")}`;
  }

  /** Las claves «AAAA-MM» de los `count` meses que empiezan en `startMonth`. */
  function monthsFrom(startMonth, count = DEFAULT_MONTHS) {
    const start = monthOf(startMonth);
    if (!start) return [];
    return Array.from({ length: Math.max(0, Math.floor(number(count, DEFAULT_MONTHS))) }, (_, i) => addMonthsKey(start, i));
  }

  /** Meses de `from` a `to` (negativo si `to` es anterior). */
  function monthsBetween(from, to) {
    const a = monthOf(from);
    const b = monthOf(to);
    return a && b ? monthIndex(b) - monthIndex(a) : 0;
  }

  /** ¿Es una fecha ISO «AAAA-MM-DD» que existe en el calendario (no 30 de febrero)? */
  function validDate(value) {
    const match = text(value).match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!match) return false;
    const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
    return date.getUTCFullYear() === Number(match[1]) && date.getUTCMonth() === Number(match[2]) - 1 && date.getUTCDate() === Number(match[3]);
  }

  function daysInMonth(key) {
    return new Date(Date.UTC(Number(key.slice(0, 4)), Number(key.slice(5, 7)), 0)).getUTCDate();
  }

  function median(values) {
    const sorted = [...values].sort((a, b) => a - b);
    if (!sorted.length) return 0;
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
  }

  /**
   * Las partidas del plan que en un mes pesan de golpe. Un importe cuenta si llega al mínimo Y es al menos `lumpFactor` veces la MEDIANA de la propia partida en la ventana (los meses sin
   * importe cuentan como cero): una cuota de 750 € todos los meses no es un pago grande; 900 € en tres meses y 0 en el resto, sí; una partida de un solo mes, también.
   * @param {{rows?: Array<{id?: string, label?: string, values?: Record<string, number>}>, months?: string[], minAmount?: number, lumpFactor?: number}} [params]
   */
  function lumpyItems({ rows = [], months = [], minAmount = DEFAULT_MIN_AMOUNT, lumpFactor = DEFAULT_LUMP_FACTOR } = {}) {
    const keys = months.map(monthOf).filter(Boolean);
    const items = [];
    (Array.isArray(rows) ? rows : []).forEach((row, rowIndex) => {
      const values = keys.map((key) => Math.max(0, number(row?.values?.[key])));
      const threshold = Math.max(number(minAmount, DEFAULT_MIN_AMOUNT), number(lumpFactor, DEFAULT_LUMP_FACTOR) * median(values));
      const id = text(row?.id) || `fila-${rowIndex}`;
      keys.forEach((key, i) => {
        if (values[i] > 0 && values[i] >= threshold) {
          items.push({ id: `plan:${id}:${key}`, kind: "plan", label: text(row?.label) || "Partida del plan", monthKey: key, day: null, amount: round2(values[i]), reserved: null, estimated: false, overdue: false, source: "plan de gastos" });
        }
      });
    });
    return items;
  }

  /**
   * Los seguros del inventario en cada aniversario de la ventana. Si la renovación declarada es de este mes o posterior y cae en la ventana, va tal cual; si ya pasó, se proyecta a cada año («estimado»).
   * Una renovación declarada para más allá de la ventana no se proyecta hacia atrás. Sin fecha válida no se puede colocar: va en `ignored`.
   * @param {{policies?: Array<{id?: string, name?: string, renewalDate?: string, premium?: number|string|null}>, startMonth?: string, months?: number, today?: string}} [params]
   */
  function policyItems({ policies = [], startMonth = "", months = DEFAULT_MONTHS, today = "" } = {}) {
    const keys = monthsFrom(startMonth, months);
    const items = [];
    const ignored = [];
    (Array.isArray(policies) ? policies : []).forEach((policy, index) => {
      const label = text(policy?.name) || "Póliza";
      const date = text(policy?.renewalDate);
      if (!validDate(date)) { ignored.push({ id: text(policy?.id) || `poliza-${index}`, label, reason: "sin fecha de renovación válida" }); return; }
      const premium = known(policy?.premium) && number(policy.premium) > 0 ? round2(policy.premium) : null;
      keys.forEach((key) => {
        if (key.slice(5, 7) !== date.slice(5, 7) || key < date.slice(0, 7)) return;
        const day = Math.min(Number(date.slice(8, 10)), daysInMonth(key));
        const occurrence = `${key}-${String(day).padStart(2, "0")}`;
        if (validDate(today) && occurrence < today) return;
        items.push({ id: `policy:${text(policy?.id) || index}:${key}`, kind: "policy", label, monthKey: key, day, amount: premium, reserved: null, estimated: occurrence !== date, overdue: false, source: "inventario de seguros" });
      });
    });
    return { items, ignored };
  }

  /**
   * Los objetivos activos con fecha: el coste es el importe objetivo y lo reservado, lo ahorrado hasta hoy (declarado por el hogar). Un objetivo con la fecha ya pasada y sin completar se coloca
   * en el primer mes y se marca `overdue`. Sin fecha o sin importe objetivo no se puede colocar: va en `ignored`.
   * @param {{goals?: Array<{id?: string, name?: string, target?: number, saved?: number, targetDate?: string, status?: string}>, startMonth?: string, months?: number}} [params]
   */
  function goalItems({ goals = [], startMonth = "", months = DEFAULT_MONTHS } = {}) {
    const keys = monthsFrom(startMonth, months);
    const items = [];
    const ignored = [];
    (Array.isArray(goals) ? goals : []).forEach((goal, index) => {
      if (text(goal?.status || "active") !== "active") return;
      const label = text(goal?.name) || "Objetivo";
      const id = text(goal?.id) || `objetivo-${index}`;
      const key = monthOf(goal?.targetDate);
      const target = number(goal?.target);
      if (!key) { ignored.push({ id, label, reason: "sin fecha" }); return; }
      if (!(target > 0)) { ignored.push({ id, label, reason: "sin importe objetivo" }); return; }
      const saved = Math.max(0, number(goal?.saved));
      const overdue = key < keys[0];
      if (overdue && saved >= target) return;
      if (!overdue && !keys.includes(key)) return;
      const full = text(goal?.targetDate);
      items.push({ id: `goal:${id}`, kind: "goal", label, monthKey: overdue ? keys[0] : key, day: !overdue && validDate(full) ? Number(full.slice(8, 10)) : null, amount: round2(target), reserved: round2(Math.min(saved, target)), estimated: false, overdue, source: "objetivos" });
    });
    return { items, ignored };
  }

  /**
   * La campaña de la Renta del calendario financiero (E15). Su importe no se estima en ningún sitio todavía (puede ser un pago o una devolución): sale con `amount: null`.
   * @param {{calendar?: {rows?: Array<{monthKey?: string, events?: Array<{type?: string, label?: string, amount?: number|null}>}>}|null, startMonth?: string, months?: number}} [params]
   */
  function taxItems({ calendar = null, startMonth = "", months = DEFAULT_MONTHS } = {}) {
    const keys = monthsFrom(startMonth, months);
    const items = [];
    (Array.isArray(calendar?.rows) ? calendar.rows : []).forEach((row) => {
      const key = monthOf(row?.monthKey);
      if (!key || !keys.includes(key)) return;
      (Array.isArray(row?.events) ? row.events : []).filter((event) => event?.type === "renta").forEach(() => {
        items.push({ id: `tax:renta:${key}`, kind: "tax", label: "Campaña de la Renta (pago o devolución)", monthKey: key, day: null, amount: null, reserved: null, estimated: true, overdue: false, source: "calendario financiero" });
      });
    });
    return items;
  }

  function sameThing(a, b) {
    const la = plain(a.label);
    const lb = plain(b.label);
    const labelMatch = la.length >= 4 && lb.length >= 4 && (la.includes(lb) || lb.includes(la));
    const amountMatch = known(a.amount) && known(b.amount) && Math.abs(a.amount - b.amount) <= MERGE_TOLERANCE * Math.max(a.amount, b.amount);
    return labelMatch || amountMatch;
  }

  /**
   * Quita de la lista las partidas del plan que son el mismo pago que un seguro o un objetivo del mismo mes (mismo nombre, o importe a menos de un 2 %): se queda el que trae más información
   * (el seguro o el objetivo) y anota `alsoInPlan`. Devuelve también lo fusionado, para decirlo.
   * @param {Array<any>} items
   */
  function dedupe(items) {
    const list = Array.isArray(items) ? items : [];
    const rich = list.filter((item) => item.kind !== "plan");
    const merged = [];
    const kept = [];
    const annotated = new Map();
    list.forEach((item) => {
      if (item.kind !== "plan") { kept.push(item); return; }
      const twin = rich.find((other) => other.kind !== "tax" && other.monthKey === item.monthKey && sameThing(item, other));
      if (twin) { merged.push({ plan: item.label, with: twin.label, monthKey: item.monthKey }); annotated.set(twin.id, item.label); } else kept.push(item);
    });
    return { items: kept.map((item) => (annotated.has(item.id) ? { ...item, alsoInPlan: annotated.get(item.id) } : item)), merged };
  }

  /**
   * La financiación de un pago: «sin-importe» (no se sabe cuánto cuesta), «sin-reserva» (nadie ha declarado dinero para él), «parcial» o «financiado». `monthsLeft` cuenta desde el primer mes de
   * la ventana; si vence este mes no se puede repartir en el tiempo (`dueNow`) y no hay ahorro mensual que proponer.
   * @param {{amount?: number|null, reserved?: number|null, monthKey?: string}} item
   * @param {string} startMonth
   */
  function funding(item, startMonth) {
    const monthsLeft = Math.max(0, monthsBetween(startMonth, item?.monthKey));
    if (!known(item?.amount)) return { status: "sin-importe", pct: null, missing: null, monthsLeft, dueNow: monthsLeft === 0, monthlyNeeded: null };
    const amount = round2(item.amount);
    const dueNow = monthsLeft === 0;
    if (!known(item?.reserved)) {
      return { status: "sin-reserva", pct: null, missing: amount, monthsLeft, dueNow, monthlyNeeded: dueNow ? null : round2(amount / monthsLeft) };
    }
    const reserved = Math.min(Math.max(0, round2(item.reserved)), amount);
    const missing = round2(amount - reserved);
    const pct = amount > 0 ? Math.floor((reserved / amount) * 100) : 100;
    return {
      status: missing <= 0.005 ? "financiado" : "parcial", pct: missing <= 0.005 ? 100 : pct, missing: Math.max(0, missing), monthsLeft, dueNow,
      monthlyNeeded: missing <= 0.005 || dueNow ? (missing <= 0.005 ? 0 : null) : round2(missing / monthsLeft),
    };
  }

  /**
   * El mapa: los pagos de la ventana agrupados por mes, cada uno con su financiación, y un resumen. Un importe conocido por debajo de `minAmount` no es «grande» y se cuenta aparte; uno sin importe
   * se muestra siempre (no se puede juzgar) y no suma.
   * @param {{items?: Array<any>, startMonth?: string, months?: number, minAmount?: number, ignored?: Array<any>, merged?: Array<any>}} [params]
   */
  function build({ items = [], startMonth = "", months = DEFAULT_MONTHS, minAmount = DEFAULT_MIN_AMOUNT, ignored = [], merged = [] } = {}) {
    const keys = monthsFrom(startMonth, months);
    const min = number(minAmount, DEFAULT_MIN_AMOUNT);
    let belowThreshold = 0;
    const placed = [];
    (Array.isArray(items) ? items : []).forEach((item) => {
      if (!keys.includes(item?.monthKey)) return;
      if (known(item.amount) && item.amount < min) { belowThreshold += 1; return; }
      placed.push({ ...item, funding: funding(item, keys[0]) });
    });
    const order = (a, b) => (a.day ?? 99) - (b.day ?? 99) || (known(b.amount) ? b.amount : -1) - (known(a.amount) ? a.amount : -1) || KIND_RANK[a.kind] - KIND_RANK[b.kind] || a.label.localeCompare(b.label, "es");
    const monthRows = keys.map((monthKey) => {
      const list = placed.filter((item) => item.monthKey === monthKey).sort(order);
      return {
        monthKey, items: list, total: round2(list.reduce((sum, item) => sum + (known(item.amount) ? item.amount : 0), 0)),
        unknownCount: list.filter((item) => !known(item.amount)).length,
      };
    });
    const withAmount = placed.filter((item) => known(item.amount));
    const total = round2(withAmount.reduce((sum, item) => sum + item.amount, 0));
    const fundedTotal = round2(withAmount.reduce((sum, item) => sum + (known(item.reserved) ? Math.min(item.reserved, item.amount) : 0), 0));
    const heaviest = [...monthRows].filter((row) => row.total > 0).sort((a, b) => b.total - a.total || a.monthKey.localeCompare(b.monthKey));
    const spread = placed.filter((item) => item.funding.monthlyNeeded !== null && item.funding.monthlyNeeded > 0);
    const dueNow = placed.filter((item) => item.funding.dueNow && item.funding.missing !== null && item.funding.missing > 0);
    return {
      schemaId: SCHEMA_ID, startMonth: keys[0] || "", minAmount: min, months: monthRows, ignored: Array.isArray(ignored) ? ignored : [], merged: Array.isArray(merged) ? merged : [],
      summary: {
        count: placed.length, countWithAmount: withAmount.length, unknownCount: placed.length - withAmount.length, belowThreshold,
        total, fundedTotal, missingTotal: round2(total - fundedTotal), fundedPct: total > 0 ? Math.floor((fundedTotal / total) * 100) : null,
        peak: heaviest[0] ? { monthKey: heaviest[0].monthKey, total: heaviest[0].total } : null,
        top3Share: total > 0 ? Math.round((heaviest.slice(0, 3).reduce((sum, row) => sum + row.total, 0) / total) * 100) : null,
        reserveMonthly: round2(spread.reduce((sum, item) => sum + item.funding.monthlyNeeded, 0)), reserveCount: spread.length,
        dueNowTotal: round2(dueNow.reduce((sum, item) => sum + item.funding.missing, 0)), dueNowCount: dueNow.length,
      },
    };
  }

  /**
   * La frase del mapa, en una o dos oraciones, con lo que SE sabe y lo que no.
   * @param {ReturnType<typeof build>} map
   * @param {{labelOf?: (monthKey: string) => string, euros?: (value: number) => string}} [options]
   */
  function describe(map, { labelOf = (key) => key, euros = (value) => `${value} €` } = {}) {
    const s = map?.summary;
    if (!s || !s.count) return "No hay pagos grandes en los próximos 12 meses con lo que la app sabe.";
    const unknown = s.unknownCount ? ` (y ${s.unknownCount} más sin importe, fuera de la suma)` : "";
    const head = s.countWithAmount
      ? `En los próximos 12 meses hay ${s.countWithAmount} pago${s.countWithAmount === 1 ? "" : "s"} grande${s.countWithAmount === 1 ? "" : "s"} que ${s.countWithAmount === 1 ? "suma" : "suman"} ${euros(s.total)}${unknown}.`
      : `Hay ${s.count} pago${s.count === 1 ? "" : "s"} grande${s.count === 1 ? "" : "s"} en los próximos 12 meses, ninguno con importe conocido.`;
    const peak = s.peak ? ` El más cargado es ${labelOf(s.peak.monthKey)} (${euros(s.peak.total)})${s.top3Share !== null && s.top3Share < 100 ? `; los tres más cargados concentran el ${s.top3Share} %` : ""}.` : "";
    const funded = s.total > 0 ? (s.fundedTotal > 0 ? ` Hay ${euros(s.fundedTotal)} reservado${s.fundedPct !== null ? ` (${s.fundedPct} %)` : ""}.` : " No hay nada reservado de forma declarada para ninguno.") : "";
    return `${head}${peak}${funded}`;
  }

  /**
   * Todo junto: las fuentes ya leídas → el mapa. `rows` son las partidas del plan; `policies`, `goals` y `calendar` tal como los guarda la app.
   * @param {{rows?: any[], policies?: any[], goals?: any[], calendar?: any, startMonth?: string, months?: number, minAmount?: number, lumpFactor?: number, today?: string}} [params]
   */
  function assemble({ rows = [], policies = [], goals = [], calendar = null, startMonth = "", months = DEFAULT_MONTHS, minAmount = DEFAULT_MIN_AMOUNT, lumpFactor = DEFAULT_LUMP_FACTOR, today = "" } = {}) {
    const keys = monthsFrom(startMonth, months);
    const fromPolicies = policyItems({ policies, startMonth, months, today });
    const fromGoals = goalItems({ goals, startMonth, months });
    const all = [...lumpyItems({ rows, months: keys, minAmount, lumpFactor }), ...fromPolicies.items, ...fromGoals.items, ...taxItems({ calendar, startMonth, months })];
    const merged = dedupe(all);
    return build({ items: merged.items, startMonth, months, minAmount, ignored: [...fromPolicies.ignored, ...fromGoals.ignored], merged: merged.merged });
  }

  return {
    SCHEMA_ID, DEFAULT_MIN_AMOUNT, DEFAULT_LUMP_FACTOR, DEFAULT_MONTHS, KIND_LABEL,
    monthsFrom, monthsBetween, validDate, lumpyItems, policyItems, goalItems, taxItems, dedupe, funding, build, describe, assemble,
  };
});
