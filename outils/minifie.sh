#!/bin/sh
# minifie.sh: minifies the pages' scripts and styles in place, for the deployment only (.github/workflows/site.yml): the sources
# in git stay readable. No bundling, so every file keeps its name and its relative imports. Vendored libraries are left as they are.
#   sh outils/minifie.sh [folder]     (default: public)
set -e
P="${1:-public}"
FILES=$(ls "$P"/squelette/*.mjs "$P"/squelette/*.js "$P"/squelette/*.css "$P"/scene/*.mjs "$P"/scene/*.js "$P"/scene/*.css "$P"/insectes/runtime/*.mjs)
# (the version the server's lock file pins, never one fetched on the spot: npm ci in api/ first)
"$(dirname "$0")/../api/node_modules/.bin/esbuild" $FILES --minify --charset=utf8 --legal-comments=none --allow-overwrite --outbase="$P" --outdir="$P" --log-level=warning
