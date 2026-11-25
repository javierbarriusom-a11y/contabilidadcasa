// DUO-D1 · D-N35 (duodécima auditoría; recoge UND-14): el seguimiento del plan de deuda, debajo del plan óptimo en Deuda › Plan.
// Sin plan guardado: «Este es nuestro plan». Con plan: los meses con su forma (● hecho · ◐ parcial · ○ no · ? sin encontrar · ·  más adelante),
// la racha, lo puesto de más frente a lo previsto, lo que la app ha encontrado en los extractos (con «No era esto») y, si no ha encontrado
// el pago de un mes cerrado, una sola pregunta: «Sí», «Otra cantidad» o «Este mes no». Sin titular nuevo (XGO-01).
//
// Lo guardado (en este navegador y en la copia, BACKUP_LOCAL_STORES): la foto del plan y las respuestas por mes. Nada se envía ni se ejecuta.
// Script de pantalla: comparte el ámbito global de app.js (qs, escapeHtml, money, storageGet/Set/Key, isoLocalDate, baseData…).

const SEG_PLAN_KEY = "plan-deuda-compromiso";
const SEG_RESPUESTAS_KEY = "plan-deuda-respuestas";
const SEG_MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
const SEG_FORMA = { hecho: "●", parcial: "◐", no: "○", preguntar: "?", "en-curso": "…", futuro: "·" };
let segEnganchado = false;
let segUltimo = null; // { plan, contratos }
let segOtraAbierta = false;

