# Propuesta de la séptima auditoría — 17 de octubre de 2026

> **Estado: propuesta pendiente de decisión del hogar. No activa nada.** El único backlog vivo sigue siendo `BACKLOG_DEFINITIVO.md` y el plan, `docs/plan/plan-definitivo.json`. Este documento analiza el artefacto «Backlog cierre octubre» y la sesión que lo generó, propone cómo mejorar ese backlog y añade un catálogo de 57 funciones nuevas (identificadores `X..-nn`), cruzadas contra el código y contra las 104 propuestas ya catalogadas. Ninguna cifra real del hogar aparece aquí: los importes de los ejemplos son inventados. Su lugar en el mapa de backlogs está en `BACKLOG_INDICE.md`. Versión para leer en el móvil: el artefacto privado «Séptima auditoría de producto».

## 1. Veredicto

Contabilidadcasa tiene el motor financiero de una app profesional y el uso de un prototipo. Antes de añadir funciones hay que hacer tres cosas: que los datos lleguen solos, medir sin rituales y cerrar lo empezado. Por eso el catálogo de abajo empieza por datos y plataforma, y casi todo lo nuevo nace apagado, en un Laboratorio, con su métrica y su fecha de retirada.

| Cifra | Qué es | Por qué importa |
|---|---|---|
| **60** | vistas en index.html | Más de las que un hogar puede recorrer; al menos 9 tocan la deuda. |
| **110** | motores canonical-*.js | Más 52 scripts de pantalla y 540 ficheros de prueba. |
| **0 de 10** | métricas del plan leídas con datos reales | Todas las lecturas son de la demo o de pruebas. |
| **54** | líneas de margen en app.js | 37.441 de un techo de 37.495: el próximo paquete no cabe. |

## 2. Siete hallazgos

