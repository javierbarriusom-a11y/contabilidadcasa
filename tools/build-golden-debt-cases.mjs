// Genera los casos dorados de deuda C001-C010 (E19-0, día 3) y fija sus resultados esperados
// ejecutándolos contra los motores reales existentes: legacy-debt-roadmap-engine.js (el `iframe`
// histórico) y canonical-e14-operations.js (el reemplazo canónico), comparados mediante el arnés
// de paridad que E14 ya usa en producción (canonical-e14-parity.js, tolerancia 0,01 €).
//
// Cuando un caso no es representable por ningún motor actual, se documenta como hueco funcional
// en vez de fabricar un resultado — es precisamente el hallazgo que justifica el ejercicio (doc
// "Esquemas validables y dataset dorado", §5.3).
//
// Reproducible: node tools/build-golden-debt-cases.mjs (o `npm run golden:debt-cases`).

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const casosDir = path.join(root, "tests", "golden", "casos");
const esperadosDir = path.join(root, "tests", "golden", "esperados");

const legacy = require("../legacy-debt-roadmap-engine.js");
const parity = require("../canonical-e14-parity.js");

const TOLERANCIA = 0.01;

function round2(value) {
  return Math.round((Number(value) + Number.EPSILON) * 100) / 100;
}

function computable({ id, titulo, proteje, dataset, motoresAplicables, config, notas }) {
  const legacyResult = legacy.simulate(config);
  const parityResult = parity.compare(config, TOLERANCIA);
  const caso = {
    id, titulo, proteje, dataset,
    estado: "computable",
    motoresAplicables,
    entrada: config,
    notas: notas || "",
  };
  const esperado = {
    id,
    tolerancia: TOLERANCIA,
    kpisEsperados: {
      totalPaid: legacyResult.totalPaid,
      totalLump: legacyResult.totalLump,
      peak: legacyResult.peak,
      durationMonths: legacyResult.durationMonths,
    },
    paridadLegadoVsCanonico: {
      valid: parityResult.valid,
      differences: parityResult.differences,
      legacyTotalPaid: parityResult.legacy.totalPaid,
      canonicalTotalCost: parityResult.canonical.totalCost,
    },
  };
  return { caso, esperado };
}

function gap({ id, titulo, proteje, dataset, motivo, motoresConsultados }) {
  return {
    caso: {
      id, titulo, proteje, dataset,
      estado: "gap_funcional",
      motoresConsultados,
      motivo,
    },
    esperado: null,
  };
}

const CASES = [];

// C001 · Amortización total, mes manual — Entidad A de D1 (7.300 €, 9,5 % TIN), liquidación única
// en el mes 6. Protege: cierre de deuda y liberación de cuota.
CASES.push(computable({
  id: "C001",
  titulo: "Amortización total, mes manual",
  proteje: "Cierre de deuda, liberación de cuota",
  dataset: "D1-hogar-base",
  motoresAplicables: ["legacy-debt-roadmap-engine", "canonical-e14-operations"],
  config: {
    baseMonth: "2026-08", months: 60, capacity: 1000,
    accounts: [{ amount: 7300, strategy: "settlement", discount: 0, start: 6, lump: 7300 }],
  },
}));

// C002 · Amortización parcial — 2.000 € de amortización en el mes 6 sobre Entidad A; el resto se
// refinancia a la misma TIN. Protege: recorte de cuadro sin cierre (la deuda sigue viva).
CASES.push(computable({
  id: "C002",
  titulo: "Amortización parcial",
  proteje: "Recorte de cuadro sin cierre",
  dataset: "D1-hogar-base",
  motoresAplicables: ["legacy-debt-roadmap-engine", "canonical-e14-operations"],
  config: {
    baseMonth: "2026-08", months: 46, capacity: 1000,
    accounts: [{ amount: 7300, strategy: "hybrid", discount: 0, start: 6, lump: 2000, apr: 9.5, term: 40, financePct: 100 }],
  },
  notas: "El motor legado no distingue «amortización parcial» de «pago inicial + financiación» (hybrid); se usa hybrid con lump < importe total como equivalente.",
}));

