/**
 * views/deuda-simulador-v2.js · SVD-6, fase 1 (18/11/2026, decisión del hogar: «haz la 3 y la 4»).
 *
 * El simulador visual de deuda como pantalla de la app, con el tema v2 (referencias `Deuda.png` y `Taller.png`): cifras arriba,
 * una fila por contrato con su estrategia y lo que da, el acuerdo aceptado, «Lo hemos propuesto», «Desde vuestra última visita» y
 * «Guardar esta estrategia como escenario». Usa el MISMO motor (`legacy-debt-roadmap-engine.js`) y el MISMO estado
 * (`debtRoadmapState`, claves `acct_<id>_<campo>`) que el simulador de siempre (debt-roadmap.html, en el iframe): lo que se elige en
 * uno se ve en el otro, y las cifras son las mismas (la e2e de paridad lo comprueba).
 *
 * Solo con el tema v2 y con contratos reales (sin los de ejemplo «Entidad A/B», que solo entiende el simulador de siempre con sus
 * perfiles). El de siempre sigue entero tras «Ver el simulador anterior» (decisión 5 de docs/rediseno/ESTADO.md: no se retira nada
 * en uso; retirarlo se consulta). Sin titulares nuevos (XGO-01): cada contrato es una fila, no un encabezado.
 */
