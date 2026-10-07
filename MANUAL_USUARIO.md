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

### Tarjetas de crédito (Plan › Partidas)

Con tarjeta de crédito, el dinero sale de tu cuenta el día del **cargo**, no el de la compra, y las compras
sueltas no aparecen en el extracto del banco: solo su liquidación. Para que la previsión lo sepa, cada
tarjeta tiene su **ciclo**. En **Plan › Partidas › Tarjetas de crédito** indicas, por tarjeta:

- **Fila donde se liquida:** la fila de Financiaciones donde ya registras el cargo de esa tarjeta.
- **Día de corte:** una compra hasta ese día (incluido) cierra el ciclo de su mes; una posterior, el del siguiente.
- **Se carga** y **día de cargo:** cuántos meses después del corte sale el dinero y qué día. «Último día del
  mes» vale para el corte y para el cargo.
- **Anoto desde (opcional):** la fecha desde la que empiezas a anotar compras de esa tarjeta.

Al guardar, la ficha te enseña un ejemplo («una compra del 15/10 se carga el …») para que compruebes el ciclo
de un vistazo. Si cambias el ciclo, las compras ya anotadas se reasignan solas.

Cómo funciona con las compras que anotas (la hoja, en la sección siguiente):

- Una compra va a la fila de su tarjeta **en el mes del cargo**. Mientras no llega el cargo del extracto, esa
  fila vale **lo mayor entre lo previsto y lo que llevas anotado**: un primer ticket no hunde la previsión
  del mes, y pasarte de lo previsto la sube.
- Cuando llega el cargo del extracto (o tecleas el real en Registrar), **manda el cargo**: las compras
  provisionales dejan de sumar y la ficha las compara: «tus compras suman X y el cargo fue Y: faltan Z
  (compras sin anotar, intereses o comisiones)».
- Un ciclo que **empezó antes de tu primera compra anotada** se marca como incompleto y no se compara, porque
  faltarían compras que la app nunca vio. Con «Anoto desde» puedes dar por completo un ciclo anterior.
- Los días de corte y de cargo se guardan en tu copia y en la nube, nunca en el código ni en el repositorio.

### Anotar una compra con tarjeta (la hoja)

Con al menos una tarjeta dada de alta, **«+ Registrar gasto»** en Hoy abre la **hoja de compra** (sin tarjetas abre la ventana de siempre):

1. **Importe** (el teclado numérico se abre solo; vale «23,40»).
2. **Concepto:** teclea o toca uno de los habituales (los más repetidos en los últimos 120 días, con prioridad a los de esta hora). Cada compra lleva su concepto.
3. **Tarjeta** (si solo hay una, ya está elegida; si no, se recuerda la última) y **fecha** (hoy, ayer u otra; no puede ser futura).
4. **Guardar**, o la tecla «Hecho» del teclado. La hoja dice antes de guardar **cuándo se carga** («Se carga el 05/12/2026») y, al guardar, **8 segundos para deshacer**.

Una compra no es un movimiento del banco: **no sale en Movimientos ni en el análisis**, no se concilia con el extracto y no crea una partida por ticket. Se **acumula en la fila de su tarjeta** en el mes del cargo (ver arriba). Si te equivocas pasados los 8 segundos, en **Plan › Partidas › Tarjetas de crédito › Compras anotadas** cada compra tiene su botón **Quitar** (y se puede deshacer).

Ahí mismo ves las compras **por tarjeta, ciclo y concepto**, de la más cara a la más barata, y dos medidas: la **mediana de segundos** que tardas en anotar una compra (objetivo ≤ 8 s) —frente a la de la ventana anterior, que también se mide— y el **% de compras que anotas el mismo día o el siguiente**. Hasta que no haya tiempos, la pantalla no afirma ninguna cifra.

