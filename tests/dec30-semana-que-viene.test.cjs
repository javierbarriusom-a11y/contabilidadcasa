// DEC-30 · la semana que viene en una frase (décima auditoría §4.6): lo que sale y lo que entra en los próximos 7 días y el día más
// justo, de las filas del motor diario, en la Previsión y en el «Listo» del repaso. Trayectorias INVENTADAS: ninguna cifra es del hogar.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const C = require("../canonical-forecast-contract.js");
const read = (file) => fs.readFileSync(path.join(__dirname, "..", file), "utf8");

/** Filas del motor diario desde `from`: `dia(i)` da { total, income, outflows } del día i. */
function filas(from, n, dia) {
  return Array.from({ length: n }, (_, i) => {
    const date = new Date(`${from}T00:00:00Z`);
    date.setUTCDate(date.getUTCDate() + i);
    return { date: date.toISOString().slice(0, 10), income: 0, outflows: 0, ...dia(i) };
  });
}

test("DEC-30 · weekAhead: de hoy a dentro de 6 días, lo que sale y lo que entra redondeado a la decena y el día más justo", () => {
  // Sale 91,40 € al día; el día 3 entra una nómina de 1.900 €; el día 5 hay un cargo de 500 € (el saldo más bajo de los 7).
  const rows = filas("2026-11-21", 20, (i) => ({ total: 3000 - i * 91.4 + (i >= 3 ? 1900 : 0) - (i >= 5 ? 500 : 0) - (i === 5 ? 2500 : 0), income: i === 3 ? 1900 : 0, outflows: 91.4 + (i === 5 ? 500 : 0) }));
  const semana = C.weekAhead(rows, { today: "2026-11-21" });
  assert.equal(semana.from, "2026-11-21");
  assert.equal(semana.to, "2026-11-27");
  assert.equal(semana.outflows, 1140, "7 × 91,40 + 500 = 1.139,80, a la decena");
  assert.equal(semana.outflowsApproximate, false, "1.139,80 se enseña como 1.140: el redondeo al euro ya es 1.140");
  assert.equal(semana.income, 1900);
  assert.equal(semana.incomeApproximate, false);
  assert.deepEqual(semana.low, { date: "2026-11-26", daysAhead: 5 });
  // Lo de antes de hoy y lo de después del día 7 no cuenta.
  assert.equal(C.weekAhead(rows, { today: "2026-11-22" }).from, "2026-11-22");
});

test("DEC-30 · weekAhead: «unos» cuando el redondeo quita algo; los traspasos no salen ni entran; sin las 7 filas, nada", () => {
  const rows = filas("2026-11-21", 7, (i) => ({ total: 5000 - i * 10, outflows: 13.3, transfers: i === 2 ? 800 : 0 }));
  const semana = C.weekAhead(rows, { today: "2026-11-21" });
  assert.equal(semana.outflows, 90, "93,10 €, a la decena");
  assert.equal(semana.outflowsApproximate, true);
  assert.equal(semana.income, 0);
  assert.deepEqual(semana.low, { date: "2026-11-27", daysAhead: 6 }, "el saldo baja hasta el último día");
  // Con empate, el primero.
  assert.equal(C.weekAhead(filas("2026-11-21", 7, () => ({ total: 100 })), { today: "2026-11-21" }).low.date, "2026-11-21");
  // Sin las 7 filas (el horizonte se acaba, falta un saldo) o sin fecha, no se dice media semana.
  assert.equal(C.weekAhead(rows.slice(0, 6), { today: "2026-11-21" }), null);
  assert.equal(C.weekAhead(rows.map((row, i) => (i === 3 ? { ...row, total: null } : row)), { today: "2026-11-21" }), null);
  assert.equal(C.weekAhead(rows, {}), null);
  assert.equal(C.weekAhead(null, { today: "2026-11-21" }), null);
});

test("DEC-30 · la cifra está en el contrato de previsión, con su etiqueta, unidad y motor", () => {
  const metric = C.METRICS.find((item) => item.id === "semana-que-viene");
  assert.ok(metric, "declarada en METRICS");
  assert.equal(metric.engine, "diario");
  assert.equal(C.WEEK_DAYS, 7);
});