(function attachSimuladorV2(root) {
  "use strict";

  const CAMPOS = ["strategy", "discount", "start", "lump", "apr", "term", "finance_pct", "extra", "extra_month"];
  const POR_DEFECTO = { strategy: "hold", discount: "0", start: "1", lump: "0", apr: "0", term: "12", finance_pct: "100", extra: "0", extra_month: "1" };
  const ESTRATEGIAS = [
    ["hold", "Esperar"],
    ["settlement", "Quita"],
    ["refi", "Refinanciar"],
    ["hybrid", "Quita + refinanciar"],
  ];
  const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

  const numero = (value, fallback = 0) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  };

  function claveCuenta(id) {
    return `acct_${String(id).replace(/[^a-zA-Z0-9_-]/g, "_")}`;
  }

  function mesTexto(base, offset) {
    const match = String(base || "").match(/^(\d{4})-(\d{2})$/);
    if (!match) return "";
    const index = Number(match[1]) * 12 + Number(match[2]) - 1 + offset;
    return `${MESES[index % 12]} ${Math.floor(index / 12)}`;
  }

  // --- Lo puro: de lo que lee el simulador (modelo de lectura) y lo que guarda (estado) a lo que se enseña -------------------------

  /** Se pinta solo con contratos reales: sin las cuentas fijas de ejemplo («Entidad A/B») y con alguna deuda que simular. */
  function aplica(modelo) {
    if (!modelo || modelo.mode !== "read-only") return false;
    const fijas = modelo.fixedAccounts || {};
    return fijas.cb === "sin-contrato" && fijas.bk === "sin-contrato" && Array.isArray(modelo.extraDebts) && modelo.extraDebts.length > 0;
  }

  /** Lo que el simulador de siempre manda a su motor (currentConfig + accountEntries), con los mismos valores por defecto. */
  function configuracion(modelo, estado = {}) {
    const canon = modelo.canonicalValues || {};
    const cuentas = modelo.extraDebts.map((deuda) => {
      const clave = claveCuenta(deuda.id);
      const valor = (campo) => (estado[`${clave}_${campo}`] ?? POR_DEFECTO[campo]);
      const hoy = deuda.cuotaDeHoy ? { keepPayment: deuda.cuotaDeHoy.payment, keepRate: deuda.cuotaDeHoy.monthlyRate, keepTolerance: deuda.cuotaDeHoy.tolerance } : {};
      return {
        clave,
        deuda,
        bruto: {
          amount: numero(deuda.currentPrincipal),
          strategy: String(valor("strategy")),
          discount: numero(valor("discount")),
          start: numero(valor("start")),
          lump: numero(valor("lump")),
          apr: numero(valor("apr")),
          term: numero(valor("term")),
          financePct: numero(valor("finance_pct")),
          extra: numero(valor("extra")),
          extraMonth: numero(valor("extra_month")),
          ...hoy,
        },
      };
    });
    return {
      months: Math.max(12, Math.round(numero(estado.fc_months, 60) || 60)),
      capacity: numero(canon.monthly ?? estado.monthly, 900),
      preserveCash: numero(estado.preserveCash, 1000),
      liquidity: numero(canon.liquidity ?? estado.liquidity, 9000),
      baseMonth: String(canon.baseMonth || estado.baseMonth || ""),
      cuotasEnPlan: estado.cuotasEnPlan === "si",
      cuentas,
    };
  }

  /** La simulación y lo que se dice de ella: por contrato, cuándo acaba y cuánto paga; en total, fin, pagado, quita y pico. */
  function simular(motor, config) {
    const result = motor.simulate({ months: config.months, capacity: config.capacity, baseMonth: config.baseMonth, cuotasEnPlan: config.cuotasEnPlan, accounts: config.cuentas.map((cuenta) => cuenta.bruto) });
    const filas = result.rows;
    const cuentas = config.cuentas.map((cuenta, i) => {
      const cuentaMotor = result.accounts[i];
      let ultima = 0;
      let pagado = 0;
      filas.forEach((fila, index) => {
        pagado += fila.payments[i] || 0;
        if ((fila.payments[i] || 0) > 0 || (fila.balances[i] || 0) > 0) ultima = index + 1;
      });
      // En «Esperar» sin cuota de hoy el motor no lleva saldo (no paga nada): la deuda sigue entera y no acaba nunca.
      const viva = (cuentaMotor.strategy === "hold" && !cuentaMotor.keep && cuenta.bruto.amount > 0) || (filas.length && (filas[filas.length - 1].balances[i] || 0) > 0);
      return {
        clave: cuenta.clave,
        id: cuenta.deuda.id,
        estrategia: cuentaMotor.strategy,
        cuotaDeHoy: Boolean(cuentaMotor.keep),
        acaba: viva ? null : ultima,
        pagado: Math.round(pagado * 100) / 100,
        quita: cuentaMotor.strategy === "hold" ? 0 : Math.round((cuentaMotor.discountAmount || 0) * 100) / 100,
        cuotaNueva: ["refi", "hybrid"].includes(cuentaMotor.strategy) ? Math.round(cuentaMotor.monthly * 100) / 100 : 0,
      };
    });
    const sinFin = cuentas.some((cuenta) => cuenta.acaba === null);
    return {
      cuentas,
      filas,
      totalPagado: result.totalPaid,
      totalPagoUnico: result.totalLump,
      pico: result.peak,
      duracion: result.durationMonths,
      sinFin,
      quita: Math.round(cuentas.reduce((suma, cuenta) => suma + cuenta.quita, 0) * 100) / 100,
      deuda: Math.round(config.cuentas.reduce((suma, cuenta) => suma + cuenta.bruto.amount, 0) * 100) / 100,
      capacidad: config.capacity,
      fondo: Math.max(0, config.liquidity - config.preserveCash),
    };
  }

  const api = { CAMPOS, POR_DEFECTO, ESTRATEGIAS, claveCuenta, mesTexto, aplica, configuracion, simular };
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.FinanceSimuladorV2 = api;
})(typeof globalThis !== "undefined" ? globalThis : this);

// --- El pintado (solo en la app) ---------------------------------------------------------------------------------------------------

function simV2Modo() {
  try { return localStorage.getItem("simulador-v2-modo") || ""; } catch { return ""; }
}

function simV2Euro(value) {
  return typeof money === "function" ? money(value, true) : `${Math.round(value)} €`;
}

function simV2Estado() {
  return typeof debtRoadmapState === "object" && debtRoadmapState ? debtRoadmapState : {};
}

// Se guarda en el mismo estado que el simulador de siempre. No se le reenvía en cada tecla: su respuesta (el estado que devuelve
// tras aplicarlo) podría llegar después de la tecla siguiente y pisarla. Se le manda al pasar a él («Ver el simulador anterior») y
// cada vez que se entra en la pestaña (el puente lo hace en cada visita).
function simV2Guardar(cambios) {
  debtRoadmapState = { ...simV2Estado(), ...cambios };
  if (typeof queueRemoteSave === "function") queueRemoteSave();
}

function simV2Fin(base, acaba) {
  return acaba ? globalThis.FinanceSimuladorV2.mesTexto(base, acaba - 1) : "";
}