// C003 · Amortización, mes óptimo — requiere que el motor busque el primer mes viable respetando
// un guardarraíl duro (§2.3 regla 2 del modelo de Escenario). Ningún motor actual admite
// `planificacion.modo = "optimo"`: es responsabilidad exclusiva del motor de Escenario de E20.
CASES.push(gap({
  id: "C003",
  titulo: "Amortización, mes óptimo",
  proteje: "Búsqueda respeta guardarraíl duro",
  dataset: "D1-hogar-base",
  motoresConsultados: ["legacy-debt-roadmap-engine", "canonical-e14-operations", "canonical-debt-comparator"],
  motivo: "Ninguno de los tres motores actuales busca un mes óptimo: todos exigen un mes explícito (`start`). La búsqueda con guardarraíles es una capacidad nueva de E20 (planificacion.modo = \"optimo\"), no una migración de código existente.",
}));

// C004 · Amortización fraccionada, 6 meses — aportaciones extra recurrentes que recortan el
// cuadro progresivamente. El motor legado solo admite UN evento de lump por cuenta (en `start`);
// no hay forma de expresar una serie de amortizaciones parciales sucesivas.
CASES.push(gap({
  id: "C004",
  titulo: "Amortización fraccionada, 6 meses",
  proteje: "Recorte progresivo",
  dataset: "D1-hogar-base",
  motoresConsultados: ["legacy-debt-roadmap-engine", "canonical-e14-operations"],
  motivo: "legacy-debt-roadmap-engine.simulate() aplica como máximo un `lump` por cuenta, en el mes `start`. No existe un mecanismo para varias amortizaciones parciales sucesivas dentro del mismo contrato.",
}));

// C005 · Reunificación de 3 deudas — cierre múltiple + apertura de un instrumento nuevo con
// comisiones. El motor legado modela cada cuenta de forma independiente: no hay ninguna
// operación que cierre N cuentas y abra 1 nueva combinando su capital.
CASES.push(gap({
  id: "C005",
  titulo: "Reunificación de 3 deudas",
  proteje: "Cierre múltiple + apertura, comisiones",
  dataset: "D2-hogar-apalancado",
  motoresConsultados: ["legacy-debt-roadmap-engine", "canonical-e14-operations"],
  motivo: "legacy-debt-roadmap-engine trata cada elemento de `accounts[]` de forma independiente; no existe una estrategia que combine el capital de varias cuentas en una nueva. canonical-e14-operations tampoco expone una operación N:1 hoy. Es exactamente el tipo de decisión (`reunificacion`) que introduce el esquema de E19-0 y que E20 deberá implementar de cero, no migrar.",
}));

// C006 · Refinanciación con alargamiento — Entidad A (7.300 €, 9,5 % TIN): plazo original de 46
// meses frente a un alargamiento a 72 meses. Caso contraintuitivo citado por el propio documento:
// la cuota baja pero el coste total sube.
CASES.push(computable({
  id: "C006",
  titulo: "Refinanciación con alargamiento",
  proteje: "Cuota baja, coste total sube (contraintuitivo)",
  dataset: "D1-hogar-base",
  motoresAplicables: ["legacy-debt-roadmap-engine", "canonical-e14-operations"],
  config: {
    baseMonth: "2026-08", months: 60, capacity: 1000,
    accounts: [{ amount: 7300, strategy: "refi", discount: 0, start: 1, apr: 9.5, term: 46, financePct: 100 }],
  },
  notas: "El caso de comparación (plazo alargado a 72 meses, mismo principal y TIN) se registra aparte en C006-alargado dentro del informe de paridad: coste total 9.605,52 € frente a 8.738,16 € del plazo original, con cuota mensual menor (133,41 € frente a 189,96 €).",
}));

// C007 · Retomar pagos suspendidos — Entidad B de D2 (3.600 €, 11 % TIN), reanudación desde el
// mes 8 con calendario normal. Protege: reactivación de calendario.
CASES.push(computable({
  id: "C007",
  titulo: "Retomar pagos suspendidos",
  proteje: "Reactivación de calendario",
  dataset: "D2-hogar-apalancado",
  motoresAplicables: ["legacy-debt-roadmap-engine", "canonical-e14-operations"],
  config: {
    baseMonth: "2026-08", months: 40, capacity: 1000,
    accounts: [{ amount: 3600, strategy: "refi", discount: 0, start: 8, apr: 11, term: 32, financePct: 100 }],
  },
  notas: "El motor legado no distingue «reanudar tras suspensión» de «financiar desde el mes 8»: el resultado numérico es idéntico porque no modela el histórico de meses suspendidos, solo el calendario desde `start`.",
}));

