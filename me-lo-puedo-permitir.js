/**
 * me-lo-puedo-permitir.js
 *
 * UND-08 (undécima auditoría; DEC-31, 22/11/2026): «¿Me lo puedo permitir?» desde Hoy. Un importe y una fecha → una frase:
 *  - «Sí, y el día más justo os quedan X € sobre el suelo» (margen de 150 € o más);
 *  - «Sí, pero el 14 os quedáis a 120 € del suelo» (por encima del suelo, con menos de 150 € de margen);
 *  - «No sin mover algo», con dos opciones calculadas: esperar al cobro (si entonces cabe) y el importe que cabe en esa fecha.
 * Se calcula con la previsión diaria de Hoy (la misma línea que su gráfico): desde la fecha del gasto, todos los días bajan ese
 * importe, y se mira el día más bajo de los que quedan en la ventana (30 días después del gasto, o hasta 6 días después del cobro si
 * es más tarde) frente al suelo de Hoy. Si la previsión ya baja del suelo sin el gasto, se dice eso y no un «no» que no es por él.
 *
 * No guarda nada. Me aparto de la ficha en una cosa: no hay «Apuntarlo como previsto», porque apuntar en el plan desde aquí se
 * saltaría el «Qué ocurrirá» de las acciones que cambian el plan (decisión 6); para eso está Plan.
 *
 * La parte pura (`responder`) se prueba en Node; la hoja solo corre en el navegador y comparte el ámbito de app.js y views/hoy-v2.js.
 */
