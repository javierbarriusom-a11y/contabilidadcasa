// Rediseño · B5 «Repaso semanal» (docs/rediseno/HANDOFF.md §5 y §5b, referencias/png/Ritual.png y RitualDesktop.png;
// XUX-03 de docs/PROPUESTA_SEPTIMA_AUDITORIA_2026-10-17.md). Abierto el 24/10/2026, al levantar el hogar la regla de
// parada para funciones nuevas: es la que ataca el cuello de botella real, que la app no recibe datos.
//
// Cinco pasos en orden, uno cada vez, con cronómetro que se mide solo: saldos («Coincide» o «Corregir»), extracto
// (¿hay que importar?), lo que vino (cobros y cargos esperados por confirmar), bandeja (conceptos sin partida) y listo.
// Lo que ya está al día se dice y se pasa con un toque. Pantalla completa en móvil; diálogo de 880 px en escritorio.
//
// No es un motor nuevo ni guarda nada por su cuenta salvo su propio registro de duración:
// · saldos: el mismo modelo y la misma escritura que el pulso de saldos de Registrar (WP-26, canonical-balance-pulse.js
//   y setBalancePulseState de registrar-ui.js), con su «Deshacer» de 8 s;
// · extracto: lleva a Importar (views/importar-v2.js) y vuelve al repaso con la píldora «Seguir con el repaso»;
// · lo que vino: las mismas preguntas y botones de esperados-ui.js (WP-14 + WP-27), que las atiende por delegación;
// · bandeja: abre Clasificar por lotes (views/clasificar-v2.js) encima del repaso.
// La duración de cada repaso terminado alimenta M-COSTE (≤ 10 min a la semana), que hasta ahora se autodeclaraba.
// Script clásico con defer, cargado antes de app.js (mismo scope global que el resto de views/*.js).

const REPASO_V2_STORE = "repaso-semanal";
const REPASO_V2_KEEP = 26;
const REPASO_V2_PASOS = [
  { id: "saldos", nombre: "Saldos" },
  { id: "extracto", nombre: "Extracto" },
  { id: "vino", nombre: "Lo que vino" },
  { id: "bandeja", nombre: "Bandeja" },
  { id: "listo", nombre: "Listo" },
];
// Un extracto con su último movimiento de hace más de una semana pide importar el siguiente.
const REPASO_V2_EXTRACTO_DIAS = 7;

let repasoV2 = null; // { paso, inicio, respuestas, escritos, hecho: {}, fuera, opener }
let repasoV2Reloj = 0;

function repasoV2Active() {
  return document.documentElement.dataset.tema === "v2";
}

function repasoV2Hoy() {
  return isoLocalDate(new Date());
}

// «1 min 10 s», «45 s»: lo que se ve en el cronómetro y al terminar.
function repasoV2Duracion(segundos) {
  const total = Math.max(0, Math.round(Number(segundos) || 0));
  const min = Math.floor(total / 60);
  const s = total % 60;
  return min ? `${min} min${s ? ` ${s} s` : ""}` : `${s} s`;
}

// ---------- registro de repasos (solo duración y qué se hizo: ni importes ni conceptos) ----------

function repasoV2Leer() {
  try {
    const raw = JSON.parse(globalThis.localStorage?.getItem(storageKey(REPASO_V2_STORE)) || "null");
    return Array.isArray(raw?.runs) ? { runs: raw.runs.filter((run) => run && /^\d{4}-\d{2}-\d{2}$/.test(run.date) && Number.isFinite(run.seconds)) } : { runs: [] };
  } catch {
    return { runs: [] };
  }
}

function repasoV2Guardar(store) {
  try {
    globalThis.localStorage?.setItem(storageKey(REPASO_V2_STORE), JSON.stringify({ runs: store.runs.slice(-REPASO_V2_KEEP) }));
  } catch {
    /* sin almacenamiento: el repaso funciona igual, solo no se recuerda */
  }
}

// Lunes de la semana de una fecha (semana ISO), para contar semanas seguidas con repaso.
function repasoV2Lunes(iso) {
  const [y, m, d] = String(iso).split("-").map(Number);
  const date = new Date(y, m - 1, d, 12);
  date.setDate(date.getDate() - ((date.getDay() + 6) % 7));
  return isoLocalDate(date);
}

