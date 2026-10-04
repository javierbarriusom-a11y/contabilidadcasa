const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

// WP-25 (CAP-02 + plantilla de CAP-01): contrato de los enlaces de registro prellenado
// `#registrar?importe=&concepto=&fecha=&cuenta=&origen=`. Abren la ventana «Registrar gasto» (FLU-2) con los
// campos rellenos y NUNCA guardan solos. Lo no válido no se tira en silencio: vuelve como error citando lo
// recibido. 30 casos de contrato (válidos, malformados, inyección, fecha «hoy», importes con miles) y el
// enganche en app.js.

const root = path.resolve(__dirname, "..");
const read = (name) => fs.readFileSync(path.join(root, name), "utf8");
const link = require("../canonical-capture-link.js");
const { parseAmountInput } = require("../ux-shell.js");

const TODAY = "2026-10-04";
const parse = (hash) => link.parseCaptureLink(hash, { today: TODAY, parseAmount: parseAmountInput });

// [descripción, hash, campos esperados (parcial), errores esperados (claves)]
const CASES = [
  // Válidos
  ["mínimo: importe y concepto", "#registrar?importe=23,40&concepto=Mercadona", { amount: 23.4, label: "Mercadona", date: TODAY, dateDefaulted: true, origin: "enlace" }, []],
  ["completo", "#registrar?importe=12,5&concepto=Farmacia&fecha=2026-10-03&cuenta=Caixa&origen=applepay", { amount: 12.5, label: "Farmacia", date: "2026-10-03", account: "Caixa", origin: "applepay", originLabel: "Apple Pay" }, []],
  ["miles con punto", "#registrar?importe=1.234,56&concepto=Seguro", { amount: 1234.56 }, []],
  ["«1.234» son mil doscientos treinta y cuatro", "#registrar?importe=1.234&concepto=Taller", { amount: 1234 }, []],
  ["con «€» y espacio codificado", "#registrar?importe=23%2C40%20%E2%82%AC&concepto=Bar", { amount: 23.4 }, []],
  ["punto decimal (Atajo en inglés)", "#registrar?importe=23.40&concepto=Bar", { amount: 23.4 }, []],
  ["alias del Atajo: comercio y tarjeta", "#registrar?importe=9,99&comercio=Apple%20Store&tarjeta=Mediolanum", { label: "Apple Store", account: "Mediolanum" }, []],
  ["«+» es un espacio en el concepto", "#registrar?importe=5&concepto=El+Corte+Ingl%C3%A9s", { label: "El Corte Inglés" }, []],
  ["fecha «hoy»", "#registrar?importe=5&concepto=Pan&fecha=hoy", { date: TODAY, dateDefaulted: false }, []],
  ["fecha «ayer» cruza de mes", "#registrar?importe=5&concepto=Pan&fecha=ayer", { date: "2026-10-03" }, []],
  ["fecha española dd/mm/aaaa", "#registrar?importe=5&concepto=Pan&fecha=30/09/2026", { date: "2026-09-30" }, []],
  ["fecha d/m/aa", "#registrar?importe=5&concepto=Pan&fecha=1/10/26", { date: "2026-10-01" }, []],
  ["fecha ISO con hora (el Atajo la da así)", "#registrar?importe=5&concepto=Pan&fecha=2026-10-04T09:15:00%2B02:00", { date: TODAY }, []],
  ["solo el importe: concepto vacío para escribirlo", "#registrar?importe=7", { amount: 7, label: "" }, []],
  ["origen desconocido queda como «enlace»", "#registrar?importe=5&concepto=Pan&origen=raro", { origin: "enlace", originLabel: "enlace" }, []],
  ["concepto con saltos de línea y espacios de más", "#registrar?importe=5&concepto=%20Gasolinera%0A%20Repsol%20%20", { label: "Gasolinera Repsol" }, []],
  // Malformados
  ["importe con dos comas", "#registrar?importe=12,3,4&concepto=Bar", { amount: null }, ["importe"]],
  ["importe que no es un número", "#registrar?importe=abc&concepto=Bar", { amount: null }, ["importe"]],
  ["importe cero", "#registrar?importe=0&concepto=Bar", { amount: null }, ["importe"]],
  ["importe negativo (reembolso)", "#registrar?importe=-12,50&concepto=Bar", { amount: null }, ["importe"]],
  ["importe fuera de rango", "#registrar?importe=250.000&concepto=Casa", { amount: null }, ["importe"]],
  ["fecha imposible (31/02)", "#registrar?importe=5&concepto=Pan&fecha=2026-02-31", { date: "" }, ["fecha"]],
  ["fecha futura", "#registrar?importe=5&concepto=Pan&fecha=2026-10-05", { date: "" }, ["fecha"]],
  ["fecha de hace más de un año", "#registrar?importe=5&concepto=Pan&fecha=2025-09-01", { date: "" }, ["fecha"]],
  ["fecha en texto libre", "#registrar?importe=5&concepto=Pan&fecha=el%20martes", { date: "" }, ["fecha"]],
  ["porcentaje mal codificado no rompe la lectura", "#registrar?importe=5&concepto=Caf%E9", { amount: 5 }, []],
  // Inyección
  ["HTML en el concepto", "#registrar?importe=5&concepto=%3Cimg%20src%3Dx%20onerror%3Dalert(1)%3E", { label: "" }, ["concepto"]],
  ["script en la cuenta", "#registrar?importe=5&concepto=Bar&cuenta=%3Cscript%3E", { account: "" }, ["cuenta"]],
  ["HTML en el importe", "#registrar?importe=%3Cb%3E5%3C/b%3E&concepto=Bar", { amount: null }, ["importe"]],
  ["enlace descomunal", `#registrar?importe=5&concepto=${"x".repeat(2100)}`, { amount: null, label: "" }, ["enlace"]],
];

