const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const R = require("../canonical-reminders.js");

// WP-32 (CAP-09 + ND-10, docs/WP32_DISENO.md): recordatorios calculados, no a horas fijas. Motor puro: qué eventos salen, cuáles NO (un aviso
// en un día de relleno es ruido), y que el .ics sea válido de verdad (RFC 5545: CRLF, plegado a 75 octetos, escapes, identificadores estables).

const income = (date, label, amount, confidence = "rule") => ({ date, label, amount, confidence });
const charge = (date, label, amount, confidence = "rule") => ({ date, label, amount, confidence });
const base = { today: "2026-10-07" };
const onlyKind = (kind) => ({ kinds: { income: false, bigCharge: false, monthClose: false, fiscal: false, rateReview: false, [kind]: true } });

test("sin la fecha de hoy no hay recordatorios: dice qué falta", () => {
  const r = R.build({});
  assert.equal(r.status, "missing");
  assert.deepEqual(r.missing, ["la fecha de hoy"]);
  assert.deepEqual(r.events, []);
});

test("cobro: aviso dos días antes, solo con fecha segura, y agrupa los cobros del mismo día", () => {
  const r = R.build({ ...base, options: onlyKind("income"), incomes: [income("2026-10-31", "Nómina Javi", 3000), income("2026-10-31", "Local", 800), income("2026-10-25", "Nómina Tere", 2000, "observed"), income("2026-11-08", "Relleno", 500, "estimated")] });
  assert.deepEqual(r.events.map((event) => [event.date, event.uid]), [["2026-10-23", "rec-cobro-2026-10-25"], ["2026-10-29", "rec-cobro-2026-10-31"]]);
  assert.equal(r.skipped.uncertainIncomes, 1, "el cobro con fecha estimada no genera aviso, pero se cuenta");
  const grouped = r.events[1];
  assert.match(grouped.description, /Nómina Javi, Local/);
  assert.match(grouped.description, /3\.800,00 €/);
  assert.equal(grouped.title, "Cobro en 2 días: actualizad saldos");
});

test("el título (lo que sale en la pantalla de bloqueo) no lleva importes ni nombres; el detalle sí", () => {
  const r = R.build({ ...base, incomes: [income("2026-10-31", "Nómina Javi", 3000)], outflows: [charge("2026-10-20", "Seguro de salud", 1200)] });
  r.events.forEach((event) => {
    assert.doesNotMatch(event.title, /\d[\d.,]*\s*€|Javi|Seguro|nómina/i, `el título «${event.title}» enseña un dato privado`);
  });
  assert.match(r.events.find((event) => event.kind === "income").description, /3\.000,00 €/);
  assert.match(r.events.find((event) => event.kind === "bigCharge").description, /Seguro de salud/);
});

test("si el aviso caería antes de hoy, se da hoy (mejor tarde que nunca) con los días que faltan reales", () => {
  const r = R.build({ ...base, options: onlyKind("income"), incomes: [income("2026-10-08", "Nómina", 100), income("2026-10-07", "Hoy", 50)] });
  assert.deepEqual(r.events.map((event) => [event.date, event.title]), [["2026-10-07", "Cobro hoy: actualizad saldos"], ["2026-10-07", "Cobro en 1 día: actualizad saldos"]]);
});

test("cobros pasados o fuera del horizonte no generan nada", () => {
  const r = R.build({ ...base, options: { ...onlyKind("income"), horizonMonths: 1 }, incomes: [income("2026-10-01", "Pasado", 1), income("2027-06-30", "Lejano", 1)] });
  assert.deepEqual(r.events, []);
});

