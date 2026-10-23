# WP-23 · Campaña fiscal de fin de año — diseño

Paquete del plan definitivo (FIS-01 + DAC-02 + FIS-02, Ola 1, ≈ 4 sesiones). Diseño cerrado el 6/10/2026, adelantado a la semana del 12/10 por decisión del hogar («adelántalo con datos ficticios y señálalo en la app de forma elegante»). **Ninguna cifra real del hogar aquí**: el repositorio es público; los datos fiscales llegan por el chat (H-03, 20/10) y viven solo en el almacén privado de la app.

## 1. Qué es y por qué ahora

Una lista de acciones que ahorran impuestos antes del 31/12, cada una con su **euro estimado**, su **fecha límite** y lo que falta para calcularla. El motor, la pantalla y las pruebas se construyen ya **sin datos del hogar**, con un hogar de ejemplo claramente ficticio; los euros reales entran cuando el hogar mande sus datos. Así el riesgo de calendario (retomar el 1/11 con 14 días hasta el 15/11) desaparece: el 20/10 solo hay que rellenar datos, no construir.

Es el único paquete del plan con fecha límite externa y dinero directo (criterios 1 y 2 de §3 del backlog).

## 2. Acciones (todas por declarante: tributación individual)

| Acción | Cálculo | Fecha límite | Dato que necesita |
|---|---|---|---|
| **Vivienda** (DAC-02) | Régimen transitorio: 15 % sobre un máximo de 9.040 € pagados al año por declarante. Ahorro = (tope − pagado) × 15 %: lo que rinde amortizar de más hasta llenar el tope. Por encima del tope no deduce. | 31/12 | Si aplica (compra anterior a 2013 con deducción), lo pagado en el año por declarante |
| **Pensiones** | Límite individual (1.500 €) − aportado. Ahorro = hueco × tipo marginal. Muestra el **coste real** (aportación − ahorro): queda inmovilizado. Con plan de empresa no se calcula (límite combinado distinto). | 31/12 | Aportado, tipo marginal, si hay plan de empresa; opcionalmente liquidez disponible |
| **Compensación** | min(plusvalía neta del año, minusvalías latentes) × tipo del ahorro. Aviso de la regla de recompra (2 meses en cotizados). Sin plusvalía neta: no aplica (la minusvalía se arrastra 4 años). | 31/12 | Resultado neto de ventas, minusvalías latentes, tipo del ahorro |
| **Donativos** | 80 % de los primeros 250 € y 40 % del resto (45 % con recurrencia). Muestra el coste real. | 31/12 | Donativos del año (hechos o previstos) |
| **Retención** (FIS-02) | Tipo adicional = resultado a pagar / bruto anual, redondeado hacia arriba. Es **caja, no ahorro**: no suma al total. | sin fecha límite | Resultado estimado de la Renta, bruto anual; opcional tipo actual |

Se ordena por euros ahorrados (de más a menos); luego lo que falta datos; al final lo que no aplica. **«Sin dato = no calculable»**: una acción sin dato sale como tal y dice cuál falta; una calculada para un declarante y sin dato para otro sale «parcial» y solo suma lo calculado. Nunca una cifra inventada.

### Desviación respecto a la especificación (FIS-02)

La especificación pedía ajustar la retención «para no pagar en junio». La Renta de junio de 2027 cierra el IRPF de **2026**, y pedir ahora (modelo 145) un tipo superior solo alcanza a las una o dos nóminas que quedan de 2026: **no evita el pago de junio de 2027**. El ajuste rinde de verdad en **2027** (la Renta de junio de 2028). Por eso la acción se presenta como «retención voluntaria», calcula el tipo adicional si el resultado se repite, no tiene fecha límite del 31/12 y no cuenta como ahorro. Con devolución esperada solo cabe pedir una retención superior, nunca inferior: «no aplica».

## 3. Parámetros legales: estimaciones sin verificar

> **Actualizado el 23/10/2026 (§10):** cuatro de los cinco parámetros ya están contrastados y dicen su fuente; vivienda sigue pendiente del tramo autonómico.

Los valores (1.500 €, 15 % / 9.040 €, 80 % / 250 € / 40 % / 45 %, regla de 2 meses, 4 años) salen del plan y están marcados `verified: false` en el motor y en la pantalla («Pendiente de contrastar con la fuente oficial»). Viajan en el resultado y se pueden sustituir por los del hogar. Quedan por contrastar con la fuente oficial y con la comunidad autónoma antes de que la campaña se presente como algo más que una estimación. Un año sin tabla propia hereda la del último conocido y lo declara (`inheritedFromYear`). Regla heredada de A15-2/A15-5: nunca un número con apariencia de correcto sobre un parámetro sin fuente. El límite de pensiones está acoplado por una prueba al de `canonical-pension-simulator.js` (A15-4), para que no diverjan en silencio.

