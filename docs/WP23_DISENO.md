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

- **PR-2 · datos del hogar:** formulario «Tus datos fiscales» (almacén privado, en la copia y la nube; migración del contrato de estado con la herramienta) que sustituye el ejemplo. Entrada: lo que mande el hogar el 20/10 (H-03).
- **PR-3 · «Hecho» y calendario:** estado «hecho» por acción con fecha (M-FISCAL ≥ 100 % de las aplicables antes del 31/12) y eventos de calendario el 1/12 y el 20/12 con la exportación `.ics` existente (A17-2).
- Contrastar los parámetros con la fuente oficial y la comunidad autónoma, y pasarlos a `verified: true` con su fuente.
- Fecha de los datos de entrada: H-03 (20/10). Límite para tener la lista con euros reales: 15/11.

## 7. Riesgo

Normativa mal aplicada (probabilidad media): cada acción con su fuente, etiqueta «estimación», parámetros sin verificar a la vista, pruebas de los bordes (por debajo, justo en y por encima del tope), «sin dato = no calculable» y confirmación con asesor antes de actuar (H-14, 31/12).