function simV2CifrasHtml(sim, config, modelo) {
  const ruta = modelo.ruta;
  const fin = sim.sinFin ? `más de ${config.months} meses` : simV2Fin(config.baseMonth, sim.duracion);
  const rutaTexto = ruta?.debtFreeMonthKey ? `Sin cambios (Ruta): ${globalThis.FinanceSimuladorV2.mesTexto(ruta.debtFreeMonthKey, 0)}` : "Sin cambios, Ruta no da fecha";
  const caro = sim.pico > sim.capacidad;
  return `<div class="sim-v2-cifras">
      <div><span>Deuda a simular</span><strong>${simV2Euro(sim.deuda)}</strong><small>${sim.cuentas.length} ${sim.cuentas.length === 1 ? "contrato" : "contratos"}</small></div>
      <div><span>Libre de deuda</span><strong>${escapeHtml(fin)}</strong><small>${escapeHtml(rutaTexto)}</small></div>
      <div><span>Pagaréis en total</span><strong>${simV2Euro(sim.totalPagado)}</strong><small>${sim.quita > 0 ? `${simV2Euro(sim.quita)} de quita` : "sin quita"}</small></div>
      <div class="${caro ? "is-alerta" : ""}"><span>El mes más caro</span><strong>${simV2Euro(sim.pico)}</strong><small>${caro ? "más que" : "dentro de"} la capacidad (${simV2Euro(sim.capacidad)} al mes)</small></div>
    </div>`;
}

function simV2CuentaHtml(cuenta, deuda, resultado, config, estado) {
  const v2 = globalThis.FinanceSimuladorV2;
  const clave = cuenta.clave;
  const valor = (campo) => escapeHtml(String(estado[`${clave}_${campo}`] ?? v2.POR_DEFECTO[campo]));
  const estrategia = resultado.estrategia;
  const nombre = escapeHtml([deuda.entity, deuda.type].filter(Boolean).join(" · "));
  const hechos = [
    deuda.currentPayment ? `cuota ${simV2Euro(deuda.currentPayment)}` : "sin cuota",
    deuda.apr === null || deuda.apr === undefined ? "TAE por confirmar" : `TAE ${String(deuda.apr).replace(".", ",")} %`,
    deuda.remainingInstallments ? `${deuda.remainingInstallments} cuotas` : "",
  ].filter(Boolean).join(" · ");
  const opciones = v2.ESTRATEGIAS.map(([id, texto]) => `<label class="sim-v2-opcion"><input type="radio" name="${clave}_strategy" value="${id}" data-sim-v2-campo="${clave}_strategy"${id === estrategia ? " checked" : ""} /> ${escapeHtml(texto)}</label>`).join("");
  const campo = (id, texto, extra = "") => `<label class="sim-v2-campo">${escapeHtml(texto)}<input type="number" inputmode="decimal" data-sim-v2-campo="${clave}_${id}" value="${valor(id)}" ${extra} /></label>`;
  const campos = estrategia === "hold" ? "" : `<div class="sim-v2-campos">
      ${campo("discount", "Quita (%)", 'min="0" max="100"')}
      ${campo("start", "Mes de inicio", 'min="1"')}
      ${campo("lump", "Pago único (€)", 'min="0"')}
      ${["refi", "hybrid"].includes(estrategia) ? `${campo("apr", "TAE de la refinanciación (%)", 'min="0"')}${campo("term", "Plazo (meses)", 'min="1"')}${campo("finance_pct", "% de lo que queda a financiar", 'min="0" max="100"')}` : ""}
    </div>`;
  const ancho = resultado.acaba ? Math.max(4, Math.min(100, Math.round((resultado.acaba / Math.max(1, config.months)) * 100))) : 100;
  return `<div class="sim-v2-cuenta" data-sim-v2-cuenta="${escapeHtml(clave)}">
      <p class="sim-v2-cuenta-cabeza"><strong>${nombre}</strong><span>${simV2Euro(deuda.currentPrincipal)}</span></p>
      <p class="sim-v2-cuenta-hechos">De Contratos: ${escapeHtml(hechos)}</p>
      <fieldset class="sim-v2-estrategia"><legend class="sr-only">Estrategia para ${nombre}</legend>${opciones}</fieldset>
      ${campos}
      <div class="sim-v2-barra${resultado.acaba ? "" : " is-sin-fin"}" aria-hidden="true"><span style="width:${ancho}%"></span></div>
      <p class="sim-v2-resultado" data-sim-v2-resultado="${escapeHtml(clave)}">${simV2ResultadoTexto(resultado, config)}</p>
      ${simV2AcuerdoHtml(clave, deuda, estado, estrategia)}
    </div>`;
}

