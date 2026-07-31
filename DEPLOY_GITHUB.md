# Despliegue controlado en GitHub Pages

## Configuración inicial

1. En GitHub abre `Settings` → `Pages`.
2. En `Build and deployment`, selecciona `GitHub Actions` como fuente.
3. En `Settings` → `Environments` → `github-pages`, limita el despliegue a `main`.
4. Activa las notificaciones de fallos de Actions para recibir los avisos del monitor.

No debe usarse `Deploy from a branch`: publicaría archivos internos de la raíz y evitaría la puerta de pruebas.

## Publicación

Antes de solicitar commit o push:

```bash
npm run verify
```

El workflow `.github/workflows/pages.yml` repite la verificación, crea un artefacto con la lista cerrada
de `dist/` y solo después lo despliega. Los pull requests se verifican, pero no se publican.

El sitio esperado es `https://javierbarriusom-a11y.github.io/finanzas-casa-def/`.

El workflow `availability.yml` comprueba cada seis horas HTTPS, arranque, recursos críticos, la marca de
datos demo y `version.json`. Un fallo queda visible y notificable en GitHub Actions.

## Rollback

1. Identifica el último commit publicado que superó la puerta y la revisión de privacidad.
2. Crea un revert no destructivo del cambio defectuoso: `git revert <commit_defectuoso>`.
3. Ejecuta `npm run verify` y confirma que el revert no reintroduce datos personales.
4. Tras autorización expresa, publica el commit de revert en `main`.
5. Comprueba el workflow, el hash nuevo de `version.json` y ejecuta manualmente `Published availability`.
6. Verifica la aplicación en escritorio y móvil.

Nunca se debe volver a una revisión anterior a la retirada de datos personales. No se usa `push --force`,
no se reescribe el historial y no se despliega un artefacto que no haya pasado la puerta.

## Durante una incidencia

La aplicación conserva el último estado en el navegador y en la cola durable. No borres IndexedDB ni
el almacenamiento local. Corrige o revierte el código, despliega y confirma que la sincronización pendiente
se reanuda sin duplicados.
