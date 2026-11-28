/**
 * views/navegacion-v2.js · R2 (auditoría de diseño §4, D-N50; decimocuarta auditoría, CAT-06; 27/11/2026): la navegación de cinco
 * destinos del tema v2, de `Navegacion.png`, `HoyDesktop.png` (la barra lateral) y `Hoy.png` (la barra inferior).
 *
 *  - **El menú del escritorio:** «Buscar o hacer… ⌘K» arriba (el buscador de siempre, E17) y cinco destinos con su pregunta: Hoy,
 *    Movimientos, Plan, Patrimonio y Decidir. Bajo el destino en que se está, sus pantallas («Más»), con la actual marcada.
 *  - **La barra inferior del móvil:** los cinco destinos con su icono. Se esconde al bajar y vuelve al subir (DUO-05 rehecha: fija,
 *    tapaba controles cerca del borde), mientras se escribe en un campo y con el menú abierto; el cuerpo deja su alto libre al final,
 *    así que nada queda debajo de ella para siempre.
 *  - **No se retira ninguna pantalla** (decisión 5): el menú de siempre sigue en el DOM, con sus enlaces, ids y manejadores. Con el
 *    tema v2 sus entradas principales no se ven (cada una tiene su sitio en un destino, en su «Más» o en el pie) y «Herramientas
 *    avanzadas» pasa a llamarse «Más pantallas», plegada. En el clásico, nada cambia.
 *
 * Lo que decide a qué destino pertenece cada pantalla es `destinoDe` (puro, probado en `tests/r2-cinco-destinos.test.cjs`). app.js
 * llama a `renderNavegacionV2(viewId)` desde `setActiveView`, que es por donde pasa toda navegación (también los clics del menú de
 * siempre, que no cambian el hash con un `hashchange`).
 */
