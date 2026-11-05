# Octava auditoría · previsiones, escenarios y su visibilidad (5/11/2026)

**Petición del hogar (5/11/2026):** «Analiza la app de manera crítica […]. Hazme una propuesta de mejoras y nuevas
features […] con el máximo detalle y con las mejores prácticas de UX y UI. Tienen que ir en el sentido de usabilidad
y mejora de la visibilidad de las previsiones, estado e impacto de forecasts financieros en función de diferentes
escenarios. El backlog que tenemos actualmente lo conservamos y lo incorporamos con la prioridad adecuada dentro del
nuevo plan. Será el backlog de noviembre oleada 1».

**Qué es este documento:** el porqué. El análisis crítico (§1-§3), los principios (§4) y la especificación de cada
propuesta nueva, con IDs `FX-nn` (§5-§11). La prioridad que se da a cada una (P0 = núcleo de la Oleada 1, P1 = Oleada 2,
P2 = con disparador de datos, P3 = catálogo) es la del backlog; si alguna vez discrepan, manda el backlog. **El orden, las fechas y la integración con todo lo que ya estaba en el
backlog viven en [`BACKLOG_NOVIEMBRE_OLEADA_1.md`](../BACKLOG_NOVIEMBRE_OLEADA_1.md)**, que pasa a ser el único
backlog vivo. Mismo reparto que la quinta, sexta y séptima auditoría: propuesta aquí, prioridad allí.

**El repositorio es público.** Todas las cifras de este documento son de los **datos de demostración** (hogar
inventado, reloj fijo el 5/11/2026), nunca del hogar.

**Método:** app construida en local (`npm run build:site`), recorrida con Chromium a 1440 × 900 y a 390 × 844 con la
demo; lectura del código de los motores de previsión y escenarios (`canonical-forecast*.js`, `canonical-cash-band.js`,
`canonical-scenario-*.js`, `canonical-e13-scenarios.js`, `canonical-mortgage-rate-scenarios.js`,
`canonical-contingency-plan.js`, `app.js`), de `docs/rediseno/` (ESTADO, HANDOFF y las referencias `Prevision*.png`)
y del backlog vigente hasta hoy (`BACKLOG_DEFINITIVO.md` y la séptima auditoría).

---

## 1. Conclusión en cinco líneas

1. **El problema no es que falten motores de previsión: sobran verdades.** Para «¿cuánto dinero tendremos?» la app da
   cuatro cifras de tres motores distintos, con dos unidades y sin decir cuál manda (§2, H1). En un producto de
   previsión, eso es lo primero que destruye la confianza.
2. **Lo mejor que se ha construido no se ve.** La banda de caja, las tres capas, la calidad del dato, el acierto, el
   puente y el plan B existen, pero viven plegados o en otras pantallas. Lo que se ve primero es lo más pobre (H2).
3. **Los escenarios están desconectados de la previsión.** Hay al menos siete motores o pantallas de «¿y si…?», y
   ninguno se puede ver encima de la previsión del plan. Comparar exige dos escenarios guardados (H3).
4. **La incertidumbre se cuenta en jerga estadística y con falsa precisión** (P10, 500 trayectorias, «207 %»,
   céntimos a 30 días) y cubre solo las fechas, no los importes (H4).
5. **Mi recomendación, que va contra el instinto de «más funciones»:** la oleada empieza por **coherencia y
   visibilidad** (una sola verdad, una sola pantalla de previsión, escenarios superpuestos) y no por motores nuevos.
   Los motores que faltan (incertidumbre de importes, sesgo, calibración) no pueden dar fruto antes de febrero de 2027,
   porque necesitan cierres de mes que todavía no existen.

---

## 2. Hallazgos (con evidencia)

### H1 · Cuatro cifras, tres motores, dos unidades para la misma pregunta — **gravedad crítica**

Con la demo, el 5/11/2026:

| Dónde | Qué dice | Motor | Unidad real |
|---|---|---|---|
| Hoy | «Disponible hasta cobrar **8.580 €**» y «Fin de noviembre **8.850 €**» | motor diario (`home-margin`) | **margen sobre el suelo** de 1.500 €, aunque la etiqueta «Fin de noviembre» se lee como saldo |
| Plan › Previsión, titular | «El punto delicado es nov 26 · Cae a **5.350 €** el **01 nov 26**, antes de los cobros del mes» | motor mensual (`previsionMetric`) | saldo, con el mínimo **siempre en el día 1** (`app.js`, `minDateLabel: dateWithMonthLabel(monthDate, 1)`) |
| Plan › Previsión, banda de caja | 30 nov «según el plan» **10.350 €**; mínimo probable el 5 dic | Monte Carlo diario (`canonical-cash-band.js`) | saldo |
| Tira de cifras de cabecera | «Colchón más justo · nov 26 · **2,4 meses**» | motor mensual | meses de gasto |

Tres defectos concretos:
- **Fecha pasada.** El 5/11 la app anuncia una caída «el 01 nov», que ya pasó. El motor mensual asume que todo el gasto
  previo al cobro sale el día 1. Como heurística prudente sirve, pero no como titular con fecha.
- **Diferencia de ~4.500 € entre motores.** Para los primeros días de noviembre, el mensual dice 5.350 € y el diario,
  unos 9.800 €. No hay ningún texto que explique cuál manda ni por qué difieren.
- **Margen y saldo con la misma forma.** «Fin de noviembre 8.850 €» (Hoy) y «30 de noviembre 10.350 €» (banda) son el
  mismo dato: uno restando el suelo y otro sin restarlo. La persona usuaria no tiene forma de saberlo.

Por qué es crítico: en finanzas personales, la confianza en la cifra es el producto (lo dicen las guías de diseño de
apps de dinero y lo dice este repositorio desde la quinta auditoría). Una sola discrepancia vista basta para que se deje
de mirar la previsión.

### H2 · Lo que más vale está plegado; lo que se ve primero es lo más pobre — **alta**

