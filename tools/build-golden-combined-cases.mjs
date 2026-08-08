// Genera los casos dorados combinados C040-C045 (E19-0, día 5): el bloque que el propio
// documento señala como "donde aparecen los bugs" porque cruza varias decisiones a la vez —
// orden, dependencias, conflictos — en vez de una decisión aislada como C001-C010.
//
// Dos de los seis (C044, C045) son verificables hoy con teoría de grafos pura, sin esperar al
// motor de Escenario: se ejecutan de verdad contra resolveExecutionOrder() de
// canonical-scenario-schema.js y su resultado se fija como esperado. Los otros cuatro (C040-C043)
// exigen que un motor conozca el estado de cada deuda tras cada decisión anterior — cascada de
// caja, cierre de una deuda por otra decisión — y se documentan como hueco funcional en vez de
// forzar un resultado inventado, siguiendo el mismo criterio que C003-C005 del día 3.
//
// Reproducible: node tools/build-golden-combined-cases.mjs (o `npm run golden:combined-cases`).

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const casosDir = path.join(root, "tests", "golden", "casos");
const esperadosDir = path.join(root, "tests", "golden", "esperados");

const schema = require("../canonical-scenario-schema.js");

const ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ"; // Crockford base32

function makeId(prefix, seed) {
  let out = "";
  for (let index = 0; index < 26; index += 1) out += ALPHABET[(seed * (index + 7) + index * 13) % ALPHABET.length];
  return `${prefix}_${out}`;
}

function decision(seed, tipo, params, overrides = {}) {
  return { id: makeId("dec", seed), tipo, titulo: `Decisión ${tipo}`, activa: true, orden: 0, planificacion: { modo: "optimo" }, params, ...overrides };
}

function computableOrder({ id, titulo, proteje, decisiones, notas }) {
  const result = schema.resolveExecutionOrder(decisiones);
  return {
    caso: {
      id, titulo, proteje,
      estado: "computable",
      motoresAplicables: ["canonical-scenario-schema.resolveExecutionOrder"],
      entrada: { decisiones },
      notas: notas || "",
    },
    esperado: {
      id,
      resolucion: {
        hasCycle: result.hasCycle,
        declaredOrder: result.declaredOrder,
        resolvedOrder: result.resolvedOrder,
        declaredOrderMatches: result.declaredOrderMatches,
        unresolved: result.unresolved,
      },
    },
  };
}

function gap({ id, titulo, proteje, dataset, motoresConsultados, motivo }) {
  return {
    caso: { id, titulo, proteje, dataset, estado: "gap_funcional", motoresConsultados, motivo },
    esperado: null,
  };
}

const CASES = [];

// C040 · Amortizar en M6 + comprar en M9 usando la cuota liberada — Protege: efecto cascada.
CASES.push(gap({
  id: "C040",
  titulo: "Amortizar en M6 + comprar en M9 usando la cuota liberada",
  proteje: "Efecto cascada",
  dataset: "D1-hogar-base",
  motoresConsultados: ["legacy-debt-roadmap-engine", "canonical-e14-operations", "canonical-scenario-schema"],
  motivo: "Ningún motor actual conoce el margen mensual liberado por cerrar una deuda ni lo reinyecta en la capacidad disponible para una compra posterior: cada motor de deuda calcula su propio cuadro de forma aislada del resto del plan (ingresos, otros gastos, otras decisiones). Simular la cascada real (cerrar deuda → más margen mensual → financiar mejor la compra) exige el motor de Escenario de E20, que sí comparte estado entre decisiones resueltas en orden.",
}));

// C041 · Las mismas dos decisiones en orden inverso — Protege: la dependencia del orden es real y
// correcta (comprar primero, sin la cuota liberada, debería dar un resultado peor o distinto).
CASES.push(gap({
  id: "C041",
  titulo: "Las mismas dos decisiones (C040) en orden inverso",
  proteje: "La dependencia del orden es real y correcta",
  dataset: "D1-hogar-base",
  motoresConsultados: ["legacy-debt-roadmap-engine", "canonical-e14-operations", "canonical-scenario-schema"],
  motivo: "Mismo motivo que C040: sin motor que comparta estado entre decisiones, no hay nada que comparar entre 'amortizar y luego comprar' y 'comprar y luego amortizar'. La infraestructura de orden (resolveExecutionOrder, ver C044) ya decide QUÉ decisión se resuelve primero; lo que falta es el motor que calcule un resultado distinto según ese orden.",
}));

