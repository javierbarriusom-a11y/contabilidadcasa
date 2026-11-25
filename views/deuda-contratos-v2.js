/**
 * views/deuda-contratos-v2.js · TRE-D4 (decimotercera auditoría §2.5; auditoría de diseño §5.2, PR 4; referencia `DeudaTREContratos`).
 *
 * Deuda › Contratos con el diseño nuevo, de arriba abajo:
 *   - una línea con lo vivo (cuántos, cuánto, la cuota) y «Añadir un contrato» / «Pegar varios» (el alta de siempre, en el detalle);
 *   - «Faltan N datos»: solo lo que mueve cifras y se puede escribir aquí (TAE, cuota, capital inicial), cada uno con su porqué, y
 *     «Completar ahora · 1 de N», que abre la ficha en ese campo y pasa al siguiente al guardar. La insignia de siempre («Faltan 4
 *     datos») cuenta campos de calidad que esta pantalla no deja escribir (titular, procedencia, vencimiento…): no se repite aquí;
 *   - una tarjeta por contrato, en el orden del plan, con lo que debe, la TAE, la cuota, el % pagado y «fuera en …» con el plan, sus
 *     insignias y «Editar» / «Kit para la entidad»;
 *   - «Herramientas de contratos (n)», plegado: cada herramienta de siempre a un toque, en el detalle;
 *   - «Ver todo el detalle», que enseña lo de siempre (la tabla editable, el alta, las listas de orden y el simulador de consolidación:
 *     D-N41 decide si salen de aquí; hasta entonces, nada se retira).
 * La ficha de edición (`#deudaContratoFicha`): lo básico, plazo y progreso, costes y estado (diez campos), con una vista previa en vivo
 * y «Guardar» explícito con deshacer. Escribe por `handleDeudaContratosFieldChange`, la misma función que la tabla: no hay otra puerta
 * de escritura del contrato. `localStorage["deuda-contratos-v2-modo"] = "anterior"` abre siempre lo de siempre.
 *
 * Script de pantalla: comparte el ámbito global de app.js (qs, escapeHtml, money, round2, debtContractSourceRows, debtContractOverrides…).
 */
