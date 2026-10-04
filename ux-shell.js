(function exposeFinanceUxShell(root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.FinanceUxShell = api;
  if (root && typeof document !== "undefined" && typeof window !== "undefined") {
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", () => api.mountReleaseInfo());
    else api.mountReleaseInfo();
    api.mountAmountInputs(document);
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function buildFinanceUxShell() {
  "use strict";

  // WP-01 (NXP-02): versión que lleva ESTE fichero. En el repositorio vale «dev»;
  // tools/build-public-site.mjs la reescribe en dist con el GITHUB_SHA y la hora del build, la misma
  // referencia que escribe en version.json. Así la página sabe qué versión está ejecutando aunque el
  // Service Worker se la haya servido de caché, y puede compararla con la publicada.
  const BUILD_INFO = { version: "dev", builtAt: "" };
  const CACHE_PREFIX = "finanzas-casa-shell-";
  const NOVEDADES_SEEN_KEY = "novedades-ultima-vista";
  const VERSION_CHECK_MIN_INTERVAL_MS = 60 * 1000;
  const UPDATE_READY_POLL_MS = 3000;
  const UPDATE_READY_MAX_WAIT_MS = 60 * 1000;

  function shouldRenderView({ viewId = "", lastView = "", revision = 0, lastRevision = -1, force = false } = {}) {
    if (force) return true;
    return String(viewId) !== String(lastView) || Number(revision) !== Number(lastRevision);
  }

  function makeDocumentTitle(title, brand = "Finanzas Casa") {
    const cleanTitle = String(title || "Dashboard").trim();
    const cleanBrand = String(brand || "Finanzas Casa").trim();
    return cleanTitle === cleanBrand ? cleanBrand : `${cleanTitle} | ${cleanBrand}`;
  }

  function statusMessage(title, { busy = false } = {}) {
    const cleanTitle = String(title || "Esta sección").trim();
    return busy ? `Calculando ${cleanTitle}.` : `${cleanTitle} lista.`;
  }

  // --- WP-01 · sello de versión ---------------------------------------------------------------

  // Un SHA de commit publicado; «dev», «local» o vacío no son versiones comparables.
  function isPublishedVersion(version) {
    return /^[0-9a-f]{7,40}$/i.test(String(version || ""));
  }

  function shortVersion(version) {
    return isPublishedVersion(version) ? String(version).slice(0, 7).toLowerCase() : null;
  }

  function formatBuildDate(builtAt) {
    const date = new Date(builtAt || "");
    if (!builtAt || Number.isNaN(date.getTime())) return null;
    return new Intl.DateTimeFormat("es-ES", {
      day: "numeric",
      month: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "Europe/Madrid",
    }).format(date);
  }

  function formatBuildStamp(info = {}) {
    const short = shortVersion(info.version);
    if (!short) return "Versión de desarrollo";
    const date = formatBuildDate(info.builtAt);
    return date ? `Versión ${short} · ${date}` : `Versión ${short}`;
  }

  // «current» (la publicada es la que corre), «outdated» (hay otra publicada) o «unknown» (no se
  // puede saber: en local, sin red o sin version.json). Nunca se avisa con «unknown».
  function compareDeployedVersion({ running, published } = {}) {
    if (!isPublishedVersion(running) || !isPublishedVersion(published)) return "unknown";
    return String(running).toLowerCase() === String(published).toLowerCase() ? "current" : "outdated";
  }

  // El Service Worker hace skipWaiting() + clients.claim(): nunca hay un worker «en espera». Que la
  // versión nueva está lista se sabe porque su caché existe y la anterior ya se borró (activate).
  function isPublishedVersionCached(cacheKeys = [], published = "") {
    if (!isPublishedVersion(published)) return false;
    const expected = `${CACHE_PREFIX}${String(published).slice(0, 12)}`;
    const shells = cacheKeys.filter((key) => String(key).startsWith(CACHE_PREFIX));
    return shells.includes(expected) && shells.every((key) => key === expected);
  }

  // Un cambio de controlador solo es una actualización si la página ya tenía uno al cargar; la
  // primera instalación del worker también lo dispara y no es una versión nueva.
  function isUpdateControllerChange({ hadController = false } = {}) {
    return Boolean(hadController);
  }

  // --- WP-01 · «Novedades» --------------------------------------------------------------------

  // Las novedades que este dispositivo aún no ha visto (la lista viene de la más reciente a la más
  // antigua). Sin marca previa solo cuenta la más reciente: el historial entero como «nuevo» sería
  // ruido la primera vez.
  function unseenNovedades(entries = [], lastSeenId = "") {
    if (!entries.length) return [];
    if (!lastSeenId) return entries.slice(0, 1);
    const index = entries.findIndex((entry) => entry.id === lastSeenId);
    return index === -1 ? entries.slice(0, 1) : entries.slice(0, index);
  }

  function formatNovedadDate(fecha) {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(fecha || ""));
    return match ? `${Number(match[3])}/${Number(match[2])}/${match[1]}` : "";
  }

  function validateNovedades(entries = []) {
    const problems = [];
    const ids = new Set();
    entries.forEach((entry, index) => {
      const where = entry?.id || `#${index}`;
      if (!entry?.id) problems.push(`${where}: sin id`);
      else if (ids.has(entry.id)) problems.push(`${where}: id repetido`);
      ids.add(entry?.id);
      if (!formatNovedadDate(entry?.fecha)) problems.push(`${where}: fecha no es AAAA-MM-DD`);
      const text = String(entry?.texto || "").trim();
      if (!text) problems.push(`${where}: sin texto`);
      if (text.length > 140) problems.push(`${where}: texto de más de 140 caracteres`);
      if (entry?.href != null && !/^#[a-z0-9-]+$/i.test(entry.href)) problems.push(`${where}: href debe ser #vista`);
      const previous = entries[index - 1];
      if (previous && String(previous.fecha) < String(entry?.fecha)) problems.push(`${where}: fuera de orden (la más reciente primero)`);
    });
    return problems;
  }

  // --- WP-01 · enganche en el navegador -------------------------------------------------------
  // Sin tocar app.js (techo con trinquete): el sello y «Novedades» viven en el pie del menú y el
  // aviso de versión nueva en un toast propio. Nunca recarga solo: el hogar decide cuándo.

  function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
  }

  function readSeen(storage) {
    try {
      return storage?.getItem(NOVEDADES_SEEN_KEY) || "";
    } catch {
      return "";
    }
  }

  function writeSeen(storage, id) {
    try {
      storage.setItem(NOVEDADES_SEEN_KEY, id);
    } catch {
      // Navegación privada o almacenamiento bloqueado: la marca solo vive esta visita.
    }
  }

  function renderNovedades(doc, entries, storage) {
    const list = doc.getElementById("novedadesList");
    const badge = doc.getElementById("novedadesBadge");
    if (!list) return;
    list.innerHTML = entries.length
      ? entries.map((entry) => {
        const text = escapeHtml(entry.texto);
        const body = entry.href ? `<a href="${escapeHtml(entry.href)}">${text}</a>` : text;
        return `<li><time datetime="${escapeHtml(entry.fecha)}">${formatNovedadDate(entry.fecha)}</time> ${body}</li>`;
      }).join("")
      : "<li>Aún no hay novedades anotadas.</li>";
    if (badge) {
      const count = unseenNovedades(entries, readSeen(storage)).length;
      badge.hidden = count === 0;
      badge.textContent = count === 1 ? "1 nueva" : `${count} nuevas`;
    }
  }

  function mountReleaseInfo({
    doc = document,
    win = window,
    entries = win.FinanceNovedades || [],
    buildInfo = BUILD_INFO,
  } = {}) {
    const storage = (() => {
      try {
        return win.localStorage;
      } catch {
        return null;
      }
    })();
    const label = doc.getElementById("versionStampLabel");
    if (label) label.textContent = formatBuildStamp(buildInfo);
    renderNovedades(doc, entries, storage);
    const details = doc.getElementById("versionStamp");
    details?.addEventListener("toggle", () => {
      if (!details.open || !entries.length) return;
      writeSeen(storage, entries[0].id);
      renderNovedades(doc, entries, storage);
    });

    const toast = doc.getElementById("updateToast");
    const message = doc.getElementById("updateToastMessage");
    const button = doc.getElementById("updateToastButton");
    if (!toast || !message || !button) return;
    button.addEventListener("click", () => win.location.reload());
    let state = "idle";
    const showReady = () => {
      state = "ready";
      message.textContent = "Hay una versión nueva de la app.";
      button.hidden = false;
      toast.hidden = false;
    };
    const showDownloading = () => {
      if (state !== "idle") return;
      state = "downloading";
      message.textContent = "Descargando la versión nueva…";
      button.hidden = true;
      toast.hidden = false;
    };

    const sw = win.navigator?.serviceWorker;
    const hadController = Boolean(sw?.controller);
    sw?.addEventListener?.("controllerchange", () => {
      if (isUpdateControllerChange({ hadController })) showReady();
    });

    const waitUntilCached = async (published) => {
      if (!sw || !win.caches?.keys) {
        showReady();
        return;
      }
      showDownloading();
      try {
        const registration = await sw.getRegistration?.();
        await registration?.update?.();
      } catch {
        // Sin red: se sigue comprobando la caché por si la actualización ya estaba en curso.
      }
      const started = Date.now();
      const poll = async () => {
        if (state === "ready") return;
        let keys = [];
        try {
          keys = await win.caches.keys();
        } catch {
          keys = [];
        }
        if (isPublishedVersionCached(keys, published) || Date.now() - started >= UPDATE_READY_MAX_WAIT_MS) showReady();
        else win.setTimeout(poll, UPDATE_READY_POLL_MS);
      };
      poll();
    };

    let lastCheck = 0;
    const checkPublished = async () => {
      if (state !== "idle" || !isPublishedVersion(buildInfo.version) || typeof win.fetch !== "function") return;
      if (Date.now() - lastCheck < VERSION_CHECK_MIN_INTERVAL_MS) return;
      lastCheck = Date.now();
      try {
        const response = await win.fetch("version.json", { cache: "no-store" });
        if (!response.ok) return;
        const published = (await response.json())?.version;
        if (compareDeployedVersion({ running: buildInfo.version, published }) === "outdated") await waitUntilCached(published);
      } catch {
        // Sin red o sin version.json: el sello sigue a la vista y no se avisa de nada.
      }
    };
    checkPublished();
    doc.addEventListener("visibilitychange", () => {
      if (doc.visibilityState === "visible") checkPublished();
    });
  }

  // --- WP-11 · campo de importe (NXP-05) ------------------------------------------------------
  //
  // `<input type="number">` en un iPhone en español no deja escribir «1.234,56», no pega «1.234,56 €» y
  // muestra flechas que suman céntimos. Los campos de importe de Registrar pasan a `type="text"` con
  // teclado decimal y `data-amount-input`; este lector entiende cómo escribe un hogar español, y al salir
  // del campo se pone el separador de miles. Es un lector PROPIO: el `parseAmount` general de app.js lee
  // también tipos y años de campos numéricos, donde «2.125» es 2,125 %, y no se toca.
  //
  // Vacío NO es cero: vacío = «sin dato» (un real vacío usa el previsto), «0» = cero de verdad.

  const MINUS_SIGNS = /[\u2212\u2012\u2013\u2014\uFE63\uFF0D]/g;

  /**
   * Importe escrito o pegado → número; `null` si está vacío o no es un importe.
   * «1.234,56», «1234,56», «1.234», «1 234,56 €», «-12,5», «−12,5», «1,234.56» (pegado de un sitio en inglés).
   */
  function parseAmountInput(value) {
    if (typeof value === "number") return Number.isFinite(value) ? value : null;
    let text = String(value ?? "").replace(MINUS_SIGNS, "-").replace(/[\s\u00A0\u202F€]/g, "").replace(/^\+/, "");
    if (!text) return null;
    const negative = /^-/.test(text) || /-$/.test(text);
    text = text.replace(/^-|-$/g, "");
    text = text.replace(/^(\d+),$/, "$1"); // «12,» a medio escribir es 12
    if (!/^\d[\d.,]*$/.test(text) || /[.,]$/.test(text)) return null;
    const lastComma = text.lastIndexOf(",");
    const lastDot = text.lastIndexOf(".");
    let integer = text;
    let decimals = "";
    if (lastComma >= 0 && lastDot >= 0) {
      // Los dos: el último es el decimal y el otro, el de miles («1.234,56» o «1,234.56»).
      const decimalSep = lastComma > lastDot ? "," : ".";
      const thousandsSep = decimalSep === "," ? "." : ",";
      [integer, decimals] = [text.slice(0, text.lastIndexOf(decimalSep)), text.slice(text.lastIndexOf(decimalSep) + 1)];
      if (integer.includes(decimalSep) || !new RegExp(`^\\d{1,3}(\\${thousandsSep}\\d{3})*$`).test(integer)) return null;
      integer = integer.split(thousandsSep).join("");
    } else if (lastComma >= 0) {
      if (text.indexOf(",") !== lastComma) return null;
      [integer, decimals] = text.split(",");
    } else if (lastDot >= 0) {
      // Solo puntos: «1.234» y «1.234.567» son miles (así se escribe en España); «12.5» o «12.50», decimal.
      if (/^\d{1,3}(\.\d{3})+$/.test(text)) integer = text.split(".").join("");
      else if (text.indexOf(".") === lastDot) [integer, decimals] = text.split(".");
      else return null;
    }
    const number = Number(`${integer}.${decimals || "0"}`);
    if (!Number.isFinite(number)) return null;
    return negative && number !== 0 ? -number : number;
  }

  // Número → «1.234,56» (siempre dos decimales y separador de miles, también en «1.234»). Vacío si no hay número.
  function formatAmountInput(value) {
    if (value === "" || value === null || value === undefined) return "";
    const number = Number(value);
    if (!Number.isFinite(number)) return "";
    const [integer, decimals] = Math.abs(number).toFixed(2).split(".");
    return `${number < 0 && Number(Math.abs(number).toFixed(2)) !== 0 ? "-" : ""}${integer.replace(/\B(?=(\d{3})+(?!\d))/g, ".")},${decimals}`;
  }

  /** @param {{ value?: string }} input */
  function readAmountInput(input) {
    const text = String(input?.value ?? "").trim();
    const value = parseAmountInput(text);
    return { empty: text === "", value, invalid: text !== "" && value === null };
  }

  const AMOUNT_ERROR_TEXT = "No es un importe: escríbelo como 1.234,56. No se ha guardado.";
  let amountErrorSeq = 0;

  // Al salir del campo: con un importe válido, se reescribe con formato; si no, queda marcado y con el
  // motivo a la vista debajo (texto, no solo el borde rojo), enlazado al campo con aria-describedby.
  function normalizeAmountField(input) {
    const { empty, value, invalid } = readAmountInput(input);
    const doc = input.ownerDocument;
    if (!input.id) input.id = `importe-${(amountErrorSeq += 1)}`;
    const errorId = `${input.id}-error`;
    const existing = doc?.getElementById(errorId);
    if (invalid) {
      input.setAttribute("aria-invalid", "true");
      if (!existing && doc) {
        const message = doc.createElement("small");
        message.id = errorId;
        message.className = "amount-input-error";
        message.textContent = AMOUNT_ERROR_TEXT;
        input.parentNode?.appendChild(message);
      }
      input.setAttribute("aria-describedby", errorId);
      return;
    }
    clearAmountError(input);
    if (!empty) input.value = formatAmountInput(value);
  }

  function clearAmountError(input) {
    const errorId = `${input.id}-error`;
    input.removeAttribute("aria-invalid");
    if (input.getAttribute("aria-describedby") === errorId) input.removeAttribute("aria-describedby");
    input.ownerDocument?.getElementById(errorId)?.remove();
  }

  // Signo «−» explícito: el teclado decimal del iPhone no tiene la tecla del menos. Avisa como si se escribiera.
  function toggleAmountSign(input) {
    if (!input || input.readOnly || input.disabled) return;
    const { value, empty } = readAmountInput(input);
    if (empty || value === null || value === 0) return;
    input.value = formatAmountInput(-value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
  }

  // Delegado en el documento: vale para los campos de index.html y para los que app.js pinta después.
  function mountAmountInputs(doc) {
    if (!doc?.addEventListener || doc.amountInputsMounted) return;
    doc.amountInputsMounted = true;
    doc.addEventListener("focusout", (event) => {
      if (event.target?.matches?.("input[data-amount-input]")) normalizeAmountField(event.target);
    });
    // El aviso se quita al corregir, no al salir: si se quitara al tocar «Registrar», el botón subiría bajo el
    // dedo y el toque caería fuera (WP-25, medido en la ventana «Registrar gasto» a 390 px).
    doc.addEventListener("input", (event) => {
      const input = event.target;
      if (input?.matches?.("input[data-amount-input][aria-invalid]") && !readAmountInput(input).invalid) clearAmountError(input);
    });
    doc.addEventListener("click", (event) => {
      const button = event.target?.closest?.("[data-amount-sign]");
      if (button) toggleAmountSign(doc.getElementById(button.dataset.amountSign));
    });
  }

  return {
    shouldRenderView,
    makeDocumentTitle,
    statusMessage,
    BUILD_INFO,
    isPublishedVersion,
    shortVersion,
    formatBuildStamp,
    compareDeployedVersion,
    isPublishedVersionCached,
    isUpdateControllerChange,
    unseenNovedades,
    formatNovedadDate,
    validateNovedades,
    mountReleaseInfo,
    parseAmountInput,
    formatAmountInput,
    readAmountInput,
    normalizeAmountField,
    toggleAmountSign,
    mountAmountInputs,
    AMOUNT_ERROR_TEXT,
  };
});
