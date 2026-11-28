// D-N57 (27/11/2026, petición del hogar con la captura de «Registrar gasto nuevo»): la asignación, lo más flexible posible.
// Hasta hoy la ventana creaba siempre una partida nueva con el concepto y la anotaba en un solo mes. Ahora:
// - **Partida:** la nueva con este concepto (lo de siempre, en el bloque elegido) o una que ya existe.
// - **Meses:** solo el mes de la ventana, un periodo (desde-hasta) o meses concretos.
// - **El importe se repite en cada mes elegido.** Los meses hasta el de la ventana (abiertos) se anotan como gasto ya
//   realizado (real); los posteriores, como previsto: un gasto que aún no ha ocurrido no puede ser real. En una partida que
//   ya existe, el previsto de cada mes sube en ese importe (se enseña «antes → después»); en una de deuda no se toca, porque
//   su previsto lo calcula el plan de deuda.
// - **«Repartir el importe entre los meses»** (la otra mitad de D-N57) no está aquí todavía: repartir un pago real descuadra
//   Cierre, que compara banco y reales mes a mes, y necesita la provisión aparte. Va en su propio PR (docs del 27/11).
// Antes de registrar, «Qué ocurrirá» dice mes a mes lo que se escribe; después, «Deshacer» lo devuelve todo.
// Se carga con `defer` y comparte el ámbito de app.js, como ficha-movimiento-ui.js. La parte pura (gastoFlexPlan) se prueba en Node.

const GASTO_FLEX_NUEVA = "";

// La parte pura: qué se escribe en cada mes. `meses` [{ key, label }] elegidos; `baseKey` el mes de la ventana; `antes(mes)`
// el previsto actual de la partida existente en ese mes (null si es nueva) y `esDeuda(mes)` si su previsto lo pone el plan de deuda.
function gastoFlexPlan({ meses = [], baseKey = "", importe = 0, nueva = true, antes = () => 0, esDeuda = () => false } = {}) {
  const cantidad = Math.round((Number(importe) || 0) * 100) / 100;
  const vistos = new Set();
  const filas = [...meses]
    .filter((mes) => mes?.key && !vistos.has(mes.key) && vistos.add(mes.key))
    .sort((a, b) => a.key.localeCompare(b.key))
    .map((mes) => {
      if (mes.key <= baseKey) return { mes, tipo: "real", importe: cantidad, previsto: nueva ? cantidad : null };
      if (!nueva && esDeuda(mes)) return { mes, tipo: "omitido", importe: 0, motivo: "su previsto lo calcula el plan de deuda" };
      const previo = nueva ? 0 : Math.round((Number(antes(mes)) || 0) * 100) / 100;
      return { mes, tipo: "previsto", importe: cantidad, antes: previo, despues: Math.round((previo + cantidad) * 100) / 100 };
    });
  const reales = filas.filter((fila) => fila.tipo === "real");
  const previstos = filas.filter((fila) => fila.tipo === "previsto");
  return { filas, reales, previstos, total: Math.round(cantidad * (reales.length + previstos.length) * 100) / 100 };
}

// Los meses que se pueden elegir: abiertos, desde el primero sin cerrar hasta el final del plan.
function gastoFlexMesesElegibles() {
  return (baseData?.monthlyPlanning?.months || []).filter((month) => !isClosedMonthKey(month.key));
}

let gastoFlexEstado = null; // { mes: () => month } de la ventana abierta

function gastoFlexModo() {
  return document.querySelector('input[name="homeQuickExpenseCuando"]:checked')?.value || "uno";
}

function gastoFlexMesesElegidos() {
  const base = gastoFlexEstado?.mes?.();
  const elegibles = gastoFlexMesesElegibles();
  const modo = gastoFlexModo();
  if (modo === "periodo") {
    const desde = qs("homeQuickExpenseDesde")?.value || "";
    const hasta = qs("homeQuickExpenseHasta")?.value || "";
    return elegibles.filter((month) => month.key >= desde && month.key <= hasta);
  }
  if (modo === "sueltos") {
    const marcados = new Set([...document.querySelectorAll("#homeQuickExpenseSueltos input:checked")].map((input) => input.value));
    return elegibles.filter((month) => marcados.has(month.key));
  }
  return base ? [base] : [];
}

function gastoFlexPartidaElegida() {
  const key = qs("homeQuickExpensePartida")?.value || GASTO_FLEX_NUEVA;
  return key ? rowForSeriesKey(key) : null;
}

