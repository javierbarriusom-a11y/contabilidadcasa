# Undécima auditoría · 21/11/2026 · Fiabilidad silenciosa, arquitectura por áreas y el plan óptimo de deuda

> Petición del hogar (21/11): «Sigue analizando la app de manera crítica (…) Propón nuevas mejoras y features con el máximo
> detalle y con las mejores prácticas de UX y UI (…) Revisa del backlog anterior las nuevas funcionalidades que no hayan sido
> implementadas» y «quiero seguir con un plan optimizado de saldo de deuda». **Es una propuesta**: el backlog vivo sigue siendo
> `BACKLOG_NOVIEMBRE_OLEADA_1.md` hasta que el hogar decida qué entra. Sin importes ni nombres del hogar: las cifras de ejemplo
> son de contratos inventados.

## 0. Resumen en ocho frases

1. **El fallo más caro de noviembre no se vio: Hoy estuvo once días sin gráfico con datos reales** (del 10/11, #605, al 21/11) y
   ninguna prueba lo detectó, porque todas arrancan la app sin nada guardado. El problema no es ese fallo, ya corregido. Es que
   **la app no sabe decir cuándo una cifra o un gráfico no se ha podido calcular**: lo esconde. Propongo pruebas de «arranque en
   caliente» y un aviso visible en lugar del hueco (§2.1, UND-01 a UND-03).
2. **Agrupar por áreas funciona y hay que extenderlo.** Hoy ya tiene cinco (Hoy, Mes, Caja, Patrimonio y deuda, Seguimiento) sin
   retirar nada. El mismo patrón resuelve Ajustes (34.000 px en el móvil) e Inversión (9.100 px), las dos pantallas más pesadas.
3. **Deuda tiene seis superficies para una sola pregunta** (Ruta, Comparar, Préstamo, Contratos, Simulador visual, el plan
   heredado y, desde hoy, el plan óptimo). Cada una tiene sentido, pero el hogar no debería tener que saber cuál abrir. Propongo
   reordenar Deuda en tres pestañas: **Plan · Contratos · Ofertas**, con un solo motor (§5.4).
4. **El plan óptimo de saldo (v1) ya está en Deuda › Ruta.** Con lo que podéis poner al mes y un pago inicial opcional, dice en qué
   orden saldar, cuándo acabáis, cuánto os ahorráis y qué se paga cada mes a qué deuda. Las cuotas que se liberan pasan a la
   siguiente. Usa el mismo motor que «Camino a deuda cero» (NTC-05). Faltan tres cosas para que sea de verdad «óptimo»: las
   quitas, la liquidez mes a mes y el seguimiento de lo hecho (§5).
5. **De las 46 funciones de la décima, unas 15 están hechas y 31 siguen abiertas** (§3). De estas, recomiendo 8 ya, 9 tras una
   decisión del hogar, 6 fundidas en otras y 8 aplazadas o descartadas.
6. **26 funciones nuevas (UND-01 a UND-26)**, con el qué, el porqué, la interfaz, la métrica, el tamaño y la prioridad. Pesan más la
   fiabilidad y la experiencia de uso que las funciones nuevas: la app ya tiene más de las que se usan.
7. **La medición existe pero no decide.** Medidor, «¿te sirve?» y Funciones en prueba recogen datos, pero ninguna pantalla se
   ha retirado por ellos. Propongo una revisión trimestral con una lista de retirada (UND-24).
8. **Orden recomendado para las tres próximas semanas** (§6): fiabilidad primero (UND-01 a UND-03), después el plan de deuda v2
   (quitas y liquidez), y Ajustes por áreas.

---

## 1. Lo hecho hoy, y por qué así

| Qué | Por qué así | Dónde |
|---|---|---|
| **Hoy por áreas:** cinco pestañas (Hoy · Mes · Caja · Patrimonio y deuda · Seguimiento) | El hogar: «muchos datos interesantes, pero todos en una sola página». Son pestañas con el aspecto de las de Deuda, **pero sin número**: Deuda es un recorrido en orden y estas áreas no. Un número inventaría un orden. «Hoy» sigue siendo la de entrada: la pregunta de cada día es «¿qué hago ahora?», no «¿cómo va el patrimonio?». No se retira nada: «Ver todo el detalle» sigue enseñándolo todo a la vez | `views/hoy-v2.js`, `tema-v2.css` |
| **El gráfico de Hoy, recuperado** | Se perdía al volver a abrir la app con el plan sin cambios: la copia guardada de la previsión diaria no traía sus filas y se reutilizaba vacía. Afectaba a 17 lecturas, no solo al gráfico | `app.js` (`refreshCanonicalDailyAudit`) |
| **«El detalle del mes»** | En el área Mes: la barra del mes, las tres partidas que más se desvían (las mismas de Cierre) y «El mes en una línea» (ingresos, previsto, real, desviación, sin clasificar, irá a ahorro), que solo salía con «Ver todo el detalle» | área Mes |
| **«Decisiones abiertas» en el móvil** | Esas filas no llevan número, pero el móvil les reservaba su columna de 34 px: el texto salía letra a letra. Pasaba también con «Ver todo el detalle» | `styles.css` |
| **DEC-38, tandas 3 a 5** | La cabecera del móvil pasa de 117 a 46 px a 195 px (zoom al 200 %). Plan, Cierre, Ajustes, Deuda y el simulador visual ya se leen a ese ancho | PROJECT_STATE 517 |
| **Plan óptimo de saldo (v1)** | §5 | `canonical-debt-optimal-plan.js`, `camino-deuda-ui.js` |

**Decisiones de diseño que el hogar debería conocer:**
- El área elegida **dura lo que la pestaña del navegador**: al volver otro día se entra por «Hoy». Recordarla para siempre haría
  que un día se abriera la app en «Patrimonio» y no se viera la decisión urgente.
- Cambiar de área **no cuenta como acción** en el medidor: la métrica de Hoy es el tiempo hasta la primera acción, y mirar no es
  actuar.
- Las áreas Caja, Patrimonio y Seguimiento enseñan los bloques de la Hoy de siempre con el estilo nuevo, no bloques rediseñados.
  Rediseñarlos es el paso siguiente (UND-05), una vez el medidor diga qué áreas se abren.

---

## 2. Diagnóstico crítico

### 2.1 Fiabilidad silenciosa (lo más grave)

- **Las ~490 pruebas en navegador arrancan con el almacenamiento vacío.** El hogar nunca arranca así. Todo lo que dependa de lo
  guardado (cachés, copias compactadas, migraciones) queda sin probar. El fallo del gráfico es el tercero de esta familia en
  noviembre (los otros dos: los saldos con fecha pasada y el cobro manual caducado, ambos de octubre).
- **Ante un dato que falta, la interfaz esconde en lugar de avisar.** Sin filas, `hoyV2ChartSvg` devuelve una cadena vacía y la
  tarjeta queda bien maquetada pero incompleta. El principio «lo que no tiene datos no ocupa pantalla» (decisión 4) se pensó para
  funciones que esperan datos del hogar. **No vale para un cálculo que debería existir y ha fallado**: eso tiene que verse.
- **No hay un indicador de salud del motor.** Nadie sabe, sin abrir la consola, si la previsión diaria tiene filas, cuándo se
  calculó o si alguna invariante falló.

### 2.2 Carga y arquitectura de información

- 60 vistas, 54 enlaces en el menú; Ajustes mide unos 34.000 px en el móvil e Inversión › Cartera, 9.100 (décima §1.1). **Plegar
  no reduce la carga, la esconde** (DEC-40 ya lo mide).
- **El patrón de áreas en pestañas funciona y es barato**: un `tablist` accesible con flechas, CSS que reparte bloques que ya
  existían y ningún motor nuevo. Es la forma más rápida de bajar la carga sin retirar nada, que es lo que el hogar pide cada vez.
- La navegación de 5 destinos (DEC-05) sigue sin hacer. A 200 % de zoom, el menú lateral convertido en lista ocupa varias
  pantallas.

### 2.3 Deuda

- Seis superficies: **Ruta** (calendario y «Camino a deuda cero»), **Comparar** (estrategias), **Préstamo** (consolidar),
  **Contratos** (los datos), **Simulador visual** (quitas y refinanciaciones por contrato), el **plan heredado** en «Versiones
  anteriores» y, desde hoy, el **plan óptimo**. Responden a variantes de una misma pregunta: «¿cómo salimos de la deuda lo antes y
  lo más barato posible sin quedarnos sin colchón?».
- **D-N23 sigue abierta** (decidida el 21/11, después de escribir esto: el realista; ver §5.4): el simulador y Ruta dejan de pagar la cuota de hoy desde el mes de un acuerdo; el plan y Escenarios la
  siguen pagando ese mes. Mientras no se decida, el plan óptimo no puede llevar acuerdos simulados (solo los aceptados).
- **DEC-29 (Ruta sin contradicción) sigue sin hacer:** el título puede decir «sin fecha estimable» encima de una fecha.

### 2.4 Medición sin decisión

- El medidor (XGO-02), «¿te sirve?» (DEC-45) y Funciones en prueba (XGO-03) recogen datos de verdad. Desde el 22/10, **ninguna
  pantalla se ha retirado por lo medido**; solo se han graduado. Sin un momento fijo para decidir, medir no cambia nada.

---

## 3. El backlog anterior: lo que sigue sin hacer (décima, DEC-nn)

Hechas o en marcha (unas 15): DEC-12, 13, 14, 16, 18, 20, 22, 23, 30, 38 (pasos 1 a 3), 39, 40, 41, 44 y 45. DEC-21 espera al
hogar (el nombre de cada colchón).

| DEC | Qué | Recomendación | Por qué |
|---|---|---|---|
| 01 | «¿De dónde sale?» en las cifras protagonistas | **Ya** (con UND-02) | Es la otra cara de UND-02: si una cifra falla, decirlo; si sale, decir de dónde |
| 02 | Sello de calidad en cada cifra | Fundir en DEC-01 | Dos marcas en la misma cifra son ruido |
| 03 | Una sola insignia de procedencia | Tras decisión (cambia todas las pantallas) | Se consulta (décima §7) |
| 04 | «¿Por qué ha cambiado?» en Cierre | Tras el cierre de noviembre | Necesita dos cierres firmados para tener sentido |
| 05 | Barra inferior en el móvil | **Ya, como UND-07** | Es lo que más reduce la carga del móvil |
| 06 | Ajustes en portada y subpáginas | **Ya, como UND-04** (áreas en pestañas) | El patrón de Hoy, ya probado |
| 07 | Inversión y Deuda con resumen arriba | **Ya**: Deuda en UND-15, Inversión en UND-05 | — |
| 08 | Tablas que pasan a lista en el móvil | **Ya**, pantalla a pantalla con DEC-38 | Contratos (10 columnas) es la primera |
| 09 | Buscador de la app | Aplazar | Con áreas y barra inferior baja mucho su valor |
| 10 | Cabecera compacta al desplazar | Fundir en UND-07 | La de 195 px ya está hecha; falta la de 390 px al desplazar |
| 11 | Una puerta única «Traer datos» | Tras D-N11 (4/12) | Toca la entrada de datos |
| 15 | Clasificar con un pulgar | Aplazar | El atasco está en las propuestas, no en el gesto (XDA-05) |
| 17 | Deshacer por lotes en las reglas | Ya (S) | Barato y protege |
| 19 | Hoy con una cifra y dos datos | Hecho en parte con las áreas | El resto, cuando el medidor mida las áreas |
| 24 | Estado «En impago» | **Tras D-N16** (contestada): ya | Sin él, el plan óptimo trata lo impagado como si tuviera cuota |
| 25 | La previsión con lo exigible | Tras DEC-24 | — |
| 26 | Kit para hablar con la entidad | **Ya, en UND-13** | Es el paso previo a cualquier quita |
| 27 | Migrar lo que solo sabe el plan heredado | Con UND-15 | — |
| 28 | «Salir del fichero» como objetivo | Fundir en UND-12 | El plan óptimo ya da el orden y la fecha |
| 29 | Ruta sin contradicción | **Ya** (S, corrección) | Riesgo de confianza |
| 31 | «¿Me lo puedo permitir?» desde Hoy | **Ya, como UND-08** | La pregunta más frecuente de un hogar |
| 32 | Sensibilidad de una línea por escenario | Aplazar | Escenarios se usa poco |
| 33 | Calendario de vencimientos y renovaciones | Fundir en UND-10 | — |
| 34 | Enlace de solo lectura | Tras decisión (privacidad) | Se consulta |
| 35 | Acta de decisiones | Fundir en UND-18 | — |
| 36 | Ocultar cifras con un toque | **Ya** (S) | Mirar la app en público o delante de otros |
| 37 | Modo conversación mensual | **Ya, como UND-18** | Las áreas de Hoy son su orden del día |
| 42 | Hoy primero, lo demás después | Medir antes (UND-23) | — |
| 43 | Graduación por defecto | Fundir en UND-24 | — |
| 46 | Pruebas con la forma del dato real | **Ya, ampliada en UND-01** | El fallo del gráfico es exactamente esto |

De la novena (47 abiertas) y la octava sigue valiendo lo que dijo la décima §3: fusionar 9, bajar 11 y descartar 3.

---

## 4. Funciones nuevas (UND-01 a UND-26)

Formato: **qué** · *por qué* · interfaz · métrica · tamaño (S/M/L) · prioridad (P0 = antes que nada).

### 4.1 Fiabilidad y confianza

**UND-01 · Pruebas de arranque en caliente.** Cada pantalla v2 se prueba también tras guardar, recargar y volver a pintar,
con un estado sintético con la forma del dato real (contratos, movimientos de varios meses, ajustes manuales). *Por qué:* §2.1;
el gráfico estuvo once días perdido. *Interfaz:* ninguna; un ayudante `arrancarEnCaliente(page)` en `tests/helpers`. *Métrica:*
pantallas v2 con prueba en caliente / total (objetivo: 100 %). M · **P0**.

**UND-02 · «No he podido calcular…» en lugar del hueco.** Si una cifra protagonista o un gráfico debería existir y no sale (motor
sin filas, invariante fallida, excepción), se ve una línea discontinua: «No he podido dibujar la previsión de estos días.
Recalcular», con el botón. *Por qué:* hoy un fallo y un «sin datos» se ven igual, y el hogar no puede distinguirlos. *Interfaz:*
el estilo de `.hoy-v2-pending` con un icono distinto (⚠ y no ○) y texto que dice qué falta. *Métrica:* veces que salta (en el
medidor, sin datos); objetivo: 0 tras una semana. S · **P0**.

**UND-03 · Salud del motor en Ajustes › Uso de la app.** Una tarjeta con la última vez que se calculó cada motor (mensual, diario,
deuda, previsión), cuántas filas tiene y si pasa sus invariantes, y «Recalcular todo». *Por qué:* hoy solo se sabe con la consola.
*Interfaz:* lista de cuatro filas con semáforo por forma (●◐○). *Métrica:* —. S · P1.

### 4.2 Arquitectura y navegación

**UND-04 · Ajustes por áreas.** El patrón de Hoy en Ajustes: Cuentas y saldos · Plan y partidas · Datos y copias · Avisos ·
Pareja y titulares · Laboratorio. *Por qué:* 34.000 px en el móvil; es la pantalla más pesada de la app. *Interfaz:* `tablist` con
flechas, área recordada en la sesión, y «Ver todo» para quien busque algo y no sepa dónde está. *Métrica:* alto de Ajustes en el
móvil por área (objetivo: ninguna por encima de 6 pantallas). M · **P1**.

**UND-05 · Inversión y las áreas de Hoy, rediseñadas desde su referencia.** Las áreas Caja, Patrimonio y Seguimiento enseñan hoy
bloques clásicos. Con lo que diga el medidor de qué áreas se abren, rehacer las dos más usadas con las referencias
(`Patrimonio.png`, `Inversion.png`). *Por qué:* consistencia visual; hoy conviven dos estilos dentro de Hoy. M · P2.

**UND-06 · Indicador por área.** Cada pestaña de Hoy lleva, si hace falta, un punto o un número: «Caja ●» si la previsión baja del
suelo en 30 días, «Seguimiento 3» si hay tres decisiones abiertas. *Por qué:* que esconder no sea olvidar; el hogar sabe sin
entrar dónde hay algo. *Interfaz:* insignia de 8 px con su texto para lectores de pantalla («Caja, un aviso»); rojo solo si rompe
una regla del hogar (decisión 2). *Métrica:* aperturas de área con indicador frente a sin él. S · **P1**.

**UND-07 · Barra inferior en el móvil y cabecera que se recoge** (DEC-05 y DEC-10). Cuatro destinos (Hoy, Movimientos, Plan,
Deuda) y «Más». La cabecera de 82 px se recoge a 44 al desplazar hacia abajo y vuelve al subir. *Por qué:* a 390 px el menú
lateral es una lista que tapa la pantalla; la barra es el patrón que el hogar ya conoce de su banco. *Interfaz:* 56 px + zona segura
del iPhone, iconos con texto siempre (no solo icono) y el destino activo en verde sólido. *Métrica:* toques hasta llegar a una
pantalla (objetivo: 1 para las cuatro). M · P1.

### 4.3 Decidir

**UND-08 · «¿Me lo puedo permitir?» desde Hoy** (DEC-31). Un botón en la cabecera de Hoy: importe y fecha → «Sí, y os quedan
X € sobre el suelo el día más justo» / «Sí, pero el 14 os quedáis a 120 € del suelo» / «No sin mover algo: estas dos opciones».
*Por qué:* es la pregunta que más se hace un hogar, y la app tiene todo lo necesario para contestarla (motor diario, suelo,
reserva). *Interfaz:* hoja inferior con dos campos, la respuesta en una frase y el mini gráfico de Hoy con el gasto marcado. No
guarda nada salvo que se pulse «Apuntarlo como previsto». *Métrica:* consultas por semana. M · **P1**.

**UND-09 · «Qué ha cambiado» en el área Seguimiento, en una frase.** Encima de los bloques: «Desde el lunes: la previsión de fin de
mes baja 90 € (recibo de la luz más alto) y se ha clasificado el 12 % del gasto que faltaba». *Por qué:* «Qué cambió» existe pero
pide leer una tabla. *Interfaz:* una frase con dos causas como mucho, el puente de FX-40 al tocarla. S · P2.

**UND-10 · Calendario de lo que vence** (DEC-33 ampliada). Seguros, revisiones de tipo, fin de promociones, acuerdos con entidades
y la última cuota de cada deuda, en una lista por mes y en el calendario del móvil (`.ics`). *Por qué:* lo caro suele ser lo que se
renueva solo. *Interfaz:* lista agrupada por mes con el aviso a 30 días en «Decidir esta semana». *Métrica:* renovaciones revisadas
antes de vencer. M · P2.

### 4.4 Deuda (el plan óptimo, §5)

**UND-11 · Plan óptimo v2: quitas y ofertas dentro del cálculo.** Una oferta de quita (pagar X para cancelar Y) se convierte en
**rendimiento equivalente**: un 40 % de quita sobre 1.000 € vale lo mismo que amortizar una deuda al 40 % durante un año. El plan
pone cada euro donde más ahorra: quita aceptable > deuda más cara > siguiente. *Interfaz:* en el plan, la quita sale como un
tramo más («Mes 3: 1.500 € a la quita de Banco Y; ahorro 900 €»), con su «Qué ocurrirá» antes de marcarla como propuesta (decisión
6). M · **P1** (tras D-N23).

**UND-12 · Plan óptimo v2: la liquidez mes a mes.** Hoy el plan pone lo mismo cada mes. En la v2, el extra de cada mes sale de la
previsión: menos en los meses de recibos fuertes y más con las pagas extra, sin bajar nunca del suelo ni de la reserva. *Por qué:*
un importe fijo es prudente pero deja dinero sin usar en meses holgados y aprieta en los justos. *Interfaz:* el control «Al mes»
pasa a «Lo que permita la previsión (sin bajar del suelo)», con la opción de fijar un importe. Los tramos dicen el importe de cada
mes. *Métrica:* intereses ahorrados frente a la v1 con la misma liquidez mínima. M · P1.

**UND-13 · Kit para hablar con cada entidad** (DEC-26). Por deuda: qué pedir (certificado con el desglose de capital, intereses y
comisiones; quita; plan de pagos; baja del fichero al pagar), un guion de llamada y una carta con los datos del contrato. Nada se
envía desde la app. *Por qué:* lo primero antes de refinanciar es saber cuánto es capital y negociar el resto. *Interfaz:* hoja
imprimible desde la fila del contrato. *Métrica:* certificados pedidos y recibidos. M · **P1**.

**UND-14 · Seguimiento del plan: lo previsto frente a lo hecho.** Guardado el plan (como escenario, SVD-4), cada mes Hoy pregunta
una vez: «Este mes tocaba poner 300 € de más en Banco X. ¿Hecho?», con «Sí», «Otra cantidad» y «Este mes no». *Por qué:* un plan sin
seguimiento se abandona en el tercer mes. *Interfaz:* una fila en «Decidir esta semana» con tres botones; el plan se recalcula
desde lo hecho. *Métrica:* meses seguidos cumpliendo el plan. M · P1.

**UND-15 · Deuda en tres pestañas: Plan · Contratos · Ofertas.** **Plan:** el plan óptimo arriba, el camino y el calendario.
**Contratos:** los datos. **Ofertas:** Comparar, Préstamo y el simulador visual, que responden a «¿y si aceptamos esta oferta?».
*Por qué:* §2.3; seis superficies para una pregunta. *Interfaz:* las pestañas numeradas de siempre, pero tres; los enlaces viejos
(`#deuda-ruta`, `#deuda-comparar`…) siguen funcionando y llevan a su sitio nuevo. **Se consulta:** cambia una pantalla en uso. L · P2. **Decidida el 21/11 (D-N28: «Sí») y hecha el mismo día** (PROJECT_STATE 519): las cinco pantallas siguen siendo propias; lo que cambia es la navegación (tres arriba, Ofertas con su fila).

**UND-16 · Hitos con su momento.** Al saldar una deuda (marcada en Contratos), Hoy lo dice una vez («Habéis saldado la tarjeta: 90 €
al mes que ya van a la siguiente») y recuerda pedir el certificado de deuda cero. *Por qué:* las finanzas conductuales
documentan que celebrar los hitos sostiene el plan. *Interfaz:* tarjeta teñida (conclusión) sin confeti; un solo día. S · P2.

### 4.5 Experiencia diaria

**UND-17 · Ocultar cifras con un toque** (DEC-36). Un ojo en la cabecera que cambia todos los importes por «•••» hasta volver a
tocarlo; se recuerda en el dispositivo. *Por qué:* mirar la app en el transporte o delante de otros. *Interfaz:* el ojo con
`aria-pressed`; los gráficos siguen viéndose sin su eje. S · **P1**.

**UND-18 · Reunión mensual de 20 minutos** (DEC-37 y DEC-35). Un recorrido guiado por las áreas de Hoy (Mes → Caja → Patrimonio y
deuda → Seguimiento) con una pregunta por área y un acta automática con lo decidido. *Por qué:* las áreas ya son el orden del día;
falta el ritual. *Interfaz:* el modo reunión existente (`#meetingModeBar`) con las áreas como pasos. *Métrica:* reuniones al mes,
decisiones por reunión. M · P2.

**UND-19 · Entrada por la pregunta.** En Hoy, bajo la fecha, tres preguntas que llevan a su área: «¿Cómo va el mes?», «¿Llegamos?»,
«¿Cuándo acabamos con la deuda?». *Por qué:* quien no sabe qué es «Caja» sí sabe qué quiere saber. S · P3.

**UND-20 · Texto grande de verdad.** Un ajuste «Texto grande» que sube la escala tipográfica a 1,25 sin el zoom del navegador, con
las reglas de DEC-38. *Por qué:* a 200 % de zoom la pantalla se queda en 195 px y pierde contexto; con texto grande se mantiene la
maqueta del móvil. S · P2.

### 4.6 Datos

**UND-21 · Importar desde la hoja Compartir sin desplegar nada** (alternativa a XDA-02). Con el Atajo de iOS guardando el extracto
en Archivos e Importar leyendo «lo último de Descargas», sin servidor. *Por qué:* el buzón de XDA-02 sigue sin desplegar desde el
25/10. M · P2.

**UND-22 · Aviso de extracto atrasado por cuenta, en Hoy.** Si una cuenta no tiene movimientos de hace más de 10 días, una línea en
Hoy (no solo en el repaso). S · P2.

### 4.7 Gobierno del producto

**UND-23 · Medir las áreas de Hoy.** Aperturas por área, tiempo en cada una y desde qué área se actúa, en el medidor (sin
importes). Revisión a las dos semanas: el área que no se abra se funde en otra. S · **P1**.

**UND-24 · Revisión trimestral con lista de retirada** (DEC-43 ampliada). Cada trimestre, una hoja con lo medido de cada función
(vista, acción, «¿te sirve?») y tres columnas: se queda, se funde, se retira. El hogar marca; retirar es redirigir sin borrar código
(como en la Ola 1). S · P1.

**UND-25 · Presupuesto de superficie por pantalla.** Además del inventario de titulares (XGO-01), un tope de alto en el móvil por
pantalla (p. ej. 8 pantallas de iPhone), comprobado por el CI como el de 195 px. *Por qué:* «uno entra, uno sale» no saca nada
(décima §1.2); un tope físico sí obliga. S · P2.

**UND-26 · Registro de fallos sin datos.** Los errores de JavaScript del navegador del hogar, contados por función en el medidor (solo
el nombre de la función y el número, nunca el mensaje con datos). *Por qué:* el fallo del gráfico no dejaba ni un error; otros sí
y nadie los ve. S · P1.

---

## 5. El plan optimizado de saldo de deuda

### 5.1 Lo que hace la v1 (publicada con este PR)

En Deuda › Ruta, encima de «Camino a deuda cero»:

1. **Entradas:** lo que se pone al mes además de las cuotas (de entrada, la capacidad libre de Hoy, redondeada a la decena por
   abajo) y un pago inicial opcional (de entrada, 0; la tarjeta dice cuánto hay por encima del suelo del colchón que la previsión no
   toca en 12 meses).
2. **Dos caminos con el mismo motor** (`canonical-debt-payoff-path.js`), los dos con las cuotas liberadas redirigidas:
   - **avalancha:** primero la TAE más alta (con la deducción fiscal de DEB5 si se puede calcular). Matemáticamente es el que menos
     intereses paga;
   - **bola de nieve:** primero la deuda más pequeña.
3. **Recomendación:** la avalancha, salvo que la bola de nieve cueste como mucho un 3 % más de intereses (o 150 €, lo que sea
   mayor) **y** salde la primera deuda antes. Una cuota menos pronto ayuda a sostener el plan, y la tarjeta dice en euros lo que
   cuesta esa elección.
4. **El pago inicial** rebaja el capital en el orden de ataque (salda la primera y, si sobra, empieza la siguiente). Cuota y TAE no
   cambian; con capital deducido de cuota y plazo, la TAE se fija para que no cambie.
5. **Salida:** fecha de libre de deuda frente a hoy, intereses ahorrados, primera deuda saldada, el orden con su porqué y los
   **tramos** («Hasta marzo de 2027: 440 € al mes de más a la tarjeta; hasta octubre: 530 € al préstamo»).
6. **Avisos:** por encima de la capacidad libre, pago inicial por encima de lo que sobra del colchón y deudas que no entran en la
   cuenta.

**Ejemplo con contratos inventados** (tarjeta de 2.400 € al 21,9 % y 90 € de cuota; préstamo de 5.100 € al 9,5 % y 160 € de
cuota), con 440 € al mes: libres en octubre de 2027 en lugar de noviembre de 2029 (25 meses antes) y 1.266 € menos de intereses.
Con el mismo extra pero sin redirigir las cuotas, «Camino a deuda cero» acaba un mes después y paga 17,70 € más de intereses. Con
dos deudas la diferencia es pequeña. Crece con el número de deudas y con lo larga que sea la última: es la bola de nieve de cuotas.
**Honestamente, en este ejemplo lo que más ahorra no es el orden, sino poner los 440 € al mes.** El plan sirve sobre todo para decir
cuánto, a qué deuda y hasta cuándo.

**Lo que no hace (y dice):** sin comisiones por amortizar antes ni cambios de tipo; lo que no tiene cuota activa o TAE no entra;
a lo pactado con una entidad no se le adelanta nada; no ejecuta nada (A11-4).

### 5.2 Por qué así y no de otra forma

- **No es un motor nuevo (NTC-05).** Es un orquestador sobre el motor del camino, que ya tiene sus pruebas. Así un cambio en el
  cálculo de una cuota cambia a la vez el camino, la ruta y el plan.
- **La avalancha no siempre es lo óptimo para un hogar.** La literatura de finanzas conductuales (y la experiencia de cualquier
  asesor) dice que el plan que se abandona no ahorra nada. Por eso hay una tolerancia explícita, pequeña y dicha en euros, y no un
  «elige tú» sin criterio.
- **La recomendación sale con su coste.** Nunca «la mejor opción» sin decir frente a qué y cuánto.

### 5.3 Hoja de ruta

| Versión | Qué | Depende de |
|---|---|---|
| v1 (hoy) | Orden, fecha, ahorro, tramos, pago inicial | — |
| v2 | Quitas como rendimiento equivalente (UND-11) y la liquidez mes a mes (UND-12) | D-N23 (decidida el 21/11: el realista) |
| v3 | Guardar el plan como escenario y seguir lo hecho cada mes (UND-14); hitos (UND-16) | SVD-4 (ya hecho) |
| v4 | Préstamo de consolidación como candidato más del plan (Préstamo dentro del cálculo) y Deuda en tres pestañas (UND-15) | DEC-24 (estado «en impago»); las tres pestañas, sí (D-N28) |

### 5.4 Decisiones que pide (contestadas el 21/11/2026)

> **Renumeradas el 21/11/2026:** esta propuesta las llamó D-N24 y D-N25, pero esos números ya eran de las decisiones de privacidad
> del 19/11 (`docs/PRIVACIDAD_NOMBRES.md`). Pasan a ser D-N27 y D-N28; las respuestas del hogar se refieren a ellas.

- **D-N23** (abierta desde el 18/11): un solo criterio para el mes de un acuerdo. Recomendación: el realista (sin la cuota de hoy)
  para lo que sale de un acuerdo o del simulador. **Decidida: «ok».** Hecho el mismo día (PROJECT_STATE 519): el plan deja de restar
  la cuota de hoy desde el mes del acuerdo aceptado, y las estrategias guardadas desde el simulador la sustituyen desde su mes en
  Escenarios (`planificacion.cuotaMesCambio: "sustituye"`); lo demás de Escenarios, igual.
- **D-N27** (antes D-N24): ¿la tolerancia de la bola de nieve (3 % o 150 €) os parece bien, o preferís que el plan sea siempre el más
  barato? Recomendación: mantenerla. **Decidida: «ok, pero me preguntas antes y poder modificar».** Hecho el mismo día: el plan
  enseña la avalancha mientras no se elija; si la bola de nieve entra en el margen, lo pregunta; el orden elegido se recuerda y se
  cambia en «Orden», y el margen (porcentaje e importe) se edita.
- **D-N28** (antes D-N25): ¿Deuda en tres pestañas (UND-15)? Cambia una pantalla en uso, así que se consulta. **Decidida: «Sí».** Hecho el mismo día: Plan · Contratos · Ofertas, con Comparar, Préstamo y el simulador dentro de Ofertas; los enlaces de siempre siguen valiendo.

---

## 6. Orden recomendado (tres semanas)

1. **Semana del 23/11 — fiabilidad:** UND-01 (arranque en caliente), UND-02 (avisar en vez de esconder), UND-26 (fallos contados),
   DEC-29 (Ruta sin contradicción) y UND-23 (medir las áreas de Hoy).
   *(22/11: hechas UND-02, UND-23, UND-26 y DEC-29, PROJECT_STATE 522; UND-01, 9 de 11 pantallas v2 en caliente, PROJECT_STATE 523.)*
2. **Semana del 30/11 — deuda y uso:** UND-11 y UND-12 (plan v2, tras D-N23), UND-13 (kit para hablar con la entidad), UND-17
   (ocultar cifras), UND-06 (indicador por área).
   *(22/11: hechas UND-11 y UND-12, el plan óptimo v2, PROJECT_STATE 524. Me aparto en una cosa del texto de UND-11: el rendimiento
   equivalente de una quita sin cuota es lo perdonado entre lo pagado (40 % sobre 1.000 € = 66,7 %, no 40 %), porque lo que se
   compara es dónde rinde más cada euro que se pone.)*
   *(22/11: hechas UND-17 y UND-06, PROJECT_STATE 525; UND-06 activo desde el 7/12, tras la revisión de las áreas de UND-23.)*
3. **Semana del 7/12 — carga:** UND-04 (Ajustes por áreas), UND-08 («¿Me lo puedo permitir?»), DEC-38 en Inversión y Escenarios.

Lo demás, tras el cierre de noviembre y la revisión de D-N11 (4/12).
