// WP-28 (NPV-07, docs/WP28_DISENO.md): kit de gráficos táctil y accesible. SVG a mano, sin librerías.
//
// Qué resuelve: los gráficos de la app dependían de `title` nativo (sin ratón no hay hover) y cada uno resolvía la accesibilidad por su
// cuenta. El kit pone lo común en un sitio: (1) una frase automática que dice lo que el gráfico enseña, (2) recorrido con el dedo, el
// ratón o las flechas, con la lectura FIJA debajo del gráfico (un dedo tapa un tooltip flotante), (3) «Ver como tabla» con los mismos datos.
//
// Dos mitades, por la misma razón que el resto de la app:
//   · funciones PURAS que devuelven HTML o números (se prueban sin DOM): trendSentence, bandPlotHtml, figureHtml, tableHtml, nearestIndex…
//   · attach(document): una sola vez, con delegación de eventos; no hay estado en JS, todo vive en atributos del propio gráfico.
//
// No es un motor `canonical-*`: no calcula nada del hogar, solo dibuja y lee lo que le dan.

(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.ChartKit = factory();
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const esc = (value) =>
    String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
  const round2 = (value) => Math.round((Number(value) + Number.EPSILON) * 100) / 100;

  const HINT = "Toca o desliza por el gráfico, o usa las flechas ← →, para leer punto a punto.";
  const KEYS = Object.freeze({ ArrowLeft: -1, ArrowDown: -1, ArrowRight: 1, ArrowUp: 1 });

  // ---- Frase automática ----
  /**
   * La frase que resume un gráfico de una serie. Determinista y sin adjetivos: dice de dónde a dónde va, dónde está el extremo y, si se
   * le da un umbral (el suelo de la caja, el cero), cuándo lo cruza. Sin dato = lo dice.
   * @param {{subject: string, points: Array<{label: string, value: number}>, format?: (n: number) => string, threshold?: {value: number, label: string}|null}} spec
   */
  function trendSentence({ subject, points, format = (n) => String(round2(n)), threshold = null }) {
    const valid = (Array.isArray(points) ? points : []).filter((point) => Number.isFinite(point?.value));
    if (!valid.length) return `${subject}: sin datos.`;
    const first = valid[0];
    const last = valid[valid.length - 1];
    if (valid.length === 1) return `${subject}: ${format(first.value)} en ${first.label}.`;

    let min = first;
    let max = first;
    valid.forEach((point) => {
      if (point.value < min.value) min = point;
      if (point.value > max.value) max = point;
    });
    const range = max.value - min.value;
    const delta = last.value - first.value;

    let body;
    if (range === 0) body = `${subject} se mantiene en ${format(first.value)} de ${first.label} a ${last.label}.`;
    else if (Math.abs(delta) <= range * 0.05) body = `${subject} acaba donde empezó: ${format(first.value)} en ${first.label} y ${format(last.value)} en ${last.label}.`;
    else body = `${subject} ${delta > 0 ? "sube" : "baja"} de ${format(first.value)} en ${first.label} a ${format(last.value)} en ${last.label}.`;

    const extremes = [];
    if (range > 0 && min !== first && min !== last) extremes.push(`Mínimo: ${format(min.value)} en ${min.label}.`);
    if (range > 0 && max !== first && max !== last) extremes.push(`Máximo: ${format(max.value)} en ${max.label}.`);

    let crossing = "";
    if (threshold && Number.isFinite(threshold.value)) {
      const below = valid.find((point) => point.value < threshold.value);
      crossing = below
        ? `Pasa por debajo de ${threshold.label} (${format(threshold.value)}) en ${below.label}.`
        : `No baja de ${threshold.label} (${format(threshold.value)}) en todo el periodo.`;
    }
    return [body, ...extremes, crossing].filter(Boolean).join(" ");
  }

  // ---- Geometría y lectura ----
  /** Índice del punto más cercano a una posición horizontal (0-1) dentro del gráfico. `xs` son porcentajes 0-100. */
  function nearestIndex(xs, fraction) {
    if (!Array.isArray(xs) || !xs.length) return 0;
    const target = Math.max(0, Math.min(1, Number(fraction) || 0)) * 100;
    let best = 0;
    let bestDistance = Infinity;
    for (let index = 0; index < xs.length; index += 1) {
      const distance = Math.abs(xs[index] - target);
      if (distance < bestDistance) {
        best = index;
        bestDistance = distance;
      }
    }
    return best;
  }

  /** Siguiente índice tras una tecla; null si la tecla no es de recorrido. Inicio/Fin saltan a los extremos; Re Pág/Av Pág, a saltos de ~un cuarto. */
  function stepIndex(key, index, count) {
    if (!(count > 0)) return null;
    const last = count - 1;
    const jump = Math.max(2, Math.round(count / 4));
    let next;
    if (key in KEYS) next = index + KEYS[key];
    else if (key === "Home") next = 0;
    else if (key === "End") next = last;
    else if (key === "PageUp") next = index - jump;
    else if (key === "PageDown") next = index + jump;
    else return null;
    return Math.max(0, Math.min(last, next));
  }

  // ---- Piezas HTML ----
  /**
   * El dibujo de un cono / banda P10-P90: un polígono continuo entre el límite bajo y el alto, más la línea central. viewBox 0-100 con
   * preserveAspectRatio="none" (se estira al ancho real; por eso el trazo central es `non-scaling-stroke`).
   * Devuelve también `xs`, la posición horizontal (0-100) de cada punto, que el recorrido necesita.
   * `threshold` (WP-16): una línea horizontal discontinua, por ejemplo el suelo de caja. Entra en la escala para que siempre se vea.
   * @param {{points: Array<{low: number, center: number, high: number}>, ariaLabel: string, classes?: {svg?: string, area?: string, center?: string}, threshold?: {value: number}|null}} spec
   */
  function bandPlotHtml({ points, ariaLabel, classes = {}, threshold = null }) {
    const thresholdValue = threshold && Number.isFinite(Number(threshold.value)) ? Number(threshold.value) : null;
    const values = [...points.flatMap((point) => [point.low, point.high]), ...(thresholdValue === null ? [] : [thresholdValue])];
    const min = Math.min(0, ...values);
    const max = Math.max(1, ...values);
    const span = Math.max(1, max - min);
    const stepX = points.length > 1 ? 100 / (points.length - 1) : 0;
    const xAt = (index) => round2(points.length > 1 ? index * stepX : 50);
    const yAt = (value) => round2(100 - ((value - min) / span) * 100);
    const high = points.map((point, index) => `${xAt(index)},${yAt(point.high)}`);
    const low = points.map((point, index) => `${xAt(index)},${yAt(point.low)}`).reverse();
    const center = points.map((point, index) => `${xAt(index)},${yAt(point.center)}`).join(" ");
    const svg = `<svg class="${esc(classes.svg || "ck-svg")}" viewBox="0 0 100 100" preserveAspectRatio="none" role="img" aria-label="${esc(ariaLabel)}">
    <polygon class="${esc(classes.area || "ck-banda")}" points="${[...high, ...low].join(" ")}"></polygon>
    <polyline class="${esc(classes.center || "ck-centro")}" points="${center}" vector-effect="non-scaling-stroke"></polyline>${
      thresholdValue === null ? "" : `\n    <line class="ck-umbral" x1="0" x2="100" y1="${yAt(thresholdValue)}" y2="${yAt(thresholdValue)}" vector-effect="non-scaling-stroke"></line>`
    }
  </svg>`;
    return { svg, xs: points.map((_, index) => xAt(index)) };
  }

  /**
   * «Ver como tabla»: los mismos datos que el gráfico, en una tabla de verdad (cabeceras, leyenda), plegada. Es la salida para quien no
   * puede o no quiere interpretar el dibujo, y el contraste de los números exactos para quien sí.
   * @param {{caption: string, columns: string[], rows: Array<Array<string|number>>}} spec
   */
  function tableHtml({ caption, columns, rows }) {
    const head = columns.map((column) => `<th scope="col">${esc(column)}</th>`).join("");
    const body = rows
      .map((row) => `<tr><th scope="row">${esc(row[0])}</th>${row.slice(1).map((cell) => `<td>${esc(cell)}</td>`).join("")}</tr>`)
      .join("");
    return `<details class="ck-tabla"><summary>Ver como tabla</summary><div class="ck-tabla-scroll"><table class="e19-table"><caption class="sr-only">${esc(caption)}</caption><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table></div></details>`;
  }

  /**
   * El gráfico completo: dibujo, capa de recorrido, lectura fija, nota y tabla. `plotHtml` es el dibujo (el SVG ya hecho); `readings` es la
   * frase de cada punto, lo que se lee al llegar a él (en pantalla y con lector de pantalla); `xs`, su posición horizontal (0-100).
   * @param {{id: string, plotHtml: string, plotClass?: string, belowPlotHtml?: string, readings: string[], xs: number[], sliderLabel: string, noteHtml?: string, table?: {caption: string, columns: string[], rows: Array<Array<string|number>>}|null}} spec
   */
  function figureHtml({ id, plotHtml, plotClass = "", belowPlotHtml = "", readings, xs, sliderLabel, noteHtml = "", table = null }) {
    const count = readings.length;
    const slider = count
      ? `<div class="ck-scrub" role="slider" tabindex="0" aria-orientation="horizontal" aria-label="${esc(sliderLabel)}" aria-valuemin="0" aria-valuemax="${count - 1}" aria-valuenow="0" aria-valuetext="${esc(readings[0])}" data-ck-readings="${esc(JSON.stringify(readings))}" data-ck-x="${esc(JSON.stringify(xs))}"><span class="ck-cursor" hidden></span></div>`
      : "";
    return `<div class="ck-figure" data-ck-id="${esc(id)}"><div class="ck-plot ${esc(plotClass)}">${plotHtml}${slider}</div>${belowPlotHtml}${
      count ? `<p class="ck-lectura" data-ck-readout>${esc(HINT)}</p>` : ""
    }${noteHtml}${table ? tableHtml(table) : ""}</div>`;
  }

  // ---- Interacción ----
  const stateOf = (slider) => {
    if (!slider.__ck) slider.__ck = { readings: JSON.parse(slider.dataset.ckReadings || "[]"), xs: JSON.parse(slider.dataset.ckX || "[]") };
    return slider.__ck;
  };

  function select(slider, index) {
    const state = stateOf(slider);
    if (!state.readings.length) return;
    const at = Math.max(0, Math.min(state.readings.length - 1, index));
    slider.setAttribute("aria-valuenow", String(at));
    slider.setAttribute("aria-valuetext", state.readings[at]);
    const cursor = slider.querySelector(".ck-cursor");
    if (cursor) {
      cursor.style.left = `${state.xs[at]}%`;
      cursor.hidden = false;
    }
    const readout = slider.closest(".ck-figure")?.querySelector("[data-ck-readout]");
    if (readout) readout.textContent = state.readings[at];
  }

  function moveToPointer(slider, event) {
    const rect = slider.getBoundingClientRect();
    if (!rect.width) return;
    select(slider, nearestIndex(stateOf(slider).xs, (event.clientX - rect.left) / rect.width));
  }

  /** Engancha el recorrido a todo el documento, una sola vez (idempotente). Devuelve true la primera vez. */
  function attach(doc) {
    if (!doc || doc.__ckAttached) return false;
    doc.__ckAttached = true;
    const scrubOf = (event) => (event.target && event.target.closest ? event.target.closest(".ck-scrub") : null);
    doc.addEventListener("pointerdown", (event) => {
      const slider = scrubOf(event);
      if (!slider) return;
      slider.dataset.ckActive = "1";
      try { slider.setPointerCapture?.(event.pointerId); } catch { /* sin captura el recorrido sigue dentro del propio elemento */ }
      moveToPointer(slider, event);
    });
    doc.addEventListener("pointermove", (event) => {
      const slider = scrubOf(event);
      if (!slider) return;
      // El ratón lee con solo pasar; el dedo, solo mientras está apoyado (si no, el gesto es desplazar la página).
      if (event.pointerType === "mouse" || slider.dataset.ckActive === "1") moveToPointer(slider, event);
    });
    const release = (event) => {
      const slider = scrubOf(event);
      if (slider) delete slider.dataset.ckActive;
    };
    doc.addEventListener("pointerup", release);
    doc.addEventListener("pointercancel", release);
    doc.addEventListener("lostpointercapture", release);
    doc.addEventListener("keydown", (event) => {
      const slider = scrubOf(event);
      if (!slider) return;
      const state = stateOf(slider);
      const next = stepIndex(event.key, Number(slider.getAttribute("aria-valuenow")) || 0, state.readings.length);
      if (next === null) return;
      event.preventDefault();
      select(slider, next);
    });
    // Al enfocar con teclado se enseña el cursor donde el lector de pantalla ya dice que está.
    doc.addEventListener("focusin", (event) => {
      const slider = scrubOf(event);
      if (slider && slider.querySelector(".ck-cursor")?.hidden) select(slider, Number(slider.getAttribute("aria-valuenow")) || 0);
    });
    return true;
  }

  return Object.freeze({ HINT, trendSentence, nearestIndex, stepIndex, bandPlotHtml, tableHtml, figureHtml, select, attach });
});
