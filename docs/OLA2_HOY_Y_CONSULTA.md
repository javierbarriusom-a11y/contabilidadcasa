# Ola 2 — Hoy con veredicto y modo consulta: diseño

Fecha: 30 de septiembre de 2026 (sesión 278). Estado: **propuesta para decidir; no hay código**. Sigue el patrón de
`docs/OLA1_ARQUITECTURA_NAVEGACION.md`: primero el diagnóstico con datos reales, luego las decisiones que son del hogar.

Dato del hogar que condiciona todo: **dos personas; una opera (intensa) y la otra solo consulta**, y la que consulta
usa Hoy como producto entero. Móviles: iPhone 17 y iPhone 15 Pro.

## 1. Resumen

- **Hoy no responde «¿cuánto puedo gastar?».** Da ocho cifras que se parecen a esa respuesta, con unidades, horizontes
  y cuentas distintos, y **hay cuatro problemas verificados** entre ellas: un duplicado, un negativo oculto, dos lecturas
  que se contradicen y la cifra con más sentido vacía (§2). La respuesta, cuando existe, está a **~1.000–1.250 px**
  del borde superior en móvil, fuera de la primera pantalla.
- **La pieza que más se parece a un veredicto ya existe** —la tarjeta oscura «Hasta el siguiente ingreso»— **pero
  hoy muestra «—»** en el dataset demo (no conoce el gasto diario) y **su cálculo es tosco**: caja de CaixaBank menos
  días × gasto diario *medio aprendido*. No mira las salidas ya previstas ni la reserva.
- **La «reserva protegida» no es lo que su nombre sugiere para este fin**: es el suelo de reserva **más las salidas de
  todo el mes siguiente** (`canonical-decisions.js`, `transferForMonth`), pensada para decidir cuánto se traspasa a
  ahorro, no para saber cuánto se puede gastar hasta el próximo ingreso.
- **Propuesta:** un único bloque «veredicto» en la posición y con el código de la tarjeta oscura, con una **cascada de
  tres líneas** que reconcilia las cifras, un estado honesto cuando no se puede calcular, y la **frescura del dato**
  pegada a la cifra. La lógica de esa tarjeta sale de `app.js` hacia un módulo nuevo, así que la entrega **debería
  liberar** líneas en vez de gastarlas (estimación de 60–100, ver §4; no está medida).
- **Modo consulta: solo nivel 1** (preferencia de este dispositivo que simplifica y reordena; **no protege**).
  El nivel 2 (rol `viewer` real) **contradice OPT-22** y lo desaconsejo (§6).

## 2. Diagnóstico: qué responde Hoy hoy

Medido en el **dataset demo público** (30/09/2026), escritorio 1280 px y móvil 390 px. `#home` mide **6.601 px** en
escritorio y **11.422 px** en móvil. **Los valores son de la demo, no los de vuestros datos reales**; los problemas
estructurales (duplicado, negativo recortado, bases distintas) se dan con cualquier dato, mientras que el «—» de la cifra 3
depende de que haya histórico conciliado.

| # | Cifra en Hoy | Valor demo | Qué es de verdad | Cuenta | Horizonte |
|---|---|---|---|---|---|
| 1 | Liquidez hoy | 9.540 € | Saldo total | CaixaBank + Mediolanum | hoy |
| 2 | Caja disponible («de un vistazo») | 9.540 € | **La misma cifra que la 1** | CaixaBank + Mediolanum | hoy |
| 3 | Margen previsto (tarjeta oscura) | «—» | Caja CaixaBank − días × gasto diario medio | solo CaixaBank | hasta el próximo ingreso (8 días) |
| 4 | Reserva protegida | 7.230 € | Suelo de reserva + salidas del mes siguiente | solo CaixaBank | mes siguiente |
| 5 | «CaixaBank conserva hoy … por encima del mínimo» | 0,00 € | `Math.max(0, caja − reserva)`; **el valor real es −1.090 €** | solo CaixaBank | hoy |
| 6 | Capacidad libre real | 447,50 € | Media mensual de traspaso seguro a 12 meses | modelo | **€/mes**, no €, 12 meses |
| 7 | Próximo riesgo | «Sin déficit» | Primer mes del modelo con déficit | modelo mensual | horizonte del modelo |
| 8 | «El mes en una línea» | Previsto 4.730 · Real 0 · Desviación −4.730 | Ejecución del mes en curso | libro | mes |