// C008 · Acuerdo con quita — Entidad B de D2 (5.600 €, 14 % TIN), quita pactada a 4.100 € en el
// mes 3. Protege: cierre por importe < principal.
CASES.push(computable({
  id: "C008",
  titulo: "Acuerdo con quita",
  proteje: "Cierre por importe < principal",
  dataset: "D2-hogar-apalancado",
  motoresAplicables: ["legacy-debt-roadmap-engine", "canonical-e14-operations", "canonical-debt-comparator"],
  config: {
    baseMonth: "2026-08", months: 24, capacity: 1000,
    accounts: [{ amount: 5600, strategy: "settlement", discount: round2((5600 - 4100) / 5600 * 100), start: 3, lump: 4100 }],
  },
  notas: "Es también el caso usado para probar canonical-debt-comparator.compareAgreements(): alimentado con este mismo total (4.100 €) como alternativa frente a «no actuar», la recomienda siempre que respete la reserva operativa.",
}));

// C009 · Deuda sin TIN — Entidad D de D2 (2.400 €) sin tipo informado (apr: 0). Protege:
// advertencia presente, coste financiero = 0, sin caída del motor.
CASES.push(computable({
  id: "C009",
  titulo: "Deuda sin TIN",
  proteje: "Advertencia presente, coste = 0, no crash",
  dataset: "D2-hogar-apalancado",
  motoresAplicables: ["legacy-debt-roadmap-engine", "canonical-e14-operations"],
  config: {
    baseMonth: "2026-08", months: 24, capacity: 1000,
    accounts: [{ amount: 2400, strategy: "refi", discount: 0, start: 1, apr: 0, term: 24, financePct: 100 }],
  },
  notas: "Con apr:0, paymentFor() reparte el principal a partes iguales sin interés: totalPaid == principal exactamente. Ninguno de los dos motores emite hoy una advertencia explícita de «TIN desconocido»: queda registrado como hallazgo, no como hueco (no hay crash, pero tampoco hay aviso).",
}));

// C010 · Tipo variable, deltaTipoVariable = +100 pb — misma Entidad A de C006, TIN base 9,5 %
// frente a 10,5 %. Protege: sensibilidad a tipos (y sirve de evidencia real para I-08).
CASES.push(computable({
  id: "C010",
  titulo: "Tipo variable con deltaTipoVariable = +100 pb",
  proteje: "Sensibilidad a tipos",
  dataset: "D1-hogar-base",
  motoresAplicables: ["legacy-debt-roadmap-engine", "canonical-e14-operations"],
  config: {
    baseMonth: "2026-08", months: 46, capacity: 1000,
    accounts: [{ amount: 7300, strategy: "refi", discount: 0, start: 1, apr: 10.5, term: 46, financePct: 100 }],
  },
  notas: "Comparado contra C006 (mismo principal y plazo a 9,5 %): +100 pb sube el coste total de 8.738,16 € a 8.898,70 € (+160,54 €). Es la evidencia real que fija I-08 (monotonía de tipo) antes de que exista el motor de Escenario.",
}));

fs.mkdirSync(casosDir, { recursive: true });
fs.mkdirSync(esperadosDir, { recursive: true });

CASES.forEach(({ caso, esperado }) => {
  const casoFile = path.join(casosDir, `${caso.id}.json`);
  fs.writeFileSync(casoFile, `${JSON.stringify(caso, null, 2)}\n`);
  console.log(`Escrito ${path.relative(root, casoFile)}`);
  if (esperado) {
    const esperadoFile = path.join(esperadosDir, `${caso.id}.expected.json`);
    fs.writeFileSync(esperadoFile, `${JSON.stringify(esperado, null, 2)}\n`);
    console.log(`Escrito ${path.relative(root, esperadoFile)}`);
  }
});