(function attachDeudaContratosV2(root) {
  "use strict";

  // Nombre propio: arq6 resuelve las claves de localStorage por el nombre de la constante, y la de Deuda › Plan ya se llama MODO_KEY.
  const MODO_CONTRATOS_KEY = "deuda-contratos-v2-modo";
  const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
  const C = () => root.FinanceComponentesV2 || (typeof require === "function" ? require("./componentes-v2.js") : null);
  const esc = (v) => (typeof escapeHtml === "function" ? escapeHtml(v) : String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]));
  const euros = (v) => (typeof money === "function" ? money(Math.round(Number(v) || 0), true) : `${Math.round(Number(v) || 0)} €`);
  // Redondeo a dos decimales por la mitad hacia arriba: 21,9 × 0,85 es 18,614999… en binario; a 12 cifras es 18,615, y el desplazamiento decimal por exponente («18.615e2» = 1861,5) lo deja en 18,62.
  const pct = (v) => `${String(Math.round(Number(`${Number(Number(v).toPrecision(12))}e2`)) / 100).replace(".", ",")} %`;
  const num = (v) => {
    const n = Number(String(v ?? "").replace(",", ".").trim());
    return String(v ?? "").trim() === "" || !Number.isFinite(n) ? null : n;
  };
  const mesValido = (k) => /^\d{4}-\d{2}$/.test(String(k || ""));
  const mesLargo = (k) => (mesValido(k) ? `${MESES[Number(k.slice(5, 7)) - 1]} de ${k.slice(0, 4)}` : "");
  const vivo = (c) => Number(c?.currentPrincipal) > 0 && c?.paymentStatus !== "settled";

  // --- Lo puro ---------------------------------------------------------------------------------------------------------------------

  /** Lo que falta y mueve cifras, en el orden en que más las mueve (lo que deja una deuda fuera del plan, antes). */
  function faltan(contratos = []) {
    const out = [];
    contratos.filter(vivo).forEach((c) => {
      const entidad = String(c.entity || "este contrato");
      if (c.apr === null || c.apr === undefined || c.apr === "") out.push({ id: String(c.id), entidad, campo: "apr", dato: "la TAE", porque: "sin ella, la deuda no entra en el plan" });
      if (c.paymentStatus === "active" && !(Number(c.currentPayment) > 0)) out.push({ id: String(c.id), entidad, campo: "currentPayment", dato: "la cuota", porque: "sin cuota, la deuda no entra en el plan" });
    });
    contratos.filter(vivo).forEach((c) => {
      if (!(Number(c.initialPrincipal) > Number(c.currentPrincipal))) out.push({ id: String(c.id), entidad: String(c.entity || "este contrato"), campo: "initialPrincipal", dato: "el capital inicial", porque: "para ver el % pagado" });
    });
    return out;
  }

  function faltanFrase(lista) {
    if (!lista.length) return "";
    const porDato = [...new Set(lista.map((f) => f.dato))];
    const porque = porDato.map((dato) => {
      const de = lista.filter((f) => f.dato === dato);
      const quien = de.length === 1 ? `de ${de[0].entidad}` : `de ${de.length} contratos`;
      return `${dato} ${quien} (${de[0].porque})`;
    });
    return { titulo: `${lista.length === 1 ? "Falta 1 dato" : `Faltan ${lista.length} datos`} que mueven las cifras:`, texto: `${porque.join("; ")}.`, datos: porDato };
  }

  /**
   * @param {Array} contratos debtContractSourceRows()
   * @param {object} e
   * @param {Map<string,{fin:string|null, posicion:number}>} e.plan el fin de cada contrato con el plan y su puesto en el orden
   * @param {object} e.comisiones planOptimoComisionesGuardadas(): {id: {pct, promoHasta}}
   * @param {(type:string)=>boolean} e.esRevolving
   */
  function tarjetas(contratos = [], { plan = new Map(), comisiones = {}, esRevolving = () => false } = {}) {
    return contratos
      .map((c) => {
        const id = String(c.id);
        const p = plan.get(id) || null;
        const inicial = Number(c.initialPrincipal) || 0;
        const debe = Math.max(0, Number(c.currentPrincipal) || 0);
        const pagado = inicial > debe ? Math.min(100, Math.round(((inicial - debe) / inicial) * 100)) : null;
        const tae = c.apr === null || c.apr === undefined || c.apr === "" ? null : Number(c.apr);
        const insignias = [];
        if (c.paymentStatus === "settled") insignias.push({ texto: "Liquidada", tono: "ok" });
        if (c.paymentStatus === "suspended") insignias.push({ texto: "Pagos suspendidos", tono: "peligro" });
        if (c.paymentStatus === "reunified") insignias.push({ texto: "Reunificada", tono: "neutro" });
        if (vivo(c) && tae === null) insignias.push({ texto: "Sin TAE", tono: "aviso" });
        if (vivo(c) && tae !== null && esRevolving(c.type)) insignias.push({ texto: "Revolving: revisad la TAE", tono: "aviso" });
        const com = comisiones[id] || {};
        if (Number(com.pct) > 0) insignias.push({ texto: `Comisión ${pct(com.pct)}`, tono: "neutro" });
        if (mesValido(com.promoHasta)) insignias.push({ texto: `Al 0 % hasta ${mesLargo(com.promoHasta)}`, tono: "neutro" });
        if (c.agreement?.status === "accepted") insignias.push({ texto: "Acuerdo aceptado", tono: "ok" });
        return {
          id,
          entidad: String(c.entity || "Contrato"),
          tipo: String(c.type || ""),
          debe,
          tae,
          cuota: Number(c.currentPayment) || 0,
          pagado,
          fin: p?.fin || null,
          posicion: p?.posicion ?? null,
          vivo: vivo(c),
          insignias,
        };
      })
      .sort((a, b) => (a.vivo === b.vivo ? 0 : a.vivo ? -1 : 1) || (a.posicion ?? 99) - (b.posicion ?? 99));
  }

  function resumen(contratos = []) {
    const vivos = contratos.filter(vivo);
    return {
      vivos: vivos.length,
      debe: vivos.reduce((s, c) => s + (Number(c.currentPrincipal) || 0), 0),
      cuota: vivos.filter((c) => c.paymentStatus === "active").reduce((s, c) => s + (Number(c.currentPayment) || 0), 0),
    };
  }

  // Las herramientas de siempre, con su línea de qué hacen y dónde están en el detalle.
  const HERRAMIENTAS = [
    ["#cirbeCard", "Conciliación con la CIRBE", "Lo que ve el Banco de España frente a vuestros contratos"],
    ["#sombraCard", "Deuda en la sombra y TAE real", "Financiaciones en facturas, compras a plazos y aplazamientos"],
    ["#indicesCard", "Índices de referencia", "Euribor, €STR e IPC, con su fecha"],
    ["#revisionTipoCard", "Revisión del tipo variable", "Lo que puede pasar con la hipoteca en su revisión"],
    ["#gob16ClauseWatch", "Vigilancia de cláusulas", "Lo que dice cada contrato y cuándo mirarlo"],
    ["#d5DebtAssetCrossingNote", "Cruce deuda y activos", "Qué posición cancelaría qué deuda"],
    ["#deb13DormantDebtAlert", "Deuda cara dormida", "Deudas caras que llevan tiempo sin moverse"],
    ["#refinanciacionCuotaCard", "La cuota de la refinanciación", "La reunificada: su cuota, cuántas y desde cuándo"],
    // D-N41 (pendiente del hogar): si salen de Contratos. Hasta que se decida, aquí y a dos toques.
    ["#deb5FiscalPriorityNote", "Prioridad ajustada por fiscalidad", "El orden por el coste real tras la deducción"],
    ["#deb16PayoffOrderNote", "Avalancha frente a bola de nieve", "Las dos listas de orden de siempre"],
    ["#deb6SimulateRun", "Simulador de consolidación", "Juntarlas en un préstamo, con sus cifras"],
  ];

  function html(m) {
    const K = C();
    if (!K) return "";
    const cab = `<div class="dcv2-cabeza">
        <h2 class="dcv2-titulo" id="dcv2Titulo">Contratos</h2>
        <p class="dcv2-resumen">${m.resumen.vivos === 1 ? "1 vivo" : `${m.resumen.vivos} vivos`} · ${esc(euros(m.resumen.debe))} · cuota ${esc(euros(m.resumen.cuota))} al mes</p>
        <div class="cv2-acciones">${K.boton({ texto: "+ Añadir un contrato", primario: true, datos: { dcv2: "anadir" } })}${K.boton({ texto: "Pegar varios", datos: { dcv2: "varios" } })}</div>
      </div>`;
    const f = faltanFrase(m.faltan);
    const banda = f ? K.banda({ titulo: f.titulo, texto: f.texto, accion: K.boton({ texto: `Completar ahora · 1 de ${m.faltan.length}`, datos: { dcv2: "completar" } }), atributos: { "data-dcv2-faltan": m.faltan.length } }) : "";
    const tarjetasHtml = m.tarjetas.map((t) => {
      const fin = t.vivo && mesValido(t.fin) ? `con el plan, fuera en <strong>${esc(mesLargo(t.fin))}</strong>` : t.vivo ? "fuera del plan: le falta la cuota o la TAE" : "";
      const pagado = t.pagado !== null ? `${t.pagado} % pagado` : t.vivo ? "% pagado: falta el capital inicial" : "";
      const sub = [t.tipo, t.posicion !== null && t.vivo ? `${t.posicion}.º en el plan` : ""].filter(Boolean).join(" · ");
      return K.tarjeta({
        titulo: t.entidad,
        subtitulo: sub,
        insignias: t.insignias,
        datos: [
          { rotulo: "Debe", valor: euros(t.debe) },
          { rotulo: "TAE", valor: t.tae === null ? "—" : pct(t.tae) },
          { rotulo: "Cuota", valor: t.cuota > 0 ? euros(t.cuota) : "—" },
        ],
        barra: t.pagado !== null ? { pct: t.pagado, etiqueta: `${t.pagado} % pagado` } : null,
        pie: [esc(pagado), fin].filter(Boolean).join(" · "),
        acciones: `${K.boton({ texto: "Editar", datos: { "dcv2-editar": t.id }, etiqueta: `Editar el contrato de ${t.entidad}` })}<button type="button" class="e19-btn e19-btn-secondary deuda-kit-boton" data-kit-entidad="${esc(t.id)}" aria-label="Kit para hablar con ${esc(t.entidad)}">Kit para la entidad</button>`,
        atributos: { "data-dcv2-contrato": t.id },
      });
    });
    const herramientas = K.plegado({
      titulo: "Herramientas de contratos",
      entradas: HERRAMIENTAS.map(([sel, titulo, linea]) => ({ titulo, linea, datos: { "dcv2-herramienta": sel } })),
      atributos: { class: undefined, "data-dcv2-herramientas": "" },
    });
    return `${cab}${banda}${tarjetasHtml.length ? K.lista(tarjetasHtml, { "aria-labelledby": "dcv2Titulo" }) : '<p class="dpv2-nota">Todavía no hay contratos: dadlos de alta con «Añadir un contrato» o «Pegar varios».</p>'}
      ${herramientas}
      <p class="dpv2-detalle">${K.boton({ texto: "Ver todo el detalle", datos: { dcv2: "detalle" } })}</p>`;
  }

  // --- La ficha (pura: el HTML y la vista previa) -------------------------------------------------------------------------------------

  const CAMPOS = [
    ["basico", "Lo básico", [
      ["entity", "Entidad", "text"], ["type", "Tipo", "text"], ["currentPrincipal", "Capital pendiente (€)", "number"], ["apr", "TAE (%)", "number"], ["currentPayment", "Cuota al mes (€)", "number"],
    ]],
    ["plazo", "Plazo y progreso", [["initialPrincipal", "Capital inicial (€)", "number"], ["remainingInstallments", "Plazos que quedan", "number"], ["number", "Número de contrato", "text"]]],
    ["costes", "Costes", [["fiscalDeductionPct", "Deducción fiscal de los intereses (%)", "number"]]],
    ["estado", "Estado", [["paymentStatus", "Estado", "select"]]],
  ];
  const ESTADOS = [["active", "Activa"], ["suspended", "Pagos suspendidos"], ["reunified", "Reunificada"], ["settled", "Liquidada"]];
  const ERRORES = {
    apr: "La TAE va de 0 a 60 %.",
    fiscalDeductionPct: "La deducción va de 0 a 100 %.",
    remainingInstallments: "Escribe un número de plazos de 0 o más.",
  };

  function valoresDe(c) {
    const n2 = (v) => (Number(v) > 0 ? String(Math.round(Number(v) * 100) / 100) : "");
    return {
      entity: String(c.entity || ""),
      type: String(c.type || ""),
      number: String(c.number || ""),
      currentPrincipal: String(Math.round((Number(c.currentPrincipal) || 0) * 100) / 100),
      apr: c.apr === null || c.apr === undefined ? "" : String(c.apr),
      currentPayment: String(Math.round((Number(c.currentPayment) || 0) * 100) / 100),
      // Sin capital inicial de verdad (igual o menor que lo pendiente: nunca se corrigió tras el alta), vacío: es justo el dato que falta.
      initialPrincipal: Number(c.initialPrincipal) > Number(c.currentPrincipal) ? n2(c.initialPrincipal) : "",
      remainingInstallments: Number(c.remainingInstallments) > 0 ? String(Math.floor(Number(c.remainingInstallments))) : "",
      fiscalDeductionPct: Number(c.fiscalDeductionPct) > 0 ? String(c.fiscalDeductionPct) : "",
      paymentStatus: String(c.paymentStatus || "active"),
    };
  }

  /** La vista previa de la ficha con lo escrito (sin guardar): % pagado, en cuántos meses acaba solo con su cuota, la TAE tras la deducción y el estado. */
  function previa(v, { hoy = "2026-11", plazo = null } = {}) {
    const debe = num(v.currentPrincipal) ?? 0;
    const inicial = num(v.initialPrincipal);
    const cuota = num(v.currentPayment) ?? 0;
    const tae = num(v.apr);
    const ded = num(v.fiscalDeductionPct) ?? 0;
    const partes = [];
    const nombre = [v.entity, v.type, v.number ? `nº ${v.number}` : ""].filter((x) => String(x || "").trim()).join(" · ");
    if (v.paymentStatus === "settled") return { nombre, texto: "Liquidada: fuera de la deuda y del plan." };
    if (v.paymentStatus === "suspended") partes.push("pagos suspendidos: fuera del plan hasta que se retomen");
    if (v.paymentStatus === "reunified") partes.push("reunificada: cuenta dentro del préstamo que la sustituye");
    partes.push(inicial !== null && inicial > debe ? `${Math.round(((inicial - debe) / inicial) * 100)} % pagado de ${euros(inicial)}` : "sin capital inicial, sin % pagado");
    const meses = typeof plazo === "function" ? plazo({ currentPrincipal: debe, currentPayment: cuota, apr: tae }) : null;
    if (v.paymentStatus === "active") {
      if (!(cuota > 0)) partes.push("sin cuota: no entra en el plan");
      else if (tae === null) partes.push("sin TAE: no entra en el plan");
      else if (meses === null) partes.push("con esta cuota no baja: no cubre los intereses");
      else {
        const [y, m] = hoy.split("-").map(Number);
        const i = y * 12 + (m - 1) + meses;
        partes.push(`solo con su cuota, acabada en ${meses} ${meses === 1 ? "mes" : "meses"} (${mesLargo(`${Math.floor(i / 12)}-${String((i % 12) + 1).padStart(2, "0")}`)})`);
      }
    }
    // Los plazos del contrato, al lado de lo que sale de capital, cuota y TAE: si no cuadran, aquí se ve (lo que destapó TRE-D0).
    const plazos = num(v.remainingInstallments);
    if (v.paymentStatus === "active" && plazos > 0) {
      const [y, m] = hoy.split("-").map(Number);
      const i = y * 12 + (m - 1) + Math.floor(plazos);
      partes.push(`según el contrato, ${Math.floor(plazos) === 1 ? "queda 1 plazo" : `quedan ${Math.floor(plazos)} plazos`} (hasta ${mesLargo(`${Math.floor(i / 12)}-${String((i % 12) + 1).padStart(2, "0")}`)})`);
    }
    if (tae !== null && ded > 0) partes.push(`TAE tras la deducción: ${pct(tae * (1 - Math.min(100, ded) / 100))}`);
    return { nombre, texto: `${partes.join(" · ")}.` };
  }

  function fichaHtml(c, { recorrido = null } = {}) {
    const K = C();
    const v = valoresDe(c);
    const id = esc(c.id);
    const grupos = CAMPOS.map(([g, titulo, campos]) => `<fieldset class="dcv2-grupo" data-dcv2-grupo="${g}">
        <legend>${esc(titulo)}</legend>
        <div class="dcv2-campos">${campos.map(([campo, rotulo, tipo]) => {
          const input = tipo === "select"
            ? `<select id="dcv2-${campo}" data-dcv2-campo="${campo}">${ESTADOS.map(([val, txt]) => `<option value="${val}"${v[campo] === val ? " selected" : ""}>${esc(txt)}</option>`).join("")}</select>`
            : `<input id="dcv2-${campo}" data-dcv2-campo="${campo}" type="text"${tipo === "number" ? ' inputmode="decimal"' : ""} value="${esc(v[campo])}" autocomplete="off" aria-describedby="dcv2-error-${campo}" />`;
          return `<label class="dcv2-campo" for="dcv2-${campo}"><span>${esc(rotulo)}</span>${input}<small class="dcv2-error" id="dcv2-error-${campo}" data-dcv2-error="${campo}" role="alert" hidden></small></label>`;
        }).join("")}</div>
        ${g === "costes" ? '<p class="dpv2-nota">La comisión por amortizar antes y las promociones al 0 % se escriben en Deuda › Plan › Ajustar el plan › Lo que cambia el coste.</p>' : ""}
      </fieldset>`).join("");
    const fijo = `${recorrido ? `<p class="dcv2-recorrido">Completar · ${recorrido.i} de ${recorrido.n}: ${esc(recorrido.dato)}</p>` : ""}<p class="dpv2-aj-vista" id="dcv2Previa" aria-live="polite"></p>`;
    const pie = `${K.boton({ texto: "Eliminar el contrato", datos: { "dcv2-ficha": "eliminar" } })}${recorrido ? K.boton({ texto: "Saltar", datos: { "dcv2-ficha": "saltar" } }) : ""}${K.boton({ texto: "Guardar", primario: true, datos: { "dcv2-ficha": "guardar" } })}`;
    return K.panel({ idTitulo: "dcv2FichaTitulo", antetitulo: "Deuda · Contrato", titulo: v.entity || "Contrato", cerrar: { "dcv2-ficha": "cerrar" }, fijo, cuerpo: `<form class="dcv2-form" data-dcv2-id="${id}" novalidate>${grupos}</form>`, pie });
  }

  /** Lo que ha cambiado y es válido, y los errores. `parse` es deudaContratosParseFieldValue. */
  function cambios(originales, escritos, parse) {
    const out = [];
    const errores = {};
    Object.keys(escritos).forEach((campo) => {
      const antes = String(originales[campo] ?? "").trim();
      const ahora = String(escritos[campo] ?? "").trim();
      if (antes === ahora) return;
      if (campo !== "paymentStatus" && typeof parse === "function" && parse(campo, ahora).invalid) {
        errores[campo] = ERRORES[campo] || "Escribe un importe de 0 € o más.";
        return;
      }
      out.push({ campo, valor: ahora });
    });
    // El estado, al final: «Liquidada» pone el capital a 0 y no tiene que pisarlo otro cambio.
    out.sort((a, b) => (a.campo === "paymentStatus") - (b.campo === "paymentStatus"));
    return { cambios: out, errores };
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

  const modoAnterior = () => guard(() => root.localStorage.getItem(MODO_CONTRATOS_KEY) === "anterior", false);

  function planPorContrato() {
    const mapa = new Map();
    guard(() => {
      const r = typeof planOptimoResultadoUltimo !== "undefined" && planOptimoResultadoUltimo
        ? planOptimoResultadoUltimo
        : planOptimoCalcular(root.FinanceCanonicalDebtPayoffPath, escenarioMotorDebtOptions(), isoLocalDate(new Date()).slice(0, 7), planOptimoReferencias(), root.FinanceCanonicalDebtOptimalPlan).r;
      const filas = (r?.ok ? r.recommended?.result?.included || [] : []).slice().sort((a, b) => String(a.payoffMonthKey || "9999").localeCompare(String(b.payoffMonthKey || "9999")));
      filas.forEach((row, i) => mapa.set(String(row.id), { fin: row.payoffMonthKey || null, posicion: i + 1 }));
    });
    return mapa;
  }

  function entrada() {
    const contratos = guard(() => debtContractSourceRows(), []) || [];
    return {
      contratos,
      plan: planPorContrato(),
      comisiones: guard(() => planOptimoComisionesGuardadas(), {}) || {},
      esRevolving: (t) => Boolean(guard(() => root.FinanceCanonicalDebtContracts?.isRevolvingType?.(t), false)),
    };
  }

  function modelo(e) {
    return { resumen: resumen(e.contratos), faltan: faltan(e.contratos), tarjetas: tarjetas(e.contratos, e) };
  }

  let fichaId = null;
  let fichaOriginales = null;
  let recorrido = null; // { pendientes: [{id, campo, dato}], i, n }

  const fichaDialogo = () => (typeof qs === "function" ? qs("deudaContratoFicha") : null);

  function escritos() {
    const out = {};
    fichaDialogo()?.querySelectorAll("[data-dcv2-campo]").forEach((el) => { out[el.dataset.dcv2Campo] = el.value; });
    return out;
  }

  function pintarPrevia() {
    const dialog = fichaDialogo();
    const caja = dialog?.querySelector("#dcv2Previa");
    if (!caja) return;
    const p = previa(escritos(), {
      hoy: guard(() => isoLocalDate(new Date()).slice(0, 7), "2026-11"),
      plazo: typeof escenarioMotorPlazoDeducido === "function" ? (c) => guard(() => escenarioMotorPlazoDeducido(c), null) : null,
    });
    caja.innerHTML = `${p.nombre ? `<strong>${esc(p.nombre)}</strong><br />` : ""}${esc(p.texto)}`;
  }

  function abrirFicha(id, { campo = null } = {}) {
    const dialog = fichaDialogo();
    const c = guard(() => debtContractSourceRows(), [])?.find((x) => String(x.id) === String(id));
    if (!dialog || !c || typeof dialog.showModal !== "function") return;
    if (!dialog.dataset.enganchado) {
      dialog.dataset.enganchado = "1";
      dialog.addEventListener("click", onFichaClick);
      dialog.addEventListener("input", (ev) => {
        if (ev.target.matches?.("[data-dcv2-campo]")) {
          const err = dialog.querySelector(`[data-dcv2-error="${ev.target.dataset.dcv2Campo}"]`);
          if (err) err.hidden = true;
          ev.target.removeAttribute("aria-invalid");
          pintarPrevia();
        }
      });
      dialog.addEventListener("change", (ev) => { if (ev.target.matches?.("[data-dcv2-campo]")) pintarPrevia(); });
      dialog.addEventListener("close", () => {
        const volver = fichaId;
        fichaId = null;
        recorrido = null;
        render();
        const caja = qs("deudaContratosV2");
        (caja?.querySelector(`[data-dcv2-editar="${CSS.escape(String(volver || ""))}"]`) || caja?.querySelector('[data-dcv2="completar"]') || caja?.querySelector("h2"))?.focus?.();
      });
      root.addEventListener("hashchange", () => { if (dialog.open) dialog.close(); });
    }
    fichaId = String(c.id);
    fichaOriginales = valoresDe(c);
    const r = recorrido ? { i: recorrido.i + 1, n: recorrido.n, dato: `${recorrido.pendientes[recorrido.i].dato} de ${recorrido.pendientes[recorrido.i].entidad}` } : null;
    dialog.innerHTML = fichaHtml(c, { recorrido: r });
    pintarPrevia();
    if (!dialog.open) dialog.showModal();
    const foco = campo ? dialog.querySelector(`[data-dcv2-campo="${campo}"]`) : null;
    if (foco) foco.focus();
    root.FinanceMedidor?.anotar("deuda-contratos-v2", "vista");
  }

  function guardar() {
    const dialog = fichaDialogo();
    if (!dialog || !fichaId) return false;
    const { cambios: lista, errores } = cambios(fichaOriginales, escritos(), typeof deudaContratosParseFieldValue === "function" ? deudaContratosParseFieldValue : null);
    const malos = Object.keys(errores);
    malos.forEach((campo) => {
      const err = dialog.querySelector(`[data-dcv2-error="${campo}"]`);
      if (err) { err.textContent = errores[campo]; err.hidden = false; }
      dialog.querySelector(`[data-dcv2-campo="${campo}"]`)?.setAttribute("aria-invalid", "true");
    });
    if (malos.length) {
      dialog.querySelector(`[data-dcv2-campo="${malos[0]}"]`)?.focus();
      return false;
    }
    if (!lista.length) return true;
    const antes = guard(() => JSON.parse(JSON.stringify(debtContractOverrides)), null);
    const nombre = escritos().entity || fichaOriginales.entity || "el contrato";
    lista.forEach(({ campo, valor }) => handleDeudaContratosFieldChange({ dataset: { deudaContratoId: fichaId, deudaContratoField: campo }, value: valor }));
    root.FinanceMedidor?.anotar("deuda-contratos-v2", "accion");
    if (antes && typeof showUndoToast === "function") {
      showUndoToast(`Contrato de «${nombre}» guardado.`, () => {
        debtContractOverrides = antes;
        saveDebtContractOverrides();
        renderDeudaContratos();
      });
    }
    return true;
  }

  function siguienteDelRecorrido() {
    if (!recorrido) return false;
    recorrido.i += 1;
    if (recorrido.i >= recorrido.n) return false;
    const p = recorrido.pendientes[recorrido.i];
    abrirFicha(p.id, { campo: p.campo });
    return true;
  }

  function onFichaClick(event) {
    const b = event.target.closest?.("[data-dcv2-ficha]");
    const dialog = fichaDialogo();
    if (!b || !dialog) return;
    const accion = b.dataset.dcv2Ficha;
    if (accion === "cerrar") dialog.close();
    else if (accion === "guardar") {
      if (!guardar()) return;
      if (!siguienteDelRecorrido()) dialog.close();
    } else if (accion === "saltar") {
      if (!siguienteDelRecorrido()) dialog.close();
    } else if (accion === "eliminar") {
      const id = fichaId;
      dialog.close();
      if (typeof handleDeudaContratosRemove === "function") handleDeudaContratosRemove(id);
    }
  }

  function irAlDetalle(selector) {
    guard(() => root.localStorage.setItem(MODO_CONTRATOS_KEY, "anterior"));
    root.FinanceMedidor?.anotar("deuda-contratos-v2", "descarte");
    render();
    // Las herramientas sin id propio se encuentran por lo que pintan: se sube a su tarjeta.
    const dentro = selector ? root.document.querySelector(selector) : null;
    const destino = dentro?.closest?.("article, details") || dentro;
    if (destino?.tagName === "DETAILS") destino.open = true;
    (destino || qs("deuda-contratos"))?.scrollIntoView?.({ block: "start" });
    (destino?.querySelector?.("summary, h3, input, button") || destino)?.focus?.({ preventScroll: true });
  }

  function onClick(event) {
    const t = event.target;
    const editar = t.closest?.("[data-dcv2-editar]");
    if (editar) return abrirFicha(editar.dataset.dcv2Editar);
    const herramienta = t.closest?.("[data-dcv2-herramienta]");
    if (herramienta) return irAlDetalle(herramienta.dataset.dcv2Herramienta);
    const b = t.closest?.("[data-dcv2]");
    if (!b) return;
    const accion = b.dataset.dcv2;
    if (accion === "detalle") irAlDetalle(null);
    else if (accion === "anadir") {
      irAlDetalle(".deuda-contratos-add-card");
      qs("deudaContratosAddEntity")?.focus();
    } else if (accion === "varios") {
      irAlDetalle("#deudaContratosDetectados .deuda-varios");
    } else if (accion === "completar") {
      const pendientes = faltan(guard(() => debtContractSourceRows(), []) || []);
      if (!pendientes.length) return;
      recorrido = { pendientes, i: 0, n: pendientes.length };
      abrirFicha(pendientes[0].id, { campo: pendientes[0].campo });
    } else if (accion === "volver") {
      guard(() => root.localStorage.removeItem(MODO_CONTRATOS_KEY));
      render();
      qs("deudaContratosV2")?.querySelector("h2")?.scrollIntoView?.({ block: "start" });
    }
  }

  function render() {
    const box = typeof qs === "function" ? qs("deudaContratosV2") : null;
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
      if (fichaDialogo()?.open) fichaDialogo().close();
      box.dataset.modo = "anterior";
      box.__html = "";
      box.innerHTML = `<p class="dpv2-volver">Estáis viendo todo el detalle de los contratos. <button type="button" class="e19-btn e19-btn-secondary" data-dcv2="volver">Volver a la vista nueva</button></p>`;
    } else {
      delete box.dataset.modo;
      const nuevo = html(modelo(entrada()));
      if (box.__html !== nuevo) {
        box.innerHTML = nuevo;
        box.__html = nuevo;
      }
      if (!box.__vista) {
        box.__vista = true;
        root.FinanceMedidor?.anotar("deuda-contratos-v2", "vista");
      }
    }
    box.hidden = false;
  }

  const api = { MODO_KEY: MODO_CONTRATOS_KEY, faltan, faltanFrase, tarjetas, resumen, html, modelo, valoresDe, previa, fichaHtml, cambios, HERRAMIENTAS, CAMPOS };
  root.renderDeudaContratosV2 = render;
  root.FinanceDeudaContratosV2 = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
