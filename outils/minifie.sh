#!/bin/sh
# minifie.sh: minifies the pages' scripts and styles in place, for the deployment only (.github/workflows/site.yml): the sources
# in git stay readable. No bundling, so every file keeps its name and its relative imports. Vendored libraries are left as they are.
#   sh outils/minifie.sh [folder]     (default: public)
set -e
P="${1:-public}"
FILES=$(ls "$P"/squelette/*.mjs "$P"/squelette/*.js "$P"/squelette/*.css "$P"/scene/*.mjs "$P"/scene/*.js "$P"/scene/*.css "$P"/insectes/runtime/*.mjs)
npx --yes esbuild@0.24.0 $FILES --minify --charset=utf8 --legal-comments=none --allow-overwrite --outbase="$P" --outdir="$P" --out-extension:.js=.js --log-level=warning
# esbuild writes an .mjs source to a .js file unless told otherwise: put each one back under its own name
for f in $FILES; do
  case "$f" in
    *.mjs) [ -f "${f%.mjs}.js" ] && [ "${f%.mjs}.js" -nt "$f" ] && mv "${f%.mjs}.js" "$f" ;;
  esac
done