Plan › Previsión con la demo (1440 × 900): **3,8 pantallas** de alto. Tras el titular, cuatro tarjetas `<details>`
cerradas: banda de caja, calidad de los datos, tres capas y acierto. Lo primero que se ve abierto es:
- un **gráfico de barras sin eje ni cifras** (cajas verdes flotantes, «cada barra va del mínimo antes de cobros al
  máximo tras cobros»);
- una **tabla de 12 meses** que en el móvil solo enseña la columna «Mes» (ingresos y gastos quedan fuera);
- la frase «el ingreso previo a nómina aguanta caer hasta un **207 %** (hasta **−5.350 €**)», que no significa nada
  para una persona.

En el móvil (390 px), además: «Fecha 05/11/202» y «12.400 €» cortados en las tarjetas; las etiquetas del eje X se
pisan («NOV 26DIC 26ENE 27FEB 2…»).

Lo construido y escondido (todo funciona): banda de caja diaria P10-P90 (WP-16), «qué mueve cada día» (XPR-06, tras su
interruptor), el arreglo más barato (XPR-07, tras su interruptor), tres capas e ingresos con certeza (WP-35), calidad
(WP-10), acierto (WP-12), puente de por qué cambió el fin de año (WP-43, **en otra pantalla**, `#plan`), plan B
(WP-38, **en otra pantalla**), mapa de pagos grandes (WP-49, **en otra pantalla**).

### H3 · Siete «¿y si…?» y ninguno encima de la previsión — **alta**

| Motor o pantalla | Dónde vive | Qué hace |
|---|---|---|
| Motor unificado E20 (`canonical-scenario-engine.js`, 16 tipos de decisión) | Escenarios › Simular / Guardados / Comparar | decisiones sobre deuda, ingresos, gastos, compras, proyectos e imprevistos |
| Laboratorio E13 (`canonical-e13-scenarios.js`) | «Simulación de nueva vida» (Herramientas avanzadas) | perfiles Base · Favorable · Tensión y 7 eventos (pérdida de ingreso, caída de mercado…) con probabilidad |
| Simulador de decisiones (`#simulator`) | Herramientas avanzadas | «con proyectos · sin proyectos» hasta 2036 |
| Sensibilidad PV6 (`canonical-forecast-sensitivity.js`) | frase bajo el gráfico de Previsión | «aguanta caer un 207 %» |
| Hipoteca variable/fija (`canonical-mortgage-rate-scenarios.js`) | Deuda | tres escenarios de tipos |
| Plan B (`canonical-contingency-plan.js`, WP-38) | `#plan` | disparador, acciones y palanca de recorte |
| Patrimonio a tres escenarios (WP-46) | Patrimonio | abanico de patrimonio neto |

Consecuencias que se ven en la demo:
- La barra lateral dice «Escenario activo: **Base**», pero cambiar de escenario no cambia lo que enseña Previsión.
- Escenarios › Simular abre con un formulario («Tipo de decisión», «Deuda», «Importe»…) y un gráfico de una sola línea
  sin eje Y. El texto de entrada habla de «Motor unificado (E20) conectado a la interfaz, con trece tipos de decisión».
  Es la vista de quien lo construyó, no de quien decide.
- Comparar dice «Hacen falta al menos dos escenarios guardados»: no se puede comparar **el plan con una idea**, que es
  el caso de uso del 90 % de las veces.
- No hay ninguna prueba de estrés lista para usar sobre los riesgos reales del hogar (hipoteca variable con revisión
  pendiente, dos nóminas, un local alquilado, cartera con Lombard), aunque el motor E13 ya sabe modelarlos.

### H4 · La incertidumbre se cuenta mal — **media-alta**

- «Banda P10-P90», «500 trayectorias simuladas», «Mediana (P50)»: términos de analista. La persona usuaria necesita
  «rango probable» y «peor caso razonable».
- La tabla de la banda da **céntimos a 30 días** («9.612,69 €»): precisión falsa. A un mes vista, la décima de euro es
  ruido; a 12 meses, la centena también.
- La banda solo recoge la **incertidumbre de las fechas**, no la de los importes. La app lo dice en letra pequeña
  («la banda no cubre un gasto que salga más caro de lo previsto»), pero el gráfico transmite más seguridad de la que
  tiene. Con el 100 % del gasto con fecha estimada (demo), la banda es ancha en el día y estrecha en el importe: al
  revés de lo que pasa en un hogar.
- La sensibilidad sale en porcentajes por encima del 100 % y en importes negativos.

### H5 · No hay «qué ha cambiado» — **media-alta**

Un hogar mira la previsión para saber si va mejor o peor que la semana pasada, y por qué. El puente (WP-43) lo explica
solo para el 31/12 y vive en otra pantalla. No hay ninguna lectura de «desde tu última visita, el punto más bajo de los
próximos 90 días ha bajado 300 €: 200 € por un recibo nuevo y 100 € porque la nómina llega dos días más tarde». Las
herramientas profesionales de previsión (FP&A) llaman a esto *variance bridge* y es la pieza que hace que se vuelva.

### H6 · Nueve sitios responden a «¿qué viene?» — **media**

Previsión, Previsión mensual, Proyección (`#forecast`), Análisis de previsión, Mapa de calor, Cuadro de mandos,
Simulador de decisiones, Plan (puente, plan B, mapa de pagos) y Escenarios. La barra lateral tiene unas 55 entradas en
«Herramientas avanzadas» y una sección «Versiones anteriores» visible. La navegación de cinco destinos (XUX-01) sigue
pendiente.

### H7 · Los supuestos no se ven — **media**

La proyección hasta 2036 depende de supuestos (Euribor, IPC, subida de sueldo, rentabilidad esperada de la cartera,
inflación del gasto, probabilidad de la paga variable, renta del local). Están repartidos por Ajustes, Deuda e
Inversión. Ninguna pantalla de previsión dice «con estos supuestos» ni «si este supuesto cambia un punto, el fin de
2027 cambia tanto».

### H8 · El contexto que manda sobre todo lo anterior

