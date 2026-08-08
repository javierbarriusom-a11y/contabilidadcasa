# Informe de paridad de deuda — E19-0, día 3

Fecha: 8 de agosto de 2026.
Alcance: casos dorados C001–C010 (deuda), ejecutados contra los motores de cálculo de deuda que
existen hoy en el repositorio. Es el entregable que, según el documento de esquemas y dataset
dorado, "debería decidir el orden real de la Ola 0": antes de consolidar los nueve módulos de
decisión en un motor de Escenario único (E20), conviene saber en qué discrepan hoy.

## 1. Motores de deuda encontrados

De los nueve módulos de decisión que el modelo de Escenario propone consolidar, tres calculan
de forma **independiente** un cuadro de amortización o coste de deuda. Son los únicos contra los
que tiene sentido ejecutar C001–C010 hoy; el resto (simulador general E13, asesor ejecutivo, plan
de ahorro) *consumen* esos resultados en vez de recalcularlos, y se revisarán en el informe de
casos combinados del día 5.

| Motor | Archivo | Qué representa | Modela reunificación | Modela amortización parcial | Busca «mes óptimo» |
| --- | --- | --- | --- | --- | --- |
| Roadmap heredado (`iframe`) | `legacy-debt-roadmap-engine.js` | La pantalla histórica de plan de deuda, conservada como respaldo de E14 | No | Solo vía `hybrid` (lump + financiación del resto) | No |
| Operaciones E14 canónicas | `canonical-e14-operations.js` | El reemplazo canónico ya usado en producción para ofertas y aplicación | No | No expone una operación propia; hereda el mismo hueco | No |
| Comparador de acuerdos | `canonical-debt-comparator.js` | Ranking de alternativas ya calculadas para un contrato, con guardarraíl de reserva | No aplica (no calcula, solo ordena) | No aplica | No aplica |

`canonical-e14-parity.js` ya compara los dos primeros en producción con una tolerancia de 0,01 €
(es el mecanismo que impide retirar el `iframe` mientras exista una sola divergencia). Este informe
reutiliza exactamente ese arnés para los 10 casos, en vez de construir uno nuevo.

## 2. Resultado por caso

| Caso | Título | Motores que lo calculan | ¿Coinciden? | Hallazgo |
| --- | --- | --- | --- | --- |
| C001 | Amortización total, mes manual | Roadmap heredado, E14 canónico | ✅ Sí (0 € de diferencia) | Cierra la deuda y libera la cuota exactamente en el mes indicado |
| C002 | Amortización parcial | Roadmap heredado, E14 canónico | ✅ Sí (0 € de diferencia) | Ninguno de los dos tiene una operación «amortización parcial» nativa: ambos la expresan como `hybrid` (pago inicial + financiación del resto). Numéricamente correcto, pero conceptualmente es un rodeo |
| C003 | Amortización, mes óptimo | — | — | **Hueco funcional.** Ningún motor busca un mes; los tres exigen una fecha explícita. Es una capacidad nueva de E20, no una migración |
| C004 | Amortización fraccionada, 6 meses | — | — | **Hueco funcional.** El motor heredado admite un único evento de amortización por cuenta; no hay forma de expresar varias amortizaciones parciales sucesivas |
| C005 | Reunificación de 3 deudas | — | — | **Hueco funcional, el más importante de los tres.** Ni el motor heredado ni el canónico tienen una operación N:1 que cierre varias deudas y abra una nueva combinando capital y comisiones. Hoy «reunificar» se simula fuera de estos motores |
| C006 | Refinanciación con alargamiento | Roadmap heredado, E14 canónico | ✅ Sí (0 € de diferencia) | Confirma con datos reales el caso contraintuitivo del documento: alargar 46→72 meses baja la cuota de 189,96 € a 133,41 €, pero sube el coste total de 8.738,16 € a 9.605,52 € |
| C007 | Retomar pagos suspendidos | Roadmap heredado, E14 canónico | ✅ Sí (0 € de diferencia) | Ninguno de los dos motores distingue «reanudar tras una suspensión» de «financiar desde ese mes»: no existe un histórico de meses suspendidos, solo el calendario desde el mes de inicio |
| C008 | Acuerdo con quita | Roadmap heredado, E14 canónico, Comparador | ✅ Sí en los tres | El comparador, alimentado con el resultado de los otros dos (4.100 €), recomienda la quita frente a «no actuar» siempre que la reserva quede protegida |
| C009 | Deuda sin TIN | Roadmap heredado, E14 canónico | ✅ Sí (0 € de diferencia) | Con TIN desconocido (0 %), el coste financiero es exactamente cero y ningún motor falla. Pero **tampoco ninguno emite una advertencia**: el documento exige que una deuda sin TIN sea visible como aviso, y hoy no lo es en ningún sitio |
| C010 | Tipo variable, +100 pb | Roadmap heredado, E14 canónico | ✅ Sí (0 € de diferencia) | Evidencia real de la invariante I-08 (monotonía de tipo): +100 pb sobre la misma deuda sube el coste de 8.738,16 € a 8.898,70 € (+160,54 €), nunca lo baja |

