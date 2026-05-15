# Dashboard financiero familiar

App estatica para consultar el dashboard financiero, simulador de escenarios, detalle mensual previsto vs real y flujo de caja.

## Publicacion en GitHub Pages

Este repositorio esta preparado para publicarse desde la rama `main` y la carpeta raiz (`/`) de GitHub Pages.

URL esperada tras activar Pages:

```text
https://USUARIO.github.io/NOMBRE-REPO/
```

## Privacidad

La app contiene datos financieros personales dentro de `data.js`. Si se publica con GitHub Pages, la web quedara accesible desde internet segun la visibilidad configurada en GitHub Pages.

## Actualizar datos

Cuando se regenere el dashboard desde el Excel:

1. Copiar de nuevo `index.html`, `app.js`, `data.js` y `styles.css` desde la carpeta `app`.
2. Hacer commit y push a `main`.
3. GitHub Pages actualizara la web automaticamente.
