// El repaso semanal en el calendario del móvil (13/11/2026). El hogar dice que el repaso «aporta», pero en noviembre no se hizo ninguno
// (medidor del 13/11): un aviso cada domingo, el último día de la semana del repaso (de lunes a domingo). Sin importes en el título.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const R = require("../canonical-reminders.js");

const soloRepaso = { kinds: Object.fromEntries(R.KINDS.map((kind) => [kind, kind === "weeklyReview"])) };

test("un aviso cada domingo del horizonte, desde el primero que llega", () => {
  // Viernes 13/11/2026: el primero, el domingo 15; con 6 meses de horizonte (hasta el 13/5/2027), el último, el domingo 9/5/2027.
  const r = R.build({ today: "2026-11-13", options: soloRepaso });
  const fechas = r.events.map((event) => event.date);
  assert.equal(fechas[0], "2026-11-15");
  assert.equal(fechas.at(-1), "2027-05-09");
  assert.equal(fechas.length, 26);
  assert.ok(fechas.every((fecha) => new Date(`${fecha}T12:00:00Z`).getUTCDay() === 0), "todos en domingo");
  assert.equal(r.counts.weeklyReview, 26);
  assert.deepEqual([...new Set(r.events.map((event) => event.kind))], ["weeklyReview"]);
  // Si hoy es domingo, el de hoy cuenta.
  assert.equal(R.build({ today: "2026-11-15", options: soloRepaso }).events[0].date, "2026-11-15");
});

test("título sin importes, identificador estable por fecha y en el .ics", () => {
  const [primero] = R.build({ today: "2026-11-13", options: soloRepaso }).events;
  assert.equal(primero.title, "Repaso semanal de las cuentas · unos 5 min");
  assert.doesNotMatch(primero.title, /\d+[.,]?\d*\s?€/);
  assert.equal(primero.uid, "rec-repaso-2026-11-15");
  assert.match(primero.description, /Repaso de esta semana/);
  const ics = R.toIcs([primero], { now: "2026-11-13T10:00:00Z" });
  assert.match(ics, /UID:rec-repaso-2026-11-15@contabilidadcasa/);
  assert.match(ics, /DTSTART;VALUE=DATE:20261115/);
});

test("encendido por defecto, se apaga con su casilla y cabe con los demás tipos", () => {
  assert.equal(R.DEFAULTS.kinds.weeklyReview, true);
  assert.equal(R.REVIEW_WEEKDAY, 0);
  assert.equal(R.build({ today: "2026-11-13", options: { kinds: { weeklyReview: false } } }).counts.weeklyReview, 0);
  // 26 domingos dejan sitio de sobra bajo el tope de 150 eventos para los demás avisos de 6 meses.
  assert.ok(26 < R.MAX_EVENTS / 2);
  const html = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");
  assert.match(html, /<input type="checkbox" data-recordatorios-kind="weeklyReview" checked \/> Cada domingo: el repaso semanal \(unos 5 min\)<\/label>/);
  assert.match(html, /canonical-reminders\.js\?v=20261113repaso/);
  assert.match(fs.readFileSync(path.join(__dirname, "..", "recordatorios-ui.js"), "utf8"), /weeklyReview: "repasos semanales"/);
});