function simV2ResultadoTexto(resultado, config) {
  const fin = simV2Fin(config.baseMonth, resultado.acaba);
  if (resultado.estrategia === "hold") {
    if (!resultado.cuotaDeHoy) return "Esperar, sin cuota de hoy: no se paga nada y la deuda no baja (no entra en Ruta).";
    return resultado.acaba ? `Esperar con la cuota de hoy: acaba en ${escapeHtml(fin)} y paga ${simV2Euro(resultado.pagado)}.` : `Esperar con la cuota de hoy: no acaba en ${config.months} meses.`;
  }
  const quita = resultado.quita > 0 ? `, con ${simV2Euro(resultado.quita)} de quita` : "";
  const cuota = resultado.cuotaNueva > 0 ? ` Cuota nueva: ${simV2Euro(resultado.cuotaNueva)} al mes.` : "";
  return resultado.acaba ? `Acaba en ${escapeHtml(fin)} y paga ${simV2Euro(resultado.pagado)}${quita}.${cuota}` : `No acaba en ${config.months} meses.${cuota}`;
}

function simV2AcuerdoHtml(clave, deuda, estado, estrategia) {
  const acuerdo = deuda.acuerdo;
  if (acuerdo) {
    const partes = [];
    if (acuerdo.settlementAmount > 0) partes.push(`pago de ${simV2Euro(acuerdo.settlementAmount)}`);
    if (acuerdo.payment > 0 && acuerdo.duration > 0) partes.push(`${acuerdo.duration} cuotas de ${simV2Euro(acuerdo.payment)}`);
    const seguimiento = acuerdo.seguimiento || {};
    const nota = seguimiento.plan === "sin-decision" ? " Ojo: su pago ya no está en el plan (vuelve a apuntarlo en Deuda › Contratos)."
      : seguimiento.estado === "cumplido" ? " El pago ya sale en el extracto: márcalo como liquidado en Deuda › Contratos."
        : seguimiento.estado === "sin-pago" ? " El mes del pago ya pasó y no se ve en los extractos." : "";
    return `<p class="sim-v2-acuerdo" data-sim-v2-acuerdo-aplicado="${escapeHtml(clave)}"><strong>Acuerdo aceptado y aplicado:</strong> ${escapeHtml(partes.join(" + "))}${acuerdo.startMonth ? ` desde ${escapeHtml(globalThis.FinanceSimuladorV2.mesTexto(acuerdo.startMonth, 0))}` : ""}.${escapeHtml(nota)}</p>`;
  }
  const propuesta = estado[`${clave}_propuesta`];
  const respuesta = estado[`${clave}_respuesta`];
  const hoy = typeof isoLocalDate === "function" ? isoLocalDate(new Date()) : "";
  const en14 = (() => { const d = new Date(); d.setDate(d.getDate() + 14); return typeof isoLocalDate === "function" ? isoLocalDate(d) : ""; })();
  const corta = (iso) => String(iso || "").split("-").reverse().join("/");
  const propuestaHtml = propuesta
    ? `<p class="sim-v2-propuesta">Propuesto a la entidad el ${escapeHtml(corta(propuesta))}${respuesta ? `; contestan antes del ${escapeHtml(corta(respuesta))} (sale en Hoy y en el calendario)` : ""}. <button type="button" class="e19-btn e19-btn-secondary" data-sim-v2-propuesta-quitar="${escapeHtml(clave)}">Ya no está propuesto</button></p>`
    : `<details class="sim-v2-propuesta"><summary>Lo hemos propuesto a la entidad</summary>
        <label>Propuesto el <input type="date" data-sim-v2-propuesta="${escapeHtml(clave)}" value="${escapeHtml(hoy)}" /></label>
        <label>Contestan antes del <input type="date" data-sim-v2-respuesta="${escapeHtml(clave)}" value="${escapeHtml(en14)}" /></label>
        <button type="button" class="e19-btn e19-btn-secondary" data-sim-v2-propuesta-guardar="${escapeHtml(clave)}">Guardar la propuesta</button>
      </details>`;
  // Con «Esperar» no hay acuerdo que proponer ni aplicar: solo se enseña una propuesta ya apuntada. Secundario: el verde sólido es
  // para la acción principal de la pantalla (decisión 1 del rediseño), y esto se hace una vez por contrato.
  if (estrategia === "hold") return propuesta ? propuestaHtml : "";
  return `${propuestaHtml}
    <p class="sim-v2-aceptar"><button type="button" class="e19-btn e19-btn-secondary" data-sim-v2-aceptado="${escapeHtml(clave)}">La entidad lo ha aceptado: aplicar el acuerdo</button>
    <span role="status" data-sim-v2-aceptado-estado="${escapeHtml(clave)}"></span></p>`;
}

