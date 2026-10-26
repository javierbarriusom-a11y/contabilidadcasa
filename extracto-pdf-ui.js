// XDA-03 · nivel 1 (26/10/2026): el texto de un extracto en PDF, pegado en Importar. Lo lee canonical-statement-lines.js
// (fechas, conceptos, importes y saldos; el signo que el PDF no marca sale del saldo) y entra por el asistente de siempre:
// la misma revisión (cuadre, duplicados, cuenta, periodo) y la misma confirmación. El texto pegado solo vive en memoria y
// se borra del campo al leerlo; no se guarda en ningún almacén.
//
// Por dentro, lo leído se pasa al importador como un CSV con cabeceras conocidas (Fecha;Fecha valor;Concepto;Más datos;
// Importe;Saldo) en un fichero en memoria: así todo lo de después (huella de duplicados, bandeja, lote, «Deshacer») es
// exactamente lo de un CSV, sin tocar app.js. El nivel 2 (pdf.js) usará este mismo camino.
// Script clásico con defer, antes de app.js: lo de app.js se lee al usarse.

const EXTRACTO_PDF_NOMBRE = "Texto pegado del PDF.csv";
let extractoPdfAviso = null; // { tipo: "ok" | "error", texto, diagnostico? }

function extractoPdfCsvCampo(value) {
  const text = String(value ?? "");
  return /[;"\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function extractoPdfImporte(n) {
  return n === null || n === undefined ? "" : Number(n).toFixed(2).replace(".", ",");
}

// Lo leído, como CSV de punto y coma con coma decimal y fechas ISO (formatos que el lector de CSV reconoce sin dudar).
function extractoPdfCsv(transactions) {
  const head = "Fecha;Fecha valor;Concepto;Más datos;Importe;Saldo";
  const rows = transactions.map((t) => [t.date, t.valueDate || t.date, t.movement, t.details || "", extractoPdfImporte(t.amount), extractoPdfImporte(t.balance)].map(extractoPdfCsvCampo).join(";"));
  return [head, ...rows].join("\n");
}

function extractoPdfPlural(n, uno, varios) {
  return `${n} ${n === 1 ? uno : varios}`;
}

// Lee el texto y, si hay movimientos, abre la revisión de siempre. `motor` = FinanceCanonicalStatementLines.
async function extractoPdfLeer(texto, motor) {
  if (!motor) return;
  const resultado = motor.parse(motor.linesFromText(texto));
  const diagnostico = motor.diagnostic(resultado);
  if (!resultado.transactions.length) {
    extractoPdfAviso = { tipo: "error", texto: resultado.structure.movements ? `He reconocido ${extractoPdfPlural(resultado.structure.movements, "línea de movimiento", "líneas de movimiento")}, pero ninguna con su importe y su signo claros. Si el PDF trae saldos, copia también la línea del saldo anterior.` : "No he reconocido ninguna línea de movimiento (una fecha al principio y un importe al final).", diagnostico };
    return;
  }
  const notas = [
    `${extractoPdfPlural(resultado.transactions.length, "movimiento leído", "movimientos leídos")} del texto pegado`,
    resultado.errors.length ? `${extractoPdfPlural(resultado.errors.length, "línea no se ha podido leer y no se importará", "líneas no se han podido leer y no se importarán")} (diagnóstico abajo)` : "",
    ...resultado.warnings.map((w) => w.text),
  ].filter(Boolean);
  extractoPdfAviso = { tipo: resultado.errors.length || resultado.balanceCheck.status === "no-cuadra" ? "error" : "ok", texto: notas.join(". ").replace(/\.\./g, "."), diagnostico: resultado.errors.length ? diagnostico : null };
  const fichero = new File([extractoPdfCsv(resultado.transactions)], EXTRACTO_PDF_NOMBRE, { type: "text/csv" });
  await handleDatosImportarFile({ target: { files: [fichero] } });
}

function extractoPdfDiagnosticoTexto(diagnostico) {
  return JSON.stringify(diagnostico, null, 1);
}

// Lo último que ha pasado al leer (cuántos movimientos, qué no se leyó y por qué): encima de la revisión de lo pegado, o
// en las fuentes si no se leyó nada. Con la revisión de otro fichero, no sale.
function extractoPdfAvisoHtml(session) {
  const a = extractoPdfAviso;
  if (!a || (session && session.fileMeta?.fileName !== EXTRACTO_PDF_NOMBRE)) return "";
  const diag = a.diagnostico ? `<details class="imp-v2-pdf-diag"><summary>Diagnóstico (sin importes ni conceptos)</summary><pre>${escapeHtml(extractoPdfDiagnosticoTexto(a.diagnostico))}</pre><button type="button" class="imp-v2-link" data-imp-v2-pdf-copiar>Copiar diagnóstico</button></details>` : "";
  return `<div class="imp-v2-pdf-aviso${a.tipo === "error" ? " is-aviso" : ""}" role="status"><p>${escapeHtml(a.texto)}</p>${diag}</div>`;
}

// La fuente en Importar: plegada, para no quitar sitio al CSV o Excel.
function extractoPdfFuenteHtml() {
  return `<details class="mov-v2-card imp-v2-pdf">
    <summary><span class="mov-v2-main"><strong>Texto de un PDF</strong><span class="mov-v2-meta">Si el banco solo te da el extracto en PDF: copia su texto y pégalo aquí.</span></span></summary>
    <label class="imp-v2-pdf-campo"><span class="mov-v2-meta">En el iPhone: abre el PDF, mantén pulsado el texto, «Seleccionar todo» y «Copiar». Mejor si incluye la línea del saldo anterior.</span>
      <textarea id="importarV2PdfTexto" rows="6" autocomplete="off" spellcheck="false" placeholder="01/10/2026  NÓMINA …  3.000,00  8.080,00"></textarea></label>
    <button type="button" class="e19-btn e19-btn-primary" data-imp-v2-pdf-leer>Leer el texto</button>
  </details>`;
}

function extractoPdfOlvidar() {
  extractoPdfAviso = null;
}

globalThis.FinanceExtractoPdf = {
  NOMBRE: EXTRACTO_PDF_NOMBRE,
  csv: extractoPdfCsv,
  leer: extractoPdfLeer,
  fuenteHtml: extractoPdfFuenteHtml,
  avisoHtml: extractoPdfAvisoHtml,
  diagnosticoTexto: () => (extractoPdfAviso?.diagnostico ? extractoPdfDiagnosticoTexto(extractoPdfAviso.diagnostico) : ""),
  olvidar: extractoPdfOlvidar,
};
