// Rediseño C3 · Cierre (4/11/2026), de `Cierre.png`/`CierreDesktop.png`. Tras el primer cierre real del hogar (entre 30 y 60 minutos,
// lo que más costó fue clasificar; se cierra desde el ordenador). Lo que confundía era el asistente secuencial: tres pasos que se
// abrían uno tras otro, sin decir por qué el siguiente estaba cerrado, y «Firmar» escondido al final. Aquí las tres comprobaciones
// se ven a la vez, cada una con lo que falta y su acción al lado, y a la derecha la confianza del cierre, lo que guarda la firma y
// el botón «Firmar».
// - Mismas reglas que siempre: la firma la decide `cierreFirmChecks` (views/cierre.js), no esta pantalla.
// - Solo con el tema v2 y el mes abierto. Con sobres activos o un plan propuesto por revisar (pasos que aquí no caben), con el mes
//   firmado o con «Ver el cierre paso a paso», se ve el cierre de siempre entero: no se pierde ninguna función.
// - Script clásico con defer, antes de app.js y mismo ámbito; `renderCierre` (views/cierre.js) lo llama con lo que ya ha calculado.
// - `localStorage["cierre-v2-modo"] = "clasico"` abre siempre el de siempre (lo usan las pruebas del asistente).

let cierreV2Clasico = false; // «Ver el cierre paso a paso»: dura la sesión

function cierreV2Activo() {
  if (document.documentElement.dataset.tema !== "v2" || cierreV2Clasico) return false;
  try {
    return localStorage.getItem("cierre-v2-modo") !== "clasico";
  } catch {
    return true;
  }
}

function cierreV2MesNombre(monthKey) {
  const [year, month] = String(monthKey).split("-").map(Number);
  return new Date(year, month - 1, 15).toLocaleDateString("es-ES", { month: "long" });
}

function cierreV2UltimoDia(monthKey) {
  const [year, month] = String(monthKey).split("-").map(Number);
  const dia = new Date(year, month, 0);
  return dia.toLocaleDateString("es-ES", { day: "numeric", month: "short" }).replace(".", "");
}

// Comprobación 1: los saldos declarados frente a los del extracto, cuenta a cuenta.
function cierreV2Saldos(accountRows) {
  const descuadran = accountRows.filter((row) => row.status === "descuadra");
  const sinComparar = accountRows.filter((row) => row.status === "sin-conciliar");
  const ok = !descuadran.length;
  let texto;
  if (!descuadran.length && !sinComparar.length) texto = `${accountRows.map((row) => row.label).join(" y ")} coinciden con el banco.`;
  else {
    texto = [
      ...descuadran.map((row) => `${row.label} no cuadra: declarado ${money(row.declared, true)}, extracto ${money(row.calculated, true)} (diferencia ${money(row.diff, true)}).`),
      ...accountRows.filter((row) => row.status === "cuadra").map((row) => `${row.label} coincide con el banco.`),
      ...sinComparar.map((row) => `${row.label}: sin extracto con que comparar (no bloquea).`),
    ].join(" ");
  }
  const accion = descuadran.length ? `<button type="button" class="e19-btn e19-btn-secondary" data-cierre-task-target="update-hub">Corregir el saldo</button>` : "";
  return { ok, texto, accion, sinComparar: sinComparar.length };
}

// Comprobación 2: el extracto del mes entero, sin movimientos sin partida ni otras diferencias del mes.
function cierreV2Movimientos(ctx) {
  const lineas = typeof globalThis.FinanceCobertura?.lineasCierre === "function" ? globalThis.FinanceCobertura.lineasCierre(ctx.monthKey) : [];
  const huecos = lineas.filter((linea) => !linea.ok);
  const otras = ctx.tasks.filter((task) => task.cause !== "unclassified").length;
  const partes = [];
  if (!ctx.monthMovementCount) partes.push(`Todavía no hay movimientos de ${cierreV2MesNombre(ctx.monthKey)}: importa el extracto.`);
  else if (lineas.length) partes.push(lineas.map((linea) => `${linea.texto}.`).join(" "));
  else partes.push(`${ctx.monthMovementCount} ${ctx.monthMovementCount === 1 ? "movimiento" : "movimientos"} del extracto.`);
  if (ctx.unclassified) partes.push(`${ctx.unclassified} ${ctx.unclassified === 1 ? "movimiento sin partida" : "movimientos sin partida"}.`);
  if (otras) partes.push(`${otras} ${otras === 1 ? "diferencia más" : "diferencias más"} (saldo o banco frente a real).`);
  const acciones = [];
  if (!ctx.monthMovementCount || huecos.length) acciones.push(`<button type="button" class="e19-btn e19-btn-secondary" data-cierre-v2-importar>Importar extracto</button>`);
  if (ctx.unclassified) acciones.push(`<button type="button" class="e19-btn e19-btn-secondary" data-cierre-v2-clasificar>Clasificar</button>`);
  if (ctx.unclassified && !otras) acciones.push(`<button type="button" class="e19-btn e19-btn-secondary" data-cierre-por-clasificar="${escapeHtml(ctx.monthKey)}">Dejar ${ctx.unclassified} en «Por clasificar»</button>`);
  if (otras) acciones.push(`<button type="button" class="e19-btn e19-btn-secondary" data-cierre-v2-diferencias>Ver ${otras === 1 ? "la diferencia" : "las diferencias"}</button>`);
  const aviso = typeof cierrePorClasificarAvisoHtml === "function" ? cierrePorClasificarAvisoHtml(ctx.monthKey) : "";
  return { ok: ctx.monthMovementCount > 0 && ctx.tasks.length === 0, texto: partes.join(" "), accion: acciones.join(""), aviso, huecos: huecos.length };
}