function simV2DesdeVisitaHtml(modelo) {
  const d = modelo.desdeVisita || { items: [] };
  if (!simV2Estado().svdUltimaVisita || !d.items.length) return "";
  const desde = d.since ? ` (${escapeHtml(d.since.split("-").reverse().join("/"))})` : "";
  return `<div class="sim-v2-visita" role="status"><p><strong>Desde vuestra última visita${desde}:</strong></p>
      <ul>${d.items.map((item) => `<li>${escapeHtml(item.text)}</li>`).join("")}</ul>
      <button type="button" class="e19-btn e19-btn-secondary" data-sim-v2-visita-entendido>Entendido</button></div>`;
}

function simV2CuotasPlanTexto(modelo) {
  const p = modelo.cuotasPlan;
  if (!p || !p.conCuota) return "";
  const mes = p.monthLabel || p.monthKey;
  if (p.coverage === "todas") return `Según Plan › Mes (${mes}), las ${p.conCuota} cuotas que se pagan ya están en el plan.`;
  if (p.coverage === "ninguna") return `Según Plan › Mes (${mes}), ninguna de las ${p.conCuota} cuotas está en el plan.`;
  return `Según Plan › Mes (${mes}), ${p.enPlan} de ${p.conCuota} cuotas están en el plan${p.fuera > 0 ? ` (faltan ${simV2Euro(p.fuera)} al mes)` : ""}.`;
}

function simV2MesAMesHtml(sim, config) {
  const hasta = Math.min(sim.filas.length, Math.max(1, sim.duracion || 12));
  const filas = sim.filas.slice(0, hasta).map((fila, index) => `<li><span>${escapeHtml(globalThis.FinanceSimuladorV2.mesTexto(config.baseMonth, index))}</span><span>${simV2Euro(fila.total)}</span><span class="${fila.margin < 0 ? "is-alerta" : ""}">${simV2Euro(fila.margin)}</span></li>`).join("");
  return `<details class="sim-v2-mes-a-mes"><summary>Mes a mes (pagos y margen sobre la capacidad)</summary>
      <ul><li class="sim-v2-mes-cabeza"><span>Mes</span><span>Pagos</span><span>Margen</span></li>${filas}</ul></details>`;
}

