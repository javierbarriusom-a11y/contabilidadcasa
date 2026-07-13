# Fase 0 - Línea base y red de seguridad

Esta fase protege el trabajo existente antes de modificar cálculos, arquitectura o UX.

## Qué queda cubierto

- Copia completa y versionada del estado editable del dashboard.
- Checksum para rechazar copias truncadas o modificadas.
- Restauración en dos pasos: seleccionar, revisar resumen y confirmar.
- Línea base reproducible de `data.js`.
- Pruebas de saldos, calendario, movimientos, series y números no finitos.
- Punto estable en Git para volver a esta versión.

## Comandos

```bash
npm test
npm run baseline:capture
```

`baseline:capture` solo debe ejecutarse cuando un cambio de datos haya sido revisado y aprobado. Después hay que revisar el diff de `tests/fixtures/finance-data-baseline.json`.

## Copia y restauración

1. Abrir **Carga de datos > Seguridad de datos**.
2. Pulsar **Descargar copia completa**.
3. Para restaurar, elegir un `.json` generado por la app.
4. Revisar proyectos, decisiones, datos reales y libro incluido.
5. Pulsar **Confirmar restauración**.

La restauración reemplaza el estado local actual y, si hay una sesión de Supabase activa, programa su sincronización.

## Criterio de aceptación

- `npm test` termina sin fallos.
- Una copia recién descargada puede seleccionarse y validarse.
- Una copia manipulada se rechaza.
- No cambia ningún cálculo financiero ni valor visual por instalar esta fase.
