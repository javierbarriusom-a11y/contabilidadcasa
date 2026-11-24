// DUO-D2 (duodécima auditoría; recoge UND-16): hitos y cierre de cada deuda saldada.
//  - Deuda › Plan, bajo el seguimiento: «Cerrar las deudas saldadas», con tres pasos por deuda (carta de saldo cero, baja en ficheros si la
//    hubo, comprobar la CIRBE), cada uno con su fecha. Completo, se dice y se queda en una línea. Sin titular nuevo (XGO-01).
//  - Hoy, el día en que la app ve por primera vez una deuda saldada: una tarjeta teñida (conclusión, sin confeti) con lo que pasa con su
//    cuota. Puerta de fecha (D-N30, un cambio de Hoy por semana): 21/12 extractos atrasados (DUO-04), 28/12 la pregunta del seguimiento
//    (DUO-D1); esta, el 4/1/2027.
// Lo guardado (en este navegador y en la copia): el primer día en que se vio cada deuda saldada y los pasos marcados. Nada se envía.
// Script de pantalla: comparte el ámbito global de app.js (qs, escapeHtml, money, storageGet/Set/Key, isoLocalDate, canonicalDebtContractRows…).

const HITOS_KEY = "deuda-hitos";
const CIERRES_KEY = "deuda-cierres";
const HITO_HOY_DESDE = "2027-01-04";
const HITO_ESTADO_TEXTO = { pedida: "Pedida", recibida: "La tenemos", hecha: "Hecha", "no-hacia-falta": "No hacía falta", comprobado: "Comprobado" };
let hitosEnganchado = false;

function hitosLeer(key, fallback) {
  try {
    const raw = storageGet(key, "");
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function hitosEscribir(key, value) {
  try {
    storageSet(key, JSON.stringify(value));
  } catch {
    /* sin almacenamiento */
  }
}

function hitosContratos() {
  try {
    return typeof canonicalDebtContractRows === "function" ? canonicalDebtContractRows() : [];
  } catch {
    return [];
  }
}

// Anota las deudas saldadas que la app ve por primera vez (lo llaman Deuda › Plan y Hoy al pintar).
function hitosRegistrar(hoy = isoLocalDate(new Date())) {
  const H = globalThis.FinanceHitosDeuda;
  if (!H) return null;
  const contratos = hitosContratos();
  const { estado, cambiado } = H.registrar(contratos, hitosLeer(storageKey(HITOS_KEY), null), hoy);
  if (cambiado) hitosEscribir(storageKey(HITOS_KEY), estado);
  return { estado, contratos };
}

function hitosFecha(iso) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(iso || "")) ? String(iso).split("-").reverse().join("/") : "";
}

function hitosCierresHtml(lista) {
  if (!lista.length) return "";
  const filas = lista.map((d) => {
    if (d.completo) {
      return `<li class="hito-cierre is-completo" data-hito-deuda="${escapeHtml(d.id)}"><span aria-hidden="true">✓</span> <strong>${escapeHtml(d.label)}</strong>: cierre completo (carta, ficheros y CIRBE).</li>`;
    }
    const pasos = d.pasos.map((p) => {
      const hecho = p.marcado ? `<span class="hito-paso-estado">${escapeHtml(HITO_ESTADO_TEXTO[p.marcado.estado] || p.marcado.estado)} el ${escapeHtml(hitosFecha(p.marcado.fecha))}</span>` : "";
      const botones = p.terminado ? "" : p.estados
        .filter((e) => e !== p.marcado?.estado)
        .map((e) => `<button type="button" class="e19-btn e19-btn-secondary" data-hito-marcar="${escapeHtml(e)}" data-hito-paso="${escapeHtml(p.id)}" data-hito-deuda="${escapeHtml(d.id)}">${escapeHtml(HITO_ESTADO_TEXTO[e])}</button>`)
        .join("");
      return `<li class="hito-paso${p.terminado ? " is-terminado" : ""}"><span class="hito-paso-forma" aria-hidden="true">${p.terminado ? "●" : p.marcado ? "◐" : "○"}</span>
        <span>${escapeHtml(p.texto)} ${hecho}${botones ? `<span class="hito-botones">${botones}</span>` : ""}</span></li>`;
    }).join("");
    return `<li class="hito-cierre" data-hito-deuda="${escapeHtml(d.id)}"><p><strong>${escapeHtml(d.label)}</strong>, saldada (la vimos el ${escapeHtml(hitosFecha(d.fecha))}). Para cerrarla del todo:</p><ol class="hito-pasos">${pasos}</ol></li>`;
  }).join("");
  return `<div class="hitos-cierre">
    <p class="cam-frase"><strong>Cerrar las deudas saldadas</strong>: lo que conviene tener por escrito al terminar de pagar.</p>
    <ul class="hitos-cierre-lista">${filas}</ul>
    <p class="e19-kpi-note">Para pedir la carta, el kit para hablar con la entidad (desde su fila en Deuda › Contratos) trae el guion. La CIRBE se pide gratis al Banco de España.</p>
  </div>`;
}