Cada acción lleva «estimación; confirmar con asesor» y la app **nunca ejecuta nada** (A11-4): aportar, amortizar, vender o donar lo decide el hogar.

## 4. Cómo se señala el ejemplo (UI/UX)

Mientras no haya datos del hogar, la lista se calcula con un **hogar de ejemplo ficticio** (dos declarantes, cifras redondas, `example: true`, inmutable). La tarjeta lo dice de cinco maneras, ninguna dependiente solo del color:

1. Etiqueta **«Ejemplo»** (texto, borde discontinuo) junto al título.
2. Aviso con texto («Cifras de ejemplo. Esto muestra cómo quedará tu lista con un hogar ficticio…»), `role="note"`.
3. Borde discontinuo y **sombreado diagonal** muy tenue de la tarjeta (se retira con `prefers-contrast: more`).
4. Cada cifra con **subrayado punteado**, y «cifra de ejemplo» para el lector de pantalla.
5. Un test garantiza que **ninguna cifra** del ejemplo queda sin marcar.

Con datos reales (`example: false`) desaparecen las cinco marcas sin tocar nada más: la misma pantalla. Todos los colores salen de tokens `--e19-*` (claro, oscuro, alto contraste); una prueba impide colores sueltos.

Estructura: cuenta atrás discreta («La campaña se abre el 1 de noviembre (en 26 días). Quedan 86 días hasta el 31 de diciembre»), total en grande, lista numerada por euros y, plegado, el detalle por declarante y la fuente. Vive en **Herramientas avanzadas › Fiscal** (no en Hoy; cero pantallas nuevas) y se anuncia en «Novedades».

## 5. Piezas

- `canonical-year-end-tax.js` (puro): `buildCampaign`, `parametersFor`, `EXAMPLE_HOUSEHOLD`.
- `fiscal-campana-ui.js` (pantalla) y `fiscal-campana.css` (hoja propia: styles.css y design-tokens.css tienen su versión fijada por decenas de pruebas).
- `app.js`: una línea en `renderActiveSection` (`herramientas-fiscal`), con lo que el motor tiene consumidor real (ARQ-3). 37.422 de 37.495.
- `tests/fis1-campana-fiscal.test.cjs`.

## 6. Pendiente (PR siguientes, con los datos del hogar)

- ~~**PR-2 · datos del hogar**~~ — **hecho el 16/10/2026** (§8). Los datos ya no entran por el chat (el repositorio es público): los teclea el hogar en la app.
- ~~**PR-3 · «Hecho» y calendario**~~ — **hecho el 16/10/2026** (§9).
- ~~Contrastar los parámetros con la fuente oficial~~ — **cuatro de cinco el 23/10/2026** (§10); falta el tramo autonómico de vivienda.
- Fecha de los datos de entrada: H-03 (20/10). Límite para tener la lista con euros reales: 15/11.

## 7. Riesgo

Normativa mal aplicada (probabilidad media): cada acción con su fuente, etiqueta «estimación», parámetros sin verificar a la vista, pruebas de los bordes (por debajo, justo en y por encima del tope), «sin dato = no calculable» y confirmación con asesor antes de actuar (H-14, 31/12).

## 8. Segunda entrega (PR-2, 16/10/2026): «Tus datos fiscales»

El hogar no podía teclear sus datos fiscales (el ensayo del 15/10 lo encontró), y mandarlos por el chat no es una opción con un repositorio público. Ahora hay un formulario debajo de la lista, en la misma tarjeta.

