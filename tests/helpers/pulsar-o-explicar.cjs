// Pulsar un botón y, si no se puede, decir por qué. Dos pruebas fallan de vez en cuando en el CI y nunca en local:
// WP-40 (la CIRBE, Chromium: «element is not stable» durante 120 s al pulsar «Añadir fila») y el ensayo del cierre
// de octubre (WebKit: tras «Importar 5 movimientos», el diálogo de confirmar no llega a abrirse). La traza no se puede
// descargar desde la sesión de desarrollo (el proxy bloquea su almacenamiento) y la página como árbol accesible no
// enseña lo que se mueve. Con esto, el error del registro del CI dice qué pasaba en la página mientras se esperaba:
// si el botón se movía y cuánto, qué partes se repintaban, si la página se desplazaba, dónde estaba el foco, qué
// diálogos había abiertos y los últimos clics y cambios que recibió el documento. No reintenta ni espera más: el
// tiempo de cada prueba no cambia y un fallo de verdad sigue fallando.

// En la página: los últimos clics y «change» del documento, en fase de captura (antes que cualquier manejador de la
// app), para saber si un clic llegó, a qué elemento y en qué orden respecto a un cambio de campo.
async function registrarEventos(page) {
  await page.evaluate(() => {
    if (window.__pulsarEventos) return;
    window.__pulsarEventos = [];
    const nombre = (el) => (el && el.id ? `#${el.id}` : el && el.getAttribute ? `${el.tagName.toLowerCase()}${[...el.attributes].filter((a) => a.name.startsWith("data-")).map((a) => `[${a.name}]`).join("")}` : "?");
    for (const tipo of ["click", "change"]) {
      document.addEventListener(tipo, (event) => {
        window.__pulsarEventos.push({ tipo, en: nombre(event.target), ms: Math.round(performance.now()) });
        window.__pulsarEventos = window.__pulsarEventos.slice(-12);
      }, true);
    }
  });
}

// En la página, durante `ms`: cuántas veces cambia la caja del elemento y la posición de desplazamiento, y qué
// partes de la página (por su id más cercano) reciben mutaciones.
async function diagnostico(page, selector, ms = 1500) {
  return page.evaluate(({ selector, ms }) => new Promise((resolve) => {
    const el = document.querySelector(selector);
    const caja = () => {
      if (!el) return "no existe";
      const r = el.getBoundingClientRect();
      return `${Math.round(r.x)},${Math.round(r.y)} ${Math.round(r.width)}×${Math.round(r.height)}`;
    };
    const mutaciones = {};
    const observer = new MutationObserver((lista) => {
      for (const m of lista) {
        const id = (m.target.nodeType === 1 ? m.target : m.target.parentElement)?.closest?.("[id]")?.id || "(sin id)";
        mutaciones[id] = (mutaciones[id] || 0) + 1;
      }
    });
    observer.observe(document.body, { childList: true, subtree: true, attributes: true, characterData: true });
    const cajas = new Set([caja()]);
    const scrolls = new Set([Math.round(window.scrollY)]);
    const inicio = performance.now();
    const muestra = () => {
      cajas.add(caja());
      scrolls.add(Math.round(window.scrollY));
      if (performance.now() - inicio < ms) return requestAnimationFrame(muestra);
      observer.disconnect();
      const estilo = el ? getComputedStyle(el) : null;
      const activo = document.activeElement;
      resolve({
        elemento: el ? { conectado: el.isConnected, display: estilo.display, visibility: estilo.visibility, deshabilitado: Boolean(el.disabled) } : "no existe",
        cajasDistintas: cajas.size,
        cajas: [...cajas].slice(0, 4),
        scrollYDistintos: [...scrolls].slice(0, 6),
        mutacionesPorZona: Object.entries(mutaciones).sort((a, b) => b[1] - a[1]).slice(0, 6),
        foco: activo ? (activo.id ? `#${activo.id}` : activo.tagName.toLowerCase()) : null,
        dialogosAbiertos: [...document.querySelectorAll("dialog[open]")].map((d) => d.id || "(sin id)"),
        ultimosEventos: window.__pulsarEventos || "sin registrar",
      });
    };
    requestAnimationFrame(muestra);
  }), { selector, ms });
}

// Pulsa `selector` con el mismo comportamiento que locator.click(). Si no puede en `timeout`, falla con el
// diagnóstico delante del error de Playwright.
async function pulsar(page, selector, { timeout = 20000 } = {}) {
  try {
    await page.locator(selector).click({ timeout });
  } catch (error) {
    let diag;
    try {
      diag = await diagnostico(page, selector);
    } catch (fallo) {
      diag = { sinDiagnostico: String(fallo) };
    }
    throw new Error(`No se pudo pulsar ${selector} en ${timeout} ms. Lo que pasaba en la página durante 1,5 s: ${JSON.stringify(diag)}\n\n${error.message}`);
  }
}

module.exports = { pulsar, registrarEventos, diagnostico };
