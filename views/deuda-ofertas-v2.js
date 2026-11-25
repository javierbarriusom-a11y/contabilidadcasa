/**
 * views/deuda-ofertas-v2.js · TRE-D5a (decimotercera auditoría §2.5b; auditoría de diseño §5.2, PR 5; referencia `DeudaTREOfertas`).
 *
 * Deuda › Ofertas como bandeja de lo que os ofrecen las entidades o podéis pedirles, cada cosa medida contra vuestro plan:
 *   - una línea: cuántas abiertas, la que más os ahorra y cuándo vence la más próxima;
 *   - una tarjeta por oferta con sus condiciones, cuándo vence (ámbar a menos de 30 días), el **veredicto frente al plan** (el motor de
 *     `canonical-debt-offers.js`: mismo plan, misma salida al mes) y «La letra pequeña»; acciones según lo que el plan puede representar:
 *     una quita se mete en el plan (con deshacer), una reunificación se guarda como escenario (el de siempre, sin aplicar nada) y un
 *     traspaso, cuando lo aceptéis, se apunta en el contrato (su ficha); «No nos interesa» la pasa al historial (con deshacer);
 *   - «Añadir una oferta», con el veredicto en vivo mientras se escribe;
 *   - «Qué podéis pedir», desde vuestros contratos, con el kit para la llamada (UND-13);
 *   - tres accesos: probar a mano (el Simulador visual), la calculadora de préstamo e historial.
 * **Una sola fuente, sin migrar nada:** las quitas se leen de donde ya viven (las de «Ajustar el plan», `plan-optimo-quitas`) y la
 * oferta de reunificación de siempre, de la suya; solo los tipos nuevos se guardan aquí (`deuda-ofertas`, en la copia). Lo de siempre
 * de Ofertas › Comparar (las estrategias, la escalera del próximo euro, «Dinero parado», «Repartir la nómina», la capacidad…) sigue
 * detrás de «Ver todo el detalle»; sacarlo de aquí a su sitio (D-N44) es TRE-D5b.
 *
 * Script de pantalla: comparte el ámbito global de app.js (qs, escapeHtml, money, storageGet/Set/Key, isoLocalDate…).
 */
