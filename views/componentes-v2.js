/**
 * views/componentes-v2.js · TRE-23 (decimotercera auditoría §7; auditoría de diseño §5.2, PR 4): las piezas comunes del tema v2 que
 * hasta ahora cada pantalla nueva se escribía a su manera. Puras (devuelven HTML escapado) y sin estado; las usan Deuda › Contratos
 * (TRE-D4) y, después, Ofertas y el marco común (R1). Cada una lleva su clase `.cv2-*` en `tema-v2.css`.
 *
 *  - `panel`: el marco de un panel o ficha (hoja inferior en el móvil, lateral en el escritorio): asa, antetítulo, título, cerrar, una
 *    zona fija opcional (la vista previa) y el pie. Es el de «Ajustar el plan» y «Comparar» (TRE-D2, TRE-D3c), con nombre propio.
 *  - `tarjeta`: una tarjeta de lista con título, subtítulo, insignias, hasta cuatro datos con su rótulo, una barra opcional, una línea
 *    de pie y acciones.
 *  - `banda`: un aviso con su título en negrita, el porqué y una acción (p. ej. «Faltan 2 datos · Completar ahora · 1 de 2»).
 *  - `plegado`: un <details> con su contador en el título (p. ej. «Herramientas de contratos (8)») y una lista de entradas con su línea.
 *
 * Script de pantalla: comparte el ámbito global de app.js (escapeHtml).
 */
(function attachComponentesV2(root) {
  "use strict";

  const esc = (v) => (typeof escapeHtml === "function" ? escapeHtml(v) : String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]));
  const attrs = (obj = {}) => Object.entries(obj).filter(([, v]) => v !== null && v !== undefined && v !== false).map(([k, v]) => (v === true ? ` ${k}` : ` ${k}="${esc(v)}"`)).join("");
  const TONOS = new Set(["neutro", "aviso", "ok", "peligro"]);

  /** Botón del sistema de diseño. `datos`: atributos data-* (sin el prefijo). */
  function boton({ texto, primario = false, datos = {}, etiqueta = null, oculto = false }) {
    const data = Object.fromEntries(Object.entries(datos).map(([k, v]) => [`data-${k}`, v]));
    return `<button type="button" class="e19-btn ${primario ? "e19-btn-primary" : "e19-btn-secondary"}"${attrs({ ...data, "aria-label": etiqueta, hidden: oculto })}>${esc(texto)}</button>`;
  }

  function panel({ idTitulo, antetitulo = "", titulo, cerrar = {}, fijo = "", cuerpo = "", pie = "" }) {
    return `<div class="dpv2-aj-in cv2-panel">
      <div class="dpv2-aj-fija">
        <span class="clas-v2-asa" aria-hidden="true"></span>
        <div class="dpv2-aj-cabeza">
          <div>${antetitulo ? `<p class="dpv2-kicker">${esc(antetitulo)}</p>` : ""}<h2 id="${esc(idTitulo)}">${esc(titulo)}</h2></div>
          <button type="button" class="e19-btn e19-btn-secondary clas-v2-cerrar"${attrs(Object.fromEntries(Object.entries(cerrar).map(([k, v]) => [`data-${k}`, v])))} aria-label="Cerrar «${esc(titulo)}»">×</button>
        </div>
        ${fijo}
      </div>
      ${cuerpo}
      ${pie ? `<div class="dpv2-aj-pie">${pie}</div>` : ""}
    </div>`;
  }

  function insignia({ texto, tono = "neutro" }) {
    return `<span class="cv2-insignia" data-tono="${TONOS.has(tono) ? tono : "neutro"}">${esc(texto)}</span>`;
  }

  /**
   * @param {object} t
   * @param {string} t.titulo
   * @param {string} [t.subtitulo]
   * @param {Array<{texto:string,tono?:string}>} [t.insignias]
   * @param {Array<{rotulo:string,valor:string}>} [t.datos] hasta cuatro
   * @param {{pct:number, estimada?:boolean, etiqueta:string}|null} [t.barra]
   * @param {string} [t.pie] HTML ya escapado (puede llevar <strong>)
   * @param {string} [t.acciones] HTML de botones
   * @param {object} [t.atributos] del <li>
   */
  function tarjeta({ titulo, subtitulo = "", insignias = [], datos = [], barra = null, pie = "", acciones = "", atributos = {} }) {
    const ds = datos.slice(0, 4).map((d) => `<div><dt>${esc(d.rotulo)}</dt><dd>${esc(d.valor)}</dd></div>`).join("");
    const pct = barra ? Math.max(0, Math.min(100, Math.round(Number(barra.pct) || 0))) : 0;
    return `<li class="cv2-tarjeta"${attrs(atributos)}>
      <div class="cv2-tarjeta-cabeza">
        <div><h3>${esc(titulo)}</h3>${subtitulo ? `<p>${esc(subtitulo)}</p>` : ""}</div>
        ${insignias.length ? `<div class="cv2-insignias">${insignias.map(insignia).join("")}</div>` : ""}
      </div>
      ${ds ? `<dl class="cv2-datos">${ds}</dl>` : ""}
      ${barra ? `<div class="cv2-barra${barra.estimada ? " is-estimada" : ""}" role="img" aria-label="${esc(barra.etiqueta)}"><span style="width:${pct}%"></span></div>` : ""}
      ${pie ? `<p class="cv2-tarjeta-pie">${pie}</p>` : ""}
      ${acciones ? `<div class="cv2-acciones">${acciones}</div>` : ""}
    </li>`;
  }

  function lista(items, atributos = {}) {
    return `<ul class="cv2-lista"${attrs(atributos)}>${items.join("")}</ul>`;
  }

  /** @param {{titulo:string, texto?:string, accion?:string, tono?:string, atributos?:object}} b */
  function banda({ titulo, texto = "", accion = "", tono = "aviso", atributos = {} }) {
    return `<div class="cv2-banda" data-tono="${TONOS.has(tono) ? tono : "aviso"}"${attrs(atributos)}>
      <p><strong>${esc(titulo)}</strong>${texto ? ` ${esc(texto)}` : ""}</p>
      ${accion}
    </div>`;
  }

  /** @param {{titulo:string, entradas:Array<{titulo:string, linea:string, datos?:object}>, atributos?:object, abierto?:boolean}} p */
  function plegado({ titulo, entradas = [], atributos = {}, abierto = false }) {
    const filas = entradas.map((e) => {
      const data = Object.fromEntries(Object.entries(e.datos || {}).map(([k, v]) => [`data-${k}`, v]));
      return `<li><button type="button" class="cv2-plegado-entrada"${attrs(data)}><span><strong>${esc(e.titulo)}</strong><small>${esc(e.linea)}</small></span><span aria-hidden="true">›</span></button></li>`;
    }).join("");
    return `<details class="cv2-plegado"${attrs({ ...atributos, open: abierto })}>
      <summary>${esc(titulo)} <span class="cv2-cuenta">(${entradas.length})</span></summary>
      <ul>${filas}</ul>
    </details>`;
  }

  const api = { boton, panel, insignia, tarjeta, lista, banda, plegado };
  root.FinanceComponentesV2 = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
