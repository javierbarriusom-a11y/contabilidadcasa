# Manual de usuario de Finanzas Casa

Fecha de revisión: 2 de agosto de 2026.

Este manual explica cómo trabajar con las funciones disponibles y verificadas hasta E14a. Está pensado
para el uso cotidiano del hogar, sin necesidad de conocer la arquitectura técnica de la aplicación.

> **Alcance actual:** el forecast y los escenarios avanzados están disponibles; el plan visual de deuda
> ya puede leer los datos canónicos, pero todavía no puede aplicar ofertas o estrategias al plan real.
> Esa aplicación segura forma parte de E14b y continúa pendiente.

## 1. Antes de empezar

### Abrir la aplicación

La aplicación puede utilizarse de tres formas:

1. En la versión privada conectada a Supabase, iniciando sesión con el usuario del hogar.
2. En local, abriendo el proyecto desde un servidor web.
3. En la demostración pública de GitHub Pages, que contiene únicamente datos sintéticos.

No introduzcas datos personales reales en una demostración compartida. Para trabajar con información
financiera real, usa la sesión privada o una copia local controlada.

### Comprobar el estado de guardado

Antes de editar, mira el indicador de estado situado en la parte superior. Puede mostrar:

| Estado | Significado | Qué hacer |
| --- | --- | --- |
| Guardado local | Los cambios están conservados en este navegador | Puedes seguir trabajando; sincroniza cuando recuperes la conexión |
| Pendiente remoto | Existe una revisión esperando enviarse a Supabase | Mantén la pestaña abierta si puedes y revisa la conexión |
| Sincronizado | La copia local y la remota coinciden | Puedes cerrar con normalidad |
| Conflicto | Otra sesión ha publicado una revisión diferente | No sobrescribas; compara las copias y elige conscientemente cuál recuperar |

La aplicación carga primero la copia local. Un fallo de red no impide consultar ni editar, pero los
cambios no estarán disponibles en otros dispositivos hasta completar la sincronización.

### Elegir el ámbito familiar

Cuando aparezca el selector, elige `Hogar`, `Javi` o `Tere`. Este filtro cambia la lectura de ingresos,
gastos, margen y decisiones, pero no borra los datos de los otros titulares.

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

Regla práctica: **vaciar un real recupera el previsto; escribir `0` registra un real de cero euros**.

## 3. Recorrido recomendado

Para el trabajo normal sigue este orden:

1. Abre **Hoy** para detectar lo que necesita atención.
2. Entra en **Actualizar** y elige el tipo de dato que vas a poner al día.
3. Registra saldos, ingresos, gastos o movimientos.
4. Abre **Conciliación** para comprobar que banco, reales y saldos cuentan la misma historia.
5. Revisa **Previsión** y **Proyección**.
6. Usa **Deuda y proyectos** o el **Simulador** para comparar decisiones sin modificar el plan.
7. Revisa el estado de sincronización antes de cerrar.

## 4. Pantalla Hoy

**Hoy** es la portada de trabajo. Resume:

- cobertura hasta el siguiente ingreso;
- liquidez, reserva y capacidad libre;
- tres decisiones priorizadas;
- próximos hitos y meses a vigilar;
- lectura del hogar o titular seleccionado;
- alertas y calidad de los datos utilizados.

Utiliza los botones de cada tarjeta para ir a saldos, flujo, reserva, previsión, ahorro o comparación.
Las recomendaciones muestran fuente, fecha, método, cobertura y confianza. Una confianza baja indica que
faltan datos o histórico suficiente; no debe interpretarse como una certeza.

## 5. Actualizar datos

La portada **Actualizar** ofrece seis rutas.

### 5.1 Actualizar saldos de cuentas

1. Pulsa **Saldo actual — Actualizar mis cuentas**.
2. Comprueba la fecha del análisis y los saldos de CaixaBank y Mediolanum.
3. Introduce el saldo real de cada cuenta.
4. Comprueba que los resultados y mínimos se recalculan.

El saldo real se guarda al introducirlo. Utiliza siempre la fecha a la que corresponde, especialmente
si estás copiándolo desde una aplicación bancaria.

