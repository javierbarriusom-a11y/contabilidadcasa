/**
 * views/deuda-plan-v2.js · TRE-D1 (decimotercera auditoría §2.2; auditoría de diseño del 25/11/2026 §5.2, PR 1; «sigue con TRE-D1» del hogar).
 *
 * Deuda › Plan con el diseño nuevo (referencias `DeudaDesktop.png` y la maqueta `html/DeudaTRE.html`), de arriba abajo:
 *   A · la respuesta: la fecha única de «libres de deuda» (D-N40, `homeDebtOutlook`), lo que os ahorráis y lo que queda;
 *   B · «Este mes»: cuánto y a qué contrato, con «Ya lo he pagado» y «Este mes no puedo» (las mismas respuestas que la pregunta de DUO-D1);
 *   C · «Cómo vais»: los meses del plan guardado, con su forma y la racha; sin plan, «Este es nuestro plan»;
 *   D · el orden: una barra por contrato hasta que se salda con el plan, y rayado lo que se adelanta frente a pagar solo las cuotas;
 *   E · accesos: «Ajustar el plan» abre su panel (TRE-D2: los controles del plan óptimo de siempre, agrupados, con la vista previa
 *       arriba); «Comparar con otras formas» y «Cerrar las deudas saldadas» llevan a su sitio en el detalle.
 * Lee los motores de siempre (el plan óptimo ya calculado, `planOptimoResultadoUltimo`; el camino sin extra; el seguimiento): no calcula
 * nada propio. Todo lo de siempre sigue debajo y vuelve con «Ver todo el detalle» (decisión 5 de ESTADO: no se retira nada en uso).
 * `localStorage["deuda-plan-v2-modo"] = "anterior"` abre siempre lo de siempre (lo usan las pruebas de sus controles). D-N49: con la vista
 * nueva, la tira de cinco cifras no se enseña en esta pantalla (la respuesta ya está en el héroe).
 *
 * Script de pantalla: comparte el ámbito global de app.js (qs, escapeHtml, money, storageGet/Set/Key, isoLocalDate…).
 */
