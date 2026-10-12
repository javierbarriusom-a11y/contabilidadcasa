// WP-54 (GOV-06): el extracto FICTICIO de la tarea 3 de la prueba con personas ajenas (docs/WP54_PRUEBA_USABILIDAD.md). El repositorio es público y la prueba usa la demostración
// sintética: ningún dato real, ni de quien dirige la prueba ni de quien la hace. Todo es inventado y lo parece («… FICTICIA»), sin IBAN, sin nombres, sin comercios con cifras reales.
//
// Las fechas son relativas a «hoy» (la persona que dirige la prueba anota el gasto de la tarea 2 con la fecha de hoy, y el extracto lo trae el mismo día o el siguiente), así que el
// fichero se genera al preparar cada sesión:
//   node tools/build-usability-extract.mjs                    # a la salida estándar, con la fecha de hoy
//   node tools/build-usability-extract.mjs --today 2026-12-03 # una fecha concreta
//   node tools/build-usability-extract.mjs --out extracto.csv # a un fichero
//
// Lo que ejercita, a propósito, de lo construido en WP-51 y WP-53:
//   · una cabecera de título y una línea de consulta antes de la tabla, separador «;», decimales con coma y miles con punto, fechas día/mes/año, saldo con signo coherente;
//   · UNA fila que coincide con el gasto que la tarea 2 pide anotar («Mercadona», 23,40 €): el paso 3 de Importar extracto la propone como la misma compra;
//   · UNA fila del mismo importe pero otro comercio (la trampa: mismo importe no es misma compra).

import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

/** El gasto de la tarea 2: lo que la persona anota a mano. */
export const TASK_EXPENSE = Object.freeze({ concept: "Mercadona", amount: 23.4 });
export const OPENING_BALANCE = 1250;
export const BANK_ROWS = 12;

// Lo que ve el hogar en su extracto, de más nuevo a más viejo. `day` es cuántos días antes de «hoy» cae cada fila.
const ROWS = Object.freeze([
  { day: 0, concept: "COMPRA TARJ. 4412 MERCADONA SA", amount: -23.4 }, // la misma compra que anota la tarea 2
  { day: 0, concept: "COMPRA TARJ. 4412 FARMACIA FICTICIA", amount: -23.4 }, // mismo importe, otro comercio
  { day: 1, concept: "RECIBO SUMINISTRO FICTICIO A", amount: -61.18 },
  { day: 2, concept: "COMPRA TARJ. 4412 CAFETERIA FICTICIA", amount: -4.8 },
  { day: 3, concept: "TRANSFERENCIA RECIBIDA REEMBOLSO FICTICIO", amount: 35 },
  { day: 4, concept: "COMPRA TARJ. 4412 GASOLINERA FICTICIA", amount: -54.2 },
  { day: 5, concept: "RECIBO SUSCRIPCION FICTICIA", amount: -12.99 },
  { day: 6, concept: "COMPRA TARJ. 4412 SUPERMERCADO FICTICIO", amount: -41.07 },
  { day: 7, concept: "NOMINA FICTICIA", amount: 1850 },
  { day: 8, concept: "RECIBO SEGURO FICTICIO", amount: -45 },
  { day: 9, concept: "COMPRA TARJ. 4412 LIBRERIA FICTICIA", amount: -18.5 },
  { day: 10, concept: "RECIBO CUOTA FICTICIA B", amount: -220 },
]);

function isoShift(iso, days) {
  const [year, month, day] = iso.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day - days)).toISOString().slice(0, 10);
}

function validIso(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value ?? ""));
  if (!match) return false;
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
  return date.getUTCMonth() === Number(match[2]) - 1 && date.getUTCDate() === Number(match[3]);
}

const dmy = (iso) => iso.split("-").reverse().join("/");

/** Importe a la española: coma decimal y punto de miles. */
export function formatEs(value) {
  const sign = value < 0 ? "-" : "";
  const [integer, cents] = Math.abs(value).toFixed(2).split(".");
  return `${sign}${integer.replace(/\B(?=(\d{3})+(?!\d))/g, ".")},${cents}`;
}

/**
 * @param {{ today: string, balance?: number }} options `today` en AAAA-MM-DD; `balance` es el saldo tras la fila más nueva
 * @returns {{ csv: string, rows: Array<{ date: string, concept: string, amount: number, balance: number }> }}
 */
export function buildExtract({ today, balance = OPENING_BALANCE } = {}) {
  if (!validIso(today)) throw new Error(`«${today}» no es una fecha AAAA-MM-DD válida.`);
  let running = Math.round(balance * 100);
  const rows = ROWS.map((row) => {
    const cents = Math.round(row.amount * 100);
    const entry = { date: isoShift(today, row.day), concept: row.concept, amount: row.amount, balance: running / 100 };
    running -= cents; // el saldo de la fila anterior (más vieja) es este saldo menos este movimiento
    return entry;
  });
  const lines = [
    "Movimientos de la cuenta (datos ficticios)",
    `Consulta;${dmy(today)}`,
    "",
    "Fecha;Concepto;Importe;Saldo",
    ...rows.map((row) => `${dmy(row.date)};${row.concept};${formatEs(row.amount)};${formatEs(row.balance)}`),
  ];
  return { csv: `${lines.join("\n")}\n`, rows };
}

function main(argv) {
  const arg = (name) => argv.find((item) => item.startsWith(`--${name}=`))?.slice(name.length + 3) ?? (argv.includes(`--${name}`) ? argv[argv.indexOf(`--${name}`) + 1] : null);
  const today = arg("today") ?? new Date().toISOString().slice(0, 10);
  const { csv } = buildExtract({ today });
  const out = arg("out");
  if (out) {
    writeFileSync(out, csv, "utf8");
    console.log(`Extracto ficticio de ${BANK_ROWS} movimientos escrito en ${out} (hoy = ${today}).`);
  } else {
    process.stdout.write(csv);
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) main(process.argv.slice(2));
