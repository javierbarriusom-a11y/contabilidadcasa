// UND-13 (undécima auditoría; DEC-26, 22/11/2026): kit para hablar con cada entidad. Desde la fila de cada contrato de Deuda › Contratos,
// una hoja imprimible con los datos del contrato, qué pedir (el certificado con el desglose de capital, intereses y comisiones; si hay
// impago, la quita y un plan de pagos; al pagar, la carta de saldo cero y la baja de los ficheros), un guion para la llamada y una carta
// con los datos del contrato. Lo primero antes de negociar o refinanciar es saber cuánto es capital y cuánto lo demás.
//
// Nada se envía desde la app (A11-4): se imprime, se copia o se lee en voz alta. La carta no lleva vuestros nombres ni el DNI (huecos
// entre corchetes): la app no los pone en ningún papel (privacidad, D-N25). Seguimiento: «Lo hemos pedido» y «Lo hemos recibido», con
// su fecha, en este navegador; el medidor los cuenta (la métrica de UND-13: certificados pedidos y recibidos).
//
// Script de pantalla: comparte el ámbito global de app.js (qs, money, escapeHtml, isoLocalDate, storageGet/storageSet/storageKey,
// debtContractSourceRows). Sin escuchas al cargarse: se enganchan la primera vez que se pinta Contratos.

const KIT_ENTIDAD_KEY = "kit-entidad";
const KIT_ESTADOS = Object.freeze({ active: "al día", suspended: "suspendida", default: "en impago", impago: "en impago" });

function kitGuard(fn, fallback) {
  try {
    const value = fn();
    return value === undefined ? fallback : value;
  } catch {
    return fallback;
  }
}

function kitSeguimientoTodo() {
  const parsed = kitGuard(() => JSON.parse(storageGet(storageKey(KIT_ENTIDAD_KEY), "{}")), {});
  return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
}

function kitSeguimiento(id) {
  const fila = kitSeguimientoTodo()[id];
  return fila && typeof fila === "object" ? fila : {};
}

function kitMarcar(id, campo) {
  const todo = kitSeguimientoTodo();
  todo[id] = { ...(todo[id] || {}), [campo]: isoLocalDate(new Date()) };
  kitGuard(() => storageSet(storageKey(KIT_ENTIDAD_KEY), JSON.stringify(todo)), null);
  kitGuard(() => globalThis.FinanceMedidor?.anotar?.("kit-entidad", "accion"), null);
}

function kitContrato(id) {
  return kitGuard(() => (typeof debtContractSourceRows === "function" ? debtContractSourceRows() : []).find((row) => String(row.id) === String(id)), null);
}

function kitNombre(contract) {
  return [contract.entity, contract.type].filter(Boolean).join(" · ").trim() || "la deuda";
}

function kitFecha(iso) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(iso || "")) ? String(iso).split("-").reverse().join("/") : "";
}

function kitRevolving(contract) {
  return /revolving|tarjeta/i.test(String(contract?.type || ""));
}

function kitImpago(contract) {
  return String(contract?.paymentStatus || "active") !== "active";
}

// Qué pedir, según el estado del contrato. Sin promesas de plazos ni de derechos: lo que conviene tener por escrito.
function kitQuePedir(contract) {
  const items = [
    "<strong>Certificado de deuda a fecha de hoy</strong>, por escrito, con el desglose: capital pendiente, intereses ordinarios, intereses de demora, comisiones y gastos. Es lo primero: sin él no se sabe cuánto es capital y cuánto lo demás.",
    "<strong>El cuadro de pagos que queda</strong>: cuotas, fechas y el tipo de interés que se aplica.",
  ];
  if (kitRevolving(contract)) items.push("<strong>Los intereses y la TAE de cada periodo</strong> de la tarjeta, y cuánto de cada cuota fue a capital.");
  if (kitImpago(contract)) {
    items.push("<strong>Cuánto aceptarían para cancelarla de una vez</strong> (una quita) y si lo ponen por escrito antes de pagar.");
    items.push("<strong>Un plan de pagos</strong> con una cuota que podáis asumir, y si paran los intereses de demora mientras lo negociáis.");
  } else {
    items.push("<strong>Cuánto cuesta amortizar antes</strong> (parte o todo): la comisión y el ahorro de intereses.");
  }
  items.push("<strong>Al terminar de pagar</strong>: la carta de deuda saldada (saldo cero) y, si os incluyeron, la baja en los ficheros de morosidad.");
  return items;
}

function kitGuion(contract) {
  const numero = contract.number ? `el contrato ${contract.number}` : "el contrato (tened a mano el número)";
  return [
    `Decid quiénes sois y que llamáis por ${numero}${contract.type ? `, ${contract.type}` : ""}.`,
    "Pedid el certificado de deuda con el desglose (capital, intereses, demora, comisiones) y que os lo manden por escrito.",
    kitImpago(contract) ? "Preguntad qué importe aceptarían para cancelarla de una vez y qué plan de pagos ofrecen. No aceptéis nada por teléfono." : "Preguntad cuánto cuesta amortizar antes, parte o todo.",
    "Pedid que todo lo que os ofrezcan os lo envíen por escrito, con fecha.",
    "Apuntad la fecha, el nombre de quien os atiende y la referencia de la llamada.",
    "Al colgar, marcad aquí «Lo hemos pedido».",
  ];
}

