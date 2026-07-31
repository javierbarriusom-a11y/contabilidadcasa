# Estado del backlog financiero

Fecha de corte: 18 de julio de 2026.

## P0 - Integridad estructural

| Mejora | Estado | Evidencia |
| --- | --- | --- |
| Libro mayor canónico | Entregado | `canonical-ledger.js` y conciliación |
| Modelo normalizado en Supabase | Entregado y activado | `canonical-supabase-store.js`, `supabase_schema.sql` y sincronización normalizada confirmada |
| Identificador único | Entregado | IDs estables en estado, libro y decisiones |
| Máquina de estados común | Entregado | `canonical-workflow.js` |
| Motor único de cálculo | Entregado | `canonical-engine.js` y corte del motor histórico |
| Reconciliación automática | Entregado | vista y contrato de conciliación |
| Pruebas de invariantes y puerta de sincronización (P0-5) | Entregado | batería Node mensual, diaria y de decisiones; Supabase se bloquea solo ante incoherencias canónicas |
| Registro inmutable | Entregado en esquema | eventos append-only y `finance_audit_log` |
| Copias y restauración | Implementado, pendiente de verificación remota | selector, vista previa, clonación transaccional y copias locales/remotas versionadas |

### P0-5 - Puerta de sincronización

- `canonical-commit-barrier.js` evalúa los tres escenarios mensuales, el motor diario, las decisiones compuestas, el estado canónico y la calidad disponible del libro mayor.
- Una incoherencia bloquea únicamente la publicación compartida: los cambios y borradores continúan guardándose en el equipo.
- Conciliación muestra el estado, las comprobaciones superadas y cualquier impedimento antes de pulsar **Sincronizar**.
- Cobertura automatizada: escenarios ausentes, diferencias diaria/mensual, deuda duplicada y errores críticos declarados.

## P1 - Decisión y tesorería

| Mejora | Estado | Siguiente mejora útil |
| --- | --- | --- |
| Motor diario de tesorería | Entregado | ampliar calendario aprendido de movimientos |
| Contratos de deuda completos | Entregado | adjuntar documentación verificada |
| Comparador de acuerdos | Entregado | incorporar coste legal/fiscal validado |
| Optimización multiobjetivo | Parcial avanzado | frontera de Pareto explícita deuda/caja/coche |
| Escenarios probabilísticos | Parcial | bandas probabilísticas calibradas con histórico |
| Política única de reserva | Entregado | conservar un único control global |
| Landing Hoy | Entregado | priorización por urgencia y confianza |
| Centro único de acciones | Parcial | retirar definitivamente vistas redundantes |
| Calidad y procedencia | Parcial | cobertura de fuente/confianza por cada KPI |
| Cierre mensual formal | Parcial | bloqueo transaccional remoto del mes cerrado |
| Importación con vista previa | Entregado parcialmente | deshacer remoto con snapshot de importación |

## P2 - Planificación familiar

| Mejora | Estado | Siguiente mejora útil |
| --- | --- | --- |
| Huchas vinculadas | Parcial avanzado | conciliación automática de aportaciones reales |
| Modo Javi/Tere/Hogar | Parcial | titularidad obligatoria y capacidad individual |
| Alertas configurables | Parcial | preferencias persistidas y avisos programados |
| Indicadores de comportamiento | Parcial | anomalías y tendencia sobre libro real |
| Documentos de acuerdos | Pendiente | almacenamiento privado y metadatos verificables |
| Exportación para asesor | Parcial | paquete PDF/Excel trazable y firmado por versión |

## P3 - Servicios externos

| Mejora | Estado | Dependencia |
| --- | --- | --- |
| Conexión bancaria regulada | Pendiente externo | proveedor PSD2/Open Banking, consentimiento y seguridad |
| Asistente conversacional real | Pendiente externo | backend privado, autenticación y API de IA |

## Reglas financieras activas

- Ninguna amortización debe romper la reserva ni los pagos hasta el siguiente ingreso.
- Una deuda suspendida no genera ahorro mensual liberado.
- Las quitas se comparan por mejora patrimonial, urgencia, salida de ficheros y coste de oportunidad disponible.
- El coche exige simultáneamente reserva, colchón y ruta mínima de deuda.
- Toda recomendación conserva las alternativas actuar, esperar y negociar.
- Más allá de 24 meses se priorizan rangos y escenarios, no falsa precisión.
- CIRBE, ASNEF, demora y efectos legales deben mostrar procedencia y no sustituyen revisión profesional.

## Próximo bloque recomendado

1. Activar el esquema normalizado en Supabase y validar una sincronización real.
2. Formalizar el cierre mensual transaccional sobre las nuevas tablas.
3. Completar procedencia/confianza en todos los KPI ejecutivos.
4. Convertir la optimización multiobjetivo en una frontera explícita y explicable.
5. Diseñar el backend privado del asistente antes de conectar una API de IA.
