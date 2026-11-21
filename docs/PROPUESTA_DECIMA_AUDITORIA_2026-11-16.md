# Décima auditoría · 16/11/2026 · Uso y experiencia: diagnóstico medido, 46 funciones nuevas y lo que sigue sin hacer

> Pedida por el hogar el 16/11/2026: «sigue analizando la app de manera crítica […] propón nuevas mejoras y features […] más
> de 40 nuevas adicionales en los ámbitos que sean relevantes, especialmente en uso y experiencia de usuario y optimizando lo
> ya desarrollado. Revisa del backlog anterior las nuevas funcionalidades que no hayan sido implementadas».
>
> **Es una propuesta.** El único backlog vivo sigue siendo `BACKLOG_NOVIEMBRE_OLEADA_1.md`, y nada de aquí levanta D-N11
> (hasta el 4/12, prioridad a que lo que entra quede con partida y nada de previsión nueva) ni el Lote 1 rechazado (DEU-02,
> DNV-02, DEU-05). **Sin importes ni nombres del hogar**: las cifras que aparecen son de la demo pública
> (`demo-publico-anonimizado`) o se dicen como mecanismo.
>
> Complementa, no repite, a la novena (`docs/PROPUESTA_NOVENA_AUDITORIA_2026-11-14.md`, 53 funciones) y a la octava
> (`docs/PROPUESTA_OCTAVA_AUDITORIA_2026-11-05.md`, FX-nn). Las 46 nuevas llevan el prefijo **DEC-nn** (no se usaba).

---

## 0. Resumen en siete frases

1. **La app ya no tiene un problema de funciones, tiene un problema de carga.** Medido hoy en la demo: 60 vistas, 54 enlaces
   en el menú lateral, Ajustes con 59 titulares, 115 campos y 108 botones en **34.000 px de alto en el móvil** (unas 40
   pantallas de iPhone), Inversión › Cartera 9.100 px y Deuda › Contratos 5.600 px con una tabla de 10 columnas en 390 px.
2. **La regla «uno entra, uno sale» no está sacando nada.** El inventario de titulares pasó de una base de 224 a 231, con 3
   excepciones; y lo nuevo cumple la regla **plegándose** (`<details>`), no retirando otra cosa. Plegar es aplazar la
   decisión: la superficie real crece y lo plegado no se descubre. Propongo medir también lo plegado (DEC-40).
3. **La confianza en la cifra es el producto, y hoy se erosiona en pequeño.** La demo lleva la insignia «Dato real»; Hoy
   enseña a la vez «Saldos estimados», un asterisco en la deuda y **cinco cifras en euros** en su cabecera; Deuda › Ruta
   titula «Libre de deuda: sin fecha estimable» encima de «octubre de 2029». Ninguna es un error de cálculo; todas restan.
4. **La foto de la deuda del hogar no cabe en el modelo de Contratos.** Un informe de un fichero de solvencia trae saldo
   **impagado**, y una deuda impagada suele estar **vencida entera** (vencimiento anticipado), no en cuotas: la previsión, que
   la cuenta como cuota mensual, puede estar sobrestimando lo disponible. Contratos solo tiene cuatro estados (activa, pagos
   suspendidos, reunificada, liquidada) y ningún importe de atraso; el «Plan deuda óptimo» heredado sí modelaba ficheros,
   quitas y atrasos. **Antes de tocar Deuda o Préstamo hay que saber cuál es la foto vigente** (§1.4 y D-N16).
5. **Lo que más rinde ahora es optimizar lo que ya existe** (§5: 14 de las 46), sobre todo en el móvil, donde el hogar mira
   la app «a veces» y donde la cabecera, el menú y las tablas cuestan más.
6. **De las 53 funciones de la novena, 47 siguen sin hacer** (§3). Recomiendo fusionar 9 con propuestas nuevas, bajar 11 y
   descartar o replantear 3 (CLA-04 choca con una decisión del hogar).
7. **Para las próximas dos semanas (hasta el 4/12), seis cosas que encajan con D-N11** y no necesitan decisión nueva (§6);
   el resto espera a la revisión de salida y a D-N16 a D-N19 (§7).

---

## 1. Diagnóstico crítico (medido el 16/11 con la demo, Chromium, 390 × 844 y 1440 × 900)

### 1.1 Carga: demasiada app para diez minutos a la semana

| Medida | Valor | Lectura |
|---|---|---|
| Vistas (`.view-section`) | 60 | Para un hogar que usa importar, clasificar, cerrar y mirar Hoy |
| Enlaces del menú lateral | 54 (10 principales + «Herramientas avanzadas» + «Versiones anteriores») | Ruido y la pregunta «¿cuál es la buena?» (novena §1.2) |
| Ajustes en el móvil | 34.000 px · 59 titulares · 115 campos · 108 botones | Una página que nadie recorre; es un almacén, no una pantalla |
| Inversión › Cartera en el móvil | 9.100 px | Cinco pestañas y la primera ya mide 11 pantallas |
| Deuda › Contratos en el móvil | 5.600 px; tabla de 10 columnas | En 390 px una tabla de 10 columnas no se lee: se desplaza |
| Cabecera de Hoy | 5 cifras en euros antes de la primera decisión | Contra el principio 1 («una pregunta, una cifra, una acción») |
| Hoy en el móvil | el contenido empieza a 208 px (a 507 px con «Primeros pasos») | La cabecera fija mide 70 px y la tarjeta de primeros pasos se lleva media pantalla |
| Funciones en prueba | «15 por revisar» en el menú | Las revisiones se acumulan más deprisa de lo que el hogar las contesta |

**Lo crítico no es el número, es la tendencia.** Cada oleada ha añadido más de lo que ha retirado. El rediseño ha tapado lo
viejo con «Ver todo el detalle» (correcto mientras se gradúa) pero nada se ha retirado todavía, y la demo sigue cargando el
`app.js` de 32.000 líneas en cada visita.

### 1.2 «Uno entra, uno sale» se cumple plegando