function gastoFlexPlanActual() {
  const base = gastoFlexEstado?.mes?.();
  const row = gastoFlexPartidaElegida();
  return gastoFlexPlan({
    meses: gastoFlexMesesElegidos(),
    baseKey: base?.key || "",
    importe: parseAmountField(qs("homeQuickExpenseAmount")?.value) || 0,
    nueva: !row,
    antes: (month) => (row ? plannedValueForRow(row, month) : 0),
    esDeuda: (month) => Boolean(row) && adjustedDebtPlannedValue(row, month) !== null,
  });
}

function gastoFlexMesCorto(month) {
  return month?.label || month?.key || "";
}

// «Qué ocurrirá», en una o dos frases y, con varios meses, la lista mes a mes.
function gastoFlexPintarResumen() {
  const nota = qs("homeQuickExpenseQueOcurrira");
  if (!nota) return;
  const plan = gastoFlexPlanActual();
  const row = gastoFlexPartidaElegida();
  const importe = parseAmountField(qs("homeQuickExpenseAmount")?.value) || 0;
  if (!plan.filas.length) {
    nota.innerHTML = gastoFlexModo() === "uno" ? "" : "Elige al menos un mes.";
    return;
  }
  const destino = row ? `en «${escapeHtml(displayLabelForRow(row))}» (${escapeHtml(row.sectionName || "")})` : "en una partida nueva con este concepto";
  if (plan.filas.length === 1 && plan.reales.length === 1) {
    nota.innerHTML = `Qué ocurrirá: ${importe ? money(importe, true) : "el importe"} ${destino}, como gasto ya realizado de ${escapeHtml(gastoFlexMesCorto(plan.reales[0].mes))}.`;
    return;
  }
  const lineas = plan.filas.map((fila) => {
    const mes = escapeHtml(gastoFlexMesCorto(fila.mes));
    if (fila.tipo === "real") return `<li>${mes}: ${money(fila.importe, true)} ya realizado</li>`;
    if (fila.tipo === "omitido") return `<li>${mes}: no se toca (${escapeHtml(fila.motivo)})</li>`;
    return `<li>${mes}: previsto ${row ? `${money(fila.antes, true)} → ${money(fila.despues, true)}` : money(fila.importe, true)}</li>`;
  });
  const cuenta = [plan.reales.length ? `${plan.reales.length} ${plan.reales.length === 1 ? "mes" : "meses"} como real` : "", plan.previstos.length ? `${plan.previstos.length} como previsto` : ""].filter(Boolean).join(" y ");
  nota.innerHTML = `Qué ocurrirá: ${importe ? money(importe, true) : "el importe"} cada mes ${destino}, ${cuenta}.<ul class="gasto-flex-lista">${lineas.join("")}</ul>`;
}

function gastoFlexPintarCuando() {
  const modo = gastoFlexModo();
  const periodo = qs("homeQuickExpensePeriodo");
  const sueltos = qs("homeQuickExpenseSueltos");
  if (periodo) periodo.hidden = modo !== "periodo";
  if (sueltos) sueltos.hidden = modo !== "sueltos";
  const bloque = qs("homeQuickExpenseSection")?.closest("label");
  if (bloque) bloque.hidden = Boolean(gastoFlexPartidaElegida());
  gastoFlexPintarResumen();
}

// La abre openHomeQuickExpenseDialog (app.js) con el mes de la ventana, que puede cambiar con «¿Era de …?».
function gastoFlexPreparar(mesDeLaVentana) {
  gastoFlexEstado = { mes: mesDeLaVentana };
  const base = mesDeLaVentana();
  const elegibles = gastoFlexMesesElegibles();
  const partida = qs("homeQuickExpensePartida");
  if (partida) {
    const porBloque = new Map();
    availableSeriesRows("expense").forEach((row) => {
      if (!porBloque.has(row.sectionName)) porBloque.set(row.sectionName, []);
      porBloque.get(row.sectionName).push(row);
    });
    partida.innerHTML = `<option value="${GASTO_FLEX_NUEVA}">Partida nueva con este concepto</option>${[...porBloque]
      .map(([bloque, rows]) => `<optgroup label="${escapeHtml(bloque)}">${rows.map((row) => `<option value="${escapeHtml(seriesKeyForRow(row))}">${escapeHtml(displayLabelForRow(row))}</option>`).join("")}</optgroup>`)
      .join("")}`;
  }
  const uno = document.querySelector('input[name="homeQuickExpenseCuando"][value="uno"]');
  if (uno) uno.checked = true;
  const opciones = elegibles.map((month) => `<option value="${escapeHtml(month.key)}">${escapeHtml(gastoFlexMesCorto(month))}</option>`).join("");
  const desde = qs("homeQuickExpenseDesde");
  const hasta = qs("homeQuickExpenseHasta");
  if (desde) { desde.innerHTML = opciones; desde.value = base?.key || ""; }
  if (hasta) { hasta.innerHTML = opciones; hasta.value = elegibles.at(-1)?.key || ""; }
  const sueltos = qs("homeQuickExpenseSueltos");
  if (sueltos) {
    sueltos.innerHTML = `<legend>Meses</legend>${elegibles
      .map((month) => `<label class="gasto-flex-mes"><input type="checkbox" value="${escapeHtml(month.key)}"${month.key === base?.key ? " checked" : ""}><span>${escapeHtml(gastoFlexMesCorto(month))}</span></label>`)
      .join("")}`;
  }
  const form = qs("homeQuickExpenseForm");
  if (form && !form.dataset.gastoFlex) {
    form.dataset.gastoFlex = "1";
    form.addEventListener("change", gastoFlexPintarCuando);
    form.addEventListener("input", gastoFlexPintarResumen);
    qs("homeQuickExpenseMonthSwitch")?.addEventListener("click", () => window.setTimeout(gastoFlexPintarCuando, 0));
  }
  gastoFlexPintarCuando();
}