test("DEC-30 · la frase: dos cifras como mucho, el día por su nombre y nada inventado", () => {
  const src = read("views/prevision-v2.js");
  const cuerpo = src.slice(src.indexOf("const PREVISION_V2_DIAS_SEMANA"), src.indexOf("// ---- FX-42"));
  const ctx = { globalThis: { FinanceCanonicalForecastContract: C }, money: (v) => `${new Intl.NumberFormat("es-ES", { useGrouping: "always" }).format(v)} €` };
  const frase = new Function("globalThis", "money", `${cuerpo.replace("const PREVISION_V2_DIAS_SEMANA", "var PREVISION_V2_DIAS_SEMANA")}; return previsionV2SemanaFrase;`)(ctx.globalThis, ctx.money);
  const dias = (n, dia) => filas("2026-11-21", n, dia);
  // El 21/11/2026 es sábado: el día 5 es el jueves.
  assert.equal(
    frase(dias(7, (i) => ({ total: 1000 - (i === 5 ? 600 : 0), outflows: i === 5 ? 640 : 0 })), "2026-11-21"),
    "En los próximos 7 días salen 640 € y no entra nada; el jueves es el día más justo.",
  );
  assert.equal(
    frase(dias(7, (i) => ({ total: 1000 + i, income: i === 2 ? 1900 : 0, outflows: i === 0 ? 13.3 : 0 })), "2026-11-21"),
    "En los próximos 7 días salen unos 10 € y entran 1.900 €; hoy es el día más justo.",
  );
  assert.equal(frase(dias(7, (i) => ({ total: 1000 + (i === 1 ? -5 : 0), income: i === 0 ? 50 : 0 })), "2026-11-21"), "En los próximos 7 días no sale nada y entran 50 €; mañana es el día más justo.");
  assert.equal(frase(dias(7, () => ({ total: 1000 })), "2026-11-21"), "En los próximos 7 días no hay previsto ningún cobro ni pago.");
  // Si el saldo baja hasta el último día, el día lo pone el corte de la semana: no se dice.
  assert.equal(frase(dias(7, (i) => ({ total: 1000 - i * 50, outflows: 50 })), "2026-11-21"), "En los próximos 7 días salen 350 € y no entra nada.");
  assert.equal(frase(dias(3, () => ({ total: 1000 })), "2026-11-21"), "", "sin la semana entera, nada");
  const cifras = (texto) => (texto.match(/\d[\d.]*(?:,\d+)? €/g) || []).length;
  assert.ok(cifras(frase(dias(7, (i) => ({ total: 900 - i, income: 20, outflows: 30 })), "2026-11-21")) <= 2, "dos cifras como mucho");
});

test("DEC-30 · cableado: en la Previsión bajo el gráfico y primera en el «Listo» del repaso, sin pasar de tres líneas", () => {
  const src = read("views/prevision-v2.js");
  // Bajo el gráfico y el panel del día, nunca en el titular: ahí empujaba el gráfico fuera de la primera pantalla.
  assert.match(src, /<div class="prev-v2-atajos-hueco">.*<\/div>\n\s*\$\{semana \? `<p class="prev-v2-semana">\$\{escapeHtml\(semana\)\}<\/p>` : ""\}/);
  const hero = src.slice(src.indexOf("function previsionV2HeroHtml"), src.indexOf("function previsionV2Vista"));
  assert.doesNotMatch(hero, /prev-v2-semana/);
  assert.match(src, /const semana = previsionV2SemanaFrase\(rows, today\);/, "con las filas del plan, no las de una prueba");
  const resumen = src.slice(src.indexOf("function previsionV2ResumenRepaso"), src.indexOf("function previsionV2AbrirPuente"));
  assert.match(resumen, /const lineas = \[previsionV2SemanaFrase\(rows, today\), `Lo más bajo en 30 días:/);
  // Con aviso no se calcula qué ha cambiado: semana, punto más bajo y aviso, tres líneas como mucho.
  assert.match(resumen, /const cambios = aviso \? null : previsionV2Cambios\(/);
  assert.match(resumen, /lineas: lineas\.filter\(Boolean\)/);
  const css = read("tema-v2.css");
  assert.match(css, /:root\[data-tema="v2"\] \.prev-v2-semana \{[^}]*color: var\(--e19-ink\);/);
  const html = read("index.html");
  ["canonical-forecast-contract.js", "views/prevision-v2.js"].forEach((file) => assert.ok(html.includes(`${file}?v=20261121dec30`), file));
  assert.match(html, /tema-v2\.css\?v=2026112(?:1(?:dec30|dec38c|dec38d|areas|d658)|2und|5tred1|5tred2|5tre3c|5tred4|5tred4b)/, "tema-v2.css siguió a 20261121dec38c y dec38d con DEC-38 a 195 px");
  assert.match(html, /novedades\.js\?v=2026112(?:1(?:dec30|dec45|areas|dn27|dn28)|2und|5dn40|5tred2|5tre3c|5tred4|5tred4b)/, "novedades.js siguió a 20261121dec45 con DEC-45");
  const novedad = require("../novedades.js").find((entry) => entry.id === "2026-11-21-semana-que-viene");
  assert.equal(novedad.fecha, "2026-11-21");
  assert.equal(novedad.href, "#plan");
});
