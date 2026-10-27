(function attachCanonicalDecisionFreshness(root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.FinanceCanonicalDecisionFreshness = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function canonicalDecisionFreshnessFactory() {
  "use strict";

  // XDA-10 · PR-1 «Comprobar los datos antes de decidir» (ficha XDA-10 de docs/PROPUESTA_SEPTIMA_AUDITORIA_2026-10-17.md). Antes de enseñar un
  // veredicto, mira la edad de los datos que entran en él y dice cuáles podrían darle la vuelta: los que, por antiguos, pueden haberse movido
  // tanto como el margen que tiene el veredicto. Lo demás «no cambia el resultado». Como mucho tres datos.
  //
  // Reglas de honestidad:
  //   · un dato del que no se sabe cuánto ha podido moverse (sin fecha, saldos calculados por calendario) no se da por bueno: «no sé»;
  //   · «puede haberse movido hasta» es la estimación de WP-45 (gasto diario × días, con tope), no un dato, y se dice así;
  //   · el veredicto se enseña igual, solo marcado con la edad de sus datos. Motor puro: ni DOM, ni almacenamiento, ni reloj.

  const SCHEMA_ID = "finance-decision-freshness/v1";
  const MAX_ITEMS = 3;

  const known = (value) => value !== "" && value !== null && value !== undefined && Number.isFinite(Number(value));
  const round2 = (value) => Math.round((Number(value) + Number.EPSILON) * 100) / 100;

  /**
   * @param {{margin?: number|null, inputs?: Array<{id: string, label: string, ageDays: number|null, staleAfterDays: number, plausibleMove: number|null, action?: {label: string, href: string}|null}>}} [input]
   * @returns {{schemaId: string, status: "fresh"|"stale", oldestDays: number|null, margin: number|null, items: Array<any>, sentence: string}}
   */
  function check({ margin = null, inputs = [] } = {}) {
    const list = (Array.isArray(inputs) ? inputs : []).filter((item) => item && item.id);
    const marginKnown = known(margin) ? Math.abs(Number(margin)) : null;
    const stale = list.filter((item) => !known(item.ageDays) || Number(item.ageDays) >= Number(item.staleAfterDays || 0)).map((item) => {
      const move = known(item.plausibleMove) ? round2(item.plausibleMove) : null;
      const flips = move === null || marginKnown === null ? "unknown" : move >= marginKnown ? "yes" : "no";
      return { id: item.id, label: item.label, ageDays: known(item.ageDays) ? Number(item.ageDays) : null, plausibleMove: move, flips, action: item.action || null };
    });
    const order = { yes: 0, unknown: 1, no: 2 };
    const items = stale.sort((a, b) => order[a.flips] - order[b.flips] || (b.ageDays ?? Infinity) - (a.ageDays ?? Infinity)).slice(0, MAX_ITEMS);
    const ages = list.map((item) => item.ageDays).filter(known).map(Number);
    const oldestDays = ages.length ? Math.max(...ages) : null;
    return { schemaId: SCHEMA_ID, status: items.length ? "stale" : "fresh", oldestDays, margin: marginKnown, items, sentence: sentenceFor(items, marginKnown) };
  }

  function euros(value) {
    return `${String(Math.round(Math.abs(value))).replace(/\B(?=(\d{3})+(?!\d))/g, ".")} €`;
  }

  function age(days) {
    if (days === null) return "sin fecha";
    if (days === 1) return "de ayer";
    return `de hace ${days} días`;
  }

  function sentenceFor(items, margin) {
    if (!items.length) return "";
    const flips = items.filter((item) => item.flips === "yes");
    const unknown = items.filter((item) => item.flips === "unknown");
    if (flips.length) {
      const first = flips[0];
      return `Antes de decidir, actualiza ${first.label.toLowerCase()} (${age(first.ageDays)}): pueden haberse movido hasta ${euros(first.plausibleMove)} y el resultado cambia con ${euros(margin)}.`;
    }
    if (unknown.length) {
      const why = unknown[0].plausibleMove === null ? "no sé cuánto han podido moverse" : "lo que haya podido entrar desde entonces podría cambiar el resultado, y eso no lo estimo";
      return `Antes de decidir, conviene actualizar ${unknown[0].label.toLowerCase()} (${age(unknown[0].ageDays)}): ${why}.`;
    }
    const first = items[0];
    return `${first.label} son ${age(first.ageDays)}, pero lo que hayan podido moverse (hasta ${euros(first.plausibleMove)}) no cambia el resultado.`;
  }

  return Object.freeze({ SCHEMA_ID, MAX_ITEMS, check });
});