(function exposeMeLoPuedoPermitir(root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.FinanceMeLoPuedoPermitir = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function createMeLoPuedoPermitir() {
  "use strict";

  const MARGEN_JUSTO = 150;
  const DIAS_DESPUES = 30;

  function round2(value) {
    return Math.round((value + Number.EPSILON) * 100) / 100;
  }

  function sumarDias(iso, dias) {
    const d = new Date(`${iso}T12:00:00`);
    d.setDate(d.getDate() + dias);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }

  function hastaDe(fecha, cobro) {
    const tras = sumarDias(fecha, DIAS_DESPUES);
    const trasCobro = cobro && cobro > fecha ? sumarDias(cobro, 6) : "";
    return trasCobro > tras ? trasCobro : tras;
  }

  function minimo(puntos, desde, hasta, restar) {
    let peor = null;
    for (const p of puntos) {
      if (p.date < desde || p.date > hasta) continue;
      const valor = round2(Number(p.value) - (p.date >= desde ? restar : 0));
      if (!peor || valor < peor.value) peor = { date: p.date, value: valor };
    }
    return peor;
  }

  /**
   * @param {{puntos: Array<{date: string, value: number}>, suelo: number, importe: number, fecha: string, cobro?: string|null}} entrada
   *   `puntos`: la previsión diaria desde hoy (saldo total previsto cada día); `suelo`: el de Hoy; `cobro`: el próximo cobro.
   */
  function responder(entrada = {}) {
    const puntos = (Array.isArray(entrada.puntos) ? entrada.puntos : []).filter((p) => /^\d{4}-\d{2}-\d{2}$/.test(String(p?.date || "")) && Number.isFinite(Number(p.value)));
    const importe = Number(entrada.importe);
    if (!Number.isFinite(importe) || importe <= 0) return { estado: "sin-importe" };
    if (!puntos.length) return { estado: "sin-datos" };
    const suelo = Number.isFinite(Number(entrada.suelo)) ? Number(entrada.suelo) : 0;
    const primero = puntos[0].date;
    const ultimo = puntos[puntos.length - 1].date;
    const fecha = /^\d{4}-\d{2}-\d{2}$/.test(String(entrada.fecha || "")) && entrada.fecha > primero ? entrada.fecha : primero;
    if (fecha > ultimo) return { estado: "fuera", ultimo };
    const cobro = /^\d{4}-\d{2}-\d{2}$/.test(String(entrada.cobro || "")) ? entrada.cobro : null;
    const hasta = hastaDe(fecha, cobro) > ultimo ? ultimo : hastaDe(fecha, cobro);
    const sin = minimo(puntos, fecha, hasta, 0);
    const con = minimo(puntos, fecha, hasta, importe);
    const base = { fecha, hasta, importe: round2(importe), suelo, diaMasJusto: con.date, saldoMasJusto: con.value, margen: round2(con.value - suelo) };
    if (sin.value < suelo) return { ...base, estado: "ya-bajo", diaSinGasto: sin.date, faltaSinGasto: round2(suelo - sin.value) };
    if (base.margen >= MARGEN_JUSTO) return { ...base, estado: "si" };
    if (base.margen >= 0) return { ...base, estado: "justo" };
    const falta = round2(-base.margen);
    const opciones = [];
    if (cobro && cobro > fecha && cobro <= ultimo) {
      const tras = minimo(puntos, cobro, hastaDe(cobro, null) > ultimo ? ultimo : hastaDe(cobro, null), importe);
      const sinTras = minimo(puntos, cobro, hastaDe(cobro, null) > ultimo ? ultimo : hastaDe(cobro, null), 0);
      if (tras && sinTras && tras.value >= suelo) opciones.push({ id: "esperar-cobro", fecha: cobro, margen: round2(tras.value - suelo) });
    }
    const cabe = Math.max(0, Math.floor((importe - falta) / 10) * 10);
    if (cabe > 0) opciones.push({ id: "menos", importe: cabe });
    return { ...base, estado: "no", falta, opciones };
  }

  return { MARGEN_JUSTO, DIAS_DESPUES, responder, sumarDias };
});

// ---- La hoja (navegador; ámbito de app.js y views/hoy-v2.js) ---------------------------------------------------------------------
function permitirFechaCorta(iso) {
  return typeof hoyV2ShortDay === "function" ? hoyV2ShortDay(iso) : iso;
}

function permitirEntrada() {
  const hoy = isoLocalDate(new Date());
  const modelo = typeof hoyV2UltimoModelo !== "undefined" ? hoyV2UltimoModelo : null;
  const asOf = modelo?.asOf || state?.balanceDate || hoy;
  const coverage = typeof executiveCoverageSnapshot === "function" ? executiveCoverageSnapshot() : null;
  const cobro = coverage?.nextIncomeDate && coverage.nextIncomeDate > asOf ? coverage.nextIncomeDate : null;
  const rows = canonicalDailyEngineRuns?.active?.rows || [];
  const start = rows.findIndex((row) => row.date >= asOf);
  const slice = start < 0 ? [] : rows.slice(start, start + 120);
  const total = Number(modelo?.balances?.total);
  const shift = slice.length && Number.isFinite(total) ? total - Number(slice[0].openingTotal ?? slice[0].total ?? 0) : 0;
  const puntos = slice.map((row) => ({ date: row.date, value: Math.round((Number(row.total || 0) + shift) * 100) / 100 }));
  const suelo = globalThis.FinanceCanonicalHomeMargin?.normalizeFloor(state?.liquidityFloor) ?? 0;
  return { puntos, suelo, cobro, hoy };
}

function permitirFraseHtml(r) {
  const dia = (iso) => escapeHtml(permitirFechaCorta(iso));
  if (r.estado === "sin-importe") return "Escribid cuánto es y cuándo, y os digo si llegáis.";
  if (r.estado === "sin-datos") return "Sin la previsión de estos días no puedo contestarlo. Mirad Plan › Previsión.";
  if (r.estado === "fuera") return `La previsión diaria llega hasta el ${dia(r.ultimo)}: elegid una fecha antes.`;
  if (r.estado === "ya-bajo") return `<strong>Ojo: sin este gasto ya bajáis del suelo el ${dia(r.diaSinGasto)}</strong> (faltan unos ${escapeHtml(money(r.faltaSinGasto))}). Antes de decidirlo, mirad el arreglo en Plan › Previsión.`;
  if (r.estado === "si") return `<strong>Sí</strong>, y el día más justo (el ${dia(r.diaMasJusto)}) os quedan ${escapeHtml(money(r.margen))} sobre el suelo.`;
  if (r.estado === "justo") return `<strong>Sí, pero justo:</strong> el ${dia(r.diaMasJusto)} os quedáis a ${escapeHtml(money(r.margen))} del suelo.`;
  const opciones = (r.opciones || []).map((o) => (o.id === "esperar-cobro"
    ? `<li>Esperar al cobro del ${dia(o.fecha)}: entonces os quedarían ${escapeHtml(money(o.margen))} sobre el suelo.</li>`
    : `<li>En esa fecha caben hasta ${escapeHtml(money(o.importe))} sin bajar del suelo.</li>`)).join("");
  return `<strong>No sin mover algo:</strong> el ${dia(r.diaMasJusto)} os faltarían unos ${escapeHtml(money(r.falta))} para el suelo.${opciones ? `<ul class="permitir-opciones">${opciones}</ul>` : ""}`;
}

let permitirContado = false;

function permitirCalcular() {
  const dialogo = qs("permitirDialog");
  if (!dialogo) return;
  const importe = Number(String(qs("permitirImporte")?.value || "").replace(",", "."));
  const entrada = permitirEntrada();
  const fecha = qs("permitirFecha")?.value || entrada.hoy;
  const r = globalThis.FinanceMeLoPuedoPermitir.responder({ ...entrada, importe, fecha });
  const frase = qs("permitirRespuesta");
  if (frase) frase.innerHTML = permitirFraseHtml(r);
  const grafico = qs("permitirGrafico");
  if (grafico) {
    const puntos = ["si", "justo", "no", "ya-bajo"].includes(r.estado)
      ? entrada.puntos.filter((p) => p.date <= r.hasta).map((p) => ({ date: p.date, value: p.date >= r.fecha ? Math.round((p.value - r.importe) * 100) / 100 : p.value }))
      : [];
    grafico.innerHTML = puntos.length > 1 && typeof hoyV2ChartSvg === "function" ? hoyV2ChartSvg(puntos, entrada.suelo, entrada.cobro) : "";
  }
  if (!permitirContado && ["si", "justo", "no", "ya-bajo"].includes(r.estado)) {
    permitirContado = true;
    globalThis.FinanceMedidor?.anotar?.("me-lo-permito", "accion");
  }
}

let permitirOpener = null;

function permitirAbrir(opener) {
  const dialogo = qs("permitirDialog");
  if (!dialogo) return;
  permitirOpener = opener || null;
  permitirContado = false;
  const fecha = qs("permitirFecha");
  if (fecha && !fecha.value) fecha.value = isoLocalDate(new Date());
  permitirCalcular();
  if (!dialogo.open) {
    if (typeof dialogo.showModal === "function") dialogo.showModal();
    else dialogo.setAttribute("open", "");
  }
  qs("permitirImporte")?.focus();
}

function attachPermitir(doc = document) {
  if (!doc || doc.__permitir) return;
  doc.__permitir = true;
  doc.addEventListener("click", (event) => {
    const abrir = event.target?.closest?.("[data-permitir-abrir]");
    if (abrir) {
      permitirAbrir(abrir);
      return;
    }
    if (event.target?.closest?.("[data-permitir-cerrar]")) qs("permitirDialog")?.close?.();
  });
  doc.addEventListener("input", (event) => {
    if (event.target?.id === "permitirImporte" || event.target?.id === "permitirFecha") permitirCalcular();
  });
  qs("permitirDialog")?.addEventListener("close", () => {
    if (permitirOpener?.isConnected) permitirOpener.focus();
    permitirOpener = null;
  });
}