- **Construido 65 %, comprobado 0 %** (panel, 4/11). Ninguna métrica de previsión se ha leído con datos reales.
- **Calidad del dato de la previsión: 0 % del gasto con día conocido** (objetivo ≥ 70 %, WP-10), demo. El acierto
  necesita 3 cierres comparables: no habrá ninguna cifra de error antes de **febrero de 2027**.
- **Un solo usuario.** Cada función nueva compite por los mismos ≤ 10 min/semana (GOV-01).

**Lectura crítica:** si la oleada se dedica a construir motores más sofisticados (incertidumbre de importes,
corrección de sesgo), se repetirá el patrón «construido, no comprobado». La palanca de visibilidad más barata no es
de código: es que el hogar confirme el **día de cargo de sus 10 partidas más grandes** (≈ 15 min, una vez). Eso solo
mueve la calidad de la previsión más que cualquier motor nuevo de esta oleada. Lo propongo como tarea del hogar H-35,
con prioridad P0.

---

## 3. Lo que ya está bien y hay que conservar

- **Honestidad del motor.** «Datos insuficientes (0 de 3 cierres)», «No invento una incertidumbre», «sin banda para lo
  probable». Es un rasgo diferencial: se mantiene en todo lo nuevo.
- **Reglas de color del rediseño:** azul previsto, tinta real, rojo solo regla rota; verde sólido solo para lo que se
  pulsa.
- **«Qué mueve el día»** (XPR-06) y **el arreglo más barato** (XPR-07): son exactamente el patrón correcto
  (explicación + acción). Hay que sacarlos de detrás de un interruptor y ponerlos en el centro.
- **Nada se ejecuta solo** (A11-4) y **las acciones que cambian el plan tienen paso de revisión** (decisión 6 del
  rediseño). Los escenarios superpuestos de esta propuesta son de solo lectura.
- **«Uno entra, uno sale»** comprobado por el CI (XGO-01). Esta oleada debe **bajar** titulares, no subirlos.

---

## 4. Principios de diseño para la oleada (vinculantes para cada `FX`)

1. **Una pregunta, una cifra, un motor.** Cada cifra de previsión tiene una definición única (qué mide, unidad, motor,
   fecha de referencia), y todas las pantallas la toman de ahí. Si dos pantallas enseñan la misma etiqueta, enseñan la
   misma cifra; si no, se llaman distinto.
2. **El gráfico es la pantalla.** En Previsión, el gráfico con su banda, su suelo y sus hitos es el protagonista, con
   eje Y legible, marca de «hoy» y etiquetado directo (sin leyenda que haya que cruzar).
3. **Real, previsto y escenario se distinguen por forma, no solo por color.** Real: línea de tinta continua hasta hoy.
   Plan: azul continuo. Escenario: azul **discontinuo** con su nombre al final de la línea. Rango: área azul clara.
   Suelo: rojo discontinuo. Funciona en blanco y negro y con daltonismo.
4. **Precisión según el horizonte.** < 30 días: a la decena de euro. 1-12 meses: a la centena. > 12 meses: al millar y,
   cuando hay rango, solo el rango. **Nunca céntimos en una previsión.** Las tablas de detalle conservan el euro.
5. **Lenguaje de decisión, no de estadística.** «Rango probable (8 de cada 10 casos)», «peor caso razonable», «aguanta
   aunque…». Lo técnico, en un «¿cómo se calcula?» plegado.
6. **Toda cifra de previsión dice cuánto se puede fiar** con una sola insignia (alta · media · baja) y lleva a la tarea
   que más la sube.
7. **Comparar siempre contra el plan.** Un escenario no se enseña solo: se enseña como diferencia con el plan, en el
   punto más bajo, en la fecha que importa y al final del horizonte.
8. **Detalle progresivo en tres niveles:** cifra y frase (1 s) → gráfico (10 s) → hoja con el desglose y la tabla
   (cuando se pide). Escritorio: panel derecho fijo; móvil: hoja inferior.
9. **Lo que no tiene datos no ocupa pantalla** (decisión 4 del rediseño), y donde falte el dato, «Ver cómo quedaría»
   con datos de ejemplo (XUX-02).
10. **Cero minutos nuevos a la semana.** Ninguna `FX` pide un dato periódico nuevo. Las que piden algo una vez lo dicen
    con su coste (XDA-01).

---

## 5. Bloque A · Una sola verdad (coherencia de cifras)

### FX-01 · Contrato de cifras de previsión y glosario con vuestras cifras — P0 · M (2 sesiones)

**Qué:** un módulo `canonical-forecast-contract.js` que declara cada cifra de previsión una vez:

| id | Etiqueta única | Definición | Unidad | Motor | Precisión |
|---|---|---|---|---|---|
| `saldo-previsto(d)` | «Saldo previsto el {d}» | liquidez total prevista al cierre del día d | € | diario (0-90 días) · mensual cosido (> 90 días, FX-03) | según horizonte |
| `margen-suelo(d)` | «Margen sobre el suelo el {d}» | saldo previsto − suelo | € | ídem | ídem |
| `disponible-hasta-cobrar` | «Disponible hasta cobrar» | mínimo de `margen-suelo` entre hoy y el próximo cobro | € | diario | decena |
| `punto-mas-bajo(h)` | «Punto más bajo de los próximos {h}» | mínimo de `saldo-previsto` en el horizonte h, con su fecha | € y fecha | diario/cosido | según horizonte |
| `colchon-meses(m)` | «Colchón en {m}» | saldo previsto a fin de m ÷ gasto mensual medio | meses | mensual | una décima |
| `fin-de-año` | «Fin de {año}» | saldo previsto el 31/12 | € | cosido | centena |

Todas las pantallas (Hoy, tira de cabecera, Previsión, Plan › Mes, Escenarios, carta del mes) toman etiqueta, valor y
formato de aquí. El glosario (XUX-05, absorbida) se genera del mismo contrato y explica cada cifra **con el valor del
hogar** («Disponible hasta cobrar: 8.580 € = el menor margen sobre el suelo de aquí al 8 nov»).