1. **Se construye más deprisa de lo que el hogar puede usar.** Entre el 7 y el 17 de octubre se fusionaron 46 commits (15 PR, del #497 al #511) y el avance ponderado del plan sigue en 61,4 %. Todo ese trabajo fue a incrementos dentro de paquetes «en curso», no a terminar paquetes. Hay 26 paquetes en curso a la vez, cada uno con una segunda entrega esperando algo del hogar. El propio estado lo admite varias veces: «el 50 % sobrepuntúa».
2. **Una prueba de 20 minutos bloquea medio plan.** La prueba cronometrada de Hoy (H-02, prevista el 9/10) no consta hecha. Mientras no se lea, Hoy está congelado y no pueden salir las entregas que llevan algo a Hoy o a la bandeja: anomalías (WP-36), plan B (WP-38), CIRBE (WP-40), deuda en la sombra (WP-41), tres capas (WP-35) y otras. El camino crítico del producto es un ritual manual, no el desarrollo.
3. **Construido no es comprobado.** De los paquetes hechos, ninguno tiene su métrica leída con datos del hogar. M-HOY, M-SALDOS, M-CAPT, M-RESOL, M-CALIB e M-INV dependen de que se teclee algo. La última medición real (2/10) encontró el 100 % de las fechas de la previsión estimadas. Mejorar los modelos de previsión sin datos frescos es pulir un motor sin gasolina.
4. **Cada función nueva es una obligación nueva.** Saldos tres veces por semana, extracto, valoración mensual de la cartera, Euribor, €STR, IPC, índice de vivienda, CIRBE anual, datos fiscales, nóminas, contratos, tarjetas, días de cargo, probabilidad de cada ingreso, política de inversión, plan B. Nadie suma su coste. GOV-01 fija 10 minutos a la semana, pero se mide preguntando, y por función no se sabe lo que cuesta.
5. **La navegación refleja cómo se construyó, no cómo se piensa.** «Repartir la nómina» y «¿Dónde va el próximo euro?» viven en Deuda › Comparar; «Patrimonio neto» y «Vivienda por índice» en Inversión › Cartera; la política de inversión en Rebalanceo; el apalancamiento al mismo nivel que la cartera. El hogar no busca módulos: busca respuestas a cinco preguntas.
6. **El rigor es la ventaja, y también la pared.** Las reglas de honestidad (vacío no es cero, no inventar cifras, decir lo que falta) son lo mejor del producto y lo que lo distingue de cualquier app comercial. Con pocos datos, el efecto es una pared de tarjetas «sin datos», «incompleto» o «ejemplo» que hace que la app parezca rota. Falta la activación progresiva: que lo que no tiene datos no ocupe pantalla.
7. **Deuda técnica que va a frenar justo las áreas que se quieren ampliar.** Siguen conviviendo varios motores de deuda (el antiguo de la hoja de ruta, E14 y E19; NTC-05, la fecha para retirar el doble motor, está en P3). Cualquier función nueva de deuda se programaría dos veces o daría cifras distintas según la pantalla. A eso se suma el techo de app.js y un fallo intermitente del CI que no deja ver su causa.

## 3. Cómo mejoraría el backlog de octubre

| Lo que dice el artefacto | Problema | Cambio propuesto |
|---|---|---|
| P1: cerrar WP-41 PR-4 (lista de cargos mensuales sin marcar). | La propia lectura crítica del documento dice que no tiene evidencia y puede ser ruido. Son 32 minutos de CI y una tarjeta más que vigilar. | Bajarla a P3. Publicarla dentro del Laboratorio (XGO-03) o dejarla en la rama hasta tener un extracto real. |
| P2 y «necesita tu OK»: que el CI deje ver por qué falla una prueba. | Cada fallo intermitente cuesta al menos 32 minutos y no deja causa. Es la única deuda con interés compuesto de la lista. | P1. Subir el informe y las trazas de Playwright como artefacto del CI solo cuando hay fallo. No cambia ningún umbral. |
| Prueba cronometrada del 9/10 «sin constancia»; Hoy congelado hasta leerla. | Un ritual manual de tres pruebas bloquea Hoy y las segundas entregas de unos diez paquetes desde hace ocho días, sin fecha límite ni alternativa. | Subir UXS-03 (medición automática del tiempo de cada tarea) a P0 para que la línea base de M-HOY salga del uso real. Si se prefiere la prueba, ponerle fecha dura (24/10) y una versión de dos minutos. |
| «Plan ponderado: 61,4 %». | Cuenta los 26 paquetes en curso al 50 %. En diez días y quince PR no se movió. La cifra mide actividad, no avance. | Dar dos cifras: avance construido (61,4 %) y avance comprobado (paquetes con su métrica leída con datos reales: 0). Crear el estado «esperando al hogar», que no puntúa. |
| 26 paquetes «en curso». | No hay límite de trabajo en curso. Cada paquete abierto añade contexto que recordar y pruebas que mantener. | Límite de 3 en curso. Ningún paquete nuevo hasta cerrar o aparcar formalmente los abiertos. |
| 17 tareas del hogar en siete semanas, tres sin constancia. | La capacidad del hogar está sobrepasada. Más tareas no harán que se hagan las que faltan. | Máximo dos tareas del hogar por semana. Primero las que reducen minutos. Cada entrega que pida una tarea nueva retira otra. |
| «Margen de app.js: 54 líneas», en la lectura crítica. | No es una observación: es un bloqueo inminente. El siguiente paquete con algo de lógica en app.js no pasa el CI. | Tarea técnica P1: sacar unas 3.000 líneas a módulos antes de la Ola 4 (XGO-01). |
| Fecha dura del 15/11 para la lista fiscal con euros reales. | Depende de que se rellene un formulario completo por declarante. Es la fecha más cara de las próximas semanas. | Identificar los tres o cuatro campos que dan la mayor parte de los euros (aportación al plan, retención, ganancias y pérdidas del año) y pedir solo esos el 20/10. |
| Incoherencia «por el chat» en los datos fiscales. | El documento la detecta bien, pero no es la única: la fila de WP-40 en docs/ESTADO_TAREAS_Y_FASES.md también dice que el informe de la CIRBE se pide y teclea «por el chat». | Corregir las tres menciones (fiscal en el estado, fiscal en el panel y CIRBE en el estado). Regla: ninguna cifra personal pasa por el chat. |
| O-6 y la verificación práctica del 16/10, «sin constancia». | Según la regla escrita, sin verificación O-6 se cierra y WP-13 PR-2 (fuente oficial de índices) se archiva. WP-42 y WP-50 lo necesitaban. El documento no recoge esa consecuencia. | Sustituir WP-13 PR-2 por XDA-07: los índices públicos los descarga el CI y se publican en el propio sitio, sin ninguna conexión externa desde el móvil. |
| Decisión 3: «no abrir pantallas nuevas que pidan atención al hogar». | Correcto para tres semanas, pero no dice qué pasa después ni con qué criterio se abrirá la siguiente. | Convertirlo en regla permanente: todo lo nuevo nace en el Laboratorio, apagado, y «uno entra, uno sale» lo comprueba el CI (XGO-01, XGO-03). |

### Las próximas tres semanas, reordenadas por camino crítico

| Cuándo | Qué | Detalle | Quién |
|---|---|---|---|
| 20/10 | Datos fiscales mínimos | Solo los campos que mueven más euros; el resto, vacío. | Hogar |
| 21-24/10 | CI que explica sus fallos | Informe y trazas de Playwright como artefacto en fallo. | Desarrollo |
| 21-24/10 | Corregir las tres menciones «por el chat» | Estado de tareas (fiscal y CIRBE) y panel. | Desarrollo |
| 24/10 | Decidir H-02 | Prueba de dos minutos o medición pasiva (UXS-03 a P0). | Hogar |
| 27/10-7/11 | Desalojo de app.js | Unas 3.000 líneas a módulos; ningún cambio visible. | Desarrollo |
| 27/10-7/11 | Laboratorio y medidor de utilidad | XGO-03 y XGO-02: la base para todo lo nuevo. | Desarrollo |
| 1-3/11 | Cerrar octubre con saldo y valorar la cartera | Primer dato real para el backtest y el patrimonio. | Hogar |
| 10/11- | Cerrar la Ola 3 con límite de 3 en curso | Cada paquete: segunda entrega o «esperando al hogar». | Desarrollo |

## 4. Principios de diseño para todo lo nuevo

- **Una pregunta, una cifra, una acción.** Cada pantalla responde a una pregunta del hogar con una cifra principal y como mucho una acción recomendada. El resto, debajo de «más».
- **Ningún dato manual sin camino automático.** Si una función necesita un dato que hay que teclear, debe traer el plan para que llegue solo o con un toque. Si no, no entra.
- **Cada cifra con su rango, su edad y su fuente.** La app ya lo hace a trozos (edad de saldos, calidad de previsión, procedencia). Debe ser un único componente del sistema de diseño.
- **Lo que no tiene datos no ocupa pantalla.** Una función sin datos se pliega a una línea con lo que falta y cuánto cuesta dárselo. Así desaparece la pared de «sin datos».
- **Explicar el cambio antes que el nivel.** El puente de previsión es el mejor patrón de la app: «por qué ha cambiado» con cifras. Extenderlo a la cartera, la deuda y la visita diaria.
- **Decidir en frío, avisar en caliente.** Política de inversión y plan B ya siguen este patrón. Se extiende a la deuda y a las cuotas que se liberan.
- **Atención con presupuesto.** Los avisos compiten por un número fijo de huecos a la semana según los euros en juego. Lo que no entra va a un resumen.
- **Pulgar y lectura en el iPhone.** Barra inferior con cinco destinos, hojas inferiores para editar, objetivos de 44 pt, texto dinámico, VoiceOver y modo oscuro probados en WebKit.
- **Deshacer en lugar de preguntar.** Ya es regla (WP-37). Se mantiene en todo lo nuevo, incluidas las confirmaciones automáticas.
- **Nada nace visible.** Toda función nueva entra en el Laboratorio con su métrica y su fecha de retirada. Se gradúa con datos o se retira.

## 5. Rediseño de Inversión, Deuda actual y Deuda nueva

### Inversión: «¿Cómo va la cartera?»

**Hoy**

- Cinco vistas al mismo nivel: Cartera, Rebalanceo, Fiscal, Jubilación y Apalancamiento.
- En Cartera se mezclan valoración, libro de operaciones, patrimonio neto, calma, cobertura, exposición y vivienda por índice.
- La política de inversión está escondida en Rebalanceo; el apalancamiento, una acción de riesgo, pesa lo mismo que la vista diaria.
- No hay una respuesta arriba a «¿cómo vamos este año y por qué?»; la edad de cada valoración se ve tarde.

**Propuesta**

- Cabecera: valor con fecha y edad; cambio del año separado en mercado y aportaciones; dentro o fuera de las bandas de la política; botón «Valorar todo» (XDA-06).
- Cuatro pestañas: Resumen · Reparto (política y rebalanceo por aportaciones) · Impuestos (latentes, compensación, recompra XIN-02, retirada XIN-01, traspaso XIN-05, modelo 720 XIN-08) · Futuro (objetivos XIN-04, planes de pensiones XIN-06, independencia XIN-07).
- Patrimonio neto y vivienda pasan a «¿Cómo vamos?». El apalancamiento pasa a «¿Qué hacemos con el dinero?», detrás de la barrera AP4 y de la política de deuda (XDN-03).
- La lectura de calma se abre sola cuando la caída supera el umbral de la política; si no, va plegada.

### Deuda actual: una cabecera, tres bloques

**Hoy**

- Al menos nueve vistas tocan la deuda: Comparar, Ruta, Contratos, Simulador, la hoja de ruta antigua, Control, Plan de liquidación y las dos de «nueva vida».
- «Repartir la nómina» y la escalera del próximo euro viven en Deuda › Comparar aunque no son deuda.
- El camino a deuda cero no incluye comisiones de amortización y no decide qué pasa con las cuotas que se liberan.
- Conviven varios motores de deuda; NTC-05 (retirar el doble motor) está en P3.

**Propuesta**

- Cabecera fija: deuda total, coste medio ponderado, fecha libre de deuda, cuota sobre ingresos y próxima revisión del tipo.
- Bloque Calendario: camino a deuda cero con ventanas sin comisión (XDO-01) y destino de cada cuota liberada (XDO-03).
- Bloque Contratos: contratos, índices, revisión del tipo, CIRBE y deuda en la sombra, como hoy.
- Bloque Mejorar: amortizar o invertir, negociar con el banco (XDO-04), fijo, variable o mixto (XDO-02) y la ITV anual (XDO-06).
- Repartir la nómina y el próximo euro se mudan a «¿Qué hacemos con el dinero?». Las vistas antiguas se pliegan tras NTC-05 y con el panel de uso.

### Deuda nueva: un taller en seis pasos

**Hoy**

- Repartida entre el simulador de deuda, los escenarios, las ofertas de E14b y el simulador de apalancamiento.
- Lo más útil está catalogado pero sin construir y en P3-P4: «¿Me lo puedo permitir?» (NDB-03), evaluador de ofertas (NDB-05), cuánto prestaría un banco (DNU-01) y el coche (DNU-02).
- No hay reglas acordadas en frío para endeudarse, como sí las hay para invertir.

**Propuesta**

- 1 Para qué: vivienda, coche, reforma, consumo o invertir.
- 2 ¿Hace falta deuda? Contado, ahorro o vender, con el impuesto de la venta (NDB-03, XIN-01).
- 3 Cuánto podéis: la carpeta del banco y su ratio (XDN-04, DNU-01).
- 4 Ofertas: lector de la FEIN y comparador con las vinculaciones valoradas (XDN-01, XDN-02).
- 5 Prueba: política de deuda (XDN-03), estrés de tipos e ingresos y qué retrasa en vuestros planes (XDN-06).
- 6 Decisión: queda registrada con su motivo y vuelve a revisarse a los 12 meses.

## 6. Catálogo de 57 funciones nuevas

Cada función declara su valor, esfuerzo (S ≈ 1 sesión, M ≈ 2, L ≈ 4), su efecto estimado en los minutos semanales del hogar (Δmin; negativo es bueno; **supuesto, no medido**), su horizonte, su puerta (lo que tiene que ser cierto antes de empezar), su métrica de éxito y su criterio de retirada. Todas nacen en el Laboratorio (XGO-03).

| Horizonte | Funciones | Sesiones estimadas |
|---|---|---|
| Ahora (nov-dic 2026, tras cerrar la Ola 3) | 16 | 24,5 |
| Siguiente (ene-mar 2027) | 26 | 45,5 |
| Después (abr-jun 2027) | 10 | 17 |
| Condicionada (solo cuando haya una decisión real en estudio) | 5 | 12 |
| **Total** | **57** | **99** |

### Actualización de datos (10)

| Id | Función | Valor | Esfuerzo | Δmin/sem | Horizonte |
|---|---|---|---|---|---|
| XDA-01 | Lo que la app te pide: contrato de datos por función | Alto | M (2) | −2 | Ahora |
| XDA-02 | Buzón de extractos desde la hoja Compartir | Alto | M (2,5) | −3 | Ahora |
| XDA-03 | Extractos en PDF, empezando por el texto pegado | Alto | M (2) | −2 | Ahora |
| XDA-04 | Mapa de cobertura del libro | Medio | S (1) | 0 | Ahora |
| XDA-05 | Clasificar por lotes y enseñar una sola vez | Medio | M (2) | −2 | Siguiente |
| XDA-06 | Valorar la cartera con una captura o un pegado | Alto | M (2) | −0,5 | Siguiente |
| XDA-07 | Índices públicos sin teclear, publicados por el propio sitio | Alto | M (2) | −1 | Ahora |
| XDA-08 | Lo esperado se confirma solo cuando el extracto lo demuestra | Medio | S (1) | −1 | Ahora |
| XDA-09 | Apuntar un gasto con la voz | Bajo | S (1) | 0 | Siguiente |
| XDA-10 | Comprobar los datos antes de decidir | Medio | S (1) | 0 | Siguiente |

#### XDA-01 · Lo que la app te pide: contrato de datos por función

- **Problema.** Cada paquete añade una obligación de datos y nadie suma su coste. GOV-01 fija 10 minutos a la semana, pero se mide preguntando, y por función no se sabe qué cuesta. Las funciones sin dato enseñan «sin datos» o «ejemplo» y parecen rotas.
- **Propuesta.** Cada función declara en un registro qué datos necesita, cada cuánto y cuántos minutos cuesta darlos (medido si existe, supuesto si no, y dicho). La app suma el coste semanal total y por función, detecta las funciones «hambrientas» (dato caducado o que nunca llegó) y las pliega a una línea.
- **Experiencia.** Ajustes › «Lo que la app te pide»: barra de minutos por semana frente al presupuesto de 10, lista ordenada por valor por minuto e interruptor «Pausar» que libera la obligación y silencia sus avisos. Cada tarjeta plegada dice el dato que falta y lleva al sitio exacto.
- **Se apoya en.** Nuevo canonical-data-contracts.js (puro). Reutiliza la cola de datos (WP-45) y el panel de uso (WP-03).
- **Métrica.** M-COSTE medido, no autodeclarado. Funciones hambrientas: 0 o pausadas.
- **Se retira si.** Si nadie abre la pantalla en dos meses, el registro se queda solo como comprobación del CI.
- **Puerta.** Ninguna.
- **Relación con lo existente.** Complementa WP-45, que ordena tareas; esto pone precio a cada función.

#### XDA-02 · Buzón de extractos desde la hoja Compartir

- **Problema.** Importar un extracto en el iPhone exige descargarlo en la app del banco, abrir la PWA, ir a Registrar › Importar y buscarlo en Archivos. Es la tarea que más valor da (actualiza saldo y movimientos, WP-26) y la que más fricción tiene.
- **Propuesta.** Un Atajo de iOS en la hoja Compartir («Enviar a Contabilidadcasa») sube el fichero a un buzón privado en Supabase Storage (RLS, cifrado en reposo, borrado a los 7 días). Al abrir la app aparece «1 extracto nuevo» y se procesa con el perfil autodetectado (WP-51) y sin duplicados (WP-53).
- **Experiencia.** Dos toques desde la app del banco. En la app, una tarjeta con el resumen (movimientos, saldo final, días que cubre, duplicados descartados) e «Importar», con deshacer.
- **Se apoya en.** Supabase ya existe. Token del Atajo con permiso solo de escritura en el buzón.
- **Métrica.** M-SALDOS ≤ 20 s; al menos 2 extractos por semana; M-FRESC ≥ 90 %.
- **Se retira si.** Si en seis semanas se importan menos extractos que antes, se retira.
- **Puerta.** Revisión de seguridad NTC-06 del token del Atajo.
- **Relación con lo existente.** Distinto de CAP-01 (pagos de Apple Pay) y ND-05 (bandeja por gesto); usa la misma vía de servidor.

#### XDA-03 · Extractos en PDF, empezando por el texto pegado

- **Problema.** En el móvil los bancos dan casi siempre el extracto en PDF. Los perfiles de WP-51 leen CSV y Excel. Lo que no se puede importar desde el móvil no se importa.
- **Propuesta.** Nivel 1, sin biblioteca: «pegar el texto del PDF» (el visor de iOS permite seleccionar y copiar) y un analizador por perfil que reconoce fecha, concepto, importe y saldo por línea, como la nómina pegada de WP-31. Nivel 2: pdf.js autoalojado, con SRI y cargado solo en esa hoja, si el nivel 1 se usa.
- **Experiencia.** En Importar, pestaña «PDF o texto». Vista previa con las líneas reconocidas y las dudosas marcadas. Antes de aceptar, cuadre: saldo inicial + movimientos = saldo final.
- **Se apoya en.** Nuevo perfil en canonical-statement-profiles; reutiliza el control de duplicados.
- **Métrica.** Extractos importados desde el móvil; error de cuadre 0.
- **Se retira si.** Si el cuadre falla en más de 1 de cada 5 extractos reales, se queda en nivel 1 o se retira.
- **Puerta.** Decisión del hogar sobre la biblioteca PDF (ya aplazada en WP-31).
- **Relación con lo existente.** Nueva. Mismo criterio de privacidad que el lector de nóminas.

#### XDA-04 · Mapa de cobertura del libro

- **Problema.** Varios motores dependen de saber hasta qué día llega el libro importado: cargos que no llegaron (WP-27), deuda en la sombra (WP-41) y anomalías (WP-36). Esa cobertura no se ve. Un hueco entre dos extractos produce falsos «no ha llegado» o deja de vigilar en silencio.
- **Propuesta.** Calendario por cuenta con los días cubiertos por extractos (verde), los huecos (rojo) y los solapes ya deduplicados (gris). Cada motor que dependa de la cobertura dice «no puedo mirar del 4 al 9» en lugar de callar.
- **Experiencia.** Tira de 90 días por cuenta en Registrar › Importar. Al tocar un hueco: «Importa un extracto que cubra del 4 al 9 de octubre».
- **Se apoya en.** Movimientos importados y fechas del perfil; motor puro pequeño.
- **Métrica.** Días con hueco en los últimos 90: 0. Falsos «no ha llegado»: 0.
- **Se retira si.** Si no hay huecos en tres meses, se pliega a un aviso que solo sale cuando aparece uno.
- **Puerta.** Ninguna.
- **Relación con lo existente.** Refuerza WP-27, WP-41 y WP-36.

#### XDA-05 · Clasificar por lotes y enseñar una sola vez

- **Problema.** Los movimientos sin partida o mal asignados estropean la previsión por categoría y la revisión base cero (WP-34). Clasificar de uno en uno es lento, y un gestor de reglas (ND-06) obliga a pensar en reglas.
- **Propuesta.** Aprendizaje activo: agrupar por comercio normalizado (la normalización ya existe en WP-36), proponer partida con su confianza y preguntar solo los grupos dudosos, cinco por sesión. Cada respuesta crea la regla y la enseña: «A partir de ahora, MERCADONA → Supermercado».
- **Experiencia.** Hoja inferior con tarjetas que se deslizan para aceptar; contador «faltan 12 grupos, un minuto»; nunca más de cinco seguidas; deshacer en cada regla.
- **Se apoya en.** Motor de reglas por concepto existente; ranking nuevo por incertidumbre × importe.
- **Métrica.** Gasto importado con partida ≥ 95 %; ≤ 4 s por grupo.
- **Se retira si.** Si se corrigen más del 30 % de las propuestas, se vuelve a la clasificación manual.
- **Puerta.** Al menos dos extractos reales importados.
- **Relación con lo existente.** Hace casi innecesario ND-06.

#### XDA-06 · Valorar la cartera con una captura o un pegado

- **Problema.** WP-15 valora posición a posición. M-INV (todos los meses valorados) depende de teclear un valor por posición cada mes. La entrega «pegar desde el bróker» está aparcada a la espera de una muestra.
- **Propuesta.** Dos entradas: pegar el texto de la pantalla de posiciones o subir una captura (el OCR ya existe para tickets). Se casan ISIN o nombre con las posiciones, se proponen valor y unidades, se cuadra el total con el del bróker y se guarda como valoración con fecha.
- **Experiencia.** «Valorar todo» en Inversión. Tabla antes y después con la variación de mercado (WP-15) y las diferencias resaltadas; un toque para guardar.
- **Se apoya en.** canonical-portfolio-valuation y un analizador por bróker con perfil, como los de extracto.
- **Métrica.** Valoración mensual ≤ 60 s; M-INV 100 %.
- **Se retira si.** Si falla el casado de más del 20 % de las posiciones, queda solo el pegado de texto.
- **Puerta.** Una muestra del formato del bróker con nombres tapados (ya pedida).
- **Relación con lo existente.** Es la forma de construir WP-15 PR-2. Sustituye a ND-12 sin conexión externa.

#### XDA-07 · Índices públicos sin teclear, publicados por el propio sitio

- **Problema.** Euribor, €STR, IPC (WP-13) y el índice de vivienda (WP-50) se teclean. La fuente oficial (WP-13 PR-2) dependía de O-6, que se cierra sin la verificación del 16/10. Sin índices frescos envejecen la revisión de la hipoteca (WP-20), la escalera (WP-42) y la vivienda (WP-50).
- **Propuesta.** Un flujo de GitHub Actions mensual descarga las series públicas (Banco de España, BCE e INE), las valida (rango, fecha, saltos) y publica datos/indices.json con fuente y fecha en el propio sitio. El móvil solo lee un fichero de su mismo origen: ningún dato del hogar sale y no hay conexión externa desde la app.
- **Experiencia.** En «Índices de referencia», cada valor con «Fuente: Banco de España · dato de septiembre · publicado el 1/10». La primera vez, botón «Usar el valor oficial»; si el fichero falla, se vuelve al tecleado con aviso.
- **Se apoya en.** canonical-rate-indices (la caducidad ya existe) y tools/fetch-public-indices.mjs con pruebas de forma.
- **Métrica.** Índices caducados: 0. Minutos de tecleo de índices: 0.
- **Se retira si.** Si una fuente cambia de formato dos veces en seis meses, esa serie vuelve a manual.
- **Puerta.** OK del hogar a un flujo de CI con salida a internet (el móvil no cambia).
- **Relación con lo existente.** Sustituye a WP-13 PR-2. Sirve también a XDO-02 y XNF-04.

#### XDA-08 · Lo esperado se confirma solo cuando el extracto lo demuestra

- **Problema.** WP-14 pregunta siempre por los cobros esperados. Con extractos frecuentes la pregunta sobra cuando el cobro ya está en el libro por el importe previsto, y cada pregunta innecesaria enseña a ignorar la bandeja.
- **Propuesta.** Casado automático: si un movimiento importado coincide con un esperado (mismo sentido, ±3 días, importe ±2 % o regla declarada), se confirma solo y se anota «confirmado por el extracto del 16/10». Solo se pregunta lo dudoso o lo que falta.
- **Experiencia.** En la bandeja, una línea plegada «3 cosas confirmadas solas» que se despliega, con deshacer en cada una.
- **Se apoya en.** canonical-expected-movements y canonical-capture-link.
- **Métrica.** Preguntas por semana −50 % con deshacer < 5 %.
- **Se retira si.** Si el deshacer supera el 5 %, vuelve a preguntar siempre.
- **Puerta.** H-02, porque cambia lo que enseña la bandeja de Hoy.
- **Relación con lo existente.** Evoluciona WP-14 y WP-27.

#### XDA-09 · Apuntar un gasto con la voz

- **Problema.** Los enlaces prellenados (WP-25) y la hoja de captura (WP-30) permiten apuntar en ≤ 8 s, pero no con las manos ocupadas.
- **Propuesta.** Atajo «Apunta gasto»: «23 euros gasolina con la Visa» se convierte en enlace prellenado (importe, concepto, tarjeta) y abre la hoja rellena para confirmar con un toque. El reconocimiento lo hace iOS; no hay servidor.
- **Experiencia.** Se dice la frase a Siri; la app abre con la hoja rellena y el campo dudoso resaltado.
- **Se apoya en.** Analizador de frase puro (importe es-ES, tarjeta por alias, concepto) sobre WP-11 y WP-25.
- **Métrica.** M-CAPT ≤ 8 s incluida la voz; capturas por voz a la semana.
- **Se retira si.** Menos de un uso por semana tras un mes.
- **Puerta.** Probar antes el Atajo de WP-25 (pendiente del hogar).
- **Relación con lo existente.** Distinta de UXS-01, que consulta la cifra con Siri.

#### XDA-10 · Comprobar los datos antes de decidir

- **Problema.** Los simuladores de deuda, inversión y escenarios calculan con lo que haya, aunque el saldo tenga 12 días o el Euribor tres meses. Nadie sabe si la recomendación cambiaría con datos frescos.
- **Propuesta.** Antes de enseñar un veredicto, mirar la edad de los datos que entran en esa decisión y, con la sensibilidad que ya se calcula (PV6), decir cuáles podrían darle la vuelta: «Antes de decidir, actualiza el saldo de CaixaBank (12 días) y el Euribor (agosto). Lo demás no cambia el resultado».
- **Experiencia.** Banda superior en cada simulador con tres datos como mucho, cada uno con su acceso directo. El veredicto se enseña igual, marcado «con datos de hace 12 días».
- **Se apoya en.** canonical-data-age, canonical-data-queue y canonical-forecast-sensitivity.
- **Métrica.** Decisiones tomadas con datos frescos.
- **Se retira si.** Si nunca salta porque los datos siempre están al día, queda como etiqueta.
- **Puerta.** Ninguna.
- **Relación con lo existente.** Nueva; usa motores existentes.

### Previsión (11)

| Id | Función | Valor | Esfuerzo | Δmin/sem | Horizonte |
|---|---|---|---|---|---|
| XPR-01 | Importes con incertidumbre aprendida | Alto | M (2) | 0 | Siguiente |
| XPR-02 | La previsión corrige su propio sesgo | Alto | M (2) | 0 | Después |
| XPR-03 | Banda que se calibra sola | Medio | S (1) | 0 | Después |
| XPR-04 | El mes en curso al ritmo real | Alto | M (2) | 0 | Siguiente |
| XPR-05 | Previsión por cuenta y traspasos sugeridos | Alto | M (2,5) | 0 | Siguiente |
| XPR-06 | Toca un día y mira qué lo mueve | Medio | S (1) | 0 | Ahora |
| XPR-07 | El arreglo más barato para un descubierto | Alto | M (2) | 0 | Siguiente |
| XPR-08 | Disponible después de apartar lo que viene | Alto | S-M (1,5) | 0 | Siguiente |
| XPR-09 | Detector de cambios de nivel | Medio | M (2) | 0 | Después |
| XPR-10 | Probabilidad sugerida para los ingresos inciertos | Medio | S (1) | 0 | Siguiente |
| XPR-11 | Mover los días de cargo a donde menos duelen | Medio | S (1) | 0 | Siguiente |

#### XPR-01 · Importes con incertidumbre aprendida

- **Problema.** La banda de caja (WP-16) solo modela la incertidumbre de la fecha. El propio motor lo dice: «la app todavía no aporta amountSd; la banda es de fechas, no de importes». Lo que hace fallar el fin de mes es que el súper, la luz o la gasolina varían.
- **Propuesta.** Por partida, con ≥ 3 meses con real, estimar la dispersión de forma robusta (mediana y desviación absoluta mediana; cuantiles empíricos con ≥ 6 meses) y pasarla a la simulación. Sin historia, la banda dice «importe sin medir» y no inventa.
- **Experiencia.** Selector «qué es incierto: fechas · importes · ambos» y una frase: «el 60 % de la anchura viene del súper y de la luz».
- **Se apoya en.** canonical-cash-band ya acepta amountSd. Estimador puro nuevo, calibrado con los hogares sintéticos de WP-33.
- **Métrica.** M-CALIB: la banda P10-P90 cubre ≈ 80 % de los días tras 6 cierres.
- **Se retira si.** Si la cobertura empeora frente a la banda de solo fechas, se apaga.
- **Puerta.** Al menos 3 cierres con real.
- **Relación con lo existente.** Completa WP-16.

#### XPR-02 · La previsión corrige su propio sesgo

- **Problema.** El backtest (WP-12) medirá el error de caja desde enero, pero solo lo enseña: la previsión seguirá cometiendo el mismo error mes tras mes. NPV-12 propone un control de prudencia manual.
- **Propuesta.** Con ≥ 3 cierres comparables, calcular el sesgo mediano por componente (ingresos, recurrente, extraordinarios) y ofrecer una previsión corregida paralela. El hogar elige cuál manda; nunca se sustituye en silencio. El puente (WP-43) enseña la corrección como un componente más.
- **Experiencia.** Dos líneas en el cono, «tal cual» y «corregida con lo aprendido», y la frase «la previsión suele ser 140 € optimista en extraordinarios».
- **Se apoya en.** canonical-liquidity-backtest y canonical-forecast-bridge.
- **Métrica.** Error absoluto medio de caja a fin de mes −30 % frente a la previsión sin corregir.
- **Se retira si.** Si en tres meses no mejora el error, se retira.
- **Puerta.** 3 cierres con saldo comparables (enero de 2027 como pronto).
- **Relación con lo existente.** Paso siguiente de WP-12. Sustituye a NPV-12.

#### XPR-03 · Banda que se calibra sola

- **Problema.** El objetivo M-CALIB (el 80 % de los días reales dentro de P10-P90) está definido, pero nada ajusta la banda si no se cumple. Una banda que cubre el 50 % engaña; una que cubre el 99 % no informa.
- **Propuesta.** Calibración conformal sencilla: tras cada cierre se mide la cobertura real y se ensancha o estrecha la banda con el factor que la habría dejado en el 80 %, con suelo y techo. Se guarda el historial de cobertura.
- **Experiencia.** Insignia «banda calibrada: acierta 8 de cada 10 días (6 cierres)» o «sin calibrar todavía».
- **Se apoya en.** canonical-cash-band y canonical-liquidity-backtest.
- **Métrica.** Diferencia entre cobertura real y 80 % ≤ 5 puntos.
- **Se retira si.** No aplica: sin datos, no calibra y lo dice.
- **Puerta.** 6 cierres.
- **Relación con lo existente.** Realiza M-CALIB y absorbe PRV-07.

#### XPR-04 · El mes en curso al ritmo real

- **Problema.** A mitad de mes, el gasto variable vale «lo mayor entre lo previsto y lo real» (Manual, §5). La previsión nunca baja aunque se gaste menos y sube tarde si se gasta más. Es prudente, pero no ve el ritmo.
- **Propuesta.** Estimación del cierre del mes con el perfil del propio hogar: qué parte del variable se gasta, de media, hasta el día N, con el efecto de la nómina y de los fines de semana. Con banda: «al ritmo actual cerrarás el variable en 610 € (560-680); el plan dice 650». Se enseña al lado; la cifra prudente sigue mandando.
- **Experiencia.** Barra de ritmo con la marca de hoy y la del perfil esperado, y un color si se va por delante.
- **Se apoya en.** Movimientos diarios de ≥ 3 meses; motor puro nuevo, validado con WP-33.
- **Métrica.** Error de la estimación del día 15 frente al cierre ≤ 10 %.
- **Se retira si.** Error > 20 % durante tres meses.
- **Puerta.** Al menos 3 meses de extractos.
- **Relación con lo existente.** Nueva; complementa «Gasto variable del mes en curso».

#### XPR-05 · Previsión por cuenta y traspasos sugeridos

- **Problema.** El motor diario suma CaixaBank y Mediolanum. El total puede ser positivo mientras la cuenta de los recibos queda en rojo un día: recibo devuelto, comisión o descubierto.
- **Propuesta.** Previsión diaria por cuenta (cada partida con su cuenta de cargo, declarada una vez) y un aviso con fecha: «Mueve 300 € de Mediolanum a CaixaBank antes del 2/11; ese día salen la hipoteca y el seguro».
- **Experiencia.** En Previsión, conmutador «total / por cuenta». La sugerencia va a la bandeja con el importe mínimo, la fecha límite y la hora de corte de las transferencias.
- **Se apoya en.** canonical-daily-engine con dimensión de cuenta; cushionAccountSplit ya reparte el colchón por cuenta.
- **Métrica.** Días con alguna cuenta por debajo de 0: 0. Recibos devueltos: 0.
- **Se retira si.** Si todo se carga en una sola cuenta, la vista por cuenta no aparece.
- **Puerta.** Cuenta de cargo declarada en ≥ 80 % del gasto fijo.
- **Relación con lo existente.** Nueva.

#### XPR-06 · Toca un día y mira qué lo mueve

- **Problema.** El cono y la banda dicen cuánto, no por qué. Para fiarse de una previsión hay que poder abrirla.
- **Propuesta.** Al tocar cualquier día del gráfico, la lista de eventos que lo componen (entradas y salidas, con su certeza: real, por regla o estimada) y el saldo de partida. Desde cada evento se corrige la fecha o el importe.
- **Experiencia.** Hoja inferior. Los eventos estimados llevan un icono de reloj y «¿sabes el día?», que lleva al día de cargo (WP-08).
- **Se apoya en.** Los eventos ya existen en el motor diario; kit de gráficos de WP-28.
- **Métrica.** Fechas corregidas desde aquí (sube M-RESOL).
- **Se retira si.** Si nadie lo usa en dos meses, queda «Ver como tabla».
- **Puerta.** Ninguna.
- **Relación con lo existente.** Amplía WP-28.

#### XPR-07 · El arreglo más barato para un descubierto

- **Problema.** Cuando la previsión cruza el suelo, la app avisa (E16 y plan B), pero no dice qué hacer al menor coste. El plan B es para crisis acordadas; el día a día necesita tácticas.
- **Propuesta.** Un solucionador que, dado un déficit previsto (importe y fecha), ordena las palancas por coste: traspaso entre cuentas (0 €), mover un gasto discrecional de la capa 3 (WP-35), adelantar un cobro, usar el colchón (coste de oportunidad), aplazar un cargo de tarjeta (con su TAE real, WP-41) o la línea de crédito (DI2). Enseña de una a tres combinaciones.
- **Experiencia.** Tarjeta «Para no bajar del suelo el 23/11» con la combinación más barata arriba y su coste en euros.
- **Se apoya en.** canonical-forecast-layers, effectiveApr (WP-41), canonical-emergency-credit-line y canonical-cushion.
- **Métrica.** Déficits resueltos antes de su fecha; coste medio del arreglo.
- **Se retira si.** Si no hay déficits en seis meses, queda dormido.
- **Puerta.** Ninguna (con XPR-05 es más preciso).
- **Relación con lo existente.** Táctico, frente al plan B (WP-38), que es estructural.

#### XPR-08 · Disponible después de apartar lo que viene

- **Problema.** El disponible resta el suelo y mira el fin de mes, pero no reserva el IBI de dentro de tres meses ni el seguro anual. El dinero parece libre y no lo es. El mapa de pagos grandes (WP-49) ya sabe lo que viene y lo reservado.
- **Propuesta.** Un «disponible tras provisiones» que descuenta la parte devengada de cada pago grande (importe × meses transcurridos ÷ meses del ciclo) y propone el apartado mensual de cada uno.
- **Experiencia.** En Plan › Previsión, una cifra con su desglose: «de 1.200 € libres, 480 € ya son del IBI y del seguro». En Hoy, solo cuando se levante la congelación y si la prueba lo respalda.
- **Se apoya en.** canonical-large-payments y canonical-home-margin.
- **Métrica.** Meses en que un pago grande obliga a tocar el colchón: 0.
- **Se retira si.** Si no se consulta antes de tres pagos grandes.
- **Puerta.** H-02 solo para llevarlo a Hoy.
- **Relación con lo existente.** Nueva, sobre WP-49.

#### XPR-09 · Detector de cambios de nivel

- **Problema.** Cuando cambia la vida (un hijo empieza el colegio, se cambia de compañía de luz, sube un alquiler), la historia anterior deja de servir. La base cero (WP-34) y las bandas siguen usando doce meses que ya no representan nada.
- **Propuesta.** Detección de rupturas por partida (CUSUM o ventanas) que avisa: «La luz ha subido de nivel desde junio (+28 %). ¿Uso solo desde junio para prever?». Con un sí, los motores usan solo la historia posterior.
- **Experiencia.** Aviso en Cierre, no en Hoy, uno al mes como mucho, con el gráfico antes y después.
- **Se apoya en.** Reales por partida; motor puro nuevo validado con WP-33 inyectando escalones.
- **Métrica.** En los hogares sintéticos, ≥ 90 % de rupturas detectadas con ≤ 1 falsa al año.
- **Se retira si.** Más de dos falsas al año con datos reales.
- **Puerta.** Al menos 9 meses de reales.
- **Relación con lo existente.** Nueva.

#### XPR-10 · Probabilidad sugerida para los ingresos inciertos

- **Problema.** WP-35 deja declarar la probabilidad de la paga variable, la devolución de la Renta o el alquiler del local, pero el motor no la estima: sin declarar cuenta como segura, y casi nadie sabe poner un 70 %.
- **Propuesta.** Con historia (años en que llegó la paga, retrasos del inquilino, resultados de Renta anteriores), sugerir una probabilidad y un rango de importe con su evidencia. El hogar la acepta o la cambia. Sin historia, no sugiere.
- **Experiencia.** Chip «sugerido: 80 % (llegó 4 de 5 años)» junto al campo.
- **Se apoya en.** canonical-forecast-layers, canonical-payroll y el histórico del estimador de IRPF.
- **Métrica.** Ingresos inciertos con probabilidad declarada ≥ 90 %.
- **Se retira si.** Si el hogar cambia la sugerencia en más de la mitad de los casos.
- **Puerta.** WP-35 PR-2.
- **Relación con lo existente.** Completa WP-35.

#### XPR-11 · Mover los días de cargo a donde menos duelen

- **Problema.** El mínimo del mes suele caer justo antes de cobrar porque hipoteca, seguros y recibos se cargan el día que eligió cada empresa. Muchos permiten cambiarlo con una llamada.
- **Propuesta.** Con los días de cargo (WP-08) y la previsión diaria, simular qué recibos convendría mover y a qué día para subir el mínimo del mes. Enseñar la ganancia en euros y el guion de la gestión: «Pide a la compañía de luz el cargo el día 3».
- **Experiencia.** De uno a tres cambios con «sube tu mínimo del mes 410 €» y el estado de cada uno: pedido o hecho.
- **Se apoya en.** canonical-charge-days y canonical-daily-engine.
- **Métrica.** Mínimo mensual medio más alto; días bajo el suelo: 0.
- **Se retira si.** Una vez aplicados, queda dormido hasta que cambie algo.
- **Puerta.** Días de cargo declarados en ≥ 70 % del gasto (M-RESOL).
- **Relación con lo existente.** Nueva.

### Inversión (8)

| Id | Función | Valor | Esfuerzo | Δmin/sem | Horizonte |
|---|---|---|---|---|---|
| XIN-01 | ¿De dónde saco el dinero pagando menos impuestos? | Alto | M (2) | 0 | Siguiente |
| XIN-02 | Vigía de la recompra (regla de los dos meses) | Medio | S (0,5) | 0 | Ahora |
| XIN-03 | Puente de la cartera | Medio | M (2) | 0 | Siguiente |
| XIN-04 | Objetivos con probabilidad y aportación necesaria | Alto | M (2,5) | 0 | Siguiente |
| XIN-05 | ¿Me cambio a un fondo más barato? | Alto | S (1) | 0 | Siguiente |
| XIN-06 | Planes de pensiones: cuándo y cómo rescatar | Medio | M (2) | 0 | Después |
| XIN-07 | Número y fecha de independencia financiera | Medio | M (2) | 0 | Después |
| XIN-08 | Vigía de obligaciones informativas (modelos 720 y 721) | Medio | S (1) | 0 | Siguiente |

#### XIN-01 · ¿De dónde saco el dinero pagando menos impuestos?

- **Problema.** Si hace falta liquidez (una obra, un coche, una entrada), la app compara vender frente a pedir prestado (INV10), pero no dice qué vender: qué fondo, qué lotes, si conviene un traspaso antes ni cuánto IRPF del ahorro se paga.
- **Propuesta.** Optimizador de retirada: dado un importe neto, la combinación de posiciones que minimiza el impuesto (lotes con pérdida primero según FIFO, compensación con las ganancias del año, ruta de traspaso en fondos, colchón por encima del suelo) sin salirse de la política de inversión. Enseña impuesto estimado, efecto en el reparto y en la escalera.
- **Experiencia.** Un importe y «Calcular». Resultado en tres filas con el porqué de cada una y el reparto antes y después.
- **Se apoya en.** fifoLedger, yearEndCompensation, latentLossHarvestingCandidates, applyFundTransfer y canonical-investment-policy.
- **Métrica.** Impuesto estimado frente a una retirada proporcional.
- **Se retira si.** Con una sola posición no aparece.
- **Puerta.** Cartera valorada (M-INV).
- **Relación con lo existente.** Nueva, con piezas existentes.

#### XIN-02 · Vigía de la recompra (regla de los dos meses)

- **Problema.** La app sugiere aflorar pérdidas (latentLossHarvestingCandidates), pero la pérdida no se integra si se recompran valores homogéneos en los dos meses anteriores o posteriores (un año si no cotizan; art. 33.5 de la Ley del IRPF). El código no lo menciona en ningún sitio.
- **Propuesta.** Al registrar una compra o una venta con pérdida, comprobar la ventana y avisar: «Esta pérdida quedará diferida hasta que vendas lo recomprado el 12/9». En la campaña fiscal (WP-23), cada venta con pérdida lleva la fecha a partir de la cual se puede recomprar.
- **Experiencia.** Aviso en el alta de la operación, con el mismo patrón que la política (WP-39); no bloquea.
- **Se apoya en.** canonical-portfolio-ledger y canonical-year-end-tax.
- **Métrica.** Pérdidas diferidas por error: 0.
- **Se retira si.** No aplica.
- **Puerta.** Ninguna; el parámetro legal se verifica con su fuente.
- **Relación con lo existente.** Completa FC3 y WP-23. Conviene antes del 31/12.

#### XIN-03 · Puente de la cartera

- **Problema.** La cartera enseña valor, aportado y rentabilidad ponderada por tiempo (WP-18), pero no responde «¿por qué ha cambiado este año?»: cuánto es mercado, aportaciones, comisiones, divisa e impuestos.
- **Propuesta.** Cascada como la del puente de previsión (WP-43): valor inicial → aportaciones netas → mercado por clase de activo → comisiones (el coste total ya se calcula) → divisa → retenciones → valor final. Siempre cuadra; lo no atribuible va a «otros», a la vista.
- **Experiencia.** Cascada táctil del kit de gráficos (cuando tenga barras) con frase automática.
- **Se apoya en.** Serie de valoraciones, portfolioFeeCostTrajectory y currencyGeographyExposure.
- **Métrica.** El hogar responde «¿cuánto nos han costado las comisiones este año?» en menos de 10 s.
- **Se retira si.** Con menos de dos valoraciones en el año no aparece.
- **Puerta.** Dos valoraciones con fecha en el año.
- **Relación con lo existente.** Mismo patrón que WP-43.

#### XIN-04 · Objetivos con probabilidad y aportación necesaria

- **Problema.** Los objetivos (E15) tienen fecha, posiciones vinculadas y senda, pero no dicen la probabilidad de llegar ni cuánto aportar para estar razonablemente seguros.
- **Propuesta.** Por objetivo, Monte Carlo acotado (el motor ESX1 ya simula cientos de trayectorias) con el reparto de sus posiciones: «probabilidad de llegar a tiempo 64 %; con 90 € al mes más, 80 %; o retrasarlo 8 meses». Supuestos de rentabilidad declarados por el hogar o tomados de la política, nunca inventados.
- **Experiencia.** Un medidor por objetivo y tres palancas (aportar más, retrasar, rebajar el objetivo) que mueven la probabilidad en vivo.
- **Se apoya en.** canonical-e15-goals, glidePathForGoal y el Monte Carlo de E13.
- **Métrica.** Objetivos con probabilidad ≥ 80 %.
- **Se retira si.** Sin objetivos con fecha no aparece.
- **Puerta.** Supuestos de rentabilidad en la política (WP-39).
- **Relación con lo existente.** Nueva.

#### XIN-05 · ¿Me cambio a un fondo más barato?

- **Problema.** El coste total de cada posición ya existe, pero no hay un simulador del cambio. Con traspaso entre fondos (sin peaje fiscal en España) el cambio suele compensar si el destino es equivalente y más barato, y nadie lo calcula.
- **Propuesta.** Elegir una posición y un destino (TER y, si se conoce, diferencia de seguimiento). Calcular el ahorro acumulado a 5, 10 y 20 años, confirmar que es traspasable (de fondo a fondo; un ETF no lo es), el plazo y el riesgo de estar fuera del mercado unos días.
- **Experiencia.** Dos columnas, «hoy» y «tras el traspaso», con el ahorro en euros y una lista para pedir el traspaso en la gestora de destino.
- **Se apoya en.** totalCostOfOwnership, isFundToFundTransfer y applyFundTransfer.
- **Métrica.** Comisión media de la cartera a la baja.
- **Se retira si.** Sin fondos (solo ETF o acciones) no aparece.
- **Puerta.** Comisión total (TER) de cada posición declarada.
- **Relación con lo existente.** Nueva.

#### XIN-06 · Planes de pensiones: cuándo y cómo rescatar

- **Problema.** El simulador del plan (A15-4) solo mira la aportación. Desde 2025 se pueden rescatar las aportaciones con más de diez años, y en la jubilación la forma de rescate (capital, renta o mixta; reducción del 40 % de lo aportado antes de 2007) cambia mucho el impuesto. Esa liquidez también cuenta para amortizar o para la escalera.
- **Propuesta.** Calendario de liquidez de cada plan (qué importe es rescatable y desde cuándo) y comparador de formas de rescate repartidas en varios años para no saltar de tramo, con el estimador de IRPF. Parámetros con fuente y fecha.
- **Experiencia.** Línea de tiempo «rescatable hoy / en 2027 / en la jubilación» y tabla de tres estrategias con su impuesto total.
- **Se apoya en.** canonical-portfolio (plan-pension), canonical-irpf-estimator y canonical-tax-tables.
- **Métrica.** El hogar conoce su importe rescatable y el impuesto de la estrategia elegida.
- **Se retira si.** Sin planes de pensiones no aparece.
- **Puerta.** Fechas de aportación de cada plan.
- **Relación con lo existente.** Amplía A15-4.

#### XIN-07 · Número y fecha de independencia financiera

- **Problema.** La app ya calcula qué parte del gasto pagan los activos (WP-44, cobertura), pero no lo proyecta: ¿cuándo cubrirán el 25, el 50 o el 100 %? Es la pregunta de largo plazo que une ahorro, deuda e inversión.
- **Propuesta.** Con el gasto del plan, la tasa de retirada que el hogar declare (se pide; no se impone un 4 %), las deudas que terminan (camino a deuda cero) y la aportación actual, proyectar el año en que la cobertura cruza cada umbral, con banda.
- **Experiencia.** Una línea de tiempo con tres hitos y la palanca «si ahorrásemos 200 € al mes más». Tono sobrio, sin gamificación.
- **Se apoya en.** canonical-calm-coverage, la proyección de canonical-net-worth y el camino a deuda cero.
- **Métrica.** Se consulta en el cierre trimestral.
- **Se retira si.** Si no se mira en dos trimestres.
- **Puerta.** Patrimonio con serie (WP-46) y política firmada.
- **Relación con lo existente.** Nueva.

#### XIN-08 · Vigía de obligaciones informativas (modelos 720 y 721)

- **Problema.** Según dónde estén depositados cuentas, valores y fondos puede haber obligaciones informativas (modelo 720 por encima de 50.000 € por bloque en el extranjero, 721 para criptoactivos). Un descuido sale caro y nada lo vigila.
- **Propuesta.** Cada cuenta y posición declara el país del depositario. La app suma por bloque, vigila los umbrales y el aumento de más de 20.000 € que obliga a volver a declarar, y lo lleva al calendario fiscal de enero a marzo.
- **Experiencia.** En Herramientas › Fiscal, un semáforo por bloque: «no aplica / vigilar / aplica, fecha límite 31/3», con la fuente.
- **Se apoya en.** canonical-assets y canonical-portfolio; parámetros legales con fuente verificada.
- **Métrica.** Ninguna obligación descubierta tarde.
- **Se retira si.** Si todo está en entidades españolas, se queda en «no aplica».
- **Puerta.** País del depositario de cada cuenta y posición.
- **Relación con lo existente.** Nueva.

### Optimizar la deuda actual (6)

| Id | Función | Valor | Esfuerzo | Δmin/sem | Horizonte |
|---|---|---|---|---|---|
| XDO-01 | Comisión de amortización y calendario de amortizaciones | Alto | M (2) | 0 | Ahora |
| XDO-02 | Euribor esperado por el mercado; fijo, variable o mixto | Medio | M (2) | 0 | Siguiente |
| XDO-03 | Cuotas que se liberan | Alto | S (1) | 0 | Ahora |
| XDO-04 | Carta para negociar con el banco | Alto | S-M (1,5) | 0 | Siguiente |
| XDO-05 | Vigía de reclamaciones de la hipoteca | Medio | S (1) | 0 | Después |
| XDO-06 | ITV anual de la deuda | Medio | S-M (1,5) | +15 min/año | Después |

#### XDO-01 · Comisión de amortización y calendario de amortizaciones

- **Problema.** El camino a deuda cero y el comparador amortizar o invertir dicen que no incluyen las comisiones de amortización anticipada. En las hipotecas de la Ley 5/2019 la comisión depende del tipo y del año (variable: tope del 0,25 % los tres primeros años o del 0,15 % los cinco primeros; fijo: 2 % los diez primeros y 1,5 % después; nunca más que la pérdida del banco). Amortizar unos meses más tarde puede salir gratis.
- **Propuesta.** Cada contrato declara su régimen de comisión. La app calcula la comisión de hoy, la fecha en que baja o desaparece, y propone un calendario de amortizaciones parciales (cuándo y cuánto) que combina el ahorro de intereses, la comisión, el colchón (amortizeCushionGuardrail) y el tope de la deducción por vivienda (DAC-02).
- **Experiencia.** En Deuda, una línea de tiempo con las ventanas baratas y el ahorro neto de amortizar en cada una; «reducir cuota o plazo» ya con la comisión descontada.
- **Se apoya en.** canonical-debt-contracts, canonical-debt-payoff-path, amortizeReduceQuotaVsTerm y canonical-cushion.
- **Métrica.** Comisiones evitables pagadas: 0. Ahorro neto anotado.
- **Se retira si.** Sin préstamos con comisión no aparece.
- **Puerta.** Régimen de comisión de cada contrato (H-07, 13/11) y parámetros legales verificados.
- **Relación con lo existente.** Cierra un hueco declarado en WP-19 y AP1.

#### XDO-02 · Euribor esperado por el mercado; fijo, variable o mixto

- **Problema.** La revisión de la hipoteca (WP-20) usa el último Euribor ±1 punto, y los escenarios de tipos (APX5) son fijos. El mercado publica qué Euribor descuenta, que es mejor referencia que un ±1 arbitrario. Y no se compara con una hipoteca mixta.
- **Propuesta.** Con la curva publicada (en el fichero mensual de XDA-07), proyectar la cuota esperada en cada revisión con banda y comparar mantener variable, pasar a fijo o a mixta: Euribor de equilibrio y coste total con los gastos de novación o subrogación.
- **Experiencia.** Gráfico de cuota esperada con banda y tabla «mantener / fijo / mixto» con el Euribor a partir del cual gana cada opción.
- **Se apoya en.** canonical-rate-review, canonical-mortgage-rate-scenarios y canonical-rate-indices.
- **Métrica.** El hogar responde «¿cuánto pagaré en la próxima revisión?» con rango y fuente.
- **Se retira si.** Sin fuente pública fiable de la curva, se queda en ±1 punto.
- **Puerta.** XDA-07 y una fuente pública utilizable de la curva.
- **Relación con lo existente.** Amplía WP-20 y APX5.

#### XDO-03 · Cuotas que se liberan

- **Problema.** Cuando termina un préstamo, su cuota desaparece del gasto y se diluye en el día a día. La propia app lo advierte: «las cuotas que se liberan no se redirigen».
- **Propuesta.** Decisión en frío por cada deuda: qué se hace con su cuota cuando termine (a la siguiente deuda, a aportación, al colchón, a gasto o repartida). Se ve en el camino a deuda cero, se proyecta en la previsión desde el mes siguiente y se avisa el mes del último recibo.
- **Experiencia.** En cada deuda, «Cuando acabe, sus 240 € irán a…», con la escalera del próximo euro como sugerencia y un hito en la línea de tiempo.
- **Se apoya en.** canonical-debt-payoff-path, canonical-next-euro y canonical-payroll-split.
- **Métrica.** Cuotas liberadas con destino decidido: 100 %.
- **Se retira si.** No aplica.
- **Puerta.** Decisión del hogar abierta en WP-19.
- **Relación con lo existente.** Cierra la pregunta pendiente de WP-19.

#### XDO-04 · Carta para negociar con el banco

- **Problema.** La app sabe lo necesario para negociar (tipo de mercado, CIRBE limpia, oferta de otra entidad, coste de subrogar, antigüedad), pero no lo convierte en un argumento.
- **Propuesta.** Una página o correo con los datos del contrato, la referencia de mercado y su fecha, la alternativa concreta (subrogación con su coste y punto de equilibrio, NDB-04) y la petición (rebajar el diferencial, quitar una vinculación, cambiar el día de cargo). Redactado y sin datos innecesarios, con el mismo criterio que el enlace de solo lectura (A19-1).
- **Experiencia.** «Preparar la negociación» en cada contrato, vista previa editable y «Copiar». El resultado se anota («pedido el 4/11; respuesta: …») y entra en el radar.
- **Se apoya en.** canonical-debt-contracts, la referencia D6 y la redacción de canonical-share-link.
- **Métrica.** Negociaciones iniciadas; ahorro anual conseguido.
- **Se retira si.** Si no se usa en doce meses.
- **Puerta.** Referencia de mercado al día (XDA-07 ayuda).
- **Relación con lo existente.** Nueva; usa NDB-04 como alternativa.

#### XDO-05 · Vigía de reclamaciones de la hipoteca

- **Problema.** Según la fecha de firma y las cláusulas puede haber importes reclamables (gastos de formalización anteriores a la Ley 5/2019, cláusula suelo, IRPH, comisión de apertura según el caso). La jurisprudencia cambia y los plazos corren.
- **Propuesta.** Cinco preguntas sobre el contrato que acaban en «nada que mirar» o «merece una consulta con un abogado, por esto», con fuentes y el aviso de que no es asesoría jurídica. Nunca estima un importe a cobrar.
- **Experiencia.** En Deuda › Contratos, una ficha discreta por hipoteca con el resultado y la fecha del criterio.
- **Se apoya en.** canonical-debt-contracts; criterios versionados con fuente y fecha, como las tablas fiscales.
- **Métrica.** Hipotecas revisadas.
- **Se retira si.** Si el criterio no se puede mantener al día, se retira.
- **Puerta.** Revisión legal de los criterios.
- **Relación con lo existente.** Nueva.

#### XDO-06 · ITV anual de la deuda

- **Problema.** Hay muchas piezas sueltas (CIRBE anual, revisión del tipo, vinculaciones, seguros vinculados, radar de refinanciación, comisiones) y ningún momento del año en que se miren juntas.
- **Propuesta.** Un recorrido guiado de 15 minutos al año, como la base cero (WP-34): CIRBE, tipo y próxima revisión, ¿compensan las vinculaciones? (DAC-03), seguro de vida vinculado frente a uno externo, ventanas de amortización (XDO-01) y ¿negociar? (XDO-04). Cada paso con su decisión y fecha.
- **Experiencia.** Un paso por pantalla con progreso; lo que no aplica se salta solo. Al final, la ficha «ITV de la deuda 2027», guardada en la copia.
- **Se apoya en.** Motores ya citados.
- **Métrica.** Una ITV al año; ahorro anotado.
- **Se retira si.** Si no se hace dos años seguidos.
- **Puerta.** XDO-01 y DAC-03.
- **Relación con lo existente.** Orquesta piezas existentes.

### Deuda nueva (6)

| Id | Función | Valor | Esfuerzo | Δmin/sem | Horizonte |
|---|---|---|---|---|---|
| XDN-01 | Lector de la FEIN | Alto | M (2) | 0 | Condicionada |
| XDN-02 | Comparador de ofertas con las vinculaciones valoradas | Alto | M (2) | 0 | Condicionada |
| XDN-03 | Política de deuda del hogar | Alto | S-M (1,5) | 0 | Siguiente |
| XDN-04 | La carpeta para el banco | Medio | M (2) | 0 | Condicionada |
| XDN-05 | Cambio de vivienda de principio a fin | Alto | L (4) | 0 | Condicionada |
| XDN-06 | Qué retrasa esta deuda | Medio | S-M (1,5) | 0 | Siguiente |

#### XDN-01 · Lector de la FEIN

- **Problema.** Toda oferta de hipoteca llega con la Ficha Europea de Información Normalizada (FEIN), y los préstamos al consumo con la INE. Teclear sus cifras es lento y comprobar que la TAE cuadra con el resto es casi imposible a mano.
- **Propuesta.** Pegar el texto (o el PDF, con el enfoque de XDA-03) y extraer TIN, TAE, plazo, cuota, comisiones, vinculaciones con su coste y coste total. Recalcular la TAE con effectiveApr (WP-41) y decir si cuadra.
- **Experiencia.** Vista previa campo a campo con el texto de origen al lado: «la TAE declarada (3,12 %) cuadra con la recalculada (3,10 %)», o un aviso.
- **Se apoya en.** effectiveApr de canonical-shadow-debt y un analizador puro nuevo.
- **Métrica.** Alta de una oferta ≤ 1 min; discrepancias detectadas.
- **Se retira si.** Si las FEIN reales no se dejan leer en más del 30 % de los campos.
- **Puerta.** Una FEIN real con los datos tapados.
- **Relación con lo existente.** Nueva; alimenta NDB-05.

#### XDN-02 · Comparador de ofertas con las vinculaciones valoradas

- **Problema.** Las ofertas se comparan por el tipo bonificado, que esconde el coste de seguros, nómina, tarjeta y planes exigidos. Las ofertas de E14b sirven para reestructurar deuda existente, no para comparar ofertas de una deuda nueva en igualdad.
- **Propuesta.** Comparar de 2 a 4 ofertas: coste total en el plazo con el coste de cada vinculación (prima, comisión de la cuenta, aportación mínima), el valor de desvincularse en el año 3 y la flexibilidad (comisión de amortización, XDO-01). Resultado: coste total, TAE con vinculaciones y «la bonificación compensa si…».
- **Experiencia.** Tabla de ofertas con la fila de coste total destacada y una conclusión en una frase. Cada vinculación con un interruptor «la aceptaría / no».
- **Se apoya en.** canonical-debt-comparator, canonical-mortgage-rate-scenarios y XDN-01.
- **Métrica.** Decisión tomada por coste total, no por tipo.
- **Se retira si.** Condicionada a que haya ofertas.
- **Puerta.** XDN-01 o alta manual de las ofertas.
- **Relación con lo existente.** Extiende E14b y NDB-05.

#### XDN-03 · Política de deuda del hogar

- **Problema.** La política de inversión (WP-39) funciona porque se acuerda en frío y avisa en caliente. Para la deuda no existe: cuota total máxima, qué no se financia nunca, plazo máximo, fijo o variable, colchón mínimo tras la operación.
- **Propuesta.** Cinco preguntas, firma de dos personas con huella (mismo mecanismo que WP-39 y WP-38). Cada simulación de deuda nueva o de apalancamiento enseña «cumple / no cumple la regla 3» y pide motivo si se sigue adelante.
- **Experiencia.** Una página con las reglas numeradas y, en cada simulador, chips de reglas cumplidas.
- **Se apoya en.** Patrón de canonical-investment-policy y canonical-leverage-barrier.
- **Métrica.** Firmada; decisiones de deuda con la política consultada: 100 %.
- **Se retira si.** Si no se firma en tres meses, se archiva.
- **Puerta.** Ninguna.
- **Relación con lo existente.** Nueva; espejo de WP-39.

#### XDN-04 · La carpeta para el banco

- **Problema.** Pedir una hipoteca o un préstamo exige reunir ingresos, deudas, CIRBE, patrimonio y gastos. El banco calcula su ratio de endeudamiento y conviene saberlo antes que él.
- **Propuesta.** Un dosier redactado con lo justo: ingresos de doce meses, deudas vivas y cuotas, cuota sobre ingresos y LTV como los calcula un banco, patrimonio y la lista de documentos que pedirá la entidad. Incluye «cuánto os prestarían» (DNU-01) con sus supuestos.
- **Experiencia.** «Preparar la carpeta» con lista de comprobación, vista previa y enlace caducable (A19-1) o copia.
- **Se apoya en.** canonical-payroll, canonical-debt-contracts, canonical-cirbe, canonical-net-worth, canonical-loan-guarantees y canonical-share-link.
- **Métrica.** Carpeta preparada en menos de 15 minutos.
- **Se retira si.** Condicionada a una operación en estudio.
- **Puerta.** CIRBE y contratos al día.
- **Relación con lo existente.** Absorbe DNU-01.

#### XDN-05 · Cambio de vivienda de principio a fin

- **Problema.** Comprar otra casa y vender la actual es la mayor decisión financiera de un hogar y lo cruza todo: impuestos de compra según la comunidad (ITP, o IVA y AJD), notaría, registro, gestoría, tasación, plusvalía municipal de la venta, préstamo puente, capacidad de endeudamiento, pérdida de la deducción por vivienda del régimen transitorio, colchón y cartera.
- **Propuesta.** Un escenario guiado sobre el motor de escenarios (E19-E20) con todas esas partidas, el orden (comprar antes o después de vender) y su efecto en la liquidez mínima, la deuda, el patrimonio y el plan B. Parámetros fiscales por comunidad con fuente y fecha.
- **Experiencia.** Asistente de seis pasos. Resultado en tres cifras (liquidez mínima, cuota, patrimonio a cinco años) y una línea de tiempo con los pagos.
- **Se apoya en.** canonical-scenario-engine, canonical-e13-scenarios, canonical-tax-tables y canonical-cushion.
- **Métrica.** El hogar puede responder «¿podemos?» con una cifra y su riesgo.
- **Se retira si.** Condicionada.
- **Puerta.** Que el hogar lo esté considerando.
- **Relación con lo existente.** Nueva.

#### XDN-06 · Qué retrasa esta deuda

- **Problema.** Una cuota nueva se evalúa sola («¿me la puedo permitir?»), no por lo que desplaza: la fecha de deuda cero, un objetivo, la aportación al plan, la cobertura de gastos.
- **Propuesta.** Toda simulación de deuda nueva enseña su efecto en los planes existentes: «retrasa la deuda cero 14 meses, el objetivo Coche 6 meses y baja la probabilidad de la entrada del piso del 80 al 61 %».
- **Experiencia.** Bloque fijo «Lo que cambia en vuestros planes», con tres líneas, en cada simulador.
- **Se apoya en.** canonical-debt-payoff-path, canonical-e15-goals y XIN-04.
- **Métrica.** Presente en todas las simulaciones de deuda.
- **Se retira si.** No aplica.
- **Puerta.** XIN-04 para la probabilidad; sin ella, solo fechas.
- **Relación con lo existente.** Nueva.

### Experiencia de uso (7)

| Id | Función | Valor | Esfuerzo | Δmin/sem | Horizonte |
|---|---|---|---|---|---|
| XUX-01 | Navegación por cinco preguntas | Alto | L (4) | 0 | Siguiente |
| XUX-02 | Ver cada pantalla con datos de ejemplo | Medio | S-M (1,5) | 0 | Ahora |
| XUX-03 | Ritual semanal guiado de cinco minutos | Alto | M (2) | −2 | Ahora |
| XUX-04 | Presupuesto de atención | Medio | M (2) | −1 | Siguiente |
| XUX-05 | Glosario con vuestras cifras | Bajo | S (1) | 0 | Siguiente |
| XUX-06 | Pantallas que no usas | Medio | S (1) | 0 | Ahora |
| XUX-07 | Desde tu última visita | Medio | S-M (1,5) | 0 | Siguiente |

#### XUX-01 · Navegación por cinco preguntas

- **Problema.** Hay 60 vistas, varias colocadas donde se construyeron, y al menos nueve tocan la deuda. El hogar no piensa en módulos, sino en preguntas.
- **Propuesta.** Cinco puertas: ¿Cuánto puedo gastar? (Hoy, intacto mientras siga congelado) · ¿Llegamos? (previsión, banda, plan B, pagos grandes) · ¿Qué hacemos con el dinero? (próximo euro, reparto de nómina, amortizar o invertir, deuda nueva) · ¿Cómo vamos? (patrimonio, cartera, deuda, cierre y carta) · ¿Qué tengo pendiente? (bandeja, datos, fiscal, ITV). Cada vista actual va a una puerta o se pliega; las direcciones antiguas redirigen, sin borrar código.
- **Experiencia.** Barra inferior de cinco iconos con texto, en la zona del pulgar. En cada puerta, la pregunta como título y como mucho cuatro tarjetas antes de «más».
- **Se apoya en.** Sin motor; mapa de redirecciones y una prueba que impide dejar una vista huérfana.
- **Métrica.** Toques hasta cada respuesta; vistas por semana; M-ADOP.
- **Se retira si.** Si en la prueba con cinco personas (WP-54) empeora la tasa de éxito, se revierte.
- **Puerta.** Lectura del panel de uso (WP-03) para decidir qué se pliega. Hoy no cambia.
- **Relación con lo existente.** Continúa docs/OLA1_ARQUITECTURA_NAVEGACION.md y aplica GOV-02 a escala.

#### XUX-02 · Ver cada pantalla con datos de ejemplo

- **Problema.** Muchas tarjetas enseñan «sin datos», «incompleto» o «ejemplo» hasta que se teclea algo (contratos, política, plan B, datos fiscales). Sin ver el resultado nadie dedica diez minutos al alta. Solo el gráfico de la cartera tiene modo de ejemplo.
- **Propuesta.** En cada tarjeta vacía, «Ver cómo quedaría» con el hogar de demostración (ya existe para el sitio público), marcado como ejemplo. Al cerrar, la lista exacta de datos necesarios y su tiempo estimado (del registro de XDA-01).
- **Experiencia.** Superposición con una banda «EJEMPLO» fija; nunca se mezcla con cifras reales.
- **Se apoya en.** Datos de build:demo.
- **Métrica.** Altas completadas después de ver el ejemplo.
- **Se retira si.** Si no sube el número de altas, se retira.
- **Puerta.** Ninguna.
- **Relación con lo existente.** Generaliza el modo de ejemplo del gráfico de la cartera.

#### XUX-03 · Ritual semanal guiado de cinco minutos

- **Problema.** El manual describe una revisión semanal y «Estado de la semana» la resume, pero no hay un recorrido que la haga en orden y mida el tiempo. M-COSTE se autodeclara.
- **Propuesta.** Recorrido de cinco pasos con cronómetro: saldos (pulso, «Coincide»), extracto (buzón), bandeja, la semana que viene (cargos y cobros) y una decisión (la primera de la cola por valor). Lo que está al día se salta.
- **Experiencia.** Pantalla completa, un paso cada vez, botón grande abajo. Al terminar: «4 min 10 s · todo al día». Racha discreta.
- **Se apoya en.** canonical-balance-pulse, canonical-data-queue y la vista Estado de la semana.
- **Métrica.** M-COSTE medido; M-FRESC ≥ 90 %.
- **Se retira si.** Si se abandona a medias más de la mitad de las veces.
- **Puerta.** Ninguna.
- **Relación con lo existente.** Convierte «Estado de la semana» en un flujo.

#### XUX-04 · Presupuesto de atención

- **Problema.** Cada paquete trae su aviso (Cierre, calendario, bandeja). La regla actual, «sin avisos nuevos», frena pero no ayuda a elegir.
- **Propuesta.** Un presupuesto de, por ejemplo, tres avisos por semana. Los candidatos compiten por euros en juego × urgencia; los que no entran se agrupan en un resumen del domingo. Cada aviso dice por qué ganó su sitio.
- **Experiencia.** En Ajustes, el presupuesto (de 1 a 7) y la lista «avisos que no han entrado esta semana».
- **Se apoya en.** canonical-reminders (WP-32), canonical-e16-monitoring y canonical-data-queue.
- **Métrica.** Avisos abiertos sobre avisos enviados ≥ 60 %.
- **Se retira si.** No aplica: sustituye a la regla actual.
- **Puerta.** Ninguna.
- **Relación con lo existente.** Sustituye «sin avisos nuevos» por un criterio.

#### XUX-05 · Glosario con vuestras cifras

- **Problema.** TIN, TAE, TWR, XIRR, LTV, P10-P90, diferencial… La app es rigurosa y eso la hace densa.
- **Propuesta.** Cada término técnico abre una explicación de dos líneas y un ejemplo con las cifras del propio hogar: «vuestra TAE real del préstamo del coche es 7,9 % porque el seguro…».
- **Experiencia.** Hoja inferior pequeña; también desde el buscador (Cmd/Ctrl+K).
- **Se apoya en.** Catálogo de términos y enlace a la cifra de origen.
- **Métrica.** Términos consultados; comprensión en la prueba con cinco personas.
- **Se retira si.** No aplica.
- **Puerta.** Ninguna.
- **Relación con lo existente.** Nueva.

#### XUX-06 · Pantallas que no usas

- **Problema.** GOV-02 exige «uno entra, uno sale», pero nada dice qué sale. El panel de uso (WP-03) ya cuenta qué se abre.
- **Propuesta.** En Ajustes, la lista de vistas no abiertas en 60 días con «Plegar» (sale del menú y sigue en el buscador) y «Restaurar». Cada función nueva dice qué pliega.
- **Experiencia.** Lista con la fecha de la última visita, y deshacer.
- **Se apoya en.** usage-panel.js.
- **Métrica.** Vistas visibles a la baja; GOV-02 cumplido.
- **Se retira si.** No aplica.
- **Puerta.** Al menos 60 días de panel de uso.
- **Relación con lo existente.** Herramienta de GOV-02; respeta «redirigir sin borrar código».

#### XUX-07 · Desde tu última visita

- **Problema.** Tras unos días sin abrir la app no se sabe qué ha cambiado: movimientos nuevos, la previsión de fin de mes, un aviso resuelto.
- **Propuesta.** Una tira con tres cambios ordenados por euros («la previsión de fin de mes ha bajado 120 € por el seguro del coche»), con enlace a cada uno. Desaparece al tocarla.
- **Experiencia.** Banda superior plegable, nunca más de tres líneas.
- **Se apoya en.** canonical-forecast-bridge generalizado a diario y la fecha de la última visita del panel de uso.
- **Métrica.** Tiempo hasta la primera acción tras abrir.
- **Se retira si.** Si se descarta sin leer más del 70 % de las veces.
- **Puerta.** H-02, porque va en Hoy.
- **Relación con lo existente.** Nueva.

### Funciones nuevas con interés (6)

| Id | Función | Valor | Esfuerzo | Δmin/sem | Horizonte |
|---|---|---|---|---|---|
| XNF-01 | Inventario del hogar para el seguro | Bajo | M (2) | +1 | Después |
| XNF-02 | Lo que cuesta de verdad el coche (y la casa) | Medio | S-M (1,5) | 0 | Después |
| XNF-03 | Si uno de los dos pierde el empleo | Alto | M (2) | 0 | Siguiente |
| XNF-04 | ¿Gastamos como un hogar parecido? | Bajo | M (2) | 0 | Después |
| XNF-05 | Memoria financiera del año | Medio | M (2) | 0 | Siguiente |
| XNF-06 | Mejoras en casa que se pagan solas | Medio | M (2) | 0 | Condicionada |

#### XNF-01 · Inventario del hogar para el seguro

- **Problema.** El comparador de seguro de hogar (SP3) compara el contenido asegurado con un valor de reposición declarado a ojo. El infraseguro (regla proporcional) se descubre en el siniestro, y las garantías y facturas se pierden.
- **Propuesta.** Inventario por estancia con fecha, precio, garantía y foto opcional. Valor de reposición con depreciación declarada; la suma alimenta SP3 y avisa del fin de cada garantía.
- **Experiencia.** Alta rápida desde la captura de tickets (OCR existente): «¿Lo añado al inventario?». Vista por estancia.
- **Se apoya en.** canonical-home-insurance y canonical-receipt-ocr; fotos en almacenamiento privado o solo en el dispositivo.
- **Métrica.** Infraseguro detectado y corregido.
- **Se retira si.** Si no pasa de diez objetos en tres meses.
- **Puerta.** Decisión del hogar sobre guardar fotos en la nube.
- **Relación con lo existente.** Alimenta SP3.

#### XNF-02 · Lo que cuesta de verdad el coche (y la casa)

- **Problema.** El coche se ve como cuota y gasolina; la vivienda, como hipoteca. Faltan seguro, impuesto de circulación, ITV, mantenimiento, aparcamiento, depreciación, IBI, comunidad y derramas.
- **Propuesta.** Coste total de propiedad mensual por activo, sumando las partidas del plan etiquetadas con ese activo y la depreciación declarada, comparado con alternativas (renting, transporte; DNU-02).
- **Experiencia.** Ficha por activo con barra apilada y «cada kilómetro os cuesta 0,41 €».
- **Se apoya en.** Partidas del plan con etiqueta de activo y canonical-assets.
- **Métrica.** El hogar conoce el coste mensual real de cada activo.
- **Se retira si.** Si no hay partidas que etiquetar.
- **Puerta.** Ninguna.
- **Relación con lo existente.** Base para DNU-02.

#### XNF-03 · Si uno de los dos pierde el empleo

- **Problema.** Las pruebas de estrés usan recortes genéricos de ingresos. La prestación por desempleo y la incapacidad temporal tienen reglas concretas (porcentajes de la base que bajan con el tiempo, topes, duración según lo cotizado) que cambian mucho el resultado.
- **Propuesta.** Escenario «paro» o «baja» por persona con la prestación calculada con parámetros versionados y su fuente, su duración, el plan B que se activaría y los meses de autonomía.
- **Experiencia.** Selector de persona y de evento. Resultado: «aguantáis 14 meses sin tocar la cartera; con el plan B, 22».
- **Se apoya en.** canonical-e13-scenarios, canonical-contingency-plan, resilienceMonths y canonical-payroll.
- **Métrica.** El hogar conoce sus meses de autonomía por persona.
- **Se retira si.** No aplica.
- **Puerta.** Base de cotización o bruto por persona (nóminas, WP-31).
- **Relación con lo existente.** Nueva; concreta NIN-09 y el plan B.

#### XNF-04 · ¿Gastamos como un hogar parecido?

- **Problema.** El hogar solo se compara consigo mismo. La Encuesta de Presupuestos Familiares del INE publica el gasto por grupos según tamaño del hogar, renta y comunidad.
- **Propuesta.** Comparar el gasto por grandes grupos (vivienda, alimentación, transporte, ocio…) con la mediana de hogares parecidos, con fuente y año. Sin juicios: «por encima, en línea o por debajo» y dónde mirar en la base cero.
- **Experiencia.** Barras divergentes por grupo con la referencia marcada y enlace a la partida.
- **Se apoya en.** Fichero público de XDA-07 y un mapeo de partidas a los grupos de la encuesta.
- **Métrica.** Partidas revisadas a raíz de la comparación.
- **Se retira si.** Si el mapeo a grupos no es fiable.
- **Puerta.** XDA-07.
- **Relación con lo existente.** Nueva.

#### XNF-05 · Memoria financiera del año

- **Problema.** La carta del mes (WP-29) cuenta un mes. Nadie cuenta el año: el patrimonio, la tasa de ahorro, la deuda, los impuestos, las decisiones y si salieron bien.
- **Propuesta.** Un documento determinista en enero con ocho apartados: patrimonio y su puente, ahorro, deuda, cartera y su puente, impuestos, decisiones y su resultado, acierto de la previsión y objetivos del año siguiente.
- **Experiencia.** Informe largo con índice y «Copiar».
- **Se apoya en.** canonical-month-letter, canonical-net-worth, canonical-forecast-bridge, XIN-03 y canonical-decisions.
- **Métrica.** Leída en enero.
- **Se retira si.** Si no se lee.
- **Puerta.** Doce cierres para la versión completa; antes, parcial y dicho.
- **Relación con lo existente.** Nueva.

#### XNF-06 · Mejoras en casa que se pagan solas

- **Problema.** Placas solares, aerotermia, ventanas o aislamiento tienen ahorro, ayudas y deducciones en el IRPF por eficiencia energética (con requisitos y plazos), y suelen decidirse sin números.
- **Propuesta.** Simulador de una inversión en la vivienda: coste, ahorro anual (declarado o estimado con las facturas reales de la partida), deducción aplicable con fuente, financiación y periodo de retorno, comparado con amortizar o invertir.
- **Experiencia.** Tarjeta con «se paga en 7,5 años; rentabilidad equivalente 9 %» y la comparación con la escalera del próximo euro.
- **Se apoya en.** Partidas de energía, canonical-debt-comparator y canonical-tax-tables.
- **Métrica.** Decisión tomada con el retorno calculado.
- **Se retira si.** Condicionada.
- **Puerta.** Interés del hogar.
- **Relación con lo existente.** Nueva.

### Plataforma y gobierno (3)

| Id | Función | Valor | Esfuerzo | Δmin/sem | Horizonte |
|---|---|---|---|---|---|
| XGO-01 | «Uno entra, uno sale» comprobado por el CI, y desalojo de app.js | Alto | M (2,5) | 0 | Ahora |
| XGO-02 | Medidor de utilidad por función | Alto | S-M (1,5) | 0 | Ahora |
| XGO-03 | Laboratorio | Alto | S (1) | 0 | Ahora |

#### XGO-01 · «Uno entra, uno sale» comprobado por el CI, y desalojo de app.js

- **Problema.** GOV-02 es una regla de papel. El techo de app.js (37.441 de 37.495 líneas) es la única barrera real y frena por tamaño, no por criterio.
- **Propuesta.** Una prueba que cuenta las vistas y tarjetas visibles por defecto y falla si una entrega añade una sin plegar otra (o sin una excepción escrita en el propio PR). Y un desalojo de unas 3.000 líneas de app.js a módulos antes de la Ola 4, sin cambios visibles.
- **Experiencia.** No se ve.
- **Se apoya en.** index.html y el registro de vistas de app.js.
- **Métrica.** Vistas visibles ≤ techo acordado; margen de app.js ≥ 2.000 líneas.
- **Se retira si.** No aplica.
- **Puerta.** Ninguna.
- **Relación con lo existente.** Hace cumplir GOV-02.

#### XGO-02 · Medidor de utilidad por función

- **Problema.** El panel de uso cuenta aperturas, no si una recomendación se siguió. Sin eso no se puede retirar nada con evidencia.
- **Propuesta.** Cada recomendación o aviso registra, en local y agregado, si se vio, si se actuó, si se descartó y si se deshizo. Un informe mensual por función: «Escalera del próximo euro: vista 9 veces, seguida 1».
- **Experiencia.** En Ajustes › Uso de la app, una tabla por función con su tasa de acción.
- **Se apoya en.** usage-panel.js.
- **Métrica.** Al menos una retirada por trimestre basada en datos.
- **Se retira si.** No aplica.
- **Puerta.** Ninguna.
- **Relación con lo existente.** Amplía WP-03.

#### XGO-03 · Laboratorio

- **Problema.** Cada función nueva aparece para todos y en su pantalla aunque nadie haya comprobado su valor, y quitarla después cuesta.
- **Propuesta.** Toda función nueva nace en el Laboratorio, apagada por defecto, con su métrica y su criterio de retirada escritos. Se gradúa a la navegación cuando cumple la métrica dos meses seguidos, o se retira.
- **Experiencia.** Ajustes › Laboratorio: lista con interruptor, una línea de qué hace y su estado («en prueba desde el 3/11 · métrica: 2 de 4 semanas»).
- **Se apoya en.** Banderas en ux-settings.js.
- **Métrica.** Funciones graduadas con la métrica cumplida.
- **Se retira si.** No aplica.
- **Puerta.** Ninguna.
- **Relación con lo existente.** Nueva; es la condición para el resto del catálogo.

## 7. Mejoras sobre propuestas ya catalogadas (no cuentan como nuevas)

| Propuesta | Qué es | Cambio | Por qué |
|---|---|---|---|
| UXS-03 | Medición automática de cuánto tarda cada tarea | P3 → P0 | Sustituye a la prueba cronometrada manual (H-02) como línea base de M-HOY y desbloquea Hoy. |
| NTC-05 | Fecha de retirada del doble motor de deuda | P3 → P1 | Antes de construir nada de deuda; si no, cada función nueva se programa dos veces o da cifras distintas. |
| NDB-03, NDB-05, DNU-01, DNU-02 | Asequibilidad, evaluador de ofertas, capacidad y coche | P3-P4 → un solo flujo | Se integran en el Taller de deuda nueva con XDN-01 a XDN-06. |
| DAC-03 | ¿Compensan las vinculaciones? | P3 → P2 | Dentro de la ITV de la deuda (XDO-06), con el seguro de vida vinculado frente a uno externo. |
| DAC-05 | ¿Cobra el banco la cuota pactada? | P3, manual → automática | Se casa cada recibo del extracto con el calendario de amortización del contrato y solo avisa si difiere. |
| NXP-03 | Procedencia bajo demanda | P3 → componente | Un único componente «cifra con fuente, edad y rango» en el sistema de diseño, usado por todas las tarjetas. |
| ND-12 | Precios de mercado por ISIN | P4 → sustituida | La cubren XDA-06 (captura o pegado) y XDA-07 (fichero público) sin conexión desde el móvil. |
| NPV-12 y PRV-07 | Prudencia global y «hasta dónde acierta» | P3 → sustituidas | Las cubren XPR-02 (corrección del sesgo) y XPR-03 (banda calibrada) con datos, no con un control manual. |
| ND-06 | Gestor de reglas de clasificación | P3 → casi innecesaria | XDA-05 crea las reglas al responder; el gestor queda para los casos raros. |
| WP-13 PR-2 | Fuente oficial de índices | archivada con O-6 → sustituida | XDA-07: el CI descarga las series públicas y las publica en el propio sitio. |
| WP-19 | Camino a deuda cero | abierto | Guardar el «extra al mes» (hoy no se guarda) y decidir las cuotas liberadas con XDO-03. |
| Jubilación (pensión pública) | Hoy se teclea a mano una cifra mensual | mejora pequeña | Asistente para trasladar los años y bases del informe de la Seguridad Social y estimar la pensión con su supuesto. |

## 8. Lo que no haría

- **IA generativa que escriba cifras.** La carta del mes acierta al ser determinista. Una IA puede redactar, pero ninguna cifra puede salir de ella.
- **Conexión PSD2 sin la revisión de seguridad.** El buzón de extractos y el fichero de índices dan casi todo el beneficio sin credenciales bancarias en ningún sitio.
- **Precios en tiempo real o trading.** Para una cartera de largo plazo, mirar más a menudo empeora las decisiones. Valoración mensual y calma en caídas.
- **Gamificación.** Rachas discretas en el ritual semanal sí; insignias, puntos o rankings no.
- **Una puntuación de salud única como cifra principal.** La puntuación existente agrega cosas que no se compensan entre sí. Mejor tres cifras con su explicación.

## 9. Hoja de ruta y reglas de capacidad

- **Antes de nada:** cerrar la Ola 3. Cada uno de los 26 paquetes en curso termina su segunda entrega o pasa a «esperando al hogar», que no puntúa. Límite de 3 paquetes en curso.
- **Ahora** (nov-dic 2026, tras cerrar la Ola 3; 24,5 sesiones): XDA-01, XDA-02, XDA-03, XDA-04, XDA-07, XDA-08, XPR-06, XIN-02, XDO-01, XDO-03, XUX-02, XUX-03, XUX-06, XGO-01, XGO-02, XGO-03.
- **Siguiente** (ene-mar 2027; 45,5 sesiones): XDA-05, XDA-06, XDA-09, XDA-10, XPR-01, XPR-04, XPR-05, XPR-07, XPR-08, XPR-10, XPR-11, XIN-01, XIN-03, XIN-04, XIN-05, XIN-08, XDO-02, XDO-04, XDN-03, XDN-06, XUX-01, XUX-04, XUX-05, XUX-07, XNF-03, XNF-05.
- **Después** (abr-jun 2027; 17 sesiones): XPR-02, XPR-03, XPR-09, XIN-06, XIN-07, XDO-05, XDO-06, XNF-01, XNF-02, XNF-04.
- **Condicionada** (solo cuando haya una decisión real en estudio; 12 sesiones): XDN-01, XDN-02, XDN-04, XDN-05, XNF-06.
- **Capacidad del hogar:** máximo dos tareas por semana y 10 minutos semanales de mantenimiento. Las funciones con Δmin negativo van primero.
- **Uno entra, uno sale:** cada función que se gradúe del Laboratorio pliega una vista, con el panel de uso como prueba.

## 10. Decisiones que necesito del hogar

1. **¿Sustituimos la prueba cronometrada H-02 por medición pasiva?** Recomendación: Sí. Sube UXS-03 a P0. La línea base de M-HOY sale del uso real y Hoy se descongela sin depender de un ritual.
2. **¿Autorizas un flujo de CI que descargue índices públicos (Banco de España, BCE, INE)?** Recomendación: Sí. Ningún dato del hogar sale y el móvil no se conecta a nada externo; solo lee un fichero de su propio sitio.
3. **¿Buzón de extractos en Supabase Storage, con un Atajo de iOS?** Recomendación: Sí, después de la revisión de seguridad NTC-06 del token del Atajo (solo escritura en el buzón, caducidad a 7 días).
4. **¿Biblioteca PDF en el origen de la app?** Recomendación: Todavía no. Empezar por «pegar el texto del PDF», como se hizo con la nómina; la biblioteca solo si eso se usa.
5. **¿Laboratorio obligatorio y límite de 3 paquetes en curso?** Recomendación: Sí, como regla permanente. Es lo que hace compatible un catálogo de 57 funciones con 10 minutos a la semana.
6. **¿Qué se hace con cada cuota que se libera al terminar una deuda?** Recomendación: Decisión vuestra. Mi propuesta por defecto: bola de nieve a la siguiente deuda cara y, sin deuda cara, la escalera del próximo euro.
7. **¿Abrimos la Ola 4 ya o cerramos antes la Ola 3?** Recomendación: Cerrar antes la Ola 3: 26 paquetes en curso no pueden convivir con 16 funciones nuevas.

## 11. Fuentes

Artefacto «Backlog cierre octubre» (17/10/2026) y la sesión que lo generó; `docs/ESTADO_TAREAS_Y_FASES.md`; `docs/plan/plan-definitivo.json` (53 paquetes, 104 propuestas, 10 métricas); `docs/PROPUESTA_SEXTA_AUDITORIA_2026-10-03.md` (reglas GOV-01 a GOV-06); `MANUAL_USUARIO.md`; cabeceras de los motores `canonical-*.js` citados en cada función; `index.html` (vistas) y `git log` del 7 al 17 de octubre.
