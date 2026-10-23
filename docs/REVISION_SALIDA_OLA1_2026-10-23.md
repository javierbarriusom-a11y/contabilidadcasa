# Revisión de salida de la Ola 1 · 23/10/2026 (H-04)

**Decisión: parar y revisar** (regla de parada, `BACKLOG_DEFINITIVO.md` §4). La Ola 1 termina hoy sin una sola lectura de sus dos métricas, M-HOY y M-ADOP. No se abre ningún paquete nuevo hasta tenerlas. Siguen el camino del rediseño, que ya tiene sus revisiones del 2/11 y el 4/11, y lo que tiene fecha (WP-23).

La preparó Claude el 23/10/2026, y el hogar contestó en el chat las tres decisiones del §4.

## 1. Dónde estamos

| | Paquetes | Comentario |
|---|---|---|
| Hecho (construido) | 24 | |
| En curso | 1 (WP-23) | + el rediseño: 2 de los 3 huecos |
| Esperando al hogar | 21 | Construido; lo siguiente es un dato o una decisión vuestra |
| Aparcado | 3 (WP-28, WP-37, WP-42) | Por el límite de 3 en curso |
| Sin empezar | 3 (WP-17, WP-18, WP-21) | |
| Continuo | 1 (WP-54) | Primera ronda en diciembre |

- **Avance construido:** 63,2 % del plan, ponderado por sesiones.
- **Avance comprobado:** **0 %**. Ningún paquete tiene su métrica leída con datos reales.
- **Tareas del hogar marcadas:** 1 de 21 (H-01, «empezamos»). Dos estaban vencidas: H-02 (9/10) y H-03 (20/10).
- **Datos reales en la app** (captura del 19/10): 0 movimientos en octubre.

**Lectura:** el cuello de botella ya no es construir, sino alimentar la app. Cada pantalla nueva sin datos aumenta lo construido sin aumentar lo comprobado. Es justo el riesgo alto del plan: construir para nadie.

## 2. Las métricas de la ola

| Métrica | Objetivo | Lectura a 23/10 | Qué la desbloquea |
|---|---|---|---|
| M-HOY | ≤ 15 s | Ninguna | **Cambiada hoy (decisión 1 del §4):** se lee sola con el medidor de utilidad (XGO-02), que cuenta desde el 22/10. Basta con usar Hoy |
| M-ADOP | ≥ 4 días activos por semana | Ninguna anotada en el panel | Usar la app; el panel de uso (WP-03) la cuenta solo. Falta llevar la cifra al panel de seguimiento |

## 3. Lo que más desbloquea por minuto vuestro

Ordenado por paquetes que pasan a ser comprobables por cada minuto. Las fechas y los minutos son los del panel (pestaña «Tareas del hogar»).

| # | Tarea | Cuándo | Min | Qué desbloquea |
|---|---|---|---|---|
| 1 | **H-22** Importar el extracto de octubre de cada cuenta y clasificar | antes del 31/10 | 20 | El cierre de octubre (WP-09) con reales; anomalías (WP-36); deuda en la sombra (WP-41); lectura del extracto (WP-51); medidas reales de Movimientos, Importar y Clasificar para su revisión del 4/11 |
| 2 | **H-06** Cerrar octubre con saldo y firma | 1-3/11 | 10 | WP-09 comprobado; primera carta del mes posible (WP-29); empieza a contar para el backtest (WP-12), el puente (WP-43) y la serie de patrimonio (WP-46), que necesitan 3 cierres |
| 3 | **H-03** Datos fiscales en la app | ya vencida | 20 | La campaña fiscal (WP-23) con euros vuestros. Es el único paquete con dinero directo y fecha límite (31/12) |
| 4 | **H-23** Saldos con «Coincide» / «Corregir», 4 días por semana, dos semanas | antes del 6/11 | 10 | Saldos por excepción (WP-26, M-SALDOS), frescura (WP-45, M-FRESC), adopción (M-ADOP) y el disparador de `O-6` |
| 5 | **H-05** Primera transferencia de la asignación personal | 1/11 | 2 | WP-24 |
| 6 | **H-08** Confirmar los días de cargo | antes del 13/11 | 10 | WP-08, WP-27 y la resolución de la previsión (M-RESOL) |
| 7 | **H-07** Datos del contrato de la hipoteca | antes del 13/11 | 10 | El aviso de la próxima revisión del tipo variable (WP-20) |
| 8 | **H-24** Confirmar la nómina de octubre | antes del 6/11 | 10 | Lector de nóminas y retenciones (WP-31) y reparto de la nómina (WP-47) |

**Las cinco primeras suman unos 60 minutos en dos semanas** y pasan a comprobables unos 10 paquetes: WP-09, WP-23, WP-24, WP-26, WP-29, WP-36, WP-41, WP-45 y WP-51, y empiezan a contar WP-12, WP-43 y WP-46. El resto de tareas, con las del compromiso del §4, está en el panel con su fecha.

### Ensayo del cierre de octubre (hecho por Claude el 23/10)