// Semanas seguidas con al menos un repaso terminado, contando hacia atrás desde la de `hoy` (o la anterior, si esta
// semana aún no hay ninguno: la racha no se rompe hasta que termina la semana).
function repasoV2Racha(runs, hoy) {
  const semanas = new Set(runs.map((run) => repasoV2Lunes(run.date)));
  let lunes = repasoV2Lunes(hoy);
  if (!semanas.has(lunes)) {
    const [y, m, d] = lunes.split("-").map(Number);
    lunes = isoLocalDate(new Date(y, m - 1, d - 7, 12));
  }
  let racha = 0;
  while (semanas.has(lunes)) {
    racha += 1;
    const [y, m, d] = lunes.split("-").map(Number);
    lunes = isoLocalDate(new Date(y, m - 1, d - 7, 12));
  }
  return racha;
}

// Minutos de mantenimiento de la semana de `hoy` (M-COSTE): la suma de los repasos terminados esa semana.
function repasoV2MinutosSemana(runs, hoy) {
  const lunes = repasoV2Lunes(hoy);
  const segundos = runs.filter((run) => repasoV2Lunes(run.date) === lunes).reduce((sum, run) => sum + run.seconds, 0);
  return Math.round((segundos / 60) * 10) / 10;
}

globalThis.FinanceRepaso = {
  resumen() {
    const runs = repasoV2Leer().runs;
    const hoy = repasoV2Hoy();
    return { veces: runs.length, ultimo: runs.at(-1) || null, racha: repasoV2Racha(runs, hoy), minutosSemana: repasoV2MinutosSemana(runs, hoy) };
  },
  mismaSemana(a, b) {
    return repasoV2Lunes(a) === repasoV2Lunes(b);
  },
};

// ---------- lo que cada paso necesita saber ----------

function repasoV2Cuentas() {
  return typeof balancePulseAccounts === "function" ? balancePulseAccounts() : [];
}

function repasoV2Modelo() {
  return globalThis.FinanceCanonicalBalancePulse?.buildModel({ accounts: repasoV2Cuentas(), answers: repasoV2?.respuestas || {}, mode: "manual", today: repasoV2Hoy() }) || null;
}

function repasoV2SaldosAlDia() {
  return state?.balanceMode === "manual" && state?.balanceDate === repasoV2Hoy();
}

// Último movimiento importado de cada cuenta del pulso (las que tienen extracto) y si toca importar.
function repasoV2Extractos() {
  const hoy = repasoV2Hoy();
  const cuentas = globalThis.FinanceCanonicalBalancePulse?.ACCOUNTS || [];
  return cuentas.map((cuenta) => {
    const filas = (baseData?.transactions || []).filter((row) => row?.date && (String(row.account || "") === cuenta.importLabel || (!row.account && cuenta.unlabelledStatements)));
    const ultima = filas.map((row) => String(row.date).slice(0, 10)).sort().at(-1) || "";
    const dias = ultima ? Math.round((new Date(`${hoy}T12:00:00`) - new Date(`${ultima}T12:00:00`)) / 86400000) : null;
    return { id: cuenta.id, label: cuenta.label, ultima, dias, toca: dias === null || dias > REPASO_V2_EXTRACTO_DIAS };
  });
}

function repasoV2Esperados() {
  return typeof expectedMovementInboxItems === "function" ? expectedMovementInboxItems() : [];
}

function repasoV2GruposSinPartida() {
  return typeof clasV2PendingGroups === "function" ? clasV2PendingGroups() : [];
}

// ---------- pintado ----------

function repasoV2Cabecera(paso) {
  const segundos = repasoV2 ? (Date.now() - repasoV2.inicio) / 1000 : 0;
  const barras = REPASO_V2_PASOS.map((_, index) => `<span class="${index <= paso ? "is-hecho" : ""}"></span>`).join("");
  return `<div class="rep-v2-top">
      <button type="button" class="e19-btn e19-btn-secondary rep-v2-cerrar" data-rep-v2-cerrar aria-label="Cerrar el repaso">${repasoV2Icono('<path d="M6 6l12 12M18 6 6 18"></path>')}</button>
      <span class="rep-v2-reloj" role="timer" aria-live="off">${repasoV2Icono('<circle cx="12" cy="12" r="8.5"></circle><path d="M12 7.5V12l3 2"></path>')}<span data-rep-v2-reloj>${repasoV2Duracion(segundos)}</span></span>
    </div>
    <div class="rep-v2-progreso rep-v2-solo-movil" aria-hidden="true">${barras}</div>`;
}

