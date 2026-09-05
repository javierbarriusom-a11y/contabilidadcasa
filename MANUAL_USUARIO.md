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
  (candidato evaluado: GoCardless), no por trabajo pendiente propio.
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