function segLeer(key, fallback) {
  try {
    const raw = storageGet(key, "");
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function segEscribir(key, value) {
  try {
    if (value === null) storageSet(key, "");
    else storageSet(key, JSON.stringify(value));
  } catch {
    /* sin almacenamiento: el seguimiento dura lo que la pestaña */
  }
}

function segMesTexto(mes, largo = false) {
  const [y, m] = String(mes).split("-").map(Number);
  if (!y || !m) return "";
  return largo && typeof caminoMonthText === "function" ? caminoMonthText(mes) : `${SEG_MESES[m - 1]} ${String(y).slice(2)}`;
}

function segFecha(iso) {
  const [y, m, d] = String(iso || "").split("-").map(Number);
  return y && m && d ? `${d} de ${SEG_MESES[m - 1]}` : "";
}

function segEstadoTexto(f) {
  if (f.estado === "hecho") return f.fuente === "respuesta" ? "hecho (lo dijisteis)" : "hecho (en el extracto)";
  if (f.estado === "parcial") return `${money(f.real, true)} de ${money(f.previsto, true)}`;
  if (f.estado === "no") return "ese mes no";
  if (f.estado === "preguntar") return "sin encontrar";
  if (f.estado === "en-curso") return f.real ? `${money(f.real, true)} hasta ahora` : "este mes";
  return "más adelante";
}

function segSeguimiento(compromiso, contratos) {
  const S = globalThis.FinanceSeguimientoPlanDeuda;
  return S.seguimiento(compromiso, {
    movimientos: typeof baseData === "object" ? baseData?.transactions || [] : [],
    contratos,
    respuestas: segLeer(storageKey(SEG_RESPUESTAS_KEY), {}),
    hoy: isoLocalDate(new Date()),
    lenderOf: globalThis.FinanceCanonicalDebtReceipts?.lenderOf,
  });
}

function segSinPlanHtml(plan) {
  if (!plan?.ok || !plan.recommended?.periods?.length) return "";
  return `<div class="seg-plan" data-seg-estado="sin-plan">
    <p class="cam-frase"><strong>¿Es este vuestro plan?</strong> Si lo guardáis, cada mes buscaré en los extractos el pago de más y solo os preguntaré si no lo encuentro.</p>
    <p><button type="button" class="e19-btn e19-btn-primary" data-seg-guardar>Este es nuestro plan</button></p>
  </div>`;
}

function segPreguntaHtml(p) {
  const otra = segOtraAbierta
    ? `<div class="seg-otra"><label class="month-picker"><span>¿Cuánto pusisteis de más? (€)</span>
        <input type="number" id="segOtraImporte" min="0" max="100000" step="10" inputmode="decimal" /></label>
        <button type="button" class="e19-btn e19-btn-primary" data-seg-otra-guardar>Guardar</button></div>`
    : "";
  return `<div class="seg-pregunta" role="group" aria-labelledby="segPreguntaTexto">
    <p id="segPreguntaTexto"><strong>En ${escapeHtml(segMesTexto(p.mes, true))} tocaba poner ${escapeHtml(money(p.previsto, true))} de más en ${escapeHtml(p.label)}.</strong> No lo he encontrado en los extractos. ¿Lo hicisteis?</p>
    <p class="seg-botones">
      <button type="button" class="e19-btn e19-btn-primary" data-seg-responder="si" data-seg-mes="${escapeHtml(p.mes)}">Sí</button>
      <button type="button" class="e19-btn e19-btn-secondary" data-seg-otra data-seg-mes="${escapeHtml(p.mes)}" aria-expanded="${segOtraAbierta ? "true" : "false"}">Otra cantidad</button>
      <button type="button" class="e19-btn e19-btn-secondary" data-seg-responder="no" data-seg-mes="${escapeHtml(p.mes)}">Este mes no</button>
    </p>${otra}
  </div>`;
}

function segConPlanHtml(compromiso, seg, planVivo) {
  const visibles = seg.filas.filter((f) => f.estado !== "futuro").concat(seg.filas.filter((f) => f.estado === "futuro").slice(0, 3));
  const meses = visibles.map((f) => `<li class="seg-mes" data-seg-mes-estado="${f.estado}">
      <span class="seg-forma" aria-hidden="true">${SEG_FORMA[f.estado] || "·"}</span>
      <span><strong>${escapeHtml(segMesTexto(f.mes))}</strong> · ${escapeHtml(f.label)}<br><span class="seg-detalle">${escapeHtml(segEstadoTexto(f))}</span></span>
    </li>`).join("");
  const vivo = planVivo?.ok ? planVivo.recommended?.summary?.debtFreeMonthKey : null;
  const comparacion = vivo && compromiso.fechaLibre && vivo !== compromiso.fechaLibre
    ? ` Con los saldos de hoy de Contratos, el plan da ${escapeHtml(segMesTexto(vivo, true))}${vivo > compromiso.fechaLibre ? " (más tarde)" : " (antes)"}.`
    : "";
  const resumen = [
    seg.racha > 1 ? `${seg.racha} meses seguidos cumpliendo` : seg.racha === 1 ? "el último mes, cumplido" : "",
    seg.previsto > 0 ? `${money(seg.hecho, true)} de más de ${money(seg.previsto, true)} previstos` : "",
  ].filter(Boolean).join(" · ");
  const d = seg.ultimoDetectado;
  const detectado = d
    ? `<p class="e19-kpi-note" data-seg-detectado>He encontrado ${escapeHtml(money(d.real, true))} de más a ${escapeHtml(d.label)} en ${escapeHtml(segMesTexto(d.mes, true))}${d.movimientos[0] ? ` (${escapeHtml(segFecha(d.movimientos[0].date))}: «${escapeHtml(d.movimientos[0].concepto)}»)` : ""}. <button type="button" class="seg-no-era" data-seg-no-era data-seg-mes="${escapeHtml(d.mes)}">No era esto</button></p>`
    : "";
  return `<div class="seg-plan" data-seg-estado="con-plan">
    <p class="cam-frase"><strong>Vuestro plan</strong>, guardado el ${escapeHtml(segFecha(compromiso.guardadoEl))}: libres en ${escapeHtml(segMesTexto(compromiso.fechaLibre, true))}.${comparacion}</p>
    ${seg.pregunta ? segPreguntaHtml(seg.pregunta) : ""}
    <ol class="seg-meses" aria-label="Lo de más de cada mes: hecho, parcial, no, sin encontrar o más adelante">${meses}</ol>
    ${resumen ? `<p class="e19-kpi-note" data-seg-resumen>${escapeHtml(resumen)}.</p>` : ""}
    ${detectado}
    <p class="e19-kpi-note">Un mes sin poner de más es una decisión, no un fallo: el plan sigue desde lo hecho. Busco por la entidad y la referencia de cada contrato.</p>
    <p class="seg-botones"><button type="button" class="e19-btn e19-btn-secondary" data-seg-guardar>Guardar el plan de ahora en su lugar</button>
      <button type="button" class="e19-btn e19-btn-secondary" data-seg-dejar>Dejar de seguirlo</button></p>
  </div>`;
}

function renderSeguimientoPlan(planVivo, contratos) {
  const box = typeof qs === "function" ? qs("planSeguimiento") : null;
  if (!box || !globalThis.FinanceSeguimientoPlanDeuda) return;
  segUltimo = { plan: planVivo, contratos: contratos || [] };
  try {
    const compromiso = segLeer(storageKey(SEG_PLAN_KEY), null);
    const seg = compromiso ? segSeguimiento(compromiso, contratos || []) : null;
    const html = compromiso && seg?.ok ? segConPlanHtml(compromiso, seg, planVivo) : segSinPlanHtml(planVivo);
    if (box.__segHtml !== html) {
      box.innerHTML = html;
      box.__segHtml = html;
    }
  } catch (error) {
    console.error(`renderSeguimientoPlan: ${error.message}`);
  }
  if (!segEnganchado) {
    segEnganchado = true;
    box.addEventListener("click", segOnClick);
  }
}

function segRepintar(foco) {
  // D-N40: guardar o dejar el plan cambia la fecha única; el plan óptimo (que repinta este seguimiento) y el titular la siguen.
  if (typeof planOptimoRepintar === "function" && typeof planOptimoLast !== "undefined" && planOptimoLast) planOptimoRepintar();
  else if (segUltimo) renderSeguimientoPlan(segUltimo.plan, segUltimo.contratos);
  if (foco) qs("planSeguimiento")?.querySelector(foco)?.focus();
}

function segResponder(mes, respuesta) {
  const respuestas = segLeer(storageKey(SEG_RESPUESTAS_KEY), {}) || {};
  respuestas[mes] = { ...respuesta, el: isoLocalDate(new Date()) };
  segEscribir(storageKey(SEG_RESPUESTAS_KEY), respuestas);
  globalThis.FinanceMedidor?.anotar("seguimiento-plan", "accion");
  segOtraAbierta = false;
  segRepintar("[data-seg-resumen], .seg-meses");
}

function segOnClick(event) {
  const t = event.target;
  if (t.closest("[data-seg-guardar]")) {
    const S = globalThis.FinanceSeguimientoPlanDeuda;
    const nuevo = S.compromiso(segUltimo?.plan, segUltimo?.contratos, isoLocalDate(new Date()));
    if (!nuevo) return;
    const antes = { plan: segLeer(storageKey(SEG_PLAN_KEY), null), respuestas: segLeer(storageKey(SEG_RESPUESTAS_KEY), {}) };
    segEscribir(storageKey(SEG_PLAN_KEY), nuevo);
    segEscribir(storageKey(SEG_RESPUESTAS_KEY), {});
    globalThis.FinanceMedidor?.anotar("seguimiento-plan", "accion");
    segRepintar(".seg-plan .cam-frase");
    // Sustituir un plan que se seguía borra sus respuestas: se puede deshacer.
    if (antes.plan && typeof showUndoToast === "function") {
      showUndoToast("Plan de deuda sustituido.", () => {
        segEscribir(storageKey(SEG_PLAN_KEY), antes.plan);
        segEscribir(storageKey(SEG_RESPUESTAS_KEY), antes.respuestas);
        segRepintar();
      });
    }
    return;
  }
  if (t.closest("[data-seg-dejar]")) {
    const antes = { plan: segLeer(storageKey(SEG_PLAN_KEY), null), respuestas: segLeer(storageKey(SEG_RESPUESTAS_KEY), {}) };
    segEscribir(storageKey(SEG_PLAN_KEY), null);
    segRepintar("[data-seg-guardar]");
    globalThis.FinanceMedidor?.anotar("seguimiento-plan", "descarte");
    if (typeof showUndoToast === "function") {
      showUndoToast("Plan de deuda sin seguimiento.", () => {
        segEscribir(storageKey(SEG_PLAN_KEY), antes.plan);
        segEscribir(storageKey(SEG_RESPUESTAS_KEY), antes.respuestas);
        segRepintar();
      });
    }
    return;
  }
  const responder = t.closest("[data-seg-responder]");
  if (responder) return segResponder(responder.dataset.segMes, { tipo: responder.dataset.segResponder });
  if (t.closest("[data-seg-otra]")) {
    segOtraAbierta = !segOtraAbierta;
    segRepintar(segOtraAbierta ? "#segOtraImporte" : "[data-seg-otra]");
    return;
  }
  if (t.closest("[data-seg-otra-guardar]")) {
    const campo = qs("segOtraImporte");
    const importe = Number(String(campo?.value || "").replace(",", "."));
    if (!Number.isFinite(importe) || importe < 0) {
      campo?.setAttribute("aria-invalid", "true");
      campo?.focus();
      return;
    }
    const mes = qs("planSeguimiento")?.querySelector("[data-seg-otra]")?.dataset.segMes;
    if (mes) segResponder(mes, { tipo: "otra", importe });
    return;
  }
  const noEra = t.closest("[data-seg-no-era]");
  if (noEra) segResponder(noEra.dataset.segMes, { tipo: "no-era" });
}

// En Hoy, en «Decidir esta semana»: el mes sin encontrar, con su enlace a Deuda › Plan. Puerta de fecha (D-N30, un cambio de Hoy por
// semana: el 30/11 DEC-23, el 7/12 UND-06, el 14/12 UND-08, el 21/12 los extractos atrasados de DUO-04): desde el 28/12.
// D-N39 (24/11): adelantada; antes, 28/12 (antes, un cambio de Hoy por semana, D-N30).
const SEG_HOY_DESDE = "2026-11-24";

function seguimientoPlanHoy(hoy = isoLocalDate(new Date())) {
  try {
    if (String(hoy) < SEG_HOY_DESDE || !globalThis.FinanceSeguimientoPlanDeuda) return [];
    const compromiso = segLeer(storageKey(SEG_PLAN_KEY), null);
    if (!compromiso) return [];
    const contratos = typeof escenarioMotorDebtOptions === "function" ? escenarioMotorDebtOptions() : [];
    const seg = segSeguimiento(compromiso, contratos);
    const p = seg?.ok ? seg.pregunta : null;
    if (!p) return [];
    return [{
      title: `¿Pusisteis de más en ${p.label} en ${segMesTexto(p.mes, true)}?`,
      text: `Tocaba ${money(p.previsto, true)} y no lo he encontrado en los extractos. Contestadlo en Deuda › Plan.`,
      status: "warn",
      target: "deuda-ruta",
      cta: "Contestar",
    }];
  } catch {
    return [];
  }
}

globalThis.renderSeguimientoPlan = renderSeguimientoPlan;
globalThis.seguimientoPlanHoy = seguimientoPlanHoy;
