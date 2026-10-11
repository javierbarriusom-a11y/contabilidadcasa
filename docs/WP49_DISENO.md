# WP-49 · Mapa anual de pagos grandes — diseño

Paquete del plan definitivo (NPV-04, Ola 3, ≈ 2,5 sesiones). **Primera entrega el 11/10/2026.** Estado: **en curso**. Está la franja de 12 meses con los pagos grandes y su financiación **donde existe dinero reservado de verdad (los objetivos)**; **no está «la financiación por sobre»** que decía el plan, porque esa financiación no existe en la app (§3).

## 1. Qué hace

La tarjeta **«Mapa anual de pagos grandes»** en **Plan › Previsión**, bajo el puente de previsión (`mapa-pagos-ui.js`, `mapa-pagos.css`; motor puro `canonical-large-payments.js`). **No tiene almacén propio**: solo lee y pinta. No reserva ni mueve dinero (A11-4).

1. **Cuatro fuentes, las que ya existen**, para los 12 meses que empiezan este mes:
   - **Partidas del plan de gastos** que pesan de golpe (IBI, colegio, vacaciones, una derrama): se excluyen las financiaciones (son de Deuda) y el gasto variable (día a día).
   - **Seguros del inventario**, en cada aniversario (prima declarada; sin prima, importe «sin determinar»).
   - **Objetivos con fecha** (huchas): el coste es el importe objetivo y lo reservado, lo ahorrado.
   - **Campaña de la Renta**, del calendario financiero (E15): sin importe, como allí.
2. **Una franja de 12 meses** (rejilla de «múltiplos pequeños», una tarjeta por mes) con el total del mes y, por pago, una **barra** cuyo ancho es el coste frente al pago más caro del año y cuyo relleno es lo reservado. **Etiquetado directo** (nombre e importe junto a la barra); **tocar un pago abre el detalle** (origen, día, reservado, cuánto apartar al mes).
3. **Estado de financiación en texto + icono + patrón**, nunca solo color: «✓ Financiado» (barra llena), «% Reservado N %» (relleno + rayado), «○ Sin reserva asignada» (rayado discontinuo), «○ Objetivo sin ahorrar aún» (punteado), «? Importe sin determinar» (discontinua, sin relleno).
4. **Resumen:** lo que suman, lo reservado, lo que falta, **cuánto apartar al mes** para llegar a los pagos sin tocar la caja (lo que falta de cada uno entre los meses que quedan) y lo que **vence este mes** sin cubrir. Frase automática y «Ver como tabla».
5. **El mínimo para llamar «grande» a un pago** es un menú (300 / 500 / 1.000 / 2.000 €) que vale solo en la sesión.

## 2. Reglas del motor, con prueba (`tests/wp49-mapa-pagos.test.cjs`, 11 pruebas)

- **Pago grande del plan:** llega al mínimo **y** es ≥ 2,5 veces la **mediana** de esa misma partida en la ventana (los meses sin importe cuentan como cero). Una cuota de 750 € cada mes no lo es; 900 € en tres meses, un pico de 320 € sobre una base de 100 €, o una partida de un solo mes, sí; cambiar de nivel (200 → 600) no.
- **Seguros:** si la renovación declarada es futura y cae en la ventana, va tal cual; si ya pasó, **se proyecta cada año y se marca «estimado»**; una renovación declarada para más allá de la ventana no se proyecta hacia atrás; el 29 de febrero cae el 28; el aniversario de este mes que ya pasó no cuenta; sin fecha válida no se coloca (se dice).
- **Objetivos:** reservado = ahorrado (nunca más que el coste); fecha vencida y sin completar → se coloca en el primer mes marcado «fecha vencida»; en pausa o completo, fuera; sin fecha o sin importe, no se coloca (se dice). **El fondo de emergencia queda fuera** (la pantalla filtra el tipo): es un colchón, no un pago.
- **Un pago, una vez:** una partida del plan que es el mismo pago que un seguro o un objetivo del mismo mes (mismo nombre, o importe a menos de un 2 %) se fusiona y se queda el que trae más información. Hacienda no absorbe partidas.
- **Desconocido no es cero:** un pago sin importe se muestra, no suma y se cuenta aparte.
- **Financiación:** «sin importe», «sin reserva» (no hay dinero declarado), «parcial» (el porcentaje se redondea **hacia abajo**: nunca 100 % sin estar completo) o «financiado»; si vence este mes no hay meses que repartir y no se propone ahorro mensual.
- **Propiedad (200 hogares al azar):** los meses suman el total; lo reservado no pasa del coste; nada fuera de la ventana; ningún pago repetido; mismo resultado con la misma entrada; la entrada no se modifica (congelada). **Caso de oro a mano** (8 pagos, 16.130 €, 9.700 € reservados, 60 %; los tres meses más cargados concentran el 88 %; 1.102,50 €/mes por apartar y 2.700 € que vencen ya). Motor puro: sin DOM, red, almacenamiento ni reloj.

