# Publicar sin conector de GitHub

Tienes dos alternativas.

## Opcion A: GitHub CLI

1. Instala GitHub CLI si no esta instalada:

```bash
brew install gh
```

2. Autentica tu cuenta:

```bash
gh auth login --web
```

3. Desde esta carpeta, ejecuta:

```bash
./publish_github_pages.sh finanzas-casa-dashboard public
```

La URL final tendra este formato:

```text
https://TU_USUARIO.github.io/finanzas-casa-dashboard/
```

## Opcion B: Subida manual

1. Entra en GitHub y crea un repositorio nuevo llamado `finanzas-casa-dashboard`.
2. Sube los archivos del ZIP `dashboard-finanzas-casa-github-pages.zip` a la raiz del repositorio.
3. Ve a `Settings` > `Pages`.
4. En `Build and deployment`, selecciona:
   - Source: `Deploy from a branch`
   - Branch: `main`
   - Folder: `/ (root)`
5. Guarda. GitHub mostrara la URL publicada.

## Aviso de privacidad

`data.js` contiene datos financieros personales. Si publicas con GitHub Pages en una URL publica, cualquier persona con el enlace podria acceder a esos datos.