**Cambios visibles mínimos:** en Hoy, «Fin de noviembre» pasa a «Margen a fin de noviembre» (o enseña el saldo con el
margen debajo; lo decide el hogar, D-N4). En la tira de cabecera, «Colchón más justo» enlaza a su definición.

**Aceptación:** una prueba recorre la demo y los hogares sintéticos de WP-33 en 5 fechas y comprueba que **cada
etiqueta del contrato da el mismo valor en todas las pantallas donde sale**. Cualquier cifra de previsión pintada sin
pasar por el contrato rompe una prueba (búsqueda estática de etiquetas en `views/*.js` y `app.js`).

### FX-02 · El «punto delicado» nunca en una fecha pasada ni en un día inventado — P0 · S (0,5)

**Qué:** el titular de Previsión deja de usar el mínimo mensual con fecha fija en el día 1. Para los próximos 90 días,
toma `punto-mas-bajo` del motor diario (fecha real). Más allá, el mensual dice el mes, **sin día**. El mes en curso solo
cuenta desde hoy. Corrige la frase de sensibilidad: por encima del 100 %, «aguanta aunque no llegue ese ingreso»;
importes negativos, nunca.

**Aceptación:** con reloj el 5/11 la demo no enseña ninguna fecha anterior al 5/11 en el titular; prueba unitaria con
mínimo en el día 1, en el último día y en el mes siguiente; ninguna sensibilidad > 100 % ni importe negativo en el
texto.

### FX-03 · Una trayectoria cosida para todo el horizonte — P0 · M-L (3)

**Qué:** el motor diario manda en los primeros 90 días y el mensual a partir de ahí, arrancando del saldo diario del
día 90 (no de su propio cálculo). Invariante: **el cierre de cada mes del motor mensual = el saldo diario de ese último
día**, mientras los dos solapen. El gráfico enseña la costura («a partir de febrero, por meses») con un cambio de
trazo. Absorbe la parte de RD-COB2 que afecta a la previsión (estimar el siguiente cobro con el mismo mes del año
anterior) como entrada del motor diario.

**Aceptación:** invariante en `canonical-scenario-invariants.js` (o hermano) sobre la demo y los 5 hogares
sintéticos; diferencia ≤ 1 € en el solape; la e2e de Previsión comprueba que el titular y la banda dan la misma fecha
de mínimo.

### FX-04 · Precisión según el horizonte — P0 · S (0,5)

**Qué:** `moneyForecast(valor, horizonteDías)` en el contrato (FX-01), con las reglas del principio 4. Se aplica a
Previsión, banda, escenarios y Hoy. Las tablas «Ver como tabla» conservan el euro sin céntimos.

**Aceptación:** prueba unitaria de redondeo; ninguna previsión pintada con céntimos (barrido de las vistas con la demo).

---

## 6. Bloque B · La previsión, visible (Plan › Previsión C2, ampliada)

### FX-10 · Plan › Previsión con el diseño nuevo (C2), ampliada — P0 de la oleada · L (4)

Base: `PrevisionDesktop.png` y `Prevision.png` (se copia el diseño, nunca las cifras). Lo que añade esta propuesta a la
referencia va marcado con ➕.

**Escritorio (≥ 1024 px).** Las cifras del esquema y de la tabla de impacto de FX-20 son **ilustrativas**, inventadas
para enseñar la forma (como las de las referencias de Claude Design):

```
┌ Plan  [Mes] [Previsión] [Objetivos]          [3 m][12 m][24 m][Hasta 2036]  [Total · Por cuenta] ┐
│                                                                                                    │
│ ┌──────────────────── gráfico 2/3 ─────────────────────┐ ┌────── panel del día (fijo) ──────────┐ │
│ │ Punto más bajo de los próximos 3 meses               │ │ DÍA SELECCIONADO                      │ │
│ │ 7.100 € · el 5 dic        ➕[Confianza media ▸]      │ │ Viernes 5 dic          7.100 €        │ │
│ │ ➕ vs semana pasada: −300 € [por qué ▸]              │ │ rango probable 6.800 – 7.900 €        │ │
│ │  10k ┤ real ───●  plan ━━━━━  ➕escenario ┅┅ «Euribor+1» │ │ QUÉ LO MUEVE                          │ │
│ │   8k ┤        ░░░░ rango probable ░░░░                 │ │ Hipoteca            −750 €  cierta    │ │
│ │   6k ┤                                                 │ │ Seguro hogar        −310 €  ◷ estimada│ │
│ │ suelo ┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄ 1.500 €    │ │   ¿sabes el día? ▸                    │ │
│ │      hoy  ▲8 nov cobro  ▲1 dic IBI  ▲22 dic paga ➕hitos │ │ ➕ Con «Euribor +1»:  6.950 € (−150 €) │ │
│ │ ← → para moverte por los días · clic para fijar      │ │                                       │ │
│ └──────────────────────────────────────────────────────┘ └───────────────────────────────────────┘ │
│ ┌ De verdad libre este trimestre (XPR-08) ┐ ┌ Remedio más barato si el peor caso roza el suelo (XPR-07) ┐│
│ ┌ ➕ Comparar con: (Plan) (Euribor +1) (Un sueldo menos) (Imprevisto 3.000 €) (+ ¿Y si…?) ─────────────┐│
│ │  Mínimo 90 d · Fecha del mínimo · Fin de 2026 · Colchón en meses · ¿Baja del suelo? — plan vs escenario ││
│ └─────────────────────────────────────────────────────────────────────────────────────────────────────┘│
│ ▸ Lo que viene en 90 días (FX-12)  ▸ Tres capas (WP-35)  ▸ Acierto (WP-12)  ▸ Ver todo el detalle      │
└────────────────────────────────────────────────────────────────────────────────────────────────────────┘
```