- **Gasto sin tarjeta** (efectivo, transferencia): el enlace que hay al pie de la hoja abre la ventana anterior, que crea una partida con su real.
- **El enlace de registro** (Atajo de Apple Pay, WP-25) abre esta misma hoja rellena cuando hay tarjetas; el nombre que traiga en `tarjeta=` elige la tarjeta si coincide con una sola. **Nunca guarda solo.**
- Se guardan en tu copia y en la nube (almacén `card-purchases`), hasta las últimas 4.000 compras.

### Gasto variable del mes en curso

Al importar un extracto a mitad de mes, el **Gasto variable estimado** recibe solo lo gastado hasta ese día. Esa cifra
no es el total del mes, así que ya no sustituye a la previsión mientras el mes sigue abierto:

- **Mes en curso:** la partida vale lo **mayor entre lo previsto y lo real** que llevas. Si gastas más de lo previsto, sube; si
  llevas poco, no baja la previsión del mes. En **Registrar › Reales del mes** el valor usado lleva la marca «en curso».
- **«Real manual», mes de arranque:** vale **lo que falta por gastar** (previsto menos lo real, sin bajar de 0), porque lo ya
  gastado está dentro del saldo que declaraste.
- **Meses ya pasados** (aunque no estén firmados) y **el resto de partidas** no cambian: en ellos el real sigue sustituyendo
  al previsto.
- Si quieres dar por terminado el mes con un real menor que el previsto, firma el cierre del mes.

### Campaña fiscal de fin de año (Herramientas avanzadas › Fiscal)

La primera tarjeta de **Herramientas avanzadas › Fiscal** junta las decisiones de diciembre que ahorran impuestos: **aportar al plan de pensiones, llenar el tope de la deducción por vivienda, compensar plusvalías con minusvalías, donativos** y **ajustar la retención**. Cada acción trae su ahorro estimado en euros (por declarante, porque se tributa por separado), su fecha límite y, plegado, el detalle y la fuente.

- **Mientras no haya tus datos fiscales, lo que ves es un ejemplo.** La tarjeta lo marca de cinco maneras: etiqueta «Ejemplo», un aviso, borde discontinuo con sombreado diagonal, y un subrayado punteado en cada cifra. Son cifras de un hogar ficticio: no son las tuyas. Cuando entregues tus datos, el ejemplo se sustituye y las marcas desaparecen.
- **Si falta un dato, la acción dice cuál y no se calcula**: nunca una cifra inventada.
- La lista va ordenada por euros ahorrados. «Ahorrar impuestos» no es «coste cero»: aportar a un plan de pensiones inmoviliza el dinero, y la tarjeta muestra también el coste real.
- **Ajustar la retención** se presenta como caja, no como ahorro, y rinde en 2027: pedirla ahora solo alcanza a las nóminas que quedan de 2026.
- Los parámetros legales (límites, topes, porcentajes) están todavía **pendientes de contrastar con la fuente oficial**; la tarjeta lo dice. Es una estimación: confirma cada acción con un asesor antes de actuar. La app nunca aporta, amortiza, vende ni dona por ti.

### «¿Ha llegado…?»: cobros esperados y cargos que no llegaron (Hoy › Bandeja)

La **bandeja de decisiones de Hoy** pregunta por lo que se esperaba y no ha aparecido:

- **Un cobro** (p. ej. la nómina), **dos días después** de su fecha: «¿Ha llegado «Nómina Javi»?». Respuestas: **Sí, por el importe previsto** (registra el real, como en Registrar el mes) · **Sí, otro importe** (te pide el importe, con coma española) · **Aún no** (calla 2 días y vuelve a preguntar; mientras tanto la previsión diaria cuenta el cobro ese día, no el original).
- **Un cargo** (p. ej. un seguro): ««Seguro del coche» no ha llegado», con las fechas de sus últimos cargos para ver el patrón. Respuestas: **Se ha dado de baja** (los meses siguientes dejan de contar en la previsión) · **Ha cambiado de cuenta** (no se vuelve a preguntar por ese recibo; la salida sigue en la previsión) · **Llegará tarde** (calla 3 días; la previsión diaria cuenta el cargo ese día) · **Ya está pagado de otra forma** (registra el real). Si es una póliza o una domiciliación, mira que no se haya quedado sin pagar.
- Cada respuesta con efecto da un aviso de **Deshacer** unos segundos.

