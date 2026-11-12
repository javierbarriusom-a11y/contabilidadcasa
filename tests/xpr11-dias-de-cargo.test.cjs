// XPR-11 · mover los días de cargo a donde menos duelen (canonical-charge-day-moves.js). Trayectoria INVENTADA: un hogar que cobra
// 3.000 € el día 25 y paga un seguro de 900 € el 20 (antes de cobrar) y la luz (120 €) el 5, con días indicados, y 60 € de gasto cada día.
// El punto más bajo cae la víspera del cobro (el 24); mover el seguro a después de cobrar sube ese mínimo su importe.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const M = require("../canonical-charge-day-moves.js");

const pad = (n) => String(n).padStart(2, "0");
const daysIn = (y, m) => new Date(Date.UTC(y, m, 0)).getUTCDate();

/** Trayectoria diaria desde el 1/12/2026, `months` meses, con el saldo calculado a partir de los eventos. */
function trayectoria({ months = 3, confidence = "declared", start = 1000, seguroDia = 20 } = {}) {
  const rows = [];
  let total = start;
  for (let k = 0; k < months; k += 1) {
    const y = 2026 + Math.floor((11 + k) / 12);
    const m = ((11 + k) % 12) + 1;
    for (let d = 1; d <= daysIn(y, m); d += 1) {
      const date = `${y}-${pad(m)}-${pad(d)}`;
      const events = [{ kind: "outflow", field: "variableOperationalSpend", label: "Gasto variable estimado", amount: 60, date, confidence: "estimated" }];
      if (d === 25) events.push({ kind: "income", field: "income", label: "Nómina", amount: 3000, date, confidence: "rule" });
      if (d === seguroDia) events.push({ kind: "outflow", field: "fixedCoreSpend", label: "Seguro", amount: 900, date, confidence });
      if (d === 5) events.push({ kind: "outflow", field: "fixedCoreSpend", label: "Luz", amount: 120, date, confidence });
      total += events.reduce((sum, e) => sum + (e.kind === "income" ? e.amount : -e.amount), 0);
      rows.push({ date, total, events });
    }
  }
  return rows;
}

test("XPR-11 · el seguro del 20 pasa a después de cobrar y el punto más bajo sube su importe", () => {
  const rows = trayectoria();
  const r = M.suggest(rows, { today: "2026-12-01" });
  assert.equal(r.ready, true);
  assert.ok(r.knownShare === 1);
  assert.ok(r.moves.length >= 1);
  const [primero] = r.moves;
  assert.equal(primero.label, "Seguro");
  assert.equal(primero.fromDay, 20);
  assert.equal(primero.toDay, 25, "el día del cobro: el más cercano de los que más suben el mínimo");
  assert.ok(Math.abs(primero.gain - 900) < 1, `sube ~900 € (${primero.gain})`);
  assert.equal(primero.months, 3, "se nota en diciembre, enero y febrero");
  assert.ok(r.moves.every((move) => move.gain >= 50));
  // El punto más bajo de los 90 días también sube.
  assert.ok(r.low.after.value > r.low.before.value);
});

test("XPR-11 · sin días conocidos (estimados) no hay propuesta: no se mueve una suposición", () => {
  const r = M.suggest(trayectoria({ confidence: "estimated" }), { today: "2026-12-01" });
  assert.equal(r.ready, false);
  assert.equal(r.reason, "pocos-dias");
  assert.equal(r.knownShare, 0);
});

test("XPR-11 · nada que mover si ningún cambio sube el mínimo 50 €, y canMove deja fuera lo que no se puede guardar", () => {
  // El seguro ya se carga el 26, tras cobrar: lo que queda es la luz (120 €), por debajo del mínimo pedido.
  const tranquilo = M.suggest(trayectoria({ seguroDia: 26 }), { today: "2026-12-01", minGain: 400 });
  assert.equal(tranquilo.ready, true);
  assert.equal(tranquilo.moves.length, 0);
  assert.equal(tranquilo.reason, "nada-que-mover");
  const sinSeguro = M.suggest(trayectoria(), { today: "2026-12-01", canMove: (item) => item.label !== "Seguro" });
  assert.ok(!sinSeguro.moves.some((move) => move.label === "Seguro"));
});

test("XPR-11 · nunca mueve un cargo a un día pasado, y el motor es puro", () => {
  const rows = trayectoria();
  // Hoy es el 22/12: el seguro de diciembre (20) ya pasó y no se mueve; los de enero y febrero, sí.
  const r = M.suggest(rows, { today: "2026-12-22" });
  assert.equal(r.ready, true);
  assert.equal(r.moves[0].label, "Seguro");
  assert.ok(r.moves[0].toDay >= 25);
  assert.equal(r.moves[0].months, 2, "solo enero y febrero: el de diciembre ya pasó");
  const fuente = fs.readFileSync(path.resolve(__dirname, "../canonical-charge-day-moves.js"), "utf8");
  assert.doesNotMatch(fuente, /document\.|window\.|localStorage|fetch\(/);
});