**Móvil (390 px):** cabecera con el segmentado de horizonte en una fila con desplazamiento visible; cifra y frase; gráfico
a todo el ancho (alto 220 px, eje Y con 3 marcas a la izquierda dentro del área); los hitos como puntos bajo el eje;
tocar o arrastrar abre la **hoja inferior** del día (XPR-06) con el mismo contenido que el panel; «Comparar con» como
fila de chips desplazable; «De verdad libre» y el remedio apilados.

**Comportamiento:**
- **Horizonte** 3 m · 12 m · 24 m · Hasta 2036 (los de la referencia; hoy son 12 · 24 · 48 · 2036). 3 m: diario con
  rango; 12 y 24 m: diario cosido con mensual (FX-03); 2036: anual (FX-50). Se recuerda por dispositivo.
- **Panel del día:** hover para explorar y clic para fijar en escritorio; ← → por teclado; en móvil, tocar y arrastrar
  con vibración ligera al cruzar un hito (si el sistema lo permite y sin `prefers-reduced-motion`).
- **XPR-06 y XPR-07 dejan de ir tras su interruptor:** se gradúan dentro de C2 (o se quedan en prueba si el hogar los
  apaga el 12/11; decisión en su revisión).
- **Lo de siempre** (tabla mensual, resumen por periodo, tres capas, calidad, acierto, sensibilidad) sigue entero tras
  «Ver todo el detalle». Las tres capas, el acierto y lo que viene quedan como filas plegadas de una línea.
- **Estados** (WP-37): sin saldos declarados → la cifra lleva «saldos calculados» y el chip de frescura; sin movimientos
  → `Ver cómo quedaría` (XUX-02); suelo sin configurar → una línea «Fija tu suelo» que lleva a Ajustes.

**XGO-01:** Previsión no puede enseñar más titulares que hoy. Se esperan menos: los cuatro `<details>` y el resumen por
periodo pasan a filas plegadas o detrás de «Ver todo el detalle».

**Aceptación:** a 1440 × 900 la cifra, el gráfico y el panel del día se ven sin desplazar; a 390 × 844 la cifra y el
gráfico, también. Nada se corta a 320, 390, 1024 y 1440 px. e2e a 390 (`@safari`) y 1440, axe claro y oscuro, medidor
instrumentado (FX-62). «Plan nuevo» de Funciones en prueba incluye Previsión.

### FX-11 · Gráfico de previsión único (kit de gráficos, WP-28 desaparcado) — P0 · M (2,5, sobre WP-28)

**Qué:** un solo componente `chartForecast` en `chart-kit.js` que pintan Previsión, Hoy (en su versión mínima),
Escenarios y Patrimonio: real hasta hoy · plan · rango · suelo · hitos · escenarios superpuestos · marca de hoy ·
costura diario/mensual. Accesible por diseño: recorrido con teclado y táctil, **frase automática** («El punto más bajo
es 7.100 € el 5 de diciembre, 5.600 € por encima del suelo»), «Ver como tabla», `aria-live` al moverse por los días.
Recoge las trampas conocidas (`min-height` de `svg`, etiquetas en HTML superpuesto).

**Por qué ahora:** WP-28 se aparcó el 21/10 para «migrarlo con el rediseño de esas pantallas». C2 es esa pantalla.

### FX-12 · Lo que viene: los hitos del horizonte — P0 · M (2)

**Qué:** debajo del gráfico (plegado en una línea: «Lo que viene en 90 días · 9 pagos grandes · 2 sin día»), la lista
de movimientos ≥ un umbral (por defecto 150 €, editable) agrupados por semana, con su certeza (cierta · por regla ·
estimada) y «¿sabes el día?». En 12 m, la franja anual del mapa de pagos grandes (WP-49) se traslada aquí. Los mismos
hitos son los marcadores del gráfico.

### FX-13 · Previsión por cuenta y traspasos sugeridos (XPR-05, adoptada) — P1 · M (2,5)

**Qué:** conmutador «Total · Por cuenta». Por cuenta, una línea por cuenta con su mínimo operativo. Si una cuenta baja
de su mínimo con el total sano, la tarjeta de remedio propone «Traspasar 300 € de Mediolanum a CaixaBank antes del 21
nov · 0 €». Desbloquea el PR-2 de XPR-07 (traspasos). **Nunca ejecuta el traspaso** (A11-4).

### FX-14 · El mes en curso al ritmo real (XPR-04, adoptada) — P1 · M (2)

**Qué:** con movimientos importados del mes, la previsión del resto del mes usa el ritmo real del gasto variable (no el
previsto), con un límite de prudencia: «A este ritmo acabáis noviembre con 9.900 € (el plan decía 10.350 €)». Se ve en
Previsión y en Plan › Mes (BarraRitmo). Se apoya en la corrección ya hecha del «real parcial» del gasto variable.

### FX-15 · Resumen por periodo legible — P1 · S (1)

**Qué:** las barras flotantes sin eje pasan a una **cascada** por trimestre o año (saldo inicial → ingresos → gastos →
deuda → ahorro → saldo final) y la tabla mensual a una tabla que en el móvil cabe (mes · neto · saldo final, el resto
en la fila desplegada). Vive tras «Ver todo el detalle».

### FX-16 · Remates del móvil en Previsión, ya — P0 · S (0,5)

**Qué:** sin esperar a C2, porque son defectos: tarjetas de cifras cortadas, columnas de la tabla ocultas y etiquetas
del eje que se pisan a 390 px. Entra en `tools/check-mobile-overflow.mjs` como ruta vigilada.

---

## 7. Bloque C · Escenarios que se ven sobre la previsión

### FX-20 · Escenarios superpuestos en la previsión — P0 · L (3,5)

**Qué:** en Previsión, la fila «Comparar con:» y en el gráfico, la línea discontinua del escenario elegido (hasta 2 a
la vez + el plan). Debajo, la **tabla de impacto** del plan frente al escenario:

| Indicador | Plan | Escenario | Diferencia |
|---|---|---|---|
| Punto más bajo (90 días) y fecha | 7.100 € · 5 dic | 4.900 € · 5 dic | −2.200 € |
| ¿Baja del suelo? ¿Cuándo? | No | No (a 3.400 €) | — |
| Fin de 2026 | 10.400 € | 8.200 € | −2.200 € |
| Colchón en meses (fin de 2026) | 2,2 | 1,7 | −0,5 |
| Deuda viva a 24 meses | … | … | … |
| Patrimonio neto a 24 meses | … | … | … |

Más una frase generada (determinista, sin IA): «Con *Un sueldo menos durante 6 meses*, no bajáis del suelo, pero el
colchón queda en 1,7 meses en diciembre. Lo que más lo arregla: el plan B, paso 1 (pausar la aportación a la cartera)».

**Reglas:** de **solo lectura**. «Aplicar al plan» sigue en Escenarios con su paso de revisión (decisión 6). El
escenario se calcula con el motor E20 sobre la trayectoria cosida (FX-03), así que su línea y la del plan coinciden
hasta la primera decisión. Si el cálculo tarda más de 100 ms, se hace en segundo plano con un esqueleto en la línea.
La sidebar «Escenario activo» pasa a decir qué se está comparando o desaparece (no promete lo que no hace).

**Aceptación:** prueba de motor (la línea del escenario sin decisiones = la del plan); e2e: elegir un escenario pinta su
línea, su etiqueta y la tabla; quitarlo vuelve a la de antes; axe; teclado.

### FX-21 · Biblioteca de pruebas de estrés del hogar — P0 · M-L (3)

**Qué:** escenarios predefinidos, rellenados con los datos que ya tiene la app, que se superponen con un toque (FX-20).
Absorbe NIN-09 (P3, «prueba de estrés en una pulsación») y XNF-03 («si uno de los dos pierde el empleo»).

| Preset | Qué cambia | Motor que ya existe | Cuándo sale arriba |
|---|---|---|---|
| **Euribor +1 / +2 puntos** en la próxima revisión | cuota de la hipoteca desde la fecha de revisión | WP-20 + `canonical-mortgage-rate-scenarios.js` | revisión a ≤ 120 días |
| **Un sueldo menos** 3 o 6 meses (cada titular) | ingreso del titular a 0 (o a la prestación, si se declara) | E13 `income-loss` | siempre |
| **Imprevisto de 3.000 €** el peor día del horizonte | gasto único en la fecha del mínimo | E20 `imprevisto` | siempre |
| **Gasto variable +10 %** | gasto variable × 1,10 | E13 `expense` / perfil Tensión | siempre |
| **La paga variable no llega** | ingresos inciertos (WP-35) a 0 | WP-35 | si hay ingresos con certeza < 100 % |
| **El inquilino no paga 3 meses** | renta del local a 0 | E13 `income-loss` | si hay local alquilado |
| **Caída de mercado −20 %** | patrimonio y garantía del Lombard | E13 `market-crash` + WP-44 | si hay cartera o Lombard |

Cada preset dice cuatro cosas, siempre en este orden: **¿bajamos del suelo? · ¿cuándo? · ¿cuánto falta? · qué
palanca lo arregla** (plan B de WP-38, remedio de XPR-07, línea de crédito). Los parámetros (puntos, meses, importe) se
pueden tocar en la hoja del preset, y «Guardar como escenario» lo lleva a Escenarios.

**Por qué es la apuesta de la oleada:** convierte siete motores dispersos en una respuesta de un toque a «¿qué pasa si
sale mal?», sin pedir un solo dato nuevo.

### FX-22 · «¿Y si…?» rápido desde la previsión (NPV-06 y NDB-03, promovidas desde P3) — P1 · M (2)

**Qué:** botón «¿Y si…?» en la fila de comparar y clic largo en un día del gráfico: hoja con cuatro palancas —
**gasto único** (importe y día), **cambio de ingreso mensual**, **cambio de gasto mensual**, **aplazar un pago** — y
el resultado al momento como escenario «Prueba» en el gráfico. Con eso se responde «¿me puedo permitir X?» (NDB-03) en
la propia previsión: «Sí: el punto más bajo queda en 4.100 €, 2.600 € por encima del suelo». «Guardar como escenario»
para seguir en Escenarios. La prueba no se guarda si no se pide.

**Disparador cumplido de NPV-06** («visitas al Laboratorio desde Previsión»): no se puede cumplir mientras no haya un
camino de Previsión al Laboratorio. Se promueve por diseño, no por dato; el medidor dirá en su revisión si se usa.

### FX-23 · Comparar el plan con un solo escenario — P0 · S-M (1,5)

**Qué:** Escenarios › Comparar acepta 1 escenario (plan frente a él), y los presets de FX-21 sin guardarlos. Columna
por escenario con la misma tabla de impacto de FX-20 y mini-gráfico. El texto de entrada de Escenarios pasa a lenguaje
de hogar («Prueba una decisión sin tocar el plan: elige qué cambia y mira cómo queda frente a lo de ahora»).

### FX-24 · Escenarios con probabilidad y valor esperado — P3 · M (2)

**Qué:** el campo de probabilidad de E13 ya existe; con ≥ 3 escenarios con probabilidad, una línea «esperado
ponderado». **Crítica:** con un hogar y sin historia, las probabilidades son opiniones con decimales. Se queda en P3 con
disparador: el hogar pide ponderar escenarios.

### FX-25 · Un solo motor de escenarios — P2 · L (4)

**Qué:** el laboratorio E13 y el simulador de decisiones (`#simulator`) pasan a ser entradas del motor E20, con prueba
de paridad (mismo escenario → misma trayectoria de caja, ≤ 1 €) como la de deuda (E19). Después, sus pantallas se
redirigen a Escenarios (redirigir sin borrar código; **retirar se consulta**, D-N6). Baja titulares (GOV-02).

### FX-26 · Diario de decisiones con lo que se esperaba — P2 · M (2)