### 5.2 Registrar ingresos y gastos reales

1. Pulsa **Lo ocurrido — Registrar ingresos y gastos reales**.
2. Localiza el concepto y el mes.
3. Introduce el importe en la columna de real.
4. Revisa las columnas `Previsto`, `Real` y `Usado`.

Los reales se guardan automáticamente y no aparecen en el panel de cambios futuros. Si corriges una
casilla, la nueva cifra sustituye al real anterior dentro de una revisión recuperable.

### 5.3 Cambiar previsiones futuras

1. Pulsa **Plan futuro — Cambiar previsiones**.
2. Modifica el importe previsto o utiliza **Añadir línea** para crear una partida.
3. Pulsa **Preparar cambio pendiente** cuando utilices el ajuste rápido.
4. Revisa el resumen de diferencias.
5. Pulsa **Guardar cambios** para aplicarlas.

A diferencia de los reales, las previsiones no se aplican al abandonar una casilla. Permanecen como
cambios pendientes hasta confirmar el guardado. **Descartar** elimina únicamente ese borrador.

### 5.4 Importar o revisar movimientos

1. Entra en **Movimientos** desde Actualizar.
2. Selecciona el extracto bancario Excel compatible.
3. Revisa fecha, concepto, importe, saldo y clasificación detectada.
4. Confirma la incorporación desde la bandeja previa cuando se muestre.
5. Ve a **Conciliación** para resolver movimientos sin clasificar o diferencias.

La aplicación admite el formato de extracto con `Fecha`, `Fecha valor`, `Movimiento`, `Más datos`,
`Importe` y `Saldo`. La importación actualiza el último saldo real cuando puede identificarlo.

### 5.5 Cargar CSV, Excel o tablas pegadas

En **Carga de datos** puedes añadir una línea manual, pegar una tabla o importar un fichero.

1. Mantén activa la **Bandeja**.
2. Elige el tipo de dato y la fuente.
3. Pega la tabla o selecciona el fichero.
4. Revisa columnas detectadas, altas, cambios, duplicados, bajas y efecto mensual.
5. Confirma solo si la comparación es correcta.
6. Conserva el recibo de la actualización.

Nada entra en el libro desde la bandeja sin comparación y confirmación. **Deshacer último lote** crea una
revisión nueva; no borra el historial de la operación.

### 5.6 Conciliar y cerrar el mes

1. Abre **Conciliación**.
2. Pulsa **Recalcular** y revisa paridad, saldos e invariantes.
3. Resuelve las tareas de movimientos sin clasificar, saldos discontinuos o reales incoherentes.
4. Descarga la evidencia si necesitas conservar una copia del control.
5. Pulsa **Cerrar mes actual** únicamente cuando los datos reales estén completos.
6. Revisa la vista previa y confirma.

Cerrar un mes congela sus reales, crea auditoría y arrastra al mes siguiente solo las previsiones que
correspondan. **Reabrir último mes** exige un motivo y crea una revisión nueva; no elimina el cierre previo.

## 6. Previsión, proyección y ahorro

### Previsión mensual

Muestra la lectura mensual de ingresos, gastos, ahorro y saldos. Úsala para comprobar importes cercanos
y detectar meses con caja insuficiente.

### Proyección de liquidez

Presenta la evolución futura de la liquidez. Consume el forecast canónico, por lo que comparte la misma
base que las demás vistas. Si aparece un bloqueo de paridad, revisa los datos e invariantes antes de usar
la proyección para decidir.

### Plan ahorro

Compara el ahorro actual, corriente y aconsejable. Los supuestos son ajustables y el horizonte lejano se
muestra mediante bandas cuando no existe evidencia suficiente para una cifra exacta.

### Flujo mensual

Permite revisar el flujo de caja por años y meses y descargarlo como CSV. Es útil para análisis externo o
para compartir una copia sin entregar acceso a toda la aplicación.

## 7. Escenarios y simulaciones

### Laboratorio Deuda y proyectos

