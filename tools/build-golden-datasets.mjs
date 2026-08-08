// Genera los datasets sintéticos del dataset dorado (E19-0, día 2).
//
// Cada dataset combina dos formas ya existentes en el repositorio para que, desde el primer día,
// pueda ejecutarse contra dos de los nueve motores actuales sin traducción:
//   - `engineInput`     -> forma que consume canonical-engine.js (openingBalances/policy/months)
//   - `debtContracts`   -> forma que consume canonical-debt-contracts.js (normalizeContracts)
//
// Deliberadamente sintéticos y anonimizados (el repositorio es público): titulares T1/T2, cuentas
// «Banco Operativo»/«Banco Ahorro», deudas «Entidad A/B/C/D». Ningún dato real.
//
// Reproducible: node tools/build-golden-datasets.mjs (o `npm run golden:datasets`).

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outDir = path.join(root, "tests", "golden", "datasets");
const START = new Date(2026, 7, 1); // agosto 2026
const HORIZON_MESES = 120;

function round2(value) {
  return Math.round((Number(value) + Number.EPSILON) * 100) / 100;
}

function monthAt(index) {
  return new Date(START.getFullYear(), START.getMonth() + index, 1);
}

function monthKeyOf(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function monthLabelOf(date) {
  return date.toLocaleDateString("es-ES", { month: "short", year: "2-digit" }).replace(".", "");
}

// Cuota total de deuda en el mes `index` (0-based): suma de los contratos cuyo plazo restante
// todavía cubre ese mes. Modela realistamente contratos que se extinguen dentro del horizonte.
function debtServiceAt(debtContracts, index) {
  return round2(
    debtContracts.reduce((sum, contract) => {
      const covered = index < Number(contract.remainingInstallments || 0);
      return covered ? sum + Number(contract.currentPayment || 0) : sum;
    }, 0)
  );
}

function buildMonths(profile, debtContracts) {
  const months = [];
  for (let index = 0; index < HORIZON_MESES; index += 1) {
    const date = monthAt(index);
    const monthIndex0 = date.getMonth(); // 0 = enero
    const isPagaExtra = monthIndex0 === 5 || monthIndex0 === 11; // junio y diciembre
    const isTemporadaAlta = monthIndex0 === 6 || monthIndex0 === 7 || monthIndex0 === 11; // jul/ago/dic

    let income = profile.ingresoBase;
    if (isPagaExtra) income += profile.ingresoBase * profile.pagaExtraPct;

    let variableOperationalSpend = profile.gastoVariableBase;
    if (isTemporadaAlta) variableOperationalSpend *= 1 + profile.gastoEstacionalPct;

    months.push({
      month: monthLabelOf(date),
      monthKey: monthKeyOf(date),
      income: round2(income),
      coreSpend: round2(profile.gastoFijoBase + variableOperationalSpend),
      variableOperationalSpend: round2(variableOperationalSpend),
      car: 0,
      refi: debtServiceAt(debtContracts, index),
    });
  }
  return months;
}

function dataset({ id, descripcion, profile, debtContracts, saldoInicial }) {
  const months = buildMonths(profile, debtContracts);
  return {
    id,
    descripcion,
    datasetVersion: `golden-${id.toLowerCase()}-v1`,
    generatedAt: "2026-08-08T00:00:00.000Z",
    synthetic: true,
    notaAnonimizacion:
      "Titulares T1/T2, cuentas «Banco Operativo»/«Banco Ahorro», deudas «Entidad A-D». No contiene datos reales.",
    fechaCorte: monthKeyOf(START) + "-01",
    horizonteMeses: HORIZON_MESES,
    composicionIngreso: profile.composicion,
    engineInput: {
      openingBalances: { checking: saldoInicial.operativa, savings: saldoInicial.ahorro },
      policy: {
        incomeFactor: 1,
        annualIncomeGrowth: profile.derivaIngresosAnualPct,
        expenseFactor: 1,
        annualInflation: profile.inflacionAnualPct,
        plannedMonthlySaving: profile.ahorroMensualObjetivo,
        autoCapSavings: true,
      },
      months,
    },
    debtContracts,
    // Nombrado de forma genérica a propósito: este bloque es metadato informativo del dataset,
    // no el objeto `guardarrailes` del esquema de Escenario (que sí usa `reservaOperativaCaixaBank`
    // como en la app real). Aquí se evita el nombre de entidad para mantener el dataset anonimizado.
    guardarrailesReferencia: {
      reservaOperativaCuentaOperativa: 3000,
      colchonMinimoMeses: 3,
      ratioCuotaIngresoMax: 0.35,
      saldoMinimoAbsoluto: 500,
    },
  };
}

function contract(over) {
  return {
    id: over.id,
    entity: over.entity,
    type: over.type || "Crédito al consumo",
    initialPrincipal: over.initialPrincipal,
    currentPrincipal: over.currentPrincipal,
    originalPayment: over.currentPayment,
    currentPayment: over.currentPayment,
    apr: over.apr,
    remainingInstallments: over.remainingInstallments,
    maturityMonth: monthKeyOf(monthAt(over.remainingInstallments - 1)),
    owner: over.owner || "household",
    paymentStatus: "active",
  };
}

// --------------------------------------------------------------------------------------------
// D1 · hogar-base — plan realista, deuda moderada y servible.
// --------------------------------------------------------------------------------------------

const d1Debts = [
  contract({ id: "d1-entidad-a", entity: "Entidad A", initialPrincipal: 9000, currentPrincipal: 7300, currentPayment: 185, apr: 0.095, remainingInstallments: 46 }),
  contract({ id: "d1-entidad-b", entity: "Entidad B", initialPrincipal: 5000, currentPrincipal: 3600, currentPayment: 120, apr: 0.11, remainingInstallments: 32 }),
];

const D1 = dataset({
  id: "D1-hogar-base",
  descripcion: "Plan realista a 120 meses: dos titulares con paga extra en junio/diciembre, dos deudas moderadas y servibles, colchón por encima de la reserva.",
  profile: {
    ingresoBase: 2350 + 1870,
    pagaExtraPct: 0.5,
    gastoFijoBase: 1450,
    gastoVariableBase: 520,
    gastoEstacionalPct: 0.12,
    inflacionAnualPct: 2.5,
    derivaIngresosAnualPct: 1.2,
    ahorroMensualObjetivo: 300,
    composicion: [
      { titular: "T1", salarioBase: 2350 },
      { titular: "T2", salarioBase: 1870 },
    ],
  },
  debtContracts: d1Debts,
  saldoInicial: { operativa: 4200, ahorro: 9500 },
});

// --------------------------------------------------------------------------------------------
// D2 · hogar-apalancado — cuatro deudas, caja justa, colchón inicial por debajo de 2 meses.
// --------------------------------------------------------------------------------------------

const d2Debts = [
  contract({ id: "d2-entidad-a", entity: "Entidad A", initialPrincipal: 9000, currentPrincipal: 7300, currentPayment: 185, apr: 0.095, remainingInstallments: 46 }),
  contract({ id: "d2-entidad-b", entity: "Entidad B", initialPrincipal: 7200, currentPrincipal: 5600, currentPayment: 210, apr: 0.14, remainingInstallments: 30 }),
  contract({ id: "d2-entidad-c", entity: "Entidad C", initialPrincipal: 5000, currentPrincipal: 3600, currentPayment: 140, apr: 0.16, remainingInstallments: 28 }),
  contract({ id: "d2-entidad-d", entity: "Entidad D", initialPrincipal: 3200, currentPrincipal: 2400, currentPayment: 95, apr: 0.10, remainingInstallments: 27 }),
];

const D2 = dataset({
  id: "D2-hogar-apalancado",
  descripcion: "Cuatro deudas activas y caja ajustada: la liquidez inicial cubre menos de dos meses del gasto no financiero antes de la primera nómina.",
  profile: {
    ingresoBase: 2100 + 1550,
    pagaExtraPct: 0.4,
    gastoFijoBase: 1780,
    gastoVariableBase: 700,
    gastoEstacionalPct: 0.10,
    inflacionAnualPct: 2.5,
    derivaIngresosAnualPct: 0.8,
    ahorroMensualObjetivo: 80,
    composicion: [
      { titular: "T1", salarioBase: 2100 },
      { titular: "T2", salarioBase: 1550 },
    ],
  },
  debtContracts: d2Debts,
  saldoInicial: { operativa: 1400, ahorro: 2100 },
});

// --------------------------------------------------------------------------------------------
// D3 · hogar-holgado — sin deuda, superávit alto.
// --------------------------------------------------------------------------------------------

const D3 = dataset({
  id: "D3-hogar-holgado",
  descripcion: "Sin deuda viva y superávit mensual alto: sirve como techo del dataset dorado para comprobar que nada exagera la holgura disponible.",
  profile: {
    ingresoBase: 3200 + 2600,
    pagaExtraPct: 0.45,
    gastoFijoBase: 1900,
    gastoVariableBase: 900,
    gastoEstacionalPct: 0.10,
    inflacionAnualPct: 2.5,
    derivaIngresosAnualPct: 1.5,
    ahorroMensualObjetivo: 1500,
    composicion: [
      { titular: "T1", salarioBase: 3200 },
      { titular: "T2", salarioBase: 2600 },
    ],
  },
  debtContracts: [],
  saldoInicial: { operativa: 9000, ahorro: 42000 },
});

fs.mkdirSync(outDir, { recursive: true });
[D1, D2, D3].forEach((data) => {
  const file = path.join(outDir, `${data.id}.json`);
  fs.writeFileSync(file, `${JSON.stringify(data, null, 2)}\n`);
  console.log(`Escrito ${path.relative(root, file)}`);
});
