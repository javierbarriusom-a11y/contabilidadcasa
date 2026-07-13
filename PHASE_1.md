# Fase 1 - Modelo canónico y auditoría de datos

## Objetivo

Convertir el estado persistido del dashboard en un inventario único, trazable y verificable antes de ampliar cálculos, asesores o simuladores.

## Qué se ha implantado

- Identidad estable para proyectos, decisiones de deuda y partidas personalizadas.
- Estados normalizados: simulado, pendiente, aprobado, fijo, ejecutado y cancelado.
- Procedencia explícita: verificado, declarado, estimado e hipotético.
- Migración automática y no destructiva desde el estado local o sincronizado existente.
- Inventario canónico de proyectos, deuda, datos reales, saldos, ajustes, eliminaciones, reglas bancarias y eventos de decisión.
- Huella del inventario y registro incremental de altas, cambios y bajas.
- Vista `Datos y auditoría` con calidad, procedencia, estado, identidad y cronología.
- Exportación del inventario canónico a JSON.

## Regla de seguridad

El modelo canónico es un índice de control. No sustituye todavía al motor financiero existente ni reescribe los datos originales. La aplicación sigue calculando con el modelo actual mientras la nueva capa detecta inconsistencias y prepara la migración gradual.

## Garantías cubiertas por pruebas

- Renombrar o reordenar un proyecto no cambia su identidad.
- Cambiar la modalidad de una decisión de deuda no crea otra deuda.
- Todos los ámbitos persistidos aparecen en el inventario.
- Los datos reales quedan marcados como verificados y ejecutados.
- Las eliminaciones quedan como canceladas y no se regeneran silenciosamente.
- El historial distingue altas, modificaciones y bajas.
- Las transiciones de estado inválidas se rechazan.

## Pendiente para fases siguientes

- Incorporar también las líneas base procedentes del Excel como entidades canónicas de solo lectura.
- Hacer que los motores de flujo, deuda y ahorro consuman el modelo canónico directamente.
- Añadir reconciliación entre movimiento bancario, partida prevista y saldo de cuenta.
- Persistir un historial de auditoría remoto inmutable en Supabase.