(function attachDeudaOfertasV2(root) {
  "use strict";

  const MODO_OFERTAS_KEY = "deuda-ofertas-v2-modo";
  const OFERTAS_KEY = "deuda-ofertas";
  const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
  const O = () => root.FinanceCanonicalDebtOffers || (typeof require === "function" ? require("../canonical-debt-offers.js") : null);
  const K = () => root.FinanceComponentesV2 || (typeof require === "function" ? require("./componentes-v2.js") : null);
  const esc = (v) => (typeof escapeHtml === "function" ? escapeHtml(v) : String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]));
  const euros = (v) => (typeof money === "function" ? money(Math.round(Number(v) || 0), true) : `${Math.round(Number(v) || 0)} €`);
  const pct = (v) => `${String(Math.round(Number(`${Number(Number(v).toPrecision(12))}e2`)) / 100).replace(".", ",")} %`;
  const mesValido = (k) => /^\d{4}-\d{2}$/.test(String(k || ""));
  const mesLargo = (k) => (mesValido(k) ? `${MESES[Number(k.slice(5, 7)) - 1]} de ${k.slice(0, 4)}` : "");
  const fechaLarga = (d) => (/^\d{4}-\d{2}-\d{2}$/.test(String(d || "")) ? `${Number(d.slice(8, 10))} de ${MESES[Number(d.slice(5, 7)) - 1]}` : "");
  const num = (v) => {
    const x = Number(String(v ?? "").replace(",", ".").trim());
    return String(v ?? "").trim() === "" || !Number.isFinite(x) ? null : x;
  };

  // --- Lo puro ---------------------------------------------------------------------------------------------------------------------

  /**
   * Todas las ofertas, de sus tres fuentes.
   * @param {object} e
   * @param {Array} e.guardadas las de `deuda-ofertas`
   * @param {Array<{id:string, amount:number, registrada?:boolean}>} e.quitasPlan planOptimoQuitas(contratos): ya en el plan
   * @param {object|null} e.reunificacion la oferta de reunificación de siempre (debtConsolidationOffer), si está completa
   * @param {Array} e.contratos los del motor
   * @param {string} e.hoy AAAA-MM-DD
   */
  function fuentes({ guardadas = [], quitasPlan = [], reunificacion = null, contratos = [], hoy }) {
    const nombre = (id) => {
      const c = contratos.find((x) => String(x.id) === String(id));
      return c ? String(c.entity || c.label || "la deuda") : "";
    };
    // Sin entidad escrita (una quita o un traspaso), la de la deuda: «quita de Banco X», nunca «quita de ».
    const lista = O().normalizar(guardadas, hoy).map((o) => ({ ...o, entidad: o.entidad || nombre(o.contratoId), origen: "aqui" }));
    quitasPlan.forEach((q) => {
      if (lista.some((o) => o.tipo === "quita" && String(o.contratoId) === String(q.id) && o.estado !== "rechazada")) return;
      lista.push({ id: `plan-quita-${q.id}`, tipo: "quita", contratoId: String(q.id), entidad: nombre(q.id), importe: q.amount, estado: "en-plan", origen: q.registrada ? "contrato" : "plan", dias: null });
    });
    if (reunificacion && reunificacion.tin !== null && reunificacion.plazo > 0) {
      const dias = O().diasHasta(reunificacion.expiresAt ? `${reunificacion.expiresAt}-28`.slice(0, 10) : "", hoy);
      lista.push({ id: "reunificacion-de-siempre", tipo: "reunificacion", entidad: "Oferta de reunificación", tin: reunificacion.tin, plazo: reunificacion.plazo, comision: reunificacion.comision || 0, vence: "", estado: dias !== null && dias < 0 ? "vencida" : "abierta", origen: "siempre", dias });
    }
    return lista;
  }

  function condiciones(o, contratos = []) {
    const c = contratos.find((x) => String(x.id) === String(o.contratoId));
    if (o.tipo === "quita") return { titulo: `${o.entidad || c?.entity || "Deuda"} · quita`, para: c ? `Para la deuda de ${c.entity || c.label} (${euros(c.currentPrincipal)})` : "", lineas: [`Pagad ${euros(o.importe)} y se cancela la deuda`] };
    if (o.tipo === "traspaso") {
      const com = c ? Math.round(Number(c.currentPrincipal) * Number(o.comisionPct || 0)) / 100 : 0;
      return { titulo: `${o.entidad || "Tarjeta nueva"} · traspaso`, para: c ? `Para la deuda de ${c.entity || c.label} (${euros(c.currentPrincipal)})` : "", lineas: [`0 % durante ${o.meses} meses; después, ${pct(o.taeDespues || 0)} TAE`, Number(o.comisionPct) > 0 ? `Comisión del traspaso: ${pct(o.comisionPct)} (${euros(com)}), una vez` : "Sin comisión de traspaso"] };
    }
    const vivos = contratos.filter((x) => Number(x.currentPrincipal) > 0);
    const saldos = vivos.reduce((s, x) => s + (Number(x.currentPrincipal) || 0), 0);
    const cuota = O().cuotaPrestamo(saldos + Number(o.comision || 0), o.tin, o.plazo);
    const hoyCuotas = vivos.filter((x) => x.paymentStatus === "active").reduce((s, x) => s + (Number(x.currentPayment) || 0), 0);
    return { titulo: `${o.entidad || "Préstamo nuevo"} · préstamo único`, para: `Junta ${vivos.length === 1 ? "la deuda" : `las ${vivos.length} deudas`} (${euros(saldos)})`, lineas: [`${pct(o.tin)} a ${o.plazo} meses`, Number(o.comision) > 0 ? `Comisión de apertura: ${euros(o.comision)}, financiada` : "Sin comisión de apertura", `Cuota: ${euros(cuota)} al mes en lugar de ${euros(hoyCuotas)}`] };
  }

  /** El veredicto en palabras: el titular (para una quita, el de la mejor forma de pagarla) y las tres líneas. */
  function veredictoTexto(v) {
    const Of = O();
    if (!v?.ok) return { tono: "igual", titular: v?.motivo || "No se puede calcular.", filas: [] };
    const mejor = v.deGolpe && v.deGolpe.tono === "compensa" && v.tono !== "compensa" ? v.deGolpe : v;
    const sufijo = mejor === v.deGolpe ? " pagándola de golpe" : "";
    const mismoMes = mejor.libresOferta === mejor.libresBase;
    const filas = [
      { k: "Libres en", v: `${mesLargo(mejor.libresOferta) || "fuera del horizonte"}${mismoMes ? " · el mismo mes" : mejor.libresBase ? ` · con el plan, ${mesLargo(mejor.libresBase)}` : ""}` },
      // Intereses y comisiones, sin restar lo perdonado (con una quita saldría un «coste» negativo que no se entiende); lo perdonado, aparte.
      { k: "Intereses y comisiones", v: `${euros(mejor.costeOferta + (mejor.perdonado || 0))} frente a ${euros(mejor.costeBase)}` },
    ];
    if (mejor.perdonado > 0) filas.push({ k: "Os perdonan", v: euros(mejor.perdonado) });
    if (v.cuota !== null && v.cuota !== undefined) filas.push({ k: "Cuotas al mes", v: v.extra > 0 ? `${euros(v.cuota)} (${euros(v.extra)} menos; el cálculo los pone de más)` : `${euros(v.cuota)}` });
    const nota = v.promoSaldada ? "La deuda se salda antes de que acabe el 0 %: la TAE de después no llega a aplicarse." : "";
    return { tono: mejor.tono, titular: `${Of.titular(mejor, euros)}${sufijo}`, filas, quita: v.deGolpe ? Of.quitaFrase(v, euros) : "", nota };
  }

  /** «Qué podéis pedir», desde los contratos. */
  function pedir(contratos = [], { comisiones = {}, esRevolving = () => false } = {}) {
    const filas = [];
    contratos.filter((c) => Number(c.currentPrincipal) > 0 && c.paymentStatus !== "settled").forEach((c) => {
      const tae = Number(c.apr);
      if (Number.isFinite(tae) && tae >= 15) {
        filas.push({ id: String(c.id), titulo: `${c.entity || c.label} · ${esRevolving(c.type) ? "tarjeta" : "deuda"} al ${pct(tae)}`, texto: `Pedid pasarla a un préstamo con plazo o un traspaso al 0 %.${esRevolving(c.type) ? " Y revisad la TAE: según la fecha de firma, podría ser un indicio de usura." : ""}` });
      }
      const com = comisiones[String(c.id)];
      if (Number(com?.pct) > 0) filas.push({ id: String(c.id), titulo: `${c.entity || c.label} · comisión del ${pct(com.pct)}`, texto: "Preguntad si la comisión por amortizar antes baja o desaparece pasado cierto plazo." });
      if (c.paymentStatus === "suspended") filas.push({ id: String(c.id), titulo: `${c.entity || c.label} · pagos suspendidos`, texto: "Pedid por escrito un plan de pagos o una quita, y que comuniquen la deuda como regularizada al acabar." });
    });
    filas.push({ id: null, titulo: "Si un mes no llegáis", texto: "Antes del impago: pedid un aplazamiento o una carencia por escrito. Una quita solo suele ofrecerse con la deuda ya en impago, y deja huella en los ficheros." });
    return filas;
  }

  function resumen(abiertas) {
    if (!abiertas.length) return "";
    const conAhorro = abiertas.filter((a) => a.v?.ok).map((a) => ({ a, d: (a.v.deGolpe && a.v.deGolpe.tono === "compensa" && a.v.tono !== "compensa" ? a.v.deGolpe : a.v).diferencia })).filter((x) => x.d > 0).sort((x, y) => y.d - x.d);
    const vence = abiertas.filter((a) => Number.isFinite(a.o.dias) && a.o.dias >= 0).sort((x, y) => x.o.dias - y.o.dias)[0];
    const partes = [`<strong>${abiertas.length === 1 ? "1 abierta" : `${abiertas.length} abiertas`}.</strong>`];
    if (conAhorro.length) partes.push(`La que más os ahorra: <strong>${esc(O().TIPOS[conAhorro[0].a.o.tipo].nombre.toLowerCase())} de ${esc(conAhorro[0].a.o.entidad || "")}, ${esc(euros(conAhorro[0].d))} menos que vuestro plan</strong>.`);
    else partes.push("Ninguna os ahorra frente a vuestro plan.");
    if (vence) partes.push(`Vence ${vence.o.vence ? `el <strong>${esc(fechaLarga(vence.o.vence))}</strong> ` : ""}(en ${vence.o.dias} ${vence.o.dias === 1 ? "día" : "días"}).`);
    return partes.join(" ");
  }

  function tarjetaHtml({ o, v, c }) {
    const Kc = K();
    const T = O().TIPOS[o.tipo];
    const vt = veredictoTexto(v);
    const vence = o.estado === "en-plan" ? { texto: o.origen === "contrato" ? "Registrada en el contrato" : "En vuestro plan", tono: "ok" }
      : Number.isFinite(o.dias) ? { texto: o.dias < 30 ? `Vence en ${o.dias} ${o.dias === 1 ? "día" : "días"}` : `Vence el ${fechaLarga(o.vence)}`, tono: o.dias < 30 ? "aviso" : "neutro" } : null;
    const acciones = [];
    if (o.tipo === "quita" && o.estado !== "en-plan") acciones.push(Kc.boton({ texto: "Meterla en el plan", primario: vt.tono === "compensa", datos: { "dov2-accion": "plan", "dov2-id": o.id } }));
    if (o.tipo === "quita" && o.estado === "en-plan" && (o.origen === "plan" || o.origen === "aqui")) acciones.push(Kc.boton({ texto: "Sacarla del plan", datos: { "dov2-accion": "sacar", "dov2-id": o.id } }));
    if (o.tipo === "reunificacion") acciones.push(Kc.boton({ texto: "Guardarla como escenario", primario: vt.tono === "compensa", datos: { "dov2-accion": "escenario", "dov2-id": o.id } }));
    if (o.tipo === "traspaso") acciones.push(Kc.boton({ texto: "Aceptada: actualizar el contrato", datos: { "dov2-accion": "contrato", "dov2-id": o.id } }));
    if (o.origen === "aqui" && o.estado !== "en-plan") acciones.push(Kc.boton({ texto: "No nos interesa", datos: { "dov2-accion": "rechazar", "dov2-id": o.id } }));
    if (o.contratoId) acciones.push(`<button type="button" class="e19-btn e19-btn-secondary deuda-kit-boton" data-kit-entidad="${esc(o.contratoId)}">Contraoferta</button>`);
    const cond = c;
    return `<li class="dov2-oferta" data-dov2-oferta="${esc(o.id)}" data-tipo="${esc(o.tipo)}">
      <div class="cv2-tarjeta-cabeza"><span class="cv2-insignia">${esc(T.nombre)}</span>${vence ? `<span class="cv2-insignia" data-tono="${vence.tono}">${esc(vence.texto)}</span>` : ""}</div>
      <h3>${esc(cond.titulo)}</h3>
      ${cond.para ? `<p class="dpv2-nota">${esc(cond.para)}</p>` : ""}
      <ul class="dov2-condiciones">${cond.lineas.filter(Boolean).map((l) => `<li>${esc(l)}</li>`).join("")}</ul>
      <div class="dov2-veredicto" data-tono="${esc(vt.tono)}">
        <p class="dov2-titular">${esc(vt.titular)}</p>
        ${vt.filas.length ? `<dl>${vt.filas.map((f) => `<div><dt>${esc(f.k)}</dt><dd>${esc(f.v)}</dd></div>`).join("")}</dl>` : ""}
        ${vt.quita ? `<p class="dpv2-nota">${esc(vt.quita)}</p>` : ""}
        ${vt.nota ? `<p class="dpv2-nota">${esc(vt.nota)}</p>` : ""}
      </div>
      <details class="dov2-letra"><summary>La letra pequeña</summary><p>${esc(T.trampa)}</p></details>
      <div class="cv2-acciones">${acciones.join("")}</div>
    </li>`;
  }

  function html(m) {
    const Kc = K();
    const cab = `<div class="dov2-cabeza">
        <div><h2 class="dcv2-titulo" id="dov2Titulo">Ofertas</h2><p class="dpv2-nota">Lo que os ofrecen las entidades o podéis pedirles, medido contra vuestro plan. Nada se acepta solo.</p></div>
        ${Kc.boton({ texto: "+ Añadir una oferta", primario: true, datos: { dov2: "anadir" } })}
      </div>`;
    const linea = m.resumen ? `<p class="dov2-resumen">${m.resumen}</p>` : "";
    const ofertas = m.abiertas.length
      ? `<ul class="dov2-ofertas" aria-labelledby="dov2Titulo">${m.abiertas.map(tarjetaHtml).join("")}</ul>`
      : '<p class="dov2-vacio">Ahora no tenéis ofertas abiertas. Abajo, lo que podéis pedir a cada entidad.</p>';
    const pedirHtml = `<section class="dpv2-card dov2-pedir" aria-labelledby="dov2PedirTitulo">
        <h3 class="dpv2-titulo" id="dov2PedirTitulo">Qué podéis pedir</h3>
        <p class="dpv2-nota">Sale de vuestros contratos, no de ofertas reales. Cada una lleva a su guion para la llamada y su carta (el kit para la entidad).</p>
        <ul>${m.pedir.map((p) => `<li><div><strong>${esc(p.titulo)}</strong><p>${esc(p.texto)}</p></div>${p.id ? `<button type="button" class="e19-btn e19-btn-secondary deuda-kit-boton" data-kit-entidad="${esc(p.id)}">Preparar la llamada</button>` : ""}</li>`).join("")}</ul>
      </section>`;
    const historialLinea = m.historial.length ? `${m.historial.length} ${m.historial.length === 1 ? "rechazada o vencida" : "rechazadas o vencidas"}: ${m.historial.slice(0, 2).map((h) => `${O().TIPOS[h.tipo].nombre.toLowerCase()} de ${h.entidad || "—"}${h.decididaEl ? `, ${fechaLarga(h.decididaEl)}` : ""}`).join("; ")}` : "Todavía nada: las que digáis que no os interesan quedan aquí, con su fecha (sirve para negociar).";
    const accesos = Kc.plegado({
      titulo: "Probar y recordar",
      abierto: false,
      entradas: [
        { titulo: "Probar a mano", linea: "Por contrato: esperar, quita, refinanciar o los 8 modos de liquidación (el Simulador visual)", datos: { "dov2-ir": "deuda-simulador" } },
        { titulo: "Juntarlas en un préstamo: la calculadora", linea: "Con una oferta que aún no tenéis por escrito (Ofertas › Préstamo)", datos: { "dov2-ir": "deuda-prestamo" } },
        { titulo: "Historial", linea: historialLinea, datos: { "dov2-historial": "" } },
      ],
      atributos: { "data-dov2-accesos": "" },
    });
    const historial = m.historial.length ? `<ul class="dov2-historial" id="dov2Historial" hidden>${m.historial.map((h) => `<li>${esc(O().TIPOS[h.tipo].nombre)} · ${esc(h.entidad || "—")}: ${esc(h.estado === "vencida" ? "vencida" : "no nos interesa")}${h.decididaEl ? ` (${esc(fechaLarga(h.decididaEl))})` : ""}</li>`).join("")}</ul>` : "";
    return `${cab}${linea}${ofertas}${pedirHtml}${accesos}${historial}
      <p class="dpv2-detalle">${Kc.boton({ texto: "Ver todo el detalle", datos: { dov2: "detalle" } })}</p>`;
  }

  // --- «Añadir una oferta» (puro) -----------------------------------------------------------------------------------------------------

  const CAMPOS_TIPO = {
    quita: [["contratoId", "La deuda", "contrato"], ["importe", "Lo que os piden (€)", "num"], ["vence", "Vence el", "date"]],
    traspaso: [["contratoId", "La deuda que pasa", "contrato"], ["entidad", "Entidad de la tarjeta nueva", "text"], ["meses", "Meses al 0 %", "num"], ["taeDespues", "TAE después (%)", "num"], ["comisionPct", "Comisión del traspaso (%)", "num"], ["vence", "Vence el", "date"]],
    reunificacion: [["entidad", "Entidad", "text"], ["tin", "TIN (%)", "num"], ["plazo", "Plazo (meses)", "num"], ["comision", "Comisión de apertura (€)", "num"], ["vence", "Vence el", "date"]],
  };

  function ofertaDeCampos(tipo, valores) {
    const o = { tipo };
    (CAMPOS_TIPO[tipo] || []).forEach(([k, , t]) => { o[k] = t === "num" ? num(valores[k]) : String(valores[k] ?? "").trim(); });
    return o;
  }

  function anadirHtml(tipo, contratos = []) {
    const Kc = K();
    const vivos = contratos.filter((c) => Number(c.currentPrincipal) > 0);
    const chips = Object.entries(O().TIPOS).map(([k, t]) => `<label class="dov2-chip"><input type="radio" name="dov2Tipo" value="${k}"${k === tipo ? " checked" : ""} /> ${esc(t.nombre)}</label>`).join("");
    const campos = (CAMPOS_TIPO[tipo] || []).map(([k, rot, t]) => {
      const id = `dov2-${k}`;
      const input = t === "contrato"
        ? `<select id="${id}" data-dov2-campo="${k}">${vivos.map((c) => `<option value="${esc(c.id)}">${esc(`${c.entity || c.label} (${euros(c.currentPrincipal)})`)}</option>`).join("")}</select>`
        : `<input id="${id}" data-dov2-campo="${k}" type="${t === "date" ? "date" : "text"}"${t === "num" ? ' inputmode="decimal"' : ""} autocomplete="off" />`;
      return `<label class="dcv2-campo" for="${id}"><span>${esc(rot)}</span>${input}</label>`;
    }).join("");
    const fijo = '<p class="dpv2-aj-vista" id="dov2AnadirVista" aria-live="polite"></p>';
    const cuerpo = `<form class="dcv2-form" novalidate><fieldset class="dov2-tipos"><legend>Tipo de oferta</legend>${chips}</fieldset><div class="dcv2-campos">${campos}</div></form>`;
    const pie = `${Kc.boton({ texto: "Cancelar", datos: { "dov2-anadir": "cerrar" } })}${Kc.boton({ texto: "Guardar la oferta", primario: true, datos: { "dov2-anadir": "guardar" } })}`;
    return Kc.panel({ idTitulo: "dov2AnadirTitulo", antetitulo: "Deuda · Ofertas", titulo: "Añadir una oferta", cerrar: { "dov2-anadir": "cerrar" }, fijo, cuerpo, pie });
  }

  // --- Con la app ------------------------------------------------------------------------------------------------------------------

  function guard(fn, fallback = null) {
    try {
      const v = fn();
      return v === undefined ? fallback : v;
    } catch {
      return fallback;
    }
  }

  const modoAnterior = () => guard(() => root.localStorage.getItem(MODO_OFERTAS_KEY) === "anterior", false);
  const leerGuardadas = () => guard(() => JSON.parse(storageGet(storageKey(OFERTAS_KEY), "[]")), []) || [];
  const escribirGuardadas = (lista) => guard(() => storageSet(storageKey(OFERTAS_KEY), JSON.stringify(lista)));

  function calculo() {
    const Path = root.FinanceCanonicalDebtPayoffPath;
    const Plan = root.FinanceCanonicalDebtOptimalPlan;
    const contratos = guard(() => escenarioMotorDebtOptions(), []) || [];
    const hoy = guard(() => isoLocalDate(new Date()), "2026-11-25");
    const refs = guard(() => planOptimoReferencias(), {}) || {};
    const opciones = guard(() => planOptimoCalcular(Path, contratos, hoy.slice(0, 7), refs, Plan).opciones, null);
    return { Path, Plan, contratos, hoy, opciones, disponible: Number.isFinite(refs.available) ? refs.available : null };
  }

  function entrada() {
    const k = calculo();
    const guardadas = leerGuardadas();
    const todas = fuentes({
      guardadas,
      quitasPlan: guard(() => planOptimoQuitas(k.contratos), []) || [],
      reunificacion: guard(() => { const r = debtConsolidationOffer(); return r && r.tin !== null && r.plazo > 0 ? r : null; }, null),
      contratos: k.contratos,
      hoy: k.hoy,
    });
    const vista = todas.filter((o) => o.estado === "abierta" || o.estado === "en-plan").map((o) => ({
      o,
      c: condiciones(o, k.contratos),
      v: k.opciones ? O().veredicto(o, { Plan: k.Plan, Path: k.Path, contratos: k.contratos, opciones: k.opciones, disponible: k.disponible }) : { ok: false, motivo: "Sin plan calculado todavía." },
    }));
    const comisiones = guard(() => planOptimoComisionesGuardadas(), {}) || {};
    const esRevolving = (t) => Boolean(guard(() => root.FinanceCanonicalDebtContracts?.isRevolvingType?.(t), false));
    return {
      abiertas: vista,
      resumen: resumen(vista.filter((x) => x.o.estado === "abierta")),
      pedir: pedir(k.contratos, { comisiones, esRevolving }),
      historial: todas.filter((o) => o.estado === "rechazada" || o.estado === "vencida"),
    };
  }

  // «Añadir una oferta»
  let anadirTipo = "traspaso";
  const anadirDialogo = () => (typeof qs === "function" ? qs("deudaOfertaAnadir") : null);

  function valoresAnadir() {
    const out = {};
    anadirDialogo()?.querySelectorAll("[data-dov2-campo]").forEach((el) => { out[el.dataset.dov2Campo] = el.value; });
    return out;
  }

  function pintarAnadirVista() {
    const caja = anadirDialogo()?.querySelector("#dov2AnadirVista");
    if (!caja) return;
    const k = calculo();
    const o = ofertaDeCampos(anadirTipo, valoresAnadir());
    const v = k.opciones ? O().veredicto(o, { Plan: k.Plan, Path: k.Path, contratos: k.contratos, opciones: k.opciones, disponible: k.disponible }) : null;
    const vt = veredictoTexto(v);
    caja.dataset.tono = vt.tono;
    // De quién es y hasta cuándo, arriba: es la oferta que se está escribiendo (y así cada campo mueve algo que se ve).
    const dias = O().diasHasta(o.vence, k.hoy);
    const quien = [o.entidad, /^\d{4}-\d{2}-\d{2}$/.test(String(o.vence || "")) ? `vence el ${fechaLarga(o.vence)}${dias !== null && dias >= 0 ? ` (en ${dias} ${dias === 1 ? "día" : "días"})` : dias !== null ? " (ya vencida)" : ""}` : ""].filter(Boolean).join(" · ");
    const cabeza = quien ? `${esc(quien)}<br />` : "";
    caja.innerHTML = v?.ok ? `${cabeza}<strong>${esc(vt.titular)}</strong>${vt.filas.length ? `<br />${esc(vt.filas.map((f) => `${f.k}: ${f.v}`).join(" · "))}` : ""}${vt.nota ? `<br />${esc(vt.nota)}` : ""}` : `${cabeza}${esc(v?.motivo || "Escribid las condiciones y aquí sale si os compensa frente a vuestro plan.")}`;
  }

  function abrirAnadir(tipo = anadirTipo) {
    const dialog = anadirDialogo();
    if (!dialog || typeof dialog.showModal !== "function") return;
    anadirTipo = O().TIPOS[tipo] ? tipo : "traspaso";
    if (!dialog.dataset.enganchado) {
      dialog.dataset.enganchado = "1";
      dialog.addEventListener("click", (ev) => {
        const b = ev.target.closest?.("[data-dov2-anadir]");
        if (!b) return;
        if (b.dataset.dov2Anadir === "cerrar") dialog.close();
        else if (b.dataset.dov2Anadir === "guardar") guardarOferta();
      });
      dialog.addEventListener("change", (ev) => {
        if (ev.target.name === "dov2Tipo") abrirAnadir(ev.target.value);
        else pintarAnadirVista();
      });
      dialog.addEventListener("input", () => pintarAnadirVista());
      dialog.addEventListener("close", () => qs("deudaOfertasV2")?.querySelector('[data-dov2="anadir"]')?.focus?.());
      root.addEventListener("hashchange", () => { if (dialog.open) dialog.close(); });
    }
    const contratos = guard(() => escenarioMotorDebtOptions(), []) || [];
    dialog.innerHTML = anadirHtml(anadirTipo, contratos);
    pintarAnadirVista();
    if (!dialog.open) dialog.showModal();
    dialog.querySelector(`input[name="dov2Tipo"][value="${anadirTipo}"]`)?.focus();
  }

  function guardarOferta() {
    const dialog = anadirDialogo();
    const o = ofertaDeCampos(anadirTipo, valoresAnadir());
    const k = calculo();
    const v = k.opciones ? O().veredicto(o, { Plan: k.Plan, Path: k.Path, contratos: k.contratos, opciones: k.opciones }) : null;
    if (!v?.ok) {
      pintarAnadirVista();
      dialog?.querySelector("[data-dov2-campo]")?.focus();
      return;
    }
    const contrato = k.contratos.find((c) => String(c.id) === String(o.contratoId));
    const nueva = { ...o, id: `oferta-${Date.now()}`, entidad: o.entidad || contrato?.entity || "", estado: "abierta", creadaEl: k.hoy };
    escribirGuardadas([...leerGuardadas(), nueva]);
    root.FinanceMedidor?.anotar("deuda-ofertas-v2", "accion");
    dialog?.close();
    render();
  }

  function cambiarEstado(id, estado) {
    const antes = leerGuardadas();
    const hoy = guard(() => isoLocalDate(new Date()), "");
    escribirGuardadas(antes.map((o) => (o.id === id ? { ...o, estado, decididaEl: hoy } : o)));
    render();
    if (typeof showUndoToast === "function") showUndoToast("Oferta pasada al historial.", () => { escribirGuardadas(antes); render(); });
  }

  function quitaAlPlan(oferta, importe) {
    // La oferta guardada aquí cambia de estado con ella (en el plan / abierta); el deshacer devuelve las dos cosas.
    const antesOfertas = leerGuardadas();
    if (oferta.origen === "aqui") escribirGuardadas(antesOfertas.map((o) => (o.id === oferta.id ? { ...o, estado: importe > 0 ? "en-plan" : "abierta" } : o)));
    const antes = guard(() => storageGet(storageKey(PLAN_OPTIMO_QUITAS_KEY), "{}"), "{}");
    const actuales = guard(() => JSON.parse(antes), {}) || {};
    actuales[oferta.contratoId] = importe;
    planOptimoGuardar(PLAN_OPTIMO_QUITAS_KEY, JSON.stringify(actuales));
    guard(() => planOptimoRepintar());
    render();
    if (typeof showUndoToast === "function") {
      showUndoToast(importe > 0 ? "Quita metida en el plan (es una propuesta: aceptarla con la entidad es cosa vuestra)." : "Quita sacada del plan.", () => {
        planOptimoGuardar(PLAN_OPTIMO_QUITAS_KEY, antes);
        escribirGuardadas(antesOfertas);
        guard(() => planOptimoRepintar());
        render();
      });
    }
  }

  function irAlDetalle() {
    guard(() => root.localStorage.setItem(MODO_OFERTAS_KEY, "anterior"));
    root.FinanceMedidor?.anotar("deuda-ofertas-v2", "descarte");
    render();
    qs("deuda-comparar")?.scrollIntoView?.({ block: "start" });
  }

  function onClick(event) {
    const t = event.target;
    const ir = t.closest?.("[data-dov2-ir]");
    if (ir) { root.location.hash = ir.dataset.dov2Ir; return; }
    if (t.closest?.("[data-dov2-historial]")) {
      const h = qs("dov2Historial");
      if (h) { h.hidden = !h.hidden; if (!h.hidden) h.scrollIntoView?.({ block: "nearest" }); }
      return;
    }
    const acc = t.closest?.("[data-dov2-accion]");
    if (acc) {
      const id = acc.dataset.dov2Id;
      const e = entrada();
      const item = e.abiertas.find((x) => x.o.id === id);
      if (!item) return;
      root.FinanceMedidor?.anotar("deuda-ofertas-v2", "accion");
      const a = acc.dataset.dov2Accion;
      if (a === "plan") quitaAlPlan(item.o, Number(item.o.importe) || 0);
      else if (a === "sacar") quitaAlPlan(item.o, 0);
      else if (a === "rechazar") cambiarEstado(id, "rechazada");
      else if (a === "escenario") {
        if (item.o.origen === "siempre" && typeof handleDeudaCompararGuardarComoEscenario === "function") handleDeudaCompararGuardarComoEscenario("consolidar");
        else if (typeof storageSet === "function") {
          // Una reunificación de aquí se guarda como la oferta de siempre (la que lee «Consolidar») y, con ella, como escenario.
          guard(() => storageSet(storageKey(DEBT_CONSOLIDATION_OFFER_KEY), JSON.stringify({ tin: item.o.tin, plazo: item.o.plazo, comision: item.o.comision || 0, expiresAt: String(item.o.vence || "").slice(0, 7) })));
          if (typeof handleDeudaCompararGuardarComoEscenario === "function") handleDeudaCompararGuardarComoEscenario("consolidar");
        }
      } else if (a === "contrato") {
        root.location.hash = "deuda-contratos";
        root.setTimeout?.(() => qs("deudaContratosV2")?.querySelector(`[data-dcv2-editar="${CSS.escape(String(item.o.contratoId))}"]`)?.click(), 300);
      }
      return;
    }
    const b = t.closest?.("[data-dov2]");
    if (!b) return;
    if (b.dataset.dov2 === "anadir") abrirAnadir();
    else if (b.dataset.dov2 === "detalle") irAlDetalle();
    else if (b.dataset.dov2 === "volver") {
      guard(() => root.localStorage.removeItem(MODO_OFERTAS_KEY));
      render();
    }
  }

  function render() {
    const box = typeof qs === "function" ? qs("deudaOfertasV2") : null;
    if (!box) return;
    if (root.document.documentElement.dataset.tema !== "v2") {
      box.hidden = true;
      return;
    }
    if (!box.dataset.enganchado) {
      box.dataset.enganchado = "1";
      box.addEventListener("click", onClick);
    }
    if (modoAnterior()) {
      if (anadirDialogo()?.open) anadirDialogo().close();
      box.dataset.modo = "anterior";
      box.__html = "";
      box.innerHTML = `<p class="dpv2-volver">Estáis viendo todo el detalle de Ofertas. <button type="button" class="e19-btn e19-btn-secondary" data-dov2="volver">Volver a la vista nueva</button></p>`;
    } else {
      delete box.dataset.modo;
      const nuevo = html(entrada());
      if (box.__html !== nuevo) {
        box.innerHTML = nuevo;
        box.__html = nuevo;
      }
      if (!box.__vista) {
        box.__vista = true;
        root.FinanceMedidor?.anotar("deuda-ofertas-v2", "vista");
      }
    }
    box.hidden = false;
  }

  const api = { MODO_KEY: MODO_OFERTAS_KEY, OFERTAS_KEY, fuentes, condiciones, veredictoTexto, pedir, resumen, html, tarjetaHtml, anadirHtml, ofertaDeCampos, CAMPOS_TIPO };
  root.renderDeudaOfertasV2 = render;
  root.FinanceDeudaOfertasV2 = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