function renderDeudaSimuladorV2() {
  const caja = typeof qs === "function" ? qs("deudaSimuladorV2") : null;
  if (!caja) return;
  const v2 = globalThis.FinanceSimuladorV2;
  const motor = globalThis.FinanceLegacyDebtRoadmapEngine;
  const temaV2 = document.documentElement.dataset.tema === "v2";
  const modelo = typeof debtRoadmapCanonicalReadModel === "function" ? debtRoadmapCanonicalReadModel() : null;
  if (!temaV2 || !v2 || !motor || !v2.aplica(modelo)) {
    caja.hidden = true;
    caja.innerHTML = "";
    return;
  }
  caja.hidden = false;
  if (simV2Modo() === "anterior") {
    caja.dataset.modo = "anterior";
    caja.innerHTML = `<p class="sim-v2-volver">Estáis en el simulador de siempre. <button type="button" class="e19-btn e19-btn-secondary" data-sim-v2-modo="nuevo">Volver al simulador nuevo</button></p>`;
    return;
  }
  delete caja.dataset.modo;
  globalThis.FinanceMedidor?.anotar("simulador-v2", "vista"); // XGO-02: días distintos, anotar de más el mismo día no cambia nada
  const estado = simV2Estado();
  const config = v2.configuracion(modelo, estado);
  const sim = v2.simular(motor, config);
  const cuentas = config.cuentas.map((cuenta, i) => simV2CuentaHtml(cuenta, cuenta.deuda, sim.cuentas[i], config, estado)).join("");
  const plan = simV2CuotasPlanTexto(modelo);
  caja.innerHTML = `${simV2DesdeVisitaHtml(modelo)}
    <div data-sim-v2-cifras>${simV2CifrasHtml(sim, config, modelo)}</div>
    <p class="sim-v2-nota"><label><input type="checkbox" data-sim-v2-cuotas-en-plan${config.cuotasEnPlan ? " checked" : ""} /> Las cuotas de hoy ya están en el plan: el margen no las resta otra vez</label>${plan ? ` <span>${escapeHtml(plan)}</span>` : ""}</p>
    <div class="sim-v2-cuentas">${cuentas}</div>
    <div data-sim-v2-mes-a-mes>${simV2MesAMesHtml(sim, config)}</div>
    <p class="sim-v2-acciones"><button type="button" class="e19-btn e19-btn-secondary" data-sim-v2-escenario>Guardar esta estrategia como escenario</button> <span role="status" data-sim-v2-escenario-estado></span></p>
    <p class="sim-v2-volver">¿Necesitáis las demás herramientas (perfiles, ruta ejecutiva, seguimiento, notas)? <button type="button" class="e19-btn e19-btn-secondary" data-sim-v2-modo="anterior">Ver el simulador anterior</button></p>`;
  simV2Enlazar(caja);
}

// Al teclear, solo se recalculan las cifras y los resultados: los campos no se vuelven a pintar (no se pierde el foco).
function simV2Recalcular() {
  const caja = qs("deudaSimuladorV2");
  const v2 = globalThis.FinanceSimuladorV2;
  const modelo = debtRoadmapCanonicalReadModel();
  if (!caja || !v2.aplica(modelo)) return;
  const config = v2.configuracion(modelo, simV2Estado());
  const sim = v2.simular(globalThis.FinanceLegacyDebtRoadmapEngine, config);
  const cifras = caja.querySelector("[data-sim-v2-cifras]");
  if (cifras) cifras.innerHTML = simV2CifrasHtml(sim, config, modelo);
  const mesAMes = caja.querySelector("[data-sim-v2-mes-a-mes]");
  if (mesAMes) mesAMes.innerHTML = simV2MesAMesHtml(sim, config);
  sim.cuentas.forEach((resultado) => {
    const linea = caja.querySelector(`[data-sim-v2-resultado="${resultado.clave}"]`);
    if (linea) linea.innerHTML = simV2ResultadoTexto(resultado, config);
    const barra = caja.querySelector(`[data-sim-v2-cuenta="${resultado.clave}"] .sim-v2-barra`);
    if (barra) {
      barra.classList.toggle("is-sin-fin", !resultado.acaba);
      const ancho = resultado.acaba ? Math.max(4, Math.min(100, Math.round((resultado.acaba / Math.max(1, config.months)) * 100))) : 100;
      barra.firstElementChild.style.width = `${ancho}%`;
    }
  });
}