Permite comparar escenarios base, favorable y de tensión e introducir eventos como:

- pérdida temporal de ingresos;
- subida de gastos;
- avería o gasto extraordinario;
- coche o mudanza;
- nueva deuda;
- ingreso extraordinario.

Indica importe, fecha y duración. Compara caja mínima, meses negativos, ahorro, deuda y tiempo de
recuperación. La simulación prudente puede mostrar percentiles, tamaño de muestra y reglas de correlación.

Puedes guardar un escenario y recalcular una copia con datos nuevos. El original se conserva.

> **Importante:** simular o guardar un escenario no modifica el plan financiero vigente. La promoción
> confirmada de un escenario al plan todavía no está disponible.

### Simulador de decisiones

Ofrece variantes `Base`, `Prudente` y `Ahorro alto`, además de proyectos e imprevistos. Utiliza
**Comparar plan** para revisar el efecto antes de tomar una decisión.

## 8. Deuda y decisiones familiares

### Plan familiar

Reúne deuda, coche y estabilidad. Muestra alternativas familiares, impacto mensual por cuenta y una
explicación de la ruta recomendada. **Restablecer** devuelve los supuestos de esa vista a su punto inicial.

### Control de deuda

Muestra deuda por entidad y producto y permite comparar liquidación o refinanciación. Primero utiliza
**Comparar decisión**; una comparación no aplica por sí sola ningún cambio.

### Plan visual de deuda

El plan visual recibe en modo de solo lectura los saldos, contratos, capacidad y forecast canónicos.
Puedes trabajar con sus tareas, notas y supuestos propios, que sí forman parte de las copias versionadas.

Actualmente no debes utilizar el plan visual para aplicar automáticamente una oferta o estrategia al
plan financiero. Ofertas, optimización con restricciones, integración completa con escenarios y
aplicación confirmada corresponden a E14b.

### Vistas de apoyo

- **Asesor ejecutivo:** ordena decisiones inmediatas y presenta la agenda ejecutiva.
- **Asesor virtual:** reúne decisiones preparadas para comparar; no ejecuta servicios externos de IA.
- **Plan deuda óptimo:** muestra una ruta propuesta para salir de deuda sin perder estabilidad.
- **Agente ahorro:** combina agenda de caja, reglas de ahorro y candidatas de liquidación.

Las recomendaciones son apoyo a la decisión. Los efectos legales y fiscales son informativos y deben
contrastarse con un profesional cuando una operación tenga consecuencias jurídicas o tributarias.

## 9. Alertas, calidad y auditoría

### Centro de alertas

Permite crear, editar, pausar, reactivar y eliminar reglas con umbral, frecuencia y acción recomendada.
Las alertas locales funcionan sin activar servicios externos. Web push continúa desactivado.

### Datos y auditoría

Utiliza esta pantalla para consultar:

- procedencia y certeza de los datos;
- campos conocidos y desconocidos de deuda;
- movimientos sin clasificar y saldos discontinuos;
- historial de sincronizaciones, cierres, restauraciones y conflictos;
- controles automáticos y rendimiento.

**Reconstruir índice** rehace el índice de consulta; **Descargar inventario** genera una evidencia del
estado conocido. Ninguna de estas acciones corrige automáticamente cifras financieras.

## 10. Copias, restauración y recuperación

### Descargar una copia completa

1. Abre **Carga de datos**.
2. Pulsa **Descargar copia completa**.
3. Guarda el fichero en una ubicación privada.

La copia incluye una versión y una huella de integridad. Trátala como información financiera sensible.

### Recuperar una versión de Supabase

1. Pulsa **Buscar versiones en Supabase**.
2. Selecciona una versión y pulsa **Previsualizar versión**.
3. Compara cuentas, movimientos, deuda, proyectos y ajustes.
4. Confirma solo si la versión elegida es la correcta.

Restaurar no borra el historial: crea una revisión nueva idéntica al objetivo y actualiza el puntero
activo. Si existe un conflicto entre sesiones, descarga primero la copia que no quieras perder.

### Verificar copias

