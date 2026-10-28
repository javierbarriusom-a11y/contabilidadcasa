(function attachCanonicalNextBestAction(root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.FinanceCanonicalNextBestAction = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function canonicalNextBestActionFactory() {
  "use strict";

  // WP-17 (NIN-01, docs/WP17_DISENO.md): la «siguiente mejor acción» de la cartera. Motor puro: ni DOM, ni red, ni almacenamiento.
  // Recibe HECHOS ya calculados por los motores de siempre (frescura de WP-15, política de WP-39, reparto de IV6, compensación de FC3,
  // candidatas de INV6, convicción de I12) y devuelve las acciones ordenadas por reglas fijas, cada una con su motivo y la regla que la
  // origina. Una sola es la primera; el resto se enseña plegado.
  //
  // Orden (de arriba abajo, el primero que aplica manda):
  //   1. valorar      — posiciones sin valorar en más de 35 días: el resto de reglas miraría cifras viejas.
  //   2. incumple     — la cartera choca con una regla de la política firmada que no es de reparto (cripto, apalancamiento).
  //   3. deriva       — un tipo fuera de la banda: de la política firmada o, sin ella, del reparto de Rebalanceo (umbral 10).
  //   4. fiscal       — del 1/10 al 31/12, con plusvalías del año sin compensar y una posición en pérdidas.
  //   5. politica     — sin política firmada, cambiada tras firmar, o con la revisión vencida o a menos de 30 días.
  //   6. conviccion   — posiciones con convicción declarada sin confirmar en 12 meses.
  //
  // Reglas de honestidad: NUNCA opera ni escribe en la cartera (A11-4); una acción de venta dice su coste fiscal y la norma de
  // recompra; sin posiciones no hay acción que inventar; «nada pendiente» dice qué se ha mirado, no que todo esté bien.

  const TYPES = Object.freeze({ fondo: "Fondo", accion: "Acción", etf: "ETF", cripto: "Cripto", "plan-pension": "Plan de pensiones", otro: "Otro" });
  const ORDER = Object.freeze(["valorar", "incumple", "deriva", "fiscal", "politica", "conviccion"]);
  const FISCAL_FROM_MONTH = 10; // octubre: queda tiempo para vender, y la norma de recompra de dos meses aún deja recomprar antes de marzo

  const number = (value, fallback = 0) => (Number.isFinite(Number(value)) && value !== "" && value !== null && value !== undefined ? Number(value) : fallback);
  const isIso = (value) => /^\d{4}-\d{2}-\d{2}$/.test(String(value || ""));
  // Miles con punto también en cuatro cifras («1.234 €», como el resto de la app): Intl en es-ES no agrupa por debajo de 10.000.
  const euros = (value) => `${String(Math.round(Math.abs(number(value)))).replace(/\B(?=(\d{3})+(?!\d))/g, ".")} €`;
  const points = (value) => (Math.round(Math.abs(number(value)) * 10) / 10).toLocaleString("es-ES", { maximumFractionDigits: 1 });
  const typeLabel = (type) => TYPES[type] || "Otro";
  // En medio de una frase, en plural y sin mayúscula salvo las siglas («a fondos», «de acciones», «a ETF»).
  const IN_SENTENCE = Object.freeze({ fondo: "fondos", accion: "acciones", etf: "ETF", cripto: "cripto", "plan-pension": "planes de pensiones", otro: "otros" });
  const typeInSentence = (type) => IN_SENTENCE[type] || "otros";
  const MONTHS = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
  const shortDate = (iso) => (isIso(iso) ? `${Number(iso.slice(8, 10))} ${MONTHS[Number(iso.slice(5, 7)) - 1]} ${iso.slice(0, 4)}` : "");
  const list = (items) => (items.length <= 1 ? items.join("") : `${items.slice(0, -1).join(", ")} y ${items[items.length - 1]}`);

  function accionValorar(stale, staleDays) {
    if (!stale.length) return null;
    const names = stale.slice(0, 3);
    const more = stale.length > 3 ? ` y ${stale.length - 3} más` : "";
    return {
      id: "valorar",
      title: stale.length === 1 ? `Actualizad la valoración de ${names[0]}` : `Actualizad la valoración de ${stale.length} posiciones`,
      reason: `${stale.length === 1 ? "Lleva" : `${list(names)}${more} llevan`} más de ${staleDays} días sin valor: el resto de este tablero las miraría con cifras viejas.`,
      rule: "",
      cta: { kind: "valorar", label: "Actualizar valoración" },
    };
  }

  function accionIncumple(policy) {
    const breach = (policy?.state === "signed" ? policy.breaches || [] : [])[0];
    if (!breach) return null;
    return {
      id: "incumple",
      title: breach.ruleId === "no-crypto" ? "La cartera tiene cripto y vuestra política dice que no se compra" : "La cartera choca con vuestra política: hay un préstamo con la cartera como garantía",
      reason: `${breach.text} Decidid si la política o la cartera; la app no vende nada.`,
      rule: breach.n ? `Regla ${breach.n} de vuestra política` : "Vuestra política",
      cta: { kind: "enlace", label: "Ver la política", href: "#inversion-rebalanceo" },
    };
  }

  function accionDeriva(drift) {
    const rows = (drift?.rows || []).filter((row) => Math.abs(number(row.deviation)) > number(drift.bandPct));
    if (!rows.length) return null;
    const row = [...rows].sort((a, b) => Math.abs(b.deviation) - Math.abs(a.deviation))[0];
    const label = typeLabel(row.type);
    const under = number(row.deviation) < 0;
    const fromPolicy = drift.source === "politica";
    const rule = fromPolicy ? (drift.n ? `Regla ${drift.n} de vuestra política` : "Vuestra política") : "Reparto objetivo de Rebalanceo (sin política firmada)";
    const band = `la banda es de ${points(drift.bandPct)} puntos`;
    const gap = `${label}: ${points(row.currentPct)} % frente a un objetivo del ${points(row.targetPct)} %, ${points(row.deviation)} puntos ${under ? "por debajo" : "por encima"}`;
    const underweight = rows.filter((item) => number(item.deviation) < 0).sort((a, b) => a.deviation - b.deviation)[0];
    let title;
    let reason;
    if (fromPolicy && drift.byContributions) {
      if (under) {
        title = `Llevad las próximas aportaciones a ${typeInSentence(row.type)}`;
        reason = `${gap}; ${band}. Faltan unos ${euros(row.amount)} para volver al objetivo. Vuestra política dice rebalancear primero con las aportaciones, sin vender.`;
      } else {
        title = `No aportéis más a ${typeInSentence(row.type)} hasta que vuelvan a la banda`;
        reason = `${gap}; ${band}. Vuestra política dice rebalancear primero con las aportaciones, sin vender${underweight ? `: llevadlas a ${typeInSentence(underweight.type)}, que están por debajo` : ""}.`;
      }
    } else if (under) {
      title = `Comprad unos ${euros(row.amount)} de ${typeInSentence(row.type)}`;
      reason = `${gap}; ${band}. Con una aportación también vale.`;
    } else {
      title = `Vended unos ${euros(row.amount)} de ${typeInSentence(row.type)}`;
      reason = `${gap}; ${band}. Antes de vender, mirad su coste fiscal en Inversión › Fiscal; si podéis, corregidlo con aportaciones a lo que falta.`;
    }
    return { id: "deriva", title, reason, rule, cta: { kind: "enlace", label: "Ir a Rebalanceo", href: "#inversion-rebalanceo" } };
  }

  function accionFiscal(fiscal, today) {
    if (!fiscal || !isIso(today)) return null;
    if (Number(today.slice(5, 7)) < FISCAL_FROM_MONTH || String(fiscal.year) !== today.slice(0, 4)) return null;
    const base = number(fiscal.marginalSaleBase);
    const candidate = [...(fiscal.candidates || [])].filter((item) => number(item.gainLoss) < 0).sort((a, b) => a.gainLoss - b.gainLoss)[0];
    if (!(base > 0) || !candidate) return null;
    const offset = Math.min(base, Math.abs(number(candidate.gainLoss)));
    return {
      id: "fiscal",
      title: `Antes del 31/12: ${candidate.label} podría compensar ${euros(offset)} de plusvalías`,
      reason: `Este año lleváis ${euros(base)} de plusvalías sin compensar y ${candidate.label} tiene una pérdida latente de ${euros(candidate.gainLoss)}. Si la vendéis antes del 31/12, esa pérdida resta de las plusvalías. Para que cuente, no la recompréis dentro de la ventana de recompra (dos meses en acciones y ETF de la UE; un año en fondos que no cotizan y valores de fuera de la UE). Es lo que pasa fiscalmente si vendéis, no una recomendación de vender.`,
      rule: "Compensación de fin de año (art. 49 de la Ley del IRPF)",
      cta: { kind: "enlace", label: "Ir a Fiscal", href: "#inversion-fiscal" },
    };
  }

  function accionPolitica(policy) {
    const state = policy?.state || "none";
    const cta = { kind: "enlace", label: "Ir a la política", href: "#inversion-rebalanceo" };
    if (state === "none" || state === "unsigned") {
      return {
        id: "politica",
        title: state === "none" ? "Escribid y firmad vuestra política de inversión" : "Terminad y firmad vuestra política de inversión",
        reason: "Las reglas de este tablero salen de ella. Sin política firmada, solo se mira el reparto de Rebalanceo con el umbral de 10 puntos.",
        rule: "",
        cta,
      };
    }
    if (state === "changed") {
      return { id: "politica", title: "Volved a firmar la política: cambió después de firmarla", reason: "Mientras no la firméis de nuevo, el tablero no usa sus reglas.", rule: "", cta };
    }
    const review = policy.review || {};
    if (review.status === "overdue") return { id: "politica", title: "Revisad la política de inversión", reason: `Tocaba revisarla el ${shortDate(review.dueDate)}.`, rule: policy.reviewN ? `Regla ${policy.reviewN} de vuestra política` : "", cta };
    if (review.status === "due-soon") return { id: "politica", title: "Revisad la política de inversión este mes", reason: `Toca revisarla el ${shortDate(review.dueDate)}.`, rule: policy.reviewN ? `Regla ${policy.reviewN} de vuestra política` : "", cta };
    return null;
  }

  function accionConviccion(convictions) {
    const due = (convictions || []).filter((item) => item && item.label);
    if (!due.length) return null;
    const first = due[0];
    const more = due.length > 1 ? ` (y ${due.length - 1} más)` : "";
    return {
      id: "conviccion",
      title: `Revisad la convicción de ${first.label}${more}`,
      reason: first.neverReviewed ? "La declarasteis y nunca la habéis confirmado. Se confirma una vez al año, en la lista de posiciones." : `Sin confirmar desde hace ${first.monthsSinceReview} meses; se confirma una vez al año, en la lista de posiciones.`,
      rule: "",
      cta: { kind: "enlace", label: "Ver las posiciones", href: "#inversion-cartera" },
    };
  }

  /**
   * Las acciones de la cartera, ordenadas. `facts` lo prepara la pantalla con los motores de siempre.
   * @param {{today?: string, positions?: number, staleDays?: number, stale?: string[], policy?: *, drift?: *, fiscal?: *, convictions?: *}} [facts]
   * @returns {{calculable: boolean, reason?: string, primary: object|null, others: object[], checked: string[]}}
   */
  function nextBestActions(facts = {}) {
    if (!(number(facts.positions) > 0)) return { calculable: false, reason: "sin-posiciones", primary: null, others: [], checked: [] };
    const builders = {
      valorar: () => accionValorar(facts.stale || [], number(facts.staleDays, 35)),
      incumple: () => accionIncumple(facts.policy),
      deriva: () => accionDeriva(facts.drift),
      fiscal: () => accionFiscal(facts.fiscal, facts.today),
      politica: () => accionPolitica(facts.policy),
      conviccion: () => accionConviccion(facts.convictions),
    };
    const actions = ORDER.map((id) => builders[id]()).filter(Boolean);
    const checked = [
      `valoraciones de menos de ${number(facts.staleDays, 35)} días`,
      facts.drift?.source ? `reparto dentro de la banda de ${points(facts.drift.bandPct)} puntos` : "reparto (no hay reparto objetivo declarado)",
      "reglas de la política",
      "convicción confirmada en el último año",
    ];
    return { calculable: true, primary: actions[0] || null, others: actions.slice(1), checked };
  }

  return { ORDER, FISCAL_FROM_MONTH, TYPES, nextBestActions };
});