// Comprobación 3 (informa, no bloquea): las tres partidas de gasto que más se desviaron de lo previsto.
function cierreV2Desvios(monthKey) {
  const month = (typeof cuadroMandosAllMonths === "function" ? cuadroMandosAllMonths() : []).find((item) => item.key === monthKey);
  if (!month || typeof planMesCollect !== "function") return [];
  return planMesCollect(month).expense
    .filter((entry) => entry.hasActual && Math.abs(Number(entry.variance) || 0) >= 0.5)
    .sort((a, b) => Math.abs(b.variance) - Math.abs(a.variance))
    .slice(0, 3);
}

function cierreV2DesviosHtml(filas, monthKey) {
  if (!filas.length) return `<p class="e19-kpi-note">Sin reales de ${escapeHtml(cierreV2MesNombre(monthKey))} con que comparar todavía.</p>`;
  const desvio = (entry) => `<span class="${entry.variance > 0 ? "cierre-v2-pasa" : "cierre-v2-sobra"}">${entry.variance > 0 ? "+" : ""}${escapeHtml(money(entry.variance, true))}</span>`;
  return `<table class="cierre-v2-tabla">
      <thead><tr><th scope="col">Partida</th><th scope="col" class="cierre-v2-detalle">Previsto</th><th scope="col" class="cierre-v2-detalle">Real</th><th scope="col">Desvío</th></tr></thead>
      <tbody>${filas.map((entry) => `<tr><th scope="row">${escapeHtml(entry.label)}</th><td class="cierre-v2-detalle">${escapeHtml(money(entry.planned, true))}</td><td class="cierre-v2-detalle">${escapeHtml(money(entry.usado, true))}</td><td>${desvio(entry)}</td></tr>`).join("")}</tbody>
    </table>
    <p class="e19-kpi-note">En rojo, lo que se gastó por encima de lo previsto; en verde, lo que sobró. No bloquea la firma.</p>`;
}

function cierreV2PasoHtml({ numero, estado, titulo, texto, accion = "", cuerpo = "", aviso = "" }) {
  const icono = estado === "ok" ? `<span class="cierre-v2-icono is-ok" aria-hidden="true">✓</span>` : `<span class="cierre-v2-icono is-${estado}" aria-hidden="true">${numero}</span>`;
  const estadoTexto = estado === "ok" ? "Hecho" : estado === "pendiente" ? "Falta" : "Para revisar";
  return `<li class="cierre-v2-paso is-${estado}"${estado === "pendiente" ? ' tabindex="-1" data-cierre-v2-falta' : ""}>
      ${icono}
      <div class="cierre-v2-paso-cuerpo">
        <div class="cierre-v2-paso-cabecera">
          <div><h3>${escapeHtml(titulo)} <span class="sr-only">· ${estadoTexto}</span></h3><p>${escapeHtml(texto)}</p></div>
          ${accion ? `<div class="cierre-v2-acciones">${accion}</div>` : ""}
        </div>
        ${aviso}${cuerpo}
      </div>
    </li>`;
}

// Lo que falta, dicho como tarea (las comprobaciones se rotulan como meta: «Ninguna cuenta descuadra»).
const CIERRE_V2_FALTA = {
  cuentas: "que cuadren los saldos de las cuentas",
  diferencias: "resolver lo que queda abierto en el mes (movimientos sin partida u otras diferencias)",
  sobres: "dar destino a los sobres",
  extracto: "importar el extracto del mes",
  recalculo: "que la app termine de recalcular colchón, deuda, metas y apalancamiento (se hace sola al guardar cualquier dato)",
};

function cierreV2Falta(check) {
  return CIERRE_V2_FALTA[check.id] || String(check.label || "").toLowerCase();
}

