// XDA-02 · PR-2 (25/10/2026): el buzón de extractos, lado de la app (docs/XDA02_DISENO.md).
//
// Un Atajo de iOS en la hoja Compartir de la app del banco manda el fichero a la Edge Function `statement-inbox`
// (statement-inbox.js) con un token personal. Aquí:
//   - se prepara el Atajo: se crea el token (32 bytes aleatorios; a Supabase solo va su hash SHA-256 y el valor se
//     enseña una vez), se ve cuándo caduca y cuándo se usó, y se revoca;
//   - se enseñan los extractos que esperan (en Movimientos y en Importar) y se importan por el asistente de siempre,
//     que es quien enseña la revisión: nada entra al libro sin confirmarlo (RQ-09);
//   - importado o descartado, el fichero se borra del buzón.
//
// Solo funciona con la sesión iniciada (es la nube del hogar) y no habla con ningún servidor nuevo: el mismo proyecto de
// Supabase de la sincronización. Sin sesión, la tarjeta lo dice y no hace nada. Script clásico con defer, antes de app.js:
// `supabaseClient` y `remoteUser` son de app.js y se leen al usarse, nunca al cargar.

(function exposeFinanceBuzon(root) {
  const TABLA_TOKENS = "finance_statement_inbox_tokens";
  const TABLA_BUZON = "finance_statement_inbox";
  const BUCKET = "finance-statement-inbox";
  const TOKEN_DIAS = 89; // por debajo del máximo de 90 que exige la base de datos
  const REFRESCO_MS = 60000;
  const LEIBLES = ["csv", "xls", "xlsx"]; // el PDF espera a XDA-03

  const estado = { aviso: "", disponible: null, pendientes: [], token: null, cargadoEn: 0, cargando: null, nuevoToken: "", error: "", importando: null, ocupado: false };

  function esc(value) {
    return typeof escapeHtml === "function" ? escapeHtml(value) : String(value ?? "").replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
  }

  function sesion() {
    const client = typeof supabaseClient !== "undefined" ? supabaseClient : null;
    const user = typeof remoteUser !== "undefined" ? remoteUser : null;
    return client && user ? { client, user } : null;
  }

  function urlFuncion() {
    const url = String(root.SUPABASE_CONFIG?.url || "").replace(/\/+$/, "");
    return url ? `${url}/functions/v1/statement-inbox` : "";
  }

  function base64url(bytes) {
    let bin = "";
    bytes.forEach((b) => { bin += String.fromCharCode(b); });
    return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  }

  async function sha256Hex(texto) {
    const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(texto));
    return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
  }

  function hace(iso) {
    const min = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
    if (min < 60) return min <= 1 ? "hace un momento" : `hace ${min} min`;
    const horas = Math.round(min / 60);
    if (horas < 24) return `hace ${horas} ${horas === 1 ? "hora" : "horas"}`;
    const dias = Math.round(horas / 24);
    return `hace ${dias} ${dias === 1 ? "día" : "días"}`;
  }

  function fechaCorta(iso) {
    return new Date(iso).toLocaleDateString("es-ES", { day: "numeric", month: "short" });
  }

  function repintar() {
    root.movimientosV2Render?.();
    root.importarV2Render?.();
  }

  // ---------- lectura (con la sesión iniciada; como mucho una vez por minuto salvo que se fuerce) ----------

  async function refrescar({ forzar = false } = {}) {
    const s = sesion();
    if (!s) {
      const habia = estado.pendientes.length || estado.token;
      estado.pendientes = [];
      estado.token = null;
      if (habia) repintar();
      return;
    }
    if (estado.cargando) return estado.cargando;
    // Sin el buzón desplegado se vuelve a mirar cada hora, no cada minuto.
    if (!forzar && Date.now() - estado.cargadoEn < (estado.disponible === false ? 60 * REFRESCO_MS : REFRESCO_MS)) return;
    estado.cargando = (async () => {
      try {
        const ahora = new Date().toISOString();
        const [tokens, items] = await Promise.all([
          s.client.from(TABLA_TOKENS).select("id, label, created_at, expires_at, last_used_at").is("revoked_at", null).gt("expires_at", ahora).order("created_at", { ascending: false }).limit(1),
          s.client.from(TABLA_BUZON).select("id, object_path, file_name, kind, size_bytes, received_at, expires_at").is("imported_at", null).gt("expires_at", ahora).order("received_at", { ascending: true }),
        ]);
        const fallo = tokens.error || items.error;
        // Sin las tablas (esquema aún sin desplegar, docs/XDA02_DISENO.md §6) el buzón no existe: no se enseña nada.
        if (fallo && /PGRST205|42P01|does not exist|schema cache/i.test(`${fallo.code || ""} ${fallo.message || ""}`)) {
          estado.disponible = false;
          estado.pendientes = [];
          estado.token = null;
          return;
        }
        if (fallo) throw fallo;
        estado.disponible = true;
        estado.token = tokens.data?.[0] || null;
        estado.pendientes = items.data || [];
        estado.error = "";
      } catch {
        estado.error = "No se pudo leer el buzón. Se volverá a intentar al abrir Movimientos.";
      } finally {
        estado.cargadoEn = Date.now();
        estado.cargando = null;
        repintar();
      }
    })();
    return estado.cargando;
  }

  // ---------- el Atajo: crear, revocar ----------

  async function crearToken() {
    const s = sesion();
    if (!s || estado.ocupado) return;
    estado.ocupado = true;
    try {
      const token = base64url(crypto.getRandomValues(new Uint8Array(32)));
      const ahora = new Date();
      // Uno activo cada vez: el anterior se revoca antes de crear el nuevo.
      const revocar = await s.client.from(TABLA_TOKENS).update({ revoked_at: ahora.toISOString() }).is("revoked_at", null);
      if (revocar.error) throw revocar.error;
      const alta = await s.client.from(TABLA_TOKENS).insert({ token_hash: await sha256Hex(token), expires_at: new Date(ahora.getTime() + TOKEN_DIAS * 86400000).toISOString() });
      if (alta.error) throw alta.error;
      estado.nuevoToken = token; // solo en memoria, hasta «Ya está copiado» o recargar: se ve una vez
      estado.error = "";
    } catch {
      estado.error = "No se pudo preparar el Atajo. Comprueba la conexión y que la sesión siga iniciada.";
    } finally {
      estado.ocupado = false;
      await refrescar({ forzar: true });
    }
  }

  async function revocar() {
    const s = sesion();
    if (!s || !estado.token || estado.ocupado) return;
    estado.ocupado = true;
    try {
      const res = await s.client.from(TABLA_TOKENS).update({ revoked_at: new Date().toISOString() }).eq("id", estado.token.id);
      if (res.error) throw res.error;
      estado.nuevoToken = "";
      estado.aviso = "Atajo desactivado: lo que mande ya no llegará.";
    } catch {
      estado.error = "No se pudo desactivar el Atajo. Vuelve a intentarlo.";
    } finally {
      estado.ocupado = false;
      await refrescar({ forzar: true });
    }
  }

  // ---------- importar o descartar lo que espera ----------

  async function borrar(item) {
    const s = sesion();
    if (!s || !item) return;
    const marca = await s.client.from(TABLA_BUZON).update({ imported_at: new Date().toISOString() }).eq("id", item.id);
    if (marca.error) throw marca.error;
    // Si borrar el fichero falla, la fila ya no sale como pendiente y la función lo borra a los 7 días.
    await s.client.storage.from(BUCKET).remove([item.object_path]);
    await s.client.from(TABLA_BUZON).delete().eq("id", item.id);
  }

  async function importar(id) {
    const s = sesion();
    const item = estado.pendientes.find((p) => p.id === id);
    if (!s || !item || estado.ocupado || !LEIBLES.includes(item.kind)) return;
    const irAImportar = () => {
      if (typeof root.setActiveView !== "function") return;
      history.pushState(null, "", "#datos-importar");
      root.setActiveView("datos-importar"); // Registrar › Importar
    };
    // Una revisión a medias no se pisa (como en el PR-1): se enseña y se avisa; el extracto sigue en el buzón.
    if (typeof datosImportarSession !== "undefined" && datosImportarSession) {
      estado.aviso = "Hay una importación a medias: termínala o pulsa «Elegir otro fichero» y vuelve a traer este del buzón.";
      irAImportar();
      repintar();
      return;
    }
    estado.ocupado = true;
    try {
      const res = await s.client.storage.from(BUCKET).download(item.object_path);
      if (res.error) throw res.error;
      const fichero = new File([res.data], item.file_name, { type: res.data.type || "" });
      irAImportar();
      if (typeof datosImportarLastResult !== "undefined") datosImportarLastResult = null; // el «importado» anterior ya se vio
      estado.importando = { id: item.id, fileName: item.file_name };
      await handleDatosImportarFile({ target: { files: [fichero] } }); // la revisión de siempre: cuadre, duplicados, cuenta
      estado.error = "";
    } catch {
      estado.importando = null;
      estado.error = "No se pudo traer el extracto del buzón. Comprueba la conexión.";
    } finally {
      estado.ocupado = false;
      repintar();
    }
  }

  // Lo llama Importar v2 al terminar un lote: si era el del buzón, sale del buzón.
  async function alImportar(resultado) {
    const pendiente = estado.importando;
    if (!pendiente || !resultado || resultado.fileName !== pendiente.fileName) return;
    estado.importando = null;
    try {
      await borrar(estado.pendientes.find((p) => p.id === pendiente.id) || { id: pendiente.id, object_path: "" });
    } catch {
      /* se reintenta al refrescar: seguirá saliendo como pendiente */
    }
    await refrescar({ forzar: true });
  }

  async function descartar(id) {
    const item = estado.pendientes.find((p) => p.id === id);
    if (!item || estado.ocupado) return;
    estado.ocupado = true;
    try {
      await borrar(item);
      estado.aviso = "Extracto borrado del buzón.";
    } catch {
      estado.error = "No se pudo borrar del buzón. Vuelve a intentarlo.";
    } finally {
      estado.ocupado = false;
      await refrescar({ forzar: true });
    }
  }

  // ---------- pintado ----------

  function icono(path) {
    return `<svg class="mov-v2-ico" viewBox="0 0 24 24" aria-hidden="true">${path}</svg>`;
  }

  // Lo último que ha pasado en el buzón (borrado, desactivado, importación a medias), hasta la siguiente acción del buzón.
  function htmlAviso() {
    return estado.aviso ? `<p class="buzon-aviso" role="status">${esc(estado.aviso)}</p>` : "";
  }

  // En Movimientos (y arriba de Importar): lo que espera en el buzón. Sin nada, no ocupa pantalla.
  function htmlPendientes() {
    refrescar();
    if (!sesion() || !estado.pendientes.length) return "";
    const filas = estado.pendientes.slice(0, 3).map((item) => {
      const leible = LEIBLES.includes(item.kind);
      return `<li class="buzon-item">
        <span class="mov-v2-main"><strong>${esc(item.file_name)}</strong><span class="mov-v2-meta">${leible ? `Llegó ${esc(hace(item.received_at))} por el Atajo` : "Es un PDF: todavía no se puede leer (llegará con XDA-03)"}</span></span>
        <span class="buzon-acciones">
          <button type="button" class="e19-btn e19-btn-secondary" data-buzon-borrar="${esc(item.id)}" aria-label="Borrar ${esc(item.file_name)} del buzón">Borrar</button>
          ${leible ? `<button type="button" class="e19-btn e19-btn-primary" data-buzon-importar="${esc(item.id)}">Importar</button>` : ""}
        </span>
      </li>`;
    }).join("");
    const mas = estado.pendientes.length > 3 ? `<p class="mov-v2-meta">Y ${estado.pendientes.length - 3} más: aparecen al importar estos.</p>` : "";
    const n = estado.pendientes.length;
    return `<section class="mov-v2-card buzon-pendientes" aria-label="Buzón de extractos">
      <div class="mov-v2-section-head"><h3>En el buzón</h3><span>${n} ${n === 1 ? "extracto" : "extractos"}</span></div>
      <ul class="buzon-lista">${filas}</ul>${mas}
      ${estado.error ? `<p class="buzon-error" role="alert">${esc(estado.error)}</p>` : ""}
    </section>`;
  }

  // En Importar: preparar el Atajo, o ver que está activo y desactivarlo.
  // Solo con la sesión iniciada y el buzón desplegado; si no, Importar sigue diciendo «Aún no: … con Compartir».
  function htmlAtajo() {
    refrescar();
    if (!urlFuncion() || !sesion() || estado.disponible !== true) return "";
    const cabecera = `<span class="mov-v2-av" aria-hidden="true">${icono('<path d="M12 3v12M7 8l5-5 5 5M5 14v5h14v-5"></path>')}</span>`;
    if (estado.nuevoToken) {
      const token = estado.nuevoToken;
      return `<div class="mov-v2-card buzon-atajo is-nuevo" role="region" aria-label="Datos para el Atajo">
        <div class="mov-v2-section-head"><h3>Datos para el Atajo</h3><span>se ven una sola vez</span></div>
        <p class="mov-v2-meta">Cópialos en el Atajo «Enviar a Finanzas Casa». Si los pierdes, prepara uno nuevo: el anterior deja de valer.</p>
        <details class="buzon-pasos"><summary>Cómo crear el Atajo (2 minutos)</summary><ol>
          <li>App Atajos › <b>+</b> › llámalo «Enviar a Finanzas Casa».</li>
          <li>En sus detalles (ⓘ), activa <b>Mostrar en la hoja Compartir</b> y deja solo <b>Archivos</b>.</li>
          <li>Añade <b>Obtener contenido de la URL</b>: la dirección de esta tarjeta, método <b>POST</b>, cabeceras <b>x-inbox-token</b> (la clave de esta tarjeta) y <b>x-file-name</b> (variable «Entrada del atajo» › Nombre), y cuerpo <b>Archivo</b> con la «Entrada del atajo».</li>
          <li>Opcional: <b>Mostrar notificación</b> con el resultado, para ver «Extracto en el buzón».</li>
        </ol></details>
        <label class="buzon-campo"><span>Dirección</span><input type="text" readonly value="${esc(urlFuncion())}" data-buzon-copiable /></label>
        <label class="buzon-campo"><span>Clave del Atajo (cabecera x-inbox-token)</span><input type="text" readonly value="${esc(token)}" data-buzon-copiable /></label>
        <p class="mov-v2-meta">Caduca en ${TOKEN_DIAS} días. Solo sirve para dejar extractos en tu buzón: no puede leer nada.</p>
        <button type="button" class="e19-btn e19-btn-primary" data-buzon-copiado>Ya está copiado en el Atajo</button>
      </div>`;
    }
    if (estado.token) {
      const t = estado.token;
      return `<div class="mov-v2-card mov-v2-fila-bandeja buzon-atajo">${cabecera}<span class="mov-v2-main"><strong>Atajo activo · caduca el ${esc(fechaCorta(t.expires_at))}</strong><span class="mov-v2-meta">${t.last_used_at ? `Último envío ${esc(hace(t.last_used_at))}` : "Aún no ha mandado nada"}. Compartir un extracto con «Enviar a Finanzas Casa» lo deja aquí.</span></span>
        <span class="buzon-acciones"><button type="button" class="e19-btn e19-btn-secondary" data-buzon-revocar>Desactivar</button><button type="button" class="e19-btn e19-btn-secondary" data-buzon-crear>Nuevo</button></span>
      </div>${estado.error ? `<p class="buzon-error" role="alert">${esc(estado.error)}</p>` : ""}`;
    }
    return `<div class="mov-v2-card mov-v2-fila-bandeja buzon-atajo">${cabecera}<span class="mov-v2-main"><strong>Desde la app del banco, con Compartir</strong><span class="mov-v2-meta">Prepara el Atajo del iPhone: compartes el extracto y espera aquí hasta que lo importes (se borra a los 7 días).</span></span>
      <span class="buzon-acciones"><button type="button" class="e19-btn e19-btn-primary" data-buzon-crear${estado.ocupado ? " disabled" : ""}>Preparar el Atajo</button></span>
    </div>${estado.error ? `<p class="buzon-error" role="alert">${esc(estado.error)}</p>` : ""}`;
  }

  function enlazar() {
    if (typeof document === "undefined" || root.__buzonEnlazado) return;
    root.__buzonEnlazado = true;
    document.addEventListener("click", (event) => {
      const t = event.target;
      if (!(t instanceof Element)) return;
      if (t.closest("[data-buzon-importar], [data-buzon-borrar], [data-buzon-crear], [data-buzon-revocar]")) estado.aviso = "";
      const imp = t.closest("[data-buzon-importar]");
      if (imp) return importar(imp.dataset.buzonImportar);
      const bor = t.closest("[data-buzon-borrar]");
      if (bor) return descartar(bor.dataset.buzonBorrar);
      if (t.closest("[data-buzon-crear]")) return crearToken();
      if (t.closest("[data-buzon-revocar]")) return revocar();
      if (t.closest("[data-buzon-copiado]")) {
        estado.nuevoToken = ""; // a partir de aquí no se vuelve a ver: solo queda su hash en la nube
        return repintar();
      }
      const copiable = t.closest("[data-buzon-copiable]");
      if (copiable) copiable.select();
    });
  }

  enlazar();
  const disponible = () => Boolean(sesion()) && estado.disponible === true;

  root.FinanceBuzon = { disponible, refrescar, crearToken, revocar, importar, descartar, alImportar, htmlAviso, htmlPendientes, htmlAtajo, _estado: estado, _base64url: base64url, _sha256Hex: sha256Hex };
})(typeof window !== "undefined" ? window : globalThis);
