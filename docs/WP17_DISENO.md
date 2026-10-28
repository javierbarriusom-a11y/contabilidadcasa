# WP-17 · Siguiente paso de la cartera (NIN-01)

**PR-1, 28/10/2026.**
- Ficha de la propuesta: `docs/PROPUESTA_QUINTA_AUDITORIA_2026-10-02.md` (NIN-01).
- Paquete del plan: `BACKLOG_DEFINITIVO.md` §5.3 (P2, Ola 3), depende de WP-15 (hecho) y WP-39 (construida; falta que el hogar firme su política, H-12).
- Lo pidió el hogar el 28/10 («siguiente paquete del plan»), frente a la recomendación de no sacar funciones nuevas antes del cierre de octubre.

## 1. Qué responde

«¿Qué toca hacer con la cartera?» Hasta ahora la primera pestaña de Inversión era un conjunto de calculadoras. Arriba de Inversión › Cartera, la tarjeta «Siguiente paso de la cartera» enseña:
- **La cartera en una línea:** valor, lo aportado, la plusvalía en euros y en % y la XIRR.
- **Una sola acción**, con su motivo y la regla que la origina, y un botón a la pantalla donde se hace.
- **El resto de cosas pendientes**, plegadas y en el mismo orden.
- **Sin nada pendiente**, «Nada pendiente en la cartera», con lo que se ha mirado. No dice que la cartera esté bien.

## 2. Las reglas (`canonical-next-best-action.js`, puro)

El orden es fijo y la primera que aplica manda:

1. **Valorar:** posiciones sin valorar en más de 35 días (la frescura de WP-15). Va primero porque las demás reglas mirarían cifras viejas. El botón abre la hoja de valoración.
2. **Lo que choca con la política firmada**, si no es de reparto: cripto si la política dice que no se compra, o un préstamo con la cartera como garantía si dice «sin apalancamiento». Cita la regla numerada y lleva a la política.
3. **El reparto fuera de la banda:**
   - **Con política firmada:** su reparto, su banda y su número de regla. Si la política dice «rebalancear primero con aportaciones», nunca propone vender: «Llevad las próximas aportaciones a ETF» o «No aportéis más a fondos hasta que vuelvan a la banda».
   - **Sin política firmada:** el reparto objetivo de Rebalanceo con el umbral de 10 puntos de IV6. Si toca vender, avisa de mirar antes el coste fiscal.
4. **La fiscalidad antes del 31/12**, del 1/10 al 31/12. Condiciones:
   - el año lleva plusvalías sin compensar (`marginalSaleBase` de FC3, que ya descuenta las pérdidas arrastradas);
   - hay una posición en pérdidas (INV6).

   Propone la de mayor pérdida, hasta lo que hay que compensar. Dice la norma de recompra y que es lo que pasa fiscalmente si se vende, no una recomendación de vender.
5. **La política:** sin escribir, sin firmar, cambiada después de firmarla, o con la revisión vencida o a menos de 30 días.
6. **La convicción:** posiciones con convicción declarada sin confirmar en 12 meses (I12).

**Nunca opera ni escribe** (A11-4): ni en la cartera, ni en la política, ni en el reparto. Una prueba lo comprueba.

## 3. Gobierno

- **Nace apagada** en Funciones en prueba (XGO-03, «Siguiente paso de la cartera»). Es la séptima apagada; el panel de seguimiento la cuenta (`"enPrueba": "propio"` en el plan).
- **Medidor (XGO-02):** la vista y, como acción, seguir la acción propuesta.
- **Métrica:** acciones seguidas desde aquí. Se retira si en dos meses nadie sigue ninguna.
- **No cambia la superficie por defecto** (GOV-02): está oculta mientras está apagada.
- Una línea en Novedades. Estilos en `calma.css`, la hoja de las tarjetas de Cartera.

## 4. Lo que no hace este PR-1

- **«Aportación pendiente»**, la primera regla de la ficha. Exige comparar lo aportado con el plan de aportación (NIN-04), que no existe.
- **La barra «objetivo frente a actual»**, las posiciones como tarjetas en el móvil y el *sparkline*. Para un PR-2, solo si la tarjeta se usa.
- **Que la banda de la política gobierne la herramienta de Rebalanceo** (IV6 sigue con 10 puntos). La tarjeta usa la banda de la política solo si está firmada.
- **Probarla con la política real del hogar:** nadie ha firmado la suya (H-12, 18/12). Hasta entonces la deriva usa el reparto de Rebalanceo, si lo hay, y la primera «otra cosa pendiente» será firmar la política.

## 5. Pruebas

- `tests/wp17-siguiente-paso.test.cjs` (8):
  - sin posiciones, nada;
  - el orden fijo;
  - la deriva con política (aportar, nunca vender) y sin ella (vender con aviso fiscal);
  - la fiscal solo en su ventana y con sus condiciones;
  - los estados de la política;
  - la convicción;
  - «nada pendiente» dice qué ha mirado;
  - la tarjeta nace apagada, no escribe y el motor es puro.
- E2E «WP-17 · Siguiente paso de la cartera» a 390 px (también en Safari) y 1280 px:
  - apagada no sale;
  - encendida, «Vended unos 2.000 € de fondos» con su motivo y la política como otra cosa pendiente, sin desbordar;
  - con una posición sin valorar desde agosto, manda valorar y el botón abre la hoja.