### Problemas verificados

1. **Duplicado:** las cifras 1 y 2 son la misma (9.540 €) en dos bloques distintos.
2. **Se oculta un negativo:** CaixaBank tiene 6.140 € frente a una reserva de 7.230 €, es decir **−1.090 €**. La tarjeta
   dice «conserva hoy 0,00 € por encima del mínimo» (`Math.max(0, …)`, `app.js` en `renderHomeDashboard`) y a la vez
   la marca «FUERA DE UMBRAL». La cifra que importa —faltan 1.090 €— no aparece en ningún sitio.
3. **Se contradicen dos lecturas del mismo día:** «Reserva protegida: fuera de umbral» frente a «Próximo riesgo: sin
   déficit». Usan bases distintas —una foto de hoy y el modelo mensual— y no lo dicen.
4. **La cifra con más sentido está vacía:** el margen «hasta el siguiente ingreso» sale «—» con «necesidad — sin gasto
   diario conocido» porque depende de un gasto diario *aprendido* de movimientos conciliados, y en un hogar recién
   empezado o con pocos movimientos no existe. Una app cuyo primer mensaje es «datos insuficientes» no tranquiliza.

Además, la **cifra 6 no es comparable con las demás** (es €/mes) y aparece en la misma fila.

### Dónde está la respuesta en pantalla

Alturas de bloque medidas en móvil (390 px): aviso de primeros pasos 259 px + cabecera de Hoy 304 px + rejilla «de un
vistazo» 683 px = **la tarjeta de cobertura empieza a ~1.246 px**; **~987 px si ya se descartó el aviso de primeros
pasos** («Ya lo tengo claro»). Una pantalla de iPhone enseña unos 700–800 px útiles: **incluso sin el aviso hace falta
desplazarse para llegar a la cifra que responde la pregunta**.

## 3. Propuesta: el veredicto y su cascada

### 3.1 Definir «el número» (decisión del hogar, ver §8-1)

Hay tres definiciones posibles de «cuánto podéis gastar hasta el día Y». Mi recomendación es la **A**.

| | Definición | A favor | En contra |
|---|---|---|---|
| **A (recomendada)** | Caja de CaixaBank hoy − suelo de reserva − **salidas ya previstas hasta el próximo ingreso** | Usa datos que la app ya tiene (eventos del motor diario); responde exactamente a «¿hasta el día Y?»; no depende de un gasto medio aprendido | Hay que construir la suma de salidas previstas entre hoy y la fecha del ingreso (el motor diario ya emite esos eventos) |
| B | La actual: caja − días × gasto diario medio | Ya existe | Ignora las facturas conocidas; queda vacía sin histórico |
| C | Lo que queda del presupuesto del mes | Fácil de entender | Solo existe si hay presupuestos; la demo dice «sin presupuestos» |

**Cascada propuesta** (una tarjeta, tres líneas, todas visibles):

```
Caja de CaixaBank hoy                          6.140 €
− Suelo de reserva (Ajustes)                   −X €
− Salidas ya previstas hasta el 8 oct         −Y €
= Margen hasta el 8 oct (8 días)               Z €   ≈ Z/8 € al día
```

- **Si Z < 0**, la frase es: «Hoy no hay margen: faltan |Z| € para cubrir la reserva y lo previsto hasta el 8 oct». El
  negativo **se dice**, no se recorta a 0.
- **Si falta un dato** (fecha del próximo ingreso, o suelo de reserva), el bloque **no muestra una cifra**: dice qué
  dato falta y enlaza al editor que ya existe (el de la tarjeta oscura actual). Nunca «—» sin explicación.
