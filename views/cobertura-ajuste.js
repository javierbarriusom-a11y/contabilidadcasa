// Cobro caducado (docs/rediseno/ESTADO.md §6 y §8, respuestas P3 y P4 del hogar, 19/10/2026).
//
// El ajuste manual de «Hasta el siguiente ingreso» (scenarioSettings.e6Coverage, editor en Ajustes ›
// Configuración) se lee aquí con las reglas del hogar, sin tocar el motor (canonical-daily-engine.js):
//   - una fecha de cobro manual anterior a la fecha de saldos deja de aplicarse y se avisa (P3);
//   - un gasto diario manual de 0 € se trata como dato sin rellenar y se avisa (P4); vacío nunca es 0 €;
//   - el editor se abre con lo aprendido, y eso no se guarda como manual por pulsar «Guardar ajuste»:
//     solo lo que el hogar cambia (o lo que ya era manual).
// Script clásico con defer, cargado antes de app.js (mismo scope global que el resto de views/*.js).

function coberturaAjusteLeer(raw, asOf) {
  const ajuste = raw || {};
  const fecha = String(ajuste.nextIncomeDate || "");
  const caducada = fecha && asOf && fecha < String(asOf).slice(0, 10) ? fecha : "";
  const bruto = ajuste.dailyOutflow;
  const gasto = bruto === "" || bruto === null || bruto === undefined ? null : Number(bruto);
  return {
    nextIncomeDate: caducada ? "" : fecha,
    dailyOutflow: Number.isFinite(gasto) && gasto > 0 ? gasto : null,
    expiredDate: caducada,
    zeroOutflow: gasto === 0,
  };
}

function coberturaAjusteDiaMes(iso) {
  const [, mes, dia] = String(iso).split("-");
  return dia && mes ? `${dia}/${mes}` : String(iso);
}

// Una línea por problema; vacío si el ajuste manual está bien o no existe.
function coberturaAjusteAvisos(ajuste) {
  const avisos = [];
  if (ajuste?.expiredDate) avisos.push(`Tu fecha de cobro manual caducó el ${coberturaAjusteDiaMes(ajuste.expiredDate)}: ponla al día.`);
  if (ajuste?.zeroOutflow) avisos.push("El gasto diario guardado a mano es 0 €: no se usa hasta que pongas el real.");
  return avisos;
}

function coberturaAjusteAvisoHtml(ajuste, clase = "e6-coverage-aviso") {
  const avisos = coberturaAjusteAvisos(ajuste);
  if (!avisos.length) return "";
  return `<p class="${clase}" role="status">${avisos.map((texto) => escapeHtml(texto)).join(" ")}
    <button type="button" class="link-button" data-cobertura-ajuste-ir>Corregir el ajuste</button></p>`;
}

// Lo que se guarda al pulsar «Guardar ajuste». `valores` son los campos tal como están escritos; `prefill`,
// lo que el editor puso al abrirse (dataset del editor); `vigente`, el ajuste manual que ya contaba.
function coberturaAjusteAGuardar(valores, prefill = {}, vigente = {}) {
  const fechaTocada = (valores.fecha || "") !== (prefill.prefillDate || "") || Boolean(vigente.nextIncomeDate);
  const gastoTocado = (valores.gasto || "") !== (prefill.prefillOutflow || "") || Number.isFinite(vigente.dailyOutflow);
  const gasto = gastoTocado ? parseAmount(valores.gasto) : null;
  return {
    nextIncomeDate: fechaTocada ? valores.fecha || "" : "",
    dailyOutflow: Number.isFinite(gasto) ? gasto : null,
  };
}

function coberturaAjusteSinCambios(valores, prefill = {}) {
  return (valores.fecha || "") === (prefill.prefillDate || "") && (valores.gasto || "") === (prefill.prefillOutflow || "");
}

// «Corregir el ajuste» lleva al editor (Ajustes › Configuración) y deja el foco en la fecha.
document.addEventListener("click", (event) => {
  if (!event.target.closest("[data-cobertura-ajuste-ir]")) return;
  history.pushState(null, "", "#ajustes");
  setActiveView("ajustes");
  requestAnimationFrame(() => {
    document.getElementById("e6CoverageEditor")?.scrollIntoView({ block: "start" });
    document.getElementById("e6NextIncomeDate")?.focus({ preventScroll: true });
  });
});
