# WP-45 · Frescura por fuente y cola de tareas por valor — diseño

Paquete del plan definitivo (ND-09 + CAP-07, Ola 3, ≈ 3,5 sesiones). **Primera entrega el 10/10/2026.** Estado: **en curso**. Están las seis fichas de frescura y la cola ordenada por «euros de incertidumbre por minuto»; **el modelo de «euros de incertidumbre» es mío, no existía** (§3), solo cubre tres de las cinco tareas, y la mayoría de los tiempos son supuestos sin medir.

## 1. Qué hace

La tarjeta **«Frescura de tus datos y qué hacer primero»** al final de **Registrar › Saldos** (`datos-ui.js`, `datos.css`; motor puro `canonical-data-queue.js`; **no guarda nada**). Dos partes:

1. **Seis fichas de frescura** con **icono, texto y edad** (✓ al día · ◐ reciente · ⚠ antiguo · ? sin dato), no solo color: **saldos** (4 días), **último movimiento importado** (4 días), **valoración de la cartera** (35 días), **índices de referencia** (los que ya caducan, WP-13), **último cierre de mes** (al día si está cerrado el mes que acaba de terminar) y **cobros y cargos esperados sin responder**. Cada una lleva a la pantalla donde se arregla.
2. **La cola de tareas de datos**, ordenada por **incertidumbre que quitan por minuto que cuestan**: «Actualizar saldos · puede moverse hasta 1.577 € · 4.730 € por minuto · 20 s (sin medir: supuesto)». Arriba, qué hacer **con 3 minutos hoy** y cuánto de la incertidumbre estimada se quita. Lo que **no se sabe estimar va aparte, «Sin estimar», con su motivo** (cartera, índices) y las tareas **con plazo** (cerrar el mes, solo los días 1-3) no se ordenan por euros.

Nunca hace una tarea ni cambia un dato (A11-4): son enlaces a la pantalla.

## 2. Reglas del motor, con prueba (`tests/wp45-cola-datos.test.cjs`, 12 pruebas)

- **Lo no estimable no se ordena con un euro inventado.** Una tarea sin incertidumbre estimable va a «Sin estimar» con el motivo; nunca con 0.
- **El tiempo es el medido (mediana de ≥ 3 usos) o un supuesto marcado «sin medir».** Hoy solo hay tiempos medidos para el pulso de saldos y la hoja de valoración; el plan avisa si usa algún supuesto.
- **Dos tareas que resuelven lo mismo no suman dos veces:** por familia cuenta solo la mayor. Importar el extracto pone también al día el saldo (lo absorbe); si el pulso de 20 s ya quita más de lo que quitaría el extracto, el extracto no entra en el plan.
- **«Hoy mismo» es un dato (0 € posibles), no un hueco.** Sin gasto medio o sin fecha no hay estimación (`null`), no 0.
- Motor puro: sin DOM, red, almacenamiento ni reloj.

## 3. Dónde se aparta del plan, y por qué

| El plan decía | Lo entregado | Por qué |
|---|---|---|
| «La sensibilidad ya se calcula (`canonical-forecast-sensitivity.js`); falta convertirla en cola» | **Un modelo nuevo y mío** | `canonical-forecast-sensitivity.js` dice **qué caída de ingresos o subida de gasto rompería el veredicto** de caja; no dice cuánto se mueve una cifra por un dato viejo. Hubo que definir la incertidumbre: **gasto diario medio de la previsión × días sin actualizar, con tope de 30 días**. Es una estimación, rotulada «puede moverse hasta» |
| Cola con **cuatro tipos de tarea** (saldo, 6 pendientes, día de cargo, valorar la cartera) | Saldos, extracto y cobros/cargos esperados con euro; **cartera e índices «sin estimar»**; el día de cargo, no | Cartera: no hay volatilidad medida (hacen falta ≥ 3 valoraciones y modelarla). Índices: la incertidumbre es la cuota de la hipoteca, y faltan los datos del contrato (H-07). Día de cargo: afecta al día del mínimo, no al fin de mes |
| «Presupuesto visible: Esta semana: 4 de 10 min» | **«Con 3 minutos hoy»** | Contar los minutos ya empleados exige enlazar con el panel de uso (WP-03). No está |
| «La cifra pasa de confianza media a alta» | No | La app no tiene un nivel de confianza que subir |
| «Cada tarea con su tiempo estimado **medido**, no inventado» | **Medido donde existe; supuesto marcado donde no** | Importar el extracto y responder cobros no tienen medición: 2 min y 10 s por cobro son supuestos míos y lo dice cada fila |
| «Fichas en el centro de Datos» | **Al final de Registrar › Saldos** | **No existe una pantalla «Actualizar mis datos»**: su hash (`#update-hub`) redirige a Registrar › Saldos. La primera colocación (en esa pantalla) la dejaba **invisible** y se detectó al probarla en el navegador. Registrar es donde se actualizan los datos, y Saldos su pestaña por defecto; la tarjeta va **debajo** del pulso para no alargar la tarea de 20 s |
| «Saldo **de cada cuenta**» | Una ficha de **saldos** con la fecha de la foto | La app guarda una sola fecha de saldos, no una por cuenta |
| «Un toque lleva a la acción exacta» | Lleva a la **pantalla**, no al campo | — |
| Éxito: «el 80 % del error de previsión atribuible a datos viejos se elimina con ≤ 5 min/semana» | **No se puede medir** | Exige atribuir el error del backtest (WP-12) a cada dato viejo; no hay con qué |

## 4. Riesgos y decisiones a cuestionar

1. **El orden lo decide el tiempo supuesto.** Con 20 s para el pulso y 2 min para el extracto, el pulso sale casi siempre primero por construcción, no porque se haya medido. Hasta que haya ≥ 3 usos medidos de cada tarea, **el orden refleja mis supuestos**.
2. **El modelo trata todos los días como iguales** y no mira ingresos: un hogar con cobros concentrados un día puede tener más incertidumbre un día concreto. «Puede moverse hasta» es una cota gruesa, no una probabilidad.
3. **«Incertidumbre» no es «error esperado».** Un saldo de hace 10 días «puede moverse hasta 1.577 €» no quiere decir que se haya movido 1.577 €. El texto lo dice; la cifra sigue siendo la más fácil de leer mal.
4. **Con cinco tareas, la «cola» es casi una lista.** El valor de ordenar por euros por minuto crece con el número de tareas y de fuentes; hoy hay tres estimables.
5. **Una ficha que dice «al día» no prueba que el dato esté bien**, solo que es reciente. El saldo de ayer puede estar mal tecleado.
6. **La ficha de índices usa el umbral más corto de los tres** (10 días del €STR) para pintar el tono; un Euribor de hace 20 días, vigente para su plazo, se ve «antiguo» porque el índice conjunto lo es.

## 5. Pendiente

- Estimar la **cartera** (volatilidad medida con ≥ 3 valoraciones, WP-44) y los **índices** (rango de la cuota, WP-20 con H-07).
- **Medir** el tiempo de importar el extracto y de responder un cobro (hoy supuestos).
- **Presupuesto semanal** enlazado con el panel de uso (WP-03).
- Una fecha de saldos **por cuenta**.
- Llevar la tarea de arriba a Hoy, **tras H-02**.