test("CAP-02 · el contrato tiene 30 casos", () => {
  assert.equal(CASES.length, 30);
});

CASES.forEach(([name, hash, expected, errorKeys]) => {
  test(`CAP-02 · ${name}`, () => {
    const result = parse(hash);
    assert.ok(result, "es un enlace de registro");
    Object.entries(expected).forEach(([key, value]) => assert.deepEqual(result.fields[key], value, `${key} en ${hash.slice(0, 80)}`));
    assert.deepEqual(Object.keys(result.errors).sort(), [...errorKeys].sort());
    assert.equal(result.ok, errorKeys.length === 0);
  });
});

test("CAP-02 · los errores citan lo recibido (la ventana lo dice, nunca falla en silencio)", () => {
  assert.equal(parse("#registrar?importe=12,3,4").errors.importe, "importe no reconocido: «12,3,4»");
  assert.match(parse("#registrar?importe=5&fecha=2026-02-31").errors.fecha, /«2026-02-31»/);
  assert.match(parse(`#registrar?importe=${"9".repeat(60)}`).errors.importe, /«9{40}…»/, "una cita larga se recorta");
});

test("CAP-02 · lo que no es un enlace de registro no se toca", () => {
  ["", "#", "#home", "#registrar", "#movimientos?importe=5", "#household-invite=abc", "registrar"].forEach((hash) => assert.equal(parse(hash), null, hash));
  assert.equal(link.isCaptureLink("#registrar?importe=5"), true);
  assert.equal(link.isCaptureLink("#registrar"), false);
});

test("CAP-02 · concepto largo: se recorta a 80 y se avisa; parámetros desconocidos, apuntados", () => {
  const result = parse(`#registrar?importe=5&concepto=${"a".repeat(90)}&extra=1&otro=2`);
  assert.equal(result.fields.label.length, 80);
  assert.deepEqual(result.warnings, ["concepto recortado a 80 caracteres"]);
  assert.deepEqual(result.ignored, ["extra", "otro"]);
  assert.equal(result.ok, true);
});

test("CAP-02 · buildCaptureLink y parseCaptureLink son inversos (lo que construye la guía se lee igual)", () => {
  const url = link.buildCaptureLink("https://ejemplo.test/app/#home", { importe: "1.234,56", concepto: "Café & Tostada", fecha: "hoy", cuenta: "", origen: "applepay" });
  assert.equal(url, "https://ejemplo.test/app/#registrar?importe=1.234%2C56&concepto=Caf%C3%A9%20%26%20Tostada&fecha=hoy&origen=applepay");
  const result = parse(url.slice(url.indexOf("#")));
  assert.deepEqual([result.fields.amount, result.fields.label, result.fields.date, result.fields.origin], [1234.56, "Café & Tostada", TODAY, "applepay"]);
});

