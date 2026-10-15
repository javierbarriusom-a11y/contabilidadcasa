# Ensayo de los momentos del hogar con la demo (15 de octubre de 2026)

Recorrido por la **interfaz real** (clics y tecleo, `tools/ensayo-hogar.cjs`) de lo que se le pide al hogar hasta el 3/11, con el conjunto de
demostración anonimizado. Se lanza a mano contra un sitio construido; **no forma parte del CI**.

**Qué mide y qué no.** Cuenta pasos (clics, campos tecleados, pantallas) y comprueba lo que debería ocurrir. **No mide segundos humanos**: un guion
no teclea ni lee como una persona. Tampoco sustituye a la prueba con personas (`WP-54`). Es una instalación limpia con datos de demostración, no el
estado real del hogar.

## 1. Resultados por momento

| Momento | Qué se comprobó | Resultado |
|---|---|---|
| **Abrir la app el 15-17/10** (foto de liquidez, WP-12) | Entrando por la pantalla de inicio, por Hoy o por Registrar el 16/10, **la foto del día 15 se guarda sola** | ✅ Sin acción del hogar: **abrir la app basta, sea cual sea la pantalla** |
| | Abrir otra vez el 17/10 | ✅ No reescribe la foto |
| | Abrir **por primera vez el 18/10** | ✅ (como diseñado) **no hay foto**: la ventana es de tres días. La siguiente, la del día 1 (1-3/11) |
| **Datos fiscales (20/10)** | ¿Hay en la app dónde teclearlos? | ❌ **No.** La tarjeta de la campaña fiscal tiene **0 campos**. Ver hallazgo F2 |
| **Cerrar octubre con saldo (1-3/11)** | Declarar los saldos del banco | ✅ **3 clics**: «Pasar a real manual» y «Coincide» en cada cuenta (con dos cuentas) |
| | Valorar la cartera (3 posiciones) | ✅ **2 clics y 3 campos**: «Actualizar valoración», un valor por posición y «Guardar»; el resumen pasa a «3 de 3» |
| | Firmar el cierre | ✅ (como decidió el hogar el 4/10) **exige sesión de la nube**: sin ella el botón está desactivado. Además exige **al menos un movimiento del mes importado** (ver F3) |
| | Texto «Las cuentas cuadran» con cuentas sin conciliar | ❌ Decía «cuadran» con las dos cuentas «sin conciliar». **Corregido** (F1) |
| **Cierre con todos sus avisos a la vez** | Plan B, deuda en la sombra, puente y calma en caídas | Salen los 4. Ocupan **970 px en ordenador** (1,1 pantallas) y **1.439 px en móvil** (1,7 pantallas); sin errores ni desbordes. Ver F4 |

## 2. Hallazgos

| # | Hallazgo | Decisión |
|---|---|---|
| **F1** | En el paso «Antes de firmar», la comprobación decía **«Las cuentas cuadran»** con las dos cuentas en «Sin conciliar» (no hay extracto con que comparar). `cierreAccountsSettled` cuenta «sin conciliar» como asentada, y la regla del proyecto es que sin conciliar **nunca** es «cuadra» (`docs/BACKLOG_NUEVE_PANTALLAS.md`, regla 04). | ✅ **Corregido**: con cuentas sin conciliar dice «Ninguna cuenta descuadra · N sin conciliar»; con todas conciliadas, el texto de siempre. **No cambia qué bloquea la firma** (`views/cierre.js`, prueba nueva) |
| **F2** | **Los datos fiscales no tienen dónde teclearse.** El plan del hogar los pide «por el chat» el 20/10, pero el repositorio es público: **no pueden llegar al código**. `WP-23 PR-2` («Tus datos fiscales», un formulario en un almacén privado, dentro de la copia) está en el diseño y **no está construido**. El formulario **no depende de los datos del hogar para construirse**, solo para usarse. | ⏳ **Se propone construirlo ya** (≈ 1 sesión), antes del 20/10. Hoy esa tarea del hogar no se puede cumplir en la app |
| **F3** | Para firmar octubre no basta con declarar saldos: la comprobación «**Extracto incorporado · N movimiento(s)**» exige **al menos un movimiento de octubre importado**. El plan del hogar dice «cerrar octubre con saldo» y no menciona importar el extracto. | ⏳ Avisar al hogar (es **un requisito más del 1-3/11**) y confirmar que tiene el extracto de octubre a mano. Enlaza con `WP-51`/`WP-53`, sin muestra real |
| **F4** | **Los avisos de Cierre quedan *debajo* del asistente de firma** (`index.html`: `#cierreWizard` va antes que `#planBAviso`, `#sombraAviso`, `#puenteAviso` y `#calmaAviso`). Se puede llegar al paso 3 y firmar **sin haber visto** «Se cumple vuestro plan B» o «La cartera está un 41,7 % por debajo de su máximo». Todos pesan igual y no hay orden por gravedad. Con los cuatro a la vez, el asistente empieza a 514 px (ordenador) / 1.187 px (móvil) y los avisos se acumulan detrás. Es **mi** decisión de colocación (WP-38, 41, 43 y 44). | ⏳ **Se consulta**: (a) dejarlos como están; (b) una franja única «Antes de firmar: N avisos» encima del asistente, desplegable y ordenada por gravedad (**mi recomendación**); (c) tope de 2 visibles con «ver N más». Cambia el diseño de Cierre |
| **F5** | En el paso 1, **«✓ Conciliar cuentas»** sale marcado con las dos cuentas «sin conciliar». Es la misma causa que F1, pero aquí ese «hecho» **desbloquea** el paso 2, así que cambiarlo cambiaría el flujo. | ⏳ **Se consulta** (T25) |

## 3. Lo que sale bien

- **Abrir la app es gratis**: ninguna acción, ninguna pantalla concreta; una apertura cualquiera entre el 15 y el 17 basta. La única forma de perder la foto es no abrirla en tres días.
- **Valorar la cartera es corto**: dos clics y un valor por posición, con la fecha de la valoración a «Hoy» por defecto.
- **Sin errores de página ni diálogos nativos** en ningún recorrido, a 1280 y a 390 px.

## 4. Cómo repetirlo

```
python3 -m http.server 4183 -d dist &
PLAYWRIGHT_CHROMIUM_PATH=<chrome> BASE_URL=http://127.0.0.1:4183 OUT=/tmp/ensayo node tools/ensayo-hogar.cjs
```

Devuelve un JSON con cada comprobación y deja capturas en `OUT`. Sale con código 1 mientras quede algo en rojo: **a fecha de hoy una comprobación
sigue en rojo a propósito** (F2: no hay dónde teclear los datos fiscales). F5 y F4 no son comprobaciones automáticas: son decisiones de diseño.