// La confianza del cierre: baja si no se puede firmar; media si se puede pero con algo sin comprobar; alta si todo cuadra.
function cierreV2Confianza({ unmet, saldos, movimientos, porClasificar, syncReady }) {
  if (unmet.length) return { nivel: "baja", texto: `Todavía no se puede firmar: falta ${unmet.join("; ")}.` };
  const motivos = [];
  if (saldos.sinComparar) motivos.push(`${saldos.sinComparar === 1 ? "una cuenta queda" : `${saldos.sinComparar} cuentas quedan`} sin extracto con que comparar`);
  if (movimientos.huecos) motivos.push("los extractos no cubren el mes entero (los días que faltan no estarán en los reales)");
  if (porClasificar) motivos.push(`${porClasificar} ${porClasificar === 1 ? "movimiento queda" : "movimientos quedan"} en «Por clasificar»`);
  const sesion = syncReady ? "" : " Antes, inicia sesión y sincroniza una versión.";
  if (!motivos.length) return { nivel: "alta", texto: `Todo cuadra: puedes firmar.${sesion}` };
  return { nivel: "media", texto: `Puedes firmar: ${motivos.join("; ")}.${sesion}` };
}

function cierreV2ConfianzaHtml(confianza) {
  const llenos = { baja: 1, media: 2, alta: 3 }[confianza.nivel];
  const barras = [1, 2, 3].map((i) => `<span class="${i <= llenos ? `is-${confianza.nivel}` : ""}"></span>`).join("");
  return `<article class="e19-card cierre-v2-confianza">
      <div class="cierre-v2-eyebrow"><span>Confianza del cierre</span><strong class="is-${confianza.nivel}">${confianza.nivel}</strong></div>
      <div class="cierre-v2-barras" aria-hidden="true">${barras}</div>
      <p>${escapeHtml(confianza.texto)}</p>
    </article>`;
}

function cierreV2AciertoTexto() {
  const engine = globalThis.FinanceCanonicalLiquidityBacktest;
  try {
    if (!engine || typeof readLiquidityBacktestStore !== "function") return "";
    const texto = engine.summaryText(engine.evaluate({ store: readLiquidityBacktestStore(), closes: loadMonthCloseBalances(), today: isoLocalDate(new Date()) }));
    return String(texto || "").replace(/^[^:]*:\s*/, "").replace(/^datos insuficientes \((\d+) de (\d+) cierres\)$/, "se mide desde el cierre $2 (van $1)");
  } catch {
    return "";
  }
}

function cierreV2GuardaHtml(ctx) {
  const dia = cierreV2UltimoDia(ctx.monthKey);
  const filas = [[`Reales de ${cierreV2MesNombre(ctx.monthKey)}`, "se congelan"]];
  ctx.accountRows.forEach((row) => filas.push([`${row.label} a ${dia}`, money(row.declared, true)]));
  const acierto = cierreV2AciertoTexto();
  if (acierto) filas.push(["Acierto de la previsión", acierto]);
  return `<article class="e19-card cierre-v2-guarda">
      <div class="cierre-v2-eyebrow"><span>Lo que guarda la firma</span></div>
      <dl>${filas.map(([etiqueta, valor]) => `<div><dt>${escapeHtml(etiqueta)}</dt><dd>${escapeHtml(valor)}</dd></div>`).join("")}</dl>
      <p class="e19-kpi-note">Se crea una versión nueva del cierre, con su fecha y su motivo. El mes se puede reabrir después.</p>
    </article>`;
}

/**
 * Pinta el cierre nuevo. Devuelve true si lo pinta (y entonces `renderCierre` no pinta el asistente de siempre).
 * @param {{monthKey: string, accountRows: any[], tasks: any[], unclassified: number, monthMovementCount: number, checks: any[], syncReady: boolean, extraSteps: boolean}|null} ctx
 */