Lo que **no** pregunta, a propósito:

- **Partidas con la fecha estimada** (el 8 de relleno): «no ha llegado» sería mentira. Solo pregunta por fechas fijadas por regla (las nóminas y el local) o por **día de cargo que tú has indicado** en Plan › Partidas. Cuantos más días de cargo declares, más recibos vigila.
- **Cargos, si no has importado el extracto hasta ese día.** Sin extracto al día, «no aparece» no quiere decir «no ha llegado»: puede ser que no lo hayas importado. Por eso la vigilancia de cargos solo funciona si importas extractos con regularidad. Los **cobros** sí se preguntan siempre: tu respuesta es la forma más barata de registrarlos.
- Lo que ya tiene un real registrado o un movimiento importado que coincide, el gasto variable y lo que ya respondiste.
- Como mucho **5 preguntas** a la vez; las demás esperan.

### Recordatorios en el calendario del móvil (Ajustes)

**Ajustes › Recordatorios en el calendario del móvil** genera un fichero `.ics` con avisos **en el momento en que sirven**, no a horas fijas:

- **Dos días antes de cobrar:** «Cobro en 2 días: actualizad saldos». Con los saldos al día, Hoy puede decir cuánto se gasta.
- **El día después de un cargo grande** (desde 500 €, editable): comprobad que ha llegado y actualizad el saldo.
- **El día 1:** cerrad el mes (la ventana de cierre es del 1 al 3).
- **Campaña fiscal:** 1/12 (mirad la lista) y 20/12 (últimas decisiones).
- **Revisión del tipo de la hipoteca:** 60 y 30 días antes de la fecha que guardaste en Deuda › Contratos. El título no lleva importes; la cuota estimada de A a B va en el detalle. Si la fecha que guardaste ya pasó, usa la siguiente (cada 6 o 12 meses). Solo sale si has rellenado los datos de la revisión.

Cómo se usa: pulsa **«Descargar recordatorios (.ics)»** y abre el fichero desde el móvil; el calendario te pregunta si lo añade. Cada aviso suena a las 9:00 del día.

- **No es un calendario que se actualice solo.** Esta web es pública y estática: una dirección con vuestras finanzas no puede existir. El fichero se genera en este dispositivo con la previsión de hoy. **Cuando cambie el plan, descárgalo otra vez**: los avisos que siguen valiendo se actualizan, pero **los que ya no valen no se borran** (un `.ics` no puede borrar nada): bórralos a mano. La tarjeta te dice cuándo regenerarlo (nunca generado, más de 30 días, o menos de un mes por delante).
- **Solo avisa de lo que el plan sabe con seguridad.** Un cobro o un cargo con el día estimado (el 8 de relleno) no genera aviso: caería en un día cualquiera. La tarjeta dice cuántos se quedan fuera; declara el día de cargo en Plan › Partidas y entrarán.
- **Los títulos no llevan importes ni nombres**, para que no se vean en la pantalla de bloqueo; el detalle (importe, concepto) sale al abrir el evento.

### Índices de referencia: Euribor, €STR e IPC (Deuda › Contratos)

La tarjeta **«Índices de referencia»** de **Deuda › Contratos** guarda los tres índices que la app necesita para la hipoteca variable y, más adelante, para comparar dónde poner el próximo euro. **Los tecleas tú, con la fecha a la que se refiere el dato**: la app **no consulta ninguna fuente externa** (esa decisión es del 16/10/2026).

