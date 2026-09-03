const test = require("node:test");
const assert = require("node:assert/strict");
const api = require("../canonical-receipt-ocr.js");

// A17-3 (BACKLOG_ULTIMATE_SEPTIEMBRE.md bloque 6 — "captura por cámara, OCR de tickets/facturas"):
// motor puro de extracción sobre el texto que ya devolvió el OCR (Tesseract.js, cargado bajo demanda
// en app.js, fuera de esta suite porque no hay navegador en Node). Solo importe/fecha/comercio: la
// categoría se deja al mismo motor de reglas por concepto que reclasifica cualquier movimiento
// importado, nunca un segundo clasificador inventado aquí.

test("extrae importe, fecha y comercio de un ticket típico con decimales en punto", () => {
  const text = [
    "MERCADONA S.A.",
    "C/ MAYOR 12",
    "28001 MADRID",
    "03/09/2026 18:42",
    "2 LECHE       1.50",
    "1 PAN         0.95",
    "SUBTOTAL      2.45",
    "TOTAL         2.45 €",
    "GRACIAS POR SU VISITA",
  ].join("\n");
  const fields = api.extractReceiptFields(text);
  assert.deepEqual(fields.amount, { value: 2.45, calculable: true, raw: "2.45" });
  assert.deepEqual(fields.date, { value: "2026-09-03", calculable: true });
  assert.equal(fields.merchant.value, "MERCADONA S.A.");
  assert.equal(fields.merchant.calculable, true);
});

test("reconoce el separador de miles europeo y no lo confunde con el decimal", () => {
  const fields = api.extractReceiptFields("FACTURA\nTOTAL: 1.234,56 €");
  assert.equal(fields.amount.value, 1234.56);
  assert.equal(fields.amount.calculable, true);
});

test("sin ningún importe reconocible, calculable es false y el valor nunca se inventa", () => {
  const fields = api.extractReceiptFields("TICKET SIN IMPORTES LEGIBLES\nGRACIAS");
  assert.deepEqual(fields.amount, { value: null, calculable: false, raw: "" });
});

test("TOTAL A PAGAR tiene prioridad sobre IMPORTE TOTAL cuando ambos aparecen", () => {
  const text = "IMPORTE TOTAL: 5,00 €\nTOTAL A PAGAR: 12,00 €";
  const fields = api.extractReceiptFields(text);
  assert.equal(fields.amount.value, 12);
});

test("SUBTOTAL no se confunde con TOTAL por el límite de palabra", () => {
  const text = "SUBTOTAL 999,00\nTOTAL 12,00";
  const fields = api.extractReceiptFields(text);
  assert.equal(fields.amount.value, 12);
});

test("sin ninguna línea con palabra clave, usa el importe más alto de todo el texto", () => {
  const text = "TIENDA XYZ\n2 CAFES  3,50\n1 CROISSANT  2,20";
  const fields = api.extractReceiptFields(text);
  assert.equal(fields.amount.value, 3.5);
});

test("una fecha con día/mes inválido (31 de febrero) se descarta y se prueba la siguiente", () => {
  const text = "TICKET\n31/02/2026\nCOMPRA\n05/09/2026";
  const fields = api.extractReceiptFields(text);
  assert.deepEqual(fields.date, { value: "2026-09-05", calculable: true });
});

test("un año de dos cifras se normaliza a 20xx", () => {
  const fields = api.extractReceiptFields("TICKET\n03/09/26\nTOTAL 4,00");
  assert.equal(fields.date.value, "2026-09-03");
});

test("una fecha posterior a hoy se descarta cuando se declara `today`", () => {
  const text = "TICKET\n15/09/2026\n03/09/2026";
  const fields = api.extractReceiptFields(text, { today: "2026-09-03" });
  assert.equal(fields.date.value, "2026-09-03");
});

test("sin ninguna fecha válida, calculable es false", () => {
  const fields = api.extractReceiptFields("TICKET SIN FECHA\nTOTAL 4,00");
  assert.deepEqual(fields.date, { value: null, calculable: false });
});

test("sin ninguna línea que parezca un comercio en las primeras líneas, calculable es false", () => {
  const text = "1234567890\n03/09/2026\n4,00 €";
  const fields = api.extractReceiptFields(text);
  assert.deepEqual(fields.merchant, { value: null, calculable: false });
});

test("parseMoneyToken normaliza coma y punto decimal, y rechaza texto sin decimales", () => {
  assert.equal(api.parseMoneyToken("23,45"), 23.45);
  assert.equal(api.parseMoneyToken("23.45"), 23.45);
  assert.equal(api.parseMoneyToken("1.234,56"), 1234.56);
  assert.equal(api.parseMoneyToken("12"), null);
  assert.equal(api.parseMoneyToken("abc"), null);
});

test("un texto vacío no revienta y todos los campos quedan sin calcular", () => {
  const fields = api.extractReceiptFields("");
  assert.equal(fields.amount.calculable, false);
  assert.equal(fields.date.calculable, false);
  assert.equal(fields.merchant.calculable, false);
});