function repasoV2Lateral(paso) {
  const items = REPASO_V2_PASOS.map((item, index) => {
    const estado = index < paso ? "is-hecho" : index === paso ? "is-actual" : "";
    return `<li class="${estado}"${index === paso ? ' aria-current="step"' : ""}><span class="rep-v2-num">${index < paso ? "✓" : index + 1}</span>${escapeHtml(item.nombre)}</li>`;
  }).join("");
  const segundos = repasoV2 ? (Date.now() - repasoV2.inicio) / 1000 : 0;
  return `<aside class="rep-v2-lateral rep-v2-solo-ancho">
    <p class="rep-v2-lab">Repaso semanal</p>
    <ol class="rep-v2-pasos">${items}</ol>
    <p class="rep-v2-meta">${repasoV2Icono('<circle cx="12" cy="12" r="8.5"></circle><path d="M12 7.5V12l3 2"></path>')}<span data-rep-v2-reloj>${repasoV2Duracion(segundos)}</span> · se mide solo</p>
  </aside>`;
}

function repasoV2Icono(path) {
  return `<svg class="rep-v2-ico" viewBox="0 0 24 24" aria-hidden="true">${path}</svg>`;
}

function repasoV2Titulo(paso, titulo, ayuda) {
  return `<p class="rep-v2-lab">Paso ${paso + 1} de ${REPASO_V2_PASOS.length} · ${escapeHtml(REPASO_V2_PASOS[paso].nombre)}</p>
    <h2 class="rep-v2-h" id="repasoV2Titulo" tabindex="-1">${escapeHtml(titulo)}</h2>
    ${ayuda ? `<p class="rep-v2-ayuda">${ayuda}</p>` : ""}`;
}

function repasoV2Despues(paso) {
  const resto = REPASO_V2_PASOS.slice(paso + 1).map((item) => item.nombre.toLowerCase());
  return resto.length ? `<p class="rep-v2-despues rep-v2-solo-movil">Después: ${escapeHtml(resto.join(" · "))}</p>` : "";
}

function repasoV2EstimadoTexto(item) {
  if (item.known.value === null) return "sin dato";
  if (item.known.source === "extracto") return `según el extracto del ${item.known.date.slice(8, 10)}/${item.known.date.slice(5, 7)}`;
  if (!item.known.date || item.ageDays === null) return "estimado hoy";
  return item.ageDays <= 0 ? "puesto hoy" : `puesto hace ${item.ageDays} ${item.ageDays === 1 ? "día" : "días"}`;
}

function repasoV2PasoSaldos() {
  const modelo = repasoV2Modelo();
  const items = (modelo?.items || []).map((item) => {
    const respuesta = repasoV2.respuestas[item.id] || "";
    const escrito = repasoV2.escritos[item.id] ?? "";
    const valor = escrito !== "" ? parseAmountField(escrito) : null;
    const diferencia = valor !== null && item.known.value !== null ? round2(valor - item.known.value) : null;
    const estimado = item.known.value === null ? "—" : `${formatAmountField(item.known.value)} €`;
    if (respuesta === "corregido") {
      return `<div class="rep-v2-cuenta is-corrigiendo" data-rep-v2-cuenta="${escapeHtml(item.id)}">
        <div class="rep-v2-cuenta-head"><strong>${escapeHtml(item.label)}</strong><span class="rep-v2-meta">estimado ${escapeHtml(estimado)}</span></div>
        <label class="rep-v2-campo"><span>Saldo que ves en el banco</span>
          <input type="text" inputmode="decimal" autocomplete="off" data-rep-v2-saldo="${escapeHtml(item.id)}" value="${escapeHtml(escrito)}" placeholder="${escapeHtml(item.known.value === null ? "0,00" : formatAmountField(item.known.value))}" aria-describedby="repasoV2Dif-${escapeHtml(item.id)}" /></label>
        <p class="rep-v2-meta" id="repasoV2Dif-${escapeHtml(item.id)}" aria-live="polite">${escrito !== "" && valor === null ? "Eso no es un importe: escribe solo la cifra (1.234,56)." : diferencia !== null ? `Diferencia ${diferencia > 0 ? "+" : ""}${formatAmountField(diferencia)} €. La previsión se recalcula al guardar.` : "La previsión se recalcula al guardar."}</p>
      </div>`;
    }
    return `<div class="rep-v2-cuenta${respuesta === "coincide" ? " is-coincide" : ""}" data-rep-v2-cuenta="${escapeHtml(item.id)}">
      <div class="rep-v2-cuenta-head"><strong>${escapeHtml(item.label)}</strong><span class="rep-v2-meta">${escapeHtml(repasoV2EstimadoTexto(item))}</span></div>
      <p class="rep-v2-cifra">${escapeHtml(estimado)}</p>
      <div class="rep-v2-botones-cuenta">
        <button type="button" class="e19-btn e19-btn-secondary" data-rep-v2-corregir="${escapeHtml(item.id)}">Corregir</button>
        <button type="button" class="e19-btn ${respuesta === "coincide" ? "e19-btn-primary" : "e19-btn-secondary"}" data-rep-v2-coincide="${escapeHtml(item.id)}" aria-pressed="${respuesta === "coincide"}"${item.canConfirm ? "" : " disabled"}>${respuesta === "coincide" ? "✓ " : ""}Coincide</button>
      </div>
    </div>`;
  }).join("");
  const listo = repasoV2SaldosListos(modelo);
  const alDia = repasoV2SaldosAlDia();
  const ayuda = alDia ? "Ya los pusiste hoy. Si nada ha cambiado, sigue sin tocarlos." : "Abre la app del banco y compara. Si cuadra, un toque.";
  const pie = alDia && !Object.keys(repasoV2.respuestas).length
    ? `<button type="button" class="e19-btn e19-btn-primary rep-v2-sigue" data-rep-v2-seguir>Seguir sin cambiarlos</button>`
    : `<button type="button" class="e19-btn e19-btn-primary rep-v2-sigue" data-rep-v2-guardar${listo ? "" : " disabled"}>Guardar y seguir</button>`;
  return {
    cuerpo: `${repasoV2Titulo(0, "¿Coincide lo que dice tu banco?", escapeHtml(ayuda))}<div class="rep-v2-cuentas">${items}</div>`,
    pie: `${repasoV2Despues(0)}${pie}<p class="rep-v2-meta rep-v2-falta" aria-live="polite"${listo ? " hidden" : ""}>${listo ? "" : `Falta responder ${escapeHtml(repasoV2Faltan(modelo))}.`}</p>`,
  };
}