## 3. Dónde se aparta del plan, y por qué

| El plan decía | Lo entregado | Por qué |
|---|---|---|
| «Su nivel de financiación por **sobre** (`financialCalendar` y sobres)» | **Financiación solo de los objetivos con ahorro declarado**; el resto, «sin reserva asignada» | **Los sobres de la app no son fondos de pagos grandes**: son el sobrante mensual de cada partida de gasto variable, que se arrastra o se liquida al cerrar (Fase 6, P-14/P-15). No hay en ningún sitio «dinero guardado para el IBI». Mostrar un «0 % financiado» sería inventarlo. Para financiar de verdad cada pago hace falta un concepto nuevo (**fondo por pago**, con su saldo y su movimiento), que es una **decisión del hogar** y tocaría el cierre |
| «Reutiliza `financialCalendar`» | Se reutiliza **solo para la Renta**; seguros y objetivos se leen directamente | `financialCalendar` coloca un seguro solo si su renovación cae **exactamente** en ese mes: pasada la fecha declarada, no vuelve a salir hasta que alguien la edite. Un mapa a 12 meses necesita el aniversario. Los objetivos, además, necesitan lo ahorrado, que el calendario no trae |
| «Pagos grandes (seguros, impuestos locales, colegio, vacaciones, Hacienda)» | Los detecta por **«pesa de golpe»** (mínimo y 2,5 × la mediana) | La app no tiene un campo «pago anual» ni «pago grande»: lo único honesto es mirar el plan. Los umbrales son **míos** (300 € y 2,5), declarados y el mínimo ajustable |

## 4. Decisiones mías y riesgos a cuestionar

1. **El mapa depende de que el plan sea fiel.** El plan se repite cada año con lo previsto del mismo mes (convención de la app). Si el IBI no está en el plan, o está en el mes equivocado, no sale; **lo que no está en el plan, en un seguro o en un objetivo, no existe en el mapa**.
2. **Los umbrales (300 €, 2,5 × la mediana) no están calibrados con datos reales.** Pueden dejar fuera un pago de 280 € o sacar como «grande» un pico de 320 €. Es el primer punto que hay que mirar con el plan real del hogar.
3. **«Apartar al mes» es lineal y simplista:** lo que falta de cada pago entre los meses que quedan, sin mirar si el hogar tiene ese margen. Con muchos pagos próximos sale una cifra grande (en una prueba con seis pagos, ≈ 1.875 €/mes). **No se compara con la capacidad de ahorro**: sería el siguiente paso, y es una decisión de prioridades.
4. **Una partida del plan y un seguro que son lo mismo con nombre e importe distintos se cuentan dos veces** (la fusión pide nombre parecido o importe a menos de un 2 %).
5. **Los objetivos con «financiación por deuda» o «por ingreso» también cuentan lo ahorrado como reserva**; el estado no distingue la fuente.
6. **No cuenta lo ahorrado en posiciones de cartera vinculadas a un objetivo** (`fundingPositions`): solo las aportaciones al objetivo. Subestima la reserva si el hogar financia objetivos con cartera.
7. **La Renta aparece siempre sin importe** (no hay estimador que deje un resultado guardado: el de Ajustes es una calculadora manual). Es cierto y poco útil hasta que haya una estimación.
8. **No se puede marcar «esto no es un pago grande»**: sin almacén, un falso positivo se ve siempre. Se puede subir el mínimo, pero no ocultar uno.
9. **No está en Hoy** (congelado hasta H-02).

## 5. Pendiente

- Decidir si el hogar quiere **fondos por pago** (financiar IBI, seguros y colegio con un saldo propio): sin eso, la financiación sigue siendo solo de los objetivos.
- Comparar «apartar al mes» con la capacidad de ahorro; incluir la cartera vinculada a un objetivo; ocultar un falso positivo (almacén); calibrar los umbrales con el plan real; estimación de la Renta; proyectar los pagos hacia el calendario de recordatorios.
- Del hogar: **revisar el mapa con su plan real** y decir qué pagos faltan, cuáles sobran y en qué mes caen de verdad.
