// P2 (D-N58, 28/11/2026): un solo «Elegir partida» en toda la app. Hasta hoy elegir partida era un <select> nativo con todas las
// partidas («Bloque · Partida», cien y pico) en ocho sitios: la ficha de un movimiento y su «Dividir», Registrar gasto, Clasificar
// («Otra…»), Cierre, Importar y Datos. En el iPhone es una rueda imposible de recorrer.
//
// Ahora, un buscador (combobox de ARIA 1.2 con lista): escribir «pel» encuentra «Seguro de previsión»; arriba, la propuesta (si la
// pantalla la da) y las 3 últimas elegidas en este dispositivo; luego todas por bloque; al final, «+ Nueva partida» donde la pantalla
// la tenga. Flechas, Intro, Esc e Inicio/Fin; 44 px de toque.
//
// Mejora progresiva, sin tocar cómo se guarda nada: el <select> de siempre sigue en la página como fuente de verdad (oculto a la
// vista y fuera del orden del tabulador) y elegir aquí le pone el valor y dispara su `change`, así que cada pantalla hace lo de
// siempre. Si el <select> cambia (otras opciones, un valor puesto por código), el buscador se pone al día. Opt-in con
// `data-elegir-partida` en el <select>; `data-propuesta="<clave>"` y `data-elegir-nueva="<selector del botón>"`, opcionales.
(function attachElegirPartida(root) {
  "use strict";
  const doc = root.document;
  const RECIENTES = "elegir-partida-recientes";
  const MAX_RECIENTES = 3;
  let serie = 0;

  const normal = (texto) => String(texto || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();

  function leerRecientes() {
    try { return JSON.parse(root.localStorage?.getItem(RECIENTES) || "[]").filter((v) => typeof v === "string"); } catch { return []; }
  }
  function guardarReciente(clave) {
    if (!clave) return;
    try { root.localStorage?.setItem(RECIENTES, JSON.stringify([clave, ...leerRecientes().filter((v) => v !== clave)].slice(0, 10))); } catch { /* sin almacenamiento */ }
  }

  // Las opciones del <select>: { valor, nombre, bloque }. «Bloque · Partida» o un <optgroup> con el bloque.
  function opcionesDe(select) {
    return [...select.options].map((option) => {
      const grupo = option.parentElement?.tagName === "OPTGROUP" ? option.parentElement.label : "";
      const texto = option.textContent.trim();
      const partes = grupo ? [grupo, texto] : texto.split(" · ");
      const bloque = partes.length > 1 ? partes[0] : "";
      const nombre = partes.length > 1 ? partes.slice(1).join(" · ") : texto;
      return { valor: option.value, nombre, bloque, texto, disabled: option.disabled };
    });
  }

  // Lo que enseña la lista para un texto buscado. Pura: se prueba en Node.
  function secciones(opciones, { buscado = "", propuesta = "", recientes = [] } = {}) {
    const q = normal(buscado);
    const encaja = (o) => !q || normal(`${o.bloque} ${o.nombre}`).includes(q) || normal(o.nombre).split(/\s+/).some((p) => p.startsWith(q));
    const conValor = opciones.filter((o) => o.valor && !o.disabled);
    const vacias = opciones.filter((o) => !o.valor && !o.disabled && !q);
    const out = [];
    if (vacias.length) out.push({ titulo: "", items: vacias });
    if (!q) {
      const prop = conValor.find((o) => o.valor === propuesta);
      if (prop) out.push({ titulo: "Propuesta", items: [prop] });
      const rec = recientes.map((v) => conValor.find((o) => o.valor === v)).filter((o) => o && o.valor !== propuesta).slice(0, MAX_RECIENTES);
      if (rec.length) out.push({ titulo: "Recientes", items: rec });
    }
    const porBloque = new Map();
    conValor.filter(encaja).forEach((o) => {
      if (!porBloque.has(o.bloque)) porBloque.set(o.bloque, []);
      porBloque.get(o.bloque).push(o);
    });
    porBloque.forEach((items, bloque) => out.push({ titulo: bloque || "Partidas", items }));
    return out;
  }

  function mejorar(select) {
    if (!select || select.dataset.elegirPartidaHecho) return;
    select.dataset.elegirPartidaHecho = "1";
    const id = `elegirPartida${++serie}`;
    const etiqueta = select.getAttribute("aria-label") || select.closest("label")?.querySelector("span")?.textContent?.trim() || "Partida";
    const caja = doc.createElement("span");
    caja.className = "ep";
    caja.innerHTML = `<input type="text" class="ep-campo" id="${id}" role="combobox" aria-autocomplete="list" aria-expanded="false" aria-controls="${id}-lista" autocomplete="off" spellcheck="false" aria-label="${etiqueta.replace(/"/g, "&quot;")}" placeholder="Escribe para buscar…"><span class="ep-flecha" aria-hidden="true"></span><ul class="ep-lista" id="${id}-lista" role="listbox" aria-label="${etiqueta.replace(/"/g, "&quot;")}" hidden></ul>`;
    select.insertAdjacentElement("afterend", caja);
    select.classList.add("ep-nativo");
    select.tabIndex = -1;
    select.setAttribute("aria-hidden", "true");
    const campo = caja.querySelector(".ep-campo");
    const lista = caja.querySelector(".ep-lista");
    let activo = -1;
    let items = [];

    const textoActual = () => {
      const o = select.selectedOptions?.[0];
      if (!o) return "";
      return o.value ? (opcionesDe(select).find((x) => x.valor === o.value)?.nombre || o.textContent.trim()) : o.textContent.trim();
    };
    const sincronizar = () => {
      if (doc.activeElement !== campo || lista.hidden) campo.value = textoActual();
      campo.disabled = select.disabled;
    };
    const cerrar = (restaurar = true) => {
      lista.hidden = true;
      campo.setAttribute("aria-expanded", "false");
      campo.removeAttribute("aria-activedescendant");
      activo = -1;
      if (restaurar) campo.value = textoActual();
    };
    const marcar = (indice) => {
      activo = Math.max(0, Math.min(items.length - 1, indice));
      lista.querySelectorAll('[role="option"]').forEach((li, i) => li.classList.toggle("is-activa", i === activo));
      const li = lista.querySelector(`#${id}-o${activo}`);
      if (li) { campo.setAttribute("aria-activedescendant", li.id); li.scrollIntoView?.({ block: "nearest" }); }
    };
    const pintar = (buscado) => {
      const grupos = secciones(opcionesDe(select), { buscado, propuesta: select.dataset.propuesta || "", recientes: leerRecientes() });
      items = [];
      const esc = (t) => String(t).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
      let html = "";
      grupos.forEach((g, gi) => {
        const cab = g.titulo ? `<li role="presentation" class="ep-grupo" id="${id}-g${gi}">${esc(g.titulo)}</li>` : "";
        html += cab + g.items.map((o) => {
          const i = items.push({ tipo: "valor", valor: o.valor }) - 1;
          return `<li role="option" id="${id}-o${i}" data-i="${i}" aria-selected="${o.valor === select.value}"${g.titulo ? ` aria-describedby="${id}-g${gi}"` : ""}>${esc(o.nombre)}</li>`;
        }).join("");
      });
      if (!items.length) html += `<li role="presentation" class="ep-vacio">Ninguna partida con «${esc(buscado)}».</li>`;
      const nueva = select.dataset.elegirNueva ? doc.querySelector(select.dataset.elegirNueva) : null;
      if (nueva) {
        const i = items.push({ tipo: "nueva" }) - 1;
        html += `<li role="option" id="${id}-o${i}" data-i="${i}" class="ep-nueva" aria-selected="false">+ Nueva partida</li>`;
      }
      lista.innerHTML = html;
      lista.hidden = false;
      campo.setAttribute("aria-expanded", "true");
      const elegida = items.findIndex((it) => it.tipo === "valor" && it.valor === select.value);
      marcar(buscado ? 0 : Math.max(0, elegida));
    };
    const elegir = (indice) => {
      const it = items[indice];
      if (!it) return;
      cerrar(false);
      if (it.tipo === "nueva") {
        campo.value = textoActual();
        doc.querySelector(select.dataset.elegirNueva)?.click();
        return;
      }
      if (select.value !== it.valor) {
        select.value = it.valor;
        select.dispatchEvent(new Event("input", { bubbles: true }));
        select.dispatchEvent(new Event("change", { bubbles: true }));
      }
      guardarReciente(it.valor);
      campo.value = textoActual();
    };

    campo.addEventListener("focus", () => { campo.select?.(); });
    campo.addEventListener("click", () => { if (lista.hidden) pintar(""); });
    campo.addEventListener("input", () => pintar(campo.value === textoActual() ? "" : campo.value));
    campo.addEventListener("keydown", (event) => {
      const abierta = !lista.hidden;
      if (event.key === "ArrowDown" || event.key === "ArrowUp") {
        event.preventDefault();
        if (!abierta) return pintar("");
        return marcar(activo + (event.key === "ArrowDown" ? 1 : -1));
      }
      if (abierta && (event.key === "Home" || event.key === "End") && event.ctrlKey) { event.preventDefault(); return marcar(event.key === "Home" ? 0 : items.length - 1); }
      // Con la lista abierta, Intro y Esc son de la lista: no llegan a los atajos de la pantalla (Clasificar acepta con Intro) ni cierran el diálogo.
      if (event.key === "Enter" && abierta) { event.preventDefault(); event.stopPropagation(); return elegir(activo); }
      if (event.key === "Escape" && abierta) { event.preventDefault(); event.stopPropagation(); return cerrar(); }
      if (event.key === "Tab" && abierta) cerrar();
    });
    // pointerdown y no click: el campo pierde el foco antes del click y cerraría la lista bajo el dedo.
    lista.addEventListener("pointerdown", (event) => {
      const li = event.target.closest?.('[role="option"]');
      if (!li) return;
      event.preventDefault();
      elegir(Number(li.dataset.i));
    });
    campo.addEventListener("blur", () => root.setTimeout(() => { if (doc.activeElement !== campo) cerrar(); }, 0));
    // El <select> no recibe el foco (la etiqueta lo daría al tocar su texto): lo pasa al buscador.
    select.addEventListener("focus", () => campo.focus());
    select.addEventListener("change", sincronizar);
    if (typeof root.MutationObserver === "function") new root.MutationObserver(sincronizar).observe(select, { childList: true, subtree: true, attributes: true, attributeFilter: ["disabled"] });
    sincronizar();
    select.elegirPartidaSincronizar = sincronizar;
  }

  function mejorarTodo(base) {
    base?.querySelectorAll?.("select[data-elegir-partida]").forEach(mejorar);
  }

  if (doc) {
    const empezar = () => {
      mejorarTodo(doc);
      if (typeof root.MutationObserver === "function") {
        new root.MutationObserver((cambios) => cambios.forEach((c) => c.addedNodes.forEach((n) => {
          if (n.nodeType !== 1) return;
          if (n.matches?.("select[data-elegir-partida]")) mejorar(n);
          mejorarTodo(n);
        }))).observe(doc.documentElement, { childList: true, subtree: true });
      }
    };
    if (doc.readyState === "loading") doc.addEventListener("DOMContentLoaded", empezar);
    else empezar();
  }

  const api = { secciones, opcionesDe, mejorar, sincronizar: (select) => select?.elegirPartidaSincronizar?.() };
  root.FinanceElegirPartida = api;
  if (typeof module !== "undefined") module.exports = { secciones };
})(typeof globalThis !== "undefined" ? globalThis : this);