(function attachNavegacionV2(root) {
  "use strict";

  const ICONOS = {
    hoy: '<path d="M4 11.5 12 5l8 6.5V20a1 1 0 0 1-1 1h-4.5v-5.5h-5V21H5a1 1 0 0 1-1-1z"/>',
    movimientos: '<path d="M9 7h11M9 12h11M9 17h11"/><circle cx="5" cy="7" r="1"/><circle cx="5" cy="12" r="1"/><circle cx="5" cy="17" r="1"/>',
    plan: '<rect x="4" y="5.5" width="16" height="14.5" rx="2"/><path d="M4 10h16M8.5 3.5v4M15.5 3.5v4"/>',
    patrimonio: '<path d="m12 4 8.5 4.5L12 13 3.5 8.5z"/><path d="m3.5 12.5 8.5 4.5 8.5-4.5"/><path d="m3.5 16.5 8.5 4.5 8.5-4.5"/>',
    decidir: '<circle cx="12" cy="12" r="8.5"/><path d="m15.5 8.5-2 5-5 2 2-5z"/>',
  };

  // Cada destino: su entrada, su pregunta, las pantallas que le pertenecen y, de ellas, las que se ofrecen en su «Más». Los hashes son
  // los de siempre: ninguno cambia. Patrimonio entra por Deuda mientras no exista su Resumen (R3); Decidir, por Escenarios (el próximo
  // euro vive en Deuda › Plan desde TRE-D5b). Cada «Más», cuatro como mucho (la regla de profundidad del diseño); el resto, en «Más
  // pantallas» y en el buscador.
  const DESTINOS = [
    {
      id: "hoy", nombre: "Hoy", pregunta: "¿Vamos bien?", href: "home",
      vistas: ["home", "cuadro-mandos", "cambios-pendientes", "visual-detail", "alerts-center", "widget"],
      mas: [],
    },
    {
      id: "movimientos", nombre: "Movimientos", pregunta: "¿Qué ha pasado?", href: "movements",
      vistas: ["movements", "registrar", "update-hub", "cierre", "conciliar", "datos-importar", "registrar-mes", "data-entry", "update-data", "reconciliation", "data-audit", "herramientas-datos"],
      mas: [["registrar", "Registrar"], ["datos-importar", "Importar extracto"], ["cierre", "Cierre del mes"]],
    },
    {
      id: "plan", nombre: "Plan", pregunta: "¿Qué viene?", href: "plan",
      vistas: ["plan", "planificacion-partidas", "presupuesto-mes", "estado-semana", "prevision", "forecast", "mapa-calor", "analisis", "herramientas-analizar", "cashflow", "savings-plan", "savings-agent"],
      mas: [["presupuesto-mes", "Presupuesto del mes"], ["planificacion-partidas", "Partidas"], ["estado-semana", "Esta semana"]],
    },
    {
      id: "patrimonio", nombre: "Patrimonio", pregunta: "¿Cuánto tenemos y debemos?", href: "deuda-ruta",
      vistas: ["deuda-ruta", "deuda-contratos", "deuda-comparar", "deuda-prestamo", "deuda-simulador", "inversion-cartera", "inversion-rebalanceo", "inversion-fiscal", "inversion-jubilacion", "inversion-apalancamiento", "herramientas-patrimonio", "debt-roadmap", "debt-liquidation-plan", "debt-control"],
      mas: [["deuda-contratos", "Contratos de deuda"], ["inversion-cartera", "Inversión"], ["herramientas-patrimonio", "Comparadores"]],
    },
    {
      id: "decidir", nombre: "Decidir", pregunta: "¿Qué hacemos con el dinero?", href: "escenario-simular",
      vistas: ["escenario-simular", "escenario-aplicar", "escenario-guardados", "escenario-comparar", "asesor-decision", "segunda-opinion", "herramientas-seguros", "herramientas-fiscal", "executive-advisor", "virtual-advisor", "simulator", "new-life-simulation", "new-life-definitive"],
      mas: [["escenario-guardados", "Escenarios guardados"], ["asesor-decision", "Asesor ejecutivo"], ["segunda-opinion", "Segunda opinión"]],
    },
  ];
  // Fuera de los destinos, en el pie del menú (como en el diseño: Ajustes desde abajo).
  const PIE = [["ajustes", "Ajustes", "Cuentas, reserva, partidas y datos"], ["faqs-ayuda", "Ayuda", "Preguntas frecuentes y guía"]];

  const doc = () => (typeof document !== "undefined" ? document : null);
  const $ = (id) => doc()?.getElementById(id) || null;
  const esc = (v) => String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

  /** El destino de una pantalla, o null si es de las del pie (Ajustes, ayuda) o no tiene ninguno. */
  function destinoDe(viewId) {
    return DESTINOS.find((d) => d.vistas.includes(viewId))?.id || null;
  }

  const icono = (id) => `<svg class="nav-v2-icono" viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" focusable="false">${ICONOS[id] || ""}</svg>`;
  const actual = (cond) => (cond ? ' aria-current="page"' : "");

  /** El menú del escritorio: el buscador, los cinco destinos y el «Más» del destino en que se está. */
  function menuHtml(viewId) {
    const activo = destinoDe(viewId);
    const destinos = DESTINOS.map((d) => {
      const enEste = d.id === activo;
      const mas = enEste && d.mas.length
        ? `<ul class="nav-v2-mas" aria-label="Pantallas de ${esc(d.nombre)}">${d.mas.map(([vista, texto]) => `<li><a href="#${vista}"${actual(vista === viewId)}>${esc(texto)}</a></li>`).join("")}</ul>`
        : "";
      // aria-current="page" en la pantalla exacta (la entrada del destino o una de su «Más»); el destino que la contiene, «true».
      const marca = enEste ? (d.href === viewId ? ' aria-current="page"' : ' aria-current="true"') : "";
      return `<li class="nav-v2-destino${enEste ? " es-activo" : ""}" data-destino="${d.id}"><a href="#${d.href}"${marca}>${icono(d.id)}<span><strong>${esc(d.nombre)}</strong><small>${esc(d.pregunta)}</small></span></a>${mas}</li>`;
    }).join("");
    return `<button type="button" class="nav-v2-buscar" data-e17-open="launcher" aria-keyshortcuts="Meta+K Control+K"><svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" focusable="false"><circle cx="11" cy="11" r="6.5"/><path d="m16 16 4.5 4.5"/></svg><span>Buscar o hacer…</span><kbd>⌘K</kbd></button><ul class="nav-v2-destinos">${destinos}</ul>`;
  }

  /** El pie del menú: Ajustes (con el estado de guardado de siempre) y la ayuda. */
  function pieHtml(viewId, guardado) {
    return PIE.map(([vista, texto, nota], i) => `<a class="nav-v2-pie-enlace" href="#${vista}"${actual(vista === viewId)}><strong>${esc(texto)}</strong><small>${esc(i === 0 && guardado ? guardado : nota)}</small></a>`).join("");
  }

  /** La barra inferior del móvil: cinco destinos con su icono y su nombre. */
  function barraHtml(viewId) {
    const activo = destinoDe(viewId);
    return `<ul>${DESTINOS.map((d) => `<li><a href="#${d.href}" data-destino="${d.id}"${d.id === activo ? ' aria-current="page"' : ""}>${icono(d.id)}<span>${esc(d.nombre)}</span></a></li>`).join("")}</ul>`;
  }

  // «Local · guardado a las 14:49»: las palabras del chip de guardado de siempre (`updateSyncUi`), en una línea.
  function estadoGuardado() {
    const sello = $("durabilityBadge")?.textContent?.trim();
    const hora = $("durabilityTime")?.textContent?.trim().replace(/^Guardado/, "guardado");
    return [sello, hora].filter(Boolean).join(" · ").slice(0, 60);
  }

  const esV2 = () => doc()?.documentElement.dataset.tema === "v2";
  let ultimaVista = null;

  function render(viewId) {
    const d = doc();
    if (!d) return;
    // Al cambiar de pantalla la barra vuelve, y el desplazamiento cuenta desde aquí (el «volver arriba» de la app no la esconde).
    ultimoY = root.scrollY || 0;
    quietoHasta = Date.now() + 800;
    ocultarBarra(false);
    const vista = viewId || ultimaVista || (typeof viewFromHash === "function" ? viewFromHash() : (root.location?.hash || "#home").slice(1)) || "home";
    ultimaVista = vista;
    const menu = $("navDestinosV2");
    const pie = $("navPieV2");
    const barra = $("barraDestinosV2");
    const avanzadas = $("advancedNav")?.querySelector("summary > span");
    if (!esV2()) {
      [menu, pie, barra].forEach((el) => { if (el) { el.hidden = true; el.innerHTML = ""; } });
      d.documentElement.removeAttribute("data-barra-destinos");
      if (avanzadas?.dataset.original) avanzadas.textContent = avanzadas.dataset.original;
      return;
    }
    if (menu) { menu.innerHTML = menuHtml(vista); menu.hidden = false; }
    if (pie) { pie.innerHTML = pieHtml(vista, estadoGuardado()); pie.hidden = false; }
    if (barra) { barra.innerHTML = barraHtml(vista); barra.hidden = false; d.documentElement.setAttribute("data-barra-destinos", ""); }
    // TRE-08 abría «Herramientas avanzadas» sola al entrar en una pantalla suya, para que se viera dónde se estaba. Con los destinos eso
    // ya lo dice el destino marcado y su «Más»: abierta, el menú volvía a medir ~2.800 px. Abierta a mano, se queda.
    const grupo = $("advancedNav");
    if (grupo?.dataset.autoAbierto) {
      grupo.open = false;
      delete grupo.dataset.autoAbierto;
    }
    if (avanzadas && !avanzadas.dataset.original) {
      avanzadas.dataset.original = avanzadas.textContent;
      avanzadas.textContent = "Más pantallas";
    }
  }

  // ---- La barra que se esconde al bajar ----
  let ultimoY = 0;
  let quietoHasta = 0;
  function ocultarBarra(oculta) {
    const barra = $("barraDestinosV2");
    if (barra) barra.toggleAttribute("data-oculta", oculta);
  }
  // Solo el desplazamiento que hace el hogar (rueda, dedo o teclado) la esconde: el que hace la página sola al pintarse, al recuperar la
  // posición o al llevar algo a la vista, no (en Deuda la página baja ~90 px al pintarse y la barra se escondía nada más entrar).
  let tocadoHasta = 0;
  const alTocar = () => { tocadoHasta = Date.now() + 700; };
  function alDesplazar() {
    const y = root.scrollY || 0;
    // Al final de la pantalla vuelve siempre, llegue como llegue (un desplazamiento suave acaba después del gesto): lo último queda
    // por encima de ella, porque el cuerpo deja libre su alto.
    const alFinal = y + (root.innerHeight || 0) >= (doc().documentElement.scrollHeight || 0) - 2;
    if (alFinal) { ocultarBarra(false); ultimoY = y; return; }
    if (Date.now() < quietoHasta || Date.now() > tocadoHasta) { ultimoY = y; return; }
    const delta = y - ultimoY;
    if (Math.abs(delta) < 6) return;
    ocultarBarra(delta > 0 && y > 80);
    ultimoY = y;
  }
  const escribiendo = (el) => Boolean(el?.matches?.('input:not([type="checkbox"]):not([type="radio"]):not([type="range"]):not([type="button"]):not([type="submit"]), textarea, select, [contenteditable="true"]'));

  function cablear() {
    const d = doc();
    if (!d || d.__navegacionV2) return;
    d.__navegacionV2 = true;
    root.addEventListener?.("scroll", alDesplazar, { passive: true });
    for (const tipo of ["wheel", "touchmove"]) root.addEventListener?.(tipo, alTocar, { passive: true });
    d.addEventListener("keydown", (event) => { if (["ArrowDown", "ArrowUp", "PageDown", "PageUp", " ", "End", "Home"].includes(event.key)) alTocar(); });
    d.addEventListener("focusin", (event) => { if (escribiendo(event.target)) $("barraDestinosV2")?.toggleAttribute("data-escribiendo", true); });
    // Al tocar un botón con el teclado fuera, el campo pierde el foco al bajar el dedo (pointerdown). Si la barra volviera ahí, en
    // 150 ms ya tapaba lo que había debajo y el «soltar» caía en ella: el toque no llegaba al botón («Dar de alta» en Deuda ›
    // Contratos, 28/11/2026, en el CI de Safari tras R2). Vuelve cuando se suelta, después del clic, y solo si no se sigue escribiendo.
    let pulsando = false;
    let volverAlSoltar = false;
    const volverSiNoEscribe = () => {
      volverAlSoltar = false;
      root.setTimeout(() => { if (!escribiendo(doc().activeElement)) $("barraDestinosV2")?.removeAttribute("data-escribiendo"); }, 0);
    };
    d.addEventListener("pointerdown", () => { pulsando = true; }, true);
    for (const tipo of ["pointerup", "pointercancel"]) {
      d.addEventListener(tipo, () => { pulsando = false; if (volverAlSoltar) root.setTimeout(volverSiNoEscribe, 0); }, true);
    }
    d.addEventListener("focusout", () => { if (pulsando) volverAlSoltar = true; else volverSiNoEscribe(); });
    root.addEventListener?.("hashchange", () => { ocultarBarra(false); render(); });
    // El pie dice el guardado de ahora: cambia sin navegar.
    const sello = [$("durabilityBadge"), $("durabilityTime")].filter(Boolean);
    if (sello.length && typeof MutationObserver === "function") {
      const obs = new MutationObserver(() => {
        const nota = $("navPieV2")?.querySelector('a[href="#ajustes"] small');
        const texto = estadoGuardado();
        if (nota && texto) nota.textContent = texto;
      });
      sello.forEach((el) => obs.observe(el, { childList: true, characterData: true, subtree: true }));
    }
    // Los enlaces de los destinos y su «Más» cierran el menú del móvil, como los de siempre.
    d.addEventListener("click", (event) => {
      if (event.target.closest?.("#navDestinosV2 a, #navPieV2 a") && typeof setMobileNavOpen === "function") setMobileNavOpen(false);
    });
  }

  function iniciar() {
    cablear();
    render();
  }

  const api = { DESTINOS, PIE, destinoDe, menuHtml, pieHtml, barraHtml };
  root.renderNavegacionV2 = render;
  root.FinanceNavegacionV2 = api;
  if (typeof document !== "undefined" && document.addEventListener) {
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", iniciar);
    else iniciar();
  }
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
