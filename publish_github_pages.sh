#!/usr/bin/env bash
set -euo pipefail

REPO_NAME="${1:-finanzas-casa-def}"
VISIBILITY="${2:-}"

if [[ "$VISIBILITY" != "public" && "$VISIBILITY" != "private" ]]; then
  echo "Uso: ./publish_github_pages.sh <nombre-repo> <public|private>"
  echo "Ejemplo: ./publish_github_pages.sh finanzas-casa-def public"
  echo
  echo "La publicación exige la puerta de pruebas y el artefacto anonimizado."
  exit 1
fi

if ! command -v gh >/dev/null 2>&1; then
  echo "Falta GitHub CLI. Instalala con:"
  echo "  brew install gh"
  exit 1
fi

if ! gh auth status >/dev/null 2>&1; then
  gh auth login --web
fi

OWNER="$(gh api user --jq .login)"

npm run verify

if gh repo view "$OWNER/$REPO_NAME" >/dev/null 2>&1; then
  if ! git remote get-url origin >/dev/null 2>&1; then
    git remote add origin "git@github.com:$OWNER/$REPO_NAME.git"
  fi
else
  gh repo create "$REPO_NAME" "--$VISIBILITY" --source=. --remote=origin --push
fi

gh api --method PUT "/repos/$OWNER/$REPO_NAME/pages" -f build_type=workflow >/dev/null

git push -u origin main

echo "Push completado. GitHub Actions verificará y publicará el artefacto. URL:"
echo "https://$OWNER.github.io/$REPO_NAME/"