- **Mediolanum queda fuera del margen** y se dice en una línea («ahorro aparte: 3.400 €»); ver §8-2.
- La **reserva protegida de hoy** (suelo + mes siguiente) deja de ser una cifra suelta de Hoy: pasa al detalle, con su
  nombre real («reserva para el mes que viene»), porque responde a otra pregunta (¿cuánto se puede traspasar a ahorro?).

### 3.2 Reconciliar el resto de Hoy

| Cifra actual | Qué pasa con ella |
|---|---|
| Liquidez hoy / Caja disponible | **Una sola**, dentro de la cascada; se quita el duplicado |
| Margen previsto (tarjeta oscura) | Se convierte en el veredicto |
| Reserva protegida | Pasa al detalle, con nombre correcto y el margen **con signo** |
| Capacidad libre real | Se queda en el detalle, con su unidad en el título («por mes») |
| Próximo riesgo | Se queda; su texto dice **a qué fecha y con qué base** se calcula, para no contradecir al veredicto |
| El mes en una línea | Sin cambios |

### 3.3 Frescura del dato, pegada a la cifra

Hoy la frescura está repartida en cuatro sitios (insignia de dato, chip «Guardado a las 13:47», «Analizado a
2026-09-30 · libro canónico calculado», «confianza medium»), ninguno pensado para quien **consulta** y quiere saber una
sola cosa: *¿esto está al día o lo dejó a medias quien registra?* Propuesta: **una línea bajo el veredicto** —«Saldos a
30 sep · último movimiento registrado hace N días · guardado 13:47»— y un tono de aviso si el dato es viejo.

### 3.4 «Carta del mes» (necesito que me digas qué esperas, ver §8-3)

El backlog lo nombra sin definirlo. Mi lectura: un **párrafo en lenguaje llano**, generado a partir de cifras que la app
ya calcula (sin IA generativa), pensado para la persona que consulta: «Septiembre cierra con X € de margen; el gasto va un
N % por encima/debajo de lo previsto; queda Z de deuda; lo próximo: …». Es la pieza más subjetiva y la que menos
recomiendo hacer antes de acertar con el veredicto.

## 4. Restricciones técnicas

- **`app.js` está en su techo (37.530 líneas).** La tarjeta de cobertura actual —`e6CoverageSettings`,
  `executiveCoverageSnapshot`, `homeCoverageBadge`, `renderHomeCoverageCard`, `homeCoverageEditor*`, `renderE6Coverage`,
  `previewE6Coverage`, `saveE6Coverage`— ocupa ~150 líneas contiguas (`app.js` ~21.657–21.810). El veredicto **la
  sustituye en el mismo hueco**. Ojo con la promesa: esas funciones tocan estado y DOM de `app.js` (`qs`,
  `scenarioSettings`, `state`), así que **no se mueven enteras**: la lógica pura (cálculo, insignia de confianza) sale a un
  módulo nuevo (`canonical-home-verdict.js`, con pruebas) y el pintado y el editor se reescriben más cortos. Estimo
  60–100 líneas liberadas; **es una estimación que se confirma en la entrega 1**, no una garantía. Si saliera peor,
  se decide entonces cómo hacer sitio, como en la entrega 4 de la Ola 1.
- **El cálculo va en un módulo puro**, comprobable contra los datasets dorados (`golden:datasets`), como el resto de
  motores canónicos. `app.js` solo llama a una función y pinta.
- **Presupuesto de carga** (`test:load-budget`, mediana ≤ 5 s a CPU 4×, hoy 3,2–3,8 s): un script más y un cálculo más
  entran en el camino del primer pintado; se mide antes y después.

## 5. Métrica de éxito

«Tiempo hasta responder ¿cuánto puedo gastar?», medida como **posición vertical del veredicto en un móvil de 390×844 y
número de desplazamientos necesarios**. Hoy: ~1.246 px (~987 px sin el aviso de primeros pasos). Objetivo: **visible sin desplazarse** (< 700 px).
Se comprueba con una prueba de navegador, no a ojo.

