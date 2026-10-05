# Manual de usuario de Finanzas Casa

Fecha de revisión: 5 de septiembre de 2026.

Este manual explica **cómo está organizada la aplicación y qué hace cada pieza**, para poder moverte
por ella sin conocer su arquitectura técnica. Para el **paso a paso de una tarea concreta** ("¿cómo
registro un gasto?", "¿cómo comparo dos estrategias de deuda?"), usa la guía interactiva **FAQs y
ayuda** (`#faqs-ayuda`) dentro de la propia aplicación: enlaza a las pantallas reales con sus rutas
actuales y se ha mantenido al día en cada cambio de navegación — este documento no repite ese
contenido para no quedar desincronizado de nuevo la próxima vez que una pantalla cambie de sitio.

> **Por qué este manual cambió de forma.** La versión anterior (2 de agosto de 2026, alcance «hasta
> E14a») narraba cada pantalla paso a paso por fuera de la aplicación. Cubría menos del 40% de las
> pantallas de hoy y, peor aún, dos entregas ya construidas y verificadas — E15 (objetivos y
> calendario) y E16 (alertas predictivas) — seguían marcadas como «no disponibles», igual que la
> aplicación de ofertas de deuda al plan real (E14b), ya operativa. Esta versión resuelve ambos
> problemas: describe el mapa de navegación tal como es hoy y remite el paso a paso al lugar que
> realmente se mantiene actualizado.

## 1. Antes de empezar

### Abrir la aplicación

La aplicación puede utilizarse de tres formas:

1. En la versión privada conectada a Supabase, iniciando sesión con el usuario del hogar.
2. En local, abriendo el proyecto desde un servidor web.
3. En la demostración pública de GitHub Pages, que contiene únicamente datos sintéticos.

No introduzcas datos personales reales en una demostración compartida. Para trabajar con información
financiera real, usa la sesión privada o una copia local controlada.

### Comprobar el estado de guardado

El indicador de sincronización vive en la cabecera, visible desde cualquier pantalla (no solo desde
Ajustes). Puede mostrar:

| Estado | Significado | Qué hacer |
| --- | --- | --- |
| Local | Los cambios están conservados en este navegador | Puedes seguir trabajando; sincroniza cuando recuperes la conexión |
| Pendiente remoto | Existe una revisión esperando enviarse a Supabase | Mantén la pestaña abierta si puedes y revisa la conexión |
| Sincronizado | La copia local y la remota coinciden | Puedes cerrar con normalidad |
| Conflicto | Otra sesión ha publicado una revisión diferente | No sobrescribas; compara las copias y elige conscientemente cuál recuperar |

La aplicación carga primero la copia local. Un fallo de red no impide consultar ni editar, pero los
cambios no estarán disponibles en otros dispositivos hasta completar la sincronización.

### Elegir el ámbito familiar

El selector **Hogar / Javi / Tere**, en la barra lateral, cambia la lectura de ingresos, gastos,
margen y decisiones al titular elegido, sin borrar ni ocultar los datos de los demás. Es un filtro de
lectura: para cambiar quién ve o edita cada dato, no para separar cuentas.

### Buscar o abrir una pantalla (Cmd/Ctrl+K)

El botón **Buscar o abrir** de la barra lateral (o el atajo `Cmd/Ctrl+K`) abre un buscador que salta
directamente a cualquier pantalla por nombre, sin memorizar en qué grupo de navegación vive. Es la vía
más rápida cuando sabes qué quieres hacer pero no dónde está — especialmente útil para las pantallas
de "Herramientas avanzadas" (sección 4).

**Personalizar**, junto al buscador, ajusta preferencias de la propia interfaz (no de los datos
financieros).

## 2. Conceptos esenciales

| Concepto | Qué significa |
| --- | --- |
| Previsto | Importe planificado para un mes futuro o para una partida todavía no confirmada |
| Real | Importe que ya ha ocurrido y ha sido registrado |
| Usado | Importe que emplea el cálculo: el real cuando existe; si está vacío, el previsto |
| Cero real | Confirma que el importe ocurrido fue exactamente cero; no equivale a dejar la casilla vacía |
| Conciliado | Dato contrastado con movimientos, saldos o extractos bancarios |
| Supuesto | Hipótesis editable que afecta a una previsión o escenario, pero no es un dato ocurrido |
| Revisión | Copia versionada del estado que permite auditar y recuperar cambios |
| Escenario | Simulación separada del plan vigente; no modifica los datos reales por sí sola |
| Dato real / simulación / decisión aplicada | Distintivo visible en la cabecera de cada pantalla que dice de qué tipo es la cifra que estás mirando |

Regla práctica: **vaciar un real recupera el previsto; escribir `0` registra un real de cero euros**.

## 3. Mapa de navegación

La barra lateral tiene dos niveles. El primero son las pantallas de uso frecuente:

| Pantalla | Ruta | Para qué sirve |
| --- | --- | --- |
| Hoy | `#home` | Portada: qué necesita atención ahora mismo |
| Planificación de partidas | `#planificacion-partidas` | Gestión y forecast con todas las decisiones ya recogidas |
| Registrar | `#registrar` | Única puerta de escritura de datos reales — saldo, reales, extracto, lote |
| Movimientos | `#movements` | Extracto, clasificación y saldo por cuenta |
| Plan | `#plan` | Mes, previsión y ahorro |
| Deuda | `#deuda-ruta` | Ruta, estrategias y ofertas de deuda |
| Datos | `#update-hub` | Punto de entrada a saldos, reales e importaciones |
| Cierre | `#cierre` | Conciliación y confianza del dato antes de cerrar el mes |
| Ajustes | `#ajustes` | Cuentas, reserva, seguros, fiscalidad, deuda, patrimonio, laboratorio y exportación |
| FAQs y ayuda | `#faqs-ayuda` | El manual interactivo paso a paso — úsalo para el "cómo hago X" |

El segundo nivel, desplegable bajo **Herramientas avanzadas**, agrupa el resto en cuatro bloques:
**Decidir** (escenarios, comparar estrategias de deuda, asesor ejecutivo), **Analizar** (presupuesto,
estado de la semana, análisis, cuadro de mandos, mapa de calor, previsión, proyección), **Datos**
(widget de solo lectura, importar extracto, registrar el mes, carga de datos, conciliación) y
**Versiones anteriores** (pantallas heredadas que se conservan por continuidad, sin ser la vía
recomendada). No hace falta memorizar este mapa: el buscador (`Cmd/Ctrl+K`, sección 1) llega
directamente a cualquiera de ellas.

### Ajustes: diez dominios bajo una misma pantalla

Ajustes agrupa 42 tarjetas en dominios con su propia barra de anclas interna para saltar entre ellos:
Hogar, Reserva operativa, Seguros, Fiscalidad, Deuda y apalancamiento, Simuladores y Laboratorio,
Patrimonio e inversión, Presupuesto y operación, Datos y exportación, y Navegación. Cada tarjeta
explica su propio propósito y sus límites al abrirla — este manual no repite esa explicación tarjeta
por tarjeta porque quedaría obsoleta con cada tarjeta nueva; para el detalle de una tarjeta concreta,
ábrela directamente o consulta su grupo con la barra de anclas.

**Simuladores y Laboratorio**, dentro de Ajustes, merece una mención aparte: es donde vive el
Laboratorio de escenarios (simulación prudente, sensibilidad, escenario inverso, Monte Carlo de
cientos de trayectorias, malla de ingresos × gastos, árbol causal navegable de una cifra) y el archivo
de pantallas heredadas. Simular ahí **nunca modifica el plan vigente** por sí solo.

## 4. Recorrido recomendado

Para el trabajo normal:

1. Abre **Hoy** para detectar lo que necesita atención — cobertura, liquidez, próxima decisión.
2. Si hay que registrar algo, entra en **Registrar** y elige la pestaña que corresponda (saldo,
   reales, extracto o lote).
3. Revisa **Cierre** para comprobar que banco, reales y saldos cuentan la misma historia antes de
   cerrar el mes.
4. Consulta **Plan** (previsión y ahorro) y, si necesitas explorar una decisión sin comprometerla,
   el **Laboratorio de escenarios** (dentro de Ajustes) o el comparador de **Deuda**.
5. Revisa el indicador de sincronización antes de cerrar la sesión.

Para el paso a paso detallado de cada uno de estos pasos, con capturas de la propia interfaz, usa
**FAQs y ayuda** (`#faqs-ayuda`): sus cuatro casos de uso — Actualizar datos, Predicciones, Sacar
conclusiones y Presupuestar — cubren exactamente este recorrido con los nombres de pantalla reales.

## 5. Alertas, calidad y auditoría

**Hoy** resume alertas y próxima mejor acción sin necesidad de visitar otra pantalla; el horizonte que
mira está acotado a los próximos 18 meses, no al final del modelo. Para el detalle completo:

- **Análisis** y **Cuadro de mandos** (Herramientas avanzadas › Analizar): procedencia y certeza de
  los datos, campos conocidos y desconocidos de deuda, controles automáticos y rendimiento.
- **Conciliación** (`#conciliar`): movimientos sin clasificar, saldos discontinuos y reales
  incoherentes, con recálculo bajo demanda.
- **Centro de alertas** (Versiones anteriores): reglas propias con umbral, frecuencia y acción
  recomendada. Las alertas locales funcionan sin servicios externos; el envío por web push sigue
  desactivado.

Una recomendación con confianza baja indica falta de datos o histórico suficiente — no debe
interpretarse como una certeza.

### Pulso de saldos (Registrar › Saldo de cuentas)

Arriba de los saldos, el **Pulso de saldos** enseña lo último que se sabe de cada cuenta: el saldo que
declaraste o el saldo final del último extracto importado de esa cuenta, el más reciente, con su fecha. Abre
tu banco y, para cada cuenta:

- **Coincide** si el banco marca la misma cifra. Si lo último era un extracto más reciente que tu saldo, ese
  saldo del extracto pasa a ser el declarado.
- **Corregir** si no: lleva al campo de esa cuenta para escribir la cifra nueva.

Con las dos cuentas respondidas, los saldos quedan con **fecha de hoy** y sale «Saldos al día», que se
puede **deshacer** durante 8 segundos. Si solo respondes una, el pulso dice cuál falta. Ojo: escribir un saldo
ya lo fecha hoy, así que no des la otra cuenta por mirada.

Si desde la fecha de ese dato la previsión esperaba movimientos en la cuenta, lo avisa («es raro que siga
igual»): míralo en el banco antes de pulsar «Coincide». En «Auto por fecha» los saldos son una estimación del
plan y no hay nada que confirmar.

El **panel de uso** mide cuánto tardas (objetivo: 20 segundos o menos) y qué parte de las respuestas son
«Coincide». Si casi todas lo son con cuentas que se mueven, puede que se esté confirmando sin mirar.

### Un extracto actualiza también el saldo (Registrar › Importar extracto)

Si en el paso 1 eliges de qué cuenta es el extracto (CaixaBank o Mediolanum) y el fichero trae la columna
de **saldo**, el paso 4 ofrece, ya marcado, **usar su saldo final como saldo declarado de esa cuenta**, con la
fecha del último movimiento. Así una sola visita al banco deja al día los movimientos y el saldo. Si ya habías
declarado un saldo más reciente que el extracto, no se ofrece: no se cambia un saldo por otro más viejo.

El paso 4 también comprueba que **no falten movimientos**: cada saldo tiene que ser el anterior más su
movimiento. Si no cuadra, dice entre qué fechas falta algo; los reales de esos días quedarán incompletos
(el saldo final sí es el que da el banco). Todo va en el mismo lote: **Deshacer último lote** también
devuelve el saldo y su fecha. Ojo: la fecha de los saldos es una para las dos cuentas, así que pasa a ser la
del extracto.

### Escribir importes en Registrar

Los saldos, los reales y el dato manual se escriben como en España: **1.234,56**, **1234,56** o
**1.234** (mil doscientos treinta y cuatro). También se puede pegar **1.234,56 €** desde el banco. Al
salir del campo se pone el separador de miles. En el iPhone sale el teclado numérico; como no tiene la
tecla del menos, el botón **±** junto al saldo de cada cuenta cambia el signo. Si lo escrito no es un
importe, el campo se marca en rojo, dice por qué debajo y **no se guarda**. Un real **vacío** significa
«sin real» (la previsión usa el previsto); un **0** es un real de cero.

### Registrar un gasto desde un enlace o un Atajo del iPhone

Un enlace con esta forma abre **Registrar gasto** con los campos ya rellenos (la primera parte es la
dirección donde usas la app):

`https://javierbarriusom-a11y.github.io/contabilidadcasa/#registrar?importe=23,40&concepto=Mercadona&fecha=hoy&cuenta=Caixa&origen=applepay`

- **importe** (obligatorio para registrar): como en España, «23,40», «1.234,56» o «23,40 €».
- **concepto** (o **comercio**): hasta 80 caracteres; si trae «<» o «>», no se usa.
- **fecha**: 2026-10-04, 04/10/2026, **hoy** o **ayer**. Sin fecha, es hoy. Elige el mes en el que se
  registra si ese mes está abierto; si no, va al primer mes abierto y la ventana lo dice.
- **cuenta** (o **tarjeta**) y **origen** (applepay, atajo, banco): solo informan de dónde viene.

**Nunca se guarda solo**: el gasto no existe hasta que pulsas **Registrar**. Lo que el enlace trae mal
no se descarta en silencio: la ventana dice qué no ha usado y por qué («importe no reconocido: "12,3,4"»).
El enlace se borra de la barra de direcciones al abrirse.

**Ojo, cuenta doble.** Esta ventana crea una **partida nueva** con su real. Úsala para gastos que no
estaban en el plan. Un pago que ya está dentro de una partida (súper, gasolina) se anota en **Registrar ›
Reales del mes**; si lo registras aquí, contará dos veces.

**Atajo de Apple Pay (iOS 17 o posterior).** Los nombres de los menús pueden variar algo según la
versión de iOS: compruébalo con un pago pequeño.

1. **Atajos › Automatización › Nueva automatización › Transacción.** Elige tus tarjetas de Wallet y
   **Ejecutar después de confirmar** (empieza así; «inmediatamente» cuando te fíes).
2. Acción **Texto**: escribe la dirección de arriba hasta `importe=` e inserta las variables de la
   transacción: `…#registrar?importe=` *Importe* `&comercio=` *Comercio* `&tarjeta=` *Tarjeta* `&fecha=hoy&origen=applepay`.
   Pasa antes cada variable por **Codificar URL**: un espacio o un «&» en el comercio o en «23,40 €»
   partirían el enlace.
3. Acción **Abrir URL** con ese texto.

**Antes de usarlo a diario, dos comprobaciones:**

- **Dónde se abre.** Un Atajo abre los enlaces en **Safari**, no en la app de la pantalla de inicio, y
  Safari guarda sus datos aparte. Si usas la app desde la pantalla de inicio, inicia sesión también en
  Safari y espera a ver **Sincronizado** antes de registrar; si no, el gasto se queda en Safari.
- **Qué registra.** Apple Pay solo ve los pagos con el móvil o el reloj (no la tarjeta física, ni los
  recibos, ni las transferencias). Y por lo de la cuenta doble, de momento sirve para gastos fuera del
  plan; la hoja de captura de WP-30 decidirá cómo se anota un pago a cuenta de una partida.

### Asignación personal (Plan › Partidas)

Cada persona recibe una cantidad al mes, por **transferencia a una cuenta propia** que la app no importa. Lo
que gaste de ahí **no se registra ni se clasifica**. Se configura en **Plan › Partidas › Asignación
personal**, con una ficha por persona: nombre, importe al mes, mes de la primera transferencia y, si se
quiere, de la última (para la prueba de tres meses, por ejemplo). Quitar una ficha se puede deshacer
durante unos segundos.

- En el plan aparece una partida por persona, **Asignación personal · Nombre**, en Gastos variables.
- **Sale del gasto variable**: el «Gasto variable estimado» de cada mes baja lo que sumen las asignaciones,
  también si lo fijaste a mano. El gasto total previsto no cambia. Si en algún mes las asignaciones superan
  el gasto variable, este se queda en 0 y la tarjeta lo avisa: lo que pase de ahí sí sube el total.
- Indica el **día de la transferencia** en **Días de cargo**, justo debajo.
- Al importar el extracto, asigna la transferencia de cada uno a su partida **una vez**. La app recuerda la
  relación y pone el real cada mes. La reconoce por el texto exacto del movimiento: programa la
  transferencia periódica con el mismo concepto todos los meses. Si el banco le añade una referencia o una
  fecha que cambia, habrá que asignarla cada mes.

### Día de cargo de cada partida (Plan › Partidas)

La previsión día a día pone cada gasto el día del mes en que se cobra. Si no lo sabe, lo estima el
**día 8**, y **Plan › Previsión › Calidad de los datos** dice qué parte del gasto está en esa situación.
Para corregirlo, abre **Plan › Partidas › Días de cargo**. Las partidas van de mayor a menor gasto, y
en cada una eliges el día (1-31), **Fin de mes** o **Sin indicar** (vuelve a lo automático). Se guarda
al momento, viaja con la copia y la nube, y vale para todos los meses. Un 31 cae en el último día de
los meses cortos.

- Si en tus extractos ya se ve el cargo, la app te **propone** el día («Usar el día 12»). Las
  propuestas **fiables** (el mismo día ± 1 en el 80 % de 3 meses o más) se aplican todas con un botón.
- Si un mes llega el cargo real, **manda la fecha real** de ese mes; el día indicado vale para los
  meses sin cargo todavía.
- Un gasto que se reparte por todo el mes (súper, gasolina) no tiene día de cargo. La previsión lo
  pone entero en un solo día: el **día 1** es lo prudente.

### Acierto de la caja a fin de mes (Plan › Previsión)

Hoy la app mide cuánto se equivoca en cada categoría de gasto, pero no cuánto dinero hay a final de
mes, que es lo que importa. **Plan › Previsión › Acierto de la caja a fin de mes** lo mide solo, sin que
tengas que hacer nada más que abrir la app y cerrar el mes como siempre:

- **Los días 1 al 3 y 15 al 17 de cada mes**, al abrir la app, se **congela** cuánto dinero espera
  tener la previsión en CaixaBank y Mediolanum a fin de mes. La foto es de **solo añadir**: la primera
  de cada ventana se queda como está y nada la rehace, porque comparar con una previsión escrita
  sabiendo el resultado no mediría nada. Si no abres la app esos días, ese mes no tiene foto.
- **Al firmar el cierre** con los saldos del banco, se compara con lo que había en **la fecha de
  esos saldos**, aunque no sea el último día del mes. Se cuenta CaixaBank más Mediolanum (el efectivo
  no entra).
- **Hacen falta 3 cierres** para que salga un error medio. Con menos, la pantalla dice «Datos
  insuficientes» y no enseña ninguna cifra: sería precisión inventada. Con 6 cierres añade si el error
  **baja**, **sube** o se mantiene.
- «**Optimista**» quiere decir que la previsión esperaba más dinero del que hubo; «pesimista», menos.
- **Solo cuentan los saldos del banco.** Si la foto se hizo con los saldos en «Auto por fecha», o el
  cierre se firmó con saldos calculados por la app, esa fila **no cuenta** y la pantalla dice por qué.
  Para que cuente, declara los saldos reales en **Registrar › Saldo de cuentas** («Real manual»).

La pantalla solo mide: no cambia la previsión ni sus bandas. El primer cierre comparable es el de
octubre (del 1 al 3 de noviembre), si abres la app del 15 al 17 de octubre con los saldos reales
declarados. El primer error medio sale con el tercer cierre: **enero de 2027** si hay foto de octubre,
**febrero de 2027** si la primera foto es la del 1 de noviembre.

## 6. Copias, restauración y recuperación

### Descargar una copia completa

Desde **Ajustes › Datos y exportación**, **Descargar copia completa** guarda un fichero con versión y
huella de integridad. Trátalo como información financiera sensible.

### Recuperar una versión de Supabase

1. Pulsa **Buscar versiones en Supabase**.
2. Selecciona una versión y pulsa **Previsualizar versión**.
3. Compara cuentas, movimientos, deuda, proyectos y ajustes.
4. Confirma solo si la versión elegida es la correcta.

Restaurar no borra el historial: crea una revisión nueva idéntica al objetivo y actualiza el puntero
activo. Si existe un conflicto entre sesiones, descarga primero la copia que no quieras perder.

### Verificar copias

**Verificar copias** comprueba huellas y ensaya una muestra restaurable. La política protege
revisiones recientes, cierres, reaperturas, importaciones, deshacer y restauraciones. No elimina
copias automáticamente.

## 7. Trabajo sin conexión y entre dispositivos

- Después de una primera visita, el shell puede abrir sin conexión.
- Los cambios se conservan localmente y la cola pendiente sobrevive al cierre del navegador.
- Cuando vuelve la red, las revisiones pendientes se envían en orden y sin duplicados.
- Si dos dispositivos editan a la vez, una sesión obsoleta queda bloqueada para evitar sobrescrituras.
- Los adjuntos privados se cifran; la clave no se guarda ni sincroniza. Sin la clave no podrán
  descifrarse desde otro dispositivo.

Antes de cambiar de dispositivo, espera a que el indicador muestre **Sincronizado** o descarga una
copia (sección 6).

## 8. Rutinas recomendadas

### Revisión rápida semanal

1. Abrir **Hoy** y revisar alertas y cobertura.
2. Registrar saldos y reales pendientes en **Registrar**.
3. Importar movimientos recientes en **Movimientos**.
4. Revisar **Plan** para los dos meses siguientes.
5. Confirmar que el estado queda sincronizado.

### Cierre mensual

1. Importar el extracto completo del mes (**Registrar › Importar extracto**).
2. Registrar ingresos y gastos reales que falten.
3. Conciliar movimientos, saldos y reales en **Cierre**.
4. Revisar la previsión del mes siguiente en **Plan**.
5. Descargar evidencia o copia completa (sección 6).
6. Cerrar el mes con vista previa y confirmación.
7. Comprobar que la revisión queda sincronizada.

### Antes de una decisión importante

1. Actualizar saldos, deuda y previsiones.
2. Resolver avisos de calidad relevantes (sección 5).
3. Crear un escenario en el Laboratorio sin alterar el plan.
4. Comparar caja mínima, meses negativos, coste y recuperación — el escenario inverso y el Monte
   Carlo del Laboratorio ayudan a ver el margen real, no solo el caso central.
5. Conservar la simulación o exportar la información.
6. Aplicar la decisión desde la pantalla correspondiente (Deuda, Plan o Ajustes) solo cuando el
   simulacro confirme el resultado esperado.

## 9. Problemas frecuentes

| Problema | Comprobación o solución segura |
| --- | --- |
| Un real no aparece en el cálculo | Comprueba si la casilla quedó vacía; vacío usa el previsto y cero debe escribirse como `0` |
| Una previsión no se aplicó | Revisa el panel de cambios pendientes (`#cambios-pendientes`) y confirma el guardado |
| La sincronización no termina | Sigue trabajando localmente, revisa la conexión y no abras otra sesión para sobrescribir |
| Aparece un conflicto | Compara fechas y huellas; descarga una copia antes de elegir la versión local o remota |
| El extracto tiene duplicados | No confirmes la bandeja hasta revisar las coincidencias y el efecto mensual |
| El forecast queda bloqueado | Abre Cierre/Conciliación y revisa invariantes, paridad y datos incompletos |
| Una recomendación tiene confianza baja | Revisa histórico conciliado, fechas, campos desconocidos y supuestos manuales |
| No encuentras una pantalla | Usa el buscador `Cmd/Ctrl+K` (sección 1) en vez de navegar por la barra lateral |
| No puedes recuperar un adjunto cifrado | Utiliza la clave con la que se cifró; la aplicación no la almacena ni puede reconstruirla |

## 10. Funciones todavía no disponibles

Auditado contra el estado real del código el 5 de septiembre de 2026 — a diferencia de la versión
anterior de este manual, esta lista **no incluye** objetivos y calendario (E15), alertas predictivas
(E16) ni la aplicación de ofertas de deuda al plan real (E14b): las tres están construidas, verificadas
y en uso. Lo que sigue genuinamente pendiente:

- **Conexión bancaria PSD2 real** (`O-6`): bloqueada por la contratación de un proveedor externo
  (GoCardless cerró las altas en julio de 2025; desde octubre de 2026 se evalúa Enable Banking, ver
  `docs/ND13_SPIKE_CONEXION.md`), no por trabajo pendiente propio.
- **Asistente de IA en producción real** (`A5-1`): construido con backend privado propio, pero
  todavía no activo fuera de base local. Mientras tanto, la captura por voz y un puñado de tareas
  condicionadas (`DEX6`, `RGX3`) quedan a la espera de esa activación — el resto de la aplicación
  funciona con normalidad sin él.
- **Notificaciones por web push**: las alertas locales funcionan sin servicios externos; el envío
  push sigue desactivado.
- **Hogar compartido**: existe una pantalla mínima de miembros y simulacro de pérdida de acceso; no
  es todavía la integración completa (roles, permisos por titular) prevista originalmente.

La aplicación es plenamente utilizable sin estos servicios externos.

## 11. Regla de seguridad final

Antes de confirmar una importación, cierre, reapertura, restauración o cambio futuro:

1. revisa la vista previa;
2. comprueba la fecha y el titular;
3. verifica qué cifras cambian;
4. conserva una copia si la operación es importante;
5. confirma que el estado termina sincronizado.