function repasoV2SaldosListos(modelo) {
  return Boolean(modelo?.items.length) && modelo.items.every((item) => {
    const respuesta = repasoV2.respuestas[item.id];
    return respuesta === "coincide" || (respuesta === "corregido" && parseAmountField(repasoV2.escritos[item.id] ?? "") !== null);
  });
}

function repasoV2Faltan(modelo) {
  const faltan = (modelo?.items || []).filter((item) => {
    const respuesta = repasoV2.respuestas[item.id];
    return !(respuesta === "coincide" || (respuesta === "corregido" && parseAmountField(repasoV2.escritos[item.id] ?? "") !== null));
  }).map((item) => item.label);
  return faltan.join(" y ") || "una cuenta";
}

function repasoV2PasoExtracto() {
  const extractos = repasoV2Extractos();
  const toca = extractos.filter((item) => item.toca);
  const filas = extractos.map((item) => `<li class="rep-v2-fila${item.toca ? " is-toca" : ""}">
      <strong>${escapeHtml(item.label)}</strong>
      <span class="rep-v2-meta">${item.ultima ? `último movimiento ${escapeHtml(displayShortDate(item.ultima))} · hace ${item.dias} ${item.dias === 1 ? "día" : "días"}` : "sin extractos todavía"}</span>
      <span class="rep-v2-estado">${item.toca ? "toca importar" : "al día"}</span>
    </li>`).join("");
  const titulo = toca.length ? "¿Importamos el extracto?" : "Los extractos están al día";
  const ayuda = toca.length
    ? "Descarga el CSV o el Excel de tu banco e impórtalo: la previsión y el cierre trabajan con lo que de verdad pasó. Al acabar, vuelves aquí."
    : `Ninguna cuenta tiene su último movimiento de hace más de ${REPASO_V2_EXTRACTO_DIAS} días.`;
  const pie = toca.length
    ? `<div class="rep-v2-dos"><button type="button" class="e19-btn e19-btn-secondary" data-rep-v2-seguir>Ahora no</button><button type="button" class="e19-btn e19-btn-primary rep-v2-sigue" data-rep-v2-importar>Importar extracto</button></div>`
    : `<button type="button" class="e19-btn e19-btn-primary rep-v2-sigue" data-rep-v2-seguir>Seguir</button>`;
  return { cuerpo: `${repasoV2Titulo(1, titulo, escapeHtml(ayuda))}<ul class="rep-v2-filas">${filas}</ul>`, pie: `${repasoV2Despues(1)}${pie}` };
}