// C042 · Dos amortizaciones sobre la misma deuda, la segunda ya cerrada — Protege: conflicto
// bloqueante.
CASES.push(gap({
  id: "C042",
  titulo: "Dos amortizaciones sobre la misma deuda, la segunda ya cerrada",
  proteje: "Conflicto bloqueante",
  dataset: "D1-hogar-base",
  motoresConsultados: ["canonical-scenario-schema"],
  motivo: "Detectar que la segunda amortización llega sobre una deuda YA cerrada por la primera exige saber si la primera amortización cierra la deuda (depende de su importe frente al principal, que el esquema no valida de forma cruzada a propósito: deudaId es opaco para el validador de esquema, ver doc §3). Es responsabilidad del motor de Escenario (§2.3 regla 3: 'una amortización sobre una deuda ya cerrada por otra decisión genera un conflicto bloqueante'), no del esquema estructural que ya existe.",
}));

// C043 · Reunificación + amortización de una deuda incluida en ella — Protege: conflicto
// bloqueante.
CASES.push(gap({
  id: "C043",
  titulo: "Reunificación + amortización de una deuda incluida en ella",
  proteje: "Conflicto bloqueante",
  dataset: "D2-hogar-apalancado",
  motoresConsultados: ["canonical-scenario-schema"],
  motivo: "Mismo motivo que C042 y coherente con el hueco ya documentado en C005 (día 3): ni el esquema ni ningún motor actual saben qué deudaIds quedan absorbidas por una reunificación. El propio esquema exige deudaIds como array de cadenas opacas (§3), sin cruzarlas contra otras decisiones del mismo escenario — esa validación cruzada es del motor de Escenario, no del esquema.",
}));

// C044 · Dependencia declarada con orden contradictorio — Protege: el orden topológico gana.
// A (orden 1) sin dependencias; C (orden 3) sin dependencias; B (orden 2) depende de C.
// El orden declarado ingenuo (A, B, C) es inválido: B no puede resolverse antes que C.
const idA044 = makeId("dec", 100);
const idB044 = makeId("dec", 101);
const idC044 = makeId("dec", 102);
CASES.push(computableOrder({
  id: "C044",
  titulo: "Dependencia declarada con orden contradictorio",
  proteje: "Orden topológico gana",
  decisiones: [
    decision(100, "amortizacion", { deudaId: "d1-entidad-a", importe: 1000 }, { id: idA044, orden: 1 }),
    decision(101, "traspaso", { origen: "caixabank", destino: "mediolanum", importe: 300, mes: "2026-09" }, { id: idB044, orden: 2, dependeDe: [idC044] }),
    decision(102, "compra", { nombre: "Coche", importe: 5000 }, { id: idC044, orden: 3 }),
  ],
  notas: "B declara orden:2 pero depende de C (orden:3). El orden declarado ingenuo (A,B,C) es inválido porque ejecutaría B antes que su propia dependencia. resolveExecutionOrder() resuelve (A,C,B): el orden topológico gana sobre el campo `orden`, tal como exige §2.3 regla 1 del modelo de Escenario.",
}));

// C045 · Ciclo en dependeDe — Protege: error de validación, no bucle infinito. Ya cubierto en el
// esquema del día 1 (validateEscenario) y revisitado aquí contra resolveExecutionOrder().
const idA045 = makeId("dec", 200);
const idB045 = makeId("dec", 201);
CASES.push(computableOrder({
  id: "C045",
  titulo: "Ciclo en dependeDe",
  proteje: "Error de validación, no bucle infinito",
  decisiones: [
    decision(200, "amortizacion", { deudaId: "d1-entidad-a", importe: 1000 }, { id: idA045, orden: 0, dependeDe: [idB045] }),
    decision(201, "traspaso", { origen: "caixabank", destino: "mediolanum", importe: 300, mes: "2026-09" }, { id: idB045, orden: 1, dependeDe: [idA045] }),
  ],
  notas: "A depende de B y B depende de A. validateEscenario() ya rechaza este escenario con el código dependency-cycle (día 1, T-META y caso C045 originales); aquí se confirma además que resolveExecutionOrder() termina — no entra en bucle infinito — y reporta hasCycle:true con ambos identificadores sin resolver.",
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
