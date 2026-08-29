const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const read = (name) => fs.readFileSync(path.join(root, name), "utf8");
const app = read("app.js");
const html = read("index.html");

// A17-2 · Bloque 2: exportación del calendario financiero (E15) a .ics, para Google/Apple Calendar.
// Solo lectura, un fichero descargado — no una suscripción con URL propia: el sitio es estático
// (GitHub Pages, sin backend) y una suscripción de verdad necesitaría un endpoint que recalculara
// en cada sondeo. Reutiliza FinanceCanonicalE15.financialCalendar tal cual, ya en producción.

function extractFunction(name) {
  const start = app.indexOf(`function ${name}(`);
  assert.ok(start >= 0, `No existe la función ${name} en app.js`);
  let depth = 0;
  for (let index = app.indexOf("{", start); index < app.length; index += 1) {
    if (app[index] === "{") depth += 1;
    else if (app[index] === "}") {
      depth -= 1;
      if (depth === 0) return app.slice(start, index + 1);
    }
  }
  throw new Error(`La función ${name} no cierra sus llaves`);
}

function sandboxWith(names, extra = {}) {
  const context = { ...extra };
  vm.createContext(context);
  vm.runInContext(names.map((name) => extractFunction(name)).join("\n"), context);
  return context;
}

test("icsEscapeText escapa barra invertida, punto y coma, coma y salto de línea, en ese orden", () => {
  const context = sandboxWith(["icsEscapeText"]);
  assert.equal(context.icsEscapeText("a\\b;c,d\ne"), "a\\\\b\\;c\\,d\\ne");
  assert.equal(context.icsEscapeText(null), "");
  assert.equal(context.icsEscapeText(undefined), "");
});

function calendarSandbox() {
  return sandboxWith(["icsEscapeText", "icsDateStamp", "financialCalendarIcsContent"], {
    money: (value) => `${Number(value).toFixed(2)} €`,
  });
}

function sampleCalendar() {
  return {
    rows: [
      {
        monthKey: "2026-09",
        label: "Septiembre 2026",
        closingLiquidity: 3200.5,
        events: [
          { type: "debt", label: "Cuotas de deuda", amount: 450, source: "contratos canónicos" },
          { type: "goal", label: "Fecha objetivo: Coche", amount: 1200, source: "objetivos" },
        ],
      },
      {
        monthKey: "2026-10",
        label: "Octubre 2026",
        closingLiquidity: -150,
        events: [],
      },
    ],
  };
}

test("financialCalendarIcsContent produce un VCALENDAR válido con un VEVENT por mes", () => {
  const context = calendarSandbox();
  const ics = context.financialCalendarIcsContent(sampleCalendar(), new Date("2026-08-29T12:00:00.000Z"));
  assert.match(ics, /^BEGIN:VCALENDAR\r\n/);
  assert.match(ics, /VERSION:2\.0\r\n/);
  assert.match(ics, /\r\nEND:VCALENDAR\r\n$/);
  assert.equal((ics.match(/BEGIN:VEVENT/g) || []).length, 2);
  assert.equal((ics.match(/END:VEVENT/g) || []).length, 2);
});

test("financialCalendarIcsContent usa el primer día del mes como fecha, en formato YYYYMMDD", () => {
  const context = calendarSandbox();
  const ics = context.financialCalendarIcsContent(sampleCalendar(), new Date("2026-08-29T12:00:00.000Z"));
  assert.match(ics, /DTSTART;VALUE=DATE:20260901/);
  assert.match(ics, /DTSTART;VALUE=DATE:20261001/);
});

test("financialCalendarIcsContent lista cada evento del mes y el cierre previsto en la descripción", () => {
  const context = calendarSandbox();
  const ics = context.financialCalendarIcsContent(sampleCalendar(), new Date("2026-08-29T12:00:00.000Z"));
  assert.match(ics, /DESCRIPTION:Cierre previsto: 3200\.50 €\\nCuotas de deuda: 450\.00 € \(contratos canónicos\)\\nFecha objetivo: Coche: 1200\.00 € \(objetivos\)/);
  assert.match(ics, /SUMMARY:Calendario financiero: Septiembre 2026/);
});

test("financialCalendarIcsContent con un mes sin eventos solo lleva el cierre previsto", () => {
  const context = calendarSandbox();
  const ics = context.financialCalendarIcsContent(sampleCalendar(), new Date("2026-08-29T12:00:00.000Z"));
  assert.match(ics, /DESCRIPTION:Cierre previsto: -150\.00 €\r\n/);
});

// A15-3: un evento con amount: null (la Campaña de la Renta, sin estimador todavía) no es un
// importe de cero — money(null) lo convertiría en "0,00 €", una cifra falsa.
test("financialCalendarIcsContent dice \"importe por determinar\" para un evento sin importe, no 0,00 €", () => {
  const context = calendarSandbox();
  const calendar = {
    rows: [{
      monthKey: "2026-06",
      label: "Junio 2026",
      closingLiquidity: 1000,
      events: [{ type: "renta", label: "Campaña de la Renta (pago o devolución)", amount: null, source: "campaña anual" }],
    }],
  };
  const ics = context.financialCalendarIcsContent(calendar, new Date("2026-08-29T12:00:00.000Z"));
  assert.match(ics, /Campaña de la Renta \(pago o devolución\): importe por determinar \(campaña anual\)/);
  assert.doesNotMatch(ics, /Campaña de la Renta \(pago o devolución\): [\d.,]+ €/, "un importe desconocido no debe convertirse en una cifra formateada");
});

test("financialCalendarIcsContent sin filas produce un calendario vacío pero válido", () => {
  const context = calendarSandbox();
  const ics = context.financialCalendarIcsContent({ rows: [] }, new Date("2026-08-29T12:00:00.000Z"));
  assert.doesNotMatch(ics, /BEGIN:VEVENT/);
  assert.match(ics, /^BEGIN:VCALENDAR[\s\S]*END:VCALENDAR\r\n$/);
});

test("handleAjustesExportIcs avisa si el calendario financiero (E15) no está disponible", () => {
  const announcements = [];
  const context = sandboxWith(["handleAjustesExportIcs"], {
    window: {},
    announceStatus: (text) => announcements.push(text),
  });
  context.handleAjustesExportIcs();
  assert.match(announcements[0], /calendario financiero \(E15\) no está disponible/);
});

test("handleAjustesExportIcs avisa si el calendario no tiene meses todavía", () => {
  const announcements = [];
  const context = sandboxWith(["handleAjustesExportIcs"], {
    window: { FinanceCanonicalE15: { financialCalendar: () => ({ rows: [] }) }, FinanceP2Bridge: { goalPlanning: () => ({}) } },
    p2State: () => ({ goals: [], e15: {} }),
    insurancePolicies: () => [],
    announceStatus: (text) => announcements.push(text),
  });
  context.handleAjustesExportIcs();
  assert.match(announcements[0], /No hay meses en el calendario financiero todavía/);
});

test("el botón vive en Ajustes, junto a CSV y PDF, con ayuda contextual", () => {
  assert.match(html, /id="ajustesExportIcs"/);
  assert.match(app, /qs\("ajustesExportIcs"\)\?\.addEventListener\("click", handleAjustesExportIcs\)/);
  assert.match(app, /qs\("ajustesExportIcs"\)\?\.setAttribute\("data-help"/);
});