- **Cada valor caduca.** Euribor 12 meses: a los 35 días; €STR: a los 10; IPC: a los 75. Pasado el plazo la tarjeta dice «Caducado (hace N días)» y pide el último publicado, en vez de usar un tipo viejo como si fuera el de hoy. Son plazos de criterio, no de mercado.
- **Pon la fecha del dato, no la de hoy**, si no coinciden: el Euribor del 1 de octubre tecleado el día 7 es del día 1. Un segundo valor con la misma fecha sustituye al primero.
- **La coma importa.** Escribe `2,35` (también vale `2.35` y `-0,5`). Un valor fuera de lo razonable (por ejemplo `23,5`) se rechaza y te avisa de revisar la coma.
- **Historial y «Quitar».** Se conservan los últimos 120 valores de cada índice y puedes quitar uno tecleado por error.
- **Va en la copia de emergencia**, porque son datos públicos y sin importes del hogar.
- **Pendiente de unificar:** el campo «Euribor actual» del radar de refinanciación (Ajustes) sigue siendo un campo aparte con su propia fecha mensual. Hoy hay que teclear el Euribor en los dos sitios.

### Revisión del tipo variable de la hipoteca (Deuda › Contratos)

La tarjeta **«Revisión del tipo variable de la hipoteca»**, justo debajo de los índices, responde tres preguntas antes de que llegue la carta del banco: **¿cuándo es la próxima revisión?**, **¿qué dato del Euribor se leerá?** y **¿entre qué cuotas caerá la nueva?**

Cómo se usa:

1. Da de alta la hipoteca en la tabla de arriba (tipo «Hipoteca», con capital pendiente, cuota y plazos restantes o vencimiento). La tarjeta los lee de ahí; no se escriben dos veces.
2. Teclea el último **Euribor 12 meses** en «Índices de referencia» (con su fecha).
3. En la tarjeta, rellena lo que dice tu contrato o la última carta de revisión: **diferencial**, **fecha de la próxima revisión**, cada cuánto se revisa (12 o 6 meses), la **regla del Euribor** (media mensual de N meses antes, o valor de un día, con cuántos días antes) y, si lo sabes, el **tipo aplicado actualmente** y la **bonificación** incluida en el diferencial.

Qué te enseña:

- **La fecha y lo que se leerá**, por ejemplo: «la media mensual del Euribor de febrero de 2027».
- **La cuota estimada «de A a B»**: el tipo central es el último Euribor tecleado más tu diferencial; A y B son ese tipo **menos y más un punto**. El capital y los plazos se proyectan hasta la fecha de revisión si indicas el tipo aplicado.
- **Si pierdes la bonificación**, la cuota con ese punto más.
- **Avisos a 60 y 30 días antes**. Dentro de esos plazos aparece también una pregunta en la bandeja de Hoy; antes, no sale nada.

Lo que **no** es: **una estimación, no un pronóstico.** No sabe qué hará el Euribor: lo deja donde lo tecleaste y lo mueve un punto arriba y abajo como rango. Solo cubre el **Euribor a 12 meses** (no IRPH ni otros índices). Si la fecha que guardaste ya pasó, la tarjeta la desplaza por periodos completos y te lo dice: compruébalo con la carta del banco. Con un Euribor caducado, avisa. No ejecuta nada. **Los avisos también van al calendario del móvil:** en Ajustes › Recordatorios, descarga el fichero de nuevo y traerá los de 60 y 30 días. Con el botón «Ver un ejemplo» ves la tarjeta con cifras inventadas, marcadas como tal.

### Banda de caja a 30 días (Plan › Previsión)

Una línea de previsión finge saber el día de cada recibo. La tarjeta plegada **«Banda de caja a 30 días»** (Plan › Previsión) dice lo que sí se sabe: simula 500 formas posibles de que caigan los pagos cuyo día **no** conoces y te da tres cosas.