**Qué:** al aplicar un escenario o un preset, se guarda qué se esperaba (los indicadores de la tabla de impacto) y una
fecha de revisión. En esa fecha (o tras 3 cierres), la app enseña esperado frente a real. Es la forma de que los
escenarios pasen de «construido» a «comprobado» y de que el hogar aprenda a fiarse (o no) de sus simulaciones.

### FX-27 · La revisión de la hipoteca como escenario con fecha (XDO-02 adoptada en parte) — P1 · M (2)

**Qué:** a ≤ 120 días de la revisión del tipo variable (WP-20), el preset Euribor sube a primera posición y enseña la
cuota en tres caminos (sin cambio, +1, +2) con su efecto en el colchón, junto a la opción fija o mixta si el hogar ha
tecleado una oferta. Sin tipos de mercado en vivo (fuera de alcance del rediseño).

---

## 8. Bloque D · Incertidumbre y confianza

### FX-30 · Lenguaje de incertidumbre para personas — P0 · S (1)

Cambios de texto, sin tocar motores:

| Hoy | Pasa a |
|---|---|
| «Banda P10-P90» | «Rango probable (8 de cada 10 casos)» |
| «Mediana (P50)» | «Lo más probable» |
| «En ninguna de las 500 trayectorias simuladas…» | «En ningún caso razonable bajáis del suelo en 30 días» (el «¿cómo se calcula?» explica las 500 trayectorias) |
| «aguanta caer hasta un 207 % (hasta −5.350 €)» | «Aguanta aunque no llegue el ingreso previo a la nómina» |
| «Banda sin calibrar · se calibra con 3 cierres» | «Rango sin comprobar todavía: se comprueba con 3 cierres (faltan 3)» |
| «La banda es ancha: el 100 % de lo que se mueve tiene fecha estimada» | «El rango es ancho porque ningún pago tiene día confirmado. Confirmar los 10 más grandes lo estrecha» → enlace a Días de cargo |

### FX-31 · Una insignia de confianza de la previsión (XPR-03 en parte, WP-10, WP-12, WP-45) — P0 · S-M (1,5)

**Qué:** junto a la cifra principal de Previsión (y en Hoy, como punto, sin texto extra): «Confianza **baja** · media ·
alta». Se calcula con tres señales que ya existen: % del gasto con día conocido (WP-10), frescura de los saldos
(WP-26) y cierres comparables (WP-12). La hoja dice por qué y **la tarea que más la sube, con su tiempo**, ordenada por
euros de incertidumbre por minuto (CAP-07, WP-45). Sustituye a los tres `<details>` de calidad y acierto como entrada.

### FX-32 · El rango cubre también los importes (XPR-01) — P2 · M (2) · disparador: 3 cierres con reales

**Qué:** cada partida aporta su variación de importe: con ≥ 3 meses de reales, la aprendida; antes, una por bloque
declarada y rotulada («fijos 0 %, variables ±15 %, supuesto»). La banda pasa a recoger fecha **e** importe. Hasta
tener datos, se enseña el rango de fechas y se dice que no recoge importes (como ahora).

### FX-33 · La previsión corrige su sesgo y su rango se calibra (XPR-02, XPR-03) — P2 · M (2) · disparador: 3 cierres comparables (≈ febrero 2027)

### FX-34 · Probabilidad sugerida para los ingresos inciertos (XPR-10) — P2 · S (1)

### FX-35 · Detector de cambios de nivel (XPR-09) — P2 · M (2) · disparador: 4 meses de reales por partida

«El súper subió de nivel desde septiembre: +60 €/mes. ¿Actualizar el plan?» con el paso de revisión de siempre.

---

## 9. Bloque E · Qué ha cambiado, avisos y ritual

### FX-40 · Qué ha cambiado desde tu última visita (XUX-07 y WP-43, en Previsión) — P0 · M (2,5)

**Qué:** la previsión guarda una foto ligera (cifras del contrato, no la trayectoria entera) cada semana, al importar y
al firmar un cierre. Bajo la cifra principal: «−300 € frente al lunes [por qué ▸]». La hoja es un **puente** con cuatro
causas fijas: **datos nuevos** (reales importados), **cambios del plan** (partidas, escenarios aplicados), **supuestos**
(Euribor, IPC…) y **el paso del tiempo** (lo que ya se cobró o pagó). El puente del 31/12 de WP-43 se mueve aquí como
caso particular y deja `#plan` (baja un titular).

### FX-41 · Avisos de previsión con umbral — P1 · S-M (1,5)

**Qué:** la previsión avisa cuando cruza un umbral, no cuando cambia: el punto más bajo de 90 días baja del suelo; una
cuenta baja de su mínimo operativo; el colchón en meses baja del objetivo; el fin de año cae > 10 % frente a la última
foto. Salen en «Decidir esta semana» de Hoy (máximo 3, por euros en juego) y en el calendario suscribible (WP-32).
**Respeta «un cambio de Hoy por semana»:** entra como uno de esos cambios, con su línea en Novedades.

### FX-42 · La previsión en el cierre del Repaso semanal — P0 · S (0,5)

**Qué:** el paso «Listo» del Repaso (B5) añade una tarjeta de 3 líneas: punto más bajo de 30 días, qué ha cambiado
(FX-40) y, si hay, el aviso de umbral. **No es un paso nuevo**: el criterio de retirada del Repaso es abandonarlo a
medias, y un sexto paso lo empeoraría.

### FX-43 · La carta del mes cuenta la previsión (WP-29) — P0 · S (0,5)

**Qué:** la carta determinista del cierre añade dos frases: cómo acabó el mes frente a lo previsto el día 1 y el 15
(WP-12) y qué dice la previsión del mes siguiente. Primera carta con el cierre de noviembre (1-3/12).

---

## 10. Bloque F · Horizonte largo

### FX-50 · Hasta 2036, legible — P1 · M-L (3)

