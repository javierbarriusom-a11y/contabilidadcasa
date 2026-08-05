# Finanzas Casa DEF

Copia de trabajo independiente del dashboard financiero familiar. Esta version se usa para evolucionar la arquitectura, la experiencia ejecutiva y el modelo de deuda sin alterar la aplicacion estable.

## Estado de la evolución

- Fase 0: copias verificables, contrato de estado y pruebas de regresión.
- Fase 1: modelo canónico, identidades estables y vista de datos y auditoría.
- Fase 2: libro contable canónico, invariantes y conciliación banco vs. dato real.
- Fase 3: motor financiero canónico, contrato de cálculo, paridad e invariantes mensuales.
- Fase 4: calendario canónico de decisiones, deuda suspendida y política prudente de traspasos.
- Fase 5: ciclo de aprobación, fijación, ejecución y cancelación con auditoría restaurable.
- Fase 6: corte definitivo al motor canónico y aceptación integral anonimizada.
- Fase 7: tesorería diaria canónica, fechas, mínimos intrames y paridad con el cierre mensual.
- Fase 8: contratos de deuda completos, pagos suspendidos, mora estimada y plan reunificado.
- Fase 9: comparador trazable de acuerdos y confirmación explícita antes de afectar al plan.
- Fase 10: persistencia Supabase normalizada, auditoría inmutable y restauración versionada.

La guía práctica para trabajar con la aplicación está disponible en
[Markdown](MANUAL_USUARIO.md) y en [Word](MANUAL_USUARIO_FINANZAS_CASA.docx).
La documentación funcional de la fase actual está en [PHASE_10.md](PHASE_10.md) y el estado completo
del backlog está en [BACKLOG_STATUS.md](BACKLOG_STATUS.md).

La navegación principal usa `Actualizar` como matriz temporal de partidas previstas, resultados y mínimos. El plan visual de deuda consume contratos, liquidez, capacidad y forecast canónicos mediante un adaptador de solo lectura; únicamente sus tareas, notas y supuestos propios se sincronizan dentro de las copias versionadas.

## Arquitectura canónica

- `canonical-state.js`: contrato persistido e inventario de colecciones.
- `canonical-ledger.js`: libro contable y conciliación bancaria.
- `canonical-engine.js`: cálculo determinista de saldos y ahorro.
- `canonical-decisions.js`: calendario de proyectos, deuda y traspasos entre cuentas.
- `canonical-workflow.js`: estados, transiciones y auditoría de decisiones.
- `canonical-daily-engine.js`: calendario diario de cobros, pagos, traspasos y mínimos de caja.
- `canonical-debt-contracts.js`: normalización y validación de contratos y acuerdos de deuda.
- `canonical-e14-debt-adapter.js`: inventario, lectura canónica del plan visual y contrato común de estrategia de deuda.
- `canonical-e15-goals.js`: objetivos, calendario financiero, aportaciones prudentes y revisión mensual confirmable.
- `canonical-e16-monitoring.js`: alertas anticipadas, explicación de cambios, calidad de predicción y recomendaciones trazables de solo lectura.
- `canonical-debt-comparator.js`: comparación de pago único, fraccionado, reunificación, retoma o espera.
- `canonical-supabase-store.js`: proyección normalizada, huellas de contenido y copias versionadas para Supabase.
- `remote-save-queue.js`: cola de escritor único con revisiones pendientes, reintentos de red y bloqueo de conflictos entre sesiones mediante el puntero remoto.
- `app.js`: adaptación de la interfaz al motor canónico y diagnóstico histórico opcional.

El motor histórico no participa en la ejecución normal. Una invariante rota bloquea el cálculo en lugar de sustituirlo silenciosamente por otra regla.

## Ejecutar y verificar

```bash
npm test
python3 -m http.server 4182
```

Después abre `http://127.0.0.1:4182/index.html#reconciliation`.

## Activar la persistencia normalizada

La app mantiene compatibilidad con `finance_dashboard_states` y puede seguir funcionando mientras se despliega el nuevo esquema. Para activar cuentas, movimientos, partidas, deudas, proyectos, decisiones, auditoría y copias por separado:

1. Abre el editor SQL del proyecto Supabase.
2. Ejecuta el contenido completo de `supabase_schema.sql`.
3. Inicia sesión en la app y pulsa `Sincronizar`.
4. Comprueba en `finance_sync_runs` que el último registro tiene estado `complete`.

Cada sincronización conserva además una copia completa en `finance_state_snapshots`. `Recuperar versión anterior` restaura creando una versión nueva: no sobrescribe ni borra el historial.

## Operaciones E5

- Reabrir un mes y deshacer una importación requieren motivo, vista previa y confirmación; ambas acciones crean una revisión nueva.
- Si el esquema normalizado no está disponible, la app conserva los cambios localmente y no escribe en la tabla heredada. La migración antigua se inicia solo con el botón de confirmación.
- `Verificar copias` comprueba huellas y una muestra restaurable. La política conserva 30 revisiones recientes, una mensual durante 24 meses y todas las operaciones críticas; no elimina copias automáticamente.
- Para activar E5 en Supabase, vuelve a ejecutar `supabase_schema.sql` antes de usar estas operaciones remotas.

## Publicacion en GitHub Pages

Este repositorio se publica mediante GitHub Actions desde un artefacto verificado y de contenido limitado.

URL esperada tras activar Pages:

```text
https://javierbarriusom-a11y.github.io/finanzas-casa-def/
```

## Privacidad

El artefacto público contiene únicamente una demostración sintética. Los datos reales se cargan desde
el navegador, una importación explícita o la sesión privada de Supabase; no deben añadirse al repositorio.
`npm run verify` bloquea la publicación si detecta patrones sensibles conocidos.

La publicación usa exclusivamente `dist/`, generado con una lista cerrada de recursos. La documentación
interna, las pruebas y las herramientas no forman parte del sitio.

## Actualizar datos

Las importaciones se confirman desde la propia app y actualizan el modelo canónico. La fuente de Pages
debe ser **GitHub Actions**; un push a `main` solo se despliega si supera toda la verificación.