function repasoV2PasoVino() {
  const items = repasoV2Esperados();
  const lista = items.length
    ? `<ul class="rep-v2-esperados">${items.map((item) => `<li class="rep-v2-esperado"><strong>${escapeHtml(item.title)}</strong><span class="rep-v2-meta">${escapeHtml(item.text)}</span>${item.html ? `<div class="rep-v2-esperado-acciones">${item.html}</div>` : ""}</li>`).join("")}</ul>`
    : `<p class="rep-v2-vacio">Nada por confirmar: lo que esperabais ha llegado o todavía no toca.</p>`;
  const titulo = items.length ? "¿Ha llegado lo que esperabais?" : "Nada pendiente de llegar";
  const ayuda = items.length ? "Cobros que deberían haber entrado y cargos que no han aparecido. Contéstalos mirando el extracto." : "";
  return {
    cuerpo: `${repasoV2Titulo(2, titulo, escapeHtml(ayuda))}${lista}`,
    pie: `${repasoV2Despues(2)}<button type="button" class="e19-btn e19-btn-primary rep-v2-sigue" data-rep-v2-seguir>${items.length ? "Seguir (lo demás, otro día)" : "Seguir"}</button>`,
  };
}

function repasoV2PasoBandeja() {
  const grupos = repasoV2GruposSinPartida();
  const movimientos = grupos.reduce((sum, group) => sum + group.rows.length, 0);
  const titulo = grupos.length ? "¿Les damos partida?" : "Todo tiene partida";
  const ayuda = grupos.length
    ? `${grupos.length === 1 ? "Un concepto" : `${grupos.length} conceptos`} sin partida (${movimientos} ${movimientos === 1 ? "movimiento" : "movimientos"}). Se clasifican de cinco en cinco, con propuesta y deshacer, y la regla vale para los siguientes.`
    : "Ningún movimiento espera partida.";
  const pie = grupos.length
    ? `<div class="rep-v2-dos"><button type="button" class="e19-btn e19-btn-secondary" data-rep-v2-seguir>Ahora no</button><button type="button" class="e19-btn e19-btn-primary rep-v2-sigue" data-rep-v2-clasificar>Clasificar</button></div>`
    : `<button type="button" class="e19-btn e19-btn-primary rep-v2-sigue" data-rep-v2-seguir>Seguir</button>`;
  return { cuerpo: repasoV2Titulo(3, titulo, escapeHtml(ayuda)), pie: `${repasoV2Despues(3)}${pie}` };
}

function repasoV2PasoListo() {
  const hecho = repasoV2.hecho;
  const segundos = repasoV2.final ?? (Date.now() - repasoV2.inicio) / 1000;
  const pendientes = [];
  if (!hecho.saldos) pendientes.push("saldos");
  if (repasoV2Extractos().some((item) => item.toca)) pendientes.push("extracto");
  if (repasoV2Esperados().length) pendientes.push("cobros y cargos por confirmar");
  if (repasoV2GruposSinPartida().length) pendientes.push("conceptos sin partida");
  const resumen = globalThis.FinanceRepaso.resumen();
  const lineas = [
    hecho.saldos ? "Saldos confirmados hoy." : "Saldos sin confirmar.",
    pendientes.length ? `Queda para otro día: ${pendientes.join(", ")}.` : "Todo al día.",
    resumen.racha > 1 ? `${resumen.racha} semanas seguidas con repaso.` : "",
    `Esta semana: ${String(resumen.minutosSemana).replace(".", ",")} min de mantenimiento (objetivo, 10 o menos).`,
  ].filter(Boolean);
  return {
    cuerpo: `${repasoV2Titulo(4, `${repasoV2Duracion(segundos)} · ${pendientes.length ? "casi todo" : "todo al día"}`, "")}
      <ul class="rep-v2-resumen">${lineas.map((line) => `<li>${escapeHtml(line)}</li>`).join("")}</ul>`,
    pie: `<button type="button" class="e19-btn e19-btn-primary rep-v2-sigue" data-rep-v2-terminar>Terminar</button>`,
  };
}