test("cargo grande: el día siguiente, solo por encima del umbral y con fecha segura", () => {
  const r = R.build({ ...base, options: onlyKind("bigCharge"), outflows: [charge("2026-10-20", "Seguro", 1200), charge("2026-10-21", "Luz", 80), charge("2026-10-22", "Estimado grande", 2000, "estimated"), charge("2026-10-05", "Pasado", 900)] });
  assert.deepEqual(r.events.map((event) => event.date), ["2026-10-21"]);
  assert.equal(r.skipped.uncertainCharges, 1);
  const lower = R.build({ ...base, options: { ...onlyKind("bigCharge"), bigChargeMin: 50 }, outflows: [charge("2026-10-21", "Luz", 80)] });
  assert.equal(lower.events.length, 1, "el umbral se puede bajar");
  assert.equal(R.build({ ...base, options: { ...onlyKind("bigCharge"), bigChargeMin: "no" }, outflows: [charge("2026-10-21", "Luz", 600)] }).events.length, 1, "un umbral inválido vuelve al de 500 €");
});

test("lo «sin aviso» solo cuenta lo que cae dentro del periodo del fichero, no todo el horizonte del modelo", () => {
  const far = Array.from({ length: 50 }, (_, index) => charge(`2030-0${1 + (index % 9)}-15`, `Lejano ${index}`, 900, "estimated"));
  const r = R.build({ ...base, options: onlyKind("bigCharge"), outflows: [...far, charge("2026-10-20", "Cercano estimado", 900, "estimated"), charge("2026-10-06", "Ayer estimado", 900, "estimated")] });
  assert.equal(r.skipped.uncertainCharges, 2, "el de ayer (su día siguiente es hoy) y el cercano cuentan; los de 2030, no");
  assert.deepEqual(r.events, []);
});

test("cierre de mes: el día 1 de cada mes por delante, sin el de este mes si ya pasó", () => {
  const r = R.build({ ...base, options: { ...onlyKind("monthClose"), horizonMonths: 3 } });
  assert.deepEqual(r.events.map((event) => event.date), ["2026-11-01", "2026-12-01", "2027-01-01"]);
  assert.match(r.events[0].description, /Del 1 al 3 se cierra octubre/);
  assert.match(r.events[2].description, /se cierra diciembre/);
  assert.equal(R.build({ today: "2026-11-01", options: { ...onlyKind("monthClose"), horizonMonths: 1 } }).events[0].date, "2026-11-01", "si hoy es día 1, hoy cuenta");
});

test("campaña fiscal: 1/12 y 20/12, y el año siguiente si cae en el horizonte", () => {
  const r = R.build({ ...base, options: { ...onlyKind("fiscal"), horizonMonths: 12 } });
  assert.deepEqual(r.events.map((event) => event.date), ["2026-12-01", "2026-12-20"]);
  const later = R.build({ today: "2026-12-10", options: { ...onlyKind("fiscal"), horizonMonths: 12 } });
  assert.deepEqual(later.events.map((event) => event.date), ["2026-12-20", "2027-12-01", "2027-12-20"].filter((d) => d <= later.horizonEnd));
  assert.match(r.events[0].description, /confirmadlas con un asesor/, "son estimaciones y se dice");
});

test("cada tipo se puede apagar, y apagarlos todos no deja nada", () => {
  const input = { ...base, incomes: [income("2026-10-31", "N", 1)], outflows: [charge("2026-10-20", "S", 900)], reviews: [{ date: "2027-03-15", low: 627.16, high: 747.12 }] };
  const all = R.build(input);
  R.KINDS.forEach((kind) => {
    const without = R.build({ ...input, options: { kinds: { [kind]: false } } });
    assert.equal(without.counts[kind], 0);
    assert.ok(all.counts[kind] > 0, `el tipo ${kind} debe dar eventos en este escenario`);
  });
  assert.equal(R.build({ ...input, options: { kinds: { income: false, bigCharge: false, monthClose: false, fiscal: false, rateReview: false } } }).events.length, 0);
});

test("orden por fecha, sin duplicados, con identificadores estables entre generaciones", () => {
  const input = { ...base, incomes: [income("2026-10-31", "N", 1), income("2026-10-31", "N", 1)], outflows: [charge("2026-10-20", "Seguro", 900)] };
  const first = R.build(input);
  const second = R.build(input);
  assert.deepEqual(first.events.map((event) => event.uid), second.events.map((event) => event.uid));
  assert.deepEqual(first.events.map((event) => event.date), [...first.events.map((event) => event.date)].sort());
  assert.equal(new Set(first.events.map((event) => event.uid)).size, first.events.length);
  // El mismo evento, generado otro día, conserva el uid: reimportar actualiza, no duplica.
  const tomorrow = R.build({ ...input, today: "2026-10-08" });
  assert.equal(tomorrow.events.find((event) => event.kind === "income").uid, first.events.find((event) => event.kind === "income").uid);
});

