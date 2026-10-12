# WP-34 · Revisión base cero del plan — diseño

**Estado:** entregado como «en curso» (50 %). **Fuente:** `PRV-08` (`docs/PROPUESTA_SEXTA_AUDITORIA_2026-10-03.md`), `docs/PLAN_DESARROLLO_DEFINITIVO.md` (WP-34).
**El repositorio es público: ningún dato real del hogar aquí.** Los ejemplos son inventados.

## 1. Qué pedía el plan

«Una partida por pantalla con sus 12 meses de real: **mantener · ajustar a lo real · eliminar**; progreso y guardado parcial. Marca **«revisada (fecha)»** por partida (campo nuevo en `customPlanningRows` → migración del contrato de estado).» Se usa en enero (≈ 15 min del hogar).

## 2. Qué se ha construido

- **Plan › Partidas, tarjeta plegable «Revisión base cero del plan: N de M partidas revisadas»** (`base-cero-ui.js`, `base-cero.css`; motor puro `canonical-zero-base.js`).
- **Una partida por pantalla**, empezando por **las que más pesan** (suma de lo previsto en los próximos 12 meses): su nombre, lo previsto hoy, **una frase con la evidencia** («4 de los últimos 6 meses con real: mediana de 705 € al mes, entre 690 € y 742 €»), la tabla de reales por mes y los botones **Mantener como está · Ajustar a X € al mes · Quitar la partida · Saltar por ahora**.
- **Guardado parcial:** cada decisión se guarda **al momento** (almacén `zero-base-data`, en la copia y la nube); se puede dejar y seguir otro día. «Ya revisadas (N)» lista lo hecho con su fecha y su estado, y **«Revisar de nuevo»** quita la marca.
- **La marca «revisada (fecha)» vale un año**: pasados 365 días la partida vuelve a «toca».

## 3. Decisiones y desviaciones (lo que hay que cuestionar)

1. **Esta pantalla NO escribe en el plan.** «Ajustar» y «Quitar» **preparan** el cambio en el borrador que ya usa Plan › Partidas (`visualDraftCells` / `visualDraftDeletes`); lo aplica el **«Guardar» de siempre** (con su «Descartar»). La tarjeta enseña un aviso con los cambios preparados y sus dos botones. Razón: borrar y reescribir importes de 36 meses es lo más destructivo que hace la app; no quiero un segundo camino de escritura. Coste: un paso más. **Consecuencia que conviene saber:** tras guardar un borrado no hay «deshacer» (el flujo de Partidas no lo tiene); solo se recupera dando de alta la partida de nuevo.
2. **La marca vive en un almacén propio, no en `customPlanningRows`** (el plan pedía un campo nuevo y migrar el contrato de estado). Dos razones: la mayoría de las partidas **no son** `customPlanningRows` (vienen de los datos base), así que el campo no las cubriría; y WP-08, WP-09 y WP-24 ya optaron por almacenes aparte «sin migrar el contrato de estado» por riesgo. Viaja igual con la copia y la nube. Si algún día hace falta que la marca viaje dentro del estado canónico, es una migración que sigue pendiente.
3. **«12 meses de real» son los meses del plan que ya han pasado, hasta 12.** La demo empieza en julio de 2026, así que en enero de 2027 hay 6; el hogar real tendrá los que lleve anotando. **Y solo hay «real» si se anotó** (Registrar › Reales del mes o el extracto): con el hábito actual, **en enero habrá, como mucho, octubre, noviembre y diciembre**. La tarjeta lo dice («Solo hay reales anotados en N de los últimos M meses: casi ninguna partida tendrá una propuesta»). **Honestamente: la revisión de enero de 2027 será sobre todo «mantener» y «¿sigue existiendo?» salvo que se anoten los reales de aquí a entonces.**
4. **«Ajustar a lo real» es conservador a propósito** (todos los umbrales son míos, sin validar):
   - **≥ 3 meses con real**; cifra única = **mediana** (un mes raro no manda), redondeada al euro;
   - solo si **el hueco es ≥ 10 % y ≥ 10 €** (si no, «ya está en línea»);
   - solo si la partida tiene **el mismo importe todos los meses por venir**: una partida que cambia de un mes a otro (un pago anual, un contrato que acaba) **no se aplana**; se dice y se remite a la tabla;
   - se aplica a **todos los meses por venir y abiertos** de esa partida (no a los pasados: `cuadroMandosStageCell` rechaza meses cerrados).
5. **«¿Sigue existiendo?» solo con evidencia:** la partida no tiene ningún real en ≥ 3 meses en los que el hogar **sí** anotó otras partidas, y su previsto es > 0. Sin reales anotados en general no se pregunta (no se sabe). Efecto colateral que no me gusta: un **ingreso** que nadie anota también sale con este aviso.
6. **Partidas que manda otra cosa: solo «Mantener».** La fórmula del gasto variable, la asignación personal, un escenario guardado, una fila que se liquida con tarjeta y la refinanciación que sigue su calendario de deuda. Se dice quién las manda. (La detección de la deuda usa `adjustedDebtPlannedValue`, que hoy solo conoce una refinanciación: **otras filas de deuda no se bloquean**; es un hueco.)
7. **Lo que no tiene nada que revisar no entra:** una partida sin importe previsto en ningún mes por venir **y** sin ningún real (en la demo, 21 de 29 son filas de financiación a 0) se cuenta aparte; una partida que ya no existe en ningún mes por venir tampoco.
8. **Se ha corregido sobre la marcha** un defecto de maquetación: la tabla genérica pide 1.120 px de ancho mínimo y empujaba el contenido de la tarjeta fuera de la pantalla del móvil (el mismo defecto de WP-53; el e2e de desborde de página no lo vio porque el contenedor recortaba: ahora el e2e mira que **ningún elemento de dentro se salga de la tarjeta**). Y axe pilló un salto de encabezados (h4 tras h2): ahora es h3.

## 4. Lo que NO se hace

- **No revisa proyectos, decisiones de deuda ni escenarios**, solo las partidas del plan (ingresos y gastos).
- **No propone por categoría ni por persona**, ni compara con otros hogares.
- **No recuerda sola que toca** (WP-32 podría poner «enero: revisión base cero» en el calendario; no se ha hecho).
- **No va a Hoy** (congelado hasta H-02).

## 5. Qué falta para subir del 50 %

1. **Que el hogar haga la revisión de verdad** (el criterio del plan: «cada partida revisada con fecha; se usa en enero»). Hoy no se ha hecho ni una vez con datos reales.
2. **Reales anotados** (al menos 3 meses): sin ellos la herramienta casi no propone nada.
3. Calibrar los umbrales (10 % / 10 € / 3 meses / mediana) con una revisión real, y decidir si el aviso de «¿sigue existiendo?» debe excluir los ingresos.
4. El 50 % **sobrepuntúa** (≈ 0,75 de 1,5 sesiones).
