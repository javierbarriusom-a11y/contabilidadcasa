# Fase 4 - Calendario canónico de decisiones

## Objetivo

Unificar cómo proyectos, financiación externa, amortizaciones de deuda y traspasos entre cuentas afectan al calendario financiero. Hasta esta fase estas reglas convivían en varios simuladores y podían producir fechas o contrapartidas distintas según la pantalla.

La integración mantiene una red de seguridad: el calendario canónico se compara con el cálculo anterior céntimo a céntimo. Solo se activa cuando supera sus invariantes y conserva paridad dentro de una tolerancia de 0,02 EUR.

## Contrato de decisión

Cada decisión normalizada contiene:

- identidad estable y estado de ciclo de vida;
- clase: proyecto o deuda;
- mes de inicio y horizonte;
- pago inicial, duración y cuota recurrente;
- financiación externa recibida;
- deuda objetivo, principal, cuota original, vencimiento y pagos restantes;
- modalidad de deuda: amortización, fraccionamiento, reunificación o retomar pagos.

Los estados `ejecutado`, `cancelado`, `descartado` y `eliminado` no generan movimientos futuros. Los estados simulados, pendientes, aprobados, fijos y optimizados sí se reflejan mientras permanezcan activos.

## Calendario mensual

El servicio puro `canonical-decisions.js` genera por mes:

- coste inicial;
- coste recurrente;
- entrada por financiación externa;
- alivio real de una cuota de deuda;
- salida de proyectos;
- salida de deuda;
- impacto neto total.

La suma conserva todas las contrapartidas. Un crédito externo no reduce silenciosamente el coste del proyecto: registra la entrada de capital y mantiene sus cuotas futuras.

## Reglas de deuda

1. Una deuda con pagos suspendidos no crea una cuota liberada al amortizarla.
2. `Retomar pagos` conserva la cuota como gasto y nunca la transforma en ingreso.
3. El alivio de una cuota termina en su vencimiento conocido o, si falta, cuando las cuotas acumuladas alcanzan el capital pendiente más dos mensualidades de prudencia.
4. Una misma deuda objetivo no puede aparecer dos veces en el calendario activo.
5. Las decisiones inactivas dejan de afectar al flujo sin borrar su historial.

## Traspasos entre cuentas

La política común de traspasos calcula cuánto puede salir de CaixaBank después de proteger:

- la reserva operativa configurada;
- los gastos del mes siguiente cuando se usa el modo prudente.

La regla se usa en la simulación Nueva Vida definitiva y queda disponible como servicio puro para el resto de vistas. Nunca devuelve importes negativos ni valores no finitos.

## Paridad y fallback

`app.js` conserva temporalmente el cálculo histórico como referencia:

1. construye el calendario anterior;
2. construye el calendario canónico con las mismas decisiones;
3. compara cada mes dentro de 0,02 EUR;
4. usa el resultado canónico si hay paridad e invariantes válidos;
5. en cualquier discrepancia mantiene el resultado histórico y registra el motivo.

La vista `Conciliación` incorpora el contexto **Decisiones y traspasos**, el estado de conservación de las decisiones y el control de deudas duplicadas.

## Persistencia y auditoría

En el estado persistido se conserva únicamente evidencia compacta del último cálculo: huella, número de meses, paridad, diferencias e incidencias. El calendario mensual derivado se recalcula y no infla `localStorage` ni la sincronización remota.

## Pruebas

La suite específica cubre:

- pago inicial repartido y cuota recurrente;
- financiación externa y sus contrapartidas;
- alivio de cuota tras amortización;
- deuda suspendida;
- modalidad `retomar pagos`;
- estados inactivos;
- bloqueo de una deuda duplicada;
- tolerancia de paridad;
- traspaso prudente con protección del mes siguiente.

Estas pruebas se ejecutan junto a las garantías acumuladas de las fases 0 a 3.

## Definición de terminado

- Proyectos y deuda consumen un único calendario canónico verificable.
- Las cuotas suspendidas no se cuentan como ingreso ni ahorro adicional.
- Las decisiones canceladas o ejecutadas no reaparecen en el futuro.
- No se puede programar dos veces una misma deuda.
- Los traspasos protegen reserva y, en modo prudente, el mes siguiente.
- Existe fallback automático si cambia una cifra histórica.
- Conciliación hace visible la paridad del calendario de decisiones.
- Toda la suite y la verificación visual terminan sin regresiones.

## Siguiente fase

La fase 5 podrá consolidar los flujos de aprobación y ejecución sobre este contrato: comparar alternativas, aprobar una propuesta, fijarla en el plan y cerrarla con trazabilidad sin duplicar movimientos.