function repasoV2Render() {
  const dialog = qs("repasoV2");
  if (!dialog || !repasoV2) return;
  const paso = repasoV2.paso;
  const contenido = [repasoV2PasoSaldos, repasoV2PasoExtracto, repasoV2PasoVino, repasoV2PasoBandeja, repasoV2PasoListo][paso]();
  const atajos = paso === 0 ? `<p class="rep-v2-atajos rep-v2-solo-ancho">Atajos: <b>C</b> coincide · <b>E</b> editar · <b>↵</b> seguir</p>` : "";
  dialog.innerHTML = `<div class="rep-v2-in">
    ${repasoV2Lateral(paso)}
    <section class="rep-v2-main" aria-labelledby="repasoV2Titulo">
      ${repasoV2Cabecera(paso)}
      <div class="rep-v2-cuerpo">${contenido.cuerpo}</div>
      <div class="rep-v2-pie">${atajos}${contenido.pie}</div>
    </section>
  </div>`;
}

function repasoV2Tic() {
  if (!repasoV2 || repasoV2.final !== undefined) return;
  const texto = repasoV2Duracion((Date.now() - repasoV2.inicio) / 1000);
  document.querySelectorAll("[data-rep-v2-reloj]").forEach((el) => { if (el.textContent !== texto) el.textContent = texto; });
}

// ---------- acciones ----------

function repasoV2GuardarSaldos() {
  const engine = globalThis.FinanceCanonicalBalancePulse;
  const modelo = repasoV2Modelo();
  if (!engine || !repasoV2SaldosListos(modelo)) return;
  const antes = { balances: accountBalancesFromState(), date: state.balanceDate };
  const siguiente = engine.resultingBalances(modelo, { caixa: antes.balances.caixa, mediolanum: antes.balances.mediolanum });
  modelo.items.forEach((item) => {
    if (repasoV2.respuestas[item.id] === "corregido") siguiente[item.id] = round2(parseAmountField(repasoV2.escritos[item.id]));
  });
  // El tiempo del paso de saldos cuenta también para WP-26 (actualizar las cuentas en ≤ 20 s), como el pulso de Registrar.
  const segundos = (Date.now() - repasoV2.inicioPaso) / 1000;
  if (typeof writeBalancePulseTimes === "function" && segundos > 0 && segundos <= 600) {
    const coincided = modelo.items.filter((item) => repasoV2.respuestas[item.id] === "coincide").length;
    writeBalancePulseTimes(engine.recordTiming(readBalancePulseTimes(), { date: repasoV2Hoy(), seconds: segundos, coincided, corrected: modelo.items.length - coincided }));
  }
  // Saldos del banco = modo manual. Los selectores de modo son la fuente que vuelve a leer readStateFromControls (app.js):
  // si se quedaran en «auto», el siguiente repintado devolvería los saldos calculados.
  const modoAntes = state.balanceMode;
  repasoV2Modo("manual");
  setBalancePulseState(siguiente, repasoV2Hoy());
  showUndoToast("Saldos al día.", () => {
    repasoV2Modo(modoAntes || "auto");
    setBalancePulseState({ caixa: antes.balances.caixa, mediolanum: antes.balances.mediolanum }, antes.date);
    if (modoAntes !== "manual") {
      state.balanceMode = modoAntes || "auto";
      saveBalanceSettings();
      render();
    }
  }, 8000);
  repasoV2.hecho.saldos = true;
  repasoV2Avanzar();
}

function repasoV2Modo(modo) {
  ["balanceMode", "registrarBalanceMode", "visualBalanceMode"].forEach((id) => { if (qs(id)) qs(id).value = modo; });
}

function repasoV2Avanzar() {
  repasoV2.paso = Math.min(REPASO_V2_PASOS.length - 1, repasoV2.paso + 1);
  repasoV2.inicioPaso = Date.now();
  if (repasoV2.paso === REPASO_V2_PASOS.length - 1 && repasoV2.final === undefined) repasoV2Terminado();
  repasoV2Render();
  qs("repasoV2Titulo")?.focus();
}

// Al llegar a «Listo»: se para el reloj y se guarda el repaso. Cuenta como acción en el medidor; cerrar antes, como
// descarte (XUX-03: se retira si se abandona a medias más de la mitad de las veces).
function repasoV2Terminado() {
  repasoV2.final = (Date.now() - repasoV2.inicio) / 1000;
  const store = repasoV2Leer();
  store.runs.push({ date: repasoV2Hoy(), seconds: Math.round(repasoV2.final), saldos: Boolean(repasoV2.hecho.saldos), importado: Boolean(repasoV2.hecho.importado) });
  repasoV2Guardar(store);
  globalThis.FinanceMedidor?.anotar("repaso-v2", "accion", { segundos: repasoV2.final });
}