test("nunca más de 150 eventos", () => {
  const incomes = Array.from({ length: 400 }, (_, index) => income(`2026-${String(10 + Math.floor(index / 28) % 3).padStart(2, "0")}-${String(1 + (index % 28)).padStart(2, "0")}`, `I${index}`, 1));
  assert.ok(R.build({ ...base, incomes }).events.length <= R.MAX_EVENTS);
});

// ---- .ics ----
test("el .ics es válido: CRLF, cabecera, evento de día completo con fin, alarma a las 9 y marca de tiempo fija", () => {
  const events = R.build({ ...base, options: onlyKind("monthClose") }).events.slice(0, 1);
  const ics = R.toIcs(events, { now: "2026-10-07T08:00:00Z" });
  assert.ok(ics.startsWith("BEGIN:VCALENDAR\r\nVERSION:2.0\r\n"));
  assert.ok(ics.endsWith("END:VCALENDAR\r\n"));
  assert.doesNotMatch(ics.replace(/\r\n/g, ""), /[\r\n]/);
  assert.match(ics, /UID:rec-cierre-2026-11-01@contabilidadcasa\r\n/);
  assert.match(ics, /DTSTAMP:20261007T080000Z\r\n/);
  assert.match(ics, /DTSTART;VALUE=DATE:20261101\r\nDTEND;VALUE=DATE:20261102\r\n/);
  assert.match(ics, /TRANSP:TRANSPARENT/, "no bloquea el calendario");
  assert.match(ics, /BEGIN:VALARM\r\nACTION:DISPLAY\r\nDESCRIPTION:[^\r]+\r\nTRIGGER;RELATED=START:PT9H\r\nEND:VALARM/);
  assert.match(R.toIcs(events, { alarmHour: 18 }), /PT18H/);
  assert.match(R.toIcs(events, { alarmHour: 99 }), /PT9H/, "una hora inválida vuelve a las 9");
  assert.equal(R.toIcs(events, { now: "2026-10-07T08:00:00Z" }), ics, "determinista");
});

test("el .ics escapa comas, punto y coma, barras y saltos de línea, y ninguna línea pasa de 75 octetos", () => {
  const ics = R.toIcs([{ uid: "t", date: "2026-11-01", title: "A, B; C \\ D", description: `Línea 1\nLínea 2 con acentos y eñes, ${"muy larga ".repeat(30)}` }], { now: 0 });
  assert.match(ics, /SUMMARY:A\\, B\\; C \\\\ D\r\n/);
  assert.doesNotMatch(ics, /\nLínea 2/, "el salto de línea va escapado");
  ics.split("\r\n").forEach((line) => assert.ok(Buffer.byteLength(line, "utf8") <= 75, `línea de ${Buffer.byteLength(line, "utf8")} octetos: ${line.slice(0, 40)}`));
  // Al desplegar (quitar CRLF + espacio) queda el texto original.
  const unfolded = ics.replace(/\r\n /g, "");
  assert.match(unfolded, /DESCRIPTION:Línea 1\\nLínea 2 con acentos y eñes\\, muy larga muy larga/);
});

test("plegar no parte un carácter de varios octetos", () => {
  const line = `DESCRIPTION:${"€".repeat(60)}`;
  const folded = R.fold(line);
  folded.split("\r\n").forEach((part) => assert.ok(Buffer.byteLength(part, "utf8") <= 75));
  assert.equal(folded.replace(/\r\n /g, ""), line);
});

test("un evento sin fecha válida no entra en el fichero", () => {
  const ics = R.toIcs([{ uid: "a", date: "mañana", title: "x" }, { uid: "b", date: "2026-11-01", title: "y" }], { now: 0 });
  assert.equal((ics.match(/BEGIN:VEVENT/g) || []).length, 1);
});