## 6. Modo consulta

### Nivel 1 — interfaz de consulta por dispositivo (recomendado)

Una preferencia **de este dispositivo** (como «Personalizar»: localStorage, sin tocar los datos) que:

- deja Hoy en su versión corta (veredicto, frescura, decisiones abiertas) y pliega el detalle;
- oculta lo que escribe (botón «+ Registrar gasto», editores) y simplifica el menú a lo que se consulta;
- se activa y desactiva con un interruptor visible, y **dice que es una comodidad, no una protección**.

Ya existe un **«Modo reunión»** de Hoy (enseña un bloque cada vez) y una **«Vista por titular»** (metas, deuda y
aportación por persona); el modo consulta debe reutilizarlos, no duplicarlos.

### Nivel 2 — rol `viewer` real (no recomendado)

`docs/OPT22_MODELO_HOGAR.md` (29/08/2026) decidió **«no construir control de acceso, permisos ni visibilidad por
persona» sobre este modelo**: hay **una cuenta de Supabase compartida** y «Javi/Tere» son una etiqueta inferida por
texto, no identidades. Un rol de solo lectura exigiría autenticación por persona, políticas RLS nuevas y datos con
propietario explícito: **diseñarlo aparte, desde cero, y revisar OPT-22 antes**. Coste alto; ganancia para un hogar de
dos personas de confianza, baja.

**Límite que hay que asumir del nivel 1:** la persona que consulta **puede editar por error** (misma cuenta, mismos
permisos). Mitigación posible, más costosa: un «candado de solo lectura» que bloquee las escrituras desde ese dispositivo;
toca todos los puntos que escriben en `app.js` (muchos) y no lo propongo en esta ola.

## 7. Secuencia propuesta

| Entrega | Contenido | Tamaño | Riesgo |
|---|---|---|---|
| 1 | Módulo `canonical-home-verdict.js` (cálculo de la cascada, estados honestos) con pruebas contra datasets dorados; **sin cambiar la pantalla** | Medio | Bajo |
| 2 | La tarjeta oscura pasa a ser el veredicto (código sale de `app.js`); se quita el duplicado Liquidez/Caja; el negativo se dice; se corrige el texto de «Próximo riesgo» | Medio | Medio: cambia la pantalla más vista |
| 3 | Frescura del dato pegada a la cifra; el veredicto sube sobre la primera pantalla en móvil; prueba de posición | Pequeño | Bajo |
| 4 | Modo consulta nivel 1 | Medio | Medio: decide qué se oculta |
| 5 | «Carta del mes», **solo si** se define (§8-3) | Pequeño-medio | Bajo |

## 8. Decisiones que necesito del hogar

1. **¿Qué es «el número»?** Recomiendo la definición A (caja − suelo de reserva − salidas previstas hasta el próximo
   ingreso). ¿Coincide con lo que vosotros entendéis por «lo que podemos gastar»?
2. **¿Mediolanum cuenta como gastable?** Mi propuesta es que no (queda como «ahorro aparte»). Si en casa lo usáis como
   caja para imprevistos, el margen sería otro número.
3. **«Carta del mes»: ¿qué esperáis?** Mi lectura (§3.4) es un párrafo llano con las cifras del mes. Si pensáis en otra
   cosa (un PDF, un correo, un cierre firmado), lo cambio.
4. **Modo consulta: ¿solo nivel 1, sabiendo que no protege?** Recomiendo que sí.
5. **En modo consulta, ¿se pliega el detalle de Hoy por defecto?** Hoy mide 11.400 px en móvil.

## 9. Lo que descarto, y por qué

- **Un veredicto sobre el saldo total** (9.540 €): incluye ahorro y no responde «hasta el día Y».
- **Reutilizar la «reserva protegida» como base:** mide otra cosa (traspaso a ahorro, mes siguiente) y daría un margen
  engañosamente bajo.
- **Rol `viewer` real ahora:** contradice OPT-22 y el hogar no lo ha pedido.