test("CAP-02 · la nota de la ventana: origen, aviso de que no guarda, mes distinto y lo no usado", () => {
  const ok = link.noteText(parse("#registrar?importe=5&concepto=Pan&cuenta=Caixa&origen=applepay"), { monthLabel: "Oct 2026", sameMonth: true });
  assert.equal(ok, "Rellenado desde un enlace (Apple Pay · cuenta Caixa · hoy, 04/10/2026). Revisa los datos: no se guarda nada hasta que pulses «Registrar». Crea una partida nueva: si el gasto ya está previsto en otra (súper, gasolina), anótalo en Registrar › Reales del mes o contará dos veces.");
  assert.match(link.noteText(parse("#registrar?importe=5")), /^Rellenado desde un enlace \(hoy, 04\/10\/2026\)\./, "sin origen, no se repite «enlace»");
  const other = link.noteText(parse("#registrar?importe=12,3,4&fecha=30/09/2026"), { monthLabel: "Oct 2026", sameMonth: false });
  assert.match(other, /no cae en un mes abierto del plan: se registrará en Oct 2026\./);
  assert.match(other, /Del enlace no se ha usado: importe no reconocido: «12,3,4»\./);
});

test("CAP-02 · el módulo es puro: sin DOM ni estado de la app, y nunca guarda", () => {
  const source = read("canonical-capture-link.js");
  assert.doesNotMatch(source, /\bwindow\b|\bdocument\b|\bbaseData\b|\blocalStorage\b|\bstate\.|innerHTML|storageSet|save[A-Z]\w*\(/);
});

test("WP-25 · enganche en app.js: el enrutado ignora «?…», el enlace abre la ventana FLU-2 y no guarda", () => {
  const app = read("app.js");
  assert.match(app, /function viewFromHash\(\) \{\n\s+let id = \(window\.location\.hash \|\| "#home"\)\.replace\("#", ""\)\.split\("\?"\)\[0\];/);
  assert.match(app, /function registrarTabFromHash\(\) \{\n\s+let id = \(window\.location\.hash \|\| "#home"\)\.replace\("#", ""\)\.split\("\?"\)\[0\];/);
  const start = app.indexOf("function openCaptureLinkFromHash()");
  const body = app.slice(start, app.indexOf("\n}\n", start));
  assert.ok(start > 0);
  assert.match(body, /history\.replaceState\(null, "", "#registrar"\)/, "el enlace se borra de la barra de direcciones");
  assert.match(body, /openHomeQuickExpenseDialog\(\{ month,/, "abre la ventana existente");
  assert.doesNotMatch(body, /submitHomeQuickExpense|save[A-Z]\w*\(|customPlanningRows|expenseActuals/, "nunca guarda solo");
  assert.match(app, /setActiveView\(viewFromHash\(\), \{ focus: true \}\);\n\s+openCaptureLinkFromHash\(\);/, "al cambiar el #");
  assert.match(app, /render\(\);\n\s+await setupSupabaseSync\(\);\n.*\n\s+if \(document\.readyState === "complete"\) openCaptureLinkFromHash\(\); else window\.addEventListener\("load", \(\) => openCaptureLinkFromHash\(\), \{ once: true \}\);/, "al abrir la app desde el enlace, después de cargar la nube y la página");
  assert.match(app, /const parsedAmount = parseAmountField\(rawAmount\);/, "el importe se lee como en Registrar (WP-11)");
  assert.match(app, /qs\("homeQuickExpenseForm"\)\?\.addEventListener\("submit"/, "un importe ilegible no cierra la ventana");
});

test("WP-25 · ventana: importe de texto con teclado decimal y nota del enlace; módulo cargado antes de app.js, offline y publicado", () => {
  const html = read("index.html");
  assert.match(html, /<input id="homeQuickExpenseAmount" type="text" inputmode="decimal" autocomplete="off" data-amount-input required placeholder="0,00" \/>/);
  assert.match(html, /<p class="e19-kpi-note capture-link-note" id="homeQuickExpenseLinkNote" role="status" hidden><\/p>/);
  const at = html.indexOf('<script defer src="canonical-capture-link.js?v=');
  assert.ok(at > 0 && at < html.indexOf('<script defer src="app.js?v='));
  assert.match(read("service-worker.js"), /"\.\/canonical-capture-link\.js",/);
  assert.match(read("tools/build-public-site.mjs"), /"canonical-capture-link\.js",/);
});
