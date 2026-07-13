# Finanzas Casa DEF

Copia de trabajo independiente del dashboard financiero familiar. Esta version se usa para evolucionar la arquitectura, la experiencia ejecutiva y el modelo de deuda sin alterar la aplicacion estable.

## Estado de la evolución

- Fase 0: copias verificables, contrato de estado y pruebas de regresión.
- Fase 1: modelo canónico, identidades estables y vista de datos y auditoría.
- Fase 2: libro contable canónico, invariantes y conciliación banco vs. dato real.
- Fase 3: motor financiero canónico, contrato de cálculo, paridad e invariantes mensuales.

La documentación funcional de la fase actual está en [PHASE_3.md](PHASE_3.md).

## Ejecutar y verificar

```bash
npm test
python3 -m http.server 4182
```

Después abre `http://127.0.0.1:4182/index.html#reconciliation`.

## Publicacion en GitHub Pages

Este repositorio esta preparado para publicarse desde la rama `main` y la carpeta raiz (`/`) de GitHub Pages.

URL esperada tras activar Pages:

```text
https://javierbarriusom-a11y.github.io/finanzas-casa-def/
```

## Privacidad

La app contiene datos financieros personales dentro de `data.js`. Si se publica con GitHub Pages, la web quedara accesible desde internet segun la visibilidad configurada en GitHub Pages.

## Actualizar datos

Cuando se regenere el dashboard desde el Excel:

1. Copiar de nuevo `index.html`, `app.js`, `data.js` y `styles.css` desde la carpeta `app`.
2. Hacer commit y push a `main`.
3. GitHub Pages actualizara la web automaticamente.