Las tres últimas entregas (#625 a #627) cumplieron XGO-01 con un desplegable cerrado. Es la salida correcta para no romper el
CI, pero tiene dos costes que la regla no ve:

- **Descubribilidad:** una función plegada que nadie abre no existe. El medidor (XGO-02) no cuenta aperturas de desplegables,
  así que no sabemos si «Dar de alta varios contratos» o «N reglas por palabras» se han abierto alguna vez.
- **Deuda de superficie escondida:** el inventario cuenta titulares visibles por defecto; lo plegado no cuenta. La superficie
  real crece sin que ningún número lo diga.

### 1.3 Confianza en la cifra

- **Procedencia contradictoria:** la insignia «Dato real» aparece con la fuente `demo-publico-anonimizado`; a la vez, la
  píldora «Saldos estimados · confírmalos con tu banco». Una app financiera tiene que decir **una** cosa sobre de dónde sale
  la cifra.
- **Cinco cifras en la cabecera de Hoy:** disponible hasta cobrar, fin de mes, margen sobre el suelo, reserva protegida y su
  margen. Son coherentes entre sí (FX-01), pero exigen saber cómo se relacionan para leerlas.
- **Mensajes cruzados en «Decidir esta semana»:** «Construir colchón… cobertura 1,1 meses frente a 4» junto a «Reserva
  protegida cubierta». Son dos conceptos distintos (colchón objetivo y reserva protegida) con nombres que suenan igual.
- **Llamadas a la acción genéricas:** dos de tres decisiones dicen «Revisar alerta»; la tercera manda a «Ajustes ›
  Patrimonio e inversión» para rebalancear cuando existe Inversión › Rebalanceo.
- **Asteriscos y notas al pie** («libre oct 2029*», «solo deudas con cuota»): son honestos, pero un asterisco en la cifra
  principal de una tarjeta es la forma más débil de decir «faltan datos».

### 1.4 Deuda: tres fotos que no coinciden

1. **Deuda › Contratos** (motor canónico): lo que el hogar declare; hoy, en su navegador, probablemente los contratos de
   ejemplo más lo que haya dado de alta desde «Detectadas en vuestros recibos».
2. **El «Plan deuda óptimo» heredado** (`views/debt-liquidation-plan.js`, en «Versiones anteriores»): supuestos con
   ficheros de morosidad, CIRBE, quitas, pagos suspendidos y atrasos de una fecha pasada, escritos en el código.
3. **El informe de solvencia** del 15/11: siete operaciones de dos entidades con saldo impagado, que contradice lo dicho el
   14-15/11 (sin revolving, poco pendiente).

**Añadido el 17/11:** el simulador visual de deuda (`debt-roadmap.html`) es, según el historial (sesiones 255-257, 28/9), la
herramienta de **una negociación real con dos acreedores** que el hogar confirmó entonces como activa, con un tercero ya
resuelto. Cuadra con un informe de dos entidades y refuerza D-N16: es probable que la foto vigente sea «impagos en
negociación», no «poco pendiente». Lo que el simulador decide no llega hoy a Contratos: es el bloque SVD
(`docs/SVD_DISENO.md`).

Consecuencias, en orden de gravedad:

| Qué | Por qué importa |
|---|---|
| Un impagado suele llevar **vencimiento anticipado**: se debe entero, ya | La previsión cuenta cuotas mensuales; si el saldo es exigible, «Disponible hasta cobrar» puede estar inflado y el préstamo simulado responde a otra pregunta |
| El saldo impagado **no es el capital pendiente** (lleva intereses de demora, comisiones de reclamación, a veces costas) | Dar de alta «capital = saldo del informe» mezcla deuda viva con recargos negociables |
| Contratos no tiene estado «impagada» ni importe de atraso | La app no puede distinguir «pagamos la cuota» de «la entidad ya reclama el total» |
| La inclusión en un fichero cambia la **financiabilidad** | Un préstamo nuevo para refinanciar puede no concederse mientras siga la inscripción; la quita o el plan de pagos con la entidad acreedora suele ser el primer paso, no el préstamo |

**Por eso no toco Deuda ni Préstamo en esta sesión** y la primera pregunta al hogar es la foto vigente (D-N16, §7). Las
propuestas de Deuda (DEC-24 a DEC-29) están escritas para cualquiera de las dos respuestas.

### 1.5 Autocrítica de lo construido del 14 al 16/11

- **Se construyó sin un extracto real delante.** Las reglas por palabras (CLA-01/02), la propuesta por parecido (CLA-03) y
  los traspasos (DAT-05) se probaron con datos inventados. No sabemos cómo escribe el banco del hogar los Bizum ni si importa
  una cuenta o varias. Antes de añadir más señales a Clasificar hace falta ver **la forma** de su extracto, sin sus datos
  (DEC-13).
- **CLA-04 (gestos) choca con una decisión del hogar:** «las tarjetas que se deslizan» se descartaron en XDA-05
  (`ESTADO.md` §2). No debe construirse tal cual (§3).
- **«Hazlo tú en mi lugar»** se leyó como permiso para probar con datos inventados y decidir el diseño, no para levantar
  decisiones. Sigue sin confirmar (D-N19).

### 1.6 Lo que funciona y hay que proteger

El ciclo semanal (repaso, importar, clasificar), la honestidad de las cifras (confianza con su porqué, «Antes de decidir»,
rango probable), el «Deshacer» en todas partes, el cierre con «Por clasificar», la accesibilidad (axe en claro y oscuro, 151
pruebas) y el CI con Safari. **Ninguna propuesta de este documento debilita eso.**

---

## 2. Principios para las propuestas (los del rediseño, más tres)

Los diez de la séptima auditoría y las decisiones de `ESTADO.md` §3 siguen mandando (verde sólido = acción, azul = previsto,
una cifra por pregunta, lo que no tiene datos se pliega, nada se retira sin consultar, «Qué ocurrirá» antes de cambiar el
plan). Se añaden:

- **P-A · Cada función nueva dice qué retira o qué fusiona.** Si no retira nada, su coste en superficie se dice en el PR.
- **P-B · Móvil primero de verdad:** toda pantalla nueva o rehecha se diseña a 390 px y se mide su alto; el objetivo es que la
  respuesta principal quepa en la primera pantalla (844 px) y que la pantalla entera no pase de 4 pantallas.
- **P-C · Probar con la forma del dato real antes de dar algo por hecho:** cuando una función depende de cómo escribe el
  banco, se valida con la huella anónima del extracto (DEC-13), no solo con la demo.

Formato de cada propuesta: **qué** · **por qué** (con la evidencia) · **UX/UI** · **métrica** · esfuerzo (S ≤ 1 sesión, M
2-3, L 4+) · prioridad (P0 antes del 4/12 y dentro de D-N11; P1 Oleada 2; P2 después) · **encaje** (qué decisión o pieza
toca).

---

## 3. Lo que sigue sin hacer del backlog anterior

### 3.1 Novena auditoría (53): 6 hechas, 47 abiertas

Hechas: **DAT-05**, **CLA-01**, **CLA-02** (falta «quién debe a quién»), **CLA-03**, la parte de medición de **PRV-01** y la
pestaña Préstamo (§2 de la novena, fuera del catálogo).

| ID | Qué | Recomendación | Por qué |
|---|---|---|---|
| DAT-01 | Extracto de la tarjeta Carrefour con su detalle | **Mantener P0 tras el 4/12** | Es la pieza que falta del gasto variable y de suscripciones |
| DAT-02 | PSD2 de solo lectura | Bajar a P2 (sin cambio) | El atasco es clasificar, no traer datos |
| DAT-03 | Buzón por correo | **Fusionar con DEC-11** | El buzón del Atajo (XDA-02 PR-2) sigue sin desplegar: primero que funcione uno |
| DAT-04 | Saldos con una captura | Mantener P1 | El paso de saldos es el más repetitivo del repaso |
| DAT-06 | Índice de calidad del dato | **Fusionar con DEC-02** | Es la misma idea con una cara visible en cada cifra |
| DAT-07 | Dividir un movimiento | **Mantener P0** (dentro de D-N11) | Sin dividir, un ticket mixto obliga a elegir mal o a dejarlo sin partida |
| CLA-02 (resto) | Quién debe a quién | Mantener P1, con HOG-03 | Sin datos de pareja compartida no hay con qué probarlo |
| CLA-04 | Clasificar a gestos | **Replantear como DEC-15** | El hogar descartó las tarjetas que se deslizan; teclas 1-3 ya existen en escritorio |
| CLA-05 | Propuesta con modelo de lenguaje | Mantener P2 | Opt-in y medido; antes, agotar las señales locales |
| PRV-01 | Recalibrador del gasto variable | Mantener (espera D-N12) | Es el cimiento de la previsión |
| PRV-02 | Gastos irregulares («huchas») | Mantener P1 | — |
| PRV-03 | Estacionalidad | Mantener P1, dentro de PRV-01 | — |
| PRV-04 | Previsión por remuestreo | Bajar a P2 | Necesita 12 meses de reales con partida |
| PRV-05 | Deriva por partida | **Mantener P0 tras el 4/12** | Habría detectado el agujero del gasto variable |
| PRV-06 | Inflación por categoría | Bajar a P2 | Precisión falsa mientras el variable no esté medido |
| PRV-07 | Línea de vida 2026-2036 | Mantener P1 | Lo que mueve 10 años son decisiones grandes |
| PRV-08 | Exportar la previsión a Excel con fórmulas | **Subir a P1 alto** | El hogar viene de Excel; es la auditoría externa más barata |
| PRV-09 | Previsión en sombra | Mantener P1, junto a PRV-01 | — |
| SUS-01 | Centro de suscripciones | Mantener P1 (tras DAT-01) | Sin el detalle de la tarjeta no hay inventario |
| SUS-02 | Rotación de plataformas | Bajar a P2 | Útil, pero es una decisión del hogar, no un cálculo |
| SUS-03 | Pruebas gratuitas | **Fusionar con DEC-33** | Es un recordatorio más del calendario |
| DEU-01 | Préstamo, fase 2 | **Congelar hasta D-N16** | Si hay impagos, la pregunta no es qué préstamo sino qué negociar |
| DEU-02 | Chequeo de revolving | Rechazada (Lote 1); **reconsiderar con D-N16** | El informe la hace más oportuna; decide el hogar |
| DEU-03 | Pago mínimo frente a plan | Mantener P1 | — |
| DEU-04 | Pagas extra a deuda | Mantener P1 | — |
| DEU-05 | Anti-recaída | Rechazada (Lote 1) | — |
| DEU-06 | Kit de negociación | **Subir a P0 condicionado a D-N16 → DEC-26** | Con saldos impagados, negociar es la primera palanca |
| DEU-07 | Termómetro de deuda cero | Mantener P1 | Motivación compartida |
| DEU-08 | Deuda en una pantalla (D3) | Mantener (tras NTC-05) | Y retirar el plan heredado tras migrar lo que solo él sabe (DEC-27) |
| DNV-01 | Taller de deuda nueva | Bajar a P2 | Antes, la foto de la deuda actual |
| DNV-02 | Capacidad por titular | Rechazada (Lote 1); reconsiderar con D-N16 | — |
| DNV-03 | Finalista o libre | Mantener P1 | El préstamo simulado podía ser finalista (D-N13) |
| DNV-04 | Alternativa sin deuda | Bajar a P2 | — |
| DNV-05 | Protección de pagos | Bajar a P2 | — |
| INV-01 | Inversión con una pregunta | Mantener P1, **con DEC-07** | Cartera mide 9.100 px en el móvil |
| INV-02 | Semáforo invertir o amortizar | **Mantener P0 tras D-N16** | Con deuda cara o impagada, invertir no tiene sentido |
| INV-03 | Coste total de la cartera | Mantener P1 | — |
| INV-04 | Importar posiciones por CSV | Mantener P1 | — |
| INV-05 | Objetivos con probabilidad | Bajar a P2 (= FX-53) | Duplicado con la octava |
| INV-06 | Aportar lo que la previsión garantiza | Mantener P1, tras PRV-01 | — |
| INV-07 | Concentración real | Bajar a P2 | — |
| HOG-01 | Acta de decisiones | **Fusionar con DEC-35** | — |
| HOG-02 | El móvil del otro | **Fusionar con DEC-34** | — |
| HOG-03 | Lo mío, lo tuyo, lo nuestro | Mantener P2, con CLA-02 resto | — |
| HOG-04 | Modo enseñar (ocultar cifras) | **Fusionar con DEC-36** | Ya existe un «modo sesión» en Ajustes que oculta simuladores, no cifras |
| UX-01 | Navegación de 5 destinos | **Mantener P1, adelantar el móvil con DEC-05** | — |
| UX-02 | Cada cifra se puede tocar | **Fusionar con DEC-01** | — |
| UX-03 | Atajo «Cuánto podemos gastar» | Mantener P2 | — |
| UX-04 | Modo reunión | **Fusionar con DEC-37** | — |
| UX-05 | Arranque en menos de 2 s | Mantener P1, con DEC-42 | — |

### 3.2 Octava auditoría (FX-nn) abiertas

FX-21 resto (4 pruebas de estrés), FX-24, FX-25 (un solo motor de escenarios), FX-26 (diario de decisiones, **fusionar con
DEC-35**), FX-32 a FX-35 (con disparador de datos, sin cambio), FX-52 (tornado), FX-53, FX-60 (navegación por cinco
preguntas, = UX-01), FX-63 y FX-64 (lectura para compartir, **fusionar con DEC-37**). RD-D1/D2 (Patrimonio e Inversión con el
diseño nuevo) esperan a la Oleada 2. Sin cambio de prioridad salvo lo dicho.

### 3.3 Séptima auditoría sin adoptar

XDA-06 a 09, XIN-01/03/05/06/08, XDO-01/03 a 06, XDN-*, XUX-04/06 y XNF-01/02/04/05/06 siguen como propuesta. **Recomiendo
archivarlas formalmente** el 4/12 salvo las que esta auditoría recoge (XDA-08, confirmación automática de cobros, en DEC-12):
mantener tres catálogos abiertos a la vez hace imposible saber qué queda.

---

## 4. Catálogo: 46 funciones nuevas (DEC-01 a DEC-46)

### 4.1 Confianza y procedencia del dato (DEC-01 a DEC-04)

**DEC-01 · «¿De dónde sale?» en las cifras protagonistas.** Tocar la cifra principal de Hoy, Previsión, Plan › Mes, Cierre
y Deuda abre una hoja con tres bloques: **de qué está hecha** (saldo de partida, cobros y pagos hasta la fecha, suelo), **de
cuándo es cada dato** (fecha del saldo, del último extracto, de los supuestos) y **qué la cambiaría más** (la tarea que más
la mueve, como FX-31). *Por qué:* la confianza se gana explicando la cifra, no añadiendo cifras; absorbe UX-02. *UX/UI:* la
cifra lleva un subrayado punteado discreto (no un icono); hoja inferior en el móvil, panel lateral de 400 px en escritorio;
cada línea enlaza a su sitio; teclado: Intro abre, Esc cierra, foco devuelto a la cifra. *Métrica:* aperturas por semana y
tiempo hasta la primera acción tras abrirla. M · P1 · Encaje: reutiliza el contrato de cifras de FX-01.

**DEC-02 · Sello de calidad en cada cifra calculada.** Un punto (○ ◐ ●) junto a cada cifra que dependa de datos: cubierto,
clasificado y con saldo cuadrado en el periodo que usa. Fusiona DAT-06. *Por qué:* hoy la confianza mide supuestos; no dice
«este mes tiene un hueco de extracto y un 30 % sin partida». *UX/UI:* el mismo punto que la insignia de Hoy, con su nombre
al pasar o al tocar; nunca color solo (forma + texto). *Métrica:* % de cifras protagonistas con sello ●. S-M · P0 (solo
cálculo y en Cierre) / P1 (resto) · Encaje: `canonical-ledger-coverage.js` + % clasificado.

**DEC-03 · Una sola insignia de procedencia.** Sustituir «Dato real» + «Local» + «Saldos estimados» por una sola píldora con
tres estados: **Ejemplo** (demo), **Vuestros datos · saldos de hace N días**, **Vuestros datos · al día**. *Por qué:* hoy la
demo dice «Dato real» y a la vez «estimados». *UX/UI:* a la derecha de la cabecera; al tocarla, a qué cuenta le falta saldo y
«Confirmar saldos» (el pulso de siempre). *Métrica:* 0 pantallas con dos insignias de procedencia. S · **P0** · Encaje:
corrección de coherencia, no función nueva (como FX-01).

**DEC-04 · Registro de cambios de cifra («¿por qué ha cambiado?») en Cierre.** Al firmar, guardar las tres causas más grandes
de la diferencia entre lo previsto el día 1 y lo real (como el puente de FX-40, pero del mes cerrado). *Por qué:* la carta del
mes (FX-43) dice cuánto; esto dice por qué, y es lo que permite corregir el plan. *UX/UI:* tres líneas en el paso 3 de Cierre
con su signo y su partida. *Métrica:* cierres con causas guardadas. S · P1.

### 4.2 Navegación y arquitectura de información, móvil primero (DEC-05 a DEC-10)

**DEC-05 · Barra inferior en el móvil con cuatro destinos y «Más».** Hoy · Movimientos · Plan · Deuda, y «Más» con el resto.
Adelanta la parte móvil de UX-01/FX-60 sin rehacer la navegación de escritorio. *Por qué:* en el móvil todo pasa por «Menú»
(un panel de 54 enlaces), y lo que el medidor ve usarse es importar, clasificar, cerrar y mirar Hoy (novena §1.2). El reparto
exacto por destino no está medido: el PR empieza por medirlo. *UX/UI:* 56 px + zona segura, iconos con texto
siempre visible, el destino activo en `--e19-accent`; se oculta al escribir en un campo; respeta `prefers-reduced-motion`.
*Métrica:* toques hasta Movimientos desde Hoy (de 2 a 1) y uso del menú completo. M · P1 · Encaje: XGO-01 (no añade
titulares).

**DEC-06 · Ajustes partido en una portada y subpáginas.** La portada de Ajustes enseña 8 bloques con su estado («Cuentas · 3,
saldo de hace 4 días», «Reserva · 1.500 €») y cada uno abre su página. *Por qué:* 34.000 px con 115 campos no es una
pantalla. *UX/UI:* lista de filas de 56 px con valor actual a la derecha (patrón de ajustes de iOS), buscador arriba («busca un
ajuste»), migas de pan para volver. *Métrica:* alto de Ajustes en el móvil < 3.400 px; tiempo para cambiar la reserva. M · P1 ·
Encaje: no retira nada, solo reparte.

**DEC-07 · Pestañas que caben: Inversión y Deuda con un resumen arriba.** Cada pestaña empieza con su respuesta en una
tarjeta (la cifra y la frase) y lo demás plegado por bloques con su título y su cifra. *Por qué:* Cartera mide 9.100 px y la
primera pantalla es texto explicativo. *UX/UI:* «lo que no tiene datos ocupa una línea» (decisión 4) aplicado de verdad: los
bloques vacíos se pliegan a una línea con lo que falta. *Métrica:* primera pantalla con una cifra en cada pestaña. M · P1.

**DEC-08 · Tablas que se convierten en listas en el móvil.** Deuda › Contratos, Partidas, Cuentas remuneradas y la tabla de
Previsión: por debajo de 600 px, cada fila es una tarjeta con dos datos principales y «Ver todo». *Por qué:* una tabla de 10
columnas en 390 px se desplaza en horizontal y se pierde la fila. *UX/UI:* el mismo componente con `@container`; edición en
una hoja con los campos en una columna y teclado numérico (`inputmode="decimal"`). *Métrica:* `check-mobile-overflow` sin
desplazamiento horizontal en ninguna tabla. M · P1 · Encaje: Contratos se toca solo tras D-N16.

**DEC-09 · Buscador de la app («⌘K» / lupa).** Busca pantallas, ajustes, partidas y movimientos por texto. *Por qué:* con 60
vistas, buscar es más rápido que navegar, y es la forma de que lo plegado se encuentre. *UX/UI:* hoja a pantalla completa en
el móvil, diálogo centrado en escritorio, resultados por tipo, todo con teclado; nada sale del navegador. *Métrica:* búsquedas
con resultado abierto. M · P1.

**DEC-10 · Cabecera compacta al desplazar y «Primeros pasos» de una línea.** La cabecera fija baja de 70 a 48 px al
desplazar; la tarjeta de primeros pasos pasa a una línea («Primeros pasos · 2 de 4 ›») cuando ya hay datos. *Por qué:* hoy
Hoy empieza a 507 px en el móvil con la tarjeta abierta. *UX/UI:* transición de 150 ms, desactivada con movimiento reducido.
*Métrica:* la cifra de Hoy por encima de 400 px en el móvil. S · P1 · Encaje: es un cambio de Hoy (uno por semana).

### 4.3 Entrada de datos y clasificación, dentro de D-N11 (DEC-11 a DEC-18)

**DEC-11 · Una puerta de entrada única: «Traer datos».** Un solo botón en Movimientos que ofrece, en orden de esfuerzo:
compartir el extracto (buzón), elegir un fichero, pegar el texto de un PDF y, como último recurso, apunte a mano. Fusiona
DAT-03. *Por qué:* hoy hay cuatro caminos en tres pantallas (Registrar, Importar, el buzón, «Registrar gasto» en Hoy). *UX/UI:*
hoja con cuatro filas y el tiempo que cuesta cada una («1 toque», «2 min»). *Métrica:* segundos del toque al extracto
importado (ya medido por XDA-02 PR-1). S · P0 · Encaje: D-N11.

**DEC-12 · Confirmar solos los cobros y cargos que ya llegaron.** Si un esperado (WP-14/27) aparece en el extracto con el
mismo importe (± 2 %) y en su ventana de días, se confirma solo y se dice en la bandeja («3 confirmados solos · Deshacer»).
Es XDA-08 de la séptima. *Por qué:* hoy cada esperado se contesta a mano aunque el extracto ya lo diga. *UX/UI:* una línea
plegada con la lista y «No era esto» por fila. *Métrica:* preguntas de esperados contestadas a mano por semana (bajar un 70
%). M · P0 · Encaje: D-N11 (menos trabajo por semana).

**DEC-13 · Huella anónima del extracto.** Un botón en Ajustes › Uso de la app que genera un texto **sin importes, fechas
exactas, nombres ni referencias**: por cada grupo sin partida, su forma («BIZUM ENVIADO · palabra · palabra», «RECIBO ·
entidad · número de 10 cifras», «COMPRA TARJ · comercio · ciudad»), cuántas veces aparece y en cuántas cuentas. El hogar lo
pega en la conversación. *Por qué:* hoy se diseñan señales de Clasificar a ciegas (§1.5); es la forma de validar CLA-01/02/03
y DAT-05 con su banco sin que sus datos salgan. *UX/UI:* vista previa del texto antes de copiarlo, «Copiar» y una línea que
dice qué se quita. *Métrica:* señales de Clasificar validadas con la huella. S · **P0** · Encaje: D-N11; privacidad
(`check-public-privacy`) en la prueba.

**DEC-14 · Clasificar por importe típico y día del mes (las señales que faltan de CLA-01).** Un recibo mensual con el mismo
importe y ± 3 días se propone con confianza media aunque el concepto cambie del todo. *Por qué:* CLA-01 se hizo con palabras
e importe; el día y la periodicidad son la señal de los recibos sin texto estable. *UX/UI:* la confianza explica «se cobra
cada mes el día 5 por unos 42 €». *Métrica:* grupos sin propuesta de tipo «recibo» (el medidor ya lo cuenta). S · P0 (tras
DEC-13) · Encaje: D-N11.

**DEC-15 · Clasificar con un pulgar (sustituye a CLA-04).** En el móvil, los botones de las tres alternativas y «Aceptar» en
la mitad inferior de la hoja, a 48 px, y «Saltar» a la izquierda; sin gestos de deslizar (decisión del hogar). En escritorio,
lo que ya hay (↵, 1-3, S, ⌘Z). *Por qué:* el objetivo de 4 s por grupo se gana con ergonomía, no con gestos que el hogar
descartó. *UX/UI:* zona del pulgar, orden de lectura correcto, foco visible. *Métrica:* segundos por grupo (objetivo 4 s).
S · P0 · Encaje: D-N11; cambia la hoja de Clasificar, en prueba hasta el 4/12 (se publica tras la revisión).

**DEC-16 · Bandeja «Para el repaso» con un número.** Un solo contador en Movimientos y en la entrada del repaso: grupos sin
partida + traspasos por confirmar + esperados + anomalías. *Por qué:* hoy son cuatro tarjetas con cuatro números; el hogar
necesita saber «cuánto me queda» de un vistazo. *UX/UI:* «Para el repaso · 12 · unos 6 min», con el desglose al tocar.
*Métrica:* repasos completados por semana. S · P0 · Encaje: D-N11; no añade titulares (sustituye).

**DEC-17 · Deshacer por lotes en el historial de reglas.** Además de «Quitar» por regla (#627), un historial de lo que ha
clasificado cada tanda («martes 18: 9 grupos») con «Deshacer la tanda». *Por qué:* un error de una regla por palabras puede
coger de más y descubrirse días después. *UX/UI:* en el desplegable de reglas, una segunda lista por fecha. *Métrica:* tandas
deshechas (debe ser baja; si no, las reglas cogen de más). S · P1.

**DEC-18 · «Este mes vais al N % con partida» en la bandeja.** La meta de D-N11 (95 % antes del 1/12) a la vista donde se
trabaja, con lo que falta en euros y en grupos. *Por qué:* hoy el % se lee en Ajustes › Uso de la app; la meta no se ve donde
se cumple. *UX/UI:* barra fina bajo el contador de DEC-16, azul hasta el 95 % y tinta al llegar; sin rojo (no rompe una regla
del hogar). *Métrica:* % con partida el 1/12. S · **P0** · Encaje: D-N11 directamente.

### 4.4 Hoy y la semana (DEC-19 a DEC-23)

**DEC-19 · Hoy con una cifra y dos datos.** La cabecera de Hoy enseña «Disponible hasta cobrar» y, debajo, **solo** el día
del cobro y el punto más bajo; fin de mes y reserva protegida pasan a la hoja de DEC-01. *Por qué:* cinco cifras en la
cabecera (§1.3). *UX/UI:* la referencia `Hoy.png` ya era así. *Métrica:* tiempo hasta la primera acción en Hoy (la métrica
del handoff). S · P1 · Encaje: cambio de Hoy de una semana; se consulta (cambia lo que se ve).

**DEC-20 · «Decidir esta semana» con verbos concretos.** Cada decisión con su verbo y su destino exacto («Apartar 470 € al
mes», «Ver el gasto variable de noviembre», «Rebalancear en Inversión»), nunca «Revisar alerta»; y fecha límite solo si la
hay de verdad. *Por qué:* dos de tres dicen «Revisar alerta» y una manda a Ajustes. *UX/UI:* el botón dice lo que pasa al
pulsarlo. *Métrica:* tasa de acción de las decisiones (medidor). S · **P0** · Encaje: corrección de textos.

**DEC-21 · Un nombre para cada colchón.** Unificar «colchón», «reserva protegida», «reserva operativa» y «suelo» con un
glosario de cuatro términos y un dibujo (un vaso con tres rayas: suelo, reserva, objetivo) que sale en DEC-01. *Por qué:*
«Construir colchón» y «Reserva protegida cubierta» en la misma pantalla. *UX/UI:* el mismo término en todas las pantallas
(prueba de vocabulario en el CI). *Métrica:* 0 sinónimos en la app (barrido). S · P0 · Encaje: FX-01 (contrato de cifras).

**DEC-22 · Resumen del domingo en una notificación del calendario.** El `.ics` del repaso semanal (13/11) lleva en la
descripción un enlace que abre la app directamente en el repaso, con lo que hay pendiente contado al abrirlo. *Por qué:* el
repaso aporta pero no se hizo en noviembre; el recordatorio llega, la puerta no. *UX/UI:* sin importes en el calendario.
*Métrica:* repasos empezados desde el enlace. S · P0 · Encaje: D-N11.

**DEC-23 · «Hecho esta semana».** Al cerrar el repaso, una línea en Hoy hasta el domingo siguiente: «Repaso hecho el martes ·
12 grupos clasificados · 96 % con partida». *Por qué:* el progreso visible sostiene el hábito (y sustituye la línea del repaso
cuando ya está hecho). *UX/UI:* tinte claro (conclusión), sin botón. *Métrica:* racha de semanas. S · P1.

### 4.5 Deuda: la foto real primero (DEC-24 a DEC-29) — todas esperan a D-N16

**DEC-24 · Estado «En impago» con importe atrasado y fecha.** En Contratos, un estado nuevo con: importe atrasado, desde
cuándo, si la entidad ha dado el préstamo por vencido (todo exigible) y si figura en un fichero. *Por qué:* §1.4; hoy no se
puede decir. *UX/UI:* insignia ámbar en la fila; en la hoja de edición, tres preguntas sí/no con su ayuda. *Métrica:* —
(estructural). M · P0 tras D-N16 · Encaje: `canonical-debt-contracts.js` y el motor de «Camino a deuda cero» (lo exigible
entra como pago inmediato, no como cuota). **Desde el 17/11, dentro del bloque SVD (SVD-2).**

**DEC-25 · La previsión con lo exigible.** Si una deuda está vencida, la previsión enseña dos caminos: «si la reclaman ya» y
«si se pacta un plan», y Hoy dice «Disponible… sin contar N € reclamables». *Por qué:* una cifra de disponible que ignora una
deuda exigible no es honesta. *UX/UI:* línea bajo el titular de Previsión, sin cambiar la cifra hasta que el hogar elija el
camino. *Métrica:* —. M · P1 · Encaje: es previsión (espera también al 4/12).

**DEC-26 · Kit para hablar con la entidad (DEU-06 subida).** Por deuda: qué pedir (quita, plan de pagos, condonación de
intereses de demora, baja del fichero al pagar), un guion de llamada, una carta y **qué pedir por escrito** (certificado de
deuda con desglose capital/intereses/comisiones). *Por qué:* lo primero antes de refinanciar es saber cuánto es capital y
negociar el resto. *UX/UI:* hoja imprimible por entidad, con los datos del contrato y huecos para lo que diga la entidad;
nada se envía desde la app. *Métrica:* deudas con certificado pedido / recibido. M · P0 tras D-N16.

**DEC-27 · Migrar lo que solo sabe el plan heredado.** Revisar `views/debt-liquidation-plan.js` y `debt-control.js` (quitas,
atrasos, «retomar», ficheros) y llevar al motor canónico lo que siga vigente; después, proponer retirar el plan heredado. *Por
qué:* hay dos fotos de la deuda en la app (§1.4). *UX/UI:* —. M · P1 · Encaje: NTC-05. **Desde el 17/11, dentro del bloque
SVD (SVD-1 y SVD-6).**

**DEC-28 · «Salir del fichero» como objetivo con fecha.** Un objetivo en Ahorro y objetivos: deudas a cancelar o pactar,
cuánto hace falta, en qué orden y la fecha estimada; al marcar una como saldada, recordatorio para pedir el certificado y
comprobar la baja. *Por qué:* es el objetivo que ordena todo lo demás (préstamo, inversión, coche). *UX/UI:* tarjeta de
objetivo con progreso por deuda, como DEU-07. *Métrica:* deudas saldadas con baja comprobada. S · P1 tras D-N16.

**DEC-29 · Deuda › Ruta sin contradicción.** El titular nunca dice «sin fecha estimable» encima de una fecha: con deudas sin
cuota, «Libre de las deudas con cuota en oct 2029 · faltan N sin cuota» en una frase; y quitar «coste total ejecutado» cuando
los intereses son 0 (HANDOFF §5 ya lo señalaba). *Por qué:* riesgo R-1 de WP-54. *UX/UI:* una frase, sin asterisco. S · P0
(es corrección) tras D-N16, porque toca Deuda.

### 4.6 Previsión y decisiones, sin previsión nueva antes del 4/12 (DEC-30 a DEC-33)

**DEC-30 · Una frase de la semana que viene.** En Previsión y en el «Listo» del repaso: «Esta semana salen 640 € y no entra
nada; el jueves es el día más justo». *Por qué:* el horizonte que se gestiona es la semana; los 90 días ya están. *UX/UI:*
frase determinista con dos cifras máximo, del motor diario. *Métrica:* —. S · P1 (lectura, no previsión nueva).

**DEC-31 · «¿Me lo puedo permitir?» desde Hoy.** Un campo en Hoy («¿Cuánto?» y «¿Cuándo?») que responde con el veredicto de
FX-22 y lleva a guardarlo como escenario. *Por qué:* FX-22 vive en Previsión; la pregunta se hace en Hoy. *UX/UI:* plegado en
una línea («¿Un gasto extra? Compruébalo ›»), hoja con teclado numérico, respuesta en verde/ámbar con su porqué. *Métrica:*
consultas y escenarios guardados desde Hoy. S · P1 · Encaje: cambio de Hoy de una semana.

**DEC-32 · Sensibilidad de una línea en cada escenario.** Junto a cada escenario guardado: «Aguanta un imprevisto de hasta
N € sin bajar del suelo». *Por qué:* resume las pruebas de estrés en la pregunta que importa. *UX/UI:* una línea bajo el
nombre. S · P2.

**DEC-33 · Calendario de vencimientos y renovaciones.** Una lista única con seguros, ITV, suscripciones anuales, revisión de
la hipoteca, fin de pruebas gratuitas (SUS-03) y fechas fiscales, con aviso 15 días antes al calendario (sin importes).
*Por qué:* hoy están repartidos entre el mapa de pagos grandes, Fiscal, Seguros y la hipoteca. *UX/UI:* lista por mes,
exportable al `.ics` de siempre. *Métrica:* vencimientos con aviso. M · P1.

### 4.7 Hogar y pareja (DEC-34 a DEC-37)

**DEC-34 · Enlace de solo lectura para la otra persona.** Fusiona HOG-02: un enlace con caducidad que enseña Hoy y el último
cierre, sin editar, desde la copia cifrada. *Por qué:* las decisiones (préstamo, deuda) son de los dos y hoy se miran en un
solo navegador. *UX/UI:* «Compartir con…» en Ajustes, con lo que se ve y cuándo caduca. M · P2 · Encaje: necesita la nube
(Supabase), hoy opcional.

**DEC-35 · Acta de decisiones.** Fusiona HOG-01 y FX-26: cada decisión grande con su motivo, lo que se esperaba (cifra del
momento), quién la propone, el sí de cada uno y su fecha de revisión; a la fecha, la app compara lo esperado con lo real.
*UX/UI:* lista en Decidir; «Guardar como decisión» desde un escenario aplicado. M · P1.

**DEC-36 · Ocultar cifras con un toque.** Fusiona HOG-04: un botón (ojo) en la cabecera que cambia todos los importes por
«•••» hasta volver a tocarlo; se recuerda por dispositivo. *Por qué:* mirar la app en público o enseñar una pantalla.
*UX/UI:* `aria-pressed`, y las cifras ocultas se leen como «importe oculto» en lector de pantalla. S · P1.

**DEC-37 · Modo conversación mensual.** Fusiona UX-04 y FX-64: cuatro pantallas a pantalla completa (cómo acabó el mes, la
deuda, el objetivo, la decisión del mes) para mirarlas juntos, y la misma lectura en un PDF de una página. *UX/UI:* flechas y
gestos de paso; sin menús. S-M · P2.

### 4.8 Accesibilidad, rendimiento y robustez (DEC-38 a DEC-42)

**DEC-38 · Texto grande sin romper.** Probar la app con el texto del sistema al 200 % (Dynamic Type en iOS) y arreglar lo que
se corte. *Por qué:* WCAG 1.4.4; las cifras grandes de Hoy y las tablas son las que se rompen. *UX/UI:* unidades relativas en
cifras protagonistas. *Métrica:* barrido a 200 % sin desbordes. S · P1.

**DEC-39 · Estado sin conexión explícito.** Si la app abre sin red (PWA), una línea «Sin conexión · los datos son los de este
dispositivo» y las acciones que necesitan la nube desactivadas con su porqué. S · P1.

**DEC-40 · Superficie plegada en el inventario.** `docs/gobierno/superficie.json` cuenta también los desplegables por ruta
(segundo número) y el medidor anota las aperturas de cada desplegable. Lo plegado que nadie abre en 60 días se propone para
retirar. *Por qué:* §1.2. *Métrica:* superficie total (visible + plegada) que baja trimestre a trimestre. S · **P0** ·
Encaje: XGO-01 y XGO-02; no cambia pantallas.

**DEC-41 · Copia de seguridad que avisa.** Si la última copia exportada (o la nube) tiene más de 30 días, una línea en Ajustes
y en el «Listo» del repaso con «Descargar copia». *Por qué:* los datos viven en un navegador; un borrado de Safari los pierde.
*UX/UI:* sin rojo hasta 60 días. S · P0 · Encaje: no toca datos, protege los del hogar.

**DEC-42 · Hoy primero, lo demás después.** Cargar `app.js` partido: Hoy, Movimientos y Clasificar en el primer paquete; el
resto al visitar. Con UX-05. *Por qué:* 32.000 líneas en cada arranque del iPhone. *Métrica:* tiempo hasta interactivo en el
iPhone (H-26). L · P1 · Encaje: RQ-13 (sin cargador dinámico de terceros).

### 4.9 Gobierno del producto (DEC-43 a DEC-46)

**DEC-43 · Graduación por defecto.** Una función en prueba que no se revisa en 28 días **se gradúa sola** si su tasa de acción
supera la mitad de la de su pantalla, o se apaga si no se ha usado; la decisión queda anotada y se puede deshacer. *Por qué:*
«15 por revisar». *UX/UI:* el contador del menú desaparece; una línea en Funciones en prueba con lo decidido solo. S · P1 ·
Encaje: cambia una decisión del hogar (P9), se consulta (D-N18).

**DEC-44 · Retirada medida de «Versiones anteriores».** Contar visitas de las 11 pantallas heredadas 30 días (el medidor ya
puede); las que tengan 0 se proponen para retirar con su lista de lo que solo ellas hacían. Es la §5.1 de la novena con fecha.
S · P0 (solo medir) · Encaje: D-N15.

**DEC-45 · Novedades con «¿te sirve?».** Cada línea de Novedades con dos botones (sí / no) que alimentan el medidor. *Por
qué:* hoy se publica sin saber si se usa. S · P1.

**DEC-46 · Pruebas con la forma del dato real.** Un conjunto sintético generado desde la huella anónima del hogar (DEC-13)
que entra en las pruebas de Clasificar y Movimientos. *Por qué:* §1.5 y P-C. S · P0 tras DEC-13.

---

## 5. Optimizar lo que ya existe (14 de las 46, sin función nueva)

| Prioridad | ID | Qué | Esfuerzo |
|---|---|---|---|
| 1 | DEC-03 | Una sola insignia de procedencia | S |
| 2 | DEC-20 | Verbos concretos en «Decidir esta semana» | S |
| 3 | DEC-21 | Un nombre para cada colchón | S |
| 4 | DEC-29 | Deuda › Ruta sin contradicción (tras D-N16) | S |
| 5 | DEC-16 | Un contador para el repaso | S |
| 6 | DEC-10 | Cabecera compacta y primeros pasos en una línea | S |
| 7 | DEC-19 | Hoy con una cifra y dos datos | S |
| 8 | DEC-08 | Tablas que son listas en el móvil | M |
| 9 | DEC-07 | Respuesta arriba en Inversión y Deuda | M |
| 10 | DEC-06 | Ajustes en portada y subpáginas | M |
| 11 | DEC-05 | Barra inferior en el móvil | M |
| 12 | DEC-38 | Texto grande sin romper | S |
| 13 | DEC-42 | Hoy primero | L |
| 14 | DEC-44 | Medir para retirar las versiones anteriores | S |

---

## 6. Qué haría hasta el 4/12 (dentro de D-N11, sin decisión nueva)

| Orden | Qué | Por qué ahora |
|---|---|---|
| 1 | **DEC-13** huella anónima del extracto | Valida con el banco del hogar lo construido del 14 al 16/11 sin que salgan sus datos |
| 2 | **DEC-18** % con partida en la bandeja y **DEC-16** contador del repaso | Ponen la meta de D-N11 donde se trabaja |
| 3 | **DEC-12** confirmar solos los esperados | Quita trabajo semanal |
| 4 | **DEC-14** importe típico y día del mes (tras la huella) | La señal que falta para los recibos |
| 5 | **DAT-07** dividir un movimiento | Ya en la novena; sin él, tickets mixtos se quedan sin partida |
| 6 | **DEC-40** y **DEC-44** (solo medir) | Para que la revisión del 4/12 decida retiradas con datos |

**Hecho el 18/11/2026** («sigue con más cosas que puedas avanzar sin el hogar», PROJECT_STATE 491):

- **DEC-13**, la huella anónima del extracto, en Ajustes › Uso de la app (plegada, sin titular). De cada concepto sin partida
  queda solo su forma: las palabras de cómo se pagó de una lista cerrada (BIZUM, RECIBO, COMPRA TARJ…), y lo demás como
  «palabras», «mes», «número de N cifras» o «código». Por forma: movimientos, cuentas, conceptos distintos y emisores, y de
  ellos cuántos se repiten en varios meses con importe (± 10 %) y día (± 3) fijos, que es justo la pregunta de DEC-14. Lo que se
  ve es exactamente lo que se copia. Una prueba busca en el texto los nombres, importes, fechas y referencias de los
  movimientos inventados y no encuentra ninguno. `canonical-extract-fingerprint.js` + `huella-extracto-ui.js`.
- **DEC-18**, en la bandeja de Movimientos, bajo la fila de Clasificar: «Gasto con partida (últimos 90 días): N % · objetivo 95 %
  · faltan X €; bastan los K conceptos que más suman», con una barra fina. **Me aparto de la propuesta en una cosa:** decía
  «este mes»; he usado la misma cifra que Funciones en prueba y el medidor (90 días), porque la revisión del 4/12 se hará con
  esa y dos porcentajes distintos para la misma meta confundirían. Sin rojo; la paleta del tema v2 no tiene azul, así que va en
  el acento (verde oscuro) y en verde al llegar.
- **DEC-41**, la copia de seguridad que avisa (PROJECT_STATE 493), en Ajustes encima del botón de la copia y en el «Listo» del
  repaso, a partir de la fecha que la app ya apuntaba (`lastEmergencyBackupAt`, de RGX1): nada con la nube conectada, sin datos
  o con una copia de 30 días o menos; de 31 a 60 días, una línea con «Descargar copia»; de más de 60 o sin copia, la misma con
  más énfasis. Nunca rojo. El botón es la copia completa de siempre. `views/copia-aviso.js`.
- **DEC-44**, solo medir (PROJECT_STATE 494): en Ajustes › Uso de la app, una línea con cuántas pantallas de «Versiones
  anteriores» se han abierto en los últimos 30 días en ese navegador y cuáles no, con el contador de siempre. «Registrar reales
  del mes» lleva a Registrar y nunca tuvo contador propio: se dice aparte. Para D-N15; no retira nada.
- **DEC-40**, solo medir (PROJECT_STATE 497): el inventario de superficie cuenta también lo plegado que se ve por defecto
  (`plegados` en `docs/gobierno/superficie.json`: 151 desplegables en 32 rutas, frente a 231 titulares), sin techo y vigilado
  por la misma e2e; y la app anota, solo en ese navegador, qué desplegables de la página se abren y cuándo
  (`views/plegados-medidor.js`). Uso de la app dice cuántos se han abierto en 60 días y, con 60 días anotados, cuántos son
  candidatos a retirar. Solo los que vienen en `index.html`: lo que se pinta con datos no se anota.
- **DEC-20**, verbos concretos en «Decidir esta semana» (PROJECT_STATE 498): los avisos de Ajustes › Alertas ya no dicen
  «Revisar alerta» ni llevan al Centro de alertas (una pantalla de «Versiones anteriores»). Según el indicador: los de caja,
  «Ver la previsión» (Plan › Previsión); el ratio de deuda, «Ver la ruta de la deuda»; la cartera, «Rebalancear en Inversión» o
  «Ver la cartera»; las decisiones vencidas, «Revisar las decisiones» (Ajustes). Y sin «Vence el»: la fecha de la regla es
  cuándo revisarla, no un plazo. No cambia ninguna cifra.
- **DEC-14**, el recibo de cada mes por su importe y su día (20/11/2026, «sigue con todo lo que puedas que no depende de
  nosotros», PROJECT_STATE 508): en Clasificar, sin reglas, nombre ni palabras en común, la partida a la que ya fueron en dos
  meses distintos o más movimientos con importe ± 10 % y a ± 3 días del mismo día del mes, con confianza media y el porqué
  («Se carga cada mes hacia el día 5 por unos 42 €…»); con empate, nada. Solo propone; la regla guardada no mira el día.
  Falta validarlo con la huella del banco del hogar (DEC-13), que es lo que la propuesta pedía antes.
- **DEC-39**, el estado sin conexión (20/11/2026, PROJECT_STATE 508): sin red, una línea ámbar bajo el chip de la nube en
  todas las pantallas («Sin conexión · los datos son los de este dispositivo», y con la nube, que lo cambiado se sube al volver)
  y los botones de la nube apagados con «Necesita conexión a internet»; al volver, como estaban, y el guardado pendiente se
  intenta ya (`sin-conexion-ui.js`). No cambia datos.
- **DEC-38**, paso 1 (20/11/2026, PROJECT_STATE 509): medido con la comprobación del CI, a 320 px (WCAG 1.4.10) se salían 2
  pantallas, a 260 px (390 px al 150 %) 12 y a 195 px (al 200 %) 43. Arregladas las dos de 320 px (solo CSS, solo por debajo
  de 360 px) y 320 px en el CI. Queda 260 px: Movimientos, Plan › partidas, Deuda › Comparar y Préstamo y ocho de «Versiones
  anteriores».
- **DEC-38**, paso 2 (20/11/2026, PROJECT_STATE 510): a 260 px (zoom al 150 %) ninguna pantalla se sale salvo cinco de
  «Versiones anteriores» pendientes de D-N15, y el CI lo vigila. La causa común eran columnas de rejilla que no se dejaban
  estrechar (`minmax(0, 1fr)`). Queda 195 px (zoom al 200 %), que es trabajo de varias sesiones.
- **DEC-38**, paso 3 (21/11/2026, PROJECT_STATE 516; el hogar: «Sigue con DEC-38, empezando por Hoy y Movimientos»): a 195 px
  (zoom al 200 %), Hoy y Movimientos. Medido con la comprobación del CI solo salían 5 elementos, pero mirando las capturas había
  más: textos que no se salían porque se apretaban a una letra por línea (el concepto de cada movimiento, «Decidir esta semana»,
  las filas de la bandeja). Solo CSS, por debajo de 260 px: menos margen, la cifra y el título más pequeños y lo que iba en fila,
  apilado. Además, tres rejillas sin columnas con `minmax(0, 1fr)` (como en el paso 2). El CI mira ya a 195 px estas dos;
  las demás se suman por tandas. **Lección:** «nada se sale» no es «se lee»; a este ancho hay que mirar cada pantalla.
  **Segunda tanda, el mismo día** («Sigue con la siguiente tanda: Clasificar y Previsión»): en Previsión, «Qué lo mueve» del
  panel del día; en Clasificar, el nombre del grupo (se partía a media palabra) y «Aceptar y siguiente», que se salía por la
  derecha del panel (es un diálogo: el CI no lo recorre, lo vigila una e2e). **Pendiente, visto al revisar:** Plan › Mes no se
  lee a 195 px (cabeceras de bloque montadas sobre su importe, «Ahorro» cortado, leyenda solapada); por eso Plan no entra aún en
  la lista del CI a 195 px. Siguiente tanda propuesta: Plan › Mes y Cierre.
  **Tandas 3 a 5** (21/11/2026, PROJECT_STATE 517; «Sigue con la siguiente tanda: la cabecera y el simulador visual»): Plan › Mes,
  Cierre, Ajustes, las cinco pestañas de Deuda, la cabecera del móvil (de 117 a 46 px: solo «FC» y «Menú») y el simulador visual,
  el nuevo y el de siempre dentro de su iframe (que medía 303 px en 177). El CI mira 10 pantallas a 195 px. **Queda:** las
  pantallas de Inversión, Escenarios, Registrar y Herramientas, y las de «Versiones anteriores» (pendientes de D-N15).
- **DEC-22**, el aviso del domingo abre el repaso (20/11/2026, PROJECT_STATE 511): el `.ics` de los recordatorios lleva en
  el detalle y en el campo URL de cada aviso del repaso la dirección de la app con `#home?abrir=repaso`; al abrirlo, el repaso
  sale encima de Hoy y la marca se quita de la dirección. Sin importes ni datos en el enlace; el título no cambia. Medido en
  Uso de la app («Repaso desde el calendario»). El hogar tiene que descargar el fichero otra vez: el mismo identificador por
  fecha hace que importarlo actualice los avisos ya puestos.
- **DEC-23**, «Hecho esta semana» (20/11/2026, PROJECT_STATE 513; activo desde el 30/11 como el cambio de Hoy de esa semana):
  con el repaso de la semana hecho, en el hueco de su entrada, «Repaso hecho el martes» con los grupos clasificados en ese
  repaso, el % del gasto con partida (la cifra de DEC-18) y la racha. Tinte claro, sin botón; lo que no se sabe no se dice. No
  añade titular. **Me aparto en una cosa:** «12 grupos clasificados» se cuenta como los grupos sin partida que hay de menos al
  terminar el repaso frente a al abrirlo; si durante el repaso se importa un extracto con conceptos nuevos, se queda corto (nunca
  de más).
- **DEC-30**, la semana que viene en una frase (21/11/2026, PROJECT_STATE 514): en la Previsión, bajo el gráfico y el panel
  del día (en el titular sacaba el gráfico de la primera pantalla), y la primera del «Listo» del repaso: lo que sale y lo que entra de hoy a dentro de 6 días (motor diario, a la decena) y el
  día más justo. **Me aparto en dos cosas:** es «los próximos 7 días» y no «esta semana» (en un repaso de domingo, la semana de
  lunes a domingo sería un día); y el día más justo solo se dice si no es el último de los 7 (con el gasto del día a día repartido
  y sin cobro, el saldo baja hasta el final y el día lo pondría el corte). En el repaso, para seguir en tres líneas (FX-42), con
  aviso no sale la de qué ha cambiado. Sin cifra ni motor nuevos.
- **DEC-45**, «¿te sirve?» en Novedades (21/11/2026, PROJECT_STATE 515; el hogar: «Sigue con DEC-45»): «Sí» y «No» en las
  líneas de Novedades, que van al medidor (vista = abrir Novedades; «sí», acción; «no», descarte; quitar la respuesta,
  deshecho) y salen en Ajustes › Uso de la app con cuáles no sirven. En los dos temas. **Me aparto en una cosa:** no en «cada
  línea», sino en las de las dos últimas semanas (el plazo de P9) y en las ya respondidas: el 21/11 hay 202 líneas, 128 de los
  últimos 30 días; en todas serían unos 400 botones en el menú. Se guarda solo el identificador de la línea, la respuesta y la
  fecha, en este navegador.
- **DEC-16** (un solo contador para el repaso) no se ha hecho: sustituye cuatro tarjetas por una y eso cambia lo que se ve en
  Movimientos y en el repaso; mejor con D-N17 contestada.

Correcciones que se pueden hacer en paralelo porque no cambian cifras: **DEC-03**, **DEC-20**, **DEC-21**, **DEC-41**. Las de
Hoy (DEC-10, DEC-19) van como el cambio de Hoy de una semana; las de Deuda, tras D-N16.

**Lo que no haría:** nada de Deuda ni Préstamo hasta D-N16; nada de previsión nueva hasta el 4/12; ninguna función nueva sin
decir qué retira (P-A).

---

## 7. Decisiones que pide esta auditoría

| # | Pregunta | Recomendación | Para cuándo |
|---|---|---|---|
| **D-N16** | **¿Cuál es la foto vigente de vuestra deuda?** (a) Lo del informe es saldo impagado y la entidad reclama el total; (b) son deudas al corriente y el informe estaba desfasado; (c) mezcla: algunas impagadas, otras al corriente. Y por cada una: ¿tenéis el certificado de deuda con el desglose de capital, intereses y comisiones? | Pedir el certificado antes de dar de alta nada y antes de pedir un préstamo | Antes de tocar Deuda o Préstamo |
| **D-N17** | ¿Se adopta esta lista como propuesta, con el orden del §6 hasta el 4/12? | Sí | 18/11 |
| **D-N18** | ¿Graduación por defecto a los 28 días (DEC-43) en lugar de esperar a una respuesta? | Sí, con deshacer | 4/12 |
| **D-N19** | «Hazlo tú en mi lugar»: ¿permiso para probar con datos inventados y decidir el diseño (así se ha leído), o también para levantar decisiones vuestras? | Lo primero; las decisiones siguen siendo vuestras | Cuando podáis |

Y siguen abiertas D-N12 (recálculo de la previsión), D-N13 (tipo de préstamo), D-N14 (orden de la novena) y D-N15 (retiradas).
