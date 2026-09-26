(function attachCanonicalRegistrarActualsConfirm(root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.FinanceCanonicalRegistrarActualsConfirm = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function createCanonicalRegistrarActualsConfirm() {
  "use strict";

  // R-13: Registrar › Reales del mes obligaba a teclear cada partida, una a una, incluso cuando lo
  // previsto ya era lo ocurrido — pedido por el hogar. Este motor vive fuera de app.js (su techo de
  // líneas, ARQ-4, no tenía margen): recibe por inyección dónde escribe cada tipo de real y cómo se
  // registra el cambio para poder deshacerlo, igual que ya hace p2-private-store.js con el cifrado.

  function confirmPending(entries, { actualsForKind, recordSessionChange, round2 = (v) => Math.round(Number(v || 0) * 100) / 100 }) {
    const pending = (entries || []).filter((entry) => entry && entry.kind && entry.key && !entry.hasActual);
    const touchedKinds = new Set();
    pending.forEach((entry) => {
      const actuals = actualsForKind(entry.kind);
      const previous = Object.prototype.hasOwnProperty.call(actuals, entry.key) ? actuals[entry.key] : null;
      actuals[entry.key] = round2(entry.planned);
      recordSessionChange({ kind: "actual", actualsKind: entry.kind, key: entry.key, previous });
      touchedKinds.add(entry.kind);
    });
    return { count: pending.length, kinds: touchedKinds };
  }

  /** @param {{escapeHtml: (value: unknown) => string, disabled?: boolean, selectedCount?: number}} options */
  function bulkButtonHtml(pendingCount, blockFilter, options) {
    const { escapeHtml, disabled = false, selectedCount = 0 } = options || {};
    if (!pendingCount) return "";
    // Pedido del hogar tras ver R-13 en producción: además de "por bloque" y "todas", poder
    // seleccionar partidas sueltas (los checkboxes de fila) y confirmar solo esas — la selección,
    // cuando existe, manda sobre el filtro de bloque activo, sin ningún botón nuevo.
    const scope = selectedCount > 0 ? `${selectedCount} seleccionada${selectedCount === 1 ? "" : "s"}` : blockFilter === "todos" ? "todos los pendientes" : `los pendientes de ${blockFilter}`;
    const countSuffix = selectedCount > 0 ? "" : ` (${pendingCount} partida${pendingCount === 1 ? "" : "s"})`;
    return `<button type="button" class="e19-btn e19-btn-secondary" data-registrar-actuals-confirm-pending${disabled ? " disabled" : ""}>Confirmar ${escapeHtml(scope)} con su previsto${countSuffix}</button>`;
  }

  // Un único punto de entrada para el clic delegado del panel entero: decide, a partir del elemento
  // pulsado, qué partidas tocaría confirmar (una, las seleccionadas, las de un bloque, o todas) — o
  // null si el clic no era de este botón, para que app.js siga con su propia lógica de navegación.
  function entriesForClick(target, { allEntries, blockFilter, selectedKeys }) {
    const single = target?.closest?.("[data-registrar-actuals-confirm]");
    if (single) {
      return [{ kind: single.dataset.registrarActualsKind, key: single.dataset.registrarActualsConfirm, planned: Number(single.dataset.registrarActualsPlanned || 0), hasActual: false }];
    }
    if (target?.closest?.("[data-registrar-actuals-confirm-pending]")) {
      const selected = selectedKeys && selectedKeys.size ? selectedKeys : null;
      return (allEntries || []).filter((entry) => !entry.hasActual && (selected ? selected.has(entry.key) : blockFilter === "todos" || entry.sectionName === blockFilter));
    }
    return null;
  }

  // Punto de entrada único para el clic delegado en app.js: resuelve qué partidas tocaría
  // confirmar y, si el clic era de este botón, las confirma en el mismo paso — null si no lo era,
  // para que app.js siga con su propia lógica (p. ej. la navegación de "Ver en Plan").
  function handleConfirmClick(target, ctx) {
    const entries = entriesForClick(target, ctx);
    return entries ? confirmPending(entries, ctx) : null;
  }

  return { confirmPending, bulkButtonHtml, entriesForClick, handleConfirmClick };
});