- **La banda:** el 80 % de las trayectorias queda dentro de la zona sombreada (P10-P90); la línea es la mediana. Una raya discontinua marca tu **suelo de liquidez** (Ajustes).
- **La probabilidad de bajar del suelo:** «En 3 de cada 10 trayectorias la liquidez baja del suelo entre el 8 y el 12 de noviembre». Es probabilidad, no calendario: no dice qué día cae cada recibo. Si declaras el día de cargo de una partida (Plan › Partidas), deja de ser incierta y la banda se estrecha.
- **El día más probable del mínimo** (o «el punto más bajo es el saldo de hoy», si ningún día baja de ahí).
- Se recorre con el dedo, el ratón o las flechas (como el cono de escenarios) y **«Ver como tabla»** da los 31 días, con la trayectoria «según el plan» al lado.
- **Cuándo no informa:** si el 70 % o más de lo que se mueve tiene fecha estimada, la tarjeta dice que la banda es ancha: sirve para ver cuánto puede variar la caja, poco para saber en qué día.
- **Lo que no cubre:** solo recoge la incertidumbre de las **fechas**, no la de los **importes** (un gasto que salga más caro). Y parte de tus saldos declarados: si son de hace días, la banda se ensancha por los días sin declarar; si son calculados (no «Real manual»), te lo dice.

### Leer un gráfico (cono de previsión)

El cono de **Escenarios › Análisis avanzado › Bandas de confianza** se lee de tres maneras, sin necesidad de ratón:

- **Con el dedo:** apoya y desliza en horizontal por el dibujo; una raya marca el mes y **la lectura aparece fija debajo** (mes, P10, P50 y P90). Si deslizas en vertical, la página sigue desplazándose como siempre.
- **Con el ratón:** pasa por encima, sin pulsar.
- **Con el teclado:** tabula hasta el gráfico y usa **← →** (mes a mes), **Inicio** / **Fin** (primer y último mes) o **Re Pág** / **Av Pág** (saltos de unos tres meses). El lector de pantalla dice cada lectura.
- **«Ver como tabla»** (bajo el gráfico) da los mismos números en una tabla, mes a mes, con el margen.
- Mientras no haya histórico conciliado suficiente, la banda tiene **ancho cero** y el cono es una línea: no se inventa un margen.

### Valoración de la cartera (Inversión › Cartera)

Hasta ahora una posición solo se podía añadir o quitar: su valor era el del día del alta. **Inversión › Cartera › Valoración de la cartera › «Actualizar valoración»** abre una hoja con **una fila por posición, las más antiguas primero**:

- **Fecha** de la valoración (hoy por defecto; ayer u otra fecha, nunca futura).
- **Valor nuevo (€)** de cada posición (vale «1.234,56»). **Una fila vacía no cambia**; **un 0 significa que vale cero** y pide confirmación.
- **«Sin cambios»** conserva el valor y renueva la fecha: es lo habitual cuando una posición apenas se ha movido.
- **Variación de mercado:** la hoja no te dice «+500 €» cuando has aportado 500 €. Descuenta las aportaciones y las ventas registradas desde la valoración anterior: **valor nuevo − valor anterior − aportaciones netas**.
- **Avisos que piden confirmar** (casilla «Es correcto»): un 0, una variación de mercado de más del 20 % (40 % en cripto) y un cambio por un factor de 100 o más («¿falta o sobra una coma?»).
- **Guardar** (o la tecla «Hecho» del teclado) actualiza el valor, la fecha y la procedencia («declarado») de cada posición, repinta la cartera, el XIRR, la concentración y el apalancamiento, y deja **8 segundos para deshacer**.
- **Una fecha anterior** a la última valoración de una posición solo añade un **punto histórico**: no cambia su valor actual. Sirve para empezar la serie con valoraciones pasadas que tú teclees; la app no reconstruye nada por su cuenta.

Cada valoración queda en una **serie con fecha** (hasta 500 puntos; los de más de 24 meses se reducen a uno por mes) en tu copia y en la nube. Las instantáneas de «cierre de mes» de antes repiten el valor del alta y no forman una serie: no se mezclan.

**Frescura:** cada posición dice «valorada hace N días» y la tarjeta cuenta cuántas están al día (35 días o menos). **El cierre de mes te avisa**, sin impedirlo, si alguna lleva más tiempo sin valorarse. El ritmo recomendado es una vez al mes, junto con los saldos del cierre (1-3).

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
