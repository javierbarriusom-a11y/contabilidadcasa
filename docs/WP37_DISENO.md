# WP-37 · Estados completos y «deshacer» — diseño

Paquete del plan definitivo (NXP-04, Ola 3 → continuo, ≈ 2,5 sesiones). **Primera entrega el 9/10/2026**, sin dependencias del hogar. El plan lo define como «catálogo en `design-system.html` y aplicación pantalla a pantalla cuando cada paquete la toque»: es un paquete de **convención** más que de funcionalidad, y por eso queda **en curso** (la aplicación pantalla a pantalla no se termina nunca de golpe).

## 1. Qué había ya, para no reinventarlo

- **«Deshacer» ya existía** (`showUndoToast`, UX1/DEX4): una pila de hasta cinco avisos de 10 s que usan alertas, objetivos, tarjetas, compras, valoraciones, saldos y respuestas de cobros. La auditoría de `confirm()` del 28-29/8 encontró **tres**; dos se convirtieron entonces y el tercero se mantuvo a propósito.
- **Lo que faltaba**: dos `confirm()` nativos más, **posteriores a aquella auditoría** (quitar un contrato de deuda y quitar una hucha), seguían sin deshacer, y **quitar una aportación, una nómina o un dato de índice borraba al momento, sin deshacer**. Y las vistas que se descargan bajo demanda no tenían estado de carga ni salida si fallaban.

## 2. Lo que se entrega

### El catálogo (`design-system.html#estados`, `estados.css`, `estados-ui.js`)

Seis estados con su marcado vivo, su regla y su accesibilidad:

| Estado | Regla | Cómo se distingue (no solo por color) |
|---|---|---|
| **Vacío accionable** | Dice qué falta **y ofrece la acción que lo llena** | Borde discontinuo + título + botón principal |
| **Cargando con esqueleto** | Esqueleto en el sitio de lo que llega; `role="status"` + `aria-busy`; sin movimiento con `prefers-reduced-motion` | Borde punteado + título «Cargando…» |
| **Error con causa y salida** | Qué pasó, qué sigue funcionando, **una** salida; `role="alert"`; la causa técnica, en pequeño | Borde sólido oscuro + título |
| **Sin conexión** | Distinto del error: no es un fallo de la app; dice qué hacer (conectarse una vez) | Borde doble + título «Sin conexión» |
| **Dato obsoleto** | Cuánto y **qué lo renueva**; no se esconde ni se presenta como actual | Borde discontinuo oscuro + acción |
| **Éxito con «Deshacer»** | Lo reversible se hace al momento y avisa; la confirmación se reserva para lo irreversible | Aviso con su botón «Deshacer» |

Y la **regla «¿deshacer o confirmar?»** con tres filas (reversible, irreversible, lo que se importa o sale fuera).

### Aplicado hoy (lo que se tocó, no «toda la app»)

1. **Vistas que se descargan bajo demanda** (`renderActiveSection`, +1 línea neta en `app.js`): esqueleto mientras bajan; si fallan, **causa + «el resto de la app sigue funcionando» + «Reintentar»**, y **«Sin conexión»** cuando `navigator.onLine` es falso. El estado se **antepone** al contenido de la vista, no lo borra, y desaparece al llegar. Antes: una frase («Comprueba la conexión y recarga la página») sin botón, que **sustituía** el contenido.
2. **Quitar un contrato de deuda**: ya no hay `confirm()`; se hace al momento y **Deshacer** devuelve las tres colecciones (alta manual, ejemplos ocultos, correcciones) tal como estaban.
3. **Quitar una hucha / una aportación**: **Deshacer** devuelve solo esa hucha, **en su sitio**, sin pisar lo que se haya tocado en esos 10 s; antes, `confirm()` (hucha) y borrado sin aviso (aportación).
4. **Quitar una nómina (WP-31) y un dato de índice (WP-13)**: **Deshacer**. Eran del propio trabajo de esta semana y se saltaban la regla.
5. **Vacío y obsoleto en mis dos tarjetas nuevas**: «Aún no hay nóminas» lleva ahora su acción («Apuntar la primera», que lleva el foco al formulario) y «No puedo mirar lo reciente» (anomalías) lleva «Importar el extracto».

## 3. Lo que NO se hace, y por qué