function kitCarta(contract) {
  const hoy = kitFecha(isoLocalDate(new Date()));
  const numero = contract.number || "[número de contrato]";
  return [
    `A la atención de ${contract.entity || "[entidad]"} · Servicio de atención al cliente`,
    "",
    `Asunto: solicitud de certificado de deuda del contrato ${numero}`,
    "",
    `[Nombre y apellidos], con DNI [número], titular del contrato ${numero}${contract.type ? ` (${contract.type})` : ""}, solicito que me remitan por escrito un certificado de la deuda a fecha de hoy con el desglose de capital pendiente, intereses ordinarios, intereses de demora, comisiones y gastos, y el cuadro de pagos pendiente.`,
    kitImpago(contract) ? "Les ruego también que me indiquen por escrito el importe por el que aceptarían la cancelación total de la deuda y las condiciones de un posible plan de pagos." : "",
    "",
    "Pueden enviármelo a [dirección postal o correo electrónico].",
    "",
    `En [ciudad], a ${hoy}.`,
    "",
    "Firma: [firma]",
  ].filter((linea, i, todas) => !(linea === "" && todas[i - 1] === ""));
}

function kitDatosHtml(contract) {
  const filas = [
    ["Entidad", contract.entity || "—"],
    ["Tipo", contract.type || "—"],
    ["Número de contrato", contract.number || "— (pedidlo en la llamada)"],
    ["Capital pendiente (según vuestros datos)", Number(contract.currentPrincipal) > 0 ? money(Number(contract.currentPrincipal), true) : "—"],
    ["Cuota", Number(contract.currentPayment) > 0 ? money(Number(contract.currentPayment), true) : "—"],
    ["TAE", contract.apr === null || contract.apr === undefined || contract.apr === "" ? "—" : `${String(contract.apr).replace(".", ",")} %`],
    ["Plazos que quedan", Number(contract.remainingInstallments) > 0 ? String(Math.floor(Number(contract.remainingInstallments))) : "—"],
    ["Estado", KIT_ESTADOS[contract.paymentStatus] || String(contract.paymentStatus || "al día")],
  ];
  return `<dl class="kit-entidad-datos">${filas.map(([k, v]) => `<div><dt>${escapeHtml(k)}</dt><dd>${escapeHtml(v)}</dd></div>`).join("")}</dl>`;
}

function kitSeguimientoHtml(id) {
  const s = kitSeguimiento(id);
  const linea = (campo, texto, boton) => s[campo]
    ? `<p class="kit-entidad-hecho" data-kit-hecho="${campo}">✓ ${escapeHtml(texto)} el ${escapeHtml(kitFecha(s[campo]))}</p>`
    : `<button type="button" class="e19-btn e19-btn-secondary" data-kit-marcar="${campo}">${escapeHtml(boton)}</button>`;
  return `<div class="kit-entidad-seguimiento kit-entidad-no-imprimir">
      ${linea("pedido", "Certificado pedido", "Lo hemos pedido")}
      ${s.pedido ? linea("recibido", "Certificado recibido", "Lo hemos recibido") : ""}
    </div>`;
}

function kitHtml(contract) {
  const id = String(contract.id);
  return `<div class="kit-entidad-cabecera">
      <h2 id="kitEntidadTitulo">Para hablar con ${escapeHtml(contract.entity || "la entidad")}</h2>
      <p class="e19-kpi-note">${escapeHtml(kitNombre(contract))}. Nada se envía desde la app: imprimidlo, copiad la carta o tenedlo delante al llamar.</p>
    </div>
    <section aria-labelledby="kitDatosT"><h3 id="kitDatosT">Datos del contrato</h3>${kitDatosHtml(contract)}</section>
    <section aria-labelledby="kitPedirT"><h3 id="kitPedirT">Qué pedir</h3><ol class="kit-entidad-lista">${kitQuePedir(contract).map((t) => `<li>${t}</li>`).join("")}</ol></section>
    <section aria-labelledby="kitGuionT"><h3 id="kitGuionT">Guion para la llamada</h3><ol class="kit-entidad-lista">${kitGuion(contract).map((t) => `<li>${escapeHtml(t)}</li>`).join("")}</ol></section>
    <section aria-labelledby="kitCartaT"><h3 id="kitCartaT">Carta para pedir el certificado</h3>
      <pre class="kit-entidad-carta" id="kitEntidadCarta">${escapeHtml(kitCarta(contract).join("\n"))}</pre>
      <p class="e19-kpi-note kit-entidad-no-imprimir">Lo que va entre corchetes lo rellenáis vosotros: la app no pone vuestros nombres ni el DNI en ningún papel.</p>
    </section>
    <section aria-labelledby="kitSegT" class="kit-entidad-no-imprimir"><h3 id="kitSegT">Seguimiento</h3>${kitSeguimientoHtml(id)}</section>
    <p class="e19-kpi-note">Es una guía para pedir información, no asesoramiento legal.</p>
    <div class="kit-entidad-botones kit-entidad-no-imprimir">
      <button type="button" class="e19-btn e19-btn-primary" data-kit-imprimir>Imprimir</button>
      <button type="button" class="e19-btn e19-btn-secondary" data-kit-copiar>Copiar la carta</button>
      <button type="button" class="e19-btn e19-btn-secondary" data-kit-cerrar>Cerrar</button>
    </div>
    <p class="e19-kpi-note kit-entidad-no-imprimir" id="kitEntidadNota" role="status"></p>`;
}