Se recorrió en un navegador, con el reloj en el 2/11 y a 390 px, lo que haréis ese día. Se partió de cero movimientos, como vuestros datos: importar un extracto inventado, clasificar la bandeja e ir a Cierre. **Funciona de principio a fin**, y ha quedado como prueba permanente: `tests/qa1-flujos-completos.spec.cjs`, «Ensayo del cierre de octubre».

**Para que el botón «Firmar cierre» se active hacen falta tres cosas:**
1. **Al menos un movimiento de octubre importado.** La comprobación «Extracto incorporado» lo exige, así que **sin H-22 no se puede cerrar octubre**.
2. **Ningún concepto sin partida.** Cada uno es una «diferencia abierta», y la bandeja de Clasificar los resuelve de 5 en 5.
3. **Sesión iniciada y sincronizada** en el dispositivo donde firméis. El cierre es una operación transaccional en la nube y no se puede firmar sin conexión.

**Lo que no bloquea, pero se ve:**
- Una cuenta sin extracto queda «sin conciliar».
- Los saldos se guardan con la fecha del último movimiento importado (por ejemplo, «28/10, 3 días antes del fin de mes»).

**Error encontrado y corregido:** en el móvil, la tabla «Conciliar cuentas» montaba las cifras unas sobre otras y cortaba la insignia de estado. Ahora cada cuenta se lee en su bloque. La prueba falla si se quita el arreglo.

## 4. Decisiones del hogar (23/10/2026)

1. **M-HOY se mide de forma pasiva.** La prueba cronometrada (H-02) deja de esperarse: la línea base es la mediana de los segundos hasta la primera acción en Hoy que registra el medidor de utilidad (XGO-02) desde el 22/10.
   - **Lo que se gana:** una medida que llega sola y con más intentos que 3.
   - **Lo que se pierde, y conviene saberlo:** mide «actuar», no «encontrar la cifra con saldos del día» (GOV-05). Es más débil como prueba de comprensión.
   - **Consecuencia:** la congelación de Hoy se levanta el **25/10**, como estaba decidido. Para que el antes y el después sigan siendo comparables, **los cambios de Hoy entran de uno en uno, uno por semana**, y cada uno con su línea en «Novedades».
     - El primero, mover la bandeja de decisiones a Movimientos (desviación pendiente en `docs/rediseno/ESTADO.md` §4).
     - Después, los avisos que esperan para la bandeja de Hoy: WP-35, WP-36, WP-38 y WP-47.
     - **La línea base de M-HOY es la mediana anterior al primer cambio.**
2. **Comunidad autónoma para la campaña fiscal: dada por el chat.** No se escribe en el repositorio. El contraste de parámetros está en `docs/WP23_DISENO.md` §10:
   - cuatro de cinco contrastados;
   - vivienda pendiente del tramo autonómico.
3. **No se poda ningún paquete.** El hogar se compromete a alimentar los cuatro que dependían de una aportación periódica:
   - WP-50: índice de vivienda cada trimestre;
   - WP-48: CSV de los brókeres;
   - WP-40: CIRBE;
   - WP-52: cronómetro en el iPhone.

   Tienen tarea con fecha en el panel: H-27, H-28, H-31 y H-26.
   - **Criterio para revisarlo:** si una de esas tareas pasa **30 días vencida**, el paquete se propone para archivo con disparador. Sin la aportación, el paquete no sirve y solo añade mantenimiento (GOV-02).

## 5. Qué se corrigió en el panel de seguimiento

- **12 tareas nuevas del hogar** (H-22 a H-33), para que cada paquete «esperando al hogar» tenga su tarea con fecha. Antes, 16 de los 21 no tenían ninguna. Entre ellas faltaba la de más palanca: importar el extracto de octubre. Además, los cierres de mes H-06, H-11 y H-15 apuntan ahora también a WP-43 y WP-46, que dependen de ellos.
- H-02 queda como sustituida, con fecha del 23/10.
- La métrica M-HOY pasa a «tiempo hasta la primera acción en Hoy», medida por el medidor.
- **Tres hitos nuevos:**
  - 25/10: se levanta la congelación de Hoy;
  - 2/11: revisión de Funciones en prueba del diseño nuevo y Hoy;
  - 4/11: revisión de Movimientos, Importar y Clasificar.
- **Revisión de salida de la Ola 1:** «parar y revisar».
- **Corrección de lo que dije al empezar la sesión:** el rediseño **sí** cuenta en el panel como uno de los tres huecos en curso (bloque «En marcha»). No hacía falta añadirlo como paquete.

## 6. Qué no se hace hasta las revisiones del 2/11 y el 4/11

No se abre ninguna pantalla nueva del rediseño (Plan, Cierre, Patrimonio e Inversión, navegación). `docs/rediseno/ESTADO.md` §8 lo condiciona a «si las anteriores se usan», y eso lo dirá el medidor. Si el 4/11 Movimientos, Importar y Clasificar no tienen uso, la respuesta no es otra pantalla: es volver a esta lista.