function repasoV2IrA(destino) {
  repasoV2.fuera = true;
  repasoV2.movimientosAntes = (baseData?.transactions || []).length;
  qs("repasoV2")?.close();
  if (document.getElementById(destino)?.classList.contains("view-section")) {
    history.pushState(null, "", `#${destino}`);
    setActiveView(destino);
  }
  repasoV2Pildora();
}

// Mientras se importa, una píldora fija lleva de vuelta al repaso, al paso siguiente, con el reloj corriendo.
function repasoV2Pildora() {
  let pildora = qs("repasoV2Volver");
  if (!pildora) {
    pildora = document.createElement("button");
    pildora.type = "button";
    pildora.id = "repasoV2Volver";
    pildora.className = "rep-v2-pildora";
    pildora.addEventListener("click", () => {
      pildora.remove();
      if (repasoV2) {
        repasoV2.fuera = false;
        repasoV2.hecho.importado = repasoV2.hecho.importado || (baseData?.transactions || []).length > (repasoV2.movimientosAntes ?? Infinity);
        repasoV2Avanzar();
        repasoV2Mostrar();
      }
    });
    document.body.appendChild(pildora);
  }
  pildora.innerHTML = `${repasoV2Icono('<circle cx="12" cy="12" r="8.5"></circle><path d="M12 7.5V12l3 2"></path>')}<span>Seguir con el repaso · <span data-rep-v2-reloj>${repasoV2Duracion((Date.now() - repasoV2.inicio) / 1000)}</span></span><span aria-hidden="true">›</span>`;
}

function repasoV2Clasificar(opener) {
  const clas = qs("clasificarV2");
  if (!clas || typeof clasificarV2Open !== "function") return;
  // Al cerrar Clasificar se vuelve al repaso, con la bandeja ya recontada.
  clas.addEventListener("close", () => {
    if (!repasoV2 || !qs("repasoV2")?.open) return;
    repasoV2Render();
    qs("repasoV2")?.querySelector("[data-rep-v2-seguir], [data-rep-v2-clasificar]")?.focus();
  }, { once: true });
  clasificarV2Open(opener);
}

function repasoV2Cerrar() {
  qs("repasoV2")?.close();
}

