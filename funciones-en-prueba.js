// XGO-03 · «Funciones en prueba» (nombre elegido por el hogar, P8; ficha XGO-03 de
// docs/PROPUESTA_SEPTIMA_AUDITORIA_2026-10-17.md y referencias/png/LoQuePide.png, bloque «Laboratorio»).
//
// Lo nuevo se prueba aquí antes de quedarse: cada función con su fecha de entrada, su métrica y su revisión. A las dos
// semanas la app pregunta si se queda (P9: aviso en la app y confirmación a mano): «Graduar» lo anota con su fecha y
// «Dos semanas más» aplaza la pregunta. Graduar NO borra la versión antigua: retirarla se hace después y con el visto
// bueno del hogar (CLAUDE.md).
//
// Primer interruptor: el diseño nuevo (tema v2, docs/rediseno/ESTADO.md §4). Encenderlo o apagarlo recarga con
// ?tema=v2 o ?tema=clasico, así que tema-v2.js sigue siendo el único que guarda la elección y el script en línea de
// <head> el único que la lee antes de pintar. Las pantallas del rediseño van con ese interruptor (hoy no tienen bandera
// propia) y cada una lleva su propia revisión.
//
// La tarjeta está en los dos temas: desde el clásico es la forma de volver al diseño nuevo sin tocar la URL. Las
// decisiones se guardan en este navegador, como la elección de tema. Junto a la métrica de cada función va lo que ha
// medido el medidor de utilidad (XGO-02, medidor-utilidad.js), para revisar con datos y no por impresión.
(function exposeFinanceFuncionesEnPrueba(root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.FinanceFuncionesEnPrueba = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function createFinanceFuncionesEnPrueba() {
  "use strict";

  const STORAGE_KEY = "funciones-en-prueba";
  const REVISION_DIAS = 14;
  const VOLVER_KEY = "funciones-en-prueba-volver";
  // Interruptores propios (`interruptor: "propio"`): encendida o no y desde cuándo, en este navegador. Desde el 29/10/2026 nacen
  // ENCENDIDOS (decisión del hogar: «vamos a cambiar esta regla de "todo lo nuevo nace apagado"»): `encendidaDesde` es el día en que
  // empezó a verse sin tocar nada, y su revisión cuenta desde entonces. Apagarla queda guardado aquí y manda sobre ese valor.
  const BANDERAS_KEY = "funciones-en-prueba-banderas";

  // Todo lo nuevo entra aquí. `interruptor: "tema"` es el diseño nuevo; `parteDe` dice con qué interruptor va una
  // función que aún no tiene bandera propia. Una función nueva con bandera propia nace encendida desde el 29/10/2026, con
  // `encendidaDesde` (antes nacía apagada, ficha XGO-03); se apaga con su interruptor.
  const CATALOGO = [
    { id: "tema-v2", nombre: "Diseño nuevo", queHace: "El aspecto nuevo de toda la app. Apagado, vuelve el de siempre.", desde: "2026-10-19", metrica: "que lo uséis sin volver al de siempre", interruptor: "tema" },
    { id: "hoy-v2", nombre: "Hoy nuevo", queHace: "Una cifra, hasta tres decisiones y el mes en una barra.", desde: "2026-10-19", metrica: "tiempo hasta la primera acción", parteDe: "tema-v2" },
    { id: "movimientos-v2", nombre: "Movimientos nuevo", queHace: "Bandeja arriba y la lista por día con su partida.", desde: "2026-10-21", metrica: "extractos importados por semana", parteDe: "tema-v2" },
    { id: "importar-v2", nombre: "Importar en tres pasos", queHace: "Elegir, revisar con cuadre e importar con deshacer.", desde: "2026-10-21", metrica: "extractos importados por semana", parteDe: "tema-v2" },
    { id: "clasificar-v2", nombre: "Clasificar por lotes", queHace: "Los conceptos sin partida, de cinco en cinco, con propuesta.", desde: "2026-10-21", metrica: "gasto importado con partida (95 % o más), propuestas aceptadas tal cual y segundos por grupo (4 o menos)", parteDe: "tema-v2" },
    { id: "repaso-v2", nombre: "Repaso semanal", queHace: "Saldos, extracto, lo que vino y la bandeja, en orden y con cronómetro.", desde: "2026-10-24", metrica: "minutos de mantenimiento a la semana (10 o menos)", parteDe: "tema-v2" },
    // XPR-06 (26/10/2026): la primera con interruptor propio; su revisión cuenta desde el día en que se enciende.
    { id: "banda-dia", nombre: "Qué mueve cada día", queHace: "En Plan › Previsión, la banda de caja a 30 días dice qué entra y sale el día que elijas, con qué certeza y, si la fecha es estimada, dónde indicarla.", desde: "2026-10-26", metrica: "días de cargo indicados desde aquí; se retira si nadie lo usa en dos meses", interruptor: "propio", encendidaDesde: "2026-10-29" },
    // XDA-01 · PR-1 (26/10/2026): lo que cuesta mantener cada función, en Ajustes › Uso de la app.
    { id: "lo-que-pide", nombre: "Lo que la app te pide", queHace: "En Ajustes › Uso de la app, qué datos pide cada función, cada cuánto, cuántos minutos a la semana y cuáles tienen hambre.", desde: "2026-10-26", metrica: "datos que faltaban y se dan desde aquí; se retira si nadie la abre en dos meses", interruptor: "propio", encendidaDesde: "2026-10-29" },
    // XUX-02 · PR-1 (27/10/2026): «Ver cómo quedaría» en las tarjetas vacías que piden un alta (de momento, el plan B y la política de inversión).
    { id: "ver-ejemplo", nombre: "Ver con datos de ejemplo", queHace: "En las tarjetas vacías que piden un alta (plan B, política de inversión), «Ver cómo quedaría» con un hogar inventado y lo que hace falta para verlo con lo vuestro.", desde: "2026-10-27", metrica: "altas empezadas después de ver el ejemplo; se retira si no suben", interruptor: "propio", encendidaDesde: "2026-10-29" },
    // XPR-07 · PR-1 (27/10/2026): solo se ve si la trayectoria «según el plan» baja del suelo en los próximos 30 días.
    { id: "descubierto", nombre: "El arreglo más barato", queHace: "En Plan › Previsión, si la liquidez prevista baja del suelo en los próximos 30 días: cuánto falta y la combinación más barata para no bajar (gasto discrecional, colchón, línea de crédito).", desde: "2026-10-27", metrica: "descubiertos previstos que dejan de estarlo antes de su fecha; se queda dormida si no hay ninguno en seis meses", interruptor: "propio", encendidaDesde: "2026-10-29" },
    // XDA-10 · PR-1 (27/10/2026): bajo el veredicto del guardarraíl de colchón (amortizar una deuda, garantía del Lombard).
    { id: "antes-de-decidir", nombre: "Antes de decidir", queHace: "En los simuladores que miran el colchón (amortizar una deuda, garantía del Lombard), si los saldos son antiguos, dice si lo que han podido moverse cambiaría el veredicto.", desde: "2026-10-27", metrica: "decisiones tomadas con datos frescos; si nunca salta porque los datos siempre están al día, queda como etiqueta", interruptor: "propio", encendidaDesde: "2026-10-29" },
    // WP-18 · PR-1 (28/10/2026): en Inversión › Cartera, de cada 100 € cuántos pusisteis y cuántos el mercado, y la TWR junto a la XIRR.
    { id: "aportado", nombre: "Aportado frente a valor", queHace: "En Inversión › Cartera, de cada 100 € de la cartera cuántos pusisteis y cuántos el mercado, y lo que hizo el mercado (TWR) junto a lo que ganó vuestro dinero (XIRR).", desde: "2026-10-28", metrica: "que la miréis tras cada valoración; se retira si en dos meses con valoraciones nadie la abre", interruptor: "propio", encendidaDesde: "2026-10-29" },
    // WP-17 (28/10/2026): la siguiente acción de la cartera por reglas fijas. Nace apagada; su revisión cuenta desde que se enciende.
    { id: "siguiente-paso", nombre: "Siguiente paso de la cartera", queHace: "Arriba de Inversión › Cartera, la cartera en una línea y una sola acción con su motivo: valorar, lo que choca con vuestra política, el reparto, la fiscalidad antes del 31/12, la política o la convicción.", desde: "2026-10-28", metrica: "acciones seguidas desde aquí; se retira si en dos meses nadie sigue ninguna", interruptor: "propio", encendidaDesde: "2026-10-29" },
    // NIN-08 (docs/WP42_DISENO.md §7): lo construido el 30/10 se publica tras firmar el cierre de octubre (decisión del hogar del 30/10).
    { id: "dinero-parado", nombre: "Dinero parado", queHace: "En Deuda › Comparar, arriba de la escalera del próximo euro: cuánto hay por encima del colchón que la previsión no toca en 3, 6 y 12 meses, y cuánto rendiría neto en una cuenta, un depósito o letras con los tipos que escribáis.", desde: "2026-11-04", metrica: "veces que se lleva a la escalera o se compara; se retira si en dos meses nadie lo hace", interruptor: "propio", encendidaDesde: "2026-11-04" },
    // Guía del cierre (29/10/2026): la pidió el hogar para seguirla cada mes, así que no nace apagada; su revisión, a las dos semanas.
    { id: "cierre-guia", nombre: "Guía del cierre", queHace: "En Cierre, los pasos del cierre de mes con dónde se hace cada uno, si bloquea la firma y qué hacer si algo no cuadra. Del 1 al 3 sale abierta.", desde: "2026-10-29", metrica: "cierres firmados con la guía abierta; se pliega si nadie la abre en dos cierres" },
  ];

  function isoDate(date) {
    const pad = (n) => String(n).padStart(2, "0");
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
  }

  function addDays(iso, days) {
    const [y, m, d] = String(iso).split("-").map(Number);
    return isoDate(new Date(y, m - 1, d + days));
  }

  function shortDate(iso) {
    const [y, m, d] = String(iso).split("-").map(Number);
    return new Intl.DateTimeFormat("es-ES", { day: "numeric", month: "short" }).format(new Date(y, m - 1, d)).replace(".", "");
  }

  function readDecisions(storage) {
    try {
      const parsed = JSON.parse(storage?.getItem(STORAGE_KEY) || "{}");
      return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
    } catch {
      return {};
    }
  }

  function writeDecisions(storage, decisions) {
    try {
      storage?.setItem(STORAGE_KEY, JSON.stringify(decisions));
      return true;
    } catch {
      return false;
    }
  }

  function readBanderas(storage) {
    try {
      const parsed = JSON.parse(storage?.getItem(BANDERAS_KEY) || "{}");
      return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
    } catch {
      return {};
    }
  }

  // Enciende o apaga un interruptor propio. Encender anota el día: la prueba (y su revisión) empieza entonces, no al publicarse.
  function cambiarBandera(banderas, id, encender, hoy) {
    return { ...banderas, [id]: encender ? { on: true, desde: hoy } : { on: false } };
  }

  // Lo que se haya elegido en este navegador manda; sin elección, lo que diga el catálogo (`encendidaDesde`: encendida de serie).
  function estaEncendida(item, banderas = {}) {
    const bandera = banderas[item?.id];
    return bandera && typeof bandera.on === "boolean" ? bandera.on : Boolean(item?.encendidaDesde);
  }

  /** Si una función con interruptor propio está encendida en este navegador (las demás no se preguntan aquí). */
  function encendida(id, storage = safeStorage()) {
    return estaEncendida(CATALOGO.find((item) => item.id === id) || { id }, readBanderas(storage));
  }

  // Estado de una función hoy: graduada (con fecha) o en prueba, con su fecha de revisión y si ya toca. Una función
  // que va con un interruptor apagado no pide revisión: no se está probando. Con interruptor propio, la prueba empieza
  // el día en que se encendió (`banderas`).
  function estadoDe(item, decisions = {}, hoy = isoDate(new Date()), encendidas = {}, banderas = {}) {
    const decision = decisions[item.id] || {};
    if (decision.estado === "graduada") return { estado: "graduada", fecha: decision.fecha || "" };
    const desde = item.interruptor === "propio" ? (banderas[item.id]?.on === true && banderas[item.id].desde) || item.encendidaDesde || item.desde : item.desde;
    const revision = addDays(decision.revisarDesde || desde, REVISION_DIAS);
    const activa = item.parteDe ? Boolean(encendidas[item.parteDe]) : item.interruptor ? Boolean(encendidas[item.id]) : true;
    return { estado: "en-prueba", desde, revision, activa, tocaRevisar: activa && hoy >= revision };
  }

  function porRevisar(decisions, hoy, encendidas, catalogo = CATALOGO, banderas = {}) {
    return catalogo.filter((item) => estadoDe(item, decisions, hoy, encendidas, banderas).tocaRevisar);
  }

  function graduar(decisions, id, hoy) {
    return { ...decisions, [id]: { estado: "graduada", fecha: hoy } };
  }

  function aplazar(decisions, id, hoy) {
    return { ...decisions, [id]: { estado: "en-prueba", revisarDesde: hoy } };
  }

  // URL a la que se va al mover el interruptor del diseño nuevo: la misma página con ?tema=… y en Ajustes.
  function urlTema(href, encender) {
    const url = new URL(href);
    url.searchParams.set("tema", encender ? "v2" : "clasico");
    url.hash = "ajustes";
    return url.toString();
  }

  // ---------- Pintado (solo en el navegador) ----------

  function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
  }

  function filaHtml(item, estado, encendidas) {
    const head = `<span class="fep-texto"><b>${escapeHtml(item.nombre)}</b><span class="fep-meta">${escapeHtml(item.queHace)}</span>`;
    let linea;
    if (estado.estado === "graduada") linea = `graduada el ${shortDate(estado.fecha)}${item.interruptor ? " · la versión de siempre sigue disponible" : ""}`;
    else if (!estado.activa) linea = item.parteDe ? "va con el diseño nuevo, que está apagado" : item.interruptor === "propio" ? "apagada: enciéndela para probarla; la revisión cuenta desde ese día" : "apagado: estáis viendo el diseño de siempre";
    else linea = `en prueba desde el ${shortDate(estado.desde)} · revisión el ${shortDate(estado.revision)} · mide: ${escapeHtml(item.metrica)}`;
    // XGO-02: lo medido hasta hoy, en este navegador.
    const medidor = globalThis.FinanceMedidor;
    const dato = item.id === "clasificar-v2" ? globalThis.clasificarV2CoberturaFrase?.() || "" : ""; // XDA-05
    const medido = medidor && estado.estado !== "graduada" ? `<span class="fep-meta fep-medido">Medido: ${escapeHtml(medidor.frase(item.id, medidor.resumen(medidor.leer(), item.id)))}${dato ? ` · ${escapeHtml(dato)}` : ""}</span>` : "";
    let lado = "";
    if (item.interruptor) {
      const on = Boolean(encendidas[item.id]);
      lado = `<button type="button" class="fep-switch" role="switch" aria-checked="${on}" aria-label="${escapeHtml(item.nombre)}" data-fep-interruptor="${item.id}"><span aria-hidden="true"></span></button>`;
    } else if (estado.estado === "graduada") {
      lado = `<span class="fep-chip is-graduada">graduada</span>`;
    }
    const pregunta = estado.tocaRevisar
      ? `<div class="fep-revision" role="group" aria-label="Revisión de ${escapeHtml(item.nombre)}">
          <p><strong>Dos semanas en prueba: ¿se queda?</strong> Graduar no borra la versión de siempre; queda anotado para retirarla con vuestro visto bueno.</p>
          <div class="fep-revision-botones">
            <button type="button" class="e19-btn e19-btn-primary" data-fep-graduar="${item.id}">Graduar</button>
            <button type="button" class="e19-btn e19-btn-secondary" data-fep-aplazar="${item.id}">Dos semanas más</button>
          </div>
        </div>`
      : "";
    return `<li class="fep-fila${item.parteDe ? " is-hija" : ""}${estado.tocaRevisar ? " is-revisar" : ""}" data-fep-id="${item.id}">
        <div class="fep-fila-main">${head}<span class="fep-meta fep-estado">${linea}</span>${medido}</span>${lado}</div>
        ${pregunta}
      </li>`;
  }

  function encendidasAhora(doc, banderas = {}) {
    const propias = Object.fromEntries(CATALOGO.filter((item) => item.interruptor === "propio").map((item) => [item.id, estaEncendida(item, banderas)]));
    return { "tema-v2": doc.documentElement.dataset.tema === "v2", ...propias };
  }

  function render(doc = globalThis.document, storage = safeStorage(), hoy = isoDate(new Date())) {
    const lista = doc?.getElementById("funcionesEnPruebaLista");
    if (!lista) return;
    const decisions = readDecisions(storage);
    const banderas = readBanderas(storage);
    const encendidas = encendidasAhora(doc, banderas);
    // Las que van con otro interruptor se agrupan bajo él, con un subtítulo, en vez de repetir la etiqueta en cada fila.
    const padres = CATALOGO.filter((item) => !item.parteDe);
    lista.innerHTML = padres
      .map((padre) => {
        const hijas = CATALOGO.filter((item) => item.parteDe === padre.id);
        const sub = hijas.length ? `<li class="fep-subtitulo fep-meta">Pantallas que van con «${escapeHtml(padre.nombre)}»</li>` : "";
        return [filaHtml(padre, estadoDe(padre, decisions, hoy, encendidas, banderas), encendidas), sub, ...hijas.map((item) => filaHtml(item, estadoDe(item, decisions, hoy, encendidas, banderas), encendidas))].join("");
      })
      .join("");
    const pendientes = porRevisar(decisions, hoy, encendidas, CATALOGO, banderas).length;
    const resumen = doc.getElementById("funcionesEnPruebaResumen");
    if (resumen) resumen.textContent = pendientes ? `${pendientes === 1 ? "Una función pide" : `${pendientes} funciones piden`} vuestra revisión.` : "";
    // P9: el aviso se ve desde cualquier pantalla, en la entrada «Ajustes» del menú y en su ancla de sección.
    const texto = pendientes ? `${pendientes} por revisar` : "";
    doc.querySelectorAll('a.nav-primary-link[href="#ajustes"], [data-ajustes-anchor="ajustes-laboratorio"]').forEach((el) => {
      let badge = el.querySelector(".fep-aviso");
      if (!texto) return badge?.remove();
      if (!badge) {
        badge = doc.createElement("span");
        badge.className = "fep-aviso";
        el.append(badge);
      }
      badge.textContent = texto;
    });
  }

  function safeStorage() {
    try {
      return globalThis.localStorage || null;
    } catch {
      return null;
    }
  }

  function bind(doc = globalThis.document) {
    const card = doc?.getElementById("funcionesEnPruebaCard");
    if (!card || card.dataset.bound) return;
    card.dataset.bound = "1";
    card.addEventListener("click", (event) => {
      const storage = safeStorage();
      const hoy = isoDate(new Date());
      const sw = event.target.closest("[data-fep-interruptor]");
      if (sw) {
        const encender = sw.getAttribute("aria-checked") !== "true";
        const item = CATALOGO.find((entry) => entry.id === sw.dataset.fepInterruptor);
        if (item?.interruptor === "propio") {
          // Sin recargar: se guarda, se repinta la tarjeta y la pantalla que la usa lo lee al pintarse.
          try {
            storage?.setItem(BANDERAS_KEY, JSON.stringify(cambiarBandera(readBanderas(storage), item.id, encender, hoy)));
          } catch {
            // Sin almacenamiento no se puede recordar: el interruptor se queda como estaba.
          }
          if (!encender) globalThis.FinanceMedidor?.anotar(item.id, "descarte");
          globalThis.render?.(); // la pantalla en curso se repinta ya con el interruptor nuevo (la tarjeta de XDA-01 vive en Ajustes)
          render(doc, storage, hoy);
          doc.querySelector(`[data-fep-interruptor="${item.id}"]`)?.focus();
          return;
        }
        if (!encender) globalThis.FinanceMedidor?.anotar("tema-v2", "descarte"); // XGO-02: volver al de siempre
        try {
          globalThis.sessionStorage?.setItem(VOLVER_KEY, "1");
        } catch {
          // Sin almacenamiento: se vuelve a Ajustes, pero sin bajar hasta la tarjeta.
        }
        globalThis.location.assign(urlTema(globalThis.location.href, encender));
        return;
      }
      const graduarBtn = event.target.closest("[data-fep-graduar]");
      const aplazarBtn = event.target.closest("[data-fep-aplazar]");
      if (!graduarBtn && !aplazarBtn) return;
      const id = (graduarBtn || aplazarBtn).dataset[graduarBtn ? "fepGraduar" : "fepAplazar"];
      const decisions = readDecisions(storage);
      writeDecisions(storage, graduarBtn ? graduar(decisions, id, hoy) : aplazar(decisions, id, hoy));
      render(doc, storage, hoy);
      doc.querySelector(`[data-fep-id="${id}"] .fep-estado`)?.setAttribute("tabindex", "-1");
      doc.querySelector(`[data-fep-id="${id}"] .fep-estado`)?.focus();
    });
  }

  function init(doc = globalThis.document) {
    if (!doc?.getElementById("funcionesEnPruebaCard")) return;
    bind(doc);
    render(doc);
    globalThis.addEventListener?.("hashchange", () => render(doc)); // lo medido (XGO-02) cambia en otras pantallas
    try {
      if (globalThis.sessionStorage?.getItem(VOLVER_KEY)) {
        globalThis.sessionStorage.removeItem(VOLVER_KEY);
        globalThis.setTimeout(() => doc.getElementById("funcionesEnPruebaCard")?.scrollIntoView({ block: "start" }), 300);
      }
    } catch {
      // Sin almacenamiento: nada que recordar.
    }
  }

  if (typeof document !== "undefined") {
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", () => init(document));
    else init(document);
  }

  return { STORAGE_KEY, BANDERAS_KEY, REVISION_DIAS, CATALOGO, addDays, estadoDe, porRevisar, graduar, aplazar, urlTema, readDecisions, writeDecisions, readBanderas, cambiarBandera, encendida, render, init };
});