**Verificar copias** comprueba huellas y ensaya una muestra restaurable. La política protege revisiones
recientes, cierres, reaperturas, importaciones, deshacer y restauraciones. No elimina copias automáticamente.

## 11. Trabajo sin conexión y entre dispositivos

- Después de una primera visita, el shell puede abrir sin conexión.
- Los cambios se conservan localmente y la cola pendiente sobrevive al cierre del navegador.
- Cuando vuelve la red, las revisiones pendientes se envían en orden y sin duplicados.
- Si dos dispositivos editan a la vez, una sesión obsoleta queda bloqueada para evitar sobrescrituras.
- Los adjuntos privados se cifran; la clave no se guarda ni sincroniza. Sin la clave no podrán descifrarse
  desde otro dispositivo.

Antes de cambiar de dispositivo, espera a que el indicador muestre **Sincronizado** o descarga una copia.

## 12. Rutinas recomendadas

### Revisión rápida semanal

1. Abrir **Hoy** y revisar alertas y cobertura.
2. Actualizar saldos reales.
3. Importar movimientos recientes.
4. Clasificar diferencias importantes.
5. Revisar previsión de los dos meses siguientes.
6. Confirmar que el estado queda sincronizado.

### Cierre mensual

1. Importar el extracto completo del mes.
2. Registrar ingresos y gastos reales que falten.
3. Conciliar movimientos, saldos y reales.
4. Revisar la previsión del mes siguiente.
5. Descargar evidencia o copia completa.
6. Cerrar el mes con vista previa y confirmación.
7. Comprobar que la revisión queda sincronizada.

### Antes de una decisión importante

1. Actualizar saldos, deuda y previsiones.
2. Resolver avisos de calidad relevantes.
3. Crear un escenario sin alterar el plan.
4. Comparar caja mínima, meses negativos, coste y recuperación.
5. Conservar la simulación o exportar la información.
6. Aplicar manualmente solo las decisiones soportadas y confirmables en la versión actual.

## 13. Problemas frecuentes

| Problema | Comprobación o solución segura |
| --- | --- |
| Un real no aparece en el cálculo | Comprueba si la casilla quedó vacía; vacío usa el previsto y cero debe escribirse como `0` |
| Una previsión no se aplicó | Revisa el panel de cambios pendientes y pulsa **Guardar cambios** |
| La sincronización no termina | Sigue trabajando localmente, revisa la conexión y no abras otra sesión para sobrescribir |
| Aparece un conflicto | Compara fechas y huellas; descarga una copia antes de elegir la versión local o remota |
| El extracto tiene duplicados | No confirmes la bandeja hasta revisar las coincidencias y el efecto mensual |
| El forecast queda bloqueado | Abre Conciliación y revisa invariantes, paridad y datos incompletos |
| Una recomendación tiene confianza baja | Revisa histórico conciliado, fechas, campos desconocidos y supuestos manuales |
| La interfaz parece antigua tras una actualización | Recarga una vez para que el nuevo shell offline tome el control |
| No puedes recuperar un adjunto cifrado | Utiliza la clave con la que se cifró; la aplicación no la almacena ni puede reconstruirla |

## 14. Funciones todavía no disponibles

No deben darse por terminadas ni utilizarse como si estuvieran activas:

- aplicación automática y recuperable de una estrategia de deuda u oferta negociada;
- optimización completa de deuda con restricciones reales dentro del plan;
- retirada definitiva del plan visual en `iframe`;
- objetivos y calendario financiero integrados de E15;
- alertas predictivas y explicación continua de errores de E16;
- navegación simplificada definitiva de E17;
- backend privado de IA, hogar compartido, web push y conexión bancaria PSD2 de E10.

La aplicación sigue siendo plenamente utilizable sin estos servicios externos.

## 15. Regla de seguridad final

Antes de confirmar una importación, cierre, reapertura, restauración o cambio futuro:

1. revisa la vista previa;
2. comprueba la fecha y el titular;
3. verifica qué cifras cambian;
4. conserva una copia si la operación es importante;
5. confirma que el estado termina sincronizado.

