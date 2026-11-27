// CAT-11 / TRE-12 (decimotercera auditoría §7; D-N46 decidida por el hogar el 27/11/2026, opción C con la ventana de la opción 3):
// «Preparar el plan de 2027 con lo real de 2026». Una línea en Plan › Mes (en los dos temas) abre una hoja con lo que cambiaría,
// partida a partida, lo que se queda como está y por qué, y «Qué ocurrirá» antes de escribir nada (decisión 6 de ESTADO.md §3).
//
// El cálculo es de canonical-plan-2027.js (puro); los datos, los mismos que la revisión base cero (baseCeroCollect, base-cero-ui.js),
// y la escritura, la de siempre del plan: se preparan las celdas en el borrador (cuadroMandosStageCell) y se guardan
// (saveVisualChanges), así que Previsión lo usa al momento. Con algo ya pendiente en el borrador no se aplica: «Guardar» se lo
// llevaría y «Descartar» lo perdería. Lo aplicado se puede deshacer entero: se guarda qué celdas cambiaron y su importe anterior.
//
// Desde octubre la línea ofrece el año que viene; de enero a marzo, el año en curso (H-38: repetirlo en marzo con más historia).
// Script de pantalla: comparte el ámbito global de app.js (qs, money, escapeHtml, isoLocalDate, storageGet/storageSet/storageKey,
// announceStatus, cuadroMandosAllMonths, cuadroMandosStageCell, saveVisualChanges, visualHasPendingChanges, isClosedMonthKey,
// baseCeroCollect, state, modelStartDate, monthKey). Se engancha al cargar, una sola vez (CAT-14); renderPlanMes (app.js) le pasa el motor y repinta
// la línea cada vez que pinta Plan › Mes.
(function attachPlan2027Ui(root) {
  "use strict";

  const PLAN_2027_CLAVE = "plan-2027-aplicado";
  const MEDIDOR = "plan-2027";
  let elecciones = {};
  let motorRecibido = null;
  let nota = "";

  const motor = () => motorRecibido; // lo pasa renderPlanMes (app.js) al pintar Plan › Mes
  const dialogo = () => (typeof qs === "function" ? qs("plan2027Dialogo") : null);
  const esc = (v) => escapeHtml(String(v ?? ""));
  const euros = (v) => money(Math.round(Number(v) || 0));
  const hoy = () => isoLocalDate(new Date());

  function añoObjetivo(fecha) {
    const [y, m] = String(fecha).split("-").map(Number);
    if (!y || !m) return null;
    if (m >= 10) return y + 1;
    if (m <= 3) return y;
    return null;
  }

  function mesesDe(año) {
    return cuadroMandosAllMonths().map((month) => month.key).filter((key) => key.startsWith(`${año}-`));
  }

  function nombreMes(key) {
    const [y, m] = String(key).split("-").map(Number);
    return new Intl.DateTimeFormat("es-ES", { month: "short" }).format(new Date(y, m - 1, 1)).replace(".", "");
  }

  function leerAplicado() {
    try {
      const raw = JSON.parse(storageGet(storageKey(PLAN_2027_CLAVE), "null"));
      return raw && Array.isArray(raw.cambios) && raw.cambios.length ? raw : null;
    } catch {
      return null;
    }
  }

  function guardarAplicado(valor) {
    try {
      storageSet(storageKey(PLAN_2027_CLAVE), valor ? JSON.stringify(valor) : "null");
    } catch {
      /* sin almacenamiento: el deshacer dura lo que la pestaña */
    }
  }

  function calcular() {
    const año = añoObjetivo(hoy());
    if (!año || !motor() || typeof baseCeroCollect !== "function") return null;
    const objetivo = mesesDe(año);
    if (objetivo.length !== 12) return null;
    const datos = baseCeroCollect();
    const partidas = datos.partidas
      .map((p) => ({ ...p, futureMonths: p.futureMonths.filter((k) => objetivo.includes(k)), planned: Object.fromEntries(objetivo.map((k) => [k, Number(p.planned[k] ?? 0)])) }))
      .filter((p) => p.futureMonths.length);
    const modelo = motor().buildModel({ partidas, windowMonths: datos.windowMonths, targetMonths: objetivo, today: hoy() });
    if (!modelo.calculable) return null;
    const cerrados = objetivo.filter((k) => isClosedMonthKey(k));
    return { año, modelo, cerrados };
  }

  // ---------- La línea de Plan › Mes ----------

  function pintarEntrada() {
    const entrada = qs("plan2027Entrada");
    if (!entrada) return;
    const año = añoObjetivo(hoy());
    const aplicado = leerAplicado();
    const visible = Boolean(año && mesesDe(año).length === 12 && motor());
    entrada.hidden = !visible;
    if (!visible) return;
    const texto = qs("plan2027Texto");
    const abrir = entrada.querySelector('[data-p27="abrir"]');
    const deshacer = entrada.querySelector('[data-p27="deshacer"]');
    if (aplicado && aplicado.año === año) {
      const [, m, d] = String(aplicado.fecha).split("-");
      texto.textContent = `Plan de ${año} preparado con lo real el ${Number(d)}/${Number(m)}: ${aplicado.cambios.length} ${aplicado.cambios.length === 1 ? "importe" : "importes"}.`;
      abrir.textContent = "Volver a prepararlo";
      deshacer.hidden = false;
    } else {
      texto.textContent = `¿Preparamos el plan de ${año} con lo real? Unos 10 minutos.`;
      abrir.textContent = `Preparar el plan de ${año}`;
      deshacer.hidden = true;
    }
  }

  // ---------- La hoja ----------

  function ahoraDe(item, objetivo) {
    const i = objetivo.indexOf(item.meses[0]);
    return i >= 0 ? item.previsto[i] : 0;
  }

  function filaCambio(item, objetivo) {
    const eleccion = elecciones[item.key] || item.porDefecto;
    const nombre = `p27-${item.key}`;
    const opcion = (valor, texto) => `<label><input type="radio" name="${esc(nombre)}" value="${valor}" data-p27-key="${esc(item.key)}"${eleccion === valor ? " checked" : ""}> ${texto}</label>`;
    const opciones = [
      item.tipo === "mensual" ? opcion("mediana", `Lo real: ${esc(euros(item.mediana))} al mes`) : "",
      item.alternativa ? opcion("trimestre", `El último trimestre: ${esc(euros(item.alternativa.importe))} al mes`) : "",
      opcion("mantener", `Dejarlo en ${esc(euros(ahoraDe(item, objetivo)))} al mes`),
    ].join("");
    return `<li class="p27-fila">
      <p class="p27-fila-titulo"><strong>${esc(item.label)}</strong> <span>${item.kind === "income" ? "ingreso" : "gasto"}</span></p>
      <p class="p27-fila-nota">${esc(item.porque)}${item.aviso ? ` ${esc(item.aviso.texto)}` : ""}</p>
      ${item.alternativa ? `<p class="p27-fila-aviso">${esc(item.alternativa.texto)}</p>` : ""}
      <fieldset class="p27-opciones"><legend>Para ${esc(item.label)}</legend>${opciones}</fieldset>
    </li>`;
  }

  function html(calc) {
    const { año, modelo, cerrados } = calc;
    const m = motor();
    const objetivo = modelo.targetMonths;
    const cambian = modelo.items.filter((i) => i.tipo === "mensual" || (i.tipo === "en-linea" && i.alternativa));
    const quedan = modelo.items.filter((i) => !cambian.includes(i));
    const ap = m.aplicable(modelo, elecciones, cerrados);
    const gastosNuevos = modelo.totales.gastos.previsto + m.cambios(modelo, elecciones, { mesesCerrados: cerrados })
      .filter((c) => modelo.items.find((i) => i.key === c.key)?.kind === "expense").reduce((s, c) => s + (c.to - c.from), 0);
    const ventana = modelo.windowMonths;
    const historia = ventana.length < 12
      ? `<p class="p27-historia">La base son ${ventana.length} meses (${esc(nombreMes(ventana[0]))}–${esc(nombreMes(ventana.at(-1)))}): la mediana de lo real en cada partida. En marzo se repite con más meses.</p>`
      : "";
    const pendiente = typeof visualHasPendingChanges === "function" && visualHasPendingChanges();
    const inicio = typeof modelStartDate === "function" ? monthKey(modelStartDate()) : ""; // donde la previsión empieza a componer la inflación
    const inflacion = m.inflacionTexto({ ...modelo, totales: { ...modelo.totales, gastos: { ...modelo.totales.gastos, propuesto: gastosNuevos } } }, state?.annualInflation, inicio);
    return `<div class="p27-in">
      <div class="p27-cabeza">
        <div><p class="p27-kicker">Plan de ${año}</p><h2 id="p27Titulo">Preparar ${año} con lo real</h2></div>
        <button type="button" class="e19-btn e19-btn-secondary p27-cerrar" data-p27="cerrar" aria-label="Cerrar «Preparar ${año} con lo real»">×</button>
      </div>
      <p class="p27-vista" aria-live="polite">Gastos de ${año}: <strong>${esc(euros(gastosNuevos))}</strong> frente a ${esc(euros(modelo.totales.gastos.previsto))} previstos hoy. Cambian ${ap.partidas} ${ap.partidas === 1 ? "partida" : "partidas"}.</p>
      ${historia}
      ${cambian.length ? `<section class="p27-grupo" aria-labelledby="p27Cambia"><h3 id="p27Cambia">Lo que cambia (${cambian.length})</h3><ul class="p27-lista">${cambian.map((i) => filaCambio(i, objetivo)).join("")}</ul></section>` : `<p class="p27-historia">Nada que cambiar: el plan de ${año} ya está en línea con lo real.</p>`}
      ${quedan.length ? `<details class="p27-grupo"><summary>Se queda como está (${quedan.length})</summary><ul class="p27-lista">${quedan.map((i) => `<li class="p27-fila"><p class="p27-fila-titulo"><strong>${esc(i.label)}</strong></p><p class="p27-fila-nota">${esc(i.porque)}</p></li>`).join("")}</ul></details>` : ""}
      <div class="p27-pie">
        <p class="p27-kicker">Qué ocurrirá</p>
        <p>${ap.celdas ? `Se escriben ${ap.celdas} importes de ${ap.partidas} ${ap.partidas === 1 ? "partida" : "partidas"} en el plan de ${año}.` : "No se escribe nada."}${ap.saltadas ? ` ${ap.saltadas} de meses ya cerrados no se tocan.` : ""} Previsión los usa en cuanto se aplican, y se puede deshacer entero.</p>
        ${inflacion ? `<p class="p27-fila-nota">${esc(inflacion)}</p>` : ""}
        ${pendiente ? '<p class="p27-fila-aviso" role="status">Tenéis cambios sin guardar en el plan. Guardadlos o descartadlos en Partidas antes de aplicar esto, para no mezclarlos.</p>' : ""}
        ${nota ? `<p class="p27-fila-aviso" role="status">${esc(nota)}</p>` : ""}
        <div class="p27-acciones">
          <button type="button" class="e19-btn e19-btn-primary" data-p27="aplicar"${ap.celdas && !pendiente ? "" : " disabled"}>Aplicar al plan de ${año}</button>
          <button type="button" class="e19-btn e19-btn-secondary" data-p27="cerrar">Cancelar</button>
        </div>
      </div>
    </div>`;
  }

  function pintarHoja() {
    const dlg = dialogo();
    if (!dlg) return;
    const calc = calcular();
    dlg.innerHTML = calc ? html(calc) : '<div class="p27-in"><div class="p27-cabeza"><h2 id="p27Titulo">Plan del año que viene</h2><button type="button" class="e19-btn e19-btn-secondary p27-cerrar" data-p27="cerrar" aria-label="Cerrar">×</button></div><p>No se puede preparar ahora: el plan no tiene los doce meses del año que viene.</p></div>';
  }

  function abrir() {
    const dlg = dialogo();
    if (!dlg || typeof dlg.showModal !== "function") return;
    elecciones = {};
    nota = "";
    pintarHoja();
    if (!dlg.open) dlg.showModal();
    dlg.querySelector('[data-p27="cerrar"]')?.focus?.();
    root.FinanceMedidor?.anotar?.(MEDIDOR, "vista");
  }

  function escribir(celdas) {
    let escritas = 0;
    celdas.forEach(({ key, monthKey, value }) => {
      if (cuadroMandosStageCell(key, monthKey, value)) escritas += 1;
    });
    if (escritas) saveVisualChanges();
    return escritas;
  }

  function aplicar() {
    const calc = calcular();
    if (!calc) return;
    if (typeof visualHasPendingChanges === "function" && visualHasPendingChanges()) {
      nota = "Hay cambios sin guardar en el plan: no se ha aplicado nada.";
      pintarHoja();
      return;
    }
    const lista = motor().cambios(calc.modelo, elecciones, { mesesCerrados: calc.cerrados });
    const escritas = escribir(lista.map((c) => ({ key: c.key, monthKey: c.monthKey, value: c.to })));
    guardarAplicado({ año: calc.año, fecha: hoy(), cambios: lista.map((c) => ({ key: c.key, monthKey: c.monthKey, from: c.from })) });
    root.FinanceMedidor?.anotar?.(MEDIDOR, "accion");
    dialogo()?.close();
    pintarEntrada();
    announceStatus(`Plan de ${calc.año} preparado: ${escritas} ${escritas === 1 ? "importe" : "importes"}. Previsión ya lo usa; se puede deshacer en Plan › Mes.`);
  }

  function deshacer() {
    const aplicado = leerAplicado();
    if (!aplicado) return;
    if (typeof visualHasPendingChanges === "function" && visualHasPendingChanges()) {
      announceStatus("Hay cambios sin guardar en el plan: guardadlos o descartadlos antes de deshacer.");
      return;
    }
    const escritas = escribir(aplicado.cambios.map((c) => ({ key: c.key, monthKey: c.monthKey, value: c.from })));
    guardarAplicado(null);
    pintarEntrada();
    announceStatus(`Deshecho: ${escritas} ${escritas === 1 ? "importe vuelve" : "importes vuelven"} a lo de antes.`);
  }

  function alPulsar(event) {
    const boton = event.target.closest("[data-p27]");
    if (!boton) return;
    const accion = boton.dataset.p27;
    if (accion === "abrir") abrir();
    else if (accion === "deshacer") deshacer();
    else if (accion === "cerrar") dialogo()?.close();
    else if (accion === "aplicar") aplicar();
  }

  function alCambiar(event) {
    const input = event.target.closest("input[data-p27-key]");
    if (!input) return;
    elecciones[input.dataset.p27Key] = input.value;
    pintarHoja();
    dialogo()?.querySelector(`input[name="${CSS.escape(input.name)}"][value="${CSS.escape(input.value)}"]`)?.focus?.();
  }

  function enganchar() {
    qs("plan2027Entrada")?.addEventListener("click", alPulsar);
    const dlg = dialogo();
    dlg?.addEventListener("click", alPulsar);
    dlg?.addEventListener("change", alCambiar);
    root.addEventListener("hashchange", () => { if (dlg?.open) dlg.close(); });
  }

  // Los scripts con defer corren antes que app.js (que define qs y compañía) y antes de DOMContentLoaded: engancharse ahí.
  if (document.readyState === "complete") enganchar();
  else document.addEventListener("DOMContentLoaded", enganchar, { once: true });

  // La llama renderPlanMes (app.js) con el motor, en los dos temas.
  root.renderPlan2027Entrada = (engine) => {
    motorRecibido = engine || null;
    pintarEntrada();
  };
  root.FinancePlan2027Ui = { abrir, aplicar, deshacer, pintarEntrada, añoObjetivo };
})(typeof globalThis !== "undefined" ? globalThis : this);
