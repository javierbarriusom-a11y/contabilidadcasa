// views/huella-extracto.js · DEC-13 (18/11/2026): Ajustes › Uso de la app › «Huella anónima del extracto». Plegada; al abrirla genera la huella de
// los movimientos que piden partida (canonical-extract-fingerprint.js), la enseña tal cual se copiará y la copia con un
// toque. Nada sale de la app sin ese toque, y lo copiado no lleva importes, fechas, nombres, comercios, referencias ni
// cuentas. Mide en el medidor: vista al abrirla y acción al copiar. Solo funciones a nivel superior (sin let/const).

function huellaExtractoDatos() {
  const rows = [];
  let movimientos = 0;
  let traspasos = 0;
  // baseData es un let de app.js: no cuelga de globalThis.
  (typeof baseData === "undefined" ? [] : baseData?.transactions || []).forEach((row) => {
    if (!row || !Number(row.amount)) return;
    movimientos += 1;
    if (typeof movementIsInternalTransfer === "function" && movementIsInternalTransfer(row)) {
      traspasos += 1;
      return;
    }
    if (typeof mappingForMovement === "function" && !mappingForMovement(row)) rows.push(row);
  });
  const mes = new Intl.DateTimeFormat("es-ES", { month: "long", year: "numeric" }).format(new Date());
  const cobertura = typeof clasificarV2CoberturaFrase === "function" ? clasificarV2CoberturaFrase() : "";
  return { rows, totals: { movimientos, traspasos }, cobertura, mes };
}

function huellaExtractoPintar() {
  const cuerpo = document.getElementById("huellaExtracto");
  const motor = globalThis.FinanceCanonicalExtractFingerprint;
  if (!cuerpo || !motor) return;
  const huella = motor.build(huellaExtractoDatos());
  cuerpo.innerHTML = `
    <p class="e19-kpi-note">Para mejorar las propuestas de Clasificar con vuestro banco sin que vuestros datos salgan: de cada concepto que sigue sin partida, solo su forma (BIZUM · ENVIADO · palabras). Se quitan importes, fechas, nombres, comercios, referencias, cuentas y el detalle. Lo que veis aquí es exactamente lo que se copia; pegadlo en la conversación.</p>
    <label class="huella-extracto-etiqueta" for="huellaExtractoTexto">Huella (${huella.forms.length === 1 ? "1 forma" : `${huella.forms.length} formas`})</label>
    <textarea id="huellaExtractoTexto" class="huella-extracto-texto" readonly rows="10" spellcheck="false"></textarea>
    <div class="huella-extracto-acciones">
      <button type="button" class="e19-btn e19-btn-secondary" id="huellaExtractoCopiar">Copiar la huella</button>
      <span class="e19-kpi-note" id="huellaExtractoEstado" role="status" aria-live="polite"></span>
    </div>`;
  document.getElementById("huellaExtractoTexto").value = huella.text;
}

async function huellaExtractoCopiar() {
  const campo = document.getElementById("huellaExtractoTexto");
  const estado = document.getElementById("huellaExtractoEstado");
  if (!campo) return;
  let copiada = false;
  try {
    await navigator.clipboard.writeText(campo.value);
    copiada = true;
  } catch {
    // Sin permiso de portapapeles (o en http): se selecciona para copiar a mano, y como último intento, execCommand.
    campo.focus();
    campo.select();
    try {
      copiada = document.execCommand("copy");
    } catch {
      copiada = false;
    }
  }
  if (estado) estado.textContent = copiada ? "Copiada. Pegadla en la conversación." : "No se ha podido copiar sola: está seleccionada, copiadla a mano.";
  if (copiada) globalThis.FinanceMedidor?.anotar("huella-extracto", "accion");
}

function setupHuellaExtracto() {
  const card = document.getElementById("huellaExtractoCard");
  if (!card || card.dataset.enlazada) return;
  card.dataset.enlazada = "1";
  card.addEventListener("toggle", () => {
    if (!card.open) return;
    huellaExtractoPintar();
    globalThis.FinanceMedidor?.anotar("huella-extracto", "vista");
  });
  card.addEventListener("click", (event) => {
    if (event.target?.closest?.("#huellaExtractoCopiar")) huellaExtractoCopiar();
  });
}

if (typeof document !== "undefined") {
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", setupHuellaExtracto);
  else setupHuellaExtracto();
}