(function attachDeudaPlanV2(root) {
  "use strict";

  const MODO_KEY = "deuda-plan-v2-modo";
  const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
  const FORMA = { hecho: "●", parcial: "◐", no: "○", preguntar: "?", "en-curso": "…", futuro: "·" };
  const esc = (v) => (typeof escapeHtml === "function" ? escapeHtml(v) : String(v ?? ""));
  // A meses o años vista, euros redondos (FX-04: «1.398 €», no «1.398,06 €»).
  const euros = (v) => (typeof money === "function" ? money(Math.round(Number(v) || 0), true) : `${Math.round(v)} €`);

  function mesValido(key) {
    return /^\d{4}-\d{2}$/.test(String(key || ""));
  }

  function mesLargo(key, conDe = true) {
    if (!mesValido(key)) return "";
    const [y, m] = key.split("-").map(Number);
    return `${MESES[m - 1]}${conDe ? " de" : ""} ${y}`;
  }

  function indiceMes(key) {
    const [y, m] = String(key).split("-").map(Number);
    return y * 12 + (m - 1);
  }

  function sumarMeses(key, n) {
    const i = indiceMes(key) + n;
    return `${Math.floor(i / 12)}-${String((i % 12) + 1).padStart(2, "0")}`;
  }

  // --- Lo puro: de lo que ya calculan los motores a lo que se enseña ------------------------------------------------------------------

  /**
   * @param {object} e
   * @param {object} e.outlook homeDebtOutlook(): la fecha única (libreDeDeuda, fuente, fuenteNombre, pendingPrincipal, settled)
   * @param {object|null} e.plan el plan óptimo (canonical-debt-optimal-plan): recommended.summary, recommended.periods, recommended.result, baseline
   * @param {Array} e.contratos los contratos del motor (escenarioMotorDebtOptions)
   * @param {Map<string,string>} e.finBase mes en que acaba cada contrato pagando solo las cuotas (el camino sin extra)
   * @param {object|null} e.seguimiento el de DUO-D1 (filas, racha, hecho, previsto) o null sin plan guardado
   * @param {string} e.hoy AAAA-MM-DD
   */
  function modelo({ outlook, plan, contratos = [], finBase = new Map(), seguimiento = null, hoy, colchon = null }) {
    const vivas = contratos.filter((c) => Number(c?.currentPrincipal) > 0);
    if (!outlook || outlook.settled || !vivas.length) return { vacio: true };
    const mesHoy = String(hoy || "").slice(0, 7);
    const fecha = String(outlook.libreDeDeuda || "").slice(0, 7);
    const s = plan?.ok ? plan.recommended?.summary || {} : {};
    const base = plan?.ok ? plan.baseline || {} : {};
    const fuera = /· /.test(String(outlook.libreDeDeuda || ""));
    const hero = {
      etiqueta: outlook.fuente === "plan-guardado" ? "Con vuestro plan, libres de deuda en" : outlook.fuente === "plan-optimo" ? "Con el plan, libres de deuda en" : "Según los plazos firmados, libres de deuda en",
      fecha: mesValido(fecha) ? mesLargo(fecha) : String(outlook.libreDeDeuda || "sin fecha"),
      nota: [
        s.monthsSaved > 0 && mesValido(base.debtFreeMonthKey) ? `${s.monthsSaved} ${s.monthsSaved === 1 ? "mes" : "meses"} antes que pagando solo las cuotas (${mesLargo(base.debtFreeMonthKey)})` : "",
        outlook.fuente === "plan-guardado" && mesValido(s.debtFreeMonthKey) && s.debtFreeMonthKey !== fecha ? `con los saldos de hoy, ${mesLargo(s.debtFreeMonthKey)}` : "",
        fuera ? "sin contar las deudas que no entran en el plan" : "",
      ].filter(Boolean).join(" · "),
      // TRE-D3 · D-N42: bajo la reserva protegida, el plan reconstruye antes el colchón (y lo dice aquí, en la respuesta).
      colchon: colchon?.activo
        ? `Primero, el colchón: os faltan ${euros(colchon.falta)} para la reserva protegida; ${colchon.reparte ? `hasta ${colchon.hastaMonthKey ? mesLargo(colchon.hastaMonthKey) : "llegar"}, la mitad de lo de más va al colchón y la otra mitad a ${colchon.caras[0].label}` : `hasta ${colchon.hastaMonthKey ? mesLargo(colchon.hastaMonthKey) : "llegar"}, lo de más se queda en la cuenta`}.`
        : "",
      ahorro: Number.isFinite(s.totalSaved) ? s.totalSaved : Number.isFinite(s.interestSaved) ? s.interestSaved : null,
      ahorroNota: Number.isFinite(s.totalInterest) && Number.isFinite(base.totalInterest)
        ? `pagaréis ${euros(s.totalInterest)} de intereses en lugar de ${euros(base.totalInterest)}${s.commissionCost > 0 ? ` (y ${euros(s.commissionCost)} de comisiones)` : ""}`
        : "",
      quedan: vivas.reduce((sum, c) => sum + (Number(c.currentPrincipal) || 0), 0),
      contratos: vivas.length,
    };

    // B · Este mes: el primer tramo del plan (lo de más de este mes y a quién), más las cuotas de hoy.
    const cuotas = vivas.filter((c) => c.paymentStatus === "active").reduce((sum, c) => sum + (Number(c.currentPayment) || 0), 0);
    const tramo = (plan?.ok ? plan.recommended?.periods || [] : []).find((t) => t.fromIndex === 0) || null;
    const extra = tramo ? Number(Array.isArray(tramo.pools) ? tramo.pools[0] ?? tramo.extra : tramo.extra) || 0 : 0;
    const fila = seguimiento?.ok ? seguimiento.filas.find((f) => f.mes === mesHoy) || null : null;
    const siguiente = (plan?.ok ? plan.recommended?.periods || [] : []).find((t) => t.fromIndex > 0 && t.targetId !== tramo?.targetId) || null;
    const alColchonHoy = colchon?.activo ? Number(colchon.alColchonPorMes?.[0]) || 0 : 0;
    const esteMes = {
      alColchon: alColchonHoy,
      mes: mesHoy,
      mesNombre: MESES[Number(mesHoy.slice(5, 7)) - 1] || "",
      total: cuotas + extra,
      cuotas,
      extra,
      destino: tramo ? { id: String(tramo.targetId), label: tramo.targetLabel } : null,
      estado: fila ? fila.estado : null,
      real: fila ? fila.real : null,
      conPlan: Boolean(seguimiento?.ok),
      despues: siguiente && mesValido(plan.startMonthKey) ? `Desde ${mesLargo(sumarMeses(plan.startMonthKey, siguiente.fromIndex))}, lo de más va a ${siguiente.targetLabel}.` : "",
    };

    // C · Cómo vais: los meses ya evaluados y el en curso, con la racha.
    const comoVais = seguimiento?.ok
      ? {
          meses: seguimiento.filas.filter((f) => f.estado !== "futuro").slice(-6).map((f) => ({ mes: f.mes, estado: f.estado })),
          racha: seguimiento.racha,
          hecho: seguimiento.hecho,
          previsto: seguimiento.previsto,
        }
      : null;

    // D · El orden: cada contrato, del de antes al de después según el plan; su fin con el plan y pagando solo las cuotas.
    const filas = (plan?.ok ? plan.recommended?.result?.included || [] : [])
      .map((row) => {
        const c = vivas.find((x) => String(x.id) === String(row.id)) || {};
        return {
          id: String(row.id),
          label: row.label,
          detalle: [euros(Number(c.currentPrincipal) || row.principal || 0), Number.isFinite(row.aprPct) ? `${String(row.aprPct).replace(".", ",")} %` : "", Number(c.currentPayment) > 0 ? `${euros(c.currentPayment)}/mes` : ""].filter(Boolean).join(" · "),
          finPlan: row.payoffMonthKey || null,
          finBase: finBase.get(String(row.id)) || null,
          quita: Boolean(row.settlement),
        };
      })
      .sort((a, b) => String(a.finPlan || "9999").localeCompare(String(b.finPlan || "9999")));
    const fines = filas.flatMap((f) => [f.finPlan, f.finBase]).filter(mesValido);
    const hasta = fines.length ? fines.sort().at(-1) : null;
    const orden = { filas, desde: mesHoy, hasta, estrategia: plan?.ok ? plan.recommended?.strategy : null };

    return { vacio: false, hero, esteMes, comoVais, orden, fuente: outlook.fuente };
  }

  // --- El pintado ------------------------------------------------------------------------------------------------------------------

  function heroHtml(h) {
    const ahorro = h.ahorro === null ? "" : `<div class="dpv2-hero-ahorro"><p class="dpv2-kicker">Os ahorráis en intereses</p><p class="dpv2-cifra-2">${esc(euros(h.ahorro))}</p>${h.ahorroNota ? `<p class="dpv2-nota">${esc(h.ahorroNota)}</p>` : ""}</div>`;
    return `<section class="dpv2-card dpv2-hero" aria-labelledby="dpv2Titulo">
      <h2 class="dpv2-oculto" id="dpv2Titulo">Plan de deuda</h2>
      <div class="dpv2-hero-fecha">
        <p class="dpv2-kicker">${esc(h.etiqueta)}</p>
        <p class="dpv2-cifra" id="dpv2Fecha" data-fecha-libre="unica">${esc(h.fecha.charAt(0).toUpperCase() + h.fecha.slice(1))}</p>
        ${h.nota ? `<p class="dpv2-nota">${esc(h.nota)}</p>` : ""}
        ${h.colchon ? `<p class="dpv2-colchon">${esc(h.colchon)}</p>` : ""}
      </div>${ahorro}
      <p class="dpv2-hero-pie">Quedan <strong>${esc(euros(h.quedan))}</strong> en ${h.contratos} ${h.contratos === 1 ? "contrato" : "contratos"}.</p>
    </section>`;
  }

  function esteMesHtml(m) {
    if (!m.destino && !(m.cuotas > 0)) return "";
    const destino = m.destino && m.extra > 0 ? ` + de más ${esc(euros(m.extra))} → <strong>${esc(m.destino.label)}</strong>` : "";
    const colchon = m.alColchon > 0 ? `<p class="dpv2-nota">Y <strong>${esc(euros(m.alColchon))}</strong> se quedan en la cuenta, para el colchón.</p>` : "";
    let acciones;
    if (!m.conPlan) {
      acciones = `<p class="dpv2-nota">Guardadlo como vuestro plan y la app irá diciendo cómo vais, mes a mes.</p>
        <div class="dpv2-acciones"><button type="button" class="e19-btn e19-btn-primary" data-dpv2="guardar">Este es nuestro plan</button></div>`;
    } else if (m.estado === "hecho") {
      acciones = `<p class="dpv2-estado is-ok">Hecho este mes${m.real > 0 ? `: ${esc(euros(m.real))} de más` : ""}.</p>`;
    } else if (m.estado === "no") {
      acciones = `<p class="dpv2-estado">Este mes, no. El plan sigue el mes que viene.</p>`;
    } else {
      acciones = `<div class="dpv2-acciones"><button type="button" class="e19-btn e19-btn-primary" data-dpv2="pagado">Ya lo he pagado</button><button type="button" class="e19-btn e19-btn-secondary" data-dpv2="no-puedo">Este mes no puedo</button></div>`;
    }
    return `<section class="dpv2-card dpv2-mes" aria-labelledby="dpv2MesTitulo">
      <h3 class="dpv2-kicker" id="dpv2MesTitulo">Este mes · ${esc(m.mesNombre)}</h3>
      <p class="dpv2-mes-cifra"><strong>${esc(euros(m.total))}</strong> <span>cuotas ${esc(euros(m.cuotas))}${destino}</span></p>
      ${colchon}${acciones}
      ${m.despues ? `<p class="dpv2-despues">${esc(m.despues)}</p>` : ""}
    </section>`;
  }

  function comoVaisHtml(c) {
    if (!c) return "";
    const nombres = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
    const meses = c.meses.map((f) => `<li data-estado="${esc(f.estado)}"><span aria-hidden="true">${FORMA[f.estado] || "·"}</span>${esc(nombres[Number(f.mes.slice(5, 7)) - 1])}</li>`).join("");
    const racha = c.racha > 1 ? `Racha de ${c.racha} meses.` : c.racha === 1 ? "El último mes, cumplido." : "";
    const cuanto = c.previsto > 0 ? ` ${euros(c.hecho)} de más de ${euros(c.previsto)} previstos.` : "";
    return `<section class="dpv2-card dpv2-vais" aria-labelledby="dpv2VaisTitulo">
      <h3 class="dpv2-kicker" id="dpv2VaisTitulo">Cómo vais</h3>
      <ol class="dpv2-meses" aria-label="Lo de más de cada mes: ● hecho, ◐ parcial, ○ no, ? sin encontrar, … en curso">${meses}</ol>
      ${racha || cuanto ? `<p class="dpv2-nota"><strong>${esc(racha)}</strong>${esc(cuanto)}</p>` : ""}
    </section>`;
  }

  function ordenHtml(o) {
    if (!o.filas.length || !o.hasta) return "";
    const ini = indiceMes(o.desde);
    const total = Math.max(1, indiceMes(o.hasta) - ini + 1);
    const pct = (key) => Math.max(1.5, Math.min(100, ((indiceMes(key) - ini + 1) / total) * 100));
    const anos = [];
    for (let y = Number(o.desde.slice(0, 4)) + 1; y <= Number(o.hasta.slice(0, 4)); y += 1) anos.push(`<span style="left:${((indiceMes(`${y}-01`) - ini) / total) * 100}%">${y}</span>`);
    const filas = o.filas.map((f) => {
      const plan = mesValido(f.finPlan) ? pct(f.finPlan) : 100;
      const baseFin = mesValido(f.finBase) ? pct(f.finBase) : plan;
      const adelanta = mesValido(f.finPlan) && mesValido(f.finBase) ? indiceMes(f.finBase) - indiceMes(f.finPlan) : 0;
      const frase = mesValido(f.finPlan)
        ? `${f.quita ? "Se cancela con la quita" : "Saldada"} en ${mesLargo(f.finPlan)}${adelanta > 0 ? ` (${adelanta} ${adelanta === 1 ? "mes" : "meses"} antes que pagando solo las cuotas)` : ""}.`
        : "No acaba dentro del horizonte del plan.";
      return `<li class="dpv2-fila">
        <div class="dpv2-fila-nombre"><strong>${esc(f.label)}</strong><span>${esc(f.detalle)}</span></div>
        <div class="dpv2-barra" role="img" aria-label="${esc(frase)}"><span class="dpv2-barra-plan" style="width:${plan}%"></span>${baseFin > plan ? `<span class="dpv2-barra-adelanto" style="left:${plan}%;width:${baseFin - plan}%"></span>` : ""}</div>
        <p class="dpv2-fila-frase">${esc(frase)}</p>
      </li>`;
    }).join("");
    const como = o.estrategia === "bola-nieve" ? "La más pequeña primero" : "La más cara primero";
    return `<section class="dpv2-card dpv2-orden" aria-labelledby="dpv2OrdenTitulo">
      <h3 class="dpv2-titulo" id="dpv2OrdenTitulo">El orden</h3>
      <p class="dpv2-nota">${como}; cada cuota que se libera pasa a la siguiente.</p>
      <div class="dpv2-eje" aria-hidden="true">${anos.join("")}</div>
      <ol class="dpv2-filas">${filas}</ol>
      <p class="dpv2-leyenda" aria-hidden="true"><span class="dpv2-l-plan"></span>con el plan <span class="dpv2-l-adelanto"></span>lo que adelantáis frente a pagar solo las cuotas</p>
    </section>`;
  }

  function accesosHtml(m, resumenAjustes) {
    const filas = [
      ["ajustar", "Ajustar el plan", resumenAjustes || "Cuánto al mes, el orden, pago inicial, comisiones y quitas"],
      ["comparar", "Comparar con otras formas", "Solo las cuotas · bola de nieve · consolidar · liquidar con caja · no tocar nada"],
      ["cerrar", "Cerrar las deudas saldadas", "Carta de saldo cero, ficheros y CIRBE de cada deuda que acabéis"],
    ];
    return `<nav class="dpv2-card dpv2-accesos" aria-label="Más del plan">${filas
      .map(([id, titulo, sub]) => `<button type="button" class="dpv2-acceso" data-dpv2="${id}"><span><strong>${esc(titulo)}</strong><small>${esc(sub)}</small></span><span aria-hidden="true">›</span></button>`)
      .join("")}</nav>`;
  }

  function html(m, resumenAjustes = "") {
    if (m.vacio) return "";
    return `${heroHtml(m.hero)}
      <div class="dpv2-dos${m.comoVais ? "" : " is-solo"}">${esteMesHtml(m.esteMes)}${comoVaisHtml(m.comoVais)}</div>
      ${ordenHtml(m.orden)}
      ${accesosHtml(m, resumenAjustes)}
      <p class="dpv2-detalle"><button type="button" class="e19-btn e19-btn-secondary" data-dpv2="detalle">Ver todo el detalle</button></p>`;
  }

  // --- TRE-D2 · «Ajustar el plan» (decimotercera auditoría §2.3; auditoría de diseño §5.2, PR 2) ---------------------------------------
  // Lo puro: de lo que ya calculó el plan óptimo a la vista previa y a la nota de cada grupo. La vista previa enseña la fecha *con estos
  // ajustes* (la del plan óptimo que se está tocando), no la fecha única: con un plan guardado, la fecha única es la guardada y no se
  // movería al tocar nada; aquí se ve lo que cambiaría y, al lado, la del plan guardado.

  /**
   * @param {object} e
   * @param {object|null} e.plan el último plan óptimo calculado (planOptimoResultadoUltimo)
   * @param {object|null} e.outlook homeDebtOutlook(), para saber si hay plan guardado y su fecha
   * @param {"prevision"|"fijo"} e.modo
   * @param {number|null} e.fijo el importe fijo al mes
   * @param {boolean} e.coinciden si avalancha y bola de nieve dan lo mismo (planOptimoOrdenesCoinciden)
   */
  function ajustarModelo({ plan, outlook = null, modo = "prevision", fijo = null, coinciden = false }) {
    const guardadoKey = outlook?.fuente === "plan-guardado" ? String(outlook.libreDeDeuda || "").slice(0, 7) : "";
    const guardado = mesValido(guardadoKey) ? guardadoKey : null;
    const mes = modo === "fijo"
      ? `${euros(fijo)} al mes además de las cuotas, todos los meses.`
      : "Cada mes, lo que deje la previsión sin bajar del suelo: los meses de recibos fuertes, menos; los de pagas extra, más.";
    if (!plan?.ok || plan.nothing || plan.sinDatos) {
      const error = plan?.ok === false && plan.error ? String(plan.error)
        : "Con estos ajustes no se puede calcular el plan: ninguna deuda tiene cuota activa con TAE o plazo (se completan en Contratos).";
      return { ok: false, error, mes, orden: "", coste: "", guardado, guardar: guardado ? null : "Este es nuestro plan" };
    }
    const s = plan.recommended?.summary || {};
    const vivo = mesValido(s.debtFreeMonthKey) ? s.debtFreeMonthKey : null;
    const ahorro = Number.isFinite(s.totalSaved) ? s.totalSaved : Number.isFinite(s.interestSaved) ? s.interestSaved : null;
    const difiere = Boolean(guardado) && vivo !== guardado;

    const nombre = (k) => (k === "bola-nieve" ? "La más pequeña primero" : "La más cara primero");
    const usa = plan.recommended?.strategy === "bola-nieve" ? "bola-nieve" : "avalancha";
    const alt = plan.alternative?.summary;
    let orden = "";
    if (coinciden) {
      orden = "Con vuestras deudas, los dos órdenes coinciden: dan la misma fecha y los mismos intereses. Cambiar el orden o el margen no mueve ninguna cifra.";
    } else if (alt && mesValido(alt.debtFreeMonthKey) && vivo) {
      const otro = usa === "bola-nieve" ? "avalancha" : "bola-nieve";
      const intereses = (x) => (Number.isFinite(x?.totalInterest) ? `, ${euros(x.totalInterest)} de intereses` : "");
      orden = `${nombre(usa)} (el que usa el plan): libres en ${mesLargo(vivo)}${intereses(s)}. ${nombre(otro)}: ${mesLargo(alt.debtFreeMonthKey)}${intereses(alt)}.`;
    }

    const coste = [];
    if (s.forgiven > 0) coste.push(`Con las quitas os perdonan ${euros(s.forgiven)}.`);
    if (s.commissionCost > 0) coste.push(`Las comisiones por amortizar antes suman ${euros(s.commissionCost)}, ya restadas de lo que os ahorráis.`);
    (plan.warnings || []).forEach((w) => {
      if (w.id === "comision-quita") coste.push(`La comisión de ${w.label} no cuenta: el plan la cancela con la quita, y una quita no es amortizar.`);
      else if (w.id === "comision-baja" && mesValido(w.desde)) coste.push(`${w.label}: su comisión baja en ${mesLargo(w.desde)}; esperar a esa fecha os ahorraría ${euros(w.ahorro)}.`);
      else if (w.id === "promocion" && mesValido(w.hasta)) {
        coste.push(w.saldada ? `${w.label} se salda antes de que acabe su promoción al 0 % (${mesLargo(w.hasta)}).`
          : Number.isFinite(w.saldoAlAcabar) ? `${w.label}: al acabar su promoción al 0 % (${mesLargo(w.hasta)}) quedarán ${euros(w.saldoAlAcabar)}.` : "");
      }
    });

    return {
      ok: true,
      fecha: vivo ? mesLargo(vivo) : "fuera del horizonte del plan",
      ahorro,
      guardado,
      difiere,
      mes,
      orden,
      coste: coste.filter(Boolean).join(" "),
      // Sin plan guardado: guardarlo. Con uno y otra fecha: sustituirlo (lo hace el seguimiento de DUO-D1, con su deshacer).
      guardar: !guardado ? "Este es nuestro plan" : difiere ? "Guardar estos ajustes como nuestro plan" : null,
    };
  }

  function ajustarVistaHtml(a) {
    if (!a.ok) return esc(a.error);
    const ahorro = a.ahorro === null ? "" : ` · os ahorráis <strong>${esc(euros(a.ahorro))}</strong>`;
    const guardado = a.difiere ? `<span class="dpv2-aj-guardado">Vuestro plan guardado: ${esc(mesLargo(a.guardado))}.</span>` : "";
    return `Con estos ajustes, libres en <strong>${esc(a.fecha)}</strong>${ahorro}.${guardado}`;
  }

  function ajustarChromeHtml() {
    const grupo = (id, titulo, extra = "") => `<section class="dpv2-aj-grupo" aria-labelledby="dpv2Aj-${id}">
        <h3 id="dpv2Aj-${id}">${titulo}</h3>
        <div data-dpv2-hueco="${id}"></div>${extra}
        <p class="dpv2-nota" data-dpv2-aj-nota="${id}"></p>
      </section>`;
    return `<div class="dpv2-aj-in">
      <div class="dpv2-aj-fija">
        <span class="clas-v2-asa" aria-hidden="true"></span>
        <div class="dpv2-aj-cabeza">
          <div><p class="dpv2-kicker">Deuda · Plan</p><h2 id="dpv2AjustarTitulo">Ajustar el plan</h2></div>
          <button type="button" class="e19-btn e19-btn-secondary clas-v2-cerrar" data-dpv2-aj="cerrar" aria-label="Cerrar «Ajustar el plan»">×</button>
        </div>
        <p class="dpv2-aj-vista" id="dpv2AjustarVista" aria-live="polite"></p>
        <button type="button" class="e19-btn e19-btn-secondary dpv2-aj-guardar" data-dpv2-aj="guardar" hidden>Este es nuestro plan</button>
      </div>
      <div data-dpv2-hueco="nota"></div>
      ${grupo("mes", "Cuánto al mes", `<div class="dpv2-aj-pasos" role="group" aria-label="Importe fijo de 50 en 50 euros"><button type="button" class="e19-btn e19-btn-secondary" data-dpv2-aj="menos" aria-label="50 euros menos al mes">− 50 €</button><button type="button" class="e19-btn e19-btn-secondary" data-dpv2-aj="mas" aria-label="50 euros más al mes">+ 50 €</button></div>`)}
      ${grupo("orden", "En qué orden")}
      ${grupo("colchon", "Colchón primero")}
      ${grupo("coste", 'Lo que cambia el coste <span class="dpv2-aj-cuenta" data-dpv2-aj-cuenta></span>')}
      <div class="dpv2-aj-pie">
        <button type="button" class="e19-btn e19-btn-secondary" data-dpv2-aj="restablecer">Restablecer lo recomendado</button>
        <button type="button" class="e19-btn e19-btn-primary" data-dpv2-aj="cerrar">Listo</button>
      </div>
    </div>`;
  }

  // --- Con la app ------------------------------------------------------------------------------------------------------------------

  function guard(fn, fallback = null) {
    try {
      return fn();
    } catch {
      return fallback;
    }
  }

  function modoAnterior() {
    return guard(() => root.localStorage.getItem(MODO_KEY) === "anterior", false);
  }

  function leerJSON(key, fallback) {
    return guard(() => {
      const raw = storageGet(storageKey(key), "");
      return raw ? JSON.parse(raw) : fallback;
    }, fallback);
  }

  function entrada() {
    const contratos = guard(() => escenarioMotorDebtOptions(), []) || [];
    const hoy = isoLocalDate(new Date());
    const engine = root.FinanceCanonicalDebtPayoffPath;
    const finBase = new Map();
    guard(() => {
      const r = engine.project(contratos, { startMonthKey: hoy.slice(0, 7), order: typeof caminoOrder === "function" ? caminoOrder(contratos) : undefined });
      (r.included || []).forEach((row) => { if (row.payoffMonthKey) finBase.set(String(row.id), row.payoffMonthKey); });
    });
    const compromiso = leerJSON("plan-deuda-compromiso", null);
    const S = root.FinanceSeguimientoPlanDeuda;
    const seguimiento = compromiso && S
      ? guard(() => S.seguimiento(compromiso, {
          hoy,
          movimientos: typeof baseData === "object" ? baseData?.transactions || [] : [],
          contratos,
          respuestas: leerJSON("plan-deuda-respuestas", {}),
          lenderOf: root.FinanceCanonicalDebtReceipts?.lenderOf,
        }), null)
      : null;
    return {
      outlook: guard(() => homeDebtOutlook(), null),
      plan: typeof planOptimoResultadoUltimo !== "undefined" ? planOptimoResultadoUltimo : null,
      colchon: typeof planOptimoColchonUltimo !== "undefined" ? planOptimoColchonUltimo : null,
      contratos,
      finBase,
      seguimiento,
      hoy,
    };
  }

  function resumenAjustes() {
    return guard(() => {
      const partes = [];
      // El importe que usa el plan: el campo, que el plan rellena con el de partida; `planOptimoMensual` es null hasta que se escribe uno.
      const fijo = Number(String(qs("planOptimoMensual")?.value || "").replace(",", ".")) || (typeof planOptimoMensual === "number" ? planOptimoMensual : 0);
      const modo = typeof planOptimoModo !== "undefined" && planOptimoModo === "fijo" ? `${euros(fijo)} al mes` : "lo que permita la previsión";
      partes.push(modo);
      partes.push(typeof planOptimoOrdenGuardado === "function" && planOptimoOrdenGuardado() === "bola-nieve" ? "la más pequeña primero" : "la más cara primero");
      if (typeof planOptimoPago !== "undefined" && planOptimoPago > 0) partes.push(`pago inicial ${euros(planOptimoPago)}`);
      return partes.join(" · ");
    }, "");
  }

  // TRE-D2: los controles del plan óptimo de siempre se prestan al panel (los mismos nodos: mismos ids, mismos manejadores delegados en
  // `document` y lo guardado de siempre) y vuelven a su sitio al cerrarlo, marcado con un comentario. «@id»: el bloque `.cam-control`
  // que contiene ese campo (importe fijo y pago inicial).
  const AJ_SITIOS = {
    nota: ["planOptimoNota"],
    mes: ["planOptimoModo", "@planOptimoMensual"],
    orden: ["planOptimoOrden", "planOptimoMargen"],
    colchon: ["planOptimoColchonGrupo"],
    coste: ["planOptimoQuitas", "planOptimoComisiones"],
  };
  let ajPrestados = [];
  let ajTocado = false;
  let ajRestableciendo = false;

  const ajDialogo = () => (typeof qs === "function" ? qs("deudaPlanV2Ajustar") : null);

  function ajNodo(ref) {
    return ref.startsWith("@") ? qs(ref.slice(1))?.closest(".cam-control") || null : qs(ref);
  }

  function ajPrestar(dialog) {
    for (const [grupo, refs] of Object.entries(AJ_SITIOS)) {
      const destino = dialog.querySelector(`[data-dpv2-hueco="${grupo}"]`);
      refs.forEach((ref) => {
        const nodo = ajNodo(ref);
        if (!nodo || !destino || dialog.contains(nodo)) return;
        const hueco = root.document.createComment(`dpv2-ajustar ${ref}`);
        nodo.before(hueco);
        destino.append(nodo);
        ajPrestados.push({ nodo, hueco });
      });
    }
  }

  function ajDevolver() {
    ajPrestados.forEach(({ nodo, hueco }) => { if (hueco.parentNode) hueco.replaceWith(nodo); });
    ajPrestados = [];
  }

  function pintarAjustar() {
    const dialog = ajDialogo();
    if (!dialog?.firstElementChild) return;
    const plan = typeof planOptimoResultadoUltimo !== "undefined" ? planOptimoResultadoUltimo : null;
    const modo = typeof planOptimoModo !== "undefined" && planOptimoModo === "fijo" ? "fijo" : "prevision";
    const a = ajustarModelo({
      plan,
      outlook: guard(() => homeDebtOutlook(), null),
      modo,
      fijo: guard(() => Number(String(qs("planOptimoMensual")?.value || "0").replace(",", ".")) || 0, 0),
      coinciden: Boolean(plan?.ok && typeof planOptimoOrdenesCoinciden === "function" && guard(() => planOptimoOrdenesCoinciden(plan), false)),
    });
    dialog.dataset.modo = modo;
    const vista = dialog.querySelector("#dpv2AjustarVista");
    if (vista) vista.innerHTML = ajustarVistaHtml(a);
    ["mes", "orden", "coste"].forEach((id) => {
      const nota = dialog.querySelector(`[data-dpv2-aj-nota="${id}"]`);
      if (nota) nota.textContent = a[id] || "";
    });
    // El contador del grupo de coste: contratos con una quita, una comisión o una promoción escritas.
    const con = new Set();
    dialog.querySelectorAll("input[data-plan-optimo-quita]").forEach((i) => { if (Number(String(i.value).replace(",", ".")) > 0) con.add(i.dataset.planOptimoQuita); });
    dialog.querySelectorAll("input[data-plan-optimo-comision]").forEach((i) => { if (String(i.value || "").trim()) con.add(i.dataset.planOptimoComision); });
    const cuenta = dialog.querySelector("[data-dpv2-aj-cuenta]");
    if (cuenta) cuenta.textContent = con.size ? `(${con.size} ${con.size === 1 ? "contrato" : "contratos"})` : "";
    const guardar = dialog.querySelector('[data-dpv2-aj="guardar"]');
    if (guardar) {
      guardar.hidden = !a.guardar || !qs("planSeguimiento")?.querySelector("[data-seg-guardar]");
      if (a.guardar) guardar.textContent = a.guardar;
    }
  }

  function ajTocar(el, valor, evento = "input") {
    if (!el) return;
    if (el.type === "radio" || el.type === "checkbox") {
      if (el.checked === valor) return;
      el.checked = valor;
    } else {
      if (el.value === valor) return;
      el.value = valor;
    }
    el.dispatchEvent(new Event(evento, { bubbles: true }));
  }

  // «Restablecer lo recomendado»: lo de partida del plan óptimo, por los mismos controles (y lo guardado de siempre). Las quitas, las
  // comisiones y las promociones no se tocan: son datos de vuestros contratos, no preferencias del plan.
  function restablecer() {
    ajRestableciendo = true;
    try {
      ajTocar(root.document.querySelector('input[name="planOptimoModo"][value="prevision"]'), true, "change");
      ajTocar(qs("planOptimoPago"), "0");
      ajTocar(root.document.querySelector('input[name="planOptimoOrden"][value="avalancha"]'), true, "change");
      ajTocar(qs("planOptimoMargenPct"), "3");
      ajTocar(qs("planOptimoMargenAbs"), "150");
      ajTocar(qs("planOptimoColchon"), true, "change");
      ajTocar(qs("planOptimoColchonUmbral"), "15");
    } finally {
      ajRestableciendo = false;
    }
    const nota = qs("planOptimoNota");
    if (nota) nota.textContent = "Lo recomendado: lo que permita la previsión, la más cara primero, sin pago inicial y primero el colchón. Las quitas y las comisiones siguen como las escribisteis.";
    root.FinanceMedidor?.anotar("deuda-ajustar", "descarte");
    pintarAjustar();
  }

  function pasoMensual(delta) {
    const campo = qs("planOptimoMensual");
    if (!campo) return;
    const actual = Number(String(campo.value || "0").replace(",", ".")) || 0;
    ajTocar(campo, String(Math.max(0, Math.round((actual + delta) / 10) * 10)));
  }

  function onAjClick(event) {
    const boton = event.target.closest?.("[data-dpv2-aj]");
    const dialog = ajDialogo();
    if (!boton || !dialog) return;
    const accion = boton.dataset.dpv2Aj;
    if (accion === "cerrar") dialog.close();
    else if (accion === "mas" || accion === "menos") pasoMensual(accion === "mas" ? 50 : -50);
    else if (accion === "restablecer") restablecer();
    else if (accion === "guardar") {
      qs("planSeguimiento")?.querySelector("[data-seg-guardar]")?.click();
      root.FinanceMedidor?.anotar("deuda-plan-v2", "accion");
      dialog.close();
    }
  }

  function onAjCambio() {
    if (ajTocado || ajRestableciendo) return;
    ajTocado = true;
    root.FinanceMedidor?.anotar("deuda-ajustar", "accion");
  }

  function alCerrarAjustar() {
    ajDevolver();
    render();
    qs("deudaPlanV2")?.querySelector('[data-dpv2="ajustar"]')?.focus?.();
  }

  function abrirAjustar() {
    const dialog = ajDialogo();
    if (!dialog || typeof dialog.showModal !== "function") {
      irAlDetalle("#planOptimoCard");
      return;
    }
    if (!dialog.dataset.enganchado) {
      dialog.dataset.enganchado = "1";
      dialog.addEventListener("click", onAjClick);
      dialog.addEventListener("input", onAjCambio);
      dialog.addEventListener("change", onAjCambio);
      dialog.addEventListener("close", alCerrarAjustar);
      root.addEventListener("hashchange", () => { if (dialog.open) dialog.close(); });
    }
    if (!dialog.firstElementChild) dialog.innerHTML = ajustarChromeHtml();
    ajPrestar(dialog);
    ajTocado = false;
    pintarAjustar();
    // En el escritorio el panel deja a la vista la columna de la izquierda: que sea el héroe, que cambia con cada ajuste.
    if ((root.innerWidth || 0) >= 1024) qs("deudaPlanV2")?.querySelector(".dpv2-hero")?.scrollIntoView?.({ block: "start" });
    if (!dialog.open) dialog.showModal();
    root.FinanceMedidor?.anotar("deuda-ajustar", "vista");
  }

  // Desde el repintado (lo de siempre, otro tema o sin deudas): los controles vuelven ya, sin esperar al «close», que llega después.
  function cerrarAjustarSiAbierto() {
    const dialog = ajDialogo();
    ajDevolver();
    if (dialog?.open) dialog.close();
  }

  function irAlDetalle(selector) {
    guard(() => root.localStorage.setItem(MODO_KEY, "anterior"));
    root.FinanceMedidor?.anotar("deuda-plan-v2", "descarte");
    render();
    const destino = selector ? root.document.querySelector(selector) : null;
    (destino || qs("deudaRutaTitle"))?.scrollIntoView?.({ block: "start" });
    (destino?.querySelector?.("h3, summary, button, input") || destino)?.focus?.({ preventScroll: true });
  }

  function onClick(event) {
    const boton = event.target.closest?.("[data-dpv2]");
    if (!boton) return;
    const accion = boton.dataset.dpv2;
    const mes = isoLocalDate(new Date()).slice(0, 7);
    if (accion === "pagado" || accion === "no-puedo") {
      if (typeof segResponder === "function") segResponder(mes, { tipo: accion === "pagado" ? "si" : "no" });
      root.FinanceMedidor?.anotar("deuda-plan-v2", "accion");
      render();
      qs("deudaPlanV2")?.querySelector(".dpv2-mes")?.focus?.();
    } else if (accion === "guardar") {
      const legado = qs("planSeguimiento")?.querySelector("[data-seg-guardar]");
      if (legado) legado.click();
      root.FinanceMedidor?.anotar("deuda-plan-v2", "accion");
      render();
    } else if (accion === "detalle") irAlDetalle(null);
    else if (accion === "ajustar") abrirAjustar();
    else if (accion === "comparar") irAlDetalle(".deuda-ruta-layout");
    else if (accion === "cerrar") irAlDetalle("#planCierres");
    else if (accion === "volver") {
      guard(() => root.localStorage.removeItem(MODO_KEY));
      render();
      qs("deudaPlanV2")?.querySelector("#dpv2Fecha")?.scrollIntoView?.({ block: "center" });
    }
  }

  function render() {
    const box = typeof qs === "function" ? qs("deudaPlanV2") : null;
    if (!box) return;
    const v2 = root.document.documentElement.dataset.tema === "v2";
    if (!v2) {
      cerrarAjustarSiAbierto();
      box.hidden = true;
      return;
    }
    if (!box.dataset.enganchado) {
      box.dataset.enganchado = "1";
      box.addEventListener("click", onClick);
    }
    const m = modelo(entrada());
    if (m.vacio) {
      cerrarAjustarSiAbierto();
      box.hidden = true;
      box.innerHTML = "";
      return;
    }
    if (modoAnterior()) {
      cerrarAjustarSiAbierto();
      box.dataset.modo = "anterior";
      box.innerHTML = `<p class="dpv2-volver">Estáis viendo todo el detalle del plan. <button type="button" class="e19-btn e19-btn-secondary" data-dpv2="volver">Volver a la vista nueva</button></p>`;
    } else {
      delete box.dataset.modo;
      const nuevo = html(m, resumenAjustes());
      if (box.__html !== nuevo) {
        box.innerHTML = nuevo;
        box.__html = nuevo;
      }
      if (!box.__vista) {
        box.__vista = true;
        root.FinanceMedidor?.anotar("deuda-plan-v2", "vista");
      }
      // TRE-D2: con el panel abierto, cada control que se toca repinta el plan óptimo y, con él, esto: la vista previa del panel también.
      if (ajDialogo()?.open) pintarAjustar();
    }
    box.hidden = false;
  }

  const api = { modelo, html, mesLargo, MODO_KEY, ajustarModelo, ajustarVistaHtml, ajustarChromeHtml, AJ_SITIOS };
  root.renderDeudaPlanV2 = render;
  root.FinanceDeudaPlanV2 = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