// ---- cuándo regenerar ----
test("frescura del fichero: nunca generado, viejo, corto o al día", () => {
  assert.equal(R.staleness({ today: "2026-10-07" }).reason, "never");
  assert.equal(R.staleness({ lastGeneratedAt: "2026-08-01", today: "2026-10-07", coveredUntil: "2027-03-01" }).reason, "old");
  assert.equal(R.staleness({ lastGeneratedAt: "2026-10-01", today: "2026-10-07", coveredUntil: "2026-10-20" }).reason, "short");
  const fresh = R.staleness({ lastGeneratedAt: "2026-10-07", today: "2026-10-07", coveredUntil: "2027-04-07" });
  assert.equal(fresh.stale, false);
  assert.equal(fresh.label, "Generado hoy.");
  assert.equal(R.staleness({ lastGeneratedAt: "2026-10-06", today: "2026-10-07", coveredUntil: "2027-04-07" }).label, "Generado hace 1 día.");
});

// ---- cableado de la tarjeta (recordatorios-ui.js) ----
const read = (name) => fs.readFileSync(path.join(__dirname, "..", name), "utf8");

test("cableado: tarjeta en Ajustes, hoja y scripts antes que app.js, service worker, build público y las dos llamadas de app.js", () => {
  const html = read("index.html");
  assert.match(html, /<article class="e19-card" id="recordatoriosCard" aria-labelledby="recordatoriosTitulo">/);
  ["recordatoriosResumen", "recordatoriosDescargar", "recordatoriosNota", "recordatoriosMin"].forEach((id) => assert.match(html, new RegExp(`id="${id}"`)));
  ["income", "bigCharge", "monthClose", "fiscal"].forEach((kind) => assert.match(html, new RegExp(`data-recordatorios-kind="${kind}"`)));
  assert.match(html, /<link rel="stylesheet" href="recordatorios\.css\?v=[^"]+"/);
  ["canonical-reminders.js", "recordatorios-ui.js"].forEach((file) => {
    assert.match(html, new RegExp(`<script defer src="${file.replace(".", "\\.")}\\?v=[^"]+"></script>`));
    assert.ok(html.indexOf(`src="${file}`) < html.indexOf('src="app.js'), `${file} debe cargarse antes que app.js`);
  });
  assert.match(read("service-worker.js"), /"\.\/recordatorios\.css"[\s\S]*"\.\/canonical-reminders\.js"[\s\S]*"\.\/recordatorios-ui\.js"/);
  assert.match(read("tools/build-public-site.mjs"), /"recordatorios\.css"[\s\S]*"canonical-reminders\.js"[\s\S]*"recordatorios-ui\.js"/);
  const app = read("app.js");
  assert.equal((app.match(/renderRecordatorios\?\.\(globalThis\.FinanceCanonicalReminders\)/g) || []).length, 1);
  assert.equal((app.match(/attachRecordatorios\?\.\(document\)/g) || []).length, 1);
});

test("la pantalla no toca el DOM al cargarse, no usa el azar ni la red, y dice que el fichero no se actualiza solo", () => {
  const source = read("recordatorios-ui.js");
  assert.doesNotMatch(source.split("function recordatoriosSettings")[0], /document\.|addEventListener|qs\(/);
  assert.doesNotMatch(source + read("canonical-reminders.js"), /Math\.random|fetch\(|XMLHttpRequest|navigator\.sendBeacon/);
  assert.match(read("index.html"), /no es un calendario que se actualice solo/);
  assert.match(read("index.html"), /los títulos no llevan importes ni nombres/i);
});

test("diseño: la hoja solo usa tokens --e19-* y las casillas tienen zona táctil de 44 px", () => {
  const css = read("recordatorios.css");
  assert.doesNotMatch(css.replace(/\/\*[\s\S]*?\*\//g, ""), /#[0-9a-fA-F]{3,8}\b/);
  [...css.matchAll(/var\((--[a-z0-9-]+)/g)].forEach((match) => assert.match(match[1], /^--e19-/, `${match[1]} no es un token --e19-*`));
  assert.match(css, /min-height:\s*44px/);
});