function repasoV2BindOnce(dialog) {
  if (dialog.dataset.bound) return;
  dialog.dataset.bound = "1";
  dialog.addEventListener("click", (event) => {
    if (event.target === dialog || event.target.closest("[data-rep-v2-cerrar]")) return repasoV2Cerrar();
    const coincide = event.target.closest("[data-rep-v2-coincide]");
    if (coincide) {
      const id = coincide.dataset.repV2Coincide;
      repasoV2.respuestas = { ...repasoV2.respuestas, [id]: repasoV2.respuestas[id] === "coincide" ? "" : "coincide" };
      repasoV2Render();
      return dialog.querySelector(`[data-rep-v2-coincide="${CSS.escape(id)}"]`)?.focus();
    }
    const corregir = event.target.closest("[data-rep-v2-corregir]");
    if (corregir) {
      const id = corregir.dataset.repV2Corregir;
      repasoV2.respuestas = { ...repasoV2.respuestas, [id]: "corregido" };
      repasoV2Render();
      return dialog.querySelector(`[data-rep-v2-saldo="${CSS.escape(id)}"]`)?.focus();
    }
    if (event.target.closest("[data-rep-v2-guardar]")) return repasoV2GuardarSaldos();
    if (event.target.closest("[data-rep-v2-seguir]")) return repasoV2Avanzar();
    if (event.target.closest("[data-rep-v2-importar]")) {
      repasoV2IrA("datos-importar");
      return globalThis.importarV2Elegir?.(); // XDA-02 · PR-1: el selector de archivos se abre ya
    }
    const clasificar = event.target.closest("[data-rep-v2-clasificar]");
    if (clasificar) return repasoV2Clasificar(clasificar);
    if (event.target.closest("[data-rep-v2-terminar]")) return repasoV2Cerrar();
    // Las respuestas a cobros y cargos las aplica esperados-ui.js (delegación en el documento, que va después de
    // este oyente): se repinta en cuanto terminan.
    if (event.target.closest("[data-home-expected]")) {
      setTimeout(() => {
        repasoV2Render();
        dialog.querySelector("[data-expected-amount]")?.focus();
      }, 0);
    }
  });
  dialog.addEventListener("input", (event) => {
    const campo = event.target.closest("[data-rep-v2-saldo]");
    if (!campo) return;
    const id = campo.dataset.repV2Saldo;
    repasoV2.escritos = { ...repasoV2.escritos, [id]: campo.value };
    // Solo la línea de la diferencia y el botón: repintar todo movería el cursor.
    const item = repasoV2Modelo()?.items.find((candidate) => candidate.id === id);
    const valor = parseAmountField(campo.value);
    const nota = qs(`repasoV2Dif-${id}`);
    if (nota && item) {
      const diferencia = valor !== null && item.known.value !== null ? round2(valor - item.known.value) : null;
      nota.textContent = campo.value && valor === null ? "Eso no es un importe: escribe solo la cifra (1.234,56)." : diferencia !== null ? `Diferencia ${diferencia > 0 ? "+" : ""}${formatAmountField(diferencia)} €. La previsión se recalcula al guardar.` : "La previsión se recalcula al guardar.";
    }
    const modelo = repasoV2Modelo();
    const listos = repasoV2SaldosListos(modelo);
    const guardar = dialog.querySelector("[data-rep-v2-guardar]");
    if (guardar) guardar.disabled = !listos;
    const falta = dialog.querySelector(".rep-v2-falta");
    if (falta) {
      falta.hidden = listos;
      falta.textContent = listos ? "" : `Falta responder ${repasoV2Faltan(modelo)}.`;
    }
  });
  // Atajos del handoff (§5b): C coincide (la primera cuenta sin responder), E editar, ↵ seguir.
  dialog.addEventListener("keydown", (event) => {
    if (event.key === "Enter" && event.target.matches("[data-rep-v2-saldo]")) {
      event.preventDefault();
      return dialog.querySelector("[data-rep-v2-guardar]:not(:disabled)")?.click();
    }
    if (event.target.matches("input, select, textarea, button") || event.metaKey || event.ctrlKey || event.altKey || repasoV2?.paso !== 0) return;
    const key = event.key.toLowerCase();
    if (key === "c") dialog.querySelector(".rep-v2-cuenta:not(.is-coincide):not(.is-corrigiendo) [data-rep-v2-coincide]:not(:disabled)")?.click();
    else if (key === "e") dialog.querySelector(".rep-v2-cuenta:not(.is-corrigiendo) [data-rep-v2-corregir]")?.click();
    else if (event.key === "Enter") dialog.querySelector("[data-rep-v2-guardar]:not(:disabled), [data-rep-v2-seguir]")?.click();
  });
  dialog.addEventListener("close", () => {
    clearInterval(repasoV2Reloj);
    repasoV2Reloj = 0;
    if (repasoV2?.fuera) return; // se ha ido a importar: la píldora lo trae de vuelta
    if (repasoV2 && repasoV2.final === undefined) globalThis.FinanceMedidor?.anotar("repaso-v2", "descarte");
    const opener = repasoV2?.opener;
    repasoV2 = null;
    dialog.innerHTML = "";
    qs("repasoV2Volver")?.remove();
    globalThis.movimientosV2Render?.();
    // Abierto desde Hoy (cambio 2): Hoy se repinta para quitar la entrada si el repaso ya está hecho, y el foco vuelve a
    // la entrada nueva o, si ya no está, al primer botón de Hoy.
    const desdeHoy = Boolean(opener?.hasAttribute?.("data-hoy-v2-repaso")); // por el atributo: un repintado lo desconecta
    if (desdeHoy && typeof renderHomeDashboard === "function") renderHomeDashboard();
    const vuelta = opener?.isConnected ? opener : desdeHoy ? qs("hoyV2")?.querySelector("[data-hoy-v2-repaso]") || qs("hoyV2")?.querySelector("button") : null;
    vuelta?.focus?.();
  });
}

function repasoV2Mostrar() {
  const dialog = qs("repasoV2");
  if (!dialog || !repasoV2) return;
  repasoV2BindOnce(dialog);
  repasoV2Render();
  if (typeof dialog.showModal === "function" && !dialog.open) dialog.showModal();
  clearInterval(repasoV2Reloj);
  repasoV2Reloj = setInterval(repasoV2Tic, 1000);
  qs("repasoV2Titulo")?.focus();
}

function repasoV2Open(opener = null) {
  if (!repasoV2Active()) return;
  qs("repasoV2Volver")?.remove();
  repasoV2 = { paso: 0, inicio: Date.now(), inicioPaso: Date.now(), respuestas: {}, escritos: {}, hecho: {}, fuera: false, opener };
  globalThis.FinanceMedidor?.anotar("repaso-v2", "vista"); // XGO-02
  repasoV2Mostrar();
}

globalThis.repasoV2Open = repasoV2Open;
