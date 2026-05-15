#!/usr/bin/env bash
set -euo pipefail

REPO_NAME="${1:-finanzas-casa-dashboard}"
VISIBILITY="${2:-}"

if [[ "$VISIBILITY" != "public" && "$VISIBILITY" != "private" ]]; then
  echo "Uso: ./publish_github_pages.sh <nombre-repo> <public|private>"
  echo "Ejemplo: ./publish_github_pages.sh finanzas-casa-dashboard public"
  echo
  echo "Aviso: GitHub Pages puede exponer la web publicamente. Este dashboard contiene datos financieros."
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

if gh repo view "$OWNER/$REPO_NAME" >/dev/null 2>&1; then
  if ! git remote get-url origin >/dev/null 2>&1; then
    git remote add origin "git@github.com:$OWNER/$REPO_NAME.git"
  fi
else
  gh repo create "$REPO_NAME" "--$VISIBILITY" --source=. --remote=origin --push
fi

git push -u origin main

payload="$(mktemp)"
printf '{"source":{"branch":"main","path":"/"}}' > "$payload"

if gh api "/repos/$OWNER/$REPO_NAME/pages" >/dev/null 2>&1; then
  gh api --method PUT "/repos/$OWNER/$REPO_NAME/pages" --input "$payload" >/dev/null
else
  gh api --method POST "/repos/$OWNER/$REPO_NAME/pages" --input "$payload" >/dev/null
fi

rm -f "$payload"

echo "Publicado. URL:"
echo "https://$OWNER.github.io/$REPO_NAME/"