- **Qué es:** un formulario por declarante (hasta `MAX_HOLDERS` = 2) con los once datos que usa el motor y dos respuestas sí/no/«no lo sé». Se guarda en el almacén **`fiscal-data`** (`BACKUP_LOCAL_STORES`: copia en fichero y nube), con `{schemaId, year, holders, updatedAt}`. Piezas: motor puro (`holderFromInput`, `holderHasData`, `normalizeStore`, `resolveHousehold`, `FIELD_SPECS`), `fiscal-datos-ui.js` (formulario) y un enganche en `fiscal-campana-ui.js` (si hay datos de este año, `example: false` y desaparecen las cinco marcas del ejemplo). **`app.js`: +1 línea** (la clave del almacén).
- **Vacío no es cero (la regla que más importa):** un campo vacío es `null` = «sin dato» y deja la acción en «sin calcular» diciendo qué falta; un `0` escrito es un dato. «No lo sé» en las respuestas sí/no es `null`, nunca un «no». Una prueba lo verifica campo por campo y de punta a punta (aportado «vacío» → sin calcular; aportado «0» → caben los 1.500 €).
- **Una cifra mala no se guarda ni se corrige en silencio:** texto que no es un número o fuera de rango (sentido común, no límite legal: p. ej. tipo marginal 0–60 %) → no se guarda **nada**, se marcan los campos (`aria-invalid`, mensaje con texto y barra, no solo color), se resume arriba y el foco va al primero. Al **leer** del almacén, un valor dañado vuelve a «sin dato», no a 0 ni al máximo.
- **Los datos son de un año:** los del año anterior no se usan para la campaña nueva (`stale-year`): la tarjeta lo dice y vuelve al ejemplo; el formulario los ofrece, editables, para revisarlos.
- **Qué NO hace:** no deduce nada de las nóminas (WP-31) ni del estimador de Renta (A15-2) — **todo se teclea**, aunque el bruto y la retención ya estén en las nóminas, y el resultado y el tipo marginal podrían salir del estimador; unirlos es una decisión de diseño aparte (arrastra datos de otro almacén). Tampoco contrasta las cifras con ninguna fuente oficial ni da por buenos los parámetros legales (siguen `verified: false`).
- **Qué se comprobó:** 23 pruebas unitarias nuevas (`tests/fis2-datos-fiscales.test.cjs`) y 2 de navegador (guardar, recargar, error, copia, quitar y deshacer; «Rellenar mis datos»), más axe en claro y oscuro × 1280/390 en tres estados (vacío, con errores, guardado). **Mutaciones comprobadas:** vacío→0, sin rango, año ajeno, «no lo sé»→«no», la lista sin datos reales y el formato de importe en un %: cada una hace caer una prueba.
- **Hallazgos corregidos en el camino:** el aviso «No es un importe» de la app daba **3,89:1** de contraste en oscuro dentro de esta tarjeta (se dice con tinta y barra); mi mensaje de error repetía el `id` del aviso del lector de importes (ids duplicados): ahora uno solo por campo; y al guardar, el formulario se plegaba y escondía su propio «guardado» (ahora respeta cómo estaba).
- **Pendiente:** contrastar los parámetros legales (PR-3 hecho: §9).

## 9. Tercera entrega (PR-3, 16/10/2026): «Hecho» por tarea y un aviso del 20/12 que sabe lo que falta

- **Qué es:** en cada tarea de la lista, por declarante, un botón «Marcar como hecho» (y «Quitar marca»). Se guarda con la fecha de hoy en el almacén **`fiscal-done`** (hermano de `fiscal-data`) (`{schemaId: finance-wp23-fiscal-done/v1, year, marks}`; clave `acción|declarante`; en `BACKUP_LOCAL_STORES`, así que viaja en la copia y en la nube). Encima de la lista, un resumen: «Hecho: X de N tareas. Quedan M antes del 31 de diciembre, con <cifra> de ahorro estimado por hacer».
- **«Hecho» lo declara el hogar:** la app no puede comprobar que se aportó al plan o se donó. El resumen lo dice. Si lo hecho cambia las cifras (aportar baja el margen del tope), hay que actualizar «Tus datos fiscales»: la app no lo deduce.
- **Qué cuenta como tarea:** solo las filas **accionables** (calculables y, si la acción tiene ahorro, con ahorro > 0) de acciones **con fecha límite**. «Sin calcular» no es una tarea hecha ni pendiente (no se puede marcar); **ajustar la retención** no tiene fecha límite y es caja, no ahorro: no cuenta para el 31/12. Sin tareas (`total` 0) no hay progreso: **«sin tareas» no es «todo hecho»**.
- **Datos de un año:** las marcas de otro año no se aplican (empieza de cero), las de acciones desconocidas se descartan al leer y una fecha fuera del año o mal formada no se guarda. El **ejemplo no se puede marcar**: es un hogar ficticio.
- **Calendario (`canonical-reminders.js`):** los eventos del 1/12 y 20/12 ya existían (genéricos). Ahora, con datos reales de este año, el del 1/12 añade en la descripción «Según la app el <fecha>: N tareas con ahorro y M sin marcar»; el del 20/12 dice cuántas quedaban sin marcar, y **si no queda ninguna, ese evento no se genera** (se avisa en pantalla). Los títulos no llevan cifras (se leen con el móvil bloqueado). **Límite:** un `.ics` no puede borrar un evento que ya importaste; la pantalla lo dice.
- **Qué NO hace:** no cambia nada en Hoy; no emite avisos nuevos; no calcula cuánto ahorro se «consiguió» (solo cuánto queda por hacer); no verifica nada con la Agencia Tributaria.
- **Qué se comprobó:** 23 pruebas unitarias (`tests/fis3-fiscal-hecho.test.cjs`: almacén, progreso, calendario, UI en vm, cableado), 2 de navegador (marcar, recargar, quitar y deshacer; el `.ics`) y axe en claro/oscuro × 1280/390 con una cuarta etapa (tarea marcada). **Mutaciones comprobadas (7):** cada una hace caer al menos una prueba.
- **Hallazgo en el camino:** la prueba axe de PR-2 reutilizaba el estado entre anchos; con la marca persistida el botón era «Quitar marca». Era un fallo del aislamiento de la prueba, no de la app: ahora limpia `fiscal-done` además de `fiscal-data`.

