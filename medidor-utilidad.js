// XGO-02 · Medidor de utilidad por función (ficha XGO-02 de docs/PROPUESTA_SEPTIMA_AUDITORIA_2026-10-17.md; P10: PR
// aparte, justo detrás de «Funciones en prueba»).
//
// Cada función registra, en este navegador y solo en agregado, si se vio, si se actuó, si se descartó y si se
// deshizo. Sin importes ni conceptos: cuentas por mes y, para Hoy, los segundos hasta la primera acción.
// - vista: días distintos en que se vio (un repintado no es otra vista; si no, la tasa de acción saldría falsa);
// - acción: cada vez que se usó para hacer algo (aceptar una regla, importar un extracto, abrir un movimiento…);
// - descarte: cada vez que se apartó (saltar un grupo, «Ver todo el detalle» o volver al diseño de siempre);
// - deshecho: cada vez que se deshizo lo hecho con ella.
// La tasa de acción es la parte de los días vistos en los que además se actuó.
//
// Lo leen dos sitios: Ajustes › Uso de la app (informe mensual por función, junto al panel de uso de WP-03) y
// «Funciones en prueba» (XGO-03), que enseña el dato junto a la métrica de cada función para que la revisión de las
// dos semanas se conteste con datos y no por impresión.
//
// XDA-05 · PR-1 (26/10/2026): además, la calibración de Clasificar. Por cada grupo aceptado, su confianza (alta, media,
// baja o sin propuesta), si se aceptó la propuesta tal cual o se eligió otra partida, los segundos que costó y si luego
// se deshizo. Tampoco aquí hay conceptos ni importes. De ahí sale la puerta del PR-2 (aceptar en bloque los grupos de
// confianza alta): 20 grupos de alta o más, con el 95 % o más aceptados tal cual y sin deshacer.
(function exposeFinanceMedidor(root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.FinanceMedidor = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function createFinanceMedidor() {
  "use strict";

  const STORAGE_KEY = "medidor-utilidad";
  const KEEP_MONTHS = 6;
  const KEEP_CLAVES = 50;
  const KEEP_TIEMPOS = 30;
  const EVENTOS = ["vista", "accion", "descarte", "deshecho"];
  const KEEP_CALIBRACION = 300;
  const CONFIANZAS = ["alta", "media", "baja", "sin"];
  const PUERTA_GRUPOS = 20;
  const PUERTA_PCT = 95;

  // Lo que se mide de cada función y cómo se dice ([singular, plural]; vacío = no aplica). El orden es el del informe.
  const FUNCIONES = [
    { id: "tema-v2", nombre: "Diseño nuevo", accion: null, descarte: ["vuelta al de siempre", "vueltas al de siempre"], deshecho: null },
    { id: "hoy-v2", nombre: "Hoy nuevo", accion: ["acción", "acciones"], descarte: ["vez «Ver todo el detalle»", "veces «Ver todo el detalle»"], deshecho: null },
    { id: "movimientos-v2", nombre: "Movimientos nuevo", accion: ["acción", "acciones"], descarte: ["vez «Ver todo el detalle»", "veces «Ver todo el detalle»"], deshecho: null },
    { id: "importar-v2", nombre: "Importar en tres pasos", accion: ["extracto importado", "extractos importados"], descarte: ["vez al asistente de siempre", "veces al asistente de siempre"], deshecho: ["lote deshecho", "lotes deshechos"] },
    { id: "clasificar-v2", nombre: "Clasificar por lotes", accion: ["regla aceptada", "reglas aceptadas"], descarte: ["grupo saltado", "grupos saltados"], deshecho: ["regla deshecha", "reglas deshechas"] },
    { id: "repaso-v2", nombre: "Repaso semanal", accion: ["repaso terminado", "repasos terminados"], descarte: ["repaso a medias", "repasos a medias"], deshecho: null },
    { id: "lo-que-pide", nombre: "Lo que la app te pide", accion: ["dato buscado desde aquí", "datos buscados desde aquí"], descarte: ["vez apagada", "veces apagada"], deshecho: null },
    { id: "banda-dia", nombre: "Qué mueve cada día", accion: ["día de cargo buscado desde aquí", "días de cargo buscados desde aquí"], descarte: ["vez apagada", "veces apagada"], deshecho: null },
  ];

  function cuenta(n, [uno, varios]) {
    return `${n} ${n === 1 ? uno : varios}`;
  }

  function isoDate(date = new Date()) {
    const pad = (n) => String(n).padStart(2, "0");
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
  }

  function emptyStore() {
    return { meses: {}, ultimaVista: {}, ultimaAccion: {}, claves: {}, tiempos: {}, calibracion: [], desde: "" };
  }

  function normalize(raw) {
    const store = emptyStore();
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return store;
    for (const [mes, porFuncion] of Object.entries(raw.meses || {})) {
      if (!/^\d{4}-\d{2}$/.test(mes) || !porFuncion || typeof porFuncion !== "object") continue;
      store.meses[mes] = {};
      for (const [id, cuentas] of Object.entries(porFuncion)) {
        const limpio = {};
        for (const key of ["vistas", "acciones", "diasAccion", "descartes", "deshechos"]) {
          const n = Number(cuentas?.[key]);
          limpio[key] = Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
        }
        store.meses[mes][id] = limpio;
      }
    }
    for (const key of ["ultimaVista", "ultimaAccion"]) {
      for (const [id, iso] of Object.entries(raw[key] || {})) if (/^\d{4}-\d{2}-\d{2}$/.test(String(iso))) store[key][id] = iso;
    }
    for (const [id, lista] of Object.entries(raw.claves || {})) if (Array.isArray(lista)) store.claves[id] = lista.map(String).slice(-KEEP_CLAVES);
    for (const [id, lista] of Object.entries(raw.tiempos || {})) {
      if (Array.isArray(lista)) store.tiempos[id] = lista.map(Number).filter((n) => Number.isFinite(n) && n >= 0).slice(-KEEP_TIEMPOS);
    }
    if (Array.isArray(raw.calibracion)) {
      store.calibracion = raw.calibracion
        .filter((e) => e && Number.isInteger(e.i) && /^\d{4}-\d{2}$/.test(String(e.m)) && CONFIANZAS.includes(e.c))
        .map((e) => ({ i: e.i, m: e.m, c: e.c, t: e.c !== "sin" && e.t === true, x: e.x === true, s: typeof e.s === "number" && Number.isFinite(e.s) && e.s >= 0 ? e.s : null }))
        .slice(-KEEP_CALIBRACION);
    }
    if (/^\d{4}-\d{2}-\d{2}$/.test(String(raw.desde || ""))) store.desde = raw.desde;
    return store;
  }

  function prune(store, hoy) {
    const meses = Object.keys(store.meses).sort();
    const corte = meses.slice(0, Math.max(0, meses.length - KEEP_MONTHS));
    corte.forEach((mes) => delete store.meses[mes]);
    if (!store.desde) store.desde = hoy;
    return store;
  }

  // Registra un evento. `clave` evita contar dos veces lo mismo (un lote importado que se repinta); `segundos` guarda
  // el tiempo hasta la primera acción (Hoy). Devuelve el almacén nuevo, sin tocar el que recibe.
  function registrar(raw, id, evento, { hoy = isoDate(), clave = "", segundos = null } = {}) {
    const store = normalize(raw);
    if (!id || !EVENTOS.includes(evento)) return store;
    if (clave) {
      const vistas = store.claves[id] || [];
      if (vistas.includes(String(clave))) return store;
      store.claves[id] = [...vistas, String(clave)].slice(-KEEP_CLAVES);
    }
    const mes = hoy.slice(0, 7);
    if (!store.meses[mes]) store.meses[mes] = {};
    if (!store.meses[mes][id]) store.meses[mes][id] = { vistas: 0, acciones: 0, diasAccion: 0, descartes: 0, deshechos: 0 };
    const c = store.meses[mes][id];
    if (evento === "vista") {
      if (store.ultimaVista[id] === hoy) return prune(store, hoy);
      store.ultimaVista[id] = hoy;
      c.vistas += 1;
    } else if (evento === "accion") {
      c.acciones += 1;
      if (store.ultimaAccion[id] !== hoy) {
        store.ultimaAccion[id] = hoy;
        c.diasAccion += 1;
      }
      const s = Number(segundos);
      if (segundos !== null && Number.isFinite(s) && s >= 0) store.tiempos[id] = [...(store.tiempos[id] || []), Math.round(s * 10) / 10].slice(-KEEP_TIEMPOS);
    } else if (evento === "descarte") {
      c.descartes += 1;
    } else {
      c.deshechos += 1;
    }
    return prune(store, hoy);
  }

  // XDA-05: un grupo aceptado en Clasificar. `talCual` = se aceptó la partida propuesta (sin propuesta, nunca lo es);
  // `segundos` = desde que se enseñó el grupo hasta aceptarlo (como mucho 10 min: un rato con la app abierta no es
  // tardar). Cada registro lleva un número para poder marcarlo después como deshecho (corregirClasificacion).
  function registrarClasificacion(raw, { confianza = "sin", talCual = false, segundos = null, hoy = isoDate() } = {}) {
    const store = normalize(raw);
    const c = CONFIANZAS.includes(confianza) ? confianza : "sin";
    const s = Number(segundos);
    const i = (store.calibracion.at(-1)?.i || 0) + 1;
    store.calibracion = [...store.calibracion, { i, m: hoy.slice(0, 7), c, t: c !== "sin" && talCual === true, x: false, s: segundos !== null && Number.isFinite(s) && s >= 0 ? Math.round(Math.min(s, 600) * 10) / 10 : null }].slice(-KEEP_CALIBRACION);
    return prune(store, hoy);
  }

  // Deshacer la regla es corregir la propuesta: ese grupo ya no cuenta como aceptado tal cual.
  function corregirClasificacion(raw, i) {
    const store = normalize(raw);
    store.calibracion = store.calibracion.map((e) => (e.i === i ? { ...e, x: true } : e));
    return store;
  }

  function mediana(valores) {
    if (!valores.length) return null;
    const orden = [...valores].sort((a, b) => a - b);
    const mid = Math.floor(orden.length / 2);
    return orden.length % 2 ? orden[mid] : Math.round(((orden[mid - 1] + orden[mid]) / 2) * 10) / 10;
  }

  // Cuentas de una función en un mes ("2026-10") o en todo lo guardado (mes vacío), con su tasa de acción.
  function resumen(raw, id, mes = "") {
    const store = normalize(raw);
    const total = { vistas: 0, acciones: 0, diasAccion: 0, descartes: 0, deshechos: 0 };
    Object.entries(store.meses)
      .filter(([key]) => !mes || key === mes)
      .forEach(([, porFuncion]) => {
        const c = porFuncion[id];
        if (c) Object.keys(total).forEach((key) => (total[key] += c[key]));
      });
    const tasa = total.vistas ? Math.min(100, Math.round((total.diasAccion / total.vistas) * 100)) : null;
    const tiempos = store.tiempos[id] || [];
    const r = { ...total, tasa, medianaSegundos: mediana(tiempos), veces: tiempos.length };
    if (id === "clasificar-v2") r.calibracion = calibracion(store, mes);
    return r;
  }

  // La calibración de un mes (o de todo lo guardado): la parte de las propuestas aceptadas tal cual, en total y por
  // confianza (por lo bajo: un 94,6 % no se enseña como 95), los segundos por grupo y la puerta del PR-2, que se mira
  // siempre con todo lo guardado.
  function calibracion(raw, mes = "") {
    const todos = normalize(raw).calibracion;
    const lista = todos.filter((e) => !mes || e.m === mes);
    const tasa = (es) => {
      const con = es.filter((e) => e.c !== "sin");
      const bien = con.filter((e) => e.t && !e.x).length;
      return { grupos: con.length, talCual: bien, pct: con.length ? Math.floor((bien / con.length) * 100) : null };
    };
    const porConfianza = Object.fromEntries(["alta", "media", "baja"].map((c) => [c, tasa(lista.filter((e) => e.c === c))]));
    const alta = tasa(todos.filter((e) => e.c === "alta"));
    const segundos = lista.map((e) => e.s).filter((s) => s !== null);
    return {
      registros: lista.length,
      ...tasa(lista),
      porConfianza,
      sinPropuesta: lista.filter((e) => e.c === "sin").length,
      deshechos: lista.filter((e) => e.x).length,
      medianaSegundos: mediana(segundos),
      veces: segundos.length,
      puerta: { grupos: alta.grupos, pct: alta.pct, faltan: Math.max(0, PUERTA_GRUPOS - alta.grupos), cumple: alta.grupos >= PUERTA_GRUPOS && alta.talCual * 100 >= PUERTA_PCT * alta.grupos },
    };
  }

  function decimal(n) {
    return String(n).replace(".", ",");
  }

  // La calibración en palabras, para la línea de Clasificar del informe y de «Funciones en prueba».
  function fraseCalibracion(k) {
    if (!k?.registros) return "";
    const partes = [];
    if (k.grupos) {
      const porConfianza = ["alta", "media", "baja"].filter((c) => k.porConfianza[c].grupos).map((c) => `${c} ${k.porConfianza[c].pct} % de ${k.porConfianza[c].grupos}`);
      partes.push(`${k.pct} % de las propuestas aceptadas tal cual (${k.talCual} de ${k.grupos}${porConfianza.length > 1 ? `; ${porConfianza.join(", ")}` : ""})`);
    }
    if (k.sinPropuesta) partes.push(cuenta(k.sinPropuesta, ["grupo sin propuesta", "grupos sin propuesta"]));
    if (k.medianaSegundos !== null) partes.push(`${decimal(k.medianaSegundos)} s por grupo (mediana de ${k.veces}; objetivo 4 s)`);
    const p = k.puerta;
    if (p.cumple) partes.push(`aceptar en bloque los de confianza alta: se cumple la puerta (${p.grupos} grupos, ${p.pct} % tal cual)`);
    else if (p.faltan) partes.push(`aceptar en bloque los de confianza alta: faltan ${cuenta(p.faltan, ["grupo", "grupos"])} de alta para decidir`);
    else partes.push(`aceptar en bloque los de confianza alta: aún no (${p.pct} % tal cual; hace falta el ${PUERTA_PCT} %)`);
    return partes.join(" · ");
  }

  function mesesGuardados(raw) {
    return Object.keys(normalize(raw).meses).sort().reverse();
  }

  // Una línea por función, en palabras: lo que enseñan el informe y «Funciones en prueba».
  function frase(id, r) {
    const f = FUNCIONES.find((item) => item.id === id);
    if (!f || (!r.vistas && !r.acciones && !r.descartes && !r.deshechos)) return "aún sin usar";
    const partes = [`vista ${r.vistas} ${r.vistas === 1 ? "día" : "días"}`];
    if (f.accion) partes.push(`${cuenta(r.acciones, f.accion)}${r.tasa === null ? "" : ` (actuasteis el ${r.tasa} % de los días)`}`);
    if (id === "hoy-v2" && r.medianaSegundos !== null) partes.push(`${String(r.medianaSegundos).replace(".", ",")} s hasta la primera acción (mediana de ${r.veces})`);
    if (id === "importar-v2" && r.medianaSegundos !== null) partes.push(`${String(Math.round(r.medianaSegundos)).replace(".", ",")} s del toque en «Importar» al extracto importado (mediana de ${r.veces})`);
    if (id === "repaso-v2" && r.medianaSegundos !== null) partes.push(`${String(Math.round((r.medianaSegundos / 60) * 10) / 10).replace(".", ",")} min por repaso (mediana de ${r.veces})`);
    if (f.descarte) partes.push(cuenta(r.descartes, f.descarte));
    if (f.deshecho) partes.push(cuenta(r.deshechos, f.deshecho));
    const k = fraseCalibracion(r.calibracion);
    if (k) partes.push(k);
    return partes.join(" · ");
  }

  // ---------- Navegador ----------

  function storage() {
    try {
      return globalThis.localStorage || null;
    } catch {
      return null;
    }
  }

  function leer() {
    try {
      return normalize(JSON.parse(storage()?.getItem(STORAGE_KEY) || "null"));
    } catch {
      return emptyStore();
    }
  }

  function guardar(store) {
    try {
      storage()?.setItem(STORAGE_KEY, JSON.stringify(store));
    } catch {
      // Navegación privada o almacenamiento bloqueado: esta visita no cuenta.
    }
  }

  // Lo llaman las pantallas: `globalThis.FinanceMedidor?.anotar("clasificar-v2", "accion")`.
  function anotar(id, evento, opciones = {}) {
    guardar(registrar(leer(), id, evento, opciones));
    if (globalThis.document?.getElementById("medidorUtilidadLista")) pintarInforme();
  }

  // XDA-05: lo llama Clasificar al aceptar un grupo; devuelve el número del registro, para marcarlo si se deshace.
  function anotarClasificacion(opciones = {}) {
    const store = registrarClasificacion(leer(), opciones);
    guardar(store);
    if (globalThis.document?.getElementById("medidorUtilidadLista")) pintarInforme();
    return store.calibracion.at(-1)?.i || 0;
  }

  function corregir(i) {
    if (!i) return;
    guardar(corregirClasificacion(leer(), i));
    if (globalThis.document?.getElementById("medidorUtilidadLista")) pintarInforme();
  }

  function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
  }

  function nombreMes(mes) {
    const [y, m] = mes.split("-").map(Number);
    return new Intl.DateTimeFormat("es-ES", { month: "long", year: "numeric" }).format(new Date(y, m - 1, 15));
  }

  let mesElegido = "";

  // Ajustes › Uso de la app: el informe mensual, una ficha por función (en el móvil una tabla escondía los valores,
  // mismo criterio que el panel de uso).
  function pintarInforme(doc = globalThis.document) {
    const lista = doc?.getElementById("medidorUtilidadLista");
    if (!lista) return;
    const store = leer();
    const meses = mesesGuardados(store);
    const select = doc.getElementById("medidorUtilidadMes");
    if (!meses.includes(mesElegido)) mesElegido = meses[0] || "";
    if (select) {
      select.innerHTML = meses.length ? meses.map((mes) => `<option value="${mes}"${mes === mesElegido ? " selected" : ""}>${escapeHtml(nombreMes(mes))}</option>`).join("") : `<option value="">${escapeHtml(nombreMes(isoDate().slice(0, 7)))}</option>`;
    }
    lista.innerHTML = FUNCIONES.map((f) => {
      const r = resumen(store, f.id, mesElegido);
      const tasa = r.tasa === null ? "—" : `${r.tasa} %`;
      const dato = f.id === "clasificar-v2" ? globalThis.clasificarV2CoberturaFrase?.() || "" : ""; // XDA-05
      return `<li><div class="panel-uso-cabecera"><strong>${escapeHtml(f.nombre)}</strong><span class="panel-uso-valor" title="Tasa de acción">${escapeHtml(f.accion ? tasa : "—")}</span></div><p class="e19-kpi-note">${escapeHtml(frase(f.id, r))}</p>${dato ? `<p class="e19-kpi-note">${escapeHtml(dato)}</p>` : ""}</li>`;
    }).join("");
    const desde = doc.getElementById("medidorUtilidadDesde");
    if (desde) desde.textContent = store.desde ? `Datos desde el ${store.desde.split("-").reverse().join("/")}, solo en este navegador.` : "Aún no hay datos: empieza a contar hoy.";
  }

  function init(doc = globalThis.document) {
    if (!doc) return;
    if (doc.documentElement?.dataset?.tema === "v2") anotar("tema-v2", "vista");
    doc.getElementById("medidorUtilidadMes")?.addEventListener("change", (event) => {
      mesElegido = event.target.value;
      pintarInforme(doc);
    });
    globalThis.addEventListener?.("hashchange", () => pintarInforme(doc));
    pintarInforme(doc);
  }

  if (typeof document !== "undefined") {
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", () => init(document));
    else init(document);
  }

  return { STORAGE_KEY, FUNCIONES, PUERTA_GRUPOS, PUERTA_PCT, normalize, registrar, registrarClasificacion, corregirClasificacion, calibracion, resumen, mesesGuardados, frase, leer, anotar, anotarClasificacion, deshacerClasificacion: corregir, pintarInforme };
});