**Qué:** el horizonte «Hasta 2036» de Previsión pasa a vista anual con **hitos** (deuda cero, colchón completo,
objetivos de ahorro, fin de la hipoteca), los supuestos al lado (FX-51) y escenarios superpuestos (FX-20). Absorbe la
proyección de liquidez de `#forecast` («con proyectos · sin proyectos» pasa a ser un escenario más) y se apoya en la
serie de patrimonio de WP-46. Rango en abanico que se abre con los años, con el texto «a 10 años, esto es una
dirección, no una cifra».

### FX-51 · Supuestos del plan, en un solo sitio — P0 · M (2)

**Qué:** hoja «Con estos supuestos» desde Previsión (y en Ajustes): cada supuesto con valor, fuente, fecha y caducidad
(como los índices de WP-13), y **su impacto** en el fin de año y en 2036 si se mueve ±1 punto. Editar un supuesto
enseña el antes y el después antes de guardar (decisión 6). Coste: ≈ 10 min **una vez** para revisarlos; cero a la
semana (XDA-01).

### FX-52 · Qué supuesto pesa más (tornado) — P2 · S (1), sobre FX-51

Barras horizontales ordenadas por impacto en el fin de 2027 y en 2036.

### FX-53 · Objetivos con probabilidad y aportación necesaria (XIN-04) y fecha de independencia financiera (XIN-07) — P2 / P3

Adoptadas de la séptima auditoría con su prioridad: XIN-04 en P2 tras FX-50; XIN-07 en P3 (disparador: el hogar lo
pide).

---

## 11. Bloque G · Navegación, medición y plataforma

### FX-60 · Navegación por cinco preguntas (XUX-01) — P1 · L (4)

Hoy · Movimientos · Plan · Patrimonio · Decidir, con Ajustes desde el avatar y todo lo demás desde el buscador ⌘K.
**Plan › Previsión queda como el único sitio de la previsión**: `#forecast`, Previsión mensual, Análisis de previsión,
Mapa de calor y la proyección redirigen allí (redirigir sin borrar; dos meses de redirección; HANDOFF §4). «Herramientas
avanzadas» y «Versiones anteriores» salen de la barra lateral al buscador. Escenarios vive en **Decidir › Escenarios**,
con los presets de FX-21 arriba.

### FX-61 · WP-28, desaparcado — P0 · (sesiones de WP-28: 3,5)

Lo pide FX-11. Se construye con C2 como su primera pantalla, no en abstracto.

### FX-62 · Medir Previsión y Escenarios — P0 · S (0,5)

Instrumentar en el medidor de utilidad (XGO-02): vista de Previsión, cambio de horizonte, día fijado, escenario
superpuesto, preset abierto, «¿Y si…?» usado, «Guardar como escenario», «por qué» del puente. **Antes de C2**, para que
su revisión de 14 días tenga un antes.

### FX-63 · Rendimiento de los escenarios — P2 · S-M (1,5)

La banda de caja hace 500 trayectorias; con 2 escenarios superpuestos serían 1.500. Presupuesto: ≤ 100 ms percibidos al
superponer (cálculo en segundo plano o en un *worker* si se pasa) y la e2e de rendimiento de pantallas
(`perf-screens`) con Previsión y un escenario.

### FX-64 · Una lectura de la previsión para compartir — P3 · S (1)

Una página imprimible (cifra, gráfico, supuestos, escenarios comparados, fecha) para el banco o un asesor. Disparador:
el hogar lo pide. Sin servidor (el enlace compartido de solo lectura ya existe).

---

## 12. Riesgos y cómo se cubren

| Riesgo | Cómo se cubre |
|---|---|
| Teatro de simulación: muchos escenarios, ninguna decisión | Presets atados a decisiones reales con fecha (revisión de la hipoteca, 31/12, enero base cero); diario de decisiones (FX-26); medidor (FX-62) con revisión a 14 días |
| La previsión gana atractivo pero no exactitud (0 % del gasto con día) | H-35 (días de cargo de las 10 partidas grandes) en P0; insignia de confianza (FX-31) honesta; FX-30 dice por qué el rango es ancho |
| Falsa seguridad del rango (solo fechas) | Lo dice en la propia cifra hasta FX-32 |
| Crecer en pantallas | XGO-01: C2 y FX-60 deben **bajar** titulares; FX-25 retira superficies tras paridad |
| Romper la línea base de Hoy | Lo que toca Hoy (FX-01 etiqueta, FX-41 avisos) entra como corrección o como el cambio de la semana, nunca dos a la vez |
| Demasiadas funciones en prueba a la vez (8 encendidas el 29/10) | Tope blando de 3 funciones nuevas en prueba a la vez en esta oleada (D-N7) |
| Paridad de motores (FX-03, FX-25) cambia cifras que el hogar ya conoce | Novedades lo dice con el antes y el después; la prueba de invariantes lo vigila |

---

## 13. Cómo se mide que la oleada ha funcionado

| Métrica | Objetivo | Se mide con |
|---|---|---|
| M-COHERENCIA: cifras del contrato iguales en todas las pantallas | 100 % en demo y en los 5 hogares sintéticos, en 5 fechas | prueba de FX-01 (CI) |
| M-PREV-USO: días de la semana con Previsión vista | ≥ 2 de media durante 4 semanas desde C2 | medidor (FX-62) |
| M-PREV-T: segundos hasta la primera interacción en Previsión | mediana ≤ 10 s | medidor |
| M-ESC: escenarios o presets superpuestos | ≥ 1 por semana en 3 de 4 semanas | medidor |
| M-CONF: gasto con día conocido | de 0 % a ≥ 40 % al cierre de noviembre (≥ 70 % en enero) | WP-10 |
| M-SUPERFICIE: titulares visibles por defecto en Plan y Decidir | −15 % frente a `docs/gobierno/superficie.json` del 5/11 | XGO-01 (CI) |
| GOV-01: minutos a la semana | sin cambio (≤ 10) | Repaso (B5) |

Regla de parada heredada: si la oleada no mueve ninguna de M-PREV-USO, M-ESC o M-CONF en 4 semanas desde C2, se para y
se revisa con el hogar antes de seguir con FX-25 o FX-50.