function renderCierreV2(ctx) {
  const box = qs("cierreV2");
  if (!box) return false;
  cierreV2Attach(box);
  if (!ctx || ctx.extraSteps || document.documentElement.dataset.tema !== "v2") {
    box.hidden = true;
    box.removeAttribute("data-modo");
    box.innerHTML = "";
    return false;
  }
  if (!cierreV2Activo()) {
    box.hidden = false;
    box.dataset.modo = "linea";
    box.innerHTML = `<p class="cierre-v2-linea">Estás viendo el cierre paso a paso. <button type="button" class="link-button" data-cierre-v2-nuevo>Volver al cierre nuevo</button></p>`;
    return false;
  }
  const mes = cierreV2MesNombre(ctx.monthKey);
  const saldos = cierreV2Saldos(ctx.accountRows);
  const movimientos = cierreV2Movimientos(ctx);
  const desvios = cierreV2Desvios(ctx.monthKey);
  const unmet = ctx.checks.filter((check) => !check.met).map(cierreV2Falta);
  const porClasificar = typeof cierrePorClasificarContados === "function" ? cierrePorClasificarContados(ctx.monthKey) : 0;
  const confianza = cierreV2Confianza({ unmet, saldos, movimientos, porClasificar, syncReady: ctx.syncReady });
  const puede = !unmet.length && ctx.syncReady;
  const falta = [unmet.length ? `Para firmar falta ${unmet.join("; ")}.` : "", ctx.syncReady ? "" : "Inicia sesión y sincroniza una versión antes de firmar."].filter(Boolean).join(" ");
  const titulo = qs("cierreTitle");
  if (titulo) titulo.textContent = `Cerrar ${mes}`;
  const subtitulo = qs("cierreSubtitle");
  if (subtitulo) subtitulo.textContent = "Tres comprobaciones y una firma. Al firmar, los reales del mes quedan congelados y se guarda el saldo de cada cuenta.";
  box.hidden = false;
  box.dataset.modo = "v2";
  box.innerHTML = `<div class="cierre-v2">
      <ol class="e19-card cierre-v2-pasos" aria-label="Comprobaciones del cierre de ${escapeHtml(mes)}">
        ${cierreV2PasoHtml({ numero: 1, estado: saldos.ok ? "ok" : "pendiente", titulo: `Saldos a ${cierreV2UltimoDia(ctx.monthKey)}`, texto: saldos.texto, accion: saldos.accion })}
        ${cierreV2PasoHtml({ numero: 2, estado: movimientos.ok ? "ok" : "pendiente", titulo: "Movimientos completos", texto: movimientos.texto, accion: movimientos.accion, aviso: movimientos.aviso })}
        ${cierreV2PasoHtml({ numero: 3, estado: "info", titulo: "Lo previsto frente a lo real", texto: desvios.length ? `Las ${desvios.length === 1 ? "partida" : `${desvios.length} partidas`} de gasto que más se desviaron.` : "Para revisar antes de firmar.", cuerpo: cierreV2DesviosHtml(desvios, ctx.monthKey) })}
      </ol>
      <aside class="cierre-v2-lado" aria-label="Firma">
        ${cierreV2ConfianzaHtml(confianza)}
        ${cierreV2GuardaHtml(ctx)}
        <button type="button" class="e19-btn e19-btn-primary cierre-v2-firmar${puede ? "" : " is-bloqueado"}" id="cierreSignButton"${puede ? "" : ` aria-disabled="true" aria-describedby="cierreFirmaFalta" data-falta="${escapeHtml(falta)}"`}>Firmar el cierre de ${escapeHtml(mes)}</button>
        <p class="cierre-firma-falta" id="cierreFirmaFalta" role="alert" hidden></p>
      </aside>
    </div>
    <p class="cierre-v2-linea"><button type="button" class="link-button" data-cierre-v2-clasico>Ver el cierre paso a paso</button> · el de siempre, con todos sus detalles.</p>`;
  globalThis.FinanceMedidor?.anotar("cierre-v2", "vista"); // XGO-02
  return true;
}

// Una sola escucha por contenedor. «Dejar en Por clasificar» y «Corregir el saldo» los atiende la escucha de siempre de #cierre (app.js).
function cierreV2Attach(box) {
  if (box.__cierreV2) return;
  box.__cierreV2 = true;
  box.addEventListener("click", (event) => {
    const medir = (tipo) => globalThis.FinanceMedidor?.anotar("cierre-v2", tipo);
    if (event.target.closest("[data-cierre-v2-clasico]")) {
      cierreV2Clasico = true;
      medir("descarte");
      renderCierre();
      return;
    }
    if (event.target.closest("[data-cierre-v2-nuevo]")) {
      cierreV2Clasico = false;
      try { localStorage.removeItem("cierre-v2-modo"); } catch { /* sin almacenamiento */ }
      renderCierre();
      return;
    }
    if (event.target.closest("[data-cierre-v2-diferencias]")) {
      cierreV2Clasico = true;
      cierreActiveStep = 2;
      medir("accion");
      renderCierre();
      return;
    }
    const clasificar = event.target.closest("[data-cierre-v2-clasificar]");
    if (clasificar) {
      medir("accion");
      if (typeof globalThis.clasificarV2Open === "function") globalThis.clasificarV2Open(clasificar);
      else { history.pushState(null, "", "#movements"); setActiveView("movements", { focus: true }); }
      return;
    }
    if (event.target.closest("[data-cierre-v2-importar]")) {
      medir("accion");
      if (typeof importarV2Elegir === "function") importarV2Elegir();
      else { history.pushState(null, "", "#datos-importar"); setActiveView("datos-importar", { focus: true }); }
      return;
    }
    if (event.target.closest("[data-cierre-por-clasificar], [data-cierre-task-target]") || (event.target.closest("#cierreSignButton") && event.target.closest("#cierreSignButton").getAttribute("aria-disabled") !== "true")) medir("accion");
  });
}