let kitAbiertoId = null;
let kitOpener = null;

function kitAbrir(id, opener = null) {
  const dialogo = qs("kitEntidad");
  const contract = kitContrato(id);
  if (!dialogo || !contract) return;
  kitAbiertoId = String(id);
  kitOpener = opener;
  qs("kitEntidadCuerpo").innerHTML = kitHtml(contract);
  if (!dialogo.open) {
    if (typeof dialogo.showModal === "function") dialogo.showModal();
    else dialogo.setAttribute("open", "");
  }
  kitGuard(() => globalThis.FinanceMedidor?.anotar?.("kit-entidad", "vista"), null);
  dialogo.querySelector("h2")?.setAttribute("tabindex", "-1");
  dialogo.querySelector("h2")?.focus();
}

function kitCerrar() {
  const dialogo = qs("kitEntidad");
  if (dialogo?.open) {
    if (typeof dialogo.close === "function") dialogo.close();
    else dialogo.removeAttribute("open");
  }
}

// Imprimir solo la hoja: como el informe de la Renta, se marcan los antepasados (sin :has(), que en WebKit cuesta un recorrido por
// elemento con la hoja de impresión activa).
function kitImprimir() {
  const dialogo = qs("kitEntidad");
  if (!dialogo) return;
  const antepasados = [];
  for (let nodo = dialogo.parentElement; nodo && nodo !== document.body; nodo = nodo.parentElement) antepasados.push(nodo);
  antepasados.forEach((nodo) => nodo.setAttribute("data-kit-entidad-ancestro", ""));
  document.documentElement.classList.add("imprimiendo-kit-entidad");
  document.body.classList.add("imprimiendo-kit-entidad");
  const quitar = () => {
    document.documentElement.classList.remove("imprimiendo-kit-entidad");
    document.body.classList.remove("imprimiendo-kit-entidad");
    antepasados.forEach((nodo) => nodo.removeAttribute("data-kit-entidad-ancestro"));
    window.removeEventListener("afterprint", quitar);
  };
  window.addEventListener("afterprint", quitar);
  window.print();
}

async function kitCopiar() {
  const nota = qs("kitEntidadNota");
  const texto = qs("kitEntidadCarta")?.textContent || "";
  try {
    await navigator.clipboard.writeText(texto);
    if (nota) nota.textContent = "Carta copiada: pegadla en un correo o un documento y rellenad lo que va entre corchetes.";
  } catch {
    if (nota) nota.textContent = "No se ha podido copiar: seleccionad el texto de la carta y copiadlo a mano.";
  }
}

function kitOnClick(event) {
  const abrir = event.target?.closest?.("[data-kit-entidad]");
  if (abrir) {
    kitAbrir(abrir.dataset.kitEntidad, abrir);
    return;
  }
  if (!event.target?.closest?.("#kitEntidad")) return;
  if (event.target.closest("[data-kit-cerrar]")) kitCerrar();
  else if (event.target.closest("[data-kit-imprimir]")) kitImprimir();
  else if (event.target.closest("[data-kit-copiar]")) kitCopiar();
  else {
    const marcar = event.target.closest("[data-kit-marcar]");
    if (marcar && kitAbiertoId) {
      const campo = marcar.dataset.kitMarcar;
      kitMarcar(kitAbiertoId, campo);
      qs("kitEntidadCuerpo").querySelector(".kit-entidad-seguimiento").outerHTML = kitSeguimientoHtml(kitAbiertoId);
      const nota = qs("kitEntidadNota");
      if (nota) nota.textContent = campo === "pedido" ? "Apuntado: certificado pedido hoy." : "Apuntado: certificado recibido hoy. Corregid el capital en Contratos si no coincide.";
      qs("kitEntidadCuerpo").querySelector(campo === "pedido" ? "[data-kit-marcar=\"recibido\"]" : "[data-kit-hecho=\"recibido\"]")?.focus?.();
    }
  }
}

function attachKitEntidad(doc = document) {
  if (!doc || doc.__kitEntidad) return false;
  doc.__kitEntidad = true;
  doc.addEventListener("click", kitOnClick);
  qs("kitEntidad")?.addEventListener("close", () => {
    kitAbiertoId = null;
    if (kitOpener?.isConnected) kitOpener.focus();
    kitOpener = null;
  });
  return true;
}
