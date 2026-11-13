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
//
// Coste del cierre (4/11/2026, sesión 399; plan de la sesión aprobado por el hogar): cuánto cuesta de verdad cerrar un
// mes, para comparar el de noviembre con la línea base de octubre (unos 45 min, dicho por el hogar). Mientras haya un
// mes ya terminado sin firmar (el que enseña Cierre), cuenta el tiempo activo en Cierre, Movimientos (con Clasificar)
// y Registrar (saldos e Importar): entre dos toques, teclas o desplazamientos seguidos, como mucho 3 min, que un rato
// parado no es trabajo. Guarda también los días en que se trabajó, los grupos sin partida de ese mes al empezar a
// medir y, al firmar, cuántos movimientos quedaron en «Por clasificar». Sin importes ni conceptos, y solo en este
// navegador (el hogar cierra en el ordenador). Lo enseñan «Lo que guarda la firma» en el cierre nuevo y el informe de
// Uso de la app, junto a «Cierre nuevo».
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
  const CIERRE_PAUSA_S = 180;
  const CIERRE_VISTAS = ["cierre", "movements", "registrar"];
  const KEEP_CIERRES = 12;
  // El primer cierre real (octubre de 2026) no se midió: lo dijo el hogar el 4/11 (docs/REVISION_POST_CIERRE_2026-11.md).
  const CIERRE_LINEA_BASE = { mes: "2026-10", minutos: 45 };

  // Lo que se mide de cada función y cómo se dice ([singular, plural]; vacío = no aplica). El orden es el del informe.
  const FUNCIONES = [
    { id: "tema-v2", nombre: "Diseño nuevo", accion: null, descarte: ["vuelta al de siempre", "vueltas al de siempre"], deshecho: null },
    { id: "hoy-v2", nombre: "Hoy nuevo", accion: ["acción", "acciones"], descarte: ["vez «Ver todo el detalle»", "veces «Ver todo el detalle»"], deshecho: null },
    { id: "movimientos-v2", nombre: "Movimientos nuevo", accion: ["acción", "acciones"], descarte: ["vez «Ver todo el detalle»", "veces «Ver todo el detalle»"], deshecho: null },
    { id: "importar-v2", nombre: "Importar en tres pasos", accion: ["extracto importado", "extractos importados"], descarte: ["vez al asistente de siempre", "veces al asistente de siempre"], deshecho: ["lote deshecho", "lotes deshechos"] },
    { id: "clasificar-v2", nombre: "Clasificar por lotes", accion: ["regla aceptada", "reglas aceptadas"], descarte: ["grupo saltado", "grupos saltados"], deshecho: ["regla deshecha", "reglas deshechas"] },
    { id: "repaso-v2", nombre: "Repaso semanal", accion: ["repaso terminado", "repasos terminados"], descarte: ["repaso a medias", "repasos a medias"], deshecho: null },
    { id: "cierre-v2", nombre: "Cierre nuevo", accion: ["acción o firma", "acciones o firmas"], descarte: ["vez «el cierre paso a paso»", "veces «el cierre paso a paso»"], deshecho: null },
    { id: "prevision-v2", nombre: "Previsión nueva", accion: ["horizonte cambiado o ida a otra pantalla", "horizontes cambiados o idas a otra pantalla"], descarte: ["vez «Ver todo el detalle»", "veces «Ver todo el detalle»"], deshecho: null },
    { id: "plan-v2", nombre: "Plan nuevo", accion: ["previsto guardado o ida a otra pantalla", "previstos guardados o idas a otra pantalla"], descarte: ["vez «la tabla de siempre»", "veces «la tabla de siempre»"], deshecho: null },
    { id: "aportado", nombre: "Aportado frente a valor", accion: ["valoración buscada desde aquí", "valoraciones buscadas desde aquí"], descarte: ["vez apagada", "veces apagada"], deshecho: null },
    { id: "siguiente-paso", nombre: "Siguiente paso de la cartera", accion: ["acción seguida desde aquí", "acciones seguidas desde aquí"], descarte: ["vez apagada", "veces apagada"], deshecho: null },
    { id: "dinero-parado", nombre: "Dinero parado", accion: ["vez llevado a la escalera o comparado", "veces llevado a la escalera o comparado"], descarte: ["vez apagado", "veces apagado"], deshecho: null },
    { id: "cierre-guia", nombre: "Guía del cierre", accion: ["paso marcado", "pasos marcados"], descarte: ["vez plegada", "veces plegada"], deshecho: null },
    { id: "antes-de-decidir", nombre: "Antes de decidir", accion: null, descarte: ["vez apagada", "veces apagada"], deshecho: null },
    { id: "descubierto", nombre: "El arreglo más barato", accion: null, descarte: ["vez apagada", "veces apagada"], deshecho: null },
    { id: "ver-ejemplo", nombre: "Ver con datos de ejemplo", accion: ["alta empezada tras el ejemplo", "altas empezadas tras el ejemplo"], descarte: ["vez apagada", "veces apagada"], deshecho: null },
    { id: "lo-que-pide", nombre: "Lo que la app te pide", accion: ["dato buscado desde aquí", "datos buscados desde aquí"], descarte: ["vez apagada", "veces apagada"], deshecho: null },
    // FX-62 (BACKLOG_NOVIEMBRE_OLEADA_1.md, S0): Previsión y Escenarios, medidos antes de rehacerlos (C2, FX-20), para que su
    // revisión de 14 días tenga un antes con que compararse.
    { id: "prevision", nombre: "Previsión", accion: ["horizonte, mes o periodo elegido", "horizontes, meses o periodos elegidos"], descarte: null, deshecho: null },
    { id: "escenarios", nombre: "Escenarios", accion: ["decisión simulada o escenario guardado", "decisiones simuladas o escenarios guardados"], descarte: null, deshecho: null },
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
    return { meses: {}, ultimaVista: {}, ultimaAccion: {}, claves: {}, tiempos: {}, calibracion: [], cierres: {}, desde: "" };
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
    for (const [mes, c] of Object.entries(raw.cierres || {})) {
      if (!/^\d{4}-\d{2}$/.test(mes) || !c || typeof c !== "object") continue;
      const entero = (v) => (Number.isInteger(v) && v >= 0 ? v : null);
      const s = Number(c.s);
      store.cierres[mes] = {
        s: Number.isFinite(s) && s > 0 ? Math.round(s) : 0,
        dias: Array.isArray(c.dias) ? [...new Set(c.dias.map(String).filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d)))].sort().slice(-31) : [],
        grupos: entero(c.grupos),
        firmado: /^\d{4}-\d{2}-\d{2}$/.test(String(c.firmado || "")) ? c.firmado : "",
        porClasificar: entero(c.porClasificar),
      };
    }
    if (/^\d{4}-\d{2}-\d{2}$/.test(String(raw.desde || ""))) store.desde = raw.desde;
    return store;
  }

  function prune(store, hoy) {
    const meses = Object.keys(store.meses).sort();
    const corte = meses.slice(0, Math.max(0, meses.length - KEEP_MONTHS));
    corte.forEach((mes) => delete store.meses[mes]);
    const cierres = Object.keys(store.cierres).sort();
    cierres.slice(0, Math.max(0, cierres.length - KEEP_CIERRES)).forEach((mes) => delete store.cierres[mes]);
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
    // La puerta de «aceptar en bloque» (XDA-05 PR-2) ya no se enseña: el hogar retiró la propuesta el 13/11/2026 (con 0 grupos de
    // confianza alta en noviembre, 5 de 7 sin propuesta y 0 de 2 tal cual, el atasco está en las propuestas, no en aceptarlas de
    // una vez). Se sigue calculando en calibracion().puerta, por si se retoma.
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

  // ---------- Coste del cierre ----------

  function nuevoCierre() {
    return { s: 0, dias: [], grupos: null, firmado: "", porClasificar: null };
  }

  // Suma el tiempo activo de un rato de trabajo en el cierre del mes `mes` (nunca más de una pausa por llamada). Un mes
  // ya firmado no suma: lo de después no es cierre. `grupos` (sin partida del mes) solo se guarda la primera vez.
  function registrarTiempoCierre(raw, { mes = "", segundos = 0, hoy = isoDate(), grupos = null } = {}) {
    const store = normalize(raw);
    if (!/^\d{4}-\d{2}$/.test(mes)) return store;
    const c = store.cierres[mes] || nuevoCierre();
    if (c.firmado) return store;
    const n = Number(segundos);
    if (Number.isFinite(n) && n > 0) c.s = Math.round(c.s + Math.min(n, CIERRE_PAUSA_S));
    if (!c.dias.includes(hoy)) c.dias = [...c.dias, hoy].sort().slice(-31);
    if (c.grupos === null && Number.isInteger(grupos) && grupos >= 0) c.grupos = grupos;
    store.cierres[mes] = c;
    return prune(store, hoy);
  }

  // La firma del mes: el día en que se vio firmado y cuántos movimientos quedaron en «Por clasificar». Solo la primera.
  function registrarFirmaCierre(raw, { mes = "", hoy = isoDate(), porClasificar = null } = {}) {
    const store = normalize(raw);
    const c = store.cierres[mes];
    if (!c || c.firmado) return store;
    c.firmado = hoy;
    if (Number.isInteger(porClasificar) && porClasificar >= 0) c.porClasificar = porClasificar;
    return store;
  }

  function cierre(raw, mes = "") {
    const store = normalize(raw);
    const clave = mes || Object.keys(store.cierres).sort().at(-1) || "";
    const c = store.cierres[clave];
    if (!c) return null;
    return { mes: clave, minutos: Math.round(c.s / 60), dias: c.dias.length, grupos: c.grupos, firmado: c.firmado, porClasificar: c.porClasificar };
  }

  function mesCorto(mes) {
    const [y, m] = mes.split("-").map(Number);
    return new Intl.DateTimeFormat("es-ES", { month: "long" }).format(new Date(y, m - 1, 15));
  }

  // «18 min activos en 2 días (octubre: unos 45, dicho por vosotros) · 12 grupos sin partida al empezar · firmado con
  // 3 en «Por clasificar»». Con menos de un minuto todavía no dice nada.
  function fraseCierre(c, { conMes = true, conFirma = true } = {}) {
    if (!c || c.minutos < 1) return "";
    const base = c.mes !== CIERRE_LINEA_BASE.mes ? ` (${mesCorto(CIERRE_LINEA_BASE.mes)}: unos ${CIERRE_LINEA_BASE.minutos}, dicho por vosotros)` : "";
    const partes = [`${c.minutos} min activos${c.dias > 1 ? ` en ${c.dias} días` : ""}${base}`];
    if (c.grupos !== null) partes.push(`${c.grupos} ${c.grupos === 1 ? "grupo" : "grupos"} sin partida al empezar`);
    if (conFirma && c.firmado) partes.push(c.porClasificar ? `firmado con ${c.porClasificar} en «Por clasificar»` : "firmado");
    else if (conFirma) partes.push("sin firmar todavía");
    return `${conMes ? `Cierre de ${mesCorto(c.mes)}: ` : ""}${partes.join(" · ")}`;
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
      const dato = f.id === "clasificar-v2" ? globalThis.clasificarV2CoberturaFrase?.() || "" : f.id === "cierre-v2" ? fraseCierre(cierre(store)) : ""; // XDA-05 y coste del cierre
      return `<li><div class="panel-uso-cabecera"><strong>${escapeHtml(f.nombre)}</strong><span class="panel-uso-valor" title="Tasa de acción">${escapeHtml(f.accion ? tasa : "—")}</span></div><p class="e19-kpi-note">${escapeHtml(frase(f.id, r))}</p>${dato ? `<p class="e19-kpi-note">${escapeHtml(dato)}</p>` : ""}</li>`;
    }).join("");
    const desde = doc.getElementById("medidorUtilidadDesde");
    if (desde) desde.textContent = store.desde ? `Datos desde el ${store.desde.split("-").reverse().join("/")}, solo en este navegador.` : "Aún no hay datos: empieza a contar hoy.";
  }

  // El mes que se está cerrando: el que enseña Cierre, si ya terminó y no está firmado. Un mes en curso no cuenta:
  // usar Movimientos a mitad de mes no es cerrar. Las funciones son de app.js y de views/*.js (scripts clásicos).
  function mesEnCierre() {
    try {
      const mes = typeof closeTargetMonthKey === "function" ? closeTargetMonthKey() : "";
      if (!/^\d{4}-\d{2}$/.test(mes) || mes >= isoDate().slice(0, 7)) return "";
      if (typeof isSignedClosedMonthKey === "function" && isSignedClosedMonthKey(mes)) return "";
      return mes;
    } catch {
      return "";
    }
  }

  // `activeViewId` es de app.js (un `let` de script clásico: no cuelga de globalThis).
  function vistaActiva(doc) {
    try {
      if (typeof activeViewId === "string" && activeViewId) return activeViewId;
    } catch {
      // sin app.js
    }
    return doc.querySelector(".view-section:not([hidden])")?.id || "";
  }

  function gruposSinPartida(mes) {
    try {
      if (typeof clasV2PendingGroups !== "function") return null;
      const deMes = (row) => String(row?.month || row?.date || "").slice(0, 7) === mes;
      return clasV2PendingGroups().filter((g) => (g.rows || []).some(deMes)).length;
    } catch {
      return null;
    }
  }

  // Un mes medido que ya sale firmado: se anota la firma con lo que quedó en «Por clasificar».
  function comprobarFirmas() {
    try {
      const store = leer();
      let nuevo = null;
      for (const [mes, c] of Object.entries(store.cierres)) {
        if (c.firmado || typeof isSignedClosedMonthKey !== "function" || !isSignedClosedMonthKey(mes)) continue;
        const porClasificar = typeof cierrePorClasificarContados === "function" ? cierrePorClasificarContados(mes) : null;
        nuevo = registrarFirmaCierre(nuevo || store, { mes, porClasificar });
      }
      if (nuevo) guardar(nuevo);
    } catch {
      // Sin la app cargada (pruebas, arranque): ya se mirará la próxima vez.
    }
  }

  let cierreUltimo = 0;
  let cierrePendiente = 0;
  let cierreMes = "";

  function volcarCierre() {
    if (!cierreMes || cierrePendiente <= 0) return;
    const store = leer();
    const grupos = store.cierres[cierreMes]?.grupos == null ? gruposSinPartida(cierreMes) : null;
    guardar(registrarTiempoCierre(store, { mes: cierreMes, segundos: cierrePendiente, grupos }));
    cierrePendiente = 0;
  }

  function actividadCierre(doc) {
    if (doc.hidden) return;
    const mes = CIERRE_VISTAS.includes(vistaActiva(doc)) ? mesEnCierre() : "";
    const ahora = Date.now();
    if (mes !== cierreMes) {
      volcarCierre();
      cierreMes = mes;
      cierreUltimo = 0;
    }
    if (!mes) return;
    if (cierreUltimo && ahora - cierreUltimo <= CIERRE_PAUSA_S * 1000) cierrePendiente += (ahora - cierreUltimo) / 1000;
    cierreUltimo = ahora;
    if (cierrePendiente >= 15) volcarCierre();
  }

  function vigilarCierre(doc) {
    let ultimoScroll = 0;
    const alActuar = () => actividadCierre(doc);
    doc.addEventListener("pointerdown", alActuar, true);
    doc.addEventListener("keydown", alActuar, true);
    globalThis.addEventListener?.(
      "scroll",
      () => {
        const ahora = Date.now();
        if (ahora - ultimoScroll < 5000) return;
        ultimoScroll = ahora;
        alActuar();
      },
      { passive: true, capture: true },
    );
    const parar = () => {
      volcarCierre();
      cierreUltimo = 0;
      comprobarFirmas();
    };
    doc.addEventListener("visibilitychange", parar);
    globalThis.addEventListener?.("pagehide", parar);
    globalThis.addEventListener?.("hashchange", parar);
    // Al firmar se repinta Cierre: tras un toque en Cierre se mira si el mes ya sale firmado (una lectura del almacén).
    doc.addEventListener("click", (event) => {
      if (event.target?.closest?.("#cierre")) globalThis.setTimeout?.(comprobarFirmas, 1500);
    });
    globalThis.setTimeout?.(comprobarFirmas, 3000);
  }

  function init(doc = globalThis.document) {
    if (!doc) return;
    vigilarCierre(doc);
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

  return { STORAGE_KEY, FUNCIONES, PUERTA_GRUPOS, PUERTA_PCT, CIERRE_PAUSA_S, CIERRE_VISTAS, CIERRE_LINEA_BASE, normalize, registrar, registrarClasificacion, corregirClasificacion, calibracion, resumen, mesesGuardados, frase, registrarTiempoCierre, registrarFirmaCierre, cierre, fraseCierre, leer, anotar, anotarClasificacion, deshacerClasificacion: corregir, pintarInforme };
});