function simV2Enlazar(caja) {
  if (caja.__simV2Enlazado) return;
  caja.__simV2Enlazado = true;
  caja.addEventListener("input", (event) => {
    const campo = event.target.dataset?.simV2Campo;
    if (!campo || event.target.type === "radio") return;
    simV2Guardar({ [campo]: event.target.value });
    simV2Recalcular();
  });
  caja.addEventListener("change", (event) => {
    const objetivo = event.target;
    if (objetivo.type === "radio" && objetivo.dataset.simV2Campo) {
      simV2Guardar({ [objetivo.dataset.simV2Campo]: objetivo.value });
      renderDeudaSimuladorV2();
      caja.querySelector(`input[name="${objetivo.name}"][value="${objetivo.value}"]`)?.focus();
      return;
    }
    if (objetivo.matches?.("[data-sim-v2-cuotas-en-plan]")) {
      simV2Guardar({ cuotasEnPlan: objetivo.checked ? "si" : "" });
      simV2Recalcular();
    }
  });
  caja.addEventListener("click", (event) => {
    const boton = event.target.closest?.("button");
    if (!boton) return;
    const d = boton.dataset;
    if (d.simV2Modo) {
      try { localStorage.setItem("simulador-v2-modo", d.simV2Modo === "anterior" ? "anterior" : ""); } catch { /* sin almacenamiento */ }
      if (d.simV2Modo === "anterior" && typeof sendDebtRoadmapState === "function") sendDebtRoadmapState();
      if (d.simV2Modo === "anterior") globalThis.FinanceMedidor?.anotar("simulador-v2", "descarte");
      renderDeudaSimuladorV2();
      return;
    }
    if (boton.hasAttribute("data-sim-v2-visita-entendido")) {
      const modelo = debtRoadmapCanonicalReadModel();
      if (modelo?.visitaActual) simV2Guardar({ svdUltimaVisita: modelo.visitaActual });
      renderDeudaSimuladorV2();
      return;
    }
    if (d.simV2Aceptado) {
      const clave = d.simV2Aceptado;
      const estado = simV2Estado();
      const modelo = debtRoadmapCanonicalReadModel();
      const config = globalThis.FinanceSimuladorV2.configuracion(modelo, estado);
      const cuenta = config.cuentas.find((item) => item.clave === clave);
      const built = cuenta ? globalThis.FinanceLegacyDebtRoadmapEngine.buildAccount(cuenta.bruto) : null;
      const resultado = typeof receiveDebtRoadmapAgreement === "function" && built
        ? receiveDebtRoadmapAgreement({ accountKey: clave, account: { strategy: built.strategy, lump: built.lump, monthly: built.monthly, term: built.term, start: built.start }, baseMonth: config.baseMonth, cuotasEnPlan: config.cuotasEnPlan })
        : null;
      if (resultado?.ok) globalThis.FinanceMedidor?.anotar("simulador-v2", "accion");
      const linea = caja.querySelector(`[data-sim-v2-aceptado-estado="${clave}"]`);
      if (linea && resultado) {
        linea.textContent = resultado.message || "";
        linea.classList.toggle("is-alerta", !resultado.ok);
      }
      return;
    }
    if (d.simV2PropuestaGuardar) {
      const clave = d.simV2PropuestaGuardar;
      const propuesta = caja.querySelector(`[data-sim-v2-propuesta="${clave}"]`)?.value || "";
      const respuesta = caja.querySelector(`[data-sim-v2-respuesta="${clave}"]`)?.value || "";
      if (!/^\d{4}-\d{2}-\d{2}$/.test(propuesta)) return;
      simV2Guardar({ [`${clave}_propuesta`]: propuesta, [`${clave}_respuesta`]: /^\d{4}-\d{2}-\d{2}$/.test(respuesta) ? respuesta : "" });
      renderDeudaSimuladorV2();
      return;
    }
    if (d.simV2PropuestaQuitar) {
      const clave = d.simV2PropuestaQuitar;
      const { [`${clave}_propuesta`]: _p, [`${clave}_respuesta`]: _r, ...resto } = simV2Estado();
      debtRoadmapState = resto;
      simV2Guardar({});
      renderDeudaSimuladorV2();
      return;
    }
    if (boton.hasAttribute("data-sim-v2-escenario")) {
      const modelo = debtRoadmapCanonicalReadModel();
      const config = globalThis.FinanceSimuladorV2.configuracion(modelo, simV2Estado());
      const accounts = config.cuentas.map((cuenta) => {
        const a = globalThis.FinanceLegacyDebtRoadmapEngine.buildAccount(cuenta.bruto);
        return { accountKey: cuenta.clave, account: { strategy: a.strategy, lump: a.lump, financed: a.financed, monthly: a.monthly, apr: a.apr, term: a.term, start: a.start } };
      });
      const resultado = typeof receiveDebtRoadmapScenario === "function" ? receiveDebtRoadmapScenario({ accounts, baseMonth: config.baseMonth }) : null;
      if (resultado?.ok) globalThis.FinanceMedidor?.anotar("simulador-v2", "accion");
      const linea = caja.querySelector("[data-sim-v2-escenario-estado]");
      if (linea && resultado) {
        linea.textContent = resultado.message || "";
        linea.classList.toggle("is-alerta", !resultado.ok);
      }
    }
  });
}
