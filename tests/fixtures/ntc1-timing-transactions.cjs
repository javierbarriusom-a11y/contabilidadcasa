// WP-07 (NTC-01): movimientos sintéticos y deterministas (sin datos del hogar) para la equivalencia del
// motor de fechas. Los usan tests/ntc1-motor-fechas.test.cjs y la herramienta que generó
// ntc1-timing-golden.json a partir de app.js ANTES de la extracción. No cambiar: el oro depende de ellos.
const MONTHS = [];
for (let year = 2025; year <= 2027; year += 1) for (let month = 1; month <= 12; month += 1) MONTHS.push(`${year}-${String(month).padStart(2, "0")}`);

const TEXTS = ["NOMINA EMPRESA", "TRANSFER INMEDIATA", "INGRESO RECURRENTE 800", "DEVOLUCIONES TRIBUTARIA", "WASH SL", "BONUS ANUAL", "IBERDROLA LUZ", "GIMNASIO CENTRO", "SEGURO HOGAR MAPFRE", "CANAL AGUA", "NETFLIX.COM", "COMUNIDAD VECINOS", "TRASTERO BOX", "PARKING PLAZA", "COMPRA SUPER"];
const AMOUNTS = [15.5, 80, 500, 800, 2400, 2500, 3400, 8123.45, 81.9, 497];

function buildTransactions() {
  let seed = 7;
  const rnd = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;
  return MONTHS.flatMap((month) => {
    const [year, monthNumber] = month.split("-").map(Number);
    const last = new Date(year, monthNumber, 0).getDate();
    return Array.from({ length: 18 }, () => {
      const text = TEXTS[Math.floor(rnd() * TEXTS.length)];
      const sign = /NOMINA|TRANSFER|INGRESO|DEVOL|WASH|BONUS/.test(text) ? 1 : -1;
      const amount = sign * AMOUNTS[Math.floor(rnd() * AMOUNTS.length)];
      const day = String(1 + Math.floor(rnd() * last)).padStart(2, "0");
      const r = rnd();
      // Fechas vacías, inválidas y con hora: el motor debe tratarlas igual que antes.
      const date = r < 0.05 ? "" : r < 0.08 ? "no-es-fecha" : r < 0.1 ? `${month}-${day}T10:00:00Z` : `${month}-${day}`;
      return { month, date, amount, movement: text, details: rnd() < 0.3 ? "recibo" : "", category: rnd() < 0.2 ? "Hogar" : "" };
    });
  });
}

module.exports = { MONTHS, buildTransactions };