- **No se reescriben las demás pantallas.** El plan dice «cuando cada paquete la toque»; reescribir todo de golpe es el modo de romper pantallas que funcionan, sin medida que lo justifique. Lo que sí queda es la **regla**, el marcado común y una prueba que **impide volver a colar un `confirm()` nativo**.
- **No se sustituye el último `confirm()`** (consolidar con la reserva bajo el mínimo): UX1 decidió mantenerlo porque no es «¿seguro que quieres borrar?» sino un aviso de riesgo antes de perder la red de seguridad de «Descartar todo». El catálogo pide que ese tipo de confirmación diga la consecuencia **en el botón**; hoy es el diálogo nativo. **Pendiente** de pasarlo a diálogo propio cuando se toque Registrar.
- **«Dato obsoleto» no se aplica a las pantallas existentes** (el sello de edad de los saldos y el Euribor caducado ya cumplen el patrón con su propio marcado). No se migran para no tocar Hoy (congelado hasta leer H-02).
- **No se mide la carga con esqueleto.** El esqueleto solo aparece si la descarga tarda; en el móvil emulado de la prueba de carga la vista inicial (Hoy) no se descarga bajo demanda, así que el presupuesto de 5 s no cambia.

## 4. Riesgos y decisiones a cuestionar

1. **Deshacer a 10 segundos no es lo mismo que confirmar**: quien quita un contrato y no mira el aviso pierde la posibilidad de recuperarlo a los 10 s. Para datos que el hogar teclea con esfuerzo (un contrato de deuda) el riesgo es real. Mitigación: se guardan las tres colecciones completas y el aviso es visible y anunciado; si el hogar prefiere confirmar para contratos, es volver a un diálogo (y la prueba lo marcará).
2. **Dos estados con `role="alert"`** (error y sin conexión) interrumpen a un lector de pantalla. Es lo debido para un fallo que bloquea la pantalla, y solo salen cuando falla la descarga.
3. **El catálogo no se publica** (`design-system.html` no va al sitio): es referencia de desarrollo. Las pruebas lo abren desde el disco y comprueban que muestra los seis estados y que usa la misma hoja que la app.
4. **Un estado para todos los fallos de descarga**: la causa es la del navegador («no se pudo descargar el fichero»). No distingue un servidor caído de una versión nueva sin desplegar; el texto sugiere recargar por si la hay.

## 5. Segunda entrega (PR-2, 13/10/2026): los registros de Ajustes que se quitaban sin aviso

Una búsqueda de los manejadores de borrado encontró **seis listas de Ajustes que se vaciaban al instante, sin confirmación y sin vuelta atrás**: objetivos de compra grande, cuentas remuneradas, cuentas con comisión de mantenimiento, pólizas, tablas fiscales y escalas de IRPF. Todas viven en `scenarioSettings` y el hogar las teclea a mano (una escala de IRPF son varios tramos con su fuente).

- **Qué cambia:** un ayudante común `quitarConDeshacer` (`estados-ui.js`) guarda el registro y su **posición**, llama a la función de datos de siempre (las funciones `removeX` no se tocan: sus pruebas unitarias siguen igual) y deja el aviso «Deshacer». Al deshacer, el registro vuelve **a su sitio**, **no pisa** lo que se haya tocado en esa lista durante los 10 s, **no se duplica** si ya se volvió a dar de alta, y repinta lo mismo que repinta quitarlo (p. ej. las pólizas, también el checklist de continuidad; las escalas de IRPF, sus dos estimaciones).
- **`app.js` baja 11 líneas** (37.449 → 37.438): el ayudante está fuera, en `estados-ui.js`.
- **Lo que se comprobó:** pruebas unitarias del ayudante (orden, no pisar, no duplicar, índice fuera de rango, lista inexistente), una prueba que obliga a que **los seis** pasen por él, y una prueba de navegador con el botón real (cuentas remuneradas y pólizas: se quita, avisa, se deshace en su sitio, sobrevive a recargar, sin diálogos nativos). **Comprobado que la prueba de navegador detecta el fallo**: con el manejador estropeado a propósito en el sitio construido, cae justo en el aviso.
- **No cubierto en navegador:** tablas fiscales, escalas de IRPF, cuentas con comisión y objetivos de compra grande se prueban por la prueba unitaria y por la que fija su cableado, no con el botón real. Pasan por el mismo ayudante, pero no lo he visto funcionar clicando en cada una.
- **Proyectos y decisiones de deuda quedan fuera, con motivo:** al retirarlos ya existe una vía de recuperación (`restoreWorkflowDecision`), y deshacerlos con otro aviso duplicaría la lógica del ciclo de decisiones.

## 6. Pendiente

- Aplicar el catálogo pantalla a pantalla **a medida que cada paquete las toque** (la regla de la cola).
- Diálogo propio para el último `confirm()` (consolidar con la reserva bajo el mínimo): sigue pendiente; UX1 lo mantuvo a propósito y no he encontrado un caso nuevo que lo justifique ahora.
- Si el hogar prefiere confirmar al quitar contratos de deuda, revertir ese caso concreto.