## 10. Contraste de los parámetros legales (23/10/2026)

El hogar dio su comunidad autónoma por el chat. **No se escribe en el repositorio**, que es público: el motor sigue con una tabla genérica y la comunidad solo aparece como ejemplo en el texto de donativos.

**Cómo se contrastó.** La tabla de 2026 se comparó con el **Manual práctico de Renta 2025** de la Agencia Tributaria, el del ejercicio 2025 y el último publicado. No se encontró ningún cambio aprobado para 2026 en estos cinco puntos. Hubo un límite de método: el contenedor de desarrollo no puede abrir la sede de la Agencia Tributaria, el BOE ni la web de la comunidad, porque la política de red lo deniega. El contraste se hizo con el texto del manual tal como lo devuelve el buscador, no con la página abierta. Las fuentes van en el motor como texto, sin enlace: el código publicado no nombra servidores sin revisar (NTC-06, `tests/ntc6-conexiones-externas`).

| Parámetro | Antes | Ahora | Fuente | Qué cambió en el texto |
|---|---|---|---|---|
| Pensiones | sin verificar | **contrastado** | Manual 2025, cap. 13 (arts. 51-52 LIRPF) | Además del límite de 1.500 €, el tope del 30 % de los rendimientos netos del trabajo (con nóminas normales no muerde), el límite de 8.500 € más con plan de empresa (no calculado) y el arrastre de cinco años |
| Donativos | sin verificar | **contrastado** | RDL 6/2023 (boletín de la AEAT); manual 2025, deducciones autonómicas | 45 % solo si se donó a la misma entidad, al menos lo mismo, los dos años anteriores; límite del 10 % de la base liquidable; deducción autonómica propia de algunas comunidades, no calculada |
| Compensación | sin verificar | **contrastado** | Manual 2025, caps. 11-12 (arts. 33.5.f y 49 LIRPF) | Compensación del 25 % con rendimientos del capital mobiliario; la regla de recompra afecta a «valores homogéneos» |
| Retención | sin verificar | **contrastado** | Art. 88.5 RIRPF, según los modelos de solicitud de la Administración General del Estado | Cinco días de antelación; el tipo nuevo sigue en los años siguientes hasta renunciar por escrito. **Esto confirma la desviación de FIS-02**: pedirlo ahora rinde en 2027 sin volver a pedirlo en enero |
| Vivienda | sin verificar | **sigue pendiente** | DT 18ª LIRPF; manual 2025, cap. 16 | El 15 % sobre 9.040 € se reparte entre tramo estatal y autonómico. El manual da un 7,5 % autonómico general en Cataluña (9 % en algunos casos), pero la ficha de la comunidad del hogar no se ha podido leer. `pending` lo dice en pantalla |

**Qué cambia en la app.**
- El motor (`canonical-year-end-tax.js`) lleva por parámetro `source`, `checked` y, si falta algo, `pending`, y cada acción los transporta.
- La pantalla (`fiscal-campana-ui.js`) dice «Contrastado el 23 de octubre de 2026 con: …» o «Pendiente de contrastar… (qué falta)». Lo hace en cada acción y en «Parámetros que usa el cálculo».
- Ninguna cifra calculada cambia: los cinco valores numéricos eran correctos.
- Una prueba nueva impide marcar un parámetro como verificado sin fuente ni fecha, o dejarlo sin verificar sin decir qué falta.

**Hallazgo fuera del alcance: deducción autonómica por el encarecimiento de la hipoteca variable.** El manual de 2025 recoge en la comunidad del hogar una deducción del 25 % sobre el exceso de intereses pagados respecto a los que habría con el Euribor de diciembre de 2022 (artículo 10 del texto refundido de tributos cedidos). Fuentes no oficiales le dan un tope de unos 300 € al año y un límite de renta de la unidad familiar. La hipoteca del hogar es variable (D1), así que puede aplicar. **No es una acción de diciembre**: se pide en la Renta. Por eso no entra en esta campaña. Queda como candidata para el paquete de la Renta (WP-21) o para el estimador de IRPF (A15-2), a decidir por el hogar.

**Para cerrar vivienda:** abrir la ficha de la Agencia Tributaria del tramo autonómico de la deducción por inversión en vivienda habitual de la comunidad del hogar (Manual práctico de Renta 2025, Parte 2) y confirmar el porcentaje. Hay dos maneras: que el hogar lo mire (≈ 2 min) o permitir los servidores `sede.agenciatributaria.gob.es` y `www.boe.es` en la red del entorno de desarrollo.