// Al confirmar la ventana. Devuelve true si lo ha registrado (y app.js no hace lo de siempre); false si es el caso de siempre
// (partida nueva y solo el mes de la ventana), que sigue por submitHomeQuickExpense sin cambiar nada.
function gastoFlexGuardar(month, sectionName, label, rawAmount, linkDate = "") {
  const row = gastoFlexPartidaElegida();
  if (!row && gastoFlexModo() === "uno") return false;
  const importe = parseAmountField(rawAmount);
  if (!month || !label || importe === null || importe <= 0) return true;
  const plan = gastoFlexPlanActual();
  if (!plan.reales.length && !plan.previstos.length) {
    announceStatus("No se ha registrado nada: no había ningún mes elegido.");
    return true;
  }
  const foto = { filas: customPlanningRows.length, reales: { ...expenseActuals }, overrides: { ...seriesOverrides } };
  let destino = row;
  if (!destino) {
    const id = `custom-expense-${Date.now()}-${Math.random().toString(16).slice(2)}`;
    [...plan.reales, ...plan.previstos].forEach((fila) => customPlanningRows.push({ id, custom: true, kind: "expense", sectionName, label, monthKey: fila.mes.key, plannedValue: fila.importe }));
    saveCustomPlanningRows();
    destino = { id, kind: "expense", custom: true };
  } else {
    plan.previstos.forEach((fila) => {
      const key = overrideKeyForRow(destino, fila.mes);
      // En la partida de gasto variable lo que se ve es su base menos las asignaciones personales (WP-24): la base sube igual.
      const base = isVariableOperationalRow(destino) ? fila.despues + personalAllowanceTotal(fila.mes) : fila.despues;
      seriesOverrides[key] = { ...(seriesOverrides[key] || {}), planned: round2(base) };
    });
    if (plan.previstos.length) saveSeriesOverrides();
  }
  plan.reales.forEach((fila) => {
    const key = actualKeyForRow(destino, fila.mes);
    expenseActuals[key] = round2(Number(expenseActuals[key] || 0) + fila.importe);
    recordCaptureLog({ rowId: destino.id, monthKey: fila.mes.key, date: linkDate || isoLocalDate(new Date()), concept: label, amount: -fila.importe, channel: linkDate ? "enlace" : "ventana" }); // WP-53
  });
  if (plan.reales.length) saveExpenseActuals();
  render();
  const texto = `Registrado: ${money(importe, true)} ${plan.reales.length + plan.previstos.length > 1 ? `en ${plan.reales.length + plan.previstos.length} meses` : ""} ${row ? `en «${displayLabelForRow(row)}»` : `en la partida nueva «${label}»`}.`.replace(/\s+/g, " ");
  announceStatus(texto);
  showUndoToast(texto, () => {
    customPlanningRows.splice(foto.filas);
    saveCustomPlanningRows();
    Object.keys(expenseActuals).forEach((key) => delete expenseActuals[key]);
    Object.assign(expenseActuals, foto.reales);
    saveExpenseActuals();
    Object.keys(seriesOverrides).forEach((key) => delete seriesOverrides[key]);
    Object.assign(seriesOverrides, foto.overrides);
    saveSeriesOverrides();
    render();
    announceStatus("Deshecho: el gasto ya no está registrado.");
  });
  return true;
}

if (typeof module !== "undefined") module.exports = { gastoFlexPlan };