function renderHitosDeuda() {
  const box = typeof qs === "function" ? qs("planCierres") : null;
  const H = globalThis.FinanceHitosDeuda;
  if (!box || !H) return;
  try {
    const r = hitosRegistrar();
    const lista = r ? H.cierres(r.estado, hitosLeer(storageKey(CIERRES_KEY), {}), r.contratos) : [];
    const html = hitosCierresHtml(lista);
    if (box.__hitosHtml !== html) {
      box.innerHTML = html;
      box.__hitosHtml = html;
    }
  } catch (error) {
    console.error(`renderHitosDeuda: ${error.message}`);
  }
  if (!hitosEnganchado) {
    hitosEnganchado = true;
    box.addEventListener("click", (event) => {
      const b = event.target.closest("[data-hito-marcar]");
      if (!b) return;
      const pasos = hitosLeer(storageKey(CIERRES_KEY), {}) || {};
      const id = b.dataset.hitoDeuda;
      pasos[id] = { ...(pasos[id] || {}), [b.dataset.hitoPaso]: { estado: b.dataset.hitoMarcar, fecha: isoLocalDate(new Date()) } };
      hitosEscribir(storageKey(CIERRES_KEY), pasos);
      globalThis.FinanceMedidor?.anotar("hitos-deuda", "accion");
      renderHitosDeuda();
      box.querySelector(`[data-hito-deuda="${CSS.escape(id)}"]`)?.querySelector("button, strong")?.focus?.();
    });
  }
}

// Hoy: la tarjeta del hito, solo el día en que se ve por primera vez la deuda saldada.
function hitoDeudaHoyHtml(hoy = isoLocalDate(new Date())) {
  try {
    const H = globalThis.FinanceHitosDeuda;
    if (String(hoy) < HITO_HOY_DESDE || !H) return "";
    const r = hitosRegistrar(hoy);
    const h = r ? H.hitoDeHoy(r.estado, r.contratos, hoy) : null;
    if (!h) return "";
    const cuota = h.cuota > 0 ? `${money(h.cuota, true)} al mes` : "su cuota";
    const destino = h.quedan > 0 ? `${cuota} que ya pueden ir a la siguiente deuda` : `${cuota} que ya son vuestros: no os queda ninguna deuda con cuota`;
    const mas = h.mas > 0 ? ` Y ${h.mas === 1 ? "otra más" : `${h.mas} más`}.` : "";
    return `<div class="hoy-v2-hecho hito-deuda-hoy" data-hoy-v2-hito>
      <span class="hoy-v2-hecho-marca" aria-hidden="true">✓</span>
      <span><strong>Habéis saldado ${escapeHtml(h.label)}</strong><br>${escapeHtml(destino)}.${escapeHtml(mas)} <a href="#deuda-ruta">Lo que queda para cerrarla</a></span>
    </div>`;
  } catch {
    return "";
  }
}

globalThis.renderHitosDeuda = renderHitosDeuda;
globalThis.hitoDeudaHoyHtml = hitoDeudaHoyHtml;