## 3. Lectura del resultado

**Los tres desenlaces que preveía el documento aparecieron, y en la proporción que cabía esperar:**

1. **Coinciden (7 de 10 casos computables).** El roadmap heredado y las operaciones E14 canónicas
   están, para amortización total, parcial, refinanciación, reanudación, quita y sensibilidad de
   tipo, en paridad exacta hoy. Esto es lo que ya garantiza `canonical-e14-parity.js` en producción;
   este informe simplemente lo confirma con casos con nombre y trazabilidad, en vez de un número
   de test genérico.
2. **Divergen entre pantallas: ninguna encontrada.** No apareció ningún caso en el que los dos
   motores calculasen algo distinto sobre los mismos datos. Es una noticia mejor de lo previsto: el
   dominio de deuda concreto (los pagos y cierres, no la decisión de reunificar o esperar) ya está
   consolidado en la práctica.
3. **Ningún motor puede calcularlo (3 de 10 casos): C003, C004, C005.** Este es el hallazgo que
   importa para planificar E20. Los tres huecos no son errores de un motor frente a otro — son
   capacidades que **no existen todavía en ningún sitio**: búsqueda de mes óptimo, amortización
   fraccionada recurrente y reunificación N:1. El esquema de `Escenario`/`Decisión` de E19-0 (día 1)
   ya los modela (`tipo: "amortizacion_fraccionada"`, `tipo: "reunificacion"`,
   `planificacion.modo: "optimo"`); son precisamente los tipos de decisión que E20 debe implementar
   de cero, no migrar desde un motor existente.

### 3.1 Corrección posterior (día 4): C007 no estaba realmente en paridad

Al construir las invariantes con generación aleatoria (día 4, ver `E19_INVARIANTES.md`) apareció
un caso que amortizaba una cuenta `hybrid` con importe y plazo mayores que los usados aquí y que
el motor heredado reportaba con una duración superior a la real. La causa: `durationMonths` en
`legacy-debt-roadmap-engine.js` leía el array de saldos mutable del final de la simulación en vez
del saldo histórico de cada mes, así que un residuo de coma flotante podía dejar una deuda ya
pagada «viva» durante el resto del horizonte. Se corrigió en `legacy-debt-roadmap-engine.js`
(un único punto, sin tocar `totalPaid`, `totalLump` ni `peak`).

Al volver a generar los casos con el motor corregido, **C007 cambió**: su duración pasó de 40 a 39
meses y `paridadLegadoVsCanonico.valid` pasó de `false` (con `duration:40!=39`) a `true`. La tabla
del §2 y este informe ya reflejan el resultado corregido. Es la prueba de que el propio ejercicio
del dataset dorado encuentra divergencias reales incluso en un caso que este mismo informe había
marcado como «✅ coincide» — la comparación de §2 se basaba en `totalPaid`, no en la duración, y
por eso no lo detectó hasta que las invariantes lo generalizaron con casos aleatorios.

## 4. Consecuencia para el orden de E20

- **F1 (esquema + motor determinista) no puede limitarse a envolver el motor heredado.** Para
  amortización total, parcial, refinanciación, quita y reanudación, envolver
  `legacy-debt-roadmap-engine.js`/`canonical-e14-operations.js` sería suficiente y de bajo riesgo.
  Pero reunificación y mes óptimo — dos de los seis tipos de decisión más usados según el propio
  documento de Escenario — exigen lógica nueva desde el primer día de F1, no una migración.
- **La advertencia de TIN desconocido (C009) es un defecto de producto independiente del
  refactor.** Se registra aquí para que no se pierda, pero no bloquea nada: puede corregirse en
  cualquiera de los dos motores actuales sin esperar a E20.
- **El comparador de acuerdos (C008) ya es reutilizable tal cual.** No calcula, solo ordena
  alternativas ya calculadas — es exactamente el patrón que el motor de Escenario debería conservar
  para no reescribir la lógica de recomendación.

## 5. Qué queda fuera de este informe

- Los casos de proyectos y compras (C020–C024) y los casos combinados (C040–C045), previstos para
  el día 5, que sí ejercitan el simulador general (E13) y el asesor ejecutivo como motores de
  decisión.
- Las 15 invariantes del motor (I-01…I-15), previstas para el día 4. Dos de ellas —
  conservación de caja (I-02) y cierre de cuentas (I-03) — ya están verificadas desde el día 2
  contra `canonical-engine.js` usando los datasets D1–D3.
- Presupuesto de rendimiento del cálculo determinista (150 ms / 120 meses): no aplica todavía
  porque no existe un motor de Escenario que medir; se retomará en E20-0.
